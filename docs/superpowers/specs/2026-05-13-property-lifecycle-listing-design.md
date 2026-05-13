# Property Lifecycle & Listing Page 設計

**Goal:** 在「我的物件」列表加入歸檔（移除）功能與四狀態篩選；將上架刊登流程從 PropertyEditPage 移至獨立的合併頁面（出租/出售 tab 切換）。

**Architecture:** 後端新增 REMOVED / ARCHIVED 兩個 setup_status 值與對應 API；前端 MyPropertiesPage 改為可篩選的四欄計數 + card 上的 action 按鈕；新建 PropertyListingPage（包含 RentalListingForm / SaleListingForm 兩個子元件，從現有頁面抽出）。

**Tech Stack:** Go 1.25 + Gin + PostgreSQL（後端）；React 19 + TypeScript 5 strict + Tailwind（前端）

---

## 狀態機

```
DRAFT ──→ REMOVED   （軟刪除，頁面完全隱藏，不進歷史）
READY ──→ REMOVED
DRAFT ──→ 上架中    （rental/sale listing 狀態為 ACTIVE/NEGOTIATING/LOCKED/SIGNING）
READY ──→ 上架中
上架中 ──→ ARCHIVED  （媒合成功，外部流程觸發，顯示於「歷史」tab）
```

- `REMOVED`：`ListByOwner` 完全排除，前端不顯示
- `ARCHIVED`：顯示於「歷史」篩選 tab，card 無操作按鈕
- 「上架中」非 property setup\_status，而是 derived state（有活躍 listing），由後端 RemoveProperty 時檢查

---

## 後端

### DB Migration

```sql
ALTER TABLE property
    DROP CONSTRAINT IF EXISTS property_setup_status_check;

ALTER TABLE property
    ADD CONSTRAINT property_setup_status_check
    CHECK (setup_status IN ('DRAFT', 'READY', 'REMOVED', 'ARCHIVED'));
```

### `go-service/internal/db/model/property_model.go`

新增常數：
```go
PropertySetupRemoved  = "REMOVED"
PropertySetupArchived = "ARCHIVED"
```

### `go-service/internal/db/repository/property_repo.go`

**修改 `ListByOwner`：** 加 `AND setup_status <> 'REMOVED'`

```go
FROM property WHERE owner_user_id = $1 AND setup_status <> 'REMOVED'
ORDER BY created_at DESC
```

**新增 `UpdateSetupStatus`：**

```go
func (r *PropertyRepository) UpdateSetupStatus(propertyID, ownerUserID int64, newStatus string) error {
    _, err := r.db.Exec(`
        UPDATE property SET setup_status=$1, updated_at=NOW()
        WHERE id=$2 AND owner_user_id=$3`,
        newStatus, propertyID, ownerUserID,
    )
    if err != nil {
        return fmt.Errorf("property_repo: UpdateSetupStatus: %w", err)
    }
    return nil
}
```

### `go-service/internal/modules/property/service.go`

**`Store` interface 加入：**
```go
UpdateSetupStatus(propertyID, ownerUserID int64, newStatus string) error
```

**擴充 `var` block（與現有 `ErrNotFound` 等並列）：**

```go
var (
    ErrNotFound      = errors.New("property not found")
    ErrForbidden     = errors.New("only the property owner can perform this action")
    ErrNotOwner      = errors.New("KYC verified owner credential required")
    ErrPropertyListed = errors.New("物件上架中，無法移除")  // 新增
)
```

**新增 `RemoveProperty` 方法：**

```go
func (s *Service) RemoveProperty(ctx context.Context, propertyID int64, wallet string) error {
    user, err := s.requireOwner(wallet)
    if err != nil {
        return err
    }

    prop, err := s.repo.FindByID(propertyID)
    if err != nil {
        return err
    }
    if prop == nil {
        return ErrNotFound
    }
    if prop.OwnerUserID != user.ID {
        return ErrForbidden
    }
    if prop.SetupStatus != model.PropertySetupDraft && prop.SetupStatus != model.PropertySetupReady {
        return fmt.Errorf("only DRAFT or READY properties can be removed")
    }

    hasActive, err := s.repo.HasActiveListing(propertyID)
    if err != nil {
        return err
    }
    if hasActive {
        return ErrPropertyListed
    }

    return s.repo.UpdateSetupStatus(propertyID, user.ID, model.PropertySetupRemoved)
}
```

### `go-service/internal/db/repository/property_repo.go` — `HasActiveListing`

```go
func (r *PropertyRepository) HasActiveListing(propertyID int64) (bool, error) {
    activeStatuses := []string{"ACTIVE", "NEGOTIATING", "LOCKED", "SIGNING"}
    var count int
    err := r.db.QueryRow(`
        SELECT COUNT(*) FROM (
            SELECT id FROM rental_listing
            WHERE property_id=$1 AND status = ANY($2)
            UNION ALL
            SELECT id FROM sale_listing
            WHERE property_id=$1 AND status = ANY($2)
        ) AS t`,
        propertyID, pq.Array(activeStatuses),
    ).Scan(&count)
    if err != nil {
        return false, fmt.Errorf("property_repo: HasActiveListing: %w", err)
    }
    return count > 0, nil
}
```

### `go-service/internal/modules/property/handler.go`

**`APIService` interface 加入：**
```go
RemoveProperty(ctx context.Context, propertyID int64, wallet string) error
```

**新增 `RemoveProperty` handler：**

```go
func (h *Handler) RemoveProperty(c *gin.Context) {
    id, err := parseID(c)
    if err != nil {
        c.JSON(400, gin.H{"error": "invalid property id"})
        return
    }
    err = h.svc.RemoveProperty(c.Request.Context(), id, walletFrom(c))
    if err != nil {
        handleErr(c, err)
        return
    }
    c.JSON(200, gin.H{"success": true})
}
```

**`handleErr`：** 新增 case：
```go
case errors.Is(err, ErrPropertyListed):
    c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
```

### `go-service/internal/bootstrap/router.go`

```go
protected.PUT("/property/:id/remove", newPropertyHandler.RemoveProperty)
```

---

## 前端

### `react-service/src/api/propertyApi.ts`

**擴充 `PropertySetupStatus`：**
```typescript
export type PropertySetupStatus = "DRAFT" | "READY" | "ARCHIVED" | "REMOVED";
```

**新增 `removeProperty`：**
```typescript
export async function removeProperty(id: number): Promise<void> {
    const res = await fetch(`${API}/property/${id}/remove`, {
        method: "PUT", credentials: "include",
    });
    await parse<unknown>(res);
}
```

---

### `react-service/src/pages/MyPropertiesPage.tsx`

**新增 import：** `removeProperty` from `propertyApi`

**新增 state：**
```typescript
type FilterType = "ALL" | "READY" | "DRAFT" | "ARCHIVED";
const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
const [removing, setRemoving] = useState<number | null>(null); // property id 待確認移除
const [removeError, setRemoveError] = useState("");
```

**計數邏輯（`items` 為 listMyProperties 回傳，已排除 REMOVED）：**
```typescript
const readyCount    = items.filter((p) => p.setup_status === "READY").length;
const draftCount    = items.filter((p) => p.setup_status === "DRAFT").length;
const archivedCount = items.filter((p) => p.setup_status === "ARCHIVED").length;
```

**篩選後清單：**
```typescript
const filtered = activeFilter === "ALL"    ? items
               : activeFilter === "READY"  ? items.filter((p) => p.setup_status === "READY")
               : activeFilter === "DRAFT"  ? items.filter((p) => p.setup_status === "DRAFT")
               : items.filter((p) => p.setup_status === "ARCHIVED");
```

**四個計數 card（可點擊）：**

```typescript
[
    { label: "物件總數", value: items.length,   filter: "ALL"      },
    { label: "完成度 READY", value: readyCount, filter: "READY"    },
    { label: "草稿中",   value: draftCount,     filter: "DRAFT"    },
    { label: "歷史",     value: archivedCount,  filter: "ARCHIVED" },
].map(({ label, value, filter }) => (
    <button
        key={label}
        onClick={() => setActiveFilter(filter as FilterType)}
        className={`rounded-2xl border p-5 text-left transition-colors ${
            activeFilter === filter
                ? "border-primary-container bg-primary-container/10"
                : "border-outline-variant/15 bg-surface-container-lowest hover:bg-surface-container-low"
        }`}
    >
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
    </button>
))
```

**Property Card：**

每個 card 右下角（原「點擊編輯 →」處）改為 action 區：

```typescript
// 狀態 badge 樣式
const statusBadge = (status: PropertySetupStatus) => {
    if (status === "READY")    return "bg-[#E8F5E9] text-[#2E7D32]";
    if (status === "ARCHIVED") return "bg-surface-container text-on-surface-variant";
    return "bg-surface-container-low text-on-surface-variant"; // DRAFT
};
const statusLabel = (status: PropertySetupStatus) => {
    if (status === "READY")    return "✓ READY";
    if (status === "ARCHIVED") return "歷史";
    return "草稿";
};
```

Action 按鈕（右下角，**所有按鈕 onClick 須 `e.stopPropagation()`**，避免觸發 card navigate）：

- `DRAFT` 或 `READY`：
  - 「移除物件」(`text-error border border-error/30`) → `setRemoving(item.id)`
  - `READY` 額外加「上架」(`bg-primary-container text-on-primary-container`) → `navigate(/my/properties/${item.id}/listing)`
- `ARCHIVED`：靜態文字「已歸檔」，無操作按鈕
- Card 主體 `onClick` 對**所有狀態**（含 ARCHIVED）均導向 `/my/properties/:id`，讓屋主仍可查看歸檔物件詳情

**移除確認 Dialog（全域，基於 `removing` state）：**

```
removing !== null →
<div fixed inset-0 overlay>
  <div modal>
    <h3>確定移除物件？</h3>
    <p>此操作無法復原，物件資料將保留於資料庫但不再顯示。</p>
    {removeError && <p className="text-error">{removeError}</p>}
    <button onClick={handleRemove}>確定移除</button>
    <button onClick={() => { setRemoving(null); setRemoveError(""); }}>取消</button>
  </div>
</div>
```

`handleRemove`：call `removeProperty(removing)` → 成功則 reload + close dialog；失敗則顯示 `removeError`

---

### `react-service/src/pages/PropertyEditPage.tsx`

移除整個「上架刊登」section（現 lines 430-452）及 `isReady` 計算。

---

### 新元件：`react-service/src/components/listing/RentalListingForm.tsx`

從 `RentalListingPage` 抽出，Props：
```typescript
type Props = {
    propertyId: number;
    property: Property;
};
```

內部自管：`listing`、`form`、`loading`、`saving`、`msg` — 邏輯完全同現有 `RentalListingPage`。移除 `<SiteLayout>` 和 header，只保留 form 區塊 + 操作按鈕。

---

### 新元件：`react-service/src/components/listing/SaleListingForm.tsx`

從 `SaleListingPage` 抽出，同上模式，對應 sale listing API。

---

### 現有頁面重構：`RentalListingPage` / `SaleListingPage`

改為薄殼：
```typescript
export default function RentalListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = parseInt(id ?? "", 10);
    const [property, setProperty] = useState<Property | null>(null);

    useEffect(() => {
        getProperty(propertyId).then(setProperty).catch(console.error);
    }, [propertyId]);

    if (!property) return <SiteLayout><div className="p-12 text-sm">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to={`/my/properties/${propertyId}`}>← 返回物件編輯</Link>
                <RentalListingForm propertyId={propertyId} property={property} />
            </main>
        </SiteLayout>
    );
}
```

---

### 新頁面：`react-service/src/pages/PropertyListingPage.tsx`

```typescript
// Route: /my/properties/:id/listing
// State: activeTab: "RENT" | "SALE", property: Property | null

// Header
<Link to="/my/properties">← 返回我的物件</Link>
<h1>上架刊登</h1>
<p>{property?.address}</p>

// Tab bar
<div>
    <button onClick={() => setActiveTab("RENT")}
        className={activeTab === "RENT" ? "border-b-2 border-primary-container ..." : "..."}>
        出租
    </button>
    <button onClick={() => setActiveTab("SALE")} ...>
        出售
    </button>
</div>

// Content
{activeTab === "RENT" && property && <RentalListingForm propertyId={propertyId} property={property} />}
{activeTab === "SALE" && property && <SaleListingForm propertyId={propertyId} property={property} />}
```

---

### `react-service/src/router/index.tsx`

新增路由（在 `/my/properties/:id` 之後）：
```typescript
{ path: "/my/properties/:id/listing", element: <PropertyListingPage /> }
```

---

## 驗證重點

1. `PUT /property/:id/remove`：DRAFT/READY → REMOVED；上架中 → 409；其他用戶 → 403
2. REMOVED 物件不出現在 `GET /property`（listMyProperties）
3. 四個計數 card 點擊正確篩選列表；作用中 card 有 highlight
4. READY card：「上架」按鈕出現，click 不觸發 card navigate
5. DRAFT card：僅「移除物件」按鈕，無「上架」
6. ARCHIVED card：無操作按鈕
7. 移除確認 dialog：後端 409 時顯示錯誤訊息
8. `/my/properties/:id/listing`：tab 切換出租/出售，各自獨立 load listing
9. 原有 `/my/properties/:id/rent` 和 `/my/properties/:id/sale` 路由仍可正常使用
10. PropertyEditPage 不再顯示「上架刊登」section
