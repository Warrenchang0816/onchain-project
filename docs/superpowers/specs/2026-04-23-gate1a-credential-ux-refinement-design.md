# Gate 1A 身份認證 UX 補強設計

> 日期：2026-04-23  
> 適用範圍：Gate 1A 已上線的 `OWNER / TENANT / AGENT` 身份申請流程  
> 關聯文件：
> - `docs/superpowers/specs/2026-04-22-gate1-role-credential-activation-design.md`
> - `docs/superpowers/plans/2026-04-22-gate1-role-credential-activation-implementation.md`

---

## 1. 目的

Gate 1A 目前已具備基本的角色申請、智能審核、人工審核、啟用 NFT 憑證流程，但前台體驗仍偏向「填表送件頁」，不夠像正式申請產品。

這次補強的目的，是把 Gate 1A 收斂成以下體驗：

1. 上傳文件後可立即預覽。
2. 智能審核是主路徑，人工審核是次路徑，但兩者都由使用者主動確認送出。
3. 送出後切成唯讀成品頁，不再停留在可編輯表單。
4. 人工審核中允許停止審核；智能審核中不提供停止。
5. 結果出來後，由使用者決定重新審核或啟用身份。
6. 啟用身份前一定再做一次確認，確認後才 mint NFT 憑證。

這次補強不改 Gate 1A 的核心商業邏輯，也不提前進入 Gate 1B 權限切換。

---

## 2. 核心決策

### 2.1 智能審核與人工審核的定位

- 智能審核：主路徑，送出後立即進入 loading，等待同步判定結果返回。
- 人工審核：次路徑，以提示文案形式存在，使用者可主動改走人工審核。
- 兩條路都只回覆「通過」或「不通過」，是否採用結果與是否啟用身份都由使用者決定。

### 2.2 停止審核規則

- `MANUAL_REVIEWING` 可執行 `停止審核`。
- `SMART_REVIEWING` 不提供 `停止審核`。
- 原因：智能審核本質上是短 loading，不應鼓勵中途打斷；人工審核則是可等待、可撤回的流程。

### 2.3 重新審核規則

- `STOPPED` 與 `FAILED` 都允許重新審核。
- 重新審核後，前端回到全新空白表單。
- 舊 submission 與舊文件保留在後端做稽核，不會物理刪除。
- 前台這一輪不做歷史列表 UI，只處理最新主流程。

### 2.4 成品頁規則

- 送出後一律切到唯讀成品頁。
- 成品頁不可直接編輯原始資料。
- 使用者在等待或結果頁上能做的事，只能是該狀態允許的操作。

---

## 3. 使用者體驗定稿

### 3.1 編輯態

在 `NOT_STARTED` 狀態下，頁面呈現可編輯申請表單，包含：

- 角色專屬欄位
- 補充說明
- 主文件上傳
- 補充文件上傳

文件上傳後，畫面需立即顯示預覽圖。

人工審核入口改為文案型 CTA，放在智能審核主按鈕下方偏右，文案固定為：

`可以選擇[人工審核]，將會耗時較久`

其中 `[人工審核]` 為可點擊送出的互動元素。

### 3.2 送出前確認

以下四個動作都必須有確認彈窗：

- 送出智能審核
- 送出人工審核
- 停止審核
- 啟用身份 / 鑄造 NFT

確認彈窗的原則：

- 智能審核文案要強調系統會立即開始判定。
- 人工審核文案要強調等待時間較長。
- 停止審核文案要明確告知目前送件會中止。
- 啟用身份文案要明確告知將正式鑄造身份 NFT。

### 3.3 智能審核中

使用者確認送出智能審核後：

1. 建立 submission
2. 上傳文件
3. 前台顯示 loading
4. 後端同步跑智能判定
5. 直接切到最終結果頁

這段流程前台可用 `智能審核中` 作為過渡文案，但不做可停留的等待頁，也不提供 `停止審核`。

### 3.4 人工審核中

使用者確認送出人工審核後，頁面切到唯讀成品頁，抬頭狀態顯示 `人工審核中`。

此時頁面只能提供：

- 查看成品
- 停止審核

不提供：

- 直接修改原資料
- 直接重送同一筆資料
- 在等待中切換其他審核路線

### 3.5 已停止審核

當人工審核中的案件被使用者停止後：

- 抬頭狀態顯示 `已停止審核`
- 成品頁保留原送件內容唯讀展示
- 頁面提供 `重新審核` 入口

`重新審核` 的效果是回到全新空白表單，重新開始一輪新申請。

### 3.6 未通過

當案件結果為不通過：

- 抬頭狀態顯示 `未通過`
- 成品頁保留原送件內容與本次結果
- 頁面提供 `重新審核`

重新審核不沿用舊資料，回到空白表單，由使用者重新選擇智能或人工路線。

### 3.7 已通過待啟用

當案件結果為通過但尚未啟用：

- 抬頭狀態顯示 `已通過，待啟用`
- 成品頁保留原送件內容與通過結果
- 頁面提供 `啟用身份`

點擊 `啟用身份` 後，必須再跳一次確認彈窗。只有使用者確認後，才正式 mint NFT。

### 3.8 已啟用

當 NFT 憑證已成功鑄造：

- 抬頭狀態顯示 `已啟用`
- 成品頁維持唯讀
- 至少顯示 `activationTxHash`

---

## 4. 狀態機調整

### 4.1 顯示狀態

前台顯示狀態收斂為：

- `NOT_STARTED`
- `SMART_REVIEWING`
- `MANUAL_REVIEWING`
- `STOPPED`
- `FAILED`
- `PASSED_READY`
- `ACTIVATED`
- `REVOKED`

其中：

- `SMART_REVIEWING` 只作為短暫 loading/過渡狀態，不提供可中斷流程。
- `STOPPED` 是這次新增的正式狀態。

### 4.2 後端狀態

`credential_submissions.review_status` 需要新增：

- `STOPPED`

語意如下：

- `SMART_REVIEWING`：智能審核送出後、結果返回前的暫時狀態
- `MANUAL_REVIEWING`：人工待審
- `STOPPED`：使用者主動停止人工審核
- `PASSED`：審核通過
- `FAILED`：審核不通過

`activation_status` 這次不新增新 enum，維持：

- `NOT_READY`
- `READY`
- `ACTIVATED`
- `SUPERSEDED`

`STOPPED` submission 的 `activation_status` 維持 `NOT_READY`。

### 4.3 狀態轉移

- `NOT_STARTED -> SMART_REVIEWING -> PASSED_READY | FAILED`
- `NOT_STARTED -> MANUAL_REVIEWING`
- `MANUAL_REVIEWING -> STOPPED`
- `MANUAL_REVIEWING -> PASSED_READY | FAILED`
- `STOPPED -> NOT_STARTED`（前台重開新申請）
- `FAILED -> NOT_STARTED`（前台重開新申請）
- `PASSED_READY -> ACTIVATED`

---

## 5. API 與資料流調整

### 5.1 新增或擴充的 API 能力

為了讓成品頁可在重新整理後仍正確重建，Gate 1A UX 補強需要補足「最新 submission 詳情」能力。

本次 API 調整如下：

- 保留既有 `GET /api/credentials/me`
  - 用來取得身份中心與各角色頁的總覽狀態
- 新增 `GET /api/credentials/:type/submissions/latest`
  - 回傳最新 submission 的唯讀成品資料
- 新增 `POST /api/credentials/:type/submissions/:id/stop`
  - 僅允許停止 `MANUAL_REVIEWING`
- 新增受保護的文件預覽路徑
  - `GET /api/credentials/:type/submissions/:id/files/main`
  - `GET /api/credentials/:type/submissions/:id/files/support`

### 5.2 最新 submission 詳情回傳內容

`latest submission` 詳情至少應包含：

- submission id
- credential type
- review route
- display status
- summary / decision summary
- form payload
- notes
- main file preview URL
- support file preview URL
- canStopReview
- canRestartReview
- canActivate
- activationTxHash

原則是：前台只靠這份資料，就能重建成品頁與狀態按鈕。

### 5.3 停止審核 API 規則

`POST /stop` 的規則：

- 只有 submission owner 可呼叫
- 只有 `MANUAL_REVIEWING` 可停止
- 若 submission 不是人工審核中，回 `409`
- 停止後更新 submission `review_status = STOPPED`
- 停止後該案件不可再回到同一筆繼續審核

### 5.4 文件預覽資料流

成品頁上的預覽圖不能只依賴前端本地 `File` 物件，因為使用者可能重新整理頁面。

因此文件預覽要改為：

1. 前端上傳檔案
2. 後端寫入 MinIO 路徑
3. 角色頁在成品態改抓 submission detail
4. 由後端受保護檔案路徑提供預覽

這樣才能保證：

- 重新整理後仍能看到成品
- 人工審核等待期間仍能正確回顯文件
- 舊 submission 保留時仍有稽核依據

---

## 6. 前端結構調整

### 6.1 `CredentialDocumentUploader`

需要補強：

- 上傳後圖片預覽
- 清除 / 重新選擇檔案
- 必填與非必填提示

### 6.2 `CredentialApplicationShell`

需要從「單純表單容器」升級成「表單態 + 成品態」雙模式容器。

應拆成三個區塊：

- `EditableForm`
- `SubmissionSnapshot`
- `ActionBar / ConfirmDialog`

這樣比較容易處理不同狀態下的按鈕與內容切換。

### 6.3 角色頁

三個角色頁仍維持獨立頁面，但共用同一套 shell 與成品頁元件。

角色頁責任：

- 定義角色欄位
- 載入 credential center item
- 載入 latest submission detail
- 對接 smart submit / manual submit / stop / activate / restart

### 6.4 文案

所有使用者看得到的新增文案，一律使用繁體中文。

包括但不限於：

- 按鈕文字
- 空狀態
- loading 文案
- 確認彈窗
- 成品頁抬頭
- 錯誤提示

API enum、後端常數、合約常數維持英文。

---

## 7. 驗收門檻

這次 UX 補強完成後，以下情境必須成立：

1. 使用者在三個身份頁都能上傳主文件與補充文件，且立即看到預覽圖。
2. 點擊 `送出智能審核` 時，會先跳確認彈窗；確認後顯示 loading，最後切到結果頁。
3. 點擊文案中的 `[人工審核]` 時，會先跳確認彈窗；確認後切到 `人工審核中` 的唯讀成品頁。
4. `人工審核中` 頁面可 `停止審核`，停止前需確認；停止後狀態變成 `已停止審核`。
5. `已停止審核` 與 `未通過` 都可 `重新審核`，且會回到全新空白表單。
6. `已通過，待啟用` 點 `啟用身份` 時，會先跳確認彈窗；確認後才執行 NFT 啟用。
7. 成品頁在重新整理後仍能正確回顯最新 submission 的表單資料與文件預覽。
8. 智能審核中不提供 `停止審核`。
9. 人工審核等待頁不允許直接編輯原送件資料。

---

## 8. 明確不納入這一輪的項目

這份補強 spec 不包含：

- 歷史 submission 列表 UI
- admin 後台新頁面
- 真正非同步的智能審核 worker
- ML 訓練管線或模型優化
- Gate 1B 權限切換

本次只處理 Gate 1A 現有流程的前後台體驗收斂，不擴張主題。

---

## 9. 一句話總結

Gate 1A UX 補強的最終形態是：

**智能審核作為主路徑快速出結果；人工審核作為可等待、可停止的次路徑；送出後一律進入唯讀成品頁；重新審核永遠重開新申請；啟用身份永遠由使用者最後確認後才 mint NFT。**
