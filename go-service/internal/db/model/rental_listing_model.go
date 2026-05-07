package model

import (
	"database/sql"
	"time"
)

const (
	RentalListingStatusDraft       = "DRAFT"
	RentalListingStatusActive      = "ACTIVE"
	RentalListingStatusNegotiating = "NEGOTIATING"
	RentalListingStatusLocked      = "LOCKED"
	RentalListingStatusClosed      = "CLOSED"
	RentalListingStatusExpired     = "EXPIRED"

	ManagementFeePayerTenant = "TENANT"
	ManagementFeePayerOwner  = "OWNER"
	ManagementFeePayerSplit  = "SPLIT"

	GenderRestrictionNone   = "NONE"
	GenderRestrictionMale   = "MALE"
	GenderRestrictionFemale = "FEMALE"
)

type RentalListing struct {
	ID         int64
	PropertyID int64

	Status       string
	DurationDays int

	MonthlyRent        float64
	DepositMonths      float64
	ManagementFeePayer string
	MinLeaseMonths     int
	AllowPets          bool
	AllowCooking       bool
	GenderRestriction  sql.NullString
	Notes              sql.NullString

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
