# Gate 2 房屋物件與揭露主線實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標：** 建立 property 物件主體、財產/現況說明書、屋主重大事項保證、揭露快照 hash，並讓房源草稿必須綁定完成揭露的物件後才能上架。

**架構：** 新增 `property` 後端模組與 `properties` 資料表，listing 僅保留刊登資料並透過 `property_id` 綁定物件。前端先在我的房源與草稿詳情顯示物件揭露狀態，文件預覽統一套用途限制浮水印。

**技術棧：** Go、Gin、PostgreSQL init SQL、React、TypeScript、Vite。

---

## 任務 1：Property Domain 與揭露快照

**檔案：**
- 建立：`go-service/internal/modules/property/domain.go`
- 建立：`go-service/internal/modules/property/domain_test.go`

- [x] **步驟 1：寫失敗測試**

建立 `domain_test.go`，測試：

```go
package property

import "testing"

func TestBuildDisclosureSnapshotRequiresWarrantyAnswers(t *testing.T) {
	_, err := BuildDisclosureSnapshot(DisclosureInput{
		OwnerUserID: 7,
		PropertyAddress: "台北市大安區復興南路一段100號5樓",
		OwnershipDocNo: "A-123",
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: ""},
		},
	})
	if err == nil {
		t.Fatal("expected missing warranty answer to be rejected")
	}
}

func TestBuildDisclosureSnapshotRequiresNotesForRiskAnswers(t *testing.T) {
	_, err := BuildDisclosureSnapshot(DisclosureInput{
		OwnerUserID: 7,
		PropertyAddress: "台北市大安區復興南路一段100號5樓",
		OwnershipDocNo: "A-123",
		Warranties: []WarrantyAnswer{
			{Code: WarrantyWaterLeak, Answer: WarrantyAnswerYes},
		},
	})
	if err == nil {
		t.Fatal("expected YES warranty without note to be rejected")
	}
}

func TestBuildDisclosureSnapshotIsDeterministic(t *testing.T) {
	input := DisclosureInput{
		OwnerUserID: 7,
		PropertyAddress: " 台北市大安區復興南路一段100號5樓 ",
		OwnershipDocNo: " A-123 ",
		Statement: PropertyStatement{
			BuildingType: "公寓",
			RegisteredPing: 28.5,
			Floor: 5,
			TotalFloors: 7,
		},
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: WarrantyAnswerNo},
			{Code: WarrantyRadiation, Answer: WarrantyAnswerNo},
			{Code: WarrantyUnnaturalDeath, Answer: WarrantyAnswerUnknown, Note: "屋主不確定，需買方自行查證"},
		},
	}
	first, err := BuildDisclosureSnapshot(input)
	if err != nil {
		t.Fatalf("first snapshot: %v", err)
	}
	second, err := BuildDisclosureSnapshot(input)
	if err != nil {
		t.Fatalf("second snapshot: %v", err)
	}
	if first.DisclosureHash != second.DisclosureHash {
		t.Fatalf("disclosure hash not deterministic: %q != %q", first.DisclosureHash, second.DisclosureHash)
	}
	if first.DeedHash != second.DeedHash {
		t.Fatalf("deed hash not deterministic: %q != %q", first.DeedHash, second.DeedHash)
	}
}
```

- [x] **步驟 2：確認測試失敗**

執行：

```powershell
cd go-service
go test ./internal/modules/property -run TestBuildDisclosureSnapshot -v
```

預期：因為 `property` package 尚未存在而失敗。

- [x] **步驟 3：實作 domain**

建立 `domain.go`，包含：

- `DisclosureInput`
- `PropertyStatement`
- `WarrantyAnswer`
- `WarrantyAnswerYes / No / Unknown`
- 重大事項 code 常數
- `BuildDisclosureSnapshot`
- deterministic JSON + SHA-256 hex
- 平台責任邊界文字常數
- `WatermarkShortText` 與 `WatermarkLongText`

- [x] **步驟 4：確認測試通過**

執行：

```powershell
cd go-service
go test ./internal/modules/property -run TestBuildDisclosureSnapshot -v
```

預期：PASS。

---

## 任務 2：資料表與 repository

**檔案：**
- 建立：`infra/init/10-properties.sql`
- 建立：`go-service/internal/db/model/property_model.go`
- 建立：`go-service/internal/db/repository/property_repo.go`

- [x] **步驟 1：建立 schema**

`properties` 需包含：

- owner/source/address/deed_no
- `deed_hash`
- `property_statement_json`
- `warranty_answers_json`
- `disclosure_snapshot_json`
- `disclosure_hash`
- `verification_status`
- `completeness_status`
- timestamps

`listings` 追加：

- `property_id BIGINT REFERENCES properties(id)`

- [x] **步驟 2：建立 model/repository**

repository 至少提供：

- `FindByID`
- `FindBySourceCredentialSubmission`
- `CreateDraftFromOwnerCredential`
- `UpdateDisclosure`
- `MarkReadyForListing`

- [x] **步驟 3：跑編譯測試**

```powershell
cd go-service
go test ./internal/db/repository ./internal/modules/property -v
```

---

## 任務 3：Property service 與屋主身份啟用銜接

**檔案：**
- 建立：`go-service/internal/modules/property/service.go`
- 修改：`go-service/internal/modules/credential/service.go`
- 修改：`go-service/internal/modules/listing/service.go`
- 修改：`go-service/internal/bootstrap/wiring.go`

- [x] **步驟 1：寫 service idempotent 測試**

測試同一筆 owner credential activation 重跑時，不重複建立 property。

- [x] **步驟 2：實作 property service**

提供：

- `BootstrapOwnerCredentialProperty`
- `UpdateDisclosure`
- `ConfirmDisclosure`

`BootstrapOwnerCredentialProperty` 初始完整度為 `DISCLOSURE_REQUIRED`。

- [x] **步驟 3：credential service 改為先建 property，再建 listing 草稿**

OWNER 啟用後：

1. 建立/取得 property
2. 建立/取得 listing 草稿
3. listing 草稿綁定 property

---

## 任務 4：Listing 發布門檻

**檔案：**
- 修改：`go-service/internal/modules/listing/domain.go`
- 修改：`go-service/internal/modules/listing/domain_test.go`
- 修改：`go-service/internal/modules/listing/service.go`
- 修改：`go-service/internal/modules/listing/dto.go`
- 修改：`go-service/internal/modules/listing/handler.go`

- [x] **步驟 1：寫失敗測試**

新增測試：

- 沒有 `property_id` 不可上架
- property 未 `READY_FOR_LISTING` 不可上架
- property 已 `READY_FOR_LISTING` 且 listing 欄位完整才可上架

- [x] **步驟 2：實作門檻**

`Publish` 必須檢查：

- listing 是 DRAFT
- listing setup READY
- property exists
- property verification status VERIFIED
- property completeness status READY_FOR_LISTING
- disclosure hash exists

---

## 任務 5：前端 API 與我的房源顯示

**檔案：**
- 修改：`react-service/src/api/listingApi.ts`
- 修改：`react-service/src/pages/MyListingsPage.tsx`
- 修改：`react-service/src/pages/ListingDetailPage.tsx`

- [x] **步驟 1：補型別**

`Listing` 加：

- `property_id`
- `property.verification_status`
- `property.completeness_status`
- `property.disclosure_hash`

- [x] **步驟 2：我的房源顯示物件完整度**

顯示：

- 物件已建立
- 待填財產說明
- 待確認重大事項
- 揭露已完成
- 可上架

- [x] **步驟 3：草稿詳情顯示責任邊界**

顯示平台說明：

> 平台透過 KYC 實名制、角色認證、文件揭露、浮水印與 hash 留存，提高媒合流程的便利性、透明度與可信度；但文件內容、屋況聲明、交易承諾與後續履約責任，仍由提供資料與參與交易的使用者自行負責。

---

## 任務 6：文件預覽浮水印

**檔案：**
- 修改或建立共用元件：`react-service/src/components/common/WatermarkedDocumentPreview.tsx`
- 套用到現有文件預覽元件：`react-service/src/components/credential/CredentialDocumentUploader.tsx`

- [x] **步驟 1：建立浮水印預覽元件**

預覽圖上覆蓋：

> 僅供本平台媒合使用，非官方驗證文件

- [x] **步驟 2：套用到證件/證照/收入證明/權狀預覽**

所有有預覽圖的上傳區都要經過此元件。

---

## 任務 7：驗證

- [x] **後端測試**

```powershell
cd go-service
$env:GOCACHE="D:\Git\onchain-project\go-service\.gocache"
go test ./...
```

- [x] **前端 build**

```powershell
cd react-service
npm run build
```

- [ ] **人工 smoke**

1. OWNER 啟用後產生 property + listing 草稿。
2. 未完成物件揭露前，listing 不可上架。
3. 完成財產說明與重大事項確認後，產生 disclosure hash。
4. 我的房源顯示物件完整度。
5. 文件預覽有浮水印。

---

## 目前需等使用者補充的項目

財產/現況說明書正式欄位需等使用者提供版本後再精準對齊。本階段先用分類化 JSON 結構承接，不把欄位寫死到無法調整。
---

## 2026-04-29 continuation: property owner API

- [x] Added owner-authenticated property service methods:
  - `ListMine`
  - `GetForOwner`
  - `UpdateDisclosureForOwner`
  - `ConfirmDisclosureForOwner`
- [x] Added property API DTO/handler layer:
  - `GET /api/properties/mine`
  - `GET /api/properties/:id`
  - `PUT /api/properties/:id/disclosure`
  - `POST /api/properties/:id/disclosure/confirm`
- [x] Added repository support for `ListByOwnerUserID`.
- [x] Verified with focused property tests and full backend `go test ./...`.
