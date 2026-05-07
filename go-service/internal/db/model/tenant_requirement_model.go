package model

import (
	"database/sql"
	"time"
)

const (
	TenantRequirementOpen   = "OPEN"
	TenantRequirementPaused = "PAUSED"
	TenantRequirementClosed = "CLOSED"
)

type TenantRequirement struct {
	ID                         int64
	UserID                     int64
	TargetDistrict             string
	BudgetMin                  float64
	BudgetMax                  float64
	LayoutNote                 string
	MoveInDate                 sql.NullTime
	PetFriendlyNeeded          bool
	ParkingNeeded              bool
	Status                     string
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
	AreaMinPing                sql.NullFloat64
	AreaMaxPing                sql.NullFloat64
	RoomMin                    int
	BathroomMin                int
	MoveInTimeline             string
	MinimumLeaseMonths         int
	CanCookNeeded              bool
	CanRegisterHouseholdNeeded bool
	LifestyleNote              string
	MustHaveNote               string
	Districts                  []*TenantRequirementDistrict
}
