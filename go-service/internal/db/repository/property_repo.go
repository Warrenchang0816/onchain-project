package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type PropertyRepository struct {
	db *sql.DB
}

func NewPropertyRepository(db *sql.DB) *PropertyRepository {
	return &PropertyRepository{db: db}
}

func (r *PropertyRepository) Create(ownerUserID int64, title, address string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO property (owner_user_id, title, address, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id`,
		ownerUserID, title, address,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("customer_repo: Create: %w", err)
	}
	return id, nil
}

func (r *PropertyRepository) FindByID(id int64) (*model.Property, error) {
	row := r.db.QueryRow(`
		SELECT id, owner_user_id, title, address, district_id,
		       building_type, floor, total_floors,
		       main_area, auxiliary_area, balcony_area, shared_area, awning_area, land_area,
		       rooms, living_rooms, bathrooms, is_corner_unit, has_dark_room,
		       building_age, building_structure, exterior_material, building_usage, zoning, units_on_floor,
		       building_orientation, window_orientation,
		       parking_type, management_fee, security_type,
		       setup_status, created_at, updated_at
		FROM property WHERE id = $1`, id)
	p, err := scanProperty(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindByID: %w", err)
	}
	return p, nil
}

func (r *PropertyRepository) ListByOwner(ownerUserID int64) ([]*model.Property, error) {
	rows, err := r.db.Query(`
		SELECT id, owner_user_id, title, address, district_id,
		       building_type, floor, total_floors,
		       main_area, auxiliary_area, balcony_area, shared_area, awning_area, land_area,
		       rooms, living_rooms, bathrooms, is_corner_unit, has_dark_room,
		       building_age, building_structure, exterior_material, building_usage, zoning, units_on_floor,
		       building_orientation, window_orientation,
		       parking_type, management_fee, security_type,
		       setup_status, created_at, updated_at
		FROM property WHERE owner_user_id = $1 ORDER BY created_at DESC`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListByOwner: %w", err)
	}
	defer rows.Close()
	var out []*model.Property
	for rows.Next() {
		p, err := scanPropertyRow(rows)
		if err != nil {
			return nil, fmt.Errorf("property_repo: ListByOwner scan: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PropertyRepository) Update(p *model.Property) error {
	_, err := r.db.Exec(`
		UPDATE property SET
		    title=$1, address=$2, district_id=$3, building_type=$4,
		    floor=$5, total_floors=$6,
		    main_area=$7, auxiliary_area=$8, balcony_area=$9, shared_area=$10,
		    awning_area=$11, land_area=$12,
		    rooms=$13, living_rooms=$14, bathrooms=$15,
		    is_corner_unit=$16, has_dark_room=$17,
		    building_age=$18, building_structure=$19, exterior_material=$20,
		    building_usage=$21, zoning=$22, units_on_floor=$23,
		    building_orientation=$24, window_orientation=$25,
		    parking_type=$26, management_fee=$27, security_type=$28,
		    setup_status=$29, updated_at=NOW()
		WHERE id=$30`,
		p.Title, p.Address, p.DistrictID, p.BuildingType,
		p.Floor, p.TotalFloors,
		p.MainArea, p.AuxiliaryArea, p.BalconyArea, p.SharedArea,
		p.AwningArea, p.LandArea,
		p.Rooms, p.LivingRooms, p.Bathrooms,
		p.IsCornerUnit, p.HasDarkRoom,
		p.BuildingAge, p.BuildingStructure, p.ExteriorMaterial,
		p.BuildingUsage, p.Zoning, p.UnitsOnFloor,
		p.BuildingOrientation, p.WindowOrientation,
		p.ParkingType, p.ManagementFee, p.SecurityType,
		p.SetupStatus, p.ID,
	)
	if err != nil {
		return fmt.Errorf("property_repo: Update: %w", err)
	}
	return nil
}

func (r *PropertyRepository) AddAttachment(propertyID int64, attachType, url string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO property_attachment (property_id, type, url, created_at)
		VALUES ($1, $2, $3, NOW()) RETURNING id`,
		propertyID, attachType, url,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("property_repo: AddAttachment: %w", err)
	}
	return id, nil
}

func (r *PropertyRepository) DeleteAttachment(propertyID, attachmentID int64) error {
	_, err := r.db.Exec(`DELETE FROM property_attachment WHERE id=$1 AND property_id=$2`,
		attachmentID, propertyID)
	if err != nil {
		return fmt.Errorf("property_repo: DeleteAttachment: %w", err)
	}
	return nil
}

func (r *PropertyRepository) ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error) {
	rows, err := r.db.Query(`
		SELECT id, property_id, type, url, created_at
		FROM property_attachment WHERE property_id=$1 ORDER BY created_at ASC`, propertyID)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListAttachments: %w", err)
	}
	defer rows.Close()
	var out []*model.PropertyAttachment
	for rows.Next() {
		a := &model.PropertyAttachment{}
		if err := rows.Scan(&a.ID, &a.PropertyID, &a.Type, &a.URL, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("property_repo: ListAttachments scan: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *PropertyRepository) SetSetupStatus(id int64, status string, updatedAt time.Time) error {
	_, err := r.db.Exec(`UPDATE property SET setup_status=$1, updated_at=$2 WHERE id=$3`,
		status, updatedAt, id)
	return err
}

func scanProperty(row *sql.Row) (*model.Property, error) {
	p := &model.Property{}
	return p, row.Scan(
		&p.ID, &p.OwnerUserID, &p.Title, &p.Address, &p.DistrictID,
		&p.BuildingType, &p.Floor, &p.TotalFloors,
		&p.MainArea, &p.AuxiliaryArea, &p.BalconyArea, &p.SharedArea, &p.AwningArea, &p.LandArea,
		&p.Rooms, &p.LivingRooms, &p.Bathrooms, &p.IsCornerUnit, &p.HasDarkRoom,
		&p.BuildingAge, &p.BuildingStructure, &p.ExteriorMaterial,
		&p.BuildingUsage, &p.Zoning, &p.UnitsOnFloor,
		&p.BuildingOrientation, &p.WindowOrientation,
		&p.ParkingType, &p.ManagementFee, &p.SecurityType,
		&p.SetupStatus, &p.CreatedAt, &p.UpdatedAt,
	)
}

func scanPropertyRow(rows *sql.Rows) (*model.Property, error) {
	p := &model.Property{}
	return p, rows.Scan(
		&p.ID, &p.OwnerUserID, &p.Title, &p.Address, &p.DistrictID,
		&p.BuildingType, &p.Floor, &p.TotalFloors,
		&p.MainArea, &p.AuxiliaryArea, &p.BalconyArea, &p.SharedArea, &p.AwningArea, &p.LandArea,
		&p.Rooms, &p.LivingRooms, &p.Bathrooms, &p.IsCornerUnit, &p.HasDarkRoom,
		&p.BuildingAge, &p.BuildingStructure, &p.ExteriorMaterial,
		&p.BuildingUsage, &p.Zoning, &p.UnitsOnFloor,
		&p.BuildingOrientation, &p.WindowOrientation,
		&p.ParkingType, &p.ManagementFee, &p.SecurityType,
		&p.SetupStatus, &p.CreatedAt, &p.UpdatedAt,
	)
}
