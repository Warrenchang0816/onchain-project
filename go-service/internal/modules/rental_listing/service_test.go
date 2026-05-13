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
