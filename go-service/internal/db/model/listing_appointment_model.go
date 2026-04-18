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

type ListingAppointment struct {
	ID            int64
	ListingID     int64
	VisitorUserID int64

	QueuePosition int
	PreferredTime time.Time
	ConfirmedTime sql.NullTime

	Status string
	Note   sql.NullString

	CreatedAt time.Time
	UpdatedAt time.Time
}
