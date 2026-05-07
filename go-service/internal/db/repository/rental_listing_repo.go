package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type RentalListingRepository struct {
	db *sql.DB
}

func NewRentalListingRepository(db *sql.DB) *RentalListingRepository {
	return &RentalListingRepository{db: db}
}

func (r *RentalListingRepository) Create(propertyID int64, monthlyRent, depositMonths float64, minLeaseMonths int, managementFeePayer string, allowPets, allowCooking bool, durationDays int) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO rental_listing
		    (property_id, status, duration_days, monthly_rent, deposit_months,
		     management_fee_payer, min_lease_months, allow_pets, allow_cooking, created_at, updated_at)
		VALUES ($1, 'DRAFT', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING id`,
		propertyID, durationDays, monthlyRent, depositMonths,
		managementFeePayer, minLeaseMonths, allowPets, allowCooking,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("rental_listing_repo: Create: %w", err)
	}
	return id, nil
}

func (r *RentalListingRepository) FindByID(id int64) (*model.RentalListing, error) {
	row := r.db.QueryRow(`
		SELECT id, property_id, status, duration_days,
		       monthly_rent, deposit_months, management_fee_payer,
		       min_lease_months, allow_pets, allow_cooking,
		       gender_restriction, notes, published_at, expires_at,
		       created_at, updated_at
		FROM rental_listing WHERE id = $1`, id)
	rl, err := scanRentalListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: FindByID: %w", err)
	}
	return rl, nil
}

func (r *RentalListingRepository) FindActiveByProperty(propertyID int64) (*model.RentalListing, error) {
	row := r.db.QueryRow(`
		SELECT id, property_id, status, duration_days,
		       monthly_rent, deposit_months, management_fee_payer,
		       min_lease_months, allow_pets, allow_cooking,
		       gender_restriction, notes, published_at, expires_at,
		       created_at, updated_at
		FROM rental_listing WHERE property_id = $1
		ORDER BY created_at DESC LIMIT 1`, propertyID)
	rl, err := scanRentalListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: FindActiveByProperty: %w", err)
	}
	return rl, nil
}

func (r *RentalListingRepository) ListPublic() ([]*model.RentalListing, error) {
	rows, err := r.db.Query(`
		SELECT id, property_id, status, duration_days,
		       monthly_rent, deposit_months, management_fee_payer,
		       min_lease_months, allow_pets, allow_cooking,
		       gender_restriction, notes, published_at, expires_at,
		       created_at, updated_at
		FROM rental_listing
		WHERE status = 'ACTIVE'
		ORDER BY published_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: ListPublic: %w", err)
	}
	defer rows.Close()
	return scanRentalListings(rows)
}

func (r *RentalListingRepository) Update(rl *model.RentalListing) error {
	_, err := r.db.Exec(`
		UPDATE rental_listing SET
		    duration_days=$1, monthly_rent=$2, deposit_months=$3,
		    management_fee_payer=$4, min_lease_months=$5,
		    allow_pets=$6, allow_cooking=$7,
		    gender_restriction=$8, notes=$9, updated_at=NOW()
		WHERE id=$10`,
		rl.DurationDays, rl.MonthlyRent, rl.DepositMonths,
		rl.ManagementFeePayer, rl.MinLeaseMonths,
		rl.AllowPets, rl.AllowCooking,
		rl.GenderRestriction, rl.Notes, rl.ID,
	)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: Update: %w", err)
	}
	return nil
}

func (r *RentalListingRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE rental_listing SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: SetStatus: %w", err)
	}
	return nil
}

func (r *RentalListingRepository) Publish(id int64, durationDays int) error {
	_, err := r.db.Exec(`
		UPDATE rental_listing
		SET status='ACTIVE', duration_days=$1,
		    published_at=NOW(), expires_at=NOW() + ($1 * INTERVAL '1 day'),
		    updated_at=NOW()
		WHERE id=$2`, durationDays, id)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: Publish: %w", err)
	}
	return nil
}

func scanRentalListing(row *sql.Row) (*model.RentalListing, error) {
	rl := &model.RentalListing{}
	return rl, row.Scan(
		&rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
		&rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
		&rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
		&rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
		&rl.CreatedAt, &rl.UpdatedAt,
	)
}

func scanRentalListings(rows *sql.Rows) ([]*model.RentalListing, error) {
	var out []*model.RentalListing
	for rows.Next() {
		rl := &model.RentalListing{}
		if err := rows.Scan(
			&rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
			&rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
			&rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
			&rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
			&rl.CreatedAt, &rl.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan rental_listing: %w", err)
		}
		out = append(out, rl)
	}
	return out, rows.Err()
}
