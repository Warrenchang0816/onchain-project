package listing

import (
	"database/sql"
	"testing"

	"go-service/internal/db/model"
)

func TestShouldBootstrapOwnerDraft(t *testing.T) {
	tests := []struct {
		name          string
		existing      int
		hasSource     bool
		wantBootstrap bool
	}{
		{name: "first owner listing bootstraps", existing: 0, hasSource: false, wantBootstrap: true},
		{name: "existing listings skip bootstrap", existing: 1, hasSource: false, wantBootstrap: false},
		{name: "existing source draft skips bootstrap", existing: 0, hasSource: true, wantBootstrap: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ShouldBootstrapOwnerDraft(tt.existing, tt.hasSource)
			if got != tt.wantBootstrap {
				t.Fatalf("ShouldBootstrapOwnerDraft(%d, %v) = %v, want %v", tt.existing, tt.hasSource, got, tt.wantBootstrap)
			}
		})
	}
}

func TestIsReadyForPublish(t *testing.T) {
	ready := &model.Listing{
		Title:         "民生社區兩房",
		Address:       "台北市松山區民生東路四段 100 號",
		ListType:      model.ListingTypeRent,
		Price:         36000,
		Status:        model.ListingStatusDraft,
		SetupStatus:   model.ListingSetupStatusReady,
		AreaPing:      nullFloat(21.5),
		RoomCount:     nullInt(2),
		BathroomCount: nullInt(1),
	}
	if !IsReadyForPublish(ready) {
		t.Fatal("expected ready listing to be publishable")
	}

	incomplete := &model.Listing{
		Title:       "",
		Address:     "台北市松山區民生東路四段 100 號",
		ListType:    model.ListingTypeUnset,
		Price:       0,
		Status:      model.ListingStatusDraft,
		SetupStatus: model.ListingSetupStatusIncomplete,
	}
	if IsReadyForPublish(incomplete) {
		t.Fatal("expected incomplete bootstrap draft to be blocked from publish")
	}
}

func TestComputeSetupStatus(t *testing.T) {
	ready := &model.Listing{
		Title:         "民生社區兩房",
		Address:       "台北市松山區民生東路四段 100 號",
		ListType:      model.ListingTypeSale,
		Price:         18800000,
		AreaPing:      nullFloat(32.2),
		RoomCount:     nullInt(3),
		BathroomCount: nullInt(2),
	}
	if got := ComputeSetupStatus(ready); got != model.ListingSetupStatusReady {
		t.Fatalf("ComputeSetupStatus(ready) = %q, want %q", got, model.ListingSetupStatusReady)
	}

	missingType := &model.Listing{
		Title:         "民生社區兩房",
		Address:       "台北市松山區民生東路四段 100 號",
		ListType:      model.ListingTypeUnset,
		Price:         18800000,
		AreaPing:      nullFloat(32.2),
		RoomCount:     nullInt(3),
		BathroomCount: nullInt(2),
	}
	if got := ComputeSetupStatus(missingType); got != model.ListingSetupStatusIncomplete {
		t.Fatalf("ComputeSetupStatus(missingType) = %q, want %q", got, model.ListingSetupStatusIncomplete)
	}
}

func nullFloat(v float64) sql.NullFloat64 { return sql.NullFloat64{Float64: v, Valid: true} }

func nullInt(v int64) sql.NullInt64 { return sql.NullInt64{Int64: v, Valid: true} }
