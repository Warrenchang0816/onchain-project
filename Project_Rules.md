# onchain-project（可信房屋媒合平台）Project Rules

> 本文件為專案級治理依據，引用 `D:\Git\Agent-Project-Constitution` 全套憲法，並與 `CLAUDE.md`、使用者 memory 規則疊加。三者衝突時，**使用者明確指示 > CLAUDE.md > 本憲法 > 系統預設**。
> 建立紀錄見 `dev_log/2026-06-09.md`。

## 專案定位

可信房屋媒合平台（Phase 6），由 onchain-task-tracker 公版演進。核心策略：**以信義房屋為基準層，Web3 / AI 疊加其上**；所有設計先問「信義房屋怎麼做」。技術棧：Go (Gin + PostgreSQL，無 ORM) REST API + React 19 SPA + Web3 (viem/wagmi、task-reward-vault Hardhat 合約) + eKYC (AWS Rekognition / faceai)。

## 必讀來源（Source of Truth 順位）

1. 本文件 `Project_Rules.md`。
2. 最新 `dev_log/YYYY-MM-DD.md`。
3. 主要架構書與規格書：`docs/第六階段架構定稿：可信房屋媒合平台.md`、`docs/架構設計書.md`、`docs/開發規劃書.md`、`docs/refs/pahse6/*`。
4. 目前有效的 Superpowers specs/plans：`docs/superpowers/specs/`、`docs/superpowers/plans/`。
5. 程式碼、測試、設定檔、migration。
6. 外部官方文件與 release note。

不建立「補充規格」取代正式文件；討論結論必須同步回正式文件與 dev_log；舊方向標 legacy 或封存，不留誤導性舊名。

## 語言

預設繁體中文，不用簡體。專有名詞、API、class/method/field/enum/endpoint、命令、環境變數、錯誤訊息、官方引用保留原文。文件要支援開發、保留決策背景與取捨，不寫漂亮摘要。

## Hermes-first（DORMANT — 本專案目前不適用）

經 2026-06-09 首份 Hermes capability audit 評估：本專案無 LLM-agent runtime、未導入 Hermes、非在打造 agent 框架，故 Hermes-first **不作為現階段審核閘門**。

**重新啟用條件**：若日後新增 AI-agent 層（自動媒合/協商 agent、多 provider LLM proxy、agent 任務板等），須重跑 Hermes capability audit，先檢查 Hermes 官方能力，再決定設定 / 擴充 / 自建，且自建不得複製 Hermes runtime。

## 資料架構

每類資料維護一張**底層主表**（最廣泛共通資料），特殊/關聯資料才另拆；禁止同類資料分散多表互不相通。範例：`tenant_profiles` 為租客唯一主表，`credential_submissions` 維持三角色共用的憑證申請/啟用/稽核關聯職責。

## 後端架構（go-service）

嚴格分層 `router → handler → service → repository → PostgreSQL`，單向相依。保持 raw SQL，**不引入 ORM**。新增 resource 依序建立 model → dto → repository → service → handler → router → main 接線。

## 前端約束（react-service）

樣式全寫 `src/index.css`（無 per-component CSS）；用 fetch（不引入 axios）；只用 useState（不引入 Zustand/Redux 等狀態管理）。所有按鈕/元件必須加明確 `bg-*` 類別，避免 Edge 深色模式變黑底。

## Git 與 Worktree

- `main` 為穩定分支，**禁止直接 commit main**；所有功能走 `feature branch → PR → merge`，命名 `feat/<feature>` 或 `feat/<name>/<feature>`。
- **未經使用者明確要求不 commit**；**不可自動建立 worktree 或 branch**，須先詢問確認。
- 只 stage 指定檔案，**永不 `git add .`**（避免誤 commit `.env`）。
- 不 revert 使用者變更；不執行 destructive command（`git reset --hard`、未確認的遞迴刪除）。
- commit 前檢查 `git status` 與 diff、跑驗證、更新 dev_log、同步 specs/plans；commit message 格式 `feat: 新增 xxx 功能`，描述行為/治理改變。
- 發現同檔案已有非自己變更時，先讀懂再整合，不自行覆蓋。

## 安全與 Secrets

API key / token / cookie / session / 密碼 / 私鑰不得寫入 repo、文件、dev_log、聊天紀錄或測試輸出。`.env` 必須被 `.gitignore` 忽略。高風險操作（刪改資料、動 production、大量 LLM token 花費、改 auth/provider/proxy/secret）須取得人類確認。

## 指示確認與 Timeout

對使用者指示、範圍、檔案落點或風險有任何不確定時，**先停止並確認**，不憑記憶或猜測繼續。所有可能長時間執行的命令、測試、build、server、agent 任務或外部整合呼叫**必須設定明確 timeout**；無法設定時先告知風險並取得確認。

## 驗證與完成宣稱

完成宣稱前必須執行本回合最新、與變更範圍相符的驗證（test / build / lint / smoke），讀完整輸出與 exit code，只宣稱有證據支持的狀態。驗證若因 timeout、缺依賴或權限無法完成，明確回報原因與剩餘風險。**沒有新鮮驗證證據，不宣稱完成。**

## dev_log

每個功能完成後更新 `dev_log/YYYY-MM-DD.md`，記錄：討論主題、決策結論、影響文件/程式碼、未採納方向與原因、待確認風險、驗證方式與結果。要讓下一個 agent 理解「為什麼這樣做」，而非只知「做了什麼」。必記事件：專案定位改變、Hermes 能力審核結果、provider/RAG/skill 變更、架構書/規格書/本規則的重要改動、使用者明確訂下的開發規則。

## 交付回報格式

每次完成任務後用**繁體中文總結**：更新了什麼、多了什麼功能、可以怎麼驗證。

## Superpowers Skills

設計新功能 / 規劃 / 寫 plan / 執行 plan / 除錯 / 實作前(TDD) / 宣稱完成前 / 整合分支 / 收 code review 前，先檢查並呼叫對應 `superpowers:*` skill。有 1% 機率適用就先呼叫。
