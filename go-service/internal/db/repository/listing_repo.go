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
	SELECT id, owner_user_id,
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
		&l.ID, &l.OwnerUserID,
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
			&l.ID, &l.OwnerUserID,
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

func (r *ListingRepository) CreateBootstrapDraft(ownerUserID, submissionID int64, address string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listings (
			owner_user_id, title, description, address, district,
			list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
			is_pet_allowed, is_parking_included,
			status, draft_origin, setup_status, source_credential_submission_id,
			daily_fee_ntd
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
		RETURNING id`,
		ownerUserID, "", "", address, nil,
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
