package model

import (
	"database/sql"
	"time"
)

// KYCSubmission maps to the kyc_submissions table.
type KYCSubmission struct {
	ID            int64
	UserID        int64
	WalletAddress string

	// MinIO object paths
	IDFrontPath sql.NullString
	IDBackPath  sql.NullString
	SelfiePath  sql.NullString

	// OCR from front side
	OCRName          sql.NullString
	OCRIDNumber      sql.NullString // raw ID number from OCR (e.g. "A123456789")
	IdentityHash     sql.NullString // SHA-256(id_number + wallet_address)
	OCRBirthDate     sql.NullString
	OCRIssueDate     sql.NullString
	OCRIssueLocation sql.NullString

	// OCR from back side
	OCRAddress    sql.NullString
	OCRFatherName sql.NullString
	OCRMotherName sql.NullString
	OCRSpouseName sql.NullString

	// AI verification
	FaceMatchScore sql.NullFloat64
	OCRSuccess     bool

	// Review / pipeline status
	ReviewStatus     string
	ReviewerNote     string
	ReviewedByWallet sql.NullString

	SubmittedAt time.Time
	ReviewedAt  sql.NullTime
}

const (
	KYCPipelineDraft          = "DRAFT"
	KYCPipelineUploaded       = "UPLOADED"
	KYCPipelineOCRProcessing  = "OCR_PROCESSING"
	KYCPipelineFaceProcessing = "FACE_MATCH_PROCESSING"

	KYCReviewPending      = "PENDING"
	KYCReviewAutoVerified = "AUTO_VERIFIED"
	KYCReviewManualReview = "MANUAL_REVIEW"
	KYCReviewVerified     = "VERIFIED"
	KYCReviewRejected     = "REJECTED"
)
