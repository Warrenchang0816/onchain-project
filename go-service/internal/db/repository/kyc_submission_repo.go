package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type KYCSubmissionRepository struct {
	db *sql.DB
}

func NewKYCSubmissionRepository(db *sql.DB) *KYCSubmissionRepository {
	return &KYCSubmissionRepository{db: db}
}

func (r *KYCSubmissionRepository) Create(userID int64, walletAddress string) (int64, error) {
	const q = `
		INSERT INTO kyc_submissions (user_id, wallet_address, review_status)
		VALUES ($1, $2, $3)
		RETURNING id`
	var id int64
	if err := r.db.QueryRow(q, userID, walletAddress, model.KYCPipelineDraft).Scan(&id); err != nil {
		return 0, fmt.Errorf("kyc_submission: create: %w", err)
	}
	return id, nil
}

func (r *KYCSubmissionRepository) SetPaths(id int64, frontPath, backPath, selfiePath string) error {
	const q = `
		UPDATE kyc_submissions
		SET id_front_path = $1, id_back_path = $2, selfie_path = $3
		WHERE id = $4`
	_, err := r.db.Exec(q, frontPath, backPath, selfiePath, id)
	return err
}

func (r *KYCSubmissionRepository) SetStatus(id int64, status string) error {
	const q = `UPDATE kyc_submissions SET review_status = $1 WHERE id = $2`
	_, err := r.db.Exec(q, status, id)
	return err
}

func (r *KYCSubmissionRepository) SetOCRResult(id int64, p OCRResultParams) error {
	const q = `
		UPDATE kyc_submissions SET
			ocr_name = $1,
			ocr_id_number = $2,
			identity_hash = $3,
			ocr_birth_date = $4,
			ocr_issue_date = $5,
			ocr_issue_location = $6,
			ocr_address = $7,
			ocr_father_name = $8,
			ocr_mother_name = $9,
			ocr_spouse_name = $10,
			face_match_score = $11,
			ocr_success = $12
		WHERE id = $13`
	_, err := r.db.Exec(q,
		nullStr(p.Name),
		nullStr(p.IDNumber),
		nullStr(p.IdentityHash),
		nullStr(p.BirthDate),
		nullStr(p.IssueDate),
		nullStr(p.IssueLocation),
		nullStr(p.Address),
		nullStr(p.FatherName),
		nullStr(p.MotherName),
		nullStr(p.SpouseName),
		nullFloat(p.FaceMatchScore),
		p.OCRSuccess,
		id,
	)
	return err
}

func (r *KYCSubmissionRepository) SetReviewStatus(id int64, status, note string, reviewerWallet *string) error {
	var reviewedAt *time.Time
	now := time.Now()
	if status == model.KYCReviewAutoVerified || status == model.KYCReviewManualReview || status == model.KYCReviewVerified || status == model.KYCReviewRejected {
		reviewedAt = &now
	}
	const q = `
		UPDATE kyc_submissions
		SET review_status = $1, reviewer_note = $2, reviewed_by_wallet = $3, reviewed_at = $4
		WHERE id = $5`
	_, err := r.db.Exec(q, status, note, reviewerWallet, reviewedAt, id)
	return err
}

func (r *KYCSubmissionRepository) FindByID(id int64) (*model.KYCSubmission, error) {
	const q = `
		SELECT id, user_id, wallet_address,
		       id_front_path, id_back_path, selfie_path,
		       ocr_name, ocr_id_number, identity_hash, ocr_birth_date, ocr_issue_date, ocr_issue_location,
		       ocr_address, ocr_father_name, ocr_mother_name, ocr_spouse_name,
		       face_match_score, ocr_success,
		       review_status, reviewer_note, reviewed_by_wallet,
		       submitted_at, reviewed_at
		FROM kyc_submissions WHERE id = $1`
	return r.scanOne(r.db.QueryRow(q, id))
}

func (r *KYCSubmissionRepository) FindLatestByWallet(walletAddress string) (*model.KYCSubmission, error) {
	const q = `
		SELECT id, user_id, wallet_address,
		       id_front_path, id_back_path, selfie_path,
		       ocr_name, ocr_id_number, identity_hash, ocr_birth_date, ocr_issue_date, ocr_issue_location,
		       ocr_address, ocr_father_name, ocr_mother_name, ocr_spouse_name,
		       face_match_score, ocr_success,
		       review_status, reviewer_note, reviewed_by_wallet,
		       submitted_at, reviewed_at
		FROM kyc_submissions
		WHERE wallet_address = $1
		ORDER BY submitted_at DESC
		LIMIT 1`
	row := r.db.QueryRow(q, walletAddress)
	s, err := r.scanOne(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

func (r *KYCSubmissionRepository) FindPendingManual(limit, offset int) ([]*model.KYCSubmission, error) {
	const q = `
		SELECT id, user_id, wallet_address,
		       id_front_path, id_back_path, selfie_path,
		       ocr_name, ocr_id_number, identity_hash, ocr_birth_date, ocr_issue_date, ocr_issue_location,
		       ocr_address, ocr_father_name, ocr_mother_name, ocr_spouse_name,
		       face_match_score, ocr_success,
		       review_status, reviewer_note, reviewed_by_wallet,
		       submitted_at, reviewed_at
		FROM kyc_submissions
		WHERE review_status = 'MANUAL_REVIEW'
		ORDER BY submitted_at ASC
		LIMIT $1 OFFSET $2`
	rows, err := r.db.Query(q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return r.scanAll(rows)
}

func (r *KYCSubmissionRepository) FindByIdentityHash(hash string) (*model.KYCSubmission, error) {
	const q = `
		SELECT id, user_id, wallet_address,
		       id_front_path, id_back_path, selfie_path,
		       ocr_name, ocr_id_number, identity_hash, ocr_birth_date, ocr_issue_date, ocr_issue_location,
		       ocr_address, ocr_father_name, ocr_mother_name, ocr_spouse_name,
		       face_match_score, ocr_success,
		       review_status, reviewer_note, reviewed_by_wallet,
		       submitted_at, reviewed_at
		FROM kyc_submissions WHERE identity_hash = $1 LIMIT 1`
	row := r.db.QueryRow(q, hash)
	s, err := r.scanOne(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

type OCRResultParams struct {
	Name           string
	IDNumber       string
	IdentityHash   string
	BirthDate      string
	IssueDate      string
	IssueLocation  string
	Address        string
	FatherName     string
	MotherName     string
	SpouseName     string
	FaceMatchScore float64
	OCRSuccess     bool
}

func (r *KYCSubmissionRepository) scanOne(row *sql.Row) (*model.KYCSubmission, error) {
	var s model.KYCSubmission
	err := row.Scan(
		&s.ID, &s.UserID, &s.WalletAddress,
		&s.IDFrontPath, &s.IDBackPath, &s.SelfiePath,
		&s.OCRName, &s.OCRIDNumber, &s.IdentityHash, &s.OCRBirthDate, &s.OCRIssueDate, &s.OCRIssueLocation,
		&s.OCRAddress, &s.OCRFatherName, &s.OCRMotherName, &s.OCRSpouseName,
		&s.FaceMatchScore, &s.OCRSuccess,
		&s.ReviewStatus, &s.ReviewerNote, &s.ReviewedByWallet,
		&s.SubmittedAt, &s.ReviewedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *KYCSubmissionRepository) scanAll(rows *sql.Rows) ([]*model.KYCSubmission, error) {
	var list []*model.KYCSubmission
	for rows.Next() {
		var s model.KYCSubmission
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.WalletAddress,
			&s.IDFrontPath, &s.IDBackPath, &s.SelfiePath,
			&s.OCRName, &s.OCRIDNumber, &s.IdentityHash, &s.OCRBirthDate, &s.OCRIssueDate, &s.OCRIssueLocation,
			&s.OCRAddress, &s.OCRFatherName, &s.OCRMotherName, &s.OCRSpouseName,
			&s.FaceMatchScore, &s.OCRSuccess,
			&s.ReviewStatus, &s.ReviewerNote, &s.ReviewedByWallet,
			&s.SubmittedAt, &s.ReviewedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &s)
	}
	return list, rows.Err()
}

func nullStr(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

func nullFloat(f float64) sql.NullFloat64 {
	return sql.NullFloat64{Float64: f, Valid: f != 0}
}
