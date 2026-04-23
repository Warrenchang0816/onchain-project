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
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return 0, fmt.Errorf("user_credential_repo: create: %w", err)
	}

	var id int64
	err = r.db.QueryRow(`
		INSERT INTO user_credentials (user_id, credential_type, doc_path, review_status, revoked_at, revoked_reason)
		VALUES ($1, $2, $3, $4, NULL, '')
		ON CONFLICT (user_id, credential_type) DO UPDATE
		    SET doc_path = EXCLUDED.doc_path,
		        review_status = $4,
		        revoked_at = NULL,
		        revoked_reason = '',
		        updated_at = NOW()
		RETURNING id
	`, userID, normalizedType, nullStr(docPath), model.CredentialReviewPending).Scan(&id)
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
		       revoked_at, revoked_reason,
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
		    reviewed_by_wallet = $4, verified_at = $5,
		    revoked_at = NULL, revoked_reason = '',
		    updated_at = NOW()
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

// UpsertIssuedCredential records an issued credential in the read model.
func (r *UserCredentialRepository) UpsertIssuedCredential(userID int64, credentialType string, tokenID int32, txHash, reviewerWallet string) error {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return fmt.Errorf("user_credential_repo: upsert issued credential: %w", err)
	}

	_, err = r.db.Exec(`
		INSERT INTO user_credentials (
			user_id, credential_type, review_status, nft_token_id, tx_hash, reviewed_by_wallet, verified_at,
			revoked_at, revoked_reason
		) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL, '')
		ON CONFLICT (user_id, credential_type) DO UPDATE
		SET review_status = EXCLUDED.review_status,
		    nft_token_id = EXCLUDED.nft_token_id,
		    tx_hash = EXCLUDED.tx_hash,
		    reviewed_by_wallet = EXCLUDED.reviewed_by_wallet,
		    verified_at = EXCLUDED.verified_at,
		    revoked_at = NULL,
		    revoked_reason = '',
		    updated_at = NOW()
	`, userID, normalizedType, model.CredentialReviewVerified, tokenID, nullStr(txHash), reviewerWallet)
	if err != nil {
		return fmt.Errorf("user_credential_repo: upsert issued credential: %w", err)
	}
	return nil
}

// SetRevoked marks the credential as revoked in the read model.
func (r *UserCredentialRepository) SetRevoked(userID int64, credentialType, reason, reviewerWallet string) error {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return fmt.Errorf("user_credential_repo: set revoked: %w", err)
	}

	result, err := r.db.Exec(`
		UPDATE user_credentials
		SET review_status = $1,
		    revoked_at = NOW(),
		    revoked_reason = $2,
		    reviewed_by_wallet = $3,
		    updated_at = NOW()
		WHERE user_id = $4
		  AND credential_type = $5
		  AND review_status = $6
		  AND revoked_at IS NULL
	`, model.CredentialReviewRevoked, reason, reviewerWallet, userID, normalizedType, model.CredentialReviewVerified)
	if err != nil {
		return fmt.Errorf("user_credential_repo: set revoked: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("user_credential_repo: set revoked: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("user_credential_repo: set revoked: active credential not found")
	}
	return nil
}

// FindByUserAndType returns the issued credential for a user and type.
func (r *UserCredentialRepository) FindByUserAndType(userID int64, credentialType string) (*model.UserCredential, error) {
	normalizedType, err := normalizeCredentialType(credentialType)
	if err != nil {
		return nil, fmt.Errorf("user_credential_repo: find by user and type: %w", err)
	}

	row := r.db.QueryRow(`
		SELECT id, user_id, credential_type,
		       doc_path, review_status, reviewer_note, reviewed_by_wallet,
		       revoked_at, revoked_reason,
		       nft_token_id, tx_hash, verified_at, created_at, updated_at
		FROM user_credentials
		WHERE user_id = $1
		  AND credential_type = $2
		  AND review_status = $3
		  AND revoked_at IS NULL
		LIMIT 1
	`, userID, normalizedType, model.CredentialReviewVerified)
	c, err := r.scanOne(row)
	if err != nil {
		return nil, fmt.Errorf("user_credential_repo: find by user and type: %w", err)
	}
	return c, nil
}

func (r *UserCredentialRepository) scanOne(row *sql.Row) (*model.UserCredential, error) {
	var c model.UserCredential
	if err := row.Scan(
		&c.ID, &c.UserID, &c.CredentialType,
		&c.DocPath, &c.ReviewStatus, &c.ReviewerNote, &c.ReviewedByWallet,
		&c.RevokedAt, &c.RevokedReason,
		&c.NFTTokenID, &c.TxHash, &c.VerifiedAt, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *UserCredentialRepository) scanAll(rows *sql.Rows) ([]*model.UserCredential, error) {
	var list []*model.UserCredential
	for rows.Next() {
		var c model.UserCredential
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.CredentialType,
			&c.DocPath, &c.ReviewStatus, &c.ReviewerNote, &c.ReviewedByWallet,
			&c.RevokedAt, &c.RevokedReason,
			&c.NFTTokenID, &c.TxHash, &c.VerifiedAt, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &c)
	}
	return list, rows.Err()
}

// AgentRecord is the result of user_credentials JOIN users for AGENT type.
type AgentRecord struct {
	WalletAddress string
	DisplayName   sql.NullString
	NFTTokenID    sql.NullInt32
	TxHash        sql.NullString
	ActivatedAt   time.Time
}

// FindAllAgents returns all non-revoked AGENT credentials joined with user data.
func (r *UserCredentialRepository) FindAllAgents() ([]AgentRecord, error) {
	rows, err := r.db.Query(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		WHERE uc.credential_type = $1
		  AND uc.review_status = $2
		  AND uc.revoked_at IS NULL
		ORDER BY uc.verified_at DESC
	`, model.CredentialTypeAgent, model.CredentialReviewVerified)
	if err != nil {
		return nil, fmt.Errorf("user_credential_repo: find all agents: %w", err)
	}
	defer rows.Close()

	var result []AgentRecord
	for rows.Next() {
		var rec AgentRecord
		if err := rows.Scan(
			&rec.WalletAddress, &rec.DisplayName,
			&rec.NFTTokenID, &rec.TxHash, &rec.ActivatedAt,
		); err != nil {
			return nil, fmt.Errorf("user_credential_repo: find all agents scan: %w", err)
		}
		result = append(result, rec)
	}
	return result, rows.Err()
}

// FindAgentByWallet returns the AGENT credential for a given wallet address, or nil if not found.
func (r *UserCredentialRepository) FindAgentByWallet(walletAddress string) (*AgentRecord, error) {
	row := r.db.QueryRow(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		WHERE u.wallet_address = $1
		  AND uc.credential_type = $2
		  AND uc.review_status = $3
		  AND uc.revoked_at IS NULL
		LIMIT 1
	`, walletAddress, model.CredentialTypeAgent, model.CredentialReviewVerified)

	var rec AgentRecord
	if err := row.Scan(
		&rec.WalletAddress, &rec.DisplayName,
		&rec.NFTTokenID, &rec.TxHash, &rec.ActivatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("user_credential_repo: find agent by wallet: %w", err)
	}
	return &rec, nil
}
