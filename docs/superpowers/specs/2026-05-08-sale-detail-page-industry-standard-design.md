# Sale Detail Page — Industry-Standard Info Architecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `SaleDetailPage` to match the information architecture used by major Taiwanese real estate platforms (信義房屋 as reference), while keeping the existing project visual style.

**Architecture:** Changes span four layers — Go DTO, Go repository SQL, TypeScript API types, and React page component. No DB schema changes needed: all new fields already exist in `property` table and `Property` model.

**Scope:** `SaleDetailPage` and `SaleListingResponse / PropertySummaryResponse` in the `sale_listing` module. `RentDetailPage` follows the same pattern in a separate task.

---

## Information Architecture (Reference: 信義房屋)

### Section 1 — Hero
| Element | Data source | Notes |
|---------|------------|-------|
| Property title | `property.title` | h1, large |
| Address | `property.address` | subtitle |
| 總價 | `listing.total_price` | **Large primary-color number**, e.g. "4,500萬" |
| 建坪單價副標 | `listing.unit_price_per_ping` | shown as "建坪單價 X萬/坪" below price |
| Building type chip | `property.building_type` | existing chip |
| Floor chip | `property.floor / total_floors` | existing chip |
| Layout chip | `property.rooms/living_rooms/bathrooms` | existing chip |
| 邊間 chip | `property.is_corner_unit` | existing chip |
| Security chip | `property.security_type` | existing chip |

### Quick Stats Strip (below chips)
Five items in a horizontal band:
| Label | Value |
|-------|-------|
| 建坪 | `main_area` 坪 |
| 格局 | `{rooms}房{living_rooms}廳{bathrooms}衛` |
| 屋齡 | `{building_age}年 · {building_type}` |
| 樓層 | `{floor}/{total_floors}樓` |
| 車位 | `parking_type` label (PARKING_TYPE_LABEL) |

### Section 2 — 基本資料
Grid of InfoRow cards (3 columns, existing style):

| Row | Col 1 | Col 2 | Col 3 |
|-----|-------|-------|-------|
| 1 | 建坪單價 | 建坪（登記） | 地坪 🆕 |
| 2 | **面積拆解方程式** (full width): 主建物 X坪 ＋ 附屬建物 X坪 ＋ 陽台 X坪 ＝ 合計 X坪 | | |
| 3 | 共有部份 🆕 | 雨遮 🆕 | 屋齡 |
| 4 | 格局 | 建物類型 | 樓層 |
| 5 | 邊間 / 暗房 🔧 | 建物朝向 | 落地窗朝向 |
| 6 | 警衛管理 | 管理費 | 車位類型 |

**邊間/暗房** — displayed as "是/否" or "否/否" in one InfoRow, combining `is_corner_unit` + `has_dark_room`.

**面積拆解** — special full-width row below row 1. Only rendered if at least one of main_area / auxiliary_area / balcony_area is non-null.

**Empty fields** — show "—" (em dash). All fields always rendered.

### Section 3 — 建物詳情 🆕 (new section)
Grid of InfoRow cards (3 columns):

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| 建物結構 | 外牆建材 | 該層戶數 |
| 謄本用途 | 使用分區 | — |

Only render this section if at least one of the six fields is non-null.

### Section 4 — 出售條件
Existing section, no layout change:
- 總價, 建坪單價, 車位類型, 車位價格, 刊登到期, 備注

---

## Backend Changes

### `go-service/internal/modules/sale_listing/dto.go`
Add to `PropertySummaryResponse`:
```go
HasDarkRoom        bool     `json:"has_dark_room"`
LandArea           *float64 `json:"land_area,omitempty"`
SharedArea         *float64 `json:"shared_area,omitempty"`
AwningArea         *float64 `json:"awning_area,omitempty"`
BuildingStructure  *string  `json:"building_structure,omitempty"`
ExteriorMaterial   *string  `json:"exterior_material,omitempty"`
BuildingUsage      *string  `json:"building_usage,omitempty"`
Zoning             *string  `json:"zoning,omitempty"`
UnitsOnFloor       *int32   `json:"units_on_floor,omitempty"`
```

### `go-service/internal/db/repository/property_repo.go`
`FindByID` SELECT already fetches all columns via model scan. Verify the scan maps these new fields:
- `has_dark_room`, `land_area`, `shared_area` (column: `awning_area`), `building_structure`, `exterior_material`, `building_usage`, `zoning`, `units_on_floor`

### Handler / Service (`sale_listing` module)
The `toPropertySummaryResponse` mapping function (in handler or service) must copy the new fields from `model.Property` to `PropertySummaryResponse`.

---

## Frontend Changes

### `react-service/src/api/saleListingApi.ts`
Add to `PropertySummary` type:
```typescript
has_dark_room: boolean;
land_area?: number;
shared_area?: number;
awning_area?: number;
building_structure?: string;
exterior_material?: string;
building_usage?: string;
zoning?: string;
units_on_floor?: number;
```

### `react-service/src/pages/SaleDetailPage.tsx`
Full rewrite of page content:

1. **Hero**: price as large styled number (万 unit), unit price subtitle, existing chips, new stats strip
2. **基本資料 section**: 3-col InfoRow grid + full-width area equation row
3. **建物詳情 section**: conditional (only if any field non-null)
4. **出售條件 section**: existing content, no change

Helper: `formatWan(price: number)` — converts raw NT$ to 萬 with one decimal, e.g. `45000000 → "4,500萬"`.

---

## Seed Data Changes

### `infra/init/15-demo-properties.sql`

Update INSERT statements for all 20 properties to populate a realistic subset of new fields. Strategy:
- **建物結構**: fill for all 20 (BUILDING/APARTMENT → 鋼筋混凝土; TOWNHOUSE → 鋼骨)
- **外牆建材**: fill for ~14/20 (leave 6 blank for realism)
- **謄本用途**: fill for all 20 (住宅 → 集合住宅; 透天 → 透天住宅)
- **使用分區**: fill for ~16/20
- **該層戶數**: fill for BUILDING/APARTMENT types only (~16/20)
- **地坪 (land_area)**: fill only for TOWNHOUSE properties (北投溫泉透天, 南屯透天別墅, 北屯親子三房 area approx)
- **共有部份 (shared_area)**: fill for BUILDING type with FULLTIME/PARTTIME security (~10/20)
- **雨遮 (awning_area)**: fill for ~8/20 older buildings

---

## What Does NOT Change
- Visual style: all existing Tailwind classes, color tokens, `InfoRow` component
- Route structure
- `RentDetailPage` (separate task, same pattern)
- Any other page

---

## Out of Scope
- Photo gallery
- Map / nearby facilities
- Mortgage calculator
- Agent contact panel
- `RentDetailPage` (follow-up)
