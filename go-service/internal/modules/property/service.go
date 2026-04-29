package property

import (
	"errors"
	"strings"

	"go-service/internal/db/model"
)

var (
	ErrPropertyNotFound           = errors.New("property not found")
	ErrDisclosureSnapshotRequired = errors.New("disclosure snapshot is required")
)

type Repository interface {
	FindByID(id int64) (*model.Property, error)
	FindBySourceCredentialSubmission(submissionID int64) (*model.Property, error)
	CreateDraftFromOwnerCredential(ownerUserID, submissionID int64, built BuiltPropertyDraft) (int64, error)
	UpdateDisclosure(id int64, built BuiltDisclosureSnapshot) error
	MarkReadyForListing(id int64) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
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
