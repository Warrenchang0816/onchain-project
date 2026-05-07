package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type LocationRepository struct {
	db *sql.DB
}

func NewLocationRepository(db *sql.DB) *LocationRepository {
	return &LocationRepository{db: db}
}

func (r *LocationRepository) ListTaiwanDistricts() ([]model.TaiwanDistrict, error) {
	rows, err := r.db.Query(`
		SELECT id, county, district, postal_code, sort_order
		FROM taiwan_districts
		ORDER BY sort_order ASC, county ASC, district ASC`)
	if err != nil {
		return nil, fmt.Errorf("location_repo: ListTaiwanDistricts: %w", err)
	}
	defer rows.Close()

	result := []model.TaiwanDistrict{}
	for rows.Next() {
		var d model.TaiwanDistrict
		if err := rows.Scan(&d.ID, &d.County, &d.District, &d.PostalCode, &d.SortOrder); err != nil {
			return nil, fmt.Errorf("location_repo: ListTaiwanDistricts scan: %w", err)
		}
		result = append(result, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("location_repo: ListTaiwanDistricts rows: %w", err)
	}
	return result, nil
}
