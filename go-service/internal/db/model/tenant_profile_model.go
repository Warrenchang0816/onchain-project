package model

import "time"

const (
	TenantAdvancedDataBasic    = "BASIC"
	TenantAdvancedDataAdvanced = "ADVANCED"

	TenantDocTypeIncomeProof = "INCOME_PROOF"
	TenantDocTypeHousehold   = "HOUSEHOLD_DOC"
	TenantDocTypeOther       = "OTHER"
)

type TenantProfile struct {
	ID                 int64
	UserID             int64
	OccupationType     string
	OrgName            string
	IncomeRange        string
	HouseholdSize      int
	CoResidentNote     string
	MoveInTimeline     string
	AdditionalNote     string
	AdvancedDataStatus string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type TenantProfileDocument struct {
	ID              int64
	TenantProfileID int64
	DocType         string
	FilePath        string
	CreatedAt       time.Time
}
