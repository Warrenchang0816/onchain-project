package favorites

import (
	"database/sql"
	"fmt"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) ListByWallet(wallet, listingType string) ([]UserFavorite, error) {
	rows, err := r.db.Query(
		`SELECT id, wallet, listing_type, listing_id, created_at
         FROM user_favorites WHERE wallet = $1 AND listing_type = $2
         ORDER BY created_at DESC`,
		wallet, listingType,
	)
	if err != nil {
		return nil, fmt.Errorf("favorites repo: ListByWallet: %w", err)
	}
	defer rows.Close()

	var result []UserFavorite
	for rows.Next() {
		var f UserFavorite
		if err := rows.Scan(&f.ID, &f.Wallet, &f.ListingType, &f.ListingID, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("favorites repo: scan: %w", err)
		}
		result = append(result, f)
	}
	return result, rows.Err()
}

func (r *Repository) IsFavorited(wallet string, listingID int64, listingType string) (bool, error) {
	var count int
	err := r.db.QueryRow(
		`SELECT COUNT(*) FROM user_favorites
         WHERE wallet = $1 AND listing_type = $2 AND listing_id = $3`,
		wallet, listingType, listingID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("favorites repo: IsFavorited: %w", err)
	}
	return count > 0, nil
}

func (r *Repository) Add(wallet string, listingID int64, listingType string) error {
	_, err := r.db.Exec(
		`INSERT INTO user_favorites (wallet, listing_type, listing_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
		wallet, listingType, listingID,
	)
	if err != nil {
		return fmt.Errorf("favorites repo: Add: %w", err)
	}
	return nil
}

func (r *Repository) Remove(wallet string, listingID int64, listingType string) error {
	_, err := r.db.Exec(
		`DELETE FROM user_favorites
         WHERE wallet = $1 AND listing_type = $2 AND listing_id = $3`,
		wallet, listingType, listingID,
	)
	if err != nil {
		return fmt.Errorf("favorites repo: Remove: %w", err)
	}
	return nil
}
