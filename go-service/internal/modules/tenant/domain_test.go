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
