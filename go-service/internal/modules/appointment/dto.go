package appointment

import "time"

type BookRequest struct {
	PreferredTime time.Time `json:"preferred_time" binding:"required"`
	Note          *string   `json:"note"`
}

type ConfirmRequest struct {
	ConfirmedTime time.Time `json:"confirmed_time" binding:"required"`
}

type StatusRequest struct {
	Status string `json:"status" binding:"required,oneof=VIEWED INTERESTED CANCELLED"`
}

type AppointmentResponse struct {
	ID            int64      `json:"id"`
	PropertyID    int64      `json:"property_id"`
	VisitorUserID int64      `json:"visitor_user_id"`
	QueuePosition int        `json:"queue_position"`
	PreferredTime time.Time  `json:"preferred_time"`
	ConfirmedTime *time.Time `json:"confirmed_time,omitempty"`
	Status        string     `json:"status"`
	Note          *string    `json:"note,omitempty"`
}
