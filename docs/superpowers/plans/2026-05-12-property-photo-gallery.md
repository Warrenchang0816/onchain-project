# Property Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add property photo upload (max 10 張) to PropertyEditPage, display a shared hero+thumbnail gallery on all property detail pages (出租/出售), and show a thumbnail on MyPropertiesPage property cards.

**Architecture:** One shared read-only `PropertyPhotoGallery` component; one owner-only `PropertyPhotoUploader` wrapping it. Backend adds `POST /property/:id/attachment/photo` (multipart → MinIO → proxy URL stored as attachment) and `GET /property/:id/photos/:filename` (public proxy serve). Both listing APIs extend `PropertySummaryResponse` with `photo_urls []string`.

**Tech Stack:** React 19 + TypeScript 5 strict (frontend); Go 1.25 + Gin + MinIO via existing `storage.Client` (backend)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `go-service/internal/modules/property/service.go` | Add `storageSvc`, `apiBaseURL`, `UploadPhoto`, `DownloadPhoto` |
| Modify | `go-service/internal/modules/property/handler.go` | Add `UploadPhoto` + `ServePhoto` handlers, extend `APIService` interface |
| Create | `go-service/internal/modules/property/service_test.go` | Unit test for photo count limit |
| Modify | `go-service/internal/bootstrap/wiring.go` | Pass `minioClient` + `APP_PUBLIC_URL` to property service |
| Modify | `go-service/internal/bootstrap/router.go` | Register 2 new routes |
| Modify | `go-service/internal/modules/rental_listing/dto.go` | Add `PhotoURLs []string` |
| Modify | `go-service/internal/modules/rental_listing/service.go` | Extend `PropertyStore` interface, load attachments |
| Modify | `go-service/internal/modules/rental_listing/handler.go` | Populate `PhotoURLs` in `toResponse` |
| Modify | `go-service/internal/modules/sale_listing/dto.go` | Add `PhotoURLs []string` |
| Modify | `go-service/internal/modules/sale_listing/service.go` | Extend `PropertyStore` interface, load attachments |
| Modify | `go-service/internal/modules/sale_listing/handler.go` | Populate `PhotoURLs` in `toResponse` |
| Create | `react-service/src/components/property/PropertyPhotoGallery.tsx` | Read-only hero + thumbnail gallery |
| Create | `react-service/src/components/property/PropertyPhotoUploader.tsx` | File upload + delete, wraps gallery |
| Modify | `react-service/src/api/propertyApi.ts` | Add `uploadPropertyPhoto` |
| Modify | `react-service/src/pages/PropertyEditPage.tsx` | Add photo section C1, remove PHOTO from dropdown |
| Modify | `react-service/src/pages/MyPropertiesPage.tsx` | Add thumbnail to property cards |
| Modify | `react-service/src/api/rentalListingApi.ts` | Add `photo_urls` to `PropertySummary` |
| Modify | `react-service/src/api/saleListingApi.ts` | Add `photo_urls` to `PropertySummary` |
| Modify | `react-service/src/pages/RentDetailPage.tsx` | Add `PropertyPhotoGallery` above hero |
| Modify | `react-service/src/pages/SaleDetailPage.tsx` | Add `PropertyPhotoGallery` above hero |

---

## Task 1: Go — Property photo upload + serve endpoints

**Files:**
- Modify: `go-service/internal/modules/property/service.go`
- Modify: `go-service/internal/modules/property/handler.go`
- Create: `go-service/internal/modules/property/service_test.go`
- Modify: `go-service/internal/bootstrap/wiring.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [ ] **Step 1: Write failing test for photo count limit**

Create `go-service/internal/modules/property/service_test.go`:

```go
package property

import (
	"context"
	"testing"
	"time"

	"go-service/internal/db/model"
)

// mockStore implements Store with in-memory state.
type mockStore struct {
	property    *model.Property
	attachments []*model.PropertyAttachment
	nextID      int64
}

func (m *mockStore) Create(ownerUserID int64, title, address string) (int64, error) { return 0, nil }
func (m *mockStore) FindByID(id int64) (*model.Property, error)                    { return m.property, nil }
func (m *mockStore) ListByOwner(ownerUserID int64) ([]*model.Property, error)      { return nil, nil }
func (m *mockStore) Update(p *model.Property) error                                { return nil }
func (m *mockStore) SetSetupStatus(id int64, status string, _ time.Time) error     { return nil }
func (m *mockStore) AddAttachment(propertyID int64, attachType, url string) (int64, error) {
	m.nextID++
	m.attachments = append(m.attachments, &model.PropertyAttachment{
		ID: m.nextID, PropertyID: propertyID, Type: attachType, URL: url,
	})
	return m.nextID, nil
}
func (m *mockStore) DeleteAttachment(propertyID, attachmentID int64) error { return nil }
func (m *mockStore) ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error) {
	return m.attachments, nil
}

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(wallet string) (*model.User, error) { return m.user, nil }

func TestUploadPhoto_RejectsAtLimit(t *testing.T) {
	prop := &model.Property{
		ID: 1, OwnerUserID: 1,
		Title: "test", Address: "addr", BuildingType: "BUILDING",
		SetupStatus: model.PropertySetupDraft,
	}
	// Prefill 10 PHOTO attachments
	atts := make([]*model.PropertyAttachment, 10)
	for i := range atts {
		atts[i] = &model.PropertyAttachment{ID: int64(i + 1), Type: model.AttachmentTypePhoto}
	}
	store := &mockStore{property: prop, attachments: atts, nextID: 10}
	userStore := &mockUserStore{user: &model.User{ID: 1}}
	// nil storage: count check fires before storage is touched
	svc := NewService(store, userStore, nil, "")

	_, _, err := svc.UploadPhoto(context.Background(), 1, "wallet", []byte("img"), "image/jpeg")
	if err == nil {
		t.Fatal("expected error when photo count is 10, got nil")
	}
	want := "已達照片上限（10 張）"
	if err.Error() != want {
		t.Fatalf("got error %q, want %q", err.Error(), want)
	}
}

func TestUploadPhoto_AllowsUnder10(t *testing.T) {
	prop := &model.Property{
		ID: 1, OwnerUserID: 1,
		Title: "test", Address: "addr", BuildingType: "BUILDING",
		SetupStatus: model.PropertySetupDraft,
	}
	// 9 existing photos — one more should be allowed (but storage is nil → different error)
	atts := make([]*model.PropertyAttachment, 9)
	for i := range atts {
		atts[i] = &model.PropertyAttachment{ID: int64(i + 1), Type: model.AttachmentTypePhoto}
	}
	store := &mockStore{property: prop, attachments: atts, nextID: 9}
	userStore := &mockUserStore{user: &model.User{ID: 1}}
	svc := NewService(store, userStore, nil, "")

	_, _, err := svc.UploadPhoto(context.Background(), 1, "wallet", []byte("img"), "image/jpeg")
	// Storage is nil → "photo storage not configured", NOT the limit error
	if err == nil {
		t.Fatal("expected an error (nil storage), got nil")
	}
	if err.Error() == "已達照片上限（10 張）" {
		t.Fatal("should not have hit limit with 9 photos")
	}
}
```

- [ ] **Step 2: Run test — expect compile error (NewService signature not yet updated)**

```powershell
cd go-service
go test ./internal/modules/property/... -run TestUploadPhoto -v
```

Expected: compile error about `NewService` argument count.

- [ ] **Step 3: Update `service.go` — add storage fields, helpers, UploadPhoto, DownloadPhoto**

In `go-service/internal/modules/property/service.go`:

Add imports `"context"`, `"crypto/rand"`, `"fmt"` (already present), `"path/filepath"`, `"strings"`, and `"go-service/internal/platform/storage"`.

Replace the `Service` struct and `NewService`:

```go
type Service struct {
	repo       Store
	userRepo   UserStore
	storageSvc *storage.Client
	apiBaseURL string
}

func NewService(repo Store, userRepo UserStore, storageSvc *storage.Client, apiBaseURL string) *Service {
	return &Service{repo: repo, userRepo: userRepo, storageSvc: storageSvc, apiBaseURL: apiBaseURL}
}
```

Add these helpers at the bottom of `service.go` (before the closing brace of the file):

```go
func newPhotoUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x%x%x%x%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func extFromContentType(ct string) string {
	switch strings.ToLower(strings.SplitN(ct, ";", 2)[0]) {
	case "image/png":
		return "png"
	case "image/gif":
		return "gif"
	case "image/webp":
		return "webp"
	default:
		return "jpg"
	}
}

func contentTypeFromFilename(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

func (s *Service) UploadPhoto(ctx context.Context, propertyID int64, wallet string, data []byte, contentType string) (attachID int64, proxyURL string, err error) {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return 0, "", err
	}
	atts, err := s.repo.ListAttachments(propertyID)
	if err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto list: %w", err)
	}
	count := 0
	for _, a := range atts {
		if a.Type == model.AttachmentTypePhoto {
			count++
		}
	}
	if count >= 10 {
		return 0, "", errors.New("已達照片上限（10 張）")
	}
	if s.storageSvc == nil {
		return 0, "", errors.New("photo storage not configured")
	}
	uuid := newPhotoUUID()
	ext := extFromContentType(contentType)
	objectPath := fmt.Sprintf("property/%d/photos/%s.%s", propertyID, uuid, ext)
	if err := s.storageSvc.Upload(ctx, objectPath, data, contentType); err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto upload: %w", err)
	}
	proxyURL = fmt.Sprintf("%s/api/property/%d/photos/%s.%s", s.apiBaseURL, propertyID, uuid, ext)
	id, err := s.AddAttachment(propertyID, wallet, model.AttachmentTypePhoto, proxyURL)
	if err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto add: %w", err)
	}
	return id, proxyURL, nil
}

func (s *Service) DownloadPhoto(ctx context.Context, propertyID int64, filename string) ([]byte, string, error) {
	if s.storageSvc == nil {
		return nil, "", errors.New("photo storage not configured")
	}
	objectPath := fmt.Sprintf("property/%d/photos/%s", propertyID, filename)
	data, err := s.storageSvc.Download(ctx, objectPath)
	if err != nil {
		return nil, "", fmt.Errorf("property: DownloadPhoto: %w", err)
	}
	return data, contentTypeFromFilename(filename), nil
}
```

Also add `"crypto/rand"`, `"path/filepath"`, `"strings"` to the import block.

- [ ] **Step 4: Run test — expect PASS**

```powershell
go test ./internal/modules/property/... -run TestUploadPhoto -v
```

Expected:
```
=== RUN   TestUploadPhoto_RejectsAtLimit
--- PASS: TestUploadPhoto_RejectsAtLimit
=== RUN   TestUploadPhoto_AllowsUnder10
--- PASS: TestUploadPhoto_AllowsUnder10
PASS
```

- [ ] **Step 5: Update `handler.go` — extend APIService interface + add two handlers**

In `go-service/internal/modules/property/handler.go`, add `"context"` and `"io"` to imports.

Replace the `APIService` interface with:

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
}
```

Add two new handler methods at the bottom of `handler.go`:

```go
func (h *Handler) UploadPhoto(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "photo field required"})
		return
	}
	defer file.Close()
	const maxSize = 10 << 20 // 10 MB
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "file too large (max 10 MB)"})
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "read failed"})
		return
	}
	ct := header.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	attachID, proxyURL, err := h.svc.UploadPhoto(c.Request.Context(), id, walletFrom(c), data, ct)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": attachID, "url": proxyURL}})
}

func (h *Handler) ServePhoto(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	filename := c.Param("filename")
	data, ct, err := h.svc.DownloadPhoto(c.Request.Context(), id, filename)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
		return
	}
	c.Data(http.StatusOK, ct, data)
}
```

- [ ] **Step 6: Update `wiring.go` — pass storage + apiBaseURL to property service**

In `go-service/internal/bootstrap/wiring.go`, add `"os"` to imports if not present.

Find the line:
```go
newPropertySvc := propertymod.NewService(newPropertyRepo, userRepo)
```

Replace with:
```go
appPublicURL := os.Getenv("APP_PUBLIC_URL")
if appPublicURL == "" {
    appPublicURL = "http://localhost:8081"
}
newPropertySvc := propertymod.NewService(newPropertyRepo, userRepo, minioClient, appPublicURL)
```

- [ ] **Step 7: Register new routes in `router.go`**

In `go-service/internal/bootstrap/router.go`, inside the `protected` group after the existing property routes:

```go
// Property photo upload (auth required)
protected.POST("/property/:id/attachment/photo", newPropertyHandler.UploadPhoto)
```

And inside the `api` group (no auth), after the existing public routes:

```go
// Property photo serve (public)
api.GET("/property/:id/photos/:filename", newPropertyHandler.ServePhoto)
```

- [ ] **Step 8: Build Go service to verify no compile errors**

```powershell
cd go-service
go build ./...
```

Expected: no output (clean build).

- [ ] **Step 9: Run all property tests**

```powershell
go test ./internal/modules/property/... -v
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```powershell
git add go-service/internal/modules/property/service.go `
        go-service/internal/modules/property/handler.go `
        go-service/internal/modules/property/service_test.go `
        go-service/internal/bootstrap/wiring.go `
        go-service/internal/bootstrap/router.go
git commit -m "feat: add property photo upload and serve endpoints"
```

---

## Task 2: Go — Listing APIs include photo_urls

**Files:**
- Modify: `go-service/internal/modules/rental_listing/dto.go`
- Modify: `go-service/internal/modules/rental_listing/service.go`
- Modify: `go-service/internal/modules/rental_listing/handler.go`
- Modify: `go-service/internal/modules/sale_listing/dto.go`
- Modify: `go-service/internal/modules/sale_listing/service.go`
- Modify: `go-service/internal/modules/sale_listing/handler.go`

No new test file — verification via `go build ./...` and `go test ./...`.

- [ ] **Step 1: Add `PhotoURLs` to `rental_listing/dto.go`**

In `go-service/internal/modules/rental_listing/dto.go`, add one field to `PropertySummaryResponse` (after `WindowOrientation`):

```go
PhotoURLs []string `json:"photo_urls"`
```

- [ ] **Step 2: Extend `PropertyStore` interface in `rental_listing/service.go`**

Find:
```go
type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
}
```

Replace with:
```go
type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}
```

- [ ] **Step 3: Load attachments in `rental_listing/service.go` `ListPublic` and `GetByID`**

Find the existing `ListPublic`:
```go
func (s *Service) ListPublic() ([]*model.RentalListing, error) {
	rls, err := s.repo.ListPublic()
	if err != nil {
		return nil, fmt.Errorf("rental_listing: ListPublic: %w", err)
	}
	for _, rl := range rls {
		prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
		rl.Property = prop
	}
	return rls, nil
}
```

Replace with:
```go
func (s *Service) ListPublic() ([]*model.RentalListing, error) {
	rls, err := s.repo.ListPublic()
	if err != nil {
		return nil, fmt.Errorf("rental_listing: ListPublic: %w", err)
	}
	for _, rl := range rls {
		prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
		if prop != nil {
			atts, _ := s.propertyRepo.ListAttachments(rl.PropertyID)
			prop.Attachments = atts
		}
		rl.Property = prop
	}
	return rls, nil
}
```

Find the existing `GetByID`:
```go
func (s *Service) GetByID(id int64) (*model.RentalListing, error) {
	rl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("rental_listing: GetByID: %w", err)
	}
	if rl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
	rl.Property = prop
	return rl, nil
}
```

Replace with:
```go
func (s *Service) GetByID(id int64) (*model.RentalListing, error) {
	rl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("rental_listing: GetByID: %w", err)
	}
	if rl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(rl.PropertyID)
	if prop != nil {
		atts, _ := s.propertyRepo.ListAttachments(rl.PropertyID)
		prop.Attachments = atts
	}
	rl.Property = prop
	return rl, nil
}
```

- [ ] **Step 4: Populate `PhotoURLs` in `rental_listing/handler.go` `toResponse`**

In the `if rl.Property != nil {` block in `toResponse`, find the line:
```go
		resp.Property = &pResp
```

Insert before it:
```go
		pResp.PhotoURLs = []string{}
		for _, a := range p.Attachments {
			if a.Type == model.AttachmentTypePhoto {
				pResp.PhotoURLs = append(pResp.PhotoURLs, a.URL)
			}
		}
```

- [ ] **Step 5: Add `PhotoURLs` to `sale_listing/dto.go`**

In `go-service/internal/modules/sale_listing/dto.go`, add to `PropertySummaryResponse` (after `UnitsOnFloor`):

```go
PhotoURLs []string `json:"photo_urls"`
```

- [ ] **Step 6: Extend `PropertyStore` interface in `sale_listing/service.go`**

Find:
```go
type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
}
```

Replace with:
```go
type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}
```

- [ ] **Step 7: Load attachments in `sale_listing/service.go` `ListPublic` and `GetByID`**

Find the existing `ListPublic`:
```go
func (s *Service) ListPublic() ([]*model.SaleListing, error) {
	sls, err := s.repo.ListPublic()
	if err != nil {
		return nil, fmt.Errorf("sale_listing: ListPublic: %w", err)
	}
	for _, sl := range sls {
		prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
		sl.Property = prop
	}
	return sls, nil
}
```

Replace with:
```go
func (s *Service) ListPublic() ([]*model.SaleListing, error) {
	sls, err := s.repo.ListPublic()
	if err != nil {
		return nil, fmt.Errorf("sale_listing: ListPublic: %w", err)
	}
	for _, sl := range sls {
		prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
		if prop != nil {
			atts, _ := s.propertyRepo.ListAttachments(sl.PropertyID)
			prop.Attachments = atts
		}
		sl.Property = prop
	}
	return sls, nil
}
```

Find the existing `GetByID`:
```go
func (s *Service) GetByID(id int64) (*model.SaleListing, error) {
	sl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("sale_listing: GetByID: %w", err)
	}
	if sl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
	sl.Property = prop
	return sl, nil
}
```

Replace with:
```go
func (s *Service) GetByID(id int64) (*model.SaleListing, error) {
	sl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("sale_listing: GetByID: %w", err)
	}
	if sl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
	if prop != nil {
		atts, _ := s.propertyRepo.ListAttachments(sl.PropertyID)
		prop.Attachments = atts
	}
	sl.Property = prop
	return sl, nil
}
```

- [ ] **Step 8: Populate `PhotoURLs` in `sale_listing/handler.go` `toResponse`**

In the `if sl.Property != nil {` block in `toResponse`, find the line:
```go
		resp.Property = &pResp
```

Insert before it:
```go
		pResp.PhotoURLs = []string{}
		for _, a := range p.Attachments {
			if a.Type == model.AttachmentTypePhoto {
				pResp.PhotoURLs = append(pResp.PhotoURLs, a.URL)
			}
		}
```

- [ ] **Step 9: Build and test**

```powershell
cd go-service
go build ./...
go test ./...
```

Expected: clean build, all tests PASS.

- [ ] **Step 10: Commit**

```powershell
git add go-service/internal/modules/rental_listing/dto.go `
        go-service/internal/modules/rental_listing/service.go `
        go-service/internal/modules/rental_listing/handler.go `
        go-service/internal/modules/sale_listing/dto.go `
        go-service/internal/modules/sale_listing/service.go `
        go-service/internal/modules/sale_listing/handler.go
git commit -m "feat: include photo_urls in rental and sale listing responses"
```

---

## Task 3: React — PropertyPhotoGallery component

**Files:**
- Create: `react-service/src/components/property/PropertyPhotoGallery.tsx`

- [ ] **Step 1: Create `react-service/src/components/property/` directory and component**

Create `react-service/src/components/property/PropertyPhotoGallery.tsx`:

```tsx
import { useState } from "react";

type Props = {
    photos: string[];
    className?: string;
};

export default function PropertyPhotoGallery({ photos, className = "" }: Props) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    if (photos.length === 0) {
        return (
            <div
                className={`flex items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-lowest ${className}`}
                style={{ height: "320px" }}
            >
                <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl">photo_camera</span>
                    <span className="text-sm">暫無照片</span>
                </div>
            </div>
        );
    }

    const safeIndex = Math.min(selectedIndex, photos.length - 1);

    return (
        <div className={`overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest ${className}`}>
            {/* Hero */}
            <div className="relative w-full overflow-hidden" style={{ height: "420px" }}>
                <img
                    src={photos[safeIndex]}
                    alt={`物件照片 ${safeIndex + 1}`}
                    className="h-full w-full object-cover"
                />
                <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
                    {safeIndex + 1} / {photos.length}
                </div>
            </div>
            {/* Thumbnails */}
            {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto bg-surface-container-low p-3">
                    {photos.map((url, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                                idx === safeIndex
                                    ? "border-primary-container"
                                    : "border-transparent hover:border-outline-variant/40"
                            }`}
                        >
                            <img
                                src={url}
                                alt={`縮圖 ${idx + 1}`}
                                className="h-16 w-24 object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Lint and build**

```powershell
cd react-service
npm run lint
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add react-service/src/components/property/PropertyPhotoGallery.tsx
git commit -m "feat: add PropertyPhotoGallery shared component"
```

---

## Task 4: React — uploadPropertyPhoto API + PropertyPhotoUploader

**Files:**
- Modify: `react-service/src/api/propertyApi.ts`
- Create: `react-service/src/components/property/PropertyPhotoUploader.tsx`

- [ ] **Step 1: Add `uploadPropertyPhoto` to `propertyApi.ts`**

In `react-service/src/api/propertyApi.ts`, add after `deleteAttachment`:

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

- [ ] **Step 2: Create `PropertyPhotoUploader.tsx`**

Create `react-service/src/components/property/PropertyPhotoUploader.tsx`:

```tsx
import { useRef, useState } from "react";
import { deleteAttachment, uploadPropertyPhoto } from "@/api/propertyApi";
import PropertyPhotoGallery from "./PropertyPhotoGallery";

const MAX_PHOTOS = 10;

type Props = {
    propertyId: number;
    photos: string[];
    attachmentIds: number[];
    onUploaded: () => void;
};

export default function PropertyPhotoUploader({ propertyId, photos, attachmentIds, onUploaded }: Props) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const atLimit = photos.length >= MAX_PHOTOS;

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            await uploadPropertyPhoto(propertyId, file);
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "上傳失敗");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleDelete = async (attachmentId: number) => {
        setError("");
        try {
            await deleteAttachment(propertyId, attachmentId);
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "刪除失敗");
        }
    };

    return (
        <div className="space-y-4">
            <PropertyPhotoGallery photos={photos} />

            {/* Thumbnail strip with delete buttons */}
            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {photos.map((url, idx) => (
                        <div key={attachmentIds[idx]} className="relative">
                            <img
                                src={url}
                                alt={`照片 ${idx + 1}`}
                                className="h-16 w-24 rounded-lg object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => void handleDelete(attachmentIds[idx])}
                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs font-bold text-white"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload control */}
            <div>
                {atLimit ? (
                    <p className="text-xs text-on-surface-variant">已達上限（{MAX_PHOTOS} 張）</p>
                ) : (
                    <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface ${uploading ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                        <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                        {uploading ? "上傳中..." : `新增照片（${photos.length} / ${MAX_PHOTOS}）`}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading || atLimit}
                            onChange={(e) => void handleFile(e)}
                        />
                    </label>
                )}
                {error && <p className="mt-2 text-sm text-error">{error}</p>}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Lint and build**

```powershell
npm run lint
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add react-service/src/api/propertyApi.ts `
        react-service/src/components/property/PropertyPhotoUploader.tsx
git commit -m "feat: add uploadPropertyPhoto API and PropertyPhotoUploader component"
```

---

## Task 5: React — PropertyEditPage photo section

**Files:**
- Modify: `react-service/src/pages/PropertyEditPage.tsx`

The existing Section C has a type selector with PHOTO/DEED/FLOOR_PLAN/DISCLOSURE and a URL input. We add a new Section C1 above it for photo file upload, and remove PHOTO from Section C2's dropdown.

- [ ] **Step 1: Add imports to `PropertyEditPage.tsx`**

At the top of `react-service/src/pages/PropertyEditPage.tsx`, add to existing imports:

```typescript
import PropertyPhotoUploader from "@/components/property/PropertyPhotoUploader";
```

- [ ] **Step 2: Derive photo arrays before the return statement**

In `PropertyEditPage`, before the `return (`, add:

```typescript
const photoAttachments = property.attachments.filter((a) => a.type === "PHOTO");
const photoUrls = photoAttachments.map((a) => a.url);
const photoAttachmentIds = photoAttachments.map((a) => a.id);
```

- [ ] **Step 3: Add Section C1 (photo upload) in JSX**

Find the existing Section C opening:
```tsx
<section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
    <h2 className="mb-4 text-lg font-bold text-on-surface">Section C — 可信附件</h2>
    <p className="mb-6 text-xs text-on-surface-variant">至少上傳一張照片後，物件才會變成 READY 狀態並可上架。</p>
```

Insert a new section **before** this entire Section C block:

```tsx
{/* Section C1 — 物件照片 */}
<section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
    <h2 className="mb-1 text-lg font-bold text-on-surface">Section C1 — 物件照片</h2>
    <p className="mb-6 text-xs text-on-surface-variant">最多 10 張。至少上傳一張後物件才會進入 READY 狀態可上架。</p>
    <PropertyPhotoUploader
        propertyId={propertyId}
        photos={photoUrls}
        attachmentIds={photoAttachmentIds}
        onUploaded={reload}
    />
</section>
```

- [ ] **Step 4: Remove PHOTO option from Section C2 type selector**

In the existing Section C, find:
```tsx
<select value={attachType} onChange={(e) => setAttachType(e.target.value as AttachmentType)} className={`${selectCls} md:w-44`}>
    <option value="PHOTO">照片</option>
    <option value="FLOOR_PLAN">格局圖</option>
    <option value="DEED">謄本</option>
    <option value="DISCLOSURE">揭露文件</option>
</select>
```

Replace with:
```tsx
<select value={attachType} onChange={(e) => setAttachType(e.target.value as AttachmentType)} className={`${selectCls} md:w-44`}>
    <option value="FLOOR_PLAN">格局圖</option>
    <option value="DEED">謄本</option>
    <option value="DISCLOSURE">揭露文件</option>
</select>
```

Also update the default value of `attachType` state from `"PHOTO"` to `"FLOOR_PLAN"`. Find:
```typescript
const [attachType, setAttachType] = useState<AttachmentType>("PHOTO");
```
Replace with:
```typescript
const [attachType, setAttachType] = useState<AttachmentType>("FLOOR_PLAN");
```

Also update the Section C title and description to clarify it's for non-photo attachments:
Find:
```tsx
<h2 className="mb-4 text-lg font-bold text-on-surface">Section C — 可信附件</h2>
<p className="mb-6 text-xs text-on-surface-variant">至少上傳一張照片後，物件才會變成 READY 狀態並可上架。</p>
```
Replace with:
```tsx
<h2 className="mb-4 text-lg font-bold text-on-surface">Section C2 — 其他附件</h2>
<p className="mb-6 text-xs text-on-surface-variant">格局圖、謄本、揭露文件等非照片附件請在此新增（以 URL 形式）。</p>
```

- [ ] **Step 5: Lint and build**

```powershell
npm run lint
npm run build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add react-service/src/pages/PropertyEditPage.tsx
git commit -m "feat: add photo upload section to PropertyEditPage"
```

---

## Task 6: React — MyPropertiesPage card thumbnails

**Files:**
- Modify: `react-service/src/pages/MyPropertiesPage.tsx`

`listMyProperties()` returns `Property[]` which already includes `attachments: PropertyAttachment[]` (the service calls `ListAttachments` for each). No backend changes needed.

- [ ] **Step 1: Add thumbnail to property card in `MyPropertiesPage.tsx`**

Find the `<article>` block inside `items.map`:

```tsx
<article
    key={item.id}
    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
    onClick={() => navigate(`/my/properties/${item.id}`)}
>
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
```

Replace the inner `<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">` opening with:

```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    {/* Thumbnail */}
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
```

(The existing `<div>` text section and right section remain unchanged after this insertion.)

- [ ] **Step 2: Lint and build**

```powershell
npm run lint
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add react-service/src/pages/MyPropertiesPage.tsx
git commit -m "feat: add photo thumbnail to MyPropertiesPage property cards"
```

---

## Task 7: React — Listing detail pages show photo gallery

**Files:**
- Modify: `react-service/src/api/rentalListingApi.ts`
- Modify: `react-service/src/api/saleListingApi.ts`
- Modify: `react-service/src/pages/RentDetailPage.tsx`
- Modify: `react-service/src/pages/SaleDetailPage.tsx`

- [ ] **Step 1: Add `photo_urls` to `rentalListingApi.ts` `PropertySummary`**

In `react-service/src/api/rentalListingApi.ts`, inside `type PropertySummary`, add after `window_orientation`:

```typescript
photo_urls?: string[];
```

- [ ] **Step 2: Add `photo_urls` to `saleListingApi.ts` `PropertySummary`**

In `react-service/src/api/saleListingApi.ts`, inside `type PropertySummary`, add after `units_on_floor` (or any existing field at the end):

```typescript
photo_urls?: string[];
```

- [ ] **Step 3: Add gallery to `RentDetailPage.tsx`**

Add import at top of `react-service/src/pages/RentDetailPage.tsx`:
```typescript
import PropertyPhotoGallery from "@/components/property/PropertyPhotoGallery";
```

Find in the JSX (inside the `return`):
```tsx
<Link to="/rent" className="text-sm text-on-surface-variant hover:text-primary">← 出租物件列表</Link>

{/* Hero */}
```

Insert `PropertyPhotoGallery` between the Link and the Hero comment:
```tsx
<Link to="/rent" className="text-sm text-on-surface-variant hover:text-primary">← 出租物件列表</Link>

<PropertyPhotoGallery photos={p?.photo_urls ?? []} />

{/* Hero */}
```

- [ ] **Step 4: Add gallery to `SaleDetailPage.tsx`**

Add import at top of `react-service/src/pages/SaleDetailPage.tsx`:
```typescript
import PropertyPhotoGallery from "@/components/property/PropertyPhotoGallery";
```

Find in the JSX:
```tsx
<Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary">← 出售物件列表</Link>

{/* ── Hero ── */}
```

Insert:
```tsx
<Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary">← 出售物件列表</Link>

<PropertyPhotoGallery photos={p?.photo_urls ?? []} />

{/* ── Hero ── */}
```

- [ ] **Step 5: Lint and build**

```powershell
npm run lint
npm run build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```powershell
git add react-service/src/api/rentalListingApi.ts `
        react-service/src/api/saleListingApi.ts `
        react-service/src/pages/RentDetailPage.tsx `
        react-service/src/pages/SaleDetailPage.tsx
git commit -m "feat: display PropertyPhotoGallery on listing detail pages"
```

---

## Verification Checklist

1. `go test ./...` — all PASS
2. `npm run lint` — 0 errors
3. `npm run build` — 0 errors
4. Upload a JPEG to a property via PropertyEditPage → gallery updates immediately
5. Upload 10 photos → 11th attempt is blocked (input disabled in UI; backend returns 400 if bypassed)
6. Delete a photo → count drops, input re-enables
7. Clicking a thumbnail changes the hero image
8. No photos → grey placeholder with camera icon shown on all pages
9. RentDetailPage and SaleDetailPage show photos from `photo_urls`
10. MyPropertiesPage cards show first photo thumbnail or placeholder
