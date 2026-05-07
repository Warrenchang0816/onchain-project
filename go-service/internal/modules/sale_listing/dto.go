package sale_listing

import "time"

type CreateSaleListingRequest struct {
	TotalPrice       float64  `json:"total_price" binding:"required,min=0"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping"`
	ParkingType      *string  `json:"parking_type"`
	ParkingPrice     *float64 `json:"parking_price"`
	Notes            *string  `json:"notes"`
	DurationDays     int      `json:"duration_days" binding:"min=7"`
}

type UpdateSaleListingRequest struct {
	TotalPrice       *float64 `json:"total_price"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping"`
	ParkingType      *string  `json:"parking_type"`
	ParkingPrice     *float64 `json:"parking_price"`
	Notes            *string  `json:"notes"`
	DurationDays     *int     `json:"duration_days"`
}

type SaleListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	TotalPrice       float64  `json:"total_price"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping,omitempty"`
	ParkingType      *string  `json:"parking_type,omitempty"`
	ParkingPrice     *float64 `json:"parking_price,omitempty"`
	Notes            *string  `json:"notes,omitempty"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
