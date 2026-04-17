package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type UserCredentialRepository struct {
	db *sql.DB
}

func NewUserCredentialRepository(db *sql.DB) *UserCredentialRepository {
	return &UserCredentialRepository{db: db}
}

// Create inserts a pending credential application.
func (r *UserCredentialRepository) Create(userID int64, credentialType, docPath string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO user_credentials (user_id, credential_type, doc_path, review_status)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, credential_type) DO UPDATE
		    SET doc_path = EXCLUDED.doc_path,
		        review_status = $4,
		        updated_at = NOW()
		RETURNING id
	`, userID, credentialType, nullStr(docPath), model.CredentialReviewPending).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("user_credential_repo: create: %w", err)
	}
	return id, nil
}

// FindByUser returns all credentials for a user.
func (r *UserCredentialRepository) FindByUser(userID int64) ([]*model.UserCredential, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, credential_type,
		       doc_path, review_status, reviewer_note, reviewed_by_wallet,
		       nft_token_id, tx_hash, verified_at, created_at, updated_at
		FROM user_credentials WHERE user_id = $1
		ORDER BY credential_type
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return r.scanAll(rows)
}

// SetVerified marks the credential as verified and stores NFT details.
func (r *UserCredentialRepository) SetVerified(id int64, nftTokenID int32, txHash, reviewerWallet string) error {
	now := time.Now()
	_, err := r.db.Exec(`
		UPDATE user_credentials
		SET review_status = $1, nft_token_id = $2, tx_hash = $3,
		    reviewed_by_wallet = $4, verified_at = $5, updated_at = NOW()
		WHERE id = $6
	`, model.CredentialReviewVerified, nftTokenID, nullStr(txHash), reviewerWallet, now, id)
	return err
}

// SetRejected marks the credential as rejected with a note.
func (r *UserCredentialRepository) SetRejected(id int64, note, reviewerWallet string) error {
	_, err := r.db.Exec(`
		UPDATE user_credentials
		SET review_status = $1, reviewer_note = $2, reviewed_by_wallet = $3, updated_at = NOW()
		WHERE id = $4
	`, model.CredentialReviewRejected, note, reviewerWallet, id)
	return err
}

func (r *UserCredentialRepository) scanAll(rows *sql.Rows) ([]*model.UserCredential, error) {
	var list []*model.UserCredential
	for rows.Next() {
		var c model.UserCredential
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.CredentialType,
			&c.DocPath, &c.ReviewStatus, &c.ReviewerNote, &c.ReviewedByWallet,
			&c.NFTTokenID, &c.TxHash, &c.VerifiedAt, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &c)
	}
	return list, rows.Err()
}
