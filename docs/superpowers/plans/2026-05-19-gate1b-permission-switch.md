# Gate 1B：角色憑證權限切換 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將刊登建立/上架限制從 KYC VERIFIED 切換到 OWNER credential，將預約看房從 KYC VERIFIED 切換到 TENANT credential。

**Architecture:** 後端三個 listing service 各自注入 `CredentialReader` interface 並加 guard helper；handler 補充 403 error case；wiring.go 傳入 `credentialRepo`。前端補 ListingDetailPage 無 TENANT credential 時的 CTA 提示，以及 form 的 403 錯誤訊息。

**Tech Stack:** Go 1.25 + Gin + PostgreSQL；React 19 + TypeScript 5 strict + Tailwind

---

## 前置條件

在開始 Gate 1B 實作前，先完成以下 git 整理：

- [ ] **Commit 目前 branch 上的 uncommitted 變更**

```bash
cd d:/Git/onchain-project
git add go-service/internal/db/repository/rental_listing_repo.go
git add go-service/internal/db/repository/sale_listing_repo.go
git add react-service/src/components/credential/OwnerStep1Form.tsx
git add react-service/src/components/credential/ownerFieldParsers.ts
git add react-service/src/pages/IdentityCenterPage.tsx
git add react-service/src/pages/OwnerCredentialPage.tsx
git add react-service/src/pages/identityCenterViewModel.ts
git add dev_log/2026-05-12.md
git commit -m "feat: owner step1 form section-card redesign; fix identity center property count"
```

- [ ] **開 PR 並合進 main**

```bash
gh pr create --title "feat: property lifecycle, listing forms, owner credential redesign" --body "$(cat <<'EOF'
## Summary
- Property REMOVED/ARCHIVED lifecycle + MyPropertiesPage 4-filter cards
- PropertyListingPage 出租/出售 tab switch
- RentalListingForm / SaleListingForm extracted as reusable components
- Rental listing furniture + nearby fields
- OwnerCredentialPage two-step redesign (DECLARATIONS route)
- Property photo gallery (MinIO)
- Identity center property count fix

## Test plan
- [ ] Go tests pass: `go test ./...`
- [ ] Frontend: `npm run lint && npm run build` 0 errors
EOF
)"
```

- [ ] **從 main 建新 branch 開始 Gate 1B**

```bash
git checkout main && git pull
git checkout -b feat/gate1b-permission-switch
```

---

## File Map

**Modify:**
- `go-service/internal/modules/listing/service.go` — 加 CredentialReader interface、credRepo、guard helpers、error sentinels；替換 Create/Publish/BookAppointment 的 guard
- `go-service/internal/modules/listing/service_test.go` — 更新 NewService 呼叫；加 credential guard 測試
- `go-service/internal/modules/listing/handler.go` — 在 handleSvcError 加 ErrNoOwnerCredential、ErrNoTenantCredential cases
- `go-service/internal/modules/rental_listing/service.go` — 加 CredentialReader interface、credRepo、ErrNoOwnerCredential、requireOwnerCredential；Create/Publish 前插 guard
- `go-service/internal/modules/rental_listing/service_test.go` — 加 credential guard 測試
- `go-service/internal/modules/rental_listing/handler.go` — 在 handleErr 加 ErrNoOwnerCredential case
- `go-service/internal/modules/sale_listing/service.go` — 同 rental_listing 模式
- `go-service/internal/modules/sale_listing/handler.go` — 同 rental_listing 模式

**Create:**
- `go-service/internal/modules/sale_listing/service_test.go` — 新建 credential guard 測試

**Modify (frontend):**
- `go-service/internal/bootstrap/wiring.go` — 三個 listing service NewService() 加 credentialRepo 參數
- `react-service/src/pages/ListingDetailPage.tsx` — 無 TENANT credential 時顯示引導 CTA
- `react-service/src/components/listing/RentalListingForm.tsx` — 403 含憑證訊息時加跳轉連結
- `react-service/src/components/listing/SaleListingForm.tsx` — 同上

---

## Task 1：`modules/listing` — CredentialReader + guard helpers + error sentinels

**Files:**
- Modify: `go-service/internal/modules/listing/service.go`

- [ ] **Step 1：在 `var` block 加兩個新 error sentinel**

在 `service.go` 的 `var(...)` block（現有 `ErrNotFound`、`ErrForbidden`、`ErrInvalidStatus`、`ErrNotKYCVerified`、`ErrAlreadyBooked`、`ErrDurationTooShort` 之後）加入：

```go
ErrNoOwnerCredential  = errors.New("需要屋主身份憑證才能操作")
ErrNoTenantCredential = errors.New("需要租客身份憑證才能預約")
```

- [ ] **Step 2：在 interface 區塊之後加 `CredentialReader` interface**

緊接在 `type CustomerReader interface { ... }` 之後加：

```go
type CredentialReader interface {
    FindByUserAndType(userID int64, credType string) (*model.UserCredential, error)
}
```

- [ ] **Step 3：在 `Service` struct 加 `credRepo` 欄位**

將 `Service` struct 從：
```go
type Service struct {
    listingRepo  ListingStore
    apptRepo     AppointmentStore
    userRepo     UserStore
    customerRepo CustomerReader
}
```
改為：
```go
type Service struct {
    listingRepo  ListingStore
    apptRepo     AppointmentStore
    userRepo     UserStore
    customerRepo CustomerReader
    credRepo     CredentialReader
}
```

- [ ] **Step 4：更新 `NewService()` 簽名**

將：
```go
func NewService(
    listingRepo ListingStore,
    apptRepo AppointmentStore,
    userRepo UserStore,
    customerRepo CustomerReader,
) *Service {
    return &Service{
        listingRepo:  listingRepo,
        apptRepo:     apptRepo,
        userRepo:     userRepo,
        customerRepo: customerRepo,
    }
}
```
改為：
```go
func NewService(
    listingRepo ListingStore,
    apptRepo AppointmentStore,
    userRepo UserStore,
    customerRepo CustomerReader,
    credRepo CredentialReader,
) *Service {
    return &Service{
        listingRepo:  listingRepo,
        apptRepo:     apptRepo,
        userRepo:     userRepo,
        customerRepo: customerRepo,
        credRepo:     credRepo,
    }
}
```

- [ ] **Step 5：在 `requireUser` 之後加兩個 guard helpers**

緊接在 `func (s *Service) requireUser(...)` 之後加：

```go
func (s *Service) requireOwnerCredential(wallet string) (*model.User, error) {
    user, err := s.requireUser(wallet)
    if err != nil {
        return nil, err
    }
    cred, err := s.credRepo.FindByUserAndType(user.ID, model.CredentialTypeOwner)
    if err != nil {
        return nil, fmt.Errorf("listing: check owner credential: %w", err)
    }
    if cred == nil {
        return nil, ErrNoOwnerCredential
    }
    return user, nil
}

func (s *Service) requireTenantCredential(wallet string) (*model.User, error) {
    user, err := s.requireUser(wallet)
    if err != nil {
        return nil, err
    }
    cred, err := s.credRepo.FindByUserAndType(user.ID, model.CredentialTypeTenant)
    if err != nil {
        return nil, fmt.Errorf("listing: check tenant credential: %w", err)
    }
    if cred == nil {
        return nil, ErrNoTenantCredential
    }
    return user, nil
}
```

- [ ] **Step 6：`Create()` — 替換 guard**

找到：
```go
func (s *Service) Create(walletAddress string, req CreateListingRequest) (int64, error) {
    owner, err := s.requireVerifiedUser(walletAddress)
```
改為：
```go
func (s *Service) Create(walletAddress string, req CreateListingRequest) (int64, error) {
    owner, err := s.requireOwnerCredential(walletAddress)
```

- [ ] **Step 7：`Publish()` — 替換 guard**

找到：
```go
func (s *Service) Publish(listingID int64, walletAddress string, durationDays int) error {
    caller, err := s.requireUser(walletAddress)
```
改為：
```go
func (s *Service) Publish(listingID int64, walletAddress string, durationDays int) error {
    caller, err := s.requireOwnerCredential(walletAddress)
```

- [ ] **Step 8：`BookAppointment()` — 替換 guard**

找到：
```go
func (s *Service) BookAppointment(listingID int64, walletAddress string, req CreateAppointmentRequest) (int64, error) {
    visitor, err := s.requireVerifiedUser(walletAddress)
```
改為：
```go
func (s *Service) BookAppointment(listingID int64, walletAddress string, req CreateAppointmentRequest) (int64, error) {
    visitor, err := s.requireTenantCredential(walletAddress)
```

- [ ] **Step 9：確認 build**

```bash
cd d:/Git/onchain-project/go-service && docker compose up --build -d
```

Expected：build 成功，container running。

---

## Task 2：`modules/listing` service_test.go — 更新 + 新增測試

**Files:**
- Modify: `go-service/internal/modules/listing/service_test.go`

- [ ] **Step 1：加 `fakeCredRepo` mock 到 service_test.go 頂部**

在現有 fake stores 之後（`fakeListingUserStore` 之後）加：

```go
type fakeCredRepo struct{ cred *model.UserCredential }

func (f *fakeCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
    return f.cred, nil
}
```

- [ ] **Step 2：修正現有測試中所有 `NewService()` 呼叫**

全文搜尋 `NewService(listings, &fakeApptStore{}, &fakeListingUserStore{` 並在結尾加 `, &fakeCredRepo{cred: &model.UserCredential{}}`，使現有測試繼續編譯。

範例（`TestListPublicNormalizesMultiDistrictFilters`）：
```go
svc := NewService(listings, &fakeApptStore{}, &fakeListingUserStore{}, nil, &fakeCredRepo{cred: &model.UserCredential{}})
```

- [ ] **Step 3：新增 `TestCreateRequiresOwnerCredential`**

```go
func TestCreateRequiresOwnerCredential(t *testing.T) {
    listings := &fakeListingStore{}
    users := &fakeListingUserStore{byWallet: map[string]*model.User{
        "0xowner": {ID: 1, KYCStatus: model.KYCStatusVerified},
    }}

    t.Run("no credential → ErrNoOwnerCredential", func(t *testing.T) {
        svc := NewService(listings, &fakeApptStore{}, users, nil, &fakeCredRepo{cred: nil})
        _, err := svc.Create("0xowner", CreateListingRequest{
            Title: "Test", Address: "Test St", ListType: "RENT", Price: 20000,
        })
        if !errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("want ErrNoOwnerCredential, got %v", err)
        }
    })

    t.Run("has credential → proceeds past guard", func(t *testing.T) {
        svc := NewService(listings, &fakeApptStore{}, users, nil, &fakeCredRepo{cred: &model.UserCredential{}})
        // repo.Create returns 0, nil so we just check no credential error
        _, err := svc.Create("0xowner", CreateListingRequest{
            Title: "Test", Address: "Test St", ListType: "RENT", Price: 20000,
        })
        if errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("should not get ErrNoOwnerCredential when credential present")
        }
    })
}
```

- [ ] **Step 4：新增 `TestBookAppointmentRequiresTenantCredential`**

```go
func TestBookAppointmentRequiresTenantCredential(t *testing.T) {
    listing := &model.Listing{ID: 10, OwnerUserID: 99, Status: model.ListingStatusActive}
    listings := &fakeListingStore{byID: map[int64]*model.Listing{10: listing}}
    users := &fakeListingUserStore{byWallet: map[string]*model.User{
        "0xtenant": {ID: 2, KYCStatus: model.KYCStatusVerified},
    }}

    t.Run("no credential → ErrNoTenantCredential", func(t *testing.T) {
        svc := NewService(listings, &fakeApptStore{}, users, nil, &fakeCredRepo{cred: nil})
        _, err := svc.BookAppointment(10, "0xtenant", CreateAppointmentRequest{
            PreferredTime: time.Now().Add(24 * time.Hour),
        })
        if !errors.Is(err, ErrNoTenantCredential) {
            t.Errorf("want ErrNoTenantCredential, got %v", err)
        }
    })

    t.Run("has credential → proceeds past guard", func(t *testing.T) {
        svc := NewService(listings, &fakeApptStore{}, users, nil, &fakeCredRepo{cred: &model.UserCredential{}})
        _, err := svc.BookAppointment(10, "0xtenant", CreateAppointmentRequest{
            PreferredTime: time.Now().Add(24 * time.Hour),
        })
        if errors.Is(err, ErrNoTenantCredential) {
            t.Errorf("should not get ErrNoTenantCredential when credential present")
        }
    })
}
```

- [ ] **Step 5：跑測試確認全綠**

```bash
cd d:/Git/onchain-project/go-service && go test ./internal/modules/listing/... -v -run "TestCreate|TestBookAppointment|TestListPublic|TestUpdateRent"
```

Expected：所有測試 PASS。

- [ ] **Step 6：Commit**

```bash
git add go-service/internal/modules/listing/service.go go-service/internal/modules/listing/service_test.go
git commit -m "feat: listing service — require OWNER/TENANT credential for Create/Publish/BookAppointment"
```

---

## Task 3：`modules/listing` handler — 補充 error case

**Files:**
- Modify: `go-service/internal/modules/listing/handler.go`

- [ ] **Step 1：在 `handleSvcError` 加兩個新 case**

找到 `handleSvcError` 函式中的 `case errors.Is(err, ErrNotKYCVerified):` 這一行，在它之後加：

```go
case errors.Is(err, ErrNoOwnerCredential):
    c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
case errors.Is(err, ErrNoTenantCredential):
    c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
```

- [ ] **Step 2：確認 build**

```bash
cd d:/Git/onchain-project/go-service && go build ./...
```

Expected：0 errors。

- [ ] **Step 3：Commit**

```bash
git add go-service/internal/modules/listing/handler.go
git commit -m "feat: listing handler — map ErrNoOwnerCredential/ErrNoTenantCredential to 403"
```

---

## Task 4：`modules/rental_listing` — CredentialReader + guard + error sentinel

**Files:**
- Modify: `go-service/internal/modules/rental_listing/service.go`

- [ ] **Step 1：加 `CredentialReader` interface**

在 `type UserStore interface { ... }` 之後加：

```go
type CredentialReader interface {
    FindByUserAndType(userID int64, credType string) (*model.UserCredential, error)
}
```

- [ ] **Step 2：加 `ErrNoOwnerCredential` error sentinel**

在 `var(...)` block 加：

```go
ErrNoOwnerCredential = errors.New("需要屋主身份憑證才能操作")
```

（與現有 `ErrNotFound`、`ErrForbidden`、`ErrPropertyNotReady` 並列）

- [ ] **Step 3：在 `Service` struct 加 `credRepo`**

將：
```go
type Service struct {
    repo         Store
    propertyRepo PropertyStore
    userRepo     UserStore
}
```
改為：
```go
type Service struct {
    repo         Store
    propertyRepo PropertyStore
    userRepo     UserStore
    credRepo     CredentialReader
}
```

- [ ] **Step 4：更新 `NewService()` 簽名**

將：
```go
func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore) *Service {
    return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo}
}
```
改為：
```go
func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore, credRepo CredentialReader) *Service {
    return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo, credRepo: credRepo}
}
```

- [ ] **Step 5：在 `assertOwnsProperty` 之前加 `requireOwnerCredential` helper**

在 `func (s *Service) assertOwnsProperty(...)` 之前加：

```go
func (s *Service) requireOwnerCredential(wallet string) (*model.User, error) {
    user, err := s.userRepo.FindByWallet(wallet)
    if err != nil || user == nil {
        return nil, ErrForbidden
    }
    cred, err := s.credRepo.FindByUserAndType(user.ID, model.CredentialTypeOwner)
    if err != nil {
        return nil, fmt.Errorf("rental_listing: check owner credential: %w", err)
    }
    if cred == nil {
        return nil, ErrNoOwnerCredential
    }
    return user, nil
}
```

- [ ] **Step 6：`Create()` — 在最前面插入 credential guard**

找到：
```go
func (s *Service) Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error) {
    if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
        return 0, err
    }
```
改為：
```go
func (s *Service) Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error) {
    if _, err := s.requireOwnerCredential(wallet); err != nil {
        return 0, err
    }
    if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
        return 0, err
    }
```

- [ ] **Step 7：`Publish()` — 在最前面插入 credential guard**

找到：
```go
func (s *Service) Publish(id int64, wallet string, durationDays int) error {
    rl, err := s.repo.FindByID(id)
```
改為：
```go
func (s *Service) Publish(id int64, wallet string, durationDays int) error {
    if _, err := s.requireOwnerCredential(wallet); err != nil {
        return err
    }
    rl, err := s.repo.FindByID(id)
```

- [ ] **Step 8：確認 build**

```bash
cd d:/Git/onchain-project/go-service && go build ./...
```

Expected：0 errors。

---

## Task 5：`modules/rental_listing` service_test.go — credential guard 測試

**Files:**
- Modify: `go-service/internal/modules/rental_listing/service_test.go`

- [ ] **Step 1：在測試檔加 fake stores 和新測試**

在現有測試之後加：

```go
// ── Credential guard tests ────────────────────────────────────────────────────

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(_ string) (*model.User, error) { return m.user, nil }

type mockCredRepo struct{ cred *model.UserCredential }

func (m *mockCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
    return m.cred, nil
}

type stubRentalStore struct{}

func (s *stubRentalStore) Create(_ *model.RentalListing) (int64, error)            { return 1, nil }
func (s *stubRentalStore) FindByID(_ int64) (*model.RentalListing, error)          { return nil, nil }
func (s *stubRentalStore) FindActiveByProperty(_ int64) (*model.RentalListing, error) { return nil, nil }
func (s *stubRentalStore) ListPublic() ([]*model.RentalListing, error)             { return nil, nil }
func (s *stubRentalStore) Update(_ *model.RentalListing) error                     { return nil }
func (s *stubRentalStore) SetStatus(_ int64, _ string) error                       { return nil }
func (s *stubRentalStore) Publish(_ int64, _ int) error                            { return nil }

type stubPropertyStore struct{}

func (s *stubPropertyStore) FindByID(_ int64) (*model.Property, error) {
    return &model.Property{SetupStatus: model.PropertySetupReady}, nil
}
func (s *stubPropertyStore) ListAttachments(_ int64) ([]*model.PropertyAttachment, error) {
    return nil, nil
}

func TestRentalCreateRequiresOwnerCredential(t *testing.T) {
    user := &model.User{ID: 1}

    t.Run("no credential → ErrNoOwnerCredential", func(t *testing.T) {
        svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
        _, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
        if !errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("want ErrNoOwnerCredential, got %v", err)
        }
    })

    t.Run("has credential → credential check passes", func(t *testing.T) {
        // property owner check will fail (user.ID != prop.OwnerUserID) but credential check should pass
        svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: &model.UserCredential{}})
        _, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
        if errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("should not get ErrNoOwnerCredential when credential present, got %v", err)
        }
    })
}

func TestRentalCredentialCheckBeforePropertyOwnerCheck(t *testing.T) {
    // Proves fail-fast: credential checked before property ownership
    user := &model.User{ID: 1}
    svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
    _, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
    // Must be credential error, not forbidden (which would come from property check)
    if !errors.Is(err, ErrNoOwnerCredential) {
        t.Errorf("credential check must fire before property owner check; got %v", err)
    }
}
```

- [ ] **Step 2：跑測試確認全綠**

```bash
cd d:/Git/onchain-project/go-service && go test ./internal/modules/rental_listing/... -v
```

Expected：所有測試 PASS。

- [ ] **Step 3：Commit**

```bash
git add go-service/internal/modules/rental_listing/service.go go-service/internal/modules/rental_listing/service_test.go
git commit -m "feat: rental_listing service — require OWNER credential for Create/Publish"
```

---

## Task 6：`modules/rental_listing` handler — 補充 error case

**Files:**
- Modify: `go-service/internal/modules/rental_listing/handler.go`

- [ ] **Step 1：在 `handleErr` 加 `ErrNoOwnerCredential` case**

找到：
```go
func handleErr(c *gin.Context, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrForbidden):
        c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrPropertyNotReady):
        c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
    default:
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
    }
}
```
改為：
```go
func handleErr(c *gin.Context, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrForbidden):
        c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrNoOwnerCredential):
        c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
    case errors.Is(err, ErrPropertyNotReady):
        c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
    default:
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
    }
}
```

- [ ] **Step 2：Commit**

```bash
git add go-service/internal/modules/rental_listing/handler.go
git commit -m "feat: rental_listing handler — map ErrNoOwnerCredential to 403"
```

---

## Task 7：`modules/sale_listing` — CredentialReader + guard + error sentinel + test

**Files:**
- Modify: `go-service/internal/modules/sale_listing/service.go`
- Modify: `go-service/internal/modules/sale_listing/handler.go`
- Create: `go-service/internal/modules/sale_listing/service_test.go`

`sale_listing` 的模式與 `rental_listing` 完全相同。

- [ ] **Step 1：`service.go` — 加 CredentialReader interface**

在 `type UserStore interface { ... }` 之後加：

```go
type CredentialReader interface {
    FindByUserAndType(userID int64, credType string) (*model.UserCredential, error)
}
```

- [ ] **Step 2：`service.go` — 加 ErrNoOwnerCredential**

在 `var(...)` block 加：

```go
ErrNoOwnerCredential = errors.New("需要屋主身份憑證才能操作")
```

- [ ] **Step 3：`service.go` — 更新 Service struct + NewService()**

將：
```go
type Service struct {
    repo         Store
    propertyRepo PropertyStore
    userRepo     UserStore
}

func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore) *Service {
    return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo}
}
```
改為：
```go
type Service struct {
    repo         Store
    propertyRepo PropertyStore
    userRepo     UserStore
    credRepo     CredentialReader
}

func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore, credRepo CredentialReader) *Service {
    return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo, credRepo: credRepo}
}
```

- [ ] **Step 4：`service.go` — 加 `requireOwnerCredential` helper**

在 `func (s *Service) assertOwnsProperty(...)` 之前加：

```go
func (s *Service) requireOwnerCredential(wallet string) (*model.User, error) {
    user, err := s.userRepo.FindByWallet(wallet)
    if err != nil || user == nil {
        return nil, ErrForbidden
    }
    cred, err := s.credRepo.FindByUserAndType(user.ID, model.CredentialTypeOwner)
    if err != nil {
        return nil, fmt.Errorf("sale_listing: check owner credential: %w", err)
    }
    if cred == nil {
        return nil, ErrNoOwnerCredential
    }
    return user, nil
}
```

- [ ] **Step 5：`service.go` — `Create()` + `Publish()` 前插 guard**

`Create()` 找到：
```go
func (s *Service) Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error) {
    if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
```
改為：
```go
func (s *Service) Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error) {
    if _, err := s.requireOwnerCredential(wallet); err != nil {
        return 0, err
    }
    if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
```

`Publish()` 找到：
```go
func (s *Service) Publish(id int64, wallet string, durationDays int) error {
    rl, err := s.repo.FindByID(id)
```
改為：
```go
func (s *Service) Publish(id int64, wallet string, durationDays int) error {
    if _, err := s.requireOwnerCredential(wallet); err != nil {
        return err
    }
    rl, err := s.repo.FindByID(id)
```

- [ ] **Step 6：`handler.go` — 在 `handleErr` 加 `ErrNoOwnerCredential` case**

找到 `handleErr` 的 `case errors.Is(err, ErrForbidden):` 之後加：

```go
case errors.Is(err, ErrNoOwnerCredential):
    c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
```

- [ ] **Step 7：建立 `service_test.go`**

新建 `go-service/internal/modules/sale_listing/service_test.go`：

```go
package sale_listing

import (
    "errors"
    "testing"

    "go-service/internal/db/model"
)

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(_ string) (*model.User, error) { return m.user, nil }

type mockCredRepo struct{ cred *model.UserCredential }

func (m *mockCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
    return m.cred, nil
}

type stubSaleStore struct{}

func (s *stubSaleStore) Create(_ int64, _ float64, _ int) (int64, error)           { return 1, nil }
func (s *stubSaleStore) FindByID(_ int64) (*model.SaleListing, error)              { return nil, nil }
func (s *stubSaleStore) FindActiveByProperty(_ int64) (*model.SaleListing, error)  { return nil, nil }
func (s *stubSaleStore) ListPublic() ([]*model.SaleListing, error)                 { return nil, nil }
func (s *stubSaleStore) Update(_ *model.SaleListing) error                         { return nil }
func (s *stubSaleStore) SetStatus(_ int64, _ string) error                         { return nil }
func (s *stubSaleStore) Publish(_ int64, _ int) error                              { return nil }

type stubPropertyStore struct{}

func (s *stubPropertyStore) FindByID(_ int64) (*model.Property, error) {
    return &model.Property{SetupStatus: model.PropertySetupReady}, nil
}
func (s *stubPropertyStore) ListAttachments(_ int64) ([]*model.PropertyAttachment, error) {
    return nil, nil
}

func TestSaleCreateRequiresOwnerCredential(t *testing.T) {
    user := &model.User{ID: 1}

    t.Run("no credential → ErrNoOwnerCredential", func(t *testing.T) {
        svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
        _, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
        if !errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("want ErrNoOwnerCredential, got %v", err)
        }
    })

    t.Run("has credential → credential check passes", func(t *testing.T) {
        svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: &model.UserCredential{}})
        _, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
        if errors.Is(err, ErrNoOwnerCredential) {
            t.Errorf("should not get ErrNoOwnerCredential when credential present, got %v", err)
        }
    })
}

func TestSaleCredentialCheckBeforePropertyOwnerCheck(t *testing.T) {
    user := &model.User{ID: 1}
    svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
    _, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
    if !errors.Is(err, ErrNoOwnerCredential) {
        t.Errorf("credential check must fire before property owner check; got %v", err)
    }
}
```

- [ ] **Step 8：跑測試確認全綠**

```bash
cd d:/Git/onchain-project/go-service && go test ./internal/modules/sale_listing/... -v
```

Expected：所有測試 PASS。

- [ ] **Step 9：Commit**

```bash
git add go-service/internal/modules/sale_listing/service.go \
        go-service/internal/modules/sale_listing/handler.go \
        go-service/internal/modules/sale_listing/service_test.go
git commit -m "feat: sale_listing service/handler — require OWNER credential for Create/Publish"
```

---

## Task 8：Bootstrap Wiring — 注入 credentialRepo

**Files:**
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1：更新 `listingSvc` 的 `NewService()` 呼叫**

找到（wiring.go 約 228 行）：
```go
listingSvc := listingmod.NewService(listingRepo, apptRepo, userRepo, propertyRepo)
```
改為：
```go
listingSvc := listingmod.NewService(listingRepo, apptRepo, userRepo, propertyRepo, credentialRepo)
```

- [ ] **Step 2：更新 `rentalListingSvc` 的 `NewService()` 呼叫**

找到（約 259 行）：
```go
rentalListingSvc := rentallistingmod.NewService(rentalListingRepo, newPropertyRepo, userRepo)
```
改為：
```go
rentalListingSvc := rentallistingmod.NewService(rentalListingRepo, newPropertyRepo, userRepo, credentialRepo)
```

- [ ] **Step 3：更新 `saleListingSvc` 的 `NewService()` 呼叫**

找到（約 262 行）：
```go
saleListingSvc := salelistingmod.NewService(saleListingRepo, newPropertyRepo, userRepo)
```
改為：
```go
saleListingSvc := salelistingmod.NewService(saleListingRepo, newPropertyRepo, userRepo, credentialRepo)
```

- [ ] **Step 4：完整 build + 全部 Go 測試**

```bash
cd d:/Git/onchain-project/go-service && docker compose up --build -d
go test ./internal/modules/listing/... ./internal/modules/rental_listing/... ./internal/modules/sale_listing/... -v
```

Expected：docker build 成功；所有測試 PASS。

- [ ] **Step 5：Commit**

```bash
git add go-service/internal/bootstrap/wiring.go
git commit -m "feat: wiring — inject credentialRepo into listing/rental_listing/sale_listing services"
```

---

## Task 9：前端 — ListingDetailPage 無 TENANT credential CTA

**Files:**
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

目前當 `canBook = false`（含 `!hasRole("TENANT")`）時只顯示「目前無法預約此物件。」純文字。Gate 1B 改為：若使用者已登入、未擁有 TENANT credential、且 listing 是 ACTIVE，就顯示帶連結的引導訊息。

- [ ] **Step 1：找到目前 `!canBook` 的 render 區塊**

搜尋這一行：
```tsx
{!canBook ? <p className="text-center text-sm text-on-surface-variant">目前無法預約此物件。</p> : null}
```

將它改為：

```tsx
{!canBook && !isOwner && listing.status === "ACTIVE" && isAuthenticated ? (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-center">
        <p className="text-sm text-on-surface-variant">預約看房需要租客身份憑證。</p>
        <button
            type="button"
            onClick={() => navigate("/credential/tenant")}
            className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
        >
            前往取得租客身份 →
        </button>
    </div>
) : !canBook ? (
    <p className="text-center text-sm text-on-surface-variant">目前無法預約此物件。</p>
) : null}
```

- [ ] **Step 2：確認 `navigate` 已 import**

檢查頁面頂部是否已有 `import { ..., useNavigate } from "react-router-dom";` 和 `const navigate = useNavigate();`。若無，加上。

- [ ] **Step 3：確認 `isAuthenticated` state 可用**

檢查頁面中的 `isAuthenticated` state（應是從 `getAuthMe()` 取得的 `authenticated` 欄位）。若變數名稱不同，使用現有的正確變數名稱。

- [ ] **Step 4：lint + build**

```bash
cd d:/Git/onchain-project/react-service && npm run lint && npm run build
```

Expected：0 errors。

- [ ] **Step 5：Commit**

```bash
git add react-service/src/pages/ListingDetailPage.tsx
git commit -m "feat: ListingDetailPage — show TENANT credential CTA when canBook is false"
```

---

## Task 10：前端 — RentalListingForm / SaleListingForm 403 錯誤訊息

**Files:**
- Modify: `react-service/src/components/listing/RentalListingForm.tsx`
- Modify: `react-service/src/components/listing/SaleListingForm.tsx`

- [ ] **Step 1：`RentalListingForm.tsx` — 加 Link import + 更新錯誤區塊**

在 imports 頂部加（若未有）：
```tsx
import { Link } from "react-router-dom";
```

找到現有的錯誤訊息 render（`msg.err` 那一行）：
```tsx
{msg.err ? <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{msg.err}</p> : null}
```
改為：
```tsx
{msg.err ? (
    <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">
        {msg.err}
        {msg.err.includes("憑證") && (
            <Link to="/credential/owner" className="ml-2 underline">前往取得屋主身份 →</Link>
        )}
    </p>
) : null}
```

- [ ] **Step 2：`SaleListingForm.tsx` — 相同改動**

找到 `SaleListingForm.tsx` 中相同的錯誤訊息 render，做相同替換（加 Link import + 更新 msg.err 區塊）。

- [ ] **Step 3：lint + build**

```bash
cd d:/Git/onchain-project/react-service && npm run lint && npm run build
```

Expected：0 errors。

- [ ] **Step 4：Commit**

```bash
git add react-service/src/components/listing/RentalListingForm.tsx \
        react-service/src/components/listing/SaleListingForm.tsx
git commit -m "feat: listing forms — show credential CTA on 403 error"
```

---

## Task 11：最終驗收

- [ ] **Go 全測試**

```bash
cd d:/Git/onchain-project/go-service && go test ./internal/modules/listing/... ./internal/modules/rental_listing/... ./internal/modules/sale_listing/... -v
```

Expected：全部 PASS，0 failures。

- [ ] **Frontend lint + build**

```bash
cd d:/Git/onchain-project/react-service && npm run lint && npm run build
```

Expected：0 errors。

- [ ] **驗收清單手動確認**

| 項目 | 驗收方式 |
|---|---|
| `listing.Create` 無 OWNER credential → 403 | `curl -X POST /api/listings` 無 credential cookie → 403 |
| `rental_listing.Create` 無 OWNER credential → 403 | `curl -X POST /api/rental_listings/property/:id` → 403 |
| `sale_listing.Create` 無 OWNER credential → 403 | `curl -X POST /api/sale_listings/property/:id` → 403 |
| `listing.BookAppointment` 無 TENANT credential → 403 | `curl -X POST /api/listings/:id/appointments` → 403 |
| ListingDetailPage 無 TENANT → CTA 顯示 | 登入無 TENANT 角色的帳號，進 ACTIVE listing，看到「前往取得租客身份 →」按鈕 |
| 有 TENANT → 正常預約按鈕 | 登入有 TENANT 角色的帳號，按鈕為「預約看房」 |

- [ ] **開 PR**

```bash
gh pr create --title "feat: Gate 1B — require OWNER/TENANT credential for listing and appointment" --body "$(cat <<'EOF'
## Summary
- listing.Create / Publish now require OWNER credential (was KYC VERIFIED)
- listing.BookAppointment now requires TENANT credential (was KYC VERIFIED)
- rental_listing.Create / Publish require OWNER credential
- sale_listing.Create / Publish require OWNER credential
- ListingDetailPage shows TENANT credential CTA when canBook=false
- RentalListingForm / SaleListingForm show credential link on 403

## Test plan
- [ ] `go test ./internal/modules/listing/... ./internal/modules/rental_listing/... ./internal/modules/sale_listing/...` all PASS
- [ ] `npm run lint && npm run build` 0 errors
- [ ] Manual: listing API with no credential → 403
- [ ] Manual: ListingDetailPage without TENANT credential → CTA shown
EOF
)"
```
