# Listing Public Pages and Print Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reusable sale/rental listing public pages, owner preview mode, and print-derived listing-book/cover output from one shared display architecture.

**Architecture:** Add a `ListingDisplayModel` layer under `react-service/src/components/listing/` and use it from thin page containers. Sale, rental, owner preview, and print output share display sections; pages only load data, select a mode, and compose components.

**Tech Stack:** React 19, TypeScript, React Router v7, Vite, existing fetch helpers in `listingApi.ts`, existing Tailwind utility classes, browser print CSS for first PDF output.

---

## File Structure

- Create: `react-service/src/components/listing/listingDisplayModel.ts`
  - Converts API `Listing` objects into stable view data.
  - Owns value formatting, mode-neutral labels, missing field detection, and sale/rent field grouping.
- Create: `react-service/src/components/listing/ListingSearchBar.tsx`
  - Shared sale/rental search and sort UI.
  - Owns list/map disabled panel state labels and search parameter form state.
- Create: `react-service/src/components/listing/ListingResultCard.tsx`
  - Shared list card for sale and rental listing results.
- Create: `react-service/src/components/listing/ListingDetailSections.tsx`
  - Shared hero, facts, features, trust, contact, and completeness sections.
- Create: `react-service/src/components/listing/ListingDetailShell.tsx`
  - Composes detail sections for `public`, `ownerPreview`, and `print` modes.
- Create: `react-service/src/components/listing/ListingPrintBook.tsx`
  - Full listing-book print layout derived from `ListingDisplayModel`.
- Create: `react-service/src/components/listing/ListingCoverPreview.tsx`
  - Cover-preview layout derived from the listing-book cover content.
- Create: `react-service/src/pages/ListingPrintPage.tsx`
  - Owner-only print output page for full book and cover modes.
- Modify: `react-service/src/pages/ListingListPage.tsx`
  - Replace local card/search structure with shared search bar and result card.
- Modify: `react-service/src/pages/ListingDetailPage.tsx`
  - Replace inline display sections with `ListingDetailShell`.
  - Keep owner actions and existing modals intact.
- Modify: `react-service/src/router/index.tsx`
  - Add owner-only print routes.
- Modify: `react-service/src/index.css`
  - Add print media rules and print-only helpers if no existing print section exists.

## Task 1: Listing Display Model

**Files:**
- Create: `react-service/src/components/listing/listingDisplayModel.ts`

- [ ] **Step 1: Create display model types and helpers**

Add this file:

```ts
import type { Listing, ListingType } from "../../api/listingApi";

export type ListingDisplayMode = "public" | "ownerPreview" | "print";

export type DisplayStat = {
    label: string;
    value: string;
};

export type DisplayChip = {
    label: string;
    tone: "neutral" | "primary" | "success" | "warning" | "danger";
};

export type ListingDisplayModel = {
    id: number;
    type: ListingType;
    title: string;
    address: string;
    district: string;
    description: string;
    statusLabel: string;
    setupLabel: string;
    priceLabel: string;
    priceCaption: string;
    coverImageUrl?: string;
    generatedAtLabel: string;
    updatedAtLabel: string;
    heroStats: DisplayStat[];
    listStats: DisplayStat[];
    saleFacts: DisplayStat[];
    rentFacts: DisplayStat[];
    featureChips: DisplayChip[];
    trustFacts: DisplayStat[];
    missingFields: string[];
    canShowVisitorActions: boolean;
};

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "刊登中",
    NEGOTIATING: "洽談中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已成交",
    EXPIRED: "已到期",
    REMOVED: "已下架",
    SUSPENDED: "已暫停",
};

function formatDateTime(value?: string): string {
    if (!value) return "未提供";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未提供";
    return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatNumber(value?: number): string {
    if (value === undefined || value === null || Number.isNaN(value)) return "未提供";
    return value.toLocaleString("zh-TW");
}

function formatPing(value?: number): string {
    if (value === undefined || value <= 0) return "未提供";
    return `${formatNumber(value)}坪`;
}

function formatCurrency(value?: number): string {
    if (value === undefined || value <= 0) return "未提供";
    return `NT$ ${value.toLocaleString("zh-TW")}`;
}

function formatLayout(listing: Listing): string {
    const rooms = listing.room_count;
    const baths = listing.bathroom_count;
    if (rooms === undefined && baths === undefined) return "未提供";
    if (rooms !== undefined && baths !== undefined) return `${rooms}房 / ${baths}衛`;
    if (rooms !== undefined) return `${rooms}房`;
    return `${baths}衛`;
}

function formatFloor(listing: Listing): string {
    if (listing.floor === undefined && listing.total_floors === undefined) return "未提供";
    if (listing.floor !== undefined && listing.total_floors !== undefined) return `${listing.floor}樓 / ${listing.total_floors}樓`;
    if (listing.floor !== undefined) return `${listing.floor}樓`;
    return `共 ${listing.total_floors}樓`;
}

function missingCommonFields(listing: Listing): string[] {
    const missing: string[] = [];
    if (!listing.title.trim()) missing.push("標題");
    if (!listing.address.trim()) missing.push("地址");
    if (listing.price <= 0) missing.push(listing.list_type === "RENT" ? "月租金" : "價格");
    if (!listing.image_url) missing.push("封面照片");
    if (listing.area_ping === undefined || listing.area_ping <= 0) missing.push("坪數");
    if (listing.room_count === undefined) missing.push("房數");
    if (listing.bathroom_count === undefined) missing.push("衛浴數");
    return missing;
}

function missingSaleFields(listing: Listing): string[] {
    if (listing.list_type !== "SALE") return [];
    const missing: string[] = [];
    if (!listing.sale_details) return ["賣屋詳細資料"];
    if (listing.sale_details.sale_total_price <= 0) missing.push("總價");
    if (listing.sale_details.main_building_ping === undefined) missing.push("主建物坪數");
    return missing;
}

function missingRentFields(listing: Listing): string[] {
    if (listing.list_type !== "RENT") return [];
    const missing: string[] = [];
    if (!listing.rent_details) return ["出租詳細資料"];
    if (listing.rent_details.monthly_rent <= 0) missing.push("月租金");
    if (listing.rent_details.deposit_months <= 0) missing.push("押金");
    if (listing.rent_details.minimum_lease_months <= 0) missing.push("最短租期");
    return missing;
}

function buildFeatureChips(listing: Listing): DisplayChip[] {
    const chips: DisplayChip[] = [];
    if (listing.is_pet_allowed) chips.push({ label: "可寵物", tone: "success" });
    if (listing.is_parking_included) chips.push({ label: "含車位", tone: "primary" });
    if (listing.rent_details?.can_cook) chips.push({ label: "可開伙", tone: "success" });
    if (listing.rent_details?.can_register_household) chips.push({ label: "可設籍", tone: "success" });
    if (listing.sale_details?.parking_space_type) chips.push({ label: listing.sale_details.parking_space_type, tone: "primary" });
    if (chips.length === 0) chips.push({ label: "尚未標註特色", tone: "neutral" });
    return chips;
}

export function buildListingDisplayModel(listing: Listing, now: Date = new Date()): ListingDisplayModel {
    const isRent = listing.list_type === "RENT";
    const isSale = listing.list_type === "SALE";
    const rentPrice = listing.rent_details?.monthly_rent || listing.price;
    const salePrice = listing.sale_details?.sale_total_price || listing.price;
    const priceLabel = isRent ? `${formatCurrency(rentPrice)} / 月` : isSale ? formatCurrency(salePrice) : formatCurrency(listing.price);
    const priceCaption = isRent ? "月租金" : isSale ? "總價" : "價格";

    const heroStats: DisplayStat[] = [
        { label: "坪數", value: formatPing(listing.area_ping) },
        { label: "格局", value: formatLayout(listing) },
        { label: "樓層", value: formatFloor(listing) },
    ];

    const saleFacts: DisplayStat[] = listing.sale_details
        ? [
              { label: "總價", value: formatCurrency(listing.sale_details.sale_total_price) },
              { label: "單價", value: formatCurrency(listing.sale_details.sale_unit_price_per_ping) },
              { label: "主建物", value: formatPing(listing.sale_details.main_building_ping) },
              { label: "附屬建物", value: formatPing(listing.sale_details.auxiliary_building_ping) },
              { label: "陽台", value: formatPing(listing.sale_details.balcony_ping) },
              { label: "土地", value: formatPing(listing.sale_details.land_ping) },
              { label: "車位", value: listing.sale_details.parking_space_type || "未提供" },
              { label: "車位價格", value: formatCurrency(listing.sale_details.parking_space_price) },
          ]
        : [];

    const rentFacts: DisplayStat[] = listing.rent_details
        ? [
              { label: "月租金", value: `${formatCurrency(listing.rent_details.monthly_rent)} / 月` },
              { label: "押金", value: `${listing.rent_details.deposit_months}個月` },
              { label: "管理費", value: `${formatCurrency(listing.rent_details.management_fee_monthly)} / 月` },
              { label: "最短租期", value: `${listing.rent_details.minimum_lease_months}個月` },
              { label: "可設籍", value: listing.rent_details.can_register_household ? "可以" : "不可以" },
              { label: "可開伙", value: listing.rent_details.can_cook ? "可以" : "不可以" },
              { label: "可寵物", value: listing.is_pet_allowed ? "可以" : "不可以" },
              { label: "車位", value: listing.is_parking_included ? "含車位" : "未標示" },
          ]
        : [];

    const trustFacts: DisplayStat[] = [
        { label: "物件驗證", value: listing.property?.verification_status || "未提供" },
        { label: "完整度", value: listing.property?.completeness_status || listing.setup_status },
        { label: "產權雜湊", value: listing.property?.deed_hash || "未提供" },
        { label: "揭露雜湊", value: listing.property?.disclosure_hash || "未提供" },
    ];

    return {
        id: listing.id,
        type: listing.list_type,
        title: listing.title || "未命名物件",
        address: listing.address || "未提供地址",
        district: listing.district || "未提供行政區",
        description: listing.description || "",
        statusLabel: STATUS_LABEL[listing.status] ?? listing.status,
        setupLabel: listing.setup_status === "READY" ? "資料完整" : "資料未完整",
        priceLabel,
        priceCaption,
        coverImageUrl: listing.image_url,
        generatedAtLabel: formatDateTime(now.toISOString()),
        updatedAtLabel: formatDateTime(listing.updated_at),
        heroStats,
        listStats: [
            { label: "行政區", value: listing.district || "未提供" },
            { label: "坪數", value: formatPing(listing.area_ping) },
            { label: "格局", value: formatLayout(listing) },
            { label: "樓層", value: formatFloor(listing) },
        ],
        saleFacts,
        rentFacts,
        featureChips: buildFeatureChips(listing),
        trustFacts,
        missingFields: [...missingCommonFields(listing), ...missingSaleFields(listing), ...missingRentFields(listing)],
        canShowVisitorActions: listing.status === "ACTIVE",
    };
}
```

- [ ] **Step 2: Run TypeScript build to verify new types compile**

Run: `npm run build` from `react-service`.

Expected: build passes or fails only on existing unrelated project errors. If it fails because of this new file, fix the reported TypeScript error before continuing.

- [ ] **Step 3: Commit display model**

```bash
git add react-service/src/components/listing/listingDisplayModel.ts
git commit -m "feat: add listing display model"
```

## Task 2: Shared List Search and Result Card

**Files:**
- Create: `react-service/src/components/listing/ListingSearchBar.tsx`
- Create: `react-service/src/components/listing/ListingResultCard.tsx`

- [ ] **Step 1: Add shared search bar**

Create `ListingSearchBar.tsx`:

```tsx
import type { ListingType } from "../../api/listingApi";

export type ListingListMode = Exclude<ListingType, "UNSET"> | "ALL";

export type ListingSearchState = {
    mode: ListingListMode;
    district: string;
    keyword: string;
    priceBand: string;
    layout: string;
    sort: string;
    mapSelected: boolean;
};

type Props = {
    state: ListingSearchState;
    onChange: (next: ListingSearchState) => void;
    onSearch: () => void;
};

const modeOptions: Array<{ value: ListingListMode; label: string }> = [
    { value: "ALL", label: "全部" },
    { value: "SALE", label: "買屋" },
    { value: "RENT", label: "租屋" },
];

export default function ListingSearchBar({ state, onChange, onSearch }: Props) {
    const isRent = state.mode === "RENT";
    const isSale = state.mode === "SALE";

    const update = <K extends keyof ListingSearchState>(key: K, value: ListingSearchState[K]) => {
        onChange({ ...state, [key]: value });
    };

    return (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
            <div className="flex flex-wrap items-center gap-3">
                {modeOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => update("mode", option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                            state.mode === option.value
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => update("mapSelected", false)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                        !state.mapSelected ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"
                    }`}
                >
                    列表
                </button>
                <button
                    type="button"
                    onClick={() => update("mapSelected", true)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                        state.mapSelected ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"
                    }`}
                >
                    地圖
                </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <input
                    value={state.district}
                    onChange={(event) => update("district", event.target.value)}
                    placeholder="行政區"
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                />
                <input
                    value={state.keyword}
                    onChange={(event) => update("keyword", event.target.value)}
                    placeholder={isRent ? "路街、社區、關鍵字或物件編號" : "街道、捷運站、社區、物件編號或學校"}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container md:col-span-2"
                />
                <select
                    value={state.priceBand}
                    onChange={(event) => update("priceBand", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="">{isRent ? "不限租金" : "不限總價"}</option>
                    <option value="low">{isRent ? "2萬以下" : "1000萬以下"}</option>
                    <option value="mid">{isRent ? "2萬-5萬" : "1000萬-3000萬"}</option>
                    <option value="high">{isRent ? "5萬以上" : "3000萬以上"}</option>
                </select>
                <button type="button" onClick={onSearch} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
                    {isRent ? "租屋搜尋" : isSale ? "買屋搜尋" : "搜尋"}
                </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                    value={state.layout}
                    onChange={(event) => update("layout", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="">不限格局</option>
                    <option value="1">1房</option>
                    <option value="2">2房</option>
                    <option value="3">3房以上</option>
                </select>
                <select
                    value={state.sort}
                    onChange={(event) => update("sort", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="default">預設排序</option>
                    <option value="newest">最新</option>
                    <option value="priceAsc">{isRent ? "租金低到高" : "價格低到高"}</option>
                    <option value="priceDesc">{isRent ? "租金高到低" : "價格高到低"}</option>
                    <option value="areaDesc">坪數大到小</option>
                </select>
            </div>

            {state.mapSelected ? (
                <div className="mt-5 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low p-6 text-sm text-on-surface-variant">
                    地圖搜尋將在刊登、需求與仲介流程完成後接入地圖服務；目前先使用列表搜尋。
                </div>
            ) : null}
        </section>
    );
}
```

- [ ] **Step 2: Add shared result card**

Create `ListingResultCard.tsx`:

```tsx
import type { ListingDisplayModel } from "./listingDisplayModel";

type Props = {
    listing: ListingDisplayModel;
    onClick: () => void;
};

function chipClass(tone: string): string {
    if (tone === "success") return "bg-tertiary/10 text-tertiary";
    if (tone === "primary") return "bg-primary-container/15 text-primary-container";
    if (tone === "warning") return "bg-amber-700/10 text-amber-700";
    if (tone === "danger") return "bg-error-container text-on-error-container";
    return "bg-surface-container-low text-on-surface-variant";
}

export default function ListingResultCard({ listing, onClick }: Props) {
    return (
        <article
            onClick={onClick}
            className="grid cursor-pointer gap-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 transition-transform duration-300 hover:-translate-y-0.5 md:grid-cols-[220px_1fr_auto]"
        >
            <div className="relative h-48 overflow-hidden rounded-xl bg-surface-container-low md:h-40">
                {listing.coverImageUrl ? (
                    <img src={listing.coverImageUrl} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface">
                    {listing.statusLabel}
                </span>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-bold text-on-surface-variant">{listing.type === "RENT" ? "出租物件" : listing.type === "SALE" ? "賣屋物件" : "未設定類型"}</div>
                <h2 className="mt-1 text-xl font-extrabold text-on-surface">{listing.title}</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{listing.district} · {listing.address}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {listing.listStats.slice(1).map((stat) => (
                        <span key={stat.label} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {stat.label} {stat.value}
                        </span>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {listing.featureChips.slice(0, 4).map((chip) => (
                        <span key={chip.label} className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass(chip.tone)}`}>{chip.label}</span>
                    ))}
                </div>
            </div>
            <div className="flex flex-col items-start justify-between gap-4 md:items-end">
                <div>
                    <div className="text-xs text-on-surface-variant">{listing.priceCaption}</div>
                    <div className="mt-1 text-2xl font-extrabold text-primary-container">{listing.priceLabel}</div>
                </div>
                <div className="text-xs text-on-surface-variant">更新 {listing.updatedAtLabel}</div>
            </div>
        </article>
    );
}
```

- [ ] **Step 3: Run build**

Run: `npm run build` from `react-service`.

Expected: TypeScript accepts both new components.

- [ ] **Step 4: Commit shared list components**

```bash
git add react-service/src/components/listing/ListingSearchBar.tsx react-service/src/components/listing/ListingResultCard.tsx
git commit -m "feat: add shared listing list components"
```

## Task 3: Listing List Page Integration

**Files:**
- Modify: `react-service/src/pages/ListingListPage.tsx`

- [ ] **Step 1: Replace local card state with shared search state**

In `ListingListPage.tsx`, import:

```ts
import ListingResultCard from "../components/listing/ListingResultCard";
import ListingSearchBar, { type ListingSearchState } from "../components/listing/ListingSearchBar";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
```

Remove the local `ListingCard`, `formatPrice`, and duplicated `STATUS_LABEL`.

Add state near the existing listing state:

```ts
const [searchState, setSearchState] = useState<ListingSearchState>({
    mode: typeFilter,
    district: districtFilter,
    keyword: "",
    priceBand: "",
    layout: "",
    sort: "default",
    mapSelected: false,
});
```

- [ ] **Step 2: Keep URL filters synced**

Add this effect after `typeFilter` and `districtFilter` are computed:

```ts
useEffect(() => {
    setSearchState((current) => ({
        ...current,
        mode: typeFilter,
        district: districtFilter,
    }));
}, [districtFilter, typeFilter]);
```

Add this handler:

```ts
const applySearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    if (searchState.mode === "ALL") nextParams.delete("type");
    else nextParams.set("type", searchState.mode);
    if (searchState.district.trim()) nextParams.set("district", searchState.district.trim());
    else nextParams.delete("district");
    setSearchParams(nextParams);
};
```

- [ ] **Step 3: Render shared search and cards**

Replace the sticky type tab section with:

```tsx
<section className="sticky top-[64px] z-40 w-full border-b border-outline-variant/10 bg-surface-container-lowest">
    <div className="mx-auto max-w-[1440px] px-6 py-4 md:px-12">
        <ListingSearchBar state={searchState} onChange={setSearchState} onSearch={applySearch} />
        {isOwner ? (
            <button
                type="button"
                onClick={() => navigate("/my/listings")}
                className="mt-4 flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-opacity hover:opacity-90"
            >
                <span className="material-symbols-outlined text-sm">home_work</span>
                <span className="text-sm font-medium">我的刊登</span>
            </button>
        ) : null}
    </div>
</section>
```

Replace card rendering with:

```tsx
<div className="grid grid-cols-1 gap-5">
    {listings.map((listing) => (
        <ListingResultCard
            key={listing.id}
            listing={buildListingDisplayModel(listing)}
            onClick={() => navigate(`/listings/${listing.id}`)}
        />
    ))}
</div>
```

- [ ] **Step 4: Run build and inspect page**

Run: `npm run build` from `react-service`.

Expected: Build passes. `/listings`, `/listings?type=SALE`, and `/listings?type=RENT` compile with no missing imports.

- [ ] **Step 5: Commit list integration**

```bash
git add react-service/src/pages/ListingListPage.tsx
git commit -m "feat: upgrade listing list page"
```

## Task 4: Shared Detail Sections and Shell

**Files:**
- Create: `react-service/src/components/listing/ListingDetailSections.tsx`
- Create: `react-service/src/components/listing/ListingDetailShell.tsx`

- [ ] **Step 1: Add detail sections**

Create `ListingDetailSections.tsx`:

```tsx
import type { ReactNode } from "react";
import type { DisplayStat, ListingDisplayModel, ListingDisplayMode } from "./listingDisplayModel";

function Section(props: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={`rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 ${props.className ?? ""}`}>
            <h2 className="text-xl font-extrabold text-on-surface">{props.title}</h2>
            <div className="mt-5">{props.children}</div>
        </section>
    );
}

function StatGrid({ stats }: { stats: DisplayStat[] }) {
    return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-surface-container-low p-4">
                    <p className="text-xs font-bold text-on-surface-variant">{stat.label}</p>
                    <p className="mt-1 text-base font-extrabold text-on-surface">{stat.value}</p>
                </div>
            ))}
        </div>
    );
}

export function ListingHeroSection({ model, mode }: { model: ListingDisplayModel; mode: ListingDisplayMode }) {
    return (
        <section className="grid gap-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 lg:grid-cols-[1fr_360px]">
            <div>
                <div className="relative h-[320px] overflow-hidden rounded-2xl bg-surface-container-low">
                    {model.coverImageUrl ? (
                        <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                    )}
                    {mode !== "public" ? (
                        <span className="absolute left-4 top-4 rounded-full bg-surface-container-lowest px-4 py-2 text-xs font-bold text-on-surface">
                            預覽稿
                        </span>
                    ) : null}
                </div>
            </div>
            <div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">{model.statusLabel}</span>
                    <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">{model.setupLabel}</span>
                </div>
                <div className="mt-5 text-xs font-bold text-on-surface-variant">物件 #{model.id}</div>
                <h1 className="mt-2 text-3xl font-extrabold text-on-surface">{model.title}</h1>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{model.district} · {model.address}</p>
                <p className="mt-6 text-sm text-on-surface-variant">{model.priceCaption}</p>
                <p className="text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                <div className="mt-6 grid gap-3">
                    {model.heroStats.map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                            <span className="text-sm text-on-surface-variant">{stat.label}</span>
                            <span className="text-sm font-bold text-on-surface">{stat.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function ListingFactsSection({ model }: { model: ListingDisplayModel }) {
    const stats = model.type === "RENT" ? model.rentFacts : model.saleFacts;
    return (
        <Section title={model.type === "RENT" ? "出租條件" : "基本資料"}>
            {stats.length > 0 ? <StatGrid stats={stats} /> : <p className="text-sm text-on-surface-variant">尚未建立詳細資料。</p>}
        </Section>
    );
}

export function ListingFeaturesSection({ model }: { model: ListingDisplayModel }) {
    return (
        <Section title={model.type === "RENT" ? "設備與特色" : "物件特色"}>
            <div className="flex flex-wrap gap-2">
                {model.featureChips.map((chip) => (
                    <span key={chip.label} className="rounded-full bg-surface-container-low px-3 py-1 text-sm font-bold text-on-surface-variant">
                        {chip.label}
                    </span>
                ))}
            </div>
            {model.description ? <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{model.description}</p> : null}
        </Section>
    );
}

export function ListingTrustSection({ model }: { model: ListingDisplayModel }) {
    return (
        <Section title="可信資料">
            <StatGrid stats={model.trustFacts} />
        </Section>
    );
}

export function ListingCompletenessSection({ model }: { model: ListingDisplayModel }) {
    if (model.missingFields.length === 0) {
        return (
            <Section title="資料完整度">
                <p className="text-sm font-bold text-tertiary">目前沒有偵測到關鍵缺漏欄位。</p>
            </Section>
        );
    }
    return (
        <Section title="資料完整度">
            <p className="text-sm text-on-surface-variant">發布前建議補齊以下欄位：</p>
            <div className="mt-4 flex flex-wrap gap-2">
                {model.missingFields.map((field) => (
                    <span key={field} className="rounded-full bg-amber-700/10 px-3 py-1 text-xs font-bold text-amber-700">{field}</span>
                ))}
            </div>
        </Section>
    );
}
```

- [ ] **Step 2: Add detail shell**

Create `ListingDetailShell.tsx`:

```tsx
import type { ReactNode } from "react";
import type { ListingDisplayMode, ListingDisplayModel } from "./listingDisplayModel";
import {
    ListingCompletenessSection,
    ListingFactsSection,
    ListingFeaturesSection,
    ListingHeroSection,
    ListingTrustSection,
} from "./ListingDetailSections";

type Props = {
    model: ListingDisplayModel;
    mode: ListingDisplayMode;
    actions?: ReactNode;
};

export default function ListingDetailShell({ model, mode, actions }: Props) {
    return (
        <div className={mode === "print" ? "listing-print-surface" : "flex flex-col gap-6"}>
            {mode !== "public" ? (
                <div className="rounded-2xl border border-amber-700/20 bg-amber-700/10 p-4 text-sm text-amber-700">
                    這是刊登預覽內容，尚未代表正式公開頁面。產出時間：{model.generatedAtLabel}
                </div>
            ) : null}
            <ListingHeroSection model={model} mode={mode} />
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ListingFactsSection model={model} />
                    <ListingFeaturesSection model={model} />
                    <ListingTrustSection model={model} />
                    {mode !== "public" ? <ListingCompletenessSection model={model} /> : null}
                </div>
                {mode !== "print" && actions ? <aside className="flex flex-col gap-4">{actions}</aside> : null}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Run build**

Run: `npm run build` from `react-service`.

Expected: Build passes with new section components.

- [ ] **Step 4: Commit detail shell**

```bash
git add react-service/src/components/listing/ListingDetailSections.tsx react-service/src/components/listing/ListingDetailShell.tsx
git commit -m "feat: add shared listing detail shell"
```

## Task 5: Listing Detail Page Integration

**Files:**
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

- [ ] **Step 1: Import shell and display model**

Add imports:

```ts
import ListingDetailShell from "../components/listing/ListingDetailShell";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
```

- [ ] **Step 2: Build the display model after owner state is computed**

After `canPublish` is computed, add:

```ts
const displayModel = buildListingDisplayModel(listing);
```

- [ ] **Step 3: Replace the inline display article with the shared shell**

In the main `section className="grid gap-8 lg:grid-cols-[1fr_360px]"`, replace the current left `article` and right `aside` layout with:

```tsx
<ListingDetailShell
    model={displayModel}
    mode={isOwner ? "ownerPreview" : "public"}
    actions={
        <>
            {isOwner ? (
                <>
                    {propertyReady && needsIntent ? (
                        <>
                            <ActionButton variant="primary" disabled={isActionLoading} onClick={() => void handleSetIntent("RENT")}>刊登出租</ActionButton>
                            <ActionButton disabled={isActionLoading} onClick={() => void handleSetIntent("SALE")}>刊登出售</ActionButton>
                        </>
                    ) : null}
                    {listing.status === "DRAFT" && !propertyReady ? (
                        <p className="rounded-xl bg-surface-container-low p-4 text-sm leading-[1.7] text-on-surface-variant">
                            物件驗證資料尚未完成，請先完成揭露與產權確認後再刊登。
                        </p>
                    ) : null}
                    {canPublish ? <ActionButton variant="primary" onClick={() => setModal("publish")}>發布物件</ActionButton> : null}
                    {listing.status === "DRAFT" && propertyReady && listing.list_type === "RENT" ? (
                        <ActionButton variant={listing.rent_details ? "secondary" : "primary"} disabled={isActionLoading} onClick={() => setModal("rentDetails")}>
                            {listing.rent_details ? "編輯出租資料" : "補齊出租資料"}
                        </ActionButton>
                    ) : null}
                    {listing.status === "DRAFT" && propertyReady && listing.list_type === "SALE" ? (
                        <ActionButton variant={listing.sale_details ? "secondary" : "primary"} disabled={isActionLoading} onClick={() => setModal("saleDetails")}>
                            {listing.sale_details ? "編輯賣屋資料" : "補齊賣屋資料"}
                        </ActionButton>
                    ) : null}
                    {(listing.status === "DRAFT" || listing.status === "ACTIVE") ? <ActionButton onClick={() => setModal("edit")}>編輯刊登</ActionButton> : null}
                    <ActionButton onClick={() => navigate(`/my/listings/${listing.id}/print`)}>預覽刊登書</ActionButton>
                    {listing.status === "ACTIVE" ? <ActionButton variant="danger" onClick={() => void handleRemove()}>下架物件</ActionButton> : null}
                    {(listing.status === "ACTIVE" || listing.status === "NEGOTIATING") ? <ActionButton onClick={() => void handleClose()}>結案</ActionButton> : null}
                </>
            ) : isAuthenticated ? (
                <>
                    {canBook ? <ActionButton variant="primary" onClick={() => setModal("book")}>預約看屋</ActionButton> : null}
                    {!canBook ? <p className="text-center text-sm text-on-surface-variant">目前無法預約此物件。</p> : null}
                </>
            ) : (
                <ActionButton variant="primary" onClick={() => navigate("/login")}>登入後聯絡</ActionButton>
            )}

            {appointments.length > 0 ? (
                <div className="mt-4 border-t border-surface-container pt-4">
                    <h2 className="text-sm font-bold text-on-surface">預約紀錄</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">目前共有 {appointments.length} 筆預約。</p>
                </div>
            ) : null}
        </>
    }
/>
```

Keep all existing modals below this section.

- [ ] **Step 4: Run build**

Run: `npm run build` from `react-service`.

Expected: Build passes. Existing owner edit, intent, rent detail, sale detail, publish, remove, close, and book handlers still compile.

- [ ] **Step 5: Commit detail integration**

```bash
git add react-service/src/pages/ListingDetailPage.tsx
git commit -m "feat: use shared listing detail shell"
```

## Task 6: Print Book and Cover Preview

**Files:**
- Create: `react-service/src/components/listing/ListingPrintBook.tsx`
- Create: `react-service/src/components/listing/ListingCoverPreview.tsx`
- Create: `react-service/src/pages/ListingPrintPage.tsx`
- Modify: `react-service/src/router/index.tsx`
- Modify: `react-service/src/index.css`

- [ ] **Step 1: Add full listing book component**

Create `ListingPrintBook.tsx`:

```tsx
import ListingDetailShell from "./ListingDetailShell";
import type { ListingDisplayModel } from "./listingDisplayModel";

export default function ListingPrintBook({ model }: { model: ListingDisplayModel }) {
    return (
        <article className="mx-auto flex max-w-[960px] flex-col gap-6 bg-surface px-8 py-8 text-on-surface print:max-w-none print:px-0 print:py-0">
            <section className="listing-print-page rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <p className="text-sm font-bold text-on-surface-variant">完整刊登書 · 預覽稿</p>
                <h1 className="mt-3 text-4xl font-extrabold">{model.title}</h1>
                <p className="mt-3 text-sm text-on-surface-variant">{model.district} · {model.address}</p>
                <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
                    <div className="h-[360px] overflow-hidden rounded-2xl bg-surface-container-low">
                        {model.coverImageUrl ? (
                            <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm text-on-surface-variant">{model.priceCaption}</p>
                        <p className="mt-1 text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                        <div className="mt-6 grid gap-3">
                            {model.heroStats.map((stat) => (
                                <div key={stat.label} className="rounded-xl bg-surface-container-low p-4">
                                    <p className="text-xs text-on-surface-variant">{stat.label}</p>
                                    <p className="text-base font-bold">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <footer className="mt-8 flex justify-between border-t border-surface-container pt-4 text-xs text-on-surface-variant">
                    <span>物件 #{model.id}</span>
                    <span>產出時間 {model.generatedAtLabel}</span>
                </footer>
            </section>
            <ListingDetailShell model={model} mode="print" />
        </article>
    );
}
```

- [ ] **Step 2: Add cover preview component**

Create `ListingCoverPreview.tsx`:

```tsx
import type { ListingDisplayModel } from "./listingDisplayModel";

export default function ListingCoverPreview({ model }: { model: ListingDisplayModel }) {
    return (
        <article className="mx-auto aspect-[1.414/1] w-full max-w-[960px] overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-on-surface">
            <div className="grid h-full gap-6 md:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-2xl bg-surface-container-low">
                    {model.coverImageUrl ? (
                        <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                    )}
                </div>
                <div className="flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-bold text-on-surface-variant">刊登封面預覽 · 預覽稿</p>
                        <h1 className="mt-3 text-3xl font-extrabold">{model.title}</h1>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">{model.district} · {model.address}</p>
                        <p className="mt-8 text-sm text-on-surface-variant">{model.priceCaption}</p>
                        <p className="text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                    </div>
                    <div className="grid gap-2">
                        {model.heroStats.map((stat) => (
                            <div key={stat.label} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                                <span className="text-on-surface-variant">{stat.label}</span>
                                <span className="font-bold">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
```

- [ ] **Step 3: Add print page**

Create `ListingPrintPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getListing, type Listing } from "../api/listingApi";
import ListingCoverPreview from "../components/listing/ListingCoverPreview";
import ListingPrintBook from "../components/listing/ListingPrintBook";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
import SiteLayout from "../layouts/SiteLayout";

export default function ListingPrintPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const [listing, setListing] = useState<Listing | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const output = searchParams.get("output") === "cover" ? "cover" : "book";
    const listingId = id ? parseInt(id, 10) : Number.NaN;

    useEffect(() => {
        const load = async () => {
            if (Number.isNaN(listingId)) {
                setError("物件編號不正確");
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                setError("");
                setListing(await getListing(listingId));
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取物件失敗");
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [listingId]);

    if (isLoading) {
        return (
            <SiteLayout>
                <main className="px-6 py-20 text-center text-sm text-on-surface-variant">產生預覽內容中...</main>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <main className="mx-auto max-w-[960px] px-6 py-20">
                    <div className="rounded-2xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error || "找不到物件"}</div>
                </main>
            </SiteLayout>
        );
    }

    const model = buildListingDisplayModel(listing);

    return (
        <SiteLayout>
            <main className="bg-surface py-8 print:bg-white print:py-0">
                <div className="mx-auto mb-6 flex max-w-[960px] justify-end gap-3 px-6 print:hidden">
                    <button type="button" onClick={() => window.print()} className="rounded-xl bg-primary-container px-4 py-2 text-sm font-bold text-on-primary-container">
                        列印 / 另存 PDF
                    </button>
                </div>
                {output === "cover" ? <ListingCoverPreview model={model} /> : <ListingPrintBook model={model} />}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 4: Add routes**

In `react-service/src/router/index.tsx`, add import:

```ts
import ListingPrintPage from "../pages/ListingPrintPage";
```

Add route after `/my/listings/:id`:

```tsx
{
    path: "/my/listings/:id/print",
    element: (
        <RequireCredential requiredRole="OWNER">
            <ListingPrintPage />
        </RequireCredential>
    ),
},
```

- [ ] **Step 5: Add print CSS**

Append to `react-service/src/index.css`:

```css
@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  body {
    background: white;
  }

  .listing-print-page {
    break-after: page;
    page-break-after: always;
  }

  .listing-print-surface {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
}
```

- [ ] **Step 6: Run build**

Run: `npm run build` from `react-service`.

Expected: Build passes with new route and print page.

- [ ] **Step 7: Commit print output**

```bash
git add react-service/src/components/listing/ListingPrintBook.tsx react-service/src/components/listing/ListingCoverPreview.tsx react-service/src/pages/ListingPrintPage.tsx react-service/src/router/index.tsx react-service/src/index.css
git commit -m "feat: add listing print preview output"
```

## Task 7: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run frontend build**

Run: `npm run build` from `react-service`.

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 2: Run repository whitespace check**

Run from repo root:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Check generated/temp files**

Run from repo root:

```bash
rg --files | rg "\.(tmp|temp|bak|orig|log)$|\.go\.[0-9]+$|~$"
```

Expected: no new temporary artifacts created by this implementation.

- [ ] **Step 4: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended listing display, page, router, and CSS files are changed.

- [ ] **Step 5: Commit verification fixes if needed**

If verification required fixes, stage exact files and commit:

```bash
git add <exact-file-list>
git commit -m "fix: polish listing display verification"
```

Expected: final worktree contains only intentional uncommitted changes or is clean.
