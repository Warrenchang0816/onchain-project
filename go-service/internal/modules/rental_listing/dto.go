package rental_listing

import "time"

type CreateRentalListingRequest struct {
	MonthlyRent        float64 `json:"monthly_rent" binding:"required,min=0"`
	DepositMonths      float64 `json:"deposit_months" binding:"min=0"`
	ManagementFeePayer string  `json:"management_fee_payer" binding:"oneof=TENANT OWNER SPLIT"`
	MinLeaseMonths     int     `json:"min_lease_months" binding:"min=0"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction"`
	Notes              *string `json:"notes"`
	DurationDays       int     `json:"duration_days" binding:"min=7"`
}

type UpdateRentalListingRequest struct {
	MonthlyRent        *float64 `json:"monthly_rent"`
	DepositMonths      *float64 `json:"deposit_months"`
	ManagementFeePayer *string  `json:"management_fee_payer"`
	MinLeaseMonths     *int     `json:"min_lease_months"`
	AllowPets          *bool    `json:"allow_pets"`
	AllowCooking       *bool    `json:"allow_cooking"`
	GenderRestriction  *string  `json:"gender_restriction"`
	Notes              *string  `json:"notes"`
	DurationDays       *int     `json:"duration_days"`
}

type RentalListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	MonthlyRent        float64 `json:"monthly_rent"`
	DepositMonths      float64 `json:"deposit_months"`
	ManagementFeePayer string  `json:"management_fee_payer"`
	MinLeaseMonths     int     `json:"min_lease_months"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction,omitempty"`
	Notes              *string `json:"notes,omitempty"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
