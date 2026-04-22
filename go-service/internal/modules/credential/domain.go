package credential

import (
	"fmt"
	"strings"

	"go-service/internal/db/model"
)

const (
	CredentialTypeOwner  = "OWNER"
	CredentialTypeTenant = "TENANT"
	CredentialTypeAgent  = "AGENT"

	ReviewRouteSmart  = "SMART"
	ReviewRouteManual = "MANUAL"

	CredentialReviewSmartReviewing  = "SMART_REVIEWING"
	CredentialReviewManualReviewing = "MANUAL_REVIEWING"
	CredentialReviewPassed          = "PASSED"
	CredentialReviewFailed          = "FAILED"

	ActivationStatusNotReady   = "NOT_READY"
	ActivationStatusReady      = "READY"
	ActivationStatusActivated  = "ACTIVATED"
	ActivationStatusSuperseded = "SUPERSEDED"
)

func NormalizeType(raw string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case CredentialTypeOwner:
		return CredentialTypeOwner, nil
	case CredentialTypeTenant:
		return CredentialTypeTenant, nil
	case CredentialTypeAgent:
		return CredentialTypeAgent, nil
	default:
		return "", fmt.Errorf("invalid credential type %q", raw)
	}
}

func TokenIDForType(credentialType string) (int64, error) {
	switch strings.ToUpper(strings.TrimSpace(credentialType)) {
	case CredentialTypeOwner:
		return model.NFTTokenOwner, nil
	case CredentialTypeTenant:
		return model.NFTTokenTenant, nil
	case CredentialTypeAgent:
		return model.NFTTokenAgent, nil
	default:
		return 0, fmt.Errorf("unsupported credential type %q", credentialType)
	}
}

func TypeForTokenID(tokenID int64) (string, error) {
	switch tokenID {
	case model.NFTTokenOwner:
		return CredentialTypeOwner, nil
	case model.NFTTokenTenant:
		return CredentialTypeTenant, nil
	case model.NFTTokenAgent:
		return CredentialTypeAgent, nil
	default:
		return "", fmt.Errorf("unsupported credential token id %d", tokenID)
	}
}

func EnsureActivatable(sub *model.CredentialSubmission, hasActiveCredential bool, superseded bool) error {
	if sub == nil {
		return fmt.Errorf("credential submission is required")
	}
	if superseded || strings.EqualFold(sub.ActivationStatus, ActivationStatusSuperseded) {
		return fmt.Errorf("credential submission has been superseded")
	}
	if hasActiveCredential {
		return fmt.Errorf("user already has an active credential for this type")
	}
	if sub.ReviewStatus != CredentialReviewPassed {
		return fmt.Errorf("credential submission has not passed review")
	}
	if sub.ActivationStatus != ActivationStatusReady {
		return fmt.Errorf("credential submission is not ready for activation")
	}
	return nil
}
