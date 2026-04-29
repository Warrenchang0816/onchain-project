package credential

type CreateSubmissionRequest struct {
	Route       string            `json:"route"`
	FormPayload map[string]string `json:"formPayload"`
	Notes       string            `json:"notes"`
}

type CreateSubmissionResponse struct {
	SubmissionID int64 `json:"submissionId"`
}

type CredentialCenterItem struct {
	CredentialType     string  `json:"credentialType"`
	DisplayStatus      string  `json:"displayStatus"`
	LatestSubmissionID *int64  `json:"latestSubmissionId,omitempty"`
	ReviewRoute        *string `json:"reviewRoute,omitempty"`
	Summary            *string `json:"summary,omitempty"`
	CanActivate        bool    `json:"canActivate"`
	CanRetrySmart      bool    `json:"canRetrySmart"`
	CanRequestManual   bool    `json:"canRequestManual"`
	ActivationTxHash   *string `json:"activationTxHash,omitempty"`
}

type CredentialCenterResponse struct {
	KYCStatus string                 `json:"kycStatus"`
	Items     []CredentialCenterItem `json:"items"`
}

type AdminReviewRequest struct {
	Action string `json:"action" binding:"required"`
	Note   string `json:"note"`
}

type AdminCredentialItem struct {
	SubmissionID   int64   `json:"submissionId"`
	UserID         int64   `json:"userId"`
	WalletAddress  string  `json:"walletAddress"`
	CredentialType string  `json:"credentialType"`
	ReviewRoute    string  `json:"reviewRoute"`
	ReviewStatus   string  `json:"reviewStatus"`
	Summary        *string `json:"summary,omitempty"`
	Notes          *string `json:"notes,omitempty"`
	CreatedAt      string  `json:"createdAt"`
}

type CredentialSubmissionDetailResponse struct {
	SubmissionID     int64             `json:"submissionId"`
	CredentialType   string            `json:"credentialType"`
	ReviewRoute      string            `json:"reviewRoute"`
	DisplayStatus    string            `json:"displayStatus"`
	FormPayload      map[string]string `json:"formPayload"`
	Notes            string            `json:"notes"`
	Summary          *string           `json:"summary,omitempty"`
	Checks           map[string]string `json:"checks,omitempty"`
	MainFileURL      *string           `json:"mainFileUrl,omitempty"`
	SupportFileURL   *string           `json:"supportFileUrl,omitempty"`
	CanStopReview    bool              `json:"canStopReview"`
	CanRestartReview bool              `json:"canRestartReview"`
	CanActivate      bool              `json:"canActivate"`
	ActivationTxHash *string           `json:"activationTxHash,omitempty"`
}

const (
	DisplayStatusNotStarted      = "NOT_STARTED"
	DisplayStatusSmartReviewing  = "SMART_REVIEWING"
	DisplayStatusManualReviewing = "MANUAL_REVIEWING"
	DisplayStatusStopped         = "STOPPED"
	DisplayStatusPassedReady     = "PASSED_READY"
	DisplayStatusFailed          = "FAILED"
	DisplayStatusActivated       = "ACTIVATED"
	DisplayStatusRevoked         = "REVOKED"
)
