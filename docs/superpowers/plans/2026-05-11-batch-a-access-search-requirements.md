# Batch A：存取控制 / Header / 地區篩選 / 需求列表 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四項純前端調整：遊客路由保護、Header 迎賓詞邏輯更新、地區篩選 bug 修復、需求列表開放所有登入會員並加入 Nav。

**Architecture:** 全部限於 react-service，無需新後端 API。新增 RequireAuth 元件作為路由守衛，修改現有 Header、SaleListPage、RentListPage、RequirementsPage。

**Tech Stack:** React 19, TypeScript 5 strict, React Router v7, Tailwind CSS

---

## 檔案異動清單

| 操作 | 路徑 |
|------|------|
| 新增 | `react-service/src/components/common/RequireAuth.tsx` |
| 修改 | `react-service/src/router/index.tsx` |
| 修改 | `react-service/src/components/common/Header.tsx` |
| 修改 | `react-service/src/pages/SaleListPage.tsx` |
| 修改 | `react-service/src/pages/RentListPage.tsx` |
| 修改 | `react-service/src/pages/RequirementsPage.tsx` |

---

## Task 1：新增 RequireAuth 路由守衛元件

**Files:**
- Create: `react-service/src/components/common/RequireAuth.tsx`

- [ ] **Step 1：建立 RequireAuth.tsx**

```typescript
// react-service/src/components/common/RequireAuth.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";

export default function RequireAuth({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<"loading" | "auth" | "unauth">("loading");

    useEffect(() => {
        getAuthMe()
            .then((r) => setStatus(r.authenticated ? "auth" : "unauth"))
            .catch(() => setStatus("unauth"));
    }, []);

    if (status === "loading") return null;
    if (status === "unauth") return <Navigate to="/login" replace />;
    return <>{children}</>;
}
```

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3：Commit**

```bash
git add react-service/src/components/common/RequireAuth.tsx
git commit -m "feat: add RequireAuth route guard component"
```

---

## Task 2：Router — 保護出售和出租詳情路由

**Files:**
- Modify: `react-service/src/router/index.tsx:1,153-156`

Context: 目前 lines 153-156：
```typescript
{ path: "/sale", element: <SaleListPage /> },
{ path: "/sale/:id", element: <SaleDetailPage /> },
{ path: "/rent", element: <RentListPage /> },
{ path: "/rent/:id", element: <RentDetailPage /> },
```

- [ ] **Step 1：在 router/index.tsx 加入 RequireAuth import**

在現有 import 區塊（line 14 附近，RequireCredential import 之後）加入：
```typescript
import RequireAuth from "../components/common/RequireAuth";
```

- [ ] **Step 2：包裹詳情路由**

將 lines 153-156 改為：
```typescript
{ path: "/sale", element: <SaleListPage /> },
{ path: "/sale/:id", element: <RequireAuth><SaleDetailPage /></RequireAuth> },
{ path: "/rent", element: <RentListPage /> },
{ path: "/rent/:id", element: <RequireAuth><RentDetailPage /></RequireAuth> },
```

- [ ] **Step 3：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4：手動驗證**

在瀏覽器中：
1. 未登入狀態下訪問 `http://localhost:5173/sale/1` → 應跳轉到 `/login`
2. 未登入狀態下訪問 `http://localhost:5173/rent/1` → 應跳轉到 `/login`
3. 未登入狀態下訪問 `http://localhost:5173/sale` → 應正常顯示列表

- [ ] **Step 5：Commit**

```bash
git add react-service/src/router/index.tsx
git commit -m "feat: protect sale/:id and rent/:id routes for authenticated users only"
```

---

## Task 3：Header 迎賓詞邏輯更新

**Files:**
- Modify: `react-service/src/components/common/Header.tsx:17-24,87-88,114`

Context: 目前 `deriveRole()` 函式（lines 17-24）：
```typescript
function deriveRole(kycStatus: KYCStatus, credentials: string[]): string {
    if (credentials.includes("AGENT")) return "仲介";
    if (credentials.includes("OWNER")) return "房東";
    if (credentials.includes("TENANT")) return "租客";
    if (kycStatus === "VERIFIED") return "已驗證";
    if (kycStatus === "PENDING") return "審核中";
    return "訪客";
}
```

新邏輯：
| 狀態 | 顯示 |
|------|------|
| KYC 通過 + 任一身份啟用 | 「貴賓」 |
| KYC 通過 + 無已啟用身份 | 「尚未啟用身份」 |
| KYC 審核中 | 「審核中」（維持現有） |
| 其他 | 「訪客」（維持現有） |

- [ ] **Step 1：更新 deriveRole 函式**

將 lines 17-24 改為：
```typescript
function deriveRole(kycStatus: KYCStatus, credentials: string[]): string {
    if (kycStatus === "VERIFIED") {
        return credentials.length > 0 ? "貴賓" : "尚未啟用身份";
    }
    if (kycStatus === "PENDING") return "審核中";
    return "訪客";
}
```

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3：手動驗證**

在瀏覽器中：
1. 未登入 → Header 右上角顯示「登入」（不變）
2. 已登入 + KYC 通過 + 已啟用房東身份 → 顯示「貴賓」
3. 已登入 + KYC 通過 + 無身份 → 顯示「尚未啟用身份」
4. 已登入 + KYC 審核中 → 顯示「審核中」

- [ ] **Step 4：Commit**

```bash
git add react-service/src/components/common/Header.tsx
git commit -m "feat: update header greeting to show 貴賓/尚未啟用身份 based on credential status"
```

---

## Task 4：地區篩選 Bug 修復

**Files:**
- Modify: `react-service/src/pages/SaleListPage.tsx:44-46`
- Modify: `react-service/src/pages/RentListPage.tsx:44-46`

**Root cause：** `matchesSale()` / `matchesRent()` 第 45 行條件：
```typescript
const hit = districts.some((d) => addr.includes(d.district) || addr.includes(d.county));
```
`DistrictSelection` 每筆都包含 `county` 和 `district`（例如 `{ county: "新北市", district: "板橋區" }`）。因為條件同時 check `d.county`，選了板橋區後「新北市」所有物件都會通過篩選。

**Fix：** 只 check `d.district`（已選到具體區鎮，county 是多餘的）。

- [ ] **Step 1：修復 SaleListPage.tsx 第 45 行**

```typescript
// react-service/src/pages/SaleListPage.tsx, matchesSale() function
// 修改前（line 45）：
const hit = districts.some((d) => addr.includes(d.district) || addr.includes(d.county));
// 修改後：
const hit = districts.some((d) => addr.includes(d.district));
```

- [ ] **Step 2：修復 RentListPage.tsx 第 45 行**

```typescript
// react-service/src/pages/RentListPage.tsx, matchesRent() function
// 修改前（line 45）：
const hit = districts.some((d) => addr.includes(d.district) || addr.includes(d.county));
// 修改後：
const hit = districts.some((d) => addr.includes(d.district));
```

- [ ] **Step 3：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4：手動驗證**

在瀏覽器 `http://localhost:5173/sale`：
1. 選縣市「新北市」後選區鎮「板橋區」→ 點「搜尋出售」
2. 結果應只顯示地址包含「板橋區」的物件，新莊區/三重區等不應出現
3. 同樣在 `http://localhost:5173/rent` 測試

- [ ] **Step 5：Commit**

```bash
git add react-service/src/pages/SaleListPage.tsx react-service/src/pages/RentListPage.tsx
git commit -m "fix: district filter now matches specific district instead of whole county"
```

---

## Task 5：Header Nav 加需求列表 + Router 開放

**Files:**
- Modify: `react-service/src/components/common/Header.tsx:88,114`
- Modify: `react-service/src/router/index.tsx:89-103`

Context：
- Header.tsx line 88：`const canBrowseRequirements = state.authenticated && (state.credentials.includes("OWNER") || state.credentials.includes("AGENT"));`
- Header.tsx line 114：`{canBrowseRequirements ? <NavLink to="/requirements" className={navLinkCls}>租屋需求</NavLink> : null}`
- Router lines 89-103：`/requirements` 和 `/requirements/:id` 被 `RequireCredential anyOf={["OWNER", "AGENT"]}` 包裹

- [ ] **Step 1：修改 canBrowseRequirements 條件**

Header.tsx line 88 改為：
```typescript
const canBrowseRequirements = state.authenticated;
```

- [ ] **Step 2：更新 Nav 標籤**

Header.tsx line 114 改為：
```typescript
{canBrowseRequirements ? <NavLink to="/requirements" className={navLinkCls}>需求列表</NavLink> : null}
```

- [ ] **Step 3：修改 router 移除角色限制**

router/index.tsx lines 88-103（`/requirements` 和 `/requirements/:id`）改為：
```typescript
{
    path: "/requirements",
    element: (
        <RequireAuth>
            <RequirementsPage />
        </RequireAuth>
    ),
},
{
    path: "/requirements/:id",
    element: (
        <RequireAuth>
            <RequirementDetailPage />
        </RequireAuth>
    ),
},
```

注意：`RequireAuth` 已在 Task 2 中 import，此處可直接使用。

- [ ] **Step 4：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5：手動驗證**

1. 未登入 → Header 不顯示「需求列表」
2. 已登入（任何角色，包括 KYC 通過但無角色）→ Header 顯示「需求列表」
3. 點擊「需求列表」→ 正常進入 RequirementsPage（不再要求房東/仲介角色）

- [ ] **Step 6：Commit**

```bash
git add react-service/src/components/common/Header.tsx react-service/src/router/index.tsx
git commit -m "feat: open requirements list to all authenticated users and add to nav"
```

---

## Task 6：RequirementsPage UI 改版（參照出租列表）

**Files:**
- Modify: `react-service/src/pages/RequirementsPage.tsx`

Context：現有 RequirementsPage 使用 `<main>` 平面結構；RentListPage 使用「gradient hero section + bg-surface body section」雙層結構。需將 RequirementsPage 改為相同佈局，並將 2-column grid 改為單欄列表。

目前 RequirementsPage 的 return（lines 103-167）結構：
```jsx
<SiteLayout>
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
        <header ...>頁首</header>
        <div>篩選列</div>
        {/* 2-column grid of TenantRequirementCard */}
        <section className="grid gap-4 md:grid-cols-2">
```

- [ ] **Step 1：改寫 RequirementsPage return（保持 API 邏輯不變，只更新 JSX）**

```typescript
// react-service/src/pages/RequirementsPage.tsx
// 只更改 return 部分（lines 103-167），API 邏輯和 state 不動

return (
    <SiteLayout>
        <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
            <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">需求列表</h1>
                <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                    瀏覽租客公開的租屋條件，依行政區、預算與關鍵字找到適合媒合的需求。
                </p>
            </div>
        </section>

        <section className="w-full bg-surface py-12">
            <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                <div className="mb-6 grid gap-3">
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
                    <div className="flex items-center justify-center py-32">
                        <span className="animate-pulse text-sm text-on-surface-variant">讀取需求中...</span>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的租屋需求</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/requirements/${item.id}`)}
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="flex-1">
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {item.targetDistricts?.length > 0 ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                    {item.targetDistricts[0].county} {item.targetDistricts[0].district}
                                                    {item.targetDistricts.length > 1 ? ` 等 ${item.targetDistricts.length} 區` : ""}
                                                </span>
                                            ) : item.targetDistrict ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{item.targetDistrict}</span>
                                            ) : null}
                                            {item.roomMin != null && item.roomMin > 0 ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{item.roomMin}房以上</span>
                                            ) : null}
                                            {item.minLeaseMonths > 0 ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">最短 {item.minLeaseMonths} 個月</span>
                                            ) : null}
                                        </div>
                                        <h2 className="text-lg font-bold text-on-surface">
                                            {item.lifestyleNote?.trim() || `租屋需求 #${item.id}`}
                                        </h2>
                                        {item.mustHaveNote?.trim() ? (
                                            <p className="mt-1 text-sm text-on-surface-variant">{item.mustHaveNote}</p>
                                        ) : null}
                                        {item.moveInTimeline?.trim() ? (
                                            <p className="mt-1 text-xs text-on-surface-variant">入住時間：{item.moveInTimeline}</p>
                                        ) : null}
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-xl font-extrabold text-on-surface">
                                            NT$ {item.budgetMin.toLocaleString()}
                                            <span className="mx-1 text-base font-normal text-on-surface-variant">—</span>
                                            {item.budgetMax.toLocaleString()}
                                        </p>
                                        <p className="mt-1 text-xs text-on-surface-variant">預算 / 月</p>
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
```

注意：上方 JSX 中使用 `item.targetDistricts`、`item.roomMin`、`item.minLeaseMonths` 等欄位，需確認與 `TenantRequirement` type 定義一致。若欄位名稱不同，依 `react-service/src/api/tenantApi.ts` 中的實際 type 調整。

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

若有型別錯誤，開啟 `react-service/src/api/tenantApi.ts` 查看 `TenantRequirement` 的實際欄位名稱並調整 JSX。

- [ ] **Step 3：手動驗證**

在瀏覽器中：
1. 以已登入帳號訪問 `http://localhost:5173/requirements`
2. 確認頁面有 gradient hero section + 列表區域
3. 需求卡片為單欄顯示
4. 搜尋和篩選功能正常

- [ ] **Step 4：Commit**

```bash
git add react-service/src/pages/RequirementsPage.tsx
git commit -m "feat: redesign RequirementsPage to match RentListPage layout"
```

---

## 最終驗證清單

執行所有手動測試後確認：

- [ ] 未登入訪問 `/sale/1` → redirect `/login`
- [ ] 未登入訪問 `/rent/1` → redirect `/login`
- [ ] 未登入訪問 `/sale` → 正常顯示列表（不 redirect）
- [ ] KYC 通過有身份 → Header 顯示「貴賓」
- [ ] KYC 通過無身份 → Header 顯示「尚未啟用身份」
- [ ] KYC 審核中 → Header 顯示「審核中」（不變）
- [ ] 出售列表選板橋區 → 只顯示板橋區物件
- [ ] 已登入一般會員可訪問 `/requirements`
- [ ] `/requirements` 頁面 UI 為 gradient hero + 單欄列表
