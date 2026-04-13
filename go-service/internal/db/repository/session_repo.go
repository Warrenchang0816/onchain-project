package repository

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"
)

type SessionRepository struct {
	DB *sql.DB
}

type WalletSession struct {
	SessionToken  string
	WalletAddress string
	ChainID       string
	ExpiredAt     time.Time
	Revoked       bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func NewSessionRepository(db *sql.DB) *SessionRepository {
	return &SessionRepository{
		DB: db,
	}
}

func GenerateSessionToken() (string, error) {
	bytes := make([]byte, 32)

	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(bytes), nil
}

func (r *SessionRepository) Create(walletAddress string, chainID string, expiredAt time.Time) (string, error) {
	sessionToken, err := GenerateSessionToken()
	if err != nil {
		return "", err
	}

	query := `
        INSERT INTO wallet_session (
            wallet_address,
            session_token,
            chain_id,
            expired_at,
            revoked,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
    `

	_, err = r.DB.Exec(query, walletAddress, sessionToken, chainID, expiredAt)
	if err != nil {
		return "", err
	}

	return sessionToken, nil
}

func (r *SessionRepository) GetByToken(sessionToken string) (*WalletSession, error) {
	query := `
        SELECT
            session_token,
            wallet_address,
            chain_id,
            expired_at,
            revoked,
            created_at,
            updated_at
        FROM wallet_session
        WHERE session_token = $1
        LIMIT 1
    `

	session := &WalletSession{}

	err := r.DB.QueryRow(query, sessionToken).Scan(
		&session.SessionToken,
		&session.WalletAddress,
		&session.ChainID,
		&session.ExpiredAt,
		&session.Revoked,
		&session.CreatedAt,
		&session.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return session, nil
}

func (r *SessionRepository) Revoke(sessionToken string) error {
	query := `
        UPDATE wallet_session
        SET revoked = TRUE,
            updated_at = NOW()
        WHERE session_token = $1
          AND revoked = FALSE
    `

	_, err := r.DB.Exec(query, sessionToken)
	return err
}
