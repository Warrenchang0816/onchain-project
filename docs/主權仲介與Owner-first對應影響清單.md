# 主權仲介與 Owner-first 對應影響清單

> 目的：把「Owner-first 去中心化房地產服務市場」的願景，拆成可落地的 **DB / 合約 / 模組** 影響清單。  
> 原則：本文件不是 live schema，也不是立即開發清單；而是後續 phase 規劃時的對照基準。  
> 更新日期：2026-04-18

---

## 一、核心前提

### 1.1 已確認的平台原則

- 平台核心是 **Owner-first**
- 仲介是平台上的主權服務節點，不是平台員工
- 仲介可為個人品牌、小團隊、法人
- 包租代管 / 透明代管是 **AGENT 角色下的管理權限延伸**
- 仲介履歷 / 專家頁是市場自行判斷信用與專業度的依據，不是平台分級制度
- Phase 1 仍以 **屋主自租、租客需求、仲介基本委託版** 為主

### 1.2 規劃原則

- **Phase 1**：只補最小必要欄位與能力，不把理想模型一次做爆
- **Phase 2**：補齊仲介主權、專家頁、授權細分、後台查詢
- **Phase 3**：透明代管、維護履歷、分帳、自動化工具箱

---

## 二、DB 影響清單

## 2.1 `users`

### 現況

目前 `users` 是正式身份主表，承接：

- `person_hash`
- `wallet_address`
- `identity_hash`
- `kyc_status`
- `identity_nft_token_id`
- `password_hash`

### 影響

#### Phase 1 不建議立即加回的欄位

以下欄位雖然符合願景，但目前不應直接回填進 `users`，避免再次把 profile layer 和 auth root table 混在一起：

- `occupation`
- `income_range`
- `family_status`
- `household_size`
- `profile_completed`

#### 建議

- 保持 `users` 作為 **身份根表**
- 若要承接租客 / 屋主畫像，建議未來新增獨立 profile table，而不是把所有畫像欄位塞回 `users`

---

## 2.2 建議新增：`user_profiles`

### 目的

承接「KYC 之上的 Profile Layer」，讓平台可以收斂租客需求、屋主偏好、瀏覽統計族群，而不污染 `users` 主表。

### 建議欄位

- `user_id`
- `display_name`
- `occupation`
- `income_range`
- `family_status`
- `household_size`
- `bio`
- `profile_visibility`
- `profile_completed`
- `created_at`
- `updated_at`

### 用途

- 需求推薦
- 瀏覽族群統計
- 高齡市場 / 家庭型租客分析
- 後續仲介 / 專家頁延伸資料基礎

### 建議 phase

- **Phase 2**

---

## 2.3 `user_credentials`

### 現況

目前已存在，承接：

- OWNER
- TENANT
- AGENT

### 影響

這張表未來應成為「三身分擴充」的正式樞紐，但不要被誤用成平台階級表。

### 建議新增 / 補強欄位

- `credential_type`
- `application_status`
- `approved_at`
- `revoked_at`
- `review_notes`
- `metadata_json`

### 補充

`metadata_json` 可承接各身分的差異資料，例如：

- OWNER：房產佐證摘要
- TENANT：收入 / 就業證明摘要
- AGENT：證照、品牌、公司、服務範圍

### 建議 phase

- **Phase 1.5 ~ Phase 2**

---

## 2.4 建議新增：`agent_profiles`

### 目的

建立「仲介主權頁 / 專家頁 / 履歷頁」，讓仲介信用不再只依附公司品牌。

### 建議欄位

- `user_id`
- `brand_name`
- `license_no`
- `company_name`
- `service_areas`
- `specializations`
- `years_of_experience`
- `bio`
- `is_accepting_new_cases`
- `profile_visible`
- `created_at`
- `updated_at`

### 補充

這張表不是平台分級機制，而是 **仲介公開履歷頁**。

### 建議 phase

- **Phase 2**

---

## 2.5 建議新增：`agent_reputation_snapshots`

### 目的

保留仲介的可驗證經驗摘要，支撐專家頁與市場判斷，但不直接把它當平台官分級。

### 建議欄位

- `agent_user_id`
- `completed_case_count`
- `active_authorization_count`
- `managed_property_count`
- `rating_avg`
- `rating_count`
- `complaint_count`
- `updated_at`

### 補充

這類數據可由 `cases`、`authorizations`、`management_logs` 等聚合，不一定一開始就要實體化；若實體化，應明確標示為 snapshot / cache。

### 建議 phase

- **Phase 2 ~ 3**

---

## 2.6 房屋平台核心表（目前不在 live schema）

目前 `properties / property_authorizations / listings / tenant_demands / cases` 已從 live schema 拔除，但願景落地仍需要它們回歸，只是要等真正進入下一階段再重新建。

### 必要回歸表

- `properties`
- `property_owners`
- `property_authorizations`
- `listings`
- `listing_views`
- `tenant_demands`
- `cases`
- `case_events`

### 回歸時要特別補強的欄位

#### `properties`
- `fixed_address`
- `geo_lat`
- `geo_lng`
- `property_status`
- `occupancy_status`
- `disclosure_snapshot_json`

#### `property_authorizations`
- `authorization_scope`
  - `MATCH_ONLY`
  - `SHOWING`
  - `MANAGEMENT`
- `service_fee_bps`
- `mandate_duration_days`
- `penalty_amount`
- `introduced_by_agent_user_id`
- `is_locked_for_mutual_consent`

#### `listings`
- `contact_reveal_mode`
- `allow_agent_contact`
- `allow_self_rent`
- `showing_schedule_json`
- `current_rental_status`

#### `listing_views`
- `viewer_profile_snapshot`
- `viewer_group_tags`

#### `tenant_demands`
- `budget_range`
- `preferred_area`
- `family_status`
- `occupation`
- `income_range`
- `allow_agent_contact`

#### `cases`
- `introduced_by_agent_user_id`
- `cooldown_until`
- `offline_deal_claim_status`
- `management_mode`

### 建議 phase

- **Phase 2**

---

## 2.7 後台與爭議查詢

### 建議

Phase 1 不做完整 admin system，但 DB 與查詢模型應預留最低限度能力：

- 查人
- 查物件
- 查授權
- 查案件
- 查申訴 / 爭議

### 建議表

- `complaints`
- `audit_logs`

### 建議 phase

- `complaints`：**Phase 2**
- `audit_logs`：若後端操作開始複雜，可提早進 **Phase 1.5**

---

## 三、合約影響清單

## 3.1 `IdentityNFT.sol`

### 現況

已定義：

- `NATURAL_PERSON`
- `OWNER`
- `TENANT`
- `AGENT`

### 影響

目前設計與平台三身分主線一致，不需要再新增新角色 token。

### 建議

- 維持三身分 + 自然人基座
- 不新增 `PROPERTY_MANAGER`
- 代管能力應交由授權合約與資料層表達，不交由新 tokenId 表達

---

## 3.2 `AgencyRegistry.sol`

### 現況

是最關鍵的後續合約，因為它承接：

- 屋主主權
- 仲介授權
- 解約規則
- 委託範圍

### 影響

此合約要能支撐「仲介主權」與「Owner-first」同時成立。

### 建議新增 / 補強能力

- 授權 scope 區分
  - `MATCH_ONLY`
  - `SHOWING`
  - `MANAGEMENT`
- 委託條款上鏈
  - 服務費
  - 委託期限
  - 解約違約金
- `lockForMutualConsent`
- `revokeWithConsent`
- `forceRevoke`
- `introducedByAgent`
- operator / sub-operator 概念

### 關鍵原則

- 仲介拿到的是服務授權，不是資產所有權
- 涉及押金、解約、資產核心欄位變更時，應保留屋主最終確認權

### 建議 phase

- **Phase 2 核心**

---

## 3.3 `PropertyRegistry.sol`

### 影響

承接：

- 物件唯一 ID
- 地址不可變
- 物件認證
- 揭露資訊 hash

### 建議新增 / 補強原則

- 一物一 ID
- 地址不可改
- 一次只能有一個主操作主體
- 多 owner 可存在，但需有主操作人

### 建議 phase

- **Phase 2 核心**

---

## 3.4 `ListingStakeVault.sol`

### 影響

承接：

- 刊登押金
- 誠信押金
- 後續可能的違規扣 stake

### 建議

- 押金不要和直接取得電話綁死
- 押金應與「行為」綁定
  - 惡意約看
  - 解約後繞平台成交
  - 不實揭露

### 建議 phase

- **Phase 2**

---

## 3.5 `CaseTracker.sol`

### 影響

承接：

- 誰引入誰進媒合
- 案件狀態
- 解約冷卻期
- 包租代管 / 維護履歷延伸

### 建議新增 / 補強能力

- `introducedByAgent`
- `cooldown window`
- `dispute / complaint linkage`
- 後續可擴充 maintenance / management records

### 建議 phase

- **Phase 2 核心**

---

## 四、Go 模組影響清單

## 4.1 `modules/auth`

### 影響

主責仍保持單純：

- login
- session
- SIWE

### 不應承擔

- profile layer
- agent page
- property / agency 邏輯

### 結論

- **不擴張**

---

## 4.2 `modules/onboarding`

### 影響

目前已完成自然人 onboarding，但若未來要支撐 Profile Layer，這裡只應接住最早期的最小必要資料。

### 建議

Phase 2 若要補 profile，建議只補：

- onboarding 完成後導向 profile completion
- 不要把完整 agent / owner 專業資料塞進 onboarding wizard

### 結論

- **僅做最小延伸**

---

## 4.3 `modules/user`

### 影響

未來會成為身份中心的核心模組，需承接：

- `/api/kyc/me`
- 自然人 KYC 狀態
- OWNER / TENANT / AGENT credential 狀態
- profile completion 狀態

### 建議新增責任

- profile summary 查詢
- credential overview
- identity center aggregate API

### 建議 phase

- **Phase 1.5 ~ 2**

---

## 4.4 建議新增：`modules/agent`

### 目的

承接仲介主權頁與專家頁，而不是把所有 agent 邏輯都塞在 `user`。

### 建議責任

- 仲介檔案
- 專家頁
- 履歷 / 統計摘要
- 公司 / 品牌資訊
- 是否接受委託

### 建議 phase

- **Phase 2**

---

## 4.5 建議新增：`modules/property`

### 目的

承接物件唯一識別、物件認證、揭露義務、共同持有。

### 建議責任

- property create / verify
- disclosure update
- owner relation
- address immutability

### 建議 phase

- **Phase 2**

---

## 4.6 建議新增：`modules/agency`

### 目的

承接屋主與仲介之間的授權關係，是 Owner-first 平台最核心的商業模組之一。

### 建議責任

- 建立委託
- 撤銷委託
- mutual consent lock
- 仲介引入足跡
- 管理權限延伸

### 建議 phase

- **Phase 2 核心**

---

## 4.7 `modules/task` 的定位

### 現況

目前仍是 listing / case compatibility backbone。

### 建議

- 不再往 `task` 追加新願景邏輯
- 新的 Owner-first / agent sovereignty 願景，不應繼續疊在 `task` 命名上
- 後續應逐步讓 `task` 退到 compatibility 層

### 結論

- **只維持相容，不再加新核心責任**

---

## 五、前端影響清單

## 5.1 Identity Center

### 影響

目前已有 NATURAL_PERSON 與三角色入口，未來可延伸但不應改變三身分主軸。

### 建議

- 保留三入口
- 增加 profile completeness
- 增加 credential progress

---

## 5.2 Agent Page / Expert Page

### 目的

把仲介信用與專業度公開化，讓市場自行判斷，而非平台分級。

### 建議內容

- 履歷摘要
- 專長
- 服務區域
- 接案狀態
- 成交 / 委託摘要
- 評價

### 建議 phase

- **Phase 2**

---

## 5.3 Admin 查詢工具

### 建議

Phase 1 只做查詢，不做完整操作平台：

- 查人
- 查物件
- 查授權
- 查案件
- 查 KYC / credential

### 建議 phase

- **Phase 1.5**

---

## 六、優先順序建議

### 第一優先

1. 穩住現有 KYC / Auth / IdentityCenter
2. 保持 `task` compatibility，不再追加願景邏輯
3. 先把 Owner-first / Agent sovereignty 寫進規劃與架構文件

### 第二優先

1. `user_profiles`
2. `agent_profiles`
3. `modules/agent`
4. `modules/property`
5. `modules/agency`

### 第三優先

1. `properties / authorizations / listings / demands / cases` 正式回歸
2. 專家頁 / 履歷頁
3. 最低限度 admin 查詢

### 第四優先

1. 透明代管
2. 維護履歷
3. 分帳
4. 更完整爭議處理

---

## 七、總結

這份願景對系統的核心影響可以濃縮成一句話：

> **自然人 KYC 只是一切的起點；後續要建立的是 Owner-first 的授權市場，以及仲介可攜帶的主權品牌與信用資產。**

落地策略上，最重要的是：

- 不新增第四身分
- 不把 profile layer 塞回 `users`
- 不把新願景繼續疊在 `task` 命名上
- 先分清 live flow 與後續 phase，再逐步回補 DB / 合約 / 模組

