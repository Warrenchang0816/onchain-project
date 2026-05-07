package rental_listing

import (
	"database/sql"
	"errors"
	"fmt"

	"go-service/internal/db/model"
)

var (
	ErrNotFound         = errors.New("rental listing not found")
	ErrForbidden        = errors.New("only the property owner can manage this listing")
	ErrPropertyNotReady = errors.New("property must be READY before creating a listing")
)

type Store interface {
	Create(propertyID int64, monthlyRent, depositMonths float64, minLeaseMonths int, managementFeePayer string, allowPets, allowCooking bool, durationDays int) (int64, error)
	FindByID(id int64) (*model.RentalListing, error)
	FindActiveByProperty(propertyID int64) (*model.RentalListing, error)
	ListPublic() ([]*model.RentalListing, error)
	Update(rl *model.RentalListing) error
	SetStatus(id int64, status string) error
	Publish(id int64, durationDays int) error
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	repo         Store
	propertyRepo PropertyStore
	userRepo     UserStore
}

func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore) *Service {
	return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo}
}

func (s *Service) Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return 0, err
	}
	prop, _ := s.propertyRepo.FindByID(propertyID)
	if prop == nil || prop.SetupStatus != model.PropertySetupReady {
		return 0, ErrPropertyNotReady
	}
	id, err := s.repo.Create(
		propertyID,
		req.MonthlyRent, req.DepositMonths,
		req.MinLeaseMonths, req.ManagementFeePayer,
		req.AllowPets, req.AllowCooking, req.DurationDays,
	)
	if err != nil {
		return 0, fmt.Errorf("rental_listing: Create: %w", err)
	}
	return id, nil
}

func (s *Service) ListPublic() ([]*model.RentalListing, error) {
	rls, err := s.repo.ListPublic()
	if err != nil {
		return nil, fmt.Errorf("rental_listing: ListPublic: %w", err)
	}
	for _, rl := range rls {
		prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
		rl.Property = prop
	}
	return rls, nil
}

func (s *Service) GetByID(id int64) (*model.RentalListing, error) {
	rl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("rental_listing: GetByID: %w", err)
	}
	if rl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
	rl.Property = prop
	return rl, nil
}

func (s *Service) GetActiveByProperty(propertyID int64, wallet string) (*model.RentalListing, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	rl, err := s.repo.FindActiveByProperty(propertyID)
	if err != nil {
		return nil, fmt.Errorf("rental_listing: GetActiveByProperty: %w", err)
	}
	return rl, nil
}

func (s *Service) Update(id int64, wallet string, req UpdateRentalListingRequest) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	applyRentalUpdate(rl, req)
	return s.repo.Update(rl)
}

func (s *Service) Publish(id int64, wallet string, durationDays int) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	return s.repo.Publish(id, durationDays)
}

func (s *Service) Close(id int64, wallet string) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	return s.repo.SetStatus(id, model.RentalListingStatusClosed)
}

func (s *Service) assertOwnsProperty(wallet string, propertyID int64) error {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil || user == nil {
		return ErrForbidden
	}
	prop, err := s.propertyRepo.FindByID(propertyID)
	if err != nil || prop == nil {
		return ErrNotFound
	}
	if prop.OwnerUserID != user.ID {
		return ErrForbidden
	}
	return nil
}

func applyRentalUpdate(rl *model.RentalListing, req UpdateRentalListingRequest) {
	if req.MonthlyRent != nil {
		rl.MonthlyRent = *req.MonthlyRent
	}
	if req.DepositMonths != nil {
		rl.DepositMonths = *req.DepositMonths
	}
	if req.ManagementFeePayer != nil {
		rl.ManagementFeePayer = *req.ManagementFeePayer
	}
	if req.MinLeaseMonths != nil {
		rl.MinLeaseMonths = *req.MinLeaseMonths
	}
	if req.AllowPets != nil {
		rl.AllowPets = *req.AllowPets
	}
	if req.AllowCooking != nil {
		rl.AllowCooking = *req.AllowCooking
	}
	if req.GenderRestriction != nil {
		rl.GenderRestriction = sql.NullString{String: *req.GenderRestriction, Valid: true}
	}
	if req.Notes != nil {
		rl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	if req.DurationDays != nil {
		rl.DurationDays = *req.DurationDays
	}
}
