package repository

import (
	"strings"
	"testing"
)

func TestBuildVisibleRequirementsQueryFiltersByDistrictTokens(t *testing.T) {
	query, args := buildVisibleRequirementsQuery(RequirementFilter{
		Districts: []string{"台北市:大安區:106", "新北市:板橋區:220"},
		Status:    "OPEN",
		Keyword:   "捷運",
	})

	required := []string{
		"EXISTS",
		"tenant_requirement_districts trd",
		"trd.requirement_id = tenant_requirements.id",
		"trd.county || ':' || trd.district || ':' || trd.zip_code",
		"ANY($1)",
		"status = $2",
		"layout_note ILIKE $3",
	}
	for _, want := range required {
		if !strings.Contains(query, want) {
			t.Fatalf("query missing %q\n%s", want, query)
		}
	}
	if len(args) != 3 {
		t.Fatalf("len(args) = %d, want 3", len(args))
	}
}
