# Sale Detail Page — Industry-Standard Info Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sale listing detail page to match the information architecture of major Taiwanese real estate platforms (信義房屋 reference), while keeping the existing project visual style.

**Architecture:** Four-layer change — (1) Go DTO adds 9 new fields, (2) Go handler `toResponse` maps them, (3) TypeScript type mirrors the DTO, (4) React page gets new sections. No DB schema changes — all columns already exist. Seed SQL also updated so demo pages show realistic data.

**Tech Stack:** Go 1.25 / Gin backend (Docker), React 19 / TypeScript 5 / Tailwind frontend (Vite dev server), PostgreSQL via Docker.

---

## File Map

| File | Change |
|------|--------|
| `go-service/internal/modules/sale_listing/dto.go` | Add 9 fields to `PropertySummaryResponse` |
| `go-service/internal/modules/sale_listing/handler.go` | Add 9 field mappings in `toResponse()` |
| `react-service/src/api/saleListingApi.ts` | Add 9 fields to `PropertySummary` type |
| `react-service/src/pages/SaleDetailPage.tsx` | Full rewrite — 4 sections + helpers |
| `infra/init/15-demo-properties.sql` | Add new columns to all 20 INSERT statements |

No new files. No other files touched.

---

## Task 1: Go DTO — Add new fields to PropertySummaryResponse

**Files:**
- Modify: `go-service/internal/modules/sale_listing/dto.go`

- [ ] **Step 1: Open dto.go and replace `PropertySummaryResponse`**

Current file is at `go-service/internal/modules/sale_listing/dto.go`. Replace the entire `PropertySummaryResponse` struct with:

```go
type PropertySummaryResponse struct {
	ID                  int64    `json:"id"`
	Title               string   `json:"title"`
	Address             string   `json:"address"`
	BuildingType        string   `json:"building_type"`
	Floor               *int32   `json:"floor,omitempty"`
	TotalFloors         *int32   `json:"total_floors,omitempty"`
	MainArea            *float64 `json:"main_area,omitempty"`
	AuxiliaryArea       *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea         *float64 `json:"balcony_area,omitempty"`
	SharedArea          *float64 `json:"shared_area,omitempty"`
	AwningArea          *float64 `json:"awning_area,omitempty"`
	LandArea            *float64 `json:"land_area,omitempty"`
	Rooms               *int32   `json:"rooms,omitempty"`
	LivingRooms         *int32   `json:"living_rooms,omitempty"`
	Bathrooms           *int32   `json:"bathrooms,omitempty"`
	BuildingAge         *int32   `json:"building_age,omitempty"`
	ParkingType         string   `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee,omitempty"`
	IsCornerUnit        bool     `json:"is_corner_unit"`
	HasDarkRoom         bool     `json:"has_dark_room"`
	SecurityType        string   `json:"security_type"`
	BuildingOrientation *string  `json:"building_orientation,omitempty"`
	WindowOrientation   *string  `json:"window_orientation,omitempty"`
	BuildingStructure   *string  `json:"building_structure,omitempty"`
	ExteriorMaterial    *string  `json:"exterior_material,omitempty"`
	BuildingUsage       *string  `json:"building_usage,omitempty"`
	Zoning              *string  `json:"zoning,omitempty"`
	UnitsOnFloor        *int32   `json:"units_on_floor,omitempty"`
}
```

- [ ] **Step 2: Update `toResponse()` in handler.go — add new field mappings**

In `go-service/internal/modules/sale_listing/handler.go`, find the `toResponse` function (line ~131). Inside the `if sl.Property != nil` block, after the existing `WindowOrientation` mapping (around line 208), add:

```go
		pResp.HasDarkRoom = p.HasDarkRoom
		if p.SharedArea.Valid {
			v := p.SharedArea.Float64
			pResp.SharedArea = &v
		}
		if p.AwningArea.Valid {
			v := p.AwningArea.Float64
			pResp.AwningArea = &v
		}
		if p.LandArea.Valid {
			v := p.LandArea.Float64
			pResp.LandArea = &v
		}
		if p.BuildingStructure.Valid {
			pResp.BuildingStructure = &p.BuildingStructure.String
		}
		if p.ExteriorMaterial.Valid {
			pResp.ExteriorMaterial = &p.ExteriorMaterial.String
		}
		if p.BuildingUsage.Valid {
			pResp.BuildingUsage = &p.BuildingUsage.String
		}
		if p.Zoning.Valid {
			pResp.Zoning = &p.Zoning.String
		}
		if p.UnitsOnFloor.Valid {
			v := p.UnitsOnFloor.Int32
			pResp.UnitsOnFloor = &v
		}
```

- [ ] **Step 3: Rebuild go-service Docker image**

```bash
cd go-service && docker compose up --build -d
```

Expected output ends with: `Started` or `Running`

- [ ] **Step 4: Verify new fields appear in API response**

```bash
curl -s http://localhost:8081/api/sale-listing | python -m json.tool | grep -E "has_dark_room|shared_area|building_structure|zoning|units_on_floor" | head -20
```

Expected: at least `"has_dark_room": false` appears for each listing (other fields may be null/absent if seed data not yet updated).

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/modules/sale_listing/dto.go go-service/internal/modules/sale_listing/handler.go
git commit -m "feat: expose has_dark_room and building detail fields in sale listing API"
```

---

## Task 2: TypeScript API types

**Files:**
- Modify: `react-service/src/api/saleListingApi.ts`

- [ ] **Step 1: Add new fields to `PropertySummary` type**

In `react-service/src/api/saleListingApi.ts`, find the `PropertySummary` type and replace it entirely:

```typescript
export type PropertySummary = {
    id: number;
    title: string;
    address: string;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    building_age?: number;
    parking_type: string;
    management_fee?: number;
    is_corner_unit: boolean;
    has_dark_room: boolean;
    security_type: string;
    building_orientation?: string;
    window_orientation?: string;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add react-service/src/api/saleListingApi.ts
git commit -m "feat: add building detail fields to PropertySummary TypeScript type"
```

---

## Task 3: React SaleDetailPage — full rewrite

**Files:**
- Modify: `react-service/src/pages/SaleDetailPage.tsx`

- [ ] **Step 1: Replace entire file with the new implementation**

Write the complete file at `react-service/src/pages/SaleDetailPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSaleListing, type SaleListing } from "../api/saleListingApi";
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

function formatWan(price: number): string {
    const wan = Math.round(price / 10000);
    return `${wan.toLocaleString("zh-TW")}萬`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
            <dd className="text-sm font-bold text-on-surface">{value ?? "—"}</dd>
        </div>
    );
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex flex-1 flex-col items-center px-2 py-3">
            <span className="text-xs text-on-surface-variant">{label}</span>
            <span className="mt-1 text-sm font-bold text-on-surface">{value}</span>
            {sub && <span className="text-xs text-on-surface-variant">{sub}</span>}
        </div>
    );
}

export default function SaleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isNaN(listingId)) return;
        getSaleListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;
    const totalArea = p
        ? (p.main_area ?? 0) + (p.auxiliary_area ?? 0) + (p.balcony_area ?? 0)
        : 0;
    const hasAreaBreakdown = p && (p.main_area != null || p.auxiliary_area != null || p.balcony_area != null);
    const hasBuildingDetail = p && (
        p.building_structure != null || p.exterior_material != null ||
        p.units_on_floor != null || p.building_usage != null || p.zoning != null
    );

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary">← 出售物件列表</Link>

                {/* ── Hero ── */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h1 className="text-3xl font-extrabold text-on-surface">{p?.title ?? `出售 #${listing.id}`}</h1>
                    <p className="mt-1 text-sm text-on-surface-variant">{p?.address ?? ""}</p>

                    <div className="mt-4">
                        <p className="text-4xl font-black text-primary">{formatWan(listing.total_price)}</p>
                        {listing.unit_price_per_ping != null && (
                            <p className="mt-1 text-sm text-on-surface-variant">
                                建坪單價 {(listing.unit_price_per_ping / 10000).toFixed(1)} 萬/坪
                            </p>
                        )}
                    </div>

                    {p && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {p.building_type && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type}
                                </span>
                            )}
                            {p.floor != null && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {p.floor}F / {p.total_floors}F
                                </span>
                            )}
                            {p.rooms != null && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {p.rooms}房{p.living_rooms}廳{p.bathrooms}衛
                                </span>
                            )}
                            {p.is_corner_unit && (
                                <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">邊間</span>
                            )}
                            {p.security_type && p.security_type !== "NONE" && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 快速統計條 */}
                    {p && (p.main_area != null || p.rooms != null || p.building_age != null || p.floor != null) && (
                        <div className="mt-5 flex divide-x divide-outline-variant/20 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low">
                            {totalArea > 0 && (
                                <StatItem label="建坪" value={`${totalArea.toFixed(1)} 坪`} />
                            )}
                            {p.rooms != null && (
                                <StatItem label="格局" value={`${p.rooms}房${p.living_rooms}廳${p.bathrooms}衛`} />
                            )}
                            {p.building_age != null && (
                                <StatItem
                                    label="屋齡"
                                    value={`${p.building_age} 年`}
                                    sub={p.building_type ? (BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type) : undefined}
                                />
                            )}
                            {p.floor != null && (
                                <StatItem label="樓層" value={`${p.floor}/${p.total_floors} 樓`} />
                            )}
                            {p.parking_type && p.parking_type !== "NONE" && (
                                <StatItem label="車位" value={PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type} />
                            )}
                        </div>
                    )}
                </section>

                {/* ── 基本資料 ── */}
                {p && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">基本資料</h2>
                        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {listing.unit_price_per_ping != null && (
                                <InfoRow label="建坪單價" value={`${(listing.unit_price_per_ping / 10000).toFixed(1)} 萬/坪`} />
                            )}
                            {totalArea > 0 && <InfoRow label="建坪（登記）" value={`${totalArea.toFixed(1)} 坪`} />}
                            <InfoRow label="地坪" value={p.land_area != null ? `${p.land_area} 坪` : null} />

                            {/* 面積拆解方程式 */}
                            {hasAreaBreakdown && (
                                <div className="col-span-full rounded-lg bg-surface-container-low p-4">
                                    <dt className="text-xs font-semibold text-on-surface-variant">主建物面積拆解</dt>
                                    <dd className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-on-surface">
                                        {p.main_area != null && (
                                            <span>{p.main_area} 坪 <span className="text-xs font-normal text-on-surface-variant">主建物</span></span>
                                        )}
                                        {p.auxiliary_area != null && (
                                            <><span className="font-normal text-on-surface-variant">＋</span>
                                            <span>{p.auxiliary_area} 坪 <span className="text-xs font-normal text-on-surface-variant">附屬建物</span></span></>
                                        )}
                                        {p.balcony_area != null && (
                                            <><span className="font-normal text-on-surface-variant">＋</span>
                                            <span>{p.balcony_area} 坪 <span className="text-xs font-normal text-on-surface-variant">陽台</span></span></>
                                        )}
                                        <span className="font-normal text-on-surface-variant">＝</span>
                                        <span className="text-primary">{totalArea.toFixed(1)} 坪 <span className="text-xs font-normal text-on-surface-variant">合計</span></span>
                                    </dd>
                                </div>
                            )}

                            <InfoRow label="共有部份" value={p.shared_area != null ? `${p.shared_area} 坪` : null} />
                            <InfoRow label="雨遮" value={p.awning_area != null ? `${p.awning_area} 坪` : null} />
                            {p.building_age != null && <InfoRow label="屋齡" value={`${p.building_age} 年`} />}
                            {p.rooms != null && (
                                <InfoRow label="格局" value={`${p.rooms}房 ${p.living_rooms}廳 ${p.bathrooms}衛`} />
                            )}
                            {p.building_type && (
                                <InfoRow label="建物類型" value={BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type} />
                            )}
                            {p.floor != null && <InfoRow label="樓層" value={`${p.floor}F / ${p.total_floors}F`} />}
                            <InfoRow
                                label="邊間 / 暗房"
                                value={`${p.is_corner_unit ? "是" : "否"} / ${p.has_dark_room ? "是" : "否"}`}
                            />
                            {p.building_orientation && <InfoRow label="建物朝向" value={p.building_orientation} />}
                            {p.window_orientation && <InfoRow label="落地窗朝向" value={p.window_orientation} />}
                            {p.security_type && (
                                <InfoRow label="警衛管理" value={SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type} />
                            )}
                            {p.management_fee != null && (
                                <InfoRow label="管理費" value={`NT$ ${p.management_fee.toLocaleString()} / 月`} />
                            )}
                            {p.parking_type && (
                                <InfoRow label="車位類型" value={PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type} />
                            )}
                        </dl>
                    </section>
                )}

                {/* ── 建物詳情 ── */}
                {hasBuildingDetail && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">建物詳情</h2>
                        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <InfoRow label="建物結構" value={p!.building_structure} />
                            <InfoRow label="外牆建材" value={p!.exterior_material} />
                            {p!.units_on_floor != null && (
                                <InfoRow label="該層戶數" value={`${p!.units_on_floor} 戶`} />
                            )}
                            <InfoRow label="謄本用途" value={p!.building_usage} />
                            <InfoRow label="使用分區" value={p!.zoning} />
                        </dl>
                    </section>
                )}

                {/* ── 出售條件 ── */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出售條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        <InfoRow label="總價" value={`NT$ ${listing.total_price.toLocaleString()}`} />
                        {listing.unit_price_per_ping != null && (
                            <InfoRow label="建坪單價" value={`NT$ ${listing.unit_price_per_ping.toLocaleString()} / 坪`} />
                        )}
                        {listing.parking_type && (
                            <InfoRow label="車位類型" value={PARKING_TYPE_LABEL[listing.parking_type] ?? listing.parking_type} />
                        )}
                        {listing.parking_price != null && (
                            <InfoRow label="車位價格" value={`NT$ ${listing.parking_price.toLocaleString()}`} />
                        )}
                        {listing.expires_at && (
                            <InfoRow label="刊登到期" value={new Date(listing.expires_at).toLocaleDateString("zh-TW")} />
                        )}
                    </dl>
                    {listing.notes && (
                        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">備注</p>
                            <p className="mt-1 text-sm text-on-surface">{listing.notes}</p>
                        </div>
                    )}
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Verify lint passes**

```bash
cd react-service && npx eslint src/pages/SaleDetailPage.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/SaleDetailPage.tsx
git commit -m "feat: redesign SaleDetailPage with industry-standard info architecture"
```

---

## Task 4: Seed data — populate new fields for all 20 demo properties

**Files:**
- Modify: `infra/init/15-demo-properties.sql`

**Strategy:** `building_structure` and `building_usage` filled for all 20. `exterior_material`, `zoning`, `units_on_floor` filled for ~15/20. `shared_area` for BUILDING with security (~12/20). `awning_area` for older buildings (~8/20). `land_area` only for TOWNHOUSE (2 properties).

**Value reference table:**

| Property | structure | exterior | usage | zoning | units | shared | awning | land |
|----------|-----------|----------|-------|--------|-------|--------|--------|------|
| 大安路精裝兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第三種住宅區 | 6 | 5.2 | 1.5 | — |
| 信義世貿三房 | 鋼骨鋼筋混凝土 | 石材 | 集合住宅 | 第三種住宅區 | 8 | 8.5 | — | — |
| 中山捷運套房 | 加強磚造 | 磁磚 | 集合住宅 | 第二種住宅區 | 4 | — | 1.2 | — |
| 內湖科技兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第二種住宅區 | 5 | 4.8 | — | — |
| 木柵捷運三房 | 加強磚造 | 磁磚（整建）| 集合住宅 | 第二種住宅區 | 3 | — | 2.0 | — |
| 板橋府中三房 | 磚造 | — | 集合住宅 | 第三種住宅區 | 4 | — | 2.5 | — |
| 中和景觀兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第三種住宅區 | 6 | 4.0 | — | — |
| 新店碧潭兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第三種住宅區 | 5 | 4.5 | 1.8 | — |
| 七期精裝兩房 | 鋼骨鋼筋混凝土 | 玻璃帷幕 | 集合住宅 | 第三種住宅區 | 4 | 5.5 | — | — |
| 北屯親子三房 | 加強磚造 | 磁磚 | 集合住宅 | 第二種住宅區 | 3 | — | — | — |
| 大安精品三房 | 鋼筋混凝土 | 石材 | 集合住宅 | 第三種住宅區 | 4 | 8.2 | — | — |
| 信義高樓景觀宅 | 鋼骨鋼筋混凝土 | 玻璃帷幕 | 集合住宅 | 第三種住宅區 | 5 | 12.0 | — | — |
| 中山雙捷兩房 | 加強磚造 | 磁磚（整建）| 集合住宅 | 第二種住宅區 | 4 | — | 2.2 | — |
| 北投溫泉透天 | 磚造 | 洗石子 | 透天住宅 | 第一種住宅區 | — | — | 1.5 | 30.0 |
| 板橋車站兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第三種住宅區 | 6 | 6.0 | — | — |
| 新莊副都心兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第三種住宅區 | 5 | 4.5 | — | — |
| 七期高層三房 | 鋼骨鋼筋混凝土 | 玻璃帷幕 | 集合住宅 | 第三種住宅區 | 4 | 14.0 | — | — |
| 南屯透天別墅 | 鋼骨造 | 磁磚 | 透天住宅 | 第二種住宅區 | — | — | — | 25.0 |
| 竹科生活圈兩房 | 鋼筋混凝土 | 磁磚 | 集合住宅 | 第二種住宅區 | 5 | 5.0 | — | — |
| 竹北高端三房 | 鋼骨鋼筋混凝土 | 石材 | 集合住宅 | 第一種住宅區 | 4 | 8.0 | — | — |

- [ ] **Step 1: Update INSERT column list pattern**

Every property INSERT in `infra/init/15-demo-properties.sql` currently ends with:
```sql
INSERT INTO property (
    owner_user_id, title, address, building_type,
    floor, total_floors, main_area, auxiliary_area, balcony_area,
    rooms, living_rooms, bathrooms,
    is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
    building_age, management_fee, building_orientation, window_orientation,
    created_at, updated_at
) VALUES (...)
```

Each INSERT must be updated to include the new columns. Use this expanded column list:
```sql
INSERT INTO property (
    owner_user_id, title, address, building_type,
    floor, total_floors, main_area, auxiliary_area, balcony_area,
    shared_area, awning_area, land_area,
    rooms, living_rooms, bathrooms,
    is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
    building_age, management_fee, building_orientation, window_orientation,
    building_structure, exterior_material, building_usage, zoning, units_on_floor,
    created_at, updated_at
) VALUES (
    ..., -- existing values in same order
    <shared_area or NULL>, <awning_area or NULL>, <land_area or NULL>,
    ..., -- rooms, living_rooms, bathrooms, is_corner_unit, has_dark_room, parking_type, security_type, setup_status unchanged
    ..., -- building_age, management_fee, building_orientation, window_orientation unchanged
    '<building_structure>', '<exterior_material or NULL>', '<building_usage>', '<zoning or NULL>', <units_on_floor or NULL>,
    NOW() - INTERVAL '...', NOW() - INTERVAL '...'
)
```

Full example for 大安路精裝兩房採光宅 (rental #1):
```sql
INSERT INTO property (
    owner_user_id, title, address, building_type,
    floor, total_floors, main_area, auxiliary_area, balcony_area,
    shared_area, awning_area, land_area,
    rooms, living_rooms, bathrooms,
    is_corner_unit, has_dark_room, parking_type, security_type, setup_status,
    building_age, management_fee, building_orientation, window_orientation,
    building_structure, exterior_material, building_usage, zoning, units_on_floor,
    created_at, updated_at
) VALUES (
    owner_id, '大安路精裝兩房採光宅', '台北市大安區大安路一段168號',
    'BUILDING', 6, 12, 21.5, 3.2, 1.8,
    5.2, 1.5, NULL,
    2, 1, 1,
    FALSE, FALSE, 'NONE', 'PARTTIME', 'READY',
    5, 1500, '南', '東南',
    '鋼筋混凝土', '磁磚', '集合住宅', '第三種住宅區', 6,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
) RETURNING id INTO prop_id;
```

Apply this pattern to all 20 properties using the value table above. Use `NULL` for any cell marked "—" in the table.

Special cases:
- 中山捷運套房: no `balcony_area` column in original, keep omitting `balcony_area` value (it was `NULL` before)
- TOWNHOUSE properties (北投溫泉透天, 南屯透天別墅): no `units_on_floor` → `NULL`

- [ ] **Step 2: Re-inject seed into database**

```bash
docker exec -i onchain-postgres psql -U postgres -d LAND < "d:/Git/onchain-project/infra/init/15-demo-properties.sql"
```

Expected output:
```
INSERT 0 1
INSERT 0 1
DO
```

- [ ] **Step 3: Verify data in DB**

```bash
docker exec onchain-postgres psql -U postgres -d LAND -c "SELECT title, building_structure, exterior_material, building_usage, zoning, units_on_floor, shared_area, awning_area, land_area FROM property WHERE owner_user_id = (SELECT id FROM users WHERE wallet_address = '0xDemoPropertyOwner0000000000000000000000000000001') ORDER BY id;" 2>&1
```

Expected: 20 rows, most having building_structure and building_usage filled, some with NULL exterior_material, zoning, etc.

- [ ] **Step 4: Verify API returns new fields**

```bash
curl -s http://localhost:8081/api/sale-listing/11 | python -m json.tool | grep -E "building_structure|building_usage|zoning|units_on_floor|shared_area"
```

Expected: fields with values appear (not null/absent).

- [ ] **Step 5: Commit**

```bash
git add infra/init/15-demo-properties.sql
git commit -m "feat: populate building detail fields in demo property seed data"
```

---

## Final Verification

- [ ] Open `http://localhost:5173/sale/11` (or any ID from 11–20)
- [ ] Confirm Hero shows: large price in dark gold, "建坪單價 X.X萬/坪" subtitle, chips, stats strip
- [ ] Confirm 基本資料: shows area equation row, 共有部份, 雨遮, 邊間/暗房 as "是/否"
- [ ] Confirm 建物詳情 section appears with building_structure, building_usage etc.
- [ ] Confirm 出售條件 section unchanged
- [ ] Run `npx tsc --noEmit` — zero errors
