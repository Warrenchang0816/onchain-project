# Batch A：存取控制 / Header / 地區篩選 / 需求列表 實作規格

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 四項純前端調整：遊客路由保護、Header 迎賓詞更新、地區篩選修復、需求列表開放並加入 Nav。

**Architecture:** 全部限於 react-service，無需新後端 API。需求列表頁面 UI 改版以符合出租列表風格。

**Tech Stack:** React 19, TypeScript 5, React Router v7, Tailwind CSS, Material Design Icons

---

## 功能 1：遊客 Access Control（路由保護）

### 需求
- 未登入使用者可以瀏覽：`/`、`/sale`（列表）、`/rent`（列表）
- 無法進入：`/sale/:id`、`/rent/:id`（詳情頁）→ 自動 redirect `/login`
- 不使用現有 `RequireCredential`（會顯示 GateFallback UI），而是直接跳轉

### 設計
新增 `react-service/src/components/common/RequireAuth.tsx`：
- 呼叫 `getAuthMe()`（或 `useIdentity()`）檢查 `authenticated`
- 若未登入 → `<Navigate to="/login" replace />`
- 若已登入 → render children

Router 調整（`react-service/src/router/index.tsx`）：
- `/sale/:id` 包裹 `<RequireAuth>`
- `/rent/:id` 包裹 `<RequireAuth>`

---

## 功能 2：Header 迎賓詞邏輯更新

### 需求
| 使用者狀態 | 顯示 |
|-----------|------|
| 未登入 | 維持現有 |
| 已登入 + KYC 未通過（審核中/未送審） | 維持現有（「審核中」/「訪客」） |
| 已登入 + KYC 通過 + 無已啟用身份 | 「尚未啟用身份」 |
| 已登入 + KYC 通過 + 任一身份啟用 | 「貴賓」 |

### 設計
修改 `react-service/src/components/common/Header.tsx` 中的迎賓詞 render 邏輯：

```typescript
// 目前邏輯（概念示意）
let greeting = "訪客";
if (identity.activatedRoles.includes("OWNER")) greeting = "房東";
// ...

// 新邏輯
let greeting: string | null = null;
if (kycStatus === "VERIFIED") {
  greeting = identity.activatedRoles.length > 0 ? "貴賓" : "尚未啟用身份";
} else if (kycStatus === "PENDING") {
  greeting = "審核中"; // 維持現有
} else {
  greeting = null; // 未送審維持現有（訪客 or 無顯示）
}
```

需要確認 Header 目前使用哪個欄位判斷 kycStatus，對應到 `KYCStatus` enum（`VERIFIED` / `PENDING` / `UNVERIFIED`）。

---

## 功能 3：地區篩選修復（區鎮第二層實際生效）

### 問題根源
UI 已有縣市（county）+ 區鎮（district）兩層下拉，但後端 query 只用 `county`，`district` 未傳入或未套用到 WHERE 條件。

### 需修改範圍

**前端（react-service）：**
- `SaleListPage.tsx`：確認 district 值是否納入 API 呼叫參數
- `RentListPage.tsx`：同上
- `saleListingApi.ts`：確認 `getSaleListings(params)` 接受並傳遞 `district` 參數
- `rentalListingApi.ts`：同上

**後端（go-service）：**
- `go-service/internal/modules/sale_listing/handler.go`：`ListSaleListings` handler 讀取 `district` query param 並傳入 service/repo
- `go-service/internal/modules/sale_listing/repo.go`（或等效 repository）：在 SQL WHERE 加入 `AND p.district = $N`（若 district 有值）
- `go-service/internal/modules/rental_listing/handler.go`：同上
- `go-service/internal/modules/rental_listing/repo.go`：同上

### district 對應欄位
`property` table 有 `district_id BIGINT REFERENCES taiwan_districts(id)`。join `taiwan_districts` 後篩選 `td.district = $district_param`。

或前端直接傳 `district_id`，在 handler 解析後做 WHERE 篩選。

---

## 功能 4：需求列表 Nav + UI 改版

### 需求
- Header Nav 新增「需求列表」，顯示條件：已登入（任何角色）
- `/requirements` 和 `/requirements/:id` 存取改為：已登入即可（移除 OWNER/AGENT 限制）
- `RequirementsPage` UI 改版：參照 `RentListPage`（卡片列表 + 搜尋欄）
- `RequirementDetailPage` UI 改版：參照 `RentDetailPage`（分 section 顯示）

### Header Nav 修改（Header.tsx）
在現有 nav 連結陣列加入：
```typescript
{ label: "需求列表", href: "/requirements", requireAuth: true }
```
（已登入才顯示，無需特定角色）

### Router 修改（router/index.tsx）
```typescript
// 改前：anyOf={["OWNER", "AGENT"]} 的 RequireCredential
// 改後：
{ path: "requirements", element: <RequireAuth><RequirementsPage /></RequireAuth> }
{ path: "requirements/:id", element: <RequireAuth><RequirementDetailPage /></RequireAuth> }
```

### RequirementsPage UI 改版
參照 `RentListPage.tsx` 結構：
- 頁面標題 + 副標說明
- 搜尋/篩選列：縣市 + 關鍵字（預算範圍可選）
- 卡片列表：每張卡顯示租客需求摘要（目標地區、預算範圍、格局需求、最短租期）
- 空狀態、載入狀態

### RequirementDetailPage UI 改版
參照 `RentDetailPage.tsx` 結構（分 section）：
- **需求概覽**：目標地區、預算上限、格局、坪數範圍、最短租期
- **租屋條件**：需要開伙/寵物/設籍、性別要求
- **生活期望**：lifestyle 備註、must-have 備註
- 若有 move-in timeline 顯示「入住時間」

---

## 驗證重點

1. 未登入點 `/sale/1` → 跳至 `/login`
2. 已登入點 `/sale/1` → 正常顯示
3. Header 迎賓詞：KYC 通過無身份 → 「尚未啟用身份」；有身份 → 「貴賓」
4. 出售列表選縣市 + 區鎮 → 結果確實篩選到該區鎮物件
5. 出租列表同上
6. 已登入普通會員可訪問 `/requirements`
7. 需求列表卡片顯示正確，點進詳情正常
