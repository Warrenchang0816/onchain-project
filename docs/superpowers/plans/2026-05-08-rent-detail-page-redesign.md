# RentDetailPage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `RentDetailPage` to match 信義房屋 rental detail information architecture, adding furnishings and nearby-environment fields full-stack.

**Architecture:** Add 15 boolean columns to `rental_listing` (11 furnishings + 4 nearby-environment), expose them through the existing DTO/handler pipeline, extend TypeScript types, then rewrite the React page with five sections: Hero, 出租條件, 物件資料, 傢俱設備, 周邊環境. Transit section is pre-reserved as a static placeholder (no DB columns yet).

**Tech Stack:** Go 1.25 / Gin / lib/pq (no ORM), React 19 / TypeScript 5 strict / Tailwind / MD3 warm-light theme

---

## File Map

| File | Change |
|---|---|
| `go-service/internal/platform/db/schema.go` | Add 15 cols to `CREATE TABLE rental_listing` + `ALTER TABLE` stmts |
| `go-service/internal/db/model/rental_listing_model.go` | Add 15 fields to `RentalListing` struct |
| `go-service/internal/db/repository/rental_listing_repo.go` | Update all SELECT columns + both scan functions |
| `go-service/internal/modules/rental_listing/dto.go` | Add 15 fields to `RentalListingResponse` |
| `go-service/internal/modules/rental_listing/handler.go` | Update `toResponse()` to map 15 new fields |
| `react-service/src/api/rentalListingApi.ts` | Add 15 fields to `RentalListing` type |
| `react-service/src/pages/RentDetailPage.tsx` | Full rewrite — 5-section layout |
| `infra/init/15-demo-properties.sql` | Update 10 rental INSERT statements with new columns |

---

## Task 1: Go DB layer — schema, model, repository

**Files:**
- Modify: `go-service/internal/platform/db/schema.go`
- Modify: `go-service/internal/db/model/rental_listing_model.go`
- Modify: `go-service/internal/db/repository/rental_listing_repo.go`

- [ ] **Step 1: Add 15 columns to CREATE TABLE rental_listing in schema.go**

Find the block starting with `` `CREATE TABLE IF NOT EXISTS rental_listing ( `` (around line 83) and add 15 new columns before the closing `)`+backtick:

```go
// After: notes TEXT,
// Before: published_at TIMESTAMPTZ,
// Add:
    has_sofa             BOOLEAN       NOT NULL DEFAULT FALSE,
    has_bed              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_wardrobe         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_tv               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_fridge           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_ac               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_washer           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_water_heater     BOOLEAN       NOT NULL DEFAULT FALSE,
    has_gas              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_internet         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_cable_tv         BOOLEAN       NOT NULL DEFAULT FALSE,
    near_school          BOOLEAN       NOT NULL DEFAULT FALSE,
    near_supermarket     BOOLEAN       NOT NULL DEFAULT FALSE,
    near_convenience_store BOOLEAN     NOT NULL DEFAULT FALSE,
    near_park            BOOLEAN       NOT NULL DEFAULT FALSE,
```

The full updated block in schema.go:
```go
`CREATE TABLE IF NOT EXISTS rental_listing (
    id                   BIGSERIAL     PRIMARY KEY,
    property_id          BIGINT        NOT NULL REFERENCES property(id),
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    duration_days        INT           NOT NULL DEFAULT 30,
    monthly_rent         NUMERIC(14,2) NOT NULL DEFAULT 0,
    deposit_months       NUMERIC(4,1)  NOT NULL DEFAULT 0,
    management_fee_payer VARCHAR(20)   NOT NULL DEFAULT 'TENANT',
    min_lease_months     INT           NOT NULL DEFAULT 0,
    allow_pets           BOOLEAN       NOT NULL DEFAULT FALSE,
    allow_cooking        BOOLEAN       NOT NULL DEFAULT FALSE,
    gender_restriction   VARCHAR(20),
    notes                TEXT,
    has_sofa             BOOLEAN       NOT NULL DEFAULT FALSE,
    has_bed              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_wardrobe         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_tv               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_fridge           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_ac               BOOLEAN       NOT NULL DEFAULT FALSE,
    has_washer           BOOLEAN       NOT NULL DEFAULT FALSE,
    has_water_heater     BOOLEAN       NOT NULL DEFAULT FALSE,
    has_gas              BOOLEAN       NOT NULL DEFAULT FALSE,
    has_internet         BOOLEAN       NOT NULL DEFAULT FALSE,
    has_cable_tv         BOOLEAN       NOT NULL DEFAULT FALSE,
    near_school          BOOLEAN       NOT NULL DEFAULT FALSE,
    near_supermarket     BOOLEAN       NOT NULL DEFAULT FALSE,
    near_convenience_store BOOLEAN     NOT NULL DEFAULT FALSE,
    near_park            BOOLEAN       NOT NULL DEFAULT FALSE,
    published_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,
```

- [ ] **Step 2: Add ALTER TABLE statements for existing DBs**

Find the two `CREATE INDEX IF NOT EXISTS idx_rental_listing_*` lines (around lines 102–103) and add the ALTER TABLE block **before** them:

```go
`ALTER TABLE rental_listing
    ADD COLUMN IF NOT EXISTS has_sofa             BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_bed              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_wardrobe         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_tv               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_fridge           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_ac               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_washer           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_water_heater     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_gas              BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_internet         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_cable_tv         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_school          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_supermarket     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_convenience_store BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS near_park            BOOLEAN NOT NULL DEFAULT FALSE`,
```

- [ ] **Step 3: Add 15 fields to the RentalListing Go model**

Replace the entire content of `go-service/internal/db/model/rental_listing_model.go` with:

```go
package model

import (
	"database/sql"
	"time"
)

const (
	RentalListingStatusDraft       = "DRAFT"
	RentalListingStatusActive      = "ACTIVE"
	RentalListingStatusNegotiating = "NEGOTIATING"
	RentalListingStatusLocked      = "LOCKED"
	RentalListingStatusClosed      = "CLOSED"
	RentalListingStatusExpired     = "EXPIRED"

	ManagementFeePayerTenant = "TENANT"
	ManagementFeePayerOwner  = "OWNER"
	ManagementFeePayerSplit  = "SPLIT"

	GenderRestrictionNone   = "NONE"
	GenderRestrictionMale   = "MALE"
	GenderRestrictionFemale = "FEMALE"
)

type RentalListing struct {
	ID         int64
	PropertyID int64

	Status       string
	DurationDays int

	MonthlyRent        float64
	DepositMonths      float64
	ManagementFeePayer string
	MinLeaseMonths     int
	AllowPets          bool
	AllowCooking       bool
	GenderRestriction  sql.NullString
	Notes              sql.NullString

	HasSofa         bool
	HasBed          bool
	HasWardrobe     bool
	HasTV           bool
	HasFridge       bool
	HasAC           bool
	HasWasher       bool
	HasWaterHeater  bool
	HasGas          bool
	HasInternet     bool
	HasCableTV      bool

	NearSchool           bool
	NearSupermarket      bool
	NearConvenienceStore bool
	NearPark             bool

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
```

- [ ] **Step 4: Update all SELECT queries and scan functions in rental_listing_repo.go**

The repository has three SELECT queries (FindByID, FindActiveByProperty, ListPublic) and two scan functions (scanRentalListing, scanRentalListings). All must select the 15 new columns and scan them in order.

Replace the SELECT column list in **all three queries**. The new column list (append after `created_at, updated_at`):

```sql
SELECT id, property_id, status, duration_days,
       monthly_rent, deposit_months, management_fee_payer,
       min_lease_months, allow_pets, allow_cooking,
       gender_restriction, notes, published_at, expires_at,
       created_at, updated_at,
       has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
       has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
       near_school, near_supermarket, near_convenience_store, near_park
```

Replace `scanRentalListing` (for `*sql.Row`):
```go
func scanRentalListing(row *sql.Row) (*model.RentalListing, error) {
	rl := &model.RentalListing{}
	return rl, row.Scan(
		&rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
		&rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
		&rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
		&rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
		&rl.CreatedAt, &rl.UpdatedAt,
		&rl.HasSofa, &rl.HasBed, &rl.HasWardrobe, &rl.HasTV, &rl.HasFridge,
		&rl.HasAC, &rl.HasWasher, &rl.HasWaterHeater, &rl.HasGas, &rl.HasInternet, &rl.HasCableTV,
		&rl.NearSchool, &rl.NearSupermarket, &rl.NearConvenienceStore, &rl.NearPark,
	)
}
```

Replace the inner `rows.Scan(...)` call inside `scanRentalListings` (for `*sql.Rows`):
```go
if err := rows.Scan(
    &rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
    &rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
    &rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
    &rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
    &rl.CreatedAt, &rl.UpdatedAt,
    &rl.HasSofa, &rl.HasBed, &rl.HasWardrobe, &rl.HasTV, &rl.HasFridge,
    &rl.HasAC, &rl.HasWasher, &rl.HasWaterHeater, &rl.HasGas, &rl.HasInternet, &rl.HasCableTV,
    &rl.NearSchool, &rl.NearSupermarket, &rl.NearConvenienceStore, &rl.NearPark,
); err != nil {
```

- [ ] **Step 5: Build and verify schema migration**

```bash
cd go-service && docker compose up --build -d
```

Expected: build succeeds (no compile errors).

```bash
curl -s http://localhost:8081/api/rental-listing | python -m json.tool | grep -E "has_sofa|near_school"
```

Expected: `"has_sofa": false` and `"near_school": false` appear (once Task 2 is also done — if doing step-by-step, come back to verify after Task 2).

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/platform/db/schema.go \
        go-service/internal/db/model/rental_listing_model.go \
        go-service/internal/db/repository/rental_listing_repo.go
git commit -m "feat: add furnishings and nearby-env columns to rental_listing"
```

---

## Task 2: Go API layer — DTO + handler

**Files:**
- Modify: `go-service/internal/modules/rental_listing/dto.go`
- Modify: `go-service/internal/modules/rental_listing/handler.go`

- [ ] **Step 1: Add 15 fields to RentalListingResponse in dto.go**

In `dto.go`, find `RentalListingResponse` struct (starts around line 51). Add the 15 new fields after `Notes *string`:

```go
type RentalListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	MonthlyRent        float64 `json:"monthly_rent"`
	DepositMonths      float64 `json:"deposit_months"`
	ManagementFeePayer string  `json:"management_fee_payer"`
	MinLeaseMonths     int     `json:"min_lease_months"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction,omitempty"`
	Notes              *string `json:"notes,omitempty"`

	HasSofa        bool `json:"has_sofa"`
	HasBed         bool `json:"has_bed"`
	HasWardrobe    bool `json:"has_wardrobe"`
	HasTV          bool `json:"has_tv"`
	HasFridge      bool `json:"has_fridge"`
	HasAC          bool `json:"has_ac"`
	HasWasher      bool `json:"has_washer"`
	HasWaterHeater bool `json:"has_water_heater"`
	HasGas         bool `json:"has_gas"`
	HasInternet    bool `json:"has_internet"`
	HasCableTV     bool `json:"has_cable_tv"`

	NearSchool           bool `json:"near_school"`
	NearSupermarket      bool `json:"near_supermarket"`
	NearConvenienceStore bool `json:"near_convenience_store"`
	NearPark             bool `json:"near_park"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Property *PropertySummaryResponse `json:"property,omitempty"`
}
```

- [ ] **Step 2: Update toResponse() in handler.go to map the 15 new fields**

In `handler.go`, find the `resp := RentalListingResponse{...}` block inside `toResponse()` (around line 132). Add the 15 new fields to the struct literal:

```go
func toResponse(rl *model.RentalListing) RentalListingResponse {
	resp := RentalListingResponse{
		ID: rl.ID, PropertyID: rl.PropertyID,
		Status: rl.Status, DurationDays: rl.DurationDays,
		MonthlyRent: rl.MonthlyRent, DepositMonths: rl.DepositMonths,
		ManagementFeePayer: rl.ManagementFeePayer, MinLeaseMonths: rl.MinLeaseMonths,
		AllowPets: rl.AllowPets, AllowCooking: rl.AllowCooking,
		HasSofa: rl.HasSofa, HasBed: rl.HasBed, HasWardrobe: rl.HasWardrobe,
		HasTV: rl.HasTV, HasFridge: rl.HasFridge, HasAC: rl.HasAC,
		HasWasher: rl.HasWasher, HasWaterHeater: rl.HasWaterHeater, HasGas: rl.HasGas,
		HasInternet: rl.HasInternet, HasCableTV: rl.HasCableTV,
		NearSchool: rl.NearSchool, NearSupermarket: rl.NearSupermarket,
		NearConvenienceStore: rl.NearConvenienceStore, NearPark: rl.NearPark,
		CreatedAt: rl.CreatedAt, UpdatedAt: rl.UpdatedAt,
	}
	// ... rest of the function unchanged (NullString/NullTime handling + property mapping)
```

- [ ] **Step 3: Rebuild and verify API response includes new fields**

```bash
cd go-service && docker compose up --build -d
```

```bash
curl -s http://localhost:8081/api/rental-listing/1 | python -m json.tool | grep -E "has_sofa|has_ac|near_school|near_park"
```

Expected output (values will be `false` until seed data is updated in Task 4):
```json
"has_sofa": false,
"has_ac": false,
"near_school": false,
"near_park": false,
```

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/modules/rental_listing/dto.go \
        go-service/internal/modules/rental_listing/handler.go
git commit -m "feat: expose rental_listing furnishings and nearby fields in API response"
```

---

## Task 3: TypeScript API types

**Files:**
- Modify: `react-service/src/api/rentalListingApi.ts`

- [ ] **Step 1: Add 15 new fields to the RentalListing type**

In `rentalListingApi.ts`, find the `RentalListing` type (around line 27). Add the 15 new fields after `notes?: string`:

```typescript
export type RentalListing = {
    id: number;
    property_id: number;
    status: RentalListingStatus;
    duration_days: number;
    monthly_rent: number;
    deposit_months: number;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: number;
    allow_pets: boolean;
    allow_cooking: boolean;
    gender_restriction?: GenderRestriction;
    notes?: string;
    has_sofa: boolean;
    has_bed: boolean;
    has_wardrobe: boolean;
    has_tv: boolean;
    has_fridge: boolean;
    has_ac: boolean;
    has_washer: boolean;
    has_water_heater: boolean;
    has_gas: boolean;
    has_internet: boolean;
    has_cable_tv: boolean;
    near_school: boolean;
    near_supermarket: boolean;
    near_convenience_store: boolean;
    near_park: boolean;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    property?: PropertySummary;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd react-service && npm run lint
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/api/rentalListingApi.ts
git commit -m "feat: add furnishings and nearby-env fields to RentalListing TypeScript type"
```

---

## Task 4: React page rewrite

**Files:**
- Modify: `react-service/src/pages/RentDetailPage.tsx`

Context: The current page is 104 lines with a flat grid layout. Rewrite to match 信義房屋's rental detail information architecture with 5 sections. Keep the existing warm MD3 light theme classes (`text-primary`, `bg-surface-container-lowest`, `text-on-surface-variant`, `bg-tertiary/10`, etc.).

- [ ] **Step 1: Replace the entire content of RentDetailPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRentalListing, type RentalListing } from "../api/rentalListingApi";
import SiteLayout from "../layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};
const PARKING_TYPE_LABEL: Record<string, string> = {
    NONE: "無停車位", RAMP: "坡道式", MECHANICAL: "機械式", TOWER: "塔式", UNDERGROUND: "地下室",
};
const SECURITY_TYPE_LABEL: Record<string, string> = {
    NONE: "無安管", PARTTIME: "兼職安管", FULLTIME: "全天安管",
};
const FEE_PAYER_LABEL: Record<string, string> = {
    TENANT: "租客負擔", OWNER: "房東負擔", SPLIT: "各半",
};
const GENDER_LABEL: Record<string, string> = {
    NONE: "不限", MALE: "限男性", FEMALE: "限女性",
};

type FurnishingKey = "has_sofa" | "has_bed" | "has_wardrobe" | "has_tv" | "has_fridge" |
    "has_ac" | "has_washer" | "has_water_heater" | "has_gas" | "has_internet" | "has_cable_tv";
type NearbyKey = "near_school" | "near_supermarket" | "near_convenience_store" | "near_park";

const FURNISHINGS: { key: FurnishingKey; label: string }[] = [
    { key: "has_sofa", label: "沙發" },
    { key: "has_bed", label: "床組" },
    { key: "has_wardrobe", label: "衣櫃" },
    { key: "has_tv", label: "電視" },
    { key: "has_fridge", label: "冰箱" },
    { key: "has_ac", label: "冷氣" },
    { key: "has_washer", label: "洗衣機" },
    { key: "has_water_heater", label: "熱水器" },
    { key: "has_gas", label: "天然瓦斯" },
    { key: "has_internet", label: "網路" },
    { key: "has_cable_tv", label: "第四台" },
];

const NEARBY: { key: NearbyKey; label: string }[] = [
    { key: "near_school", label: "近學校" },
    { key: "near_supermarket", label: "近超市" },
    { key: "near_convenience_store", label: "近便利商店" },
    { key: "near_park", label: "近公園" },
];

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
            <dd className="text-sm font-bold text-on-surface">{value ?? "—"}</dd>
        </div>
    );
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 px-4 first:pl-0">
            <span className="text-base font-bold text-on-surface">{value}</span>
            <span className="text-xs text-on-surface-variant">{label}</span>
        </div>
    );
}

export default function RentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isNaN(listingId)) return;
        getRentalListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;
    const areas = p ? [p.main_area, p.auxiliary_area, p.balcony_area].filter((v): v is number => v != null) : [];
    const totalArea = areas.length > 0 ? areas.reduce((a, b) => a + b, 0) : null;
    const areaParts = p ? [
        p.main_area != null ? `主建物 ${p.main_area} 坪` : null,
        p.auxiliary_area != null ? `附屬 ${p.auxiliary_area} 坪` : null,
        p.balcony_area != null ? `陽台 ${p.balcony_area} 坪` : null,
    ].filter(Boolean).join(" + ") : null;
    const nearbyActive = NEARBY.filter(n => listing[n.key]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/rent" className="text-sm text-on-surface-variant hover:text-primary">← 出租物件列表</Link>

                {/* Hero */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h1 className="text-2xl font-extrabold text-on-surface">{p?.title ?? `出租 #${listing.id}`}</h1>
                    <p className="mt-1 text-sm text-on-surface-variant">{p?.address ?? ""}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-black text-primary">NT$ {listing.monthly_rent.toLocaleString()}</span>
                        <span className="text-sm text-on-surface-variant">/ 月</span>
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">押金 {listing.deposit_months} 個月</p>
                    {p && (
                        <div className="mt-5 flex flex-wrap items-center divide-x divide-outline-variant/30 border-y border-outline-variant/15 py-4">
                            {totalArea != null && <StatItem label="坪數" value={`${totalArea.toFixed(1)} 坪`} />}
                            {p.rooms != null && <StatItem label="格局" value={`${p.rooms}房${p.living_rooms}廳${p.bathrooms}衛`} />}
                            {p.floor != null && <StatItem label="樓層" value={`${p.floor}F / ${p.total_floors}F`} />}
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {p?.building_type && (
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                {BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type}
                            </span>
                        )}
                        {listing.allow_pets && (
                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">可養寵物</span>
                        )}
                        {listing.allow_cooking && (
                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">可炊煮</span>
                        )}
                        {listing.gender_restriction && listing.gender_restriction !== "NONE" && (
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                {GENDER_LABEL[listing.gender_restriction] ?? listing.gender_restriction}
                            </span>
                        )}
                    </div>
                </section>

                {/* 出租條件 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出租條件</h2>
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
                        <InfoRow label="月租金" value={`NT$ ${listing.monthly_rent.toLocaleString()} / 月`} />
                        <InfoRow label="押金" value={`${listing.deposit_months} 個月`} />
                        <InfoRow label="最短租期" value={`${listing.min_lease_months} 個月`} />
                        <InfoRow label="管理費負擔" value={FEE_PAYER_LABEL[listing.management_fee_payer] ?? listing.management_fee_payer} />
                        <InfoRow label="開伙" value={listing.allow_cooking ? "可" : "不可"} />
                        <InfoRow label="寵物" value={listing.allow_pets ? "可" : "不可"} />
                        <InfoRow
                            label="性別限制"
                            value={listing.gender_restriction ? (GENDER_LABEL[listing.gender_restriction] ?? listing.gender_restriction) : null}
                        />
                    </dl>
                    {listing.notes && (
                        <div className="mt-6 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">特色說明</p>
                            <p className="mt-1 text-sm leading-relaxed text-on-surface">{listing.notes}</p>
                        </div>
                    )}
                </section>

                {/* 物件資料 */}
                {p && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">物件資料</h2>
                        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
                            {areaParts && totalArea != null && (
                                <div className="col-span-full flex flex-col gap-1">
                                    <dt className="text-xs font-semibold text-on-surface-variant">坪數</dt>
                                    <dd className="text-sm font-bold text-on-surface">
                                        <span className="text-on-surface-variant">{areaParts}</span>
                                        <span className="mx-2 text-on-surface-variant">=</span>
                                        <span className="text-primary">{totalArea.toFixed(1)} 坪</span>
                                    </dd>
                                </div>
                            )}
                            <InfoRow label="屋齡" value={p.building_age != null ? `${p.building_age} 年` : null} />
                            <InfoRow label="樓層" value={p.floor != null ? `${p.floor} / ${p.total_floors} 樓` : null} />
                            <InfoRow label="建物朝向" value={p.building_orientation ?? null} />
                            <InfoRow label="管理費" value={p.management_fee != null ? `NT$ ${p.management_fee.toLocaleString()} / 月` : null} />
                            <InfoRow label="警衛管理" value={p.security_type ? (SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type) : null} />
                            <InfoRow label="停車位" value={p.parking_type ? (PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type) : null} />
                        </dl>
                    </section>
                )}

                {/* 傢俱設備 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">傢俱設備</h2>
                    <div className="flex flex-wrap gap-3">
                        {FURNISHINGS.map(f => {
                            const has = listing[f.key];
                            return (
                                <span
                                    key={f.key}
                                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${has ? "bg-primary/10 text-primary" : "bg-surface-container-low text-on-surface-variant/40 line-through"}`}
                                >
                                    {f.label}
                                </span>
                            );
                        })}
                    </div>
                </section>

                {/* 周邊環境 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">周邊環境</h2>
                    {nearbyActive.length > 0 ? (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {nearbyActive.map(n => (
                                <span key={n.key} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary">
                                    {n.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mb-6 text-sm text-on-surface-variant">暫無資料</p>
                    )}
                    <div className="rounded-lg bg-surface-container-low p-4">
                        <p className="text-xs font-semibold text-on-surface-variant">交通資訊</p>
                        <p className="mt-1 text-sm text-on-surface-variant">—</p>
                    </div>
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Verify lint and build pass**

```bash
cd react-service && npm run lint && npm run build
```

Expected: exit 0 for both commands, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/pages/RentDetailPage.tsx
git commit -m "feat: rewrite RentDetailPage with 信義-style 5-section layout"
```

---

## Task 5: Seed data

**Files:**
- Modify: `infra/init/15-demo-properties.sql`

Update all 10 `INSERT INTO rental_listing` statements. Each currently ends with `created_at, updated_at` in the column list and the corresponding timestamp values. Add the 15 new columns and varied boolean values to each INSERT.

Pattern — add to **column list** after `created_at, updated_at`:
```sql
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
```

And add to **VALUES** after the two timestamp values.

- [ ] **Step 1: Update all 10 rental_listing INSERTs**

**Listing 1 — 大安路精裝兩房採光宅 (35000/月)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 35000, 2,
    'TENANT', 12, TRUE, TRUE,
    '近捷運科技大樓站，採光明亮，可開伙與設籍。',
    NOW() - INTERVAL '9 days', NOW() + INTERVAL '81 days',
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
    FALSE, TRUE, TRUE, FALSE
);
```

**Listing 2 — 信義世貿三房 (52000/月, 全配)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 52000, 2,
    'TENANT', 12, FALSE, TRUE,
    '社區管理完善，近世貿中心，機械停車位含租金。',
    NOW() - INTERVAL '8 days', NOW() + INTERVAL '82 days',
    NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
    FALSE, TRUE, TRUE, FALSE
);
```

**Listing 3 — 中山捷運套房 (16000/月, 套房基本配)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 16000, 2,
    'TENANT', 6, FALSE, FALSE,
    '近中山國小捷運站，生活機能成熟，適合單身上班族。',
    NOW() - INTERVAL '7 days', NOW() + INTERVAL '83 days',
    NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days',
    FALSE, FALSE, FALSE, TRUE, TRUE,
    TRUE, FALSE, TRUE, FALSE, TRUE, TRUE,
    FALSE, TRUE, TRUE, FALSE
);
```

**Listing 4 — 內湖科技兩房 (28000/月)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 28000, 2,
    'TENANT', 12, FALSE, TRUE,
    '步行至內湖科技園區，含機車停車位，有電梯。',
    NOW() - INTERVAL '6 days', NOW() + INTERVAL '84 days',
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days',
    FALSE, TRUE, TRUE, FALSE, TRUE,
    TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
    FALSE, TRUE, TRUE, FALSE
);
```

**Listing 5 — 木柵捷運三房 (32000/月, 家庭用)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 32000, 2,
    'OWNER', 12, TRUE, TRUE,
    '近木柵捷運站，前後陽台，適合家庭入住，可養寵物。',
    NOW() - INTERVAL '5 days', NOW() + INTERVAL '85 days',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, TRUE, FALSE,
    TRUE, TRUE, TRUE, TRUE
);
```

**Listing 6 — 板橋府中三房 (38000/月)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 38000, 2,
    'TENANT', 12, TRUE, TRUE,
    '步行至府中捷運站，含坡道停車位，屋況良好。',
    NOW() - INTERVAL '4 days', NOW() + INTERVAL '86 days',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days',
    TRUE, TRUE, TRUE, FALSE, TRUE,
    TRUE, TRUE, TRUE, TRUE, FALSE, TRUE,
    TRUE, TRUE, TRUE, FALSE
);
```

**Listing 7 — 中和景觀兩房 (24000/月)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 24000, 2,
    'TENANT', 12, FALSE, TRUE,
    '高樓層景觀，近中和環路，社區有管理員，機械停車。',
    NOW() - INTERVAL '3 days', NOW() + INTERVAL '87 days',
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days',
    FALSE, FALSE, TRUE, TRUE, TRUE,
    TRUE, FALSE, TRUE, FALSE, TRUE, FALSE,
    FALSE, TRUE, TRUE, TRUE
);
```

**Listing 8 — 新店碧潭兩房 (26000/月)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 26000, 2,
    'OWNER', 12, TRUE, TRUE,
    '近碧潭風景區，環境優美，步行至新店捷運站，可設籍。',
    NOW() - INTERVAL '2 days', NOW() + INTERVAL '88 days',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
    TRUE, TRUE, TRUE, FALSE, TRUE,
    TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
    TRUE, FALSE, TRUE, TRUE
);
```

**Listing 9 — 七期精裝兩房 (22000/月, 台中全配)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 22000, 2,
    'TENANT', 12, FALSE, TRUE,
    '台中七期核心地段，高樓層視野開闊，社區設施完善。',
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '89 days',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
    FALSE, TRUE, TRUE, FALSE
);
```

**Listing 10 — 北屯親子三房 (20000/月, 台中家庭)**
```sql
INSERT INTO rental_listing (
    property_id, status, duration_days, monthly_rent, deposit_months,
    management_fee_payer, min_lease_months, allow_pets, allow_cooking,
    notes, published_at, expires_at, created_at, updated_at,
    has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
    has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
    near_school, near_supermarket, near_convenience_store, near_park
) VALUES (
    prop_id, 'ACTIVE', 90, 20000, 2,
    'TENANT', 12, TRUE, TRUE,
    '鄰近北屯運動公園，適合親子家庭，含坡道停車位。',
    NOW() - INTERVAL '12 hours', NOW() + INTERVAL '89 days' + INTERVAL '12 hours',
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, FALSE, TRUE, FALSE,
    TRUE, FALSE, TRUE, TRUE
);
```

- [ ] **Step 2: Reset demo data and verify in browser**

Reset the DB to pick up the new seed data:
```bash
cd infra && docker compose down -v && docker compose up -d
cd ../go-service && docker compose up --build -d
```

Then open http://localhost:5173/rent, click any listing, and verify:
- 傢俱設備 section shows active (highlighted) vs inactive (strikethrough) pills correctly
- 周邊環境 section shows active tag pills (or "暫無資料" if all false)
- 交通資訊 shows "—"

- [ ] **Step 3: Commit**

```bash
git add infra/init/15-demo-properties.sql
git commit -m "chore: add furnishings and nearby-env demo data to rental listings"
```

---

## After all tasks: run finishing-a-development-branch skill
