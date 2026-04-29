# Gate 1B：角色能力守門與仲介名冊 — 設計文件

> 更新日期：2026-04-23  
> 上位準據：`docs/superpowers/specs/2026-04-22-platform-mainline-gate-roadmap-design.md`  
> 參照：`docs/superpowers/specs/2026-04-22-gate1-role-credential-activation-design.md` 第 2.3 節

---

## 1. 背景與目標

Gate 1A 完成後，平台擁有完整的角色憑證申請與啟用流程（OWNER / TENANT / AGENT）。  
Gate 1B 的目標是將這些已啟用角色的資料**實際反映在前端能力守門**，讓平台從「KYC 驗證 = 全部功能開放」切換到「對應角色啟用 = 對應能力解鎖」的正確模型。

同步新增仲介名冊（MVP 版），以公開已啟用 AGENT 憑證的用戶清單，建立平台最早期的信任展示介面。

---

## 2. 不做清單

- 後端新增 auth 或 KYC 端點的修改
- `agent_profiles` 表或 AGENT 專屬業務資料（Phase 2）
- 仲介評價、履歷、成交紀錄（Phase 2 / Gate 3）
- 後端角色守門（API 層攔截）——留給後續強化
- 任何 listing 之外的功能守門（如個人資料頁、設定頁）

---

## 3. 能力矩陣

| 使用者狀態 | 瀏覽房源列表 | 房源詳情 | 刊登房源 | 預約看房 | 仲介列表/詳情 |
|---|---|---|---|---|---|
| 未登入 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 已登入 / KYC 未完成 | ✅ | ❌ | ❌ | ❌ | ✅ |
| KYC VERIFIED（無角色） | ✅ | ❌ | ❌ | ❌ | ✅ |
| OWNER 已啟用 | ✅ | ✅ | ✅ | ❌ | ✅ |
| TENANT 已啟用 | ✅ | ✅ | ❌ | ✅ | ✅ |
| AGENT 已啟用 | ✅ | ✅ | ❌ | ❌ | ✅ |
| OWNER + TENANT 都啟用 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. 架構

### 4.1 整體設計原則

- **後端零改動**（仲介名冊的輕量後端模組除外）
- 角色資料來源：`GET /api/kyc/me` 回傳的 `credentials: string[]`，已是已啟用且未撤銷的角色清單，由 `user_credentials` 表讀出
- 前端守門採「wrapper 元件」模式，在 router 層包裹受保護頁面

### 4.2 新增單元

```
react-service/src/
  hooks/
    useIdentity.ts            ← 認證 + 角色狀態 hook
  components/common/
    RequireCredential.tsx     ← 路由層 guard 元件
  api/
    agentApi.ts               ← 仲介 API client
  pages/
    AgentListPage.tsx         ← /agents
    AgentDetailPage.tsx       ← /agents/:wallet

go-service/internal/modules/agent/
  dto.go
  service.go
  handler.go
```

---

## 5. 前端元件設計

### 5.1 `useIdentity.ts`

兩個連續 API 呼叫：

1. `getAuthMe()` → 確認登入狀態
2. 若已登入 → `getKYCStatus()` → 取得 `kycStatus` 與 `credentials[]`

回傳介面：

```typescript
interface IdentityState {
  loading: boolean
  authenticated: boolean
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | null
  activatedRoles: string[]
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
}
```

`getKYCStatus()` 是需要認證的端點。未登入時僅回傳 `{ authenticated: false, activatedRoles: [] }`，不發出 kyc 請求。

### 5.2 `RequireCredential.tsx`

Props：

```typescript
interface RequireCredentialProps {
  requiredRole?: "OWNER" | "TENANT" | "AGENT"   // 精確角色
  anyOf?: ("OWNER" | "TENANT" | "AGENT")[]       // 任一即可
  children: ReactNode
}
```

渲染邏輯（依序判斷）：

| 狀態 | 顯示 |
|---|---|
| `loading` | `<PageLoading />` |
| `!authenticated` | 「請先登入才能繼續」+ 登入按鈕 → `/login` |
| `kycStatus !== "VERIFIED"` | 「請先完成身份驗證」+ 前往驗證按鈕 → `/kyc` |
| 無符合角色 | 「此功能需要完成角色認證」+ 前往身份中心按鈕 → `/member` |
| 符合 | `{children}` |

使用方式（router/index.tsx）：

```tsx
{ path: "/listings/:id",
  element: <RequireCredential anyOf={["OWNER","TENANT","AGENT"]}><ListingDetailPage /></RequireCredential> }

{ path: "/listings/new",
  element: <RequireCredential requiredRole="OWNER"><ListingCreatePage /></RequireCredential> }
```

### 5.3 `ListingCreatePage` 調整

現有 `useEffect` 中的 `kycStatus === "VERIFIED"` gate 完全移除，改由 router 層的 `RequireCredential requiredRole="OWNER"` 負責守門。不留兩層邏輯。

### 5.4 `ListingDetailPage` 預約看房區塊

頁面已由 router 層守門（任一角色即可進入）。  
頁面內部呼叫 `useIdentity()`，使用 `hasRole("TENANT")` 決定是否渲染預約看房區塊。  
兩次 `/api/kyc/me` 呼叫為 MVP 已知行為，Gate 2 再考慮 context 優化。

### 5.5 Header 調整

- 新增「仲介列表」導覽連結 → `/agents`
- 「刊登房源」按鈕：由 `useIdentity()` 的 `hasRole("OWNER")` 控制是否顯示（原為 KYC 守門）

---

## 6. 後端仲介名冊模組

### 6.1 新路由（public，無 auth middleware）

```
GET /api/agents          ← 已啟用 AGENT 清單
GET /api/agents/:wallet  ← 單一仲介詳情
```

### 6.2 資料來源

查詢現有兩張表，無新 schema：

```sql
SELECT uc.id, u.wallet_address, u.display_name,
       uc.nft_token_id, uc.tx_hash, uc.verified_at
FROM user_credentials uc
JOIN users u ON u.id = uc.user_id
WHERE uc.credential_type = 'AGENT'
  AND uc.review_status = 'VERIFIED'
  AND uc.revoked_at IS NULL
ORDER BY uc.verified_at DESC
```

### 6.3 DTO

```go
type AgentListItem struct {
    WalletAddress string  `json:"walletAddress"`
    DisplayName   *string `json:"displayName,omitempty"`
    ActivatedAt   string  `json:"activatedAt"`
    NFTTokenID    int32   `json:"nftTokenId"`
}

type AgentDetailResponse struct {
    WalletAddress string  `json:"walletAddress"`
    DisplayName   *string `json:"displayName,omitempty"`
    ActivatedAt   string  `json:"activatedAt"`
    NFTTokenID    int32   `json:"nftTokenId"`
    TxHash        string  `json:"txHash"`
}
```

### 6.4 Repository 新增方法

在 `UserCredentialRepository` 新增：
- `FindAllAgents() ([]*AgentCredential, error)`
- `FindAgentByWallet(wallet string) (*AgentCredential, error)`

### 6.5 模組放置

`go-service/internal/modules/agent/` — 符合既有 layered architecture，為 Phase 2 `agent_profiles` 擴充預留正確位置。

---

## 7. 前端仲介頁面設計

### 7.1 `AgentListPage.tsx`（`/agents`）

- 使用 `SiteLayout`
- 呼叫 `getAgentList()`
- 每張卡片顯示：錢包地址（縮寫）、顯示名稱（若有）、啟用日期、NFT Token ID
- 空狀態：「目前尚無認證仲介」
- 正常 loading / error state

### 7.2 `AgentDetailPage.tsx`（`/agents/:wallet`）

- 使用 `SiteLayout`
- route param 為 wallet address
- 顯示：「鏈上認證仲介」badge、錢包地址、啟用時間、NFT Token ID、on-chain tx 連結
- 說明文字：「完整仲介主頁（服務區域、履歷、評價）將於後續版本開放」
- 404 處理：若 wallet 不存在或無 AGENT 憑證，顯示「找不到此仲介」

---

## 8. 受影響檔案清單

### 前端（react-service）

| 檔案 | 動作 |
|---|---|
| `src/hooks/useIdentity.ts` | 新增 |
| `src/components/common/RequireCredential.tsx` | 新增 |
| `src/api/agentApi.ts` | 新增 |
| `src/pages/AgentListPage.tsx` | 新增 |
| `src/pages/AgentDetailPage.tsx` | 新增 |
| `src/router/index.tsx` | 修改：加路由、加 guard 包裹 |
| `src/components/common/Header.tsx` | 修改：加仲介列表連結、OWNER 守門 |
| `src/pages/ListingCreatePage.tsx` | 修改：移除舊 KYC gate useEffect |
| `src/pages/ListingDetailPage.tsx` | 修改：加預約區塊 TENANT 守門 |

### 後端（go-service）

| 檔案 | 動作 |
|---|---|
| `internal/modules/agent/dto.go` | 新增 |
| `internal/modules/agent/service.go` | 新增 |
| `internal/modules/agent/handler.go` | 新增 |
| `internal/db/repository/user_credential_repo.go` | 修改：新增 FindAllAgents, FindAgentByWallet |
| `internal/router/router.go` | 修改：註冊 /api/agents 路由 |
| `cmd/server/main.go` | 修改：wire agent handler |

---

## 9. 錯誤處理

- 仲介列表 API 失敗 → 顯示錯誤訊息，不 crash
- `getAgentDetail` 404 → AgentDetailPage 顯示「找不到此仲介」提示
- `RequireCredential` 中 API 失敗 → 視為未登入，顯示登入 fallback
- `useIdentity` 的 `getKYCStatus` 失敗 → `activatedRoles` 維持空陣列，不拋出未捕獲例外

---

## 10. 後續 Phase 擴充點

- Gate 2：仲介詳情頁補 `agent_profiles` 資料（品牌、執照、服務區域）
- Gate 3：Agent 專屬能力守門（委託管理等進階功能）
- 後端 API 層守門強化（目前只有前端守門）
- `useIdentity` context 優化（避免同頁多次呼叫）
