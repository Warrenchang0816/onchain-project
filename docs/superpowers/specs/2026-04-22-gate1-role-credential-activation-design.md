# Gate 1 角色身份認證與啟用設計

> 文件性質：正式開工規格 / Gate 1A 設計文件  
> 日期：2026-04-22  
> 關聯文件：`docs/開發規劃書.md`、`docs/架構設計書.md`、`docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`

---

## 1. 目標

Gate 1A 的目標不是立刻改寫平台所有權限，而是先把 `OWNER / TENANT / AGENT` 三大角色身份做成可正式運作的閉環：

1. 使用者可從三個獨立頁面送出角色身份申請
2. 每個身份都支援兩條路線：
   - 智能審核：主流程
   - 人工審核：次要入口
3. 智能與人工都只產生結果，不直接替使用者 mint NFT
4. 只要結果通過，身份中心顯示為「通過待啟用」
5. 使用者自行點擊「啟用」後，才執行鏈上 `mintCredential`
6. 啟用後在身份中心與個人資料顯示已啟用狀態

本 Gate 的核心價值，是把「審核結果」與「鏈上啟用」拆開，讓最終決定權回到使用者。

---

## 2. 範圍與邊界

### 2.1 本 Gate 要完成的內容

- 三個獨立頁面：
  - `/credential/owner`
  - `/credential/tenant`
  - `/credential/agent`
- 每頁支援：
  - 主文件上傳
  - 補充附件上傳
  - 補充說明欄
  - 智能審核主流程
  - 人工審核次要入口
  - 審核結果查詢
  - 通過待啟用後的啟用動作
- 後端支援：
  - 送件資料模型
  - 智能審核引擎 v1
  - 人工審核佇列
  - 啟用 mint 流程
  - `CredentialMinted` 同步
- 前台支援：
  - 身份中心狀態顯示
  - 重新送件
  - 改走人工審核
  - 啟用按鈕

### 2.2 本 Gate 明確不做的內容

- 不在本 Gate 直接把平台權限從 `KYC VERIFIED` 切到 `OWNER / TENANT / AGENT`
- 不做 Property / Agency / Case / Stake 主線功能
- 不做真正的模型訓練平台或文件分類訓練管線
- 不做複雜多附件組合與逐欄位表單深度建模
- 不做使用者自助撤銷 credential

### 2.3 Gate 1B 預留內容

Gate 1B 再處理：

- `listing create` 改成 OWNER 已啟用才可用
- `appointment booking` 改成 TENANT 已啟用才可用
- 後續 AGENT 專屬能力切換
- 角色權限全面從 KYC 切換到 credential 啟用狀態

---

## 3. 產品原則

本 Gate 採用以下固定原則：

1. 智能審核是主流程，人工審核是次要入口
2. 智能只給結果，不給建議
3. 人工與智能地位相同，最終都只會產生「通過 / 不通過」結果
4. 不論哪條路線，只要結果通過，都先停在「通過待啟用」
5. 真正的 NFT 憑證只在使用者主動啟用時才鑄造
6. 不通過時，使用者可自行決定：
   - 重跑智能
   - 改走人工
7. 同一身份在尚未啟用前，可重新送審，但永遠只保留最新一次結果作為可啟用依據
8. 所有使用者可見文案一律使用繁體中文

---

## 4. 使用者流程

### 4.1 OWNER / TENANT / AGENT 三頁獨立

三個身份採獨立頁面，不做單一頁切換：

- `OWNER`：屋主身份認證
- `TENANT`：租客身份認證
- `AGENT`：仲介身份認證

原因：

- 三種身份的主文件不同
- 審核依據不同
- 後續說明與提示不同
- 後續權限切換也不同

畫面層可共用底層元件，但路由與使用者認知上要明確分開。

### 4.2 主流程：智能審核

每個身份頁預設主 CTA 都是智能審核。

流程如下：

1. 使用者進入身份頁
2. 上傳主文件
3. 可選擇補充附件
4. 輸入補充說明
5. 點擊智能審核
6. 系統執行 OCR + 規則判斷
7. 產生結果：
   - 通過
   - 不通過
8. 結果同步顯示在身份頁與身份中心

### 4.3 副流程：人工審核

人工審核不做成主按鈕，而是像忘記密碼那樣的次要入口。

例如：

- `改走人工審核`
- `不採用這次智能結果，改由人工審核`

流程如下：

1. 使用者在身份頁選擇人工審核
2. 使用同一組送件資料建立人工審核案件
3. Admin 在人工審核清單中處理
4. 回覆結果：
   - 通過
   - 不通過
5. 若通過，進入「通過待啟用」

### 4.4 啟用流程

通過後，不論來源是智能或人工，都不直接 mint。

啟用流程如下：

1. 身份中心顯示某身份為 `通過待啟用`
2. 使用者點擊 `啟用`
3. 後端呼叫 `IdentityNFT.mintCredential()`
4. 等待交易完成
5. DB 與 read model 更新
6. 身份中心改為 `已啟用`

這裡的產品意圖，是讓「審核結果」與「是否上鏈」由使用者自行決定。

---

## 5. 各身份最小送件規格

Gate 1 先採最小可用版，不做複雜表單深度建模。

### 5.1 OWNER

- 主文件：權狀或可辨識產權證明
- 補充附件：可選
- 補充說明：可填

### 5.2 TENANT

- 主文件：收入或工作證明
- 補充附件：可選
- 補充說明：可填

### 5.3 AGENT

- 主文件：仲介證照、執照或可辨識資格證明
- 補充附件：可選
- 補充說明：可填

---

## 6. 狀態機

每一個身份類型都採同一套狀態機：

- `未申請`
- `智能審核中`
- `人工審核中`
- `通過待啟用`
- `不通過`
- `已啟用`
- `已撤銷`

### 6.1 狀態說明

- `未申請`
  尚未送件

- `智能審核中`
  智能審核任務已建立，等待結果

- `人工審核中`
  人工審核案件已建立，等待 admin 結果

- `通過待啟用`
  審核已通過，但尚未 mint NFT

- `不通過`
  審核結果未通過，可選擇重新智能送審或改走人工

- `已啟用`
  已完成鏈上啟用與 read model 更新

- `已撤銷`
  平台 operator 已於鏈上撤銷 credential

### 6.2 最新結果規則

同一身份在 `未啟用` 前允許重跑送審，但只保留最新一次結果作為可啟用依據。

也就是：

- 舊的通過結果不再可啟用
- 舊的不通過結果僅作為歷史記錄
- 身份中心只顯示最新有效結果

### 6.3 已啟用後的規則

同一身份一旦 `已啟用`，前台不再提供重新申請入口。
若後續需要失效或重審，先由平台走 `撤銷 -> 重新申請` 流程。

---

## 7. 智能審核引擎 v1

### 7.1 定位

本 Gate 的智能審核不是機器學習平台，而是可運作的 `智能審核引擎 v1`：

- OCR 抽取文字
- 文件關鍵字判斷
- 版型 / 類型基本比對
- 表單內容一致性檢查
- 與既有 KYC 基本資料比對

本階段先做可運作與可擴充，不追求真正模型訓練。

### 7.2 輸入

輸入來源包含：

- 主文件影像
- 補充附件影像
- 使用者補充說明
- 使用者 KYC 基本資料
  - 姓名
  - 出生日期
  - 已驗證身份

### 7.3 輸出

智能審核只輸出結果，不輸出建議。

輸出內容：

- 審核結果
  - `通過`
  - `不通過`
- 幾個簡短檢查項目
- 必要時的失敗原因摘要

### 7.4 各身份最低判定規則

#### OWNER

最低規則包含：

- 主文件文字可成功抽取
- 文件包含產權或權狀關鍵字
- 文件中至少有可辨識姓名或地址等資訊
- 若有姓名資訊，需可與 KYC 姓名進行最低程度比對

#### TENANT

最低規則包含：

- 主文件文字可成功抽取
- 文件包含收入、工作、聘僱、薪資等關鍵訊號
- 若文件中有姓名，需與 KYC 姓名最低程度比對

#### AGENT

最低規則包含：

- 主文件文字可成功抽取
- 文件包含仲介、執照、證照、經紀人等關鍵訊號
- 若文件中有姓名，需與 KYC 姓名最低程度比對

### 7.5 後續升級方向

未來若要加入真正的機器學習與文件餵料，應在此引擎上替換判定器，而不是推翻整條資料流。

---

## 8. 資料模型設計

### 8.1 設計原則

不把新的審核與啟用流程硬塞進現有 `user_credentials`。

原因：

- 現有 `user_credentials` 比較接近最終 credential read model
- Gate 1 需要保留送件歷史
- Gate 1 需要同時表達：
  - 智能 / 人工路線
  - 通過 / 不通過結果
  - 待啟用 / 已啟用
  - 最新結果覆蓋規則

### 8.2 新增資料模型

建議新增 `credential_submissions`：

- `id`
- `user_id`
- `credential_type`
- `review_route`
  - `SMART`
  - `MANUAL`
- `review_status`
  - `SMART_REVIEWING`
  - `MANUAL_REVIEWING`
  - `PASSED`
  - `FAILED`
- `activation_status`
  - `NOT_READY`
  - `READY`
  - `ACTIVATED`
  - `SUPERSEDED`
- `main_doc_path`
- `support_doc_path`
- `notes`
- `ocr_text_main`
- `ocr_text_support`
- `check_result_json`
- `decision_summary`
- `reviewer_note`
- `reviewed_by_wallet`
- `decided_at`
- `activated_at`
- `activation_tx_hash`
- `activation_token_id`
- `superseded_by_submission_id`
- `created_at`
- `updated_at`

### 8.3 `user_credentials` 的角色

`user_credentials` 保留為已核發 credential 的 read model：

- 已啟用的 OWNER / TENANT / AGENT
- 對應 token id
- 對應 tx hash
- 驗證時間
- 撤銷後更新狀態

這樣可讓：

- `credential_submissions` 管送審與結果
- `user_credentials` 管最終已啟用憑證

---

## 9. 後端架構

### 9.1 路由

建議新增：

- `GET /api/credentials/me`
  回傳三種身份的最新狀態與可啟用資訊

- `POST /api/credentials/:type/submissions`
  建立送審案件

- `POST /api/credentials/:type/submissions/:id/files`
  上傳主文件與補充附件

- `POST /api/credentials/:type/submissions/:id/analyze`
  執行智能審核

- `POST /api/credentials/:type/submissions/:id/manual`
  改走人工審核

- `POST /api/credentials/:type/submissions/:id/activate`
  啟用並 mint credential

Admin：

- `GET /api/admin/credentials/pending`
- `PUT /api/admin/credentials/:id/review`

### 9.2 模組邊界

建議新增 `credential` 模組，避免全部塞回 `user` 模組。

模組責任：

- `credential/service`
  - 建立送件
  - 執行智能審核
  - 切換人工路線
  - 啟用 mint
  - 取回最新狀態

- `credential/handler`
  - API 入口

- `credential/repository`
  - 送件資料存取

- `credential/review`
  - 智能審核引擎 v1

### 9.3 啟用流程

啟用時要檢查：

1. 該 submission 必須為最新有效結果
2. `review_status = PASSED`
3. `activation_status = READY`
4. 使用者必須已持有 `NATURAL_PERSON`
5. 使用者尚未持有該 credential

通過後：

1. 呼叫 `IdentityNFT.mintCredential()`
2. 立即更新 submission activation 資訊
3. 更新 `user_credentials`
4. 觸發 `CredentialMinted` 同步

---

## 10. 鏈上與同步

### 10.1 合約使用方式

合約沿用現有 [IdentityNFT.sol](/d:/Git/onchain-project/task-reward-vault/contracts/IdentityNFT.sol:183)：

- `OWNER = 2`
- `TENANT = 3`
- `AGENT = 4`

啟用時才呼叫 `mintCredential(wallet, tokenId)`。

### 10.2 啟用與撤銷

- 使用者只能啟用
- 撤銷先只保留給平台 operator / admin
- 若有爭議，不做使用者自助撤銷

### 10.3 事件同步

需要把 `CredentialMinted` 正式接上 read model 更新。

最低要求：

- 交易成功後 DB 先同步一版
- indexer 再做鏈上事件確認與補償同步
- UI 顯示以 DB / read model 為準

---

## 11. 前端設計

### 11.1 身份頁

每個身份頁面包含：

- 身份說明
- 主文件上傳區
- 補充附件上傳區
- 補充說明欄
- 智能審核主按鈕
- 人工審核次要入口
- 最近一次結果區塊

### 11.2 身份中心

身份中心需顯示每個身份：

- 當前狀態
- 最近一次審核路線
- 最近一次結果時間
- 通過待啟用時的啟用按鈕
- 不通過時的：
  - 重新智能審核
  - 改走人工審核

### 11.3 文案規則

所有使用者可見文字改用繁體中文：

- 身份頁
- 身份中心
- 結果描述
- 錯誤訊息
- 啟用成功 / 失敗訊息

系統內部 enum、API 欄位、合約 token 名稱可維持英文。

---

## 12. 驗收標準

本 Gate 完成的最低驗收標準如下：

1. 三個獨立身份頁可進入並送件
2. 三種身份都可走智能審核主流程
3. 三種身份都可改走人工審核副流程
4. 智能與人工都只回覆結果，不直接 mint
5. 通過後身份中心顯示 `通過待啟用`
6. 使用者點擊啟用後才正式 mint credential
7. `CredentialMinted` 可同步回 DB / read model
8. 不通過時可重新智能送審或改走人工
9. 尚未啟用前只保留最新結果作為可啟用依據
10. 前台文案採繁體中文
11. 現有 Gate 0 權限主線不被破壞

---

## 13. 風險與控制

### 13.1 智能判定可信度

本 Gate 的智能審核不是法律或行政認定，只是平台內部的最低可運作判定機制。

控制方式：

- 不做自動 mint
- 結果由使用者決定是否採用
- 永遠保留人工審核路線

### 13.2 文件格式過於多樣

OWNER / TENANT 文件格式差異很大，初版容易有誤判。

控制方式：

- 只做最低標準可運作版
- 失敗時允許直接改走人工
- 後續再升級智能審核引擎

### 13.3 權限與身份混線

若在 Gate 1A 就同時切權限，會讓主線風險過高。

控制方式：

- Gate 1A 只完成身份申請、審核、啟用閉環
- Gate 1B 再切權限

---

## 14. 實作順序建議

建議按以下順序落地：

1. DB schema 與 repository
2. 後端 `credential` 模組與 DTO
3. 智能審核引擎 v1
4. 人工審核 admin API
5. 啟用 mint 流程
6. `CredentialMinted` 同步
7. React 三個身份頁
8. 身份中心整合
9. 繁體中文文案收斂
10. Gate 1 驗收與 smoke check

---

## 15. 開工結論

Gate 1A 的正式方向固定為：

- 三個獨立身份頁
- 智能審核主流程
- 人工審核次要入口
- 通過待啟用
- 使用者自行啟用後才 mint
- 三個身份都適用同一決策模型
- 權限切換延後到 Gate 1B

這個切法能先把身份系統本身做成真正可運作的產品閉環，同時保留你要的「客戶主權」與後續升級空間。
