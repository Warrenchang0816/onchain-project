# Gate 2 刊登分流實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標：** 讓房屋物件完成揭露後不自動公開，必須先選擇上架出租或上架賣屋，補完對應刊登資料後才進入公開列表。

**架構：** 沿用既有 `properties` 作為物件主體、`listings` 作為刊登明細。後端新增刊登目的與出租/出售欄位檢核，前端在 `/my/listings/:id` 以物件狀態驅動「選擇出租/賣屋 -> 編輯對應表單 -> 發布」流程。

**技術棧：** Go、Gin、PostgreSQL init SQL、React、TypeScript、Vite。

---

## 檔案結構

- 修改：`infra/init/10-properties.sql`  
  擴充 `listings` 出租/出售欄位，使用 nullable 欄位支援草稿。
- 修改：`go-service/internal/db/model/listing_model.go`  
  補出租/出售欄位與 `list_type` 語意。
- 修改：`go-service/internal/db/repository/listing_repo.go`  
  補 scan/select/update，新增設定刊登目的與細節更新方法。
- 修改：`go-service/internal/modules/listing/domain.go`  
  將刊登完整度拆成共用欄位、出租欄位、出售欄位檢核。
- 修改：`go-service/internal/modules/listing/domain_test.go`  
  新增出租/出售完整度測試。
- 修改：`go-service/internal/modules/listing/dto.go`  
  新增 `SetListingIntentRequest`、`UpdateRentDetailsRequest`、`UpdateSaleDetailsRequest`。
- 修改：`go-service/internal/modules/listing/service.go`  
  新增 `SetIntent`、`UpdateRentDetails`、`UpdateSaleDetails`，發布前確認物件與刊登都 ready。
- 修改：`go-service/internal/modules/listing/handler.go`  
  新增三個 handler。
- 修改：`go-service/internal/bootstrap/router.go`  
  新增三條 protected route。
- 修改：`react-service/src/api/listingApi.ts`  
  補型別與 API client。
- 修改：`react-service/src/pages/ListingDetailPage.tsx`  
  草稿詳情支援選擇出租/賣屋與對應表單。
- 修改：`react-service/src/pages/MyListingsPage.tsx`  
  卡片狀態顯示「可建立刊登 / 待選擇出租或出售 / 待補出租資料 / 待補出售資料」。

---

## 任務 1：後端刊登完整度規則

**檔案：**
- 修改：`go-service/internal/modules/listing/domain.go`
- 修改：`go-service/internal/modules/listing/domain_test.go`

- [x] **步驟 1：寫失敗測試**

在 `domain_test.go` 加入：

```go
func TestCanSelectListingIntentRequiresReadyProperty(t *testing.T) {
	l := &model.Listing{
		Status:   model.ListingStatusDraft,
		Title:    "大安區住宅",
		Address:  "台北市大安區復興南路一段100號5樓",
		ListType: model.ListingTypeUnset,
		Price:    30000,
	}
	p := &model.Property{
		VerificationStatus: model.PropertyVerificationDraft,
		CompletenessStatus: model.PropertyCompletenessDisclosureRequired,
	}
	if CanSelectListingIntent(l, p) {
		t.Fatal("expected incomplete property to block listing intent selection")
	}
	p.VerificationStatus = model.PropertyVerificationVerified
	p.CompletenessStatus = model.PropertyCompletenessReadyForListing
	p.DisclosureHash = "abc123"
	if !CanSelectListingIntent(l, p) {
		t.Fatal("expected draft listing with ready property to allow intent selection")
	}
}

func TestComputeSetupStatusKeepsUnsetIntentIncomplete(t *testing.T) {
	l := &model.Listing{
		Status:        model.ListingStatusDraft,
		Title:         "大安區住宅",
		Address:       "台北市大安區復興南路一段100號5樓",
		ListType:      model.ListingTypeUnset,
		Price:         30000,
		AreaPing:      sql.NullFloat64{Float64: 51.93, Valid: true},
		RoomCount:     sql.NullInt64{Int64: 3, Valid: true},
		BathroomCount: sql.NullInt64{Int64: 2, Valid: true},
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusIncomplete {
		t.Fatalf("ComputeSetupStatus() = %s, want INCOMPLETE", got)
	}
}

func TestComputeSetupStatusRentReadyWithMinimumFields(t *testing.T) {
	l := &model.Listing{
		Status:        model.ListingStatusDraft,
		Title:         "可租補三房",
		Address:       "台北市文山區溪洲街",
		ListType:      model.ListingTypeRent,
		Price:         68000,
		AreaPing:      sql.NullFloat64{Float64: 51.93, Valid: true},
		RoomCount:     sql.NullInt64{Int64: 3, Valid: true},
		BathroomCount: sql.NullInt64{Int64: 2, Valid: true},
	}
	if got := ComputeSetupStatus(l); got != model.ListingSetupStatusReady {
		t.Fatalf("ComputeSetupStatus() = %s, want READY", got)
	}
}
```

- [x] **步驟 2：確認測試失敗**

執行：

```powershell
cd go-service
$env:GOCACHE="D:\Git\onchain-project\go-service\.gocache"
go test ./internal/modules/listing -run "TestCanSelectListingIntent|TestComputeSetupStatus" -v
```

預期：`CanSelectListingIntent` 尚未存在而失敗。

- [x] **步驟 3：實作完整度規則**

在 `domain.go` 新增 `CanSelectListingIntent`，並確認 `ComputeSetupStatus` 保持 `UNSET` 不可 ready：

```go
func CanSelectListingIntent(l *model.Listing, p *model.Property) bool {
	if l == nil || p == nil {
		return false
	}
	if l.Status != model.ListingStatusDraft {
		return false
	}
	if p.VerificationStatus != model.PropertyVerificationVerified {
		return false
	}
	if p.CompletenessStatus != model.PropertyCompletenessReadyForListing {
		return false
	}
	return strings.TrimSpace(p.DisclosureHash) != ""
}

func ComputeSetupStatus(l *model.Listing) string {
	if l == nil {
		return model.ListingSetupStatusIncomplete
	}
	if strings.TrimSpace(l.Title) == "" || strings.TrimSpace(l.Address) == "" {
		return model.ListingSetupStatusIncomplete
	}
	if l.ListType != model.ListingTypeRent && l.ListType != model.ListingTypeSale {
		return model.ListingSetupStatusIncomplete
	}
	if l.Price <= 0 {
		return model.ListingSetupStatusIncomplete
	}
	if !l.AreaPing.Valid || !l.RoomCount.Valid || !l.BathroomCount.Valid {
		return model.ListingSetupStatusIncomplete
	}
	return model.ListingSetupStatusReady
}
```

本階段先以現有欄位作為最小出租/出售 ready 檢核；後續財產說明書版本確定後，再把土地坪數、主建物坪數、押金、管理費等欄位擴入 schema。

- [x] **步驟 4：確認測試通過**

執行同一步驟 2 指令，預期 PASS。

---

## 任務 2：後端刊登目的 API

**檔案：**
- 修改：`go-service/internal/modules/listing/dto.go`
- 修改：`go-service/internal/modules/listing/service.go`
- 修改：`go-service/internal/modules/listing/handler.go`
- 修改：`go-service/internal/bootstrap/router.go`
- 修改：`go-service/internal/db/repository/listing_repo.go`

- [x] **步驟 1：新增 DTO**

在 `dto.go` 加入：

```go
type SetListingIntentRequest struct {
	ListType string `json:"list_type" binding:"required,oneof=RENT SALE"`
}
```

- [x] **步驟 2：repository 新增方法**

在 `listing_repo.go` 新增：

```go
func (r *ListingRepository) UpdateIntent(id int64, listType string, setupStatus string) error {
	_, err := r.db.Exec(`
		UPDATE listings
		SET list_type = $2, setup_status = $3, updated_at = NOW()
		WHERE id = $1
	`, id, listType, setupStatus)
	return err
}
```

- [x] **步驟 3：service 新增 `SetIntent`**

在 `service.go` 加入：

```go
func (s *Service) SetIntent(listingID int64, walletAddress string, req SetListingIntentRequest) error {
	caller, err := s.requireUser(walletAddress)
	if err != nil {
		return err
	}
	l, err := s.listingRepo.FindByID(listingID)
	if err != nil {
		return fmt.Errorf("listing: SetIntent: %w", err)
	}
	if l == nil {
		return ErrNotFound
	}
	if l.OwnerUserID != caller.ID {
		return ErrForbidden
	}
	if l.Status != model.ListingStatusDraft {
		return ErrInvalidStatus
	}
	if !l.PropertyID.Valid {
		return ErrInvalidStatus
	}
	p, err := s.propertyRepo.FindByID(l.PropertyID.Int64)
	if err != nil {
		return fmt.Errorf("listing: SetIntent property: %w", err)
	}
	if p == nil || p.VerificationStatus != model.PropertyVerificationVerified || p.CompletenessStatus != model.PropertyCompletenessReadyForListing {
		return ErrInvalidStatus
	}
	l.ListType = req.ListType
	return s.listingRepo.UpdateIntent(listingID, req.ListType, ComputeSetupStatus(l))
}
```

- [x] **步驟 4：handler 與 route**

`handler.go` 加入：

```go
func (h *Handler) SetListingIntent(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req SetListingIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.SetIntent(id, getWallet(c), req); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
```

`router.go` 加入：

```go
protected.PUT("/listings/:id/intent", listingHandler.SetListingIntent)
```

- [x] **步驟 5：後端編譯測試**

```powershell
cd go-service
$env:GOCACHE="D:\Git\onchain-project\go-service\.gocache"
go test ./internal/modules/listing ./internal/db/repository -v
```

預期 PASS。

---

## 任務 3：前端 API 與草稿分流 UI

**檔案：**
- 修改：`react-service/src/api/listingApi.ts`
- 修改：`react-service/src/pages/ListingDetailPage.tsx`
- 修改：`react-service/src/pages/MyListingsPage.tsx`

- [x] **步驟 1：API client**

在 `listingApi.ts` 加入：

```ts
export async function setListingIntent(id: number, listType: Exclude<ListingType, "UNSET">): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/listings/${id}/intent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ list_type: listType }),
    });
    await parseResponse<unknown>(res);
}
```

- [x] **步驟 2：草稿詳情顯示刊登分流**

在 `ListingDetailPage.tsx` 的 owner draft 區塊加入判斷：

```tsx
const propertyReady =
    listing.property?.verification_status === "VERIFIED" &&
    listing.property?.completeness_status === "READY_FOR_LISTING" &&
    Boolean(listing.property?.disclosure_hash);

const needsIntent = listing.status === "DRAFT" && listing.list_type === "UNSET";
```

當 `propertyReady && needsIntent` 時顯示兩個按鈕：

```tsx
<button type="button" onClick={() => handleSetIntent("RENT")}>上架出租</button>
<button type="button" onClick={() => handleSetIntent("SALE")}>上架賣屋</button>
```

`handleSetIntent` 呼叫 `setListingIntent` 後重新載入 detail。

- [x] **步驟 3：我的房源狀態文字**

在 `MyListingsPage.tsx` 狀態文案加入：

```ts
if (listing.status === "DRAFT" && listing.property?.completeness_status === "READY_FOR_LISTING" && listing.list_type === "UNSET") {
    return "待選擇出租或出售";
}
if (listing.status === "DRAFT" && listing.list_type === "RENT" && listing.setup_status !== "READY") {
    return "出租刊登待補資料";
}
if (listing.status === "DRAFT" && listing.list_type === "SALE" && listing.setup_status !== "READY") {
    return "出售刊登待補資料";
}
```

- [x] **步驟 4：前端 build**

```powershell
cd react-service
npm run build
```

預期 PASS；若 Vite 只有 chunk size warning，視為可接受。

---

## 任務 4：全域驗證與人工測試

**檔案：**
- 修改：`docs/superpowers/plans/2026-04-29-gate2-listing-intent-rent-sale-implementation.md`

- [x] **步驟 1：後端全量測試**

```powershell
cd go-service
$env:GOCACHE="D:\Git\onchain-project\go-service\.gocache"
go test ./...
```

預期 PASS。

- [x] **步驟 2：前端全量 build**

```powershell
cd react-service
npm run build
```

預期 PASS。

- [ ] **步驟 3：人工 smoke**

1. 屋主身份啟用後產生 property + `list_type = UNSET` 的 listing 草稿。
2. property 未 `READY_FOR_LISTING` 時，草稿詳情不允許選擇出租或賣屋。
3. property `READY_FOR_LISTING` 後，草稿詳情顯示 `上架出租` 與 `上架賣屋`。
4. 選擇出租後，`list_type` 變成 `RENT`，仍需補完刊登資料才可發布。
5. 選擇賣屋後，`list_type` 變成 `SALE`，仍需補完刊登資料才可發布。
6. 公開列表不顯示 `UNSET` 或 `DRAFT` 草稿。

---

## 自檢結果

- 規格涵蓋：物件 ready 不自動公開、出租/出售分流、公開列表只顯示 ACTIVE、角色 OCR 文案不宣稱官方認證。

---

## 2026-04-30 continuation: relational rent/sale details

- [x] Kept `listings` as the shared workflow/read-summary table.
- [x] Added relational one-to-one detail tables:
  - `listing_rent_details`
  - `listing_sale_details`
- [x] Added owner-only APIs:
  - `PUT /api/listings/:id/rent-details`
  - `PUT /api/listings/:id/sale-details`
- [x] Added rent/sale readiness rules so `setup_status` becomes `READY` only when the matching detail row is complete.
- [x] Added frontend API types and wrappers for the new endpoints.
- [x] Verified with focused listing tests and full backend `go test ./...`.
- 範圍控制：本計畫先完成刊登目的分流與最小 ready 檢核，不在本階段擴充完整信義房屋欄位級 schema。
- 後續階段：等使用者提供不動產說明書版本後，再擴充 `properties` 的正式財產/現況欄位與 `SALE` 詳細交易欄位。
