package agent

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
)

type Service struct {
	credentialRepo   *repository.UserCredentialRepository
	agentProfileRepo *repository.AgentProfileRepository
	userRepo         *repository.UserRepository
}

func NewService(
	credentialRepo *repository.UserCredentialRepository,
	agentProfileRepo *repository.AgentProfileRepository,
	userRepo *repository.UserRepository,
) *Service {
	return &Service{
		credentialRepo:   credentialRepo,
		agentProfileRepo: agentProfileRepo,
		userRepo:         userRepo,
	}
}

func (s *Service) ListAgents(f AgentListFilter) (*AgentListResponse, error) {
	all, err := s.agentProfileRepo.FindAllWithProfile()
	if err != nil {
		return nil, fmt.Errorf("agent service: list agents: %w", err)
	}

	items := make([]AgentListItem, 0, len(all))
	for _, r := range all {
		areas := parseServiceAreas(r.ServiceAreasJSON.String)
		isComplete := r.IsProfileComplete.Bool && r.IsProfileComplete.Valid

		if f.ProfileComplete != nil && isComplete != *f.ProfileComplete {
			continue
		}
		if f.ServiceArea != "" {
			found := false
			for _, a := range areas {
				if strings.EqualFold(a, f.ServiceArea) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		item := AgentListItem{
			WalletAddress:     r.WalletAddress,
			DisplayName:       nullStrPtr(r.DisplayName),
			ActivatedAt:       r.ActivatedAt.UTC().Format(time.RFC3339),
			NFTTokenID:        r.NFTTokenID.Int32,
			ServiceAreas:      areas,
			IsProfileComplete: isComplete,
		}
		if r.Headline.Valid && r.Headline.String != "" {
			item.Headline = &r.Headline.String
		}
		items = append(items, item)
	}
	return &AgentListResponse{Items: items}, nil
}

func (s *Service) GetByWallet(walletAddress string) (*AgentDetailResponse, error) {
	r, err := s.agentProfileRepo.FindOneWithProfile(walletAddress)
	if err != nil {
		return nil, fmt.Errorf("agent service: get by wallet: %w", err)
	}
	if r == nil {
		return nil, nil
	}
	areas := parseServiceAreas(r.ServiceAreasJSON.String)
	resp := &AgentDetailResponse{
		WalletAddress:     r.WalletAddress,
		DisplayName:       nullStrPtr(r.DisplayName),
		ActivatedAt:       r.ActivatedAt.UTC().Format(time.RFC3339),
		NFTTokenID:        r.NFTTokenID.Int32,
		TxHash:            r.TxHash.String,
		ServiceAreas:      areas,
		IsProfileComplete: r.IsProfileComplete.Bool && r.IsProfileComplete.Valid,
	}
	if r.Headline.Valid && r.Headline.String != "" {
		resp.Headline = &r.Headline.String
	}
	return resp, nil
}

func (s *Service) GetMyProfile(wallet string) (*AgentDetailResponse, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("找不到會員資料")
	}
	cred, err := s.credentialRepo.FindByUserAndType(user.ID, "AGENT")
	if err != nil {
		return nil, err
	}
	if cred == nil {
		return nil, errors.New("請先啟用仲介身份")
	}
	profile, err := s.agentProfileRepo.FindByUserID(user.ID)
	if err != nil {
		return nil, err
	}
	areas := []string{}
	if profile != nil {
		areas = parseServiceAreas(profile.ServiceAreasJSON)
	}

	activatedAt := ""
	if cred.VerifiedAt.Valid {
		activatedAt = cred.VerifiedAt.Time.UTC().Format(time.RFC3339)
	} else {
		activatedAt = cred.UpdatedAt.UTC().Format(time.RFC3339)
	}

	resp := &AgentDetailResponse{
		WalletAddress: wallet,
		ActivatedAt:   activatedAt,
		ServiceAreas:  areas,
	}
	if user.DisplayName.Valid && user.DisplayName.String != "" {
		resp.DisplayName = &user.DisplayName.String
	}
	if profile != nil {
		if profile.Headline != "" {
			resp.Headline = &profile.Headline
		}
		if profile.Bio != "" {
			resp.Bio = &profile.Bio
		}
		if profile.LicenseNote != "" {
			resp.LicenseNote = &profile.LicenseNote
		}
		resp.IsProfileComplete = profile.IsProfileComplete
		if profile.IsProfileComplete {
			resp.TxHash = nullStrOrEmpty(cred.TxHash)
		}
	}
	return resp, nil
}

func (s *Service) UpsertMyProfile(wallet string, req UpsertMyAgentProfileRequest) (*AgentDetailResponse, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("找不到會員資料")
	}
	cred, err := s.credentialRepo.FindByUserAndType(user.ID, "AGENT")
	if err != nil {
		return nil, err
	}
	if cred == nil {
		return nil, errors.New("請先啟用仲介身份")
	}

	areas := req.ServiceAreas
	if areas == nil {
		areas = []string{}
	}
	areasBytes, err := json.Marshal(areas)
	if err != nil {
		return nil, fmt.Errorf("agent service: marshal service areas: %w", err)
	}

	isComplete := strings.TrimSpace(req.Headline) != "" &&
		strings.TrimSpace(req.Bio) != "" &&
		len(areas) > 0

	profile := &model.AgentProfile{
		UserID:             user.ID,
		Headline:           strings.TrimSpace(req.Headline),
		Bio:                strings.TrimSpace(req.Bio),
		ServiceAreasJSON:   string(areasBytes),
		LicenseNote:        strings.TrimSpace(req.LicenseNote),
		ContactPreferences: strings.TrimSpace(req.ContactPreferences),
		IsProfileComplete:  isComplete,
	}
	saved, err := s.agentProfileRepo.Upsert(profile)
	if err != nil {
		return nil, err
	}

	activatedAt := ""
	if cred.VerifiedAt.Valid {
		activatedAt = cred.VerifiedAt.Time.UTC().Format(time.RFC3339)
	} else {
		activatedAt = cred.UpdatedAt.UTC().Format(time.RFC3339)
	}

	savedAreas := parseServiceAreas(saved.ServiceAreasJSON)
	resp := &AgentDetailResponse{
		WalletAddress:     wallet,
		ActivatedAt:       activatedAt,
		ServiceAreas:      savedAreas,
		IsProfileComplete: saved.IsProfileComplete,
	}
	if user.DisplayName.Valid && user.DisplayName.String != "" {
		resp.DisplayName = &user.DisplayName.String
	}
	if saved.Headline != "" {
		resp.Headline = &saved.Headline
	}
	if saved.Bio != "" {
		resp.Bio = &saved.Bio
	}
	if saved.LicenseNote != "" {
		resp.LicenseNote = &saved.LicenseNote
	}
	return resp, nil
}

func normalizeProfileCompleteFilter(raw string) *bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "complete":
		v := true
		return &v
	case "incomplete":
		v := false
		return &v
	default:
		return nil
	}
}

func parseServiceAreas(jsonStr string) []string {
	if jsonStr == "" || jsonStr == "[]" || jsonStr == "null" {
		return []string{}
	}
	var areas []string
	if err := json.Unmarshal([]byte(jsonStr), &areas); err != nil {
		return []string{}
	}
	return areas
}

func nullStrPtr(ns sql.NullString) *string {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	return &ns.String
}

func nullStrOrEmpty(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
