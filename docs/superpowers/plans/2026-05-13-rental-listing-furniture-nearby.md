# Rental Listing Furniture & Nearby Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓出租刊登的建立/更新表單能填寫傢俱設備（11 項）和周邊環境（4 項），並正確儲存到 DB，與公開詳情頁顯示的欄位完全對齊。

**Architecture:** DB 和 API response 已有所有欄位，缺口在輸入路徑。後端 `Create/Update` 請求 DTO 補齊 15 個 bool 欄位；`Store.Create` 介面改為接受 `*model.RentalListing`（與 Update 一致）；`repo.Create/Update` SQL 補入所有欄位。前端 API payload 型別和表單同步補齊。

**Tech Stack:** Go 1.25 + Gin + lib/pq（backend）、React 19 + TypeScript 5 strict + Tailwind（frontend）

---

## File Map

| 檔案 | 異動 |
|------|------|
| `go-service/internal/modules/rental_listing/dto.go` | Create/Update request 各補 15 個 bool 欄位 |
| `go-service/internal/modules/rental_listing/service.go` | `Store.Create` 改接受 `*model.RentalListing`；`applyRentalUpdate` 補 15 個 if 塊 |
| `go-service/internal/modules/rental_listing/service_test.go` | 新增 TestApplyRentalUpdate_FurnitureNearby |
| `go-service/internal/db/repository/rental_listing_repo.go` | `Create` 改簽名 + INSERT SQL 補欄；`Update` SQL 補欄 |
| `react-service/src/api/rentalListingApi.ts` | `CreateRentalListingPayload`/`UpdateRentalListingPayload` 補 15 個 bool |
| `react-service/src/components/listing/RentalListingForm.tsx` | `FormState` + `EMPTY_FORM` + `listingToForm` + `formToPayload` + 兩個 UI section |

---

### Task 1: Backend DTO + service.go + test

**Files:**
- Modify: `go-service/internal/modules/rental_listing/dto.go`
- Modify: `go-service/internal/modules/rental_listing/service.go`
- Modify: `go-service/internal/modules/rental_listing/service_test.go`

- [ ] **Step 1: 寫失敗測試**

在 `go-service/internal/modules/rental_listing/service_test.go` 末尾加上：

```go
func TestApplyRentalUpdate_FurnitureNearby(t *testing.T) {
	trueVal := true
	falseVal := false
	rl := &model.RentalListing{}
	req := UpdateRentalListingRequest{
		HasSofa:              &trueVal,
		HasAC:                &falseVal,
		NearPark:             &trueVal,
		NearConvenienceStore: &falseVal,
	}
	applyRentalUpdate(rl, req)
	if !rl.HasSofa {
		t.Error("expected HasSofa true")
	}
	if rl.HasAC {
		t.Error("expected HasAC false")
	}
	if !rl.NearPark {
		t.Error("expected NearPark true")
	}
	if rl.NearConvenienceStore {
		t.Error("expected NearConvenienceStore false")
	}
}
```

- [ ] **Step 2: 確認測試失敗（欄位不存在，應編譯失敗）**

```powershell
cd go-service; go test ./internal/modules/rental_listing/...
```

預期：`unknown field HasSofa in struct literal` 或 `undefined: UpdateRentalListingRequest.HasSofa`

- [ ] **Step 3: 修改 dto.go — 補齊 Create/Update request 欄位**

完整替換 `go-service/internal/modules/rental_listing/dto.go`：

```go
package rental_listing

import "time"

type PropertySummaryResponse struct {
	ID                  int64    `json:"id"`
	Title               string   `json:"title"`
	Address             string   `json:"address"`
	BuildingType        string   `json:"building_type"`
	Floor               *int32   `json:"floor,omitempty"`
	TotalFloors         *int32   `json:"total_floors,omitempty"`
	MainArea            *float64 `json:"main_area,omitempty"`
	AuxiliaryArea       *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea         *float64 `json:"balcony_area,omitempty"`
	Rooms               *int32   `json:"rooms,omitempty"`
	LivingRooms         *int32   `json:"living_rooms,omitempty"`
	Bathrooms           *int32   `json:"bathrooms,omitempty"`
	BuildingAge         *int32   `json:"building_age,omitempty"`
	ParkingType         string   `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee,omitempty"`
	IsCornerUnit        bool     `json:"is_corner_unit"`
	SecurityType        string   `json:"security_type"`
	BuildingOrientation *string  `json:"building_orientation,omitempty"`
	WindowOrientation   *string  `json:"window_orientation,omitempty"`
	PhotoURLs           []string `json:"photo_urls"`
}

type CreateRentalListingRequest struct {
	MonthlyRent        float64 `json:"monthly_rent" binding:"required,min=0"`
	DepositMonths      float64 `json:"deposit_months" binding:"min=0"`
	ManagementFeePayer string  `json:"management_fee_payer" binding:"oneof=TENANT OWNER SPLIT"`
	MinLeaseMonths     int     `json:"min_lease_months" binding:"min=0"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction"`
	Notes              *string `json:"notes"`
	DurationDays       int     `json:"duration_days" binding:"min=7"`

	HasSofa        bool `json:"has_sofa"`
	HasBed         bool `json:"has_bed"`
	HasWardrobe    bool `json:"has_wardrobe"`
	HasTV          bool `json:"has_tv"`
	HasFridge      bool `json:"has_fridge"`
	HasAC          bool `json:"has_ac"`
	HasWasher      bool `json:"has_washer"`
	HasWaterHeater bool `json:"has_water_heater"`
	HasGas         bool `json:"has_gas"`
	HasInternet    bool `json:"has_internet"`
	HasCableTV     bool `json:"has_cable_tv"`

	NearSchool           bool `json:"near_school"`
	NearSupermarket      bool `json:"near_supermarket"`
	NearConvenienceStore bool `json:"near_convenience_store"`
	NearPark             bool `json:"near_park"`
}

type UpdateRentalListingRequest struct {
	MonthlyRent        *float64 `json:"monthly_rent"`
	DepositMonths      *float64 `json:"deposit_months"`
	ManagementFeePayer *string  `json:"management_fee_payer"`
	MinLeaseMonths     *int     `json:"min_lease_months"`
	AllowPets          *bool    `json:"allow_pets"`
	AllowCooking       *bool    `json:"allow_cooking"`
	GenderRestriction  *string  `json:"gender_restriction"`
	Notes              *string  `json:"notes"`
	DurationDays       *int     `json:"duration_days"`

	HasSofa        *bool `json:"has_sofa"`
	HasBed         *bool `json:"has_bed"`
	HasWardrobe    *bool `json:"has_wardrobe"`
	HasTV          *bool `json:"has_tv"`
	HasFridge      *bool `json:"has_fridge"`
	HasAC          *bool `json:"has_ac"`
	HasWasher      *bool `json:"has_washer"`
	HasWaterHeater *bool `json:"has_water_heater"`
	HasGas         *bool `json:"has_gas"`
	HasInternet    *bool `json:"has_internet"`
	HasCableTV     *bool `json:"has_cable_tv"`

	NearSchool           *bool `json:"near_school"`
	NearSupermarket      *bool `json:"near_supermarket"`
	NearConvenienceStore *bool `json:"near_convenience_store"`
	NearPark             *bool `json:"near_park"`
}

type RentalListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	MonthlyRent        float64 `json:"monthly_rent"`
	DepositMonths      float64 `json:"deposit_months"`
	ManagementFeePayer string  `json:"management_fee_payer"`
	MinLeaseMonths     int     `json:"min_lease_months"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction,omitempty"`
	Notes              *string `json:"notes,omitempty"`

	HasSofa        bool `json:"has_sofa"`
	HasBed         bool `json:"has_bed"`
	HasWardrobe    bool `json:"has_wardrobe"`
	HasTV          bool `json:"has_tv"`
	HasFridge      bool `json:"has_fridge"`
	HasAC          bool `json:"has_ac"`
	HasWasher      bool `json:"has_washer"`
	HasWaterHeater bool `json:"has_water_heater"`
	HasGas         bool `json:"has_gas"`
	HasInternet    bool `json:"has_internet"`
	HasCableTV     bool `json:"has_cable_tv"`

	NearSchool           bool `json:"near_school"`
	NearSupermarket      bool `json:"near_supermarket"`
	NearConvenienceStore bool `json:"near_convenience_store"`
	NearPark             bool `json:"near_park"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Property *PropertySummaryResponse `json:"property,omitempty"`
}
```

- [ ] **Step 4: 修改 service.go — Store.Create 介面 + applyRentalUpdate + service.Create 方法**

完整替換 `go-service/internal/modules/rental_listing/service.go`：

```go
package rental_listing

import (
	"database/sql"
	"errors"
	"fmt"

	"go-service/internal/db/model"
)

var (
	ErrNotFound         = errors.New("rental listing not found")
	ErrForbidden        = errors.New("only the property owner can manage this listing")
	ErrPropertyNotReady = errors.New("property must be READY before creating a listing")
)

type Store interface {
	Create(rl *model.RentalListing) (int64, error)
	FindByID(id int64) (*model.RentalListing, error)
	FindActiveByProperty(propertyID int64) (*model.RentalListing, error)
	ListPublic() ([]*model.RentalListing, error)
	Update(rl *model.RentalListing) error
	SetStatus(id int64, status string) error
	Publish(id int64, durationDays int) error
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	repo         Store
	propertyRepo PropertyStore
	userRepo     UserStore
}

func NewService(repo Store, propertyRepo PropertyStore, userRepo UserStore) *Service {
	return &Service{repo: repo, propertyRepo: propertyRepo, userRepo: userRepo}
}

func (s *Service) Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return 0, err
	}
	prop, _ := s.propertyRepo.FindByID(propertyID)
	if prop == nil || prop.SetupStatus != model.PropertySetupReady {
		return 0, ErrPropertyNotReady
	}
	rl := &model.RentalListing{
		PropertyID:           propertyID,
		MonthlyRent:          req.MonthlyRent,
		DepositMonths:        req.DepositMonths,
		ManagementFeePayer:   req.ManagementFeePayer,
		MinLeaseMonths:       req.MinLeaseMonths,
		AllowPets:            req.AllowPets,
		AllowCooking:         req.AllowCooking,
		DurationDays:         req.DurationDays,
		HasSofa:              req.HasSofa,
		HasBed:               req.HasBed,
		HasWardrobe:          req.HasWardrobe,
		HasTV:                req.HasTV,
		HasFridge:            req.HasFridge,
		HasAC:                req.HasAC,
		HasWasher:            req.HasWasher,
		HasWaterHeater:       req.HasWaterHeater,
		HasGas:               req.HasGas,
		HasInternet:          req.HasInternet,
		HasCableTV:           req.HasCableTV,
		NearSchool:           req.NearSchool,
		NearSupermarket:      req.NearSupermarket,
		NearConvenienceStore: req.NearConvenienceStore,
		NearPark:             req.NearPark,
	}
	if req.GenderRestriction != nil {
		rl.GenderRestriction = sql.NullString{String: *req.GenderRestriction, Valid: true}
	}
	if req.Notes != nil {
		rl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	id, err := s.repo.Create(rl)
	if err != nil {
		return 0, fmt.Errorf("rental_listing: Create: %w", err)
	}
	return id, nil
}

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

func (s *Service) GetActiveByProperty(propertyID int64, wallet string) (*model.RentalListing, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	rl, err := s.repo.FindActiveByProperty(propertyID)
	if err != nil {
		return nil, fmt.Errorf("rental_listing: GetActiveByProperty: %w", err)
	}
	return rl, nil
}

func (s *Service) Update(id int64, wallet string, req UpdateRentalListingRequest) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	applyRentalUpdate(rl, req)
	return s.repo.Update(rl)
}

func (s *Service) Publish(id int64, wallet string, durationDays int) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	return s.repo.Publish(id, durationDays)
}

func (s *Service) Close(id int64, wallet string) error {
	rl, err := s.repo.FindByID(id)
	if err != nil || rl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, rl.PropertyID); err != nil {
		return err
	}
	return s.repo.SetStatus(id, model.RentalListingStatusClosed)
}

func (s *Service) assertOwnsProperty(wallet string, propertyID int64) error {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil || user == nil {
		return ErrForbidden
	}
	prop, err := s.propertyRepo.FindByID(propertyID)
	if err != nil || prop == nil {
		return ErrNotFound
	}
	if prop.OwnerUserID != user.ID {
		return ErrForbidden
	}
	return nil
}

func applyRentalUpdate(rl *model.RentalListing, req UpdateRentalListingRequest) {
	if req.MonthlyRent != nil {
		rl.MonthlyRent = *req.MonthlyRent
	}
	if req.DepositMonths != nil {
		rl.DepositMonths = *req.DepositMonths
	}
	if req.ManagementFeePayer != nil {
		rl.ManagementFeePayer = *req.ManagementFeePayer
	}
	if req.MinLeaseMonths != nil {
		rl.MinLeaseMonths = *req.MinLeaseMonths
	}
	if req.AllowPets != nil {
		rl.AllowPets = *req.AllowPets
	}
	if req.AllowCooking != nil {
		rl.AllowCooking = *req.AllowCooking
	}
	if req.GenderRestriction != nil {
		rl.GenderRestriction = sql.NullString{String: *req.GenderRestriction, Valid: true}
	}
	if req.Notes != nil {
		rl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	if req.DurationDays != nil {
		rl.DurationDays = *req.DurationDays
	}
	if req.HasSofa != nil {
		rl.HasSofa = *req.HasSofa
	}
	if req.HasBed != nil {
		rl.HasBed = *req.HasBed
	}
	if req.HasWardrobe != nil {
		rl.HasWardrobe = *req.HasWardrobe
	}
	if req.HasTV != nil {
		rl.HasTV = *req.HasTV
	}
	if req.HasFridge != nil {
		rl.HasFridge = *req.HasFridge
	}
	if req.HasAC != nil {
		rl.HasAC = *req.HasAC
	}
	if req.HasWasher != nil {
		rl.HasWasher = *req.HasWasher
	}
	if req.HasWaterHeater != nil {
		rl.HasWaterHeater = *req.HasWaterHeater
	}
	if req.HasGas != nil {
		rl.HasGas = *req.HasGas
	}
	if req.HasInternet != nil {
		rl.HasInternet = *req.HasInternet
	}
	if req.HasCableTV != nil {
		rl.HasCableTV = *req.HasCableTV
	}
	if req.NearSchool != nil {
		rl.NearSchool = *req.NearSchool
	}
	if req.NearSupermarket != nil {
		rl.NearSupermarket = *req.NearSupermarket
	}
	if req.NearConvenienceStore != nil {
		rl.NearConvenienceStore = *req.NearConvenienceStore
	}
	if req.NearPark != nil {
		rl.NearPark = *req.NearPark
	}
}
```

- [ ] **Step 5: 執行測試，確認 TestApplyRentalUpdate_FurnitureNearby 通過**

```powershell
cd go-service; go test ./internal/modules/rental_listing/...
```

預期輸出：
```
ok  	go-service/internal/modules/rental_listing	0.XXXs
```

- [ ] **Step 6: Commit**

```powershell
git add go-service/internal/modules/rental_listing/dto.go
git add go-service/internal/modules/rental_listing/service.go
git add go-service/internal/modules/rental_listing/service_test.go
git commit -m "feat: add furniture and nearby fields to rental listing Create/Update DTOs and service"
```

---

### Task 2: Repository — Create + Update SQL

**Files:**
- Modify: `go-service/internal/db/repository/rental_listing_repo.go`

- [ ] **Step 1: 修改 repo.Create — 改簽名並補 INSERT 欄位**

將 `go-service/internal/db/repository/rental_listing_repo.go` 中的 `Create` 方法替換為：

```go
func (r *RentalListingRepository) Create(rl *model.RentalListing) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO rental_listing
		    (property_id, status, duration_days, monthly_rent, deposit_months,
		     management_fee_payer, min_lease_months, allow_pets, allow_cooking,
		     gender_restriction, notes,
		     has_sofa, has_bed, has_wardrobe, has_tv, has_fridge,
		     has_ac, has_washer, has_water_heater, has_gas, has_internet, has_cable_tv,
		     near_school, near_supermarket, near_convenience_store, near_park,
		     created_at, updated_at)
		VALUES ($1, 'DRAFT', $2, $3, $4, $5, $6, $7, $8, $9, $10,
		        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
		        $22, $23, $24, $25, NOW(), NOW())
		RETURNING id`,
		rl.PropertyID, rl.DurationDays, rl.MonthlyRent, rl.DepositMonths,
		rl.ManagementFeePayer, rl.MinLeaseMonths, rl.AllowPets, rl.AllowCooking,
		rl.GenderRestriction, rl.Notes,
		rl.HasSofa, rl.HasBed, rl.HasWardrobe, rl.HasTV, rl.HasFridge,
		rl.HasAC, rl.HasWasher, rl.HasWaterHeater, rl.HasGas, rl.HasInternet, rl.HasCableTV,
		rl.NearSchool, rl.NearSupermarket, rl.NearConvenienceStore, rl.NearPark,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("rental_listing_repo: Create: %w", err)
	}
	return id, nil
}
```

- [ ] **Step 2: 修改 repo.Update — 補 SET 欄位**

將 `Update` 方法替換為：

```go
func (r *RentalListingRepository) Update(rl *model.RentalListing) error {
	_, err := r.db.Exec(`
		UPDATE rental_listing SET
		    duration_days=$1, monthly_rent=$2, deposit_months=$3,
		    management_fee_payer=$4, min_lease_months=$5,
		    allow_pets=$6, allow_cooking=$7,
		    gender_restriction=$8, notes=$9,
		    has_sofa=$10, has_bed=$11, has_wardrobe=$12, has_tv=$13, has_fridge=$14,
		    has_ac=$15, has_washer=$16, has_water_heater=$17, has_gas=$18, has_internet=$19, has_cable_tv=$20,
		    near_school=$21, near_supermarket=$22, near_convenience_store=$23, near_park=$24,
		    updated_at=NOW()
		WHERE id=$25`,
		rl.DurationDays, rl.MonthlyRent, rl.DepositMonths,
		rl.ManagementFeePayer, rl.MinLeaseMonths,
		rl.AllowPets, rl.AllowCooking,
		rl.GenderRestriction, rl.Notes,
		rl.HasSofa, rl.HasBed, rl.HasWardrobe, rl.HasTV, rl.HasFridge,
		rl.HasAC, rl.HasWasher, rl.HasWaterHeater, rl.HasGas, rl.HasInternet, rl.HasCableTV,
		rl.NearSchool, rl.NearSupermarket, rl.NearConvenienceStore, rl.NearPark,
		rl.ID,
	)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: Update: %w", err)
	}
	return nil
}
```

- [ ] **Step 3: 執行全部 Go 測試，確認編譯通過**

```powershell
cd go-service; go test ./...
```

預期輸出（含之前的 property 測試）：
```
ok  	go-service/internal/modules/rental_listing	0.XXXs
ok  	go-service/internal/modules/property	0.XXXs
...
```

- [ ] **Step 4: Commit**

```powershell
git add go-service/internal/db/repository/rental_listing_repo.go
git commit -m "feat: rental listing repo Create/Update SQL include furniture and nearby fields"
```

---

### Task 3: Frontend — API types + form

**Files:**
- Modify: `react-service/src/api/rentalListingApi.ts`
- Modify: `react-service/src/components/listing/RentalListingForm.tsx`

- [ ] **Step 1: 修改 rentalListingApi.ts — 補 payload 型別**

將 `CreateRentalListingPayload` 和 `UpdateRentalListingPayload` 替換為：

```typescript
export type CreateRentalListingPayload = {
    monthly_rent: number;
    deposit_months: number;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: number;
    allow_pets: boolean;
    allow_cooking: boolean;
    gender_restriction?: string;
    notes?: string;
    duration_days: number;
    has_sofa: boolean;
    has_bed: boolean;
    has_wardrobe: boolean;
    has_tv: boolean;
    has_fridge: boolean;
    has_ac: boolean;
    has_washer: boolean;
    has_water_heater: boolean;
    has_gas: boolean;
    has_internet: boolean;
    has_cable_tv: boolean;
    near_school: boolean;
    near_supermarket: boolean;
    near_convenience_store: boolean;
    near_park: boolean;
};

export type UpdateRentalListingPayload = Partial<CreateRentalListingPayload>;
```

- [ ] **Step 2: 修改 RentalListingForm.tsx — FormState + EMPTY_FORM + listingToForm + formToPayload**

將 `FormState`、`EMPTY_FORM`、`listingToForm`、`formToPayload` 完整替換（位於檔案 22–61 行）：

```typescript
type FormState = {
    monthly_rent: string; deposit_months: string;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: string; allow_pets: boolean;
    allow_cooking: boolean; gender_restriction: string;
    notes: string; duration_days: string;
    has_sofa: boolean; has_bed: boolean; has_wardrobe: boolean;
    has_tv: boolean; has_fridge: boolean; has_ac: boolean;
    has_washer: boolean; has_water_heater: boolean;
    has_gas: boolean; has_internet: boolean; has_cable_tv: boolean;
    near_school: boolean; near_supermarket: boolean;
    near_convenience_store: boolean; near_park: boolean;
};

const EMPTY_FORM: FormState = {
    monthly_rent: "", deposit_months: "2",
    management_fee_payer: "TENANT", min_lease_months: "12",
    allow_pets: false, allow_cooking: true,
    gender_restriction: "", notes: "", duration_days: "30",
    has_sofa: false, has_bed: false, has_wardrobe: false,
    has_tv: false, has_fridge: false, has_ac: false,
    has_washer: false, has_water_heater: false,
    has_gas: false, has_internet: false, has_cable_tv: false,
    near_school: false, near_supermarket: false,
    near_convenience_store: false, near_park: false,
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
        has_sofa: rl.has_sofa, has_bed: rl.has_bed, has_wardrobe: rl.has_wardrobe,
        has_tv: rl.has_tv, has_fridge: rl.has_fridge, has_ac: rl.has_ac,
        has_washer: rl.has_washer, has_water_heater: rl.has_water_heater,
        has_gas: rl.has_gas, has_internet: rl.has_internet, has_cable_tv: rl.has_cable_tv,
        near_school: rl.near_school, near_supermarket: rl.near_supermarket,
        near_convenience_store: rl.near_convenience_store, near_park: rl.near_park,
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
        has_sofa: f.has_sofa, has_bed: f.has_bed, has_wardrobe: f.has_wardrobe,
        has_tv: f.has_tv, has_fridge: f.has_fridge, has_ac: f.has_ac,
        has_washer: f.has_washer, has_water_heater: f.has_water_heater,
        has_gas: f.has_gas, has_internet: f.has_internet, has_cable_tv: f.has_cable_tv,
        near_school: f.near_school, near_supermarket: f.near_supermarket,
        near_convenience_store: f.near_convenience_store, near_park: f.near_park,
    };
}
```

- [ ] **Step 3: 在 RentalListingForm.tsx 加入傢俱設備和周邊環境 UI**

在 `<div className="flex items-center gap-6 md:col-span-2">` （目前的 `allow_pets/allow_cooking` checkbox 區塊）之後、`<div className="flex flex-col gap-1.5 md:col-span-2">` （備注欄位）之前，插入兩個新 section（**注意：這兩個新區塊要放在 `grid` 內**）：

```tsx
<div className="flex flex-col gap-3 md:col-span-2">
    <label className="text-xs font-semibold text-on-surface-variant">傢俱設備</label>
    <div className="flex flex-wrap gap-x-6 gap-y-3">
        {([
            ["has_sofa", "沙發"], ["has_bed", "床組"], ["has_wardrobe", "衣櫃"],
            ["has_tv", "電視"], ["has_fridge", "冰箱"], ["has_ac", "冷氣"],
            ["has_washer", "洗衣機"], ["has_water_heater", "熱水器"],
            ["has_gas", "天然瓦斯"], ["has_internet", "網路"], ["has_cable_tv", "第四台"],
        ] as const).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                <input type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                {label}
            </label>
        ))}
    </div>
</div>
<div className="flex flex-col gap-3 md:col-span-2">
    <label className="text-xs font-semibold text-on-surface-variant">周邊環境</label>
    <div className="flex flex-wrap gap-x-6 gap-y-3">
        {([
            ["near_school", "近學區"], ["near_supermarket", "近超市"],
            ["near_convenience_store", "近便利商店"], ["near_park", "近公園"],
        ] as const).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                <input type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} className="h-4 w-4 rounded accent-primary-container" />
                {label}
            </label>
        ))}
    </div>
</div>
```

- [ ] **Step 4: lint + build 驗證**

```powershell
cd react-service; npm run lint; npm run build
```

預期：0 errors, 0 warnings（或只有現有已知的 warnings）。

- [ ] **Step 5: Commit**

```powershell
git add react-service/src/api/rentalListingApi.ts
git add react-service/src/components/listing/RentalListingForm.tsx
git commit -m "feat: add furniture and nearby fields to rental listing form and API types"
```

---

### Task 4: Integration 驗收

- [ ] **Step 1: rebuild go-service docker container**

```powershell
cd go-service; docker compose up --build -d
```

- [ ] **Step 2: 手動驗證 create flow**

1. 前往 `http://localhost:5173/my/properties/:id/listing`（使用一個 READY 物件）
2. 出租 tab → 勾選「沙發」「冷氣」「近超市」
3. 點「建立出租刊登」→ 確認「已儲存」成功訊息
4. 重整頁面 → 確認「沙發」「冷氣」「近超市」checkbox 仍被勾選

- [ ] **Step 3: 手動驗證 update flow**

1. 取消「冷氣」勾選
2. 點「更新條件」→ 確認成功
3. 重整頁面 → 確認「冷氣」為未勾選

- [ ] **Step 4: 確認公開詳情頁同步**

1. 將該刊登上架（點「上架」）
2. 前往 `http://localhost:5173/rent/:id` 公開頁
3. 確認傢俱設備和周邊環境區塊顯示正確的項目

- [ ] **Step 5: Commit（如有任何微調）**

```powershell
git add -p
git commit -m "fix: <describe any adjustments>"
```
