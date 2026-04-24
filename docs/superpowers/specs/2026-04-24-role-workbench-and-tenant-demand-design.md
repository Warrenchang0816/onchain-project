# 身份中心角色工作台與租屋需求主線設計

> 適用日期：2026-04-24  
> 依據文件：`docs/開發規劃書.md`、`docs/架構設計書.md`、`docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`  
> 適用範圍：Gate 1B 後續的產品工作台收斂，聚焦身份中心角色工作台、屋主未完善物件草稿、租客需求主線、租客進階資料與仲介專頁入口  
> 本文件不包含：`favorites`、全站繁中掃描、全站按鈕樣式全面整理；這三者另列支援軌 spec

---

## 1. 背景

Gate 1A 與 Gate 1B 完成後，平台已具備：

- 自然人 KYC 與角色憑證啟用閉環
- 角色能力守門
- 公開仲介列表

但身份中心目前仍偏向「顯示狀態」，缺少角色啟用後的實際工作台與後續入口。使用者通過角色認證後，應立即進入對應業務流程，而不是只看到 NFT 與狀態文案。

本次設計要把身份中心從「認證結果頁」推進為「角色工作台入口」，並明確維持下列原則：

- 屋主啟用後直接進入物件工作流
- 租客啟用後可建立需求，但需求與身份認證不自動綁死
- 平台揭露資料完整度，不做官方審核背書
- 仲介公開專頁與登入後工作摘要分離
- 不提前把 Gate 2 的 `propertyId / deed_hash / disclosure snapshot` 半做進來

---

## 2. 設計目標

### 2.1 本次要解決的事

1. 身份中心下半部改成角色工作台區塊
2. `OWNER` 啟用後自動建立第一筆未完善物件草稿
3. `TENANT` 啟用流程改成輕量填寫制，不靠 OCR
4. 租客另有可選的「進階資料」補件區塊，對外只揭露 `已提供進階資料`
5. 新增受權限控管的租屋需求列表主線
6. `AGENT` 啟用後有公開專頁入口與登入後工作摘要入口
7. Header 與身份中心的導覽入口跟著角色狀態調整

### 2.2 本次刻意不做的事

- 不做 `favorites`
- 不做全站英文全面掃描與翻譯
- 不做全站黑底按鈕全面整理
- 不做 Gate 2 正式 `property` 主體與鏈上驗證流程
- 不做租客進階資料的人工審核或平台背書
- 不把仲介預約 / 媒合完整歷程公開到專頁

---

## 3. 已確認的產品決策

### 3.1 OWNER

- `OWNER` 角色啟用成功後，系統自動建立第一筆「未完善物件草稿」
- 這筆草稿不公開，只出現在本人工作台
- 草稿由屋主認證資料初始化，但不能直接上架
- 後續第二筆、第三筆物件也沿用同樣概念：先建立草稿，再補完，再公開
- 所有物件都保留歷史，不提供硬刪除，只用狀態區分

### 3.2 TENANT

- `TENANT` 啟用成功後，不自動建立需求草稿
- 租客身份認證改成輕量填寫制，不依賴 OCR
- 租客另有「進階資料」區塊，可補薪資證明、戶籍 / 戶口類文件、補充說明
- 平台不做審核背書，只揭露資料完整度
- 對外標籤固定使用 `已提供進階資料`
- 此標籤與補件摘要的可見範圍是：
  - 本人可見完整狀態
  - 已登入且具 `OWNER / AGENT` 角色者可見標籤與精簡摘要
  - 公開訪客不可見

### 3.3 AGENT

- `AGENT` 啟用後，身份中心出現仲介專頁與工作摘要入口
- 公開專頁只顯示可公開資訊
- 預約與媒合歷程只放在登入後工作台摘要，不公開全文

### 3.4 導覽層

- Header 新增 `租屋需求列表`
- `租屋需求列表` 只對已登入且具 `OWNER / AGENT` 角色者顯示
- `房源列表` 與 `仲介列表` 保持公開

---

## 4. 主線與支援軌切分

### 4.1 主線

本次主線只包含：

- 身份中心角色工作台
- OWNER 自動草稿與物件工作流入口
- TENANT 輕量身份認證 + 進階資料 + 租屋需求主線
- AGENT 專頁入口與工作摘要入口
- Header / 路由 / 權限顯示調整

### 4.2 支援軌

另開 spec 處理：

- `favorites`
- 全站繁中掃描與預設繁中
- 全站按鈕樣式全面整理

雖然上述三者不在本次主線 spec 內，但本次主線涉及的新頁與新文案，仍必須預設採繁體中文，且不得新增新的黑底按鈕樣式。

---

## 5. 資訊架構

### 5.1 身份中心

身份中心分成上下兩層：

1. 上半部維持現有認證資訊
   - KYC 狀態
   - 角色卡片
   - 已啟用角色
   - 鏈上記錄
2. 下半部改為角色工作台
   - `我的物件`
   - `我的租屋需求`
   - `租客進階資料`
   - `我的仲介專頁`

工作台區塊顯示規則：

- 只有角色已啟用才顯示對應區塊
- 未啟用角色完全隱藏，不顯示灰階 placeholder
- 每個區塊都以「摘要卡 + 進入管理」結構呈現

### 5.2 建議路由

本次主線建議新增或明確化下列頁面：

- `/member`
  - 身份中心與角色工作台摘要
- `/my/listings`
  - 屋主的私有物件列表，顯示全部歷史狀態
- `/requirements`
  - 租屋需求列表，只限已登入且具 `OWNER / AGENT`
- `/requirements/:id`
  - 租屋需求詳情，只限已登入且具 `OWNER / AGENT`
- `/my/requirements`
  - 租客本人管理自己的需求列表
- `/my/tenant-profile`
  - 租客進階資料管理頁
- `/my/agent-profile`
  - 仲介專頁與工作摘要管理頁

現有頁面延續使用：

- `/listings`
  - 公開房源列表，只顯示可公開資料
- `/listings/:id`
  - 物件詳情頁；屋主本人可在此進入編輯 / 補完 / 上架流程
- `/agents`
  - 公開仲介列表
- `/agents/:wallet`
  - 公開仲介專頁

---

## 6. OWNER 工作台設計

### 6.1 角色啟用後的自動草稿

`OWNER` 啟用成功時，系統需自動建立第一筆未完善物件草稿。

這筆草稿的產品定義：

- 來源：屋主認證資料初始化
- 對外不可見
- 不能預約、不能公開、不能進公開列表
- 只作為屋主進入物件工作流的第一個容器

### 6.2 不直接建立 property 主體

本次不新增正式 `properties` 主體，也不引入鏈上 `propertyId`。

理由：

- Gate 2 才是正式 `PropertyRegistry / deed_hash / disclosure snapshot` 主線
- 現在先做「工作台草稿」，可以承接屋主啟用後的產品流程
- 後續 Gate 2 再把這筆草稿往正式 property 綁上去

### 6.3 沿用現有 listings 承接草稿

本次先沿用現有 `listings` 表作為未完善草稿容器，但必須補上額外語意欄位，避免與公開房源混淆。

建議新增欄位：

- `draft_origin`
  - `MANUAL_CREATE`
  - `OWNER_ACTIVATION`
- `setup_status`
  - `INCOMPLETE`
  - `READY`
- `source_credential_submission_id`
  - 記錄此草稿是否來自 `OWNER` 認證 submission

另外，為了容納由認證資料初始化的 sparse 草稿，本次需明確放寬 `listings` 的草稿欄位規則：

- `title` 在 `DRAFT + INCOMPLETE` 可為空值，前端以 `未命名物件草稿` 作為顯示 fallback
- `list_type` 在 `DRAFT + INCOMPLETE` 使用明確 enum 值 `UNSET`
- `price` 在 `DRAFT + INCOMPLETE` 可為 `0`

但一旦要從 `INCOMPLETE` 進到 `READY` 或 `ACTIVE`，就必須通過正式刊登欄位驗證。

### 6.4 OWNER 摘要卡內容

身份中心的 `我的物件` 摘要卡至少顯示：

- 未完善草稿數
- 已上架數
- 已下架 / 已結束數
- 最近更新的一筆物件

第一筆自動草稿的卡片需明確標示：

- `由屋主認證資料初始化`
- `尚未完善，無法公開`

### 6.5 列表與詳情行為

私有 `我的物件` 列表顯示所有歷史資料，包括：

- `DRAFT + INCOMPLETE`
- `DRAFT + READY`
- `ACTIVE`
- `REMOVED`
- `CLOSED`

公開房源列表只顯示 `ACTIVE`。

物件不提供硬刪除：

- `REMOVED` 視為下架歷史
- `CLOSED` 視為成交或結束歷史
- 所有資料仍保留供本人追蹤

---

## 7. TENANT 工作台設計

### 7.1 TENANT 身份認證改成輕量填寫制

`TENANT` 啟用流程不再依賴 OCR。

身份啟用所需資料改為輕量表單，例如：

- 姓名
- 職業 / 身分類型
- 工作單位或學校
- 收入區間

平台目標是讓租客完成角色啟用，而不是在角色啟用階段就要求高負擔文件審查。

### 7.2 TENANT 工作台拆成兩塊

租客工作台分成：

1. `我的租屋需求`
2. `租客進階資料`

兩者互相關聯，但不是同一件事：

- 身份啟用不等於已建立需求
- 進階資料不等於平台背書

### 7.3 租客進階資料

租客進階資料是可選補件區，用來增加雙方判斷資訊，不是平台認證。

內容可包含：

- 薪資證明
- 戶籍 / 戶口類文件
- 補充說明
- 補充揭露欄位，例如居住人數、同住對象、入住時程

對外標籤：

- `已提供進階資料`

禁止使用的語氣：

- `完整認可`
- `官方認證`
- `平台審核通過`

### 7.4 租屋需求

`TENANT` 啟用後不自動建立第一筆需求草稿。

租客必須主動建立需求，這樣可以避免把「租客是誰」與「租客現在想租什麼」混成同一件事。

需求資料應獨立成新 domain，可包含：

- 目標區域
- 預算區間
- 房型需求
- 可入住時間
- 是否接受寵物
- 是否需要車位
- 其他條件

### 7.5 租屋需求可見性

`租屋需求列表` 與 `需求詳情` 的可見性規則：

- 只限已登入且具 `OWNER / AGENT`
- 公開訪客不可見
- 租客本人透過 `/my/requirements` 管理自己的需求，不透過 Header 公開導流

在需求詳情頁中：

- 本人看完整資料
- 已登入 `OWNER / AGENT` 可見 `已提供進階資料` 與精簡摘要
- 公開訪客無法進入

---

## 8. AGENT 工作台設計

### 8.1 公開專頁與登入後工作台分離

`AGENT` 啟用後會有兩個層次：

1. 公開仲介專頁
2. 登入後仲介工作台

公開專頁只放可公開資料，例如：

- 顯示名稱
- 簡介
- 服務區域
- 可公開資格資訊
- 認證狀態

登入後工作台再顯示：

- 預約數量摘要
- 媒合紀錄摘要
- 專頁完整度
- 進入編輯入口

### 8.2 agent_profiles

建議新增 `agent_profiles`，作為仲介公開資料與工作台摘要的正式資料來源。

v1 欄位可先包含：

- `user_id`
- `headline`
- `bio`
- `service_areas`
- `license_note`
- `contact_preferences`
- `is_profile_complete`

---

## 9. 資料模型建議

### 9.1 listings 擴充

為了承接 OWNER 自動草稿，`listings` 需補足工作台語意欄位：

- `draft_origin`
- `setup_status`
- `source_credential_submission_id`

本次仍沿用：

- `status = DRAFT / ACTIVE / REMOVED / CLOSED ...`

語意拆分：

- `status` 管工作流狀態
- `setup_status` 管是否已補完到可發布程度

此外，`listings` 需允許在 `DRAFT + INCOMPLETE` 階段保留未完成欄位，不再假設每一筆草稿一建立就已具備完整公開刊登資料。

### 9.2 tenant_profiles

新增 `tenant_profiles`：

- `user_id`
- `occupation_type`
- `org_name`
- `income_range`
- `household_size`
- `co_resident_note`
- `move_in_timeline`
- `additional_note`
- `advanced_data_status`
- `updated_at`

`advanced_data_status` 可先用：

- `BASIC`
- `ADVANCED`

### 9.3 tenant_profile_documents

新增 `tenant_profile_documents`：

- `id`
- `tenant_profile_id`
- `doc_type`
  - `INCOME_PROOF`
  - `HOUSEHOLD_DOC`
  - `OTHER`
- `file_path`
- `created_at`

### 9.4 tenant_requirements

新增 `tenant_requirements`：

- `id`
- `user_id`
- `target_district`
- `budget_min`
- `budget_max`
- `layout_note`
- `move_in_date`
- `pet_friendly_needed`
- `parking_needed`
- `status`
- `created_at`
- `updated_at`

需求狀態 v1 可先用：

- `OPEN`
- `PAUSED`
- `CLOSED`

### 9.5 agent_profiles

新增 `agent_profiles`，供公開專頁與登入後工作台共用。

---

## 10. 後端模組與 API 邊界

### 10.1 credential 模組

`credential` 模組仍負責角色 submission 與 activation。

新增責任：

- `OWNER` 首次 activation 成功後，呼叫內部 listing bootstrap 流程

不新增責任：

- 不在 credential 模組內承接 tenant requirement CRUD
- 不在 credential 模組內承接仲介專頁資料

### 10.2 listing 模組

`listing` 模組延續作為當前租屋主線的正式容器。

新增責任：

- 建立由 `OWNER` activation 初始化的未完善草稿
- 區分 `INCOMPLETE` 與 `READY`
- 私有列表需能回傳全部歷史狀態

### 10.3 tenant 模組

新增 `tenant` 模組，負責：

- tenant profile 基本資料
- 進階資料補件
- `已提供進階資料` 狀態計算
- tenant requirements CRUD
- 只對 `OWNER / AGENT` 開放的需求查詢

### 10.4 agent 模組

現有 `agent` 模組從公開列表擴成：

- 公開專頁
- 本人專頁管理
- 工作台摘要

---

## 11. 前端頁面與元件邊界

### 11.1 身份中心

修改 `IdentityCenterPage`：

- 保留現有上半部
- 下半部加入角色工作台摘要卡
- 每張卡只在角色已啟用時顯示

### 11.2 OWNER 相關頁面

- 新增 `MyListingsPage`
  - 顯示全部歷史物件
  - 顯示未完善草稿
- 延用現有 `ListingDetailPage`
  - 屋主本人可進入編輯 / 補完 / 發布
- 延用現有 `ListingEditorForm`
  - 不另造一套物件編輯表單

### 11.3 TENANT 相關頁面

- 新增 `MyRequirementsPage`
- 新增 `RequirementsPage`
- 新增 `RequirementDetailPage`
- 新增 `TenantProfilePage` 或等價頁面
  - 管理進階資料與補件

### 11.4 AGENT 相關頁面

- 新增 `MyAgentProfilePage`
- 擴充現有 `AgentDetailPage`
  - 顯示 `agent_profiles` 的公開資料
- 擴充現有 `AgentListPage`
  - 支援篩選

### 11.5 Header

Header 調整：

- 新增 `租屋需求列表`
- 僅在已登入且具 `OWNER / AGENT` 身份時顯示

---

## 12. 狀態規則與完整度判定

### 12.1 OWNER 草稿狀態

OWNER 自動草稿需同時考慮兩層狀態：

- `status`
  - `DRAFT`
  - `ACTIVE`
  - `REMOVED`
  - `CLOSED`
- `setup_status`
  - `INCOMPLETE`
  - `READY`

代表意義：

- `DRAFT + INCOMPLETE`
  - 由認證資料初始化，尚未補完
- `DRAFT + READY`
  - 已補完，可發布但尚未公開
- `ACTIVE`
  - 已公開

### 12.2 OWNER 發布條件

v1 的可發布條件只看現有 listing 主欄位是否補齊：

- 標題
- 地址 / 行政區
- 租售類型
- 價格
- 坪數
- 房間數
- 衛浴數

本次不把封面圖設為硬條件。

本次不把 Gate 2 的 `propertyId / deed_hash / disclosure snapshot` 設為發布門檻。

### 12.3 OWNER bootstrap idempotency

自動建立草稿只允許在「首次 OWNER 啟用成功，且目前沒有任何 owner-owned listing」時發生。

必須避免：

- 重整頁面重複建立
- 重跑 sync / activation 重複建立
- 角色重新讀取狀態時重複建立
- 舊 Gate 0 使用者原本就有 listing，卻又被多建立一筆 bootstrap 草稿

判定方式應以資料存在性為準，而不是只靠前端行為。

### 12.4 TENANT `已提供進階資料`

此標籤採規則達成制，不做人工審核。

建議規則：

- 已填基本租客資料：
  - 職業類型
  - 工作 / 學校
  - 收入區間
- 已填至少一項補充揭露：
  - 居住人數
  - 同住對象
  - 入住時程
  - 補充說明
- 已上傳至少一份進階文件：
  - 薪資證明
  - 戶籍 / 戶口類文件
  - 其他輔助文件

滿足以上條件即可顯示 `已提供進階資料`。

未達成時只顯示「可補充更多資料」，不顯示負向評分或警告。

---

## 13. 篩選與可見性規則

### 13.1 租屋需求列表篩選

v1 篩選先做：

- 目標區域
- 預算區間
- 可入住時間
- 房型需求
- 是否接受寵物
- 是否需要車位

### 13.2 仲介列表篩選

v1 篩選先做：

- 服務區域
- 是否已補齊公開專頁
- 最近啟用 / 最近更新排序

### 13.3 可見性規則總表

- 公開訪客
  - 可看 `房源列表`
  - 可看 `仲介列表`
  - 不可看 `租屋需求列表`
  - 不可看租客進階資料標籤
- TENANT 本人
  - 可管理自己的需求
  - 可管理自己的進階資料
- OWNER / AGENT
  - 可看 `租屋需求列表`
  - 可在需求詳情頁看到 `已提供進階資料` 與精簡摘要

---

## 14. 驗證邊界

### 14.1 後端驗證

至少要覆蓋：

- `OWNER` 首次啟用只建立一筆自動草稿
- 非首次啟用不重複 bootstrap
- `INCOMPLETE` 草稿不會進公開 listing API
- `READY` 前不可 publish
- `已提供進階資料` 只靠規則計算，不依賴人工審核欄位
- 租屋需求列表 API 只允許 `OWNER / AGENT`

### 14.2 前端驗證

至少要覆蓋：

- 身份中心只顯示已啟用角色區塊
- `租屋需求列表` 僅對 `OWNER / AGENT` 顯示
- OWNER 可在工作台看到自動草稿
- 公開房源列表不會看到 `INCOMPLETE` 草稿
- 租客需求詳情頁中，`已提供進階資料` 的可見性符合角色規則
- 本次新增與修改文案一律使用繁體中文
- 本次主線涉及頁面不得新增黑底按鈕樣式

---

## 15. 風險與後續銜接

### 15.1 主要風險

- `listings` 同時承接公開房源與未完善草稿，若語意欄位設計不清楚，容易混淆
- 租客進階資料若文案失手，會讓使用者誤以為平台在背書
- 仲介專頁若把工作歷程公開太多，可能暴露不該公開的業務資訊

### 15.2 銜接 Gate 2

這份設計明確保留 Gate 2 的主體邊界：

- OWNER 自動建立的是「工作草稿」，不是正式鏈上 property
- Gate 2 再把這筆草稿與正式 property 主體銜接
- 不在本次主線提前接入 `propertyId / deed_hash / disclosure snapshot`

### 15.3 支援軌後續

本次主線完成後，再另外補：

- `favorites`
- 全站繁中掃描
- 全站按鈕樣式整理

---

## 16. 結論

本次主線的核心不是再多幾張資訊頁，而是把角色啟用正式接成「角色工作台」：

- `OWNER` 啟用後直接有第一筆未完善物件草稿
- `TENANT` 啟用後有需求入口與進階資料揭露機制
- `AGENT` 啟用後有公開專頁與工作摘要入口

這樣做能讓 Gate 1 的角色憑證從「可顯示」變成「可運作」，同時又不提前把 Gate 2 的 property 鏈上主體混進來。
