# 可信房屋媒合平台：Docker 標準化部署指南

> 更新日期：2026-04-22  
> 文件定位：本文件是目前 repo 的本機啟動與接手指南，以現行房屋平台主線為準。  
> 開工前請先讀：`docs/開發規劃書.md`、`docs/架構設計書.md`、`docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`

---

## 1. 目前適用範圍

本指南適用於目前 repo 的本機開發環境：

- `infra/`：PostgreSQL、Redis、MinIO
- `go-service/`：Go API、登入、eKYC、身份中心、房源與預約看房
- `react-service/`：React SPA
- `task-reward-vault/`：房屋平台合約與部署腳本

補充邊界：

- 目前正式主線不是舊 `Task Tracker` 任務系統；`/api/tasks`、`TaskRewardVault` 相關舊範例不應再作為接手入口。
- 目前可直接驗證的後端主線以 `/api/listings`、`/api/onboard/*`、`/api/auth/*`、`/api/user/profile` 為主。
- `Property / Agency / Case / Stake` 屬後續 Gate 的主幹路線，尚未全部閉環。

---

## 2. 服務總覽

| 層級 | 目錄 | 啟動方式 | 說明 |
|------|------|----------|------|
| 基礎設施 | `infra/` | `docker compose up -d` | 啟動 PostgreSQL / Redis / MinIO，並建立 `onchain` network |
| 後端 | `go-service/` | `docker compose up --build -d` | 啟動 Go API 容器，讀取 `.env` |
| 前端 | `react-service/` | `npm run dev` | 啟動 Vite 開發伺服器 |
| 合約 | `task-reward-vault/` | `npm run compile` / `npm run deploy:house-platform:sepolia` | 只有做鏈上開發時才需要 |

---

## 3. 前置需求

- Docker Desktop
- Node.js 20+
- Go 1.25+（若要在容器外直接跑 Go）
- MetaMask（若要測試 wallet / SIWE）
- Sepolia 測試網 RPC 與測試 ETH（若要測試鏈上流程）

---

## 4. 啟動順序

### 4.1 啟動基礎設施

```powershell
cd D:\Git\onchain-project\infra
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

預期結果：

- `onchain-postgres`、`onchain-redis`、`onchain-minio` 皆為 running
- Docker network `onchain` 會被建立
- PostgreSQL 會依序執行 `infra/init/01-init.sql` 到 `infra/init/07-listings.sql`

`infra/.env.example` 目前主要欄位：

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `PG_PORT`（選填）
- `REDIS_PORT`（選填）

### 4.2 啟動 Go 後端

```powershell
cd D:\Git\onchain-project\go-service
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

補充說明：

- `.env.example` 已包含目前房屋平台主線所需的大部分欄位。
- 若你把 `go-service` 也跑在 Docker 內，`DB_HOST` / `MINIO_ENDPOINT` 可沿用預設值，或改成共享網路下的 `onchain-postgres` / `onchain-minio:9000`。
- 若只做前後端主線驗證，可先不填 `PropertyRegistry / AgencyRegistry / CaseTracker / ListingStakeVault` 相關地址；目前正式已接線的是 `IdentityNFT` 與其 indexer。

### 4.3 啟動 React 前端

```powershell
cd D:\Git\onchain-project\react-service
Copy-Item .env.example .env
npm install
npm run dev
```

目前前端最重要的環境變數是：

- `VITE_API_GO_SERVICE_URL`
- `VITE_CHAIN_ID`
- `VITE_CHAIN_NAME`
- `VITE_RPC_URL`
- `VITE_EXPLORER_URL`

補充邊界：

- `react-service/.env.example` 內仍保留部分舊任務系統相容欄位，這些不是目前房屋平台主幹的主要依賴。
- 目前正式主線以前端呼叫 Go API 為主，Gate 2 之後才會逐步增加更多房屋平台合約直連頁面。

### 4.4 合約工作流（選用）

```powershell
cd D:\Git\onchain-project\task-reward-vault
Copy-Item .env.example .env
npm install
npm run compile
```

只有在以下情況需要進入這一步：

- 驗證或修改 Solidity 合約
- 重新部署 `IdentityNFT / PropertyRegistry / AgencyRegistry / ListingStakeVault / CaseTracker`
- 驗證 `.env` 與合約地址是否對齊

---

## 5. 驗證方式

### 5.1 後端基本驗證

```powershell
curl http://localhost:8081/api/listings
```

預期結果：

- 取得 JSON 回應
- 即使資料為空，也不應該再是舊 `/api/tasks` 路線

### 5.2 前端建置驗證

```powershell
cd D:\Git\onchain-project\react-service
npm run build
```

### 5.3 合約編譯驗證

```powershell
cd D:\Git\onchain-project\task-reward-vault
npm run compile
```

補充：

- 若 Hardhat 卡在 compiler cache lock，先確認沒有殘留中的編譯程序，再重新執行。
- 這個問題屬環境穩定性議題，不應被寫成「合約主線已驗收完成」。

---

## 6. 常見接手路徑

### 情境 A：只想跑目前主線 UI / API

1. 啟動 `infra/`
2. 啟動 `go-service/`
3. 啟動 `react-service/`
4. 驗證 `/api/listings`
5. 依序測試 `/login`、`/kyc`、`/member`、`/profile`、`/listings`

### 情境 B：要做鏈上功能開發

1. 先完成情境 A
2. 準備 `task-reward-vault/.env`
3. 編譯或部署房屋平台合約
4. 把地址同步回 `go-service/.env`
5. 再對照當前 Gate 決定是否需要補 indexer / read model / 前端頁面

### 情境 C：要接手規劃與文件

1. 先讀 `docs/開發規劃書.md`
2. 再讀 `docs/架構設計書.md`
3. 再讀 `docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`
4. 最後才回來看各藍圖文件與操作指南

---

## 7. 常見問題

### `go-service` 起不來，提示 `network onchain not found`

先回 `infra/` 執行：

```powershell
docker compose up -d
```

`go-service/docker-compose.yml` 依賴外部 `onchain` network，沒有先起基礎設施就會報錯。

### `.env` 都填了，還是連不到 DB / MinIO

先確認你是「容器內連線」還是「宿主機連線」：

- 容器內可用 `host.docker.internal`，也可改成共享網路服務名
- 宿主機通常用 `localhost`

### 為什麼文件不再寫 `/api/tasks`

因為舊任務追蹤路線已不是目前房屋平台主線。repo 內仍有少量舊相容痕跡，但目前正式接手與驗收應以 listings / kyc / auth / profile 路線為準。

---

## 8. 文件關聯

- 目前主線：`docs/開發規劃書.md`
- 目前架構：`docs/架構設計書.md`
- Gate Roadmap：`docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`
- DB 規格：`docs/database/relational-database-spec.md`
