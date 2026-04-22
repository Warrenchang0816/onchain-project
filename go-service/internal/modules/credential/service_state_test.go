package credential

import (
	"database/sql"
	"testing"
	"time"

	"go-service/internal/db/model"
)

func TestShouldDisplayRevoked(t *testing.T) {
	revokedAt := time.Date(2026, 4, 22, 10, 0, 0, 0, time.UTC)
	revokedCredential := &model.UserCredential{
		UpdatedAt:     revokedAt,
		RevokedAt:     sql.NullTime{Time: revokedAt, Valid: true},
		RevokedReason: "資格已撤銷",
	}

	t.Run("revoked without newer submission stays revoked", func(t *testing.T) {
		latestSubmission := &model.CredentialSubmission{
			CreatedAt: revokedAt.Add(-2 * time.Hour),
		}
		if !shouldDisplayRevoked(revokedCredential, latestSubmission) {
			t.Fatal("expected revoked state to win when submission is older than revocation")
		}
	})

	t.Run("newer submission replaces revoked display", func(t *testing.T) {
		latestSubmission := &model.CredentialSubmission{
			CreatedAt: revokedAt.Add(2 * time.Hour),
		}
		if shouldDisplayRevoked(revokedCredential, latestSubmission) {
			t.Fatal("expected newer submission to replace revoked display")
		}
	})

	t.Run("revoked without submission stays revoked", func(t *testing.T) {
		if !shouldDisplayRevoked(revokedCredential, nil) {
			t.Fatal("expected revoked state when no submission exists")
		}
	})

	t.Run("nil revoked credential does not force revoked state", func(t *testing.T) {
		if shouldDisplayRevoked(nil, nil) {
			t.Fatal("expected nil revoked credential to return false")
		}
	})
}
