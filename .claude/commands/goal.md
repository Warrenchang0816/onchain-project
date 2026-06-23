---
description: 讀取租屋媒合主線收斂的 goal 錨點，回報進度並接續執行下一個未完成階段
---

# /goal — 目標錨點執行器

你被呼叫來推進「租屋媒合主線收斂」這條主線。**嚴格依下列步驟，不可跳過治理。**

## 參數

`$ARGUMENTS` 可為：
- 空：從目前指針接續下一個未完成的目標事項。
- `status`：只回報進度，不動程式碼。
- `S1` / `S2` / `S3` / `S4`：指定要推進的階段。

## 步驟

1. **讀治理與錨點**（先讀，不可憑記憶）：
   - `docs/superpowers/goals/2026-06-09-rental-matching-mainline-consolidation.md`（goal 錨點 = 本次唯一進度真相）
   - `Project_Rules.md`（治理規則）
   - 最新 `dev_log/YYYY-MM-DD.md`
   - 若該階段需求不明，回讀 `docs/開發規劃書.md`、`docs/第六階段架構定稿：可信房屋媒合平台.md`

2. **回報定位**：用繁體中文說明目前在哪個階段、哪些目標事項已完成/未完成、接下來要做哪一個。若參數是 `status`，到此停止。

3. **底層 Table 治理閘門**（最高約束）：若接下來的工作會碰 DB，先執行錨點「🧱 底層 Table 治理」檢查 —— 盤點現有 base table、同類資料複用同一張、優先 query 不亂建表。決策（複用/擴欄/新建）寫進該階段 spec 並同步 `docs/database/relational-database-spec.*`。違反就停下來問使用者。

4. **開工前置（依 Project_Rules 與 Superpowers）**：
   - **先問使用者**是否要開 feature branch（禁止自動建 branch / worktree、禁止直接 commit main）。
   - 動手前呼叫對應 skill：先 `superpowers:brainstorming`（若該階段設計未定）→ `superpowers:writing-plans` 寫該階段實作計畫 → `superpowers:test-driven-development` 實作。

5b. **Timeout 機制（強制，依憲法）**：每一個可能長時間執行的指令都必須帶明確 timeout，不可無界等待。基準值：
   - `go test ./...` / `go build ./...` / `go vet`：`timeout` 300000ms（5 分）
   - `npm run lint` / `npm run build` / `npm ci`：`timeout` 300000ms（5 分）
   - `docker compose up --build`：`timeout` 600000ms（10 分，上限）
   - dev server、`docker compose up -d` 等持續執行者：用 `run_in_background`，不要前景阻塞
   - 任何外部整合呼叫（RPC / 第三方 API）：設明確 timeout 並有失敗路徑
   - 若某指令無法設定 timeout，先告知使用者風險並取得確認再執行
   - 指令逾時即視為失敗：停下、回報原因與剩餘風險，不假設已成功、不在 sleep 迴圈裡盲目重試

5. **執行該階段的「目標事項」**，逐項完成。

6. **跑該階段的「驗證事項」**：執行對應 `go test` / `npm run lint` / `npm run build` / 手動端到端，讀完整輸出與 exit code。**沒有新鮮驗證證據，不宣稱完成**（`superpowers:verification-before-completion`）。

7. **更新狀態**：
   - 在錨點檔勾選完成的目標/驗證事項、更新「進度快照」表與「目前指針」、補「變更紀錄」。
   - 更新當日 `dev_log/YYYY-MM-DD.md`：主題、決策、影響範圍、未採納方向、風險、驗證結果（記「為什麼」不只「做了什麼」）。

8. **繁中總結**：更新了什麼、多了什麼功能、可以怎麼驗證。並提醒使用者下一步（PR/合併由使用者決定，不自動 commit）。

## 硬性禁區

- 不自動 commit、不自動建 branch/worktree、不直接動 main —— 一律先問。
- 不為了租/售或子情境亂開平行底層表 —— 同類資料同一張主表。
- 不在未完成驗證前宣稱完成。
- 不憑記憶；範圍/落點/風險不確定先停下來問。
