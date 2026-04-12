# Onchain Task Tracker：Docker 標準化部署指南

## 目錄

1. [導論](#1-導論)
2. [系統前置環境準備](#2-系統前置環境準備)
3. [專案架構概覽](#3-專案架構概覽)
4. [基礎設施：PostgreSQL 容器部署](#4-基礎設施postgresql-容器部署)
5. [環境變數配置](#5-環境變數配置)
6. [Go 服務建置與啟動](#6-go-服務建置與啟動)
7. [React 前端開發環境啟動](#7-react-前端開發環境啟動)
8. [服務驗證與維運指令集](#8-服務驗證與維運指令集)
9. [本機資料庫 GUI / CLI 工具](#9-本機資料庫-gui--cli-工具)
10. [進階建議](#10-進階建議)

---

## 1. 導論

本指南以「基礎設施即程式碼 (Infrastructure as Code)」思維，說明如何在本地端透過 Docker 完整啟動 **Onchain Task Tracker** 全棧專案。

**專案技術棧：**

| 層級 | 技術 | Port | 狀態 |
| :--- | :--- | :--- | :--- |
| 前端 | React 19 + TypeScript + Vite | `5173` | 現行 |
| 後端 | Go 1.25 (Gin 框架) | `8081`（宿主機） → `8080`（容器內） | 現行 |
| 資料庫 | PostgreSQL 15 | `5432` | 現行 |
| 快取 / 佇列 | Redis 7 | `6379` | 預留擴充 |

> **架構重點：** 本專案採用「分層容器化」策略。資料庫（PostgreSQL）與快取（Redis）作為基礎設施獨立運行，Go 後端以 Docker 容器部署並透過 `host.docker.internal` 與基礎設施通訊，React 前端在本地以 Vite dev server 啟動。

---

## 2. 系統前置環境準備

確保工具鏈版本一致，是防止不可預測行為的第一步。

**環境檢查清單：**

- [ ] 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows 使用者請確認已啟用 WSL2 後端）
- [ ] 驗證 Docker 引擎：`docker --version`
- [ ] 驗證 Docker Compose（現代 V2 插件）：`docker compose version`
- [ ] 安裝 Node.js 20+（供前端使用）：`node --version`
- [ ] 安裝 Go 1.25+（本地開發選用）：`go version`

> **提醒：** 建議全面使用 `docker compose`（V2，無連字號），而非舊版的 `docker-compose`。

---

## 3. 專案架構概覽

```
onchain-task-tracker/
├── go-service/                 # Go 後端服務
│   ├── cmd/server/main.go      # 應用程式進入點
│   ├── internal/
│   │   ├── config/config.go    # 環境變數載入
│   │   ├── db/postgres.go      # PostgreSQL 連線初始化
│   │   ├── handler/            # HTTP 請求處理層
│   │   ├── service/            # 業務邏輯層
│   │   ├── repository/         # 資料存取層
│   │   └── model/              # 領域模型
│   ├── Dockerfile              # Go 服務的多階段建置定義
│   ├── docker-compose.yml      # Go 服務容器編排
│   └── .env                    # 環境變數（勿提交至 Git）
│
├── react-service/              # React 前端
│   ├── src/
│   │   ├── api/                # API 呼叫封裝
│   │   ├── components/         # 共用 UI 元件
│   │   └── pages/              # 頁面元件
│   └── .env                    # 前端環境變數
│
└── docs/                       # 專案文件
    └── docker-deployment-guide.md
```

**API 端點一覽：**

| Method | 路徑 | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | 取得所有任務 |
| `POST` | `/api/tasks` | 建立任務 |
| `PUT` | `/api/tasks/:id` | 更新任務 |
| `PUT` | `/api/tasks/:id/status` | 更新任務狀態 |

---

## 4. 基礎設施：PostgreSQL 容器部署

本專案的資料庫基礎設施以獨立的 Docker Compose 啟動，與 Go 服務解耦，方便維護。

### 4.1 建立基礎設施目錄

在 **專案根目錄**（`onchain-task-tracker/`）建立以下結構：

```
onchain-task-tracker/
└── infra/
    ├── docker-compose.yml      # 資料庫容器編排
    ├── .env                    # 資料庫機敏設定（勿提交 Git）
    ├── .env.example            # 設定範本（應提交 Git）
    ├── init/
    │   └── 01-init.sql         # 首次啟動自動執行的初始化 SQL
    └── data/
        ├── postgres/           # PostgreSQL 資料持久化掛載點（自動建立）
        └── redis/              # Redis 資料持久化掛載點（自動建立）
```

> **重要：** 請在 `.gitignore` 中加入 `infra/data/`，資料庫二進制資料不應進入版本控制。

### 4.2 infra/docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: onchain-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "${PG_PORT:-5432}:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis：預留擴充用，未來可供快取、Session、訊息佇列等功能接入
  redis:
    image: redis:7-alpine
    container_name: onchain-redis
    restart: always
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - ./data/redis:/data
```

> 選用 `*-alpine` 系列映像，體積輕巧、攻擊面小，適合開發與 CI/CD 環境。Redis 目前為預留容器，尚未與 Go 服務整合，可安全啟動不影響現有功能。

### 4.3 infra/.env.example（提交至 Git）

```env
# PostgreSQL Configuration
DB_USER=postgres
DB_PASS=your_secure_password
DB_NAME=TASK

# Port 設定（可選，預設值已內建於 docker-compose.yml）
# PG_PORT=5432
REDIS_PORT=6379
```

複製範本並填入實際密碼：

```bash
cp infra/.env.example infra/.env
```

### 4.4 infra/init/01-init.sql

資料庫初始化腳本，對應專案的 `tasks` 資料表結構：

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
    priority    VARCHAR(50)  NOT NULL DEFAULT 'medium',
    due_date    TIMESTAMP,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

> **架構師提醒：** init SQL 僅在 Volume **第一次建立時**執行。若需後續修改資料表結構，請直接連入資料庫手動執行 `ALTER TABLE`，或考慮引入 `golang-migrate` 等 Migration 工具進行版本化管理。

### 4.5 啟動資料庫

```bash
cd onchain-task-tracker/infra
docker compose up -d
```

確認啟動成功：

```bash
docker compose ps
# 應顯示 onchain-postgres 狀態為 healthy
```

---

## 5. 環境變數配置

> **重要：** 所有 `.env` 檔案均已列入 `.gitignore`，**不會隨 Git clone 下來**。每個服務目錄都附有 `.env.example` 範本，clone 後複製一份再填入真實值即可。

---

### 5.1 .gitignore 說明

| 服務 | 已排除的檔案 | 已提交的範本 |
| :--- | :--- | :--- |
| `go-service/` | `.env` | `.env.example` ✅ |
| `react-service/` | `.env` | `.env.example` ✅ |
| `infra/` | `.env`、`data/` | `.env.example` ✅ |

> **原則：** `.env.example` 含欄位說明但不含真實值，應提交至 Git；`.env` 含真實密碼與私鑰，絕對不可提交。

---

### 5.2 go-service/.env

Clone 後從範本複製並填入真實值：

```bash
cd go-service
cp .env.example .env
# 用編輯器開啟 .env，填入 DB_PASS、APP_RPC_URL、APP_PLATFORM_OPERATOR_PRIVATE_KEY 等真實值
```

> 完整欄位說明請直接查看 `go-service/.env.example`，每個變數都有注釋說明用途與格式。

**DB_HOST 設定說明：**

| 執行方式 | DB_HOST 值 |
| :--- | :--- |
| 本地 `go run`（非容器） | `localhost` |
| Docker 容器內（docker compose up） | `host.docker.internal` |

> `host.docker.internal` 是 Docker Desktop 提供的特殊 DNS，讓容器內的程式能連回宿主機上跑的 PostgreSQL 容器。

---

## 6. Go 服務建置與啟動

`go-service/docker-compose.yml` 負責建置 Go 應用程式映像檔並啟動容器。

### go-service/docker-compose.yml（現有）

```yaml
version: "3.9"

services:
  go-service:
    build: .
    image: go-service:1.0.0
    container_name: go-service
    restart: unless-stopped
    ports:
      - "8081:8080"
    environment:
      APP_PORT: ${APP_PORT}
      DB_HOST: ${DB_HOST}
      DB_PORT: ${DB_PORT}
      DB_USER: ${DB_USER}
      DB_PASS: ${DB_PASS}
      DB_NAME: ${DB_NAME}
      DB_SSLMODE: "disable"   # 必須小寫
```

### Dockerfile 多階段建置說明

```
階段一 (builder)：golang:1.25.4
  └── 下載依賴 (go mod download)
  └── 編譯二進制 (go build → /app/server)

階段二 (runtime)：debian:stable-slim
  └── 僅複製編譯好的 /app/server
  └── 最終映像體積極小，適合生產部署
```

### 啟動 Go 服務

確保 PostgreSQL 已正常運行後：

```bash
cd onchain-task-tracker/go-service
docker compose up -d
```

驗證服務啟動：

```bash
docker compose ps
# go-service 應顯示 running

curl http://localhost:8081/api/tasks
# 應回傳 JSON 陣列（空陣列或任務列表）
```

---

## 7. React 前端開發環境啟動

React 前端在本地以 Vite dev server 啟動，透過環境變數指向 Go 後端 API。

### react-service/.env

Clone 後從範本複製並填入真實值：

```bash
cd react-service
cp .env.example .env
# 填入 VITE_RPC_URL、VITE_REWARD_VAULT_ADDRESS 等真實值
```

> 完整欄位說明請直接查看 `react-service/.env.example`。

### 啟動前端

```bash
cd onchain-task-tracker/react-service
npm install
npm run dev
```

Vite 將在 `http://localhost:5173` 啟動開發伺服器。

> **架構重點：** React 前端**絕不**直接連線資料庫。所有資料操作均透過 Go API（`localhost:8081/api`）進行，資料庫連線完全由後端封裝處理。

---

## 8. 服務驗證與維運指令集

### 標準啟動流程（新人 SOP）

```bash
# Step 1：啟動資料庫基礎設施
cd onchain-task-tracker/infra
docker compose up -d

# Step 2：等待 PostgreSQL 健康檢查通過（約 10-30 秒）
docker compose ps   # 確認 Status 為 healthy

# Step 3：啟動 Go 後端服務
cd ../go-service
docker compose up -d

# Step 4：啟動 React 前端
cd ../react-service
npm run dev

# 開啟瀏覽器：http://localhost:5173
```

### 重新部署流程

依修改的範圍選擇對應的重部署方式：

---

**情境 A：只改了 Go 後端程式碼**

```bash
cd onchain-task-tracker/go-service

# 重新建置映像並重啟容器（資料庫不受影響）
docker compose up --build -d

# 確認新容器正常啟動
docker compose ps
docker compose logs -f --tail=30
```

---

**情境 B：只改了前端（React）**

Vite dev server 支援 Hot Reload，存檔後瀏覽器自動更新，**不需要任何重啟指令**。

若前端有新增套件（`npm install <pkg>`）：

```bash
cd onchain-task-tracker/react-service
npm install
# Vite dev server 會自動偵測，通常不需重啟
```

---

**情境 C：更新了環境變數（.env）**

```bash
# go-service .env 有變動
cd onchain-task-tracker/go-service
docker compose down
docker compose up -d

# infra .env 有變動（調整 DB 密碼或 port）
cd onchain-task-tracker/infra
docker compose down
docker compose up -d
```

> **注意：** 修改 `DB_PASS` 後，若 Volume 內的資料庫已用舊密碼建立，單純重啟無效。需清除 Volume 重建（會遺失資料），或直接進入資料庫用 `ALTER USER` 修改密碼。

---

**情境 D：更新了資料庫結構（新增欄位或資料表）**

init SQL 只在 Volume 第一次建立時執行，後續修改需手動套用：

```bash
# 方式一：直接進入容器執行 SQL（推薦，不影響現有資料）
docker exec -it onchain-postgres psql -U postgres -d TASK
# 進入後執行 ALTER TABLE 或 CREATE TABLE

# 方式二：用 pgcli 執行
pgcli -h localhost -p 5432 -u postgres -d TASK
```

---

**情境 E：完整重建（環境損壞或全新同步）**

```bash
# 停止所有服務
cd onchain-task-tracker/go-service && docker compose down
cd ../infra && docker compose down

# 清除舊映像（保留 Volume 資料）
docker compose down --rmi local

# 重新啟動
docker compose up -d                         # infra
cd ../go-service && docker compose up --build -d   # go-service
cd ../react-service && npm run dev           # react
```

> 若需要完全清空資料重來（包含資料庫內容）：在 infra 目錄執行 `docker compose down -v`，**此操作會永久刪除所有資料庫資料，請確認後再執行**。

---

### 常用維運指令

| 指令 | 說明 |
| :--- | :--- |
| `docker compose up -d` | 啟動服務（背景執行） |
| `docker compose up --build -d` | 重新建置映像後啟動 |
| `docker compose ps` | 查看容器狀態與健康狀況 |
| `docker compose logs -f` | 追蹤即時日誌輸出 |
| `docker compose logs -f --tail=30` | 只看最新 30 行日誌 |
| `docker compose down` | 停止並移除容器（**保留資料 Volume**） |
| `docker compose down --rmi local` | 同上，並刪除本地建置的映像 |
| `docker compose down -v` | 停止並**同時清除資料 Volume**（慎用） |
| `docker compose build --no-cache` | 強制完整重新建置映像檔（不用快取） |

### 連線驗證

**PostgreSQL 驗證：**

```bash
docker exec -it onchain-postgres psql -U postgres -d TASK

# 進入後確認 tasks 資料表存在：
\dt
# 應顯示 tasks 資料表

# 查看資料表結構：
\d tasks
```

**Redis 驗證（預留容器）：**

```bash
docker exec -it onchain-redis redis-cli ping
# 回傳 PONG 即代表容器正常運行
```

**Go API 驗證：**

```bash
# 健康確認（取得任務列表）
curl http://localhost:8081/api/tasks

# 建立測試任務
curl -X POST http://localhost:8081/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"測試任務","description":"驗證 API 正常運作","status":"pending","priority":"medium"}'
```

---

## 9. 本機資料庫 GUI / CLI 工具

Docker 只負責跑 PostgreSQL 容器，pgAdmin 和 pgcli 安裝在**本機**，透過 Port 映射直接連入。

---

### 9.1 pgAdmin 4（圖形化介面）

#### 安裝

前往 [pgadmin.org/download](https://www.pgadmin.org/download/) 下載對應平台的安裝包並執行安裝。

#### 前置條件

確認 `onchain-postgres` 容器已啟動且狀態為 **healthy**：

```bash
cd onchain-task-tracker/infra
docker compose ps
# onchain-postgres   healthy
```

#### 新增伺服器步驟

**Step 1** — 開啟 pgAdmin 4，在首頁點擊 **Add New Server**。

**Step 2 — General 分頁**

| 欄位 | 填入值 |
| :--- | :--- |
| Name | `Onchain Task DB`（任意名稱） |

**Step 3 — Connection 分頁**

| 欄位 | 填入值 | 說明 |
| :--- | :--- | :--- |
| Host name/address | `localhost` | Docker 已做 Port 映射，從本機連用 localhost |
| Port | `5432` | 對應 `PG_PORT`，預設 5432 |
| Maintenance database | `postgres` | 預設即可 |
| Username | `postgres` | 對應 `POSTGRES_USER` |
| Password | *(你的 POSTGRES_PASSWORD)* | 填入 `infra/.env` 中設定的密碼 |
| Save password | 勾選 | 方便下次免輸入 |

**Step 4** — 點擊 **Save**，左側 Browser 展開即可看到 `TASK` 資料庫。

> **常見問題：** 若連線失敗顯示 "could not connect to server"，請先確認容器狀態為 healthy，而非僅 running。

---

### 9.2 pgcli（智慧補全的命令列介面）

pgcli 是 psql 的強化版，支援 SQL 智慧補全、語法高亮、表格式輸出。

#### 安裝

```bash
pip install pgcli
```

> Mac 使用者可用 `brew install pgcli`。
> 若安裝後輸入 `pgcli` 顯示「找不到指令」，改用 `python -m pgcli` 啟動。

#### 連線指令

**參數格式：**

```bash
pgcli -h localhost -p 5432 -u postgres -d TASK
```

**URI 格式（一行搞定）：**

```bash
pgcli postgres://postgres:your_password_here@localhost:5432/TASK
```

輸入後提示輸入密碼（輸入時不顯示字元，屬正常安全機制），按 Enter 即進入。

#### 進入後的常用指令

成功連線後提示字元為 `postgres@localhost:TASK>`：

| 指令 | 說明 |
| :--- | :--- |
| `\dt` | 列出所有 Table |
| `\d tasks` | 查看 tasks 表欄位結構 |
| `SELECT * FROM tasks;` | 查詢所有任務資料 |
| `\e` | 開啟外部編輯器編寫 SQL |
| `exit` 或 `Ctrl+D` | 離開 pgcli |

> **pgcli 強項：** 輸入 `SEL` 後按 `Tab` 自動補全為 `SELECT`；查詢結果過長時自動進入捲動模式，按 `q` 退出。

---

## 10. 進階建議

### 安全防護

- **資料庫密碼：** `.env` 檔案包含真實密碼，**絕對不可提交至 Git**。請確認 `.gitignore` 中已正確排除 `.env`（非 `.env.example`）。
- **CORS 設定：** Go 服務目前允許來自 `http://localhost:5173` 的請求。正式環境部署時，請在 `router.go` 中更新為實際的前端網域。
- **PostgreSQL 版本升級注意事項：** 若需從 PostgreSQL 15 升級至更高版本，直接更改 Image tag **會因磁碟 Volume 格式不相容而失敗**。正確步驟：
  1. `pg_dump` 匯出資料
  2. `docker compose down -v` 清除舊 Volume
  3. 更新 image 版本後重新啟動
  4. 還原資料

### 常見問題排查

| 問題現象 | 可能原因 | 解決方式 |
| :--- | :--- | :--- |
| Go 服務起動失敗，log 出現連線拒絕 | PostgreSQL 尚未就緒 | 確認 `infra` 的 postgres 已 healthy 再啟動 go-service |
| `host.docker.internal` 無法解析 | Docker Desktop 未啟動 | 確認 Docker Desktop 正常運行 |
| tasks 資料表不存在 | init SQL 未被執行 | 清除 `infra/data/postgres/` 再重新啟動（init 只在首次建立 Volume 時執行） |
| React 呼叫 API 返回 CORS 錯誤 | 前端 Port 不符 | 確認 Vite 在 5173，或調整 go-service 的 CORS 設定 |
