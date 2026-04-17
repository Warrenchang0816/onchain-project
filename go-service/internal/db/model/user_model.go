package model

import (
	"database/sql"
	"time"
)

type User struct {
	ID                 int64
	WalletAddress      string
	Email              sql.NullString
	Phone              sql.NullString
	DisplayName        sql.NullString
	EmailVerified      bool
	PhoneVerified      bool
	KYCStatus          string
	PersonHash         sql.NullString
	IdentityHash       sql.NullString
	IdentityNFTTokenID sql.NullInt64
	KYCMintTxHash      sql.NullString

	MailingAddress sql.NullString
	IDNumberHint   sql.NullString // masked hint e.g. "F***2708"

	PasswordHash sql.NullString

	KYCSubmittedAt sql.NullTime
	KYCVerifiedAt  sql.NullTime
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

const (
	KYCStatusUnverified = "UNVERIFIED"
	KYCStatusPending    = "PENDING"
	KYCStatusVerified   = "VERIFIED"
	KYCStatusRejected   = "REJECTED"
)
