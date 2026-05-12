package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"go-service/internal/db/model"
)

type CredentialSubmissionRepository struct {
	db *sql.DB
}

func NewCredentialSubmissionRepository(db *sql.DB) *CredentialSubmissionRepository {
	return &CredentialSubmissionRepository{db: db}
}

const credentialSubmissionSelectCols = `
	SELECT id, user_id, credential_type, review_route, review_status, activation_status,
	       form_payload_json, main_doc_path, support_doc_path, notes,
	       ocr_text_main, ocr_text_support, check_result_json,
	       decision_summary, reviewer_note, reviewed_by_wallet,
	       decided_at, activated_at, activation_tx_hash, activation_token_id,
	       superseded_by_submission_id, created_at, updated_at
	FROM credential_submissions`

func (r *CredentialSubmissionRepository) Create(userID int64, credentialType, reviewRoute, formPayload, notes string) (int64, error) {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return 0, fmt.Errorf("credential_submission_repo: create: %w", err)
	}

	route := strings.ToUpper(strings.TrimSpace(reviewRoute))
	if err := validateReviewRoute(route); err != nil {
		return 0, fmt.Errorf("credential_submission_repo: create: %w", err)
	}

	var id int64
	err = r.db.QueryRow(`
		INSERT INTO credential_submissions (
			user_id, credential_type, review_route, review_status, activation_status,
			form_payload_json, notes
		) VALUES (
			$1, $2, $3, $4, $5,
			COALESCE(NULLIF($6, '')::jsonb, '{}'::jsonb), $7
		)
		RETURNING id
	`, userID, normalizedType, route, reviewStatusDraft, activationStatusNotReady, formPayload, notes).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("credential_submission_repo: create: %w", err)
	}
	return id, nil
}

func (r *CredentialSubmissionRepository) SetFiles(id int64, mainDocPath, supportDocPath string) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET main_doc_path = NULLIF($1, ''),
		    support_doc_path = NULLIF($2, ''),
		    updated_at = NOW()
		WHERE id = $3
	`, mainDocPath, supportDocPath, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: set files: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) SaveDecision(id int64, reviewStatus, activationStatus, ocrMain, ocrSupport, checksJSON, summary string) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_status = $1,
		    activation_status = $2,
		    ocr_text_main = $3,
		    ocr_text_support = $4,
		    check_result_json = COALESCE(NULLIF($5, '')::jsonb, '{}'::jsonb),
		    decision_summary = $6,
		    decided_at = NOW(),
		    updated_at = NOW()
		WHERE id = $7
	`, reviewStatus, activationStatus, ocrMain, ocrSupport, checksJSON, summary, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: save decision: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) MarkManualReview(id int64) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_route = $1,
		    review_status = $2,
		    activation_status = $3,
		    updated_at = NOW()
		WHERE id = $4
	`, reviewRouteManual, reviewStatusManualReviewing, activationStatusNotReady, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark manual review: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) MarkActivated(id int64, txHash string, tokenID int32) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET activation_status = $1,
		    activated_at = NOW(),
		    activation_tx_hash = NULLIF($2, ''),
		    activation_token_id = $3,
		    updated_at = NOW()
		WHERE id = $4
	`, activationStatusActivated, txHash, tokenID, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark activated: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) MarkOlderSubmissionsSuperseded(userID int64, credentialType string, exceptID int64) error {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark superseded: %w", err)
	}

	_, err = r.db.Exec(`
		UPDATE credential_submissions
		SET activation_status = $1,
		    superseded_by_submission_id = $2,
		    updated_at = NOW()
		WHERE user_id = $3
		  AND credential_type = $4
		  AND id <> $5
		  AND activation_status <> $6
	`, activationStatusSuperseded, exceptID, userID, normalizedType, exceptID, activationStatusActivated)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark superseded: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) FindLatestByUserAndType(userID int64, credentialType string) (*model.CredentialSubmission, error) {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return nil, fmt.Errorf("credential_submission_repo: find latest: %w", err)
	}

	row := r.db.QueryRow(credentialSubmissionSelectCols+`
		WHERE user_id = $1 AND credential_type = $2
		ORDER BY created_at DESC, id DESC
		LIMIT 1`, userID, normalizedType)
	sub, err := r.scanOne(row)
	if err != nil {
		return nil, fmt.Errorf("credential_submission_repo: find latest: %w", err)
	}
	return sub, nil
}

func (r *CredentialSubmissionRepository) FindByID(id int64) (*model.CredentialSubmission, error) {
	row := r.db.QueryRow(credentialSubmissionSelectCols+`
		WHERE id = $1
		LIMIT 1`, id)
	sub, err := r.scanOne(row)
	if err != nil {
		return nil, fmt.Errorf("credential_submission_repo: find by id: %w", err)
	}
	return sub, nil
}

func (r *CredentialSubmissionRepository) FindPendingManual(limit, offset int) ([]*model.CredentialSubmission, error) {
	rows, err := r.db.Query(credentialSubmissionSelectCols+`
		WHERE review_status = $1
		ORDER BY created_at ASC, id ASC
		LIMIT $2 OFFSET $3`, reviewStatusManualReviewing, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("credential_submission_repo: find pending manual: %w", err)
	}
	defer rows.Close()
	return r.scanAll(rows)
}

func (r *CredentialSubmissionRepository) MarkStopped(id int64) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_status = 'STOPPED',
		    activation_status = 'NOT_READY',
		    updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark stopped: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) SaveAdminDecision(id int64, reviewStatus, activationStatus, summary, reviewerNote, reviewerWallet string) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_status = $1,
		    activation_status = $2,
		    decision_summary = $3,
		    reviewer_note = $4,
		    reviewed_by_wallet = NULLIF($5, ''),
		    decided_at = NOW(),
		    updated_at = NOW()
		WHERE id = $6
	`, reviewStatus, activationStatus, summary, reviewerNote, reviewerWallet, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: save admin decision: %w", err)
	}
	return nil
}

func (r *CredentialSubmissionRepository) scanOne(row *sql.Row) (*model.CredentialSubmission, error) {
	var sub model.CredentialSubmission
	if err := row.Scan(
		&sub.ID, &sub.UserID, &sub.CredentialType, &sub.ReviewRoute, &sub.ReviewStatus, &sub.ActivationStatus,
		&sub.FormPayloadJSON, &sub.MainDocPath, &sub.SupportDocPath, &sub.Notes,
		&sub.OCRTextMain, &sub.OCRTextSupport, &sub.CheckResultJSON,
		&sub.DecisionSummary, &sub.ReviewerNote, &sub.ReviewedByWallet,
		&sub.DecidedAt, &sub.ActivatedAt, &sub.ActivationTxHash, &sub.ActivationTokenID,
		&sub.SupersededBySubmissionID, &sub.CreatedAt, &sub.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

func (r *CredentialSubmissionRepository) scanAll(rows *sql.Rows) ([]*model.CredentialSubmission, error) {
	var list []*model.CredentialSubmission
	for rows.Next() {
		var sub model.CredentialSubmission
		if err := rows.Scan(
			&sub.ID, &sub.UserID, &sub.CredentialType, &sub.ReviewRoute, &sub.ReviewStatus, &sub.ActivationStatus,
			&sub.FormPayloadJSON, &sub.MainDocPath, &sub.SupportDocPath, &sub.Notes,
			&sub.OCRTextMain, &sub.OCRTextSupport, &sub.CheckResultJSON,
			&sub.DecisionSummary, &sub.ReviewerNote, &sub.ReviewedByWallet,
			&sub.DecidedAt, &sub.ActivatedAt, &sub.ActivationTxHash, &sub.ActivationTokenID,
			&sub.SupersededBySubmissionID, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &sub)
	}
	return list, rows.Err()
}

func validateReviewRoute(reviewRoute string) error {
	switch reviewRoute {
	case reviewRouteSmart, reviewRouteManual, reviewRouteProfile, reviewRouteDeclarations:
		return nil
	default:
		return fmt.Errorf("invalid review route %q", reviewRoute)
	}
}

func normalizeCredentialType(raw string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case model.CredentialTypeOwner:
		return model.CredentialTypeOwner, nil
	case model.CredentialTypeTenant:
		return model.CredentialTypeTenant, nil
	case model.CredentialTypeAgent:
		return model.CredentialTypeAgent, nil
	default:
		return "", fmt.Errorf("invalid credential type %q", raw)
	}
}

const (
	reviewRouteSmart            = "SMART"
	reviewRouteManual           = "MANUAL"
	reviewRouteProfile          = "PROFILE"
	reviewRouteDeclarations     = "DECLARATIONS"
	reviewStatusDraft           = "DRAFT"
	reviewStatusSmartReviewing  = "SMART_REVIEWING"
	reviewStatusManualReviewing = "MANUAL_REVIEWING"
	activationStatusNotReady    = "NOT_READY"
	activationStatusReady       = "READY"
	activationStatusActivated   = "ACTIVATED"
	activationStatusSuperseded  = "SUPERSEDED"
)
