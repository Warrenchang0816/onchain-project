package model

import (
	"database/sql"
	"time"
)

// CredentialSubmission maps to the credential_submissions table.
type CredentialSubmission struct {
	ID               int64
	UserID           int64
	CredentialType   string
	ReviewRoute      string
	ReviewStatus     string
	ActivationStatus string

	FormPayloadJSON string

	MainDocPath    sql.NullString
	SupportDocPath sql.NullString

	Notes          string
	OCRTextMain    string
	OCRTextSupport string

	CheckResultJSON  string
	DecisionSummary  string
	ReviewerNote     string
	ReviewedByWallet sql.NullString

	DecidedAt sql.NullTime

	ActivatedAt       sql.NullTime
	ActivationTxHash  sql.NullString
	ActivationTokenID sql.NullInt32

	SupersededBySubmissionID sql.NullInt64

	CreatedAt time.Time
	UpdatedAt time.Time
}
