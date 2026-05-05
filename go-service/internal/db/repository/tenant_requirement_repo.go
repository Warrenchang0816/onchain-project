package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/lib/pq"
	"go-service/internal/db/model"
)

type TenantRequirementRepository struct {
	db *sql.DB
}

func NewTenantRequirementRepository(db *sql.DB) *TenantRequirementRepository {
	return &TenantRequirementRepository{db: db}
}

type RequirementFilter struct {
	District  string
	Districts []string
	County    string
	Status    string
	Keyword   string
}

const requirementSelectCols = `
	SELECT id, user_id, target_district, budget_min, budget_max, layout_note,
	       move_in_date, pet_friendly_needed, parking_needed, status, created_at, updated_at,
	       area_min_ping, area_max_ping, room_min, bathroom_min, move_in_timeline,
	       minimum_lease_months, can_cook_needed, can_register_household_needed,
	       lifestyle_note, must_have_note
	FROM tenant_requirements`

type requirementScanner interface {
	Scan(dest ...any) error
}

func scanRequirementRow(row requirementScanner) (*model.TenantRequirement, error) {
	r := &model.TenantRequirement{}
	err := row.Scan(
		&r.ID, &r.UserID, &r.TargetDistrict, &r.BudgetMin, &r.BudgetMax, &r.LayoutNote,
		&r.MoveInDate, &r.PetFriendlyNeeded, &r.ParkingNeeded, &r.Status,
		&r.CreatedAt, &r.UpdatedAt,
		&r.AreaMinPing, &r.AreaMaxPing, &r.RoomMin, &r.BathroomMin, &r.MoveInTimeline,
		&r.MinimumLeaseMonths, &r.CanCookNeeded, &r.CanRegisterHouseholdNeeded,
		&r.LifestyleNote, &r.MustHaveNote,
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
			move_in_date, pet_friendly_needed, parking_needed, area_min_ping, area_max_ping,
			room_min, bathroom_min, move_in_timeline, minimum_lease_months,
			can_cook_needed, can_register_household_needed, lifestyle_note, must_have_note
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING id
	`, req.UserID, req.TargetDistrict, req.BudgetMin, req.BudgetMax, req.LayoutNote,
		req.MoveInDate, req.PetFriendlyNeeded, req.ParkingNeeded, req.AreaMinPing, req.AreaMaxPing,
		req.RoomMin, req.BathroomMin, req.MoveInTimeline, req.MinimumLeaseMonths,
		req.CanCookNeeded, req.CanRegisterHouseholdNeeded, req.LifestyleNote, req.MustHaveNote,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("tenant_requirement_repo: Create: %w", err)
	}
	if err := r.ReplaceDistricts(id, req.Districts); err != nil {
		return 0, err
	}
	return id, nil
}

func (r *TenantRequirementRepository) Update(req *model.TenantRequirement) error {
	_, err := r.db.Exec(`
		UPDATE tenant_requirements
		SET target_district = $1, budget_min = $2, budget_max = $3, layout_note = $4,
		    move_in_date = $5, pet_friendly_needed = $6, parking_needed = $7,
		    area_min_ping = $8, area_max_ping = $9, room_min = $10, bathroom_min = $11,
		    move_in_timeline = $12, minimum_lease_months = $13,
		    can_cook_needed = $14, can_register_household_needed = $15,
		    lifestyle_note = $16, must_have_note = $17, updated_at = NOW()
		WHERE id = $18 AND user_id = $19
	`, req.TargetDistrict, req.BudgetMin, req.BudgetMax, req.LayoutNote,
		req.MoveInDate, req.PetFriendlyNeeded, req.ParkingNeeded,
		req.AreaMinPing, req.AreaMaxPing, req.RoomMin, req.BathroomMin,
		req.MoveInTimeline, req.MinimumLeaseMonths, req.CanCookNeeded,
		req.CanRegisterHouseholdNeeded, req.LifestyleNote, req.MustHaveNote,
		req.ID, req.UserID,
	)
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: Update: %w", err)
	}
	return r.ReplaceDistricts(req.ID, req.Districts)
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
	reqs, err := scanRequirements(rows)
	if err != nil {
		return nil, err
	}
	if err := r.attachDistricts(reqs); err != nil {
		return nil, err
	}
	return reqs, nil
}

func (r *TenantRequirementRepository) FindVisible(f RequirementFilter) ([]*model.TenantRequirement, error) {
	q, args := buildVisibleRequirementsQuery(f)
	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("tenant_requirement_repo: FindVisible: %w", err)
	}
	defer rows.Close()
	reqs, err := scanRequirements(rows)
	if err != nil {
		return nil, err
	}
	if err := r.attachDistricts(reqs); err != nil {
		return nil, err
	}
	return reqs, nil
}

func (r *TenantRequirementRepository) FindByID(id int64) (*model.TenantRequirement, error) {
	row := r.db.QueryRow(requirementSelectCols+` WHERE id = $1`, id)
	req, err := scanRequirementRow(row)
	if err != nil {
		return nil, fmt.Errorf("tenant_requirement_repo: FindByID: %w", err)
	}
	if req != nil {
		if err := r.attachDistricts([]*model.TenantRequirement{req}); err != nil {
			return nil, err
		}
	}
	return req, nil
}

func scanRequirements(rows *sql.Rows) ([]*model.TenantRequirement, error) {
	var result []*model.TenantRequirement
	for rows.Next() {
		r, err := scanRequirementRow(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func buildVisibleRequirementsQuery(f RequirementFilter) (string, []interface{}) {
	q := requirementSelectCols + ` WHERE status != 'CLOSED'`
	args := []interface{}{}
	idx := 1

	if len(f.Districts) > 0 {
		q += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM tenant_requirement_districts trd
			WHERE trd.requirement_id = tenant_requirements.id
			  AND (trd.county || ':' || trd.district || ':' || trd.zip_code) = ANY($%d)
		)`, idx)
		args = append(args, pq.Array(f.Districts))
		idx++
	}
	if strings.TrimSpace(f.County) != "" {
		q += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM tenant_requirement_districts trd
			WHERE trd.requirement_id = tenant_requirements.id
			  AND trd.county = $%d
		)`, idx)
		args = append(args, strings.TrimSpace(f.County))
		idx++
	}
	if strings.TrimSpace(f.District) != "" {
		q += fmt.Sprintf(" AND target_district = $%d", idx)
		args = append(args, strings.TrimSpace(f.District))
		idx++
	}
	if strings.TrimSpace(f.Status) != "" {
		q += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, strings.TrimSpace(f.Status))
		idx++
	}
	if strings.TrimSpace(f.Keyword) != "" {
		q += fmt.Sprintf(" AND (layout_note ILIKE $%d OR target_district ILIKE $%d)", idx, idx)
		args = append(args, "%"+strings.TrimSpace(f.Keyword)+"%")
		idx++
	}

	q += " ORDER BY created_at DESC"
	return q, args
}

func (r *TenantRequirementRepository) ReplaceDistricts(requirementID int64, districts []*model.TenantRequirementDistrict) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM tenant_requirement_districts WHERE requirement_id = $1`, requirementID); err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts delete: %w", err)
	}
	for _, d := range districts {
		if _, err := tx.Exec(`
			INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (requirement_id, county, district, zip_code) DO NOTHING
		`, requirementID, d.County, d.District, d.ZipCode); err != nil {
			return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts insert: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts commit: %w", err)
	}
	return nil
}

func (r *TenantRequirementRepository) attachDistricts(reqs []*model.TenantRequirement) error {
	if len(reqs) == 0 {
		return nil
	}
	byID := map[int64]*model.TenantRequirement{}
	ids := make([]int64, 0, len(reqs))
	for _, req := range reqs {
		byID[req.ID] = req
		ids = append(ids, req.ID)
	}
	rows, err := r.db.Query(`
		SELECT id, requirement_id, county, district, zip_code, created_at
		FROM tenant_requirement_districts
		WHERE requirement_id = ANY($1)
		ORDER BY county, zip_code, district
	`, pq.Array(ids))
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: attachDistricts: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		d := &model.TenantRequirementDistrict{}
		if err := rows.Scan(&d.ID, &d.RequirementID, &d.County, &d.District, &d.ZipCode, &d.CreatedAt); err != nil {
			return err
		}
		if req := byID[d.RequirementID]; req != nil {
			req.Districts = append(req.Districts, d)
		}
	}
	return rows.Err()
}
