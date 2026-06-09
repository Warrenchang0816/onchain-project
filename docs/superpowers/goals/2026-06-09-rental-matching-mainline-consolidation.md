# GOAL ANCHOR — 租屋媒合主線收斂

> 類型：living goal anchor（由 `/goal` 指令讀取並更新進度）
> 建立：2026-06-09 ｜ 範圍：租屋主線 off-chain 媒合閉環收斂
> 治理依據：`Project_Rules.md`、`docs/開發規劃書.md`、`docs/第六階段架構定稿：可信房屋媒合平台.md`、最新 `dev_log/`
> 路徑選擇：方案 A（閉環優先、由淺到深串接）— 經使用者 2026-06-09 核可

---

## 北極星（North Star）

讓**物件 ↔ 需求可被真正配對**，並走完 **預約看房 → 案件追蹤（off-chain）** 的可跑閉環。
收斂目標不是堆功能，而是把已經厚實的供給側（`properties` + `listing_rent_details`）與需求側（`tenant_profiles` + `tenant_requirements`）真正接成一條 KYC→角色→物件→需求→配對→預約→案件 的可驗證主線。

完成定義（Definition of Done）：一位 OWNER 與一位 TENANT 能在系統內，從刊登/登需求 → 被配對 → 預約看房 → 建立案件 → 推進至結案，全程 off-chain 可跑通且有驗證證據。

---

## 🧱 底層 Table 治理（最高約束，每個階段都必須先過這關）

> 使用者明確要求：**底層 table 要仔細評估，不可亂開；同一類底層基礎資料用同一張表。**

動 DB 前的強制檢查：
1. 先盤點現有 base table，確認這類資料是否已有主表。
2. 同類資料**一律複用既有主表**（必要時擴欄/改外鍵指向），**禁止**為了租/售或子情境另開平行表。
3. 衍生資料（查詢快取、配對結果）優先用 query 解決，不輕易建表；要建也標明為 derived，不是 base。
4. 每個階段的 table 決策需在本錨點與該階段 spec 內寫明「複用 / 擴欄 / 新建」與理由，並同步更新 `docs/database/relational-database-spec.*`。

**各階段預先 table 評估（待實作時驗證後定案）：**
- **S1 預約看房**：已有 `listing_appointments` 為「預約/看房」主表 → **複用**，將其參照從舊 `listings` 重新指向 `properties` / 租屋刊登；**不得**新開 `rent_appointments`。
- **S2 配對**：配對是對既有表（`properties`/`listing_rent_details` × `tenant_requirements`/`tenant_requirement_districts`）的 **query**，**預設不建任何新表**；若需結果快取，僅建 derived 表並標明。
- **S3 案件**：「案件」為全新資料類別 → 建**單一** `cases` base table，**租屋與買賣共用同一張**（以 type 區分），對齊架構定稿統一狀態機；不得拆 `rent_cases` / `sale_cases`。

---

## 階段與目標 / 驗證事項

> 進度標記：`[ ]` 未開始 ｜ `[~]` 進行中 ｜ `[x]` 完成（附驗證證據連結/commit）
> 每階段一律走：feature branch（先問使用者）→ spec → plan → TDD 實作 → 驗證 → dev_log → 繁中總結。

### 階段 S1：預約看房接通新租屋物件　狀態：[ ]

**目標事項**
- [ ] 先實機/讀碼查清 `listing_appointments` 現況：是否仍綁舊 `listings`、新 `/rent/:id` 是否能發起預約（systematic-debugging 釐清「修復」或「接線」）。
- [ ] `/rent/:id` 詳情頁可由 TENANT 發起預約看房，預約綁 `properties` / 租屋刊登。
- [ ] 屋主（OWNER）端可看到並確認/取消該物件的預約。
- [ ] 預約狀態與既有狀態機一致（排隊 / 確認 / 已看 / 有意願 / 取消）。

**驗證事項**
- [ ] `go test` 預約相關模組 PASS。
- [ ] `npm run lint` + `npm run build` 0 errors。
- [ ] 手動端到端：TENANT 在 `/rent/:id` 預約 → OWNER 端看到並確認。
- [ ] 無孤兒舊表參照（不殘留指向舊 `listings` 的死碼）。
- [ ] `listing_appointments` 的 table 決策符合上節治理並更新 DB spec。

### 階段 S2：雙向配對查詢　狀態：[ ]

**目標事項**
- [ ] 需求側：`/requirements/:id` 或我的需求頁顯示「符合的物件」清單。
- [ ] 物件側：物件頁顯示「符合的租客需求」清單。
- [ ] 配對條件用已對齊欄位：租金、坪數、房數、衛浴、希望區域、傢俱設備需求。
- [ ] 配對為 query/service，預設不新增 base table。

**驗證事項**
- [ ] 配對 service / SQL 單元測試 PASS（含邊界：未指定條件視為不限）。
- [ ] 給定樣本資料，配對結果正確（符合/不符合各驗一筆）。
- [ ] `npm run lint` + `npm run build` 0 errors。
- [ ] 確認未違反 table 治理（無多餘新表）。

### 階段 S3：off-chain 案件狀態機　狀態：[ ]

**目標事項**
- [ ] 建立**單一** `cases` base table（租/售共用，type 區分），對齊架構定稿狀態機。
- [ ] 狀態機 `OPEN → MATCHED → SIGN → CLOSED`（+ `CANCELLED` / `DISPUTED`）。
- [ ] 與 S1 預約、S2 配對銜接：由配對/預約結果可建立案件並推進。
- [ ] 提供建立/查詢/推進案件的 API。

**驗證事項**
- [ ] 狀態轉移單元測試 PASS；非法轉移被擋（回 422 而非 500）。
- [ ] `go test ./...` PASS、gofmt 乾淨。
- [ ] 端到端：配對 → 建案 → 推進 → 結案。
- [ ] `cases` 為單一主表，租售未拆表；DB spec 已更新。

### 階段 S4：端到端串接驗證 + 文件/dev_log 收斂　狀態：[ ]

**目標事項**
- [ ] 完整跑一遍：KYC → 角色啟用 → 物件刊登 → 登需求 → 配對 → 預約 → 案件 → 結案。
- [ ] 補齊/修正 `docs/開發規劃書.md`、`docs/database/relational-database-spec.*` 與本主線相關規格。
- [ ] 補齊缺失的上位文件漂移（例如 gate roadmap spec 路徑失效問題）。

**驗證事項**
- [ ] 全鏈路手動跑通，留存證據（截圖/操作紀錄）。
- [ ] `go test ./...` + `npm run lint` + `npm run build` 全 PASS。
- [ ] `git diff --check`、文件與實作一致、無未完成標記與舊名漂移。
- [ ] dev_log 完整記錄各階段決策與驗證。

---

## 進度快照（由 /goal 更新）

| 階段 | 狀態 | 最近更新 | 證據 |
|------|------|----------|------|
| S1 預約看房接通 | [ ] 未開始 | 2026-06-09 | — |
| S2 雙向配對 | [ ] 未開始 | — | — |
| S3 案件狀態機 | [ ] 未開始 | — | — |
| S4 端到端 + 文件 | [ ] 未開始 | — | — |

**目前指針**：S1（待啟動；第一步為釐清 `listing_appointments` 現況）。

---

## 變更紀錄

- 2026-06-09：建立錨點；方案 A 與 S1–S4 切分經使用者核可；加入底層 table 治理為最高約束。錨點置於 `docs/superpowers/goals/`（`/docs/*` ignore 下唯一被追蹤的可放路徑）。
