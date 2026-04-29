# 可信房屋媒合平台主幹 Gate Roadmap Design

> 文件類型：活文件 / 上位治理規格  
> 更新日期：2026-04-22  
> 適用範圍：平台主體中程路線，從目前 repo 基線一路規劃到 `property / agency / case / stake` 正式鏈上化  
> 適用團隊：單一核心團隊，必要時平行，但所有 Gate 皆必須完成串接驗收後才能進入下一 Gate

---

## 1. 文件定位

本文件不是一次性簡報，也不是單次 sprint 任務單。

本文件是平台主體開發的正式上位治理基線，用來回答以下問題：

- 目前平台正式主線在哪裡，哪些能力已完成、哪些仍屬半完成或保留路線
- 下一個可以開工的 Gate 是什麼，開工前必須滿足哪些條件
- 每個 Gate 的正式交付物、驗收標準、風險與例外處理是什麼
- 哪些能力是主幹主線，哪些只是支援軌或未來保留路線

本文件不能取代每個 Gate 的細部 spec 與 implementation plan，但所有後續 spec、implementation plan、實作與驗收都必須服從本文件定義的 Gate 順序與邊界。

---

## 2. Roadmap 使用規則

### 2.1 使用目的

每次準備開工時，團隊必須先對照本文件確認：

1. 當前正在進行哪一個 Gate
2. 這個 Gate 的開工條件是否已滿足
3. 本次工作是否屬於該 Gate 的正式範圍
4. 是否誤把支援軌或未來保留路線寫成主線
5. 本次完成後應提供哪些驗收證據

### 2.2 四段式開工治理

每一個 Gate 都必須走完以下四段式：

1. `Spec`
2. `Implementation Plan`
3. `Implementation`
4. `Verification`

未完成當前 Gate 驗收前，不得把下一個 Gate 描述成正式進行中的主線。

### 2.3 Gate 模板

本文件中的每一個 Gate 都固定包含以下欄位：

- `目標`
- `範圍`
- `明確不做`
- `依賴`
- `開工條件`
- `交付物`
- `驗收條件`
- `主要風險`
- `例外處理`
- `下一 Gate 入口`

### 2.4 驗收標準

每個 Gate 的正式驗收一律以三層證據為準：

1. `Spec evidence`
   文件、架構決策、欄位與事件定義、流程圖、Gate 更新紀錄
2. `Implementation evidence`
   migration、合約、Go API、indexer、React 頁面、環境變數、router、read model
3. `Verification evidence`
   測試、CI、Sepolia 實際交易或事件證據、DB read model 對照、必要 UI 驗收紀錄

### 2.5 例外處理邊界

平台採自動化優先治理。人工介入只允許存在於：

- `dispute`
- `emergency`
- `compliance exception`

前端可以保留「申報給客服 / 發起 dispute」入口，但該入口只屬於例外處理機制，不可成為主流程 fallback。

---

## 3. 核心決策摘要

本文件採用以下已確認決策：

- Roadmap 形式採 `主幹 Gate Roadmap`
- 文件形式採 `活文件`
- 主線優先採 `租屋主線`
- 買賣路線保留為每個 Gate 的架構預留與後續前置條件，不作為目前主幹正式需求
- 中程主幹順序採 `Property -> Agency -> Case -> Stake`
- Gate 驗收以 `Sepolia / testnet 可驗收` 為正式標準
- 平台採 `自動化優先`，人工只留極少數例外入口
- `OWNER 自營` 與 `OWNER -> AGENT 授權` 兩條路線並存，且 `OWNER 自營` 不可被仲介授權主線吃掉
- `WebSocket / notify / TWID / AI 審核` 屬支援軌，不阻塞主幹 Gate
- 每個 Gate 都必須走 `spec -> implementation plan -> implementation -> verification`
- 暫不把 git / branch 策略寫進本文件，避免把平台主體 Roadmap 提前綁到交付管理策略

---

## 4. 架構原則

### 4.1 真相來源原則

- 鏈上合約與 events 是鏈上狀態的最終真相來源
- PostgreSQL 是 read model、查詢快取、文件中繼層與部分尚未 fully on-chain 的 workflow 容器
- 前端不可信任「交易已送出」本身；對外展示的正式狀態以 Go service 回讀的資料與鏈上事件為準

### 4.2 開發順序原則

所有主幹 Gate 都必須遵守以下順序：

1. DB schema / read model
2. 合約函式與事件介面
3. Go service / indexer / signer / sync
4. React API 與頁面整合

### 4.3 最小上鏈原則

鏈上只承擔以下內容：

- 必須具備治理效力的狀態
- 必須具備不可否認性的授權與責任邊界
- 必須可被機械判定的條件與結果

複雜文件、商務條款全文、附件、影像與補充說明原則上保留在鏈下 DB / storage，透過 hash 與 snapshot 形成可驗證對照。

### 4.4 分層責任原則

- `listing` 負責供給展示與市場可見性
- `property` 負責物件真實性與物件主體
- `agency` 負責 owner-first 授權與撤銷治理
- `case` 負責媒合後責任、交易進度與糾紛狀態
- `stake` 負責市場治理中的承諾成本、釋放與處罰

---

## 5. Gate 地圖總覽

### 5.1 Gate 地圖

| Gate | 名稱 | 核心目標 | 是否主幹阻塞點 |
|------|------|----------|----------------|
| Gate 0 | 基線收斂 | 把目前 repo 收斂成可持續開工的正式基線 | 是 |
| Gate 1 | 身分與角色閉環 | 完成 NATURAL_PERSON 之上的 OWNER / TENANT / AGENT 憑證閉環 | 是 |
| Gate 2 | Property On-chain | 建立鏈上物件主體與可驗證揭露/驗證流程 | 是 |
| Gate 3 | Agency On-chain | 建立 owner-first 授權、條款、撤銷與 mutual consent 鎖定治理 | 是 |
| Gate 4 | Case On-chain | 建立正式鏈上案件主線與前後台 read model 串接 | 是 |
| Gate 5 | Stake 正式上鏈 | 將市場承諾成本正式導入刊登與檢舉治理 | 是 |
| Gate 6 | Production Readiness 前置 | 列出 production-ready 之前置條件，不作為目前中程主線開發目標 | 否 |

### 5.2 支援軌

以下能力不作為主幹 Gate 的阻塞條件，但可在適當 Gate 內列為附屬交付或 future track：

- WebSocket / 即時通知
- 更完整 notify 體驗
- TWID / 第三方 KYC provider
- AI 輔助 property 審核
- production deployment hardening

---

## 6. Gate 0：目前 Repo 基線盤點

### 6.1 Gate 0 目標

把目前 repo 中已完成、半完成、漂移、殘留與假資料路徑整理成正式基線，讓後續每個 Gate 的開工都建立在一致的 live reality 上，而不是建立在互相矛盾的文件與舊模板殘留之上。

### 6.2 Gate 0 範圍

- 確認目前 live 主線
- 確認第二階段已完成與未完成部分
- 確認文件與實作漂移
- 確認 router、placeholder、命名殘留與 DB spec 漂移
- 確認合約、Go、React、CI 的實際現況

### 6.3 Gate 0 基線結論

#### 已完成主線

- 自建 eKYC onboarding 主線已成形
- `person_hash + wallet SIWE + password` 登入已成形
- `IdentityNFT` 自然人憑證流程已接上
- `/member` 與 `/profile` 已可作為正式身份中心與會員資料頁基底
- `listings` 與 `listing_appointments` 已形成租屋導向的 DB workflow 骨架
- GitHub Actions 已有 Go / Frontend / Contracts / Security 四條主 workflow

#### 半完成主線

- `OWNER / TENANT / AGENT` 角色憑證底座已存在，但 `/credential/*` 路由、申請 API、審核閉環、`CredentialMinted` indexer 尚未成形
- `IdentityCenterPage` 已出現角色申請入口，但前端 router 尚未正式接上對應頁面

#### 主要漂移

- DB 規格文件仍保留 `tasks` 舊主幹敘述，與目前 `listings` 正式骨架不一致
- 前端仍有舊 `task` 型別與命名別名殘留
- 部分 config / 文案仍殘留 `On-chain Task Tracker` 模板命名
- 前端存在 `DEV placeholder` 與未接路由，例如 `/listings/new`

#### 已知驗證現況

- 本地 `go test ./...` 可通過，但目前幾乎沒有有效測試檔
- 本地 `react-service` 的 `npm run lint`、`npm run build` 可通過
- `task-reward-vault` compile 目前需額外確認 compiler cache / tool lock 問題，不可直接假設合約驗證流程已穩定

### 6.4 Gate 0 主要風險

- 文件與實作漂移會污染後續 Gate 定義
- 舊模板殘留會讓團隊誤判哪些能力仍屬正式主線
- 假資料 fallback 會讓 UI 看似完成、實際流程卻未閉環
- 缺少有效自動測試，後續每個 Gate 的整合風險偏高

### 6.5 Gate 0 驗收條件

- 主要架構文件與 live flow 敘述一致
- `task` 舊骨架不再被誤認為正式主線
- 未接 router、假資料 fallback、命名漂移有正式清單與處理策略
- 後續 Gate 開工時可直接引用本基線，不需重新做一次專案真實性盤點

### 6.6 Gate 0 下一 Gate 入口

只有在「目前 repo 正式主線與風險邊界已被文件化且共識化」後，才能進入 Gate 1。

---

## 7. Gate 1：身分與角色閉環

### 7.1 目標

完成 NATURAL_PERSON 之上的 `OWNER / TENANT / AGENT` 角色憑證申請、審核、mint、indexer、顯示與能力解鎖閉環，讓平台正式從「自然人通行」升級到「角色化市場參與」。

### 7.2 範圍

- `/credential/*` 路由與申請入口
- OWNER / TENANT / AGENT 申請 API
- 必要審核流程與狀態回寫
- `IdentityNFT.mintCredential()` 正式接線
- `CredentialMinted` 事件同步與 read model 回寫
- IdentityCenterPage 與 profile 顯示角色狀態
- 角色對應功能能力邊界

### 7.3 明確不做

- Property 註冊
- Agency 授權
- CaseTracker 正式接線
- Stake 主流程
- 完整仲介商務管理後台

### 7.4 依賴

- Gate 0 完成
- NATURAL_PERSON / KYC 主線穩定

### 7.5 開工條件

- `user_credentials` schema 與 repository 能支撐正式讀寫
- IdentityNFT tokenId 2 / 3 / 4 語意固定
- 前後端對角色申請、審核、憑證顯示的資料模型一致

### 7.6 交付物

- 角色申請頁面與 router
- 角色申請 / 查詢 / 審核 API
- 合約呼叫與 indexer worker
- DB read model 更新
- 身份中心顯示與能力解鎖邏輯
- 文件與驗收紀錄

### 7.7 驗收條件

- 使用者可在 Sepolia 上完成角色憑證閉環
- 角色狀態在前端、API、DB read model、鏈上事件之間一致
- 身份中心可正確顯示 NATURAL_PERSON 與次角色憑證
- 不得再把角色申請描述為「已有 UI 草圖但未接線」

### 7.8 主要風險

- 角色申請只完成 UI 或只完成 DB，未形成閉環
- `CredentialMinted` 未接 indexer，造成鏈上與 read model 脫節
- 身份中心把未驗證角色當成正式能力開放

### 7.9 例外處理

- dispute / emergency / compliance exception

### 7.10 下一 Gate 入口

只有在角色與能力邊界已正式閉環後，才能進 Gate 2 做物件主體鏈上化。

---

## 8. Gate 2：Property On-chain

### 8.1 目標

建立平台中的正式物件主體，讓房屋不再只是 DB 中的一筆房源資料，而是擁有鏈上 `propertyId`、揭露 hash、owner verification 與驗證狀態的可驗證資產單位。

### 8.2 範圍

- `PropertyRegistry` 正式接線
- 一個 property 對應一個鏈上 `propertyId`
- 以 `deed_hash` 作為唯一性綁定
- 支援多 owner + share bps + primary operator，但不做多簽
- `registerProperty -> owner verify -> disclosure complete -> verifyProperty` 閉環
- DB / storage 保留完整 property snapshot、揭露內容、文件與對應 hash
- listing 與 property 建立正式對應關係

### 8.3 明確不做

- 不做共同持有人多簽
- 不做完整自動 AI 審核取代
- 不做 property marketplace 全功能頁面

### 8.4 依賴

- Gate 1 完成
- OWNER 角色正式可用

### 8.5 開工條件

- property 的 DB / read model 與 hash 策略已定義
- disclosure snapshot 資料結構與 hash 生成方式已固定
- property / listing 的關係模型已寫清楚

### 8.6 交付物

- PropertyRegistry 接線
- property schema / read model
- property API
- disclosure snapshot / hash 流程
- property 驗證同步與 UI 顯示
- listing 與 property 的正式映射規則

### 8.7 驗收條件

- Sepolia 上可完成 property 註冊、揭露、驗證閉環
- `deed_hash` 唯一性與 `propertyId` 對應成立
- property 驗證是 listing 進入正式可交易市場的前置條件
- DB / storage 可回推出完整揭露資料與其對應 hash

### 8.8 主要風險

- property 只是鏈上佔位，未真正成為市場主體
- listing 與 property 關係模糊，導致後續 agency / case 不穩
- disclosure hash 已上鏈，但鏈下對應內容不完整或不可追溯

### 8.9 例外處理

- dispute / emergency / compliance exception

### 8.10 下一 Gate 入口

只有當 property 已成為正式物件主體後，才能進入 owner-first 授權治理。

---

## 9. Gate 3：Agency On-chain

### 9.1 目標

建立 owner-first 授權治理，讓 `OWNER 自營` 與 `OWNER -> AGENT 授權` 並存，但所有仲介權限都必須來自可驗證的屋主授權，而不是平台假定或線下模糊約定。

### 9.2 範圍

- `AgencyRegistry` 正式接線
- `OWNER 自營` 與 `OWNER -> AGENT` 並存
- 授權主線採最小上鏈原則，只記錄：
  - `serviceFeeRate`
  - `mandateDuration`
  - `penaltyAmount`
- 完整商務條款與附件保留在 DB / storage，以 snapshot / hash 對應完整內容
- `grantAuthorization / revokeAuthorization / lockForMutualConsent / revokeWithConsent` 正式治理

### 9.3 明確不做

- 不把複雜商務條款全文直接塞進鏈上主介面
- 不把所有房源都強制走仲介授權
- 不做完整仲介 CRM / 經營後台

### 9.4 依賴

- Gate 2 完成
- property 與 owner 身分已正式成立
- AGENT 角色已正式成立

### 9.5 開工條件

- 授權 snapshot / hash 策略已固定
- OWNER 自營與 AGENT 授權的產品邏輯邊界已寫清楚
- mutual consent 觸發條件已與 Gate 4 case 設計協調

### 9.6 交付物

- AgencyRegistry 接線
- 授權 API、DB read model、前端頁面
- 授權條款最小上鏈與完整鏈下快照
- mutual consent 鎖定與撤銷治理

### 9.7 驗收條件

- 屋主可自營，不需經過仲介
- 屋主授權仲介時，Sepolia 上可產生正式授權記錄
- 授權撤銷規則與 mutual consent 鎖定可被正確驗證
- 鏈上最小條款與鏈下完整條款可互相對應

### 9.8 主要風險

- 把仲介授權做成唯一主線，侵蝕 owner-first
- 條款過度上鏈，造成後續治理與產品複雜度過高
- mutual consent 條件與 case 邊界不一致

### 9.9 例外處理

- dispute / emergency / compliance exception

### 9.10 下一 Gate 入口

只有當 owner-first 授權治理穩定成立後，才能進入正式鏈上案件主線。

---

## 10. Gate 4：Case On-chain

### 10.1 目標

建立平台中的正式案件主體，讓媒合後責任、交易進度、糾紛與仲介引入足跡不再只是 DB workflow，而是進入 `CaseTracker` 的正式治理範圍。

### 10.2 範圍

- `CaseTracker` 正式接線
- 租屋 case 狀態機採：
  - `OPEN -> MATCHED -> SIGN -> CLOSED`
  - 另有 `CANCELLED / DISPUTED`
- listing 與 case 責任切分：
  - listing 保持供給展示與市場可見狀態
  - case 承擔媒合後責任與交易進度
- `openCase()` 的正式時點定為進入 `MATCHED`
- 在 `OPEN -> MATCHED` 期間，建立正式 `pre-match trace / audit trail`

### 10.3 Pre-match Trace 原則

`OPEN -> MATCHED` 期間的預約、帶看、關鍵互動、仲介引入足跡不能被視為雜訊，也不應完全放任只作一般 CRUD。

本文件要求：

- 此階段必須有正式 audit trail
- audit trail 必須可追溯、不可任意覆寫、可形成 snapshot / hash
- 但此階段不強制每一筆互動都立刻成為鏈上 case event

換言之：

- `MATCHED` 才正式開 case
- `MATCHED` 前的關鍵互動必須被正式治理
- 進入 case 時，至少要能把前段關鍵足跡摘要與 `introducedByAgent` 一起關聯到 case

### 10.4 明確不做

- 不把所有詢問、預約、普通瀏覽事件都直接變成鏈上案件
- 不把 listing 狀態機完全替換成 case 狀態機
- 不在此 Gate 正式導入完整 stake 治理

### 10.5 依賴

- Gate 3 完成
- property / agency 主體已穩定

### 10.6 開工條件

- case 與 listing / property / agency 關聯模型已定義
- pre-match trace 的 read model 與 hash 策略已固定
- MATCHED 觸發條件已與產品語意一致

### 10.7 交付物

- CaseTracker 接線
- case schema / read model / indexer
- pre-match trace / audit trail
- MATCHED 開 case 與後續 state transition
- dispute 入口與客服例外處理接點

### 10.8 驗收條件

- Sepolia 上可完成租屋 case 的正式開啟、推進、關閉
- MATCHED 時可正確建立 case
- introducedByAgent 與 pre-match trace 可被追溯
- listing 與 case 的責任切分在 UI、API、DB、鏈上狀態之間一致

### 10.9 主要風險

- 過早把所有互動上鏈，導致成本、噪音與隱私問題
- 過晚引入 case，導致鏈上無法承擔責任追蹤
- listing 與 case 語義繼續混在一起

### 10.10 例外處理

- dispute / emergency / compliance exception

### 10.11 下一 Gate 入口

只有當 case 已成為正式責任主體後，才適合把 stake 作為市場治理工具正式壓上主線。

---

## 11. Gate 5：Stake 正式上鏈

### 11.1 目標

將平台的市場治理從「只有可追溯狀態」提升到「有承諾成本與處罰機制」，但第一版只做必要且公平的 stake，避免在 adoption 初期過度提高市場摩擦。

### 11.2 範圍

- `ListingStakeVault` 正式接線
- 第一版 stake 主體採：
  - `刊登方 stake`
  - `檢舉 stake`
  - 一般租客不強制 stake
- 第一版資產型別要求：
  - `ETH + USDC + USDT`
- 第一版 slash 範圍採極少數可機械判定情境

### 11.3 明確不做

- 不把一般租客一開始全面納入強制 stake
- 不把所有爭議情境都做成複雜 slash 邏輯
- 不把 stake 提早壓到 property / agency / case 之前

### 11.4 依賴

- Gate 4 完成
- case 與責任邊界已穩定

### 11.5 開工條件

- stake 與 listing / case / dispute 的關聯條件明確
- 支援 ETH / USDC / USDT 的資產流與驗收方式已固定
- 哪些情境會 release、哪些情境會 slash 已有明確清單

### 11.6 交付物

- ListingStakeVault 接線
- stake read model
- 前端 stake / release / slash /檢舉介面
- Go service 與 chain sync
- 支援 ETH / USDC / USDT 的驗收流程

### 11.7 第一版治理建議

第一版 slash 僅允許極少數可機械判定情境，例如：

- 假物件成立
- 惡意檢舉成立與不成立的對應處理
- 違規取消或逾期未完成必要動作

其餘複雜爭議不在第一版 stake 核心流程內展開。

### 11.8 驗收條件

- Sepolia 上可驗證 `ETH + USDC + USDT` stake 能力
- 刊登方 stake 閉環成立
- 檢舉 stake 閉環成立
- release / slash 的條件與證據可被追溯
- 一般租客不因 stake 被全面阻擋於主流程之外

### 11.9 主要風險

- 過早把租客全面 stake 化，破壞 adoption
- slash 條件過寬，讓治理失去可預期性
- 僅做 ETH，忽略穩定幣主流方向

### 11.10 例外處理

- dispute / emergency / compliance exception

### 11.11 下一 Gate 入口

Gate 5 完成後，平台主幹主線已完成中程正式鏈上化骨架，可進入 production-readiness 前置盤點。

---

## 12. Gate 6：Production Readiness 前置

### 12.1 目標

本 Gate 不直接要求 production 上線，而是列出從 `Sepolia gate-ready` 走向 `production-ready` 必須補完的前置條件，避免團隊把測試網成功誤認為正式上線能力。

### 12.2 範圍

- 安全與密鑰管理強化
- production RPC / infra / monitoring
- 災難復原與 emergency procedure
- 合規與客服流程前置
- 更嚴格的測試與 release checklist

### 12.3 明確不做

- 本 Gate 不作為目前主幹主線的必做開發目標
- 不要求在本文件周期內完成 production launch

### 12.4 交付物

- production readiness checklist
- 安全與營運風險盤點
- release prerequisites

### 12.5 驗收條件

- 團隊可清楚區分 `testnet-ready` 與 `production-ready`
- production 前置清單完整且可追蹤

---

## 13. 支援軌與保留路線

### 13.1 支援軌

以下能力可在適當 Gate 中併行，但不得阻塞主幹 Gate 驗收：

- WebSocket / 即時通知
- Notify / push enhancement
- 更完整的 UI 體驗優化
- AI 審核輔助

### 13.2 保留路線

以下能力保留在中長期設計，不進入當前主幹主線：

- TWID / 第三方 KYC provider 正式接線
- 買賣主線完整案件與銀行流程實作
- production-ready 完整上線工程

---

## 14. 風險治理規則

### 14.1 不允許的開發方式

- 為了趕 UI 先做假流程，再期待後面補真實主線
- 在文件中把未來 phase 描述成目前 live flow
- 讓支援軌反過來阻塞主幹 Gate
- 在未完成前一 Gate 驗收前，提前開做下一 Gate 的核心閉環

### 14.2 必須持續追蹤的風險

- 文件與實作漂移
- 舊模板與命名殘留
- 前端 placeholder 導致的假完成感
- 鏈上與 DB read model 不一致
- 缺少有效自動測試造成的整合風險

### 14.3 決策變更紀錄

若後續 Gate 實作過程中需要改變本文件既有決策，必須：

1. 明確記錄變更原因
2. 指出被影響的 Gate
3. 說明是否影響既有驗收標準
4. 更新本文件，不得只靠口頭說明

---

## 15. 活文件更新規則

每完成一個 Gate，本文件都必須至少更新以下項目：

- `目前完成到哪一個 Gate`
- `目前仍存在的主要風險`
- `哪些決策被保留`
- `哪些決策被修正`
- `下一 Gate 的開工條件是否已滿足`

若任一 Gate 在實作中發現：

- 架構邊界與原規格不符
- 驗收條件無法落地
- 風險評估明顯變化

則必須先更新本文件，再繼續推進。

---

## 16. 後續使用方式

本文件完成後，後續正式流程如下：

1. 選定目前要開工的 Gate
2. 依本文件撰寫該 Gate 的獨立 spec
3. 依該 spec 撰寫 implementation plan
4. 進入實作與驗收
5. Gate 驗收通過後，回寫本活文件

本文件是主幹治理基線，不是執行細單。  
執行細節一律在後續 Gate spec 與 implementation plan 中展開。
