# Rent Appointment Wiring 實作計畫（S1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓租客可在 `/rent/:id` 對租屋物件發起預約看房、屋主在 `MyPropertiesPage` 確認/取消，預約以單一 `listing_appointments` 表承載並參照 `property(id)`。

**Architecture:** `listing_appointments` 改為 property-based（新增 `property_id → property(id)`）。新增單一職責 `modules/appointment`（service+dto+handler），repo 沿用 `db/repository/listing_appointment_repo.go` 改寫為 property-based。退場舊 `modules/listing` 的預約 handler/route 與 `ListingDetailPage` 預約 UI。

**Tech Stack:** Go (Gin, lib/pq, 無 ORM)；React 19 + TS + fetch；PostgreSQL（schema 經 `platform/db/schema.go EnsureSchema` 套用）。

**對應 spec:** `docs/superpowers/specs/2026-06-09-rent-appointment-wiring-design.md`
**對應 goal 錨點:** `docs/superpowers/goals/2026-06-09-rental-matching-mainline-consolidation.md`（S1）

> ⚠️ live 物件表是單數 `property`；`rental_listing.property_id → property(id)`。所有 FK/JOIN 用 `property`。
> 驗證命令一律帶 timeout：`go test`/`go build` 300000ms、`npm run lint`/`build` 300000ms。

---

## File Structure

**Backend**
- Modify `go-service/internal/platform/db/schema.go` — EnsureSchema 加 `listing_appointments` property-based 遷移（須排在 `property` 表建立之後）。
- Modify `go-service/internal/db/model/listing_appointment_model.go` — struct 加 `PropertyID`。
- Modify `go-service/internal/db/repository/listing_appointment_repo.go` — 改 property-based 存取。
- Create `go-service/internal/modules/appointment/service.go` — 業務邏輯（解析 property、隊列、擁有權、狀態機）。
- Create `go-service/internal/modules/appointment/service_test.go` — service 單元測試。
- Create `go-service/internal/modules/appointment/dto.go` — request/response。
- Create `go-service/internal/modules/appointment/handler.go` — HTTP 層。
- Modify `go-service/internal/bootstrap/wiring.go` — 構造 appointment service/handler。
- Modify `go-service/internal/bootstrap/router.go` — 加新 route、移除舊預約 route。
- Modify `go-service/internal/modules/listing/handler.go` — 移除 BookAppointment/ConfirmAppointment/UpdateAppointmentStatus/CancelAppointment。
- Modify `infra/init/07-listings.sql` 註解 + `docs/database/relational-database-spec.md` — 文件同步。

**Frontend**
- Create `react-service/src/api/appointmentApi.ts` — API client。
- Modify `react-service/src/pages/RentDetailPage.tsx` — 預約看房區塊。
- Modify `react-service/src/pages/MyPropertiesPage.tsx` — 屋主預約清單 + 確認/取消。
- Modify `react-service/src/pages/ListingDetailPage.tsx` — 移除預約 UI。

---

## Task 1: DB schema — listing_appointments 改 property-based

**Files:**
- Modify: `go-service/internal/platform/db/schema.go`（EnsureSchema statements 尾端，須在 `property` 表 CREATE 之後）

- [ ] **Step 1: 在 EnsureSchema 的 `statements` slice 末尾加入以下三段（緊接在 property / rental_listing 既有語句之後，確保 `property` 已存在）**

```go
	`ALTER TABLE listing_appointments
	    ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES property(id)`,

	`ALTER TABLE listing_appointments ALTER COLUMN listing_id DROP NOT NULL`,

	`DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'uq_listing_appointments_property_visitor'
    ) THEN
        ALTER TABLE listing_appointments DROP CONSTRAINT IF EXISTS uq_listing_visitor;
        CREATE UNIQUE INDEX uq_listing_appointments_property_visitor
            ON listing_appointments (property_id, visitor_user_id)
            WHERE property_id IS NOT NULL;
    END IF;
END $$`,

	`CREATE INDEX IF NOT EXISTS idx_listing_appointments_property_id
	    ON listing_appointments (property_id)`,
```

- [ ] **Step 2: 編譯確認語法**

Run: `cd go-service && go build ./...`（timeout 300000ms）
Expected: PASS（無編譯錯誤）

- [ ] **Step 3: 文件同步**

於 `infra/init/07-listings.sql` 的 `listing_appointments` 區塊註解補一行：`-- property_id 由 platform/db/schema.go EnsureSchema 於 property 表建立後加入（property-based 預約）`。
於 `docs/database/relational-database-spec.md` 補 `listing_appointments.property_id` 欄位與「參照 property、唯一鍵 (property_id, visitor_user_id)」說明。

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/platform/db/schema.go infra/init/07-listings.sql docs/database/relational-database-spec.md
git commit -m "feat: listing_appointments 改 property-based schema（property_id + 唯一鍵）"
```

---

## Task 2: Model — ListingAppointment 加 PropertyID

**Files:**
- Modify: `go-service/internal/db/model/listing_appointment_model.go:18-20`

- [ ] **Step 1: 在 struct 內 `ListingID int64` 之後加入**

```go
	ListingID     int64
	PropertyID    int64
	VisitorUserID int64
```

- [ ] **Step 2: 編譯**

Run: `cd go-service && go build ./...`（timeout 300000ms）
Expected: 會在 repo 處報未使用/掃描不符（下一 Task 修），或 PASS。先確認 model 本身語法無誤。

- [ ] **Step 3: Commit**

```bash
git add go-service/internal/db/model/listing_appointment_model.go
git commit -m "feat: ListingAppointment model 加 PropertyID"
```

---

## Task 3: Repo — listing_appointment_repo.go 改 property-based

**Files:**
- Modify: `go-service/internal/db/repository/listing_appointment_repo.go`

- [ ] **Step 1: 改 SELECT 欄位與 scan（加入 property_id）**

`apptSelectCols` 改為：

```go
const apptSelectCols = `
	SELECT id, listing_id, property_id, visitor_user_id,
	       queue_position, preferred_time, confirmed_time,
	       status, note,
	       created_at, updated_at
	FROM listing_appointments`
```

`scanAppointment` 與 `scanAppointments` 的 `row.Scan(...)` 改為（property_id 以 `sql.NullInt64` 暫存再賦值，避免舊列 NULL）：

```go
	var propertyID sql.NullInt64
	err := row.Scan(
		&a.ID, &a.ListingID, &propertyID, &a.VisitorUserID,
		&a.QueuePosition, &a.PreferredTime, &a.ConfirmedTime,
		&a.Status, &a.Note,
		&a.CreatedAt, &a.UpdatedAt,
	)
	// ...錯誤處理後：
	a.PropertyID = propertyID.Int64
```

（`scanAppointments` 內同樣以區域變數處理，迴圈每筆都宣告 `var propertyID sql.NullInt64`。）

- [ ] **Step 2: 新增 property-based 查詢方法，取代 listing-based**

```go
// FindByProperty returns all appointments for a property ordered by queue_position.
func (r *ListingAppointmentRepository) FindByProperty(propertyID int64) ([]*model.ListingAppointment, error) {
	rows, err := r.db.Query(apptSelectCols+` WHERE property_id = $1 ORDER BY queue_position ASC`, propertyID)
	if err != nil {
		return nil, fmt.Errorf("appt_repo: FindByProperty: %w", err)
	}
	defer rows.Close()
	return scanAppointments(rows)
}

// FindByPropertyAndVisitor finds an existing appointment for this (property, visitor) pair.
func (r *ListingAppointmentRepository) FindByPropertyAndVisitor(propertyID, visitorUserID int64) (*model.ListingAppointment, error) {
	row := r.db.QueryRow(apptSelectCols+` WHERE property_id=$1 AND visitor_user_id=$2`, propertyID, visitorUserID)
	return scanAppointment(row)
}

// NextQueuePosition returns (current max queue_position + 1) for a property.
func (r *ListingAppointmentRepository) NextQueuePosition(propertyID int64) (int, error) {
	var pos int
	err := r.db.QueryRow(`
		SELECT COALESCE(MAX(queue_position), 0) + 1
		FROM listing_appointments WHERE property_id = $1`, propertyID).Scan(&pos)
	if err != nil {
		return 0, fmt.Errorf("appt_repo: NextQueuePosition: %w", err)
	}
	return pos, nil
}

// Create inserts a new property-based appointment and returns the new ID.
func (r *ListingAppointmentRepository) Create(propertyID, visitorUserID int64, queuePosition int, preferredTime time.Time, note *string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO listing_appointments
		    (property_id, visitor_user_id, queue_position, preferred_time, note)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		propertyID, visitorUserID, queuePosition, preferredTime, note,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("appt_repo: Create: %w", err)
	}
	return id, nil
}
```

保留既有 `FindByID`、`SetStatus`、`Confirm`（不變）。刪除舊的 `FindByListing`、`FindByVisitor`、`FindByListingAndVisitor`（listing-based，已無人用）。

- [ ] **Step 3: 編譯**

Run: `cd go-service && go build ./...`（timeout 300000ms）
Expected: `modules/listing` 仍引用舊方法 → 報錯。此為預期，Task 6 一併修正；本步先確認 repo 自身語法。可暫時跑 `go build ./internal/db/...` 確認 repo package 編譯 PASS。

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/db/repository/listing_appointment_repo.go
git commit -m "feat: appointment repo 改 property-based 存取"
```

---

## Task 4: appointment service + 單元測試（TDD）

**Files:**
- Create: `go-service/internal/modules/appointment/service.go`
- Create: `go-service/internal/modules/appointment/service_test.go`

- [ ] **Step 1: 先寫 service 介面與骨架（讓測試可編譯）**

`service.go`：

```go
package appointment

import (
	"errors"
	"fmt"
	"time"

	"go-service/internal/db/model"
)

var (
	ErrNotFound      = errors.New("appointment not found")
	ErrForbidden     = errors.New("not allowed")
	ErrInvalidStatus = errors.New("invalid status transition")
	ErrListingNotFound = errors.New("rental listing not found")
)

type ApptStore interface {
	FindByID(id int64) (*model.ListingAppointment, error)
	FindByProperty(propertyID int64) ([]*model.ListingAppointment, error)
	FindByPropertyAndVisitor(propertyID, visitorUserID int64) (*model.ListingAppointment, error)
	NextQueuePosition(propertyID int64) (int, error)
	Create(propertyID, visitorUserID int64, queuePosition int, preferredTime time.Time, note *string) (int64, error)
	SetStatus(id int64, status string) error
	Confirm(id int64, confirmedTime time.Time) error
}

type RentalListingStore interface {
	FindByID(id int64) (*model.RentalListing, error)
}

type PropertyStore interface {
	FindByID(id int64) (*model.Property, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	appts    ApptStore
	rentals  RentalListingStore
	props    PropertyStore
	users    UserStore
}

func NewService(appts ApptStore, rentals RentalListingStore, props PropertyStore, users UserStore) *Service {
	return &Service{appts: appts, rentals: rentals, props: props, users: users}
}

// allowedTransitions defines legal status changes.
var allowedTransitions = map[string][]string{
	model.AppointmentStatusPending:   {model.AppointmentStatusConfirmed, model.AppointmentStatusCancelled},
	model.AppointmentStatusConfirmed: {model.AppointmentStatusViewed, model.AppointmentStatusCancelled},
	model.AppointmentStatusViewed:    {model.AppointmentStatusInterested, model.AppointmentStatusCancelled},
}

func canTransition(from, to string) bool {
	for _, t := range allowedTransitions[from] {
		if t == to {
			return true
		}
	}
	return false
}

// BookForRentalListing resolves property from rental listing id, then creates an appointment.
func (s *Service) BookForRentalListing(rentalListingID, visitorUserID int64, preferredTime time.Time, note *string) (int64, error) {
	rl, err := s.rentals.FindByID(rentalListingID)
	if err != nil {
		return 0, fmt.Errorf("appointment: resolve rental: %w", err)
	}
	if rl == nil {
		return 0, ErrListingNotFound
	}
	existing, err := s.appts.FindByPropertyAndVisitor(rl.PropertyID, visitorUserID)
	if err != nil {
		return 0, err
	}
	if existing != nil && existing.Status != model.AppointmentStatusCancelled {
		return 0, ErrForbidden // 已有 active 預約
	}
	pos, err := s.appts.NextQueuePosition(rl.PropertyID)
	if err != nil {
		return 0, err
	}
	return s.appts.Create(rl.PropertyID, visitorUserID, pos, preferredTime, note)
}

// ListForOwner returns appointments of a property, asserting the wallet owns it.
func (s *Service) ListForOwner(propertyID int64, wallet string) ([]*model.ListingAppointment, error) {
	if err := s.assertOwnsProperty(wallet, propertyID); err != nil {
		return nil, err
	}
	return s.appts.FindByProperty(propertyID)
}

// Confirm sets an appointment to CONFIRMED (owner only).
func (s *Service) Confirm(apptID int64, wallet string, confirmedTime time.Time) error {
	appt, err := s.ownerAppt(apptID, wallet)
	if err != nil {
		return err
	}
	if !canTransition(appt.Status, model.AppointmentStatusConfirmed) {
		return ErrInvalidStatus
	}
	return s.appts.Confirm(apptID, confirmedTime)
}

// SetStatus performs a guarded status transition (owner only for VIEWED/INTERESTED/CANCELLED).
func (s *Service) SetStatus(apptID int64, wallet, status string) error {
	appt, err := s.ownerAppt(apptID, wallet)
	if err != nil {
		return err
	}
	if !canTransition(appt.Status, status) {
		return ErrInvalidStatus
	}
	return s.appts.SetStatus(apptID, status)
}

func (s *Service) ownerAppt(apptID int64, wallet string) (*model.ListingAppointment, error) {
	appt, err := s.appts.FindByID(apptID)
	if err != nil {
		return nil, err
	}
	if appt == nil {
		return nil, ErrNotFound
	}
	if err := s.assertOwnsProperty(wallet, appt.PropertyID); err != nil {
		return nil, err
	}
	return appt, nil
}

func (s *Service) assertOwnsProperty(wallet string, propertyID int64) error {
	user, err := s.users.FindByWallet(wallet)
	if err != nil || user == nil {
		return ErrForbidden
	}
	prop, err := s.props.FindByID(propertyID)
	if err != nil || prop == nil {
		return ErrNotFound
	}
	if prop.OwnerUserID != user.ID {
		return ErrForbidden
	}
	return nil
}
```

- [ ] **Step 2: 寫失敗測試（fakes + 行為）**

`service_test.go`（涵蓋：解析 property 後建立、重複 active 擋下、非法狀態轉移、擁有權）：

```go
package appointment

import (
	"testing"
	"time"

	"go-service/internal/db/model"
)

type fakeAppts struct {
	byID       map[int64]*model.ListingAppointment
	byPropVis  map[[2]int64]*model.ListingAppointment
	created    []*model.ListingAppointment
	nextPos    int
	lastStatus string
}

func (f *fakeAppts) FindByID(id int64) (*model.ListingAppointment, error) { return f.byID[id], nil }
func (f *fakeAppts) FindByProperty(p int64) ([]*model.ListingAppointment, error) { return nil, nil }
func (f *fakeAppts) FindByPropertyAndVisitor(p, v int64) (*model.ListingAppointment, error) {
	return f.byPropVis[[2]int64{p, v}], nil
}
func (f *fakeAppts) NextQueuePosition(p int64) (int, error) { return f.nextPos, nil }
func (f *fakeAppts) Create(p, v int64, pos int, t time.Time, note *string) (int64, error) {
	a := &model.ListingAppointment{ID: 100, PropertyID: p, VisitorUserID: v, QueuePosition: pos, Status: model.AppointmentStatusPending}
	f.created = append(f.created, a)
	f.byID[100] = a
	return 100, nil
}
func (f *fakeAppts) SetStatus(id int64, s string) error { f.lastStatus = s; return nil }
func (f *fakeAppts) Confirm(id int64, t time.Time) error { f.lastStatus = model.AppointmentStatusConfirmed; return nil }

type fakeRentals struct{ rl *model.RentalListing }
func (f *fakeRentals) FindByID(id int64) (*model.RentalListing, error) { return f.rl, nil }

type fakeProps struct{ prop *model.Property }
func (f *fakeProps) FindByID(id int64) (*model.Property, error) { return f.prop, nil }

type fakeUsers struct{ user *model.User }
func (f *fakeUsers) FindByWallet(w string) (*model.User, error) { return f.user, nil }

func newSvc(a *fakeAppts) (*Service, *fakeProps, *fakeUsers) {
	props := &fakeProps{prop: &model.Property{ID: 7, OwnerUserID: 42}}
	users := &fakeUsers{user: &model.User{ID: 42}}
	rentals := &fakeRentals{rl: &model.RentalListing{ID: 5, PropertyID: 7}}
	return NewService(a, rentals, props, users), props, users
}

func TestBookForRentalListing_resolvesPropertyAndCreates(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{}, nextPos: 1}
	svc, _, _ := newSvc(a)
	id, err := svc.BookForRentalListing(5, 99, time.Now(), nil)
	if err != nil || id != 100 {
		t.Fatalf("want id=100 err=nil, got id=%d err=%v", id, err)
	}
	if len(a.created) != 1 || a.created[0].PropertyID != 7 {
		t.Fatalf("expected appointment created for property 7, got %+v", a.created)
	}
}

func TestBookForRentalListing_duplicateActiveBlocked(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{
		{7, 99}: {ID: 1, PropertyID: 7, VisitorUserID: 99, Status: model.AppointmentStatusPending},
	}, nextPos: 2}
	svc, _, _ := newSvc(a)
	if _, err := svc.BookForRentalListing(5, 99, time.Now(), nil); err != ErrForbidden {
		t.Fatalf("want ErrForbidden, got %v", err)
	}
}

func TestSetStatus_invalidTransitionRejected(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{
		1: {ID: 1, PropertyID: 7, Status: model.AppointmentStatusPending},
	}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, _ := newSvc(a)
	// PENDING → VIEWED 非法（須先 CONFIRMED）
	if err := svc.SetStatus(1, "0xowner", model.AppointmentStatusViewed); err != ErrInvalidStatus {
		t.Fatalf("want ErrInvalidStatus, got %v", err)
	}
}

func TestConfirm_nonOwnerForbidden(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{
		1: {ID: 1, PropertyID: 7, Status: model.AppointmentStatusPending},
	}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, users := newSvc(a)
	users.user = &model.User{ID: 999} // 非 owner(42)
	if err := svc.Confirm(1, "0xother", time.Now()); err != ErrForbidden {
		t.Fatalf("want ErrForbidden, got %v", err)
	}
}
```

- [ ] **Step 3: 跑測試確認 PASS**

Run: `cd go-service && go test ./internal/modules/appointment/...`（timeout 300000ms）
Expected: PASS（4 個測試）。若 `model.Property` / `model.RentalListing` / `model.User` 欄位名不符，依實際 model 修正測試 fake。

- [ ] **Step 4: gofmt + commit**

```bash
cd go-service && gofmt -w internal/modules/appointment/
git add go-service/internal/modules/appointment/service.go go-service/internal/modules/appointment/service_test.go
git commit -m "feat: appointment service + 單元測試（property 解析/重複擋下/狀態機/擁有權）"
```

---

## Task 5: appointment dto + handler

**Files:**
- Create: `go-service/internal/modules/appointment/dto.go`
- Create: `go-service/internal/modules/appointment/handler.go`

- [ ] **Step 1: dto.go**

```go
package appointment

import "time"

type BookRequest struct {
	PreferredTime time.Time `json:"preferred_time" binding:"required"`
	Note          *string   `json:"note"`
}

type ConfirmRequest struct {
	ConfirmedTime time.Time `json:"confirmed_time" binding:"required"`
}

type StatusRequest struct {
	Status string `json:"status" binding:"required,oneof=VIEWED INTERESTED CANCELLED"`
}

type AppointmentResponse struct {
	ID            int64      `json:"id"`
	PropertyID    int64      `json:"property_id"`
	VisitorUserID int64      `json:"visitor_user_id"`
	QueuePosition int        `json:"queue_position"`
	PreferredTime time.Time  `json:"preferred_time"`
	ConfirmedTime *time.Time `json:"confirmed_time,omitempty"`
	Status        string     `json:"status"`
	Note          *string    `json:"note,omitempty"`
}
```

- [ ] **Step 2: handler.go（沿用 favorites 的 `walletFrom` 與回應信封 `{success,data,message}`）**

```go
package appointment

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func toResp(a *model.ListingAppointment) AppointmentResponse {
	r := AppointmentResponse{
		ID: a.ID, PropertyID: a.PropertyID, VisitorUserID: a.VisitorUserID,
		QueuePosition: a.QueuePosition, PreferredTime: a.PreferredTime, Status: a.Status,
	}
	if a.ConfirmedTime.Valid {
		t := a.ConfirmedTime.Time
		r.ConfirmedTime = &t
	}
	if a.Note.Valid {
		n := a.Note.String
		r.Note = &n
	}
	return r
}

// POST /rental-listing/:id/appointments
func (h *Handler) Book(c *gin.Context) {
	rlID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req BookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	// visitor user id 由 wallet 解析（service 內部已有 users store；此處沿用 user repo 解 wallet→id）
	id, err := h.svc.BookForRentalListingByWallet(rlID, walletFrom(c), req.PreferredTime, req.Note)
	if err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// GET /property/:id/appointments
func (h *Handler) ListForProperty(c *gin.Context) {
	pid, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	appts, err := h.svc.ListForOwner(pid, walletFrom(c))
	if err != nil {
		writeErr(c, err)
		return
	}
	out := make([]AppointmentResponse, 0, len(appts))
	for _, a := range appts {
		out = append(out, toResp(a))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// PUT /appointments/:id/confirm
func (h *Handler) Confirm(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req ConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Confirm(id, walletFrom(c), req.ConfirmedTime); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /appointments/:id/status  和  /appointments/:id/cancel
func (h *Handler) SetStatus(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req StatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.SetStatus(id, walletFrom(c), req.Status); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) Cancel(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.svc.SetStatus(id, walletFrom(c), model.AppointmentStatusCancelled); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func writeErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidStatus):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrListingNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
	}
}
```

- [ ] **Step 2b: service.go 補 `BookForRentalListingByWallet`（handler 用 wallet 入口）**

```go
func (s *Service) BookForRentalListingByWallet(rentalListingID int64, wallet string, preferredTime time.Time, note *string) (int64, error) {
	user, err := s.users.FindByWallet(wallet)
	if err != nil || user == nil {
		return 0, ErrForbidden
	}
	return s.BookForRentalListing(rentalListingID, user.ID, preferredTime, note)
}
```

- [ ] **Step 3: 編譯 + gofmt**

Run: `cd go-service && gofmt -w internal/modules/appointment/ && go build ./internal/modules/appointment/...`（timeout 300000ms）
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/modules/appointment/dto.go go-service/internal/modules/appointment/handler.go go-service/internal/modules/appointment/service.go
git commit -m "feat: appointment dto + handler（book/list/confirm/status/cancel）"
```

---

## Task 6: 接線 + 退場舊預約

**Files:**
- Modify: `go-service/internal/bootstrap/wiring.go`
- Modify: `go-service/internal/bootstrap/router.go:121-125`（移除）, 加新 route
- Modify: `go-service/internal/modules/listing/handler.go`（移除 4 個 appointment 方法）

- [ ] **Step 1: wiring.go 構造 service/handler**

於 import 區加 `appointmentmod "go-service/internal/modules/appointment"`。在既有 `apptRepo`（已存在）、`rentalListingRepo`、property repo、userRepo 之後加入：

```go
	appointmentSvc := appointmentmod.NewService(apptRepo, rentalListingRepo, propertyRepo, userRepo)
	appointmentHandler := appointmentmod.NewHandler(appointmentSvc)
```

> 註：`propertyRepo`、`userRepo` 變數名以 wiring.go 既有為準；若 property repo 變數名不同（如 `newPropertyRepo`），用實際者。`apptRepo` 已於 line 70 構造。

將 `appointmentHandler` 傳入 `SetupRouter(...)` 呼叫（對應 router 簽章新增的參數）。

- [ ] **Step 2: router.go — 移除舊預約 route（行 121-125 整段），新增**

刪除：
```go
		// Appointment management
		protected.POST("/listings/:id/appointments", listingHandler.BookAppointment)
		protected.PUT("/listings/:id/appointments/:appt_id/confirm", listingHandler.ConfirmAppointment)
		protected.PUT("/listings/:id/appointments/:appt_id/status", listingHandler.UpdateAppointmentStatus)
		protected.PUT("/listings/:id/appointments/:appt_id/cancel", listingHandler.CancelAppointment)
```
新增（`SetupRouter` 參數加 `appointmentHandler *appointmentmod.Handler`，import 加該包）：
```go
		// Appointment (property-based)
		protected.POST("/rental-listing/:id/appointments", appointmentHandler.Book)
		protected.GET("/property/:id/appointments", appointmentHandler.ListForProperty)
		protected.PUT("/appointments/:id/confirm", appointmentHandler.Confirm)
		protected.PUT("/appointments/:id/status", appointmentHandler.SetStatus)
		protected.PUT("/appointments/:id/cancel", appointmentHandler.Cancel)
```

- [ ] **Step 3: listing/handler.go — 移除 4 個方法**

刪除 `BookAppointment`、`ConfirmAppointment`、`UpdateAppointmentStatus`、`CancelAppointment` 及其僅供它們使用的 import/欄位（若 listing handler 注入了 apptRepo 而其他方法不用，移除該依賴）。

- [ ] **Step 4: 全量編譯 + 測試 + gofmt**

Run: `cd go-service && gofmt -l . && go build ./... && go vet ./... && go test ./...`（timeout 300000ms）
Expected: 全 PASS、gofmt 無輸出。

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/bootstrap/wiring.go go-service/internal/bootstrap/router.go go-service/internal/modules/listing/handler.go
git commit -m "feat: 接線 appointment 模組並退場舊 listing 預約 route/handler"
```

---

## Task 7: 前端 appointment API client

**Files:**
- Create: `react-service/src/api/appointmentApi.ts`

- [ ] **Step 1: 依 rentalListingApi.ts 範式建立**

```ts
const API = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "VIEWED" | "INTERESTED" | "CANCELLED";

export type Appointment = {
    id: number;
    property_id: number;
    visitor_user_id: number;
    queue_position: number;
    preferred_time: string;
    confirmed_time?: string;
    status: AppointmentStatus;
    note?: string;
};

async function parse<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const data = raw ? (JSON.parse(raw) as T & { error?: string; message?: string }) : ({} as T & { error?: string; message?: string });
    if (!res.ok) throw new Error((data as { message?: string }).message ?? raw ?? `Request failed: ${res.status}`);
    return data;
}

export async function bookAppointment(rentalListingId: number, preferredTime: string, note?: string): Promise<{ id: number }> {
    const res = await fetch(`${API}/rental-listing/${rentalListingId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferred_time: preferredTime, note }),
    });
    const data = await parse<{ data: { id: number } }>(res);
    return data.data;
}

export async function listPropertyAppointments(propertyId: number): Promise<Appointment[]> {
    const res = await fetch(`${API}/property/${propertyId}/appointments`, { credentials: "include" });
    const data = await parse<{ data: Appointment[] }>(res);
    return data.data ?? [];
}

export async function confirmAppointment(id: number, confirmedTime: string): Promise<void> {
    const res = await fetch(`${API}/appointments/${id}/confirm`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ confirmed_time: confirmedTime }),
    });
    await parse<unknown>(res);
}

export async function cancelAppointment(id: number): Promise<void> {
    const res = await fetch(`${API}/appointments/${id}/cancel`, { method: "PUT", credentials: "include" });
    await parse<unknown>(res);
}
```

- [ ] **Step 2: lint**

Run: `cd react-service && npm run lint`（timeout 300000ms）
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add react-service/src/api/appointmentApi.ts
git commit -m "feat: 前端 appointment API client"
```

---

## Task 8: RentDetailPage 預約看房區塊

**Files:**
- Modify: `react-service/src/pages/RentDetailPage.tsx`

- [ ] **Step 1: 在「周邊環境」section 之後、`</main>` 之前，新增預約區塊**

於檔頂 import 加 `import { bookAppointment } from "../api/appointmentApi";`。在 component 內 state 區加：
```tsx
    const [preferredTime, setPreferredTime] = useState("");
    const [apptNote, setApptNote] = useState("");
    const [booking, setBooking] = useState(false);
    const [bookMsg, setBookMsg] = useState("");
```
新增 handler：
```tsx
    async function handleBook() {
        if (!preferredTime) { setBookMsg("請選擇希望看房時間"); return; }
        setBooking(true); setBookMsg("");
        try {
            await bookAppointment(listing!.id, new Date(preferredTime).toISOString(), apptNote || undefined);
            setBookMsg("預約已送出，等待屋主確認");
            setPreferredTime(""); setApptNote("");
        } catch (e) {
            setBookMsg(e instanceof Error ? e.message : "預約失敗");
        } finally {
            setBooking(false);
        }
    }
```
區塊 JSX（明確 `bg-*`，避免 Edge 深色變黑底）：
```tsx
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">預約看房</h2>
                    {!authenticated ? (
                        <p className="text-sm text-on-surface-variant">請先 <Link to="/login" className="text-primary underline">登入</Link> 並完成租客身分後預約。</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-semibold text-on-surface-variant">希望看房時間</span>
                                <input type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}
                                    className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-semibold text-on-surface-variant">留言給屋主（選填）</span>
                                <textarea value={apptNote} onChange={(e) => setApptNote(e.target.value)} rows={3}
                                    className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-on-surface" />
                            </label>
                            <button type="button" onClick={handleBook} disabled={booking}
                                className="self-start rounded-full bg-primary px-6 py-2 text-sm font-bold text-on-primary disabled:opacity-50">
                                {booking ? "送出中..." : "送出預約"}
                            </button>
                            {bookMsg && <p className="text-sm text-on-surface-variant">{bookMsg}</p>}
                        </div>
                    )}
                </section>
```

- [ ] **Step 2: lint + build**

Run: `cd react-service && npm run lint && npm run build`（timeout 300000ms）
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add react-service/src/pages/RentDetailPage.tsx
git commit -m "feat: RentDetailPage 新增預約看房區塊"
```

---

## Task 9: MyPropertiesPage 屋主預約清單 + 確認/取消

**Files:**
- Modify: `react-service/src/pages/MyPropertiesPage.tsx`

- [ ] **Step 1: 為每個物件卡片載入並顯示預約**

import 加 `import { listPropertyAppointments, confirmAppointment, cancelAppointment, type Appointment } from "../api/appointmentApi";`。
在物件卡片元件內以 `useState<Appointment[]>` + `useEffect` 呼叫 `listPropertyAppointments(property.id)`，渲染清單（顯示 queue_position、preferred_time、status、note）。
為 `PENDING` 項目提供「確認」按鈕（彈出/輸入 confirmed_time → `confirmAppointment(id, iso)`）與「取消」按鈕（`cancelAppointment(id)`），成功後重載清單。所有按鈕加明確 `bg-*` class。

> 實作細節：沿用 MyPropertiesPage 既有卡片結構與載入/錯誤狀態樣式；不新增 CSS 檔。

- [ ] **Step 2: lint + build**

Run: `cd react-service && npm run lint && npm run build`（timeout 300000ms）
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add react-service/src/pages/MyPropertiesPage.tsx
git commit -m "feat: MyPropertiesPage 屋主預約清單與確認/取消"
```

---

## Task 10: 移除 ListingDetailPage 預約 UI + 驗證收斂

**Files:**
- Modify: `react-service/src/pages/ListingDetailPage.tsx`
- Modify: `docs/superpowers/goals/2026-06-09-rental-matching-mainline-consolidation.md`
- Modify: `dev_log/2026-06-09.md`

- [ ] **Step 1: 移除 ListingDetailPage 內的預約相關 UI 與 API 呼叫**

刪除預約區塊、預約 state、對舊 `/listings/:id/appointments` 的呼叫。若整頁因此無實質內容，於 `router/index.tsx` 評估下架 `/my/listings/:id`（與使用者確認後再刪路由）。

- [ ] **Step 2: 全量驗證**

Run（皆 timeout 300000ms）：
- `cd go-service && go test ./... && go build ./... && gofmt -l .`
- `cd react-service && npm run lint && npm run build`
Expected: 全 PASS、gofmt 無輸出、lint/build 0 errors。

- [ ] **Step 3: 手動端到端（需啟動服務，dev server 用 run_in_background）**

1. 啟 DB / go-service / react dev server。
2. 以 TENANT 開 `/rent/:id` → 送出預約 → 應顯示「等待屋主確認」。
3. 以該物件 OWNER 開 `/my/properties` → 應看到該預約 → 確認 → 狀態變 CONFIRMED。
記錄結果（截圖/操作紀錄）。

- [ ] **Step 4: 更新 goal 錨點與 dev_log**

於錨點 S1 勾選完成的目標/驗證事項、更新「進度快照」與「目前指針」（指向 S2）、補變更紀錄。
於 `dev_log/2026-06-09.md` 追加 S1 完成紀錄：主題、決策（property-based 單一預約表、退場舊接live）、影響範圍、驗證結果。

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/ListingDetailPage.tsx docs/superpowers/goals/2026-06-09-rental-matching-mainline-consolidation.md dev_log/2026-06-09.md
git commit -m "feat: 移除舊 ListingDetailPage 預約 UI；S1 驗證與文件收斂"
```

---

## Self-Review 對照

- **Spec 覆蓋**：schema(T1)、model(T2)、repo(T3)、service+測試(T4)、dto/handler(T5)、接線+退場(T6)、前端 api(T7)、租客 UI(T8)、屋主 UI(T9)、退場舊 UI+驗證(T10) — 全覆蓋。
- **底層 table 治理**：複用 `listing_appointments`、參照 `property`、不新增表 ✅。
- **型別一致**：`PropertyID`、`BookForRentalListing(ByWallet)`、`AppointmentResponse`、`Appointment` 前後一致。
- **待實作期確認**：wiring.go 內 property repo / userRepo 實際變數名、`model.Property`/`model.User` 欄位名（owner_user_id、id）以實際程式為準；MyPropertiesPage 卡片結構沿用既有。
```
