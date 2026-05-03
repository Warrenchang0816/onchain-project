# Rental Matching Search Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a matching-ready rental search foundation with structured tenant requirements, multi-county district selection, shared rental search controls, and lightweight explainable match scoring.

**Architecture:** Extend the Go/Postgres tenant requirement model first, including an idempotent schema migration and a normalized `tenant_requirement_districts` table. Add pure matching domain logic before exposing it through services, then upgrade React with shared district/search helpers and reusable requirement form/list/detail components.

**Tech Stack:** Go 1.23, PostgreSQL, `database/sql`, Gin, React 19, TypeScript, React Router v7, Vite, existing fetch APIs, existing Tailwind utility classes.

---

## File Structure

- Modify: `go-service/internal/platform/db/schema.go`
  - Add idempotent `tenant_requirements` column repairs and `tenant_requirement_districts`.
  - Backfill district rows from legacy `target_district`.
- Modify: `go-service/internal/platform/db/schema_test.go`
  - Assert schema statements include the new requirement table, columns, indexes, and backfill.
- Create: `infra/init/13-tenant-requirement-matching.sql`
  - Fresh database bootstrap SQL for requirement matching columns and seed data.
- Modify: `go-service/internal/db/model/tenant_requirement_model.go`
  - Add structured fields and `Districts`.
- Create: `go-service/internal/db/model/tenant_requirement_district_model.go`
  - Define normalized requirement district model.
- Modify: `go-service/internal/db/repository/tenant_requirement_repo.go`
  - Read/write structured districts and filters.
- Modify: `go-service/internal/modules/tenant/dto.go`
  - Add district payloads, structured criteria fields, and match summary response types.
- Modify: `go-service/internal/modules/tenant/domain.go`
  - Add pure match scoring logic and district summary helpers.
- Modify: `go-service/internal/modules/tenant/domain_test.go`
  - Cover scoring, level decisions, and district summaries.
- Modify: `go-service/internal/modules/tenant/service.go`
  - Map DTOs to models, preserve legacy `target_district` summary, and apply filters.
- Modify: `go-service/internal/modules/tenant/service_test.go`
  - Cover create/update/list behavior where practical with repository fakes or focused domain tests.
- Modify: `go-service/internal/modules/listing/dto.go`
  - Add multi-district list filter fields and optional `match` response shape if listing responses need it.
- Modify: `go-service/internal/modules/listing/service.go`
  - Apply district filters to rental listing list without changing sale-specific behavior.
- Modify: `go-service/internal/db/repository/listing_repo.go`
  - Support district set filters with `district = ANY(...)` or generated SQL parameter slots.
- Modify: `react-service/src/api/tenantApi.ts`
  - Add structured requirement payload/response types.
- Modify: `react-service/src/api/listingApi.ts`
  - Add multi-district filter request support while keeping existing fields compatible.
- Create: `react-service/src/components/location/districtSelection.ts`
  - Shared grouping, selection, encoding, and summary helpers.
- Create: `react-service/tests/districtSelection.test.ts`
  - Unit tests for multi-county selection helpers.
- Create: `react-service/src/components/location/DistrictMultiSelect.tsx`
  - Shared multi/single district selector.
- Modify: `react-service/src/components/listing/listingDistrictOptions.ts`
  - Re-export or delegate to `districtSelection.ts`, removing hard-coded county labels.
- Modify: `react-service/src/components/listing/ListingSearchBar.tsx`
  - Use the shared district selector and multi-district query state.
- Create: `react-service/src/components/search/RentalSearchFilters.tsx`
  - Shared rental filter controls for listing and requirement pages.
- Create: `react-service/src/components/tenant/requirementFormValues.ts`
  - Form default values, payload conversion, and response-to-form conversion.
- Create: `react-service/tests/requirementFormValues.test.ts`
  - Unit tests for requirement form conversions.
- Create: `react-service/src/components/tenant/TenantRequirementForm.tsx`
  - Full create/edit form for rental requirements.
- Create: `react-service/src/components/tenant/tenantRequirementDisplayModel.ts`
  - Requirement card/detail formatting and match labels.
- Create: `react-service/tests/tenantRequirementDisplayModel.test.ts`
  - Unit tests for display formatting.
- Create: `react-service/src/components/tenant/TenantRequirementCard.tsx`
  - Shared list card.
- Create: `react-service/src/components/tenant/TenantRequirementDetailShell.tsx`
  - Shared detail shell.
- Modify: `react-service/src/pages/MyRequirementsPage.tsx`
  - Replace inline form/list with shared components.
- Modify: `react-service/src/pages/RequirementsPage.tsx`
  - Replace broken copy and simple filters with search/filter/card components.
- Modify: `react-service/src/pages/RequirementDetailPage.tsx`
  - Replace broken copy and inline sections with detail shell.
- Modify: `infra/init/12-demo-listings.sql`
  - Keep existing five listings and ensure rental rows have complete comparable criteria.
- Create: `infra/init/14-demo-tenant-requirements.sql`
  - Add seed requirements covering good, partial, and low rental matches.

## Task 1: Backend Schema Foundation

**Files:**
- Modify: `go-service/internal/platform/db/schema.go`
- Modify: `go-service/internal/platform/db/schema_test.go`
- Create: `infra/init/13-tenant-requirement-matching.sql`

- [ ] **Step 1: Write failing schema test**

Add this test to `go-service/internal/platform/db/schema_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/platform/db -run TestEnsureSchemaAddsTenantRequirementMatchingSchema -count=1
```

Expected: FAIL because the schema statements do not yet include requirement matching columns or the district table.

- [ ] **Step 3: Add idempotent schema statements**

In `go-service/internal/platform/db/schema.go`, add statements inside `statements := []string{...}` after the Taiwan district setup:

```go
`ALTER TABLE tenant_requirements
    ADD COLUMN IF NOT EXISTS area_min_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS area_max_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS room_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bathroom_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS move_in_timeline TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS minimum_lease_months INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS can_cook_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_register_household_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lifestyle_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS must_have_note TEXT NOT NULL DEFAULT ''`,
`CREATE TABLE IF NOT EXISTS tenant_requirement_districts (
    id BIGSERIAL PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES tenant_requirements(id) ON DELETE CASCADE,
    county VARCHAR(20) NOT NULL,
    district VARCHAR(30) NOT NULL,
    zip_code CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_requirement_districts UNIQUE (requirement_id, county, district, zip_code)
)`,
`CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_requirement_id
    ON tenant_requirement_districts (requirement_id)`,
`CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_location
    ON tenant_requirement_districts (county, district, zip_code)`,
`INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
    SELECT tr.id, td.county, td.district, td.postal_code
    FROM tenant_requirements tr
    JOIN taiwan_districts td ON td.district = tr.target_district
    WHERE tr.target_district <> ''
      AND NOT EXISTS (
        SELECT 1 FROM tenant_requirement_districts existing
        WHERE existing.requirement_id = tr.id
      )`,
```

- [ ] **Step 4: Add fresh init SQL**

Create `infra/init/13-tenant-requirement-matching.sql` with the same table/column/index/backfill SQL, wrapped as plain SQL statements:

```sql
ALTER TABLE tenant_requirements
    ADD COLUMN IF NOT EXISTS area_min_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS area_max_ping NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS room_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bathroom_min INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS move_in_timeline TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS minimum_lease_months INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS can_cook_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_register_household_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lifestyle_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS must_have_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS tenant_requirement_districts (
    id BIGSERIAL PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES tenant_requirements(id) ON DELETE CASCADE,
    county VARCHAR(20) NOT NULL,
    district VARCHAR(30) NOT NULL,
    zip_code CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_requirement_districts UNIQUE (requirement_id, county, district, zip_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_requirement_id
    ON tenant_requirement_districts (requirement_id);

CREATE INDEX IF NOT EXISTS idx_tenant_requirement_districts_location
    ON tenant_requirement_districts (county, district, zip_code);

INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
SELECT tr.id, td.county, td.district, td.postal_code
FROM tenant_requirements tr
JOIN taiwan_districts td ON td.district = tr.target_district
WHERE tr.target_district <> ''
  AND NOT EXISTS (
    SELECT 1 FROM tenant_requirement_districts existing
    WHERE existing.requirement_id = tr.id
  );
```

- [ ] **Step 5: Run schema tests**

Run:

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/platform/db -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit schema foundation**

```powershell
git add go-service/internal/platform/db/schema.go go-service/internal/platform/db/schema_test.go infra/init/13-tenant-requirement-matching.sql
git commit -m "feat: add tenant requirement matching schema"
```

## Task 2: Tenant Requirement Models, DTOs, and Repository

**Files:**
- Modify: `go-service/internal/db/model/tenant_requirement_model.go`
- Create: `go-service/internal/db/model/tenant_requirement_district_model.go`
- Modify: `go-service/internal/db/repository/tenant_requirement_repo.go`
- Modify: `go-service/internal/modules/tenant/dto.go`

- [ ] **Step 1: Add model definitions**

Update `tenant_requirement_model.go` with these fields:

```go
AreaMinPing                  sql.NullFloat64
AreaMaxPing                  sql.NullFloat64
RoomMin                      int
BathroomMin                  int
MoveInTimeline               string
MinimumLeaseMonths           int
CanCookNeeded                bool
CanRegisterHouseholdNeeded   bool
LifestyleNote                string
MustHaveNote                 string
Districts                    []*TenantRequirementDistrict
```

Create `tenant_requirement_district_model.go`:

```go
package model

import "time"

type TenantRequirementDistrict struct {
	ID            int64
	RequirementID int64
	County        string
	District      string
	ZipCode       string
	CreatedAt     time.Time
}
```

- [ ] **Step 2: Add DTO types**

In `go-service/internal/modules/tenant/dto.go`, add:

```go
type RequirementDistrictRequest struct {
	County   string `json:"county" binding:"required"`
	District string `json:"district" binding:"required"`
	ZipCode  string `json:"zipCode" binding:"required"`
}

type RequirementDistrictResponse struct {
	County   string `json:"county"`
	District string `json:"district"`
	ZipCode  string `json:"zipCode"`
}

type MatchSummaryResponse struct {
	Score          int      `json:"score"`
	Level          string   `json:"level"`
	MatchedReasons []string `json:"matchedReasons"`
	MissingReasons []string `json:"missingReasons"`
}
```

Extend `TenantRequirementResponse`, `CreateRequirementRequest`, and `UpdateRequirementRequest` with:

```go
Districts                  []RequirementDistrictResponse `json:"districts"`
AreaMinPing                *float64                      `json:"areaMinPing,omitempty"`
AreaMaxPing                *float64                      `json:"areaMaxPing,omitempty"`
RoomMin                    int                           `json:"roomMin"`
BathroomMin                int                           `json:"bathroomMin"`
MoveInTimeline             string                        `json:"moveInTimeline"`
MinimumLeaseMonths         int                           `json:"minimumLeaseMonths"`
CanCookNeeded              bool                          `json:"canCookNeeded"`
CanRegisterHouseholdNeeded bool                          `json:"canRegisterHouseholdNeeded"`
LifestyleNote              string                        `json:"lifestyleNote"`
MustHaveNote               string                        `json:"mustHaveNote"`
Match                      *MatchSummaryResponse         `json:"match,omitempty"`
```

For request structs, use `[]RequirementDistrictRequest` for `Districts`.

- [ ] **Step 3: Update repository query shape**

Change `requirementSelectCols` in `tenant_requirement_repo.go` to include all new columns:

```go
const requirementSelectCols = `
	SELECT id, user_id, target_district, budget_min, budget_max, layout_note,
	       move_in_date, pet_friendly_needed, parking_needed, status, created_at, updated_at,
	       area_min_ping, area_max_ping, room_min, bathroom_min, move_in_timeline,
	       minimum_lease_months, can_cook_needed, can_register_household_needed,
	       lifestyle_note, must_have_note
	FROM tenant_requirements`
```

Update both scan sites to scan the new fields.

- [ ] **Step 4: Add district persistence helpers**

Add repository methods:

```go
func (r *TenantRequirementRepository) ReplaceDistricts(requirementID int64, districts []*model.TenantRequirementDistrict) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM tenant_requirement_districts WHERE requirement_id = $1`, requirementID); err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts delete: %w", err)
	}
	for _, d := range districts {
		if _, err := tx.Exec(`
			INSERT INTO tenant_requirement_districts (requirement_id, county, district, zip_code)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (requirement_id, county, district, zip_code) DO NOTHING
		`, requirementID, d.County, d.District, d.ZipCode); err != nil {
			return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts insert: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("tenant_requirement_repo: ReplaceDistricts commit: %w", err)
	}
	return nil
}

func (r *TenantRequirementRepository) attachDistricts(reqs []*model.TenantRequirement) error {
	if len(reqs) == 0 {
		return nil
	}
	byID := map[int64]*model.TenantRequirement{}
	ids := make([]int64, 0, len(reqs))
	for _, req := range reqs {
		byID[req.ID] = req
		ids = append(ids, req.ID)
	}
	rows, err := r.db.Query(`
		SELECT requirement_id, county, district, zip_code, created_at
		FROM tenant_requirement_districts
		WHERE requirement_id = ANY($1)
		ORDER BY county, zip_code, district
	`, pq.Array(ids))
	if err != nil {
		return fmt.Errorf("tenant_requirement_repo: attachDistricts: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		d := &model.TenantRequirementDistrict{}
		if err := rows.Scan(&d.RequirementID, &d.County, &d.District, &d.ZipCode, &d.CreatedAt); err != nil {
			return err
		}
		if req := byID[d.RequirementID]; req != nil {
			req.Districts = append(req.Districts, d)
		}
	}
	return rows.Err()
}
```

Add `github.com/lib/pq` to imports when needed.

- [ ] **Step 5: Update create/update SQL**

Update `Create` and `Update` to persist the new scalar fields. After `Create` returns an id, call `ReplaceDistricts(id, req.Districts)`. After `Update`, call `ReplaceDistricts(req.ID, req.Districts)`.

Use `sql.NullFloat64` for nullable area bounds. Keep `target_district` populated from a summary string for legacy display.

- [ ] **Step 6: Add filter support**

Extend repository `RequirementFilter`:

```go
type RequirementFilter struct {
	Districts []string
	County    string
	Status    string
	Keyword   string
}
```

Use an `EXISTS` clause for district filtering:

```go
AND EXISTS (
  SELECT 1 FROM tenant_requirement_districts trd
  WHERE trd.requirement_id = tenant_requirements.id
    AND (trd.county || ':' || trd.district || ':' || trd.zip_code) = ANY($N)
)
```

- [ ] **Step 7: Run backend compile tests**

Run:

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/db/repository ./internal/modules/tenant -count=1
```

Expected: PASS after any import or scan-order fixes.

- [ ] **Step 8: Commit model and repository support**

```powershell
git add go-service/internal/db/model/tenant_requirement_model.go go-service/internal/db/model/tenant_requirement_district_model.go go-service/internal/db/repository/tenant_requirement_repo.go go-service/internal/modules/tenant/dto.go
git commit -m "feat: structure tenant requirement criteria"
```

## Task 3: Tenant Requirement Service Mapping and Match Scoring

**Files:**
- Modify: `go-service/internal/modules/tenant/domain.go`
- Modify: `go-service/internal/modules/tenant/domain_test.go`
- Modify: `go-service/internal/modules/tenant/service.go`
- Modify: `go-service/internal/modules/tenant/dto.go`

- [ ] **Step 1: Write match scoring tests**

Add to `domain_test.go`:

```go
func TestScoreRentalMatchGood(t *testing.T) {
	req := RentalMatchRequirement{
		DistrictTokens: []string{"台北市:大安區:106", "台北市:信義區:110"},
		BudgetMin: 20000,
		BudgetMax: 36000,
		AreaMinPing: 12,
		RoomMin: 1,
		BathroomMin: 1,
		PetFriendlyNeeded: true,
		CanCookNeeded: true,
		MinimumLeaseMonths: 12,
	}
	listing := RentalMatchListing{
		DistrictToken: "台北市:大安區:106",
		MonthlyRent: 32000,
		AreaPing: 18,
		RoomCount: 2,
		BathroomCount: 1,
		PetAllowed: true,
		CanCook: true,
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
		DistrictTokens: []string{"台北市:大安區:106"},
		BudgetMax: 40000,
		PetFriendlyNeeded: true,
	}
	listing := RentalMatchListing{
		DistrictToken: "台北市:大安區:106",
		MonthlyRent: 30000,
		PetAllowed: false,
	}
	got := ScoreRentalMatch(req, listing)
	if got.Level != MatchLevelLow {
		t.Fatalf("Level = %s, want LOW for required pet miss", got.Level)
	}
	if len(got.MissingReasons) == 0 {
		t.Fatalf("MissingReasons empty, want pet miss")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/modules/tenant -run TestScoreRentalMatch -count=1
```

Expected: FAIL because match types and scoring do not exist.

- [ ] **Step 3: Add match domain types and scoring**

Add to `domain.go`:

```go
const (
	MatchLevelGood    = "GOOD"
	MatchLevelPartial = "PARTIAL"
	MatchLevelLow     = "LOW"
)

type RentalMatchRequirement struct {
	DistrictTokens                 []string
	BudgetMin                      float64
	BudgetMax                      float64
	AreaMinPing                    float64
	AreaMaxPing                    float64
	RoomMin                        int
	BathroomMin                    int
	PetFriendlyNeeded              bool
	ParkingNeeded                  bool
	CanCookNeeded                  bool
	CanRegisterHouseholdNeeded     bool
	MinimumLeaseMonths             int
}

type RentalMatchListing struct {
	DistrictToken                  string
	MonthlyRent                    float64
	AreaPing                       float64
	RoomCount                      int
	BathroomCount                  int
	PetAllowed                     bool
	ParkingIncluded                bool
	CanCook                        bool
	CanRegisterHousehold           bool
	MinimumLeaseMonths             int
}

type MatchSummary struct {
	Score          int
	Level          string
	MatchedReasons []string
	MissingReasons []string
}
```

Implement `ScoreRentalMatch` with the point rules from the spec. Use helper functions for `containsToken`, `withinBudget`, `withinArea`, and `requiredBool`.

- [ ] **Step 4: Add district summary helpers**

Add helpers in `domain.go`:

```go
func RequirementDistrictToken(county, district, zipCode string) string {
	return strings.TrimSpace(county) + ":" + strings.TrimSpace(district) + ":" + strings.TrimSpace(zipCode)
}

func RequirementDistrictSummary(districts []*model.TenantRequirementDistrict) string {
	if len(districts) == 0 {
		return ""
	}
	byCounty := map[string]int{}
	for _, d := range districts {
		byCounty[d.County]++
	}
	if len(byCounty) == 1 && len(districts) == 1 {
		return districts[0].County + " " + districts[0].District
	}
	if len(byCounty) == 1 {
		for county, count := range byCounty {
			return fmt.Sprintf("%s %d districts", county, count)
		}
	}
	return fmt.Sprintf("%d counties %d districts", len(byCounty), len(districts))
}
```

Use English summaries internally if that avoids console encoding churn; UI can localize display labels.

- [ ] **Step 5: Update service request mapping**

In `service.go`, add functions:

```go
func requirementDistrictsFromRequest(items []RequirementDistrictRequest) []*model.TenantRequirementDistrict {
	result := make([]*model.TenantRequirementDistrict, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		county := strings.TrimSpace(item.County)
		district := strings.TrimSpace(item.District)
		zipCode := strings.TrimSpace(item.ZipCode)
		token := RequirementDistrictToken(county, district, zipCode)
		if county == "" || district == "" || zipCode == "" || seen[token] {
			continue
		}
		seen[token] = true
		result = append(result, &model.TenantRequirementDistrict{
			County: county,
			District: district,
			ZipCode: zipCode,
		})
	}
	return result
}
```

When creating/updating a requirement, map all new scalar fields and set:

```go
r.Districts = requirementDistrictsFromRequest(req.Districts)
r.TargetDistrict = RequirementDistrictSummary(r.Districts)
```

- [ ] **Step 6: Update response mapping**

Extend `buildRequirementResponse` to include `Districts`, new scalar fields, and `Match` when supplied. Keep `targetDistrict` as summary string for frontend backward compatibility.

- [ ] **Step 7: Run tenant module tests**

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/modules/tenant -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit service and scoring**

```powershell
git add go-service/internal/modules/tenant/domain.go go-service/internal/modules/tenant/domain_test.go go-service/internal/modules/tenant/service.go go-service/internal/modules/tenant/dto.go
git commit -m "feat: add rental match scoring"
```

## Task 4: Frontend District Selection Foundation

**Files:**
- Create: `react-service/src/components/location/districtSelection.ts`
- Create: `react-service/tests/districtSelection.test.ts`
- Create: `react-service/src/components/location/DistrictMultiSelect.tsx`
- Modify: `react-service/src/components/listing/listingDistrictOptions.ts`
- Modify: `react-service/tests/listingDistrictOptions.test.ts`

- [ ] **Step 1: Write district helper tests**

Create `react-service/tests/districtSelection.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  encodeDistrictToken,
  getDistrictSelectionSummary,
  groupDistrictOptions,
  toggleDistrictSelection,
  type DistrictSelection,
} from "../src/components/location/districtSelection.ts";

const options = [
  { county: "台北市", district: "大安區", postal_code: "106" },
  { county: "台北市", district: "信義區", postal_code: "110" },
  { county: "新北市", district: "板橋區", postal_code: "220" },
];

assert.equal(encodeDistrictToken(options[0]), "台北市:大安區:106");

const groups = groupDistrictOptions(options);
assert.equal(groups.length, 2);
assert.equal(groups[0].county, "台北市");

let selected: DistrictSelection[] = [];
selected = toggleDistrictSelection(selected, options[0], "multi");
selected = toggleDistrictSelection(selected, options[2], "multi");
assert.equal(selected.length, 2);
assert.equal(getDistrictSelectionSummary(selected), "2 縣市 2 區");

selected = toggleDistrictSelection(selected, options[0], "multi");
assert.deepEqual(selected.map((item) => item.district), ["板橋區"]);

selected = toggleDistrictSelection(selected, options[0], "single");
selected = toggleDistrictSelection(selected, options[1], "single");
assert.deepEqual(selected.map((item) => item.district), ["信義區"]);
```

- [ ] **Step 2: Run helper test to verify it fails**

```powershell
Set-Location react-service
node --experimental-strip-types tests/districtSelection.test.ts
```

Expected: FAIL because `districtSelection.ts` does not exist.

- [ ] **Step 3: Add district helper module**

Create `districtSelection.ts`:

```ts
import type { TaiwanDistrictOption } from "../../api/listingApi";

export type DistrictSelection = {
  county: string;
  district: string;
  postalCode: string;
};

export type DistrictGroup = {
  county: string;
  districts: TaiwanDistrictOption[];
};

export type DistrictSelectionMode = "single" | "multi";

export function encodeDistrictToken(option: TaiwanDistrictOption | DistrictSelection): string {
  const postalCode = "postal_code" in option ? option.postal_code : option.postalCode;
  return `${option.county}:${option.district}:${postalCode}`;
}

export function districtOptionToSelection(option: TaiwanDistrictOption): DistrictSelection {
  return { county: option.county, district: option.district, postalCode: option.postal_code };
}

export function groupDistrictOptions(options: TaiwanDistrictOption[]): DistrictGroup[] {
  const groups = new Map<string, TaiwanDistrictOption[]>();
  for (const option of options) {
    groups.set(option.county, [...(groups.get(option.county) ?? []), option]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "zh-TW"))
    .map(([county, districts]) => ({
      county,
      districts: [...districts].sort((a, b) => Number(a.postal_code) - Number(b.postal_code) || a.district.localeCompare(b.district, "zh-TW")),
    }));
}

export function toggleDistrictSelection(current: DistrictSelection[], option: TaiwanDistrictOption, mode: DistrictSelectionMode): DistrictSelection[] {
  const next = districtOptionToSelection(option);
  const token = encodeDistrictToken(next);
  if (mode === "single") {
    return current.length === 1 && encodeDistrictToken(current[0]) === token ? [] : [next];
  }
  if (current.some((item) => encodeDistrictToken(item) === token)) {
    return current.filter((item) => encodeDistrictToken(item) !== token);
  }
  return [...current, next];
}

export function getDistrictSelectionSummary(selection: DistrictSelection[]): string {
  if (selection.length === 0) return "不限行政區";
  const counties = new Set(selection.map((item) => item.county));
  if (selection.length === 1) return `${selection[0].county} ${selection[0].district}`;
  if (counties.size === 1) return `${selection[0].county} ${selection.length} 區`;
  return `${counties.size} 縣市 ${selection.length} 區`;
}
```

- [ ] **Step 4: Add `DistrictMultiSelect` component**

Create `DistrictMultiSelect.tsx` with props:

```ts
type DistrictMultiSelectProps = {
  options: TaiwanDistrictOption[];
  value: DistrictSelection[];
  mode?: "single" | "multi";
  emptyLabel?: string;
  onChange: (next: DistrictSelection[]) => void;
};
```

Use `groupDistrictOptions`, `toggleDistrictSelection`, and `getDistrictSelectionSummary`. Render a button, popover, county column, district checkbox column, and clear button. Keep styling close to `ListingSearchBar`.

- [ ] **Step 5: Delegate old listing helpers**

Replace `listingDistrictOptions.ts` with compatibility exports:

```ts
export {
  groupDistrictOptions,
  type DistrictGroup,
} from "../location/districtSelection";

import type { DistrictGroup } from "../location/districtSelection";

export function findCountyForSelection(groups: DistrictGroup[], selectedDistrict: string): string {
  if (!selectedDistrict) return groups[0]?.county ?? "";
  const selectedGroup = groups.find((group) => group.county === selectedDistrict || group.districts.some((option) => option.district === selectedDistrict));
  return selectedGroup?.county ?? groups[0]?.county ?? "";
}

export function getDistrictSelectionLabel(selectedDistrict: string): string {
  return selectedDistrict ? selectedDistrict : "不限行政區";
}
```

- [ ] **Step 6: Run frontend helper tests**

```powershell
Set-Location react-service
node --experimental-strip-types tests/districtSelection.test.ts
node --experimental-strip-types tests/listingDistrictOptions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit district foundation**

```powershell
git add react-service/src/components/location/districtSelection.ts react-service/src/components/location/DistrictMultiSelect.tsx react-service/src/components/listing/listingDistrictOptions.ts react-service/tests/districtSelection.test.ts react-service/tests/listingDistrictOptions.test.ts
git commit -m "feat: add shared district selector foundation"
```

## Task 5: Requirement API Types and Form Helpers

**Files:**
- Modify: `react-service/src/api/tenantApi.ts`
- Create: `react-service/src/components/tenant/requirementFormValues.ts`
- Create: `react-service/tests/requirementFormValues.test.ts`

- [ ] **Step 1: Update API types**

In `tenantApi.ts`, add:

```ts
export type RequirementDistrict = {
  county: string;
  district: string;
  zipCode: string;
};

export type MatchSummary = {
  score: number;
  level: "GOOD" | "PARTIAL" | "LOW";
  matchedReasons: string[];
  missingReasons: string[];
};
```

Extend `TenantRequirement` and `TenantRequirementPayload` with the fields from the spec and `districts`.

- [ ] **Step 2: Write form helper tests**

Create `requirementFormValues.test.ts`:

```ts
import assert from "node:assert/strict";
import { createRequirementFormInitialValues, requirementToFormValues, toRequirementPayload } from "../src/components/tenant/requirementFormValues.ts";

const empty = createRequirementFormInitialValues();
assert.deepEqual(empty.districts, []);
assert.equal(empty.budgetMin, "");

const payload = toRequirementPayload({
  ...empty,
  districts: [{ county: "台北市", district: "大安區", postalCode: "106" }],
  budgetMin: "20000",
  budgetMax: "36000",
  areaMinPing: "12",
  roomMin: "1",
  bathroomMin: "1",
  canCookNeeded: true,
});

assert.deepEqual(payload.districts, [{ county: "台北市", district: "大安區", zipCode: "106" }]);
assert.equal(payload.budgetMin, 20000);
assert.equal(payload.areaMinPing, 12);
assert.equal(payload.canCookNeeded, true);

const form = requirementToFormValues({
  id: 1,
  targetDistrict: "台北市 1 districts",
  districts: [{ county: "台北市", district: "大安區", zipCode: "106" }],
  budgetMin: 20000,
  budgetMax: 36000,
  layoutNote: "兩房佳",
  petFriendlyNeeded: false,
  parkingNeeded: true,
  canCookNeeded: true,
  canRegisterHouseholdNeeded: false,
  roomMin: 2,
  bathroomMin: 1,
  minimumLeaseMonths: 12,
  lifestyleNote: "安靜",
  mustHaveNote: "電梯",
  status: "OPEN",
  hasAdvancedData: false,
  createdAt: "2026-05-03T00:00:00Z",
  updatedAt: "2026-05-03T00:00:00Z",
});
assert.equal(form.roomMin, "2");
assert.equal(form.districts[0].postalCode, "106");
```

- [ ] **Step 3: Run test to verify it fails**

```powershell
Set-Location react-service
node --experimental-strip-types tests/requirementFormValues.test.ts
```

Expected: FAIL because helper file does not exist.

- [ ] **Step 4: Add form helper implementation**

Create `requirementFormValues.ts` with:

```ts
import type { TenantRequirement, TenantRequirementPayload } from "../../api/tenantApi";
import type { DistrictSelection } from "../location/districtSelection";

export type RequirementFormValues = {
  districts: DistrictSelection[];
  budgetMin: string;
  budgetMax: string;
  areaMinPing: string;
  areaMaxPing: string;
  roomMin: string;
  bathroomMin: string;
  moveInDate: string;
  moveInTimeline: string;
  minimumLeaseMonths: string;
  petFriendlyNeeded: boolean;
  parkingNeeded: boolean;
  canCookNeeded: boolean;
  canRegisterHouseholdNeeded: boolean;
  layoutNote: string;
  lifestyleNote: string;
  mustHaveNote: string;
};
```

Implement `createRequirementFormInitialValues`, `toRequirementPayload`, and `requirementToFormValues`. Numeric blank values should become `0` for integer minimums and `undefined` for nullable area bounds.

- [ ] **Step 5: Run helper tests**

```powershell
Set-Location react-service
node --experimental-strip-types tests/requirementFormValues.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API and form helpers**

```powershell
git add react-service/src/api/tenantApi.ts react-service/src/components/tenant/requirementFormValues.ts react-service/tests/requirementFormValues.test.ts
git commit -m "feat: add tenant requirement form model"
```

## Task 6: Requirement Form and My Requirements Page

**Files:**
- Create: `react-service/src/components/tenant/TenantRequirementForm.tsx`
- Modify: `react-service/src/pages/MyRequirementsPage.tsx`

- [ ] **Step 1: Add form component**

Create `TenantRequirementForm.tsx` using `DistrictMultiSelect`, `RequirementFormValues`, and existing button/input styling. Required fields:

```ts
type TenantRequirementFormProps = {
  districtOptions: TaiwanDistrictOption[];
  initialValues: RequirementFormValues;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (payload: TenantRequirementPayload) => Promise<void> | void;
  onCancel?: () => void;
};
```

Validation before submit:

```ts
if (form.districts.length === 0) throw new Error("請至少選擇一個行政區。");
if (Number(form.budgetMax || 0) <= 0) throw new Error("請填寫最高租金。");
if (Number(form.budgetMin || 0) > Number(form.budgetMax || 0)) throw new Error("最低租金不可高於最高租金。");
```

- [ ] **Step 2: Rewrite `MyRequirementsPage` state**

Load district options with `getTaiwanDistricts` from `listingApi.ts`, load requirements with `getMyRequirements`, and use `TenantRequirementForm` for create/edit.

Use readable Traditional Chinese labels:

- Page title: `我的租屋需求`
- Create title: `建立租屋需求草稿`
- Edit title: `編輯租屋需求`
- Empty state: `目前還沒有租屋需求。`

- [ ] **Step 3: Preserve status actions**

Keep OPEN/PAUSED/CLOSED actions. Use labels:

```ts
const statusLabel = {
  OPEN: "開放中",
  PAUSED: "暫停",
  CLOSED: "已結案",
} satisfies Record<TenantRequirementStatus, string>;
```

- [ ] **Step 4: Build frontend**

```powershell
Set-Location react-service
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit requirement form page**

```powershell
git add react-service/src/components/tenant/TenantRequirementForm.tsx react-service/src/pages/MyRequirementsPage.tsx
git commit -m "feat: upgrade tenant requirement drafts"
```

## Task 7: Requirement Display Model, List, and Detail

**Files:**
- Create: `react-service/src/components/tenant/tenantRequirementDisplayModel.ts`
- Create: `react-service/tests/tenantRequirementDisplayModel.test.ts`
- Create: `react-service/src/components/tenant/TenantRequirementCard.tsx`
- Create: `react-service/src/components/tenant/TenantRequirementDetailShell.tsx`
- Modify: `react-service/src/pages/RequirementsPage.tsx`
- Modify: `react-service/src/pages/RequirementDetailPage.tsx`
- Create: `react-service/src/components/search/RentalSearchFilters.tsx`

- [ ] **Step 1: Write display model tests**

Create `tenantRequirementDisplayModel.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildTenantRequirementDisplayModel } from "../src/components/tenant/tenantRequirementDisplayModel.ts";

const model = buildTenantRequirementDisplayModel({
  id: 8,
  targetDistrict: "2 counties 2 districts",
  districts: [
    { county: "台北市", district: "大安區", zipCode: "106" },
    { county: "新北市", district: "板橋區", zipCode: "220" },
  ],
  budgetMin: 20000,
  budgetMax: 36000,
  areaMinPing: 12,
  areaMaxPing: 28,
  roomMin: 2,
  bathroomMin: 1,
  minimumLeaseMonths: 12,
  layoutNote: "兩房佳",
  lifestyleNote: "安靜",
  mustHaveNote: "電梯",
  petFriendlyNeeded: true,
  parkingNeeded: false,
  canCookNeeded: true,
  canRegisterHouseholdNeeded: false,
  status: "OPEN",
  hasAdvancedData: false,
  createdAt: "2026-05-03T00:00:00Z",
  updatedAt: "2026-05-03T00:00:00Z",
  match: { score: 86, level: "GOOD", matchedReasons: ["地區符合"], missingReasons: [] },
});

assert.equal(model.statusLabel, "開放中");
assert.equal(model.districtSummary, "2 縣市 2 區");
assert.equal(model.budgetLabel, "NT$ 20,000 - 36,000");
assert.equal(model.matchLabel, "高度符合 86%");
assert.ok(model.conditionChips.includes("需可寵物"));
```

- [ ] **Step 2: Run display test to verify it fails**

```powershell
Set-Location react-service
node --experimental-strip-types tests/tenantRequirementDisplayModel.test.ts
```

Expected: FAIL because display model does not exist.

- [ ] **Step 3: Add display model**

Create `tenantRequirementDisplayModel.ts` with `buildTenantRequirementDisplayModel`. It should format:

- budget label
- area range label
- district summary using districts count
- status labels
- condition chips
- match label and reason lists

- [ ] **Step 4: Add shared rental search filter component**

Create `RentalSearchFilters.tsx` with props:

```ts
type RentalSearchFiltersProps = {
  districtOptions: TaiwanDistrictOption[];
  districts: DistrictSelection[];
  keyword: string;
  budgetMin: string;
  budgetMax: string;
  onDistrictsChange: (next: DistrictSelection[]) => void;
  onKeywordChange: (next: string) => void;
  onBudgetMinChange: (next: string) => void;
  onBudgetMaxChange: (next: string) => void;
  onSearch: () => void;
  searchLabel: string;
};
```

Use `DistrictMultiSelect` and compact inputs. Do not include map controls in this component.

- [ ] **Step 5: Add card and detail shell**

Create `TenantRequirementCard.tsx` and `TenantRequirementDetailShell.tsx` consuming the display model. Use the listing card/detail visual language with cleaner, readable Traditional Chinese copy.

- [ ] **Step 6: Rewrite public requirement pages**

`RequirementsPage.tsx` should:

- load district options
- parse district tokens from query params
- call `getRequirementList`
- render `RentalSearchFilters`
- render `TenantRequirementCard`

`RequirementDetailPage.tsx` should:

- call `getRequirementDetail`
- build display model
- render `TenantRequirementDetailShell`

- [ ] **Step 7: Run frontend tests and build**

```powershell
Set-Location react-service
node --experimental-strip-types tests/tenantRequirementDisplayModel.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit requirement display pages**

```powershell
git add react-service/src/components/tenant/tenantRequirementDisplayModel.ts react-service/tests/tenantRequirementDisplayModel.test.ts react-service/src/components/tenant/TenantRequirementCard.tsx react-service/src/components/tenant/TenantRequirementDetailShell.tsx react-service/src/components/search/RentalSearchFilters.tsx react-service/src/pages/RequirementsPage.tsx react-service/src/pages/RequirementDetailPage.tsx
git commit -m "feat: upgrade tenant requirement browsing"
```

## Task 8: Listing Search Integration

**Files:**
- Modify: `react-service/src/api/listingApi.ts`
- Modify: `react-service/src/components/listing/ListingSearchBar.tsx`
- Modify: `react-service/src/pages/ListingListPage.tsx`
- Modify: `go-service/internal/db/repository/listing_repo.go`
- Modify: `go-service/internal/modules/listing/dto.go`
- Modify: `go-service/internal/modules/listing/service.go`

- [ ] **Step 1: Extend listing filter types**

In frontend `listingApi.ts`, allow `getListings` filters to include district tokens:

```ts
districts?: string[];
```

Encode as repeated query values:

```ts
filters?.districts?.forEach((token) => qs.append("district", token));
```

- [ ] **Step 2: Update `ListingSearchBar`**

Replace the single district popover state with `DistrictMultiSelect` in multi mode for search. Keep the existing single-district compatibility only where the listing create/edit form uses district.

- [ ] **Step 3: Update `ListingListPage` query state**

Parse all `district` query values with `searchParams.getAll("district")`, map them to `DistrictSelection[]` by matching loaded location options, and pass tokens into `getListings`.

- [ ] **Step 4: Extend backend listing filters**

In listing DTO/service/repository, parse repeated `district` query values. Convert tokens into district names and filter listing rows where `district` is in the selected set. Keep existing single `district` query support by treating it as one selected district when no token separator exists.

- [ ] **Step 5: Run listing tests/build**

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./internal/modules/listing ./internal/db/repository -count=1
Set-Location ..\react-service
node --experimental-strip-types tests/districtSelection.test.ts
node --experimental-strip-types tests/listingDistrictOptions.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit listing search integration**

```powershell
git add react-service/src/api/listingApi.ts react-service/src/components/listing/ListingSearchBar.tsx react-service/src/pages/ListingListPage.tsx go-service/internal/db/repository/listing_repo.go go-service/internal/modules/listing/dto.go go-service/internal/modules/listing/service.go
git commit -m "feat: support multi-district listing search"
```

## Task 9: Seed Data and Final Verification

**Files:**
- Modify: `infra/init/12-demo-listings.sql`
- Create: `infra/init/14-demo-tenant-requirements.sql`

- [ ] **Step 1: Complete rental listing seed criteria**

Ensure the two rental rows in `infra/init/12-demo-listings.sql` have complete comparable `listing_rent_details`:

```sql
INSERT INTO listing_rent_details (
    listing_id,
    monthly_rent,
    deposit_months,
    management_fee_monthly,
    minimum_lease_months,
    can_register_household,
    can_cook,
    rent_notes
) VALUES
    ((SELECT id FROM listings WHERE title = '信義安和採光兩房'), 32000, 2, 1800, 12, TRUE, TRUE, '可寵物需另簽清潔條款。'),
    ((SELECT id FROM listings WHERE title = '中山捷運小資套房'), 18000, 2, 900, 6, FALSE, FALSE, '適合通勤族，禁菸。')
ON CONFLICT (listing_id) DO UPDATE SET
    monthly_rent = EXCLUDED.monthly_rent,
    deposit_months = EXCLUDED.deposit_months,
    management_fee_monthly = EXCLUDED.management_fee_monthly,
    minimum_lease_months = EXCLUDED.minimum_lease_months,
    can_register_household = EXCLUDED.can_register_household,
    can_cook = EXCLUDED.can_cook,
    rent_notes = EXCLUDED.rent_notes,
    updated_at = NOW();
```

- [ ] **Step 2: Add tenant requirement seeds**

Create `infra/init/14-demo-tenant-requirements.sql` with three requirements:

- Good match for 信義安和採光兩房.
- Partial match for 中山捷運小資套房.
- Low match that intentionally misses budget or required pet/cooking.

Use `ON CONFLICT`-safe inserts by deterministic `layout_note` or a CTE selecting existing demo tenant users. If there is no existing tenant user, insert requirements only when a tenant credential user exists:

```sql
WITH tenant_user AS (
    SELECT u.id
    FROM users u
    JOIN user_credentials uc ON uc.user_id = u.id AND uc.credential_type = 'TENANT'
    ORDER BY u.id
    LIMIT 1
)
INSERT INTO tenant_requirements (
    user_id, target_district, budget_min, budget_max, layout_note,
    pet_friendly_needed, parking_needed, area_min_ping, area_max_ping,
    room_min, bathroom_min, minimum_lease_months, can_cook_needed,
    can_register_household_needed, lifestyle_note, must_have_note, status
)
SELECT id, '台北市 2 districts', 25000, 36000, '希望兩房、採光好、近捷運。',
       TRUE, FALSE, 12, 28, 2, 1, 12, TRUE, TRUE,
       '兩人入住，生活單純。', '可開伙與可設籍優先。', 'OPEN'
FROM tenant_user
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_requirements WHERE layout_note = '希望兩房、採光好、近捷運。'
);
```

After each insert, insert district rows with `INSERT ... SELECT requirement.id, county, district, zip_code`.

- [ ] **Step 3: Run full backend tests**

```powershell
Set-Location go-service
$env:GOCACHE='D:\Git\onchain-project\go-service\.gocache'
go test ./...
```

Expected: PASS.

- [ ] **Step 4: Run frontend tests and build**

```powershell
Set-Location react-service
node --experimental-strip-types tests/districtSelection.test.ts
node --experimental-strip-types tests/listingDistrictOptions.test.ts
node --experimental-strip-types tests/requirementFormValues.test.ts
node --experimental-strip-types tests/tenantRequirementDisplayModel.test.ts
npm run build
```

Expected: PASS. Vite chunk size warnings are acceptable if the build exits successfully.

- [ ] **Step 5: Optional local DB seed apply**

If the local Postgres container is running and the user wants the demo data live immediately, apply:

```powershell
docker cp infra/init/13-tenant-requirement-matching.sql onchain-postgres:/tmp/13-tenant-requirement-matching.sql
docker exec onchain-postgres psql -U postgres -d LAND -f /tmp/13-tenant-requirement-matching.sql
docker cp infra/init/14-demo-tenant-requirements.sql onchain-postgres:/tmp/14-demo-tenant-requirements.sql
docker exec onchain-postgres psql -U postgres -d LAND -f /tmp/14-demo-tenant-requirements.sql
```

Expected: SQL applies without errors. This step may need escalation because it writes to Docker.

- [ ] **Step 6: Commit seed and final verification**

```powershell
git add infra/init/12-demo-listings.sql infra/init/14-demo-tenant-requirements.sql
git commit -m "test: seed rental matching data"
```

## Self-Review Checklist

- Spec coverage: The plan covers schema, structured requirement districts, rental criteria, shared district selection, listing/requirement search, requirement forms, list/detail pages, match scoring, seeds, and verification.
- Out-of-scope preserved: Buy-side demand, map integration, full recommendation feeds, saved searches, and notification workflows are not implemented here.
- Type consistency: District request uses `{ county, district, zipCode }`; frontend internal selection uses `{ county, district, postalCode }`; token encoding is `county:district:postalCode`.
- Testing path: Backend domain/schema tests come before implementation, frontend helper/display tests come before component/page rewrites, and final verification runs both backend and frontend commands.
