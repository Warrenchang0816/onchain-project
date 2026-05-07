package rental_listing

import "time"

type PropertySummaryResponse struct {
	ID                  int64    `json:"id"`
	Title               string   `json:"title"`
	Address             string   `json:"address"`
	BuildingType        string   `json:"building_type"`
	Floor               *int32   `json:"floor,omitempty"`
	TotalFloors         *int32   `json:"total_floors,omitempty"`
	MainArea            *float64 `json:"main_area,omitempty"`
	AuxiliaryArea       *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea         *float64 `json:"balcony_area,omitempty"`
	Rooms               *int32   `json:"rooms,omitempty"`
	LivingRooms         *int32   `json:"living_rooms,omitempty"`
	Bathrooms           *int32   `json:"bathrooms,omitempty"`
	BuildingAge         *int32   `json:"building_age,omitempty"`
	ParkingType         string   `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee,omitempty"`
	IsCornerUnit        bool     `json:"is_corner_unit"`
	SecurityType        string   `json:"security_type"`
	BuildingOrientation *string  `json:"building_orientation,omitempty"`
	WindowOrientation   *string  `json:"window_orientation,omitempty"`
}

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

	Property *PropertySummaryResponse `json:"property,omitempty"`
}
