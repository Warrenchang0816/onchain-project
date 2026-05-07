package customer

import "testing"

func TestBuildDisclosureSnapshotRequiresWarrantyAnswers(t *testing.T) {
	_, err := BuildDisclosureSnapshot(DisclosureInput{
		OwnerUserID:     7,
		PropertyAddress: "台北市大安區復興南路一段100號5樓",
		OwnershipDocNo:  "A-123",
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: ""},
		},
	})
	if err == nil {
		t.Fatal("expected missing warranty answer to be rejected")
	}
}

func TestBuildDisclosureSnapshotRequiresNotesForRiskAnswers(t *testing.T) {
	_, err := BuildDisclosureSnapshot(DisclosureInput{
		OwnerUserID:     7,
		PropertyAddress: "台北市大安區復興南路一段100號5樓",
		OwnershipDocNo:  "A-123",
		Warranties: []WarrantyAnswer{
			{Code: WarrantyWaterLeak, Answer: WarrantyAnswerYes},
		},
	})
	if err == nil {
		t.Fatal("expected YES warranty without note to be rejected")
	}
}

func TestBuildDisclosureSnapshotIsDeterministic(t *testing.T) {
	input := DisclosureInput{
		OwnerUserID:     7,
		PropertyAddress: " 台北市大安區復興南路一段100號5樓 ",
		OwnershipDocNo:  " A-123 ",
		Statement: PropertyStatement{
			BuildingType:   "公寓",
			RegisteredPing: 28.5,
			Floor:          5,
			TotalFloors:    7,
		},
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: WarrantyAnswerNo},
			{Code: WarrantyRadiation, Answer: WarrantyAnswerNo},
			{Code: WarrantyUnnaturalDeath, Answer: WarrantyAnswerUnknown, Note: "屋主不確定，需承租方或買方自行查證"},
		},
	}

	first, err := BuildDisclosureSnapshot(input)
	if err != nil {
		t.Fatalf("first snapshot: %v", err)
	}
	second, err := BuildDisclosureSnapshot(input)
	if err != nil {
		t.Fatalf("second snapshot: %v", err)
	}

	if first.DisclosureHash != second.DisclosureHash {
		t.Fatalf("disclosure hash not deterministic: %q != %q", first.DisclosureHash, second.DisclosureHash)
	}
	if first.DeedHash != second.DeedHash {
		t.Fatalf("deed hash not deterministic: %q != %q", first.DeedHash, second.DeedHash)
	}
	if first.Address != "台北市大安區復興南路一段100號5樓" {
		t.Fatalf("address was not normalized: %q", first.Address)
	}
	if first.DeedNo != "A-123" {
		t.Fatalf("deed no was not normalized: %q", first.DeedNo)
	}
}
