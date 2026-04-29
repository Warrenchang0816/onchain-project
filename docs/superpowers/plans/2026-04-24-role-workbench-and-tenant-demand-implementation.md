# Role Workbench And Tenant Demand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the identity center into a real role workbench by adding OWNER bootstrap drafts, TENANT lightweight credential + advanced profile + demand listings, and AGENT profile/workbench entry points, while keeping public/publicly-hidden data boundaries honest.

**Architecture:** Reuse the live `listings` mainline for OWNER bootstrap drafts instead of inventing a half-property system before Gate 2. Add a new `tenant` module for tenant profile/documents/requirements, extend the existing `agent` module with profile data, and keep role activation in the `credential` module by injecting a narrow owner-draft bootstrap interface. On the frontend, extend the existing pages and APIs with role-specific workbench pages, guarded routes, and Traditional Chinese copy on all touched surfaces.

**Tech Stack:** Go 1.25, Gin, `database/sql`, PostgreSQL migrations in `infra/init`, React 19, TypeScript 5 strict mode, React Router v7, Tailwind utility classes, native `fetch`. No ORM, no new npm packages, no frontend test framework beyond `npm run lint` and `npm run build`.

---

## Scope Check

This spec is broad, but the pieces are still one connected vertical slice:

- OWNER activation must create a listing bootstrap draft
- TENANT workbench depends on a new tenant backend module
- AGENT public/workbench profile depends on extending the existing agent module
- Identity center, header, and routes tie the three roles together

`favorites`, full-site translation cleanup, and full visual polish remain intentionally out of scope and are not included in this plan.

---

## File Map

### New files

| File | Purpose |
|---|---|
| `infra/init/09-role-workbench.sql` | Adds listing draft metadata fields and the new tenant/agent tables |
| `go-service/internal/db/model/tenant_profile_model.go` | Tenant profile and document model structs |
| `go-service/internal/db/model/tenant_requirement_model.go` | Tenant requirement model struct |
| `go-service/internal/db/model/agent_profile_model.go` | Agent public profile model struct |
| `go-service/internal/db/repository/tenant_profile_repo.go` | Tenant profile/document SQL |
| `go-service/internal/db/repository/tenant_requirement_repo.go` | Tenant requirement SQL |
| `go-service/internal/db/repository/agent_profile_repo.go` | Agent profile SQL |
| `go-service/internal/modules/listing/domain.go` | Pure helpers for bootstrap/publish rules |
| `go-service/internal/modules/listing/domain_test.go` | Tests for listing draft/publish rules |
| `go-service/internal/modules/tenant/domain.go` | Pure helpers for advanced-data calculation and viewer rules |
| `go-service/internal/modules/tenant/domain_test.go` | Tests for tenant advanced-data rules |
| `go-service/internal/modules/tenant/dto.go` | Tenant API request/response shapes |
| `go-service/internal/modules/tenant/service.go` | Tenant business logic |
| `go-service/internal/modules/tenant/handler.go` | Tenant HTTP handlers |
| `react-service/src/api/tenantApi.ts` | Tenant profile + requirement API client |
| `react-service/src/pages/MyListingsPage.tsx` | Private OWNER listing/workbench page |
| `react-service/src/pages/TenantProfilePage.tsx` | Tenant advanced-data management page |
| `react-service/src/pages/MyRequirementsPage.tsx` | Tenant-owned requirement list page |
| `react-service/src/pages/RequirementsPage.tsx` | OWNER/AGENT demand list page |
| `react-service/src/pages/RequirementDetailPage.tsx` | OWNER/AGENT demand detail page |
| `react-service/src/pages/MyAgentProfilePage.tsx` | AGENT private profile/workbench page |

### Modified files

| File | Change |
|---|---|
| `go-service/internal/db/model/listing_model.go` | Add draft origin/setup fields and `UNSET` list type |
| `go-service/internal/db/repository/listing_repo.go` | Persist/read bootstrap draft metadata and add owner-count/bootstrap helpers |
| `go-service/internal/modules/listing/dto.go` | Expose `draft_origin` and `setup_status` |
| `go-service/internal/modules/listing/service.go` | Add bootstrap draft flow and publish gating |
| `go-service/internal/modules/listing/handler.go` | Include new fields in listing responses |
| `go-service/internal/modules/credential/dto.go` | Allow tenant lightweight route detail |
| `go-service/internal/modules/credential/domain.go` | Add `PROFILE` route normalization + tenant payload validation |
| `go-service/internal/modules/credential/domain_test.go` | Add tenant lightweight-route tests |
| `go-service/internal/modules/credential/service.go` | Short-circuit TENANT submissions and call OWNER draft bootstrap on activation |
| `go-service/internal/modules/agent/dto.go` | Add public profile/workbench response types |
| `go-service/internal/modules/agent/service.go` | Read/write `agent_profiles` and support public filters |
| `go-service/internal/modules/agent/handler.go` | Handle query filters and private profile endpoints |
| `go-service/internal/modules/agent/service_test.go` | Add profile/filter mapping tests |
| `go-service/internal/bootstrap/router.go` | Register tenant endpoints, new private agent endpoints, and requirements endpoints |
| `go-service/internal/bootstrap/wiring.go` | Wire new repos/modules and inject owner-draft bootstrapper into credential service |
| `react-service/src/api/credentialApi.ts` | Add `PROFILE` route and tenant-lightweight detail handling |
| `react-service/src/api/listingApi.ts` | Add `UNSET` list type and draft/setup metadata |
| `react-service/src/api/agentApi.ts` | Add profile completeness fields, filters, and private agent profile endpoints |
| `react-service/src/router/index.tsx` | Add workbench/requirements/profile routes |
| `react-service/src/components/common/Header.tsx` | Show guarded `租屋需求列表` link and Chinese menu copy |
| `react-service/src/pages/IdentityCenterPage.tsx` | Render role workbench cards and summary fetches |
| `react-service/src/pages/TenantCredentialPage.tsx` | Replace file/OCR flow with lightweight form + activation flow |
| `react-service/src/pages/ListingCreatePage.tsx` | Chinese copy and incomplete-draft-friendly entry wording |
| `react-service/src/components/listing/ListingEditorForm.tsx` | Support `UNSET`, Chinese labels, incomplete draft save semantics |
| `react-service/src/components/listing/listingEditorValues.ts` | Add `UNSET` support/defaults |
| `react-service/src/pages/ListingListPage.tsx` | Chinese copy and owner workbench navigation hook-up |
| `react-service/src/pages/ListingDetailPage.tsx` | Surface `INCOMPLETE/READY` status and edit flow for bootstrap drafts |
| `react-service/src/pages/AgentListPage.tsx` | Add public filters and Chinese copy cleanup |
| `react-service/src/pages/AgentDetailPage.tsx` | Render profile bio/service areas and owner/private workbench link |
| `docs/database/relational-database-spec.md` | Update live schema documentation |
| `docs/database/relational-database-spec.csv` | Update CSV schema mirror |
| `dev_log/2026-04-24.md` | Record the implementation checkpoint |

---

### Task 1: Schema Foundation For Role Workbench Data

**Files:**
- Create: `infra/init/09-role-workbench.sql`
- Create: `go-service/internal/db/model/tenant_profile_model.go`
- Create: `go-service/internal/db/model/tenant_requirement_model.go`
- Create: `go-service/internal/db/model/agent_profile_model.go`
- Modify: `go-service/internal/db/model/listing_model.go`

- [ ] **Step 1: Create `infra/init/09-role-workbench.sql`**

```sql
-- Phase 3：role workbench foundation
-- Adds OWNER bootstrap-draft metadata plus TENANT / AGENT profile tables.

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS draft_origin VARCHAR(20) NOT NULL DEFAULT 'MANUAL_CREATE',
    ADD COLUMN IF NOT EXISTS setup_status VARCHAR(20) NOT NULL DEFAULT 'READY',
    ADD COLUMN IF NOT EXISTS source_credential_submission_id BIGINT REFERENCES credential_submissions(id);

ALTER TABLE listings
    DROP CONSTRAINT IF EXISTS listings_list_type_check;

ALTER TABLE listings
    ADD CONSTRAINT listings_list_type_check
    CHECK (list_type IN ('UNSET', 'RENT', 'SALE'));

ALTER TABLE listings
    ALTER COLUMN list_type SET DEFAULT 'UNSET';

CREATE INDEX IF NOT EXISTS idx_listings_source_credential_submission_id
    ON listings (source_credential_submission_id);

CREATE TABLE IF NOT EXISTS tenant_profiles (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT      NOT NULL UNIQUE REFERENCES users(id),
    occupation_type      VARCHAR(50) NOT NULL DEFAULT '',
    org_name             VARCHAR(120) NOT NULL DEFAULT '',
    income_range         VARCHAR(50) NOT NULL DEFAULT '',
    household_size       INT         NOT NULL DEFAULT 0,
    co_resident_note     TEXT        NOT NULL DEFAULT '',
    move_in_timeline     VARCHAR(80) NOT NULL DEFAULT '',
    additional_note      TEXT        NOT NULL DEFAULT '',
    advanced_data_status VARCHAR(20) NOT NULL DEFAULT 'BASIC',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_profile_documents (
    id                BIGSERIAL PRIMARY KEY,
    tenant_profile_id BIGINT      NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
    doc_type          VARCHAR(30) NOT NULL,
    file_path         VARCHAR(512) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_profile_documents_profile_id
    ON tenant_profile_documents (tenant_profile_id);

CREATE TABLE IF NOT EXISTS tenant_requirements (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT          NOT NULL REFERENCES users(id),
    target_district      VARCHAR(80)     NOT NULL DEFAULT '',
    budget_min           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    budget_max           NUMERIC(14,2)   NOT NULL DEFAULT 0,
    layout_note          TEXT            NOT NULL DEFAULT '',
    move_in_date         DATE,
    pet_friendly_needed  BOOLEAN         NOT NULL DEFAULT FALSE,
    parking_needed       BOOLEAN         NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)     NOT NULL DEFAULT 'OPEN',
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_user_id
    ON tenant_requirements (user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_status
    ON tenant_requirements (status);

CREATE INDEX IF NOT EXISTS idx_tenant_requirements_target_district
    ON tenant_requirements (target_district);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT          NOT NULL UNIQUE REFERENCES users(id),
    headline            VARCHAR(160)    NOT NULL DEFAULT '',
    bio                 TEXT            NOT NULL DEFAULT '',
    service_areas_json  JSONB           NOT NULL DEFAULT '[]'::jsonb,
    license_note        TEXT            NOT NULL DEFAULT '',
    contact_preferences TEXT            NOT NULL DEFAULT '',
    is_profile_complete BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Update `go-service/internal/db/model/listing_model.go` and create the three new model files**

```go
// go-service/internal/db/model/listing_model.go
const (
	ListingStatusDraft       = "DRAFT"
	ListingStatusActive      = "ACTIVE"
	ListingStatusNegotiating = "NEGOTIATING"
	ListingStatusLocked      = "LOCKED"
	ListingStatusSigning     = "SIGNING"
	ListingStatusClosed      = "CLOSED"
	ListingStatusExpired     = "EXPIRED"
	ListingStatusRemoved     = "REMOVED"
	ListingStatusSuspended   = "SUSPENDED"

	ListingTypeUnset = "UNSET"
	ListingTypeRent  = "RENT"
	ListingTypeSale  = "SALE"

	ListingDraftOriginManualCreate    = "MANUAL_CREATE"
	ListingDraftOriginOwnerActivation = "OWNER_ACTIVATION"

	ListingSetupStatusIncomplete = "INCOMPLETE"
	ListingSetupStatusReady      = "READY"
)

type Listing struct {
	ID          int64
	OwnerUserID int64

	Title       string
	Description sql.NullString
	Address     string
	District    sql.NullString

	ListType          string
	Price             float64
	AreaPing          sql.NullFloat64
	Floor             sql.NullInt64
	TotalFloors       sql.NullInt64
	RoomCount         sql.NullInt64
	BathroomCount     sql.NullInt64
	IsPetAllowed      bool
	IsParkingIncluded bool

	Status                   string
	DraftOrigin              string
	SetupStatus              string
	SourceCredentialSubmissionID sql.NullInt64
	NegotiatingAppointmentID sql.NullInt64

	DailyFeeNTD float64
	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
```

```go
// go-service/internal/db/model/tenant_profile_model.go
package model

import "time"

const (
	TenantAdvancedDataBasic    = "BASIC"
	TenantAdvancedDataAdvanced = "ADVANCED"

	TenantDocTypeIncomeProof = "INCOME_PROOF"
	TenantDocTypeHousehold   = "HOUSEHOLD_DOC"
	TenantDocTypeOther       = "OTHER"
)

type TenantProfile struct {
	ID                 int64
	UserID             int64
	OccupationType     string
	OrgName            string
	IncomeRange        string
	HouseholdSize      int
	CoResidentNote     string
	MoveInTimeline     string
	AdditionalNote     string
	AdvancedDataStatus string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type TenantProfileDocument struct {
	ID              int64
	TenantProfileID int64
	DocType         string
	FilePath        string
	CreatedAt       time.Time
}
```

```go
// go-service/internal/db/model/tenant_requirement_model.go
package model

import (
	"database/sql"
	"time"
)

const (
	TenantRequirementOpen   = "OPEN"
	TenantRequirementPaused = "PAUSED"
	TenantRequirementClosed = "CLOSED"
)

type TenantRequirement struct {
	ID                 int64
	UserID             int64
	TargetDistrict     string
	BudgetMin          float64
	BudgetMax          float64
	LayoutNote         string
	MoveInDate         sql.NullTime
	PetFriendlyNeeded  bool
	ParkingNeeded      bool
	Status             string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
```

```go
// go-service/internal/db/model/agent_profile_model.go
package model

import (
	"database/sql"
	"time"
)

type AgentProfile struct {
	ID                 int64
	UserID             int64
	Headline           string
	Bio                string
	ServiceAreasJSON   string
	LicenseNote        string
	ContactPreferences string
	IsProfileComplete  bool
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type AgentProfileRow struct {
	Profile *AgentProfile
	Wallet  string
	Name    sql.NullString
}
```

- [ ] **Step 3: Build the backend once so later repository changes start from a clean baseline**

Run: `go build ./...`  
Working directory: `go-service`  
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add infra/init/09-role-workbench.sql \
  go-service/internal/db/model/listing_model.go \
  go-service/internal/db/model/tenant_profile_model.go \
  go-service/internal/db/model/tenant_requirement_model.go \
  go-service/internal/db/model/agent_profile_model.go
git commit -m "feat: add role workbench schema foundation"
```

---

### Task 2: OWNER Bootstrap Draft Logic In Listing Module

**Files:**
- Create: `go-service/internal/modules/listing/domain.go`
- Create: `go-service/internal/modules/listing/domain_test.go`
- Modify: `go-service/internal/db/repository/listing_repo.go`
- Modify: `go-service/internal/modules/listing/dto.go`
- Modify: `go-service/internal/modules/listing/service.go`
- Modify: `go-service/internal/modules/listing/handler.go`

- [ ] **Step 1: Write failing tests for bootstrap and publish readiness**

```go
// go-service/internal/modules/listing/domain_test.go
package listing

import (
	"testing"

	"go-service/internal/db/model"
)

func TestShouldBootstrapOwnerDraft(t *testing.T) {
	tests := []struct {
		name         string
		existing     int
		hasSource    bool
		wantBootstrap bool
	}{
		{name: "first owner listing bootstraps", existing: 0, hasSource: false, wantBootstrap: true},
		{name: "existing listings skip bootstrap", existing: 1, hasSource: false, wantBootstrap: false},
		{name: "existing source draft skips bootstrap", existing: 0, hasSource: true, wantBootstrap: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ShouldBootstrapOwnerDraft(tt.existing, tt.hasSource)
			if got != tt.wantBootstrap {
				t.Fatalf("ShouldBootstrapOwnerDraft(%d, %v) = %v, want %v", tt.existing, tt.hasSource, got, tt.wantBootstrap)
			}
		})
	}
}

func TestIsReadyForPublish(t *testing.T) {
	ready := &model.Listing{
		Title:         "民生社區兩房",
		Address:       "台北市松山區民生東路四段 100 號",
		ListType:      model.ListingTypeRent,
		Price:         36000,
		Status:        model.ListingStatusDraft,
		SetupStatus:   model.ListingSetupStatusReady,
		AreaPing:      nullFloat(21.5),
		RoomCount:     nullInt(2),
		BathroomCount: nullInt(1),
	}
	if !IsReadyForPublish(ready) {
		t.Fatal("expected ready listing to be publishable")
	}

	incomplete := &model.Listing{
		Title:       "",
		Address:     "台北市松山區民生東路四段 100 號",
		ListType:    model.ListingTypeUnset,
		Price:       0,
		Status:      model.ListingStatusDraft,
		SetupStatus: model.ListingSetupStatusIncomplete,
	}
	if IsReadyForPublish(incomplete) {
		t.Fatal("expected incomplete bootstrap draft to be blocked from publish")
	}
}

func nullFloat(v float64) sql.NullFloat64 { return sql.NullFloat64{Float64: v, Valid: true} }
func nullInt(v int64) sql.NullInt64 { return sql.NullInt64{Int64: v, Valid: true} }
```

- [ ] **Step 2: Run the listing tests and confirm they fail**

Run: `go test ./internal/modules/listing -run "TestShouldBootstrapOwnerDraft|TestIsReadyForPublish" -v`  
Working directory: `go-service`  
Expected: FAIL because `ShouldBootstrapOwnerDraft` and `IsReadyForPublish` do not exist yet

- [ ] **Step 3: Implement pure listing helpers**

```go
// go-service/internal/modules/listing/domain.go
package listing

import (
	"strings"

	"go-service/internal/db/model"
)

func ShouldBootstrapOwnerDraft(existingOwnerListings int, hasSourceDraft bool) bool {
	return existingOwnerListings == 0 && !hasSourceDraft
}

func IsReadyForPublish(l *model.Listing) bool {
	if l == nil {
		return false
	}
	if l.Status != model.ListingStatusDraft {
		return false
	}
	if l.SetupStatus != model.ListingSetupStatusReady {
		return false
	}
	if strings.TrimSpace(l.Title) == "" || strings.TrimSpace(l.Address) == "" {
		return false
	}
	if l.ListType != model.ListingTypeRent && l.ListType != model.ListingTypeSale {
		return false
	}
	if l.Price <= 0 {
		return false
	}
	if !l.AreaPing.Valid || !l.RoomCount.Valid || !l.BathroomCount.Valid {
		return false
	}
	return true
}
```

- [ ] **Step 4: Extend the repository, DTO, and service for bootstrap drafts**

```go
// go-service/internal/db/repository/listing_repo.go
const listingSelectCols = `
	SELECT id, owner_user_id,
	       title, description, address, district,
	       list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
	       is_pet_allowed, is_parking_included,
	       status, draft_origin, setup_status, source_credential_submission_id, negotiating_appointment_id,
	       daily_fee_ntd,
	       published_at, expires_at, created_at, updated_at
	FROM listings`

func (r *ListingRepository) CountByOwner(ownerUserID int64) (int, error) {
	var count int
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM listings WHERE owner_user_id = $1`, ownerUserID).Scan(&count); err != nil {
		return 0, fmt.Errorf("listing_repo: CountByOwner: %w", err)
	}
	return count, nil
}

func (r *ListingRepository) FindBySourceCredentialSubmission(submissionID int64) (*model.Listing, error) {
	row := r.db.QueryRow(listingSelectCols+` WHERE source_credential_submission_id = $1 LIMIT 1`, submissionID)
	l, err := scanListing(row)
	if err != nil {
		return nil, fmt.Errorf("listing_repo: FindBySourceCredentialSubmission: %w", err)
	}
	return l, nil
}

func (r *ListingRepository) CreateBootstrapDraft(ownerUserID, submissionID int64, address string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listings (
			owner_user_id, title, description, address, district,
			list_type, price, area_ping, floor, total_floors, room_count, bathroom_count,
			is_pet_allowed, is_parking_included,
			status, draft_origin, setup_status, source_credential_submission_id, daily_fee_ntd
		) VALUES ($1,'','',$2,NULL,'UNSET',0,NULL,NULL,NULL,NULL,NULL,FALSE,FALSE,'DRAFT','OWNER_ACTIVATION','INCOMPLETE',$3,$4)
		RETURNING id`,
		ownerUserID, address, submissionID, defaultDailyFeeNTD,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("listing_repo: CreateBootstrapDraft: %w", err)
	}
	return id, nil
}
```

```go
// go-service/internal/modules/listing/dto.go
type ListingResponse struct {
	ID          int64 `json:"id"`
	OwnerUserID int64 `json:"owner_user_id"`
	Title       string `json:"title"`
	// ...
	Status                 string `json:"status"`
	DraftOrigin            string `json:"draft_origin"`
	SetupStatus            string `json:"setup_status"`
	NegotiatingAppointment *AppointmentResponse `json:"negotiating_appointment,omitempty"`
	// ...
}
```

```go
// go-service/internal/modules/listing/service.go
func (s *Service) BootstrapOwnerActivationDraft(ownerUserID, submissionID int64, propertyAddress string) error {
	existingCount, err := s.listingRepo.CountByOwner(ownerUserID)
	if err != nil {
		return fmt.Errorf("listing: count owner listings: %w", err)
	}
	sourceDraft, err := s.listingRepo.FindBySourceCredentialSubmission(submissionID)
	if err != nil {
		return fmt.Errorf("listing: find bootstrap draft: %w", err)
	}
	if !ShouldBootstrapOwnerDraft(existingCount, sourceDraft != nil) {
		return nil
	}
	if strings.TrimSpace(propertyAddress) == "" {
		return nil
	}
	_, err = s.listingRepo.CreateBootstrapDraft(ownerUserID, submissionID, strings.TrimSpace(propertyAddress))
	return err
}

func (s *Service) Publish(listingID int64, walletAddress string, durationDays int) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}
	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: Publish: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if !IsReadyForPublish(l) {
		return ErrInvalidStatus
	}
	if durationDays < minDurationDays {
		return ErrDurationTooShort
	}
	return s.listingRepo.Publish(listingID, durationDays)
}
```

```go
// go-service/internal/modules/listing/handler.go
resp.Status = l.Status
resp.DraftOrigin = l.DraftOrigin
resp.SetupStatus = l.SetupStatus
```

- [ ] **Step 5: Re-run listing tests and compile**

Run: `go test ./internal/modules/listing -run "TestShouldBootstrapOwnerDraft|TestIsReadyForPublish" -v`  
Expected: PASS

Run: `go build ./...`  
Working directory: `go-service`  
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/db/repository/listing_repo.go \
  go-service/internal/modules/listing/domain.go \
  go-service/internal/modules/listing/domain_test.go \
  go-service/internal/modules/listing/dto.go \
  go-service/internal/modules/listing/service.go \
  go-service/internal/modules/listing/handler.go
git commit -m "feat: add owner bootstrap draft logic to listings"
```

---

### Task 3: Credential Flow Updates For OWNER Bootstrap And TENANT Lightweight Activation

**Files:**
- Modify: `go-service/internal/modules/credential/dto.go`
- Modify: `go-service/internal/modules/credential/domain.go`
- Modify: `go-service/internal/modules/credential/domain_test.go`
- Modify: `go-service/internal/modules/credential/service.go`
- Modify: `go-service/internal/bootstrap/wiring.go`
- Modify: `react-service/src/api/credentialApi.ts`

- [ ] **Step 1: Add failing tests for the new tenant route and payload validation**

```go
// go-service/internal/modules/credential/domain_test.go
func TestNormalizeReviewRouteProfile(t *testing.T) {
	got, err := normalizeReviewRoute("profile")
	if err != nil {
		t.Fatalf("normalizeReviewRoute returned error: %v", err)
	}
	if got != ReviewRouteProfile {
		t.Fatalf("normalizeReviewRoute(profile) = %q, want %q", got, ReviewRouteProfile)
	}
}

func TestValidateTenantProfilePayload(t *testing.T) {
	valid := map[string]string{
		"holderName":     "王小美",
		"occupationType": "上班族",
		"orgName":        "測試公司",
		"incomeRange":    "40k-60k",
	}
	if err := ValidateTenantProfilePayload(valid); err != nil {
		t.Fatalf("ValidateTenantProfilePayload(valid) returned error: %v", err)
	}

	invalid := map[string]string{
		"holderName":     "王小美",
		"occupationType": "",
		"orgName":        "測試公司",
		"incomeRange":    "",
	}
	if err := ValidateTenantProfilePayload(invalid); err == nil {
		t.Fatal("expected missing lightweight tenant fields to fail validation")
	}
}
```

- [ ] **Step 2: Run the credential domain tests and confirm they fail**

Run: `go test ./internal/modules/credential -run "TestNormalizeReviewRouteProfile|TestValidateTenantProfilePayload" -v`  
Working directory: `go-service`  
Expected: FAIL because `ReviewRouteProfile` and `ValidateTenantProfilePayload` do not exist yet

- [ ] **Step 3: Implement the new route constant, tenant validation, and owner bootstrap injection**

```go
// go-service/internal/modules/credential/domain.go
const (
	ReviewRouteSmart   = "SMART"
	ReviewRouteManual  = "MANUAL"
	ReviewRouteProfile = "PROFILE"
)

func normalizeReviewRoute(raw string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case ReviewRouteSmart:
		return ReviewRouteSmart, nil
	case ReviewRouteManual:
		return ReviewRouteManual, nil
	case ReviewRouteProfile:
		return ReviewRouteProfile, nil
	default:
		return "", fmt.Errorf("invalid review route %q", raw)
	}
}

func ValidateTenantProfilePayload(form map[string]string) error {
	required := []string{"holderName", "occupationType", "orgName", "incomeRange"}
	for _, key := range required {
		if strings.TrimSpace(form[key]) == "" {
			return fmt.Errorf("tenant profile field %q is required", key)
		}
	}
	return nil
}
```

```go
// go-service/internal/modules/credential/service.go
type OwnerDraftBootstrapper interface {
	BootstrapOwnerActivationDraft(ownerUserID, submissionID int64, propertyAddress string) error
}

type Service struct {
	userRepo            *repository.UserRepository
	submissionRepo      *repository.CredentialSubmissionRepository
	credentialRepo      *repository.UserCredentialRepository
	identitySvc         usermod.IdentityContractService
	storageSvc          *storage.Client
	visionClient        *ocr.VisionClient
	chainSyncer         ChainSyncer
	ownerDraftBootstrap OwnerDraftBootstrapper
}

func NewService(
	userRepo *repository.UserRepository,
	submissionRepo *repository.CredentialSubmissionRepository,
	credentialRepo *repository.UserCredentialRepository,
	identitySvc usermod.IdentityContractService,
	storageSvc *storage.Client,
	visionClient *ocr.VisionClient,
	chainSyncer ChainSyncer,
	ownerDraftBootstrap OwnerDraftBootstrapper,
) *Service {
	return &Service{
		userRepo:            userRepo,
		submissionRepo:      submissionRepo,
		credentialRepo:      credentialRepo,
		identitySvc:         identitySvc,
		storageSvc:          storageSvc,
		visionClient:        visionClient,
		chainSyncer:         chainSyncer,
		ownerDraftBootstrap: ownerDraftBootstrap,
	}
}
```

```go
// go-service/internal/modules/credential/service.go
func (s *Service) CreateSubmission(ctx context.Context, wallet, credentialType string, req CreateSubmissionRequest) (*CreateSubmissionResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	normalizedType, err := NormalizeType(credentialType)
	if err != nil {
		return nil, err
	}
	route, err := normalizeReviewRoute(req.Route)
	if err != nil {
		return nil, err
	}

	// existing active/latest submission guards stay as-is

	formPayloadJSON, err := encodeFormPayload(req.FormPayload)
	if err != nil {
		return nil, err
	}
	submissionID, err := s.submissionRepo.Create(user.ID, normalizedType, route, formPayloadJSON, strings.TrimSpace(req.Notes))
	if err != nil {
		return nil, err
	}

	if normalizedType == CredentialTypeTenant && route == ReviewRouteProfile {
		if err := ValidateTenantProfilePayload(req.FormPayload); err != nil {
			return nil, err
		}
		if err := s.submissionRepo.SaveDecision(
			submissionID,
			CredentialReviewPassed,
			ActivationStatusReady,
			"",
			"",
			"{}",
			"已建立租客身分資料，可自行決定是否啟用租客 NFT",
		); err != nil {
			return nil, err
		}
	}

	return &CreateSubmissionResponse{SubmissionID: submissionID}, nil
}
```

```go
// go-service/internal/modules/credential/service.go
func (s *Service) ActivateSubmission(ctx context.Context, wallet, credentialType string, submissionID int64) error {
	// existing activation flow stays the same up through persistActivatedCredential(...)
	if err := s.persistActivatedCredential(user.ID, wallet, sub, activeCredential, int32(tokenID), txHash); err != nil {
		// existing sync/error handling
	}

	if sub.CredentialType == CredentialTypeOwner && s.ownerDraftBootstrap != nil {
		formPayload, decodeErr := decodeFormPayload(sub.FormPayloadJSON)
		if decodeErr != nil {
			return decodeErr
		}
		propertyAddress := strings.TrimSpace(formPayload["propertyAddress"])
		if err := s.ownerDraftBootstrap.BootstrapOwnerActivationDraft(user.ID, sub.ID, propertyAddress); err != nil {
			return fmt.Errorf("bootstrap owner draft: %w", err)
		}
	}

	if s.chainSyncer != nil {
		_ = s.chainSyncer.SyncAll(ctx)
	}
	return nil
}
```

```go
// react-service/src/api/credentialApi.ts
export type CredentialReviewRoute = "SMART" | "MANUAL" | "PROFILE";
```

- [ ] **Step 4: Wire the listing service into credential service**

```go
// go-service/internal/bootstrap/wiring.go
listingSvc := listingmod.NewService(listingRepo, apptRepo, userRepo)
listingHandler := listingmod.NewHandler(listingSvc)

credentialSvc := credentialmod.NewService(
	userRepo,
	credentialSubmissionRepo,
	credentialRepo,
	identityContractSvc,
	minioClient,
	visionClient,
	chainSyncer,
	listingSvc,
)
credentialHandler := credentialmod.NewHandler(credentialSvc)
```

- [ ] **Step 5: Run the credential tests and a full backend build**

Run: `go test ./internal/modules/credential -run "TestNormalizeReviewRouteProfile|TestValidateTenantProfilePayload" -v`  
Expected: PASS

Run: `go build ./...`  
Working directory: `go-service`  
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/modules/credential/dto.go \
  go-service/internal/modules/credential/domain.go \
  go-service/internal/modules/credential/domain_test.go \
  go-service/internal/modules/credential/service.go \
  go-service/internal/bootstrap/wiring.go \
  react-service/src/api/credentialApi.ts
git commit -m "feat: add owner draft bootstrap and tenant lightweight credential flow"
```

---

### Task 4: Tenant Backend Module (Profile, Documents, Requirements, Viewer Gating)

**Files:**
- Create: `go-service/internal/db/repository/tenant_profile_repo.go`
- Create: `go-service/internal/db/repository/tenant_requirement_repo.go`
- Create: `go-service/internal/modules/tenant/domain.go`
- Create: `go-service/internal/modules/tenant/domain_test.go`
- Create: `go-service/internal/modules/tenant/dto.go`
- Create: `go-service/internal/modules/tenant/service.go`
- Create: `go-service/internal/modules/tenant/handler.go`
- Modify: `go-service/internal/bootstrap/router.go`
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1: Write the failing tests for `已提供進階資料`**

```go
// go-service/internal/modules/tenant/domain_test.go
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
```

- [ ] **Step 2: Run the tenant tests and confirm they fail**

Run: `go test ./internal/modules/tenant -run "TestHasAdvancedData" -v`  
Working directory: `go-service`  
Expected: FAIL because the tenant module does not exist yet

- [ ] **Step 3: Create the tenant domain helpers and repositories**

```go
// go-service/internal/modules/tenant/domain.go
package tenant

import (
	"strings"

	"go-service/internal/db/model"
)

func HasAdvancedData(profile *model.TenantProfile, docs []*model.TenantProfileDocument) bool {
	if profile == nil {
		return false
	}
	if strings.TrimSpace(profile.OccupationType) == "" ||
		strings.TrimSpace(profile.OrgName) == "" ||
		strings.TrimSpace(profile.IncomeRange) == "" {
		return false
	}

	hasDisclosure := profile.HouseholdSize > 0 ||
		strings.TrimSpace(profile.CoResidentNote) != "" ||
		strings.TrimSpace(profile.MoveInTimeline) != "" ||
		strings.TrimSpace(profile.AdditionalNote) != ""
	if !hasDisclosure {
		return false
	}

	for _, doc := range docs {
		if doc.DocType == model.TenantDocTypeIncomeProof || doc.DocType == model.TenantDocTypeHousehold || doc.DocType == model.TenantDocTypeOther {
			return true
		}
	}
	return false
}

func DeriveAdvancedDataStatus(profile *model.TenantProfile, docs []*model.TenantProfileDocument) string {
	if HasAdvancedData(profile, docs) {
		return model.TenantAdvancedDataAdvanced
	}
	return model.TenantAdvancedDataBasic
}
```

```go
// go-service/internal/db/repository/tenant_profile_repo.go
package repository

type TenantProfileRepository struct { db *sql.DB }

func NewTenantProfileRepository(db *sql.DB) *TenantProfileRepository { return &TenantProfileRepository{db: db} }

func (r *TenantProfileRepository) FindByUserID(userID int64) (*model.TenantProfile, []*model.TenantProfileDocument, error) { /* select profile + docs */ }
func (r *TenantProfileRepository) Upsert(profile *model.TenantProfile) (*model.TenantProfile, error) { /* insert or update */ }
func (r *TenantProfileRepository) CreateDocument(profileID int64, docType, path string) error { /* insert doc row */ }
func (r *TenantProfileRepository) UpdateAdvancedDataStatus(profileID int64, status string) error { /* update status */ }
```

```go
// go-service/internal/db/repository/tenant_requirement_repo.go
package repository

type TenantRequirementRepository struct { db *sql.DB }

func NewTenantRequirementRepository(db *sql.DB) *TenantRequirementRepository { return &TenantRequirementRepository{db: db} }

func (r *TenantRequirementRepository) Create(req *model.TenantRequirement) (int64, error) { /* insert */ }
func (r *TenantRequirementRepository) Update(req *model.TenantRequirement) error { /* update */ }
func (r *TenantRequirementRepository) UpdateStatus(id int64, status string) error { /* update status */ }
func (r *TenantRequirementRepository) FindMine(userID int64) ([]*model.TenantRequirement, error) { /* owner list */ }
func (r *TenantRequirementRepository) FindVisible(filters RequirementFilter) ([]*model.TenantRequirement, error) { /* owner/agent list */ }
func (r *TenantRequirementRepository) FindByID(id int64) (*model.TenantRequirement, error) { /* detail */ }
```

- [ ] **Step 4: Create tenant DTO/service/handler and wire routes**

```go
// go-service/internal/modules/tenant/dto.go
package tenant

type TenantProfileResponse struct {
	OccupationType     string                  `json:"occupationType"`
	OrgName            string                  `json:"orgName"`
	IncomeRange        string                  `json:"incomeRange"`
	HouseholdSize      int                     `json:"householdSize"`
	CoResidentNote     string                  `json:"coResidentNote"`
	MoveInTimeline     string                  `json:"moveInTimeline"`
	AdditionalNote     string                  `json:"additionalNote"`
	AdvancedDataStatus string                  `json:"advancedDataStatus"`
	Documents          []TenantProfileDocument `json:"documents"`
}

type TenantProfileDocument struct {
	ID      int64  `json:"id"`
	DocType string `json:"docType"`
}

type UpsertTenantProfileRequest struct {
	OccupationType string `json:"occupationType" binding:"required"`
	OrgName        string `json:"orgName" binding:"required"`
	IncomeRange    string `json:"incomeRange" binding:"required"`
	HouseholdSize  int    `json:"householdSize"`
	CoResidentNote string `json:"coResidentNote"`
	MoveInTimeline string `json:"moveInTimeline"`
	AdditionalNote string `json:"additionalNote"`
}

type TenantRequirementResponse struct {
	ID                  int64    `json:"id"`
	TargetDistrict      string   `json:"targetDistrict"`
	BudgetMin           float64  `json:"budgetMin"`
	BudgetMax           float64  `json:"budgetMax"`
	LayoutNote          string   `json:"layoutNote"`
	MoveInDate          *string  `json:"moveInDate,omitempty"`
	PetFriendlyNeeded   bool     `json:"petFriendlyNeeded"`
	ParkingNeeded       bool     `json:"parkingNeeded"`
	Status              string   `json:"status"`
	HasAdvancedData     bool     `json:"hasAdvancedData"`
	OccupationType      *string  `json:"occupationType,omitempty"`
	IncomeRange         *string  `json:"incomeRange,omitempty"`
	MoveInTimeline      *string  `json:"moveInTimeline,omitempty"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt"`
}
```

```go
// go-service/internal/modules/tenant/service.go
type Service struct {
	userRepo            *repository.UserRepository
	credentialRepo      *repository.UserCredentialRepository
	profileRepo         *repository.TenantProfileRepository
	requirementRepo     *repository.TenantRequirementRepository
	storageSvc          *storage.Client
}

func (s *Service) requireActiveTenant(wallet string) (*model.User, error) { /* user exists + TENANT credential active */ }
func (s *Service) requireProviderViewer(wallet string) (*model.User, error) { /* OWNER or AGENT active */ }

func (s *Service) GetMyProfile(wallet string) (*TenantProfileResponse, error) { /* find or return empty profile */ }
func (s *Service) UpsertMyProfile(wallet string, req UpsertTenantProfileRequest) (*TenantProfileResponse, error) { /* upsert + recompute advanced status */ }
func (s *Service) UploadMyDocument(ctx context.Context, wallet, docType string, file []byte) (*TenantProfileResponse, error) { /* upload + recompute */ }
func (s *Service) ListMyRequirements(wallet string) ([]TenantRequirementResponse, error) { /* tenant-owned list */ }
func (s *Service) CreateRequirement(wallet string, req CreateRequirementRequest) (*TenantRequirementResponse, error) { /* create */ }
func (s *Service) UpdateRequirement(wallet string, id int64, req UpdateRequirementRequest) (*TenantRequirementResponse, error) { /* update owned */ }
func (s *Service) UpdateRequirementStatus(wallet string, id int64, status string) error { /* OPEN/PAUSED/CLOSED */ }
func (s *Service) ListVisibleRequirements(wallet string, filters RequirementFilter) ([]TenantRequirementResponse, error) { /* OWNER/AGENT only */ }
func (s *Service) GetVisibleRequirement(wallet string, id int64) (*TenantRequirementResponse, error) { /* OWNER/AGENT only */ }
```

```go
// go-service/internal/bootstrap/router.go
protected.GET("/tenant/profile", tenantHandler.GetMyProfile)
protected.PUT("/tenant/profile", tenantHandler.UpsertMyProfile)
protected.POST("/tenant/profile/documents", tenantHandler.UploadMyDocument)
protected.GET("/tenant/requirements/mine", tenantHandler.ListMyRequirements)
protected.POST("/tenant/requirements", tenantHandler.CreateRequirement)
protected.PUT("/tenant/requirements/:id", tenantHandler.UpdateRequirement)
protected.PUT("/tenant/requirements/:id/status", tenantHandler.UpdateRequirementStatus)
protected.GET("/requirements", tenantHandler.ListVisibleRequirements)
protected.GET("/requirements/:id", tenantHandler.GetVisibleRequirement)
```

```go
// go-service/internal/bootstrap/wiring.go
tenantProfileRepo := repository.NewTenantProfileRepository(postgresDB)
tenantRequirementRepo := repository.NewTenantRequirementRepository(postgresDB)

tenantSvc := tenantmod.NewService(
	userRepo,
	credentialRepo,
	tenantProfileRepo,
	tenantRequirementRepo,
	minioClient,
)
tenantHandler := tenantmod.NewHandler(tenantSvc)
```

- [ ] **Step 5: Run the tenant tests and a backend package sweep**

Run: `go test ./internal/modules/tenant -v`  
Working directory: `go-service`  
Expected: PASS

Run: `go test ./internal/modules/listing ./internal/modules/credential ./internal/modules/tenant -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/db/repository/tenant_profile_repo.go \
  go-service/internal/db/repository/tenant_requirement_repo.go \
  go-service/internal/modules/tenant/domain.go \
  go-service/internal/modules/tenant/domain_test.go \
  go-service/internal/modules/tenant/dto.go \
  go-service/internal/modules/tenant/service.go \
  go-service/internal/modules/tenant/handler.go \
  go-service/internal/bootstrap/router.go \
  go-service/internal/bootstrap/wiring.go
git commit -m "feat: add tenant profile and requirement backend"
```

---

### Task 5: Agent Profile Backend Extension

**Files:**
- Create: `go-service/internal/db/repository/agent_profile_repo.go`
- Modify: `go-service/internal/modules/agent/dto.go`
- Modify: `go-service/internal/modules/agent/service.go`
- Modify: `go-service/internal/modules/agent/handler.go`
- Modify: `go-service/internal/modules/agent/service_test.go`
- Modify: `go-service/internal/bootstrap/router.go`
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1: Add a failing agent service test for profile completeness mapping**

```go
// go-service/internal/modules/agent/service_test.go
func TestMapProfileCompleteFlag(t *testing.T) {
	got := normalizeProfileCompleteFilter("complete")
	if got == nil || *got != true {
		t.Fatalf("normalizeProfileCompleteFilter(complete) = %v, want true", got)
	}

	got = normalizeProfileCompleteFilter("all")
	if got != nil {
		t.Fatalf("normalizeProfileCompleteFilter(all) = %v, want nil", got)
	}
}
```

- [ ] **Step 2: Run the agent test and confirm it fails**

Run: `go test ./internal/modules/agent -run TestMapProfileCompleteFlag -v`  
Working directory: `go-service`  
Expected: FAIL because `normalizeProfileCompleteFilter` does not exist yet

- [ ] **Step 3: Add the repository plus the public/private profile endpoints**

```go
// go-service/internal/db/repository/agent_profile_repo.go
package repository

type AgentProfileRepository struct { db *sql.DB }

func NewAgentProfileRepository(db *sql.DB) *AgentProfileRepository { return &AgentProfileRepository{db: db} }

func (r *AgentProfileRepository) FindByUserID(userID int64) (*model.AgentProfile, error) { /* select */ }
func (r *AgentProfileRepository) FindByWallet(wallet string) (*model.AgentProfileRow, error) { /* join users */ }
func (r *AgentProfileRepository) Upsert(profile *model.AgentProfile) (*model.AgentProfile, error) { /* insert/update */ }
```

```go
// go-service/internal/modules/agent/dto.go
type AgentListFilter struct {
	ServiceArea     string
	ProfileComplete *bool
}

type AgentListItem struct {
	WalletAddress      string    `json:"walletAddress"`
	DisplayName        *string   `json:"displayName,omitempty"`
	ActivatedAt        string    `json:"activatedAt"`
	NFTTokenID         int32     `json:"nftTokenId"`
	Headline           *string   `json:"headline,omitempty"`
	ServiceAreas       []string  `json:"serviceAreas"`
	IsProfileComplete  bool      `json:"isProfileComplete"`
}

type AgentDetailResponse struct {
	WalletAddress      string    `json:"walletAddress"`
	DisplayName        *string   `json:"displayName,omitempty"`
	ActivatedAt        string    `json:"activatedAt"`
	NFTTokenID         int32     `json:"nftTokenId"`
	TxHash             string    `json:"txHash"`
	Headline           *string   `json:"headline,omitempty"`
	Bio                *string   `json:"bio,omitempty"`
	ServiceAreas       []string  `json:"serviceAreas"`
	LicenseNote        *string   `json:"licenseNote,omitempty"`
	IsProfileComplete  bool      `json:"isProfileComplete"`
}

type UpsertMyAgentProfileRequest struct {
	Headline           string   `json:"headline"`
	Bio                string   `json:"bio"`
	ServiceAreas       []string `json:"serviceAreas"`
	LicenseNote        string   `json:"licenseNote"`
	ContactPreferences string   `json:"contactPreferences"`
}
```

```go
// go-service/internal/modules/agent/service.go
func normalizeProfileCompleteFilter(raw string) *bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "complete":
		v := true
		return &v
	case "incomplete":
		v := false
		return &v
	default:
		return nil
	}
}
```

```go
// go-service/internal/modules/agent/handler.go
func (h *Handler) ListAgents(c *gin.Context) {
	filter := AgentListFilter{
		ServiceArea:     strings.TrimSpace(c.Query("serviceArea")),
		ProfileComplete: normalizeProfileCompleteFilter(c.Query("profile")),
	}
	resp, err := h.svc.ListAgents(filter)
	// existing envelope handling
}

func (h *Handler) GetMyProfile(c *gin.Context) { /* protected AGENT-only */ }
func (h *Handler) UpsertMyProfile(c *gin.Context) { /* protected AGENT-only */ }
```

```go
// go-service/internal/bootstrap/router.go
protected.GET("/agents/me/profile", agentHandler.GetMyProfile)
protected.PUT("/agents/me/profile", agentHandler.UpsertMyProfile)
```

- [ ] **Step 4: Run the agent tests and a backend build**

Run: `go test ./internal/modules/agent -v`  
Working directory: `go-service`  
Expected: PASS

Run: `go build ./...`  
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/db/repository/agent_profile_repo.go \
  go-service/internal/modules/agent/dto.go \
  go-service/internal/modules/agent/service.go \
  go-service/internal/modules/agent/handler.go \
  go-service/internal/modules/agent/service_test.go \
  go-service/internal/bootstrap/router.go \
  go-service/internal/bootstrap/wiring.go
git commit -m "feat: extend agent module with profile data"
```

---

### Task 6: Shared Frontend API, Router, Header, And Touched Copy Foundation

**Files:**
- Create: `react-service/src/api/tenantApi.ts`
- Modify: `react-service/src/api/listingApi.ts`
- Modify: `react-service/src/api/agentApi.ts`
- Modify: `react-service/src/api/credentialApi.ts`
- Modify: `react-service/src/router/index.tsx`
- Modify: `react-service/src/components/common/Header.tsx`
- Modify: `react-service/src/pages/ListingCreatePage.tsx`
- Modify: `react-service/src/components/listing/ListingEditorForm.tsx`
- Modify: `react-service/src/components/listing/listingEditorValues.ts`

- [ ] **Step 1: Add the shared API types and endpoint wrappers**

```ts
// react-service/src/api/listingApi.ts
export type ListingType = "UNSET" | "RENT" | "SALE";
export type ListingSetupStatus = "INCOMPLETE" | "READY";
export type ListingDraftOrigin = "MANUAL_CREATE" | "OWNER_ACTIVATION";

export type Listing = {
    id: number;
    owner_user_id: number;
    title: string;
    address: string;
    list_type: ListingType;
    price: number;
    status: ListingStatus;
    draft_origin: ListingDraftOrigin;
    setup_status: ListingSetupStatus;
    // ...existing fields
};
```

```ts
// react-service/src/api/tenantApi.ts
const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type TenantAdvancedDataStatus = "BASIC" | "ADVANCED";
export type TenantProfileDocument = {
    id: number;
    docType: "INCOME_PROOF" | "HOUSEHOLD_DOC" | "OTHER";
};

export type TenantProfile = {
    occupationType: string;
    orgName: string;
    incomeRange: string;
    householdSize: number;
    coResidentNote: string;
    moveInTimeline: string;
    additionalNote: string;
    advancedDataStatus: TenantAdvancedDataStatus;
    documents: TenantProfileDocument[];
};

export type TenantRequirement = {
    id: number;
    targetDistrict: string;
    budgetMin: number;
    budgetMax: number;
    layoutNote: string;
    moveInDate?: string;
    petFriendlyNeeded: boolean;
    parkingNeeded: boolean;
    status: "OPEN" | "PAUSED" | "CLOSED";
    hasAdvancedData: boolean;
    occupationType?: string;
    incomeRange?: string;
    moveInTimeline?: string;
    createdAt: string;
    updatedAt: string;
};

// add getMyTenantProfile / updateMyTenantProfile / uploadMyTenantDocument /
// getMyRequirements / createRequirement / updateRequirement / updateRequirementStatus /
// getRequirementList / getRequirementDetail
```

- [ ] **Step 2: Register the new routes and guarded navigation**

```tsx
// react-service/src/router/index.tsx
{ path: "/my/listings", element: <RequireCredential requiredRole="OWNER"><MyListingsPage /></RequireCredential> },
{ path: "/my/tenant-profile", element: <RequireCredential requiredRole="TENANT"><TenantProfilePage /></RequireCredential> },
{ path: "/my/requirements", element: <RequireCredential requiredRole="TENANT"><MyRequirementsPage /></RequireCredential> },
{ path: "/requirements", element: <RequireCredential anyOf={["OWNER", "AGENT"]}><RequirementsPage /></RequireCredential> },
{ path: "/requirements/:id", element: <RequireCredential anyOf={["OWNER", "AGENT"]}><RequirementDetailPage /></RequireCredential> },
{ path: "/my/agent-profile", element: <RequireCredential requiredRole="AGENT"><MyAgentProfilePage /></RequireCredential> },
```

```tsx
// react-service/src/components/common/Header.tsx
{state.authenticated && (state.credentials.includes("OWNER") || state.credentials.includes("AGENT")) ? (
    <NavLink to="/requirements" className={navLinkCls}>租屋需求列表</NavLink>
) : null}

[
    { label: "會員資料", path: "/profile" },
    { label: "身份中心", path: "/member" },
    { label: "設定", path: "/settings" },
]
```

- [ ] **Step 3: Translate touched listing copy and support incomplete draft editing**

```tsx
// react-service/src/pages/ListingCreatePage.tsx
<Link to="/listings" className="text-sm text-on-surface-variant hover:text-primary-container transition-colors">
    返回房源列表
</Link>
<h1 className="text-4xl font-extrabold text-on-background tracking-tight font-headline">
    建立房源草稿
</h1>
<p className="text-on-surface-variant leading-[1.75]">
    已啟用屋主身分的會員可先建立草稿，再於詳情頁補完資料與上架。
</p>
```

```tsx
// react-service/src/components/listing/ListingEditorForm.tsx
const canSubmit = useMemo(() => {
    if (props.mode === "edit") return true;
    return form.address.trim() !== "";
}, [form, props.mode]);

<Field label="物件類型">
    <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={() => setField("listType", "UNSET")}>未設定</button>
        <button type="button" onClick={() => setField("listType", "RENT")}>出租</button>
        <button type="button" onClick={() => setField("listType", "SALE")}>出售</button>
    </div>
</Field>

<Field label="標題"><input className={inputCls} ... /></Field>
<Field label="地址"><input className={inputCls} ... /></Field>
<Field label="行政區"><input className={inputCls} ... /></Field>
<Field label="價格（新台幣）"><input type="number" min={0} className={inputCls} ... /></Field>
```

- [ ] **Step 4: Run lint after the shared API/router changes**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: FAIL or PASS depending on whether the new pages already exist; if it fails, the missing-page errors must be addressed in later frontend tasks before claiming completion

- [ ] **Step 5: Commit**

```bash
git add react-service/src/api/tenantApi.ts \
  react-service/src/api/listingApi.ts \
  react-service/src/api/agentApi.ts \
  react-service/src/api/credentialApi.ts \
  react-service/src/router/index.tsx \
  react-service/src/components/common/Header.tsx \
  react-service/src/pages/ListingCreatePage.tsx \
  react-service/src/components/listing/ListingEditorForm.tsx \
  react-service/src/components/listing/listingEditorValues.ts
git commit -m "feat: add shared role workbench frontend foundations"
```

---

### Task 7: OWNER Frontend Workbench

**Files:**
- Create: `react-service/src/pages/MyListingsPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`
- Modify: `react-service/src/pages/ListingListPage.tsx`
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

- [ ] **Step 1: Create the private OWNER listings page**

```tsx
// react-service/src/pages/MyListingsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyListings, type Listing } from "@/api/listingApi";
import SiteLayout from "@/layouts/SiteLayout";

export default function MyListingsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getMyListings()
            .then(setItems)
            .catch((err) => setError(err instanceof Error ? err.message : "載入我的物件失敗"))
            .finally(() => setLoading(false));
    }, []);

    const counts = useMemo(() => ({
        incomplete: items.filter((item) => item.status === "DRAFT" && item.setup_status === "INCOMPLETE").length,
        ready: items.filter((item) => item.status === "DRAFT" && item.setup_status === "READY").length,
        active: items.filter((item) => item.status === "ACTIVE").length,
        archived: items.filter((item) => item.status === "REMOVED" || item.status === "CLOSED").length,
    }), [items]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的物件</h1>
                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                        這裡顯示所有歷史物件，包含由屋主認證資料初始化的未完善草稿。
                    </p>
                </header>
                {/* render summary counts and clickable cards */}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Add the OWNER workbench summary into `IdentityCenterPage.tsx`**

```tsx
// react-service/src/pages/IdentityCenterPage.tsx
const [myListings, setMyListings] = useState<Listing[]>([]);

// inside load()
const shouldLoadOwnerWorkbench = nextState.kyc?.credentials?.includes("OWNER") ?? false;
if (shouldLoadOwnerWorkbench) {
    const listings = await getMyListings().catch(() => [] as Listing[]);
    nextState.ownerListings = listings;
}

// inside the render tree
{activatedItems.some((item) => item.credentialType === "OWNER") ? (
    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-on-surface">我的物件</h2>
                <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                    屋主啟用後的第一筆物件草稿會由認證資料初始化，補完後才能公開上架。
                </p>
            </div>
            <button type="button" onClick={() => navigate("/my/listings")} className="rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container">
                查看全部物件
            </button>
        </div>
    </section>
) : null}
```

- [ ] **Step 3: Update listing list/detail copy and incomplete-state banners**

```tsx
// react-service/src/pages/ListingDetailPage.tsx
{listing.status === "DRAFT" && listing.setup_status === "INCOMPLETE" ? (
    <div className="rounded-2xl border border-amber-700/20 bg-amber-700/10 p-4 text-sm text-amber-700">
        這是一筆由屋主認證資料初始化的未完善物件草稿，補完欄位後才能公開上架。
    </div>
) : null}
```

```tsx
// react-service/src/pages/ListingListPage.tsx
<h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
    房源列表
</h1>
<p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
    這裡只顯示已公開的房源資料，未完善草稿不會出現在公開列表。
</p>
```

- [ ] **Step 4: Run frontend verification for the OWNER slice**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/MyListingsPage.tsx \
  react-service/src/pages/IdentityCenterPage.tsx \
  react-service/src/pages/ListingListPage.tsx \
  react-service/src/pages/ListingDetailPage.tsx
git commit -m "feat: add owner workbench and bootstrap draft surfaces"
```

---

### Task 8: TENANT Frontend Workbench And Requirement Pages

**Files:**
- Modify: `react-service/src/pages/TenantCredentialPage.tsx`
- Create: `react-service/src/pages/TenantProfilePage.tsx`
- Create: `react-service/src/pages/MyRequirementsPage.tsx`
- Create: `react-service/src/pages/RequirementsPage.tsx`
- Create: `react-service/src/pages/RequirementDetailPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`

- [ ] **Step 1: Replace `TenantCredentialPage.tsx` with the lightweight submission flow**

```tsx
// react-service/src/pages/TenantCredentialPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import { activateCredentialSubmission, createCredentialSubmission, getCredentialCenter, getLatestCredentialSubmission } from "@/api/credentialApi";

export default function TenantCredentialPage() {
    const [form, setForm] = useState({ holderName: "", occupationType: "", orgName: "", incomeRange: "", notes: "" });
    const [detail, setDetail] = useState<CredentialSubmissionDetail | null>(null);
    const [item, setItem] = useState<CredentialCenterItem | undefined>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const refresh = async () => {
        const [center, latest] = await Promise.all([getCredentialCenter(), getLatestCredentialSubmission("TENANT")]);
        setItem(center.items.find((entry) => entry.credentialType === "TENANT"));
        setDetail(latest);
    };

    useEffect(() => { void refresh(); }, []);

    const submit = async () => {
        setBusy(true);
        setError("");
        try {
            await createCredentialSubmission("TENANT", {
                route: "PROFILE",
                formPayload: {
                    holderName: form.holderName,
                    occupationType: form.occupationType,
                    orgName: form.orgName,
                    incomeRange: form.incomeRange,
                },
                notes: form.notes,
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "建立租客身分資料失敗");
        } finally {
            setBusy(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">返回身份中心</Link>
                {/* render simple form + activate button when PASSED_READY */}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Create tenant profile and requirement pages**

```tsx
// react-service/src/pages/TenantProfilePage.tsx
export default function TenantProfilePage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-2">
                    <h1 className="text-4xl font-extrabold text-on-surface">租客進階資料</h1>
                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                        這裡的資料只作為資訊揭露，平台不對內容做官方背書；符合規則時會顯示「已提供進階資料」。
                    </p>
                </header>
                {/* render advanced-data form + document upload list */}
            </main>
        </SiteLayout>
    );
}
```

```tsx
// react-service/src/pages/MyRequirementsPage.tsx
export default function MyRequirementsPage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-12 md:px-12">
                <h1 className="text-4xl font-extrabold text-on-surface">我的租屋需求</h1>
                {/* render create/edit list for the tenant */}
            </main>
        </SiteLayout>
    );
}
```

```tsx
// react-service/src/pages/RequirementsPage.tsx
export default function RequirementsPage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <h1 className="text-4xl font-extrabold text-on-surface">租屋需求列表</h1>
                <p className="text-sm leading-[1.8] text-on-surface-variant">
                    這裡只對已登入的屋主與仲介開放，用於瀏覽租客已公開的需求條件。
                </p>
                {/* render guarded filters + cards */}
            </main>
        </SiteLayout>
    );
}
```

```tsx
// react-service/src/pages/RequirementDetailPage.tsx
export default function RequirementDetailPage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                {/* render requirement detail; only show advanced-data badge/summary to OWNER or AGENT */}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Add the TENANT workbench cards to `IdentityCenterPage.tsx`**

```tsx
// react-service/src/pages/IdentityCenterPage.tsx
{activatedItems.some((item) => item.credentialType === "TENANT") ? (
    <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <h2 className="text-2xl font-bold text-on-surface">我的租屋需求</h2>
            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                租客身分啟用後不會自動建立需求，請依目前條件建立與管理你的租屋需求。
            </p>
            <button type="button" onClick={() => navigate("/my/requirements")} className="mt-6 rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container">
                管理租屋需求
            </button>
        </section>
        <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <h2 className="text-2xl font-bold text-on-surface">租客進階資料</h2>
            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                補充薪資證明、戶籍／戶口類文件與說明資料，符合規則後會顯示「已提供進階資料」。
            </p>
            <button type="button" onClick={() => navigate("/my/tenant-profile")} className="mt-6 rounded-xl border border-outline-variant/30 bg-surface-container-low px-5 py-3 font-medium text-on-surface">
                管理進階資料
            </button>
        </section>
    </div>
) : null}
```

- [ ] **Step 4: Verify the TENANT frontend slice**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/TenantCredentialPage.tsx \
  react-service/src/pages/TenantProfilePage.tsx \
  react-service/src/pages/MyRequirementsPage.tsx \
  react-service/src/pages/RequirementsPage.tsx \
  react-service/src/pages/RequirementDetailPage.tsx \
  react-service/src/pages/IdentityCenterPage.tsx
git commit -m "feat: add tenant workbench and demand pages"
```

---

### Task 9: AGENT Frontend Workbench And Public Filters

**Files:**
- Create: `react-service/src/pages/MyAgentProfilePage.tsx`
- Modify: `react-service/src/pages/AgentListPage.tsx`
- Modify: `react-service/src/pages/AgentDetailPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`

- [ ] **Step 1: Create the private AGENT profile/workbench page**

```tsx
// react-service/src/pages/MyAgentProfilePage.tsx
import SiteLayout from "@/layouts/SiteLayout";

export default function MyAgentProfilePage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-2">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的仲介專頁</h1>
                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                        補齊可公開資訊後，仲介列表與公開專頁會同步顯示你的簡介與服務區域。
                    </p>
                </header>
                {/* render profile form + completion summary */}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Extend the public agent list/detail pages with filters and profile data**

```tsx
// react-service/src/pages/AgentListPage.tsx
const [serviceArea, setServiceArea] = useState("");
const [profileFilter, setProfileFilter] = useState<"all" | "complete" | "incomplete">("all");

useEffect(() => {
    getAgentList({
        serviceArea: serviceArea.trim() || undefined,
        profile: profileFilter === "all" ? undefined : profileFilter,
    })
        .then((resp) => setAgents(resp.items))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "載入仲介列表失敗"))
        .finally(() => setLoading(false));
}, [profileFilter, serviceArea]);
```

```tsx
// react-service/src/pages/AgentDetailPage.tsx
{agent.bio ? (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
        <h2 className="text-xl font-bold text-on-surface">專頁簡介</h2>
        <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">{agent.bio}</p>
    </section>
) : null}

{agent.serviceAreas.length > 0 ? (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
        <h2 className="text-xl font-bold text-on-surface">服務區域</h2>
        <div className="mt-3 flex flex-wrap gap-2">
            {agent.serviceAreas.map((area) => (
                <span key={area} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{area}</span>
            ))}
        </div>
    </section>
) : null}
```

- [ ] **Step 3: Add the AGENT workbench card to `IdentityCenterPage.tsx`**

```tsx
// react-service/src/pages/IdentityCenterPage.tsx
{activatedItems.some((item) => item.credentialType === "AGENT") ? (
    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-on-surface">我的仲介專頁</h2>
                <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                    補齊公開專頁資料後，仲介列表會顯示你的簡介、服務區域與專頁完整度。
                </p>
            </div>
            <button type="button" onClick={() => navigate("/my/agent-profile")} className="rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container">
                管理專頁
            </button>
        </div>
    </section>
) : null}
```

- [ ] **Step 4: Verify the AGENT frontend slice**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/MyAgentProfilePage.tsx \
  react-service/src/pages/AgentListPage.tsx \
  react-service/src/pages/AgentDetailPage.tsx \
  react-service/src/pages/IdentityCenterPage.tsx
git commit -m "feat: add agent workbench and public profile filters"
```

---

### Task 10: Docs, Log, And Full Verification

**Files:**
- Modify: `docs/database/relational-database-spec.md`
- Modify: `docs/database/relational-database-spec.csv`
- Modify: `dev_log/2026-04-24.md`

- [ ] **Step 1: Update the schema docs and the daily dev log**

```md
## Role Workbench Mainline

- `listings` 新增 `draft_origin`、`setup_status`、`source_credential_submission_id`
- 新增 `tenant_profiles`
- 新增 `tenant_profile_documents`
- 新增 `tenant_requirements`
- 新增 `agent_profiles`
- `OWNER` 啟用成功後，首次且無既有 listing 時自動建立未完善物件草稿
- `TENANT` 改為輕量身份啟用，進階資料僅做資訊揭露，不做平台背書
```

- [ ] **Step 2: Run the full backend verification suite**

Run: `go test ./...`  
Working directory: `go-service`  
Expected: PASS

- [ ] **Step 3: Run the full frontend verification suite**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 4: Manually smoke-test the critical role flows**

1. KYC VERIFIED + first-time OWNER activation creates one and only one bootstrap draft in `/my/listings`
2. Existing Gate 0 owner with historical listings activates OWNER and does not get an extra bootstrap draft
3. TENANT lightweight form reaches `PASSED_READY`, then activates role NFT without OCR/upload steps
4. TENANT can manage advanced data and see `已提供進階資料` after meeting the exact rule
5. OWNER/AGENT can browse `/requirements`; unauthorised users are redirected by route guard
6. Public `/listings` excludes `DRAFT + INCOMPLETE` items
7. Public `/agents` and `/agents/:wallet` render profile fields and filters in Traditional Chinese

- [ ] **Step 5: Commit**

```bash
git add docs/database/relational-database-spec.md \
  docs/database/relational-database-spec.csv \
  dev_log/2026-04-24.md
git commit -m "docs: record role workbench and tenant demand mainline"
```

---

## Self-Review

### Spec coverage

- OWNER bootstrap draft: covered in Tasks 1-3 and 7
- TENANT lightweight credential: covered in Task 3 and Task 8
- TENANT advanced data and restricted requirement views: covered in Task 4 and Task 8
- AGENT profile/public/private split: covered in Task 5 and Task 9
- Identity center and header role workbench behavior: covered in Tasks 6-9
- Chinese copy on touched pages: covered in Tasks 6-9
- Out-of-scope support tracks (`favorites`, full-site translation sweep, full button-style cleanup): intentionally omitted

### Placeholder scan

- No `TODO`/`TBD`
- No unresolved route names
- No undefined table names or module names left hanging

### Type consistency

- `ListingType` includes `UNSET` in schema, backend model, and frontend API
- `ReviewRouteProfile` is introduced in both backend and frontend types
- `advancedDataStatus` uses `BASIC` / `ADVANCED` in schema, backend model, and frontend API

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-role-workbench-and-tenant-demand-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
