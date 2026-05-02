package property

import (
	"errors"
	"fmt"
	"strings"

	"go-service/internal/db/model"
)

var (
	ErrPropertyNotFound           = errors.New("property not found")
	ErrPropertyForbidden          = errors.New("only the property owner can perform this action")
	ErrPropertyUserNotFound       = errors.New("user not found")
	ErrDisclosureSnapshotRequired = errors.New("disclosure snapshot is required")
)

type Repository interface {
	FindByID(id int64) (*model.Property, error)
	FindBySourceCredentialSubmission(submissionID int64) (*model.Property, error)
	ListByOwnerUserID(ownerUserID int64) ([]*model.Property, error)
	CreateDraftFromOwnerCredential(ownerUserID, submissionID int64, built BuiltPropertyDraft) (int64, error)
	UpdateDisclosure(id int64, built BuiltDisclosureSnapshot) error
	MarkReadyForListing(id int64) error
}

type UserRepository interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	repo     Repository
	userRepo UserRepository
}

func NewService(repo Repository, users ...UserRepository) *Service {
	s := &Service{repo: repo}
	if len(users) > 0 {
		s.userRepo = users[0]
	}
	return s
}

func (s *Service) BootstrapOwnerCredentialProperty(in DisclosureInput) (int64, error) {
	existing, err := s.repo.FindBySourceCredentialSubmission(in.SourceCredentialSubmissionID)
	if err != nil {
		return 0, err
	}
	if existing != nil {
		return existing.ID, nil
	}
	built, err := BuildOwnerCredentialPropertyDraft(in)
	if err != nil {
		return 0, err
	}
	return s.repo.CreateDraftFromOwnerCredential(in.OwnerUserID, in.SourceCredentialSubmissionID, built)
}

func (s *Service) ListMine(walletAddress string) ([]*model.Property, error) {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return nil, err
	}
	return s.repo.ListByOwnerUserID(caller.ID)
}

func (s *Service) GetForOwner(propertyID int64, walletAddress string) (*model.Property, error) {
	return s.requireOwner(propertyID, walletAddress)
}

func (s *Service) UpdateDisclosure(propertyID int64, in DisclosureInput) error {
	p, err := s.repo.FindByID(propertyID)
	if err != nil {
		return err
	}
	if p == nil {
		return ErrPropertyNotFound
	}
	built, err := BuildDisclosureSnapshot(in)
	if err != nil {
		return err
	}
	return s.repo.UpdateDisclosure(propertyID, built)
}

func (s *Service) UpdateDisclosureForOwner(propertyID int64, walletAddress string, in DisclosureInput) error {
	p, err := s.requireOwner(propertyID, walletAddress)
	if err != nil {
		return err
	}
	in.OwnerUserID = p.OwnerUserID
	in.SourceCredentialSubmissionID = 0
	if p.SourceCredentialSubmissionID.Valid {
		in.SourceCredentialSubmissionID = p.SourceCredentialSubmissionID.Int64
	}
	built, err := BuildDisclosureSnapshot(in)
	if err != nil {
		return err
	}
	return s.repo.UpdateDisclosure(propertyID, built)
}

func (s *Service) ConfirmDisclosure(propertyID int64) error {
	p, err := s.repo.FindByID(propertyID)
	if err != nil {
		return err
	}
	if p == nil {
		return ErrPropertyNotFound
	}
	if len(p.DisclosureSnapshotJSON) == 0 || strings.TrimSpace(p.DisclosureHash) == "" {
		return ErrDisclosureSnapshotRequired
	}
	return s.repo.MarkReadyForListing(propertyID)
}

func (s *Service) ConfirmDisclosureForOwner(propertyID int64, walletAddress string) error {
	if _, err := s.requireOwner(propertyID, walletAddress); err != nil {
		return err
	}
	return s.ConfirmDisclosure(propertyID)
}

func (s *Service) requireUser(walletAddress string) (*model.User, error) {
	if s.userRepo == nil {
		return nil, ErrPropertyUserNotFound
	}
	user, err := s.userRepo.FindByWallet(walletAddress)
	if err != nil {
		return nil, fmt.Errorf("property: lookup user: %w", err)
	}
	if user == nil {
		return nil, ErrPropertyUserNotFound
	}
	return user, nil
}

func (s *Service) requireOwner(propertyID int64, walletAddress string) (*model.Property, error) {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return nil, err
	}
	p, err := s.repo.FindByID(propertyID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrPropertyNotFound
	}
	if p.OwnerUserID != caller.ID {
		return nil, ErrPropertyForbidden
	}
	return p, nil
}
