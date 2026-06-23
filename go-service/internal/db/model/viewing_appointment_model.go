package model

import (
	"database/sql"
	"time"
)

// Appointment status constants
const (
	AppointmentStatusPending    = "PENDING"
	AppointmentStatusConfirmed  = "CONFIRMED"
	AppointmentStatusViewed     = "VIEWED"
	AppointmentStatusInterested = "INTERESTED"
	AppointmentStatusCancelled  = "CANCELLED"
)

type ViewingAppointment struct {
	ID            int64
	PropertyID    int64
	VisitorUserID int64

	QueuePosition int
	PreferredTime time.Time
	ConfirmedTime sql.NullTime

	Status string
	Note   sql.NullString

	CreatedAt time.Time
	UpdatedAt time.Time
}
