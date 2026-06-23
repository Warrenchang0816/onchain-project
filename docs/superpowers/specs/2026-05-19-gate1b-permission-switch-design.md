# Gate 1B：角色憑證權限切換 設計

**Goal:** 將刊登與預約的存取控制從 KYC VERIFIED 切換到角色憑證（OWNER / TENANT），完成 Gate 1B 正式交付。

**Architecture:** 後端三個 listing service 注入 `CredentialReader` 介面並加 guard helper；前端路由層已到位，補齊預約按鈕的 inline role check 與 403 錯誤訊息。

**Tech Stack:** Go 1.25 + Gin + PostgreSQL（後端）；React 19 + TypeScript 5 strict + Tailwind（前端）

---

## 一、權限矩陣

| 操作 | 目前 guard | Gate 1B guard |
|---|---|---|
| `listing.Create` | KYC VERIFIED | **OWNER credential** |
| `listing.Publish` | `requireUser`（僅登入）| **OWNER credential** |
| `rental_listing.Create` | `assertOwnsProperty`（無 credential 檢查）| **OWNER credential** |
| `rental_listing.Publish` | `assertOwnsProperty` | **OWNER credential** |
| `sale_listing.Create` | `assertOwnsProperty` | **OWNER credential** |
| `sale_listing.Publish` | `assertOwnsProperty` | **OWNER credential** |
| `listing.BookAppointment` | KYC VERIFIED | **TENANT credential** |
| AGENT 相關操作 | KYC VERIFIED | 維持 KYC（Gate 3 才做完整 AGENT 授權）|

**AGENT 範圍說明：** Gate 1B 不新增 AGENT 特定 API gate。仲介代理屋主刊登的完整授權流程屬 Gate 3，Gate 1B 只確保 OWNER / TENANT 路徑正確切換。

---

## 二、後端實作

### 2.1 共用介面 `CredentialReader`

三個 listing 相關 service package 各自定義（不共用，避免跨模組依賴）：

```go
type CredentialReader interface {
    FindByUserAndType(userID int64, credType string) (*model.UserCredential, error)
}
```

底層實作：既有的 `UserCredentialRepository.FindByUserAndType()`（`go-service/internal/db/repository/user_credential_repo.go`）。回傳非 nil 代表使用者有 active、未撤銷的該角色憑證。

### 2.2 `modules/listing`

**修改 `Service` struct：**
```go
type Service struct {
    listingRepo  ListingStore
    apptRepo     AppointmentStore
    userRepo     UserStore
    customerRepo CustomerReader
    credRepo     CredentialReader   // ← 新增
}
```

**修改 `NewService()`：** 加入 `credRepo CredentialReader` 參數。

**新增錯誤常數（與既有 `ErrNotFound` 等並列）：**
```go
ErrNoOwnerCredential  = errors.New("需要屋主身份憑證才能操作")
ErrNoTenantCredential = errors.New("需要租客身份憑證才能預約")
```

**新增 guard helpers（private）：**
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

**Guard 替換：**
- `Create()`：`requireVerifiedUser(wallet)` → `requireOwnerCredential(wallet)`
- `Publish()`：`requireUser(wallet)` → `requireOwnerCredential(wallet)`
- `BookAppointment()`：`requireVerifiedUser(wallet)` → `requireTenantCredential(wallet)`

**Handler 錯誤映射（`handler.go` 的 `respondError` 或等效 switch）：**
```go
case errors.Is(err, ErrNoOwnerCredential):
    c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
case errors.Is(err, ErrNoTenantCredential):
    c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
```

### 2.3 `modules/rental_listing`

**修改 `Service` struct：**
```go
type Service struct {
    repo         Store
    propertyRepo PropertyStore
    userRepo     UserStore
    credRepo     CredentialReader   // ← 新增
}
```

**修改 `NewService()`：** 加入 `credRepo CredentialReader` 參數。

**新增錯誤常數：**
```go
ErrNoOwnerCredential = errors.New("需要屋主身份憑證才能操作")
```

**新增 guard helper：**
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

**Guard 插入（在 `assertOwnsProperty` 之前 fail fast）：**
- `Create()`：最前面先呼叫 `requireOwnerCredential(wallet)`
- `Publish()`：最前面先呼叫 `requireOwnerCredential(wallet)`
- `Update()` / `Close()`：維持現有 `assertOwnsProperty()`（已持有刊登者不需再驗角色）

**Handler 錯誤映射（`handler.go`）：**
```go
case errors.Is(err, ErrNoOwnerCredential):
    c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
```

### 2.4 `modules/sale_listing`

模式完全與 `rental_listing` 相同：加 `credRepo`、`requireOwnerCredential`、`ErrNoOwnerCredential`，在 `Create()` 和 `Publish()` 前插入 guard。

### 2.5 Bootstrap Wiring（`go-service/internal/bootstrap/wiring.go`）

三個 service 的 `NewService()` 呼叫，統一加入 `userCredentialRepo` 作為 `credRepo` 參數。`UserCredentialRepository` 已存在，直接注入。

---

## 三、前端實作

### 3.1 路由層（已完成，無需修改）

以下路由已包 `RequireCredential("OWNER")`，Gate 1B 不需改動：
- `/my/properties/:id/listing`
- `/my/properties/:id/rent`
- `/my/properties/:id/sale`
- `/my/listings/:id`（legacy）

### 3.2 `RentDetailPage.tsx` + `SaleDetailPage.tsx`：預約看房按鈕

這兩頁是 `RequireAuth`（登入即可），需在按鈕層做 TENANT role check：

```tsx
const { hasRole } = useIdentity();

// 條件渲染：
{hasRole("TENANT") ? (
    <button onClick={handleBook} ...>預約看房</button>
) : (
    <button onClick={() => navigate("/credential/tenant")} ...>
        取得租客身份後可預約
    </button>
)}
```

### 3.3 `RentalListingForm.tsx` + `SaleListingForm.tsx`：403 錯誤訊息

API 回 403 時，識別 credential 問題並顯示帶連結的錯誤訊息（路由已保護，此為防禦層）：

```tsx
{msg.err && (
    <p className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">
        {msg.err}
        {msg.err.includes("憑證") && (
            <Link to="/credential/owner" className="ml-2 underline">前往取得屋主身份 →</Link>
        )}
    </p>
)}
```

---

## 四、錯誤處理總表

| Error Sentinel | HTTP | 前端顯示 |
|---|---|---|
| `ErrNoOwnerCredential` | 403 | "需要屋主身份憑證才能操作" |
| `ErrNoTenantCredential` | 403 | "需要租客身份憑證才能預約" |
| 既有 `ErrForbidden` | 403 | "無此操作權限"（維持不變）|
| 既有 `ErrNotKYCVerified` | 401 | 維持不變（逐步淘汰）|

---

## 五、測試策略

**後端單元測試（每個受影響 service 加 table-driven test）：**

測試情境：
1. `credRepo.FindByUserAndType` 回 nil → 回 `ErrNoOwnerCredential` / `ErrNoTenantCredential`
2. `credRepo.FindByUserAndType` 回 `&model.UserCredential{}` → 通過 credential check，繼續下層邏輯
3. `rental_listing.Create`：credential check 在 property owner check 之前（fail fast 順序驗證）

測試用 inline mock struct（實作 `CredentialReader` interface）：
```go
type mockCredRepo struct{ cred *model.UserCredential }
func (m *mockCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
    return m.cred, nil
}
```

**前端驗收重點：**
1. 無 OWNER credential → 刊登管理頁顯示 `GateFallback`（路由層，既有行為）
2. 無 TENANT credential → RentDetailPage / SaleDetailPage 預約按鈕變為「取得租客身份後可預約」
3. 有 TENANT credential → 預約按鈕正常顯示
4. 刊登 API 回 403 → form 顯示含連結的錯誤訊息

**不需要 E2E 測試：** 後端 unit test + `npm run lint && npm run build` 通過為驗收標準。

---

## 六、驗收清單

- [ ] `listing.Create` 無 OWNER credential → 403
- [ ] `listing.Publish` 無 OWNER credential → 403
- [ ] `rental_listing.Create` 無 OWNER credential → 403
- [ ] `rental_listing.Publish` 無 OWNER credential → 403
- [ ] `sale_listing.Create` 無 OWNER credential → 403
- [ ] `sale_listing.Publish` 無 OWNER credential → 403
- [ ] `listing.BookAppointment` 無 TENANT credential → 403
- [ ] 有對應 credential → 以上操作正常通過
- [ ] RentDetailPage 無 TENANT → 按鈕文字 + 跳轉 `/credential/tenant`
- [ ] SaleDetailPage 同上
- [ ] `go test ./internal/modules/listing/... ./internal/modules/rental_listing/... ./internal/modules/sale_listing/...` 全綠
- [ ] `npm run lint && npm run build` 0 errors
