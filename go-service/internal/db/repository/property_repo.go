package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
	propertymod "go-service/internal/modules/property"
)

type PropertyRepository struct {
	db *sql.DB
}

func NewPropertyRepository(db *sql.DB) *PropertyRepository {
	return &PropertyRepository{db: db}
}

const propertySelectCols = `
	SELECT id, owner_user_id, source_credential_submission_id,
	       address, deed_no, deed_hash, property_statement_json, warranty_answers_json,
	       disclosure_snapshot_json, disclosure_hash, verification_status, completeness_status,
	       created_at, updated_at
	FROM properties`

func scanProperty(row *sql.Row) (*model.Property, error) {
	p := &model.Property{}
	err := row.Scan(
		&p.ID, &p.OwnerUserID, &p.SourceCredentialSubmissionID,
		&p.Address, &p.DeedNo, &p.DeedHash, &p.PropertyStatementJSON, &p.WarrantyAnswersJSON,
		&p.DisclosureSnapshotJSON, &p.DisclosureHash, &p.VerificationStatus, &p.CompletenessStatus,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *PropertyRepository) FindByID(id int64) (*model.Property, error) {
	row := r.db.QueryRow(propertySelectCols+` WHERE id = $1`, id)
	p, err := scanProperty(row)
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindByID: %w", err)
	}
	return p, nil
}

func (r *PropertyRepository) FindBySourceCredentialSubmission(submissionID int64) (*model.Property, error) {
	row := r.db.QueryRow(propertySelectCols+` WHERE source_credential_submission_id = $1 LIMIT 1`, submissionID)
	p, err := scanProperty(row)
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindBySourceCredentialSubmission: %w", err)
	}
	return p, nil
}

func (r *PropertyRepository) CreateDraftFromOwnerCredential(ownerUserID, submissionID int64, built propertymod.BuiltPropertyDraft) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO properties (
			owner_user_id, source_credential_submission_id, address, deed_no, deed_hash,
			verification_status, completeness_status
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		ownerUserID, submissionID, built.Address, built.DeedNo, built.DeedHash,
		model.PropertyVerificationDraft, model.PropertyCompletenessDisclosureRequired,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("property_repo: CreateDraftFromOwnerCredential: %w", err)
	}
	return id, nil
}

func (r *PropertyRepository) UpdateDisclosure(id int64, built propertymod.BuiltDisclosureSnapshot) error {
	_, err := r.db.Exec(`
		UPDATE properties
		SET address=$1,
		    deed_no=$2,
		    deed_hash=$3,
		    disclosure_snapshot_json=$4,
		    disclosure_hash=$5,
		    completeness_status=$6,
		    updated_at=NOW()
		WHERE id=$7`,
		built.Address,
		built.DeedNo,
		built.DeedHash,
		built.DisclosureSnapshotJSON,
		built.DisclosureHash,
		model.PropertyCompletenessSnapshotReady,
		id,
	)
	if err != nil {
		return fmt.Errorf("property_repo: UpdateDisclosure: %w", err)
	}
	return nil
}

func (r *PropertyRepository) MarkReadyForListing(id int64) error {
	_, err := r.db.Exec(`
		UPDATE properties
		SET verification_status=$1,
		    completeness_status=$2,
		    updated_at=NOW()
		WHERE id=$3`,
		model.PropertyVerificationVerified,
		model.PropertyCompletenessReadyForListing,
		id,
	)
	if err != nil {
		return fmt.Errorf("property_repo: MarkReadyForListing: %w", err)
	}
	return nil
}
