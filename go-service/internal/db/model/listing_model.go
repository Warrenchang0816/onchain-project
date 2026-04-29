package model

import (
	"database/sql"
	"time"
)

const (
	ListingStatusDraft       = "DRAFT"
	ListingStatusActive      = "ACTIVE"
	ListingStatusNegotiating = "NEGOTIATING"
	ListingStatusLocked      = "LOCKED"
	ListingStatusSigning     = "SIGNING"
	ListingStatusClosed      = "CLOSED"
	ListingStatusExpired     = "EXPIRED"
	ListingStatusRemoved     = "REMOVED"
	ListingStatusSuspended   = "SUSPENDED"

	ListingTypeUnset = "UNSET"
	ListingTypeRent  = "RENT"
	ListingTypeSale  = "SALE"

	ListingDraftOriginManualCreate    = "MANUAL_CREATE"
	ListingDraftOriginOwnerActivation = "OWNER_ACTIVATION"

	ListingSetupStatusIncomplete = "INCOMPLETE"
	ListingSetupStatusReady      = "READY"
)

type Listing struct {
	ID          int64
	OwnerUserID int64
	PropertyID  sql.NullInt64

	Title       string
	Description sql.NullString
	Address     string
	District    sql.NullString

	ListType          string
	Price             float64
	AreaPing          sql.NullFloat64
	Floor             sql.NullInt64
	TotalFloors       sql.NullInt64
	RoomCount         sql.NullInt64
	BathroomCount     sql.NullInt64
	IsPetAllowed      bool
	IsParkingIncluded bool

	Status                       string
	DraftOrigin                  string
	SetupStatus                  string
	SourceCredentialSubmissionID sql.NullInt64
	NegotiatingAppointmentID     sql.NullInt64

	DailyFeeNTD float64

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
