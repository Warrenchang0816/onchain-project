package agent

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/repository"
)

// Service handles agent directory queries.
type Service struct {
	credentialRepo *repository.UserCredentialRepository
}

// NewService constructs an agent Service.
func NewService(credentialRepo *repository.UserCredentialRepository) *Service {
	return &Service{credentialRepo: credentialRepo}
}

// ListAgents returns all non-revoked certified AGENT users.
func (s *Service) ListAgents() (*AgentListResponse, error) {
	records, err := s.credentialRepo.FindAllAgents()
	if err != nil {
		return nil, fmt.Errorf("agent service: list agents: %w", err)
	}

	items := make([]AgentListItem, 0, len(records))
	for _, r := range records {
		items = append(items, AgentListItem{
			WalletAddress: r.WalletAddress,
			DisplayName:   nullStrPtr(r.DisplayName),
			ActivatedAt:   r.ActivatedAt.UTC().Format(time.RFC3339),
			NFTTokenID:    r.NFTTokenID.Int32,
		})
	}
	return &AgentListResponse{Items: items}, nil
}

// GetByWallet returns the agent detail for a given wallet, or nil if not found.
func (s *Service) GetByWallet(walletAddress string) (*AgentDetailResponse, error) {
	r, err := s.credentialRepo.FindAgentByWallet(walletAddress)
	if err != nil {
		return nil, fmt.Errorf("agent service: get by wallet: %w", err)
	}
	if r == nil {
		return nil, nil
	}
	return &AgentDetailResponse{
		WalletAddress: r.WalletAddress,
		DisplayName:   nullStrPtr(r.DisplayName),
		ActivatedAt:   r.ActivatedAt.UTC().Format(time.RFC3339),
		NFTTokenID:    r.NFTTokenID.Int32,
		TxHash:        r.TxHash.String,
	}, nil
}

// nullStrPtr converts a sql.NullString to *string, returning nil for NULL or empty.
func nullStrPtr(ns sql.NullString) *string {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	return &ns.String
}
