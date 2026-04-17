package repository

import (
	"database/sql"
	"fmt"
	"time"
)

type OTPRepository struct {
	db *sql.DB
}

func NewOTPRepository(db *sql.DB) *OTPRepository {
	return &OTPRepository{db: db}
}

// Create inserts a new OTP code. sessionID may be empty (linked after session is created).
func (r *OTPRepository) Create(target, channel, code string, sessionID *string, expiresAt time.Time) error {
	var sid interface{}
	if sessionID != nil && *sessionID != "" {
		sid = *sessionID
	}
	_, err := r.db.Exec(`
		INSERT INTO otp_codes (target, channel, code, session_id, expires_at)
		VALUES ($1, $2, $3, $4, $5)
	`, target, channel, code, sid, expiresAt)
	if err != nil {
		return fmt.Errorf("otp_repo: create: %w", err)
	}
	return nil
}

// LatestCreatedAt returns the creation time of the most recent OTP for target+channel,
// or zero time if none exists. Used for rate-limiting (1 per 60 s).
func (r *OTPRepository) LatestCreatedAt(target, channel string) (time.Time, error) {
	var t time.Time
	err := r.db.QueryRow(`
		SELECT created_at FROM otp_codes
		WHERE target = $1 AND channel = $2
		ORDER BY created_at DESC LIMIT 1
	`, target, channel).Scan(&t)
	if err == sql.ErrNoRows {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("otp_repo: latest: %w", err)
	}
	return t, nil
}

// Verify checks whether code is valid for target+channel, marks it used, and returns true.
// Returns false (no error) when the code is wrong, expired, or already used.
func (r *OTPRepository) Verify(target, channel, code string) (bool, error) {
	var id int64
	err := r.db.QueryRow(`
		SELECT id FROM otp_codes
		WHERE target = $1 AND channel = $2 AND code = $3
		  AND used = FALSE AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1
	`, target, channel, code).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("otp_repo: verify: %w", err)
	}

	_, err = r.db.Exec(`UPDATE otp_codes SET used = TRUE WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("otp_repo: mark used: %w", err)
	}
	return true, nil
}
