package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type TenantProfileRepository struct {
	db *sql.DB
}

func NewTenantProfileRepository(db *sql.DB) *TenantProfileRepository {
	return &TenantProfileRepository{db: db}
}

func (r *TenantProfileRepository) FindByUserID(userID int64) (*model.TenantProfile, []*model.TenantProfileDocument, error) {
	profile := &model.TenantProfile{}
	err := r.db.QueryRow(`
		SELECT id, user_id, occupation_type, org_name, income_range,
		       household_size, co_resident_note, move_in_timeline, additional_note,
		       advanced_data_status, created_at, updated_at
		FROM tenant_profiles WHERE user_id = $1
	`, userID).Scan(
		&profile.ID, &profile.UserID, &profile.OccupationType, &profile.OrgName,
		&profile.IncomeRange, &profile.HouseholdSize, &profile.CoResidentNote,
		&profile.MoveInTimeline, &profile.AdditionalNote, &profile.AdvancedDataStatus,
		&profile.CreatedAt, &profile.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("tenant_profile_repo: FindByUserID: %w", err)
	}

	rows, err := r.db.Query(`
		SELECT id, tenant_profile_id, doc_type, file_path, created_at
		FROM tenant_profile_documents WHERE tenant_profile_id = $1
	`, profile.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("tenant_profile_repo: FindByUserID docs: %w", err)
	}
	defer rows.Close()

	var docs []*model.TenantProfileDocument
	for rows.Next() {
		d := &model.TenantProfileDocument{}
		if err := rows.Scan(&d.ID, &d.TenantProfileID, &d.DocType, &d.FilePath, &d.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("tenant_profile_repo: scan doc: %w", err)
		}
		docs = append(docs, d)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("tenant_profile_repo: docs rows err: %w", err)
	}

	return profile, docs, nil
}

func (r *TenantProfileRepository) Upsert(userID int64, occupationType, orgName, incomeRange string, householdSize int, coResidentNote, moveInTimeline, additionalNote string) (*model.TenantProfile, error) {
	profile := &model.TenantProfile{}
	err := r.db.QueryRow(`
		INSERT INTO tenant_profiles (
			user_id, occupation_type, org_name, income_range,
			household_size, co_resident_note, move_in_timeline, additional_note
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (user_id) DO UPDATE SET
			occupation_type = EXCLUDED.occupation_type,
			org_name = EXCLUDED.org_name,
			income_range = EXCLUDED.income_range,
			household_size = EXCLUDED.household_size,
			co_resident_note = EXCLUDED.co_resident_note,
			move_in_timeline = EXCLUDED.move_in_timeline,
			additional_note = EXCLUDED.additional_note,
			updated_at = NOW()
		RETURNING id, user_id, occupation_type, org_name, income_range,
		          household_size, co_resident_note, move_in_timeline, additional_note,
		          advanced_data_status, created_at, updated_at
	`, userID, occupationType, orgName, incomeRange, householdSize, coResidentNote, moveInTimeline, additionalNote).Scan(
		&profile.ID, &profile.UserID, &profile.OccupationType, &profile.OrgName,
		&profile.IncomeRange, &profile.HouseholdSize, &profile.CoResidentNote,
		&profile.MoveInTimeline, &profile.AdditionalNote, &profile.AdvancedDataStatus,
		&profile.CreatedAt, &profile.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("tenant_profile_repo: Upsert: %w", err)
	}
	return profile, nil
}

func (r *TenantProfileRepository) CreateDocument(profileID int64, docType, filePath string) error {
	_, err := r.db.Exec(`
		INSERT INTO tenant_profile_documents (tenant_profile_id, doc_type, file_path)
		VALUES ($1, $2, $3)
	`, profileID, docType, filePath)
	if err != nil {
		return fmt.Errorf("tenant_profile_repo: CreateDocument: %w", err)
	}
	return nil
}

func (r *TenantProfileRepository) UpdateAdvancedDataStatus(profileID int64, status string) error {
	_, err := r.db.Exec(`
		UPDATE tenant_profiles SET advanced_data_status = $1, updated_at = NOW()
		WHERE id = $2
	`, status, profileID)
	if err != nil {
		return fmt.Errorf("tenant_profile_repo: UpdateAdvancedDataStatus: %w", err)
	}
	return nil
}
