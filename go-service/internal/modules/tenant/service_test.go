package tenant

import (
	"database/sql"
	"testing"
	"time"

	"go-service/internal/db/model"
)

func TestRequirementDistrictsFromRequestDedupesAndSkipsInvalid(t *testing.T) {
	got := requirementDistrictsFromRequest([]RequirementDistrictRequest{
		{County: "台北市", District: "大安區", ZipCode: "106"},
		{County: "台北市", District: "大安區", ZipCode: "106"},
		{County: "新北市", District: "", ZipCode: "220"},
		{County: "新北市", District: "板橋區", ZipCode: "220"},
	})

	if len(got) != 2 {
		t.Fatalf("len(got) = %d, want 2", len(got))
	}
	if got[0].County != "台北市" || got[0].District != "大安區" || got[0].ZipCode != "106" {
		t.Fatalf("first district = %+v", got[0])
	}
	if got[1].County != "新北市" || got[1].District != "板橋區" || got[1].ZipCode != "220" {
		t.Fatalf("second district = %+v", got[1])
	}
}

func TestBuildRequirementResponseIncludesStructuredCriteria(t *testing.T) {
	areaMin := 12.5
	areaMax := 28.0
	req := &model.TenantRequirement{
		ID:                         9,
		TargetDistrict:             "2 counties 2 districts",
		BudgetMin:                  20000,
		BudgetMax:                  36000,
		AreaMinPing:                sql.NullFloat64{Float64: areaMin, Valid: true},
		AreaMaxPing:                sql.NullFloat64{Float64: areaMax, Valid: true},
		RoomMin:                    2,
		BathroomMin:                1,
		LayoutNote:                 "兩房佳",
		MoveInTimeline:             "一個月內",
		MinimumLeaseMonths:         12,
		PetFriendlyNeeded:          true,
		ParkingNeeded:              false,
		CanCookNeeded:              true,
		CanRegisterHouseholdNeeded: true,
		LifestyleNote:              "生活單純",
		MustHaveNote:               "電梯",
		Status:                     model.TenantRequirementOpen,
		CreatedAt:                  time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC),
		UpdatedAt:                  time.Date(2026, 5, 5, 1, 0, 0, 0, time.UTC),
		Districts: []*model.TenantRequirementDistrict{
			{County: "台北市", District: "大安區", ZipCode: "106"},
			{County: "新北市", District: "板橋區", ZipCode: "220"},
		},
	}

	got := buildRequirementResponse(req, false, nil)

	if len(got.Districts) != 2 {
		t.Fatalf("len(Districts) = %d, want 2", len(got.Districts))
	}
	if got.AreaMinPing == nil || *got.AreaMinPing != areaMin {
		t.Fatalf("AreaMinPing = %v, want %v", got.AreaMinPing, areaMin)
	}
	if got.AreaMaxPing == nil || *got.AreaMaxPing != areaMax {
		t.Fatalf("AreaMaxPing = %v, want %v", got.AreaMaxPing, areaMax)
	}
	if got.RoomMin != 2 || got.BathroomMin != 1 || got.MinimumLeaseMonths != 12 {
		t.Fatalf("room/bath/lease = %d/%d/%d", got.RoomMin, got.BathroomMin, got.MinimumLeaseMonths)
	}
	if !got.CanCookNeeded || !got.CanRegisterHouseholdNeeded {
		t.Fatalf("cooking/household flags = %v/%v, want true/true", got.CanCookNeeded, got.CanRegisterHouseholdNeeded)
	}
	if got.MoveInTimeline == nil || *got.MoveInTimeline != "一個月內" {
		t.Fatalf("MoveInTimeline = %v, want 一個月內", got.MoveInTimeline)
	}
}
