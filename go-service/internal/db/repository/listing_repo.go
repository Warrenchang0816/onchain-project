package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type ListingRepository struct {
	db *sql.DB
}

func NewListingRepository(db *sql.DB) *ListingRepository {
	return &ListingRepository{db: db}
}

const defaultDailyFeeNTD = 40.0

const listingSelectCols = `
	SELECT id, owner_user_id, property_id,
	       title, description, address, district,
	       list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
	       is_pet_allowed, is_parking_included,
	       status, draft_origin, setup_status, source_credential_submission_id, negotiating_appointment_id,
	       daily_fee_ntd,
	       published_at, expires_at, created_at, updated_at
	FROM listings`

func scanListing(row *sql.Row) (*model.Listing, error) {
	l := &model.Listing{}
	err := row.Scan(
		&l.ID, &l.OwnerUserID, &l.PropertyID,
		&l.Title, &l.Description, &l.Address, &l.District,
		&l.ListType, &l.Price, &l.AreaPing, &l.Floor, &l.TotalFloors, &l.RoomCount, &l.BathroomCount,
		&l.IsPetAllowed, &l.IsParkingIncluded,
		&l.Status, &l.DraftOrigin, &l.SetupStatus, &l.SourceCredentialSubmissionID, &l.NegotiatingAppointmentID,
		&l.DailyFeeNTD,
		&l.PublishedAt, &l.ExpiresAt, &l.CreatedAt, &l.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return l, nil
}

func scanListings(rows *sql.Rows) ([]*model.Listing, error) {
	var result []*model.Listing
	for rows.Next() {
		l := &model.Listing{}
		err := rows.Scan(
			&l.ID, &l.OwnerUserID, &l.PropertyID,
			&l.Title, &l.Description, &l.Address, &l.District,
			&l.ListType, &l.Price, &l.AreaPing, &l.Floor, &l.TotalFloors, &l.RoomCount, &l.BathroomCount,
			&l.IsPetAllowed, &l.IsParkingIncluded,
			&l.Status, &l.DraftOrigin, &l.SetupStatus, &l.SourceCredentialSubmissionID, &l.NegotiatingAppointmentID,
			&l.DailyFeeNTD,
			&l.PublishedAt, &l.ExpiresAt, &l.CreatedAt, &l.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, l)
	}
	return result, rows.Err()
}

// FindByID returns a listing by primary key, or nil if not found.
func (r *ListingRepository) FindByID(id int64) (*model.Listing, error) {
	row := r.db.QueryRow(listingSelectCols+` WHERE id = $1`, id)
	l, err := scanListing(row)
	if err != nil {
		return nil, fmt.Errorf("listing_repo: FindByID: %w", err)
	}
	return l, nil
}

// ListFilter holds optional filter parameters for listing queries.
type ListingFilter struct {
	ListType string // "RENT" | "SALE" | "" (all)
	District string // "" = no filter
	Status   string // "" = only ACTIVE
	OwnerID  int64  // 0 = all owners
}

// FindAll returns listings with optional filters.
// Default (empty filter) returns only ACTIVE listings sorted by published_at DESC.
func (r *ListingRepository) FindAll(f ListingFilter) ([]*model.Listing, error) {
	q := listingSelectCols + ` WHERE 1=1`
	args := []interface{}{}
	idx := 1

	// "ALL" = no status filter (used by owner's own listing view).
	// ""    = default to ACTIVE only (public listing view).
	if f.Status == "ALL" {
		// no status filter
	} else if f.Status != "" {
		q += fmt.Sprintf(` AND status = $%d`, idx)
		args = append(args, f.Status)
		idx++
	} else {
		q += ` AND status = 'ACTIVE'`
	}

	if f.ListType != "" {
		q += fmt.Sprintf(` AND list_type = $%d`, idx)
		args = append(args, f.ListType)
		idx++
	}

	if f.District != "" {
		q += fmt.Sprintf(` AND district = $%d`, idx)
		args = append(args, f.District)
		idx++
	}

	if f.OwnerID > 0 {
		q += fmt.Sprintf(` AND owner_user_id = $%d`, idx)
		args = append(args, f.OwnerID)
		idx++
	}

	q += ` ORDER BY published_at DESC NULLS LAST, created_at DESC`

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("listing_repo: FindAll: %w", err)
	}
	defer rows.Close()

	result, err := scanListings(rows)
	if err != nil {
		return nil, fmt.Errorf("listing_repo: FindAll scan: %w", err)
	}
	return result, nil
}

func (r *ListingRepository) CountByOwner(ownerUserID int64) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM listings WHERE owner_user_id = $1`, ownerUserID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("listing_repo: CountByOwner: %w", err)
	}
	return count, nil
}

func (r *ListingRepository) FindBySourceCredentialSubmission(submissionID int64) (*model.Listing, error) {
	row := r.db.QueryRow(listingSelectCols+` WHERE source_credential_submission_id = $1 LIMIT 1`, submissionID)
	l, err := scanListing(row)
	if err != nil {
		return nil, fmt.Errorf("listing_repo: FindBySourceCredentialSubmission: %w", err)
	}
	return l, nil
}

// Create inserts a new listing in DRAFT status and returns the new ID.
func (r *ListingRepository) Create(
	ownerUserID int64,
	title, address string,
	description, district *string,
	listType string,
	price float64,
	areaPing *float64,
	floor, totalFloors, roomCount, bathroomCount *int,
	isPetAllowed, isParkingIncluded bool,
	dailyFeeNTD float64,
) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listings (
			owner_user_id, title, description, address, district,
			list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
			is_pet_allowed, is_parking_included, daily_fee_ntd
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		RETURNING id`,
		ownerUserID, title, description, address, district,
		listType, price, areaPing, floor, totalFloors, roomCount, bathroomCount,
		isPetAllowed, isParkingIncluded, dailyFeeNTD,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("listing_repo: Create: %w", err)
	}
	return id, nil
}

func (r *ListingRepository) CreateBootstrapDraft(ownerUserID, submissionID, propertyID int64, address string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listings (
			owner_user_id, property_id, title, description, address, district,
			list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
			is_pet_allowed, is_parking_included,
			status, draft_origin, setup_status, source_credential_submission_id,
			daily_fee_ntd
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		RETURNING id`,
		ownerUserID, propertyID, "", "", address, nil,
		model.ListingTypeUnset, 0.0, nil, nil, nil, nil, nil,
		false, false,
		model.ListingStatusDraft, model.ListingDraftOriginOwnerActivation, model.ListingSetupStatusIncomplete, submissionID,
		defaultDailyFeeNTD,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("listing_repo: CreateBootstrapDraft: %w", err)
	}
	return id, nil
}

func (r *ListingRepository) BindProperty(listingID, propertyID int64) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET property_id=$1, updated_at=NOW()
		WHERE id=$2`,
		propertyID, listingID,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: BindProperty: %w", err)
	}
	return nil
}

func (r *ListingRepository) UpdateIntent(id int64, listType string, setupStatus string) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET list_type=$1, setup_status=$2, updated_at=NOW()
		WHERE id=$3`,
		listType, setupStatus, id,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateIntent: %w", err)
	}
	return nil
}

// UpdateInfo updates the editable fields of a listing (only while DRAFT or ACTIVE).
func (r *ListingRepository) UpdateInfo(
	id int64,
	title, address string,
	description, district *string,
	listType string,
	setupStatus string,
	price float64,
	areaPing *float64,
	floor, totalFloors, roomCount, bathroomCount *int,
	isPetAllowed, isParkingIncluded bool,
) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET title=$1, description=$2, address=$3, district=$4,
		    list_type=$5, setup_status=$6,
		    price=$7, area_ping=$8, floor=$9, total_floors=$10,
		    room_count=$11, bathroom_count=$12,
		    is_pet_allowed=$13, is_parking_included=$14,
		    updated_at=NOW()
		WHERE id=$15`,
		title, description, address, district,
		listType, setupStatus,
		price, areaPing, floor, totalFloors, roomCount, bathroomCount,
		isPetAllowed, isParkingIncluded, id,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateInfo: %w", err)
	}
	return nil
}

func (r *ListingRepository) UpdateRentDetails(id int64, listing model.Listing, details model.ListingRentDetails, setupStatus string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateRentDetails begin: %w", err)
	}
	defer tx.Rollback()

	if err := updateListingDetailsCore(tx, id, listing, setupStatus); err != nil {
		return fmt.Errorf("listing_repo: UpdateRentDetails listing: %w", err)
	}
	_, err = tx.Exec(`
		INSERT INTO listing_rent_details (
			listing_id, monthly_rent, deposit_months, management_fee_monthly,
			minimum_lease_months, can_register_household, can_cook, rent_notes
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (listing_id) DO UPDATE SET
			monthly_rent=EXCLUDED.monthly_rent,
			deposit_months=EXCLUDED.deposit_months,
			management_fee_monthly=EXCLUDED.management_fee_monthly,
			minimum_lease_months=EXCLUDED.minimum_lease_months,
			can_register_household=EXCLUDED.can_register_household,
			can_cook=EXCLUDED.can_cook,
			rent_notes=EXCLUDED.rent_notes,
			updated_at=NOW()`,
		id,
		details.MonthlyRent,
		details.DepositMonths,
		details.ManagementFeeMonthly,
		details.MinimumLeaseMonths,
		details.CanRegisterHousehold,
		details.CanCook,
		details.RentNotes,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateRentDetails detail: %w", err)
	}
	return tx.Commit()
}

func (r *ListingRepository) UpdateSaleDetails(id int64, listing model.Listing, details model.ListingSaleDetails, setupStatus string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateSaleDetails begin: %w", err)
	}
	defer tx.Rollback()

	if err := updateListingDetailsCore(tx, id, listing, setupStatus); err != nil {
		return fmt.Errorf("listing_repo: UpdateSaleDetails listing: %w", err)
	}
	_, err = tx.Exec(`
		INSERT INTO listing_sale_details (
			listing_id, sale_total_price, sale_unit_price_per_ping,
			main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
			parking_space_type, parking_space_price, sale_notes
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (listing_id) DO UPDATE SET
			sale_total_price=EXCLUDED.sale_total_price,
			sale_unit_price_per_ping=EXCLUDED.sale_unit_price_per_ping,
			main_building_ping=EXCLUDED.main_building_ping,
			auxiliary_building_ping=EXCLUDED.auxiliary_building_ping,
			balcony_ping=EXCLUDED.balcony_ping,
			land_ping=EXCLUDED.land_ping,
			parking_space_type=EXCLUDED.parking_space_type,
			parking_space_price=EXCLUDED.parking_space_price,
			sale_notes=EXCLUDED.sale_notes,
			updated_at=NOW()`,
		id,
		details.SaleTotalPrice,
		details.SaleUnitPricePerPing,
		details.MainBuildingPing,
		details.AuxiliaryBuildingPing,
		details.BalconyPing,
		details.LandPing,
		details.ParkingSpaceType,
		details.ParkingSpacePrice,
		details.SaleNotes,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: UpdateSaleDetails detail: %w", err)
	}
	return tx.Commit()
}

func updateListingDetailsCore(tx *sql.Tx, id int64, listing model.Listing, setupStatus string) error {
	_, err := tx.Exec(`
		UPDATE listings
		SET title=$1, description=$2, address=$3, district=$4,
		    list_type=$5, setup_status=$6,
		    price=$7, area_ping=$8, floor=$9, total_floors=$10,
		    room_count=$11, bathroom_count=$12,
		    is_pet_allowed=$13, is_parking_included=$14,
		    updated_at=NOW()
		WHERE id=$15`,
		listing.Title,
		listing.Description,
		listing.Address,
		listing.District,
		listing.ListType,
		setupStatus,
		listing.Price,
		listing.AreaPing,
		listing.Floor,
		listing.TotalFloors,
		listing.RoomCount,
		listing.BathroomCount,
		listing.IsPetAllowed,
		listing.IsParkingIncluded,
		id,
	)
	return err
}

func (r *ListingRepository) AttachDetails(l *model.Listing) error {
	if l == nil {
		return nil
	}
	rent, err := r.findRentDetails(l.ID)
	if err != nil {
		return err
	}
	sale, err := r.findSaleDetails(l.ID)
	if err != nil {
		return err
	}
	l.RentDetails = rent
	l.SaleDetails = sale
	return nil
}

func (r *ListingRepository) findRentDetails(listingID int64) (*model.ListingRentDetails, error) {
	row := r.db.QueryRow(`
		SELECT id, listing_id, monthly_rent, deposit_months, management_fee_monthly,
		       minimum_lease_months, can_register_household, can_cook, rent_notes,
		       created_at, updated_at
		FROM listing_rent_details
		WHERE listing_id=$1`, listingID)
	d := &model.ListingRentDetails{}
	err := row.Scan(
		&d.ID,
		&d.ListingID,
		&d.MonthlyRent,
		&d.DepositMonths,
		&d.ManagementFeeMonthly,
		&d.MinimumLeaseMonths,
		&d.CanRegisterHousehold,
		&d.CanCook,
		&d.RentNotes,
		&d.CreatedAt,
		&d.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listing_repo: findRentDetails: %w", err)
	}
	return d, nil
}

func (r *ListingRepository) findSaleDetails(listingID int64) (*model.ListingSaleDetails, error) {
	row := r.db.QueryRow(`
		SELECT id, listing_id, sale_total_price, sale_unit_price_per_ping,
		       main_building_ping, auxiliary_building_ping, balcony_ping, land_ping,
		       parking_space_type, parking_space_price, sale_notes,
		       created_at, updated_at
		FROM listing_sale_details
		WHERE listing_id=$1`, listingID)
	d := &model.ListingSaleDetails{}
	err := row.Scan(
		&d.ID,
		&d.ListingID,
		&d.SaleTotalPrice,
		&d.SaleUnitPricePerPing,
		&d.MainBuildingPing,
		&d.AuxiliaryBuildingPing,
		&d.BalconyPing,
		&d.LandPing,
		&d.ParkingSpaceType,
		&d.ParkingSpacePrice,
		&d.SaleNotes,
		&d.CreatedAt,
		&d.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("listing_repo: findSaleDetails: %w", err)
	}
	return d, nil
}

// SetStatus transitions a listing to the given status.
func (r *ListingRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`
		UPDATE listings SET status=$1, updated_at=NOW() WHERE id=$2`,
		status, id,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: SetStatus: %w", err)
	}
	return nil
}

// Publish sets the listing to ACTIVE and records published_at and expires_at.
func (r *ListingRepository) Publish(id int64, durationDays int) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET status='ACTIVE',
		    published_at=NOW(),
		    expires_at=NOW() + ($1::int * INTERVAL '1 day'),
		    updated_at=NOW()
		WHERE id=$2`,
		durationDays, id,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: Publish: %w", err)
	}
	return nil
}

// LockForNegotiation sets status to NEGOTIATING and records which appointment group.
func (r *ListingRepository) LockForNegotiation(listingID, appointmentID int64) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET status='NEGOTIATING', negotiating_appointment_id=$1, updated_at=NOW()
		WHERE id=$2`,
		appointmentID, listingID,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: LockForNegotiation: %w", err)
	}
	return nil
}

// UnlockNegotiation clears the negotiation lock and returns to ACTIVE.
func (r *ListingRepository) UnlockNegotiation(listingID int64) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET status='ACTIVE', negotiating_appointment_id=NULL, updated_at=NOW()
		WHERE id=$1`,
		listingID,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: UnlockNegotiation: %w", err)
	}
	return nil
}

// Close marks a listing as CLOSED (deal done via traditional route).
func (r *ListingRepository) Close(listingID int64) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET status='CLOSED', updated_at=NOW()
		WHERE id=$1`,
		listingID,
	)
	if err != nil {
		return fmt.Errorf("listing_repo: Close: %w", err)
	}
	return nil
}

// ExpireOverdue transitions all ACTIVE listings past expires_at to EXPIRED.
// Called by a background scheduler or on-demand sweep.
func (r *ListingRepository) ExpireOverdue() (int64, error) {
	res, err := r.db.Exec(`
		UPDATE listings
		SET status='EXPIRED', updated_at=NOW()
		WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at < NOW()`,
	)
	if err != nil {
		return 0, fmt.Errorf("listing_repo: ExpireOverdue: %w", err)
	}
	n, _ := res.RowsAffected()
	return n, nil
}
