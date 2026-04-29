package model

import (
	"database/sql"
	"time"
)

const (
	PropertyVerificationDraft    = "DRAFT"
	PropertyVerificationVerified = "VERIFIED"
	PropertyVerificationRejected = "REJECTED"

	PropertyCompletenessBasicCreated       = "BASIC_CREATED"
	PropertyCompletenessDisclosureRequired = "DISCLOSURE_REQUIRED"
	PropertyCompletenessWarrantyRequired   = "WARRANTY_REQUIRED"
	PropertyCompletenessSnapshotReady      = "SNAPSHOT_READY"
	PropertyCompletenessReadyForListing    = "READY_FOR_LISTING"
)

type Property struct {
	ID                           int64
	OwnerUserID                  int64
	SourceCredentialSubmissionID sql.NullInt64
	Address                      string
	DeedNo                       string
	DeedHash                     string
	PropertyStatementJSON        []byte
	WarrantyAnswersJSON          []byte
	DisclosureSnapshotJSON       []byte
	DisclosureHash               string
	VerificationStatus           string
	CompletenessStatus           string
	CreatedAt                    time.Time
	UpdatedAt                    time.Time
}
