package favorites

import "time"

type UserFavorite struct {
	ID          int64     `db:"id"`
	Wallet      string    `db:"wallet"`
	ListingType string    `db:"listing_type"`
	ListingID   int64     `db:"listing_id"`
	CreatedAt   time.Time `db:"created_at"`
}
