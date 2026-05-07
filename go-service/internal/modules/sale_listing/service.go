package sale_listing

import (
	"database/sql"
	"errors"
	"fmt"

	"go-service/internal/db/model"
)

var (
	ErrNotFound         = errors.New("sale listing not found")
	ErrForbidden        = errors.New("only the property owner can manage this listing")
	ErrPropertyNotReady = errors.New("property must be READY before creating a listing")
)

type Store interface {
	Create(propertyID int64, totalPrice float64, durationDays int) (int64, error)
	FindByID(id int64) (*model.SaleListing, error)
	FindActiveByProperty(propertyID int64) (*model.SaleListing, error)
	ListPublic() ([]*model.SaleListing, error)
	Update(sl *model.SaleListing) error
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

func (s *Service) Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return 0, err
	}
	prop, _ := s.propertyRepo.FindByID(propertyID)
	if prop == nil || prop.SetupStatus != model.PropertySetupReady {
		return 0, ErrPropertyNotReady
	}
	id, err := s.repo.Create(propertyID, req.TotalPrice, req.DurationDays)
	if err != nil {
		return 0, fmt.Errorf("sale_listing: Create: %w", err)
	}
	if req.UnitPricePerPing != nil || req.ParkingType != nil || req.Notes != nil {
		sl, _ := s.repo.FindByID(id)
		if sl != nil {
			applyUpdate(sl, UpdateSaleListingRequest{
				UnitPricePerPing: req.UnitPricePerPing,
				ParkingType:      req.ParkingType,
				ParkingPrice:     req.ParkingPrice,
				Notes:            req.Notes,
			})
			_ = s.repo.Update(sl)
		}
	}
	return id, nil
}

func (s *Service) ListPublic() ([]*model.SaleListing, error) {
	sls, err := s.repo.ListPublic()
	if err != nil {
		return nil, err
	}
	for _, sl := range sls {
		prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
		sl.Property = prop
	}
	return sls, nil
}

func (s *Service) GetByID(id int64) (*model.SaleListing, error) {
	sl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if sl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
	sl.Property = prop
	return sl, nil
}

func (s *Service) GetActiveByProperty(propertyID int64, wallet string) (*model.SaleListing, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	sl, err := s.repo.FindActiveByProperty(propertyID)
	if err != nil {
		return nil, fmt.Errorf("sale_listing: GetActiveByProperty: %w", err)
	}
	return sl, nil
}

func (s *Service) Update(id int64, wallet string, req UpdateSaleListingRequest) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	applyUpdate(sl, req)
	return s.repo.Update(sl)
}

func (s *Service) Publish(id int64, wallet string, durationDays int) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	return s.repo.Publish(id, durationDays)
}

func (s *Service) Close(id int64, wallet string) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	return s.repo.SetStatus(id, model.SaleListingStatusClosed)
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

func applyUpdate(sl *model.SaleListing, req UpdateSaleListingRequest) {
	if req.TotalPrice != nil {
		sl.TotalPrice = *req.TotalPrice
	}
	if req.UnitPricePerPing != nil {
		sl.UnitPricePerPing = sql.NullFloat64{Float64: *req.UnitPricePerPing, Valid: true}
	}
	if req.ParkingType != nil {
		sl.ParkingType = sql.NullString{String: *req.ParkingType, Valid: true}
	}
	if req.ParkingPrice != nil {
		sl.ParkingPrice = sql.NullFloat64{Float64: *req.ParkingPrice, Valid: true}
	}
	if req.Notes != nil {
		sl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	if req.DurationDays != nil {
		sl.DurationDays = *req.DurationDays
	}
}
