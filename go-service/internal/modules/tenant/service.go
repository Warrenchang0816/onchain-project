package tenant

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
	"go-service/internal/platform/storage"
)

type Service struct {
	userRepo        *repository.UserRepository
	credentialRepo  *repository.UserCredentialRepository
	profileRepo     *repository.TenantProfileRepository
	requirementRepo *repository.TenantRequirementRepository
	storageSvc      *storage.Client
}

func NewService(
	userRepo *repository.UserRepository,
	credentialRepo *repository.UserCredentialRepository,
	profileRepo *repository.TenantProfileRepository,
	requirementRepo *repository.TenantRequirementRepository,
	storageSvc *storage.Client,
) *Service {
	return &Service{
		userRepo:        userRepo,
		credentialRepo:  credentialRepo,
		profileRepo:     profileRepo,
		requirementRepo: requirementRepo,
		storageSvc:      storageSvc,
	}
}

func (s *Service) requireActiveTenant(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("找不到會員資料")
	}
	cred, err := s.credentialRepo.FindByUserAndType(user.ID, "TENANT")
	if err != nil {
		return nil, err
	}
	if cred == nil {
		return nil, errors.New("請先啟用租客身份")
	}
	return user, nil
}

func (s *Service) requireProviderViewer(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("找不到會員資料")
	}
	ownerCred, err := s.credentialRepo.FindByUserAndType(user.ID, "OWNER")
	if err != nil {
		return nil, err
	}
	if ownerCred != nil {
		return user, nil
	}
	agentCred, err := s.credentialRepo.FindByUserAndType(user.ID, "AGENT")
	if err != nil {
		return nil, err
	}
	if agentCred != nil {
		return user, nil
	}
	return nil, errors.New("此功能僅限屋主或仲介身份使用")
}

func (s *Service) GetMyProfile(wallet string) (*TenantProfileResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	profile, docs, err := s.profileRepo.FindByUserID(user.ID)
	if err != nil {
		return nil, err
	}
	return buildProfileResponse(profile, docs), nil
}

func (s *Service) UpsertMyProfile(wallet string, req UpsertTenantProfileRequest) (*TenantProfileResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	profile, err := s.profileRepo.Upsert(
		user.ID,
		strings.TrimSpace(req.OccupationType),
		strings.TrimSpace(req.OrgName),
		strings.TrimSpace(req.IncomeRange),
		req.HouseholdSize,
		strings.TrimSpace(req.CoResidentNote),
		strings.TrimSpace(req.MoveInTimeline),
		strings.TrimSpace(req.AdditionalNote),
	)
	if err != nil {
		return nil, err
	}
	_, docs, err := s.profileRepo.FindByUserID(user.ID)
	if err != nil {
		return nil, err
	}
	newStatus := DeriveAdvancedDataStatus(profile, docs)
	if newStatus != profile.AdvancedDataStatus {
		if err := s.profileRepo.UpdateAdvancedDataStatus(profile.ID, newStatus); err != nil {
			return nil, err
		}
		profile.AdvancedDataStatus = newStatus
	}
	return buildProfileResponse(profile, docs), nil
}

func (s *Service) UploadMyDocument(ctx context.Context, wallet, docType string, fileData []byte) (*TenantProfileResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	if s.storageSvc == nil {
		return nil, errors.New("文件儲存服務尚未啟用")
	}
	if len(fileData) == 0 {
		return nil, errors.New("請提供文件")
	}
	validDocTypes := map[string]bool{
		model.TenantDocTypeIncomeProof: true,
		model.TenantDocTypeHousehold:   true,
		model.TenantDocTypeOther:       true,
	}
	if !validDocTypes[docType] {
		return nil, fmt.Errorf("不支援的文件類型 %q", docType)
	}

	profile, _, err := s.profileRepo.FindByUserID(user.ID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.New("請先建立租客資料後再上傳文件")
	}

	path := fmt.Sprintf("tenant-profiles/%d/%s/%d.bin", user.ID, strings.ToLower(docType), time.Now().Unix())
	if err := s.storageSvc.Upload(ctx, path, fileData, "application/octet-stream"); err != nil {
		return nil, err
	}
	if err := s.profileRepo.CreateDocument(profile.ID, docType, path); err != nil {
		return nil, err
	}

	_, updatedDocs, err := s.profileRepo.FindByUserID(user.ID)
	if err != nil {
		return nil, err
	}
	newStatus := DeriveAdvancedDataStatus(profile, updatedDocs)
	if newStatus != profile.AdvancedDataStatus {
		if err := s.profileRepo.UpdateAdvancedDataStatus(profile.ID, newStatus); err != nil {
			return nil, err
		}
		profile.AdvancedDataStatus = newStatus
	}
	return buildProfileResponse(profile, updatedDocs), nil
}

func (s *Service) ListMyRequirements(wallet string) ([]TenantRequirementResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	reqs, err := s.requirementRepo.FindMine(user.ID)
	if err != nil {
		return nil, err
	}
	profile, docs, _ := s.profileRepo.FindByUserID(user.ID)
	hasAdv := HasAdvancedData(profile, docs)
	return buildRequirementResponses(reqs, hasAdv, profile), nil
}

func (s *Service) CreateRequirement(wallet string, req CreateRequirementRequest) (*TenantRequirementResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	r := &model.TenantRequirement{
		UserID:            user.ID,
		TargetDistrict:    strings.TrimSpace(req.TargetDistrict),
		BudgetMin:         req.BudgetMin,
		BudgetMax:         req.BudgetMax,
		LayoutNote:        strings.TrimSpace(req.LayoutNote),
		PetFriendlyNeeded: req.PetFriendlyNeeded,
		ParkingNeeded:     req.ParkingNeeded,
	}
	if req.MoveInDate != nil && strings.TrimSpace(*req.MoveInDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.MoveInDate))
		if err == nil {
			r.MoveInDate = sql.NullTime{Time: t, Valid: true}
		}
	}
	id, err := s.requirementRepo.Create(r)
	if err != nil {
		return nil, err
	}
	created, err := s.requirementRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	profile, docs, _ := s.profileRepo.FindByUserID(user.ID)
	hasAdv := HasAdvancedData(profile, docs)
	resp := buildRequirementResponse(created, hasAdv, profile)
	return &resp, nil
}

func (s *Service) UpdateRequirement(wallet string, id int64, req UpdateRequirementRequest) (*TenantRequirementResponse, error) {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return nil, err
	}
	existing, err := s.requirementRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.UserID != user.ID {
		return nil, errors.New("找不到此租屋需求或無權存取")
	}
	existing.TargetDistrict = strings.TrimSpace(req.TargetDistrict)
	existing.BudgetMin = req.BudgetMin
	existing.BudgetMax = req.BudgetMax
	existing.LayoutNote = strings.TrimSpace(req.LayoutNote)
	existing.PetFriendlyNeeded = req.PetFriendlyNeeded
	existing.ParkingNeeded = req.ParkingNeeded
	if req.MoveInDate != nil && strings.TrimSpace(*req.MoveInDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.MoveInDate))
		if err == nil {
			existing.MoveInDate = sql.NullTime{Time: t, Valid: true}
		}
	}
	if err := s.requirementRepo.Update(existing); err != nil {
		return nil, err
	}
	updated, err := s.requirementRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	profile, docs, _ := s.profileRepo.FindByUserID(user.ID)
	hasAdv := HasAdvancedData(profile, docs)
	resp := buildRequirementResponse(updated, hasAdv, profile)
	return &resp, nil
}

func (s *Service) UpdateRequirementStatus(wallet string, id int64, status string) error {
	user, err := s.requireActiveTenant(wallet)
	if err != nil {
		return err
	}
	existing, err := s.requirementRepo.FindByID(id)
	if err != nil {
		return err
	}
	if existing == nil || existing.UserID != user.ID {
		return errors.New("找不到此租屋需求或無權存取")
	}
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case model.TenantRequirementOpen, model.TenantRequirementPaused, model.TenantRequirementClosed:
	default:
		return fmt.Errorf("不支援的需求狀態 %q", status)
	}
	return s.requirementRepo.UpdateStatus(id, strings.ToUpper(strings.TrimSpace(status)))
}

func (s *Service) ListVisibleRequirements(wallet string, f RequirementFilter) ([]TenantRequirementResponse, error) {
	if _, err := s.requireProviderViewer(wallet); err != nil {
		return nil, err
	}
	reqs, err := s.requirementRepo.FindVisible(repository.RequirementFilter{
		District: f.District,
		Status:   f.Status,
	})
	if err != nil {
		return nil, err
	}
	return buildRequirementResponsesPublic(reqs), nil
}

func (s *Service) GetVisibleRequirement(wallet string, id int64) (*TenantRequirementResponse, error) {
	if _, err := s.requireProviderViewer(wallet); err != nil {
		return nil, err
	}
	req, err := s.requirementRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if req == nil {
		return nil, errors.New("找不到租屋需求")
	}
	if req.Status == model.TenantRequirementClosed {
		return nil, errors.New("此需求已關閉")
	}
	resp := buildRequirementResponse(req, false, nil)
	return &resp, nil
}

// ── helpers ───────────────────────────────────────────────────────────────

func buildProfileResponse(profile *model.TenantProfile, docs []*model.TenantProfileDocument) *TenantProfileResponse {
	if profile == nil {
		return &TenantProfileResponse{
			AdvancedDataStatus: model.TenantAdvancedDataBasic,
			Documents:          []TenantProfileDocumentItem{},
		}
	}
	docItems := make([]TenantProfileDocumentItem, 0, len(docs))
	for _, d := range docs {
		docItems = append(docItems, TenantProfileDocumentItem{ID: d.ID, DocType: d.DocType})
	}
	return &TenantProfileResponse{
		OccupationType:     profile.OccupationType,
		OrgName:            profile.OrgName,
		IncomeRange:        profile.IncomeRange,
		HouseholdSize:      profile.HouseholdSize,
		CoResidentNote:     profile.CoResidentNote,
		MoveInTimeline:     profile.MoveInTimeline,
		AdditionalNote:     profile.AdditionalNote,
		AdvancedDataStatus: profile.AdvancedDataStatus,
		Documents:          docItems,
	}
}

func buildRequirementResponse(r *model.TenantRequirement, hasAdv bool, profile *model.TenantProfile) TenantRequirementResponse {
	resp := TenantRequirementResponse{
		ID:                r.ID,
		TargetDistrict:    r.TargetDistrict,
		BudgetMin:         r.BudgetMin,
		BudgetMax:         r.BudgetMax,
		LayoutNote:        r.LayoutNote,
		PetFriendlyNeeded: r.PetFriendlyNeeded,
		ParkingNeeded:     r.ParkingNeeded,
		Status:            r.Status,
		HasAdvancedData:   hasAdv,
		CreatedAt:         r.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:         r.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
	if r.MoveInDate.Valid {
		s := r.MoveInDate.Time.Format("2006-01-02")
		resp.MoveInDate = &s
	}
	if hasAdv && profile != nil {
		resp.OccupationType = strPtr(profile.OccupationType)
		resp.IncomeRange = strPtr(profile.IncomeRange)
		resp.MoveInTimeline = strPtr(profile.MoveInTimeline)
	}
	return resp
}

func buildRequirementResponses(reqs []*model.TenantRequirement, hasAdv bool, profile *model.TenantProfile) []TenantRequirementResponse {
	result := make([]TenantRequirementResponse, 0, len(reqs))
	for _, r := range reqs {
		result = append(result, buildRequirementResponse(r, hasAdv, profile))
	}
	return result
}

func buildRequirementResponsesPublic(reqs []*model.TenantRequirement) []TenantRequirementResponse {
	result := make([]TenantRequirementResponse, 0, len(reqs))
	for _, r := range reqs {
		result = append(result, buildRequirementResponse(r, false, nil))
	}
	return result
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
