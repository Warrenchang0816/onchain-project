package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

const userSelectCols = `
	SELECT id, wallet_address, email, phone, display_name, email_verified, phone_verified,
	       kyc_status, person_hash, identity_hash,
	       identity_nft_token_id, kyc_mint_tx_hash,
	       mailing_address, id_number_hint,
	       password_hash,
	       kyc_submitted_at, kyc_verified_at, created_at, updated_at
	FROM users`

func scanUser(row *sql.Row) (*model.User, error) {
	u := &model.User{}
	err := row.Scan(
		&u.ID, &u.WalletAddress, &u.Email, &u.Phone, &u.DisplayName, &u.EmailVerified, &u.PhoneVerified,
		&u.KYCStatus, &u.PersonHash, &u.IdentityHash,
		&u.IdentityNFTTokenID, &u.KYCMintTxHash,
		&u.MailingAddress, &u.IDNumberHint,
		&u.PasswordHash,
		&u.KYCSubmittedAt, &u.KYCVerifiedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// FindByID looks up a user by primary key.
func (r *UserRepository) FindByID(id int64) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE id = $1`, id)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByID: %w", err)
	}
	return u, nil
}

func (r *UserRepository) FindByWallet(walletAddress string) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE LOWER(wallet_address) = LOWER($1)`, walletAddress)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByWallet: %w", err)
	}
	return u, nil
}

// FindOrCreate returns the existing user or creates a new one with UNVERIFIED KYC status.
func (r *UserRepository) FindOrCreate(walletAddress string) (*model.User, error) {
	_, err := r.db.Exec(`
		INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING
	`, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindOrCreate: %w", err)
	}
	return r.FindByWallet(walletAddress)
}

// FindByEmail looks up a user by email address.
func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE LOWER(email) = LOWER($1)`, email)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByEmail: %w", err)
	}
	return u, nil
}

// FindByPhone looks up a user by phone number.
func (r *UserRepository) FindByPhone(phone string) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE phone = $1`, phone)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByPhone: %w", err)
	}
	return u, nil
}

// FindByIdentityHash looks up a user by identity_hash = SHA-256(person_hash + lower(wallet)).
// Used by the identity-based login flow.
func (r *UserRepository) FindByIdentityHash(identityHash string) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE identity_hash = $1`, identityHash)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByIdentityHash: %w", err)
	}
	return u, nil
}

// FindByPersonHash returns a user whose person_hash matches (one-person-one-account guard).
func (r *UserRepository) FindByPersonHash(personHash string) (*model.User, error) {
	row := r.db.QueryRow(userSelectCols+` WHERE person_hash = $1`, personHash)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("user_repo: FindByPersonHash: %w", err)
	}
	return u, nil
}

// SetPassword stores a bcrypt password hash for the given user.
func (r *UserRepository) SetPassword(userID int64, hash string) error {
	_, err := r.db.Exec(`
		UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
	`, hash, userID)
	if err != nil {
		return fmt.Errorf("user_repo: SetPassword: %w", err)
	}
	return nil
}

// SetKYCPending marks kyc_status = PENDING when the user initiates KYC.
func (r *UserRepository) SetKYCPending(id int64) error {
	_, err := r.db.Exec(`
		UPDATE users SET kyc_status = $1, kyc_submitted_at = $2, updated_at = NOW() WHERE id = $3
	`, model.KYCStatusPending, time.Now(), id)
	if err != nil {
		return fmt.Errorf("user_repo: SetKYCPending: %w", err)
	}
	return nil
}

// SetKYCMinting stores the identity hash and keeps status PENDING while mint tx is in flight.
func (r *UserRepository) SetKYCMinting(id int64, identityHash string) error {
	_, err := r.db.Exec(`
		UPDATE users
		SET kyc_status = $1, identity_hash = $2, kyc_submitted_at = NOW(), updated_at = NOW()
		WHERE id = $3
	`, model.KYCStatusPending, identityHash, id)
	if err != nil {
		return fmt.Errorf("user_repo: SetKYCMinting: %w", err)
	}
	return nil
}

// SetKYCRejected marks kyc_status = REJECTED (used by admin or auto-rejection).
func (r *UserRepository) SetKYCRejected(id int64) error {
	_, err := r.db.Exec(`
		UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2
	`, model.KYCStatusRejected, id)
	if err != nil {
		return fmt.Errorf("user_repo: SetKYCRejected: %w", err)
	}
	return nil
}

// CreateFromOnboarding creates a new user from a completed KYC session (wallet-bind step).
// Returns the new user's ID.
func (r *UserRepository) CreateFromOnboarding(walletAddress, email, phone, displayName, personHash, identityHash, idNumberHint string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO users (
			wallet_address, email, phone, display_name,
			email_verified, phone_verified,
			kyc_status, person_hash, identity_hash, id_number_hint,
			kyc_submitted_at
		) VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $6, $7, $8, NOW())
		RETURNING id
	`, walletAddress,
		nullStr(email), nullStr(phone), nullStr(displayName),
		"PENDING",
		nullStr(personHash), nullStr(identityHash), nullStr(idNumberHint),
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("user_repo: CreateFromOnboarding: %w", err)
	}
	return id, nil
}

// SetKYCVerified is called by the Indexer after the IdentityMinted on-chain event is confirmed.
func (r *UserRepository) SetKYCVerified(walletAddress string, tokenID int64, mintTxHash string) error {
	_, err := r.db.Exec(`
		UPDATE users
		SET kyc_status = $1, identity_nft_token_id = $2, kyc_mint_tx_hash = $3,
		    kyc_verified_at = NOW(), updated_at = NOW()
		WHERE LOWER(wallet_address) = LOWER($4)
	`, model.KYCStatusVerified, tokenID, mintTxHash, walletAddress)
	if err != nil {
		return fmt.Errorf("user_repo: SetKYCVerified: %w", err)
	}
	return nil
}

// UpdateEmail changes the email for a user after OTP verification.
func (r *UserRepository) UpdateEmail(userID int64, newEmail string) error {
	_, err := r.db.Exec(`
		UPDATE users SET email = $1, email_verified = TRUE, updated_at = NOW() WHERE id = $2
	`, newEmail, userID)
	if err != nil {
		return fmt.Errorf("user_repo: UpdateEmail: %w", err)
	}
	return nil
}

// UpdatePhone changes the phone for a user after OTP verification.
func (r *UserRepository) UpdatePhone(userID int64, newPhone string) error {
	_, err := r.db.Exec(`
		UPDATE users SET phone = $1, phone_verified = TRUE, updated_at = NOW() WHERE id = $2
	`, newPhone, userID)
	if err != nil {
		return fmt.Errorf("user_repo: UpdatePhone: %w", err)
	}
	return nil
}

// UpdateMailingAddress sets or replaces the mailing address for a user.
func (r *UserRepository) UpdateMailingAddress(userID int64, address string) error {
	_, err := r.db.Exec(`
		UPDATE users SET mailing_address = $1, updated_at = NOW() WHERE id = $2
	`, address, userID)
	if err != nil {
		return fmt.Errorf("user_repo: UpdateMailingAddress: %w", err)
	}
	return nil
}

// UpdateWalletAddress changes the wallet address for a user (wallet switching).
func (r *UserRepository) UpdateWalletAddress(userID int64, newWalletAddress string) error {
	_, err := r.db.Exec(`
		UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE id = $2
	`, newWalletAddress, userID)
	if err != nil {
		return fmt.Errorf("user_repo: UpdateWalletAddress: %w", err)
	}
	return nil
}
