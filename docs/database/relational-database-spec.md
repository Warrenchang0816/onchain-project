# Project Relational Database Spec

> 更新日期：2026-04-22  
> 文件定位：本文件描述目前 repo 的 SQL/init reality，優先對齊 `infra/init/*.sql`、目前 Go module 與 live flow。  
> 上位準據：`docs/開發規劃書.md`、`docs/架構設計書.md`

## Scope

本文件分三層描述資料庫：

1. **正式主線表**
   目前房屋平台主線實際使用中的資料表
2. **支援 / 索引表**
   提供登入、事件同步、足跡查詢的支援性資料表
3. **舊相容表**
   仍由 `infra/init/01-init.sql` 建出，但已不屬於目前房屋平台主幹流程

Excel / 表格匯出請以：

- `docs/database/relational-database-spec.csv`

為目前文字版準據。

## Current Delivery Status

截至 2026-04-22：

- 第一階段正式主線已完成：
  - 自建 eKYC onboarding
  - `person_hash + wallet SIWE + password` 登入
  - 身份中心 / 會員資料頁
  - `listings` / `listing_appointments`
- 第二階段 Gate 1A 已交付：
  - `/credential/owner`、`/credential/tenant`、`/credential/agent`
  - `credential_submissions` 角色申請 write model
  - `user_credentials` 已啟用角色 read model
- 鏈上正式已接線：
  - `IdentityNFT` 自然人 KYC 憑證與 indexer
  - `IdentityNFT.CredentialMinted` 角色憑證同步
- 後續 Gate：
  - `Property / Agency / Case / Stake`

## Initialization Order

目前 Docker volume 首次初始化會依序執行：

1. `infra/init/01-init.sql`
2. `infra/init/02-house-platform.sql`
3. `infra/init/03-kyc-submissions.sql`
4. `infra/init/04-onboarding.sql`
5. `infra/init/05-auth-password.sql`
6. `infra/init/06-profile-fields.sql`
7. `infra/init/07-listings.sql`
8. `infra/init/08-credential-submissions.sql`

## Current Schema Domains

### 1. Identity / KYC Mainline

- `users`
  - 平台身份根表
  - 承接 wallet、KYC 狀態、person / identity 綁定、聯絡資訊、密碼與會員資料基底
- `kyc_sessions`
  - onboarding 進行中的暫存 session
- `kyc_submissions`
  - 正式 KYC 審核與稽核軌跡
- `otp_codes`
  - Email / SMS OTP 記錄
- `credential_submissions`
  - OWNER / TENANT / AGENT 角色申請 write model
  - 保存表單、OCR 結果、智能 / 人工審核路線、啟用狀態與 tx 回寫
- `user_credentials`
  - OWNER / TENANT / AGENT 已啟用角色 read model
  - 保存 NFT token、交易 hash、撤銷狀態

### 2. Auth Domain

- `auth_nonce`
  - SIWE nonce store
- `wallet_session`
  - server-side session / cookie 綁定資料

### 3. Listing Mainline

- `listings`
  - 房源主表
  - 目前正式狀態機：
    - `DRAFT -> ACTIVE -> NEGOTIATING -> LOCKED -> SIGNING -> CLOSED`
    - 任意狀態可轉 `REMOVED / EXPIRED / SUSPENDED`
- `listing_appointments`
  - 預約看房與排隊記錄
  - 目前正式狀態機：
    - `PENDING -> CONFIRMED -> VIEWED -> INTERESTED`
    - 任意狀態可轉 `CANCELLED`

### 4. Blockchain / Indexer Support

- `task_blockchain_logs`
  - 鏈上足跡查詢用 timeline
  - 雖沿用舊 `task` 命名，但目前仍有 `logs` module 讀寫
- `indexer_checkpoints`
  - 每個 contract worker 的最後處理 block
- `processed_events`
  - 事件冪等去重
  - 目前正式對齊 `IdentityMinted` 與 `CredentialMinted`

### 5. Legacy Compatibility Tables

以下表仍由 `infra/init/01-init.sql` 建立，但不屬於目前房屋平台主幹流程：

- `tasks`
- `task_submissions`

治理原則：

- 這些表不應再被描述成目前正式產品主線
- 若未來要完全移除，需與 `task_blockchain_logs` 與殘留相容邏輯一起處理

## Cleanup Result / Drift Notes

### 已修正的敘述漂移

- `listings` / `listing_appointments` 已是 live mainline，不可再寫成尚未進入正式 schema
- `tasks` 不再是房屋平台主線，但實體表仍存在於初始化 SQL
- `credential_submissions` 已成為 Gate 1A 正式 write model，不可再寫成純規劃
- `user_credentials` 已從申請中間態收斂為已啟用角色 read model，不可再把整條申請流程只寫在這張表上

### 仍存在的相容殘留

- `task_blockchain_logs` 命名仍是舊 task 語境
- `tasks` / `task_submissions` 仍在初始化 SQL 中
- 少數 config / env / 文案仍有舊 Task Tracker 命名

## Design Rules

- `users` 是身份根表，不應再塞入大量 profile 畫像欄位來污染 auth root table
- `kyc_sessions` 只承接 onboarding 中間態
- `kyc_submissions` 是正式審核 / 稽核軌跡
- `credential_submissions` 是角色申請 write model
- `user_credentials` 是角色啟用後的 read model，並保留撤銷狀態
- `listings` 與 `listing_appointments` 是目前租屋主線的正式資料骨架
- `indexer_checkpoints` 與 `processed_events` 必須與目前啟用中的 `IdentityMinted / CredentialMinted` worker 對齊

## Schema Governance Rules

- DB / read model 先定義，再談合約事件與後端同步
- 不能把未接線的未來模組直接寫進「目前 live schema」
- 若某能力還只存在於藍圖或 gate roadmap，就應留在規劃文件，不應冒充為已上線 schema
- 若文件、SQL、Go repository 三者不一致，以目前可執行的 SQL + repo 讀寫路徑為優先修正目標
