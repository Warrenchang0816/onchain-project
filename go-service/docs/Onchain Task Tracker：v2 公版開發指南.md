# Onchain Task Tracker：v2 公版開發指南

> 以**目前版本（v2）為公版基準**，說明完整的環境建置、前後端測試流程、錢包連結與切換，以及如何延展出各主題。

## 目錄

1. [第一次環境建置（建立 .env → 跑起來）](#1-第一次環境建置建立-env--跑起來)
2. [Git 工作流程](#2-git-工作流程)
3. [認識 v2 公版架構](#3-認識-v2-公版架構)
4. [端對端測試 SOP（前後端完整流程）](#4-端對端測試-sop前後端完整流程)
5. [錢包連結與切換指南](#5-錢包連結與切換指南)
6. [後端開發流程（新增資源）](#6-後端開發流程新增資源)
7. [前端開發流程（新增頁面與元件）](#7-前端開發流程新增頁面與元件)
8. [主題發想：如何從公版延展](#8-主題發想如何從公版延展)
9. [完成後的 Push 流程](#9-完成後的-push-流程)

---

## 1. 第一次環境建置（建立 .env → 跑起來）

### Step 1 — 建立 .env 檔案

`.env` 不會隨 clone 下來，但每個服務都附有 `.env.example` 範本：

```bash
# infra
cd infra
cp .env.example .env
# 填入 POSTGRES_PASSWORD
cd ..

# go-service
cd go-service
cp .env.example .env
# 填入 DB_PASS（與 infra 的 POSTGRES_PASSWORD 一致）
# 填入 APP_RPC_URL、APP_REWARD_VAULT_ADDRESS、APP_PLATFORM_OPERATOR_PRIVATE_KEY
cd ..

# react-service
cd react-service
cp .env.example .env
# 填入 VITE_RPC_URL、VITE_REWARD_VAULT_ADDRESS（與後端一致）
cd ..

# task-reward-vault（部署合約用）
cd task-reward-vault
cp .env.example .env
# 填入 SEPOLIA_RPC_URL、SEPOLIA_PRIVATE_KEY（不含 0x）、TREASURY_ADDRESS
cd ..
```

> 各欄位用途請查看各目錄的 `.env.example` 注釋。
> 區塊鏈相關值（RPC URL、合約地址、私鑰）的申請方式參考 [區塊鏈與合約建立指南](./Onchain%20Task%20Tracker：區塊鏈與合約建立指南.md)。

### Step 2 — 啟動資料庫基礎設施

```bash
cd infra
docker compose up -d
docker compose ps   # 確認 onchain-postgres 狀態為 healthy
cd ..
```

### Step 3 — 啟動後端

```bash
cd go-service
docker compose up -d
curl http://localhost:8081/api/tasks
# 回傳 {"success":true,"data":[]} 表示成功
cd ..
```

### Step 4 — 啟動前端

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
- 每個功能開一條 branch，完成後 push 並提 PR
- Branch 命名：`feat/<功能名>` 或 `feat/<你的名字>/<功能名>`

### 開始開發前

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### 開發中：指定檔案提交

```bash
git add go-service/internal/model/xxx.go
git add react-service/src/pages/XxxPage.tsx
git commit -m "feat: 新增 xxx 功能"
```

> **⚠️ 絕對不要 `git add .`** — `.env` 含有私鑰與密碼，一旦 commit 進 git history 就算之後刪除仍可被找回。

---

## 3. 認識 v2 公版架構

### 3.1 v2 相較 v1 的主要差異

| 功能 | v1 | v2（現行公版） |
| :--- | :--- | :--- |
| 身份認證 | 無 | SIWE（Sign-In with Ethereum）+ Session Cookie |
| 任務狀態 | 單一 status | 雙軌狀態機（業務 status + onchainStatus） |
| 鏈上整合 | 無 | ETH 托管（Fund）、Operator 自動簽署（assignWorker/approveTask）、用戶 Claim |
| 權限控管 | 無 | 後端基於錢包身份計算 canXxx 權限欄位 |
| 交易紀錄 | 無 | `task_blockchain_logs`，`GET /api/blockchain-logs` 公開查詢 |
| 前端路由 | `/`、`/tasks` | `/`、`/tasks`、`/tasks/:id`、`/logs` |

---

### 3.2 後端架構（go-service）

```
go-service/
├── cmd/server/main.go                     # 進入點，組裝所有依賴
└── internal/
    ├── auth/                              # SIWE Session middleware
    │   ├── auth_middleware.go             # 強制驗證 middleware
    │   ├── optional_auth_middleware.go    # 選用驗證（未登入仍可讀取，但 canXxx 全為 false）
    │   ├── siwe.go                        # SIWE 訊息產生 + 簽名驗證
    │   ├── session_cookie.go              # Session Cookie 讀寫
    │   └── nonce.go                       # Nonce 生成（防重放攻擊）
    ├── config/
    │   ├── config.go                      # BlockchainConfig / SIWEConfig / DBConfig
    │   └── env.go                         # GetEnv 工具函式
    ├── db/postgres.go                     # PostgreSQL 連線
    ├── model/
    │   ├── task.go                        # Task + TaskStatus + TaskOnchainStatus 常數
    │   └── blockchain_log.go              # BlockchainLog
    ├── dto/task_dto.go                    # Request / Response JSON 定義（含 canXxx 欄位）
    ├── repository/
    │   ├── task_repository.go             # Task CRUD SQL
    │   ├── blockchain_log_repository.go   # 交易紀錄 SQL
    │   ├── nonce_repository.go            # SIWE Nonce SQL
    │   └── session_repository.go          # Session SQL
    ├── service/
    │   ├── task_service.go                # 業務邏輯（含 MarkTaskFunded 自動 assignWorker）
    │   ├── task_permission.go             # CanEditTask / CanFundTask / CanClaimOnchain 等
    │   └── task_reward_vault_service.go   # 合約互動（assignWorker / approveTask via RPC）
    ├── handler/
    │   ├── task_handler.go                # 任務 HTTP 處理（含 toTaskResponse 注入 canXxx）
    │   ├── blockchain_log_handler.go      # GET /api/blockchain-logs
    │   └── auth_handler.go                # SIWE message / verify / me / logout
    └── router/router.go                   # 路由定義 + CORS
```

**資料流（一個 API 請求的完整路徑）：**

```
HTTP Request
  → router（路由分派）
  → auth middleware（驗證 Session Cookie，取得 walletAddress）
  → handler（解析 JSON，呼叫 service）
  → service（業務邏輯 + 權限判斷）
  → repository（執行 SQL）
  → PostgreSQL
        ↓（若需要鏈上操作）
  service → task_reward_vault_service → Alchemy RPC → 合約
```

---

### 3.3 雙軌狀態機

每筆任務有兩個獨立狀態欄位，分別追蹤業務進度與鏈上資金狀態：

**業務狀態（`status`）：**

```
OPEN → IN_PROGRESS → SUBMITTED → APPROVED → COMPLETED
                                                ↑
                                         CANCELLED（可從 OPEN 取消）
```

**鏈上狀態（`onchainStatus`）：**

```
NOT_FUNDED → FUNDED → ASSIGNED → APPROVED → CLAIMED
     ↑           ↑         ↑          ↑          ↑
  任務建立   前端 Fund  後端自動    後端自動   前端 Claim
                       (Accept 時) (Approve 時)
```

**特殊情況：Accept 在 Fund 之前**

若供給方先 Accept（`IN_PROGRESS`）、需求方再 Fund，`MarkTaskFunded` 會偵測到 `assigneeWalletAddress != nil`，**自動呼叫 `assignWorker`**，無需重新操作。

> **無報酬任務**：`rewardAmount = "0"` 的任務，`onchainStatus` 永遠停在 `NOT_FUNDED`，Fund / Claim On-chain 按鈕不會出現，Approve 後直接可 Claim（純 DB 操作）。

---

### 3.4 權限系統（canXxx）

後端每次回傳任務時，根據當前登入的 `walletAddress` 計算以下布林欄位：

| 欄位 | 條件摘要 |
| :--- | :--- |
| `isOwner` | 登入錢包 == 任務建立者 |
| `isAssignee` | 登入錢包 == 接取者 |
| `canEdit` | owner，且 status 不在 SUBMITTED/APPROVED/COMPLETED/CANCELLED |
| `canCancel` | owner，且 status 只有 OPEN（IN_PROGRESS/SUBMITTED 後不可取消） |
| `canAccept` | 非 owner、非 assignee、status == OPEN |
| `canSubmit` | assignee，且 status == IN_PROGRESS |
| `canApprove` | owner，status == SUBMITTED；有 reward 時需 onchainStatus == ASSIGNED |
| `canFund` | owner，rewardAmount > 0，onchainStatus == NOT_FUNDED，status 非終態 |
| `canClaim` | assignee，status == APPROVED，**rewardAmount == 0**（無鏈上任務用） |
| `canClaimOnchain` | assignee，status == APPROVED，rewardAmount > 0，onchainStatus == APPROVED |

> 未登入時所有 `canXxx` 均為 `false`。前端只需根據這些欄位決定是否顯示按鈕，**不需要自己判斷業務邏輯**。

---

### 3.5 完整 API 端點一覽

| Method | 路徑 | Auth | 說明 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | Optional | 任務列表（含 canXxx） |
| `GET` | `/api/tasks/:id` | Optional | 任務詳情 |
| `POST` | `/api/tasks` | ✅ | 建立任務 |
| `PUT` | `/api/tasks/:id` | ✅ | 更新任務內容 |
| `PUT` | `/api/tasks/:id/status` | ✅ | 強制更新狀態（God Mode） |
| `PUT` | `/api/tasks/:id/accept` | ✅ | 接取任務（供給方） |
| `PUT` | `/api/tasks/:id/cancel` | ✅ | 取消任務（需求方） |
| `POST` | `/api/tasks/:id/submissions` | ✅ | 提交成果（供給方） |
| `PUT` | `/api/tasks/:id/approve` | ✅ | 核准任務（需求方，觸發鏈上 approveTask） |
| `POST` | `/api/tasks/:id/claim` | ✅ | 領取獎勵（無 reward 任務用） |
| `PUT` | `/api/tasks/:id/fund` | ✅ | 同步 DB Fund 狀態（與 onchain/funded 等效，舊版端點） |
| `POST` | `/api/tasks/:id/onchain/funded` | ✅ | 前端 Fund 上鏈後同步 DB |
| `POST` | `/api/tasks/:id/onchain/claimed` | ✅ | 前端 Claim 上鏈後同步 DB |
| `GET` | `/api/blockchain-logs` | 公開 | 平台所有鏈上交易紀錄 |
| `POST` | `/api/auth/wallet/siwe/message` | 公開 | 取得 SIWE 登入訊息（含 nonce） |
| `POST` | `/api/auth/wallet/siwe/verify` | 公開 | 驗證簽名，建立 Session Cookie |
| `GET` | `/api/auth/me` | 公開 | 取得當前 Session 狀態 |
| `POST` | `/api/auth/logout` | 公開 | 登出（清除 Session） |

---

### 3.6 前端架構（react-service）

```
react-service/src/
├── api/
│   ├── taskApi.ts          # 所有任務 API + BlockchainLog 查詢
│   ├── authApi.ts          # SIWE message / verify / me / logout
│   ├── walletApi.ts        # toChecksumAddress、signSIWEMessage（MetaMask personal_sign）
│   └── dashboardApi.ts     # 首頁摘要資料
├── assets/                 # 靜態資源（hero.png 等圖片）
├── components/
│   ├── common/
│   │   ├── AppButton.tsx       # 統一按鈕（variant: primary/secondary/danger）
│   │   ├── AppModal.tsx        # 通用 Modal 框架
│   │   ├── ConfirmDialog.tsx   # 確認對話框（含 isLoading 狀態）
│   │   ├── EmptyState.tsx      # 空狀態提示
│   │   ├── FilterTabs.tsx      # 篩選 Tab 列
│   │   ├── Header.tsx          # 頁首（NavLink + WalletConnectPanel）
│   │   ├── LoadingButton.tsx   # 帶 loading 狀態的按鈕
│   │   ├── PageLoading.tsx     # 全頁 Loading 狀態
│   │   └── SummaryCard.tsx     # 首頁摘要卡片
│   ├── task/
│   │   ├── TaskCard.tsx        # 任務卡片（標題為可點擊連結 → Detail 頁）
│   │   ├── TaskForm.tsx        # 建立/編輯表單（含 rewardAmount 欄位）
│   │   ├── TaskSubmitModal.tsx # 提交成果 Modal
│   │   ├── FundTaskButton.tsx  # Fund 按鈕（wagmi writeContract + DB 同步）
│   │   └── ClaimOnchainButton.tsx  # Claim On-chain 按鈕（wagmi writeContract + DB 同步）
│   └── wallet/
│       └── WalletConnectPanel.tsx  # 錢包狀態面板（Connect / Sign to Login / Logout）
├── contexts/               # React Context（目前為空，供主題延伸使用）
├── hooks/                  # 自訂 Hook（目前為空，供主題延伸使用）
├── layouts/AppLayout.tsx   # 頁面框架（Header + children）
├── lib/wallet/
│   ├── config.ts           # wagmi 設定（MetaMask connector + Sepolia chain）
│   ├── constants.ts        # REWARD_VAULT_ADDRESS、EXPLORER_URL、TARGET_CHAIN_ID
│   ├── taskOnchain.ts      # fundTaskOnchain、toTaskBytes32、toRewardValue
│   └── abi/taskRewardVaultAbi.ts  # 合約 ABI（assignWorker/approveTask/claimReward）
├── pages/
│   ├── HomePage.tsx            # 儀表板（摘要卡片 + 近期任務）
│   ├── TaskListPage.tsx        # 任務列表（CRUD + 篩選 + 所有動作）
│   ├── TaskDetailPage.tsx      # 任務詳情（Fund / Claim On-chain / Approve 等）
│   └── BlockchainLogsPage.tsx  # 平台交易歷史（/logs）
├── router/index.tsx        # 路由定義
├── types/task.ts           # Task、TaskStatus、BlockchainLog 等型別
├── App.tsx                 # 根元件（RouterProvider 包裝）
├── index.css               # 全域樣式（所有自訂 CSS 統一寫這裡）
└── main.tsx                # App 進入點（WagmiProvider + QueryClientProvider）
```

---

### 3.7 智能合約（task-reward-vault）

```
task-reward-vault/
├── contracts/
│   └── TaskRewardVault.sol        # 主合約（OpenZeppelin AccessControl）
├── scripts/
│   └── deploy.ts                  # Hardhat 部署腳本
├── hardhat.config.ts              # 使用 @nomicfoundation/hardhat-viem
├── package.json
└── tsconfig.json
```

**合約角色與關鍵函式：**

| 函式 | 呼叫者 | 說明 |
| :--- | :--- | :--- |
| `createAndFundTask(bytes32 taskId, address poster)` | 使用者（前端） | 建立任務並存入 ETH 報酬，`payable` |
| `assignWorker(bytes32 taskId, address worker)` | Operator 後端 | 指定接取者，鎖定資金 |
| `approveTask(bytes32 taskId)` | Operator 後端 | 核准成果，資金進入可領取狀態 |
| `claimReward(bytes32 taskId)` | 使用者（前端） | 接取者領取獎勵（扣除平台費後） |
| `refundTask(bytes32 taskId)` | Operator 後端 | 退款給發布者（異常處理） |
| `withdrawPlatformFees(address to, uint256 amount)` | Treasury | 提取平台手續費 |

**部署流程：**

```bash
cd task-reward-vault
cp .env.example .env
# 填入 SEPOLIA_RPC_URL、SEPOLIA_PRIVATE_KEY（不含 0x）、TREASURY_ADDRESS

npm install
npx hardhat run scripts/deploy.ts --network sepolia
# 取得合約地址 → 填入 go-service/.env 和 react-service/.env
```

> 詳細部署 SOP 見 [區塊鏈與合約建立指南](./Onchain%20Task%20Tracker：區塊鏈與合約建立指南.md)

---

### 3.8 Task 完整型別定義

```typescript
// src/types/task.ts
interface Task {
    id: number;               // DB 自動遞增 ID（用於 API 呼叫）
    taskId: string;           // 格式：TASK-{timestamp}-{hex8}（合約 keccak256 使用）
    walletAddress: string;    // 需求方錢包地址
    assigneeWalletAddress?: string | null;  // 供給方（接取後填入）

    title: string;
    description: string;
    status: "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "CANCELLED" | "COMPLETED";
    priority: string;         // LOW / MEDIUM / HIGH / URGENT
    rewardAmount: string;     // ETH 字串，"0" 代表無報酬
    feeBps: number;           // 平台手續費基點（500 = 5%）

    onchainStatus: string;    // NOT_FUNDED / FUNDED / ASSIGNED / APPROVED / CLAIMED

    // 鏈上交易哈希（完成對應操作後填入）
    fundTxHash?: string | null;
    approveTxHash?: string | null;
    claimTxHash?: string | null;
    cancelTxHash?: string | null;

    // 後端基於登入錢包計算的權限欄位（見 3.4）
    isOwner: boolean;
    isAssignee: boolean;
    canEdit: boolean;
    canCancel: boolean;
    canAccept: boolean;
    canSubmit: boolean;
    canApprove: boolean;
    canClaim: boolean;
    canClaimOnchain: boolean;
    canFund: boolean;

    dueDate?: string | null;
    createdAt: string;
    updatedAt: string;
}
```

---

## 4. 端對端測試 SOP（前後端完整流程）

### 準備：兩個 MetaMask 錢包

- **錢包 A**：需求方（建立任務、Fund、Approve）
- **錢包 B**：供給方（Accept、Submit、Claim）

兩個錢包都需要有 **Sepolia ETH**（從水龍頭領取，有報酬任務時用）。

---

### 情境 A：有報酬任務（完整鏈上流程）

#### 階段 1 — 需求方建立任務並 Fund

1. 用錢包 A 連線 → Sign to Login（SIWE）
2. `/tasks` → 點 **新增任務** → 填入標題、rewardAmount（如 `0.001`）→ 建立
3. 點任務標題進入 **Task Detail**
4. 點 **Fund** 按鈕 → MetaMask 彈出，確認 `value = 0.001 ETH` → 送出
5. 等待鏈上確認（15–30 秒）→ 頁面自動刷新，onchainStatus 變為 `FUNDED`

**驗證：**
```bash
curl http://localhost:8081/api/tasks/<id>
# onchainStatus: "FUNDED"，fundTxHash 有值
```

#### 階段 2 — 供給方接取任務

1. 切換到錢包 B → 重新 Connect + Sign to Login
2. 找到任務 → 點 **Accept** → 確認
3. 後端呼叫合約 `assignWorker` → onchainStatus 變為 `ASSIGNED`
4. status 變為 `IN_PROGRESS`

**驗證：**
```bash
curl http://localhost:8081/api/tasks/<id>
# assigneeWalletAddress: "0x錢包B"，onchainStatus: "ASSIGNED"
```

#### 階段 3 — 供給方提交成果

1. 保持錢包 B，Detail 頁點 **Submit** → 填入成果描述 → 送出
2. status 變為 `SUBMITTED`

#### 階段 4 — 需求方核准

1. 切換回錢包 A → Detail 頁點 **Approve** → 確認
2. 後端呼叫合約 `approveTask` → onchainStatus 變為 `APPROVED`
3. status 變為 `APPROVED`

**若 Approve 按鈕不出現（黃色警告出現）：**
- 代表 onchainStatus 還不是 `ASSIGNED`
- 確認 Fund 有完成（onchainStatus 需為 FUNDED），且 Accept 已執行

#### 階段 5 — 供給方領取獎勵（Claim On-chain）

1. 切換回錢包 B → Detail 頁點 **Claim On-chain** → MetaMask 確認
2. 等待鏈上確認 → onchainStatus 變為 `CLAIMED`、status 變為 `COMPLETED`

**驗證 History：**
前往 `/logs`，確認出現 4 筆紀錄：`Fund` / `Assign Worker` / `Approve` / `Claim Reward`

---

### 情境 B：無報酬任務（純 DB 流程）

建立任務時 rewardAmount 填 `0` 或留空：

```
建立（OPEN）→ Accept（IN_PROGRESS）→ Submit（SUBMITTED）→ Approve（APPROVED）→ Claim（COMPLETED）
```

- Fund / Claim On-chain 按鈕不出現
- Approve 不需要 onchainStatus 條件
- 最後 Claim 按鈕直接完成（純 DB，不呼叫合約）

---

### 情境 C：先 Accept 後 Fund（順序互換）

若供給方先 Accept（`IN_PROGRESS`），需求方後 Fund：

1. 錢包 B Accept → status: `IN_PROGRESS`，onchainStatus: `NOT_FUNDED`
2. 錢包 A Fund → `MarkTaskFunded` 偵測到 assignee 存在 → **自動呼叫 `assignWorker`**
3. onchainStatus 直接跳到 `ASSIGNED`，無需重新操作

---

## 5. 錢包連結與切換指南

### 5.1 SIWE 認證流程說明

v2 的「連結錢包」分為兩個步驟：

```
1. Connect MetaMask（eth_requestAccounts）
   → 取得錢包地址，但後端還不認識你

2. Sign to Login（SIWE）
   → 前端向後端取得 nonce（POST /api/auth/wallet/siwe/message）
   → 請使用者用 MetaMask personal_sign 簽名
   → 前端送出簽名（POST /api/auth/wallet/siwe/verify）
   → 後端驗證通過，設定 Session Cookie（有效 24 小時）
   → 之後所有 API 請求自動帶 Cookie，後端識別身份
```

> Header 顯示 **"Wallet Connected"**：已連線但未登入（canXxx 全為 false）
> Header 顯示 **"Authenticated"**：已登入，可執行所有授權操作

### 5.2 WalletConnectPanel 的狀態機

| 狀態 | 顯示內容 | 可執行動作 |
| :--- | :--- | :--- |
| MetaMask 未安裝 | "MetaMask 未安裝" | — |
| 未連線 | Connect MetaMask 按鈕 | 點擊連線 |
| 已連線未登入 | 地址 + 鏈名 + "Wallet Connected" + **Sign to Login** 按鈕 | 簽名登入 |
| 已連線已登入 | 地址 + 鏈名 + "Authenticated" + Logout 按鈕 | 登出 |

**切換帳號時的自動處理：**
- MetaMask 切換帳號 → `accountsChanged` 事件觸發 → 自動呼叫後端 logout → 要求重新簽名
- 直接 Disconnect → 清除後端 Session + 頁面 reload

### 5.3 切換到另一個測試帳號

```
1. Header 點 Logout（清除 Session）
2. MetaMask → 右上角帳號圖示 → 選擇另一個帳號（或新增帳號）
3. Header 點 Connect MetaMask
4. Header 點 Sign to Login → MetaMask 簽名視窗 → 確認
5. Header 顯示新地址 + "Authenticated"
```

### 5.4 確認 MetaMask 網路正確

本專案需要 MetaMask 連接 **Sepolia Testnet**（Chain ID: 11155111）：

- MetaMask → 左上角網路選擇器 → 選 **Sepolia test network**
- 若沒看到 Sepolia：Settings → Advanced → **Show test networks** → 開啟

> 若 MetaMask 連到錯誤網路，Fund 或 Claim On-chain 交易會失敗（合約拒絕）。

---

## 6. 後端開發流程（新增資源）

以新增「每日打卡目標（goals）」為例，說明完整的 8 步流程。

### 建立順序

```
1. infra/init/<resource>.sql       → 資料表定義
2. internal/model/<resource>.go    → Go struct（對應 DB 欄位）
3. internal/dto/<resource>_dto.go  → Request / Response JSON 定義
4. internal/repository/            → 純 SQL CRUD（不含業務邏輯）
5. internal/service/               → 業務邏輯（呼叫 repository）
6. internal/handler/               → HTTP 處理（解析 request，呼叫 service）
7. internal/router/router.go       → 新增路由（修改既有檔案）
8. cmd/server/main.go              → 組裝依賴（修改既有檔案）
```

### Step 1 — SQL

若 Volume 已存在，直接用 pgcli 執行（不要刪 Volume）：

```sql
CREATE TABLE IF NOT EXISTS goals (
    id               BIGSERIAL    PRIMARY KEY,
    goal_id          VARCHAR(64)  NOT NULL UNIQUE,
    wallet_address   VARCHAR(255) NOT NULL,
    title            VARCHAR(255) NOT NULL,
    deposit_amount   NUMERIC(20,8) NOT NULL DEFAULT 0,
    status           VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    start_date       TIMESTAMPTZ  NOT NULL,
    end_date         TIMESTAMPTZ  NOT NULL,
    checkin_count    INTEGER      NOT NULL DEFAULT 0,
    required_checkins INTEGER     NOT NULL DEFAULT 7,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

```bash
pgcli -h localhost -p 5432 -u postgres -d TASK
# 貼上 SQL 執行
```

### Step 2 — Model

```go
// internal/model/goal.go
package model

import "time"

type Goal struct {
    ID               int64
    GoalID           string
    WalletAddress    string
    Title            string
    DepositAmount    string
    Status           string
    StartDate        time.Time
    EndDate          time.Time
    CheckinCount     int
    RequiredCheckins int
    CreatedAt        time.Time
    UpdatedAt        time.Time
}
```

### Step 3 — DTO

```go
// internal/dto/goal_dto.go
package dto

type CreateGoalRequest struct {
    Title            string `json:"title"`
    DepositAmount    string `json:"depositAmount"`
    StartDate        string `json:"startDate"`
    EndDate          string `json:"endDate"`
    RequiredCheckins int    `json:"requiredCheckins"`
}

type GoalResponse struct {
    ID               int64  `json:"id"`
    GoalID           string `json:"goalId"`
    WalletAddress    string `json:"walletAddress"`
    Title            string `json:"title"`
    DepositAmount    string `json:"depositAmount"`
    Status           string `json:"status"`
    CheckinCount     int    `json:"checkinCount"`
    RequiredCheckins int    `json:"requiredCheckins"`
    CreatedAt        string `json:"createdAt"`
}
```

### Step 4–6 — Repository / Service / Handler

參考 `task_repository.go`、`task_service.go`、`task_handler.go` 的寫法：
- **Repository**：只寫 SQL，不含任何業務判斷
- **Service**：業務邏輯（狀態檢查、權限判斷），呼叫 repository
- **Handler**：解析 request JSON，呼叫 service，回傳統一格式的 response

Response 格式統一：
```json
{ "success": true, "data": <T>, "message": "" }
```

### Step 7 — 更新 router.go

```go
func SetupRouter(
    taskHandler *handler.TaskHandler,
    logHandler *handler.BlockchainLogHandler,
    goalHandler *handler.GoalHandler,     // 新增參數
    authHandler *handler.AuthHandler,
) *gin.Engine {
    // ...
    protected.GET("/goals", goalHandler.GetGoals)
    protected.POST("/goals", goalHandler.CreateGoal)
    protected.POST("/goals/:id/checkin", goalHandler.CheckIn)
}
```

### Step 8 — 更新 main.go

```go
goalRepo    := repository.NewGoalRepository(postgresDB)
goalService := service.NewGoalService(goalRepo)
goalHandler := handler.NewGoalHandler(goalService)

r := router.SetupRouter(taskHandler, logHandler, goalHandler, authHandler)
```

### 重新部署後端

```bash
cd go-service
docker compose up --build -d
docker logs go-service --tail 20   # 確認無啟動錯誤
```

---

## 7. 前端開發流程（新增頁面與元件）

### Step 1 — 定義 TypeScript 型別

```typescript
// src/types/goal.ts
export type GoalStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "SETTLED";

export interface Goal {
    id: number;
    goalId: string;
    walletAddress: string;
    title: string;
    depositAmount: string;
    status: GoalStatus;
    checkinCount: number;
    requiredCheckins: number;
    createdAt: string;
}

export type GoalListResponse = {
    success: boolean;
    data: Goal[];
    message: string;
};
```

### Step 2 — API 封裝

```typescript
// src/api/goalApi.ts
const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export async function getGoals(): Promise<Goal[]> {
    const response = await fetch(`${API_BASE_URL}/goals`, {
        credentials: "include",
    });
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
    const result: GoalListResponse = await response.json();
    return result.data;
}
```

### Step 3 — 建立頁面元件

| 檔案 | 用途 |
| :--- | :--- |
| `pages/GoalListPage.tsx` | 列表頁，呼叫 `getGoals`，顯示 GoalCard |
| `pages/GoalDetailPage.tsx` | 詳情頁，打卡按鈕 |
| `components/goal/GoalCard.tsx` | 單筆卡片，標題做成 `<Link to="/goals/:id">` |
| `components/goal/GoalForm.tsx` | 建立表單 |

> 直接複製 `TaskListPage.tsx` 或 `TaskCard.tsx` 作為起點，替換型別名稱和欄位。

**若需要鏈上互動（如鎖定保證金）：**
參考 `FundTaskButton.tsx` 的 `useWriteContract + useWaitForTransactionReceipt` 模式：
1. `writeContractAsync(...)` 送出交易，取得 `txHash`
2. `useWaitForTransactionReceipt({ hash: txHash })` 等待確認
3. `isReceiptSuccess` 為 `true` 時，POST 同步 DB

### Step 4 — 新增路由

```typescript
// src/router/index.tsx
import GoalListPage from "../pages/GoalListPage";
import GoalDetailPage from "../pages/GoalDetailPage";

// 在 createBrowserRouter 陣列中加入：
{ path: "/goals", element: <GoalListPage /> },
{ path: "/goals/:id", element: <GoalDetailPage /> },
```

### Step 5 — Header 加入導覽

```tsx
// src/components/common/Header.tsx
<NavLink to="/goals" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
    Goals
</NavLink>
```

### 樣式規則

- **所有樣式統一寫在 `src/index.css`**，不建立 per-component CSS 檔案
- CSS 類別名稱使用 kebab-case（如 `.goal-card-title`）
- 現有的 `.page-container`、`.page-header`、`.task-card`、`.feedback-banner` 等 class 可直接沿用

---

## 8. 主題發想：如何從公版延展

v2 公版已完整實作「T1 任務媒介」的核心流程（含鏈上托管）。組員在此基礎上加入自己的主題。

### 8.1 公版提供的可複用基礎設施

| 基礎設施 | 可直接用於你的主題 |
| :--- | :--- |
| SIWE 認證 + Session | 所有 API 都能識別使用者身份（零額外設定） |
| Operator 錢包簽署機制 | 在你的合約上設定同一個 Operator，後端可代簽 |
| 雙軌狀態機模式 | 業務 status + 鏈上 status 分離，直接照搬 |
| `task_blockchain_logs` 表 | 寫入同一張表，`/logs` 頁面自動顯示你的交易 |
| wagmi + viem 設定 | `lib/wallet/config.ts` 已設定好，直接 import |
| AppModal / ConfirmDialog / AppButton | 統一 UI，直接使用 |
| FundTaskButton 的「合約寫入 + DB 同步」模式 | 複製 `useWriteContract + useWaitForTransactionReceipt + fetch DB` 的三步驟模式 |

### 8.2 各主題的延展方向

**T2 NFT 代發行（FF10560 / karven99）**

核心差異：平台後端代鑄造（Operator 呼叫 ERC-1155 Factory），廠商不需要錢包。

狀態機：`PENDING → MINTING → READY → COMPLETED`

新增資源：`nft_orders` 表，參考 Task 的 repo/service/handler 結構建立 `nft_order_repository.go` 等。

**T3 即期食物（a7872122-design）**

和 Task 最像（上架者 vs 購買者）。可直接複製整套 Task 程式碼，把 `task` → `food_listing`，`accept` → `purchase`，`approve` → `redeem`。

狀態機：`AVAILABLE → SOLD → REDEEMED`

**T4 每日目標（Warrenchang0816）**

單人使用（無供需兩方），狀態機最簡單：`ACTIVE → COMPLETED / FAILED → SETTLED`。

核心邏輯：打卡次數 >= requiredCheckins → COMPLETED；deadline 到了不足 → FAILED。先做純 DB 版本跑通，再接保證金合約。

### 8.3 決策框架：這個操作需要 Operator 嗎？

| 操作類型 | 誰執行 | 方式 |
| :--- | :--- | :--- |
| 使用者自己的資金操作（Fund、Claim、Purchase） | 使用者 | 前端 `writeContractAsync`（MetaMask 簽名） |
| 平台信任背書的操作（assignWorker、approveTask、鑄造） | 平台 Operator | 後端 `task_reward_vault_service.go` 模式 |
| 純業務狀態更新（Submit、Cancel） | 使用者 | 只更新 DB，無需鏈上 |

### 8.4 新增主題的合約地址

每個主題可以部署自己的合約。部署後：

```env
# go-service/.env
APP_YOUR_THEME_CONTRACT_ADDRESS=0x你的合約地址

# react-service/.env
VITE_YOUR_THEME_CONTRACT_ADDRESS=0x你的合約地址
```

在 `go-service/internal/config/config.go` 的 `BlockchainConfig` 加入新欄位，並更新 `.env.example`。

---

## 9. 完成後的 Push 流程

### 提交前確認清單

```bash
# 1. 確認沒有 .env 被 stage
git status
# .env 不應出現在任何列表中

# 2. 前端 TypeScript 無錯誤
cd react-service && npm run build && npm run lint

# 3. 後端可正常建置
cd ../go-service && docker compose up --build -d
docker logs go-service --tail 10  # 確認 Listening and serving HTTP on :8080
```

### Commit 並 Push

```bash
# 指定後端新增的檔案（範例）
git add go-service/internal/model/goal.go
git add go-service/internal/dto/goal_dto.go
git add go-service/internal/repository/goal_repository.go
git add go-service/internal/service/goal_service.go
git add go-service/internal/handler/goal_handler.go
git add go-service/internal/router/router.go
git add go-service/cmd/server/main.go

# 指定前端新增的檔案（範例）
git add react-service/src/types/goal.ts
git add react-service/src/api/goalApi.ts
git add react-service/src/pages/GoalListPage.tsx
git add react-service/src/pages/GoalDetailPage.tsx
git add react-service/src/components/goal/GoalCard.tsx
git add react-service/src/components/goal/GoalForm.tsx
git add react-service/src/router/index.tsx
git add react-service/src/components/common/Header.tsx
git add react-service/src/index.css

git commit -m "feat: T4 每日目標功能（Goals CRUD + 打卡）"
git push origin feat/your-feature-name
```

### 建立 Pull Request

1. 前往 GitHub → **Compare & pull request**
2. PR 標題：`feat: T4 每日目標清單基本流程`
3. Description 說明：新增的 API、前端頁面、如何測試
4. 等待 review 後合併至 main

---

> 環境問題先看 [Docker 標準化部署指南](./Onchain%20Task%20Tracker：Docker%20標準化部署指南.md)
> 區塊鏈設定問題先看 [區塊鏈與合約建立指南](./Onchain%20Task%20Tracker：區塊鏈與合約建立指南.md)
