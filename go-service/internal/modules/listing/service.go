package listing

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
)

const minDurationDays = 7
const defaultDurationDays = 30
const defaultDailyFeeNTD = 40.0

var (
	ErrNotFound         = errors.New("listing not found")
	ErrForbidden        = errors.New("only the listing owner can perform this action")
	ErrInvalidStatus    = errors.New("this action is not allowed in the current listing status")
	ErrNotKYCVerified   = errors.New("KYC verification required to perform this action")
	ErrAlreadyBooked    = errors.New("you have already booked an appointment for this listing")
	ErrDurationTooShort = errors.New("minimum listing duration is 7 days")
)

type Service struct {
	listingRepo  ListingStore
	apptRepo     AppointmentStore
	userRepo     UserStore
	propertyRepo PropertyReader
}

type ListingStore interface {
	FindAll(repository.ListingFilter) ([]*model.Listing, error)
	FindByID(id int64) (*model.Listing, error)
	CountByOwner(ownerUserID int64) (int, error)
	FindBySourceCredentialSubmission(submissionID int64) (*model.Listing, error)
	Create(ownerUserID int64, title, address string, description, district *string, listType string, price float64, areaPing *float64, floor, totalFloors, roomCount, bathroomCount *int, isPetAllowed, isParkingIncluded bool, dailyFeeNTD float64) (int64, error)
	CreateBootstrapDraft(ownerUserID, submissionID, propertyID int64, address string) (int64, error)
	BindProperty(listingID, propertyID int64) error
	UpdateIntent(id int64, listType string, setupStatus string) error
	UpdateInfo(id int64, title, address string, description, district *string, listType string, setupStatus string, price float64, areaPing *float64, floor, totalFloors, roomCount, bathroomCount *int, isPetAllowed, isParkingIncluded bool) error
	UpdateRentDetails(id int64, listing model.Listing, details model.ListingRentDetails, setupStatus string) error
	UpdateSaleDetails(id int64, listing model.Listing, details model.ListingSaleDetails, setupStatus string) error
	Publish(id int64, durationDays int) error
	SetStatus(id int64, status string) error
	LockForNegotiation(listingID, appointmentID int64) error
	UnlockNegotiation(listingID int64) error
	Close(listingID int64) error
	AttachDetails(l *model.Listing) error
}

type AppointmentStore interface {
	FindByListing(listingID int64) ([]*model.ListingAppointment, error)
	FindByID(id int64) (*model.ListingAppointment, error)
	FindByListingAndVisitor(listingID, visitorUserID int64) (*model.ListingAppointment, error)
	NextQueuePosition(listingID int64) (int, error)
	Create(listingID, visitorUserID int64, queuePosition int, preferredTime time.Time, note *string) (int64, error)
	Confirm(id int64, confirmedTime time.Time) error
	SetStatus(id int64, status string) error
}

type UserStore interface {
	FindByWallet(walletAddress string) (*model.User, error)
}

type PropertyReader interface {
	FindByID(id int64) (*model.Property, error)
}

func NewService(
	listingRepo ListingStore,
	apptRepo AppointmentStore,
	userRepo UserStore,
	propertyRepo PropertyReader,
) *Service {
	return &Service{
		listingRepo:  listingRepo,
		apptRepo:     apptRepo,
		userRepo:     userRepo,
		propertyRepo: propertyRepo,
	}
}

// requireVerifiedUser looks up a user by wallet and asserts KYC VERIFIED.
func (s *Service) requireVerifiedUser(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, fmt.Errorf("listing: lookup user: %w", err)
	}
	if user == nil || user.KYCStatus != model.KYCStatusVerified {
		return nil, ErrNotKYCVerified
	}
	return user, nil
}

// requireUser looks up a user by wallet (no KYC check).
func (s *Service) requireUser(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, fmt.Errorf("listing: lookup user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

// ── Listing CRUD ──────────────────────────────────────────────────────────────

// ListPublic returns all ACTIVE listings with optional filters.
func (s *Service) ListPublic(listType, district string) ([]*model.Listing, error) {
	listings, err := s.listingRepo.FindAll(repository.ListingFilter{
		ListType: listType,
		District: district,
	})
	if err != nil {
		return nil, err
	}
	for _, l := range listings {
		if err := s.listingRepo.AttachDetails(l); err != nil {
			return nil, err
		}
	}
	return listings, nil
}

// ListByOwner returns all listings owned by the given wallet (all statuses).
func (s *Service) ListByOwner(walletAddress string) ([]*model.Listing, error) {
	user, err := s.requireUser(walletAddress)
	if err != nil {
		return nil, err
	}
	listings, err := s.listingRepo.FindAll(repository.ListingFilter{
		OwnerID: user.ID,
		Status:  "ALL",
	})
	if err != nil {
		return nil, err
	}
	for _, l := range listings {
		if err := s.attachProperty(l); err != nil {
			return nil, err
		}
		if err := s.listingRepo.AttachDetails(l); err != nil {
			return nil, err
		}
	}
	return listings, nil
}

// GetDetail returns a listing with its full appointments queue.
func (s *Service) GetDetail(id int64) (*model.Listing, []*model.ListingAppointment, error) {
	l, err := s.listingRepo.FindByID(id)
	if err != nil {
		return nil, nil, fmt.Errorf("listing: GetDetail: %w", err)
	}
	if l == nil {
		return nil, nil, ErrNotFound
	}
	appts, err := s.apptRepo.FindByListing(id)
	if err != nil {
		return nil, nil, fmt.Errorf("listing: GetDetail appointments: %w", err)
	}
	if err := s.attachProperty(l); err != nil {
		return nil, nil, fmt.Errorf("listing: GetDetail property: %w", err)
	}
	if err := s.listingRepo.AttachDetails(l); err != nil {
		return nil, nil, fmt.Errorf("listing: GetDetail details: %w", err)
	}
	return l, appts, nil
}

func (s *Service) IsListingOwner(ownerUserID int64, callerWallet string) (bool, error) {
	if strings.TrimSpace(callerWallet) == "" {
		return false, nil
	}
	caller, err := s.requireUser(callerWallet)
	if err != nil {
		return false, err
	}
	return IsListingOwner(caller, ownerUserID), nil
}

// Create creates a new listing in DRAFT status.
// The caller must be KYC VERIFIED.
func (s *Service) Create(walletAddress string, req CreateListingRequest) (int64, error) {
	owner, err := s.requireVerifiedUser(walletAddress)
	if err != nil {
		return 0, err
	}

	id, err := s.listingRepo.Create(
		owner.ID,
		req.Title, req.Address,
		req.Description, req.District,
		req.ListType, req.Price,
		req.AreaPing,
		req.Floor, req.TotalFloors, req.RoomCount, req.BathroomCount,
		req.IsPetAllowed, req.IsParkingIncluded,
		defaultDailyFeeNTD,
	)
	if err != nil {
		return 0, fmt.Errorf("listing: Create: %w", err)
	}
	return id, nil
}

func (s *Service) BootstrapOwnerActivationDraft(ownerUserID, submissionID, propertyID int64, propertyAddress string) error {
	existingOwnerListings, err := s.listingRepo.CountByOwner(ownerUserID)
	if err != nil {
		return fmt.Errorf("listing: BootstrapOwnerActivationDraft count: %w", err)
	}

	sourceDraft, err := s.listingRepo.FindBySourceCredentialSubmission(submissionID)
	if err != nil {
		return fmt.Errorf("listing: BootstrapOwnerActivationDraft source: %w", err)
	}

	if !ShouldBootstrapOwnerDraft(existingOwnerListings, sourceDraft != nil) {
		if sourceDraft != nil && propertyID > 0 && !sourceDraft.PropertyID.Valid {
			return s.listingRepo.BindProperty(sourceDraft.ID, propertyID)
		}
		return nil
	}

	address := strings.TrimSpace(propertyAddress)
	if address == "" {
		return nil
	}
	if propertyID <= 0 {
		return nil
	}

	_, err = s.listingRepo.CreateBootstrapDraft(ownerUserID, submissionID, propertyID, address)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil
		}
		return fmt.Errorf("listing: BootstrapOwnerActivationDraft create: %w", err)
	}
	return nil
}

// Update updates the editable fields of a DRAFT or ACTIVE listing.
func (s *Service) Update(listingID int64, walletAddress string, req UpdateListingRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: Update: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusDraft && l.Status != model.ListingStatusActive {
		return ErrInvalidStatus
	}

	listType := l.ListType
	if req.ListType != "" {
		listType = req.ListType
	}

	candidate := &model.Listing{
		Status:        l.Status,
		SetupStatus:   l.SetupStatus,
		Title:         req.Title,
		Address:       req.Address,
		ListType:      listType,
		Price:         req.Price,
		AreaPing:      sql.NullFloat64{},
		RoomCount:     sql.NullInt64{},
		BathroomCount: sql.NullInt64{},
	}
	if req.AreaPing != nil {
		candidate.AreaPing = sql.NullFloat64{Float64: *req.AreaPing, Valid: true}
	}
	if req.RoomCount != nil {
		candidate.RoomCount = sql.NullInt64{Int64: int64(*req.RoomCount), Valid: true}
	}
	if req.BathroomCount != nil {
		candidate.BathroomCount = sql.NullInt64{Int64: int64(*req.BathroomCount), Valid: true}
	}

	setupStatus := l.SetupStatus
	if l.Status == model.ListingStatusDraft {
		setupStatus = ComputeSetupStatus(candidate)
	}

	return s.listingRepo.UpdateInfo(
		listingID,
		req.Title, req.Address,
		req.Description, req.District,
		listType, setupStatus,
		req.Price, req.AreaPing,
		req.Floor, req.TotalFloors, req.RoomCount, req.BathroomCount,
		req.IsPetAllowed, req.IsParkingIncluded,
	)
}

func (s *Service) SetIntent(listingID int64, walletAddress string, req SetListingIntentRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: SetIntent: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusDraft {
		return ErrInvalidStatus
	}

	property, err := s.propertyForListing(l)
	if err != nil {
		return fmt.Errorf("listing: SetIntent property: %w", err)
	}
	if !CanSelectListingIntent(l, property) {
		return ErrInvalidStatus
	}

	l.ListType = req.ListType
	setupStatus := ComputeSetupStatus(l)
	return s.listingRepo.UpdateIntent(listingID, req.ListType, setupStatus)
}

func (s *Service) UpdateRentDetails(listingID int64, walletAddress string, req UpdateRentDetailsRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}
	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: UpdateRentDetails: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusDraft || l.ListType != model.ListingTypeRent {
		return ErrInvalidStatus
	}

	candidate := listingFromRentRequest(l, req)
	details := model.ListingRentDetails{
		ListingID:            listingID,
		MonthlyRent:          req.MonthlyRent,
		DepositMonths:        req.DepositMonths,
		ManagementFeeMonthly: req.ManagementFeeMonthly,
		MinimumLeaseMonths:   req.MinimumLeaseMonths,
		CanRegisterHousehold: req.CanRegisterHousehold,
		CanCook:              req.CanCook,
		RentNotes:            strings.TrimSpace(req.RentNotes),
	}
	candidate.RentDetails = &details
	setupStatus := ComputeSetupStatus(&candidate)
	return s.listingRepo.UpdateRentDetails(listingID, candidate, details, setupStatus)
}

func (s *Service) UpdateSaleDetails(listingID int64, walletAddress string, req UpdateSaleDetailsRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}
	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: UpdateSaleDetails: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusDraft || l.ListType != model.ListingTypeSale {
		return ErrInvalidStatus
	}

	candidate := listingFromSaleRequest(l, req)
	details := model.ListingSaleDetails{
		ListingID:             listingID,
		SaleTotalPrice:        req.SaleTotalPrice,
		SaleUnitPricePerPing:  nullFloat64(req.SaleUnitPricePerPing),
		MainBuildingPing:      nullFloat64(req.MainBuildingPing),
		AuxiliaryBuildingPing: nullFloat64(req.AuxiliaryBuildingPing),
		BalconyPing:           nullFloat64(req.BalconyPing),
		LandPing:              nullFloat64(req.LandPing),
		ParkingSpaceType:      nullString(req.ParkingSpaceType),
		ParkingSpacePrice:     nullFloat64(req.ParkingSpacePrice),
		SaleNotes:             strings.TrimSpace(req.SaleNotes),
	}
	if !details.SaleUnitPricePerPing.Valid && candidate.AreaPing.Valid && candidate.AreaPing.Float64 > 0 {
		details.SaleUnitPricePerPing = sql.NullFloat64{Float64: req.SaleTotalPrice / candidate.AreaPing.Float64, Valid: true}
	}
	candidate.SaleDetails = &details
	setupStatus := ComputeSetupStatus(&candidate)
	return s.listingRepo.UpdateSaleDetails(listingID, candidate, details, setupStatus)
}

// Publish transitions a DRAFT listing to ACTIVE.
func (s *Service) Publish(listingID int64, walletAddress string, durationDays int) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: Publish: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	property, err := s.propertyForListing(l)
	if err != nil {
		return fmt.Errorf("listing: Publish property: %w", err)
	}
	if !IsReadyForPublishWithProperty(l, property) {
		return ErrInvalidStatus
	}
	if durationDays < minDurationDays {
		return ErrDurationTooShort
	}
	return s.listingRepo.Publish(listingID, durationDays)
}

func (s *Service) propertyForListing(l *model.Listing) (*model.Property, error) {
	if l == nil || !l.PropertyID.Valid || s.propertyRepo == nil {
		return nil, nil
	}
	return s.propertyRepo.FindByID(l.PropertyID.Int64)
}

func listingFromRentRequest(existing *model.Listing, req UpdateRentDetailsRequest) model.Listing {
	l := listingFromCommonRequest(existing, req.Title, req.Address, req.Description, req.District, model.ListingTypeRent, req.Price, req.AreaPing, req.Floor, req.TotalFloors, req.RoomCount, req.BathroomCount, req.IsPetAllowed, req.IsParkingIncluded)
	return l
}

func listingFromSaleRequest(existing *model.Listing, req UpdateSaleDetailsRequest) model.Listing {
	l := listingFromCommonRequest(existing, req.Title, req.Address, req.Description, req.District, model.ListingTypeSale, req.Price, req.AreaPing, req.Floor, req.TotalFloors, req.RoomCount, req.BathroomCount, req.IsPetAllowed, req.IsParkingIncluded)
	return l
}

func listingFromCommonRequest(
	existing *model.Listing,
	title, address string,
	description, district *string,
	listType string,
	price float64,
	areaPing *float64,
	floor, totalFloors, roomCount, bathroomCount *int,
	isPetAllowed, isParkingIncluded bool,
) model.Listing {
	l := *existing
	l.Title = strings.TrimSpace(title)
	l.Address = strings.TrimSpace(address)
	l.Description = nullSQLString(description)
	l.District = nullSQLString(district)
	l.ListType = listType
	l.Price = price
	l.AreaPing = nullSQLFloat64(areaPing)
	l.Floor = nullSQLInt64(floor)
	l.TotalFloors = nullSQLInt64(totalFloors)
	l.RoomCount = nullSQLInt64(roomCount)
	l.BathroomCount = nullSQLInt64(bathroomCount)
	l.IsPetAllowed = isPetAllowed
	l.IsParkingIncluded = isParkingIncluded
	return l
}

func nullSQLString(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: trimmed, Valid: true}
}

func nullSQLFloat64(v *float64) sql.NullFloat64 {
	if v == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *v, Valid: true}
}

func nullSQLInt64(v *int) sql.NullInt64 {
	if v == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(*v), Valid: true}
}

func nullFloat64(v *float64) sql.NullFloat64 {
	return nullSQLFloat64(v)
}

func nullString(v *string) sql.NullString {
	return nullSQLString(v)
}

func (s *Service) attachProperty(l *model.Listing) error {
	p, err := s.propertyForListing(l)
	if err != nil {
		return err
	}
	l.Property = p
	return nil
}

// Remove transitions a listing to REMOVED (owner takes it down).
func (s *Service) Remove(listingID int64, walletAddress string) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: Remove: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status == model.ListingStatusClosed || l.Status == model.ListingStatusRemoved {
		return ErrInvalidStatus
	}
	return s.listingRepo.SetStatus(listingID, model.ListingStatusRemoved)
}

// Close marks a listing as CLOSED via the traditional (off-chain) route.
func (s *Service) Close(listingID int64, walletAddress string) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: Close: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	allowed := l.Status == model.ListingStatusActive ||
		l.Status == model.ListingStatusNegotiating ||
		l.Status == model.ListingStatusLocked ||
		l.Status == model.ListingStatusSigning
	if !allowed {
		return ErrInvalidStatus
	}
	return s.listingRepo.Close(listingID)
}

// ── Negotiation Lock ──────────────────────────────────────────────────────────

// LockForNegotiation sets the listing to NEGOTIATING with the specified appointment group.
func (s *Service) LockForNegotiation(listingID int64, walletAddress string, appointmentID int64) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: LockForNegotiation: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusActive && l.Status != model.ListingStatusNegotiating {
		return ErrInvalidStatus
	}

	appt, err := s.apptRepo.FindByID(appointmentID)
	if err != nil {
		return fmt.Errorf("listing: LockForNegotiation appt: %w", err)
	}
	if appt == nil || appt.ListingID != listingID {
		return errors.New("appointment does not belong to this listing")
	}

	return s.listingRepo.LockForNegotiation(listingID, appointmentID)
}

// UnlockNegotiation clears the NEGOTIATING lock and returns to ACTIVE.
func (s *Service) UnlockNegotiation(listingID int64, walletAddress string) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: UnlockNegotiation: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusNegotiating {
		return ErrInvalidStatus
	}
	return s.listingRepo.UnlockNegotiation(listingID)
}

// ── Appointments ──────────────────────────────────────────────────────────────

// BookAppointment creates a new appointment for a visitor (must be KYC VERIFIED).
func (s *Service) BookAppointment(listingID int64, walletAddress string, req CreateAppointmentRequest) (int64, error) {
	visitor, err := s.requireVerifiedUser(walletAddress)
	if err != nil {
		return 0, err
	}

	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return 0, fmt.Errorf("listing: BookAppointment: %w", err)
	}
	if l == nil {
		return 0, ErrNotFound
	}
	if l.Status != model.ListingStatusActive && l.Status != model.ListingStatusNegotiating {
		return 0, ErrInvalidStatus
	}

	existing, err := s.apptRepo.FindByListingAndVisitor(listingID, visitor.ID)
	if err != nil {
		return 0, fmt.Errorf("listing: BookAppointment: %w", err)
	}
	if existing != nil && existing.Status != model.AppointmentStatusCancelled {
		return 0, ErrAlreadyBooked
	}

	pos, err := s.apptRepo.NextQueuePosition(listingID)
	if err != nil {
		return 0, fmt.Errorf("listing: BookAppointment: %w", err)
	}

	return s.apptRepo.Create(listingID, visitor.ID, pos, req.PreferredTime, req.Note)
}

// ConfirmAppointment lets the owner confirm a time slot for a PENDING appointment.
func (s *Service) ConfirmAppointment(apptID int64, walletAddress string, req ConfirmAppointmentRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	appt, err := s.apptRepo.FindByID(apptID)
	if err != nil {
		return fmt.Errorf("listing: ConfirmAppointment: %w", err)
	}
	if appt == nil {
		return ErrNotFound
	}

	l, err := s.listingRepo.FindByID(appt.ListingID)
	if err != nil {
		return fmt.Errorf("listing: ConfirmAppointment listing: %w", err)
	}
	if l == nil || l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if appt.Status != model.AppointmentStatusPending {
		return ErrInvalidStatus
	}
	return s.apptRepo.Confirm(apptID, req.ConfirmedTime)
}

// UpdateAppointmentStatus lets the visitor update their own appointment status.
// Allowed transitions: VIEWED, INTERESTED, CANCELLED.
func (s *Service) UpdateAppointmentStatus(apptID int64, walletAddress string, req UpdateAppointmentStatusRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	appt, err := s.apptRepo.FindByID(apptID)
	if err != nil {
		return fmt.Errorf("listing: UpdateAppointmentStatus: %w", err)
	}
	if appt == nil {
		return ErrNotFound
	}
	if appt.VisitorUserID != caller.ID {
		return ErrForbidden
	}
	terminal := appt.Status == model.AppointmentStatusCancelled ||
		appt.Status == model.AppointmentStatusInterested
	if terminal {
		return ErrInvalidStatus
	}
	return s.apptRepo.SetStatus(apptID, req.Status)
}

// CancelAppointmentByOwner lets the listing owner cancel any appointment.
func (s *Service) CancelAppointmentByOwner(apptID int64, walletAddress string) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}

	appt, err := s.apptRepo.FindByID(apptID)
	if err != nil {
		return fmt.Errorf("listing: CancelAppointmentByOwner: %w", err)
	}
	if appt == nil {
		return ErrNotFound
	}

	l, err := s.listingRepo.FindByID(appt.ListingID)
	if err != nil {
		return fmt.Errorf("listing: CancelAppointmentByOwner listing: %w", err)
	}
	if l == nil || l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if appt.Status == model.AppointmentStatusCancelled {
		return ErrInvalidStatus
	}
	return s.apptRepo.SetStatus(apptID, model.AppointmentStatusCancelled)
}
