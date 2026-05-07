package customer

import "encoding/json"

type UpdateDisclosureRequest struct {
	PropertyAddress     string              `json:"property_address" binding:"required"`
	OwnershipDocNo      string              `json:"ownership_doc_no"`
	Statement           PropertyStatement   `json:"statement"`
	Warranties          []WarrantyAnswer    `json:"warranties" binding:"required"`
	AttachmentSummaries []AttachmentSummary `json:"attachment_summaries"`
}

type CustomerResponse struct {
	ID                           int64            `json:"id"`
	OwnerUserID                  int64            `json:"owner_user_id"`
	SourceCredentialSubmissionID *int64           `json:"source_credential_submission_id,omitempty"`
	Address                      string           `json:"address"`
	DeedNo                       string           `json:"deed_no"`
	DeedHash                     string           `json:"deed_hash"`
	PropertyStatementJSON        *json.RawMessage `json:"property_statement_json,omitempty"`
	WarrantyAnswersJSON          *json.RawMessage `json:"warranty_answers_json,omitempty"`
	DisclosureSnapshotJSON       *json.RawMessage `json:"disclosure_snapshot_json,omitempty"`
	DisclosureHash               string           `json:"disclosure_hash"`
	VerificationStatus           string           `json:"verification_status"`
	CompletenessStatus           string           `json:"completeness_status"`
	CreatedAt                    string           `json:"created_at"`
	UpdatedAt                    string           `json:"updated_at"`
}
