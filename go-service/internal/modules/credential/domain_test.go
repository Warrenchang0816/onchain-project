package credential

import (
	"database/sql"
	"strings"
	"testing"

	"go-service/internal/db/model"
)

func TestNormalizeTypeAndTokenID(t *testing.T) {
	cases := []struct {
		name      string
		raw       string
		wantType  string
		wantToken int64
	}{
		{name: "owner", raw: "owner", wantType: CredentialTypeOwner, wantToken: model.NFTTokenOwner},
		{name: "tenant", raw: "TENANT", wantType: CredentialTypeTenant, wantToken: model.NFTTokenTenant},
		{name: "agent", raw: "Agent", wantType: CredentialTypeAgent, wantToken: model.NFTTokenAgent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotType, err := NormalizeType(tc.raw)
			if err != nil {
				t.Fatalf("NormalizeType(%q) error = %v", tc.raw, err)
			}
			if gotType != tc.wantType {
				t.Fatalf("NormalizeType(%q) = %q, want %q", tc.raw, gotType, tc.wantType)
			}

			gotToken, err := TokenIDForType(gotType)
			if err != nil {
				t.Fatalf("TokenIDForType(%q) error = %v", gotType, err)
			}
			if gotToken != tc.wantToken {
				t.Fatalf("TokenIDForType(%q) = %d, want %d", gotType, gotToken, tc.wantToken)
			}

			gotTypeForToken, err := TypeForTokenID(gotToken)
			if err != nil {
				t.Fatalf("TypeForTokenID(%d) error = %v", gotToken, err)
			}
			if gotTypeForToken != tc.wantType {
				t.Fatalf("TypeForTokenID(%d) = %q, want %q", gotToken, gotTypeForToken, tc.wantType)
			}
		})
	}
}

func TestNormalizeTypeRejectsInvalidInput(t *testing.T) {
	if _, err := NormalizeType(""); err == nil {
		t.Fatal("NormalizeType returned nil error for empty input")
	}
	if _, err := NormalizeType("guest"); err == nil {
		t.Fatal("NormalizeType returned nil error for unsupported type")
	}
}

func TestTokenIDMappingRejectsInvalidInput(t *testing.T) {
	if _, err := TokenIDForType("GUEST"); err == nil {
		t.Fatal("TokenIDForType returned nil error for unsupported type")
	}
	if _, err := TypeForTokenID(1); err == nil {
		t.Fatal("TypeForTokenID returned nil error for unsupported token")
	}
}

func TestCanStopReview(t *testing.T) {
	if !CanStopReview(CredentialReviewManualReviewing) {
		t.Fatal("manual reviewing should be stoppable")
	}
	for _, status := range []string{
		CredentialReviewSmartReviewing,
		CredentialReviewPassed,
		CredentialReviewFailed,
		CredentialReviewStopped,
	} {
		if CanStopReview(status) {
			t.Fatalf("status %s should not be stoppable", status)
		}
	}
}

func TestDisplayStatusForSubmission(t *testing.T) {
	cases := []struct {
		name string
		sub  *model.CredentialSubmission
		want string
	}{
		{
			name: "draft submission stays not started",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewDraft,
				ActivationStatus: ActivationStatusNotReady,
			},
			want: DisplayStatusNotStarted,
		},
		{
			name: "smart reviewing without main file stays not started",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewSmartReviewing,
				ActivationStatus: ActivationStatusNotReady,
				MainDocPath:      sql.NullString{},
			},
			want: DisplayStatusNotStarted,
		},
		{
			name: "stopped manual submission",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewStopped,
				ActivationStatus: ActivationStatusNotReady,
			},
			want: DisplayStatusStopped,
		},
		{
			name: "smart reviewing with main file stays reviewing",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewSmartReviewing,
				ActivationStatus: ActivationStatusNotReady,
				MainDocPath:      sql.NullString{String: "credentials/1/owner/1/main.png", Valid: true},
			},
			want: DisplayStatusSmartReviewing,
		},
		{
			name: "manual reviewing",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewManualReviewing,
				ActivationStatus: ActivationStatusNotReady,
			},
			want: DisplayStatusManualReviewing,
		},
		{
			name: "passed ready",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewPassed,
				ActivationStatus: ActivationStatusReady,
			},
			want: DisplayStatusPassedReady,
		},
		{
			name: "activated",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewPassed,
				ActivationStatus: ActivationStatusActivated,
			},
			want: DisplayStatusActivated,
		},
	}

	for _, tc := range cases {
		if got := DisplayStatusForSubmission(tc.sub); got != tc.want {
			t.Fatalf("%s: got %s want %s", tc.name, got, tc.want)
		}
	}
}

func TestNormalizeReviewRouteProfile(t *testing.T) {
	got, err := normalizeReviewRoute("profile")
	if err != nil {
		t.Fatalf("normalizeReviewRoute returned error: %v", err)
	}
	if got != ReviewRouteProfile {
		t.Fatalf("normalizeReviewRoute(profile) = %q, want %q", got, ReviewRouteProfile)
	}
}

func TestValidateTenantProfilePayload(t *testing.T) {
	valid := map[string]string{
		"occupationType": "上班族",
		"orgName":        "測試公司",
		"incomeRange":    "40k-60k",
	}
	if err := ValidateTenantProfilePayload(valid); err != nil {
		t.Fatalf("ValidateTenantProfilePayload(valid) returned error: %v", err)
	}

	invalid := map[string]string{
		"occupationType": "",
		"orgName":        "測試公司",
		"incomeRange":    "",
	}
	if err := ValidateTenantProfilePayload(invalid); err == nil {
		t.Fatal("expected missing lightweight tenant fields to fail validation")
	}
}

func TestEnsureActivatable(t *testing.T) {
	t.Run("passed ready activates", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewPassed,
			ActivationStatus: ActivationStatusReady,
		}
		if err := EnsureActivatable(sub, false); err != nil {
			t.Fatalf("EnsureActivatable returned error: %v", err)
		}
	})

	t.Run("duplicate active credential blocked", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewPassed,
			ActivationStatus: ActivationStatusReady,
		}
		err := EnsureActivatable(sub, true)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "active credential") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning active credential", got)
		}
	})

	t.Run("superseded submission blocked", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewPassed,
			ActivationStatus: ActivationStatusSuperseded,
		}
		err := EnsureActivatable(sub, false)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "superseded") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning superseded", got)
		}
	})

	t.Run("persisted superseded status blocked", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewPassed,
			ActivationStatus: ActivationStatusSuperseded,
		}
		err := EnsureActivatable(sub, false)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "superseded") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning superseded", got)
		}
	})

	t.Run("pending review blocked", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewManualReviewing,
			ActivationStatus: ActivationStatusReady,
		}
		err := EnsureActivatable(sub, false)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "passed review") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning passed review", got)
		}
	})

	t.Run("not ready blocked", func(t *testing.T) {
		sub := &model.CredentialSubmission{
			ReviewStatus:     CredentialReviewPassed,
			ActivationStatus: ActivationStatusNotReady,
		}
		err := EnsureActivatable(sub, false)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "not ready") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning not ready", got)
		}
	})

	t.Run("missing submission blocked", func(t *testing.T) {
		err := EnsureActivatable(nil, false)
		if err == nil {
			t.Fatal("EnsureActivatable returned nil error")
		}
		if got := err.Error(); !strings.Contains(got, "required") {
			t.Fatalf("EnsureActivatable error = %q, want message mentioning required", got)
		}
	})
}
