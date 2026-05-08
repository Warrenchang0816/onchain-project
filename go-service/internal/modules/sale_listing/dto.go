package sale_listing

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
	SharedArea          *float64 `json:"shared_area,omitempty"`
	AwningArea          *float64 `json:"awning_area,omitempty"`
	LandArea            *float64 `json:"land_area,omitempty"`
	Rooms               *int32   `json:"rooms,omitempty"`
	LivingRooms         *int32   `json:"living_rooms,omitempty"`
	Bathrooms           *int32   `json:"bathrooms,omitempty"`
	BuildingAge         *int32   `json:"building_age,omitempty"`
	ParkingType         string   `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee,omitempty"`
	IsCornerUnit        bool     `json:"is_corner_unit"`
	HasDarkRoom         bool     `json:"has_dark_room"`
	SecurityType        string   `json:"security_type"`
	BuildingOrientation *string  `json:"building_orientation,omitempty"`
	WindowOrientation   *string  `json:"window_orientation,omitempty"`
	BuildingStructure   *string  `json:"building_structure,omitempty"`
	ExteriorMaterial    *string  `json:"exterior_material,omitempty"`
	BuildingUsage       *string  `json:"building_usage,omitempty"`
	Zoning              *string  `json:"zoning,omitempty"`
	UnitsOnFloor        *int32   `json:"units_on_floor,omitempty"`
}

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

	Property *PropertySummaryResponse `json:"property,omitempty"`
}
