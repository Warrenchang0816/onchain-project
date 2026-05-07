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

func TestIsListingOwner(t *testing.T) {
	owner := &model.User{ID: 7}
	if !IsListingOwner(owner, 7) {
		t.Fatal("expected matching caller id to be treated as listing owner")
	}
	if IsListingOwner(owner, 8) {
		t.Fatal("expected different caller id to be treated as non-owner")
	}
	if IsListingOwner(nil, 7) {
		t.Fatal("expected missing caller to be treated as non-owner")
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
		RentDetails: &model.ListingRentDetails{
			MonthlyRent:        36000,
			DepositMonths:      2,
			MinimumLeaseMonths: 12,
		},
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

func TestIsReadyForPublishRequiresReadyProperty(t *testing.T) {
	ready := &model.Listing{
		Title:         "大安電梯兩房",
		Address:       "台北市大安區復興南路一段100號5樓",
		ListType:      model.ListingTypeRent,
		Price:         36000,
		Status:        model.ListingStatusDraft,
		SetupStatus:   model.ListingSetupStatusReady,
		AreaPing:      nullFloat(21.5),
		RoomCount:     nullInt(2),
		BathroomCount: nullInt(1),
		RentDetails: &model.ListingRentDetails{
			MonthlyRent:        36000,
			DepositMonths:      2,
			MinimumLeaseMonths: 12,
		},
	}

	if IsReadyForPublishWithProperty(ready, nil) {
		t.Fatal("expected missing property to block publish")
	}
	if IsReadyForPublishWithProperty(ready, &model.Customer{
		VerificationStatus: model.CustomerVerificationVerified,
		CompletenessStatus: model.CustomerCompletenessDisclosureRequired,
		DisclosureHash:     "abc",
	}) {
		t.Fatal("expected incomplete property disclosure to block publish")
	}
	if IsReadyForPublishWithProperty(ready, &model.Customer{
		VerificationStatus: model.CustomerVerificationDraft,
		CompletenessStatus: model.CustomerCompletenessReadyForListing,
		DisclosureHash:     "abc",
	}) {
		t.Fatal("expected unverified property to block publish")
	}
	if IsReadyForPublishWithProperty(ready, &model.Customer{
		VerificationStatus: model.CustomerVerificationVerified,
		CompletenessStatus: model.CustomerCompletenessReadyForListing,
		DisclosureHash:     "",
	}) {
		t.Fatal("expected missing disclosure hash to block publish")
	}
	if !IsReadyForPublishWithProperty(ready, &model.Customer{
		VerificationStatus: model.CustomerVerificationVerified,
		CompletenessStatus: model.CustomerCompletenessReadyForListing,
		DisclosureHash:     "abc",
	}) {
		t.Fatal("expected complete listing with ready property to be publishable")
	}
}

func TestCanSelectListingIntentRequiresReadyProperty(t *testing.T) {
	l := &model.Listing{
		Status:   model.ListingStatusDraft,
		Title:    "大安區住宅",
		Address:  "台北市大安區復興南路一段100號5樓",
		ListType: model.ListingTypeUnset,
		Price:    30000,
	}
	p := &model.Customer{
		VerificationStatus: model.CustomerVerificationDraft,
		CompletenessStatus: model.CustomerCompletenessDisclosureRequired,
	}
	if CanSelectListingIntent(l, p) {
		t.Fatal("expected incomplete property to block listing intent selection")
	}
	p.VerificationStatus = model.CustomerVerificationVerified
	p.CompletenessStatus = model.CustomerCompletenessReadyForListing
	p.DisclosureHash = "abc123"
	if !CanSelectListingIntent(l, p) {
		t.Fatal("expected draft listing with ready property to allow intent selection")
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
		SaleDetails: &model.ListingSaleDetails{
			SaleTotalPrice: 18800000,
		},
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

func TestComputeSetupStatusRequiresRentDetailsForRentListing(t *testing.T) {
	l := &model.Listing{
		Title:         "Rent ready home",
		Address:       "Taipei Main Road 100",
		ListType:      model.ListingTypeRent,
		Price:         36000,
		AreaPing:      nullFloat(21.5),
		RoomCount:     nullInt(2),
		BathroomCount: nullInt(1),
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusIncomplete {
		t.Fatalf("ComputeSetupStatus(missing rent details) = %q, want %q", got, model.ListingSetupStatusIncomplete)
	}

	l.RentDetails = &model.ListingRentDetails{
		MonthlyRent:        36000,
		DepositMonths:      2,
		MinimumLeaseMonths: 12,
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusReady {
		t.Fatalf("ComputeSetupStatus(rent ready) = %q, want %q", got, model.ListingSetupStatusReady)
	}
}

func TestComputeSetupStatusRequiresSaleDetailsForSaleListing(t *testing.T) {
	l := &model.Listing{
		Title:         "Sale ready home",
		Address:       "Taipei Main Road 100",
		ListType:      model.ListingTypeSale,
		Price:         18800000,
		AreaPing:      nullFloat(32.2),
		RoomCount:     nullInt(3),
		BathroomCount: nullInt(2),
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusIncomplete {
		t.Fatalf("ComputeSetupStatus(missing sale details) = %q, want %q", got, model.ListingSetupStatusIncomplete)
	}

	l.SaleDetails = &model.ListingSaleDetails{
		SaleTotalPrice: 18800000,
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusReady {
		t.Fatalf("ComputeSetupStatus(sale ready) = %q, want %q", got, model.ListingSetupStatusReady)
	}
}

func nullFloat(v float64) sql.NullFloat64 { return sql.NullFloat64{Float64: v, Valid: true} }

func nullInt(v int64) sql.NullInt64 { return sql.NullInt64{Int64: v, Valid: true} }
