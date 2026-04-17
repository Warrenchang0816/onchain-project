package user

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
	"go-service/internal/platform/faceai"
	"go-service/internal/platform/notify"
	"go-service/internal/platform/ocr"
	"go-service/internal/platform/storage"
)

// ChainSyncer is satisfied by *indexer.Indexer.
// Defined here to avoid importing the indexer package in this module.
type ChainSyncer interface {
	SyncAll(ctx context.Context) error
}

type Service struct {
	userRepo       *repository.UserRepository
	kycRepo        *repository.KYCSubmissionRepository
	credentialRepo *repository.UserCredentialRepository
	otpRepo        *repository.OTPRepository
	identitySvc    IdentityContractService
	ekycCfg        *config.EKYCConfig

	storageSvc   *storage.Client
	visionClient *ocr.VisionClient
	faceClient   *faceai.RekognitionClient
	chainSyncer  ChainSyncer // nil when blockchain is disabled

	emailSender *notify.EmailSender
	smsSender   *notify.MitakeSender
}

func NewService(
	userRepo *repository.UserRepository,
	kycRepo *repository.KYCSubmissionRepository,
	credentialRepo *repository.UserCredentialRepository,
	otpRepo *repository.OTPRepository,
	identitySvc IdentityContractService,
	ekycCfg *config.EKYCConfig,
	storageSvc *storage.Client,
	visionClient *ocr.VisionClient,
	faceClient *faceai.RekognitionClient,
	chainSyncer ChainSyncer,
	emailSender *notify.EmailSender,
	smsSender *notify.MitakeSender,
) *Service {
	return &Service{
		userRepo:       userRepo,
		kycRepo:        kycRepo,
		credentialRepo: credentialRepo,
		otpRepo:        otpRepo,
		identitySvc:    identitySvc,
		ekycCfg:        ekycCfg,
		storageSvc:     storageSvc,
		visionClient:   visionClient,
		faceClient:     faceClient,
		chainSyncer:    chainSyncer,
		emailSender:    emailSender,
		smsSender:      smsSender,
	}
}

func (s *Service) GetKYCStatus(walletAddress string) (*KYCStatusResponse, error) {
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return &KYCStatusResponse{KYCStatus: model.KYCStatusUnverified, Credentials: []string{}}, nil
	}

	resp := &KYCStatusResponse{KYCStatus: user.KYCStatus, Credentials: []string{}}
	if user.IdentityNFTTokenID.Valid {
		v := user.IdentityNFTTokenID.Int64
		resp.IdentityNFTTokenID = &v
	}
	if user.KYCMintTxHash.Valid {
		v := user.KYCMintTxHash.String
		resp.KYCMintTxHash = &v
	}

	// Append verified credential types (OWNER, TENANT, AGENT).
	if creds, credErr := s.credentialRepo.FindByUser(user.ID); credErr == nil {
		for _, c := range creds {
			if c.ReviewStatus == model.CredentialReviewVerified {
				resp.Credentials = append(resp.Credentials, c.CredentialType)
			}
		}
	}

	return resp, nil
}

// GetProfile returns the full member profile for a wallet, unmasked.
func (s *Service) GetProfile(walletAddress string) (*UserProfileResponse, error) {
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	resp := &UserProfileResponse{
		WalletAddress:  user.WalletAddress,
		DisplayName:    nullStr(user.DisplayName),
		Email:          nullStr(user.Email),
		Phone:          nullStr(user.Phone),
		MailingAddress: nullStr(user.MailingAddress),
		KYCStatus:      user.KYCStatus,
		Credentials:    []string{},
		CreatedAt:      user.CreatedAt.UTC().Format(time.RFC3339),
	}

	if user.KYCSubmittedAt.Valid {
		v := user.KYCSubmittedAt.Time.UTC().Format(time.RFC3339)
		resp.KYCSubmittedAt = &v
	}
	if user.KYCVerifiedAt.Valid {
		v := user.KYCVerifiedAt.Time.UTC().Format(time.RFC3339)
		resp.KYCVerifiedAt = &v
	}
	if user.IdentityNFTTokenID.Valid {
		v := user.IdentityNFTTokenID.Int64
		resp.IdentityNFTTokenID = &v
	}
	if user.KYCMintTxHash.Valid && strings.HasPrefix(user.KYCMintTxHash.String, "0x") {
		v := user.KYCMintTxHash.String
		resp.KYCMintTxHash = &v
	}

	// Enrich with OCR data from the latest KYC submission
	if sub, subErr := s.kycRepo.FindLatestByWallet(walletAddress); subErr == nil && sub != nil {
		if sub.OCRIDNumber.Valid {
			resp.IDNumber = sub.OCRIDNumber.String
			resp.Gender = genderFromIDNumber(sub.OCRIDNumber.String)
		}
		if sub.OCRBirthDate.Valid {
			resp.BirthDate = sub.OCRBirthDate.String
		}
		if sub.OCRAddress.Valid {
			resp.RegisteredAddress = sub.OCRAddress.String
		}
	}

	if creds, credErr := s.credentialRepo.FindByUser(user.ID); credErr == nil {
		for _, c := range creds {
			if c.ReviewStatus == model.CredentialReviewVerified {
				resp.Credentials = append(resp.Credentials, c.CredentialType)
			}
		}
	}

	return resp, nil
}

// genderFromIDNumber derives gender from a Taiwan ID number.
// Second character: '1' = male (男), '2' = female (女).
func genderFromIDNumber(id string) string {
	if len(id) < 2 {
		return ""
	}
	switch id[1] {
	case '1':
		return "男"
	case '2':
		return "女"
	}
	return ""
}

// --- Contact change flows (email / phone / mailing address) ---

const otpTTL = 5 * time.Minute

func (s *Service) generateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// RequestEmailChange sends a 6-digit OTP to newEmail.
func (s *Service) RequestEmailChange(walletAddress, newEmail string) error {
	if newEmail == "" {
		return errors.New("email is required")
	}
	if err := s.checkOTPRateLimit(newEmail, "email"); err != nil {
		return err
	}
	code, err := s.generateOTP()
	if err != nil {
		return err
	}
	if err := s.otpRepo.Create(newEmail, "email", code, nil, time.Now().Add(otpTTL)); err != nil {
		return err
	}
	return s.emailSender.SendOTP(newEmail, code)
}

// VerifyEmailChange verifies the OTP and updates the user's email.
func (s *Service) VerifyEmailChange(walletAddress, newEmail, otp string) error {
	ok, err := s.otpRepo.Verify(newEmail, "email", otp)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("驗證碼錯誤或已過期")
	}
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil || user == nil {
		return errors.New("user not found")
	}
	return s.userRepo.UpdateEmail(user.ID, newEmail)
}

// RequestPhoneChange sends a 6-digit OTP to newPhone via SMS.
func (s *Service) RequestPhoneChange(walletAddress, newPhone string) error {
	if newPhone == "" {
		return errors.New("phone is required")
	}
	if err := s.checkOTPRateLimit(newPhone, "sms"); err != nil {
		return err
	}
	code, err := s.generateOTP()
	if err != nil {
		return err
	}
	if err := s.otpRepo.Create(newPhone, "sms", code, nil, time.Now().Add(otpTTL)); err != nil {
		return err
	}
	return s.smsSender.SendOTP(newPhone, code)
}

// VerifyPhoneChange verifies the OTP and updates the user's phone.
func (s *Service) VerifyPhoneChange(walletAddress, newPhone, otp string) error {
	ok, err := s.otpRepo.Verify(newPhone, "sms", otp)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("驗證碼錯誤或已過期")
	}
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil || user == nil {
		return errors.New("user not found")
	}
	return s.userRepo.UpdatePhone(user.ID, newPhone)
}

// RequestMailingAddressOTP sends a 6-digit OTP to the user's existing email or phone.
// channel must be "email" or "phone".
func (s *Service) RequestMailingAddressOTP(walletAddress, channel string) error {
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil || user == nil {
		return errors.New("user not found")
	}
	switch channel {
	case "email":
		email := nullStr(user.Email)
		if email == "" {
			return errors.New("此帳號尚未設定 Email")
		}
		if err := s.checkOTPRateLimit(email, "email"); err != nil {
			return err
		}
		code, err := s.generateOTP()
		if err != nil {
			return err
		}
		if err := s.otpRepo.Create(email, "email", code, nil, time.Now().Add(otpTTL)); err != nil {
			return err
		}
		return s.emailSender.SendOTP(email, code)
	case "phone":
		phone := nullStr(user.Phone)
		if phone == "" {
			return errors.New("此帳號尚未設定手機號碼")
		}
		if err := s.checkOTPRateLimit(phone, "sms"); err != nil {
			return err
		}
		code, err := s.generateOTP()
		if err != nil {
			return err
		}
		if err := s.otpRepo.Create(phone, "sms", code, nil, time.Now().Add(otpTTL)); err != nil {
			return err
		}
		return s.smsSender.SendOTP(phone, code)
	default:
		return errors.New("channel must be 'email' or 'phone'")
	}
}

// UpdateMailingAddress verifies OTP against existing email/phone and updates mailing_address.
func (s *Service) UpdateMailingAddress(walletAddress, newAddress, channel, otp string) error {
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil || user == nil {
		return errors.New("user not found")
	}
	var target, otpChannel string
	switch channel {
	case "email":
		target = nullStr(user.Email)
		otpChannel = "email"
	case "phone":
		target = nullStr(user.Phone)
		otpChannel = "sms"
	default:
		return errors.New("channel must be 'email' or 'phone'")
	}
	if target == "" {
		return errors.New("對應的聯絡方式尚未設定")
	}
	ok, err := s.otpRepo.Verify(target, otpChannel, otp)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("驗證碼錯誤或已過期")
	}
	return s.userRepo.UpdateMailingAddress(user.ID, newAddress)
}

func (s *Service) checkOTPRateLimit(target, channel string) error {
	last, err := s.otpRepo.LatestCreatedAt(target, channel)
	if err != nil {
		return err
	}
	if !last.IsZero() && time.Since(last) < 60*time.Second {
		return errors.New("請等待 60 秒後再重新發送驗證碼")
	}
	return nil
}

func nullStr(s sql.NullString) string {
	if s.Valid {
		return s.String
	}
	return ""
}

func (s *Service) CreateKYCSubmission(ctx context.Context, walletAddress, documentType string) (*KYCSubmissionResponse, error) {
	if walletAddress == "" {
		return nil, errors.New("wallet is required")
	}
	user, err := s.userRepo.FindOrCreate(walletAddress)
	if err != nil {
		return nil, err
	}
	if user.KYCStatus == model.KYCStatusVerified {
		return nil, errors.New("wallet is already KYC verified")
	}
	if err := s.userRepo.SetKYCPending(user.ID); err != nil {
		return nil, err
	}
	id, err := s.kycRepo.Create(user.ID, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("kyc: create submission: %w", err)
	}
	return &KYCSubmissionResponse{SubmissionID: id, Status: model.KYCPipelineDraft, Message: "KYC submission created"}, nil
}

func (s *Service) UploadKYCSubmissionDocuments(ctx context.Context, walletAddress string, submissionID int64, idFrontData, idBackData, selfieData []byte) (*KYCSubmissionResponse, error) {
	sub, err := s.requireSubmissionOwner(submissionID, walletAddress)
	if err != nil {
		return nil, err
	}
	if s.storageSvc == nil {
		return nil, errors.New("storage service is not configured")
	}

	prefix := fmt.Sprintf("kyc/%s/%d", strings.ToLower(walletAddress), submissionID)
	frontPath := prefix + "/id_front.jpg"
	backPath := prefix + "/id_back.jpg"
	selfiePath := prefix + "/selfie.jpg"

	if err := s.storageSvc.Upload(ctx, frontPath, idFrontData, "image/jpeg"); err != nil {
		return nil, fmt.Errorf("kyc: upload id front: %w", err)
	}
	if err := s.storageSvc.Upload(ctx, backPath, idBackData, "image/jpeg"); err != nil {
		return nil, fmt.Errorf("kyc: upload id back: %w", err)
	}
	if err := s.storageSvc.Upload(ctx, selfiePath, selfieData, "image/jpeg"); err != nil {
		return nil, fmt.Errorf("kyc: upload selfie: %w", err)
	}
	if err := s.kycRepo.SetPaths(sub.ID, frontPath, backPath, selfiePath); err != nil {
		return nil, fmt.Errorf("kyc: set paths: %w", err)
	}
	if err := s.kycRepo.SetStatus(sub.ID, model.KYCPipelineUploaded); err != nil {
		return nil, fmt.Errorf("kyc: set status: %w", err)
	}

	return &KYCSubmissionResponse{SubmissionID: sub.ID, Status: model.KYCPipelineUploaded, Message: "KYC documents uploaded"}, nil
}

func (s *Service) AnalyzeKYCSubmission(ctx context.Context, walletAddress string, submissionID int64) (*SubmitKYCResponse, error) {
	sub, err := s.requireSubmissionOwner(submissionID, walletAddress)
	if err != nil {
		return nil, err
	}
	if s.storageSvc == nil {
		return nil, errors.New("storage service is not configured")
	}
	if !sub.IDFrontPath.Valid || !sub.IDBackPath.Valid || !sub.SelfiePath.Valid {
		return nil, errors.New("submission documents are incomplete")
	}

	idFrontData, err := s.storageSvc.Download(ctx, sub.IDFrontPath.String)
	if err != nil {
		return nil, fmt.Errorf("kyc: download id front: %w", err)
	}
	idBackData, err := s.storageSvc.Download(ctx, sub.IDBackPath.String)
	if err != nil {
		return nil, fmt.Errorf("kyc: download id back: %w", err)
	}
	selfieData, err := s.storageSvc.Download(ctx, sub.SelfiePath.String)
	if err != nil {
		return nil, fmt.Errorf("kyc: download selfie: %w", err)
	}

	return s.analyzeSubmissionData(ctx, sub, idFrontData, idBackData, selfieData)
}

func (s *Service) GetKYCSubmission(ctx context.Context, walletAddress string, submissionID int64) (*KYCSubmissionDetailResponse, error) {
	sub, err := s.requireSubmissionOwner(submissionID, walletAddress)
	if err != nil {
		return nil, err
	}
	resp := &KYCSubmissionDetailResponse{
		SubmissionID:  sub.ID,
		WalletAddress: sub.WalletAddress,
		ReviewStatus:  sub.ReviewStatus,
		OCRSuccess:    sub.OCRSuccess,
		SubmittedAt:   sub.SubmittedAt.Format(time.RFC3339),
	}
	if sub.FaceMatchScore.Valid {
		v := sub.FaceMatchScore.Float64
		resp.FaceMatchScore = &v
	}
	if sub.OCRName.Valid {
		v := sub.OCRName.String
		resp.OCRName = &v
	}
	if sub.OCRBirthDate.Valid {
		v := sub.OCRBirthDate.String
		resp.OCRBirthDate = &v
	}
	if sub.OCRAddress.Valid {
		v := sub.OCRAddress.String
		resp.OCRAddress = &v
	}
	if sub.ReviewedAt.Valid {
		v := sub.ReviewedAt.Time.Format(time.RFC3339)
		resp.ReviewedAt = &v
	}
	checks := buildFieldChecks(
		sub.OCRName.Valid,
		sub.OCRBirthDate.Valid,
		sub.IdentityHash.Valid,
		sub.OCRAddress.Valid,
		nullFloat64FromSQL(sub.FaceMatchScore),
	)
	resp.FieldChecks = &checks
	return resp, nil
}

func (s *Service) AdminReview(ctx context.Context, submissionID int64, action, note, adminWallet string) error {
	sub, err := s.kycRepo.FindByID(submissionID)
	if err != nil {
		return err
	}
	if sub == nil {
		return errors.New("submission not found")
	}
	if sub.ReviewStatus != model.KYCReviewManualReview && sub.ReviewStatus != model.KYCReviewPending {
		return fmt.Errorf("submission is already %s", sub.ReviewStatus)
	}

	switch action {
	case "approve":
		user, err := s.userRepo.FindByWallet(sub.WalletAddress)
		if err != nil || user == nil {
			return fmt.Errorf("kyc: admin approve: user not found: %w", err)
		}
		identityHash := ""
		if sub.IdentityHash.Valid {
			identityHash = sub.IdentityHash.String
		}
		if err := s.mintIdentityNFT(ctx, user, sub.WalletAddress, "", identityHash); err != nil {
			return fmt.Errorf("kyc: admin approve: mint failed: %w", err)
		}
		if err := s.kycRepo.SetReviewStatus(submissionID, model.KYCReviewVerified, note, &adminWallet); err != nil {
			return err
		}
	case "reject":
		if err := s.kycRepo.SetReviewStatus(submissionID, model.KYCReviewRejected, note, &adminWallet); err != nil {
			return err
		}
		if user, err := s.userRepo.FindByWallet(sub.WalletAddress); err == nil && user != nil {
			_ = s.userRepo.SetKYCRejected(user.ID)
		}
	default:
		return fmt.Errorf("unknown action %q: must be 'approve' or 'reject'", action)
	}
	return nil
}

func (s *Service) analyzeSubmissionData(ctx context.Context, sub *model.KYCSubmission, idFrontData, idBackData, selfieData []byte) (*SubmitKYCResponse, error) {
	if err := s.kycRepo.SetStatus(sub.ID, model.KYCPipelineOCRProcessing); err != nil {
		return nil, err
	}

	frontText, frontErr := s.visionClient.ExtractText(idFrontData)
	backText, backErr := s.visionClient.ExtractText(idBackData)

	var frontFields ocr.IDCardFront
	var backFields ocr.IDCardBack
	if frontErr == nil {
		frontFields = ocr.ParseFront(frontText)
	}
	if backErr == nil {
		backFields = ocr.ParseBack(backText)
	}
	ocrSuccess := frontErr == nil && backErr == nil && frontFields.IDNumber != ""

	if err := s.kycRepo.SetStatus(sub.ID, model.KYCPipelineFaceProcessing); err != nil {
		return nil, err
	}

	var faceScore float32
	if s.faceClient != nil {
		comparedScore, compareErr := s.faceClient.CompareFaces(ctx, idFrontData, selfieData)
		if compareErr == nil {
			faceScore = comparedScore
		}
	}

	var identityHash string
	if frontFields.IDNumber != "" {
		raw := frontFields.IDNumber + strings.ToLower(sub.WalletAddress)
		h := sha256.Sum256([]byte(raw))
		identityHash = hex.EncodeToString(h[:])
	}

	if identityHash != "" {
		existing, err := s.kycRepo.FindByIdentityHash(identityHash)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.WalletAddress != sub.WalletAddress {
			return nil, errors.New("kyc: this identity is already bound to another wallet")
		}
	}

	ocrParams := repository.OCRResultParams{
		Name:           frontFields.Name,
		IDNumber:       frontFields.IDNumber,
		IdentityHash:   identityHash,
		BirthDate:      frontFields.BirthDate,
		IssueDate:      frontFields.IssueDate,
		IssueLocation:  frontFields.IssueLocation,
		Address:        backFields.Address,
		FatherName:     backFields.FatherName,
		MotherName:     backFields.MotherName,
		SpouseName:     backFields.SpouseName,
		FaceMatchScore: float64(faceScore),
		OCRSuccess:     ocrSuccess,
	}
	if err := s.kycRepo.SetOCRResult(sub.ID, ocrParams); err != nil {
		return nil, fmt.Errorf("kyc: set ocr result: %w", err)
	}

	reviewStatus := s.decideReviewStatus(faceScore, ocrSuccess)
	if err := s.kycRepo.SetReviewStatus(sub.ID, reviewStatus, "", nil); err != nil {
		return nil, fmt.Errorf("kyc: set review status: %w", err)
	}

	user, err := s.userRepo.FindByWallet(sub.WalletAddress)
	if err != nil || user == nil {
		return nil, fmt.Errorf("kyc: user not found: %w", err)
	}

	if reviewStatus == model.KYCReviewAutoVerified {
		if err := s.mintIdentityNFT(ctx, user, sub.WalletAddress, frontFields.IDNumber, identityHash); err != nil {
			_ = s.kycRepo.SetReviewStatus(sub.ID, model.KYCReviewManualReview, "mint failed: "+err.Error(), nil)
			reviewStatus = model.KYCReviewManualReview
		}
	}
	if reviewStatus == model.KYCReviewRejected {
		_ = s.userRepo.SetKYCRejected(user.ID)
	}

	checks := buildFieldChecks(frontFields.Name != "", frontFields.BirthDate != "", frontFields.IDNumber != "", backFields.Address != "", nullFloat64(faceScore))
	msg := reviewStatusMessage(reviewStatus)
	return &SubmitKYCResponse{
		SubmissionID:   sub.ID,
		ReviewStatus:   reviewStatus,
		FaceMatchScore: float64(faceScore),
		OCRSuccess:     ocrSuccess,
		FieldChecks:    checks,
		Message:        msg,
	}, nil
}

func (s *Service) requireSubmissionOwner(submissionID int64, walletAddress string) (*model.KYCSubmission, error) {
	sub, err := s.kycRepo.FindByID(submissionID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, errors.New("submission not found")
	}
	if !strings.EqualFold(sub.WalletAddress, walletAddress) {
		return nil, errors.New("forbidden")
	}
	return sub, nil
}

func (s *Service) decideReviewStatus(faceScore float32, ocrSuccess bool) string {
	if !ocrSuccess {
		return model.KYCReviewManualReview
	}
	autoPass := s.ekycCfg.FaceAutoPassScore
	manual := s.ekycCfg.FaceManualReviewScore
	switch {
	case faceScore >= autoPass:
		return model.KYCReviewAutoVerified
	case faceScore >= manual:
		return model.KYCReviewManualReview
	default:
		return model.KYCReviewRejected
	}
}

func (s *Service) mintIdentityNFT(ctx context.Context, user *model.User, walletAddress, idNumber, identityHash string) error {
	refHash := blockchain.HashFields(identityHash)
	var idHash [32]byte
	if identityHash != "" {
		decoded, err := hex.DecodeString(identityHash)
		if err == nil && len(decoded) == 32 {
			copy(idHash[:], decoded)
		}
	} else {
		idHash = blockchain.HashFields(idNumber, walletAddress)
	}

	if err := s.userRepo.SetKYCMinting(user.ID, identityHash); err != nil {
		return fmt.Errorf("persist minting: %w", err)
	}

	mintCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	txHash, tokenID, err := s.identitySvc.Mint(mintCtx, walletAddress, "eKYC", refHash, idHash)
	if err != nil {
		return fmt.Errorf("mint SBT: %w", err)
	}

	// Update DB immediately from receipt data — do not wait for indexer's ConfirmationBlocks.
	if dbErr := s.userRepo.SetKYCVerified(walletAddress, tokenID, txHash); dbErr != nil {
		log.Printf("[user/service] SetKYCVerified failed (non-fatal, indexer will retry): %v", dbErr)
	}

	if s.chainSyncer != nil {
		if err := s.chainSyncer.SyncAll(ctx); err != nil {
			log.Printf("[user/service] post-mint sync error (non-fatal): %v", err)
		}
	}
	return nil
}

func reviewStatusMessage(status string) string {
	switch status {
	case model.KYCReviewAutoVerified:
		return "KYC auto-verified. Your identity NFT is being minted."
	case model.KYCReviewManualReview:
		return "KYC submitted for manual review."
	case model.KYCReviewRejected:
		return "KYC rejected: face similarity too low or OCR failed. Please retry with clearer photos."
	default:
		return "KYC submission received."
	}
}

func buildFieldChecks(hasName, hasBirthDate, hasDocumentNumber, hasAddress bool, faceScore *float64) KYCFieldChecks {
	checks := KYCFieldChecks{
		FullName:       passOrReview(hasName),
		BirthDate:      passOrReview(hasBirthDate),
		DocumentNumber: passOrReview(hasDocumentNumber),
		Address:        passOrReview(hasAddress),
		FaceMatch:      "REVIEW",
	}
	if faceScore != nil {
		switch {
		case *faceScore >= 85:
			checks.FaceMatch = "PASS"
		case *faceScore >= 70:
			checks.FaceMatch = "REVIEW"
		default:
			checks.FaceMatch = "FAIL"
		}
	}
	return checks
}

func passOrReview(ok bool) string {
	if ok {
		return "PASS"
	}
	return "REVIEW"
}

func nullFloat64(v float32) *float64 {
	f := float64(v)
	return &f
}

func nullFloat64FromSQL(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	f := v.Float64
	return &f
}
