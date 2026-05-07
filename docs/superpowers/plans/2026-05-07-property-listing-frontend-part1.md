# Property Listing Frontend — Part 1 Implementation Plan
# (Backend fix + API clients + Header + Router + MyPropertiesPage + PropertyCreatePage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix backend listing responses to include property data, add three new API clients, split header nav, wire all new routes, and build the first two owner pages.

**Architecture:** New `propertyApi.ts` / `rentalListingApi.ts` / `saleListingApi.ts` mirror the Go module structure. All pages use `SiteLayout` + `useState`/`useEffect` + native fetch. No new dependencies.

**Tech Stack:** React 19, TypeScript strict, React Router v7, Tailwind, native fetch.

---

## File Map

| Action | Path |
|---|---|
| Modify | `go-service/internal/modules/rental_listing/dto.go` |
| Modify | `go-service/internal/modules/rental_listing/handler.go` |
| Modify | `go-service/internal/modules/rental_listing/service.go` |
| Modify | `go-service/internal/modules/sale_listing/dto.go` |
| Modify | `go-service/internal/modules/sale_listing/handler.go` |
| Modify | `go-service/internal/modules/sale_listing/service.go` |
| Modify | `go-service/internal/bootstrap/router.go` |
| Create | `react-service/src/api/propertyApi.ts` |
| Create | `react-service/src/api/rentalListingApi.ts` |
| Create | `react-service/src/api/saleListingApi.ts` |
| Modify | `react-service/src/components/common/Header.tsx` |
| Modify | `react-service/src/router/index.tsx` |
| Create | `react-service/src/pages/MyPropertiesPage.tsx` |
| Create | `react-service/src/pages/PropertyCreatePage.tsx` |

---

### Task 1: Backend — expose property data in listing public responses + add GetForProperty endpoints

The listing service already loads `rl.Property` in `ListPublic` and `GetByID`, but `toResponse` never puts that data in the JSON. Public list/detail pages need address, rooms, floor, etc. Also, `RentalListingPage` and `SaleListingPage` need to load the existing active listing for a property (no such endpoint exists yet).

**Files:**
- Modify: `go-service/internal/modules/rental_listing/dto.go`
- Modify: `go-service/internal/modules/rental_listing/handler.go`
- Modify: `go-service/internal/modules/rental_listing/service.go`
- Modify: `go-service/internal/modules/sale_listing/dto.go`
- Modify: `go-service/internal/modules/sale_listing/handler.go`
- Modify: `go-service/internal/modules/sale_listing/service.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [ ] **Step 1: Add PropertySummaryResponse to rental_listing/dto.go**

Replace the full `dto.go` with:

```go
package rental_listing

import "time"

type PropertySummaryResponse struct {
	ID           int64    `json:"id"`
	Title        string   `json:"title"`
	Address      string   `json:"address"`
	BuildingType string   `json:"building_type"`
	Floor        *int32   `json:"floor,omitempty"`
	TotalFloors  *int32   `json:"total_floors,omitempty"`
	MainArea     *float64 `json:"main_area,omitempty"`
	AuxiliaryArea *float64 `json:"auxiliary_area,omitempty"`
	BalconyArea  *float64 `json:"balcony_area,omitempty"`
	Rooms        *int32   `json:"rooms,omitempty"`
	LivingRooms  *int32   `json:"living_rooms,omitempty"`
	Bathrooms    *int32   `json:"bathrooms,omitempty"`
	BuildingAge  *int32   `json:"building_age,omitempty"`
	ParkingType  string   `json:"parking_type"`
	ManagementFee *float64 `json:"management_fee,omitempty"`
	IsCornerUnit bool     `json:"is_corner_unit"`
	SecurityType string   `json:"security_type"`
	BuildingOrientation *string `json:"building_orientation,omitempty"`
	WindowOrientation   *string `json:"window_orientation,omitempty"`
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

	MonthlyRent        float64 `json:"monthly_rent"`
	DepositMonths      float64 `json:"deposit_months"`
	ManagementFeePayer string  `json:"management_fee_payer"`
	MinLeaseMonths     int     `json:"min_lease_months"`
	AllowPets          bool    `json:"allow_pets"`
	AllowCooking       bool    `json:"allow_cooking"`
	GenderRestriction  *string `json:"gender_restriction,omitempty"`
	Notes              *string `json:"notes,omitempty"`

	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Property *PropertySummaryResponse `json:"property,omitempty"`
}
```

- [ ] **Step 2: Update toResponse in rental_listing/handler.go to populate Property**

After the existing null-check assignments in `toResponse`, add before `return resp`:

```go
if rl.Property != nil {
	p := rl.Property
	pResp := PropertySummaryResponse{
		ID: p.ID, Title: p.Title, Address: p.Address,
		BuildingType: p.BuildingType, IsCornerUnit: p.IsCornerUnit,
		ParkingType: p.ParkingType, SecurityType: p.SecurityType,
	}
	if p.Floor.Valid        { v := p.Floor.Int32;        pResp.Floor = &v }
	if p.TotalFloors.Valid  { v := p.TotalFloors.Int32;  pResp.TotalFloors = &v }
	if p.MainArea.Valid     { v := p.MainArea.Float64;   pResp.MainArea = &v }
	if p.AuxiliaryArea.Valid { v := p.AuxiliaryArea.Float64; pResp.AuxiliaryArea = &v }
	if p.BalconyArea.Valid  { v := p.BalconyArea.Float64; pResp.BalconyArea = &v }
	if p.Rooms.Valid        { v := p.Rooms.Int32;        pResp.Rooms = &v }
	if p.LivingRooms.Valid  { v := p.LivingRooms.Int32;  pResp.LivingRooms = &v }
	if p.Bathrooms.Valid    { v := p.Bathrooms.Int32;    pResp.Bathrooms = &v }
	if p.BuildingAge.Valid  { v := p.BuildingAge.Int32;  pResp.BuildingAge = &v }
	if p.ManagementFee.Valid { v := p.ManagementFee.Float64; pResp.ManagementFee = &v }
	if p.BuildingOrientation.Valid { pResp.BuildingOrientation = &p.BuildingOrientation.String }
	if p.WindowOrientation.Valid   { pResp.WindowOrientation = &p.WindowOrientation.String }
	resp.Property = &pResp
}
return resp
```

- [ ] **Step 3: Add GetActiveByProperty to rental_listing/service.go**

Add to `APIService` interface in handler.go:
```go
GetActiveByProperty(propertyID int64, wallet string) (*model.RentalListing, error)
```

Add to `service.go` after `Close`:
```go
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
```

- [ ] **Step 4: Add GetForProperty handler to rental_listing/handler.go**

Add after `Close`:
```go
func (h *Handler) GetForProperty(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	rl, err := h.svc.GetActiveByProperty(propID, walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	if rl == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(rl)})
}
```

- [ ] **Step 5: Repeat steps 1-4 for sale_listing**

`sale_listing/dto.go` — add same `PropertySummaryResponse` struct, add `Property *PropertySummaryResponse` to `SaleListingResponse`.

`sale_listing/handler.go` — update `toResponse` with the same property population block (identical null checks). Add `GetForProperty` handler:
```go
func (h *Handler) GetForProperty(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	sl, err := h.svc.GetActiveByProperty(propID, walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	if sl == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(sl)})
}
```

`sale_listing/service.go` — add `GetActiveByProperty` to `APIService` interface and implement:
```go
func (s *Service) GetActiveByProperty(propertyID int64, wallet string) (*model.SaleListing, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	sl, err := s.repo.FindActiveByProperty(propertyID)
	if err != nil {
		return nil, fmt.Errorf("sale_listing: GetActiveByProperty: %w", err)
	}
	return sl, nil
}
```

Note: `sale_listing_repo.go` already has `FindActiveByProperty`. Confirm it exists before this step.

- [ ] **Step 6: Register new routes in bootstrap/router.go**

In the `protected` group, after existing rental-listing routes, add:
```go
protected.GET("/property/:id/rental-listing", rentalListingHandler.GetForProperty)
protected.GET("/property/:id/sale-listing", saleListingHandler.GetForProperty)
```

- [ ] **Step 7: Rebuild and verify**

```bash
cd go-service && docker compose up --build -d
```

Expected: build succeeds with no errors.

```bash
curl http://localhost:8081/api/rental-listing
```

Expected: `{"data":[],"success":true}` (empty list is fine; if a ACTIVE rental listing exists it will now include `"property":{...}` in each item).

- [ ] **Step 8: Commit**

```bash
git add go-service/internal/modules/rental_listing/dto.go \
        go-service/internal/modules/rental_listing/handler.go \
        go-service/internal/modules/rental_listing/service.go \
        go-service/internal/modules/sale_listing/dto.go \
        go-service/internal/modules/sale_listing/handler.go \
        go-service/internal/modules/sale_listing/service.go \
        go-service/internal/bootstrap/router.go
git commit -m "feat: add property join to listing responses, add GetForProperty endpoints"
```

---

### Task 2: Property API client

**Files:**
- Create: `react-service/src/api/propertyApi.ts`

- [ ] **Step 1: Create propertyApi.ts**

```typescript
const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type PropertySetupStatus = "DRAFT" | "READY";
export type BuildingType = "APARTMENT" | "BUILDING" | "TOWNHOUSE" | "STUDIO";
export type ParkingType = "NONE" | "RAMP" | "MECHANICAL" | "TOWER";
export type SecurityType = "NONE" | "FULLTIME" | "PARTTIME";
export type AttachmentType = "PHOTO" | "DEED" | "FLOOR_PLAN" | "DISCLOSURE";

export type PropertyAttachment = {
    id: number;
    type: AttachmentType;
    url: string;
    created_at: string;
};

export type Property = {
    id: number;
    owner_user_id: number;
    title: string;
    address: string;
    district_id?: number;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    is_corner_unit: boolean;
    has_dark_room: boolean;
    building_age?: number;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
    building_orientation?: string;
    window_orientation?: string;
    parking_type: string;
    management_fee?: number;
    security_type: string;
    setup_status: PropertySetupStatus;
    attachments: PropertyAttachment[];
    created_at: string;
    updated_at: string;
};

export type CreatePropertyPayload = {
    title: string;
    address: string;
};

export type UpdatePropertyPayload = {
    title?: string;
    address?: string;
    building_type?: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    shared_area?: number;
    awning_area?: number;
    land_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    is_corner_unit?: boolean;
    has_dark_room?: boolean;
    building_age?: number;
    building_structure?: string;
    exterior_material?: string;
    building_usage?: string;
    zoning?: string;
    units_on_floor?: number;
    building_orientation?: string;
    window_orientation?: string;
    parking_type?: string;
    management_fee?: number;
    security_type?: string;
};

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function listMyProperties(): Promise<Property[]> {
    const res = await fetch(`${API}/property`, { credentials: "include" });
    const data = await parse<{ data: Property[] }>(res);
    return data.data;
}

export async function getProperty(id: number): Promise<Property> {
    const res = await fetch(`${API}/property/${id}`, { credentials: "include" });
    const data = await parse<{ data: Property }>(res);
    return data.data;
}

export async function createProperty(payload: CreatePropertyPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateProperty(id: number, payload: UpdatePropertyPayload): Promise<void> {
    const res = await fetch(`${API}/property/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function addAttachment(propertyId: number, type: AttachmentType, url: string): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/attachment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, url }),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function deleteAttachment(propertyId: number, attachmentId: number): Promise<void> {
    const res = await fetch(`${API}/property/${propertyId}/attachment/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
    });
    await parse<unknown>(res);
}
```

- [ ] **Step 2: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/api/propertyApi.ts
git commit -m "feat: add propertyApi client"
```

---

### Task 3: Rental Listing + Sale Listing API clients

**Files:**
- Create: `react-service/src/api/rentalListingApi.ts`
- Create: `react-service/src/api/saleListingApi.ts`

- [ ] **Step 1: Create rentalListingApi.ts**

```typescript
const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type RentalListingStatus = "DRAFT" | "ACTIVE" | "NEGOTIATING" | "LOCKED" | "CLOSED" | "EXPIRED";
export type ManagementFeePayer = "TENANT" | "OWNER" | "SPLIT";
export type GenderRestriction = "MALE" | "FEMALE" | "ANY";

export type PropertySummary = {
    id: number;
    title: string;
    address: string;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    building_age?: number;
    parking_type: string;
    management_fee?: number;
    is_corner_unit: boolean;
    security_type: string;
    building_orientation?: string;
    window_orientation?: string;
};

export type RentalListing = {
    id: number;
    property_id: number;
    status: RentalListingStatus;
    duration_days: number;
    monthly_rent: number;
    deposit_months: number;
    management_fee_payer: ManagementFeePayer;
    min_lease_months: number;
    allow_pets: boolean;
    allow_cooking: boolean;
    gender_restriction?: GenderRestriction;
    notes?: string;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    property?: PropertySummary;
};

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
};

export type UpdateRentalListingPayload = Partial<CreateRentalListingPayload>;

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function getRentalListings(): Promise<RentalListing[]> {
    const res = await fetch(`${API}/rental-listing`, { credentials: "include" });
    const data = await parse<{ data: RentalListing[] }>(res);
    return data.data ?? [];
}

export async function getRentalListing(id: number): Promise<RentalListing> {
    const res = await fetch(`${API}/rental-listing/${id}`, { credentials: "include" });
    const data = await parse<{ data: RentalListing }>(res);
    return data.data;
}

export async function getRentalListingForProperty(propertyId: number): Promise<RentalListing | null> {
    const res = await fetch(`${API}/property/${propertyId}/rental-listing`, { credentials: "include" });
    const data = await parse<{ data: RentalListing | null }>(res);
    return data.data;
}

export async function createRentalListing(propertyId: number, payload: CreateRentalListingPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/rental-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateRentalListing(id: number, payload: UpdateRentalListingPayload): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function publishRentalListing(id: number, durationDays: number): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: durationDays }),
    });
    await parse<unknown>(res);
}

export async function closeRentalListing(id: number): Promise<void> {
    const res = await fetch(`${API}/rental-listing/${id}/close`, {
        method: "POST",
        credentials: "include",
    });
    await parse<unknown>(res);
}
```

- [ ] **Step 2: Create saleListingApi.ts**

```typescript
const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type SaleListingStatus = "DRAFT" | "ACTIVE" | "NEGOTIATING" | "LOCKED" | "CLOSED" | "EXPIRED";

export type PropertySummary = {
    id: number;
    title: string;
    address: string;
    building_type: string;
    floor?: number;
    total_floors?: number;
    main_area?: number;
    auxiliary_area?: number;
    balcony_area?: number;
    rooms?: number;
    living_rooms?: number;
    bathrooms?: number;
    building_age?: number;
    parking_type: string;
    management_fee?: number;
    is_corner_unit: boolean;
    security_type: string;
    building_orientation?: string;
    window_orientation?: string;
};

export type SaleListing = {
    id: number;
    property_id: number;
    status: SaleListingStatus;
    duration_days: number;
    total_price: number;
    unit_price_per_ping?: number;
    parking_type?: string;
    parking_price?: number;
    notes?: string;
    published_at?: string;
    expires_at?: string;
    created_at: string;
    updated_at: string;
    property?: PropertySummary;
};

export type CreateSaleListingPayload = {
    total_price: number;
    unit_price_per_ping?: number;
    parking_type?: string;
    parking_price?: number;
    notes?: string;
    duration_days: number;
};

export type UpdateSaleListingPayload = Partial<CreateSaleListingPayload>;

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function getSaleListings(): Promise<SaleListing[]> {
    const res = await fetch(`${API}/sale-listing`, { credentials: "include" });
    const data = await parse<{ data: SaleListing[] }>(res);
    return data.data ?? [];
}

export async function getSaleListing(id: number): Promise<SaleListing> {
    const res = await fetch(`${API}/sale-listing/${id}`, { credentials: "include" });
    const data = await parse<{ data: SaleListing }>(res);
    return data.data;
}

export async function getSaleListingForProperty(propertyId: number): Promise<SaleListing | null> {
    const res = await fetch(`${API}/property/${propertyId}/sale-listing`, { credentials: "include" });
    const data = await parse<{ data: SaleListing | null }>(res);
    return data.data;
}

export async function createSaleListing(propertyId: number, payload: CreateSaleListingPayload): Promise<{ id: number }> {
    const res = await fetch(`${API}/property/${propertyId}/sale-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function updateSaleListing(id: number, payload: UpdateSaleListingPayload): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    await parse<unknown>(res);
}

export async function publishSaleListing(id: number, durationDays: number): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: durationDays }),
    });
    await parse<unknown>(res);
}

export async function closeSaleListing(id: number): Promise<void> {
    const res = await fetch(`${API}/sale-listing/${id}/close`, {
        method: "POST",
        credentials: "include",
    });
    await parse<unknown>(res);
}
```

- [ ] **Step 3: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/api/rentalListingApi.ts react-service/src/api/saleListingApi.ts
git commit -m "feat: add rentalListingApi and saleListingApi clients"
```

---

### Task 4: Header nav split + Router + legacy redirects

**Files:**
- Modify: `react-service/src/components/common/Header.tsx`
- Modify: `react-service/src/router/index.tsx`

- [ ] **Step 1: Split "房源列表" into two nav links in Header.tsx**

Find the `<nav>` block (around line 110). Replace the single `<NavLink to="/listings">` with two links:

```tsx
<NavLink to="/sale" className={navLinkCls}>出售物件</NavLink>
<NavLink to="/rent" className={navLinkCls}>出租物件</NavLink>
```

Remove the old `<NavLink to="/listings" className={navLinkCls}>房源列表</NavLink>`.

- [ ] **Step 2: Add all new routes + legacy redirects to router/index.tsx**

Import the new pages and Navigate at top:
```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import MyPropertiesPage from "../pages/MyPropertiesPage";
import PropertyCreatePage from "../pages/PropertyCreatePage";
import PropertyEditPage from "../pages/PropertyEditPage";
import RentalListingPage from "../pages/RentalListingPage";
import SaleListingPage from "../pages/SaleListingPage";
import RentListPage from "../pages/RentListPage";
import RentDetailPage from "../pages/RentDetailPage";
import SaleListPage from "../pages/SaleListPage";
import SaleDetailPage from "../pages/SaleDetailPage";
```

Add these route entries to the `createBrowserRouter` array:

```tsx
// Legacy redirects
{ path: "/listings", element: <Navigate to="/sale" replace /> },
{ path: "/listings/:id", element: <Navigate to="/sale" replace /> },
{ path: "/my/listings", element: <Navigate to="/my/properties" replace /> },
{ path: "/my/listings/new", element: <Navigate to="/my/properties/new" replace /> },

// Public — sale & rent
{ path: "/sale", element: <SaleListPage /> },
{ path: "/sale/:id", element: <SaleDetailPage /> },
{ path: "/rent", element: <RentListPage /> },
{ path: "/rent/:id", element: <RentDetailPage /> },

// Owner — properties
{
    path: "/my/properties",
    element: (
        <RequireCredential requiredRole="OWNER">
            <MyPropertiesPage />
        </RequireCredential>
    ),
},
{
    path: "/my/properties/new",
    element: (
        <RequireCredential requiredRole="OWNER">
            <PropertyCreatePage />
        </RequireCredential>
    ),
},
{
    path: "/my/properties/:id",
    element: (
        <RequireCredential requiredRole="OWNER">
            <PropertyEditPage />
        </RequireCredential>
    ),
},
{
    path: "/my/properties/:id/rent",
    element: (
        <RequireCredential requiredRole="OWNER">
            <RentalListingPage />
        </RequireCredential>
    ),
},
{
    path: "/my/properties/:id/sale",
    element: (
        <RequireCredential requiredRole="OWNER">
            <SaleListingPage />
        </RequireCredential>
    ),
},
```

Note: The page files `PropertyEditPage.tsx`, `RentalListingPage.tsx`, `SaleListingPage.tsx`, `RentListPage.tsx`, `RentDetailPage.tsx`, `SaleListPage.tsx`, `SaleDetailPage.tsx` do not exist yet — TypeScript will fail until they're created in Tasks 5-11 of Part 2. Add placeholder files now to unblock the import:

For each missing page, create a minimal placeholder:
```tsx
// react-service/src/pages/PropertyEditPage.tsx
import SiteLayout from "../layouts/SiteLayout";
export default function PropertyEditPage() {
    return <SiteLayout><div className="p-12">PropertyEditPage — coming soon</div></SiteLayout>;
}
```

Create placeholder files for: `PropertyEditPage.tsx`, `RentalListingPage.tsx`, `SaleListingPage.tsx`, `RentListPage.tsx`, `RentDetailPage.tsx`, `SaleListPage.tsx`, `SaleDetailPage.tsx`.

- [ ] **Step 3: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Start dev server and verify nav**

```bash
cd react-service && npm run dev
```

Open `http://localhost:5173`. Verify:
- Header shows "出售物件" and "出租物件" (not "房源列表")
- `/listings` redirects to `/sale`
- `/sale` loads (placeholder page)
- `/rent` loads (placeholder page)

- [ ] **Step 5: Commit**

```bash
git add react-service/src/components/common/Header.tsx \
        react-service/src/router/index.tsx \
        react-service/src/pages/PropertyEditPage.tsx \
        react-service/src/pages/RentalListingPage.tsx \
        react-service/src/pages/SaleListingPage.tsx \
        react-service/src/pages/RentListPage.tsx \
        react-service/src/pages/RentDetailPage.tsx \
        react-service/src/pages/SaleListPage.tsx \
        react-service/src/pages/SaleDetailPage.tsx
git commit -m "feat: split header nav, add routes and placeholders for new pages"
```

---

### Task 5: MyPropertiesPage

Owner dashboard listing all their 591-style properties with status chips and "新增物件" CTA.

**Files:**
- Create: `react-service/src/pages/MyPropertiesPage.tsx`

- [ ] **Step 1: Implement MyPropertiesPage.tsx**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyProperties, type Property } from "../api/propertyApi";
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

export default function MyPropertiesPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listMyProperties()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取物件失敗"))
            .finally(() => setLoading(false));
    }, []);

    const readyCount = items.filter((p) => p.setup_status === "READY").length;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="flex items-center justify-between gap-4">
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
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    {[
                        ["物件總數", items.length],
                        ["完成度 READY", readyCount],
                        ["草稿中", items.length - readyCount],
                    ].map(([label, value]) => (
                        <div key={label as string} className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                            <p className="text-sm text-on-surface-variant">{label}</p>
                            <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
                        </div>
                    ))}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取物件中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">尚無物件</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">點擊右上角「新增物件」開始建立第一個物件。</p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/my/properties/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">#{item.id}</span>
                                            {item.building_type ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                    {BUILDING_TYPE_LABEL[item.building_type] ?? item.building_type}
                                                </span>
                                            ) : null}
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.setup_status === "READY" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                                                {item.setup_status === "READY" ? "✓ READY" : "草稿"}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名物件"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "地址未設定"}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">{formatArea(item)} · {formatLayout(item)}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-xs text-on-surface-variant">更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}</p>
                                        <p className="mt-2 text-xs font-medium text-primary-container">點擊編輯 →</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

Log in as OWNER. Navigate to `http://localhost:5173/my/properties`.
- If no properties exist: shows empty state with "新增物件" button.
- "新增物件" button navigates to `/my/properties/new`.

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/MyPropertiesPage.tsx
git commit -m "feat: add MyPropertiesPage"
```

---

### Task 6: PropertyCreatePage

Simple two-field form (title + address) that creates a DRAFT property and redirects to edit.

**Files:**
- Create: `react-service/src/pages/PropertyCreatePage.tsx`

- [ ] **Step 1: Implement PropertyCreatePage.tsx**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProperty } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

export default function PropertyCreatePage() {
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [address, setAddress] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const canSubmit = title.trim() !== "" && address.trim() !== "" && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError("");
        try {
            const { id } = await createProperty({ title: title.trim(), address: address.trim() });
            navigate(`/my/properties/${id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "建立物件失敗");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to="/my/properties" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                        ← 返回我的物件
                    </Link>
                    <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">新增物件</h1>
                    <p className="text-sm text-on-surface-variant">先填入名稱和地址建立草稿，其他詳細資料可以之後補齊。</p>
                </div>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">物件名稱 *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例：台北市信義區兩房公寓"
                                className={inputCls}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">地址 *</label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="例：台北市信義區松仁路100號5樓"
                                className={inputCls}
                            />
                        </div>

                        {error ? (
                            <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>
                        ) : null}

                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() => void handleSubmit()}
                            className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                            {submitting ? "建立中..." : "建立草稿"}
                        </button>
                    </div>
                </section>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Lint check**

```bash
cd react-service && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:5173/my/properties/new`.
- Fill in title and address → click "建立草稿"
- Expect redirect to `/my/properties/:id` (placeholder page for now)
- Check backend: `curl http://localhost:8081/api/property` should return the new property

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/PropertyCreatePage.tsx
git commit -m "feat: add PropertyCreatePage"
```

---

**End of Part 1.** Continue with Part 2 (`2026-05-07-property-listing-frontend-part2.md`) for:
- Task 7: PropertyEditPage (full form + completeness bar + attachment upload)
- Task 8: RentalListingPage
- Task 9: SaleListingPage
- Task 10: RentListPage + RentDetailPage
- Task 11: SaleListPage + SaleDetailPage
