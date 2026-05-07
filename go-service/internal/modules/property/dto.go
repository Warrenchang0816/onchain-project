package property

import "time"

type CreatePropertyRequest struct {
	Title   string `json:"title" binding:"required"`
	Address string `json:"address" binding:"required"`
}

type UpdatePropertyRequest struct {
	Title               string   `json:"title"`
	Address             string   `json:"address"`
	BuildingType        string   `json:"building_type"`
	Floor               *int32   `json:"floor"`
	TotalFloors         *int32   `json:"total_floors"`
	MainArea            *float64 `json:"main_area"`
	AuxiliaryArea       *float64 `json:"auxiliary_area"`
	BalconyArea         *float64 `json:"balcony_area"`
	SharedArea          *float64 `json:"shared_area"`
	AwningArea          *float64 `json:"awning_area"`
	LandArea            *float64 `json:"land_area"`
	Rooms               *int32   `json:"rooms"`
	LivingRooms         *int32   `json:"living_rooms"`
	Bathrooms           *int32   `json:"bathrooms"`
	IsCornerUnit        *bool    `json:"is_corner_unit"`
	HasDarkRoom         *bool    `json:"has_dark_room"`
	BuildingAge         *int32   `json:"building_age"`
	BuildingStructure   *string  `json:"building_structure"`
	ExteriorMaterial    *string  `json:"exterior_material"`
	BuildingUsage       *string  `json:"building_usage"`
	Zoning              *string  `json:"zoning"`
	UnitsOnFloor        *int32   `json:"units_on_floor"`
	BuildingOrientation *string  `json:"building_orientation"`
	WindowOrientation   *string  `json:"window_orientation"`
	ParkingType         *string  `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee"`
	SecurityType        *string  `json:"security_type"`
}

type AttachmentResponse struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

type PropertyResponse struct {
	ID           int64  `json:"id"`
	OwnerUserID  int64  `json:"owner_user_id"`
	Title        string `json:"title"`
	Address      string `json:"address"`
	DistrictID   *int64 `json:"district_id,omitempty"`
	BuildingType string `json:"building_type"`

	Floor       *int32 `json:"floor,omitempty"`
	TotalFloors *int32 `json:"total_floors,omitempty"`

	MainArea      *float64 `json:"main_area,omitempty"`
	AuxiliaryArea *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea   *float64 `json:"balcony_area,omitempty"`
	SharedArea    *float64 `json:"shared_area,omitempty"`
	AwningArea    *float64 `json:"awning_area,omitempty"`
	LandArea      *float64 `json:"land_area,omitempty"`

	Rooms        *int32 `json:"rooms,omitempty"`
	LivingRooms  *int32 `json:"living_rooms,omitempty"`
	Bathrooms    *int32 `json:"bathrooms,omitempty"`
	IsCornerUnit bool   `json:"is_corner_unit"`
	HasDarkRoom  bool   `json:"has_dark_room"`

	BuildingAge       *int32  `json:"building_age,omitempty"`
	BuildingStructure *string `json:"building_structure,omitempty"`
	ExteriorMaterial  *string `json:"exterior_material,omitempty"`
	BuildingUsage     *string `json:"building_usage,omitempty"`
	Zoning            *string `json:"zoning,omitempty"`
	UnitsOnFloor      *int32  `json:"units_on_floor,omitempty"`

	BuildingOrientation *string `json:"building_orientation,omitempty"`
	WindowOrientation   *string `json:"window_orientation,omitempty"`

	ParkingType   string   `json:"parking_type"`
	ManagementFee *float64 `json:"management_fee,omitempty"`
	SecurityType  string   `json:"security_type"`

	SetupStatus string               `json:"setup_status"`
	Attachments []AttachmentResponse `json:"attachments"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
