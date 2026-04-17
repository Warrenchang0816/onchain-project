package onboarding

import "time"

// ── Step 1: Email OTP ────────────────────────────────────────

type RequestEmailOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RequestEmailOTPResponse is returned by /email/request-otp.
// has_active_session=true means the email already has a mid-flow KYC session the user may want to resume.
type RequestEmailOTPResponse struct {
	OK               bool   `json:"ok"`
	Message          string `json:"message,omitempty"`
	HasActiveSession bool   `json:"has_active_session"`
	ActiveStep       string `json:"active_step,omitempty"`
}

type VerifyEmailOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code"  binding:"required,len=6"`
}

type VerifyEmailOTPResponse struct {
	SessionID string `json:"session_id"`
	Step      string `json:"step"`
	IsResume  bool   `json:"is_resume,omitempty"`
	// OCR pre-fill data (only set when is_resume && step ∈ {OCR_DONE, CONFIRMED})
	OCRName      string `json:"ocr_name,omitempty"`
	OCRBirthDate string `json:"ocr_birth_date,omitempty"`
	OCRAddress   string `json:"ocr_address,omitempty"`
	IDNumberHint string `json:"id_number_hint,omitempty"`
}

// RestartSessionRequest creates a fresh session for the same email as the given session.
// The caller must have previously verified the email via verify-otp.
type RestartSessionRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

// ── Step 2: Phone OTP ────────────────────────────────────────

type RequestPhoneOTPRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Phone     string `json:"phone"      binding:"required"`
}

type VerifyPhoneOTPRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Phone     string `json:"phone"      binding:"required"`
	Code      string `json:"code"       binding:"required,len=6"`
}

// ── Step 3: Document upload + OCR ────────────────────────────

// UploadKYCDocumentsResponse returns OCR pre-fill data for the confirmation form.
type UploadKYCDocumentsResponse struct {
	SessionID        string  `json:"session_id"`
	Step             string  `json:"step"`
	Stage            string  `json:"stage"`
	OCRName          string  `json:"ocr_name"`
	OCRBirthDate     string  `json:"ocr_birth_date"`
	OCRAddress       string  `json:"ocr_address"`
	IDNumberHint     string  `json:"id_number_hint"` // e.g. "A123****90"
	FaceMatchScore   float64 `json:"face_match_score"`
	OCRSuccess       bool    `json:"ocr_success"`
	// SecondDocIDMatch is true when the second document's OCR ID number matches the primary ID.
	// Always true in dev-bypass mode (no OCR service).
	SecondDocIDMatch bool `json:"second_doc_id_match,omitempty"`
}

// ── Step 4: Confirm OCR data ─────────────────────────────────

type ConfirmKYCDataRequest struct {
	SessionID          string `json:"session_id"           binding:"required"`
	ConfirmedName      string `json:"confirmed_name"       binding:"required"`
	ConfirmedBirthDate string `json:"confirmed_birth_date" binding:"required"`
}

// ── Step 5: Wallet message (SIWE) ────────────────────────────

type WalletMessageRequest struct {
	SessionID     string `json:"session_id"      binding:"required"`
	WalletAddress string `json:"wallet_address"  binding:"required"`
}

type WalletMessageResponse struct {
	Message string `json:"message"`
}

// ── Step 6: Wallet bind ──────────────────────────────────────

type BindWalletRequest struct {
	SessionID     string `json:"session_id"      binding:"required"`
	WalletAddress string `json:"wallet_address"  binding:"required"`
	SIWEMessage   string `json:"siwe_message"    binding:"required"`
	SIWESignature string `json:"siwe_signature"  binding:"required"`
}

type BindWalletResponse struct {
	WalletAddress string    `json:"wallet_address"`
	KYCStatus     string    `json:"kyc_status"`
	Message       string    `json:"message"`
	SessionToken  string    `json:"session_token"`
	SessionExpiry time.Time `json:"session_expiry"`
}

// ── Generic ──────────────────────────────────────────────────

type OKResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
}
