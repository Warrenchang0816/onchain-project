# Property & Listing Redesign

**Date:** 2026-05-07
**Scope:** Full-stack — Go backend + React frontend

## Problem

The current architecture is backend-designed-for-frontend: a single `listing` table mixes physical property data with listing commercial conditions, and the UI reflects this confusion with overlapping forms. The result is duplicated data, nullable columns for type-specific fields (rent vs. sale), and no clean separation between what a property *is* versus how it is *listed*.

## Solution

Three-table Concrete Table Inheritance:

- `property` — all physical property data, owned independently of any listing
- `rental_listing` — rent conditions, references `property_id`
- `sale_listing` — sale conditions, references `property_id`

Frontend derives its list and detail views from queries against these tables. One property can have an active `rental_listing` and an active `sale_listing` simultaneously.

---

## Section 1 — Database Schema

### `property`

| Column group | Columns |
|---|---|
| Identity | `id`, `owner_id`, `created_at`, `updated_at` |
| Basic | `title`, `address`, `district_id`, `building_type` (APARTMENT / BUILDING / TOWNHOUSE / STUDIO) |
| Floor | `floor`, `total_floors` |
| Area (ping) | `main_area`, `auxiliary_area`, `balcony_area`, `shared_area`, `awning_area`, `land_area` |
| Layout | `rooms`, `living_rooms`, `bathrooms`, `is_corner_unit`, `has_dark_room` |
| Building | `building_age`, `building_structure`, `exterior_material`, `building_usage`, `zoning`, `units_on_floor` |
| Orientation | `building_orientation`, `window_orientation` |
| Amenities | `parking_type` (NONE / RAMP / MECHANICAL / TOWER), `management_fee`, `security_type` (NONE / FULLTIME / PARTTIME) |
| Status | `setup_status` (DRAFT / READY) |

### `property_attachments`

`id`, `property_id`, `type` (PHOTO / DEED / FLOOR_PLAN / DISCLOSURE), `url`, `created_at`

### `rental_listing`

`id`, `property_id`, `status` (ACTIVE / NEGOTIATING / LOCKED / CLOSED / EXPIRED), `duration_days`, `monthly_rent`, `deposit_months`, `management_fee_payer`, `min_lease_months`, `allow_pets`, `allow_cooking`, `gender_restriction`, `notes`, `created_at`, `updated_at`

### `sale_listing`

`id`, `property_id`, `status` (ACTIVE / NEGOTIATING / LOCKED / CLOSED / EXPIRED), `duration_days`, `total_price`, `unit_price_per_ping`, `parking_type`, `parking_price`, `notes`, `created_at`, `updated_at`

---

## Section 2 — Backend API

All responses use the existing envelope: `{ "success": true, "data": <T>, "message": "" }`

### Property API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/properties` | OWNER | Create property draft |
| GET | `/api/properties/:id` | OWNER (own) | Full property detail |
| PUT | `/api/properties/:id` | OWNER (own) | Update property |
| DELETE | `/api/properties/:id` | OWNER (own) | Delete draft only (status = DRAFT) |
| POST | `/api/properties/:id/attachments` | OWNER (own) | Upload attachment |
| DELETE | `/api/properties/:id/attachments/:aid` | OWNER (own) | Delete attachment |

### Rental Listing API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rental-listings` | Public | Rental list with basic property fields |
| POST | `/api/properties/:id/rental-listing` | OWNER (own) | Create rental listing for property |
| GET | `/api/rental-listings/:id` | Public | Rental detail with full property join |
| PUT | `/api/rental-listings/:id` | OWNER (own) | Update rental conditions |
| POST | `/api/rental-listings/:id/publish` | OWNER (own) | Publish listing |
| POST | `/api/rental-listings/:id/close` | OWNER (own) | Close listing |

### Sale Listing API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/sale-listings` | Public | Sale list with basic property fields |
| POST | `/api/properties/:id/sale-listing` | OWNER (own) | Create sale listing for property |
| GET | `/api/sale-listings/:id` | Public | Sale detail with full property join |
| PUT | `/api/sale-listings/:id` | OWNER (own) | Update sale conditions |
| POST | `/api/sale-listings/:id/publish` | OWNER (own) | Publish listing |
| POST | `/api/sale-listings/:id/close` | OWNER (own) | Close listing |

### Migration

`/api/listings` and `/api/listings/:id` remain active during migration, redirecting to new endpoints. Removed once all frontend routes are updated.

---

## Section 3 — Frontend Routes

### Header Navigation

| Before | After |
|---|---|
| 房源列表 (`/listings`) | 出售物件 (`/sale`) |
| — | 出租物件 (`/rent`) |
| 租屋需求 | 租屋需求 (unchanged) |
| 仲介列表 | 仲介列表 (unchanged) |

### Public Routes

| Path | Page | Description |
|---|---|---|
| `/sale` | `SaleListPage` | Sale listings with search/filter |
| `/sale/:id` | `SaleDetailPage` | Sale detail with full property data |
| `/rent` | `RentListPage` | Rental listings with search/filter |
| `/rent/:id` | `RentDetailPage` | Rental detail with full property data |

### Owner Routes

| Path | Page | Description |
|---|---|---|
| `/my/properties` | `MyPropertiesPage` | Property dashboard with "新增物件" button |
| `/my/properties/new` | `PropertyCreatePage` | Single-form property creation |
| `/my/properties/:id` | `PropertyEditPage` | Edit property with completeness bar |
| `/my/properties/:id/rent` | `RentalListingPage` | Create/edit rental listing conditions |
| `/my/properties/:id/sale` | `SaleListingPage` | Create/edit sale listing conditions |

### Legacy Redirects

`/listings` → `/sale`, `/listings/:id` → `/sale/:id`, `/my/listings/*` → `/my/properties/*`

---

## Section 4 — Property Form Fields & Completeness

### PropertyCreatePage / PropertyEditPage

Single scrollable page, three labelled sections.

**Section A — 基本資料** (required, affects completeness)

| Field | Type | Notes |
|---|---|---|
| 建物類型 | select | 公寓 / 大樓 / 透天 / 套房 |
| 地址 | text | |
| 行政區 | DistrictSelect | reuse existing component |
| 樓層 / 總樓層 | number × 2 | |
| 主建物坪 / 附屬建物坪 / 陽台坪 | number × 3 | |
| 共有部份坪 / 雨遮坪 / 土地坪 | number × 3 | |
| 格局：房 / 廳 / 衛 | number × 3 | |
| 屋齡 | number | years |
| 車位類型 | select | 無 / 坡道平面 / 機械 / 塔式 |
| 管理費 | number | NTD/month, 0 = none |

**Section B — 物件詳情** (target required, currently optional)

| Field | Type |
|---|---|
| 建物結構 | select (加強磚造 / 鋼筋混凝土 / 鋼骨 / 木造) |
| 外牆建材 | text |
| 建物朝向 | select (東 / 西 / 南 / 北 / 東南 / 西南 / 東北 / 西北) |
| 落地窗朝向 | select (same options) |
| 邊間 / 暗房 | checkbox × 2 |
| 警衛管理 | select (無 / 全天候 / 部分時段) |
| 謄本用途 | text |
| 使用分區 | text |
| 該層戶數 | number |

**Section C — 可信附件** (currently optional, target: at least one photo)

Photo upload, floor plan, deed/謄本, disclosure documents.

### Completeness Gate

| Phase | READY condition |
|---|---|
| Development (now) | Section A fully filled + at least 1 photo |
| Target | Section A + B fully filled + at least 1 photo |

Completeness progress bar shown on `PropertyEditPage`. "上架出租" and "上架出售" buttons only appear when `setup_status = READY`.

---

## Out of Scope

- Appointment booking logic (unchanged, moves to rental/sale listing level)
- KYC / credential gates (OWNER requirement unchanged)
- Agent-facing flows
