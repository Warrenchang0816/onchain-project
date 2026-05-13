# Property Lifecycle & Listing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add property removal (REMOVED status), archived history tab (ARCHIVED status), 4-filter card dashboard on MyPropertiesPage, and a new unified PropertyListingPage with 出租/出售 tab switch.

**Architecture:** Backend extends the `property` table CHECK constraint and adds a `RemoveProperty` service method; frontend MyPropertiesPage grows filter state and card action buttons; form logic is extracted from RentalListingPage/SaleListingPage into reusable components, then composed in a new PropertyListingPage.

**Tech Stack:** Go 1.25 + Gin + PostgreSQL (backend); React 19 + TypeScript 5 strict + Tailwind (frontend)

---

## File Map

**Create:**
- `react-service/src/components/listing/RentalListingForm.tsx`
- `react-service/src/components/listing/SaleListingForm.tsx`
- `react-service/src/pages/PropertyListingPage.tsx`

**Modify:**
- `go-service/internal/db/model/property_model.go` — add REMOVED/ARCHIVED constants
- `go-service/internal/db/repository/property_repo.go` — filter REMOVED in ListByOwner, add HasActiveListing
- `go-service/internal/modules/property/service.go` — add ErrPropertyListed, RemoveProperty
- `go-service/internal/modules/property/handler.go` — add to APIService interface, handler, handleErr case
- `go-service/internal/bootstrap/router.go` — add PUT /property/:id/remove
- `react-service/src/api/propertyApi.ts` — expand PropertySetupStatus, add removeProperty
- `react-service/src/pages/MyPropertiesPage.tsx` — filter cards, action buttons, confirm dialog
- `react-service/src/pages/PropertyEditPage.tsx` — remove "上架刊登" section and isReady
- `react-service/src/pages/RentalListingPage.tsx` — thin shell
- `react-service/src/pages/SaleListingPage.tsx` — thin shell
- `react-service/src/router/index.tsx` — add /my/properties/:id/listing route

---

### Task 1: DB Migration

**Files:**
- Run SQL against the running PostgreSQL instance

- [ ] **Step 1: Apply migration**

Connect to the DB (e.g. `psql -h localhost -p 5432 -U postgres TASK`) and run:

```sql
ALTER TABLE property
    DROP CONSTRAINT IF EXISTS property_setup_status_check;

ALTER TABLE property
    ADD CONSTRAINT property_setup_status_check
    CHECK (setup_status IN ('DRAFT', 'READY', 'REMOVED', 'ARCHIVED'));
```

- [ ] **Step 2: Verify**

```sql
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'property' AND con.contype = 'c';
```

Expected output: one row with `property_setup_status_check` and `CHECK ((setup_status = ANY (ARRAY['DRAFT'::text, 'READY'::text, 'REMOVED'::text, 'ARCHIVED'::text])))`.

- [ ] **Step 3: Commit**

```bash
git add -p   # no file changes — skip or commit a migration note
git commit -m "feat: add REMOVED and ARCHIVED to property setup_status constraint"
```

---

### Task 2: Backend Model + Repo

**Files:**
- Modify: `go-service/internal/db/model/property_model.go`
- Modify: `go-service/internal/db/repository/property_repo.go`

- [ ] **Step 1: Add model constants**

In `go-service/internal/db/model/property_model.go`, add after `PropertySetupReady`:

```go
const (
    PropertySetupDraft    = "DRAFT"
    PropertySetupReady    = "READY"
    PropertySetupRemoved  = "REMOVED"
    PropertySetupArchived = "ARCHIVED"
    // ... rest of existing constants unchanged
```

Replace only the two lines currently defining `PropertySetupDraft` and `PropertySetupReady` — keep all other constants in the block intact.

- [ ] **Step 2: Filter REMOVED in ListByOwner**

In `go-service/internal/db/repository/property_repo.go`, update `ListByOwner` query from:

```go
		FROM property WHERE owner_user_id = $1 ORDER BY created_at DESC`, ownerUserID)
```

to:

```go
		FROM property WHERE owner_user_id = $1 AND setup_status <> 'REMOVED' ORDER BY created_at DESC`, ownerUserID)
```

- [ ] **Step 3: Add HasActiveListing**

Add to `go-service/internal/db/repository/property_repo.go` (before `scanProperty`):

```go
func (r *PropertyRepository) HasActiveListing(propertyID int64) (bool, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT id FROM rental_listing
			WHERE property_id=$1 AND status IN ('ACTIVE','NEGOTIATING','LOCKED','SIGNING')
			UNION ALL
			SELECT id FROM sale_listing
			WHERE property_id=$1 AND status IN ('ACTIVE','NEGOTIATING','LOCKED','SIGNING')
		) AS t`,
		propertyID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("property_repo: HasActiveListing: %w", err)
	}
	return count > 0, nil
}
```

- [ ] **Step 4: Build to confirm no errors**

```bash
cd go-service && docker compose up --build -d
```

Expected: build succeeds, container running.

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/db/model/property_model.go go-service/internal/db/repository/property_repo.go
git commit -m "feat: add REMOVED/ARCHIVED model constants, filter ListByOwner, add HasActiveListing"
```

---

### Task 3: Backend Service — RemoveProperty

**Files:**
- Modify: `go-service/internal/modules/property/service.go`

- [ ] **Step 1: Add HasActiveListing to Store interface**

In `service.go`, add to the `Store` interface:

```go
type Store interface {
    Create(ownerUserID int64, title, address string) (int64, error)
    FindByID(id int64) (*model.Property, error)
    ListByOwner(ownerUserID int64) ([]*model.Property, error)
    Update(p *model.Property) error
    SetSetupStatus(id int64, status string, updatedAt time.Time) error
    HasActiveListing(propertyID int64) (bool, error)   // ← add this line
    AddAttachment(propertyID int64, attachType, url string) (int64, error)
    DeleteAttachment(propertyID, attachmentID int64) error
    ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}
```

- [ ] **Step 2: Add ErrPropertyListed to var block**

Change the existing `var` block (lines 17-21) to:

```go
var (
    ErrNotFound       = errors.New("property not found")
    ErrForbidden      = errors.New("only the property owner can perform this action")
    ErrNotOwner       = errors.New("KYC verified owner credential required")
    ErrPropertyListed = errors.New("物件上架中，無法移除")
)
```

- [ ] **Step 3: Add RemoveProperty method**

Add after the `DeleteAttachment` method (around line 136), before `computeSetupStatus`:

```go
func (s *Service) RemoveProperty(ctx context.Context, propertyID int64, wallet string) error {
    user, err := s.requireOwner(wallet)
    if err != nil {
        return err
    }
    prop, err := s.repo.FindByID(propertyID)
    if err != nil {
        return fmt.Errorf("property: RemoveProperty: %w", err)
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
    return s.repo.SetSetupStatus(propertyID, model.PropertySetupRemoved, time.Now())
}
```

Note: `ctx` is accepted to match handler convention but not used — the repo calls are synchronous.

- [ ] **Step 4: Build**

```bash
cd go-service && docker compose up --build -d
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/modules/property/service.go
git commit -m "feat: add RemoveProperty service method with active listing guard"
```

---

### Task 4: Backend Handler + Router

**Files:**
- Modify: `go-service/internal/modules/property/handler.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [ ] **Step 1: Add RemoveProperty to APIService interface**

In `handler.go`, add to `APIService`:

```go
type APIService interface {
    Create(wallet, title, address string) (int64, error)
    ListMine(wallet string) ([]*model.Property, error)
    GetForOwner(id int64, wallet string) (*model.Property, error)
    Update(id int64, wallet string, req UpdatePropertyRequest) error
    AddAttachment(propertyID int64, wallet, attachType, url string) (int64, error)
    DeleteAttachment(propertyID, attachmentID int64, wallet string) error
    UploadPhoto(ctx context.Context, propertyID int64, wallet string, data []byte, contentType string) (int64, string, error)
    DownloadPhoto(ctx context.Context, propertyID int64, filename string) ([]byte, string, error)
    RemoveProperty(ctx context.Context, propertyID int64, wallet string) error   // ← add
}
```

- [ ] **Step 2: Add RemoveProperty handler**

Add after `DeleteAttachment` handler (around line 139), before `toPropertyResponse`:

```go
func (h *Handler) RemoveProperty(c *gin.Context) {
    id, err := parseID(c)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
        return
    }
    if err := h.svc.RemoveProperty(c.Request.Context(), id, walletFrom(c)); err != nil {
        handleErr(c, err)
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

- [ ] **Step 3: Add 409 case to handleErr**

Change `handleErr` to:

```go
func handleErr(c *gin.Context, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrForbidden):
        c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrNotOwner):
        c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrPropertyListed):
        c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
    default:
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
    }
}
```

- [ ] **Step 4: Add route in router.go**

In `go-service/internal/bootstrap/router.go`, inside the `protected` group, after the existing `DELETE /property/:id/attachment/:aid` line:

```go
protected.DELETE("/property/:id/attachment/:aid", newPropertyHandler.DeleteAttachment)
protected.POST("/property/:id/attachment/photo", newPropertyHandler.UploadPhoto)
protected.PUT("/property/:id/remove", newPropertyHandler.RemoveProperty)   // ← add
```

- [ ] **Step 5: Build + smoke test**

```bash
cd go-service && docker compose up --build -d
```

Manual check: `curl -X PUT http://localhost:8081/api/property/9999/remove` (no auth) should return 401.

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/modules/property/handler.go go-service/internal/bootstrap/router.go
git commit -m "feat: add PUT /property/:id/remove endpoint with 409 on active listing"
```

---

### Task 5: Frontend API Layer

**Files:**
- Modify: `react-service/src/api/propertyApi.ts`

- [ ] **Step 1: Expand PropertySetupStatus type**

In `propertyApi.ts`, line 3, change:

```typescript
export type PropertySetupStatus = "DRAFT" | "READY";
```

to:

```typescript
export type PropertySetupStatus = "DRAFT" | "READY" | "ARCHIVED" | "REMOVED";
```

- [ ] **Step 2: Add removeProperty function**

After the `uploadPropertyPhoto` function (or at the end of the file), add:

```typescript
export async function removeProperty(id: number): Promise<void> {
    const res = await fetch(`${API}/property/${id}/remove`, {
        method: "PUT",
        credentials: "include",
    });
    await parse<unknown>(res);
}
```

- [ ] **Step 3: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/api/propertyApi.ts
git commit -m "feat: expand PropertySetupStatus type and add removeProperty API call"
```

---

### Task 6: MyPropertiesPage — Filter Cards, Action Buttons, Confirm Dialog

**Files:**
- Modify: `react-service/src/pages/MyPropertiesPage.tsx`

This task rewrites MyPropertiesPage substantially. The current file is 138 lines. Replace it entirely with the version below.

- [ ] **Step 1: Write the new file**

```typescript
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMyProperties, removeProperty, type Property, type PropertySetupStatus } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};

function formatArea(p: Property): string {
    if (!p.main_area) return "坪數未設定";
    return `${p.main_area} 坪`;
}

function formatLayout(p: Property): string {
    const parts: string[] = [];
    if (p.rooms != null) parts.push(`${p.rooms} 房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms} 廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms} 衛`);
    return parts.length > 0 ? parts.join("") : "格局未設定";
}

function statusBadgeCls(status: PropertySetupStatus): string {
    if (status === "READY") return "bg-[#E8F5E9] text-[#2E7D32]";
    if (status === "ARCHIVED") return "bg-surface-container text-on-surface-variant";
    return "bg-surface-container-low text-on-surface-variant";
}

function statusLabel(status: PropertySetupStatus): string {
    if (status === "READY") return "✓ READY";
    if (status === "ARCHIVED") return "歷史";
    return "草稿";
}

type FilterType = "ALL" | "READY" | "DRAFT" | "ARCHIVED";

export default function MyPropertiesPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
    const [removing, setRemoving] = useState<number | null>(null);
    const [removeError, setRemoveError] = useState("");
    const [removeLoading, setRemoveLoading] = useState(false);

    const loadItems = () => {
        setLoading(true);
        listMyProperties()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取物件失敗"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadItems(); }, []);

    const readyCount    = items.filter((p) => p.setup_status === "READY").length;
    const draftCount    = items.filter((p) => p.setup_status === "DRAFT").length;
    const archivedCount = items.filter((p) => p.setup_status === "ARCHIVED").length;

    const filtered =
        activeFilter === "ALL"      ? items :
        activeFilter === "READY"    ? items.filter((p) => p.setup_status === "READY") :
        activeFilter === "DRAFT"    ? items.filter((p) => p.setup_status === "DRAFT") :
        items.filter((p) => p.setup_status === "ARCHIVED");

    const handleRemove = async () => {
        if (removing === null) return;
        setRemoveLoading(true);
        setRemoveError("");
        try {
            await removeProperty(removing);
            setRemoving(null);
            loadItems();
        } catch (e) {
            setRemoveError(e instanceof Error ? e.message : "移除失敗");
        } finally {
            setRemoveLoading(false);
        }
    };

    const filterCards: { label: string; value: number; filter: FilterType }[] = [
        { label: "物件總數",    value: items.length,   filter: "ALL"      },
        { label: "完成度 READY", value: readyCount,    filter: "READY"    },
        { label: "草稿中",      value: draftCount,     filter: "DRAFT"    },
        { label: "歷史",        value: archivedCount,  filter: "ARCHIVED" },
    ];

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="flex flex-col gap-2">
                    <Link
                        to="/member"
                        className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
                    >
                        ← 身分工作台
                    </Link>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-extrabold text-on-surface">我的物件</h1>
                            <p className="mt-2 text-sm text-on-surface-variant">管理你的房屋物件，完成後可上架出租或出售。</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/my/properties/new")}
                            className="flex items-center gap-2 rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            新增物件
                        </button>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    {filterCards.map(({ label, value, filter }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setActiveFilter(filter)}
                            className={`rounded-2xl border p-5 text-left transition-colors ${
                                activeFilter === filter
                                    ? "border-primary-container bg-primary-container/10"
                                    : "border-outline-variant/15 bg-surface-container-lowest hover:bg-surface-container-low"
                            }`}
                        >
                            <p className="text-sm text-on-surface-variant">{label}</p>
                            <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
                        </button>
                    ))}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取物件中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : filtered.length === 0 ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">尚無物件</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">
                            {activeFilter === "ALL" ? "點擊右上角「新增物件」開始建立第一個物件。" : "此篩選條件下無物件。"}
                        </p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {filtered.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/my/properties/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    {(() => {
                                        const firstPhoto = item.attachments.find((a) => a.type === "PHOTO");
                                        return firstPhoto ? (
                                            <img
                                                src={firstPhoto.url}
                                                alt="物件照片"
                                                className="h-20 w-28 shrink-0 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-surface-container-low">
                                                <span className="material-symbols-outlined text-2xl text-on-surface-variant">photo_camera</span>
                                            </div>
                                        );
                                    })()}
                                    <div className="flex-1">
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">#{item.id}</span>
                                            {item.building_type ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                    {BUILDING_TYPE_LABEL[item.building_type] ?? item.building_type}
                                                </span>
                                            ) : null}
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeCls(item.setup_status)}`}>
                                                {statusLabel(item.setup_status)}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名物件"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "地址未設定"}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">{formatArea(item)} · {formatLayout(item)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 text-right">
                                        <p className="text-xs text-on-surface-variant">更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}</p>
                                        {item.setup_status === "ARCHIVED" ? (
                                            <span className="text-xs text-on-surface-variant">已歸檔</span>
                                        ) : (
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                {item.setup_status === "READY" && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/my/properties/${item.id}/listing`); }}
                                                        className="rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                                    >
                                                        上架
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setRemoving(item.id); setRemoveError(""); }}
                                                    className="rounded-lg border border-error/30 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-container"
                                                >
                                                    移除物件
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>

            {removing !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                        <h3 className="text-lg font-bold text-on-surface">確定移除物件？</h3>
                        <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                            此操作無法復原，物件資料將保留於資料庫但不再顯示。
                        </p>
                        {removeError && (
                            <p className="mt-3 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{removeError}</p>
                        )}
                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => void handleRemove()}
                                disabled={removeLoading}
                                className="w-full rounded-xl bg-error px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                                {removeLoading ? "處理中..." : "確定移除"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRemoving(null); setRemoveError(""); }}
                                disabled={removeLoading}
                                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/pages/MyPropertiesPage.tsx
git commit -m "feat: MyPropertiesPage 4-filter cards, action buttons, remove dialog"
```

---

### Task 7: PropertyEditPage — Remove "上架刊登" Section

**Files:**
- Modify: `react-service/src/pages/PropertyEditPage.tsx`

- [ ] **Step 1: Remove isReady const (line 183)**

Find and delete this line:

```typescript
    const isReady = property.setup_status === "READY";
```

- [ ] **Step 2: Remove the "上架刊登" section (lines 430–452)**

Remove the entire block:

```typescript
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-2 text-lg font-bold text-on-surface">上架刊登</h2>
                    {isReady ? (
                        <div className="flex flex-col gap-3 md:flex-row">
                            <button
                                type="button"
                                onClick={() => navigate(`/my/properties/${propertyId}/rent`)}
                                className="flex-1 rounded-xl bg-[#E8A000] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                            >
                                上架出租
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/my/properties/${propertyId}/sale`)}
                                className="flex-1 rounded-xl bg-[#2196F3] px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                            >
                                上架出售
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-on-surface-variant">物件完成度達 100%（名稱＋地址＋建物類型＋照片）後，上架按鈕才會出現。</p>
                    )}
                </section>
```

- [ ] **Step 3: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/PropertyEditPage.tsx
git commit -m "feat: remove 上架刊登 section from PropertyEditPage"
```

---

### Task 8: Extract RentalListingForm Component

**Files:**
- Create: `react-service/src/components/listing/RentalListingForm.tsx`
- Modify: `react-service/src/pages/RentalListingPage.tsx`

The `RentalListingPage` currently owns both the form UI and property/listing data loading. Extract the form logic into a self-contained component; reduce the page to a thin loader shell.

- [ ] **Step 1: Create `react-service/src/components/listing/RentalListingForm.tsx`**

```typescript
import { useCallback, useEffect, useState } from "react";
import {
    closeRentalListing,
    createRentalListing,
    getRentalListingForProperty,
    publishRentalListing,
    updateRentalListing,
    type CreateRentalListingPayload,
    type ManagementFeePayer,
    type RentalListing,
} from "@/api/rentalListingApi";
import type { Property } from "@/api/propertyApi";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿", ACTIVE: "上架中", NEGOTIATING: "洽談中",
    LOCKED: "已鎖定", CLOSED: "已下架", EXPIRED: "已過期",
};

type FormState = {
    monthly_rent: string; deposit_months: string;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: string; allow_pets: boolean;
    allow_cooking: boolean; gender_restriction: string;
    notes: string; duration_days: string;
};

const EMPTY_FORM: FormState = {
    monthly_rent: "", deposit_months: "2",
    management_fee_payer: "TENANT", min_lease_months: "12",
    allow_pets: false, allow_cooking: true,
    gender_restriction: "", notes: "", duration_days: "30",
};

function listingToForm(rl: RentalListing): FormState {
    return {
        monthly_rent: String(rl.monthly_rent),
        deposit_months: String(rl.deposit_months),
        management_fee_payer: rl.management_fee_payer,
        min_lease_months: String(rl.min_lease_months),
        allow_pets: rl.allow_pets, allow_cooking: rl.allow_cooking,
        gender_restriction: rl.gender_restriction ?? "",
        notes: rl.notes ?? "", duration_days: String(rl.duration_days),
    };
}

function formToPayload(f: FormState): CreateRentalListingPayload {
    return {
        monthly_rent: parseFloat(f.monthly_rent) || 0,
        deposit_months: parseFloat(f.deposit_months) || 0,
        management_fee_payer: f.management_fee_payer,
        min_lease_months: parseInt(f.min_lease_months, 10) || 0,
        allow_pets: f.allow_pets, allow_cooking: f.allow_cooking,
        gender_restriction: f.gender_restriction || undefined,
        notes: f.notes || undefined,
        duration_days: parseInt(f.duration_days, 10) || 30,
    };
}

type Props = {
    propertyId: number;
    property: Property;
};

export default function RentalListingForm({ propertyId, property }: Props) {
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: "", err: "" });

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const rl = await getRentalListingForProperty(propertyId);
            setListing(rl);
            setForm(rl ? listingToForm(rl) : EMPTY_FORM);
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "載入失敗" });
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => { void reload(); }, [reload]);

    const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: val }));

    const handleSave = async () => {
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            const payload = formToPayload(form);
            if (listing) {
                await updateRentalListing(listing.id, payload);
            } else {
                await createRentalListing(propertyId, payload);
            }
            setMsg({ ok: "已儲存", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "儲存失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await publishRentalListing(listing.id, parseInt(form.duration_days, 10) || 30);
            setMsg({ ok: "已上架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "上架失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await closeRentalListing(listing.id);
            setMsg({ ok: "已下架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "下架失敗" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-10 text-center text-sm text-on-surface-variant">載入中...</div>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-on-surface">出租條件</h2>
                <p className="text-sm text-on-surface-variant">{property.address}</p>
                {listing ? (
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${listing.status === "ACTIVE" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                        {STATUS_LABEL[listing.status] ?? listing.status}
                    </span>
                ) : null}
            </div>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">月租金（NTD）*</label>
                        <input type="number" value={form.monthly_rent} onChange={(e) => setField("monthly_rent", e.target.value)} className={inputCls} placeholder="例：20000" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">押金月數</label>
                        <input type="number" value={form.deposit_months} onChange={(e) => setField("deposit_months", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">管理費負擔方</label>
                        <select value={form.management_fee_payer} onChange={(e) => setField("management_fee_payer", e.target.value as ManagementFeePayer)} className={inputCls}>
                            <option value="TENANT">租客</option>
                            <option value="OWNER">房東</option>
                            <option value="SPLIT">各半</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">最短租期（月）</label>
                        <input type="number" value={form.min_lease_months} onChange={(e) => setField("min_lease_months", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">性別限制</label>
                        <select value={form.gender_restriction} onChange={(e) => setField("gender_restriction", e.target.value)} className={inputCls}>
                            <option value="">不限</option>
                            <option value="MALE">限男</option>
                            <option value="FEMALE">限女</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">刊登天數（上架時生效）</label>
                        <input type="number" value={form.duration_days} onChange={(e) => setField("duration_days", e.target.value)} className={inputCls} min="7" />
                    </div>
                    <div className="flex items-center gap-6 md:col-span-2">
                        {([["allow_pets", "可養寵物"], ["allow_cooking", "可炊煮"]] as const).map(([key, label]) => (
                            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                                <input type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                                {label}
                            </label>
                        ))}
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-on-surface-variant">備注</label>
                        <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} className={inputCls} />
                    </div>
                </div>

                {msg.ok ? <p className="mt-4 text-sm text-[#2E7D32]">✓ {msg.ok}</p> : null}
                {msg.err ? <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{msg.err}</p> : null}

                <div className="mt-6 flex flex-col gap-3">
                    <button type="button" onClick={() => void handleSave()} disabled={saving}
                        className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container disabled:opacity-40 hover:opacity-90 transition-opacity">
                        {saving ? "處理中..." : listing ? "更新條件" : "建立出租刊登"}
                    </button>
                    {listing?.status === "DRAFT" ? (
                        <button type="button" onClick={() => void handlePublish()} disabled={saving}
                            className="w-full rounded-xl bg-[#E8A000] px-6 py-3 font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                            上架（刊登 {form.duration_days} 天）
                        </button>
                    ) : null}
                    {listing?.status === "ACTIVE" ? (
                        <button type="button" onClick={() => void handleClose()} disabled={saving}
                            className="w-full rounded-xl border border-error/30 bg-surface-container-lowest px-6 py-3 font-medium text-error disabled:opacity-40 hover:bg-error-container transition-colors">
                            下架
                        </button>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
```

- [ ] **Step 2: Replace RentalListingPage.tsx with thin shell**

Replace the entire content of `react-service/src/pages/RentalListingPage.tsx` with:

```typescript
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, type Property } from "@/api/propertyApi";
import SiteLayout from "@/layouts/SiteLayout";
import RentalListingForm from "@/components/listing/RentalListingForm";

export default function RentalListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;
    const [property, setProperty] = useState<Property | null>(null);

    useEffect(() => {
        if (!isNaN(propertyId)) {
            getProperty(propertyId).then(setProperty).catch(console.error);
        }
    }, [propertyId]);

    if (!property) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to={`/my/properties/${propertyId}`} className="text-sm text-on-surface-variant hover:text-primary-container">
                    ← 返回物件編輯
                </Link>
                <RentalListingForm propertyId={propertyId} property={property} />
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/components/listing/RentalListingForm.tsx react-service/src/pages/RentalListingPage.tsx
git commit -m "feat: extract RentalListingForm component, reduce RentalListingPage to thin shell"
```

---

### Task 9: Extract SaleListingForm Component

**Files:**
- Create: `react-service/src/components/listing/SaleListingForm.tsx`
- Modify: `react-service/src/pages/SaleListingPage.tsx`

Same pattern as Task 8, but for sale listing.

- [ ] **Step 1: Create `react-service/src/components/listing/SaleListingForm.tsx`**

```typescript
import { useCallback, useEffect, useState } from "react";
import {
    closeSaleListing,
    createSaleListing,
    getSaleListingForProperty,
    publishSaleListing,
    updateSaleListing,
    type CreateSaleListingPayload,
    type SaleListing,
} from "@/api/saleListingApi";
import type { Property } from "@/api/propertyApi";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿", ACTIVE: "上架中", NEGOTIATING: "洽談中",
    LOCKED: "已鎖定", CLOSED: "已下架", EXPIRED: "已過期",
};

type FormState = {
    total_price: string; unit_price_per_ping: string;
    parking_type: string; parking_price: string;
    notes: string; duration_days: string;
};

const EMPTY_FORM: FormState = {
    total_price: "", unit_price_per_ping: "",
    parking_type: "", parking_price: "",
    notes: "", duration_days: "30",
};

function listingToForm(sl: SaleListing): FormState {
    return {
        total_price: String(sl.total_price),
        unit_price_per_ping: sl.unit_price_per_ping != null ? String(sl.unit_price_per_ping) : "",
        parking_type: sl.parking_type ?? "",
        parking_price: sl.parking_price != null ? String(sl.parking_price) : "",
        notes: sl.notes ?? "",
        duration_days: String(sl.duration_days),
    };
}

function formToPayload(f: FormState): CreateSaleListingPayload {
    const unit = parseFloat(f.unit_price_per_ping);
    const pprice = parseFloat(f.parking_price);
    return {
        total_price: parseFloat(f.total_price) || 0,
        unit_price_per_ping: isFinite(unit) ? unit : undefined,
        parking_type: f.parking_type || undefined,
        parking_price: isFinite(pprice) ? pprice : undefined,
        notes: f.notes || undefined,
        duration_days: parseInt(f.duration_days, 10) || 30,
    };
}

type Props = {
    propertyId: number;
    property: Property;
};

export default function SaleListingForm({ propertyId, property }: Props) {
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: "", err: "" });

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const sl = await getSaleListingForProperty(propertyId);
            setListing(sl);
            setForm(sl ? listingToForm(sl) : EMPTY_FORM);
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "載入失敗" });
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => { void reload(); }, [reload]);

    const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: val }));

    const handleSave = async () => {
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            const payload = formToPayload(form);
            if (listing) {
                await updateSaleListing(listing.id, payload);
            } else {
                await createSaleListing(propertyId, payload);
            }
            setMsg({ ok: "已儲存", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "儲存失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await publishSaleListing(listing.id, parseInt(form.duration_days, 10) || 30);
            setMsg({ ok: "已上架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "上架失敗" });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async () => {
        if (!listing) return;
        setSaving(true); setMsg({ ok: "", err: "" });
        try {
            await closeSaleListing(listing.id);
            setMsg({ ok: "已下架", err: "" });
            await reload();
        } catch (err) {
            setMsg({ ok: "", err: err instanceof Error ? err.message : "下架失敗" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-10 text-center text-sm text-on-surface-variant">載入中...</div>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-on-surface">出售條件</h2>
                <p className="text-sm text-on-surface-variant">{property.address}</p>
                {listing ? (
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${listing.status === "ACTIVE" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                        {STATUS_LABEL[listing.status] ?? listing.status}
                    </span>
                ) : null}
            </div>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">總價（NTD）*</label>
                        <input type="number" value={form.total_price} onChange={(e) => setField("total_price", e.target.value)} className={inputCls} placeholder="例：12000000" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">單坪價（NTD）</label>
                        <input type="number" value={form.unit_price_per_ping} onChange={(e) => setField("unit_price_per_ping", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">車位類型</label>
                        <select value={form.parking_type} onChange={(e) => setField("parking_type", e.target.value)} className={inputCls}>
                            <option value="">無</option>
                            <option value="RAMP">坡道平面</option>
                            <option value="MECHANICAL">機械</option>
                            <option value="TOWER">塔式</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">車位價格（NTD）</label>
                        <input type="number" value={form.parking_price} onChange={(e) => setField("parking_price", e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">刊登天數</label>
                        <input type="number" value={form.duration_days} onChange={(e) => setField("duration_days", e.target.value)} className={inputCls} min="7" />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-on-surface-variant">備注</label>
                        <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} className={inputCls} />
                    </div>
                </div>

                {msg.ok ? <p className="mt-4 text-sm text-[#2E7D32]">✓ {msg.ok}</p> : null}
                {msg.err ? <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{msg.err}</p> : null}

                <div className="mt-6 flex flex-col gap-3">
                    <button type="button" onClick={() => void handleSave()} disabled={saving}
                        className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container disabled:opacity-40 hover:opacity-90 transition-opacity">
                        {saving ? "處理中..." : listing ? "更新條件" : "建立出售刊登"}
                    </button>
                    {listing?.status === "DRAFT" ? (
                        <button type="button" onClick={() => void handlePublish()} disabled={saving}
                            className="w-full rounded-xl bg-[#2196F3] px-6 py-3 font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                            上架（刊登 {form.duration_days} 天）
                        </button>
                    ) : null}
                    {listing?.status === "ACTIVE" ? (
                        <button type="button" onClick={() => void handleClose()} disabled={saving}
                            className="w-full rounded-xl border border-error/30 bg-surface-container-lowest px-6 py-3 font-medium text-error disabled:opacity-40 hover:bg-error-container transition-colors">
                            下架
                        </button>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
```

- [ ] **Step 2: Replace SaleListingPage.tsx with thin shell**

Replace the entire content of `react-service/src/pages/SaleListingPage.tsx` with:

```typescript
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, type Property } from "@/api/propertyApi";
import SiteLayout from "@/layouts/SiteLayout";
import SaleListingForm from "@/components/listing/SaleListingForm";

export default function SaleListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;
    const [property, setProperty] = useState<Property | null>(null);

    useEffect(() => {
        if (!isNaN(propertyId)) {
            getProperty(propertyId).then(setProperty).catch(console.error);
        }
    }, [propertyId]);

    if (!property) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to={`/my/properties/${propertyId}`} className="text-sm text-on-surface-variant hover:text-primary-container">
                    ← 返回物件編輯
                </Link>
                <SaleListingForm propertyId={propertyId} property={property} />
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/components/listing/SaleListingForm.tsx react-service/src/pages/SaleListingPage.tsx
git commit -m "feat: extract SaleListingForm component, reduce SaleListingPage to thin shell"
```

---

### Task 10: PropertyListingPage + Router Route

**Files:**
- Create: `react-service/src/pages/PropertyListingPage.tsx`
- Modify: `react-service/src/router/index.tsx`

- [ ] **Step 1: Create `react-service/src/pages/PropertyListingPage.tsx`**

```typescript
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, type Property } from "@/api/propertyApi";
import SiteLayout from "@/layouts/SiteLayout";
import RentalListingForm from "@/components/listing/RentalListingForm";
import SaleListingForm from "@/components/listing/SaleListingForm";

type Tab = "RENT" | "SALE";

export default function PropertyListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = id ? parseInt(id, 10) : NaN;
    const [property, setProperty] = useState<Property | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("RENT");

    useEffect(() => {
        if (!isNaN(propertyId)) {
            getProperty(propertyId).then(setProperty).catch(console.error);
        }
    }, [propertyId]);

    if (!property) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to="/my/properties" className="text-sm text-on-surface-variant hover:text-primary-container">
                        ← 返回我的物件
                    </Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">上架刊登</h1>
                    <p className="text-sm text-on-surface-variant">{property.address}</p>
                </div>

                <div className="flex border-b border-outline-variant/20">
                    {(["RENT", "SALE"] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-semibold transition-colors ${
                                activeTab === tab
                                    ? "border-b-2 border-primary-container text-primary-container"
                                    : "text-on-surface-variant hover:text-on-surface"
                            }`}
                        >
                            {tab === "RENT" ? "出租" : "出售"}
                        </button>
                    ))}
                </div>

                {activeTab === "RENT" && <RentalListingForm propertyId={propertyId} property={property} />}
                {activeTab === "SALE" && <SaleListingForm propertyId={propertyId} property={property} />}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Add route to router**

In `react-service/src/router/index.tsx`, add after the `/my/properties/:id/sale` route block (around line 198), and import `PropertyListingPage`:

Add import at top of file with other page imports:
```typescript
import PropertyListingPage from "@/pages/PropertyListingPage";
```

Add route after the `/my/properties/:id/sale` block:
```typescript
    {
        path: "/my/properties/:id/listing",
        element: (
            <RequireCredential requiredRole="OWNER">
                <PropertyListingPage />
            </RequireCredential>
        ),
    },
```

- [ ] **Step 3: Verify lint + build**

```bash
cd react-service && npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/PropertyListingPage.tsx react-service/src/router/index.tsx
git commit -m "feat: add PropertyListingPage with 出租/出售 tab switch at /my/properties/:id/listing"
```

---

## Verification Checklist

After all tasks are committed, verify these end-to-end scenarios:

1. **Remove DRAFT/READY** — `PUT /property/:id/remove` returns 200; property disappears from `GET /property`
2. **Remove active listing** — returns 409 with Chinese error message; dialog shows the message
3. **Remove other user's property** — returns 403
4. **ListByOwner excludes REMOVED** — REMOVED properties never show in `GET /property`
5. **Four filter cards** — click each card; list updates correctly; active card has highlight border
6. **READY card action** — "上架" button appears; click navigates to `/my/properties/:id/listing`; card body click navigates to `/my/properties/:id` (not blocked)
7. **DRAFT card action** — only "移除物件" button; no "上架" button
8. **ARCHIVED card** — "已歸檔" text shown, no buttons; card body click still navigates to detail page
9. **Remove dialog** — opens on "移除物件" click; cancel closes it; confirm calls API; on 409 shows backend error in dialog
10. **PropertyEditPage** — no "上架刊登" section visible
11. **`/my/properties/:id/listing`** — renders with RENT tab active by default; switching to SALE tab loads sale form; both forms operate independently
12. **Existing routes** — `/my/properties/:id/rent` and `/my/properties/:id/sale` still work as thin shells
