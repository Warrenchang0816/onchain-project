package model

import (
	"database/sql"
	"time"
)

const (
	SaleListingStatusDraft       = "DRAFT"
	SaleListingStatusActive      = "ACTIVE"
	SaleListingStatusNegotiating = "NEGOTIATING"
	SaleListingStatusLocked      = "LOCKED"
	SaleListingStatusClosed      = "CLOSED"
	SaleListingStatusExpired     = "EXPIRED"
)

type SaleListing struct {
	ID         int64
	PropertyID int64

	Status       string
	DurationDays int

	TotalPrice       float64
	UnitPricePerPing sql.NullFloat64
	ParkingType      sql.NullString
	ParkingPrice     sql.NullFloat64
	Notes            sql.NullString

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
