package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type AgentProfileRepository struct {
	db *sql.DB
}

func NewAgentProfileRepository(db *sql.DB) *AgentProfileRepository {
	return &AgentProfileRepository{db: db}
}

func (r *AgentProfileRepository) FindByUserID(userID int64) (*model.AgentProfile, error) {
	p := &model.AgentProfile{}
	err := r.db.QueryRow(`
		SELECT id, user_id, headline, bio, service_areas_json::text,
		       license_note, contact_preferences, is_profile_complete, created_at, updated_at
		FROM agent_profiles WHERE user_id = $1
	`, userID).Scan(
		&p.ID, &p.UserID, &p.Headline, &p.Bio, &p.ServiceAreasJSON,
		&p.LicenseNote, &p.ContactPreferences, &p.IsProfileComplete,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("agent_profile_repo: FindByUserID: %w", err)
	}
	return p, nil
}

func (r *AgentProfileRepository) FindByWallet(wallet string) (*model.AgentProfileRow, error) {
	row := &model.AgentProfileRow{Profile: &model.AgentProfile{}}
	err := r.db.QueryRow(`
		SELECT ap.id, ap.user_id, ap.headline, ap.bio, ap.service_areas_json::text,
		       ap.license_note, ap.contact_preferences, ap.is_profile_complete, ap.created_at, ap.updated_at,
		       u.wallet_address, u.display_name
		FROM agent_profiles ap
		JOIN users u ON u.id = ap.user_id
		WHERE u.wallet_address = $1
	`, wallet).Scan(
		&row.Profile.ID, &row.Profile.UserID, &row.Profile.Headline, &row.Profile.Bio,
		&row.Profile.ServiceAreasJSON, &row.Profile.LicenseNote, &row.Profile.ContactPreferences,
		&row.Profile.IsProfileComplete, &row.Profile.CreatedAt, &row.Profile.UpdatedAt,
		&row.Wallet, &row.Name,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("agent_profile_repo: FindByWallet: %w", err)
	}
	return row, nil
}

func (r *AgentProfileRepository) Upsert(profile *model.AgentProfile) (*model.AgentProfile, error) {
	areasJSON := profile.ServiceAreasJSON
	if areasJSON == "" {
		areasJSON = "[]"
	}
	p := &model.AgentProfile{}
	err := r.db.QueryRow(`
		INSERT INTO agent_profiles (
			user_id, headline, bio, service_areas_json, license_note, contact_preferences, is_profile_complete
		) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			headline = EXCLUDED.headline,
			bio = EXCLUDED.bio,
			service_areas_json = EXCLUDED.service_areas_json,
			license_note = EXCLUDED.license_note,
			contact_preferences = EXCLUDED.contact_preferences,
			is_profile_complete = EXCLUDED.is_profile_complete,
			updated_at = NOW()
		RETURNING id, user_id, headline, bio, service_areas_json::text,
		          license_note, contact_preferences, is_profile_complete, created_at, updated_at
	`, profile.UserID, profile.Headline, profile.Bio, areasJSON,
		profile.LicenseNote, profile.ContactPreferences, profile.IsProfileComplete,
	).Scan(
		&p.ID, &p.UserID, &p.Headline, &p.Bio, &p.ServiceAreasJSON,
		&p.LicenseNote, &p.ContactPreferences, &p.IsProfileComplete,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("agent_profile_repo: Upsert: %w", err)
	}
	return p, nil
}

// AgentWithProfile combines credential/user data with optional profile data for list queries.
type AgentWithProfile struct {
	WalletAddress     string
	DisplayName       sql.NullString
	NFTTokenID        sql.NullInt32
	TxHash            sql.NullString
	ActivatedAt       time.Time
	Headline          sql.NullString
	ServiceAreasJSON  sql.NullString
	IsProfileComplete sql.NullBool
}

// FindAllWithProfile returns all active AGENT credentials joined with optional profile data.
func (r *AgentProfileRepository) FindAllWithProfile() ([]AgentWithProfile, error) {
	rows, err := r.db.Query(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at,
		       ap.headline, ap.service_areas_json::text, ap.is_profile_complete
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		LEFT JOIN agent_profiles ap ON ap.user_id = uc.user_id
		WHERE uc.credential_type = 'AGENT'
		  AND uc.review_status = 'VERIFIED'
		  AND uc.revoked_at IS NULL
		ORDER BY uc.verified_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("agent_profile_repo: FindAllWithProfile: %w", err)
	}
	defer rows.Close()

	var result []AgentWithProfile
	for rows.Next() {
		var a AgentWithProfile
		if err := rows.Scan(
			&a.WalletAddress, &a.DisplayName,
			&a.NFTTokenID, &a.TxHash, &a.ActivatedAt,
			&a.Headline, &a.ServiceAreasJSON, &a.IsProfileComplete,
		); err != nil {
			return nil, fmt.Errorf("agent_profile_repo: scan: %w", err)
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

// FindOneWithProfile returns credential+profile data for a single wallet.
func (r *AgentProfileRepository) FindOneWithProfile(wallet string) (*AgentWithProfile, error) {
	a := &AgentWithProfile{}
	err := r.db.QueryRow(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at,
		       ap.headline, ap.service_areas_json::text, ap.is_profile_complete
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		LEFT JOIN agent_profiles ap ON ap.user_id = uc.user_id
		WHERE u.wallet_address = $1
		  AND uc.credential_type = 'AGENT'
		  AND uc.review_status = 'VERIFIED'
		  AND uc.revoked_at IS NULL
		LIMIT 1
	`, wallet).Scan(
		&a.WalletAddress, &a.DisplayName,
		&a.NFTTokenID, &a.TxHash, &a.ActivatedAt,
		&a.Headline, &a.ServiceAreasJSON, &a.IsProfileComplete,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("agent_profile_repo: FindOneWithProfile: %w", err)
	}
	return a, nil
}
