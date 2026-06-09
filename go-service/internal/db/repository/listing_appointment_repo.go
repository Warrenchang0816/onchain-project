package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type ListingAppointmentRepository struct {
	db *sql.DB
}

func NewListingAppointmentRepository(db *sql.DB) *ListingAppointmentRepository {
	return &ListingAppointmentRepository{db: db}
}

const apptSelectCols = `
	SELECT id, listing_id, property_id, visitor_user_id,
	       queue_position, preferred_time, confirmed_time,
	       status, note,
	       created_at, updated_at
	FROM listing_appointments`

func scanAppointment(row *sql.Row) (*model.ListingAppointment, error) {
	a := &model.ListingAppointment{}
	var propertyID sql.NullInt64
	err := row.Scan(
		&a.ID, &a.ListingID, &propertyID, &a.VisitorUserID,
		&a.QueuePosition, &a.PreferredTime, &a.ConfirmedTime,
		&a.Status, &a.Note,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.PropertyID = propertyID.Int64
	return a, nil
}

func scanAppointments(rows *sql.Rows) ([]*model.ListingAppointment, error) {
	var result []*model.ListingAppointment
	for rows.Next() {
		a := &model.ListingAppointment{}
		var propertyID sql.NullInt64
		err := rows.Scan(
			&a.ID, &a.ListingID, &propertyID, &a.VisitorUserID,
			&a.QueuePosition, &a.PreferredTime, &a.ConfirmedTime,
			&a.Status, &a.Note,
			&a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		a.PropertyID = propertyID.Int64
		result = append(result, a)
	}
	return result, rows.Err()
}

// FindByID returns an appointment by primary key.
func (r *ListingAppointmentRepository) FindByID(id int64) (*model.ListingAppointment, error) {
	row := r.db.QueryRow(apptSelectCols+` WHERE id = $1`, id)
	a, err := scanAppointment(row)
	if err != nil {
		return nil, fmt.Errorf("appt_repo: FindByID: %w", err)
	}
	return a, nil
}

// FindByProperty returns all appointments for a property ordered by queue_position.
func (r *ListingAppointmentRepository) FindByProperty(propertyID int64) ([]*model.ListingAppointment, error) {
	rows, err := r.db.Query(apptSelectCols+` WHERE property_id = $1 ORDER BY queue_position ASC`, propertyID)
	if err != nil {
		return nil, fmt.Errorf("appt_repo: FindByProperty: %w", err)
	}
	defer rows.Close()
	return scanAppointments(rows)
}

// FindByPropertyAndVisitor finds an existing appointment for this (property, visitor) pair.
func (r *ListingAppointmentRepository) FindByPropertyAndVisitor(propertyID, visitorUserID int64) (*model.ListingAppointment, error) {
	row := r.db.QueryRow(apptSelectCols+` WHERE property_id=$1 AND visitor_user_id=$2 ORDER BY id DESC LIMIT 1`, propertyID, visitorUserID)
	return scanAppointment(row)
}

// NextQueuePosition returns (current max queue_position + 1) for a property.
func (r *ListingAppointmentRepository) NextQueuePosition(propertyID int64) (int, error) {
	var pos int
	err := r.db.QueryRow(`
		SELECT COALESCE(MAX(queue_position), 0) + 1
		FROM listing_appointments WHERE property_id = $1`, propertyID).Scan(&pos)
	if err != nil {
		return 0, fmt.Errorf("appt_repo: NextQueuePosition: %w", err)
	}
	return pos, nil
}

// Create inserts a new property-based appointment and returns the new ID.
func (r *ListingAppointmentRepository) Create(propertyID, visitorUserID int64, queuePosition int, preferredTime time.Time, note *string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listing_appointments
		    (property_id, visitor_user_id, queue_position, preferred_time, note)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		propertyID, visitorUserID, queuePosition, preferredTime, note,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("appt_repo: Create: %w", err)
	}
	return id, nil
}

// SetStatus updates the status of an appointment.
func (r *ListingAppointmentRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`
		UPDATE listing_appointments SET status=$1, updated_at=NOW() WHERE id=$2`,
		status, id,
	)
	if err != nil {
		return fmt.Errorf("appt_repo: SetStatus: %w", err)
	}
	return nil
}

// Confirm sets the status to CONFIRMED and records the owner-confirmed time slot.
func (r *ListingAppointmentRepository) Confirm(id int64, confirmedTime time.Time) error {
	_, err := r.db.Exec(`
		UPDATE listing_appointments
		SET status='CONFIRMED', confirmed_time=$1, updated_at=NOW()
		WHERE id=$2`,
		confirmedTime, id,
	)
	if err != nil {
		return fmt.Errorf("appt_repo: Confirm: %w", err)
	}
	return nil
}
