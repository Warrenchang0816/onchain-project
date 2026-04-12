# Onchain Task Tracker：組員本地開發指南

## 本次本地開發的目標

這份指南的核心目標只有一件事：

> **每位組員需要在公版架構上，獨立完成一條屬於自己的前端 + 後端完整流程，並用一個「敘事」貫穿它。**

### 我們的敘事：主題一「任務媒介」

本次本地開發以**主題一：任務媒介**為核心敘事：

> 「讓**需求方**在平台上發布任務並設定報酬，**供給方**瀏覽後接取任務並完成，系統記錄整條任務流程——從開放、接取、提交到完成。」

這條敘事對應到下列具體操作：

| 使用者動作 | 對應功能 |
| :--- | :--- |
| 需求方填寫標題、描述、報酬，建立任務 | `POST /api/onchain-tasks` |
| 任何人瀏覽所有開放中的任務 | `GET /api/onchain-tasks` |
| 供給方接取某筆任務，任務進入「進行中」 | `PUT /api/onchain-tasks/:id/accept` |
| 供給方提交成果，任務進入「待確認」 | `PUT /api/onchain-tasks/:id/submit` |
| 需求方確認完成，任務結束 | `PUT /api/onchain-tasks/:id/complete` |

**本階段先做純後端 + 前端的資料流**（不含錢包連接與鏈上合約），讓每個人都能走通完整的 CRUD 路徑。鏈上機制（USDC 托管、智能合約）是後續擴張的第二步。

### 完成的定義

1. 後端跑通上表的所有 API，可以用 curl 逐一驗證
2. 前端呈現任務列表、新增任務、切換任務狀態
3. 整條流程能對應敘事——使用者打開頁面後，能完整走過「建立 → 接取 → 提交 → 完成」這條路

這不是要你做一個完整產品，而是要你走過一次完整的全端開發路徑，理解資料如何從資料庫流到使用者的畫面。後續主題二至四，以及鏈上機制，都是建立在這條路走通之後再疊加的。

---

## 目錄

1. [第一次環境建置（Clone → 跑起來）](#1-第一次環境建置clone--跑起來)
2. [Git 工作流程](#2-git-工作流程)
3. [認識公版架構](#3-認識公版架構)
4. [如何在公版上發想你的需求](#4-如何在公版上發想你的需求)
5. [後端開發流程（Go）](#5-後端開發流程go)
6. [前端開發流程（React）](#6-前端開發流程react)
7. [完整開發範例：從想法到落地](#7-完整開發範例從想法到落地)
8. [完成後的 Push 流程](#8-完成後的-push-流程)

---

## 1. 第一次環境建置（Clone → 跑起來）

### Step 1 — Clone 專案

```bash
git clone <repo-url>
cd onchain-task-tracker
```

### Step 2 — 建立 .env 檔案

`.env` 不會隨 clone 下來，但每個服務目錄都附有 `.env.example` 範本，複製後填入真實值即可：

```bash
# go-service 環境變數
cd go-service
cp .env.example .env
# 開啟 .env，至少填入：DB_PASS、APP_RPC_URL、APP_REWARD_VAULT_ADDRESS、APP_PLATFORM_OPERATOR_PRIVATE_KEY
cd ..

# react-service 環境變數
cd react-service
cp .env.example .env
# 開啟 .env，至少填入：VITE_RPC_URL、VITE_REWARD_VAULT_ADDRESS
cd ..
```

> 各欄位的用途與格式說明，請直接查看對應的 `.env.example` 檔案中的注釋。
> 區塊鏈相關變數（RPC URL、合約地址、私鑰）的申請方式，參考 [區塊鏈與合約建立指南](./Onchain%20Task%20Tracker：區塊鏈與合約建立指南.md)。

### Step 3 — 啟動資料庫基礎設施

```bash
cd infra
cp .env.example .env   # 填入密碼（與 go-service/.env 的 DB_PASS 一致）
docker compose up -d
docker compose ps      # 確認 onchain-postgres 狀態為 healthy
cd ..
```

### Step 4 — 啟動後端

```bash
cd go-service
docker compose up -d
curl http://localhost:8081/api/tasks   # 回傳 [] 表示成功
cd ..
```

### Step 5 — 啟動前端

```bash
cd react-service
npm install
npm run dev
# 開啟 http://localhost:5173
```

---

## 2. Git 工作流程

### 基本原則

- `main` 是穩定分支，**不直接在 main 上開發**
- 每個功能開一條 branch，完成後再 push 並提 PR 合併回 main
- Branch 命名格式：`feat/<你的功能名>` 或 `feat/<你的名字>/<功能名>`

### 開始開發前

確認自己在最新的 main 上開 branch：

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### 開發中：定期存檔

```bash
git add go-service/internal/...     # 指定檔案，避免誤 commit .env
git add react-service/src/...
git commit -m "feat: 新增 xxx 功能"
```

> **注意：** 絕對不要 `git add .`，`.env` 雖在 `.gitignore` 但養成指定檔案的習慣是好事。

### 開發完成：Push 並合併

詳見 [Section 8](#8-完成後的-push-流程)。

---

## 3. 認識公版架構

在你動手之前，先理解現有的程式碼結構，這樣你就知道要在哪裡加東西。

### 後端分層（go-service）

```
go-service/
├── cmd/server/main.go          # 程式進入點，組裝所有依賴
└── internal/
    ├── config/config.go        # 讀取 .env 環境變數
    ├── db/postgres.go          # 建立資料庫連線
    ├── model/task.go           # 資料結構定義（對應資料庫欄位）
    ├── dto/task_dto.go         # Request / Response 的 JSON 格式定義
    ├── repository/             # 純 SQL 操作（CRUD），不含業務邏輯
    ├── service/                # 業務邏輯層（呼叫 repository）
    ├── handler/                # HTTP 處理層（解析 request，呼叫 service）
    └── router/router.go        # 路由定義與 CORS 設定
```

**資料流向（一個 API 請求的完整路徑）：**

```
HTTP Request
  → router（路由分派）
  → handler（解析 JSON、驗證格式）
  → service（業務判斷）
  → repository（執行 SQL）
  → PostgreSQL
```

**現有 API 一覽：**

| Method | 路徑 | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | 取得所有任務 |
| `POST` | `/api/tasks` | 建立任務 |
| `PUT` | `/api/tasks/:id` | 更新任務完整資料 |
| `PUT` | `/api/tasks/:id/status` | 只更新任務狀態 |

**現有資料結構（Task）：**

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `id` | int64 | 主鍵，自動遞增 |
| `title` | string | 任務標題 |
| `description` | string | 任務描述 |
| `status` | string | 狀態（如 `pending`、`archived`） |
| `priority` | string | 優先級（如 `low`、`medium`、`high`） |
| `dueDate` | *time.Time | 截止日期（可為空） |
| `createdAt` | time.Time | 建立時間 |
| `updatedAt` | time.Time | 最後更新時間 |

---

### 前端分層（react-service）

```
react-service/src/
├── api/                        # 所有後端 API 呼叫封裝（fetch）
├── types/                      # TypeScript 型別定義
├── components/
│   ├── common/                 # 共用 UI 元件（Button、Modal、Card 等）
│   └── task/                   # 任務相關的專屬元件
├── pages/                      # 頁面元件（對應路由）
├── layouts/                    # 頁面框架（Header、側欄等）
└── router/index.tsx            # 前端路由設定
```

---

## 4. 如何在公版上發想你的需求

本專案的「公版」不是通用 CRUD 框架，而是以**主題一：任務媒介**為地基，後續各主題（T2 NFT 代發行、T3 食物販售、T4 目標清單）都是在這個地基上疊加的新實體。

### 第一步：理解公版的核心實體與角色

公版管理的核心實體是 **`onchain_tasks`（鏈上任務）**，圍繞兩個角色運作：

| 角色 | 說明 |
| :--- | :--- |
| **需求方（creator）** | 發布任務、設定報酬、確認完成 |
| **供給方（executor）** | 瀏覽任務、接取執行、提交成果 |

**任務的狀態機（核心流程）：**

```
Open → InProgress → Submitted → Completed
  ↑                                  ↑
需求方建立                       需求方確認
        ↑                ↑
     供給方接取       供給方提交
```

**現有資料結構（`onchain_tasks`）：**

| 欄位 | 型別 | 說明 |
| :--- | :--- | :--- |
| `id` | BIGSERIAL | 主鍵 |
| `title` | VARCHAR | 任務標題 |
| `description` | TEXT | 任務描述 |
| `reward` | NUMERIC | 報酬金額（USDC） |
| `status` | VARCHAR | `Open` / `InProgress` / `Submitted` / `Completed` |
| `creator_address` | VARCHAR(42) | 需求方錢包地址 |
| `executor_address` | VARCHAR(42) | 供給方錢包地址（接取後填入） |
| `submission` | TEXT | 供給方提交的成果說明 |
| `created_at` | TIMESTAMPTZ | 建立時間 |
| `updated_at` | TIMESTAMPTZ | 最後更新時間 |

### 第二步：對應你的主題到這個骨架

各主題都有自己的**主要實體**與**角色**，但骨架與 Task 相同（供需兩方 + 狀態流）。

| 主題 | 主要實體 | 需求方 | 供給方 | 核心狀態流 |
| :--- | :--- | :--- | :--- | :--- |
| **T1 任務媒介**（公版） | `onchain_tasks` | 任務發布者 | 任務執行者 | Open → InProgress → Submitted → Completed |
| **T2 NFT 代發行** | `nft_orders` | 廠商（付服務費） | 平台（代鑄造） | Pending → Minting → Ready → Completed |
| **T3 即期食物** | `food_listings` | 餐廳（上架） | 消費者（購買） | Available → Sold → Redeemed |
| **T4 每日目標** | `goals` | 使用者（設定目標） | 使用者本人（打卡） | Active → Completed / Failed → Settled |

### 第三步：為你的主題列出 API 端點

參考 T1 的 API 設計，為你的主題規劃對應端點：

**T1 任務媒介（公版參考）：**

| Method | 路徑 | 說明 |
| :--- | :--- | :--- |
| `GET` | `/api/onchain-tasks` | 取得所有開放任務 |
| `POST` | `/api/onchain-tasks` | 需求方建立任務 |
| `PUT` | `/api/onchain-tasks/:id/accept` | 供給方接取任務 |
| `PUT` | `/api/onchain-tasks/:id/submit` | 供給方提交成果 |
| `PUT` | `/api/onchain-tasks/:id/complete` | 需求方確認完成 |

你的主題照這個模式，把 `onchain-tasks` 換成你的資源名稱，把狀態動詞換成你的流程步驟。

### 第四步：規劃資料庫欄位

以 T1 的 `onchain_tasks` 為參考模板，設計你的資料表：

```sql
-- 主題一（公版）的結構，作為其他主題的設計參考
CREATE TABLE IF NOT EXISTS onchain_tasks (
    id               BIGSERIAL    PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    reward           NUMERIC(18,6) NOT NULL DEFAULT 0,
    status           VARCHAR(50)  NOT NULL DEFAULT 'Open',
    creator_address  VARCHAR(42)  NOT NULL,
    executor_address VARCHAR(42),
    submission       TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

你的資料表至少應包含：
- `id`（主鍵，BIGSERIAL）
- 你的核心業務欄位
- `status`（狀態機的當前節點）
- 涉及的角色地址（creator / executor 等）
- `created_at` / `updated_at`

---

## 5. 後端開發流程（Go）

以「新增一個 `books` 功能」為例，說明你需要按順序建立哪些檔案。

### Step 1 — 新增資料表（SQL）

在 `infra/init/` 新增你的 SQL 檔（若 Volume 已建立，直接用 pgcli 執行）：

```sql
CREATE TABLE IF NOT EXISTS books (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    author      VARCHAR(255) NOT NULL,
    status      VARCHAR(50)  NOT NULL DEFAULT 'unread',
    rating      INT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

直接執行（若資料庫已在跑）：

```bash
pgcli -h localhost -p 5432 -u postgres -d TASK
# 進入後貼上 SQL 執行
```

### Step 2 — 建立 Model

新增 `go-service/internal/model/book.go`：

```go
package model

import "time"

type Book struct {
    ID        int64
    Title     string
    Author    string
    Status    string
    Rating    *int
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### Step 3 — 建立 DTO

新增 `go-service/internal/dto/book_dto.go`，定義 API 的 JSON 格式：

```go
package dto

type CreateBookRequest struct {
    Title  string `json:"title"`
    Author string `json:"author"`
    Status string `json:"status"`
    Rating *int   `json:"rating"`
}

type BookResponse struct {
    ID        int64  `json:"id"`
    Title     string `json:"title"`
    Author    string `json:"author"`
    Status    string `json:"status"`
    Rating    *int   `json:"rating"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
}

type BookListResponse struct {
    Success bool           `json:"success"`
    Data    []BookResponse `json:"data"`
    Message string         `json:"message"`
}
```

### Step 4 — 建立 Repository（SQL 操作）

新增 `go-service/internal/repository/book_repository.go`，
參考 `task_repository.go` 的寫法，實作 `FindAll`、`Create`、`Update`、`Delete`。

### Step 5 — 建立 Service（業務邏輯）

新增 `go-service/internal/service/book_service.go`，
參考 `task_service.go`，呼叫 repository 的方法。

### Step 6 — 建立 Handler（HTTP 層）

新增 `go-service/internal/handler/book_handler.go`，
參考 `task_handler.go`，解析 request 並呼叫 service。

### Step 7 — 註冊路由

在 `go-service/internal/router/router.go` 加入你的路由：

```go
// 在 SetupRouter 函式中加入 bookHandler 參數，並新增路由
api.GET("/books", bookHandler.GetBooks)
api.POST("/books", bookHandler.CreateBook)
api.PUT("/books/:id", bookHandler.UpdateBook)
api.DELETE("/books/:id", bookHandler.DeleteBook)
```

### Step 8 — 組裝依賴

在 `go-service/cmd/server/main.go` 按照現有 Task 的寫法，
依序建立 `bookRepo → bookService → bookHandler`，傳入 `SetupRouter`。

### 驗證後端

```bash
cd go-service
docker compose up --build -d

# 測試新增
curl -X POST http://localhost:8081/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"原子習慣","author":"詹姆斯·克利爾","status":"reading"}'

# 測試查詢
curl http://localhost:8081/api/books
```

---

## 6. 前端開發流程（React）

### Step 1 — 定義 TypeScript 型別

新增或修改 `react-service/src/types/book.ts`：

```ts
export type Book = {
  id: number;
  title: string;
  author: string;
  status: string;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BookListResponse = {
  success: boolean;
  data: Book[];
  message: string;
};
```

### Step 2 — 建立 API 封裝

新增 `react-service/src/api/bookApi.ts`，
參考 `taskApi.ts` 的寫法，實作 `getBooks`、`createBook`、`updateBook`、`deleteBook`。

### Step 3 — 建立頁面元件

| 檔案 | 用途 |
| :--- | :--- |
| `pages/BookListPage.tsx` | 列表頁，呼叫 `getBooks` 顯示資料 |
| `pages/BookCreatePage.tsx` | 新增頁，包含表單，呼叫 `createBook` |
| `components/book/BookCard.tsx` | 單筆書籍的卡片元件 |
| `components/book/BookForm.tsx` | 新增/編輯的共用表單元件 |

> 可以直接複製 `TaskListPage.tsx` 或 `TaskCard.tsx` 作為起點，修改欄位名稱和型別。

### Step 4 — 註冊路由

在 `react-service/src/router/index.tsx` 加入你的頁面路由：

```tsx
{ path: "/books", element: <BookListPage /> },
{ path: "/books/new", element: <BookCreatePage /> },
```

### Step 5 — 加入導覽連結

在 `layouts/AppLayout.tsx` 或 `components/common/Header.tsx` 加入你的頁面連結。

---

## 7. 完整開發範例：從想法到落地

### 一個完整功能的最小集合

```
後端（Go）                        前端（React）
─────────────────────────────    ─────────────────────────────
model/book.go                    types/book.ts
dto/book_dto.go                  api/bookApi.ts
repository/book_repository.go    components/book/BookCard.tsx
service/book_service.go          components/book/BookForm.tsx
handler/book_handler.go          pages/BookListPage.tsx
router/router.go（修改）         pages/BookCreatePage.tsx
cmd/server/main.go（修改）       router/index.tsx（修改）
infra/init/<your>.sql
```

### 開發建議順序

1. **先定資料結構** — 想清楚你的 DB 欄位，這是整個系統的地基
2. **後端先跑通** — 用 curl 驗證每個 API 正確回傳資料
3. **前端再接上** — 確認 API 有資料後，前端開發比較順
4. **最後打磨 UI** — 調整樣式、加入 Loading / 空狀態等細節

---

## 8. 完成後的 Push 流程

### 確認不會 commit 到不該 commit 的東西

```bash
git status
# 確認沒有 .env 出現在 Changes to be committed 中
```

### Commit 並 Push

```bash
git add go-service/internal/ go-service/cmd/
git add react-service/src/
git commit -m "feat: 新增書籍管理功能（CRUD）"

git push origin feat/your-feature-name
```

### 在 GitHub 建立 Pull Request

1. 前往 GitHub repo，點擊 **Compare & pull request**
2. PR 標題清楚描述功能，例如：`feat: 新增書籍閱讀記錄系統`
3. Description 簡述你做了什麼、有哪些 API、前端有哪些頁面
4. 等待 review 後合併至 main

---

> 有任何問題先看 [Docker 標準化部署指南](./Onchain%20Task%20Tracker：Docker%20標準化部署指南.md)，環境問題 90% 都在那邊有解答。
