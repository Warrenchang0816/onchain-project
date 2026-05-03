# Rental Matching Search Foundation Design

## Purpose

This design upgrades the rental side of the platform from a simple tenant-requirement list into a reusable matching-ready foundation. It keeps the first implementation intentionally explainable: structured rental listing data, structured tenant requirement data, shared search components, and lightweight match scoring.

The goal is not to build a heavy recommendation engine yet. The goal is to make every rental listing and tenant requirement comparable by the same filters so the whole site can later surface matches consistently for tenants, owners, and agents.

## Scope

In scope:

- Rental listing creation and draft editing improvements.
- Tenant requirement creation and draft editing improvements.
- Multi-county and multi-district search/selection.
- Shared district selector backed by `GET /api/locations/districts`.
- Shared rental/search filter state that listing and requirement pages can reuse.
- Tenant requirement list and detail page rewrite.
- Rental listing list/detail search improvements.
- Database changes for structured tenant requirement districts and rental criteria.
- Lightweight match scoring between rental listings and tenant requirements.
- Fixing broken Traditional Chinese copy on rental/requirement pages touched by this work.
- Seed data enough to exercise rental listing and tenant requirement matching.

Out of scope:

- Buy-side demand pages.
- Sale-specific matching beyond preserving existing sale listing behavior.
- Map provider integration or geocoding.
- Full recommendation feeds, machine-learning ranking, or automated notifications.
- Saved searches, subscriptions, chat, or agent assignment workflow.
- Public anonymous requirement browsing. Requirement browsing remains behind the existing role-gated routes.

## Product Direction

Rental listings and tenant requirements should use one compatible information shape:

- A rental listing describes what the unit offers.
- A tenant requirement describes what the tenant wants.
- Search filters describe how a user narrows either side.
- Match scoring explains why a listing and requirement fit or do not fit.

This keeps the platform from building separate one-off search systems for listings, tenant demand pages, owner dashboards, and agent workbenches. The first version should feel practical and transparent instead of clever: users should understand why something matched.

## Data Model

### Tenant Requirements

Keep `tenant_requirements` as the requirement root table and extend it with structured rental criteria:

- `budget_min`
- `budget_max`
- `area_min_ping`
- `area_max_ping`
- `room_min`
- `bathroom_min`
- `move_in_date`
- `move_in_timeline`
- `minimum_lease_months`
- `pet_friendly_needed`
- `parking_needed`
- `can_cook_needed`
- `can_register_household_needed`
- `layout_note`
- `lifestyle_note`
- `must_have_note`
- `status`

`target_district` can remain during migration for backward compatibility, but new code should read and write selected districts through the structured district table.

### Requirement Districts

Create `tenant_requirement_districts`:

- `id`
- `requirement_id`
- `county`
- `district`
- `zip_code`
- `created_at`

A requirement can select districts across multiple counties. The API should return districts in stable county and zip-code order.

### Rental Listings

Rental listings already have common listing fields and `rent_details`. This work should make rental listing creation and editing expose the same fields that tenant requirements can compare against:

- district
- price/monthly rent
- area ping
- room count
- bathroom count
- floor and total floors
- pet allowance
- parking included
- cooking allowed
- household registration allowed
- minimum lease months
- deposit months
- management fee
- description and rental notes

The listing location remains a single district because a physical property has one address. Search can still select many districts.

## API Design

### Location API

Continue using:

- `GET /api/locations/districts`

The frontend should not hard-code county/district options.

### Tenant Requirement API

Update existing endpoints:

- `GET /api/tenant/requirements/mine`
- `POST /api/tenant/requirements`
- `PUT /api/tenant/requirements/:id`
- `PUT /api/tenant/requirements/:id/status`
- `GET /api/requirements`
- `GET /api/requirements/:id`

Payloads should include:

- `districts: Array<{ county: string; district: string; zipCode: string }>`
- structured rental criteria listed in the data model
- existing status and timestamps

List filters should support:

- `districts`, encoded as repeated query values or a comma-separated stable token list
- `county`
- budget range
- area range
- room minimum
- bathroom minimum
- pet, parking, cooking, household registration flags
- status
- keyword

### Match API

First version can expose match information as part of list/detail responses when the authenticated viewer has enough context:

- Tenant viewing rental listings: compare each listing to the tenant's open requirements.
- Owner or agent viewing tenant requirements: compare each requirement to owned or relevant rental listings when available.

The response shape should be reusable:

```ts
type MatchSummary = {
  score: number;
  level: "GOOD" | "PARTIAL" | "LOW";
  matchedReasons: string[];
  missingReasons: string[];
};
```

If there is no comparison context, omit `match` instead of returning a fake score.

## Matching Rules

The first scoring version should be deterministic and easy to test.

Suggested scoring:

- District match: 30 points.
- Budget match: 20 points.
- Area range match: 10 points.
- Room count match: 10 points.
- Bathroom count match: 5 points.
- Pet allowance match when required: 5 points.
- Parking match when required: 5 points.
- Cooking match when required: 5 points.
- Household registration match when required: 5 points.
- Lease and move-in compatibility: 5 points.

Levels:

- `GOOD`: score >= 80 and no required boolean condition is missing.
- `PARTIAL`: score >= 50 or only soft criteria are missing.
- `LOW`: score < 50 or a required boolean condition is missing.

Required boolean misses should always appear in `missingReasons`, even when the numeric score is otherwise high.

## Frontend Components

### District Multi Select

Create a shared district selector used by listing search, requirement search, and tenant requirement forms:

- Data source: `GET /api/locations/districts`.
- Supports multi-county and multi-district selection.
- Left column: counties.
- Right column: district checkboxes for the active county.
- Summary label: examples include `No district limit`, `Taipei City 3 districts`, `3 counties 8 districts`. The UI can localize these labels in Traditional Chinese during implementation.
- Clear all action.
- Keyboard and outside-click closing behavior.

For listing draft forms, configure the same component in single-district mode because a property has one actual district.

### Shared Search Filter Bar

Create reusable filter state and UI pieces for rental-facing pages:

- district selection
- keyword
- budget/rent range
- area range
- room minimum
- bathroom minimum
- pet
- parking
- cooking
- household registration
- sort

Pages configure which controls are visible. The component should not know whether it is rendering listing search or requirement search beyond the supplied labels and enabled controls.

### Tenant Requirement Form

Replace the current inline requirement form with a fuller draft form:

- target districts
- rent budget
- area range
- room and bathroom minimums
- move-in date or timeline
- minimum lease
- pet, parking, cooking, household registration requirements
- layout note
- lifestyle note
- must-have note

The form should support create and edit from the same component.

### Requirement List and Detail

Rewrite tenant requirement list and detail pages to match the listing display architecture:

- cards with district summary, budget, area, room/bath needs, move-in timing, and required condition chips
- detail shell with sections for search areas, budget/space, required conditions, notes, and tenant profile visibility
- role-appropriate actions for tenant, owner, and agent viewers
- readable Traditional Chinese copy

## Page Behavior

### Rental Listing List

Rental listing search should use multi-district filters. A listing matches the district filter when its single district is included in the selected district set.

### Tenant Requirement List

Requirement search should use the same district picker. A requirement matches the district filter when any of its selected districts intersects the filter set.

### Tenant Requirement Detail

Detail pages should show all selected districts grouped by county and list match summaries when the viewer has a listing context.

### My Requirements

The tenant workbench should show requirement status counts, create/edit actions, and the richer draft form. It should not require advanced tenant profile documents before creating a basic requirement.

## Migration Strategy

The migration should be idempotent and compatible with existing local databases:

1. Add new nullable columns to `tenant_requirements`.
2. Add `tenant_requirement_districts`.
3. Backfill one district row from existing `target_district` when possible.
4. Keep `target_district` populated as a readable summary during the first version.
5. Update repositories to read/write the structured table.

No existing requirement should disappear because of this migration.

## Testing

Backend tests:

- Requirement create/update persists multi-county district selections.
- Requirement list filters by district intersection.
- Existing single `target_district` data backfills into structured districts.
- Match scoring returns expected score, level, matched reasons, and missing reasons.
- Role-gated requirement visibility remains intact.

Frontend tests:

- District multi-select groups counties and supports multiple counties.
- District selection summary labels are stable.
- Requirement form converts values into the expected API payload.
- Requirement list/detail display models format budget, districts, conditions, and match summaries.
- Existing listing search behavior still works with the shared district selector.

Verification commands:

- `go test ./...`
- `node --experimental-strip-types tests/listingDistrictOptions.test.ts`
- new frontend unit tests for district multi-select/filter helpers
- `npm run build`

## Rollout Notes

Implement in small commits:

1. Backend schema and repository support.
2. Match scoring domain logic.
3. Frontend district multi-select foundation.
4. Requirement API types and form helpers.
5. Requirement create/edit/list/detail UI rewrite.
6. Listing search integration.
7. Seed data and final verification.

This order keeps database compatibility first, then makes shared UI usable, then upgrades pages.
