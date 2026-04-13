package repository

import (
	"database/sql"
	"time"
)

type NonceRecord struct {
	ID            int64
	WalletAddress string
	Nonce         string
	IssuedAt      time.Time
	ExpiredAt     time.Time
	Used          bool
}

type NonceRepository struct {
	DB *sql.DB
}

func NewNonceRepository(db *sql.DB) *NonceRepository {
	return &NonceRepository{
		DB: db,
	}
}

func (r *NonceRepository) Create(walletAddress string, nonce string, expiredAt time.Time) error {
	query := `
        INSERT INTO auth_nonce (
            wallet_address,
            nonce,
            expired_at,
            used,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, FALSE, NOW(), NOW())
    `

	_, err := r.DB.Exec(query, walletAddress, nonce, expiredAt)
	return err
}

func (r *NonceRepository) FindLatestByWalletAddress(walletAddress string) (*NonceRecord, error) {
	query := `
        SELECT id, wallet_address, nonce, issued_at, expired_at, used
        FROM auth_nonce
        WHERE wallet_address = $1
        ORDER BY id DESC
        LIMIT 1
    `

	var record NonceRecord

	err := r.DB.QueryRow(query, walletAddress).Scan(
		&record.ID,
		&record.WalletAddress,
		&record.Nonce,
		&record.IssuedAt,
		&record.ExpiredAt,
		&record.Used,
	)
	if err != nil {
		return nil, err
	}

	return &record, nil
}

func (r *NonceRepository) MarkUsed(id int64) error {
	query := `
        UPDATE auth_nonce
        SET used = TRUE,
            updated_at = NOW()
        WHERE id = $1
    `

	_, err := r.DB.Exec(query, id)
	return err
}
