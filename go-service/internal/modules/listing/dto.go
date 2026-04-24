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
	ID          int64 `json:"id"`
	OwnerUserID int64 `json:"owner_user_id"`

	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Address     string  `json:"address"`
	District    *string `json:"district,omitempty"`

	ListType          string   `json:"list_type"`
	Price             float64  `json:"price"`
	AreaPing          *float64 `json:"area_ping,omitempty"`
	Floor             *int64   `json:"floor,omitempty"`
	TotalFloors       *int64   `json:"total_floors,omitempty"`
	RoomCount         *int64   `json:"room_count,omitempty"`
	BathroomCount     *int64   `json:"bathroom_count,omitempty"`
	IsPetAllowed      bool     `json:"is_pet_allowed"`
	IsParkingIncluded bool     `json:"is_parking_included"`

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

	IsOwner bool `json:"is_owner"`
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
