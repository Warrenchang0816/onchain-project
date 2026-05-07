package model

import (
	"database/sql"
	"time"
)

const (
	PropertySetupDraft = "DRAFT"
	PropertySetupReady = "READY"

	BuildingTypeApartment = "APARTMENT"
	BuildingTypeBuilding  = "BUILDING"
	BuildingTypeTownhouse = "TOWNHOUSE"
	BuildingTypeStudio    = "STUDIO"

	ParkingTypeNone       = "NONE"
	ParkingTypeRamp       = "RAMP"
	ParkingTypeMechanical = "MECHANICAL"
	ParkingTypeTower      = "TOWER"

	SecurityTypeNone     = "NONE"
	SecurityTypeFulltime = "FULLTIME"
	SecurityTypeParttime = "PARTTIME"

	AttachmentTypePhoto      = "PHOTO"
	AttachmentTypeDeed       = "DEED"
	AttachmentTypeFloorPlan  = "FLOOR_PLAN"
	AttachmentTypeDisclosure = "DISCLOSURE"
)

type Property struct {
	ID          int64
	OwnerUserID int64

	Title        string
	Address      string
	DistrictID   sql.NullInt64
	BuildingType string

	Floor       sql.NullInt32
	TotalFloors sql.NullInt32

	MainArea      sql.NullFloat64
	AuxiliaryArea sql.NullFloat64
	BalconyArea   sql.NullFloat64
	SharedArea    sql.NullFloat64
	AwningArea    sql.NullFloat64
	LandArea      sql.NullFloat64

	Rooms        sql.NullInt32
	LivingRooms  sql.NullInt32
	Bathrooms    sql.NullInt32
	IsCornerUnit bool
	HasDarkRoom  bool

	BuildingAge       sql.NullInt32
	BuildingStructure sql.NullString
	ExteriorMaterial  sql.NullString
	BuildingUsage     sql.NullString
	Zoning            sql.NullString
	UnitsOnFloor      sql.NullInt32

	BuildingOrientation sql.NullString
	WindowOrientation   sql.NullString

	ParkingType   string
	ManagementFee sql.NullFloat64
	SecurityType  string

	SetupStatus string
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Attachments []*PropertyAttachment
}

type PropertyAttachment struct {
	ID         int64
	PropertyID int64
	Type       string
	URL        string
	CreatedAt  time.Time
}
