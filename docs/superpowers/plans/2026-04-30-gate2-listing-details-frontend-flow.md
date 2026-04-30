# Gate2 Listing Details Frontend Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the owner-facing rent/sale detail UI to the listing detail page so the frontend completes the same publish-readiness flow as the backend.

**Architecture:** Keep the existing `ListingDetailPage` as the workflow owner, but move rent/sale detail form state and payload mapping into focused listing component files. The page opens the correct modal, submits to the existing detail API endpoints, reloads the listing, and lets the publish gate update from the refreshed backend state.

**Tech Stack:** React 19, TypeScript, Vite, existing `listingApi.ts` fetch helpers, Tailwind classes used by the current listing UI.

---

### Task 1: Detail Form Value Mapping

**Files:**
- Create: `react-service/src/components/listing/listingDetailValues.ts`

- [ ] Define rent and sale detail form value types that include shared listing fields plus type-specific fields.
- [ ] Add `listingToRentDetailValues(listing)` and `listingToSaleDetailValues(listing)` helpers that prefill existing listing and detail data.
- [ ] Add `rentDetailValuesToPayload(values)` and `saleDetailValuesToPayload(values)` helpers that return `UpdateRentDetailsPayload` and `UpdateSaleDetailsPayload`.

### Task 2: Detail Form Component

**Files:**
- Create: `react-service/src/components/listing/ListingDetailsForm.tsx`

- [ ] Build a reusable modal form for `"rent"` and `"sale"` modes.
- [ ] Include common listing fields needed by the backend detail endpoints.
- [ ] Include rent fields: monthly rent, deposit months, management fee, minimum lease, household registration, cooking, notes.
- [ ] Include sale fields: total price, unit price, main/auxiliary/balcony/land ping, parking type, parking price, notes.
- [ ] Disable submit until required backend fields are filled.

### Task 3: Listing Detail Page Integration

**Files:**
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

- [ ] Import detail API functions, payload types, and the new form component.
- [ ] Add rent/sale detail modals.
- [ ] Add owner action buttons after intent selection.
- [ ] Submit details through `updateRentDetails` or `updateSaleDetails`, then reload listing state.
- [ ] Show a compact read-only summary of existing rent or sale details in the listing article.

### Task 4: Verification and Commit

**Files:**
- Verify all changed files.

- [ ] Run `npm run build` in `react-service`.
- [ ] Run `rg --files | rg "\.(tmp|temp|bak|orig|log)$|\.go\.[0-9]+$|~$"` from repo root.
- [ ] Run `git diff --check`.
- [ ] Stage only the exact changed files.
- [ ] Commit with `feat: add listing rent sale detail flow`.
