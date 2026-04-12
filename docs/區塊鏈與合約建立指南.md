# Onchain Task Tracker：區塊鏈與合約建立指南

> 本指南說明如何申請 RPC 節點、設定所有區塊鏈相關環境變數，以及特別注意私鑰等敏感資訊的安全管理。

## 目錄

1. [前置概念：本專案的鏈上架構](#1-前置概念本專案的鏈上架構)
2. [使用的鏈與合約](#2-使用的鏈與合約)
3. [申請 RPC 節點（Infura / Alchemy）](#3-申請-rpc-節點infura--alchemy)
4. [平台 Operator 錢包準備](#4-平台-operator-錢包準備)
5. [合約部署（TaskRewardVault）](#5-合約部署taskrewardvault)
6. [go-service 環境變數完整說明](#6-go-service-環境變數完整說明)
7. [react-service 環境變數完整說明](#7-react-service-環境變數完整說明)
8. [資安重要事項](#8-資安重要事項)
9. [環境驗證 SOP](#9-環境驗證-sop)
10. [常見問題](#10-常見問題)

> **三個服務都有 `.env.example`：**
> `infra/` · `go-service/` · `react-service/` · `task-reward-vault/`
> Clone 後每個目錄各執行一次 `cp .env.example .env` 再填值。

---

## 1. 前置概念：本專案的鏈上架構

本專案有兩種需要與區塊鏈互動的角色：

| 角色 | 誰在操作 | 如何互動 |
| :--- | :--- | :--- |
| **使用者（前端）** | 一般用戶的 MetaMask 錢包 | 透過 wagmi/viem，由使用者自行簽署 `createAndFundTask`、`claimReward` 等交易 |
| **平台 Operator（後端）** | Go 服務，用平台私鑰自動簽署 | 呼叫需要 operator 權限的合約函式：`assignWorker`、`approveTask` |

這兩種角色需要不同的設定：
- **前端**：需要 RPC URL（讀鏈資訊）+ 合約地址（寫合約）
- **後端**：需要 RPC URL + 合約地址 + **平台 Operator 私鑰**（自動簽署交易）

> **重要**：平台 Operator 私鑰只存在 go-service 的 `.env` 裡，**前端絕對不會接觸到私鑰**。

---

## 2. 使用的鏈與合約

### 目前使用的測試網

| 項目 | 值 |
| :--- | :--- |
| 鏈名稱 | **Ethereum Sepolia** |
| Chain ID | `11155111` |
| 原生代幣 | SepoliaETH（測試用，水龍頭可領取） |
| 區塊瀏覽器 | `https://sepolia.etherscan.io` |

> **未來目標**：正式上線時切換至 **Base L2**（Chain ID: `8453`），測試網為 Base Sepolia（Chain ID: `84532`）。Base L2 Gas 費極低，為本專案長期目標鏈。

### 本專案的合約：TaskRewardVault

`TaskRewardVault` 是本專案的核心 Escrow 合約，負責管理任務報酬的托管與釋放。

**合約提供的函式：**

| 函式 | 誰可以呼叫 | 說明 |
| :--- | :--- | :--- |
| `createAndFundTask(taskId, tokenSymbol)` | 任何人（需求方）| 建立任務並鎖入 ETH 報酬 |
| `assignWorker(taskId, worker)` | **Operator only** | 指定任務的執行者（供給方） |
| `approveTask(taskId)` | **Operator only** | 核准任務完成，觸發報酬釋放 |
| `claimReward(taskId)` | 任何人（供給方） | 供給方領取已核准的報酬 |

**Operator only 的設計原因**：`assignWorker` 和 `approveTask` 是高權限操作，由平台後端用固定的 Operator 錢包代為執行，確保業務邏輯一致性，防止惡意搶佔。

---

## 3. 申請 RPC 節點（Infura / Alchemy）

RPC（Remote Procedure Call）節點是後端與前端用來讀寫區塊鏈的入口，就像「通往區塊鏈的門戶」。**Infura** 和 **Alchemy** 是目前最常用的兩家供應商，免費方案皆足夠開發使用，擇一申請即可。

### 兩者比較

| 特性 | Infura | Alchemy |
| :--- | :--- | :--- |
| **介面風格** | 簡潔、專注於 API 管理 | 功能豐富、附帶數據圖表與 Debug 工具 |
| **Sepolia 支援** | 完整支援 | 完整支援，並提供專屬 Sepolia 水龍頭 |
| **開發工具** | 基本交易追蹤 | Alchemy SDK、可模擬交易失敗原因 |
| **免費額度** | 每天約 100,000 次請求 | 採用 Compute Units（CUs），額度通常較寬裕 |
| **附加功能** | IPFS 支援 | NFT API、Notify 推播通知 |

---

### 方案 A：Infura 建立流程

1. 前往 [https://www.infura.io](https://www.infura.io) 註冊並登入。
2. 點擊 **Create New API Key**。
   - Network 選擇 **Web3 API**。
   - 為專案命名（例如：`onchain-task-tracker-dev`）。
3. 進入專案設定 → **Endpoints** 分頁 → 在 Ethereum 下拉選單中勾選 **Sepolia**。
4. 複製 HTTPS 欄位的 URL：
   ```
   https://sepolia.infura.io/v3/你的API_KEY
   ```

---

### 方案 B：Alchemy 建立流程

1. 前往 [https://www.alchemy.com](https://www.alchemy.com) 註冊並登入（可用 Google 登入）。
2. 點擊 **Create new app**，填寫設定：

   | 欄位 | 填入值 |
   | :--- | :--- |
   | Name | `onchain-task-tracker-dev`（任意） |
   | Chain | **Ethereum** |
   | Network | **Ethereum Sepolia** |

3. 點擊 **Create app** 後，進入 App Dashboard → 點擊右上角 **API Key** 按鈕。
4. 複製 HTTPS 欄位的 URL：
   ```
   https://eth-sepolia.g.alchemy.com/v2/你的API_KEY
   ```

---

不論選哪一家，取得的 HTTPS URL 就是後端的 `APP_RPC_URL` 與前端的 `VITE_RPC_URL`。

### 領取測試網 ETH（水龍頭）

部署合約與發送交易都需要 Gas，測試網 ETH 可免費領取：

- **Alchemy Faucet**（推薦，每天 0.1 ETH）：[https://www.alchemy.com/faucets/ethereum-sepolia](https://www.alchemy.com/faucets/ethereum-sepolia)
- **Google Faucet**：搜尋「Sepolia faucet」，選擇需要連接社群帳號的水龍頭

> 平台 Operator 錢包與你的個人開發錢包都需要有測試網 ETH。

---

## 4. 平台 Operator 錢包準備

平台需要一個專用的「服務帳號」錢包，用於後端自動簽署 `assignWorker` 和 `approveTask` 交易。

### 建立 Operator 錢包

**方式一（推薦）：用 MetaMask 建立新帳號**

1. 開啟 MetaMask → 點右上角帳號圖示 → **Add account or hardware wallet**
2. 選擇 **Add a new account**，命名為 `Platform Operator`
3. 匯出私鑰：點擊帳號 → 三點選單 → **Account details** → **Show private key**
4. 輸入 MetaMask 密碼後複製私鑰（`0x` 開頭的 64 位 hex 字串）

**方式二：用程式產生**

```bash
# 用 Node.js 產生（需安裝 ethers）
node -e "const {ethers} = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('address:', w.address); console.log('privKey:', w.privateKey);"
```

### 為 Operator 錢包領取測試 ETH

將 Step 3 水龍頭的 ETH 領到 Operator 錢包地址，確保錢包有足夠 Gas 費用。

> **安全提醒：** Operator 錢包的私鑰只填入 `go-service/.env`，**不要在任何地方截圖或傳訊息**。

---

## 5. 合約部署（TaskRewardVault）

> **若已有合約地址（由其他組員部署），直接跳到 Section 6，填入地址即可。**

合約原始碼與部署腳本位於專案根目錄的 `task-reward-vault/`，使用 **Hardhat + viem** 框架。

### 5.1 合約目錄結構

```
task-reward-vault/
├── contracts/               # Solidity 合約原始碼
│   └── TaskRewardVault.sol
├── scripts/
│   └── deploy.ts            # Hardhat 部署腳本
├── hardhat.config.ts        # Hardhat 設定（讀取 .env 變數）
├── tsconfig.json
├── .env.example             # 環境變數範本 ✅
├── .env                     # 真實值（已在 .gitignore 排除）
└── package.json
```

### 5.2 建立 task-reward-vault/.env

```bash
cd task-reward-vault
cp .env.example .env
```

開啟 `.env` 填入以下三個欄位：

| 欄位 | 說明 |
| :--- | :--- |
| `SEPOLIA_RPC_URL` | Alchemy 或 Infura 的 HTTPS endpoint（同 go-service 的 `APP_RPC_URL`） |
| `SEPOLIA_PRIVATE_KEY` | 部署者私鑰（**不含 `0x` 前綴**，64 位 hex） |
| `TREASURY_ADDRESS` | 平台金庫錢包地址（同 go-service 的 `APP_PLATFORM_TREASURY_ADDRESS`） |

> **注意：** `SEPOLIA_PRIVATE_KEY` 格式不含 `0x` 前綴，與 go-service 的 `APP_PLATFORM_OPERATOR_PRIVATE_KEY`（含 `0x`）格式不同，填入時請注意。
> 部署者帳號自動成為合約的 operator，因此**建議使用與 `APP_PLATFORM_OPERATOR_PRIVATE_KEY` 同一把私鑰**（去掉 `0x` 後填入）。

### 5.3 安裝依賴並部署

```bash
cd task-reward-vault
npm install

# 部署至 Sepolia 測試網
npm run deploy:sepolia
```

部署成功後，終端機會輸出：

```
TaskRewardVault deployed: 0x合約地址
```

**記下這個地址**，填入：
- `go-service/.env` → `APP_REWARD_VAULT_ADDRESS`
- `react-service/.env` → `VITE_REWARD_VAULT_ADDRESS`

在區塊瀏覽器確認部署：`https://sepolia.etherscan.io/address/0x合約地址`

---

## 6. go-service 環境變數完整說明

`go-service/` 已附有 `.env.example` 範本，每個欄位都有注釋說明。Clone 後直接複製：

```bash
cd go-service
cp .env.example .env
```

然後用編輯器開啟 `.env`，**至少**填入以下欄位的真實值：

| 欄位 | 從哪裡取得 |
| :--- | :--- |
| `DB_PASS` | 與 `infra/.env` 的 `POSTGRES_PASSWORD` 一致 |
| `APP_RPC_URL` | Alchemy Dashboard → App → API Key（HTTPS） |
| `APP_REWARD_VAULT_ADDRESS` | 合約部署輸出的 `Deployed to: 0x...` |
| `APP_PLATFORM_TREASURY_ADDRESS` | 你的收款錢包地址 |
| `APP_PLATFORM_OPERATOR_PRIVATE_KEY` | Operator 錢包的私鑰（見 Section 4） |
| `APP_GOD_MODE_WALLET_ADDRESS` | 你的開發用錢包地址 |

### 各變數說明一覽

| 變數名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| `APP_CHAIN_ID` | 目標鏈的 Chain ID | `11155111` |
| `APP_RPC_URL` | Alchemy/Infura HTTPS endpoint | `https://eth-sepolia.g.alchemy.com/v2/abc123` |
| `APP_REWARD_VAULT_ADDRESS` | 部署完成的合約地址 | `0xABCD...1234` |
| `APP_PLATFORM_FEE_BPS` | 手續費基點（100 = 1%，500 = 5%） | `500` |
| `APP_PLATFORM_TREASURY_ADDRESS` | 收取手續費的錢包地址 | `0x你的地址` |
| `APP_PLATFORM_OPERATOR_PRIVATE_KEY` | **後端自動簽署用私鑰**（最高敏感度） | `0xabcdef...` |
| `APP_GOD_MODE_WALLET_ADDRESS` | 開發用超級權限錢包地址 | `0x你的地址` |
| `SIWE_CHAIN_ID` | SIWE 簽名要求的 Chain ID，需與 `APP_CHAIN_ID` 一致 | `11155111` |

---

## 7. react-service 環境變數完整說明

`react-service/` 已附有 `.env.example` 範本。Clone 後直接複製：

```bash
cd react-service
cp .env.example .env
```

然後填入以下欄位的真實值：

| 欄位 | 從哪裡取得 |
| :--- | :--- |
| `VITE_RPC_URL` | 與後端相同的 Alchemy URL（可選，留空使用公共 RPC） |
| `VITE_REWARD_VAULT_ADDRESS` | 與後端 `APP_REWARD_VAULT_ADDRESS` 完全相同 |

> **注意：** 前端環境變數必須以 `VITE_` 開頭，Vite 才會注入到 `import.meta.env`。**不要**把私鑰放在前端 `.env`，前端所有變數都是公開的（會被打包進 JS bundle）。

### 前後端變數對照表

| 功能 | 後端變數 | 前端變數 | 必須一致？ |
| :--- | :--- | :--- | :--- |
| Chain ID | `APP_CHAIN_ID` | `VITE_CHAIN_ID` | ✅ 必須 |
| RPC URL | `APP_RPC_URL` | `VITE_RPC_URL` | 可不同，但建議一致 |
| 合約地址 | `APP_REWARD_VAULT_ADDRESS` | `VITE_REWARD_VAULT_ADDRESS` | ✅ 必須 |

---

## 8. 資安重要事項

### 🔴 最高風險：私鑰（兩處）

本專案有兩個地方存放私鑰，控制同一把 Operator 錢包：

| 位置 | 變數名稱 | 格式 |
| :--- | :--- | :--- |
| `go-service/.env` | `APP_PLATFORM_OPERATOR_PRIVATE_KEY` | `0x` 開頭，64 位 hex |
| `task-reward-vault/.env` | `SEPOLIA_PRIVATE_KEY` | 不含 `0x`，64 位 hex |

兩者通常指向同一把私鑰（部署者 = operator），只是格式不同。任一外洩，Operator 錢包的控制權即喪失。

**規則：**

- ✅ 只填入各自的 `.env`（兩個目錄都已在 `.gitignore` 排除）
- ✅ 定期檢查 `git status`，確認 `.env` 沒有出現在 staged 清單
- ❌ **絕對不要** 在 Slack、Discord、GitHub Issues、PR 留言中貼出私鑰
- ❌ **絕對不要** `git add .`，養成指定檔案提交的習慣
- ❌ **絕對不要** 把私鑰 hardcode 進程式碼（即使是測試檔案）
- ❌ **絕對不要** 截圖私鑰後上傳到任何雲端服務

**如果私鑰外洩怎麼辦：**

1. 立即停止使用該錢包（所有資產都應視為已損失）
2. 建立新的 Operator 錢包，重新產生私鑰
3. 在合約上更換 Operator 地址（若合約有此功能）
4. 更新 `.env` 中的私鑰並重新部署後端

### 🟡 中風險：Alchemy API Key

`APP_RPC_URL` 中包含你的 Alchemy API Key。

**規則：**
- 同樣不可提交至 Git
- Alchemy 有 API Key 的速率限制；若 Key 外洩，可能被他人消耗你的 API 配額
- 若 Key 外洩：前往 Alchemy Dashboard → 重新產生 API Key

### 🟡 中風險：God Mode 錢包

`APP_GOD_MODE_WALLET_ADDRESS` 指定的錢包可以繞過所有業務邏輯強制更新任務狀態。

**規則：**
- 只用於開發除錯，**正式上線前必須設定為空或移除此功能**
- 不要將 God Mode 錢包同時作為個人常用錢包

### .gitignore 確認清單

確認以下檔案都在對應目錄的 `.gitignore` 中：

```
# go-service/.gitignore
.env

# react-service/.gitignore
.env
.env.local

# infra/.gitignore
.env
data/

# task-reward-vault/.gitignore
.env
artifacts/
cache/
node_modules/
```

**提交前必做的驗證：**

```bash
git status
# 確認輸出中沒有出現任何 .env 檔案
```

---

## 9. 環境驗證 SOP

完成上述所有設定後，依序執行以下驗證：

### Step 1 — 確認後端可連接 RPC

```bash
# 查看 go-service 容器啟動日誌
docker logs go-service --tail 20

# 正常情況：看到 Listening and serving HTTP on :8080
# 異常情況：failed to connect rpc 或 x509 certificate error
```

若出現 `x509: certificate signed by unknown authority`，代表 Docker 容器缺少 CA 憑證。確認 `go-service/Dockerfile` 中有以下內容：

```dockerfile
FROM debian:stable-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
```

### Step 2 — 確認合約地址正確

```bash
# 用 curl 呼叫任意 API，確認後端正常回應
curl http://localhost:8081/api/tasks
# 預期：{"success":true,"data":[...],"message":""}
```

### Step 3 — 確認前端可連上正確的鏈

1. 開啟 `http://localhost:5173`
2. 點擊 **Connect Wallet**，MetaMask 彈出後確認顯示的是 **Sepolia Testnet**
3. 若 MetaMask 顯示其他網路，在 MetaMask 中手動切換至 Sepolia

### Step 4 — 端對端流程驗證

執行一次完整的 Fund → Accept → Submit → Approve → Claim 流程（詳見[開發指南](./Onchain%20Task%20Tracker：v2%20公版開發指南.md) Section 4）。確認 `/logs`（History 頁面）有出現對應的 FUND、ASSIGN_WORKER、APPROVE_TASK、CLAIM_REWARD 紀錄。

---

## 10. 常見問題

| 問題現象 | 可能原因 | 解決方式 |
| :--- | :--- | :--- |
| `failed to connect rpc` | `APP_RPC_URL` 未設定或格式錯誤 | 確認 Alchemy URL 完整，包含 API Key |
| `x509: certificate` | Docker slim 映像缺 CA 憑證 | Dockerfile 加入 `apt-get install -y ca-certificates` |
| `APP_PLATFORM_OPERATOR_PRIVATE_KEY is required` | 私鑰未填入 `.env` | 填入 Operator 私鑰後重新 `docker compose up -d` |
| `transaction reverted` | 合約地址錯誤，或 Operator 不是合約的授權 Operator | 確認合約地址，並確認 Operator 錢包有被合約授權 |
| `insufficient funds for gas` | Operator 錢包 ETH 不足 | 到水龍頭領取 Sepolia ETH 到 Operator 地址 |
| `MetaMask: wrong network` | MetaMask 連的鏈與 `VITE_CHAIN_ID` 不符 | 在 MetaMask 手動切換至 Sepolia（Chain ID 11155111） |
| Fund 後 DB 未更新 | `POST /api/tasks/:id/onchain/funded` 呼叫失敗 | 開瀏覽器 console 查看錯誤，確認後端日誌 |
