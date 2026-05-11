# Batch B：加入最愛 / 屋主身分認證流程 實作規格

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 兩項前後端功能：（1）每個物件可加入最愛，收藏在會員選單；（2）屋主身分認證加入聲明必填及附件比對審核。

**Architecture:** 後端 Go service 新增 favorites module；前端新增 HeartButton 元件、更新 FavoritesPage；OwnerCredentialPage 加入聲明 section 和附件比對邏輯。

**Tech Stack:** Go 1.25 + Gin + lib/pq（後端）；React 19 + TypeScript 5（前端）

---

## 功能 5：加入最愛（Favorites）

### 5A 後端

**新 DB table（加入 EnsureSchema）：**
```sql
CREATE TABLE IF NOT EXISTS user_favorites (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_type VARCHAR(10) NOT NULL CHECK (listing_type IN ('SALE', 'RENT')),
    listing_id   BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_favorites UNIQUE (user_id, listing_type, listing_id)
)
```
```sql
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites (user_id, listing_type)
```

**新 Go module**（依照現有分層架構）：

`go-service/internal/modules/favorites/`
- `model.go`：`UserFavorite` struct（Id, UserId, ListingType, ListingId, CreatedAt）
- `repo.go`：
  - `FindByUser(userID int64, listingType string) ([]UserFavorite, error)`
  - `IsFavorited(userID, listingID int64, listingType string) (bool, error)`
  - `Add(userID, listingID int64, listingType string) error`
  - `Remove(userID, listingID int64, listingType string) error`
- `handler.go`：
  - `GET /favorites?type=SALE|RENT` → 回傳該使用者收藏列表（需驗證登入）
  - `POST /favorites` body: `{listing_type, listing_id}` → 新增收藏（需驗證登入）
  - `DELETE /favorites/:type/:id` → 移除收藏（需驗證登入）
  - `GET /favorites/:type/:id/check` → 回傳 `{favorited: bool}`（需驗證登入）
- `router.go`：掛載到 `/api/favorites`

Response 格式維持現有 envelope：`{ "success": true, "data": <T> }`

**Session 驗證**：從現有 auth middleware 取 userID（與其他 module 相同）

### 5B 前端

**新 API module `react-service/src/api/favoritesApi.ts`：**
```typescript
type ListingType = "SALE" | "RENT";

getFavorites(type: ListingType): Promise<Favorite[]>
addFavorite(type: ListingType, id: number): Promise<void>
removeFavorite(type: ListingType, id: number): Promise<void>
checkFavorite(type: ListingType, id: number): Promise<boolean>
```

**新元件 `react-service/src/components/common/HeartButton.tsx`：**
- Props：`listingType: ListingType`, `listingId: number`, `authenticated: boolean`
- 狀態：`favorited: boolean`（mount 時呼叫 `checkFavorite`）
- 已登入：點愛心呼叫 `addFavorite`/`removeFavorite`，toggle icon
- 未登入：點愛心 → `navigate("/login")`
- Icon：Material Design `favorite_border`（空心）/ `favorite`（實心，紅色 `text-red-500`）
- 載入中 disable 按鈕

**加入 HeartButton 的位置：**
- `SaleListPage.tsx`：每張物件卡片右上角
- `RentListPage.tsx`：同上
- `SaleDetailPage.tsx`：Hero section 右上角
- `RentDetailPage.tsx`：同上

**更新 `FavoritesPage.tsx`：**
- 切換 tab：「出售」/「出租」
- 分別呼叫 `getFavorites("SALE")` 和 `getFavorites("RENT")`
- 以現有 listing card 格式顯示（複用 SaleListPage / RentListPage 的卡片元件）
- 卡片可點進詳情（`/sale/:id` 或 `/rent/:id`）
- 每張卡片右上角保留 HeartButton（可在此頁面直接移除收藏）
- 空狀態：「尚無收藏物件」

**會員選單（Header.tsx）：**
- 已登入後的 user menu 加入「我的收藏」連結 → `/favorites`（已登入才顯示）

---

## 功能 6：屋主身分認證流程調整

### 6A 目標
現有 `OwnerCredentialPage.tsx` 流程：填寫房屋地址 + 權狀字號 → 上傳主要文件 → 送出智能審核。

**新流程**：
1. 填寫基本資料（面積/格局/樓層等）+ 建物詳情（結構/外牆等）— 必填
2. 勾選三項聲明（必填全部）
3. 提交申請（不需上傳文件即可送出）
4. 可選上傳附件（權狀/所有權證明）→ 觸發智能審核（比對附件內容與填寫的物件資料）

### 6B 頁面改版（OwnerCredentialPage.tsx）

**Section 1：房屋基本資料**（目前只有地址 + 權狀字號，需擴充）
- 房屋地址（必填）
- 權狀字號（選填）
- 建物類型（大樓/公寓/透天/店面）
- 樓層 / 總樓層
- 主建物面積 / 附屬建物面積 / 陽台面積（坪）
- 格局（房/廳/衛）
- 屋齡（年）

**Section 2：建物詳情**（新增）
- 建物結構（鋼筋混凝土/鋼構/磚造等）
- 外牆建材
- 該層戶數
- 謄本用途 / 使用分區

**Section 3：物件聲明（必填，全部勾選才可提交）**
```
□ 本物件非海砂屋，無使用海砂混凝土之情形
□ 本物件非輻射屋，未受輻射污染
□ 本物件非凶宅，近期無發生非自然死亡事件
```

**提交按鈕**：
- 三個聲明全部勾選 → 「提交申請」按鈕啟用
- 提交後：進入 PENDING 狀態（不需等文件審核）

**Section 4：附件上傳（選填，可在提交前或提交後上傳）**

維持現有 UI 邏輯（補充文件 + 審核備註）：
- 「選擇檔案」上傳權狀或所有權證明
- 「送出智能審核」按鈕 → 觸發現有 AI 分析流程
- 「人工審核」secondary 選項
- **審核目標改為**：比對上傳附件的內容是否符合 Section 1+2 填寫的物件資料（地址、面積、結構等）
- 後端 AI prompt 需更新，從「比對 KYC 身份證資料」改為「比對物件基本資料欄位」

### 6C PropertyCreatePage / PropertyEditPage（草稿頁面）

同樣在草稿頁面下方新增「物件聲明」section：
- 三個聲明 checkbox（同上）
- 「上架」按鈕前驗證：三個聲明必須全部勾選
- 聲明狀態存於 property 或 sale/rental listing 的某個欄位（需在 DB 新增 3 個 boolean 欄位或一個 json 欄位）

**DB 方案（建議）**：在 `property` table 新增：
```sql
ALTER TABLE property
  ADD COLUMN IF NOT EXISTS declaration_no_sea_sand  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS declaration_no_radiation  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS declaration_no_haunted    BOOLEAN NOT NULL DEFAULT FALSE
```

加入 `EnsureSchema`。

### 6D 後端調整（AI 審核 prompt）

找到現有智能審核的 AI call（推測在 credential service 或 KYC service 中）：
- 原 prompt：比對身份證資料（姓名/ID）
- 新 prompt：比對物件資料（地址、面積、建物類型、結構等）

具體 prompt 改動依現有 AI call 位置而定，需先找到該 handler/service。

---

## 驗證重點

**Favorites：**
1. 出售列表/詳情頁 → 愛心圖標正常顯示
2. 未登入點愛心 → 跳到 `/login`
3. 已登入點愛心 → 切換實心/空心
4. 收藏頁顯示已收藏物件，點卡片進詳情
5. 收藏頁移除愛心 → 物件從列表消失
6. 會員選單有「我的收藏」連結

**屋主身分認證：**
1. 新增 Section 1（基本資料）和 Section 2（建物詳情）欄位正確顯示
2. 三個聲明未全勾選 → 「提交申請」按鈕 disabled
3. 全勾選後按鈕啟用 → 送出後進入 PENDING
4. 上傳附件後「送出智能審核」可點擊
5. 人工審核 secondary 連結正常

**物件草稿：**
1. 草稿頁面顯示聲明 section
2. 未勾選聲明 → 上架按鈕 disabled
3. 全勾選後可上架
