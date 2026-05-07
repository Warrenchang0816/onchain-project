package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
	customermod "go-service/internal/modules/customer"
)

type CustomerRepository struct {
	db *sql.DB
}

func NewCustomerRepository(db *sql.DB) *CustomerRepository {
	return &CustomerRepository{db: db}
}

const propertySelectCols = `
	SELECT id, owner_user_id, source_credential_submission_id,
	       address, deed_no, deed_hash, property_statement_json, warranty_answers_json,
	       disclosure_snapshot_json, disclosure_hash, verification_status, completeness_status,
	       created_at, updated_at
	FROM customer`

func scanProperty(row *sql.Row) (*model.Customer, error) {
	p := &model.Customer{}
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

func scanProperties(rows *sql.Rows) ([]*model.Customer, error) {
	defer rows.Close()

	properties := []*model.Customer{}
	for rows.Next() {
		p := &model.Customer{}
		if err := rows.Scan(
			&p.ID, &p.OwnerUserID, &p.SourceCredentialSubmissionID,
			&p.Address, &p.DeedNo, &p.DeedHash, &p.PropertyStatementJSON, &p.WarrantyAnswersJSON,
			&p.DisclosureSnapshotJSON, &p.DisclosureHash, &p.VerificationStatus, &p.CompletenessStatus,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		properties = append(properties, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return properties, nil
}

func (r *CustomerRepository) FindByID(id int64) (*model.Customer, error) {
	row := r.db.QueryRow(propertySelectCols+` WHERE id = $1`, id)
	p, err := scanProperty(row)
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindByID: %w", err)
	}
	return p, nil
}

func (r *CustomerRepository) ListByOwnerUserID(ownerUserID int64) ([]*model.Customer, error) {
	rows, err := r.db.Query(propertySelectCols+` WHERE owner_user_id = $1 ORDER BY updated_at DESC, id DESC`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListByOwnerUserID: %w", err)
	}
	properties, err := scanProperties(rows)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListByOwnerUserID scan: %w", err)
	}
	return properties, nil
}

func (r *CustomerRepository) FindBySourceCredentialSubmission(submissionID int64) (*model.Customer, error) {
	row := r.db.QueryRow(propertySelectCols+` WHERE source_credential_submission_id = $1 LIMIT 1`, submissionID)
	p, err := scanProperty(row)
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindBySourceCredentialSubmission: %w", err)
	}
	return p, nil
}

func (r *CustomerRepository) CreateDraftFromOwnerCredential(ownerUserID, submissionID int64, built customermod.BuiltPropertyDraft) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO customer (
			owner_user_id, source_credential_submission_id, address, deed_no, deed_hash,
			verification_status, completeness_status
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		ownerUserID, submissionID, built.Address, built.DeedNo, built.DeedHash,
		model.CustomerVerificationDraft, model.CustomerCompletenessDisclosureRequired,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("property_repo: CreateDraftFromOwnerCredential: %w", err)
	}
	return id, nil
}

func (r *CustomerRepository) UpdateDisclosure(id int64, built customermod.BuiltDisclosureSnapshot) error {
	_, err := r.db.Exec(`
		UPDATE customer
		SET address=$1,
		    deed_no=$2,
		    deed_hash=$3,
		    property_statement_json=$4,
		    warranty_answers_json=$5,
		    disclosure_snapshot_json=$6,
		    disclosure_hash=$7,
		    completeness_status=$8,
		    updated_at=NOW()
		WHERE id=$9`,
		built.Address,
		built.DeedNo,
		built.DeedHash,
		built.PropertyStatementJSON,
		built.WarrantyAnswersJSON,
		built.DisclosureSnapshotJSON,
		built.DisclosureHash,
		model.CustomerCompletenessSnapshotReady,
		id,
	)
	if err != nil {
		return fmt.Errorf("property_repo: UpdateDisclosure: %w", err)
	}
	return nil
}

func (r *CustomerRepository) MarkReadyForListing(id int64) error {
	_, err := r.db.Exec(`
		UPDATE customer
		SET verification_status=$1,
		    completeness_status=$2,
		    updated_at=NOW()
		WHERE id=$3`,
		model.CustomerVerificationVerified,
		model.CustomerCompletenessReadyForListing,
		id,
	)
	if err != nil {
		return fmt.Errorf("property_repo: MarkReadyForListing: %w", err)
	}
	return nil
}
