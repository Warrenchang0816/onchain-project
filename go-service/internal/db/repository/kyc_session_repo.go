package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type KYCSessionRepository struct {
	db *sql.DB
}

func NewKYCSessionRepository(db *sql.DB) *KYCSessionRepository {
	return &KYCSessionRepository{db: db}
}

// Create inserts a new KYC session with email and expiry.
func (r *KYCSessionRepository) Create(email string, expiresAt time.Time) (*model.KYCSession, error) {
	var id string
	err := r.db.QueryRow(`
		INSERT INTO kyc_sessions (email, step, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id
	`, email, model.KYCSessionStepStarted, expiresAt).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("kyc_session_repo: create: %w", err)
	}
	return r.FindByID(id)
}

// FindByID returns the session or nil if not found / expired.
func (r *KYCSessionRepository) FindByID(id string) (*model.KYCSession, error) {
	const q = `
		SELECT id, email, phone, email_verified, phone_verified,
		       person_hash, ocr_id_number, confirmed_name, confirmed_birth_date, ocr_address, ocr_id_number_hint, ocr_gender, ocr_issue_date, ocr_issue_location, ocr_father_name, ocr_mother_name,
		       id_front_path, id_back_path, selfie_path, second_doc_path,
		       face_match_score, ocr_success, step, bound_user_id,
		       expires_at, created_at
		FROM kyc_sessions WHERE id = $1`
	return r.scanOne(r.db.QueryRow(q, id))
}

// FindActiveByEmail returns the most recent non-expired session for an email.
func (r *KYCSessionRepository) FindActiveByEmail(email string) (*model.KYCSession, error) {
	const q = `
		SELECT id, email, phone, email_verified, phone_verified,
		       person_hash, ocr_id_number, confirmed_name, confirmed_birth_date, ocr_address, ocr_id_number_hint, ocr_gender, ocr_issue_date, ocr_issue_location, ocr_father_name, ocr_mother_name,
		       id_front_path, id_back_path, selfie_path, second_doc_path,
		       face_match_score, ocr_success, step, bound_user_id,
		       expires_at, created_at
		FROM kyc_sessions
		WHERE email = $1 AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1`
	s, err := r.scanOne(r.db.QueryRow(q, email))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

// MarkEmailVerified sets email_verified = TRUE and advances step.
func (r *KYCSessionRepository) MarkEmailVerified(id string) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET email_verified = TRUE, step = $1
		WHERE id = $2
	`, model.KYCSessionStepEmailVerified, id)
	return err
}

// SetPhone stores phone number in the session.
func (r *KYCSessionRepository) SetPhone(id, phone string) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions SET phone = $1 WHERE id = $2
	`, phone, id)
	return err
}

// MarkPhoneVerified sets phone_verified = TRUE and advances step.
func (r *KYCSessionRepository) MarkPhoneVerified(id string) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET phone_verified = TRUE, step = $1
		WHERE id = $2
	`, model.KYCSessionStepPhoneVerified, id)
	return err
}

// SetOCRResult stores MinIO paths, OCR data, and face match score after document analysis.
type OCRSessionParams struct {
	PersonHash      string
	IDNumber        string
	IDNumberHint    string
	OCRName         string
	OCRGender       string
	OCRBirthDate    string
	OCRIssueDate    string
	OCRIssueLocation string
	OCRAddress      string
	OCRFatherName   string
	OCRMotherName   string
	IDFrontPath     string
	IDBackPath      string
	SelfiePath      string
	SecondDocPath   string
	FaceMatchScore  float64
	OCRSuccess      bool
}

func (r *KYCSessionRepository) SetOCRResult(id string, p OCRSessionParams) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions SET
			person_hash           = $1,
			ocr_id_number         = $2,
			ocr_id_number_hint    = $3,
			confirmed_name        = $4,
			ocr_gender            = $5,
			confirmed_birth_date  = $6,
			ocr_issue_date        = $7,
			ocr_issue_location    = $8,
			ocr_address           = $9,
			ocr_father_name       = $10,
			ocr_mother_name       = $11,
			id_front_path         = $12,
			id_back_path          = $13,
			selfie_path           = $14,
			second_doc_path       = $15,
			face_match_score      = $16,
			ocr_success           = $17,
			step                  = $18
		WHERE id = $19
	`,
		nullStr(p.PersonHash),
		nullStr(p.IDNumber),
		nullStr(p.IDNumberHint),
		nullStr(p.OCRName),
		nullStr(p.OCRGender),
		nullStr(p.OCRBirthDate),
		nullStr(p.OCRIssueDate),
		nullStr(p.OCRIssueLocation),
		nullStr(p.OCRAddress),
		nullStr(p.OCRFatherName),
		nullStr(p.OCRMotherName),
		nullStr(p.IDFrontPath),
		nullStr(p.IDBackPath),
		nullStr(p.SelfiePath),
		nullStr(p.SecondDocPath),
		nullFloat(p.FaceMatchScore),
		p.OCRSuccess,
		model.KYCSessionStepOCRDone,
		id,
	)
	return err
}

func (r *KYCSessionRepository) SetDocumentPaths(id, idFrontPath, idBackPath, secondDocPath, selfiePath string) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET
			id_front_path = COALESCE(NULLIF($1, ''), id_front_path),
			id_back_path = COALESCE(NULLIF($2, ''), id_back_path),
			second_doc_path = COALESCE(NULLIF($3, ''), second_doc_path),
			selfie_path = COALESCE(NULLIF($4, ''), selfie_path)
		WHERE id = $5
	`, idFrontPath, idBackPath, secondDocPath, selfiePath, id)
	return err
}

func (r *KYCSessionRepository) SetFaceMatchResult(id string, faceMatchScore float64) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET face_match_score = $1
		WHERE id = $2
	`, nullFloat(faceMatchScore), id)
	return err
}

// ConfirmData stores user-edited name/birth date and advances to CONFIRMED.
func (r *KYCSessionRepository) ConfirmData(id, confirmedName, confirmedBirthDate string) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET confirmed_name = $1, confirmed_birth_date = $2, step = $3
		WHERE id = $4
	`, confirmedName, confirmedBirthDate, model.KYCSessionStepConfirmed, id)
	return err
}

// RefreshExpiry extends the session's expires_at by ttlMins from now.
// Call this after each successful step to prevent mid-flow expiry.
func (r *KYCSessionRepository) RefreshExpiry(id string, ttlMins int) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET expires_at = NOW() + ($1 * INTERVAL '1 minute')
		WHERE id = $2
	`, ttlMins, id)
	return err
}

// MarkWalletBound links the session to the newly created user and advances to WALLET_BOUND.
func (r *KYCSessionRepository) MarkWalletBound(id string, userID int64) error {
	_, err := r.db.Exec(`
		UPDATE kyc_sessions
		SET bound_user_id = $1, step = $2
		WHERE id = $3
	`, userID, model.KYCSessionStepWalletBound, id)
	return err
}

func (r *KYCSessionRepository) scanOne(row *sql.Row) (*model.KYCSession, error) {
	var s model.KYCSession
	err := row.Scan(
		&s.ID,
		&s.Email, &s.Phone, &s.EmailVerified, &s.PhoneVerified,
		&s.PersonHash, &s.OCRIDNumber, &s.ConfirmedName, &s.ConfirmedBirthDate, &s.OCRAddress, &s.OCRIDNumberHint, &s.OCRGender, &s.OCRIssueDate, &s.OCRIssueLocation, &s.OCRFatherName, &s.OCRMotherName,
		&s.IDFrontPath, &s.IDBackPath, &s.SelfiePath, &s.SecondDocPath,
		&s.FaceMatchScore, &s.OCRSuccess, &s.Step, &s.BoundUserID,
		&s.ExpiresAt, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
