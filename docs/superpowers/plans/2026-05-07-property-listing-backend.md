# Property & Listing Redesign — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed listing/property data model with three clean tables (`property`, `rental_listing`, `sale_listing`) and rename the existing KYC `properties` table to `customer`.

**Architecture:** `property` stores all 591-style physical data. `rental_listing` and `sale_listing` each hold type-specific conditions with a `property_id` FK. The existing KYC `properties` table is renamed `customer` to free the `property` name. Existing `listings` table is kept as-is (legacy, not deleted in this plan).

**Tech Stack:** Go 1.25, Gin, `lib/pq`, PostgreSQL — no ORM, raw SQL in repositories.

---

## File Map

**Rename (existing files):**
- `internal/db/model/property_model.go` → keep path, rename struct `Property` → `Customer`, constants `Property*` → `Customer*`
- `internal/db/repository/property_repo.go` → keep path, rename type `PropertyRepository` → `CustomerRepository`, SQL `FROM properties` → `FROM customer`
- `internal/modules/property/` → `internal/modules/customer/` (new directory, package `customer`)

**Create (new files):**
- `internal/db/model/property_model.go` (new 591-style struct after old one is renamed)
- `internal/db/model/rental_listing_model.go`
- `internal/db/model/sale_listing_model.go`
- `internal/db/repository/new_property_repo.go` (temporary name during transition; rename to `property_repo.go` after old one is moved)
- `internal/db/repository/rental_listing_repo.go`
- `internal/db/repository/sale_listing_repo.go`
- `internal/modules/property/dto.go`
- `internal/modules/property/service.go`
- `internal/modules/property/handler.go`
- `internal/modules/rental_listing/dto.go`
- `internal/modules/rental_listing/service.go`
- `internal/modules/rental_listing/handler.go`
- `internal/modules/sale_listing/dto.go`
- `internal/modules/sale_listing/service.go`
- `internal/modules/sale_listing/handler.go`

**Modify (existing files):**
- `internal/platform/db/schema.go` — rename table + add new tables
- `internal/bootstrap/wiring.go` — rename imports + wire new modules
- `internal/bootstrap/router.go` — add new routes
- `internal/modules/listing/service.go` — rename `PropertyReader` → `CustomerReader`

---

## Task 1: Rename `properties` → `customer` in schema.go

**Files:**
- Modify: `internal/platform/db/schema.go`

- [ ] **Step 1: Add rename + new tables to EnsureSchema**

Add these statements at the **top** of the `statements` slice (before existing ones):

```go
`DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties') THEN
        ALTER TABLE properties RENAME TO customer;
    END IF;
END $$`,

`CREATE TABLE IF NOT EXISTS property (
    id                   BIGSERIAL    PRIMARY KEY,
    owner_user_id        BIGINT       NOT NULL REFERENCES users(id),
    title                TEXT         NOT NULL DEFAULT '',
    address              TEXT         NOT NULL DEFAULT '',
    district_id          BIGINT       REFERENCES taiwan_districts(id),
    building_type        VARCHAR(20)  NOT NULL DEFAULT 'APARTMENT',
    floor                SMALLINT,
    total_floors         SMALLINT,
    main_area            NUMERIC(6,2),
    auxiliary_area       NUMERIC(6,2),
    balcony_area         NUMERIC(6,2),
    shared_area          NUMERIC(6,2),
    awning_area          NUMERIC(6,2),
    land_area            NUMERIC(8,2),
    rooms                SMALLINT,
    living_rooms         SMALLINT,
    bathrooms            SMALLINT,
    is_corner_unit       BOOLEAN      NOT NULL DEFAULT FALSE,
    has_dark_room        BOOLEAN      NOT NULL DEFAULT FALSE,
    building_age         SMALLINT,
    building_structure   VARCHAR(50),
    exterior_material    VARCHAR(100),
    building_usage       TEXT,
    zoning               TEXT,
    units_on_floor       SMALLINT,
    building_orientation VARCHAR(10),
    window_orientation   VARCHAR(10),
    parking_type         VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    management_fee       NUMERIC(10,2),
    security_type        VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    setup_status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)`,

`CREATE INDEX IF NOT EXISTS idx_property_owner ON property (owner_user_id)`,

`CREATE TABLE IF NOT EXISTS property_attachment (
    id          BIGSERIAL   PRIMARY KEY,
    property_id BIGINT      NOT NULL REFERENCES property(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,
    url         TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,

`CREATE INDEX IF NOT EXISTS idx_property_attachment_property ON property_attachment (property_id)`,

`CREATE TABLE IF NOT EXISTS rental_listing (
    id                   BIGSERIAL     PRIMARY KEY,
    property_id          BIGINT        NOT NULL REFERENCES property(id),
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    duration_days        INT           NOT NULL DEFAULT 30,
    monthly_rent         NUMERIC(14,2) NOT NULL DEFAULT 0,
    deposit_months       NUMERIC(4,1)  NOT NULL DEFAULT 0,
    management_fee_payer VARCHAR(20)   NOT NULL DEFAULT 'TENANT',
    min_lease_months     INT           NOT NULL DEFAULT 0,
    allow_pets           BOOLEAN       NOT NULL DEFAULT FALSE,
    allow_cooking        BOOLEAN       NOT NULL DEFAULT FALSE,
    gender_restriction   VARCHAR(20),
    notes                TEXT,
    published_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,

`CREATE INDEX IF NOT EXISTS idx_rental_listing_property ON rental_listing (property_id)`,
`CREATE INDEX IF NOT EXISTS idx_rental_listing_status   ON rental_listing (status)`,

`CREATE TABLE IF NOT EXISTS sale_listing (
    id                  BIGSERIAL     PRIMARY KEY,
    property_id         BIGINT        NOT NULL REFERENCES property(id),
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    duration_days       INT           NOT NULL DEFAULT 30,
    total_price         NUMERIC(14,2) NOT NULL DEFAULT 0,
    unit_price_per_ping NUMERIC(14,2),
    parking_type        VARCHAR(50),
    parking_price       NUMERIC(14,2),
    notes               TEXT,
    published_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
)`,

`CREATE INDEX IF NOT EXISTS idx_sale_listing_property ON sale_listing (property_id)`,
`CREATE INDEX IF NOT EXISTS idx_sale_listing_status   ON sale_listing (status)`,
```

- [ ] **Step 2: Rebuild and verify schema applies**

```bash
cd go-service && docker compose up --build -d
docker compose logs go-service | grep -E "schema|error|Error"
```

Expected: no error lines, container healthy.

- [ ] **Step 3: Verify tables exist**

```bash
docker exec -it go-service-db-1 psql -U postgres -d TASK -c "\dt"
```

Expected: `customer`, `property`, `property_attachment`, `rental_listing`, `sale_listing` all present.

- [ ] **Step 4: Commit**

```bash
git add internal/platform/db/schema.go
git commit -m "feat: rename properties→customer, add property/rental_listing/sale_listing tables"
```

---

## Task 2: Rename `Property` model → `Customer`

**Files:**
- Modify: `internal/db/model/property_model.go`

- [ ] **Step 1: Replace all content**

```go
package model

import (
	"database/sql"
	"time"
)

const (
	CustomerVerificationDraft    = "DRAFT"
	CustomerVerificationVerified = "VERIFIED"
	CustomerVerificationRejected = "REJECTED"

	CustomerCompletenessBasicCreated       = "BASIC_CREATED"
	CustomerCompletenessDisclosureRequired = "DISCLOSURE_REQUIRED"
	CustomerCompletenessWarrantyRequired   = "WARRANTY_REQUIRED"
	CustomerCompletenessSnapshotReady      = "SNAPSHOT_READY"
	CustomerCompletenessReadyForListing    = "READY_FOR_LISTING"
)

type Customer struct {
	ID                           int64
	OwnerUserID                  int64
	SourceCredentialSubmissionID sql.NullInt64
	Address                      string
	DeedNo                       string
	DeedHash                     string
	PropertyStatementJSON        []byte
	WarrantyAnswersJSON          []byte
	DisclosureSnapshotJSON       []byte
	DisclosureHash               string
	VerificationStatus           string
	CompletenessStatus           string
	CreatedAt                    time.Time
	UpdatedAt                    time.Time
}
```

- [ ] **Step 2: Fix compile errors from rename**

Run:
```bash
cd go-service && go build ./...
```

Fix any references to `model.Property` (KYC kind) → `model.Customer`. They will appear in:
- `internal/db/repository/property_repo.go`
- `internal/modules/property/service.go`, `handler.go`, `domain.go`, `dto.go`
- `internal/modules/listing/service.go` (`PropertyReader` interface)
- `internal/modules/credential/service.go`

- [ ] **Step 3: Commit**

```bash
git add internal/db/model/property_model.go
git commit -m "refactor: rename Property KYC model to Customer"
```

---

## Task 3: Update property repository to reference `customer` table

**Files:**
- Modify: `internal/db/repository/property_repo.go`

- [ ] **Step 1: Rename struct and constructor, update SQL**

Find and replace throughout the file:
- `PropertyRepository` → `CustomerRepository`
- `NewPropertyRepository` → `NewCustomerRepository`
- `FROM properties` → `FROM customer`
- `INTO properties` → `INTO customer`
- `*model.Property` → `*model.Customer`

- [ ] **Step 2: Build**

```bash
cd go-service && go build ./...
```

Fix any remaining compile errors.

- [ ] **Step 3: Commit**

```bash
git add internal/db/repository/property_repo.go
git commit -m "refactor: rename PropertyRepository to CustomerRepository, table properties→customer"
```

---

## Task 4: Rename property module → customer module

**Files:**
- Create: `internal/modules/customer/` (copy of `internal/modules/property/`)
- Delete: `internal/modules/property/`

- [ ] **Step 1: Create customer module directory and copy files**

```bash
cp -r go-service/internal/modules/property go-service/internal/modules/customer
```

- [ ] **Step 2: Update package declaration in all files**

In every file under `internal/modules/customer/`, change first line:
```go
// before
package property

// after
package customer
```

Files to update: `domain.go`, `domain_test.go`, `dto.go`, `handler.go`, `handler_test.go`, `service.go`, `service_test.go`

- [ ] **Step 3: Update internal references in customer package**

In `service.go` and `handler.go`, update all `model.Property` (KYC type) references to `model.Customer`:
- `*model.Property` → `*model.Customer`
- `model.PropertyVerification*` → `model.CustomerVerification*`
- `model.PropertyCompleteness*` → `model.CustomerCompleteness*`

In `handler.go` update `toPropertyResponse` → `toCustomerResponse` and `PropertyResponse` → `CustomerResponse`.

In `dto.go` rename `PropertyResponse` → `CustomerResponse`.

- [ ] **Step 4: Update Repository interface in customer/service.go**

```go
// before
type Repository interface {
    FindByID(id int64) (*model.Property, error)
    // ...
}

// after
type Repository interface {
    FindByID(id int64) (*model.Customer, error)
    // ...
}
```

- [ ] **Step 5: Delete old property module**

```bash
rm -rf go-service/internal/modules/property
```

- [ ] **Step 6: Update wiring.go imports**

```go
// before
propertymod "go-service/internal/modules/property"

// after
customermod "go-service/internal/modules/customer"
```

And rename all usages:
- `propertymod.` → `customermod.`
- `propertySvc` → `customerSvc`
- `propertyHandler` → `customerHandler`
- `propertyRepo` → `customerRepo`
- `repository.NewPropertyRepository` → `repository.NewCustomerRepository`

- [ ] **Step 7: Update router.go**

```go
// In SetupRouter signature and body, rename:
// propertyHandler *property.Handler → customerHandler *customer.Handler
// and update import alias
```

Find the property routes in router.go:
```go
// before
protected.GET("/properties", propertyHandler.ListMine)
protected.GET("/properties/:id", propertyHandler.GetForOwner)
protected.PUT("/properties/:id/disclosure", propertyHandler.UpdateDisclosure)
protected.POST("/properties/:id/disclosure/confirm", propertyHandler.ConfirmDisclosure)

// after (same routes for now, handler renamed)
protected.GET("/properties", customerHandler.ListMine)
protected.GET("/properties/:id", customerHandler.GetForOwner)
protected.PUT("/properties/:id/disclosure", customerHandler.UpdateDisclosure)
protected.POST("/properties/:id/disclosure/confirm", customerHandler.ConfirmDisclosure)
```

- [ ] **Step 8: Update listing service's PropertyReader interface**

In `internal/modules/listing/service.go`:
```go
// before
type PropertyReader interface {
    FindByID(id int64) (*model.Property, error)
}

// after
type CustomerReader interface {
    FindByID(id int64) (*model.Customer, error)
}
```

Also rename the field in `Service` struct:
```go
// before
type Service struct {
    // ...
    propertyRepo PropertyReader
}

// after
type Service struct {
    // ...
    customerRepo CustomerReader
}
```

Update all usages of `s.propertyRepo` → `s.customerRepo` throughout `service.go`.

Update `NewService` parameter: `propertyRepo PropertyReader` → `customerRepo CustomerReader`.

- [ ] **Step 9: Fix credential module references**

Search for `model.Property` in `internal/modules/credential/`:
```bash
grep -rn "model\.Property" go-service/internal/modules/credential/
```
Replace any `model.Property` (KYC kind) → `model.Customer`.

- [ ] **Step 10: Full build**

```bash
cd go-service && go build ./...
```

Expected: 0 errors.

- [ ] **Step 11: Commit**

```bash
git add -A go-service/internal/modules/customer \
         go-service/internal/modules/property \
         go-service/internal/bootstrap/ \
         go-service/internal/modules/listing/service.go \
         go-service/internal/modules/credential/
git commit -m "refactor: rename property KYC module to customer throughout"
```

---

## Task 5: New `property` model

**Files:**
- Create: `internal/db/model/property_model.go` (now free to create fresh)

- [ ] **Step 1: Create file**

```go
package model

import (
	"database/sql"
	"time"
)

const (
	PropertySetupDraft = "DRAFT"
	PropertySetupReady = "READY"

	BuildingTypeApartment = "APARTMENT"
	BuildingTypeBuilding  = "BUILDING"
	BuildingTypeTownhouse = "TOWNHOUSE"
	BuildingTypeStudio    = "STUDIO"

	ParkingTypeNone       = "NONE"
	ParkingTypeRamp       = "RAMP"
	ParkingTypeMechanical = "MECHANICAL"
	ParkingTypeTower      = "TOWER"

	SecurityTypeNone     = "NONE"
	SecurityTypeFulltime = "FULLTIME"
	SecurityTypeParttime = "PARTTIME"

	AttachmentTypePhoto       = "PHOTO"
	AttachmentTypeDeed        = "DEED"
	AttachmentTypeFloorPlan   = "FLOOR_PLAN"
	AttachmentTypeDisclosure  = "DISCLOSURE"
)

type Property struct {
	ID          int64
	OwnerUserID int64

	Title        string
	Address      string
	DistrictID   sql.NullInt64
	BuildingType string

	Floor       sql.NullInt32
	TotalFloors sql.NullInt32

	MainArea      sql.NullFloat64
	AuxiliaryArea sql.NullFloat64
	BalconyArea   sql.NullFloat64
	SharedArea    sql.NullFloat64
	AwningArea    sql.NullFloat64
	LandArea      sql.NullFloat64

	Rooms       sql.NullInt32
	LivingRooms sql.NullInt32
	Bathrooms   sql.NullInt32
	IsCornerUnit bool
	HasDarkRoom  bool

	BuildingAge       sql.NullInt32
	BuildingStructure sql.NullString
	ExteriorMaterial  sql.NullString
	BuildingUsage     sql.NullString
	Zoning            sql.NullString
	UnitsOnFloor      sql.NullInt32

	BuildingOrientation sql.NullString
	WindowOrientation   sql.NullString

	ParkingType   string
	ManagementFee sql.NullFloat64
	SecurityType  string

	SetupStatus string
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Attachments []*PropertyAttachment
}

type PropertyAttachment struct {
	ID         int64
	PropertyID int64
	Type       string
	URL        string
	CreatedAt  time.Time
}
```

- [ ] **Step 2: Build**

```bash
cd go-service && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add internal/db/model/property_model.go
git commit -m "feat: add Property and PropertyAttachment models (591-style)"
```

---

## Task 6: New `rental_listing` and `sale_listing` models

**Files:**
- Create: `internal/db/model/rental_listing_model.go`
- Create: `internal/db/model/sale_listing_model.go`

- [ ] **Step 1: Create rental_listing_model.go**

```go
package model

import (
	"database/sql"
	"time"
)

const (
	RentalListingStatusDraft       = "DRAFT"
	RentalListingStatusActive      = "ACTIVE"
	RentalListingStatusNegotiating = "NEGOTIATING"
	RentalListingStatusLocked      = "LOCKED"
	RentalListingStatusClosed      = "CLOSED"
	RentalListingStatusExpired     = "EXPIRED"

	ManagementFeePayerTenant = "TENANT"
	ManagementFeePayerOwner  = "OWNER"
	ManagementFeePayerSplit  = "SPLIT"

	GenderRestrictionNone   = "NONE"
	GenderRestrictionMale   = "MALE"
	GenderRestrictionFemale = "FEMALE"
)

type RentalListing struct {
	ID         int64
	PropertyID int64

	Status       string
	DurationDays int

	MonthlyRent        float64
	DepositMonths      float64
	ManagementFeePayer string
	MinLeaseMonths     int
	AllowPets          bool
	AllowCooking       bool
	GenderRestriction  sql.NullString
	Notes              sql.NullString

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
```

- [ ] **Step 2: Create sale_listing_model.go**

```go
package model

import (
	"database/sql"
	"time"
)

const (
	SaleListingStatusDraft       = "DRAFT"
	SaleListingStatusActive      = "ACTIVE"
	SaleListingStatusNegotiating = "NEGOTIATING"
	SaleListingStatusLocked      = "LOCKED"
	SaleListingStatusClosed      = "CLOSED"
	SaleListingStatusExpired     = "EXPIRED"
)

type SaleListing struct {
	ID         int64
	PropertyID int64

	Status       string
	DurationDays int

	TotalPrice       float64
	UnitPricePerPing sql.NullFloat64
	ParkingType      sql.NullString
	ParkingPrice     sql.NullFloat64
	Notes            sql.NullString

	PublishedAt sql.NullTime
	ExpiresAt   sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time

	Property *Property
}
```

- [ ] **Step 3: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/db/model/rental_listing_model.go internal/db/model/sale_listing_model.go && \
git commit -m "feat: add RentalListing and SaleListing models"
```

---

## Task 7: New `property` repository

**Files:**
- Create: `internal/db/repository/property_repo.go`

- [ ] **Step 1: Create file**

```go
package repository

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

type PropertyRepository struct {
	db *sql.DB
}

func NewPropertyRepository(db *sql.DB) *PropertyRepository {
	return &PropertyRepository{db: db}
}

func (r *PropertyRepository) Create(ownerUserID int64, title, address string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO property (owner_user_id, title, address, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id`,
		ownerUserID, title, address,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("property_repo: Create: %w", err)
	}
	return id, nil
}

func (r *PropertyRepository) FindByID(id int64) (*model.Property, error) {
	row := r.db.QueryRow(`
		SELECT id, owner_user_id, title, address, district_id,
		       building_type, floor, total_floors,
		       main_area, auxiliary_area, balcony_area, shared_area, awning_area, land_area,
		       rooms, living_rooms, bathrooms, is_corner_unit, has_dark_room,
		       building_age, building_structure, exterior_material, building_usage, zoning, units_on_floor,
		       building_orientation, window_orientation,
		       parking_type, management_fee, security_type,
		       setup_status, created_at, updated_at
		FROM property WHERE id = $1`, id)
	p, err := scanProperty(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("property_repo: FindByID: %w", err)
	}
	return p, nil
}

func (r *PropertyRepository) ListByOwner(ownerUserID int64) ([]*model.Property, error) {
	rows, err := r.db.Query(`
		SELECT id, owner_user_id, title, address, district_id,
		       building_type, floor, total_floors,
		       main_area, auxiliary_area, balcony_area, shared_area, awning_area, land_area,
		       rooms, living_rooms, bathrooms, is_corner_unit, has_dark_room,
		       building_age, building_structure, exterior_material, building_usage, zoning, units_on_floor,
		       building_orientation, window_orientation,
		       parking_type, management_fee, security_type,
		       setup_status, created_at, updated_at
		FROM property WHERE owner_user_id = $1 ORDER BY created_at DESC`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListByOwner: %w", err)
	}
	defer rows.Close()
	var out []*model.Property
	for rows.Next() {
		p, err := scanPropertyRow(rows)
		if err != nil {
			return nil, fmt.Errorf("property_repo: ListByOwner scan: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PropertyRepository) Update(p *model.Property) error {
	_, err := r.db.Exec(`
		UPDATE property SET
		    title=$1, address=$2, district_id=$3, building_type=$4,
		    floor=$5, total_floors=$6,
		    main_area=$7, auxiliary_area=$8, balcony_area=$9, shared_area=$10,
		    awning_area=$11, land_area=$12,
		    rooms=$13, living_rooms=$14, bathrooms=$15,
		    is_corner_unit=$16, has_dark_room=$17,
		    building_age=$18, building_structure=$19, exterior_material=$20,
		    building_usage=$21, zoning=$22, units_on_floor=$23,
		    building_orientation=$24, window_orientation=$25,
		    parking_type=$26, management_fee=$27, security_type=$28,
		    setup_status=$29, updated_at=NOW()
		WHERE id=$30`,
		p.Title, p.Address, p.DistrictID, p.BuildingType,
		p.Floor, p.TotalFloors,
		p.MainArea, p.AuxiliaryArea, p.BalconyArea, p.SharedArea,
		p.AwningArea, p.LandArea,
		p.Rooms, p.LivingRooms, p.Bathrooms,
		p.IsCornerUnit, p.HasDarkRoom,
		p.BuildingAge, p.BuildingStructure, p.ExteriorMaterial,
		p.BuildingUsage, p.Zoning, p.UnitsOnFloor,
		p.BuildingOrientation, p.WindowOrientation,
		p.ParkingType, p.ManagementFee, p.SecurityType,
		p.SetupStatus, p.ID,
	)
	if err != nil {
		return fmt.Errorf("property_repo: Update: %w", err)
	}
	return nil
}

func (r *PropertyRepository) AddAttachment(propertyID int64, attachType, url string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO property_attachment (property_id, type, url, created_at)
		VALUES ($1, $2, $3, NOW()) RETURNING id`,
		propertyID, attachType, url,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("property_repo: AddAttachment: %w", err)
	}
	return id, nil
}

func (r *PropertyRepository) DeleteAttachment(propertyID, attachmentID int64) error {
	_, err := r.db.Exec(`DELETE FROM property_attachment WHERE id=$1 AND property_id=$2`,
		attachmentID, propertyID)
	if err != nil {
		return fmt.Errorf("property_repo: DeleteAttachment: %w", err)
	}
	return nil
}

func (r *PropertyRepository) ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error) {
	rows, err := r.db.Query(`
		SELECT id, property_id, type, url, created_at
		FROM property_attachment WHERE property_id=$1 ORDER BY created_at ASC`, propertyID)
	if err != nil {
		return nil, fmt.Errorf("property_repo: ListAttachments: %w", err)
	}
	defer rows.Close()
	var out []*model.PropertyAttachment
	for rows.Next() {
		a := &model.PropertyAttachment{}
		if err := rows.Scan(&a.ID, &a.PropertyID, &a.Type, &a.URL, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("property_repo: ListAttachments scan: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// scanProperty scans a *sql.Row into a Property.
func scanProperty(row *sql.Row) (*model.Property, error) {
	p := &model.Property{}
	return p, row.Scan(
		&p.ID, &p.OwnerUserID, &p.Title, &p.Address, &p.DistrictID,
		&p.BuildingType, &p.Floor, &p.TotalFloors,
		&p.MainArea, &p.AuxiliaryArea, &p.BalconyArea, &p.SharedArea, &p.AwningArea, &p.LandArea,
		&p.Rooms, &p.LivingRooms, &p.Bathrooms, &p.IsCornerUnit, &p.HasDarkRoom,
		&p.BuildingAge, &p.BuildingStructure, &p.ExteriorMaterial,
		&p.BuildingUsage, &p.Zoning, &p.UnitsOnFloor,
		&p.BuildingOrientation, &p.WindowOrientation,
		&p.ParkingType, &p.ManagementFee, &p.SecurityType,
		&p.SetupStatus, &p.CreatedAt, &p.UpdatedAt,
	)
}

// scanPropertyRow scans a *sql.Rows into a Property.
func scanPropertyRow(rows *sql.Rows) (*model.Property, error) {
	p := &model.Property{}
	return p, rows.Scan(
		&p.ID, &p.OwnerUserID, &p.Title, &p.Address, &p.DistrictID,
		&p.BuildingType, &p.Floor, &p.TotalFloors,
		&p.MainArea, &p.AuxiliaryArea, &p.BalconyArea, &p.SharedArea, &p.AwningArea, &p.LandArea,
		&p.Rooms, &p.LivingRooms, &p.Bathrooms, &p.IsCornerUnit, &p.HasDarkRoom,
		&p.BuildingAge, &p.BuildingStructure, &p.ExteriorMaterial,
		&p.BuildingUsage, &p.Zoning, &p.UnitsOnFloor,
		&p.BuildingOrientation, &p.WindowOrientation,
		&p.ParkingType, &p.ManagementFee, &p.SecurityType,
		&p.SetupStatus, &p.CreatedAt, &p.UpdatedAt,
	)
}

// SetupStatus updates only the setup_status column.
func (r *PropertyRepository) SetSetupStatus(id int64, status string, updatedAt time.Time) error {
	_, err := r.db.Exec(`UPDATE property SET setup_status=$1, updated_at=$2 WHERE id=$3`,
		status, updatedAt, id)
	return err
}
```

- [ ] **Step 2: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/db/repository/property_repo.go && \
git commit -m "feat: add PropertyRepository for new property table"
```

---

## Task 8: New `property` module — DTO, service, handler

**Files:**
- Create: `internal/modules/property/dto.go`
- Create: `internal/modules/property/service.go`
- Create: `internal/modules/property/handler.go`

- [ ] **Step 1: Create dto.go**

```go
package property

import "time"

// Requests

type CreatePropertyRequest struct {
	Title   string `json:"title" binding:"required"`
	Address string `json:"address" binding:"required"`
}

type UpdatePropertyRequest struct {
	Title               string   `json:"title"`
	Address             string   `json:"address"`
	BuildingType        string   `json:"building_type"`
	Floor               *int32   `json:"floor"`
	TotalFloors         *int32   `json:"total_floors"`
	MainArea            *float64 `json:"main_area"`
	AuxiliaryArea       *float64 `json:"auxiliary_area"`
	BalconyArea         *float64 `json:"balcony_area"`
	SharedArea          *float64 `json:"shared_area"`
	AwningArea          *float64 `json:"awning_area"`
	LandArea            *float64 `json:"land_area"`
	Rooms               *int32   `json:"rooms"`
	LivingRooms         *int32   `json:"living_rooms"`
	Bathrooms           *int32   `json:"bathrooms"`
	IsCornerUnit        *bool    `json:"is_corner_unit"`
	HasDarkRoom         *bool    `json:"has_dark_room"`
	BuildingAge         *int32   `json:"building_age"`
	BuildingStructure   *string  `json:"building_structure"`
	ExteriorMaterial    *string  `json:"exterior_material"`
	BuildingUsage       *string  `json:"building_usage"`
	Zoning              *string  `json:"zoning"`
	UnitsOnFloor        *int32   `json:"units_on_floor"`
	BuildingOrientation *string  `json:"building_orientation"`
	WindowOrientation   *string  `json:"window_orientation"`
	ParkingType         *string  `json:"parking_type"`
	ManagementFee       *float64 `json:"management_fee"`
	SecurityType        *string  `json:"security_type"`
}

// Responses

type AttachmentResponse struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

type PropertyResponse struct {
	ID          int64  `json:"id"`
	OwnerUserID int64  `json:"owner_user_id"`
	Title       string `json:"title"`
	Address     string `json:"address"`
	DistrictID  *int64 `json:"district_id,omitempty"`
	BuildingType string `json:"building_type"`

	Floor       *int32 `json:"floor,omitempty"`
	TotalFloors *int32 `json:"total_floors,omitempty"`

	MainArea      *float64 `json:"main_area,omitempty"`
	AuxiliaryArea *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea   *float64 `json:"balcony_area,omitempty"`
	SharedArea    *float64 `json:"shared_area,omitempty"`
	AwningArea    *float64 `json:"awning_area,omitempty"`
	LandArea      *float64 `json:"land_area,omitempty"`

	Rooms       *int32 `json:"rooms,omitempty"`
	LivingRooms *int32 `json:"living_rooms,omitempty"`
	Bathrooms   *int32 `json:"bathrooms,omitempty"`
	IsCornerUnit bool   `json:"is_corner_unit"`
	HasDarkRoom  bool   `json:"has_dark_room"`

	BuildingAge       *int32  `json:"building_age,omitempty"`
	BuildingStructure *string `json:"building_structure,omitempty"`
	ExteriorMaterial  *string `json:"exterior_material,omitempty"`
	BuildingUsage     *string `json:"building_usage,omitempty"`
	Zoning            *string `json:"zoning,omitempty"`
	UnitsOnFloor      *int32  `json:"units_on_floor,omitempty"`

	BuildingOrientation *string `json:"building_orientation,omitempty"`
	WindowOrientation   *string `json:"window_orientation,omitempty"`

	ParkingType   string   `json:"parking_type"`
	ManagementFee *float64 `json:"management_fee,omitempty"`
	SecurityType  string   `json:"security_type"`

	SetupStatus string               `json:"setup_status"`
	Attachments []AttachmentResponse `json:"attachments"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
```

- [ ] **Step 2: Create service.go**

```go
package property

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

var (
	ErrNotFound  = errors.New("property not found")
	ErrForbidden = errors.New("only the property owner can perform this action")
	ErrNotOwner  = errors.New("KYC verified owner credential required")
)

type Store interface {
	Create(ownerUserID int64, title, address string) (int64, error)
	FindByID(id int64) (*model.Property, error)
	ListByOwner(ownerUserID int64) ([]*model.Property, error)
	Update(p *model.Property) error
	SetSetupStatus(id int64, status string, updatedAt time.Time) error
	AddAttachment(propertyID int64, attachType, url string) (int64, error)
	DeleteAttachment(propertyID, attachmentID int64) error
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	repo     Store
	userRepo UserStore
}

func NewService(repo Store, userRepo UserStore) *Service {
	return &Service{repo: repo, userRepo: userRepo}
}

func (s *Service) Create(wallet, title, address string) (int64, error) {
	user, err := s.requireOwner(wallet)
	if err != nil {
		return 0, err
	}
	id, err := s.repo.Create(user.ID, title, address)
	if err != nil {
		return 0, fmt.Errorf("property: Create: %w", err)
	}
	return id, nil
}

func (s *Service) ListMine(wallet string) ([]*model.Property, error) {
	user, err := s.requireOwner(wallet)
	if err != nil {
		return nil, err
	}
	props, err := s.repo.ListByOwner(user.ID)
	if err != nil {
		return nil, fmt.Errorf("property: ListMine: %w", err)
	}
	for _, p := range props {
		atts, _ := s.repo.ListAttachments(p.ID)
		p.Attachments = atts
	}
	return props, nil
}

func (s *Service) GetForOwner(id int64, wallet string) (*model.Property, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("property: GetForOwner: %w", err)
	}
	if p == nil {
		return nil, ErrNotFound
	}
	user, err := s.requireOwner(wallet)
	if err != nil {
		return nil, err
	}
	if p.OwnerUserID != user.ID {
		return nil, ErrForbidden
	}
	atts, _ := s.repo.ListAttachments(p.ID)
	p.Attachments = atts
	return p, nil
}

func (s *Service) Update(id int64, wallet string, req UpdatePropertyRequest) error {
	p, err := s.GetForOwner(id, wallet)
	if err != nil {
		return err
	}
	applyUpdate(p, req)
	p.SetupStatus = computeSetupStatus(p)
	p.UpdatedAt = time.Now()
	if err := s.repo.Update(p); err != nil {
		return fmt.Errorf("property: Update: %w", err)
	}
	return nil
}

func (s *Service) AddAttachment(propertyID int64, wallet, attachType, url string) (int64, error) {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return 0, err
	}
	id, err := s.repo.AddAttachment(propertyID, attachType, url)
	if err != nil {
		return 0, fmt.Errorf("property: AddAttachment: %w", err)
	}
	// recompute setup status after adding attachment
	p, _ := s.repo.FindByID(propertyID)
	if p != nil {
		atts, _ := s.repo.ListAttachments(propertyID)
		p.Attachments = atts
		newStatus := computeSetupStatus(p)
		if newStatus != p.SetupStatus {
			_ = s.repo.SetSetupStatus(propertyID, newStatus, time.Now())
		}
	}
	return id, nil
}

func (s *Service) DeleteAttachment(propertyID, attachmentID int64, wallet string) error {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return err
	}
	return s.repo.DeleteAttachment(propertyID, attachmentID)
}

// computeSetupStatus applies the current completeness gate.
// Development gate: Section A fully filled + at least one PHOTO attachment.
func computeSetupStatus(p *model.Property) string {
	if p.Title == "" || p.Address == "" || p.BuildingType == "" {
		return model.PropertySetupDraft
	}
	hasPhoto := false
	for _, a := range p.Attachments {
		if a.Type == model.AttachmentTypePhoto {
			hasPhoto = true
			break
		}
	}
	if !hasPhoto {
		return model.PropertySetupDraft
	}
	return model.PropertySetupReady
}

func applyUpdate(p *model.Property, req UpdatePropertyRequest) {
	if req.Title != "" {
		p.Title = req.Title
	}
	if req.Address != "" {
		p.Address = req.Address
	}
	if req.BuildingType != "" {
		p.BuildingType = req.BuildingType
	}
	if req.Floor != nil {
		p.Floor = sql.NullInt32{Int32: *req.Floor, Valid: true}
	}
	if req.TotalFloors != nil {
		p.TotalFloors = sql.NullInt32{Int32: *req.TotalFloors, Valid: true}
	}
	if req.MainArea != nil {
		p.MainArea = sql.NullFloat64{Float64: *req.MainArea, Valid: true}
	}
	if req.AuxiliaryArea != nil {
		p.AuxiliaryArea = sql.NullFloat64{Float64: *req.AuxiliaryArea, Valid: true}
	}
	if req.BalconyArea != nil {
		p.BalconyArea = sql.NullFloat64{Float64: *req.BalconyArea, Valid: true}
	}
	if req.SharedArea != nil {
		p.SharedArea = sql.NullFloat64{Float64: *req.SharedArea, Valid: true}
	}
	if req.AwningArea != nil {
		p.AwningArea = sql.NullFloat64{Float64: *req.AwningArea, Valid: true}
	}
	if req.LandArea != nil {
		p.LandArea = sql.NullFloat64{Float64: *req.LandArea, Valid: true}
	}
	if req.Rooms != nil {
		p.Rooms = sql.NullInt32{Int32: *req.Rooms, Valid: true}
	}
	if req.LivingRooms != nil {
		p.LivingRooms = sql.NullInt32{Int32: *req.LivingRooms, Valid: true}
	}
	if req.Bathrooms != nil {
		p.Bathrooms = sql.NullInt32{Int32: *req.Bathrooms, Valid: true}
	}
	if req.IsCornerUnit != nil {
		p.IsCornerUnit = *req.IsCornerUnit
	}
	if req.HasDarkRoom != nil {
		p.HasDarkRoom = *req.HasDarkRoom
	}
	if req.BuildingAge != nil {
		p.BuildingAge = sql.NullInt32{Int32: *req.BuildingAge, Valid: true}
	}
	if req.BuildingStructure != nil {
		p.BuildingStructure = sql.NullString{String: *req.BuildingStructure, Valid: true}
	}
	if req.ExteriorMaterial != nil {
		p.ExteriorMaterial = sql.NullString{String: *req.ExteriorMaterial, Valid: true}
	}
	if req.BuildingUsage != nil {
		p.BuildingUsage = sql.NullString{String: *req.BuildingUsage, Valid: true}
	}
	if req.Zoning != nil {
		p.Zoning = sql.NullString{String: *req.Zoning, Valid: true}
	}
	if req.UnitsOnFloor != nil {
		p.UnitsOnFloor = sql.NullInt32{Int32: *req.UnitsOnFloor, Valid: true}
	}
	if req.BuildingOrientation != nil {
		p.BuildingOrientation = sql.NullString{String: *req.BuildingOrientation, Valid: true}
	}
	if req.WindowOrientation != nil {
		p.WindowOrientation = sql.NullString{String: *req.WindowOrientation, Valid: true}
	}
	if req.ParkingType != nil {
		p.ParkingType = *req.ParkingType
	}
	if req.ManagementFee != nil {
		p.ManagementFee = sql.NullFloat64{Float64: *req.ManagementFee, Valid: true}
	}
	if req.SecurityType != nil {
		p.SecurityType = *req.SecurityType
	}
}

func (s *Service) requireOwner(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, fmt.Errorf("property: lookup user: %w", err)
	}
	if user == nil {
		return nil, ErrNotOwner
	}
	return user, nil
}
```

- [ ] **Step 3: Create handler.go**

```go
package property

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(wallet, title, address string) (int64, error)
	ListMine(wallet string) ([]*model.Property, error)
	GetForOwner(id int64, wallet string) (*model.Property, error)
	Update(id int64, wallet string, req UpdatePropertyRequest) error
	AddAttachment(propertyID int64, wallet, attachType, url string) (int64, error)
	DeleteAttachment(propertyID, attachmentID int64, wallet string) error
}

type Handler struct {
	svc APIService
}

func NewHandler(svc APIService) *Handler {
	return &Handler{svc: svc}
}

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func (h *Handler) Create(c *gin.Context) {
	var req CreatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.Create(walletFrom(c), req.Title, req.Address)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

func (h *Handler) ListMine(c *gin.Context) {
	props, err := h.svc.ListMine(walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	resp := make([]PropertyResponse, 0, len(props))
	for _, p := range props {
		resp = append(resp, toPropertyResponse(p))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	p, err := h.svc.GetForOwner(id, walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toPropertyResponse(p)})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req UpdatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Update(id, walletFrom(c), req); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

func (h *Handler) AddAttachment(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req struct {
		Type string `json:"type" binding:"required,oneof=PHOTO DEED FLOOR_PLAN DISCLOSURE"`
		URL  string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	attachID, err := h.svc.AddAttachment(id, walletFrom(c), req.Type, req.URL)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": attachID}})
}

func (h *Handler) DeleteAttachment(c *gin.Context) {
	propID, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	attachID, err := strconv.ParseInt(c.Param("aid"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid attachment id"})
		return
	}
	if err := h.svc.DeleteAttachment(propID, attachID, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "deleted"})
}

func toPropertyResponse(p *model.Property) PropertyResponse {
	resp := PropertyResponse{
		ID:           p.ID,
		OwnerUserID:  p.OwnerUserID,
		Title:        p.Title,
		Address:      p.Address,
		BuildingType: p.BuildingType,
		IsCornerUnit: p.IsCornerUnit,
		HasDarkRoom:  p.HasDarkRoom,
		ParkingType:  p.ParkingType,
		SecurityType: p.SecurityType,
		SetupStatus:  p.SetupStatus,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
	if p.DistrictID.Valid {
		v := p.DistrictID.Int64
		resp.DistrictID = &v
	}
	if p.Floor.Valid {
		v := p.Floor.Int32
		resp.Floor = &v
	}
	if p.TotalFloors.Valid {
		v := p.TotalFloors.Int32
		resp.TotalFloors = &v
	}
	if p.MainArea.Valid {
		v := p.MainArea.Float64
		resp.MainArea = &v
	}
	if p.AuxiliaryArea.Valid {
		v := p.AuxiliaryArea.Float64
		resp.AuxiliaryArea = &v
	}
	if p.BalconyArea.Valid {
		v := p.BalconyArea.Float64
		resp.BalconyArea = &v
	}
	if p.SharedArea.Valid {
		v := p.SharedArea.Float64
		resp.SharedArea = &v
	}
	if p.AwningArea.Valid {
		v := p.AwningArea.Float64
		resp.AwningArea = &v
	}
	if p.LandArea.Valid {
		v := p.LandArea.Float64
		resp.LandArea = &v
	}
	if p.Rooms.Valid {
		v := p.Rooms.Int32
		resp.Rooms = &v
	}
	if p.LivingRooms.Valid {
		v := p.LivingRooms.Int32
		resp.LivingRooms = &v
	}
	if p.Bathrooms.Valid {
		v := p.Bathrooms.Int32
		resp.Bathrooms = &v
	}
	if p.BuildingAge.Valid {
		v := p.BuildingAge.Int32
		resp.BuildingAge = &v
	}
	if p.BuildingStructure.Valid {
		resp.BuildingStructure = &p.BuildingStructure.String
	}
	if p.ExteriorMaterial.Valid {
		resp.ExteriorMaterial = &p.ExteriorMaterial.String
	}
	if p.BuildingUsage.Valid {
		resp.BuildingUsage = &p.BuildingUsage.String
	}
	if p.Zoning.Valid {
		resp.Zoning = &p.Zoning.String
	}
	if p.UnitsOnFloor.Valid {
		v := p.UnitsOnFloor.Int32
		resp.UnitsOnFloor = &v
	}
	if p.BuildingOrientation.Valid {
		resp.BuildingOrientation = &p.BuildingOrientation.String
	}
	if p.WindowOrientation.Valid {
		resp.WindowOrientation = &p.WindowOrientation.String
	}
	if p.ManagementFee.Valid {
		resp.ManagementFee = &p.ManagementFee.Float64
	}
	resp.Attachments = make([]AttachmentResponse, 0, len(p.Attachments))
	for _, a := range p.Attachments {
		resp.Attachments = append(resp.Attachments, AttachmentResponse{
			ID: a.ID, Type: a.Type, URL: a.URL, CreatedAt: a.CreatedAt,
		})
	}
	return resp
}

func handleErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrNotOwner):
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
	}
}

func parseID(c *gin.Context) (int64, error) {
	return strconv.ParseInt(c.Param("id"), 10, 64)
}
```

- [ ] **Step 4: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/modules/property/ && \
git commit -m "feat: add property module (DTOs, service, handler)"
```

---

## Task 9: New `rental_listing` repository

**Files:**
- Create: `internal/db/repository/rental_listing_repo.go`

- [ ] **Step 1: Create file**

```go
package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type RentalListingRepository struct {
	db *sql.DB
}

func NewRentalListingRepository(db *sql.DB) *RentalListingRepository {
	return &RentalListingRepository{db: db}
}

func (r *RentalListingRepository) Create(propertyID int64, monthlyRent, depositMonths float64, minLeaseMonths int, managementFeePayer string, allowPets, allowCooking bool, durationDays int) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO rental_listing
		    (property_id, status, duration_days, monthly_rent, deposit_months,
		     management_fee_payer, min_lease_months, allow_pets, allow_cooking, created_at, updated_at)
		VALUES ($1, 'DRAFT', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING id`,
		propertyID, durationDays, monthlyRent, depositMonths,
		managementFeePayer, minLeaseMonths, allowPets, allowCooking,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("rental_listing_repo: Create: %w", err)
	}
	return id, nil
}

func (r *RentalListingRepository) FindByID(id int64) (*model.RentalListing, error) {
	row := r.db.QueryRow(`
		SELECT id, property_id, status, duration_days,
		       monthly_rent, deposit_months, management_fee_payer,
		       min_lease_months, allow_pets, allow_cooking,
		       gender_restriction, notes, published_at, expires_at,
		       created_at, updated_at
		FROM rental_listing WHERE id = $1`, id)
	rl, err := scanRentalListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: FindByID: %w", err)
	}
	return rl, nil
}

func (r *RentalListingRepository) FindActiveByProperty(propertyID int64) (*model.RentalListing, error) {
	row := r.db.QueryRow(`
		SELECT id, property_id, status, duration_days,
		       monthly_rent, deposit_months, management_fee_payer,
		       min_lease_months, allow_pets, allow_cooking,
		       gender_restriction, notes, published_at, expires_at,
		       created_at, updated_at
		FROM rental_listing WHERE property_id = $1
		ORDER BY created_at DESC LIMIT 1`, propertyID)
	rl, err := scanRentalListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: FindActiveByProperty: %w", err)
	}
	return rl, nil
}

func (r *RentalListingRepository) ListPublic() ([]*model.RentalListing, error) {
	rows, err := r.db.Query(`
		SELECT rl.id, rl.property_id, rl.status, rl.duration_days,
		       rl.monthly_rent, rl.deposit_months, rl.management_fee_payer,
		       rl.min_lease_months, rl.allow_pets, rl.allow_cooking,
		       rl.gender_restriction, rl.notes, rl.published_at, rl.expires_at,
		       rl.created_at, rl.updated_at
		FROM rental_listing rl
		WHERE rl.status = 'ACTIVE'
		ORDER BY rl.published_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("rental_listing_repo: ListPublic: %w", err)
	}
	defer rows.Close()
	return scanRentalListings(rows)
}

func (r *RentalListingRepository) Update(rl *model.RentalListing) error {
	_, err := r.db.Exec(`
		UPDATE rental_listing SET
		    duration_days=$1, monthly_rent=$2, deposit_months=$3,
		    management_fee_payer=$4, min_lease_months=$5,
		    allow_pets=$6, allow_cooking=$7,
		    gender_restriction=$8, notes=$9, updated_at=NOW()
		WHERE id=$10`,
		rl.DurationDays, rl.MonthlyRent, rl.DepositMonths,
		rl.ManagementFeePayer, rl.MinLeaseMonths,
		rl.AllowPets, rl.AllowCooking,
		rl.GenderRestriction, rl.Notes, rl.ID,
	)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: Update: %w", err)
	}
	return nil
}

func (r *RentalListingRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE rental_listing SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: SetStatus: %w", err)
	}
	return nil
}

func (r *RentalListingRepository) Publish(id int64, durationDays int) error {
	_, err := r.db.Exec(`
		UPDATE rental_listing
		SET status='ACTIVE', duration_days=$1,
		    published_at=NOW(), expires_at=NOW() + ($1 * INTERVAL '1 day'),
		    updated_at=NOW()
		WHERE id=$2`, durationDays, id)
	if err != nil {
		return fmt.Errorf("rental_listing_repo: Publish: %w", err)
	}
	return nil
}

func scanRentalListing(row *sql.Row) (*model.RentalListing, error) {
	rl := &model.RentalListing{}
	return rl, row.Scan(
		&rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
		&rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
		&rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
		&rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
		&rl.CreatedAt, &rl.UpdatedAt,
	)
}

func scanRentalListings(rows *sql.Rows) ([]*model.RentalListing, error) {
	var out []*model.RentalListing
	for rows.Next() {
		rl := &model.RentalListing{}
		if err := rows.Scan(
			&rl.ID, &rl.PropertyID, &rl.Status, &rl.DurationDays,
			&rl.MonthlyRent, &rl.DepositMonths, &rl.ManagementFeePayer,
			&rl.MinLeaseMonths, &rl.AllowPets, &rl.AllowCooking,
			&rl.GenderRestriction, &rl.Notes, &rl.PublishedAt, &rl.ExpiresAt,
			&rl.CreatedAt, &rl.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan rental_listing: %w", err)
		}
		out = append(out, rl)
	}
	return out, rows.Err()
}
```

- [ ] **Step 2: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/db/repository/rental_listing_repo.go && \
git commit -m "feat: add RentalListingRepository"
```

---

## Task 10: New `rental_listing` module — DTO, service, handler

**Files:**
- Create: `internal/modules/rental_listing/dto.go`
- Create: `internal/modules/rental_listing/service.go`
- Create: `internal/modules/rental_listing/handler.go`

- [ ] **Step 1: Create dto.go**

```go
package rental_listing

import "time"

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
}

type RentalListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	MonthlyRent        float64  `json:"monthly_rent"`
	DepositMonths      float64  `json:"deposit_months"`
	ManagementFeePayer string   `json:"management_fee_payer"`
	MinLeaseMonths     int      `json:"min_lease_months"`
	AllowPets          bool     `json:"allow_pets"`
	AllowCooking       bool     `json:"allow_cooking"`
	GenderRestriction  *string  `json:"gender_restriction,omitempty"`
	Notes              *string  `json:"notes,omitempty"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
```

- [ ] **Step 2: Create service.go**

```go
package rental_listing

import (
	"database/sql"
	"errors"
	"fmt"

	"go-service/internal/db/model"
)

var (
	ErrNotFound        = errors.New("rental listing not found")
	ErrForbidden       = errors.New("only the property owner can manage this listing")
	ErrPropertyNotReady = errors.New("property must be READY before creating a listing")
)

type Store interface {
	Create(propertyID int64, monthlyRent, depositMonths float64, minLeaseMonths int, managementFeePayer string, allowPets, allowCooking bool, durationDays int) (int64, error)
	FindByID(id int64) (*model.RentalListing, error)
	FindActiveByProperty(propertyID int64) (*model.RentalListing, error)
	ListPublic() ([]*model.RentalListing, error)
	Update(rl *model.RentalListing) error
	SetStatus(id int64, status string) error
	Publish(id int64, durationDays int) error
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
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
	id, err := s.repo.Create(
		propertyID,
		req.MonthlyRent, req.DepositMonths,
		req.MinLeaseMonths, req.ManagementFeePayer,
		req.AllowPets, req.AllowCooking, req.DurationDays,
	)
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
	rl.Property = prop
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
}
```

- [ ] **Step 3: Create handler.go**

```go
package rental_listing

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error)
	ListPublic() ([]*model.RentalListing, error)
	GetByID(id int64) (*model.RentalListing, error)
	Update(id int64, wallet string, req UpdateRentalListingRequest) error
	Publish(id int64, wallet string, durationDays int) error
	Close(id int64, wallet string) error
}

type Handler struct{ svc APIService }

func NewHandler(svc APIService) *Handler { return &Handler{svc: svc} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func (h *Handler) ListPublic(c *gin.Context) {
	rls, err := h.svc.ListPublic()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	resp := make([]RentalListingResponse, 0, len(rls))
	for _, rl := range rls {
		resp = append(resp, toResponse(rl))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	rl, err := h.svc.GetByID(id)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(rl)})
}

func (h *Handler) Create(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	var req CreateRentalListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.Create(propID, walletFrom(c), req)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req UpdateRentalListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Update(id, walletFrom(c), req); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

func (h *Handler) Publish(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req struct {
		DurationDays int `json:"duration_days" binding:"required,min=7"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Publish(id, walletFrom(c), req.DurationDays); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "published"})
}

func (h *Handler) Close(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := h.svc.Close(id, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "closed"})
}

func toResponse(rl *model.RentalListing) RentalListingResponse {
	resp := RentalListingResponse{
		ID: rl.ID, PropertyID: rl.PropertyID,
		Status: rl.Status, DurationDays: rl.DurationDays,
		MonthlyRent: rl.MonthlyRent, DepositMonths: rl.DepositMonths,
		ManagementFeePayer: rl.ManagementFeePayer, MinLeaseMonths: rl.MinLeaseMonths,
		AllowPets: rl.AllowPets, AllowCooking: rl.AllowCooking,
		CreatedAt: rl.CreatedAt, UpdatedAt: rl.UpdatedAt,
	}
	if rl.GenderRestriction.Valid {
		resp.GenderRestriction = &rl.GenderRestriction.String
	}
	if rl.Notes.Valid {
		resp.Notes = &rl.Notes.String
	}
	if rl.PublishedAt.Valid {
		resp.PublishedAt = &rl.PublishedAt.Time
	}
	if rl.ExpiresAt.Valid {
		resp.ExpiresAt = &rl.ExpiresAt.Time
	}
	return resp
}

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

- [ ] **Step 4: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/modules/rental_listing/ internal/db/repository/rental_listing_repo.go && \
git commit -m "feat: add rental_listing module (repo, service, handler)"
```

---

## Task 11: New `sale_listing` repository and module

**Files:**
- Create: `internal/db/repository/sale_listing_repo.go`
- Create: `internal/modules/sale_listing/dto.go`
- Create: `internal/modules/sale_listing/service.go`
- Create: `internal/modules/sale_listing/handler.go`

- [ ] **Step 1: Create sale_listing_repo.go**

```go
package repository

import (
	"database/sql"
	"fmt"

	"go-service/internal/db/model"
)

type SaleListingRepository struct {
	db *sql.DB
}

func NewSaleListingRepository(db *sql.DB) *SaleListingRepository {
	return &SaleListingRepository{db: db}
}

const saleListingCols = `id, property_id, status, duration_days,
    total_price, unit_price_per_ping, parking_type, parking_price,
    notes, published_at, expires_at, created_at, updated_at`

func (r *SaleListingRepository) Create(propertyID int64, totalPrice float64, durationDays int) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO sale_listing (property_id, status, duration_days, total_price, created_at, updated_at)
		VALUES ($1, 'DRAFT', $2, $3, NOW(), NOW()) RETURNING id`,
		propertyID, durationDays, totalPrice,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("sale_listing_repo: Create: %w", err)
	}
	return id, nil
}

func (r *SaleListingRepository) FindByID(id int64) (*model.SaleListing, error) {
	row := r.db.QueryRow(`SELECT `+saleListingCols+` FROM sale_listing WHERE id=$1`, id)
	sl, err := scanSaleListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sale_listing_repo: FindByID: %w", err)
	}
	return sl, nil
}

func (r *SaleListingRepository) ListPublic() ([]*model.SaleListing, error) {
	rows, err := r.db.Query(`SELECT ` + saleListingCols + ` FROM sale_listing WHERE status='ACTIVE' ORDER BY published_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("sale_listing_repo: ListPublic: %w", err)
	}
	defer rows.Close()
	return scanSaleListings(rows)
}

func (r *SaleListingRepository) Update(sl *model.SaleListing) error {
	_, err := r.db.Exec(`
		UPDATE sale_listing SET
		    duration_days=$1, total_price=$2, unit_price_per_ping=$3,
		    parking_type=$4, parking_price=$5, notes=$6, updated_at=NOW()
		WHERE id=$7`,
		sl.DurationDays, sl.TotalPrice, sl.UnitPricePerPing,
		sl.ParkingType, sl.ParkingPrice, sl.Notes, sl.ID,
	)
	if err != nil {
		return fmt.Errorf("sale_listing_repo: Update: %w", err)
	}
	return nil
}

func (r *SaleListingRepository) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE sale_listing SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	return err
}

func (r *SaleListingRepository) Publish(id int64, durationDays int) error {
	_, err := r.db.Exec(`
		UPDATE sale_listing
		SET status='ACTIVE', duration_days=$1,
		    published_at=NOW(), expires_at=NOW() + ($1 * INTERVAL '1 day'),
		    updated_at=NOW()
		WHERE id=$2`, durationDays, id)
	return err
}

func scanSaleListing(row *sql.Row) (*model.SaleListing, error) {
	sl := &model.SaleListing{}
	return sl, row.Scan(
		&sl.ID, &sl.PropertyID, &sl.Status, &sl.DurationDays,
		&sl.TotalPrice, &sl.UnitPricePerPing, &sl.ParkingType, &sl.ParkingPrice,
		&sl.Notes, &sl.PublishedAt, &sl.ExpiresAt, &sl.CreatedAt, &sl.UpdatedAt,
	)
}

func scanSaleListings(rows *sql.Rows) ([]*model.SaleListing, error) {
	var out []*model.SaleListing
	for rows.Next() {
		sl := &model.SaleListing{}
		if err := rows.Scan(
			&sl.ID, &sl.PropertyID, &sl.Status, &sl.DurationDays,
			&sl.TotalPrice, &sl.UnitPricePerPing, &sl.ParkingType, &sl.ParkingPrice,
			&sl.Notes, &sl.PublishedAt, &sl.ExpiresAt, &sl.CreatedAt, &sl.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan sale_listing: %w", err)
		}
		out = append(out, sl)
	}
	return out, rows.Err()
}
```

- [ ] **Step 2: Create sale_listing/dto.go**

```go
package sale_listing

import "time"

type CreateSaleListingRequest struct {
	TotalPrice       float64  `json:"total_price" binding:"required,min=0"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping"`
	ParkingType      *string  `json:"parking_type"`
	ParkingPrice     *float64 `json:"parking_price"`
	Notes            *string  `json:"notes"`
	DurationDays     int      `json:"duration_days" binding:"min=7"`
}

type UpdateSaleListingRequest struct {
	TotalPrice       *float64 `json:"total_price"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping"`
	ParkingType      *string  `json:"parking_type"`
	ParkingPrice     *float64 `json:"parking_price"`
	Notes            *string  `json:"notes"`
	DurationDays     *int     `json:"duration_days"`
}

type SaleListingResponse struct {
	ID         int64 `json:"id"`
	PropertyID int64 `json:"property_id"`

	Status       string `json:"status"`
	DurationDays int    `json:"duration_days"`

	TotalPrice       float64  `json:"total_price"`
	UnitPricePerPing *float64 `json:"unit_price_per_ping,omitempty"`
	ParkingType      *string  `json:"parking_type,omitempty"`
	ParkingPrice     *float64 `json:"parking_price,omitempty"`
	Notes            *string  `json:"notes,omitempty"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
```

- [ ] **Step 3: Create sale_listing/service.go**

```go
package sale_listing

import (
	"database/sql"
	"errors"
	"fmt"

	"go-service/internal/db/model"
)

var (
	ErrNotFound        = errors.New("sale listing not found")
	ErrForbidden       = errors.New("only the property owner can manage this listing")
	ErrPropertyNotReady = errors.New("property must be READY before creating a listing")
)

type Store interface {
	Create(propertyID int64, totalPrice float64, durationDays int) (int64, error)
	FindByID(id int64) (*model.SaleListing, error)
	ListPublic() ([]*model.SaleListing, error)
	Update(sl *model.SaleListing) error
	SetStatus(id int64, status string) error
	Publish(id int64, durationDays int) error
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
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

func (s *Service) Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return 0, err
	}
	prop, _ := s.propertyRepo.FindByID(propertyID)
	if prop == nil || prop.SetupStatus != model.PropertySetupReady {
		return 0, ErrPropertyNotReady
	}
	id, err := s.repo.Create(propertyID, req.TotalPrice, req.DurationDays)
	if err != nil {
		return 0, fmt.Errorf("sale_listing: Create: %w", err)
	}
	if req.UnitPricePerPing != nil || req.ParkingType != nil || req.Notes != nil {
		sl, _ := s.repo.FindByID(id)
		if sl != nil {
			applyUpdate(sl, UpdateSaleListingRequest{
				UnitPricePerPing: req.UnitPricePerPing,
				ParkingType:      req.ParkingType,
				ParkingPrice:     req.ParkingPrice,
				Notes:            req.Notes,
			})
			_ = s.repo.Update(sl)
		}
	}
	return id, nil
}

func (s *Service) ListPublic() ([]*model.SaleListing, error) {
	sls, err := s.repo.ListPublic()
	if err != nil {
		return nil, err
	}
	for _, sl := range sls {
		prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
		sl.Property = prop
	}
	return sls, nil
}

func (s *Service) GetByID(id int64) (*model.SaleListing, error) {
	sl, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if sl == nil {
		return nil, ErrNotFound
	}
	prop, _ := s.propertyRepo.FindByID(sl.PropertyID)
	sl.Property = prop
	return sl, nil
}

func (s *Service) Update(id int64, wallet string, req UpdateSaleListingRequest) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	applyUpdate(sl, req)
	return s.repo.Update(sl)
}

func (s *Service) Publish(id int64, wallet string, durationDays int) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	return s.repo.Publish(id, durationDays)
}

func (s *Service) Close(id int64, wallet string) error {
	sl, err := s.repo.FindByID(id)
	if err != nil || sl == nil {
		return ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, sl.PropertyID); err != nil {
		return err
	}
	return s.repo.SetStatus(id, model.SaleListingStatusClosed)
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

func applyUpdate(sl *model.SaleListing, req UpdateSaleListingRequest) {
	if req.TotalPrice != nil {
		sl.TotalPrice = *req.TotalPrice
	}
	if req.UnitPricePerPing != nil {
		sl.UnitPricePerPing = sql.NullFloat64{Float64: *req.UnitPricePerPing, Valid: true}
	}
	if req.ParkingType != nil {
		sl.ParkingType = sql.NullString{String: *req.ParkingType, Valid: true}
	}
	if req.ParkingPrice != nil {
		sl.ParkingPrice = sql.NullFloat64{Float64: *req.ParkingPrice, Valid: true}
	}
	if req.Notes != nil {
		sl.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}
	if req.DurationDays != nil {
		sl.DurationDays = *req.DurationDays
	}
}
```

- [ ] **Step 4: Create sale_listing/handler.go**

```go
package sale_listing

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error)
	ListPublic() ([]*model.SaleListing, error)
	GetByID(id int64) (*model.SaleListing, error)
	Update(id int64, wallet string, req UpdateSaleListingRequest) error
	Publish(id int64, wallet string, durationDays int) error
	Close(id int64, wallet string) error
}

type Handler struct{ svc APIService }

func NewHandler(svc APIService) *Handler { return &Handler{svc: svc} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func (h *Handler) ListPublic(c *gin.Context) {
	sls, err := h.svc.ListPublic()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	resp := make([]SaleListingResponse, 0, len(sls))
	for _, sl := range sls {
		resp = append(resp, toResponse(sl))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	sl, err := h.svc.GetByID(id)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(sl)})
}

func (h *Handler) Create(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	var req CreateSaleListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.Create(propID, walletFrom(c), req)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req UpdateSaleListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Update(id, walletFrom(c), req); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

func (h *Handler) Publish(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req struct {
		DurationDays int `json:"duration_days" binding:"required,min=7"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Publish(id, walletFrom(c), req.DurationDays); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "published"})
}

func (h *Handler) Close(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := h.svc.Close(id, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "closed"})
}

func toResponse(sl *model.SaleListing) SaleListingResponse {
	resp := SaleListingResponse{
		ID: sl.ID, PropertyID: sl.PropertyID,
		Status: sl.Status, DurationDays: sl.DurationDays,
		TotalPrice: sl.TotalPrice,
		CreatedAt: sl.CreatedAt, UpdatedAt: sl.UpdatedAt,
	}
	if sl.UnitPricePerPing.Valid {
		resp.UnitPricePerPing = &sl.UnitPricePerPing.Float64
	}
	if sl.ParkingType.Valid {
		resp.ParkingType = &sl.ParkingType.String
	}
	if sl.ParkingPrice.Valid {
		resp.ParkingPrice = &sl.ParkingPrice.Float64
	}
	if sl.Notes.Valid {
		resp.Notes = &sl.Notes.String
	}
	if sl.PublishedAt.Valid {
		resp.PublishedAt = &sl.PublishedAt.Time
	}
	if sl.ExpiresAt.Valid {
		resp.ExpiresAt = &sl.ExpiresAt.Time
	}
	return resp
}

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

- [ ] **Step 5: Build and commit**

```bash
cd go-service && go build ./... && \
git add internal/db/repository/sale_listing_repo.go internal/modules/sale_listing/ && \
git commit -m "feat: add sale_listing module (repo, service, handler)"
```

---

## Task 12: Wire new modules into bootstrap

**Files:**
- Modify: `internal/bootstrap/wiring.go`
- Modify: `internal/bootstrap/router.go`

- [ ] **Step 1: Add imports to wiring.go**

Add to the import block (alongside existing module imports):
```go
propertymod     "go-service/internal/modules/property"
rentallistingmod "go-service/internal/modules/rental_listing"
salelistingmod  "go-service/internal/modules/sale_listing"
```

- [ ] **Step 2: Add repos and handlers in Wire() after existing ones**

After `agentProfileRepo` and before the modules section, add:
```go
newPropertyRepo      := repository.NewPropertyRepository(postgresDB)
rentalListingRepo    := repository.NewRentalListingRepository(postgresDB)
saleListingRepo      := repository.NewSaleListingRepository(postgresDB)
```

After the existing listing/property module wiring (around line 217), add:
```go
// ── New property + listing modules ───────────────────────────
newPropertySvc   := propertymod.NewService(newPropertyRepo, userRepo)
newPropertyHandler := propertymod.NewHandler(newPropertySvc)

rentalListingSvc  := rentallistingmod.NewService(rentalListingRepo, newPropertyRepo, userRepo)
rentalListingHandler := rentallistingmod.NewHandler(rentalListingSvc)

saleListingSvc   := salelistingmod.NewService(saleListingRepo, newPropertyRepo, userRepo)
saleListingHandler := salelistingmod.NewHandler(saleListingSvc)
```

- [ ] **Step 3: Pass new handlers to SetupRouter**

Update the `SetupRouter(...)` call to include:
```go
r := SetupRouter(
    // ... existing handlers ...
    newPropertyHandler,
    rentalListingHandler,
    saleListingHandler,
)
```

- [ ] **Step 4: Update SetupRouter signature in router.go**

Add parameters to `SetupRouter`:
```go
func SetupRouter(
    // ... existing params ...
    newPropertyHandler  *property.Handler,
    rentalListingHandler *rental_listing.Handler,
    saleListingHandler  *sale_listing.Handler,
) *gin.Engine {
```

Add imports:
```go
propertymod      "go-service/internal/modules/property"
rentallistingmod "go-service/internal/modules/rental_listing"
salelistingmod   "go-service/internal/modules/sale_listing"
```

- [ ] **Step 5: Add routes to router.go**

Inside `SetupRouter`, add to the public group:
```go
// Public property listing routes
public.GET("/rental-listing",      rentalListingHandler.ListPublic)
public.GET("/rental-listing/:id",  rentalListingHandler.Get)
public.GET("/sale-listing",        saleListingHandler.ListPublic)
public.GET("/sale-listing/:id",    saleListingHandler.Get)
```

Add to the protected group:
```go
// Property management (owner)
protected.POST("/property",                           newPropertyHandler.Create)
protected.GET("/property",                            newPropertyHandler.ListMine)
protected.GET("/property/:id",                        newPropertyHandler.Get)
protected.PUT("/property/:id",                        newPropertyHandler.Update)
protected.POST("/property/:id/attachment",            newPropertyHandler.AddAttachment)
protected.DELETE("/property/:id/attachment/:aid",     newPropertyHandler.DeleteAttachment)

// Rental listing (owner)
protected.POST("/property/:id/rental-listing",        rentalListingHandler.Create)
protected.PUT("/rental-listing/:id",                  rentalListingHandler.Update)
protected.POST("/rental-listing/:id/publish",         rentalListingHandler.Publish)
protected.POST("/rental-listing/:id/close",           rentalListingHandler.Close)

// Sale listing (owner)
protected.POST("/property/:id/sale-listing",          saleListingHandler.Create)
protected.PUT("/sale-listing/:id",                    saleListingHandler.Update)
protected.POST("/sale-listing/:id/publish",           saleListingHandler.Publish)
protected.POST("/sale-listing/:id/close",             saleListingHandler.Close)
```

- [ ] **Step 6: Full build**

```bash
cd go-service && go build ./...
```

Expected: 0 errors.

- [ ] **Step 7: Rebuild Docker and smoke test**

```bash
cd go-service && docker compose up --build -d
sleep 5
curl -s http://localhost:8081/api/rental-listing | jq '.success'
curl -s http://localhost:8081/api/sale-listing   | jq '.success'
```

Expected: `true` for both.

- [ ] **Step 8: Commit**

```bash
git add internal/bootstrap/wiring.go internal/bootstrap/router.go && \
git commit -m "feat: wire property/rental_listing/sale_listing modules, add API routes"
```

---

## Self-Review

1. **Spec coverage:**
   - ✅ `property` table with all 591-style fields
   - ✅ `property_attachment` table
   - ✅ `rental_listing` table and module
   - ✅ `sale_listing` table and module
   - ✅ `properties` → `customer` rename throughout
   - ✅ All CRUD + publish/close endpoints
   - ✅ Completeness gate (Section A + photo → READY)

2. **Placeholder scan:** No TBD/TODO present.

3. **Type consistency:**
   - `model.Property` used consistently in new property repo/service/handler
   - `model.Customer` used in renamed KYC module
   - `PropertySetupReady`/`PropertySetupDraft` constants match schema values `'READY'`/`'DRAFT'`
   - `RentalListingStatusClosed` = `"CLOSED"` matches DB constraint

4. **Known gaps:**
   - Frontend API client (`src/api/propertyApi.ts`) is out of scope — covered in frontend plan
   - Appointment system for rental/sale listings is out of scope (existing listing module unchanged)
   - `listing` table rename (`listings` → `listing`) deferred to a future cleanup plan
