package credential

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
	customermod "go-service/internal/modules/customer"
	usermod "go-service/internal/modules/user"
	"go-service/internal/platform/ocr"
	"go-service/internal/platform/storage"
)

type ChainSyncer interface {
	SyncAll(ctx context.Context) error
}

type OwnerDraftBootstrapper interface {
	BootstrapOwnerActivationDraft(ownerUserID, submissionID, propertyID int64, propertyAddress string) error
}

type OwnerPropertyBootstrapper interface {
	BootstrapOwnerCredentialProperty(in customermod.DisclosureInput) (int64, error)
}

type Service struct {
	userRepo               *repository.UserRepository
	submissionRepo         *repository.CredentialSubmissionRepository
	credentialRepo         *repository.UserCredentialRepository
	identitySvc            usermod.IdentityContractService
	storageSvc             *storage.Client
	visionClient           *ocr.VisionClient
	chainSyncer            ChainSyncer
	ownerPropertyBootstrap OwnerPropertyBootstrapper
	ownerDraftBootstrap    OwnerDraftBootstrapper
}

func NewService(
	userRepo *repository.UserRepository,
	submissionRepo *repository.CredentialSubmissionRepository,
	credentialRepo *repository.UserCredentialRepository,
	identitySvc usermod.IdentityContractService,
	storageSvc *storage.Client,
	visionClient *ocr.VisionClient,
	chainSyncer ChainSyncer,
	ownerPropertyBootstrap OwnerPropertyBootstrapper,
	ownerDraftBootstrap OwnerDraftBootstrapper,
) *Service {
	return &Service{
		userRepo:               userRepo,
		submissionRepo:         submissionRepo,
		credentialRepo:         credentialRepo,
		identitySvc:            identitySvc,
		storageSvc:             storageSvc,
		visionClient:           visionClient,
		chainSyncer:            chainSyncer,
		ownerPropertyBootstrap: ownerPropertyBootstrap,
		ownerDraftBootstrap:    ownerDraftBootstrap,
	}
}

func (s *Service) buildSubmissionDetail(sub *model.CredentialSubmission) (*CredentialSubmissionDetailResponse, error) {
	formPayload, err := decodeFormPayload(sub.FormPayloadJSON)
	if err != nil {
		return nil, err
	}

	displayStatus := DisplayStatusForSubmission(sub)

	detail := &CredentialSubmissionDetailResponse{
		SubmissionID:     sub.ID,
		CredentialType:   sub.CredentialType,
		ReviewRoute:      sub.ReviewRoute,
		DisplayStatus:    displayStatus,
		FormPayload:      formPayload,
		Notes:            sub.Notes,
		CanStopReview:    CanStopReview(sub.ReviewStatus),
		CanRestartReview: sub.ReviewStatus == CredentialReviewStopped || sub.ReviewStatus == CredentialReviewFailed,
		CanActivate:      sub.ReviewStatus == CredentialReviewPassed && sub.ActivationStatus == ActivationStatusReady,
	}

	if summary := strings.TrimSpace(sub.DecisionSummary); summary != "" {
		detail.Summary = stringPtr(summary)
	}
	if raw := strings.TrimSpace(sub.CheckResultJSON); raw != "" && raw != "{}" && raw != "null" {
		checks := map[string]string{}
		if jsonErr := json.Unmarshal([]byte(raw), &checks); jsonErr == nil && len(checks) > 0 {
			detail.Checks = checks
		}
	}
	if txHash := strings.TrimSpace(nullStringOrEmpty(sub.ActivationTxHash)); txHash != "" {
		detail.ActivationTxHash = stringPtr(txHash)
	}
	if sub.MainDocPath.Valid && strings.TrimSpace(sub.MainDocPath.String) != "" {
		url := fmt.Sprintf("/api/credentials/%s/submissions/%d/files/main", strings.ToLower(sub.CredentialType), sub.ID)
		detail.MainFileURL = &url
	}
	if sub.SupportDocPath.Valid && strings.TrimSpace(sub.SupportDocPath.String) != "" {
		url := fmt.Sprintf("/api/credentials/%s/submissions/%d/files/support", strings.ToLower(sub.CredentialType), sub.ID)
		detail.SupportFileURL = &url
	}
	return detail, nil
}

func (s *Service) GetLatestSubmissionDetail(ctx context.Context, wallet, credentialType string) (*CredentialSubmissionDetailResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	normalizedType, err := NormalizeType(credentialType)
	if err != nil {
		return nil, err
	}
	sub, err := s.submissionRepo.FindLatestByUserAndType(user.ID, normalizedType)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, nil
	}
	if DisplayStatusForSubmission(sub) == DisplayStatusNotStarted {
		return nil, nil
	}
	return s.buildSubmissionDetail(sub)
}

func (s *Service) StopSubmission(ctx context.Context, wallet, credentialType string, submissionID int64) (*CredentialSubmissionDetailResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, err
	}
	if !CanStopReview(sub.ReviewStatus) {
		return nil, errors.New("目前只有人工審核中的案件可以停止")
	}
	if err := s.submissionRepo.MarkStopped(sub.ID); err != nil {
		return nil, err
	}
	updated, err := s.submissionRepo.FindByID(sub.ID)
	if err != nil {
		return nil, err
	}
	return s.buildSubmissionDetail(updated)
}

func (s *Service) GetSubmissionFile(ctx context.Context, wallet, credentialType string, submissionID int64, kind string) ([]byte, string, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, "", err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, "", err
	}
	if s.storageSvc == nil {
		return nil, "", errors.New("檔案儲存服務未啟用")
	}

	var objectPath string
	switch kind {
	case "main":
		objectPath = nullStringOrEmpty(sub.MainDocPath)
	case "support":
		objectPath = nullStringOrEmpty(sub.SupportDocPath)
	default:
		return nil, "", errors.New("unknown file kind")
	}
	if strings.TrimSpace(objectPath) == "" {
		return nil, "", errors.New("file not found")
	}

	data, err := s.storageSvc.Download(ctx, objectPath)
	if err != nil {
		return nil, "", err
	}
	contentType := http.DetectContentType(data)
	return data, contentType, nil
}

func (s *Service) GetMyCredentials(wallet string) (*CredentialCenterResponse, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return &CredentialCenterResponse{
			KYCStatus: model.KYCStatusUnverified,
			Items:     defaultCenterItems(),
		}, nil
	}

	items := make([]CredentialCenterItem, 0, 3)
	for _, credentialType := range supportedCredentialTypes() {
		item, err := s.buildCenterItem(user.ID, credentialType)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}

	return &CredentialCenterResponse{
		KYCStatus: user.KYCStatus,
		Items:     items,
	}, nil
}

func (s *Service) CreateSubmission(ctx context.Context, wallet, credentialType string, req CreateSubmissionRequest) (*CreateSubmissionResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}

	normalizedType, err := NormalizeType(credentialType)
	if err != nil {
		return nil, err
	}
	route, err := normalizeReviewRoute(req.Route)
	if err != nil {
		return nil, err
	}

	activeCredential, err := s.credentialRepo.FindByUserAndType(user.ID, normalizedType)
	if err != nil {
		return nil, err
	}
	if activeCredential != nil {
		return nil, errors.New("此身份憑證已啟用，無法重複申請")
	}
	if normalizedType == CredentialTypeTenant && route == ReviewRouteProfile {
		if err := ValidateTenantProfilePayload(req.FormPayload); err != nil {
			return nil, err
		}
	}
	latestSubmission, err := s.submissionRepo.FindLatestByUserAndType(user.ID, normalizedType)
	if err != nil {
		return nil, err
	}
	if latestSubmission != nil {
		switch {
		case latestSubmission.ActivationStatus == ActivationStatusActivated:
			return nil, errors.New("此身份申請已啟用，請直接回身份中心查看狀態")
		case latestSubmission.ReviewStatus == CredentialReviewManualReviewing:
			return nil, errors.New("此身份已有進行中的申請，請等待審核結果")
		case latestSubmission.ReviewStatus == CredentialReviewPassed && latestSubmission.ActivationStatus == ActivationStatusReady:
			return nil, errors.New("此身份申請已通過，請先決定是否啟用 NFT 憑證")
		}
	}

	formPayloadJSON, err := encodeFormPayload(req.FormPayload)
	if err != nil {
		return nil, err
	}

	submissionID, err := s.submissionRepo.Create(user.ID, normalizedType, route, formPayloadJSON, strings.TrimSpace(req.Notes))
	if err != nil {
		return nil, err
	}

	if normalizedType == CredentialTypeTenant && route == ReviewRouteProfile {
		if err := s.submissionRepo.SaveDecision(
			submissionID,
			CredentialReviewPassed,
			ActivationStatusReady,
			"",
			"",
			"{}",
			"已建立租客身分資料，可自行決定是否啟用租客 NFT",
		); err != nil {
			return nil, err
		}
	}

	if normalizedType == CredentialTypeOwner && route == ReviewRouteDeclarations {
		if err := s.submissionRepo.SaveDecision(
			submissionID,
			CredentialReviewPassed,
			ActivationStatusReady,
			"",
			"",
			"{}",
			"屋主已確認物件聲明，可自行決定是否啟用屋主 NFT",
		); err != nil {
			return nil, err
		}
	}

	return &CreateSubmissionResponse{SubmissionID: submissionID}, nil
}

func (s *Service) UploadFiles(ctx context.Context, wallet, credentialType string, submissionID int64, mainDocData, supportDocData []byte) error {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return err
	}
	if s.storageSvc == nil {
		return errors.New("文件儲存服務尚未啟用")
	}
	if len(mainDocData) == 0 {
		return errors.New("請上傳主要文件")
	}

	basePath := fmt.Sprintf("credentials/%d/%s/%d", user.ID, strings.ToLower(sub.CredentialType), sub.ID)
	mainContentType := http.DetectContentType(mainDocData)
	mainPath := basePath + "/main" + objectExtension(mainContentType)
	if err := s.storageSvc.Upload(ctx, mainPath, mainDocData, mainContentType); err != nil {
		return err
	}

	supportPath := ""
	if len(supportDocData) > 0 {
		supportContentType := http.DetectContentType(supportDocData)
		supportPath = basePath + "/support" + objectExtension(supportContentType)
		if err := s.storageSvc.Upload(ctx, supportPath, supportDocData, supportContentType); err != nil {
			return err
		}
	}

	return s.submissionRepo.SetFiles(sub.ID, mainPath, supportPath)
}

func (s *Service) AnalyzeSubmission(ctx context.Context, wallet, credentialType string, submissionID int64) (*CredentialCenterItem, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, err
	}
	if sub.ReviewRoute == ReviewRouteManual {
		return nil, errors.New("此申請已改為人工審核，無法再執行智能判定")
	}
	if s.storageSvc == nil || s.visionClient == nil {
		return nil, errors.New("智能審核服務尚未啟用")
	}
	if !sub.MainDocPath.Valid || strings.TrimSpace(sub.MainDocPath.String) == "" {
		return nil, errors.New("請先上傳主要文件")
	}

	mainDocData, err := s.storageSvc.Download(ctx, sub.MainDocPath.String)
	if err != nil {
		return nil, err
	}
	mainOCRText, err := s.visionClient.ExtractText(mainDocData)
	if err != nil {
		return nil, err
	}

	supportOCRText := ""
	if sub.SupportDocPath.Valid && strings.TrimSpace(sub.SupportDocPath.String) != "" {
		supportDocData, err := s.storageSvc.Download(ctx, sub.SupportDocPath.String)
		if err != nil {
			return nil, err
		}
		supportOCRText, err = s.visionClient.ExtractText(supportDocData)
		if err != nil {
			return nil, err
		}
	}

	formPayload, err := decodeFormPayload(sub.FormPayloadJSON)
	if err != nil {
		return nil, err
	}

	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: sub.CredentialType,
		KYCName:        nullStringOrEmpty(user.DisplayName),
		KYCAddress:     nullStringOrEmpty(user.MailingAddress),
		MainOCRText:    mainOCRText,
		SupportOCRText: supportOCRText,
		FormPayload:    formPayload,
	})

	activationStatus := ActivationStatusNotReady
	if decision.ReviewStatus == CredentialReviewPassed {
		activationStatus = ActivationStatusReady
	}

	checksJSON, err := json.Marshal(decision.Checks)
	if err != nil {
		return nil, fmt.Errorf("credential: marshal check result: %w", err)
	}
	if err := s.submissionRepo.SaveDecision(sub.ID, decision.ReviewStatus, activationStatus, mainOCRText, supportOCRText, string(checksJSON), decision.Summary); err != nil {
		return nil, err
	}
	if decision.ReviewStatus == CredentialReviewPassed {
		if err := s.submissionRepo.MarkOlderSubmissionsSuperseded(user.ID, sub.CredentialType, sub.ID); err != nil {
			return nil, err
		}
	}

	return s.buildCenterItem(user.ID, sub.CredentialType)
}

func (s *Service) RequestManualReview(ctx context.Context, wallet, credentialType string, submissionID int64) (*CredentialCenterItem, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, err
	}

	activeCredential, err := s.credentialRepo.FindByUserAndType(user.ID, sub.CredentialType)
	if err != nil {
		return nil, err
	}
	if activeCredential != nil {
		return nil, errors.New("此身份憑證已啟用，無法改送人工審核")
	}
	if sub.ActivationStatus == ActivationStatusActivated {
		return nil, errors.New("此申請已完成啟用，無法改送人工審核")
	}

	if sub.ReviewRoute != ReviewRouteManual || sub.ReviewStatus != CredentialReviewManualReviewing {
		if err := s.submissionRepo.MarkManualReview(sub.ID); err != nil {
			return nil, err
		}
	}

	return s.buildCenterItem(user.ID, sub.CredentialType)
}

func (s *Service) ActivateSubmission(ctx context.Context, wallet, credentialType string, submissionID int64) error {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return err
	}

	activeCredential, err := s.credentialRepo.FindByUserAndType(user.ID, sub.CredentialType)
	if err != nil {
		return err
	}

	hasNaturalPerson, err := s.identitySvc.HasToken(ctx, wallet, model.NFTTokenNaturalPerson)
	if err != nil {
		return err
	}
	if !hasNaturalPerson {
		return errors.New("請先持有自然人 NFT 後再啟用身份憑證")
	}

	tokenID, err := TokenIDForType(sub.CredentialType)
	if err != nil {
		return err
	}
	hasRoleToken, err := s.identitySvc.HasToken(ctx, wallet, tokenID)
	if err != nil {
		return err
	}
	if hasRoleToken {
		switch {
		case sub.ReviewStatus == CredentialReviewPassed && (sub.ActivationStatus == ActivationStatusReady || sub.ActivationStatus == ActivationStatusActivated):
			return s.persistActivatedCredential(user.ID, wallet, sub, activeCredential, int32(tokenID), "")
		case activeCredential != nil:
			return errors.New("此身份憑證已啟用")
		default:
			return errors.New("鏈上已存在此身份憑證，請重新整理後確認身份中心狀態")
		}
	}
	if err := EnsureActivatable(sub, activeCredential != nil); err != nil {
		return err
	}
	txHash, err := s.identitySvc.MintCredential(ctx, wallet, tokenID)
	if err != nil {
		return err
	}
	if err := s.persistActivatedCredential(user.ID, wallet, sub, activeCredential, int32(tokenID), txHash); err != nil {
		if s.chainSyncer != nil {
			_ = s.chainSyncer.SyncAll(ctx)
		}
		return fmt.Errorf("身份憑證已上鏈，但本地同步失敗，請重新整理後確認狀態: %w", err)
	}

	if sub.CredentialType == CredentialTypeOwner {
		formPayload, decodeErr := decodeFormPayload(sub.FormPayloadJSON)
		if decodeErr != nil {
			return decodeErr
		}
		propertyAddress := strings.TrimSpace(formPayload["propertyAddress"])
		ownershipDocNo := strings.TrimSpace(formPayload["ownershipDocNo"])
		propertyID := int64(0)
		if s.ownerPropertyBootstrap != nil {
			propertyID, err = s.ownerPropertyBootstrap.BootstrapOwnerCredentialProperty(customermod.DisclosureInput{
				OwnerUserID:                  user.ID,
				SourceCredentialSubmissionID: sub.ID,
				PropertyAddress:              propertyAddress,
				OwnershipDocNo:               ownershipDocNo,
			})
			if err != nil {
				return fmt.Errorf("bootstrap owner property: %w", err)
			}
		}
		if s.ownerDraftBootstrap != nil {
			if err := s.ownerDraftBootstrap.BootstrapOwnerActivationDraft(user.ID, sub.ID, propertyID, propertyAddress); err != nil {
				return fmt.Errorf("bootstrap owner draft: %w", err)
			}
		}
	}

	if s.chainSyncer != nil {
		_ = s.chainSyncer.SyncAll(ctx)
	}
	return nil
}

func (s *Service) ListPendingManual(limit, offset int) ([]AdminCredentialItem, error) {
	items := []AdminCredentialItem{}
	submissions, err := s.submissionRepo.FindPendingManual(limit, offset)
	if err != nil {
		return nil, err
	}

	for _, sub := range submissions {
		user, err := s.userRepo.FindByID(sub.UserID)
		if err != nil {
			return nil, err
		}
		walletAddress := ""
		if user != nil {
			walletAddress = user.WalletAddress
		}

		item := AdminCredentialItem{
			SubmissionID:   sub.ID,
			UserID:         sub.UserID,
			WalletAddress:  walletAddress,
			CredentialType: sub.CredentialType,
			ReviewRoute:    sub.ReviewRoute,
			ReviewStatus:   sub.ReviewStatus,
			CreatedAt:      sub.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		}
		if summary := strings.TrimSpace(sub.DecisionSummary); summary != "" {
			item.Summary = stringPtr(summary)
		}
		if notes := strings.TrimSpace(sub.Notes); notes != "" {
			item.Notes = stringPtr(notes)
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *Service) ReviewSubmission(ctx context.Context, submissionID int64, action, note, adminWallet string) error {
	sub, err := s.submissionRepo.FindByID(submissionID)
	if err != nil {
		return err
	}
	if sub == nil {
		return errors.New("找不到身份申請")
	}
	if sub.ReviewStatus != CredentialReviewManualReviewing {
		return errors.New("此申請目前不在人工審核佇列中")
	}

	action = strings.ToLower(strings.TrimSpace(action))
	note = strings.TrimSpace(note)

	switch action {
	case "approve":
		summary := firstNonEmpty(note, "人工審核通過，待用戶自行啟用 NFT 憑證。")
		if err := s.submissionRepo.SaveAdminDecision(sub.ID, CredentialReviewPassed, ActivationStatusReady, summary, note, adminWallet); err != nil {
			return err
		}
		return s.submissionRepo.MarkOlderSubmissionsSuperseded(sub.UserID, sub.CredentialType, sub.ID)
	case "reject":
		summary := firstNonEmpty(note, "人工審核未通過，請補件後重新送審。")
		return s.submissionRepo.SaveAdminDecision(sub.ID, CredentialReviewFailed, ActivationStatusNotReady, summary, note, adminWallet)
	default:
		return fmt.Errorf("unknown review action %q", action)
	}
}

func (s *Service) requireVerifiedUser(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("找不到會員資料")
	}
	if user.KYCStatus != model.KYCStatusVerified {
		return nil, errors.New("請先完成 KYC 驗證後再申請身份認證")
	}
	return user, nil
}

func (s *Service) requireOwnedSubmission(userID int64, credentialType string, submissionID int64) (*model.CredentialSubmission, error) {
	normalizedType, err := NormalizeType(credentialType)
	if err != nil {
		return nil, err
	}
	sub, err := s.submissionRepo.FindByID(submissionID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, errors.New("找不到身份申請")
	}
	if sub.UserID != userID || sub.CredentialType != normalizedType {
		return nil, errors.New("無權存取此申請案件")
	}
	return sub, nil
}

func (s *Service) buildCenterItem(userID int64, credentialType string) (*CredentialCenterItem, error) {
	normalizedType, err := NormalizeType(credentialType)
	if err != nil {
		return nil, err
	}

	item := &CredentialCenterItem{
		CredentialType:   normalizedType,
		DisplayStatus:    DisplayStatusNotStarted,
		CanRetrySmart:    true,
		CanRequestManual: true,
	}

	credentials, err := s.credentialRepo.FindByUser(userID)
	if err != nil {
		return nil, err
	}
	var activeCredential *model.UserCredential
	var revokedCredential *model.UserCredential
	for _, credential := range credentials {
		if credential.CredentialType != normalizedType {
			continue
		}
		switch {
		case credential.ReviewStatus == model.CredentialReviewVerified && !credential.RevokedAt.Valid:
			activeCredential = credential
		case credential.ReviewStatus == model.CredentialReviewRevoked || credential.RevokedAt.Valid:
			revokedCredential = credential
		}
	}

	sub, err := s.submissionRepo.FindLatestByUserAndType(userID, normalizedType)
	if err != nil {
		return nil, err
	}

	switch {
	case activeCredential != nil:
		item.DisplayStatus = DisplayStatusActivated
		item.CanRetrySmart = false
		item.CanRequestManual = false
		if activeCredential.TxHash.Valid && strings.TrimSpace(activeCredential.TxHash.String) != "" {
			item.ActivationTxHash = stringPtr(activeCredential.TxHash.String)
		}
	case shouldDisplayRevoked(revokedCredential, sub):
		item.DisplayStatus = DisplayStatusRevoked
		item.CanRetrySmart = true
		item.CanRequestManual = true
		if reason := strings.TrimSpace(revokedCredential.RevokedReason); reason != "" {
			item.Summary = stringPtr(reason)
		}
	case sub != nil:
		displayStatus := DisplayStatusForSubmission(sub)
		item.DisplayStatus = displayStatus
		if displayStatus == DisplayStatusNotStarted {
			break
		}

		item.LatestSubmissionID = int64Ptr(sub.ID)
		if sub.ReviewRoute != "" {
			item.ReviewRoute = stringPtr(sub.ReviewRoute)
		}
		if sub.ActivationTxHash.Valid && strings.TrimSpace(sub.ActivationTxHash.String) != "" {
			item.ActivationTxHash = stringPtr(sub.ActivationTxHash.String)
		}
		if summary := strings.TrimSpace(sub.DecisionSummary); summary != "" {
			item.Summary = stringPtr(summary)
		}

		switch displayStatus {
		case DisplayStatusActivated, DisplayStatusManualReviewing, DisplayStatusSmartReviewing, DisplayStatusPassedReady:
			item.CanRetrySmart = false
			item.CanRequestManual = false
		}

		if displayStatus == DisplayStatusPassedReady {
			item.CanActivate = true
		}
	default:
		item.DisplayStatus = DisplayStatusNotStarted
	}

	return item, nil
}

func defaultCenterItems() []CredentialCenterItem {
	items := make([]CredentialCenterItem, 0, 3)
	for _, credentialType := range supportedCredentialTypes() {
		items = append(items, CredentialCenterItem{
			CredentialType:   credentialType,
			DisplayStatus:    DisplayStatusNotStarted,
			CanRetrySmart:    true,
			CanRequestManual: true,
		})
	}
	return items
}

func supportedCredentialTypes() []string {
	return []string{CredentialTypeOwner, CredentialTypeTenant, CredentialTypeAgent}
}

func normalizeReviewRoute(route string) (string, error) {
	if strings.TrimSpace(route) == "" {
		return ReviewRouteSmart, nil
	}

	switch strings.ToUpper(strings.TrimSpace(route)) {
	case ReviewRouteSmart:
		return ReviewRouteSmart, nil
	case ReviewRouteManual:
		return ReviewRouteManual, nil
	case ReviewRouteProfile:
		return ReviewRouteProfile, nil
	case ReviewRouteDeclarations:
		return ReviewRouteDeclarations, nil
	default:
		return "", fmt.Errorf("invalid review route %q", route)
	}
}

func encodeFormPayload(payload map[string]string) (string, error) {
	if payload == nil {
		return "{}", nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("credential: marshal form payload: %w", err)
	}
	return string(raw), nil
}

func decodeFormPayload(raw string) (map[string]string, error) {
	payload := map[string]string{}
	if strings.TrimSpace(raw) == "" {
		return payload, nil
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, fmt.Errorf("credential: decode form payload: %w", err)
	}
	return payload, nil
}

func nullStringOrEmpty(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func objectExtension(contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".bin"
	}
}

func stringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func int64Ptr(value int64) *int64 {
	return &value
}

func shouldDisplayRevoked(revokedCredential *model.UserCredential, latestSubmission *model.CredentialSubmission) bool {
	if revokedCredential == nil {
		return false
	}
	if latestSubmission == nil {
		return true
	}
	return !latestSubmission.CreatedAt.After(revokedCredential.UpdatedAt)
}

func (s *Service) persistActivatedCredential(
	userID int64,
	reviewerWallet string,
	sub *model.CredentialSubmission,
	activeCredential *model.UserCredential,
	tokenID int32,
	txHash string,
) error {
	existingTxHash := ""
	if activeCredential != nil {
		existingTxHash = nullStringOrEmpty(activeCredential.TxHash)
	}
	resolvedTxHash := firstNonEmpty(strings.TrimSpace(txHash), nullStringOrEmpty(sub.ActivationTxHash), existingTxHash)

	needsSubmissionUpdate := sub.ActivationStatus != ActivationStatusActivated ||
		!sub.ActivationTokenID.Valid ||
		sub.ActivationTokenID.Int32 != tokenID ||
		nullStringOrEmpty(sub.ActivationTxHash) != resolvedTxHash
	if needsSubmissionUpdate {
		if err := s.submissionRepo.MarkActivated(sub.ID, resolvedTxHash, tokenID); err != nil {
			return err
		}
	}

	return s.credentialRepo.UpsertIssuedCredential(userID, sub.CredentialType, tokenID, resolvedTxHash, reviewerWallet)
}
