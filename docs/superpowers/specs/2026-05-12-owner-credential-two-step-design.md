# OwnerCredentialPage 兩步驟改版設計

**Goal:** 把屋主身分申請頁面拆成兩個步驟：Step 1 填寫物件資料＋聲明即可取得 OWNER credential 並建立物件；Step 2 選填附件以提升可信度。移除現有的「目前狀態」區塊與 CredentialApplicationShell 的依賴。

**Architecture:** OwnerCredentialPage 自行管理 `step: 1 | 2` 狀態，拆出 `OwnerStep1Form`（表單＋宣告＋按鈕）和 `OwnerStep2Upload`（附件上傳＋審核）兩個 component。後端在現有 `createCredentialSubmission` 加入 `route: "DECLARATIONS"` 處理，建立時直接 set `ReviewStatus=PASSED, ActivationStatus=READY`，前端再呼叫現有的 `activateCredentialSubmission`。

**Tech Stack:** React 19 + TypeScript 5 strict（前端）；Go 1.25 + Gin（後端）

---

## 欄位定義

### 必填欄位（影響完成百分比，10 項）

| key | label | 對應 property 欄位 | 備註 |
|-----|-------|-------------------|------|
| `propertyAddress` | 房屋地址 | `address`（也作 `title`）| required |
| `buildingType` | 建物類型 | `building_type` | 大樓/公寓/透天/店面 → BUILDING/APARTMENT/TOWNHOUSE/STUDIO |
| `floor` | 樓層 / 總樓層 | `floor`, `total_floors` | 解析 "5F / 24F" |
| `mainArea` | 主建物面積（坪） | `main_area` | 解析 float |
| `rooms` | 格局（房 / 廳 / 衛） | `rooms`, `living_rooms`, `bathrooms` | 解析 "3 房 2 廳 2 衛" |
| `buildingAge` | 屋齡（年） | `building_age` | 解析 int |
| `buildingStructure` | 建物結構 | `building_structure` | string |
| `exteriorMaterial` | 外牆建材 | `exterior_material` | string |
| `buildingUsage` | 謄本用途 | `building_usage` | string |
| `zoning` | 使用分區 | `zoning` | string |

### 選填欄位（不計入百分比）

| key | label | 備註 |
|-----|-------|------|
| `ownershipDocNo` | 權狀字號 | 存入 credential formPayload，不寫 property |

### 聲明（影響完成百分比，3 項）

```
no_sea_sand  本物件非海砂屋，無使用海砂混凝土之情形
no_radiation 本物件非輻射屋，未受輻射污染
no_haunted   本物件非凶宅，近期無發生非自然死亡事件
```

**完成百分比公式：** `Math.round((填寫的必填欄位數 + 已勾選聲明數) / 13 * 100)`

---

## 前端架構

### 檔案清單

| 動作 | 路徑 |
|------|------|
| 大改寫 | `react-service/src/pages/OwnerCredentialPage.tsx` |
| 新建 | `react-service/src/components/credential/OwnerStep1Form.tsx` |
| 新建 | `react-service/src/components/credential/OwnerStep2Upload.tsx` |

`CredentialApplicationShell`、`CredentialRolePage`、`CredentialStatusPanel` 在 Owner 流程中不再使用（其他 credential 頁面維持不動）。

### OwnerCredentialPage（頁面容器）

```typescript
type Step = 1 | 2;
type DraftData = { fields: Record<string, string>; declarations: Record<string, boolean> };

const DRAFT_KEY = "owner_credential_draft_v1";
```

狀態：
- `step: Step`
- `submissionId: number | null`（Step 1 完成後由後端回傳）
- `propertyId: number | null`（Step 1 完成後建立）
- `showPostCompleteDialog: boolean`
- `showCancelDialog: boolean`

流程：
1. mount 時讀取 localStorage `DRAFT_KEY`，有值則帶入 Step 1 初始值
2. 渲染 `OwnerStep1Form`（step === 1）或 `OwnerStep2Upload`（step === 2）
3. `onComplete` callback（見下）
4. `onProvideEvidence` callback → `setStep(2)`

---

### OwnerStep1Form

Props：
```typescript
type Props = {
    initialFields?: Record<string, string>;
    initialDeclarations?: Record<string, boolean>;
    onComplete: (submissionId: number, propertyId: number) => void;
    onCancel: () => void;  // 觸發取消對話框
};
```

內部狀態：
- `fields: Record<string, string>`
- `declarations: Record<string, boolean>`
- `submitting: boolean`
- `error: string`

**完成百分比顯示：**
```tsx
<div className="...">
    <div className="...">完成度</div>
    <div className="...">
        <div style={{ width: `${pct}%` }} className="bg-primary-container h-2 rounded-full transition-all" />
    </div>
    <div className="...">{pct}%</div>
</div>
```

**「完成」按鈕：** `disabled={pct < 100 || submitting}`

**「取消」按鈕：** 呼叫 `props.onCancel()` → 上層顯示取消對話框

**onComplete 呼叫順序（`doComplete` async function）：**
1. `createProperty({ title: fields.propertyAddress, address: fields.propertyAddress })`→ 取得 `propertyId`
2. `updateProperty(propertyId, parsePropertyFields(fields))` → 寫入其餘欄位
3. `createCredentialSubmission("OWNER", { route: "DECLARATIONS", formPayload: fields, notes: "" })` → 取得 `submissionId`
4. `activateCredentialSubmission("OWNER", submissionId)` → 取得 credential
5. 清除 localStorage `DRAFT_KEY`
6. 呼叫 `props.onComplete(submissionId, propertyId)`

任何一步失敗 → `setError(...)` 顯示錯誤，`submitting` 重設為 false。

**欄位解析輔助函式 `parsePropertyFields`：**
```typescript
function parsePropertyFields(fields: Record<string, string>): UpdatePropertyPayload {
    // floor: "5F / 24F" → { floor: 5, total_floors: 24 }
    // rooms: "3 房 2 廳 2 衛" → { rooms: 3, living_rooms: 2, bathrooms: 2 }
    // mainArea: "38" → { main_area: 38 }
    // buildingAge: "10" → { building_age: 10 }
    // 解析失敗的欄位略過（不寫 property），不拋錯
}
```

---

### OwnerStep2Upload

Props：
```typescript
type Props = {
    submissionId: number;
    propertyId: number;
    onDone: () => void;  // 完成後導向 /my/properties
};
```

UI：
- 說明文字：「可上傳權狀或所有權證明，提升物件可信度。此步驟為選填。」
- `CredentialDocumentUploader`（label="附件（選填）"）→ mainDoc
- `CredentialDocumentUploader`（label="補充文件"）→ supportDoc（選填）
- 「送出智能審核」按鈕 → 呼叫 `uploadCredentialFiles` + `analyzeCredentialSubmission`
- 「人工審核」secondary → `uploadCredentialFiles` + `requestManualCredentialReview`
- 「稍後再說，前往我的物件」→ `onDone()`（不上傳直接離開）

---

### 取消對話框（OwnerCredentialPage 內 inline）

```
你確定要取消嗎？

[ 保留草稿，返回身份中心 ]   → 儲存 localStorage → navigate("/member")
[ 刪除草稿，返回身份中心 ]   → 清除 localStorage → navigate("/member")
[ 繼續填寫 ]               → 關閉對話框
```

草稿格式（存進 localStorage `DRAFT_KEY`）：
```json
{ "fields": { "propertyAddress": "...", ... }, "declarations": { "no_sea_sand": true, ... } }
```

---

### 完成後對話框（OwnerCredentialPage 內 inline）

```
物件已建立，是否現在提供證明文件？（選填）

[ 稍後再說 ]    → navigate("/my/properties")
[ 現在提供 ]   → setStep(2)，setShowPostCompleteDialog(false)
```

---

## 後端架構

### 修改檔案

`go-service/internal/modules/credential/domain.go`
```go
// 新增常數
ReviewRouteDeclarations = "DECLARATIONS"
```

`go-service/internal/modules/credential/service.go`（在 `CreateSubmission` 函式中）
```go
// 當 route == "DECLARATIONS" 時，建立 submission 直接設為 PASSED + READY
// 跳過 smart/manual review 流程
// 其餘 route 維持現有邏輯不動
if req.Route == ReviewRouteDeclarations {
    // INSERT ... review_status='PASSED', activation_status='READY'
    return submissionID, nil
}
```

前端接著呼叫現有 `activateCredentialSubmission`（`PUT /credentials/owner/submissions/:id/activate`），`EnsureActivatable` 因為 `ReviewStatus == PASSED` 和 `ActivationStatus == READY` 會通過。

---

## Draft 規格

| 事件 | 動作 |
|------|------|
| 點「取消」→「保留草稿」| `localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, declarations }))` |
| 點「取消」→「刪除草稿」| `localStorage.removeItem(DRAFT_KEY)` |
| 頁面 mount | 讀取 `DRAFT_KEY`，有值則帶入初始狀態 |
| 「完成」成功 | `localStorage.removeItem(DRAFT_KEY)` |

---

## 驗證重點

1. Step 1：百分比隨欄位填寫即時更新
2. 10 個必填欄位全填 + 3 個聲明全勾 → 百分比 100%，完成按鈕啟用
3. 點完成 → 後端 4 步驟（create property → update → create DECLARATIONS submission → activate）全部成功 → 彈對話框
4. 對話框「稍後」→ 導向 `/my/properties`，看到新物件
5. 對話框「現在提供」→ 進入 Step 2
6. Step 2：上傳附件 → 送出智能審核 → 正常運作
7. 取消「保留草稿」→ 重回頁面欄位恢復
8. 取消「刪除草稿」→ 重回頁面欄位清空
9. 部分填寫時重整頁面 → 草稿恢復（需先點取消→保留才有效）
