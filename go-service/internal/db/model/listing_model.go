package model

import (
	"database/sql"
	"time"
)

// Listing status constants
const (
	ListingStatusDraft       = "DRAFT"
	ListingStatusActive      = "ACTIVE"
	ListingStatusNegotiating = "NEGOTIATING"
	ListingStatusLocked      = "LOCKED"    // triggered by on-chain CaseTracker event
	ListingStatusSigning     = "SIGNING"   // triggered by on-chain CaseTracker event
	ListingStatusClosed      = "CLOSED"
	ListingStatusExpired     = "EXPIRED"
	ListingStatusRemoved     = "REMOVED"
	ListingStatusSuspended   = "SUSPENDED"

	ListingTypeRent = "RENT"
	ListingTypeSale = "SALE"
)

type Listing struct {
	ID          int64
	OwnerUserID int64

	Title       string
	Description sql.NullString
	Address     string
	District    sql.NullString

	ListType           string
	Price              float64
	AreaPing           sql.NullFloat64
	Floor              sql.NullInt64
	TotalFloors        sql.NullInt64
	RoomCount          sql.NullInt64
	BathroomCount      sql.NullInt64
	IsPetAllowed       bool
	IsParkingIncluded  bool

	Status                    string
	NegotiatingAppointmentID  sql.NullInt64

	DailyFeeNTD float64

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
