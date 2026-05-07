package model

import "time"

type TenantRequirementDistrict struct {
	ID            int64
	RequirementID int64
	County        string
	District      string
	ZipCode       string
	CreatedAt     time.Time
}
