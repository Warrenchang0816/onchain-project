package appointment

import (
	"errors"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

var (
	ErrNotFound        = errors.New("appointment not found")
	ErrForbidden       = errors.New("not allowed")
	ErrInvalidStatus   = errors.New("invalid status transition")
	ErrListingNotFound = errors.New("rental listing not found")
)

type ApptStore interface {
	FindByID(id int64) (*model.ListingAppointment, error)
	FindByProperty(propertyID int64) ([]*model.ListingAppointment, error)
	FindByPropertyAndVisitor(propertyID, visitorUserID int64) (*model.ListingAppointment, error)
	NextQueuePosition(propertyID int64) (int, error)
	Create(propertyID, visitorUserID int64, queuePosition int, preferredTime time.Time, note *string) (int64, error)
	SetStatus(id int64, status string) error
	Confirm(id int64, confirmedTime time.Time) error
}

type RentalListingStore interface {
	FindByID(id int64) (*model.RentalListing, error)
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	appts   ApptStore
	rentals RentalListingStore
	props   PropertyStore
	users   UserStore
}

func NewService(appts ApptStore, rentals RentalListingStore, props PropertyStore, users UserStore) *Service {
	return &Service{appts: appts, rentals: rentals, props: props, users: users}
}

var allowedTransitions = map[string][]string{
	model.AppointmentStatusPending:   {model.AppointmentStatusConfirmed, model.AppointmentStatusCancelled},
	model.AppointmentStatusConfirmed: {model.AppointmentStatusViewed, model.AppointmentStatusCancelled},
	model.AppointmentStatusViewed:    {model.AppointmentStatusInterested, model.AppointmentStatusCancelled},
}

func canTransition(from, to string) bool {
	for _, t := range allowedTransitions[from] {
		if t == to {
			return true
		}
	}
	return false
}

func (s *Service) BookForRentalListing(rentalListingID, visitorUserID int64, preferredTime time.Time, note *string) (int64, error) {
	rl, err := s.rentals.FindByID(rentalListingID)
	if err != nil {
		return 0, fmt.Errorf("appointment: resolve rental: %w", err)
	}
	if rl == nil {
		return 0, ErrListingNotFound
	}
	existing, err := s.appts.FindByPropertyAndVisitor(rl.PropertyID, visitorUserID)
	if err != nil {
		return 0, err
	}
	if existing != nil && existing.Status != model.AppointmentStatusCancelled {
		return 0, ErrForbidden
	}
	pos, err := s.appts.NextQueuePosition(rl.PropertyID)
	if err != nil {
		return 0, err
	}
	return s.appts.Create(rl.PropertyID, visitorUserID, pos, preferredTime, note)
}

func (s *Service) ListForOwner(propertyID int64, wallet string) ([]*model.ListingAppointment, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	return s.appts.FindByProperty(propertyID)
}

func (s *Service) Confirm(apptID int64, wallet string, confirmedTime time.Time) error {
	appt, err := s.ownerAppt(apptID, wallet)
	if err != nil {
		return err
	}
	if !canTransition(appt.Status, model.AppointmentStatusConfirmed) {
		return ErrInvalidStatus
	}
	return s.appts.Confirm(apptID, confirmedTime)
}

func (s *Service) SetStatus(apptID int64, wallet, status string) error {
	appt, err := s.ownerAppt(apptID, wallet)
	if err != nil {
		return err
	}
	if !canTransition(appt.Status, status) {
		return ErrInvalidStatus
	}
	return s.appts.SetStatus(apptID, status)
}

func (s *Service) ownerAppt(apptID int64, wallet string) (*model.ListingAppointment, error) {
	appt, err := s.appts.FindByID(apptID)
	if err != nil {
		return nil, err
	}
	if appt == nil {
		return nil, ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, appt.PropertyID); err != nil {
		return nil, err
	}
	return appt, nil
}

func (s *Service) assertOwnsProperty(wallet string, propertyID int64) error {
	user, err := s.users.FindByWallet(wallet)
	if err != nil {
		return fmt.Errorf("appointment: find user: %w", err)
	}
	if user == nil {
		return ErrForbidden
	}
	prop, err := s.props.FindByID(propertyID)
	if err != nil {
		return fmt.Errorf("appointment: find property: %w", err)
	}
	if prop == nil || prop.OwnerUserID != user.ID {
		return ErrForbidden
	}
	return nil
}
