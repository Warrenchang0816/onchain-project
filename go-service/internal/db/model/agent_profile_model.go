package model

import (
	"database/sql"
	"time"
)

type AgentProfile struct {
	ID                 int64
	UserID             int64
	Headline           string
	Bio                string
	ServiceAreasJSON   string
	LicenseNote        string
	ContactPreferences string
	IsProfileComplete  bool
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type AgentProfileRow struct {
	Profile *AgentProfile
	Wallet  string
	Name    sql.NullString
}
