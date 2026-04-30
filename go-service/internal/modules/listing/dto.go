package listing

import "time"

// ── Listing Request / Response ────────────────────────────────────────────────

type CreateListingRequest struct {
	Title             string   `json:"title"              binding:"required"`
	Description       *string  `json:"description"`
	Address           string   `json:"address"            binding:"required"`
	District          *string  `json:"district"`
	ListType          string   `json:"list_type"          binding:"required,oneof=RENT SALE"`
	Price             float64  `json:"price"              binding:"required,gt=0"`
	AreaPing          *float64 `json:"area_ping"`
	Floor             *int     `json:"floor"`
	TotalFloors       *int     `json:"total_floors"`
	RoomCount         *int     `json:"room_count"`
	BathroomCount     *int     `json:"bathroom_count"`
	IsPetAllowed      bool     `json:"is_pet_allowed"`
	IsParkingIncluded bool     `json:"is_parking_included"`
	DurationDays      int      `json:"duration_days"` // 上架天數，最少 7 天
}

type UpdateListingRequest struct {
	Title             string   `json:"title"              binding:"required"`
	Description       *string  `json:"description"`
	Address           string   `json:"address"            binding:"required"`
	District          *string  `json:"district"`
	ListType          string   `json:"list_type"          binding:"omitempty,oneof=UNSET RENT SALE"`
	Price             float64  `json:"price"              binding:"required,gt=0"`
	AreaPing          *float64 `json:"area_ping"`
	Floor             *int     `json:"floor"`
	TotalFloors       *int     `json:"total_floors"`
	RoomCount         *int     `json:"room_count"`
	BathroomCount     *int     `json:"bathroom_count"`
	IsPetAllowed      bool     `json:"is_pet_allowed"`
	IsParkingIncluded bool     `json:"is_parking_included"`
}

type PublishListingRequest struct {
	DurationDays int `json:"duration_days" binding:"required,min=7"`
}

type SetListingIntentRequest struct {
	ListType string `json:"list_type" binding:"required,oneof=RENT SALE"`
}

type UpdateRentDetailsRequest struct {
	Title                string   `json:"title" binding:"required"`
	Description          *string  `json:"description"`
	Address              string   `json:"address" binding:"required"`
	District             *string  `json:"district"`
	Price                float64  `json:"price" binding:"required,gt=0"`
	AreaPing             *float64 `json:"area_ping" binding:"required"`
	Floor                *int     `json:"floor"`
	TotalFloors          *int     `json:"total_floors"`
	RoomCount            *int     `json:"room_count" binding:"required"`
	BathroomCount        *int     `json:"bathroom_count" binding:"required"`
	IsPetAllowed         bool     `json:"is_pet_allowed"`
	IsParkingIncluded    bool     `json:"is_parking_included"`
	MonthlyRent          float64  `json:"monthly_rent" binding:"required,gt=0"`
	DepositMonths        float64  `json:"deposit_months" binding:"min=0"`
	ManagementFeeMonthly float64  `json:"management_fee_monthly" binding:"min=0"`
	MinimumLeaseMonths   int      `json:"minimum_lease_months" binding:"required,gt=0"`
	CanRegisterHousehold bool     `json:"can_register_household"`
	CanCook              bool     `json:"can_cook"`
	RentNotes            string   `json:"rent_notes"`
}

type UpdateSaleDetailsRequest struct {
	Title                 string   `json:"title" binding:"required"`
	Description           *string  `json:"description"`
	Address               string   `json:"address" binding:"required"`
	District              *string  `json:"district"`
	Price                 float64  `json:"price" binding:"required,gt=0"`
	AreaPing              *float64 `json:"area_ping" binding:"required"`
	Floor                 *int     `json:"floor"`
	TotalFloors           *int     `json:"total_floors"`
	RoomCount             *int     `json:"room_count" binding:"required"`
	BathroomCount         *int     `json:"bathroom_count" binding:"required"`
	IsPetAllowed          bool     `json:"is_pet_allowed"`
	IsParkingIncluded     bool     `json:"is_parking_included"`
	SaleTotalPrice        float64  `json:"sale_total_price" binding:"required,gt=0"`
	SaleUnitPricePerPing  *float64 `json:"sale_unit_price_per_ping"`
	MainBuildingPing      *float64 `json:"main_building_ping"`
	AuxiliaryBuildingPing *float64 `json:"auxiliary_building_ping"`
	BalconyPing           *float64 `json:"balcony_ping"`
	LandPing              *float64 `json:"land_ping"`
	ParkingSpaceType      *string  `json:"parking_space_type"`
	ParkingSpacePrice     *float64 `json:"parking_space_price"`
	SaleNotes             string   `json:"sale_notes"`
}

type LockNegotiationRequest struct {
	AppointmentID int64 `json:"appointment_id" binding:"required"`
}

type AppointmentResponse struct {
	ID            int64   `json:"id"`
	ListingID     int64   `json:"listing_id"`
	VisitorUserID int64   `json:"visitor_user_id"`
	QueuePosition int     `json:"queue_position"`
	PreferredTime string  `json:"preferred_time"`
	ConfirmedTime *string `json:"confirmed_time,omitempty"`
	Status        string  `json:"status"`
	Note          *string `json:"note,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

type ListingResponse struct {
	ID          int64  `json:"id"`
	OwnerUserID int64  `json:"owner_user_id"`
	PropertyID  *int64 `json:"property_id,omitempty"`

	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Address     string  `json:"address"`
	District    *string `json:"district,omitempty"`

	ListType          string               `json:"list_type"`
	Price             float64              `json:"price"`
	AreaPing          *float64             `json:"area_ping,omitempty"`
	Floor             *int64               `json:"floor,omitempty"`
	TotalFloors       *int64               `json:"total_floors,omitempty"`
	RoomCount         *int64               `json:"room_count,omitempty"`
	BathroomCount     *int64               `json:"bathroom_count,omitempty"`
	IsPetAllowed      bool                 `json:"is_pet_allowed"`
	IsParkingIncluded bool                 `json:"is_parking_included"`
	RentDetails       *RentDetailsResponse `json:"rent_details,omitempty"`
	SaleDetails       *SaleDetailsResponse `json:"sale_details,omitempty"`

	Status                 string                `json:"status"`
	DraftOrigin            string                `json:"draft_origin"`
	SetupStatus            string                `json:"setup_status"`
	NegotiatingAppointment *AppointmentResponse  `json:"negotiating_appointment,omitempty"`
	Appointments           []AppointmentResponse `json:"appointments,omitempty"` // only in detail view

	DailyFeeNTD float64 `json:"daily_fee_ntd"`

	PublishedAt *string `json:"published_at,omitempty"`
	ExpiresAt   *string `json:"expires_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`

	IsOwner  bool                            `json:"is_owner"`
	Property *ListingPropertySummaryResponse `json:"property,omitempty"`
}

type RentDetailsResponse struct {
	MonthlyRent          float64 `json:"monthly_rent"`
	DepositMonths        float64 `json:"deposit_months"`
	ManagementFeeMonthly float64 `json:"management_fee_monthly"`
	MinimumLeaseMonths   int     `json:"minimum_lease_months"`
	CanRegisterHousehold bool    `json:"can_register_household"`
	CanCook              bool    `json:"can_cook"`
	RentNotes            string  `json:"rent_notes"`
}

type SaleDetailsResponse struct {
	SaleTotalPrice        float64  `json:"sale_total_price"`
	SaleUnitPricePerPing  *float64 `json:"sale_unit_price_per_ping,omitempty"`
	MainBuildingPing      *float64 `json:"main_building_ping,omitempty"`
	AuxiliaryBuildingPing *float64 `json:"auxiliary_building_ping,omitempty"`
	BalconyPing           *float64 `json:"balcony_ping,omitempty"`
	LandPing              *float64 `json:"land_ping,omitempty"`
	ParkingSpaceType      *string  `json:"parking_space_type,omitempty"`
	ParkingSpacePrice     *float64 `json:"parking_space_price,omitempty"`
	SaleNotes             string   `json:"sale_notes"`
}

type ListingPropertySummaryResponse struct {
	ID                 int64  `json:"id"`
	VerificationStatus string `json:"verification_status"`
	CompletenessStatus string `json:"completeness_status"`
	DeedHash           string `json:"deed_hash"`
	DisclosureHash     string `json:"disclosure_hash"`
}

// ── Appointment Request / Response ────────────────────────────────────────────

type CreateAppointmentRequest struct {
	PreferredTime time.Time `json:"preferred_time" binding:"required"`
	Note          *string   `json:"note"`
}

type UpdateAppointmentStatusRequest struct {
	Status string `json:"status"         binding:"required,oneof=VIEWED INTERESTED CANCELLED"`
}

type ConfirmAppointmentRequest struct {
	ConfirmedTime time.Time `json:"confirmed_time" binding:"required"`
}
