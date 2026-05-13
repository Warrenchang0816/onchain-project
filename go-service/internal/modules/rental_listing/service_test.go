package rental_listing

import (
	"go-service/internal/db/model"
	"testing"
)

func TestApplyRentalUpdate_FurnitureNearby(t *testing.T) {
	trueVal := true
	falseVal := false
	rl := &model.RentalListing{}
	req := UpdateRentalListingRequest{
		HasSofa:              &trueVal,
		HasAC:                &falseVal,
		NearPark:             &trueVal,
		NearConvenienceStore: &falseVal,
	}
	applyRentalUpdate(rl, req)
	if !rl.HasSofa {
		t.Error("expected HasSofa true")
	}
	if rl.HasAC {
		t.Error("expected HasAC false")
	}
	if !rl.NearPark {
		t.Error("expected NearPark true")
	}
	if rl.NearConvenienceStore {
		t.Error("expected NearConvenienceStore false")
	}
}

func TestApplyRentalUpdate_NilFieldsAreNoOp(t *testing.T) {
	rl := &model.RentalListing{
		HasBed:          true,
		NearSupermarket: true,
		MonthlyRent:     25000,
	}
	req := UpdateRentalListingRequest{} // all nil
	applyRentalUpdate(rl, req)
	if !rl.HasBed {
		t.Error("nil HasBed should not change existing true value")
	}
	if !rl.NearSupermarket {
		t.Error("nil NearSupermarket should not change existing true value")
	}
	if rl.MonthlyRent != 25000 {
		t.Error("nil MonthlyRent should not change existing value")
	}
}
