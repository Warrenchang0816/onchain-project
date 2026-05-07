package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type SaleListingRepository struct {
	db *sql.DB
}

func NewSaleListingRepository(db *sql.DB) *SaleListingRepository {
	return &SaleListingRepository{db: db}
}

const saleListingCols = `id, property_id, status, duration_days,
    total_price, unit_price_per_ping, parking_type, parking_price,
    notes, published_at, expires_at, created_at, updated_at`

func (r *SaleListingRepository) Create(propertyID int64, totalPrice float64, durationDays int) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO sale_listing (property_id, status, duration_days, total_price, created_at, updated_at)
		VALUES ($1, 'DRAFT', $2, $3, NOW(), NOW()) RETURNING id`,
		propertyID, durationDays, totalPrice,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("sale_listing_repo: Create: %w", err)
	}
	return id, nil
}

func (r *SaleListingRepository) FindByID(id int64) (*model.SaleListing, error) {
	row := r.db.QueryRow(`SELECT `+saleListingCols+` FROM sale_listing WHERE id=$1`, id)
	sl, err := scanSaleListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sale_listing_repo: FindByID: %w", err)
	}
	return sl, nil
}

func (r *SaleListingRepository) FindActiveByProperty(propertyID int64) (*model.SaleListing, error) {
	row := r.db.QueryRow(`SELECT `+saleListingCols+` FROM sale_listing WHERE property_id = $1 AND status NOT IN ('CLOSED', 'EXPIRED') ORDER BY created_at DESC LIMIT 1`, propertyID)
	sl, err := scanSaleListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sale_listing_repo: FindActiveByProperty: %w", err)
	}
	return sl, nil
}

func (r *SaleListingRepository) ListPublic() ([]*model.SaleListing, error) {
	rows, err := r.db.Query(`SELECT ` + saleListingCols + ` FROM sale_listing WHERE status='ACTIVE' ORDER BY published_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("sale_listing_repo: ListPublic: %w", err)
	}
	defer rows.Close()
	return scanSaleListings(rows)
}

func (r *SaleListingRepository) Update(sl *model.SaleListing) error {
	_, err := r.db.Exec(`
		UPDATE sale_listing SET
		    duration_days=$1, total_price=$2, unit_price_per_ping=$3,
		    parking_type=$4, parking_price=$5, notes=$6, updated_at=NOW()
		WHERE id=$7`,
		sl.DurationDays, sl.TotalPrice, sl.UnitPricePerPing,
		sl.ParkingType, sl.ParkingPrice, sl.Notes, sl.ID,
	)
	if err != nil {
		return fmt.Errorf("sale_listing_repo: Update: %w", err)
	}
	return nil
}

func (r *SaleListingRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE sale_listing SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err != nil {
		return fmt.Errorf("sale_listing_repo: SetStatus: %w", err)
	}
	return nil
}

func (r *SaleListingRepository) Publish(id int64, durationDays int) error {
	_, err := r.db.Exec(`
		UPDATE sale_listing
		SET status='ACTIVE', duration_days=$1,
		    published_at=NOW(), expires_at=NOW() + ($1 * INTERVAL '1 day'),
		    updated_at=NOW()
		WHERE id=$2`, durationDays, id)
	if err != nil {
		return fmt.Errorf("sale_listing_repo: Publish: %w", err)
	}
	return nil
}

func scanSaleListing(row *sql.Row) (*model.SaleListing, error) {
	sl := &model.SaleListing{}
	return sl, row.Scan(
		&sl.ID, &sl.PropertyID, &sl.Status, &sl.DurationDays,
		&sl.TotalPrice, &sl.UnitPricePerPing, &sl.ParkingType, &sl.ParkingPrice,
		&sl.Notes, &sl.PublishedAt, &sl.ExpiresAt, &sl.CreatedAt, &sl.UpdatedAt,
	)
}

func scanSaleListings(rows *sql.Rows) ([]*model.SaleListing, error) {
	var out []*model.SaleListing
	for rows.Next() {
		sl := &model.SaleListing{}
		if err := rows.Scan(
			&sl.ID, &sl.PropertyID, &sl.Status, &sl.DurationDays,
			&sl.TotalPrice, &sl.UnitPricePerPing, &sl.ParkingType, &sl.ParkingPrice,
			&sl.Notes, &sl.PublishedAt, &sl.ExpiresAt, &sl.CreatedAt, &sl.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan sale_listing: %w", err)
		}
		out = append(out, sl)
	}
	return out, rows.Err()
}
