# Property Photo Gallery 設計

**Goal:** 為物件頁面加入照片上傳與展示功能。屋主在「我的物件 → 詳情/編輯」上傳照片（最多 10 張）；所有物件詳情頁（出租、出售）在頁頂以大圖 + 縮圖列展示；物件列表卡片顯示第一張縮圖。

**Architecture:** 一個共用的 `PropertyPhotoGallery`（read-only 展示）元件跨所有頁面使用；`PropertyPhotoUploader`（上傳 + 刪除）只在 `PropertyEditPage` 使用。後端新增 multipart upload endpoint，listing API 回傳加入 `photo_urls`。

**Tech Stack:** React 19 + TypeScript 5 strict（前端）；Go 1.25 + Gin + MinIO（後端）

---

## 元件設計

### PropertyPhotoGallery（共用，read-only）

**路徑：** `react-service/src/components/property/PropertyPhotoGallery.tsx`

```typescript
type Props = {
  photos: string[];       // URL 陣列，順序即顯示順序
  className?: string;
};
```

**行為：**
- `photos` 為空 → 灰色 placeholder 區塊，顯示相機圖示 + 「暫無照片」文字
- `photos.length >= 1` → 大圖區（第一張，固定高度 420px，object-cover）+ 縮圖列（橫向排列，點擊切換大圖，active 縮圖加框線）
- `selectedIndex` 為 local state（預設 0），點縮圖更新
- 縮圖列：每張 80×64px，rounded-lg，overflow hidden，cursor-pointer

### PropertyPhotoUploader（屋主端）

**路徑：** `react-service/src/components/property/PropertyPhotoUploader.tsx`

```typescript
type Props = {
  propertyId: number;
  photos: string[];        // 已上傳的 URL 陣列（從父層傳入）
  attachmentIds: number[]; // 對應每個 URL 的 attachmentId（用於刪除）
  onUploaded: () => void;  // 上傳或刪除成功後由父層 reload
};
```

**行為：**
- 上方顯示 `PropertyPhotoGallery`（傳入 photos prop）
- 下方 file input（`accept="image/*"`，單次單張選擇）
- 點選後立即上傳，上傳中顯示 loading 狀態
- 超過 10 張：file input disabled + 顯示「已達上限（10 張）」提示
- 每張縮圖右上角有 ✕ 刪除按鈕，點擊呼叫 `deleteAttachment` → `onUploaded()`
- 錯誤訊息在 input 下方顯示

---

## 前端 API 新增

**路徑：** `react-service/src/api/propertyApi.ts`

```typescript
export async function uploadPropertyPhoto(
  propertyId: number,
  file: File,
): Promise<{ id: number; url: string }> {
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(`${API}/property/${propertyId}/attachment/photo`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await parse<{ data: { id: number; url: string } }>(res);
  return data.data;
}
```

---

## 頁面改動

### PropertyEditPage（`react-service/src/pages/PropertyEditPage.tsx`）

Section C 拆成兩塊：

**Section C1 — 物件照片**（新）：
- 標題「物件照片（最多 10 張）」
- 渲染 `PropertyPhotoUploader`
- 父層在 `reload()` 後更新 `property.attachments`，重新算 photos/attachmentIds 傳入

**Section C2 — 其他附件**（既有，僅移除 PHOTO 選項）：
- type selector 的 `<option value="PHOTO">` 刪除
- 其餘 DEED / FLOOR_PLAN / DISCLOSURE 維持 URL 輸入，不動

### MyPropertiesPage（`react-service/src/pages/MyPropertiesPage.tsx`）

物件卡片左側新增縮圖欄（64×64px）：
- 有 PHOTO：顯示第一張，object-cover，rounded-lg
- 無 PHOTO：顯示灰色 placeholder（📷）

`listMyProperties()` 回傳的 `Property` 已含 `attachments`，直接使用。

### RentDetailPage（`react-service/src/pages/RentDetailPage.tsx`）

- `listing.property` 型別的 `PropertySummary` 新增 `photo_urls?: string[]`
- 在 `← 出租物件列表` 連結與 Hero section 之間插入 `<PropertyPhotoGallery photos={p?.photo_urls ?? []} />`

### SaleDetailPage（`react-service/src/pages/SaleDetailPage.tsx`）

同 RentDetailPage，在 `← 出售物件列表` 連結與 Hero section 之間插入 `<PropertyPhotoGallery photos={p?.photo_urls ?? []} />`

---

## rentalListingApi.ts / saleListingApi.ts

`PropertySummary` 新增欄位：

```typescript
photo_urls?: string[];
```

---

## 後端設計

### 照片存取模式

MinIO bucket 預設為私有（無 `SetBucketPolicy`），無法直接用 MinIO URL 放進 `<img>`。
採用 **proxy 端點** 模式：

- 上傳時：multipart file → MinIO（私有 bucket，objectPath = `property/{id}/photos/{uuid}.ext`）→ 寫 attachment，url = `{API_BASE_URL}/property/{id}/photos/{uuid}.ext`
- 讀取時：`GET /property/:id/photos/:filename`（無需 auth）→ 後端從 MinIO stream bytes → 設定 Content-Type 回傳

### 新路由（共 2 個）

```
POST /property/:id/attachment/photo     # 上傳（需 auth）
GET  /property/:id/photos/:filename     # 讀取（公開，無需 auth）
```

### handler.go — UploadPhoto

```go
func (h *Handler) UploadPhoto(c *gin.Context) {
    propertyID, err := parseID(c)
    // 1. read multipart field "photo" (max 10MB)
    // 2. call h.svc.UploadPhoto(ctx, propertyID, walletFrom(c), data, contentType)
    // 3. return { id, url }
}
```

### handler.go — ServePhoto

```go
func (h *Handler) ServePhoto(c *gin.Context) {
    propertyID, _ := parseID(c)
    filename := c.Param("filename")
    // 1. h.svc.DownloadPhoto(ctx, propertyID, filename) → data, contentType
    // 2. c.Data(200, contentType, data)
}
```

### service.go — UploadPhoto

```go
func (s *Service) UploadPhoto(ctx context.Context, propertyID int64, wallet string, data []byte, contentType string) (attachID int64, proxyURL string, err error) {
    // 1. 確認 wallet 擁有 propertyID（查 DB owner check）
    // 2. Count existing PHOTO attachments → if >= 10, return error "已達照片上限（10 張）"
    // 3. uuid := newUUID(); ext := extFromContentType(contentType)
    //    objectPath := fmt.Sprintf("property/%d/photos/%s.%s", propertyID, uuid, ext)
    // 4. s.storageSvc.Upload(ctx, objectPath, data, contentType)
    // 5. proxyURL = fmt.Sprintf("%s/property/%d/photos/%s.%s", apiBaseURL, propertyID, uuid, ext)
    // 6. s.repo.AddAttachment(propertyID, "PHOTO", proxyURL) → attachID
}
```

### service.go — DownloadPhoto

```go
func (s *Service) DownloadPhoto(ctx context.Context, propertyID int64, filename string) ([]byte, string, error) {
    // objectPath = "property/{propertyID}/photos/{filename}"
    // data, err := s.storageSvc.Download(ctx, objectPath)
    // contentType = guessContentType(filename)
    // return data, contentType, nil
}
```

`Service` struct 需注入 `storageSvc *storage.Client` 與 `apiBaseURL string`（與 credential service 相同模式）。

### listing handler — 加入 photo_urls

出租與出售 listing 回傳的 `PropertySummary` 需加入：

```go
PhotoURLs []string `json:"photo_urls"`
```

在 `toPropertySummary(p)` 中，從 `p.Attachments` 過濾 `type == "PHOTO"` 取 URL 填入。

---

## 驗證重點

1. 無照片時，三個詳情頁頂端顯示 placeholder（不報錯）
2. 上傳一張 → gallery 即時更新（`onUploaded` 觸發 reload）
3. 點縮圖切換大圖
4. 第 10 張上傳成功，第 11 張 file input disabled
5. 第 11 張嘗試上傳（若繞過前端）→ 後端回 400
6. 刪除後 count 降到 9，可再次上傳
7. 出租/出售詳情頁照片正確顯示（來自 listing API 的 photo_urls）
8. MyPropertiesPage 卡片顯示縮圖 / placeholder
