# Listing Public Pages and Print Preview Design

## Purpose

This design upgrades the listing experience into a reusable public display system for sale and rental listings. It covers the buyer/tenant-facing listing pages first, then owner preview mode, then PDF and cover-image output. The implementation must keep the current project visual language and use the reference screenshots only for information architecture, search behavior, and content hierarchy.

The feature is part of the initial housing-platform phase. It completes the public sale/rental listing surface and creates the display architecture that later tenant demand pages and agent profile pages can reuse.

## Scope

In scope:

- Sale listing search/list page.
- Sale listing detail page.
- Rental listing search/list page.
- Rental listing detail page.
- Shared listing display model and reusable listing display components.
- Owner preview mode for draft or pre-publish listings.
- Full listing-book PDF output derived from the completed page/display components.
- Cover preview image output derived from the listing-book cover.
- Internal web preview capability kept available for owners, without opening public share-token URLs in this phase.
- Map search UI placeholders only.

Out of scope for this spec:

- Google Maps API integration, geocoding, map drawing, or map-based search.
- Public share-token preview links.
- Full tenant demand pages.
- Agent profile pages.
- Real estate transaction data ingestion from external services.
- Production PDF storage/versioning workflow beyond generating the output from the current listing state.

## Product Direction

The public display system serves two audiences:

- Finders: buyers and tenants who need to search, compare, inspect, save, and contact.
- Publishers: owners or agents who need to verify that the listing content is complete and presentable before publication.

The system uses one shared data and component architecture across public pages, owner preview, and print output. Pages are containers: they load data, select a mode, and compose reusable listing components. Components are display building blocks. A display-model layer normalizes backend `Listing` data into a stable frontend shape.

This keeps sale listings, rental listings, owner preview, PDF output, future tenant demands, and future agent profile extensions from growing separate field-formatting and presentation logic.

## Architecture

### Display Model

Create a listing display-model layer under `react-service/src/components/listing/`. It converts API `Listing` objects into a `ListingDisplayModel` that is easier for UI components to consume.

The display model should expose:

- Common listing fields: id, title, address, district, listing type, status, setup status, price, area, room/bath counts, floor, total floors, cover image, photo list when available, description, timestamps.
- Sale fields: total price, unit price, main building ping, auxiliary building ping, balcony ping, land ping, parking type, parking price, sale notes.
- Rental fields: monthly rent, deposit months, management fee, minimum lease, household registration, cooking, pet allowance, parking, rent notes.
- Trust fields: property verification status, completeness status, deed hash, disclosure hash, draft origin, source credential submission id when available.
- Preview/output fields: generated-at timestamp, preview watermark label, completeness state, missing-field list.

The display model is responsible for formatting intent and fallback decisions, such as:

- Sale price labels use total price and optional unit price.
- Rental price labels use monthly rent.
- Unknown or unavailable fields are omitted or displayed as not provided, never filled with fake inventory data.
- Missing required fields are collected for owner preview and print-preview completeness sections.

### Component Boundaries

Create reusable listing display components in `react-service/src/components/listing/`:

- `ListingSearchBar`: shared search/filter shell. It switches field sets by listing type.
- `ListingResultCard`: shared result card. Sale mode emphasizes total price, area, room layout, floor, and sale tags. Rental mode emphasizes monthly rent, area, room layout, floor, update time, and tenant-friendly tags.
- `ListingDetailShell`: shared detail page shell with `mode` support.
- `ListingHeroSection`: title, price/rent, media, address, key facts, status chips.
- `ListingFactsSection`: sale facts or rental facts.
- `ListingFeaturesSection`: features, equipment, condition, nearby amenities.
- `ListingTrustSection`: verification state, disclosure/deed hashes, platform trust status.
- `ListingContactPanel`: public contact/bookmark/appointment area or owner preview/publish information.
- `ListingPrintBook`: complete listing-book layout for PDF generation.
- `ListingCoverPreview`: cover-summary layout for preview-image generation.

`ListingDetailShell` supports these modes:

- `public`: buyer/tenant-facing. Shows save, share, appointment, and message actions when available.
- `ownerPreview`: owner/agent-facing. Shows preview status, missing fields, return-to-edit, and publish readiness. Visitor CTAs are hidden or disabled.
- `print`: PDF/image output. Hides interactive elements and adds watermark, generated-at timestamp, page headers, and page footers.

### Page Containers

Existing pages should become thinner containers:

- `ListingListPage`: loads listing data, tracks search/filter/sort/list-map UI state, renders `ListingSearchBar` and `ListingResultCard`.
- `ListingDetailPage`: loads a listing, builds a `ListingDisplayModel`, renders `ListingDetailShell mode="public"` for public listings or owner controls when accessed from owner routes.
- Owner preview route/page: loads the owner listing and renders `ListingDetailShell mode="ownerPreview"`.
- Print route/page: loads the listing and renders `ListingPrintBook` or `ListingCoverPreview` for output.

## Sale Listing List

The sale listing list uses the reference screenshots for search and result information hierarchy while keeping the project style.

Search fields:

- Area/city/district.
- Keyword: street, transit station, community, listing id, school.
- Property type.
- Total price.
- Room layout.
- More filters.
- Search action.

Result controls:

- Result-category tabs: all, price drop, low total price, new listings, platform curated.
- List/map toggle. Map mode is a placeholder in this phase.
- Sort dropdown: default, newest, price low to high, price high to low, area.

Sale result card:

- Cover image and optional photo count.
- Recommendation/status tags.
- Title.
- Address/district.
- Sale type or property type.
- Area, main/auxiliary area when available.
- Room/bath layout.
- Floor/total floors.
- Total price as the strongest numeric value.
- Optional old price or price-change marker only when real data exists.
- Feature tags such as balcony, windowed bathroom, room windows.
- Save/favorite action placeholder if supported by the existing auth flow.

## Rental Listing List

The rental list is intentionally more compact than the sale list because renters primarily scan rent, area, conditions, and update recency.

Search fields:

- City.
- District.
- Rent range.
- Type.
- Rental area.
- Tenant-friendly source/condition.
- More filters.
- Keyword: street, community, keyword, listing id.
- Search action with rental-specific wording.

Result controls:

- Breadcrumb or current filter summary.
- Result count.
- Sort dropdown: default, newest, rent low to high, rent high to low, area.
- List/map toggle placeholder.

Rental result card:

- Cover image and photo count.
- Title.
- Property/rental type.
- Area.
- Floor/total floors.
- Room/bath layout.
- Address/district.
- Updated time.
- Monthly rent as the strongest numeric value.
- Quick-save action placeholder.
- Tenant-friendly tags such as subsidy accepted, household registration allowed, students welcome, youth welcome, seniors welcome.

## Detail Pages

Sale and rental detail pages share `ListingDetailShell` and switch sections by listing type.

### Sale Detail

Top section:

- Breadcrumb/back affordance.
- Title, listing id, community/building reference when available.
- Address and district.
- Total price, optional unit price, optional price change.
- Save/share/print actions when supported.
- Key facts: building area, room/bath layout, age if available, property type, floor, parking, management fee.

Media:

- Main image.
- Image list/gallery when available.
- Placeholders for floorplan, 3D tour, video, or AI narration only as inactive future hooks when no data exists.

Facts:

- Building area, main building ping, auxiliary building ping, balcony ping, land ping.
- Parking type and parking price.
- Room layout, floor, total floors.
- Building structure, use, direction, security/management, management fee when available.

Features:

- Condition tags.
- Facilities.
- Nearby amenities.
- Recommendation notes.

Trust:

- Property verification status.
- Disclosure hash.
- Deed hash.
- Publish readiness.

Comparable/record section:

- Reserve a section for platform transaction records or comparable records.
- If data is not available, hide the section or show a neutral empty state. Do not synthesize market data.

### Rental Detail

Top section:

- Breadcrumb/back affordance.
- Title and listing id.
- Address and district.
- Monthly rent.
- Deposit, management fee, rental area, room/bath layout, floor.
- Save/share actions when supported.

Media:

- Main image.
- Image list/gallery.
- Map tab placeholder only.

Rental facts:

- Monthly rent.
- Deposit months.
- Management fee.
- Minimum lease.
- Can register household.
- Can cook.
- Pet allowance.
- Parking.
- Rental area and property area when available.
- Room/bath layout.
- Floor/total floors.

Furniture/equipment:

- Sofa, bed, wardrobe, TV, refrigerator, AC, washer, water heater, natural gas, internet, cable TV when these fields exist.
- If the backend does not yet expose equipment fields, keep the component boundary ready and omit the section.

Tenant-friendly tags:

- Subsidy accepted.
- Household registration allowed.
- Students welcome.
- Youth welcome.
- Seniors welcome.

Features and nearby:

- Owner/agent description.
- Nearby transportation, parks, shopping, and daily-life notes.
- Map and transit details are placeholders until map integration is prioritized.

## Owner Preview Mode

Owner preview is a mode of the same detail display, not a separate design.

It shows:

- Preview banner: draft/pre-publish/active state.
- Missing-field summary.
- Listing completeness status.
- Return-to-edit action.
- Publish action when backend readiness allows it.
- Internal preview route support.
- Visitor actions disabled or hidden.
- Watermark or label indicating that this is not the public listing.

Public share-token preview links are not exposed in this phase. The route and component architecture should not block adding them later.

## PDF and Cover Preview Output

PDF output happens after the public/preview page components are stable. The PDF is an output mode derived from the same display model and sections, not a separately designed source of truth.

### Full Listing Book

The listing book is a multi-page document for owner/agent review and transmission. It is not a one-page marketing card.

Content order:

1. Cover page:
   - Title, sale/rent type, main photo.
   - Sale summary: total price, unit price, area, layout, floor.
   - Rental summary: monthly rent, deposit, rental area, layout, floor.
   - Listing id, generated-at time, status.
   - Preview watermark.
2. Listing summary and publisher information:
   - Address, district, community/building, type, update time.
   - Publisher/contact visibility state.
   - Trust summary.
3. Facts:
   - Sale fields or rental fields.
4. Features and equipment:
   - Sale features or rental equipment/tenant-friendly tags.
5. Photos and space:
   - Main image and available house-condition photos.
   - Future hooks for floorplan/3D/video.
6. Nearby and records:
   - Nearby amenities when available.
   - Sale comparable/platform records when available.
7. Completeness and missing fields:
   - Visible in owner preview/print preview.
   - Omitted or reduced for final public-facing exports if needed later.

### Cover Preview Image

The cover image uses the same content as the listing-book cover page. It is intended for quick review in chat or lightweight sharing, but it does not replace the full PDF.

## Map Search and Nearby Data

Map functions are placeholders in this phase.

Rules:

- Provide list/map toggle UI.
- Provide map-search tabs where appropriate.
- Clicking map mode shows a clear unavailable/coming-later state.
- Do not add Google Maps API, API keys, geocoding, or coordinate search.
- Detail-page nearby sections can show text/card placeholders or available static data.
- Map integration becomes an optimization item after listing, tenant demand, agent profile, and mediation flow are complete.

## Implementation Order

1. Build `ListingDisplayModel` and helper formatters.
2. Extract shared listing search/card/detail components.
3. Update sale/rental list pages using the shared list architecture.
4. Update sale/rental detail pages using `ListingDetailShell`.
5. Add owner preview mode and internal route.
6. Add print mode, PDF layout, print CSS, and cover preview image layout.
7. Record follow-up specs for tenant demand pages and agent profile/mediation flow.

The implementation should not start with PDF. PDF comes after the page components are complete, so it can reuse the same display model and sections.

## Error Handling and Empty States

- Missing optional fields are omitted or shown as not provided.
- Missing required publish fields appear in owner preview completeness warnings.
- Public pages must not show fake prices, fake photos, fake amenities, or fake transaction records.
- If listings fail to load, show the existing project-style error state.
- If map mode is selected, show a disabled/coming-later message rather than an empty map.
- If a listing is inaccessible because of permissions or status, show a clear unavailable state.

## Testing and Verification

Frontend verification:

- Build succeeds with `npm run build`.
- Public list pages render sale and rental cards with the correct field emphasis.
- Detail pages render sale and rental sections without duplicate formatting logic.
- Owner preview hides visitor actions and shows missing-field information.
- Print mode hides interactive controls and includes watermark/generated-at information.
- Empty states do not invent unavailable data.
- Responsive layout is checked for list, detail, preview, and print routes.

Backend/API verification:

- Use existing listing endpoints first.
- Add backend fields only when needed by real UI requirements.
- Do not introduce map API dependencies in this phase.

## Phase Completion Roadmap

This spec completes the listing public-display foundation. The initial phase still needs two follow-up specs:

1. Tenant demand pages:
   - Demand list, demand detail, search/filtering, owner/agent matching context.
   - Reuse the display-model and component-boundary approach from listings.
2. Agent profile and mediation flow:
   - Agent public profile, service area, specialties, trusted activity, related listings/demands.
   - Connect listing detail, demand detail, appointment, and mediation status into a coherent flow.

After these are complete, map search and nearby Google API integration can be prioritized as a product-quality optimization.
