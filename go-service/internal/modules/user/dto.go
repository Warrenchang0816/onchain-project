package user

// KYCStatusResponse is returned by GET /api/kyc/me.
type KYCStatusResponse struct {
	KYCStatus          string  `json:"kycStatus"`
	IdentityNFTTokenID *int64  `json:"identityNftTokenId,omitempty"`
	KYCMintTxHash      *string `json:"kycMintTxHash,omitempty"`
	// Credentials holds the verified credential types (OWNER, TENANT, AGENT).
	Credentials []string `json:"credentials"`
}

type CreateKYCSubmissionRequest struct {
	DocumentType string `json:"documentType"`
}

type KYCSubmissionResponse struct {
	SubmissionID int64  `json:"submissionId"`
	Status       string `json:"status"`
	Message      string `json:"message,omitempty"`
}

type KYCFieldChecks struct {
	FullName       string `json:"fullName"`
	BirthDate      string `json:"birthDate"`
	DocumentNumber string `json:"documentNumber"`
	Address        string `json:"address"`
	FaceMatch      string `json:"faceMatch"`
}

type KYCSubmissionDetailResponse struct {
	SubmissionID   int64           `json:"submissionId"`
	WalletAddress  string          `json:"walletAddress"`
	ReviewStatus   string          `json:"reviewStatus"`
	OCRSuccess     bool            `json:"ocrSuccess"`
	FaceMatchScore *float64        `json:"faceMatchScore,omitempty"`
	OCRName        *string         `json:"ocrName,omitempty"`
	OCRBirthDate   *string         `json:"ocrBirthDate,omitempty"`
	OCRAddress     *string         `json:"ocrAddress,omitempty"`
	FieldChecks    *KYCFieldChecks `json:"fieldChecks,omitempty"`
	SubmittedAt    string          `json:"submittedAt"`
	ReviewedAt     *string         `json:"reviewedAt,omitempty"`
}

// SubmitKYCResponse is returned by KYC submission analysis endpoints after processing.
type SubmitKYCResponse struct {
	SubmissionID   int64          `json:"submissionId"`
	ReviewStatus   string         `json:"reviewStatus"`
	FaceMatchScore float64        `json:"faceMatchScore"`
	OCRSuccess     bool           `json:"ocrSuccess"`
	FieldChecks    KYCFieldChecks `json:"fieldChecks"`
	Message        string         `json:"message"`
}

// UserProfileResponse is returned by GET /api/user/profile.
type UserProfileResponse struct {
	WalletAddress      string   `json:"walletAddress"`
	DisplayName        string   `json:"displayName"`
	Email              string   `json:"email"`
	Phone              string   `json:"phone"`
	IDNumber           string   `json:"idNumber"`          // from KYC OCR
	Gender             string   `json:"gender"`            // derived: "男" / "女"
	BirthDate          string   `json:"birthDate"`         // from KYC OCR (ROC format)
	RegisteredAddress  string   `json:"registeredAddress"` // from KYC OCR (back side)
	MailingAddress     string   `json:"mailingAddress"`    // user-updatable
	KYCStatus          string   `json:"kycStatus"`
	KYCSubmittedAt     *string  `json:"kycSubmittedAt,omitempty"`
	KYCVerifiedAt      *string  `json:"kycVerifiedAt,omitempty"`
	IdentityNFTTokenID *int64   `json:"identityNftTokenId,omitempty"`
	KYCMintTxHash      *string  `json:"kycMintTxHash,omitempty"`
	Credentials        []string `json:"credentials"`
	CreatedAt          string   `json:"createdAt"`
}

// --- Profile update request/response types ---

type RequestContactOTPRequest struct {
	Value   string `json:"value" binding:"required"` // new email or new phone
	Channel string `json:"channel"`                  // "email" or "phone" (for mailing address)
}

type VerifyEmailChangeRequest struct {
	NewEmail string `json:"newEmail" binding:"required"`
	OTP      string `json:"otp"      binding:"required"`
}

type VerifyPhoneChangeRequest struct {
	NewPhone string `json:"newPhone" binding:"required"`
	OTP      string `json:"otp"      binding:"required"`
}

type UpdateMailingAddressRequest struct {
	Address string `json:"address"  binding:"required"`
	Channel string `json:"channel"  binding:"required"` // "email" or "phone"
	OTP     string `json:"otp"      binding:"required"`
}

// AdminReviewRequest is the body for PUT /api/admin/kyc/:id/review.
type AdminReviewRequest struct {
	Action string `json:"action" binding:"required"`
	Note   string `json:"note"`
}

// AdminKYCItem is a single row returned by GET /api/admin/kyc/pending.
type AdminKYCItem struct {
	SubmissionID   int64    `json:"submissionId"`
	WalletAddress  string   `json:"walletAddress"`
	ReviewStatus   string   `json:"reviewStatus"`
	OCRName        *string  `json:"ocrName,omitempty"`
	OCRAddress     *string  `json:"ocrAddress,omitempty"`
	FaceMatchScore *float64 `json:"faceMatchScore,omitempty"`
	OCRSuccess     bool     `json:"ocrSuccess"`
	SubmittedAt    string   `json:"submittedAt"`
}
