package agent

import (
	"database/sql"
	"testing"
	"time"

	"go-service/internal/db/repository"
)

func TestNullStrPtr(t *testing.T) {
	t.Run("null returns nil", func(t *testing.T) {
		if nullStrPtr(sql.NullString{Valid: false}) != nil {
			t.Error("expected nil for null NullString")
		}
	})
	t.Run("empty valid string returns nil", func(t *testing.T) {
		if nullStrPtr(sql.NullString{String: "", Valid: true}) != nil {
			t.Error("expected nil for empty valid NullString")
		}
	})
	t.Run("non-empty valid string returns pointer", func(t *testing.T) {
		result := nullStrPtr(sql.NullString{String: "Alice", Valid: true})
		if result == nil || *result != "Alice" {
			t.Errorf("expected 'Alice', got %v", result)
		}
	})
}

func TestAgentListItemMapping(t *testing.T) {
	rec := repository.AgentRecord{
		WalletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
		DisplayName:   sql.NullString{String: "Bob Chen", Valid: true},
		NFTTokenID:    sql.NullInt32{Int32: 2, Valid: true},
		TxHash:        sql.NullString{String: "0xdeadbeef", Valid: true},
		ActivatedAt:   time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC),
	}

	item := AgentListItem{
		WalletAddress: rec.WalletAddress,
		DisplayName:   nullStrPtr(rec.DisplayName),
		ActivatedAt:   rec.ActivatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		NFTTokenID:    rec.NFTTokenID.Int32,
	}

	if item.WalletAddress != "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" {
		t.Errorf("unexpected WalletAddress: %v", item.WalletAddress)
	}
	if item.DisplayName == nil || *item.DisplayName != "Bob Chen" {
		t.Errorf("unexpected DisplayName: %v", item.DisplayName)
	}
	if item.NFTTokenID != 2 {
		t.Errorf("unexpected NFTTokenID: %v", item.NFTTokenID)
	}
	if item.ActivatedAt != "2026-04-01T12:00:00Z" {
		t.Errorf("unexpected ActivatedAt format: %v", item.ActivatedAt)
	}
}
