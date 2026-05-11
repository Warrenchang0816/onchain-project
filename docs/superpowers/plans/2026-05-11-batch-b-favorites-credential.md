# Batch B：加入最愛 / 屋主身分認證流程 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 兩項前後端功能：（1）出售/出租物件可加入最愛，收藏在會員選單；（2）屋主身分認證加入物件資料欄位、聲明必填、附件驗證流程。

**Architecture:** Go service 新增 favorites module（table + repo + handler + router 掛載）；前端新增 HeartButton 元件和更新 FavoritesPage。OwnerCredentialPage 擴充欄位並加入聲明 checkbox 門控提交。

**Tech Stack:** Go 1.25 + Gin + lib/pq；React 19 + TypeScript 5；PostgreSQL

---

## 檔案異動清單

### 後端（Go）
| 操作 | 路徑 |
|------|------|
| 修改 | `go-service/internal/platform/db/schema.go` |
| 新增 | `go-service/internal/modules/favorites/model.go` |
| 新增 | `go-service/internal/modules/favorites/repo.go` |
| 新增 | `go-service/internal/modules/favorites/dto.go` |
| 新增 | `go-service/internal/modules/favorites/handler.go` |
| 修改 | `go-service/internal/bootstrap/wiring.go` |
| 修改 | `go-service/internal/bootstrap/router.go` |

### 前端（React）
| 操作 | 路徑 |
|------|------|
| 新增 | `react-service/src/api/favoritesApi.ts` |
| 新增 | `react-service/src/components/common/HeartButton.tsx` |
| 修改 | `react-service/src/pages/SaleListPage.tsx` |
| 修改 | `react-service/src/pages/RentListPage.tsx` |
| 修改 | `react-service/src/pages/SaleDetailPage.tsx` |
| 修改 | `react-service/src/pages/RentDetailPage.tsx` |
| 修改 | `react-service/src/pages/FavoritesPage.tsx` |
| 修改 | `react-service/src/components/credential/CredentialApplicationShell.tsx` |
| 修改 | `react-service/src/pages/OwnerCredentialPage.tsx` |

---

## Feature 5：加入最愛

---

### Task 5-1：DB migration — user_favorites table

**Files:**
- Modify: `go-service/internal/platform/db/schema.go`

`EnsureSchema` 的 `statements` slice 結尾（`}` 前）加入兩條 SQL：

- [ ] **Step 1：加入 DB migration**

在 `schema.go` 的 `statements` slice 最後兩項（`taiwan_districts` 相關之後）加入：
```go
`CREATE TABLE IF NOT EXISTS user_favorites (
    id           BIGSERIAL PRIMARY KEY,
    wallet       VARCHAR(42) NOT NULL,
    listing_type VARCHAR(10) NOT NULL CHECK (listing_type IN ('SALE', 'RENT')),
    listing_id   BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_favorites UNIQUE (wallet, listing_type, listing_id)
)`,

`CREATE INDEX IF NOT EXISTS idx_user_favorites_wallet ON user_favorites (wallet, listing_type)`,
```

- [ ] **Step 2：重啟 go-service 確認 migration 執行**

```bash
cd go-service && docker compose up --build -d
```

等候 10 秒後確認：
```bash
docker exec onchain-postgres psql -U postgres -d LAND -c "\d user_favorites"
```

Expected: 顯示 table schema（wallet, listing_type, listing_id, created_at）

- [ ] **Step 3：Commit**

```bash
git add go-service/internal/platform/db/schema.go
git commit -m "feat: add user_favorites table migration"
```

---

### Task 5-2：Go favorites module — model, repo, dto

**Files:**
- Create: `go-service/internal/modules/favorites/model.go`
- Create: `go-service/internal/modules/favorites/repo.go`
- Create: `go-service/internal/modules/favorites/dto.go`

- [ ] **Step 1：建立 model.go**

```go
// go-service/internal/modules/favorites/model.go
package favorites

import "time"

type UserFavorite struct {
    ID          int64     `db:"id"`
    Wallet      string    `db:"wallet"`
    ListingType string    `db:"listing_type"`
    ListingID   int64     `db:"listing_id"`
    CreatedAt   time.Time `db:"created_at"`
}
```

- [ ] **Step 2：建立 repo.go**

```go
// go-service/internal/modules/favorites/repo.go
package favorites

import (
    "database/sql"
    "fmt"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) ListByWallet(wallet, listingType string) ([]UserFavorite, error) {
    rows, err := r.db.Query(
        `SELECT id, wallet, listing_type, listing_id, created_at
         FROM user_favorites WHERE wallet = $1 AND listing_type = $2
         ORDER BY created_at DESC`,
        wallet, listingType,
    )
    if err != nil {
        return nil, fmt.Errorf("favorites repo: ListByWallet: %w", err)
    }
    defer rows.Close()

    var result []UserFavorite
    for rows.Next() {
        var f UserFavorite
        if err := rows.Scan(&f.ID, &f.Wallet, &f.ListingType, &f.ListingID, &f.CreatedAt); err != nil {
            return nil, fmt.Errorf("favorites repo: scan: %w", err)
        }
        result = append(result, f)
    }
    return result, rows.Err()
}

func (r *Repository) IsFavorited(wallet string, listingID int64, listingType string) (bool, error) {
    var count int
    err := r.db.QueryRow(
        `SELECT COUNT(*) FROM user_favorites
         WHERE wallet = $1 AND listing_type = $2 AND listing_id = $3`,
        wallet, listingType, listingID,
    ).Scan(&count)
    if err != nil {
        return false, fmt.Errorf("favorites repo: IsFavorited: %w", err)
    }
    return count > 0, nil
}

func (r *Repository) Add(wallet string, listingID int64, listingType string) error {
    _, err := r.db.Exec(
        `INSERT INTO user_favorites (wallet, listing_type, listing_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        wallet, listingType, listingID,
    )
    if err != nil {
        return fmt.Errorf("favorites repo: Add: %w", err)
    }
    return nil
}

func (r *Repository) Remove(wallet string, listingID int64, listingType string) error {
    _, err := r.db.Exec(
        `DELETE FROM user_favorites
         WHERE wallet = $1 AND listing_type = $2 AND listing_id = $3`,
        wallet, listingType, listingID,
    )
    if err != nil {
        return fmt.Errorf("favorites repo: Remove: %w", err)
    }
    return nil
}
```

- [ ] **Step 3：建立 dto.go**

```go
// go-service/internal/modules/favorites/dto.go
package favorites

type AddFavoriteRequest struct {
    ListingType string `json:"listing_type" binding:"required,oneof=SALE RENT"`
    ListingID   int64  `json:"listing_id"   binding:"required,min=1"`
}

type FavoriteResponse struct {
    ID          int64  `json:"id"`
    ListingType string `json:"listing_type"`
    ListingID   int64  `json:"listing_id"`
}
```

- [ ] **Step 4：Commit**

```bash
git add go-service/internal/modules/favorites/
git commit -m "feat: add favorites module model, repo, and dto"
```

---

### Task 5-3：Go favorites handler

**Files:**
- Create: `go-service/internal/modules/favorites/handler.go`

- [ ] **Step 1：建立 handler.go**

```go
// go-service/internal/modules/favorites/handler.go
package favorites

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    platformauth "go-service/internal/platform/auth"
)

type Handler struct{ repo *Repository }

func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

func walletFrom(c *gin.Context) string {
    v, _ := c.Get(platformauth.ContextWalletAddress)
    s, _ := v.(string)
    return s
}

// GET /favorites?type=SALE|RENT
func (h *Handler) List(c *gin.Context) {
    wallet := walletFrom(c)
    listingType := c.Query("type")
    if listingType != "SALE" && listingType != "RENT" {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "type must be SALE or RENT"})
        return
    }
    favs, err := h.repo.ListByWallet(wallet, listingType)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
        return
    }
    resp := make([]FavoriteResponse, 0, len(favs))
    for _, f := range favs {
        resp = append(resp, FavoriteResponse{ID: f.ID, ListingType: f.ListingType, ListingID: f.ListingID})
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GET /favorites/:type/:id/check
func (h *Handler) Check(c *gin.Context) {
    wallet := walletFrom(c)
    listingType := c.Param("type")
    listingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
        return
    }
    favorited, err := h.repo.IsFavorited(wallet, listingID, listingType)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"favorited": favorited}})
}

// POST /favorites
func (h *Handler) Add(c *gin.Context) {
    wallet := walletFrom(c)
    var req AddFavoriteRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
        return
    }
    if err := h.repo.Add(wallet, req.ListingID, req.ListingType); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"success": true})
}

// DELETE /favorites/:type/:id
func (h *Handler) Remove(c *gin.Context) {
    wallet := walletFrom(c)
    listingType := c.Param("type")
    listingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
        return
    }
    if err := h.repo.Remove(wallet, listingID, listingType); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

- [ ] **Step 2：Commit**

```bash
git add go-service/internal/modules/favorites/handler.go
git commit -m "feat: add favorites HTTP handler (List, Check, Add, Remove)"
```

---

### Task 5-4：Wiring — 接入 favorites module

**Files:**
- Modify: `go-service/internal/bootstrap/wiring.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [ ] **Step 1：wiring.go 加入 favorites module**

在 `wiring.go` 的 import 區加入：
```go
favoritesmod "go-service/internal/modules/favorites"
```

在 `Wire()` 函式的 Repositories 區塊（line 75 附近，`saleListingRepo` 之後）加入：
```go
favoritesRepo := favoritesmod.NewRepository(postgresDB)
```

在 handlers 區塊（`saleListingHandler` 之後）加入：
```go
favoritesHandler := favoritesmod.NewHandler(favoritesRepo)
```

在 `SetupRouter(...)` 呼叫中加入 `favoritesHandler` 參數（最後一個參數之後）：
```go
// 原來：
return SetupRouter(..., saleListingHandler)
// 修改後：
return SetupRouter(..., saleListingHandler, favoritesHandler)
```

- [ ] **Step 2：router.go 加入 favorites 路由**

在 `SetupRouter(...)` 函式簽名最後加入：
```go
favoritesHandler *favoritesmod.Handler,
```

在 import 加入：
```go
favoritesmod "go-service/internal/modules/favorites"
```

在 `protected` 路由組（auth required）中加入：
```go
// Favorites
protected.GET("/favorites", favoritesHandler.List)
protected.GET("/favorites/:type/:id/check", favoritesHandler.Check)
protected.POST("/favorites", favoritesHandler.Add)
protected.DELETE("/favorites/:type/:id", favoritesHandler.Remove)
```

- [ ] **Step 3：重新 build 確認 Go 編譯通過**

```bash
cd go-service && docker compose up --build -d 2>&1 | tail -20
```

Expected: no compilation errors, service starts

- [ ] **Step 4：測試 API（需已登入）**

```bash
# 先確認 service running
curl -s http://localhost:8081/api/favorites?type=SALE \
  -H "Cookie: <your-session-cookie>" | python -m json.tool
```

Expected: `{"success": true, "data": []}`

- [ ] **Step 5：Commit**

```bash
git add go-service/internal/bootstrap/wiring.go go-service/internal/bootstrap/router.go
git commit -m "feat: wire favorites module into bootstrap and register routes"
```

---

### Task 5-5：前端 favorites API client

**Files:**
- Create: `react-service/src/api/favoritesApi.ts`

- [ ] **Step 1：建立 favoritesApi.ts**

```typescript
// react-service/src/api/favoritesApi.ts
const API = import.meta.env.VITE_API_GO_SERVICE_URL ?? "http://localhost:8081/api";

export type ListingType = "SALE" | "RENT";

export interface Favorite {
    id: number;
    listing_type: ListingType;
    listing_id: number;
}

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T);
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw);
    return data;
}

export async function getFavorites(type: ListingType): Promise<Favorite[]> {
    const res = await fetch(`${API}/favorites?type=${type}`, { credentials: "include" });
    const data = await parse<{ data: Favorite[] }>(res);
    return data.data;
}

export async function checkFavorite(type: ListingType, id: number): Promise<boolean> {
    const res = await fetch(`${API}/favorites/${type}/${id}/check`, { credentials: "include" });
    const data = await parse<{ data: { favorited: boolean } }>(res);
    return data.data.favorited;
}

export async function addFavorite(type: ListingType, id: number): Promise<void> {
    const res = await fetch(`${API}/favorites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_type: type, listing_id: id }),
    });
    await parse<unknown>(res);
}

export async function removeFavorite(type: ListingType, id: number): Promise<void> {
    const res = await fetch(`${API}/favorites/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
    });
    await parse<unknown>(res);
}
```

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3：Commit**

```bash
git add react-service/src/api/favoritesApi.ts
git commit -m "feat: add favoritesApi client (getFavorites, checkFavorite, add, remove)"
```

---

### Task 5-6：HeartButton 元件

**Files:**
- Create: `react-service/src/components/common/HeartButton.tsx`

- [ ] **Step 1：建立 HeartButton.tsx**

```typescript
// react-service/src/components/common/HeartButton.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFavorite, checkFavorite, removeFavorite, type ListingType } from "@/api/favoritesApi";

type Props = {
    listingType: ListingType;
    listingId: number;
    authenticated: boolean;
};

export default function HeartButton({ listingType, listingId, authenticated }: Props) {
    const navigate = useNavigate();
    const [favorited, setFavorited] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!authenticated) return;
        checkFavorite(listingType, listingId)
            .then(setFavorited)
            .catch(() => undefined);
    }, [authenticated, listingType, listingId]);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation(); // 避免觸發卡片點擊
        if (!authenticated) {
            navigate("/login");
            return;
        }
        if (busy) return;
        setBusy(true);
        try {
            if (favorited) {
                await removeFavorite(listingType, listingId);
                setFavorited(false);
            } else {
                await addFavorite(listingType, listingId);
                setFavorited(true);
            }
        } catch {
            // silent fail — state stays unchanged
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            aria-label={favorited ? "移除收藏" : "加入收藏"}
            onClick={(e) => void handleClick(e)}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
            <span
                className="material-symbols-outlined text-xl"
                style={{
                    fontVariationSettings: favorited ? "'FILL' 1" : "'FILL' 0",
                    color: favorited ? "#e53e3e" : undefined,
                }}
            >
                favorite
            </span>
        </button>
    );
}
```

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3：Commit**

```bash
git add react-service/src/components/common/HeartButton.tsx
git commit -m "feat: add HeartButton component with favorite toggle and auth redirect"
```

---

### Task 5-7：SaleListPage 和 RentListPage 加入愛心

**Files:**
- Modify: `react-service/src/pages/SaleListPage.tsx`
- Modify: `react-service/src/pages/RentListPage.tsx`

需要：
1. 從 `authApi` 取得 `authenticated` 狀態
2. 在每張卡片右上角加入 `<HeartButton>`

- [ ] **Step 1：SaleListPage.tsx — 加入 authenticated state**

在 SaleListPage.tsx 的 import 區加入：
```typescript
import { getAuthMe } from "@/api/authApi";
import HeartButton from "@/components/common/HeartButton";
```

在 `SaleListPage()` 函式的 state 宣告區（`const [loading, setLoading] = useState(true)` 之後）加入：
```typescript
const [authenticated, setAuthenticated] = useState(false);
```

在現有 useEffect 之後加入：
```typescript
useEffect(() => {
    getAuthMe().then((r) => setAuthenticated(r.authenticated)).catch(() => undefined);
}, []);
```

- [ ] **Step 2：SaleListPage.tsx — 卡片加入 HeartButton**

在 SaleListPage 的 `<article>` 卡片內，`<div className="flex flex-col gap-3 md:flex-row...">` 修改為包含愛心按鈕的版本。

原本（line 158）：
```jsx
<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div className="flex-1">
        ...
    </div>
    <div className="text-left md:text-right">
        ...價格...
    </div>
</div>
```

改為：
```jsx
<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div className="flex-1">
        ...（內容不變）
    </div>
    <div className="flex items-start gap-2 md:flex-col md:items-end">
        <div className="text-left md:text-right">
            ...價格...（不變）
        </div>
        <HeartButton listingType="SALE" listingId={item.id} authenticated={authenticated} />
    </div>
</div>
```

- [ ] **Step 3：RentListPage.tsx — 同樣步驟**

在 RentListPage.tsx 做與 SaleListPage 完全相同的修改：
- import `getAuthMe` 和 `HeartButton`
- 加入 `authenticated` state 和 useEffect
- 卡片加入 `<HeartButton listingType="RENT" listingId={item.id} authenticated={authenticated} />`

- [ ] **Step 4：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5：手動驗證**

1. 訪問出售列表 → 每張卡片右上角有愛心圖示
2. 未登入點愛心 → 跳到 `/login`
3. 已登入點愛心 → 變實心（API call 成功）

- [ ] **Step 6：Commit**

```bash
git add react-service/src/pages/SaleListPage.tsx react-service/src/pages/RentListPage.tsx
git commit -m "feat: add HeartButton to sale and rent list cards"
```

---

### Task 5-8：SaleDetailPage 和 RentDetailPage 加入愛心

**Files:**
- Modify: `react-service/src/pages/SaleDetailPage.tsx`
- Modify: `react-service/src/pages/RentDetailPage.tsx`

- [ ] **Step 1：SaleDetailPage.tsx — 加入 authenticated + HeartButton**

讀取 `react-service/src/pages/SaleDetailPage.tsx`，找到 Hero section（顯示總價的區塊）。

在 import 加入：
```typescript
import { getAuthMe } from "@/api/authApi";
import HeartButton from "@/components/common/HeartButton";
```

加入 `authenticated` state：
```typescript
const [authenticated, setAuthenticated] = useState(false);

useEffect(() => {
    getAuthMe().then((r) => setAuthenticated(r.authenticated)).catch(() => undefined);
}, []);
```

在 Hero section 的大標題旁（或 section 右上角）加入：
```jsx
<HeartButton listingType="SALE" listingId={listing.id} authenticated={authenticated} />
```

- [ ] **Step 2：RentDetailPage.tsx — 相同步驟**

在 RentDetailPage.tsx 做相同修改，HeartButton props：
```jsx
<HeartButton listingType="RENT" listingId={listing.id} authenticated={authenticated} />
```

- [ ] **Step 3：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4：Commit**

```bash
git add react-service/src/pages/SaleDetailPage.tsx react-service/src/pages/RentDetailPage.tsx
git commit -m "feat: add HeartButton to sale and rent detail pages"
```

---

### Task 5-9：更新 FavoritesPage

**Files:**
- Modify: `react-service/src/pages/FavoritesPage.tsx`

目前 FavoritesPage 是佔位符（16 行空頁）。改為顯示實際收藏，分出售/出租兩個 tab。

- [ ] **Step 1：改寫 FavoritesPage.tsx**

```typescript
// react-service/src/pages/FavoritesPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import HeartButton from "@/components/common/HeartButton";
import { getFavorites, type Favorite, type ListingType } from "@/api/favoritesApi";
import { getSaleListing, type SaleListing } from "@/api/saleListingApi";
import { getRentalListing, type RentalListing } from "@/api/rentalListingApi";

type Tab = "SALE" | "RENT";

function SaleFavoriteCard({ listingId }: { listingId: number }) {
    const navigate = useNavigate();
    const [listing, setListing] = useState<SaleListing | null>(null);

    useEffect(() => {
        getSaleListing(listingId).then(setListing).catch(() => undefined);
    }, [listingId]);

    if (!listing) return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 animate-pulse">
            <div className="h-4 bg-surface-container-low rounded w-1/2" />
        </div>
    );

    return (
        <article
            className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
            onClick={() => navigate(`/sale/${listing.id}`)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-on-surface">{listing.property?.title ?? `出售 #${listing.id}`}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{listing.property?.address ?? ""}</p>
                    <p className="mt-2 text-xl font-extrabold text-on-surface">NT$ {listing.total_price.toLocaleString()}</p>
                </div>
                <HeartButton listingType="SALE" listingId={listing.id} authenticated={true} />
            </div>
        </article>
    );
}

function RentFavoriteCard({ listingId }: { listingId: number }) {
    const navigate = useNavigate();
    const [listing, setListing] = useState<RentalListing | null>(null);

    useEffect(() => {
        getRentalListing(listingId).then(setListing).catch(() => undefined);
    }, [listingId]);

    if (!listing) return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 animate-pulse">
            <div className="h-4 bg-surface-container-low rounded w-1/2" />
        </div>
    );

    return (
        <article
            className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
            onClick={() => navigate(`/rent/${listing.id}`)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-on-surface">{listing.property?.title ?? `出租 #${listing.id}`}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{listing.property?.address ?? ""}</p>
                    <p className="mt-2 text-xl font-extrabold text-on-surface">
                        NT$ {listing.monthly_rent.toLocaleString()}<span className="ml-1 text-sm font-normal text-on-surface-variant">/ 月</span>
                    </p>
                </div>
                <HeartButton listingType="RENT" listingId={listing.id} authenticated={true} />
            </div>
        </article>
    );
}

export default function FavoritesPage() {
    const [tab, setTab] = useState<Tab>("SALE");
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        setError("");
        getFavorites(tab)
            .then(setFavorites)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取收藏失敗"))
            .finally(() => setLoading(false));
    }, [tab]);

    const tabCls = (t: Tab) =>
        t === tab
            ? "border-b-2 border-primary-container pb-2 text-sm font-bold text-primary-container"
            : "pb-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-16 md:px-12">
                <h1 className="text-3xl font-extrabold text-on-surface">我的收藏</h1>

                <div className="flex gap-6 border-b border-outline-variant/15">
                    <button type="button" className={tabCls("SALE")} onClick={() => setTab("SALE")}>出售物件</button>
                    <button type="button" className={tabCls("RENT")} onClick={() => setTab("RENT")}>出租物件</button>
                </div>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant animate-pulse">載入中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : favorites.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-on-surface-variant">尚無收藏的{tab === "SALE" ? "出售" : "出租"}物件</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {favorites.map((fav) =>
                            tab === "SALE"
                                ? <SaleFavoriteCard key={fav.id} listingId={fav.listing_id} />
                                : <RentFavoriteCard key={fav.id} listingId={fav.listing_id} />
                        )}
                    </div>
                )}
            </main>
        </SiteLayout>
    );
}
```

注意：`getSaleListing(id)` 和 `getRentalListing(id)` 的回傳型別請確認與 `saleListingApi.ts`、`rentalListingApi.ts` 中的實際函式名稱和回傳型別一致。

- [ ] **Step 2：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3：手動驗證**

1. 先在出售列表按幾個愛心
2. 訪問 Header 選單 → 「收藏」
3. 確認出售 tab 顯示剛才收藏的物件
4. 點卡片右上角空心愛心 → 移除收藏（卡片不會即時消失，重新載入後消失）
5. 切換到出租 tab → 顯示出租收藏

- [ ] **Step 4：Commit**

```bash
git add react-service/src/pages/FavoritesPage.tsx
git commit -m "feat: implement FavoritesPage with SALE/RENT tabs and listing cards"
```

---

## Feature 6：屋主身分認證流程改版

---

### Task 6-1：CredentialApplicationShell 加入聲明 + 選填文件

**Files:**
- Modify: `react-service/src/components/credential/CredentialApplicationShell.tsx`

改動：
1. 加入 `declarations?: Array<{key: string; text: string}>` prop
2. 加入 declaration checkbox 狀態
3. 主要文件改為選填（`mainDocRequired?: boolean`，預設 `true`）
4. `validateDraft()` 依 `mainDocRequired` 決定是否檢查 mainDoc；若有 declarations 全部需打勾

- [ ] **Step 1：修改 Props type**

在 `CredentialApplicationShell.tsx` 的 `Props` type（line 26-35）加入兩個新欄位：

```typescript
type Props = {
    credentialType: CredentialType;
    title: string;
    description: string;
    primaryFields: FieldConfig[];
    kycDisplayName?: string;
    currentItem?: CredentialCenterItem;
    currentDetail?: CredentialSubmissionDetail;
    onRefresh: () => Promise<void>;
    // 新增
    declarations?: Array<{ key: string; text: string }>;
    mainDocRequired?: boolean;
};
```

- [ ] **Step 2：加入 declarations state**

在 `CredentialApplicationShell` 函式的 state 宣告區（`const [formValues...` 之後）加入：

```typescript
const [declarationValues, setDeclarationValues] = useState<Record<string, boolean>>({});

const allDeclarationsChecked =
    !props.declarations ||
    props.declarations.length === 0 ||
    props.declarations.every((d) => declarationValues[d.key] === true);
```

- [ ] **Step 3：修改 validateDraft()**

將 `validateDraft()` 函式（lines 83-95）修改為：

```typescript
const validateDraft = (): string | null => {
    for (const field of props.primaryFields) {
        if (!formValues[field.key]?.trim()) {
            return `請先填寫「${field.label}」`;
        }
    }
    if (!allDeclarationsChecked) {
        return "請確認並勾選所有物件聲明";
    }
    if ((props.mainDocRequired !== false) && !mainDoc) {
        return "請先上傳主要文件";
    }
    return null;
};
```

- [ ] **Step 4：在表單中加入 declarations 渲染**

在 `formMode` section 的 form 內，`<CredentialDocumentUploader label="主要文件".../>` 之前加入：

```jsx
{props.declarations && props.declarations.length > 0 ? (
    <div className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
        <p className="text-sm font-bold text-on-surface">物件聲明（必填）</p>
        <p className="text-xs text-on-surface-variant">以下三項均需勾選方可提交申請</p>
        <div className="space-y-2">
            {props.declarations.map((d) => (
                <label key={d.key} className="flex cursor-pointer items-start gap-3">
                    <input
                        type="checkbox"
                        checked={declarationValues[d.key] ?? false}
                        onChange={(e) =>
                            setDeclarationValues((prev) => ({ ...prev, [d.key]: e.target.checked }))
                        }
                        className="mt-0.5 h-4 w-4 accent-primary-container"
                    />
                    <span className="text-sm text-on-surface">{d.text}</span>
                </label>
            ))}
        </div>
    </div>
) : null}
```

- [ ] **Step 5：主要文件標示「選填」（當 mainDocRequired 為 false）**

將 `<CredentialDocumentUploader label="主要文件"...>` 修改：
```jsx
<CredentialDocumentUploader
    label={props.mainDocRequired !== false ? "主要文件" : "附件（選填）"}
    helperText={
        props.mainDocRequired !== false
            ? "請上傳本次身份申請最主要的證明文件。"
            : "可上傳權狀或所有權證明；上傳後可送出智能審核比對物件資料。"
    }
    file={mainDoc}
    onChange={(file) => {
        setMainDoc(file);
        setError("");
    }}
    required={props.mainDocRequired !== false}
/>
```

- [ ] **Step 6：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7：Commit**

```bash
git add react-service/src/components/credential/CredentialApplicationShell.tsx
git commit -m "feat: add declarations and optional main doc support to CredentialApplicationShell"
```

---

### Task 6-2：OwnerCredentialPage 擴充欄位與啟用聲明

**Files:**
- Modify: `react-service/src/pages/OwnerCredentialPage.tsx`

目前 OwnerCredentialPage（17 行）只傳 2 個 primaryFields 給 CredentialRolePage。
改為：傳入 11 個欄位 + 3 個聲明 + `mainDocRequired={false}`。

- [ ] **Step 1：更新 OWNER_FIELDS**

```typescript
// react-service/src/pages/OwnerCredentialPage.tsx
import CredentialRolePage from "@/components/credential/CredentialRolePage";

const OWNER_FIELDS = [
    // 現有欄位
    { key: "propertyAddress", label: "房屋地址", placeholder: "請填寫本次申請對應的房屋地址" },
    { key: "ownershipDocNo",  label: "權狀字號", placeholder: "若權狀或稅籍資料有字號請填寫" },
    // 基本資料
    { key: "buildingType",    label: "建物類型", placeholder: "大樓 / 公寓 / 透天 / 店面" },
    { key: "floor",           label: "樓層 / 總樓層", placeholder: "例：5F / 24F" },
    { key: "mainArea",        label: "主建物面積（坪）", placeholder: "例：38" },
    { key: "rooms",           label: "格局（房 / 廳 / 衛）", placeholder: "例：3 房 2 廳 2 衛" },
    { key: "buildingAge",     label: "屋齡（年）", placeholder: "例：10" },
    // 建物詳情
    { key: "buildingStructure", label: "建物結構", placeholder: "例：鋼骨鋼筋混凝土" },
    { key: "exteriorMaterial",  label: "外牆建材", placeholder: "例：石材" },
    { key: "buildingUsage",     label: "謄本用途", placeholder: "例：集合住宅" },
    { key: "zoning",            label: "使用分區", placeholder: "例：第一種住宅區" },
];

const OWNER_DECLARATIONS = [
    { key: "no_sea_sand", text: "本物件非海砂屋，無使用海砂混凝土之情形" },
    { key: "no_radiation", text: "本物件非輻射屋，未受輻射污染" },
    { key: "no_haunted", text: "本物件非凶宅，近期無發生非自然死亡事件" },
];

export default function OwnerCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="OWNER"
            title="屋主身分申請"
            description="填寫物件基本資料與建物詳情，並確認聲明。可選擇上傳權狀或所有權證明以提升可信度（非必填）；上傳後可送出智能審核比對物件資料。"
            primaryFields={OWNER_FIELDS}
            declarations={OWNER_DECLARATIONS}
            mainDocRequired={false}
        />
    );
}
```

- [ ] **Step 2：更新 CredentialRolePage 轉傳新 props**

讀取 `react-service/src/components/credential/CredentialRolePage.tsx`，在 `Props` type 加入：
```typescript
declarations?: Array<{ key: string; text: string }>;
mainDocRequired?: boolean;
```

在 `<CredentialApplicationShell .../>` 呼叫加入：
```jsx
declarations={props.declarations}
mainDocRequired={props.mainDocRequired}
```

- [ ] **Step 3：確認 TypeScript 無錯誤**

```bash
cd react-service && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4：手動驗證**

訪問 `http://localhost:5173/credential/owner`：
1. 表單顯示 11 個欄位（房屋地址 + 建物類型 + 格局 + 建物結構等）
2. 表單下方顯示「物件聲明」section，3 個 checkbox
3. 未全勾選聲明 → 點「送出智能審核」顯示「請確認並勾選所有物件聲明」錯誤
4. 全勾選聲明 + 無附件 → 可以點「送出智能審核」
5. 上傳附件後 → 智能審核流程正常運作

- [ ] **Step 5：Commit**

```bash
git add react-service/src/pages/OwnerCredentialPage.tsx react-service/src/components/credential/CredentialRolePage.tsx
git commit -m "feat: expand OwnerCredentialPage with property fields, declarations, and optional attachment"
```

---

## 最終驗證清單

**Favorites：**
- [ ] 出售列表卡片有愛心圖示
- [ ] 出租列表卡片有愛心圖示
- [ ] 出售詳情頁有愛心圖示
- [ ] 出租詳情頁有愛心圖示
- [ ] 未登入點愛心 → 跳到 `/login`
- [ ] 已登入點愛心 → 切換實心/空心，API call 成功
- [ ] Header 選單「收藏」→ FavoritesPage
- [ ] FavoritesPage 有出售/出租兩個 tab
- [ ] 點卡片進詳情頁正常

**屋主身分認證：**
- [ ] OwnerCredentialPage 顯示 11 個欄位
- [ ] 顯示「物件聲明」section 有 3 個 checkbox
- [ ] 未全勾選 → 提交按鈕報錯
- [ ] 全勾選 → 可提交（無需附件）
- [ ] 上傳附件後 → 智能審核流程正常
