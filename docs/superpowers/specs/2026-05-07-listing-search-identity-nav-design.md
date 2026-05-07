# Listing Search & Identity Nav Design

## Goal

讓出售物件（`/sale`）和出租物件（`/rent`）擁有與租屋需求（`/requirements`）一致的搜尋篩選體驗；同時在屋主物件管理（`/my/properties`）和我的租屋需求（`/my/requirements`）頁面加上返回身分工作台的導航按鈕。搜尋元件重構為全站通用，未來任何列表頁均可直接套用。

## Architecture

### 元件泛化：RentalSearchFilters → ListingSearchFilters

現有的 `RentalSearchFilters` 語意過於窄（租屋），改名並擴充可設定的 props：

**新檔案：** `react-service/src/components/search/ListingSearchFilters.tsx`
**舊檔案：** `react-service/src/components/search/RentalSearchFilters.tsx` — 保留並改為 re-export（向後相容），同一個 commit 更新 `RequirementsPage` 使用新名稱後刪除舊檔。

#### 型別定義

```ts
export type ListingSearchFilterValues = {
  districts: DistrictSelection[];
  keyword: string;
  priceMin: string;
  priceMax: string;
};

type ListingSearchFiltersProps = {
  districtOptions: TaiwanDistrictOption[];
  values: ListingSearchFilterValues;
  submitLabel?: string;                 // 預設「搜尋」
  keywordPlaceholder?: string;          // 預設「地址、社區、關鍵字」
  pricePlaceholderMin?: string;         // 預設「最低價格」
  pricePlaceholderMax?: string;         // 預設「最高價格」
  onChange: (next: ListingSearchFilterValues) => void;
  onSubmit: () => void;
  onReset: () => void;
};
```

#### 各頁配置

| 頁面 | submitLabel | keywordPlaceholder | priceMin label | priceMax label |
|------|------------|-------------------|----------------|----------------|
| `/requirements` | 搜尋需求 | 街道、捷運站、社區、需求備註 | 最低預算 | 最高預算 |
| `/rent` | 搜尋出租 | 地址、社區、捷運站 | 最低月租 | 最高月租 |
| `/sale` | 搜尋出售 | 地址、社區、物件標題 | 最低總價 | 最高總價 |

### 搜尋邏輯：Client-side filtering

出售/出租列表一次載入全量 published 資料，在前端做三層過濾（與 RequirementsPage 的預算篩選同模式）：

**RentListPage 篩選：**
- `keyword`：比對 `property.title` 或 `property.address`（`toLowerCase().includes`）
- `priceMin/Max`：比對 `monthly_rent`（number）
- `district`：比對 `property.address` 包含行政區名稱（`districtSelection.district`）

**SaleListPage 篩選：**
- `keyword`：同上
- `priceMin/Max`：比對 `total_price`（number）
- `district`：同上

URL query params 與 RequirementsPage 一致，使用 `useSearchParams`：
- `?district=<token>&keyword=<str>&priceMin=<n>&priceMax=<n>`

### 返回身分工作台按鈕

`MyPropertiesPage` 和 `MyRequirementsPage` 頁面標題列左上方加一個次要按鈕：

```tsx
<Link to="/member" className="...">← 身分工作台</Link>
```

位置：`<h1>` 上方一行，使用現有的 `text-sm text-on-surface-variant` 樣式，不加新 CSS class。

## Files

| 動作 | 路徑 |
|------|------|
| 新增 | `react-service/src/components/search/ListingSearchFilters.tsx` |
| 刪除 | `react-service/src/components/search/RentalSearchFilters.tsx` |
| 修改 | `react-service/src/pages/RequirementsPage.tsx`（import 改名、欄位 `budgetMin/Max` → `priceMin/Max`）|
| 修改 | `react-service/src/pages/RentListPage.tsx`（加搜尋）|
| 修改 | `react-service/src/pages/SaleListPage.tsx`（加搜尋）|
| 修改 | `react-service/src/pages/MyPropertiesPage.tsx`（加返回按鈕）|
| 修改 | `react-service/src/pages/MyRequirementsPage.tsx`（加返回按鈕）|

## Data Flow

```
useSearchParams (URL)
  → parse: districts / keyword / priceMin / priceMax
    → useEffect: fetch all items (API)
      → useMemo: client-side filter(items, params)
        → render filtered list
          ↑ ListingSearchFilters onChange → setFilters (local state)
          ↑ onSubmit → setSearchParams (sync to URL)
          ↑ onReset  → setSearchParams({})
```

## Error Handling

- API 失敗：顯示錯誤訊息（現有模式，不改動）
- 篩選結果為空：顯示「目前沒有符合條件的物件」（現有空態 UI）
- district 比對找不到：跳過該篩選條件（不崩潰）

## Out of Scope

- 後端 query param 搜尋（資料量小，client-side 已足夠）
- 建築類型（building_type）篩選 — 可後續擴充，此次不加
- 坪數篩選 — 同上
