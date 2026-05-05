package db

import (
	"database/sql"
	"strings"
	"testing"
)

type execCall struct {
	query string
	args  []any
}

type fakeSchemaDB struct {
	calls []execCall
}

func (f *fakeSchemaDB) Exec(query string, args ...any) (sql.Result, error) {
	f.calls = append(f.calls, execCall{query: query, args: args})
	return fakeResult(0), nil
}

type fakeResult int64

func (r fakeResult) LastInsertId() (int64, error) { return 0, nil }
func (r fakeResult) RowsAffected() (int64, error) { return int64(r), nil }

type recordingDB struct {
	statements []string
}

func (r *recordingDB) Exec(query string, args ...any) (sql.Result, error) {
	r.statements = append(r.statements, query)
	return fakeResult(0), nil
}

func TestEnsureSchemaAddsListingPropertyIDAndTaiwanDistricts(t *testing.T) {
	db := &fakeSchemaDB{}

	if err := EnsureSchema(db); err != nil {
		t.Fatalf("EnsureSchema() error = %v", err)
	}

	all := strings.Join(queries(db.calls), "\n")
	if !strings.Contains(all, "ADD COLUMN IF NOT EXISTS property_id") {
		t.Fatal("expected schema migration to add listings.property_id")
	}
	if !strings.Contains(all, "CREATE TABLE IF NOT EXISTS taiwan_districts") {
		t.Fatal("expected schema migration to create taiwan_districts")
	}

	var seeded bool
	for _, call := range db.calls {
		if strings.Contains(call.query, "INSERT INTO taiwan_districts") && len(call.args) == 4 {
			if call.args[0] == "台北市" && call.args[1] == "中正區" && call.args[2] == "100" {
				seeded = true
			}
		}
	}
	if !seeded {
		t.Fatal("expected Taiwan district seed data to include 台北市 中正區 100")
	}

	var lienchiang bool
	for _, call := range db.calls {
		if strings.Contains(call.query, "INSERT INTO taiwan_districts") && len(call.args) == 4 {
			if call.args[0] == "連江縣" && call.args[1] == "南竿" && call.args[2] == "209" {
				lienchiang = true
			}
		}
	}
	if !lienchiang {
		t.Fatal("expected Taiwan district seed data to include 連江縣 南竿 209")
	}

	if !strings.Contains(all, "DELETE FROM taiwan_districts") {
		t.Fatal("expected schema migration to clean previously misclassified district seed rows")
	}
}

func TestEnsureSchemaAddsTenantRequirementMatchingSchema(t *testing.T) {
	db := &recordingDB{}
	if err := EnsureSchema(db); err != nil {
		t.Fatalf("EnsureSchema() error = %v", err)
	}
	joined := strings.Join(db.statements, "\n")
	required := []string{
		"ALTER TABLE tenant_requirements",
		"area_min_ping",
		"area_max_ping",
		"room_min",
		"bathroom_min",
		"move_in_timeline",
		"minimum_lease_months",
		"can_cook_needed",
		"can_register_household_needed",
		"lifestyle_note",
		"must_have_note",
		"CREATE TABLE IF NOT EXISTS tenant_requirement_districts",
		"idx_tenant_requirement_districts_requirement_id",
		"idx_tenant_requirement_districts_location",
		"INSERT INTO tenant_requirement_districts",
	}
	for _, want := range required {
		if !strings.Contains(joined, want) {
			t.Fatalf("EnsureSchema statements missing %q\n%s", want, joined)
		}
	}
}

func queries(calls []execCall) []string {
	out := make([]string, 0, len(calls))
	for _, call := range calls {
		out = append(out, call.query)
	}
	return out
}
