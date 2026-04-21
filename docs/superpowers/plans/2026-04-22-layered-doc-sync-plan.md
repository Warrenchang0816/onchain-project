# Layered Documentation Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the remaining project documents to the 2026-04-22 platform baseline without erasing blueprint intent, while removing outdated Task Tracker guidance from operational docs.

**Architecture:** Keep live-operating documents aligned to the current repo and gate roadmap, preserve blueprint documents as vision references with explicit current-state overlays, and rewrite operational guides where old commands or APIs would mislead future implementation. Database docs become the canonical text export of the current SQL/init reality, with legacy tables explicitly marked as non-mainline.

**Tech Stack:** Markdown docs, text prompt templates, CSV schema exports, existing repo SQL/init files, current `.env.example` files, current contract deployment scripts.

---

### Task 1: Audit The Remaining Documentation Set

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-layered-doc-sync-plan.md`
- Reference: `docs/可信房屋媒合平台：MVP 階段開發規格與規劃書.md`
- Reference: `docs/第六階段架構定稿：可信房屋媒合平台.md`
- Reference: `docs/主權仲介與Owner-first對應影響清單.md`
- Reference: `docs/Docker 標準化部署指南.md`
- Reference: `docs/區塊鏈與合約建立指南.md`
- Reference: `docs/區塊鏈專案開發prompt.txt`
- Reference: `docs/database/relational-database-spec.md`
- Reference: `docs/database/relational-database-spec.csv`

- [ ] **Step 1: Confirm the file groups**

```text
Blueprint docs:
- docs/可信房屋媒合平台：MVP 階段開發規格與規劃書.md
- docs/第六階段架構定稿：可信房屋媒合平台.md
- docs/主權仲介與Owner-first對應影響清單.md

Operational docs:
- docs/Docker 標準化部署指南.md
- docs/區塊鏈與合約建立指南.md
- docs/區塊鏈專案開發prompt.txt

Database docs:
- docs/database/relational-database-spec.md
- docs/database/relational-database-spec.csv
```

- [ ] **Step 2: Confirm the live reference set**

```text
Live references:
- docs/開發規劃書.md
- docs/架構設計書.md
- docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md
- infra/init/01-init.sql
- infra/init/02-house-platform.sql
- infra/init/03-kyc-submissions.sql
- infra/init/04-onboarding.sql
- infra/init/05-auth-password.sql
- infra/init/06-profile-fields.sql
- infra/init/07-listings.sql
- go-service/.env.example
- react-service/.env.example
- task-reward-vault/.env.example
- task-reward-vault/scripts/deployHousePlatform.ts
```

- [ ] **Step 3: Capture the rewrite rule**

```markdown
- Blueprint docs keep original positioning and add a 2026-04-22 current-state overlay.
- Operational docs rewrite outdated Task Tracker instructions into current housing-platform instructions.
- Database docs describe the live schema first and explicitly mark legacy compatibility tables.
```

### Task 2: Sync Blueprint Documents With Current-State Overlays

**Files:**
- Modify: `docs/可信房屋媒合平台：MVP 階段開發規格與規劃書.md`
- Modify: `docs/第六階段架構定稿：可信房屋媒合平台.md`
- Modify: `docs/主權仲介與Owner-first對應影響清單.md`

- [ ] **Step 1: Add a current-state overlay to the MVP spec**

```markdown
> 更新日期：2026-04-22
> 文件定位：本文件保留 MVP 產品願景與早期規劃，不直接取代 live flow 文件。
> 現況準據：目前 repo 現況以 `docs/開發規劃書.md`、`docs/架構設計書.md` 與 `docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md` 為準。

## 0. 截至 2026-04-22 的現況對照

- 已落地：自建 eKYC、SIWE + password 登入、身份中心 / 會員資料、房源列表 / 詳情、預約看房。
- 正在收斂：OWNER / TENANT / AGENT 角色申請閉環（Gate 1）。
- 尚未正式主線：Property / Agency / Case / Stake 的正式鏈上閉環。
- Gate 對應：本文件第 3~6 節的藍圖，將依 `Gate 1 -> Gate 5` 分段落地，而非一次性實作。
```

- [ ] **Step 2: Add a current-state overlay to the phase-6 architecture doc**

```markdown
## 現況對照（2026-04-22）

- 本文件描述的是 On-chain First 目標架構，不等於目前 repo 已全部完成。
- 目前已正式接線：`IdentityNFT` 自然人 KYC 憑證、KYC indexer 同步、DB 驅動的 listings / listing_appointments 主線。
- 目前主幹順序：`Gate 0 基線收斂 -> Gate 1 身分與角色閉環 -> Gate 2 Property -> Gate 3 Agency -> Gate 4 Case -> Gate 5 Stake`。
- `OWNER 自營` 與 `OWNER -> AGENT 授權` 兩條路線皆保留，owner-first 定位不變。
```

- [ ] **Step 3: Add a gate mapping section to the owner-first impact list**

```markdown
## 0. 現況對照與 Gate 對應（2026-04-22）

- 本文件是願景拆解表，不是 live schema。
- 目前 repo 已存在的正式基底：`users`、`kyc_sessions`、`kyc_submissions`、`user_credentials`、`listings`、`listing_appointments`。
- Gate 對應：
  - Gate 1：`user_credentials` 角色閉環
  - Gate 2：`properties / property_owners`
  - Gate 3：`property_authorizations / agent_profiles`
  - Gate 4：`cases / case_events`
  - Gate 5：stake 與治理補強
```

### Task 3: Rewrite Operational Guides To Match The Current Platform

**Files:**
- Modify: `docs/Docker 標準化部署指南.md`
- Modify: `docs/區塊鏈與合約建立指南.md`
- Modify: `docs/區塊鏈專案開發prompt.txt`

- [ ] **Step 1: Rewrite the Docker guide around the current services**

```markdown
# 可信房屋媒合平台：Docker 標準化部署指南

核心內容必須改成：
- 專案名稱改為 `onchain-project`
- 目前服務為 `infra/`、`go-service/`、`react-service/`、`task-reward-vault/`
- API 驗證改成 `/api/health`（若不存在則改列目前可用的 `/api/auth/*`、`/api/listings` 類型）
- 明確說明 `tasks` 舊路線不是目前主線
- 補上先讀 `docs/開發規劃書.md` / `docs/架構設計書.md` 的 handoff 指引
```

- [ ] **Step 2: Rewrite the blockchain guide around current contracts and env names**

```markdown
# 可信房屋媒合平台：區塊鏈與合約建立指南

核心內容必須改成：
- 前端交互從舊 `createAndFundTask` / `claimReward` 改為目前房屋平台合約與 wallet 角色說明
- Operator 動作改為 `mintIdentity` / `verifyProperty` / `openCase` 類型的平台治理動作
- 合約部署腳本以 `npm run deploy:house-platform:sepolia` 為準
- `.env` 欄位與 `go-service/.env.example`、`react-service/.env.example`、`task-reward-vault/.env.example` 對齊
- 把仍未閉環的合約模組標示為 `後續 Gate`
```

- [ ] **Step 3: Rewrite the AI prompt template to the housing-platform context**

```text
## Project Context
我正在開發「可信房屋媒合平台」，目前正式主線包含自建 eKYC、SIWE + password 登入、身份中心、房源與預約看房。

## Development Principles
1. 先對照 `docs/開發規劃書.md`、`docs/架構設計書.md`、Gate roadmap。
2. 開發順序：DB/read model -> 合約/事件 -> Go service/indexer -> React api/page。
3. 若功能屬於 Property / Agency / Case / Stake，需先標示對應 Gate。
```

### Task 4: Replace The Database Text Exports With Current-Schema Truth

**Files:**
- Modify: `docs/database/relational-database-spec.md`
- Modify: `docs/database/relational-database-spec.csv`

- [ ] **Step 1: Rewrite the markdown spec around the actual schema**

```markdown
# Project Relational Database Spec

## Scope
- Current live mainline tables
- Current supporting/indexer tables
- Legacy compatibility tables still physically present but no longer mainline

## Live Mainline Domains
- Identity / KYC: `users`, `kyc_sessions`, `kyc_submissions`, `otp_codes`, `user_credentials`
- Auth: `auth_nonce`, `wallet_session`
- Listing: `listings`, `listing_appointments`
- Blockchain log / indexer: `task_blockchain_logs`, `indexer_checkpoints`, `processed_events`

## Legacy Compatibility Tables
- `tasks`
- `task_submissions`
```

- [ ] **Step 2: Replace the CSV rows to match the current schema export**

```csv
table_name,column_name,data_type,nullable,default,key_type,references,used_by,definition
users,id,BIGSERIAL,NO,,PK,,user_repo,User primary key
listings,id,BIGSERIAL,NO,,PK,,listing_repo,Listing primary key
listing_appointments,id,BIGSERIAL,NO,,PK,,listing_appointment_repo,Appointment primary key
```

- [ ] **Step 3: Mark legacy tables explicitly inside the CSV**

```csv
tasks,id,BIGSERIAL,NO,,PK,,legacy_only,Legacy task table retained by init SQL but not part of the housing-platform mainline
task_submissions,id,BIGSERIAL,NO,,PK,,legacy_only,Legacy task submission table retained for backward compatibility
```

### Task 5: Record, Verify, And Commit The Sync

**Files:**
- Modify: `dev_log/2026-04-22.md`
- Verify: `git diff -- <doc paths>`
- Verify: `git status --short --branch`

- [ ] **Step 1: Append a dev log entry for the remaining layered sync**

```markdown
## 其餘正式文件分層同步

- 變動部分：藍圖文件 / 操作指南 / database 規格
- 變動原因及邏輯：依文件性質同步到 2026-04-22 gate roadmap 與 live repo，保留藍圖定位，但清除會誤導接手的舊 Task Tracker 語境。
```

- [ ] **Step 2: Review the exact diff**

```bash
git diff -- "docs/可信房屋媒合平台：MVP 階段開發規格與規劃書.md" "docs/第六階段架構定稿：可信房屋媒合平台.md" "docs/主權仲介與Owner-first對應影響清單.md" "docs/Docker 標準化部署指南.md" "docs/區塊鏈與合約建立指南.md" "docs/區塊鏈專案開發prompt.txt" "docs/database/relational-database-spec.md" "docs/database/relational-database-spec.csv" "dev_log/2026-04-22.md"
```

Expected: only documentation diffs, no source-code changes.

- [ ] **Step 3: Commit the document checkpoint**

```bash
git add "docs/可信房屋媒合平台：MVP 階段開發規格與規劃書.md" "docs/第六階段架構定稿：可信房屋媒合平台.md" "docs/主權仲介與Owner-first對應影響清單.md" "docs/Docker 標準化部署指南.md" "docs/區塊鏈與合約建立指南.md" "docs/區塊鏈專案開發prompt.txt" "docs/database/relational-database-spec.md" "docs/database/relational-database-spec.csv" "dev_log/2026-04-22.md"
git commit -m "docs: layer remaining project docs sync"
```
