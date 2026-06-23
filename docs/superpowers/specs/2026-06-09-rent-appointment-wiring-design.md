# S1 設計：預約看房接通新 rental_listing 模型（最小接線）

> 日期：2026-06-09 ｜ 對應 goal 錨點：`docs/superpowers/goals/2026-06-09-rental-matching-mainline-consolidation.md` 階段 **S1**
> 範圍決策（使用者 2026-06-09 核可）：最小接線、預約參照 `properties`、退場舊預約接線。

## 一、背景與問題

平台存在兩套並行的刊登系統：

| | 舊（init SQL 07/10） | 新（`platform/db/schema.go` EnsureSchema，目前 live） |
|--|--|--|
| 物件 | `listings` | `properties` |
| 租屋刊登 | `listing_rent_details` | `rental_listing`（`/rent/:id` 的 id 來源） |
| 預約看房 | `listing_appointments` → FK `listings(id)` | ❌ 無 |

確認的斷鏈：
1. `listing_appointments` 綁舊 `listings`，新 `rental_listing` 沒有任何預約能力。
2. 舊預約 API `POST /listings/:id/appointments`（`modules/listing`）操作 `listings.id`，與 `rental_listing.id` 不相容。
3. `RentDetailPage` 前端**無預約 UI**（僅收藏 HeartButton）。

→ S1 是「接線」而非修 bug。

## 二、目標 / 非目標

**目標**
- 租客可在 `/rent/:id` 對該租屋物件發起預約看房。
- 屋主可看到並確認 / 取消該物件的預約。
- 預約以**單一**主表 `listing_appointments` 承載，參照 `properties(id)`，租/售共用、未來不長第二張表。

**非目標（YAGNI）**
- 不做買賣 (`sale_listing`) 的預約 UI（schema 以 property 為鍵已自然涵蓋，留待後續）。
- 不做配對/案件（屬 S2/S3）。
- 不收斂舊 `listings` / `listing_*_details` 主表本身（僅退場其預約接線）。

## 三、設計決策

### 3.1 底層 Table 治理（最高約束）
- **複用** `listing_appointments` 為唯一預約主表；**不新增**第二張預約表。
- 參照鍵改為 `property_id → property(id)`：看房對應的是「物件」，租/售刊登皆掛在 `property` 下，以 property 當鍵可一表涵蓋兩種。
  - ⚠️ live 物件表是 **`property`（單數）**：`schema.go EnsureSchema` 啟動時把舊 `properties` RENAME 成 `customer`，另建新 `property` 表，`rental_listing.property_id → property(id)`。本設計一律以 `property` 為準。
- 同步更新 `docs/database/relational-database-spec.*`。

### 3.2 退場舊預約接線（必要取捨）
「參照 properties + 同類一張表」與「完全不動舊系統」無法並存：舊 `modules/listing` 的預約 handler 綁 `listings.id`，一旦本表改 property-based 即失效。故 S1 一併**退場**：
- 移除 `modules/listing` 的 `BookAppointment / ConfirmAppointment / UpdateAppointmentStatus / CancelAppointment` 及對應 routes。
- 移除 `ListingDetailPage`（`/my/listings/:id`，已不在 live 導覽）的預約 UI；若整頁因此無內容，評估一併下架路由。
- 此為「清除已死接線」，不改變任何 live 行為。

## 四、資料模型

`listing_appointments` 變更（idempotent，經 `schema.go EnsureSchema` 套用至既有 DB，並更新 init SQL 供全新安裝）：

- 新增 `property_id BIGINT REFERENCES property(id)`（注意：live 表為單數 `property`）。
- `listing_id`：移除 `NOT NULL`（保留欄位避免破壞反向 FK；標記為 legacy，新寫入不使用）。
- 移除唯一鍵 `(listing_id, visitor_user_id)`，新增 `(property_id, visitor_user_id)`（同物件同訪客僅一筆 active）。
- 新增 `idx_listing_appointments_property_id`。
- 反向 FK `listings.negotiating_appointment_id → listing_appointments(id)` 不受影響（參照 PK）。

沿用既有欄位：`queue_position / preferred_time / confirmed_time / status / note / created_at / updated_at`。

狀態機（沿用）：`PENDING → CONFIRMED → VIEWED → INTERESTED`，任何狀態 → `CANCELLED`。

> 既有舊資料：dev DB 實務上無有效舊預約；migration 不回填 `property_id`（保持 NULL），舊列視為 legacy。production 套用前須再評估（見風險）。

## 五、後端（Go，遵守分層 router→handler→service→repository）

新增單一職責 `modules/appointment`：
- `repository`：property-based 的 `listing_appointments` 存取（由現 `listing_appointment_repo.go` 搬移改寫，鍵改 property_id）。
- `service`：建立（解 rental_listing→property、隊列序號、重複擋下）、確認、狀態更新、取消、擁有權檢查。
- `handler`：HTTP 層。
- `bootstrap/wiring.go` + `router.go` 接線；移除舊 listing 預約 routes。

API（最終命名於實作計畫定稿）：
- 租客建立：`POST /api/rental-listings/:id/appointments`（body: preferred_time, note）→ service 由 `rental_listing.id` 解出 `property_id`。
- 屋主查詢：`GET /api/properties/:id/appointments`。
- 確認：`PUT /api/appointments/:id/confirm`（body: confirmed_time）。
- 狀態 / 取消：`PUT /api/appointments/:id/status`、`PUT /api/appointments/:id/cancel`。
- 權限：建立需 TENANT；確認/取消需該 property 的 OWNER。非法狀態轉移回 422（沿用 `ErrInvalidStatus` 範式）。

## 六、前端（React，fetch + useState，樣式進 index.css/Tailwind）

- `src/api/`：新增 appointment API client。
- `RentDetailPage`：新增「預約看房」區塊 —— 未登入/非 TENANT 顯示對應引導；已具資格者可填希望時間 + 留言送出；誠實 loading/empty/error 狀態。
- 屋主端：於 `MyPropertiesPage` 顯示各物件的預約清單與確認/取消操作（使用者 2026-06-09 指定）。
- 移除 `ListingDetailPage` 預約 UI。

## 七、測試與驗證

- service 單元測試：隊列序號遞增、狀態轉移合法/非法、擁有權檢查、`(property_id, visitor_user_id)` 重複預約擋下、rental_listing→property 解析。
- `go test ./...`（timeout 300000ms）、gofmt、`go vet`。
- `npm run lint` + `npm run build`（timeout 300000ms）。
- 手動端到端：TENANT 於 `/rent/:id` 預約 → OWNER 端看到並確認。
- 確認無殘留指向舊 `listings` 的死碼；DB spec 已更新。

## 八、風險與待確認

- **production 既有預約資料**：本設計假設無有效舊資料。若 production 有，套用前需資料遷移評估（將舊 `listing_id` 對應到 `property_id`）。
- **ListingDetailPage 是否整頁下架**：視移除預約 UI 後是否還有其他用途；於實作計畫確認。
- 屋主確認 UI 位置已定為 `MyPropertiesPage`（2026-06-09）。
- **舊 listing 模組其他功能**：僅退場預約相關，其餘（若有）不動。

## 九、對 goal 錨點 S1 的對應

涵蓋 S1 全部目標事項與驗證事項；table 決策（複用 `listing_appointments`、參照 `properties`、不新增表）符合錨點「🧱 底層 Table 治理」。
