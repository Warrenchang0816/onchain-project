# Gate 2 Listing Rent/Sale Details Relational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete owner-only rent and sale detail APIs for Gate 2 listing drafts.

**Architecture:** Keep `listings` as the shared listing workflow/read-summary table. Add one-to-one `listing_rent_details` and `listing_sale_details` tables so rent/sale fields remain relationally clear and adjustable without bloating the main table.

**Tech Stack:** Go, Gin, PostgreSQL init SQL, focused Go tests.

---

## Task 1: Domain Readiness Rules

**Files:**
- Modify: `go-service/internal/db/model/listing_model.go`
- Modify: `go-service/internal/modules/listing/domain.go`
- Modify: `go-service/internal/modules/listing/domain_test.go`

- [x] Add `ListingRentDetails` and `ListingSaleDetails` model structs.
- [x] Add `RentDetails` and `SaleDetails` pointers to `model.Listing`.
- [x] Extend setup readiness so `RENT` requires rent details and `SALE` requires sale details.
- [x] Verify with focused listing domain tests.

## Task 2: Relational Storage

**Files:**
- Modify: `infra/init/10-properties.sql`
- Modify: `go-service/internal/db/repository/listing_repo.go`

- [x] Create `listing_rent_details` and `listing_sale_details` tables with `listing_id UNIQUE` foreign keys.
- [x] Add repository upsert methods for rent and sale details.
- [x] Load details for owner/detail listing reads so API responses can include them.

## Task 3: API and Service

**Files:**
- Modify: `go-service/internal/modules/listing/dto.go`
- Modify: `go-service/internal/modules/listing/service.go`
- Modify: `go-service/internal/modules/listing/handler.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [x] Add `UpdateRentDetailsRequest` and `UpdateSaleDetailsRequest`.
- [x] Add rent/sale response payloads to `ListingResponse`.
- [x] Add `UpdateRentDetails` and `UpdateSaleDetails` service methods.
- [x] Add protected routes:
  - `PUT /api/listings/:id/rent-details`
  - `PUT /api/listings/:id/sale-details`

## Task 4: Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-29-gate2-listing-intent-rent-sale-implementation.md`

- [x] Run focused listing tests.
- [x] Run full Go tests.
- [x] Scan for temp files before final status.
- [x] Update the existing Gate 2 listing plan with the relational details continuation.
