package onboarding

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

	siwe "github.com/spruceid/siwe-go"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
	usermod "go-service/internal/modules/user"
	platformauth "go-service/internal/platform/auth"
	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
	"go-service/internal/platform/faceai"
	"go-service/internal/platform/notify"
	"go-service/internal/platform/ocr"
	"go-service/internal/platform/storage"
)

// ErrWalletAlreadyBound is returned when a wallet already holds a NATURAL_PERSON NFT on-chain.
type ErrWalletAlreadyBound struct{ IDHint string }

func (e *ErrWalletAlreadyBound) Error() string {
	return "wallet already bound to an identity on-chain"
}

// ErrEmailAlreadyUsed is returned when the email is already registered to another member.
type ErrEmailAlreadyUsed struct{ IDHint string }

func (e *ErrEmailAlreadyUsed) Error() string { return "此 Email 已被其他會員使用" }

// ErrEmailNotActivated is returned when the email is registered but the password has never been set.
type ErrEmailNotActivated struct{ Email string }

func (e *ErrEmailNotActivated) Error() string { return "此 Email 已完成 KYC 但尚未設定密碼" }

// ErrPhoneAlreadyUsed is returned when the phone is already registered to another member.
type ErrPhoneAlreadyUsed struct{ IDHint string }

func (e *ErrPhoneAlreadyUsed) Error() string { return "此手機號碼已被其他會員使用" }

// ErrIdentityAlreadyUsed is returned when the OCR identity (person_hash) already has an account.
type ErrIdentityAlreadyUsed struct{ IDHint string }

func (e *ErrIdentityAlreadyUsed) Error() string { return "此身分證字號已完成 KYC 綁定" }

// ChainSyncer is satisfied by *indexer.Indexer.
// Defined here to avoid importing the indexer package in this module.
type ChainSyncer interface {
	SyncAll(ctx context.Context) error
}

// Service orchestrates the KYC-first onboarding flow:
//
//	email OTP -> phone OTP -> document upload (OCR + face) -> confirm -> wallet bind
type Service struct {
	otpRepo        *repository.OTPRepository
	sessionRepo    *repository.KYCSessionRepository
	userRepo       *repository.UserRepository
	kycRepo        *repository.KYCSubmissionRepository
	nonceRepo      *repository.NonceRepository
	svcSessionRepo *repository.SessionRepository

	emailSender  *notify.EmailSender
	smsSender    *notify.MitakeSender
	storageSvc   *storage.Client
	visionClient *ocr.VisionClient
	faceClient   *faceai.RekognitionClient
	identitySvc  usermod.IdentityContractService
	chainSyncer  ChainSyncer // nil when blockchain is disabled

	ekycCfg   *config.EKYCConfig
	notifyCfg *config.NotifyConfig
	siweCfg   *config.SIWEConfig
}

func NewService(
	otpRepo *repository.OTPRepository,
	sessionRepo *repository.KYCSessionRepository,
	userRepo *repository.UserRepository,
	kycRepo *repository.KYCSubmissionRepository,
	nonceRepo *repository.NonceRepository,
	svcSessionRepo *repository.SessionRepository,
	emailSender *notify.EmailSender,
	smsSender *notify.MitakeSender,
	storageSvc *storage.Client,
	visionClient *ocr.VisionClient,
	faceClient *faceai.RekognitionClient,
	identitySvc usermod.IdentityContractService,
	ekycCfg *config.EKYCConfig,
	notifyCfg *config.NotifyConfig,
	siweCfg *config.SIWEConfig,
	chainSyncer ChainSyncer,
) *Service {
	return &Service{
		otpRepo: otpRepo, sessionRepo: sessionRepo,
		userRepo: userRepo, kycRepo: kycRepo,
		nonceRepo: nonceRepo, svcSessionRepo: svcSessionRepo,
		emailSender: emailSender, smsSender: smsSender,
		storageSvc: storageSvc, visionClient: visionClient, faceClient: faceClient,
		identitySvc: identitySvc,
		chainSyncer: chainSyncer,
		ekycCfg:     ekycCfg, notifyCfg: notifyCfg, siweCfg: siweCfg,
	}
}

// Step 1: Email OTP

func (s *Service) RequestEmailOTP(email string) (*RequestEmailOTPResponse, error) {
	last, err := s.otpRepo.LatestCreatedAt(email, "email")
	if err != nil {
		return nil, err
	}
	if !last.IsZero() && time.Since(last) < 60*time.Second {
		return nil, errors.New("請在 60 秒後再重新發送驗證碼")
	}
	code, err := generateOTP()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(time.Duration(s.notifyCfg.OTPExpirySecs) * time.Second)
	if err := s.otpRepo.Create(email, "email", code, nil, expiresAt); err != nil {
		return nil, err
	}
	if err := s.emailSender.SendOTP(email, code); err != nil {
		return nil, err
	}
	// Check for an existing mid-flow session the user may want to resume.
	resp := &RequestEmailOTPResponse{OK: true, Message: "驗證碼已發送至 " + email}
	if existing, lookupErr := s.sessionRepo.FindActiveByEmail(email); lookupErr == nil && existing != nil {
		switch existing.Step {
		case model.KYCSessionStepStarted, model.KYCSessionStepWalletBound:
			// Not a resumable state; don't flag it.
		default:
			resp.HasActiveSession = true
			resp.ActiveStep = existing.Step
		}
	}
	return resp, nil
}

// VerifyEmailOTP returns (session, isResume, error).
// isResume=true means an active mid-flow session was found; the caller should
// ask the user whether to resume or restart before proceeding.
func (s *Service) VerifyEmailOTP(email, code string) (*model.KYCSession, bool, error) {
	ok, err := s.otpRepo.Verify(email, "email", code)
	if err != nil {
		return nil, false, err
	}
	if !ok {
		return nil, false, errors.New("驗證碼錯誤或已失效")
	}

	// Guard: email already registered to a completed member account.
	if registeredUser, lookupErr := s.userRepo.FindByEmail(email); lookupErr == nil && registeredUser != nil {
		if registeredUser.KYCStatus != model.KYCStatusUnverified {
			// If password was never set, tell the frontend to redirect to forgot-password.
			if !registeredUser.PasswordHash.Valid || registeredUser.PasswordHash.String == "" {
				return nil, false, &ErrEmailNotActivated{Email: email}
			}
			hint := ""
			if registeredUser.IDNumberHint.Valid {
				hint = registeredUser.IDNumberHint.String
			}
			return nil, false, &ErrEmailAlreadyUsed{IDHint: hint}
		}
	}

	existing, err := s.sessionRepo.FindActiveByEmail(email)
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		switch existing.Step {
		case model.KYCSessionStepWalletBound:
			return nil, false, errors.New("此信箱已完成 KYC 綁定，請直接登入")
		case model.KYCSessionStepStarted:
			// Normal first-time path: email just verified for the first time.
			if err := s.sessionRepo.MarkEmailVerified(existing.ID); err != nil {
				return nil, false, err
			}
			_ = s.sessionRepo.RefreshExpiry(existing.ID, s.notifyCfg.KYCSessionTTLMins)
			sess, err := s.sessionRepo.FindByID(existing.ID)
			return sess, false, err
		default:
			// Session already past EMAIL_VERIFIED → offer resume.
			_ = s.sessionRepo.RefreshExpiry(existing.ID, s.notifyCfg.KYCSessionTTLMins)
			return existing, true, nil
		}
	}
	// No existing active session → create fresh one.
	expiresAt := time.Now().Add(time.Duration(s.notifyCfg.KYCSessionTTLMins) * time.Minute)
	sess, err := s.sessionRepo.Create(email, expiresAt)
	if err != nil {
		return nil, false, err
	}
	if err := s.sessionRepo.MarkEmailVerified(sess.ID); err != nil {
		return nil, false, err
	}
	_ = s.sessionRepo.RefreshExpiry(sess.ID, s.notifyCfg.KYCSessionTTLMins)
	result, err := s.sessionRepo.FindByID(sess.ID)
	return result, false, err
}

// StartNewSession creates a brand-new email-verified session for the same email as
// oldSessionID. Called when the user explicitly chooses to restart rather than resume.
func (s *Service) StartNewSession(oldSessionID string) (*model.KYCSession, error) {
	old, err := s.sessionRepo.FindByID(oldSessionID)
	if err != nil {
		return nil, err
	}
	if old == nil || !old.Email.Valid || old.Email.String == "" {
		return nil, errors.New("session not found")
	}
	expiresAt := time.Now().Add(time.Duration(s.notifyCfg.KYCSessionTTLMins) * time.Minute)
	sess, err := s.sessionRepo.Create(old.Email.String, expiresAt)
	if err != nil {
		return nil, err
	}
	if err := s.sessionRepo.MarkEmailVerified(sess.ID); err != nil {
		return nil, err
	}
	_ = s.sessionRepo.RefreshExpiry(sess.ID, s.notifyCfg.KYCSessionTTLMins)
	return s.sessionRepo.FindByID(sess.ID)
}

// Step 2: Phone OTP

func (s *Service) RequestPhoneOTP(sessionID, phone string) error {
	sess, err := s.requireSession(sessionID)
	if err != nil {
		return err
	}
	if !sess.EmailVerified {
		return errors.New("請先完成 Email 驗證")
	}

	// Guard: phone already registered to a completed member account.
	if registeredUser, lookupErr := s.userRepo.FindByPhone(phone); lookupErr == nil && registeredUser != nil {
		if registeredUser.KYCStatus != model.KYCStatusUnverified {
			hint := ""
			if registeredUser.IDNumberHint.Valid {
				hint = registeredUser.IDNumberHint.String
			}
			return &ErrPhoneAlreadyUsed{IDHint: hint}
		}
	}

	if err := s.sessionRepo.SetPhone(sessionID, phone); err != nil {
		return err
	}
	last, err := s.otpRepo.LatestCreatedAt(phone, "sms")
	if err != nil {
		return err
	}
	if !last.IsZero() && time.Since(last) < 60*time.Second {
		return errors.New("請在 60 秒後再重新發送驗證碼")
	}
	code, err := generateOTP()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(time.Duration(s.notifyCfg.OTPExpirySecs) * time.Second)
	sid := sessionID
	if err := s.otpRepo.Create(phone, "sms", code, &sid, expiresAt); err != nil {
		return err
	}
	return s.smsSender.SendOTP(phone, code)
}

func (s *Service) VerifyPhoneOTP(sessionID, phone, code string) error {
	if _, err := s.requireSession(sessionID); err != nil {
		return err
	}
	ok, err := s.otpRepo.Verify(phone, "sms", code)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("驗證碼錯誤或已失效")
	}
	if err := s.sessionRepo.MarkPhoneVerified(sessionID); err != nil {
		return err
	}
	_ = s.sessionRepo.RefreshExpiry(sessionID, s.notifyCfg.KYCSessionTTLMins)
	return nil
}

// Step 3: Document upload + OCR + face match

func (s *Service) UploadKYCDocuments(
	ctx context.Context,
	stage string,
	sessionID string,
	idFrontData, idBackData, selfieData, secondDocData []byte,
) (*UploadKYCDocumentsResponse, error) {
	sess, err := s.requireSession(sessionID)
	if err != nil {
		return nil, err
	}
	if !sess.PhoneVerified {
		return nil, errors.New("請先完成手機驗證")
	}
	if s.storageSvc == nil {
		return nil, errors.New("storage service is not configured")
	}
	if stage == "" {
		stage = "full"
	}

	prefix := fmt.Sprintf("kyc/session/%s", sessionID)
	frontPath := prefix + "/id_front.jpg"
	backPath := prefix + "/id_back.jpg"
	selfiePath := prefix + "/selfie.jpg"
	secondDocPath := prefix + "/second_doc.jpg"

	switch stage {
	case "id_card":
		if len(idFrontData) == 0 || len(idBackData) == 0 {
			return nil, errors.New("id_front and id_back are required")
		}
		if err := s.storageSvc.Upload(ctx, frontPath, idFrontData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload id_front: %w", err)
		}
		if err := s.storageSvc.Upload(ctx, backPath, idBackData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload id_back: %w", err)
		}

		frontFields, backFields, personHash, idNumberHint, ocrSuccess, err := s.runOCRAndCheckUniqueness(idFrontData, idBackData)
		if err != nil {
			return nil, err
		}
		if err := s.sessionRepo.SetOCRResult(sessionID, repository.OCRSessionParams{
			PersonHash:       personHash,
			IDNumber:         frontFields.IDNumber,
			IDNumberHint:     idNumberHint,
			OCRName:          frontFields.Name,
			OCRGender:        deriveGender(frontFields.IDNumber),
			OCRBirthDate:     frontFields.BirthDate,
			OCRIssueDate:     frontFields.IssueDate,
			OCRIssueLocation: frontFields.IssueLocation,
			OCRAddress:       backFields.Address,
			OCRFatherName:    backFields.FatherName,
			OCRMotherName:    backFields.MotherName,
			IDFrontPath:      frontPath,
			IDBackPath:       backPath,
			FaceMatchScore:   0,
			OCRSuccess:       ocrSuccess,
		}); err != nil {
			return nil, err
		}

		return &UploadKYCDocumentsResponse{
			SessionID:        sessionID,
			Step:             model.KYCSessionStepOCRDone,
			Stage:            stage,
			IDNumber:         frontFields.IDNumber,
			IDNumberHint:     idNumberHint,
			OCRName:          frontFields.Name,
			OCRGender:        deriveGender(frontFields.IDNumber),
			OCRBirthDate:     frontFields.BirthDate,
			OCRIssueDate:     frontFields.IssueDate,
			OCRIssueLocation: frontFields.IssueLocation,
			OCRAddress:       backFields.Address,
			OCRFatherName:    backFields.FatherName,
			OCRMotherName:    backFields.MotherName,
			OCRSuccess:       ocrSuccess,
		}, nil

	case "second_doc":
		if sess.Step != model.KYCSessionStepConfirmed {
			return nil, errors.New("請先完成資料確認")
		}
		if len(secondDocData) == 0 {
			return nil, errors.New("second_doc is required")
		}
		if err := s.storageSvc.Upload(ctx, secondDocPath, secondDocData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload second_doc: %w", err)
		}
		if err := s.sessionRepo.SetDocumentPaths(sessionID, "", "", secondDocPath, ""); err != nil {
			return nil, err
		}

		// OCR the second document and compare its ID number against the primary ID.
		var secondDocIDMatch bool
		devBypassMode := s.ekycCfg.DevAutoApprove && s.visionClient == nil
		if devBypassMode {
			// Dev mode: no OCR service, assume match.
			secondDocIDMatch = true
		} else if s.visionClient != nil && sess.PersonHash.Valid && sess.PersonHash.String != "" {
			if docText, ocrErr := s.visionClient.ExtractText(secondDocData); ocrErr == nil {
				if extracted := ocr.ExtractTaiwanIDNumber(docText); extracted != "" {
					h := sha256.Sum256([]byte(strings.ToUpper(extracted)))
					if hex.EncodeToString(h[:]) == sess.PersonHash.String {
						secondDocIDMatch = true
					}
				}
			}
		}

		return &UploadKYCDocumentsResponse{
			SessionID:        sessionID,
			Step:             sess.Step,
			Stage:            stage,
			OCRName:          nullableStr(sess.ConfirmedName),
			OCRBirthDate:     nullableStr(sess.ConfirmedBirthDate),
			OCRAddress:       nullableStr(sess.OCRAddress),
			IDNumberHint:     nullableStr(sess.OCRIDNumberHint),
			OCRSuccess:       sess.OCRSuccess,
			SecondDocIDMatch: secondDocIDMatch,
		}, nil

	case "selfie":
		if sess.Step != model.KYCSessionStepConfirmed {
			return nil, errors.New("請先完成資料確認")
		}
		if !sess.IDFrontPath.Valid || sess.IDFrontPath.String == "" {
			return nil, errors.New("請先完成身分證上傳")
		}
		if len(selfieData) == 0 {
			return nil, errors.New("selfie is required")
		}
		if err := s.storageSvc.Upload(ctx, selfiePath, selfieData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload selfie: %w", err)
		}
		idFrontStored, err := s.storageSvc.Download(ctx, sess.IDFrontPath.String)
		if err != nil {
			return nil, fmt.Errorf("download id_front: %w", err)
		}
		var faceScore float64
		if s.faceClient != nil {
			score, compareErr := s.faceClient.CompareFaces(ctx, idFrontStored, selfieData)
			if compareErr == nil {
				faceScore = float64(score)
			}
		}
		if err := s.sessionRepo.SetDocumentPaths(sessionID, "", "", "", selfiePath); err != nil {
			return nil, err
		}
		if err := s.sessionRepo.SetFaceMatchResult(sessionID, faceScore); err != nil {
			return nil, err
		}

		return &UploadKYCDocumentsResponse{
			SessionID:      sessionID,
			Step:           sess.Step,
			Stage:          stage,
			OCRName:        nullableStr(sess.ConfirmedName),
			OCRBirthDate:   nullableStr(sess.ConfirmedBirthDate),
			OCRAddress:     nullableStr(sess.OCRAddress),
			IDNumberHint:   nullableStr(sess.OCRIDNumberHint),
			FaceMatchScore: faceScore,
			OCRSuccess:     sess.OCRSuccess,
		}, nil

	default:
		if len(idFrontData) == 0 || len(idBackData) == 0 || len(selfieData) == 0 {
			return nil, errors.New("id_front, id_back and selfie are required")
		}
		if err := s.storageSvc.Upload(ctx, frontPath, idFrontData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload id_front: %w", err)
		}
		if err := s.storageSvc.Upload(ctx, backPath, idBackData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload id_back: %w", err)
		}
		if err := s.storageSvc.Upload(ctx, selfiePath, selfieData, "image/jpeg"); err != nil {
			return nil, fmt.Errorf("upload selfie: %w", err)
		}
		if len(secondDocData) > 0 {
			if err := s.storageSvc.Upload(ctx, secondDocPath, secondDocData, "image/jpeg"); err != nil {
				return nil, fmt.Errorf("upload second_doc: %w", err)
			}
		} else {
			secondDocPath = ""
		}

		frontFields, backFields, personHash, idNumberHint, ocrSuccess, err := s.runOCRAndCheckUniqueness(idFrontData, idBackData)
		if err != nil {
			return nil, err
		}
		var faceScore float64
		if s.faceClient != nil {
			score, compareErr := s.faceClient.CompareFaces(ctx, idFrontData, selfieData)
			if compareErr == nil {
				faceScore = float64(score)
			}
		}

		if err := s.sessionRepo.SetOCRResult(sessionID, repository.OCRSessionParams{
			PersonHash:       personHash,
			IDNumber:         frontFields.IDNumber,
			IDNumberHint:     idNumberHint,
			OCRName:          frontFields.Name,
			OCRGender:        deriveGender(frontFields.IDNumber),
			OCRBirthDate:     frontFields.BirthDate,
			OCRIssueDate:     frontFields.IssueDate,
			OCRIssueLocation: frontFields.IssueLocation,
			OCRAddress:       backFields.Address,
			OCRFatherName:    backFields.FatherName,
			OCRMotherName:    backFields.MotherName,
			IDFrontPath:      frontPath,
			IDBackPath:       backPath,
			SelfiePath:       selfiePath,
			SecondDocPath:    secondDocPath,
			FaceMatchScore:   faceScore,
			OCRSuccess:       ocrSuccess,
		}); err != nil {
			return nil, err
		}

		return &UploadKYCDocumentsResponse{
			SessionID:        sessionID,
			Step:             model.KYCSessionStepOCRDone,
			Stage:            "full",
			IDNumber:         frontFields.IDNumber,
			IDNumberHint:     idNumberHint,
			OCRName:          frontFields.Name,
			OCRGender:        deriveGender(frontFields.IDNumber),
			OCRBirthDate:     frontFields.BirthDate,
			OCRIssueDate:     frontFields.IssueDate,
			OCRIssueLocation: frontFields.IssueLocation,
			OCRAddress:       backFields.Address,
			OCRFatherName:    backFields.FatherName,
			OCRMotherName:    backFields.MotherName,
			FaceMatchScore:   faceScore,
			OCRSuccess:       ocrSuccess,
		}, nil
	}
}

func deriveGender(idNumber string) string {
	if len(idNumber) < 2 {
		return ""
	}
	switch idNumber[1] {
	case '1':
		return "男"
	case '2':
		return "女"
	}
	return ""
}

// Step 4: Confirm OCR data (user edits pre-filled form)

func (s *Service) ConfirmKYCData(sessionID, confirmedName, confirmedBirthDate string) error {
	sess, err := s.requireSession(sessionID)
	if err != nil {
		return err
	}
	if sess.Step != model.KYCSessionStepOCRDone {
		return errors.New("請先完成身分證上傳與 OCR 分析")
	}
	if err := s.sessionRepo.ConfirmData(sessionID, confirmedName, confirmedBirthDate); err != nil {
		return err
	}
	_ = s.sessionRepo.RefreshExpiry(sessionID, s.notifyCfg.KYCSessionTTLMins)
	return nil
}

// Step 5: Build SIWE message for wallet binding

func (s *Service) BuildWalletMessage(sessionID, walletAddress string) (string, error) {
	sess, err := s.requireSession(sessionID)
	if err != nil {
		return "", err
	}
	if sess.Step != model.KYCSessionStepConfirmed {
		return "", errors.New("請先完成 KYC 資料確認")
	}
	if !sess.SecondDocPath.Valid || sess.SecondDocPath.String == "" {
		return "", errors.New("請先完成第二證件上傳")
	}
	if !sess.SelfiePath.Valid || sess.SelfiePath.String == "" {
		return "", errors.New("請先完成本人自拍上傳")
	}
	existing, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil {
		return "", err
	}
	if existing != nil {
		return "", errors.New("此錢包已綁定其他平台身份")
	}
	nonce, err := generateSIWENonce()
	if err != nil {
		return "", err
	}
	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	if err := s.nonceRepo.Create(walletAddress, nonce, expiresAt); err != nil {
		return "", err
	}
	return platformauth.BuildSIWEMessage(walletAddress, nonce, s.siweCfg), nil
}

// Step 6: Bind wallet, create user, create KYC submission, and mint NFT

func (s *Service) BindWallet(ctx context.Context, req BindWalletRequest) (*BindWalletResponse, error) {
	sess, err := s.requireSession(req.SessionID)
	if err != nil {
		return nil, err
	}
	if sess.Step != model.KYCSessionStepConfirmed {
		return nil, errors.New("請先完成 KYC 資料確認")
	}
	if err := s.verifySIWE(req.WalletAddress, req.SIWEMessage, req.SIWESignature); err != nil {
		return nil, fmt.Errorf("錢包簽名驗證失敗: %w", err)
	}

	// Pre-flight: check if this wallet already holds a NATURAL_PERSON NFT on-chain.
	// This prevents duplicate registrations and detects wallet re-use across identities.
	if verified, checkErr := s.identitySvc.IsVerified(ctx, req.WalletAddress); checkErr == nil && verified {
		idHint := ""
		if sess.OCRIDNumberHint.Valid {
			idHint = sess.OCRIDNumberHint.String
		}
		return nil, &ErrWalletAlreadyBound{IDHint: idHint}
	}

	// identity_hash = SHA-256(person_hash + lower(wallet))
	personHash := nullableStr(sess.PersonHash)
	idNumberHint := nullableStr(sess.OCRIDNumberHint)
	var identityHash string
	if personHash != "" {
		raw := personHash + strings.ToLower(req.WalletAddress)
		h := sha256.Sum256([]byte(raw))
		identityHash = hex.EncodeToString(h[:])
	}

	// Safety-net: identity (person_hash) already bound to another account.
	if personHash != "" {
		if existing, lookupErr := s.userRepo.FindByPersonHash(personHash); lookupErr == nil && existing != nil {
			return nil, &ErrIdentityAlreadyUsed{IDHint: idNumberHint}
		}
	}

	email := nullableStr(sess.Email)
	phone := nullableStr(sess.Phone)
	displayName := nullableStr(sess.ConfirmedName)

	userID, err := s.userRepo.CreateFromOnboarding(
		req.WalletAddress, email, phone, displayName, personHash, identityHash, idNumberHint,
	)
	if err != nil {
		return nil, fmt.Errorf("建立使用者失敗: %w", err)
	}
	if err := s.sessionRepo.MarkWalletBound(req.SessionID, userID); err != nil {
		return nil, err
	}

	// Formal KYC submission
	submissionID, err := s.kycRepo.Create(userID, req.WalletAddress)
	if err != nil {
		return nil, fmt.Errorf("建立 KYC submission 失敗: %w", err)
	}
	if sess.IDFrontPath.Valid {
		_ = s.kycRepo.SetPaths(submissionID,
			sess.IDFrontPath.String,
			sess.IDBackPath.String,
			sess.SelfiePath.String,
		)
	}
	faceScore := float64(0)
	if sess.FaceMatchScore.Valid {
		faceScore = sess.FaceMatchScore.Float64
	}
	_ = s.kycRepo.SetOCRResult(submissionID, repository.OCRResultParams{
		Name:           displayName,
		IDNumber:       nullableStr(sess.OCRIDNumber),
		IdentityHash:   identityHash,
		BirthDate:      nullableStr(sess.ConfirmedBirthDate),
		Address:        nullableStr(sess.OCRAddress),
		FaceMatchScore: faceScore,
		OCRSuccess:     sess.OCRSuccess,
	})

	if identityHash == "" {
		identityHash = buildOnboardingIdentityHash(personHash, displayName, nullableStr(sess.ConfirmedBirthDate), email, phone, req.WalletAddress)
		log.Printf("[onboarding/service] generated fallback identity hash for %s", req.WalletAddress)
		_ = s.kycRepo.SetOCRResult(submissionID, repository.OCRResultParams{
			Name:           displayName,
			IDNumber:       nullableStr(sess.OCRIDNumber),
			IdentityHash:   identityHash,
			BirthDate:      nullableStr(sess.ConfirmedBirthDate),
			Address:        nullableStr(sess.OCRAddress),
			FaceMatchScore: faceScore,
			OCRSuccess:     sess.OCRSuccess,
		})
	}

	// Derive raw ID number from person_hash is not possible; store hint only.
	// id_number_hint is already stored via CreateFromOnboarding above.

	reviewStatus := model.KYCReviewAutoVerified
	_ = s.kycRepo.SetReviewStatus(submissionID, reviewStatus, "", nil)

	user, lookupErr := s.userRepo.FindByWallet(req.WalletAddress)
	if lookupErr != nil || user == nil {
		return nil, fmt.Errorf("lookup user after wallet bind: %w", lookupErr)
	}

	if mintErr := s.mintNaturalPersonNFT(ctx, user, req.WalletAddress, identityHash); mintErr != nil {
		// Mint 是平台端的鏈上操作。使用者已完成 eKYC，mint 失敗不代表 KYC 不通過。
		// 降級為 MANUAL_REVIEW，由管理員介入補 mint；不對使用者回傳錯誤。
		log.Printf("[onboarding/service] NFT mint failed for %s (downgrade to manual review): %v", req.WalletAddress, mintErr)
		_ = s.kycRepo.SetReviewStatus(submissionID, model.KYCReviewManualReview, "mint failed: "+mintErr.Error(), nil)
	}

	// Re-read KYC status from DB — mint + sync may have already set it to VERIFIED.
	kycStatus := model.KYCStatusPending
	if refreshed, lookupErr := s.userRepo.FindByWallet(req.WalletAddress); lookupErr == nil && refreshed != nil {
		kycStatus = refreshed.KYCStatus
	}

	// Create auth session (log the user in)
	sessionExpiry := time.Now().UTC().Add(24 * time.Hour)
	sessionToken, err := s.svcSessionRepo.Create(req.WalletAddress, s.siweCfg.SIWEChainID, sessionExpiry)
	if err != nil {
		return nil, fmt.Errorf("建立登入 session 失敗: %w", err)
	}

	resp := &BindWalletResponse{
		WalletAddress: req.WalletAddress,
		KYCStatus:     kycStatus,
		Message:       reviewStatusMessage(reviewStatus),
		SessionToken:  sessionToken,
		SessionExpiry: sessionExpiry,
	}
	return resp, nil
}

// Internal helpers

func (s *Service) runOCRAndCheckUniqueness(idFrontData, idBackData []byte) (ocr.IDCardFront, ocr.IDCardBack, string, string, bool, error) {
	var frontFields ocr.IDCardFront
	var backFields ocr.IDCardBack
	var ocrSuccess bool
	if s.visionClient != nil {
		frontText, frontErr := s.visionClient.ExtractText(idFrontData)
		backText, backErr := s.visionClient.ExtractText(idBackData)
		if frontErr == nil {
			frontFields = ocr.ParseFront(frontText)
		}
		if backErr == nil {
			backFields = ocr.ParseBack(backText)
		}
		ocrSuccess = frontErr == nil && backErr == nil && frontFields.IDNumber != ""
	}

	frontFields.Name = strings.ToValidUTF8(frontFields.Name, "")
	frontFields.IDNumber = strings.ToValidUTF8(strings.ToUpper(frontFields.IDNumber), "")
	frontFields.BirthDate = strings.ToValidUTF8(frontFields.BirthDate, "")
	frontFields.IssueDate = strings.ToValidUTF8(frontFields.IssueDate, "")
	frontFields.IssueLocation = strings.ToValidUTF8(frontFields.IssueLocation, "")
	backFields.Address = strings.ToValidUTF8(backFields.Address, "")
	backFields.FatherName = strings.ToValidUTF8(backFields.FatherName, "")
	backFields.MotherName = strings.ToValidUTF8(backFields.MotherName, "")
	backFields.SpouseName = strings.ToValidUTF8(backFields.SpouseName, "")

	var personHash, idNumberHint string
	if frontFields.IDNumber != "" {
		h := sha256.Sum256([]byte(frontFields.IDNumber))
		personHash = hex.EncodeToString(h[:])
		id := frontFields.IDNumber
		if len(id) >= 5 {
			idNumberHint = string(id[0]) + "***" + id[len(id)-4:]
		}
		existing, err := s.userRepo.FindByPersonHash(personHash)
		if err != nil {
			return frontFields, backFields, "", "", false, err
		}
		if existing != nil {
			return frontFields, backFields, "", "", false, errors.New("此證件已完成註冊，不能重複建立平台身份")
		}
	}

	return frontFields, backFields, personHash, idNumberHint, ocrSuccess, nil
}
func (s *Service) requireSession(id string) (*model.KYCSession, error) {
	sess, err := s.sessionRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		return nil, errors.New("onboarding session 不存在")
	}
	if time.Now().After(sess.ExpiresAt) {
		return nil, errors.New("onboarding session 已過期")
	}
	if sess.Step == model.KYCSessionStepWalletBound {
		return nil, errors.New("此 session 已完成綁定")
	}
	return sess, nil
}

func (s *Service) verifySIWE(walletAddress, message, signature string) error {
	parsed, err := siwe.ParseMessage(message)
	if err != nil {
		return fmt.Errorf("parse SIWE message: %w", err)
	}
	nonce := parsed.GetNonce()
	nonceRecord, err := s.nonceRepo.FindLatestByWalletAddress(walletAddress)
	if err != nil || nonceRecord == nil {
		return errors.New("nonce not found")
	}
	if nonceRecord.Used || time.Now().UTC().After(nonceRecord.ExpiredAt) {
		return errors.New("nonce expired or already used")
	}
	domain := s.siweCfg.AppDomain
	if _, err := parsed.Verify(signature, &domain, &nonce, nil); err != nil {
		return fmt.Errorf("signature invalid: %w", err)
	}
	_ = s.nonceRepo.MarkUsed(nonceRecord.ID)
	return nil
}

func (s *Service) mintNaturalPersonNFT(ctx context.Context, user *model.User, walletAddress, identityHash string) error {
	decoded, err := hex.DecodeString(identityHash)
	if err != nil || len(decoded) != 32 {
		return fmt.Errorf("invalid identity hash")
	}
	var idHash [32]byte
	copy(idHash[:], decoded)
	refHash := blockchain.HashFields(identityHash)

	if err := s.userRepo.SetKYCMinting(user.ID, identityHash); err != nil {
		return err
	}
	mintCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	txHash, tokenID, err := s.identitySvc.Mint(mintCtx, walletAddress, "eKYC", refHash, idHash)
	if err != nil {
		// Check if the identity is already on-chain (e.g. DB was cleared but contract state persists).
		// "identity already bound" or "already has a natural person token" → wallet already holds NFT.
		errMsg := err.Error()
		if strings.Contains(errMsg, "already bound") || strings.Contains(errMsg, "already has") {
			if verified, checkErr := s.identitySvc.IsVerified(ctx, walletAddress); checkErr == nil && verified {
				log.Printf("[onboarding/service] wallet %s already holds NFT on-chain — syncing DB to VERIFIED", walletAddress)
				if dbErr := s.userRepo.SetKYCVerified(walletAddress, 1, "on-chain-sync"); dbErr != nil {
					log.Printf("[onboarding/service] SetKYCVerified (sync) failed: %v", dbErr)
				}
				return nil
			}
		}
		return err
	}

	// Update DB immediately from receipt data — do not wait for indexer's ConfirmationBlocks.
	if dbErr := s.userRepo.SetKYCVerified(walletAddress, tokenID, txHash); dbErr != nil {
		log.Printf("[onboarding/service] SetKYCVerified failed (non-fatal, indexer will retry): %v", dbErr)
	}

	if s.chainSyncer != nil {
		if syncErr := s.chainSyncer.SyncAll(ctx); syncErr != nil {
			log.Printf("[onboarding/service] post-mint sync error (non-fatal): %v", syncErr)
		}
	}
	return nil
}

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// generateSIWENonce generates a cryptographically random 12-character alphanumeric nonce.
// SIWE regex requires [a-zA-Z0-9]{8,} — 6-digit OTPs are too short.
func generateSIWENonce() (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const length = 12
	b := make([]byte, length)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		b[i] = charset[n.Int64()]
	}
	return string(b), nil
}

func buildOnboardingIdentityHash(personHash, displayName, birthDate, email, phone, walletAddress string) string {
	base := personHash
	if base == "" {
		base = strings.Join([]string{
			strings.TrimSpace(displayName),
			strings.TrimSpace(birthDate),
			strings.TrimSpace(email),
			strings.TrimSpace(phone),
		}, "|")
	}
	raw := base + "|" + strings.ToLower(strings.TrimSpace(walletAddress))
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func nullableStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func reviewStatusMessage(status string) string {
	switch status {
	case model.KYCReviewAutoVerified:
		return "KYC 驗證完成，身份 NFT 已發放。"
	case model.KYCReviewManualReview:
		return "KYC 已送出人工審核。"
	case model.KYCReviewRejected:
		return "KYC 驗證失敗，請重新提交。"
	default:
		return "KYC 流程已完成。"
	}
}
