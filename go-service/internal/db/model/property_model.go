package model

import (
	"database/sql"
	"time"
)

const (
	CustomerVerificationDraft    = "DRAFT"
	CustomerVerificationVerified = "VERIFIED"
	CustomerVerificationRejected = "REJECTED"

	CustomerCompletenessBasicCreated       = "BASIC_CREATED"
	CustomerCompletenessDisclosureRequired = "DISCLOSURE_REQUIRED"
	CustomerCompletenessWarrantyRequired   = "WARRANTY_REQUIRED"
	CustomerCompletenessSnapshotReady      = "SNAPSHOT_READY"
	CustomerCompletenessReadyForListing    = "READY_FOR_LISTING"
)

type Customer struct {
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
