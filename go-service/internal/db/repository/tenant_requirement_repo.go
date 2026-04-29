package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type TenantRequirementRepository struct {
	db *sql.DB
}

func NewTenantRequirementRepository(db *sql.DB) *TenantRequirementRepository {
	return &TenantRequirementRepository{db: db}
}

type RequirementFilter struct {
	District string
	Status   string
}

const requirementSelectCols = `
	SELECT id, user_id, target_district, budget_min, budget_max, layout_note,
	       move_in_date, pet_friendly_needed, parking_needed, status, created_at, updated_at
	FROM tenant_requirements`

func scanRequirement(row *sql.Row) (*model.TenantRequirement, error) {
	r := &model.TenantRequirement{}
	err := row.Scan(
		&r.ID, &r.UserID, &r.TargetDistrict, &r.BudgetMin, &r.BudgetMax, &r.LayoutNote,
		&r.MoveInDate, &r.PetFriendlyNeeded, &r.ParkingNeeded, &r.Status,
		&r.CreatedAt, &r.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (r *TenantRequirementRepository) Create(req *model.TenantRequirement) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO tenant_requirements (
			user_id, target_district, budget_min, budget_max, layout_note,
			move_in_date, pet_friendly_needed, parking_needed
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, req.UserID, req.TargetDistrict, req.BudgetMin, req.BudgetMax, req.LayoutNote,
		req.MoveInDate, req.PetFriendlyNeeded, req.ParkingNeeded,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("tenant_requirement_repo: Create: %w", err)
	}
	return id, nil
}

func (r *TenantRequirementRepository) Update(req *model.TenantRequirement) error {
	_, err := r.db.Exec(`
		UPDATE tenant_requirements
		SET target_district = $1, budget_min = $2, budget_max = $3, layout_note = $4,
		    move_in_date = $5, pet_friendly_needed = $6, parking_needed = $7, updated_at = NOW()
		WHERE id = $8 AND user_id = $9
	`, req.TargetDistrict, req.BudgetMin, req.BudgetMax, req.LayoutNote,
		req.MoveInDate, req.PetFriendlyNeeded, req.ParkingNeeded,
		req.ID, req.UserID,
	)
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: Update: %w", err)
	}
	return nil
}

func (r *TenantRequirementRepository) UpdateStatus(id int64, status string) error {
	_, err := r.db.Exec(`
		UPDATE tenant_requirements SET status = $1, updated_at = NOW() WHERE id = $2
	`, status, id)
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: UpdateStatus: %w", err)
	}
	return nil
}

func (r *TenantRequirementRepository) FindMine(userID int64) ([]*model.TenantRequirement, error) {
	rows, err := r.db.Query(requirementSelectCols+` WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("tenant_requirement_repo: FindMine: %w", err)
	}
	defer rows.Close()
	return scanRequirements(rows)
}

func (r *TenantRequirementRepository) FindVisible(f RequirementFilter) ([]*model.TenantRequirement, error) {
	q := requirementSelectCols + ` WHERE status != 'CLOSED'`
	args := []interface{}{}
	idx := 1

	if f.District != "" {
		q += fmt.Sprintf(" AND target_district = $%d", idx)
		args = append(args, f.District)
		idx++
	}
	if f.Status != "" {
		q += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, f.Status)
		idx++
	}

	q += " ORDER BY created_at DESC"
	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("tenant_requirement_repo: FindVisible: %w", err)
	}
	defer rows.Close()
	return scanRequirements(rows)
}

func (r *TenantRequirementRepository) FindByID(id int64) (*model.TenantRequirement, error) {
	row := r.db.QueryRow(requirementSelectCols+` WHERE id = $1`, id)
	req, err := scanRequirement(row)
	if err != nil {
		return nil, fmt.Errorf("tenant_requirement_repo: FindByID: %w", err)
	}
	return req, nil
}

func scanRequirements(rows *sql.Rows) ([]*model.TenantRequirement, error) {
	var result []*model.TenantRequirement
	for rows.Next() {
		r := &model.TenantRequirement{}
		err := rows.Scan(
			&r.ID, &r.UserID, &r.TargetDistrict, &r.BudgetMin, &r.BudgetMax, &r.LayoutNote,
			&r.MoveInDate, &r.PetFriendlyNeeded, &r.ParkingNeeded, &r.Status,
			&r.CreatedAt, &r.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}
