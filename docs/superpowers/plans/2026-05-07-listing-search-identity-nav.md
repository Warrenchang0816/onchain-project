# Listing Search & Identity Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將現有 `RentalSearchFilters` 元件泛化為全站通用的 `ListingSearchFilters`，並加入出售/出租列表的搜尋篩選與屋主頁面的身分工作台返回按鈕。

**Architecture:** 新建 `ListingSearchFilters.tsx` 取代舊 `RentalSearchFilters.tsx`，加入可設定的 placeholder props；出租/出售列表使用 URL query params + client-side filtering（`useMemo`）；`RequirementsPage` 同步改用新元件；`MyPropertiesPage` 與 `MyRequirementsPage` 加上 `<Link to="/member">` 返回按鈕。

**Tech Stack:** React 19, TypeScript 5 strict, React Router `useSearchParams`, Tailwind CSS

---

## File Map

| 動作 | 路徑 |
|------|------|
| 新增 | `react-service/src/components/search/ListingSearchFilters.tsx` |
| 刪除 | `react-service/src/components/search/RentalSearchFilters.tsx` |
| 修改 | `react-service/src/pages/RequirementsPage.tsx` |
| 修改 | `react-service/src/pages/RentListPage.tsx` |
| 修改 | `react-service/src/pages/SaleListPage.tsx` |
| 修改 | `react-service/src/pages/MyPropertiesPage.tsx` |
| 修改 | `react-service/src/pages/MyRequirementsPage.tsx` |

---

## Task 1: 建立 ListingSearchFilters 通用元件

**Files:**
- Create: `react-service/src/components/search/ListingSearchFilters.tsx`

- [ ] **Step 1: 建立新元件檔案**

完整寫入 `react-service/src/components/search/ListingSearchFilters.tsx`：

```tsx
import type { TaiwanDistrictOption } from "../../api/listingApi";
import DistrictMultiSelect from "../location/DistrictMultiSelect";
import { type DistrictSelection } from "../location/districtSelection";

export type ListingSearchFilterValues = {
    districts: DistrictSelection[];
    keyword: string;
    priceMin: string;
    priceMax: string;
};

type ListingSearchFiltersProps = {
    districtOptions: TaiwanDistrictOption[];
    values: ListingSearchFilterValues;
    submitLabel?: string;
    keywordPlaceholder?: string;
    pricePlaceholderMin?: string;
    pricePlaceholderMax?: string;
    onChange: (next: ListingSearchFilterValues) => void;
    onSubmit: () => void;
    onReset: () => void;
};

export default function ListingSearchFilters({
    districtOptions,
    values,
    submitLabel = "搜尋",
    keywordPlaceholder = "地址、社區、關鍵字",
    pricePlaceholderMin = "最低價格",
    pricePlaceholderMax = "最高價格",
    onChange,
    onSubmit,
    onReset,
}: ListingSearchFiltersProps) {
    const update = (patch: Partial<ListingSearchFilterValues>) => onChange({ ...values, ...patch });

    return (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
            <div className="grid gap-3 lg:grid-cols-[260px_minmax(280px,1fr)_130px_130px_auto_auto] lg:items-center">
                <DistrictMultiSelect
                    options={districtOptions}
                    value={values.districts}
                    onChange={(districts) => update({ districts })}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    value={values.keyword}
                    onChange={(e) => update({ keyword: e.target.value })}
                    placeholder={keywordPlaceholder}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.priceMin}
                    onChange={(e) => update({ priceMin: e.target.value })}
                    placeholder={pricePlaceholderMin}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.priceMax}
                    onChange={(e) => update({ priceMax: e.target.value })}
                    placeholder={pricePlaceholderMax}
                />
                <button
                    type="button"
                    onClick={onSubmit}
                    className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-colors hover:bg-primary"
                >
                    {submitLabel}
                </button>
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-xl border border-outline-variant/25 bg-transparent px-5 py-3 text-sm font-bold text-on-surface"
                >
                    清除
                </button>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: 確認 TypeScript 編譯無誤**

```bash
cd react-service && npm run lint
```

Expected: 0 errors（忽略 RentalSearchFilters 還存在的 warnings，下一個 task 才刪）

- [ ] **Step 3: Commit**

```bash
git add react-service/src/components/search/ListingSearchFilters.tsx
git commit -m "feat: add generic ListingSearchFilters component"
```

---

## Task 2: 遷移 RequirementsPage 並刪除舊 RentalSearchFilters

**Files:**
- Modify: `react-service/src/pages/RequirementsPage.tsx`
- Delete: `react-service/src/components/search/RentalSearchFilters.tsx`

- [ ] **Step 1: 更新 RequirementsPage 使用新元件**

完整替換 `react-service/src/pages/RequirementsPage.tsx`：

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import { getRequirementList, type TenantRequirement, type TenantRequirementStatus } from "@/api/tenantApi";
import ListingSearchFilters, { type ListingSearchFilterValues } from "@/components/search/ListingSearchFilters";
import TenantRequirementCard from "@/components/tenant/TenantRequirementCard";
import { districtOptionToSelection, encodeDistrictToken, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";

const statusOptions: { value: TenantRequirementStatus; label: string }[] = [
    { value: "OPEN", label: "開放中" },
    { value: "PAUSED", label: "暫停" },
    { value: "CLOSED", label: "已結案" },
];

function readSelectedDistricts(options: TaiwanDistrictOption[], tokens: string[]): DistrictSelection[] {
    const optionMap = new Map(options.map((option) => [encodeDistrictToken(option), option]));
    return tokens
        .map((token) => optionMap.get(token))
        .filter((option): option is TaiwanDistrictOption => Boolean(option))
        .map(districtOptionToSelection);
}

function budgetMatches(item: TenantRequirement, minValue: string, maxValue: string): boolean {
    const min = Number(minValue);
    const max = Number(maxValue);
    if (minValue && Number.isFinite(min) && item.budgetMax < min) return false;
    if (maxValue && Number.isFinite(max) && item.budgetMin > max) return false;
    return true;
}

export default function RequirementsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [items, setItems] = useState<TenantRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const selectedDistricts = useMemo(
        () => readSelectedDistricts(districtOptions, searchParams.getAll("district")),
        [districtOptions, searchParams],
    );
    const status = (searchParams.get("status") ?? "OPEN") as TenantRequirementStatus;
    const keyword = searchParams.get("keyword") ?? "";
    const priceMin = searchParams.get("priceMin") ?? "";
    const priceMax = searchParams.get("priceMax") ?? "";

    const [filters, setFilters] = useState<ListingSearchFilterValues>({
        districts: [],
        keyword: "",
        priceMin: "",
        priceMax: "",
    });

    useEffect(() => {
        setFilters({ districts: selectedDistricts, keyword, priceMin, priceMax });
    }, [selectedDistricts, keyword, priceMin, priceMax]);

    useEffect(() => {
        const loadDistricts = async () => {
            try {
                setDistrictOptions(await getTaiwanDistricts());
            } catch {
                setDistrictOptions([]);
            }
        };
        void loadDistricts();
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const results = await getRequirementList({
                    districts: selectedDistricts.map(encodeDistrictToken),
                    status,
                    keyword: keyword.trim() || undefined,
                });
                setItems(results.filter((item) => budgetMatches(item, priceMin, priceMax)));
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取租屋需求失敗");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [priceMax, priceMin, keyword, selectedDistricts, status]);

    const applyFilters = () => {
        const next = new URLSearchParams();
        filters.districts.forEach((district) => next.append("district", encodeDistrictToken(district)));
        if (filters.keyword.trim()) next.set("keyword", filters.keyword.trim());
        if (filters.priceMin.trim()) next.set("priceMin", filters.priceMin.trim());
        if (filters.priceMax.trim()) next.set("priceMax", filters.priceMax.trim());
        next.set("status", status);
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams({ status: "OPEN" }));

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">租屋需求</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        瀏覽租客公開的租屋條件，依行政區、預算與關鍵字找到適合媒合的需求。
                    </p>
                </header>

                <div className="grid gap-3">
                    <ListingSearchFilters
                        districtOptions={districtOptions}
                        values={filters}
                        submitLabel="搜尋需求"
                        keywordPlaceholder="街道、捷運站、社區、需求備註"
                        pricePlaceholderMin="最低預算"
                        pricePlaceholderMax="最高預算"
                        onChange={setFilters}
                        onSubmit={applyFilters}
                        onReset={resetFilters}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm font-bold text-on-surface" htmlFor="requirement-status">狀態</label>
                        <select
                            id="requirement-status"
                            className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                            value={status}
                            onChange={(event) => {
                                const next = new URLSearchParams(searchParams);
                                next.set("status", event.target.value);
                                setSearchParams(next);
                            }}
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-extrabold text-on-surface">目前沒有符合條件的需求</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                    </div>
                ) : (
                    <section className="grid gap-4 md:grid-cols-2">
                        {items.map((item) => (
                            <TenantRequirementCard
                                key={item.id}
                                requirement={item}
                                onOpen={() => navigate(`/requirements/${item.id}`)}
                            />
                        ))}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: 刪除舊 RentalSearchFilters.tsx**

```bash
rm react-service/src/components/search/RentalSearchFilters.tsx
```

- [ ] **Step 3: 確認無 TypeScript 錯誤**

```bash
cd react-service && npm run lint
```

Expected: 0 errors（不得有 `RentalSearchFilters` 找不到的錯誤）

- [ ] **Step 4: 瀏覽器驗證**

開啟 `http://localhost:5173/requirements`，確認：
- 搜尋列正常顯示（行政區、關鍵字欄位 placeholder 為「街道、捷運站、社區、需求備註」）
- 預算欄位 placeholder 為「最低預算」/ 「最高預算」
- 搜尋與清除按鈕正常運作

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/RequirementsPage.tsx
git rm react-service/src/components/search/RentalSearchFilters.tsx
git commit -m "refactor: migrate RequirementsPage to ListingSearchFilters, remove old component"
```

---

## Task 3: RentListPage 加入搜尋篩選

**Files:**
- Modify: `react-service/src/pages/RentListPage.tsx`

- [ ] **Step 1: 完整替換 RentListPage**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import { getRentalListings, type RentalListing } from "@/api/rentalListingApi";
import ListingSearchFilters, { type ListingSearchFilterValues } from "@/components/search/ListingSearchFilters";
import { districtOptionToSelection, encodeDistrictToken, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};

function formatLayout(rl: RentalListing): string {
    const p = rl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

function readSelectedDistricts(options: TaiwanDistrictOption[], tokens: string[]): DistrictSelection[] {
    const optionMap = new Map(options.map((o) => [encodeDistrictToken(o), o]));
    return tokens
        .map((t) => optionMap.get(t))
        .filter((o): o is TaiwanDistrictOption => Boolean(o))
        .map(districtOptionToSelection);
}

function matchesRent(
    item: RentalListing,
    districts: DistrictSelection[],
    keyword: string,
    priceMin: string,
    priceMax: string,
): boolean {
    const addr = item.property?.address?.toLowerCase() ?? "";
    const title = item.property?.title?.toLowerCase() ?? "";
    if (keyword.trim()) {
        const kw = keyword.toLowerCase().trim();
        if (!addr.includes(kw) && !title.includes(kw)) return false;
    }
    if (districts.length > 0) {
        const hit = districts.some((d) => addr.includes(d.district) || addr.includes(d.county));
        if (!hit) return false;
    }
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (priceMin && Number.isFinite(min) && item.monthly_rent < min) return false;
    if (priceMax && Number.isFinite(max) && item.monthly_rent > max) return false;
    return true;
}

export default function RentListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [allItems, setAllItems] = useState<RentalListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const selectedDistricts = useMemo(
        () => readSelectedDistricts(districtOptions, searchParams.getAll("district")),
        [districtOptions, searchParams],
    );
    const keyword = searchParams.get("keyword") ?? "";
    const priceMin = searchParams.get("priceMin") ?? "";
    const priceMax = searchParams.get("priceMax") ?? "";

    const [filters, setFilters] = useState<ListingSearchFilterValues>({
        districts: [], keyword: "", priceMin: "", priceMax: "",
    });

    useEffect(() => {
        setFilters({ districts: selectedDistricts, keyword, priceMin, priceMax });
    }, [selectedDistricts, keyword, priceMin, priceMax]);

    useEffect(() => {
        const loadDistricts = async () => {
            try { setDistrictOptions(await getTaiwanDistricts()); } catch { setDistrictOptions([]); }
        };
        void loadDistricts();
    }, []);

    useEffect(() => {
        getRentalListings()
            .then(setAllItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    const items = useMemo(
        () => allItems.filter((item) => matchesRent(item, selectedDistricts, keyword, priceMin, priceMax)),
        [allItems, selectedDistricts, keyword, priceMin, priceMax],
    );

    const applyFilters = () => {
        const next = new URLSearchParams();
        filters.districts.forEach((d) => next.append("district", encodeDistrictToken(d)));
        if (filters.keyword.trim()) next.set("keyword", filters.keyword.trim());
        if (filters.priceMin.trim()) next.set("priceMin", filters.priceMin.trim());
        if (filters.priceMax.trim()) next.set("priceMax", filters.priceMax.trim());
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams());

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出租物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出租房源，快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <div className="mb-6 grid gap-3">
                        <ListingSearchFilters
                            districtOptions={districtOptions}
                            values={filters}
                            submitLabel="搜尋出租"
                            keywordPlaceholder="地址、社區、捷運站"
                            pricePlaceholderMin="最低月租"
                            pricePlaceholderMax="最高月租"
                            onChange={setFilters}
                            onSubmit={applyFilters}
                            onReset={resetFilters}
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取租屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的租屋物件</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/rent/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                        {BUILDING_TYPE_LABEL[item.property.building_type] ?? item.property.building_type}
                                                    </span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                                {item.allow_pets ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">可養寵物</span> : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出租 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">
                                                {item.property?.address ?? "地址未提供"}
                                            </p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-2xl font-extrabold text-on-surface">
                                                NT$ {item.monthly_rent.toLocaleString()}
                                                <span className="ml-1 text-base font-normal text-on-surface-variant">/ 月</span>
                                            </p>
                                            <p className="mt-1 text-xs text-on-surface-variant">押金 {item.deposit_months} 個月</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: 確認無 TypeScript 錯誤**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: 瀏覽器驗證**

開啟 `http://localhost:5173/rent`，確認：
- 搜尋列顯示在列表上方
- keyword placeholder 為「地址、社區、捷運站」
- 月租 placeholder 為「最低月租」/ 「最高月租」
- 輸入關鍵字後按「搜尋出租」→ 列表即時篩選
- 按「清除」→ 還原全部列表

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/RentListPage.tsx
git commit -m "feat: add search filters to RentListPage"
```

---

## Task 4: SaleListPage 加入搜尋篩選

**Files:**
- Modify: `react-service/src/pages/SaleListPage.tsx`

- [ ] **Step 1: 完整替換 SaleListPage**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import { getSaleListings, type SaleListing } from "@/api/saleListingApi";
import ListingSearchFilters, { type ListingSearchFilterValues } from "@/components/search/ListingSearchFilters";
import { districtOptionToSelection, encodeDistrictToken, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};

function formatLayout(sl: SaleListing): string {
    const p = sl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

function readSelectedDistricts(options: TaiwanDistrictOption[], tokens: string[]): DistrictSelection[] {
    const optionMap = new Map(options.map((o) => [encodeDistrictToken(o), o]));
    return tokens
        .map((t) => optionMap.get(t))
        .filter((o): o is TaiwanDistrictOption => Boolean(o))
        .map(districtOptionToSelection);
}

function matchesSale(
    item: SaleListing,
    districts: DistrictSelection[],
    keyword: string,
    priceMin: string,
    priceMax: string,
): boolean {
    const addr = item.property?.address?.toLowerCase() ?? "";
    const title = item.property?.title?.toLowerCase() ?? "";
    if (keyword.trim()) {
        const kw = keyword.toLowerCase().trim();
        if (!addr.includes(kw) && !title.includes(kw)) return false;
    }
    if (districts.length > 0) {
        const hit = districts.some((d) => addr.includes(d.district) || addr.includes(d.county));
        if (!hit) return false;
    }
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (priceMin && Number.isFinite(min) && item.total_price < min) return false;
    if (priceMax && Number.isFinite(max) && item.total_price > max) return false;
    return true;
}

export default function SaleListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [allItems, setAllItems] = useState<SaleListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const selectedDistricts = useMemo(
        () => readSelectedDistricts(districtOptions, searchParams.getAll("district")),
        [districtOptions, searchParams],
    );
    const keyword = searchParams.get("keyword") ?? "";
    const priceMin = searchParams.get("priceMin") ?? "";
    const priceMax = searchParams.get("priceMax") ?? "";

    const [filters, setFilters] = useState<ListingSearchFilterValues>({
        districts: [], keyword: "", priceMin: "", priceMax: "",
    });

    useEffect(() => {
        setFilters({ districts: selectedDistricts, keyword, priceMin, priceMax });
    }, [selectedDistricts, keyword, priceMin, priceMax]);

    useEffect(() => {
        const loadDistricts = async () => {
            try { setDistrictOptions(await getTaiwanDistricts()); } catch { setDistrictOptions([]); }
        };
        void loadDistricts();
    }, []);

    useEffect(() => {
        getSaleListings()
            .then(setAllItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取售屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    const items = useMemo(
        () => allItems.filter((item) => matchesSale(item, selectedDistricts, keyword, priceMin, priceMax)),
        [allItems, selectedDistricts, keyword, priceMin, priceMax],
    );

    const applyFilters = () => {
        const next = new URLSearchParams();
        filters.districts.forEach((d) => next.append("district", encodeDistrictToken(d)));
        if (filters.keyword.trim()) next.set("keyword", filters.keyword.trim());
        if (filters.priceMin.trim()) next.set("priceMin", filters.priceMin.trim());
        if (filters.priceMax.trim()) next.set("priceMax", filters.priceMax.trim());
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams());

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出售物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出售房源，依行政區、總價快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <div className="mb-6 grid gap-3">
                        <ListingSearchFilters
                            districtOptions={districtOptions}
                            values={filters}
                            submitLabel="搜尋出售"
                            keywordPlaceholder="地址、社區、物件標題"
                            pricePlaceholderMin="最低總價"
                            pricePlaceholderMax="最高總價"
                            onChange={setFilters}
                            onSubmit={applyFilters}
                            onReset={resetFilters}
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取售屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的出售物件</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/sale/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{BUILDING_TYPE_LABEL[item.property.building_type] ?? item.property.building_type}</span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出售 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">{item.property?.address ?? "地址未提供"}</p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-2xl font-extrabold text-on-surface">
                                                NT$ {item.total_price.toLocaleString()}
                                            </p>
                                            {item.unit_price_per_ping != null ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">單坪 NT$ {item.unit_price_per_ping.toLocaleString()}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: 確認無 TypeScript 錯誤**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: 瀏覽器驗證**

開啟 `http://localhost:5173/sale`，確認：
- 搜尋列顯示
- placeholder 為「地址、社區、物件標題」/ 「最低總價」/ 「最高總價」
- 搜尋與清除正常

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/SaleListPage.tsx
git commit -m "feat: add search filters to SaleListPage"
```

---

## Task 5: 加入身分工作台返回按鈕

**Files:**
- Modify: `react-service/src/pages/MyPropertiesPage.tsx`
- Modify: `react-service/src/pages/MyRequirementsPage.tsx`

- [ ] **Step 1: MyPropertiesPage 加返回按鈕**

在 `react-service/src/pages/MyPropertiesPage.tsx` 中，找到 import 區段，在 `useNavigate` 那行加入 `Link`：

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
```

然後在 JSX 中，`<h1 className="...">我的物件</h1>` 的**上方**加一行：

```tsx
<Link
    to="/member"
    className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
>
    ← 身分工作台
</Link>
```

最終 `<header>` 區塊如下（其餘不變）：

```tsx
<header className="flex items-start justify-between">
    <div>
        <Link
            to="/member"
            className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
        >
            ← 身分工作台
        </Link>
        <h1 className="text-4xl font-extrabold text-on-surface">我的物件</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
            管理你的房屋物件，完成後可上架出租或出售。
        </p>
    </div>
    <button
        onClick={() => navigate("/my/properties/new")}
        className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-colors hover:bg-primary"
    >
        + 新增物件
    </button>
</header>
```

> **注意：** 先讀取 MyPropertiesPage.tsx 的完整內容，確認現有 `<header>` 區塊結構，只替換 header 內部，不動其他部分。

- [ ] **Step 2: MyRequirementsPage 加返回按鈕**

在 `react-service/src/pages/MyRequirementsPage.tsx` 中，找到 import 區段加入 `Link`：

```tsx
import { Link } from "react-router-dom";
```

在頁面最上方的標題 `<h1>` 上方插入：

```tsx
<Link
    to="/member"
    className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
>
    ← 身分工作台
</Link>
```

> **注意：** 先讀取 MyRequirementsPage.tsx 的完整內容，確認現有標題結構後再插入，只加這一行。

- [ ] **Step 3: 確認無 TypeScript 錯誤**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 4: 瀏覽器驗證**

1. 以 OWNER 帳號登入，前往 `http://localhost:5173/my/properties`
   - 頁面左上角標題上方應看到「← 身分工作台」連結
   - 點擊後應跳轉至 `/member`
2. 前往 `http://localhost:5173/my/requirements`（需 TENANT 身分）
   - 同樣看到「← 身分工作台」連結並可正常跳轉

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/MyPropertiesPage.tsx react-service/src/pages/MyRequirementsPage.tsx
git commit -m "feat: add back-to-identity-center link on owner and tenant management pages"
```

---

## 最終驗證

```bash
cd react-service && npm run lint && npm run build
```

Expected:
- 0 TypeScript errors
- Build 成功，無 import 找不到的錯誤（`RentalSearchFilters` 已完全移除）
