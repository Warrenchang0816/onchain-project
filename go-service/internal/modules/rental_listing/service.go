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
	Create(rl *model.RentalListing) (int64, error)
	FindByID(id int64) (*model.RentalListing, error)
	FindActiveByProperty(propertyID int64) (*model.RentalListing, error)
	ListPublic() ([]*model.RentalListing, error)
	Update(rl *model.RentalListing) error
	SetStatus(id int64, status string) error
	Publish(id int64, durationDays int) error
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
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
	prop, err := s.propertyRepo.FindByID(propertyID)
	if err != nil {
		return 0, fmt.Errorf("rental_listing: Create: find property: %w", err)
	}
	if prop == nil || prop.SetupStatus != model.PropertySetupReady {
		return 0, ErrPropertyNotReady
	}
	rl := &model.RentalListing{
		PropertyID:           propertyID,
		MonthlyRent:          req.MonthlyRent,
		DepositMonths:        req.DepositMonths,
		ManagementFeePayer:   req.ManagementFeePayer,
		MinLeaseMonths:       req.MinLeaseMonths,
		AllowPets:            req.AllowPets,
		AllowCooking:         req.AllowCooking,
		DurationDays:         req.DurationDays,
		HasSofa:              req.HasSofa,
		HasBed:               req.HasBed,
		HasWardrobe:          req.HasWardrobe,
		HasTV:                req.HasTV,
		HasFridge:            req.HasFridge,
		HasAC:                req.HasAC,
		HasWasher:            req.HasWasher,
		HasWaterHeater:       req.HasWaterHeater,
		HasGas:               req.HasGas,
		HasInternet:          req.HasInternet,
		HasCableTV:           req.HasCableTV,
		NearSchool:           req.NearSchool,
		NearSupermarket:      req.NearSupermarket,
		NearConvenienceStore: req.NearConvenienceStore,
		NearPark:             req.NearPark,
	}
	if req.GenderRestriction != nil {
		rl.GenderRestriction = sql.NullString{String: *req.GenderRestriction, Valid: true}
	}
	if req.Notes != nil {
		rl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	id, err := s.repo.Create(rl)
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
		if prop != nil {
			atts, _ := s.propertyRepo.ListAttachments(rl.PropertyID)
			prop.Attachments = atts
		}
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
	if prop != nil {
		atts, _ := s.propertyRepo.ListAttachments(rl.PropertyID)
		prop.Attachments = atts
	}
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
	if err != nil {
		return fmt.Errorf("rental_listing: Update: %w", err)
	}
	if rl == nil {
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
	if err != nil {
		return fmt.Errorf("rental_listing: Publish: %w", err)
	}
	if rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	return s.repo.Publish(id, durationDays)
}

func (s *Service) Close(id int64, wallet string) error {
	rl, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("rental_listing: Close: %w", err)
	}
	if rl == nil {
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
	if req.HasSofa != nil {
		rl.HasSofa = *req.HasSofa
	}
	if req.HasBed != nil {
		rl.HasBed = *req.HasBed
	}
	if req.HasWardrobe != nil {
		rl.HasWardrobe = *req.HasWardrobe
	}
	if req.HasTV != nil {
		rl.HasTV = *req.HasTV
	}
	if req.HasFridge != nil {
		rl.HasFridge = *req.HasFridge
	}
	if req.HasAC != nil {
		rl.HasAC = *req.HasAC
	}
	if req.HasWasher != nil {
		rl.HasWasher = *req.HasWasher
	}
	if req.HasWaterHeater != nil {
		rl.HasWaterHeater = *req.HasWaterHeater
	}
	if req.HasGas != nil {
		rl.HasGas = *req.HasGas
	}
	if req.HasInternet != nil {
		rl.HasInternet = *req.HasInternet
	}
	if req.HasCableTV != nil {
		rl.HasCableTV = *req.HasCableTV
	}
	if req.NearSchool != nil {
		rl.NearSchool = *req.NearSchool
	}
	if req.NearSupermarket != nil {
		rl.NearSupermarket = *req.NearSupermarket
	}
	if req.NearConvenienceStore != nil {
		rl.NearConvenienceStore = *req.NearConvenienceStore
	}
	if req.NearPark != nil {
		rl.NearPark = *req.NearPark
	}
}
