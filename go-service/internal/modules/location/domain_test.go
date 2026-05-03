package location

import "testing"

func TestDistrictResponseFromModel(t *testing.T) {
	d := District{
		County:     "台北市",
		District:   "中正區",
		PostalCode: "100",
	}

	resp := ToDistrictResponse(d)
	if resp.County != "台北市" {
		t.Fatalf("County = %q, want 台北市", resp.County)
	}
	if resp.District != "中正區" {
		t.Fatalf("District = %q, want 中正區", resp.District)
	}
	if resp.PostalCode != "100" {
		t.Fatalf("PostalCode = %q, want 100", resp.PostalCode)
	}
}
