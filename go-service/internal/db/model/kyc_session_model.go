package model

import (
	"database/sql"
	"time"
)

// KYCSession holds onboarding state before a wallet is bound.
// Created after email OTP is verified; expires in 30 minutes.
type KYCSession struct {
	ID string // UUID

	Email         sql.NullString
	Phone         sql.NullString
	EmailVerified bool
	PhoneVerified bool

	// OCR results (user-confirmed version)
	PersonHash         sql.NullString // SHA-256(id_number), person uniqueness key
	OCRIDNumber        sql.NullString
	ConfirmedName      sql.NullString
	ConfirmedBirthDate sql.NullString
	OCRAddress         sql.NullString
	OCRIDNumberHint    sql.NullString
	OCRGender          sql.NullString
	OCRIssueDate       sql.NullString
	OCRIssueLocation   sql.NullString
	OCRFatherName      sql.NullString
	OCRMotherName      sql.NullString

	// MinIO object paths: kyc/session/{id}/...
	IDFrontPath   sql.NullString
	IDBackPath    sql.NullString
	SelfiePath    sql.NullString
	SecondDocPath sql.NullString

	FaceMatchScore sql.NullFloat64
	OCRSuccess     bool

	// Flow step: STARTED → EMAIL_VERIFIED → PHONE_VERIFIED → OCR_DONE → CONFIRMED → WALLET_BOUND
	Step string

	BoundUserID sql.NullInt64

	ExpiresAt time.Time
	CreatedAt time.Time
}

// KYC session step constants.
const (
	KYCSessionStepStarted       = "STARTED"
	KYCSessionStepEmailVerified = "EMAIL_VERIFIED"
	KYCSessionStepPhoneVerified = "PHONE_VERIFIED"
	KYCSessionStepOCRDone       = "OCR_DONE"
	KYCSessionStepConfirmed     = "CONFIRMED"
	KYCSessionStepWalletBound   = "WALLET_BOUND"
)

// UserCredential maps to the user_credentials table.
type UserCredential struct {
	ID             int64
	UserID         int64
	CredentialType string // OWNER | TENANT | AGENT

	DocPath          sql.NullString
	ReviewStatus     string // PENDING | VERIFIED | REJECTED
	ReviewerNote     string
	ReviewedByWallet sql.NullString
	RevokedAt        sql.NullTime
	RevokedReason    string

	NFTTokenID sql.NullInt32
	TxHash     sql.NullString

	VerifiedAt sql.NullTime
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

const (
	CredentialTypeOwner  = "OWNER"
	CredentialTypeTenant = "TENANT"
	CredentialTypeAgent  = "AGENT"

	CredentialReviewPending  = "PENDING"
	CredentialReviewVerified = "VERIFIED"
	CredentialReviewRejected = "REJECTED"
	CredentialReviewRevoked  = "REVOKED"

	// ERC-1155 token IDs (matches IdentityNFT.sol constants)
	NFTTokenNaturalPerson = 1
	NFTTokenOwner         = 2
	NFTTokenTenant        = 3
	NFTTokenAgent         = 4
)
