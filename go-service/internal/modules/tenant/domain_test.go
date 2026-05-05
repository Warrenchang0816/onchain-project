package tenant

import (
	"testing"

	"go-service/internal/db/model"
)

func TestHasAdvancedData(t *testing.T) {
	profile := &model.TenantProfile{
		OccupationType: "上班族",
		OrgName:        "測試公司",
		IncomeRange:    "40k-60k",
		HouseholdSize:  2,
		MoveInTimeline: "一個月內",
	}
	docs := []*model.TenantProfileDocument{
		{DocType: model.TenantDocTypeIncomeProof},
	}

	if !HasAdvancedData(profile, docs) {
		t.Fatal("expected profile + one qualifying document to count as ADVANCED")
	}
}

func TestHasAdvancedDataRequiresRequiredFields(t *testing.T) {
	profile := &model.TenantProfile{
		OccupationType: "上班族",
		OrgName:        "",
		IncomeRange:    "",
	}
	docs := []*model.TenantProfileDocument{
		{DocType: model.TenantDocTypeIncomeProof},
	}

	if HasAdvancedData(profile, docs) {
		t.Fatal("expected missing org/income fields to block ADVANCED status")
	}
}

func TestScoreRentalMatchGood(t *testing.T) {
	req := RentalMatchRequirement{
		DistrictTokens:     []string{"台北市:大安區:106", "台北市:信義區:110"},
		BudgetMin:          20000,
		BudgetMax:          36000,
		AreaMinPing:        12,
		RoomMin:            1,
		BathroomMin:        1,
		PetFriendlyNeeded:  true,
		CanCookNeeded:      true,
		MinimumLeaseMonths: 12,
	}
	listing := RentalMatchListing{
		DistrictToken:      "台北市:大安區:106",
		MonthlyRent:        32000,
		AreaPing:           18,
		RoomCount:          2,
		BathroomCount:      1,
		PetAllowed:         true,
		CanCook:            true,
		MinimumLeaseMonths: 12,
	}
	got := ScoreRentalMatch(req, listing)
	if got.Level != MatchLevelGood || got.Score < 80 {
		t.Fatalf("ScoreRentalMatch() = %+v, want GOOD score >= 80", got)
	}
	if len(got.MissingReasons) != 0 {
		t.Fatalf("MissingReasons = %v, want none", got.MissingReasons)
	}
}

func TestScoreRentalMatchRequiredMissIsLow(t *testing.T) {
	req := RentalMatchRequirement{
		DistrictTokens:             []string{"台北市:大安區:106"},
		BudgetMax:                  40000,
		PetFriendlyNeeded:          true,
		CanCookNeeded:              true,
		MinimumLeaseMonths:         12,
		CanRegisterHouseholdNeeded: true,
	}
	listing := RentalMatchListing{
		DistrictToken:        "台北市:大安區:106",
		MonthlyRent:          30000,
		PetAllowed:           false,
		CanCook:              false,
		MinimumLeaseMonths:   6,
		CanRegisterHousehold: false,
	}
	got := ScoreRentalMatch(req, listing)
	if got.Level != MatchLevelLow {
		t.Fatalf("Level = %s, want LOW for required misses", got.Level)
	}
	if len(got.MissingReasons) == 0 {
		t.Fatalf("MissingReasons empty, want required misses")
	}
}
