# Owner Credential Two-Step Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重寫屋主身分申請頁面為兩步驟流程：Step 1 填寫物件資料＋聲明即可取得 OWNER credential 並建立物件；Step 2 可選填附件以提升可信度。

**Architecture:** 後端在現有 `CreateSubmission` 加入 `DECLARATIONS` route，收到時直接 set `ReviewStatus=PASSED, ActivationStatus=READY`，前端再呼叫現有 `activateCredentialSubmission`。前端拆成 `OwnerStep1Form`（表單展示）＋ `OwnerStep2Upload`（附件＋審核）兩個 component，由 `OwnerCredentialPage` 統一管理 step 狀態、dialog 狀態、localStorage 草稿、API 呼叫。

**Tech Stack:** Go 1.25 + Gin（後端）；React 19 + TypeScript 5 strict + Tailwind（前端）

---

## File Map

| 動作 | 路徑 | 職責 |
|------|------|------|
| 修改 | `go-service/internal/modules/credential/domain.go` | 新增 `ReviewRouteDeclarations` 常數 |
| 修改 | `go-service/internal/modules/credential/service.go` | `normalizeReviewRoute` 加 DECLARATIONS；`CreateSubmission` 加 DECLARATIONS 分支 |
| 修改 | `go-service/internal/modules/credential/domain_test.go` | 測試 DECLARATIONS route 可被 normalize |
| 修改 | `react-service/src/api/credentialApi.ts` | `CredentialReviewRoute` 加 `"DECLARATIONS"` |
| 新建 | `react-service/src/components/credential/ownerFieldParsers.ts` | 純函式：form string → `UpdatePropertyPayload` |
| 新建 | `react-service/src/components/credential/OwnerStep1Form.tsx` | 表單展示元件（fields + declarations + progress + buttons） |
| 新建 | `react-service/src/components/credential/OwnerStep2Upload.tsx` | 附件上傳＋智能／人工審核 |
| 大改寫 | `react-service/src/pages/OwnerCredentialPage.tsx` | 頁面容器（step 狀態、dialog、draft、API 呼叫） |

---

## Task 1: 後端 — DECLARATIONS route 常數 + normalizeReviewRoute + 測試

**Files:**
- Modify: `go-service/internal/modules/credential/domain.go`
- Modify: `go-service/internal/modules/credential/service.go:714-728`
- Modify: `go-service/internal/modules/credential/domain_test.go`

- [ ] **Step 1: 在 domain_test.go 加入失敗測試**

在 `go-service/internal/modules/credential/domain_test.go` 尾端加入：

```go
func TestNormalizeReviewRouteDeclarations(t *testing.T) {
	route, err := normalizeReviewRoute("DECLARATIONS")
	if err != nil {
		t.Fatalf("normalizeReviewRoute(DECLARATIONS) error = %v", err)
	}
	if route != ReviewRouteDeclarations {
		t.Fatalf("normalizeReviewRoute(DECLARATIONS) = %q, want %q", route, ReviewRouteDeclarations)
	}
}
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd go-service && go test ./internal/modules/credential/... -run TestNormalizeReviewRouteDeclarations -v
```

Expected: FAIL — `undefined: ReviewRouteDeclarations`

- [ ] **Step 3: 在 domain.go 加入常數**

在 `go-service/internal/modules/credential/domain.go` 的 const 區塊加入（緊接在 `ReviewRouteProfile` 之後）：

```go
ReviewRouteDeclarations = "DECLARATIONS"
```

完整 const 區塊變成：

```go
const (
    // ...existing...
    ReviewRouteSmart        = "SMART"
    ReviewRouteManual       = "MANUAL"
    ReviewRouteProfile      = "PROFILE"
    ReviewRouteDeclarations = "DECLARATIONS"
    // ...existing...
)
```

- [ ] **Step 4: 在 service.go 的 normalizeReviewRoute 加入 DECLARATIONS case**

找到 `go-service/internal/modules/credential/service.go` 的 `normalizeReviewRoute` 函式（約 714 行），加入 case：

```go
func normalizeReviewRoute(route string) (string, error) {
	if strings.TrimSpace(route) == "" {
		return ReviewRouteSmart, nil
	}

	switch strings.ToUpper(strings.TrimSpace(route)) {
	case ReviewRouteSmart:
		return ReviewRouteSmart, nil
	case ReviewRouteManual:
		return ReviewRouteManual, nil
	case ReviewRouteProfile:
		return ReviewRouteProfile, nil
	case ReviewRouteDeclarations:
		return ReviewRouteDeclarations, nil
	default:
		return "", fmt.Errorf("invalid review route %q", route)
	}
}
```

- [ ] **Step 5: 執行測試確認通過**

```bash
cd go-service && go test ./internal/modules/credential/... -run TestNormalizeReviewRouteDeclarations -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-service/internal/modules/credential/domain.go go-service/internal/modules/credential/service.go go-service/internal/modules/credential/domain_test.go
git commit -m "feat: add DECLARATIONS review route constant and normalization"
```

---

## Task 2: 後端 — CreateSubmission 加入 DECLARATIONS 分支

**Files:**
- Modify: `go-service/internal/modules/credential/service.go`（`CreateSubmission` 函式，約 216–283 行）

- [ ] **Step 1: 在 CreateSubmission 加入 DECLARATIONS 分支**

找到 `service.go` 中 `CreateSubmission` 函式，在現有 `ReviewRouteProfile` 區塊之後（約 268–280 行）加入 DECLARATIONS 分支：

```go
// 現有 PROFILE 分支（保持不動）
if normalizedType == CredentialTypeTenant && route == ReviewRouteProfile {
    if err := s.submissionRepo.SaveDecision(
        submissionID,
        CredentialReviewPassed,
        ActivationStatusReady,
        "",
        "",
        "{}",
        "已建立租客身分資料，可自行決定是否啟用租客 NFT",
    ); err != nil {
        return nil, err
    }
}

// 新增 DECLARATIONS 分支（緊接在上方 if 之後）
if normalizedType == CredentialTypeOwner && route == ReviewRouteDeclarations {
    if err := s.submissionRepo.SaveDecision(
        submissionID,
        CredentialReviewPassed,
        ActivationStatusReady,
        "",
        "",
        "{}",
        "屋主已確認物件聲明，可自行決定是否啟用屋主 NFT",
    ); err != nil {
        return nil, err
    }
}
```

- [ ] **Step 2: 確認 Go 編譯通過**

```bash
cd go-service && go build ./...
```

Expected: 0 errors

- [ ] **Step 3: 跑全部 credential 測試**

```bash
cd go-service && go test ./internal/modules/credential/... -v
```

Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/modules/credential/service.go
git commit -m "feat: auto-pass DECLARATIONS route submission for owner credential"
```

---

## Task 3: 前端 — credentialApi 加入 DECLARATIONS + ownerFieldParsers

**Files:**
- Modify: `react-service/src/api/credentialApi.ts`（第 4 行）
- Create: `react-service/src/components/credential/ownerFieldParsers.ts`

- [ ] **Step 1: 更新 CredentialReviewRoute 型別**

`react-service/src/api/credentialApi.ts` 第 4 行，改為：

```typescript
export type CredentialReviewRoute = "SMART" | "MANUAL" | "PROFILE" | "DECLARATIONS";
```

- [ ] **Step 2: 新建 ownerFieldParsers.ts**

建立 `react-service/src/components/credential/ownerFieldParsers.ts`：

```typescript
import type { UpdatePropertyPayload } from "@/api/propertyApi";

export const REQUIRED_FIELD_KEYS = [
    "propertyAddress",
    "buildingType",
    "floor",
    "mainArea",
    "rooms",
    "buildingAge",
    "buildingStructure",
    "exteriorMaterial",
    "buildingUsage",
    "zoning",
] as const;

export const DECLARATION_KEYS = ["no_sea_sand", "no_radiation", "no_haunted"] as const;

export const TOTAL_COMPLETION_ITEMS = REQUIRED_FIELD_KEYS.length + DECLARATION_KEYS.length; // 13

export function computeCompletion(
    fields: Record<string, string>,
    declarations: Record<string, boolean>,
): number {
    const filledFields = REQUIRED_FIELD_KEYS.filter((k) => fields[k]?.trim()).length;
    const checked = DECLARATION_KEYS.filter((k) => declarations[k] === true).length;
    return Math.round(((filledFields + checked) / TOTAL_COMPLETION_ITEMS) * 100);
}

function parseFloor(value: string): Pick<UpdatePropertyPayload, "floor" | "total_floors"> {
    const parts = value
        .split(/[/\\／]/)
        .map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10));
    return {
        floor: isNaN(parts[0]) ? undefined : parts[0],
        total_floors: parts.length > 1 && !isNaN(parts[1]) ? parts[1] : undefined,
    };
}

function parseRooms(
    value: string,
): Pick<UpdatePropertyPayload, "rooms" | "living_rooms" | "bathrooms"> {
    const roomMatch = value.match(/(\d+)\s*房/);
    const livingMatch = value.match(/(\d+)\s*廳/);
    const bathroomMatch = value.match(/(\d+)\s*衛/);
    return {
        rooms: roomMatch ? parseInt(roomMatch[1], 10) : undefined,
        living_rooms: livingMatch ? parseInt(livingMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
    };
}

const BUILDING_TYPE_MAP: Record<string, string> = {
    大樓: "BUILDING",
    公寓: "APARTMENT",
    透天: "TOWNHOUSE",
    店面: "STUDIO",
};

export function parsePropertyFields(fields: Record<string, string>): UpdatePropertyPayload {
    const result: UpdatePropertyPayload = {};

    const bt = BUILDING_TYPE_MAP[fields.buildingType?.trim() ?? ""];
    if (bt) result.building_type = bt;

    if (fields.floor?.trim()) Object.assign(result, parseFloor(fields.floor));

    const area = parseFloat(fields.mainArea ?? "");
    if (!isNaN(area)) result.main_area = area;

    if (fields.rooms?.trim()) Object.assign(result, parseRooms(fields.rooms));

    const age = parseInt(fields.buildingAge ?? "", 10);
    if (!isNaN(age)) result.building_age = age;

    if (fields.buildingStructure?.trim()) result.building_structure = fields.buildingStructure;
    if (fields.exteriorMaterial?.trim()) result.exterior_material = fields.exteriorMaterial;
    if (fields.buildingUsage?.trim()) result.building_usage = fields.buildingUsage;
    if (fields.zoning?.trim()) result.zoning = fields.zoning;

    return result;
}
```

- [ ] **Step 3: 確認 lint 通過**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add react-service/src/api/credentialApi.ts react-service/src/components/credential/ownerFieldParsers.ts
git commit -m "feat: add DECLARATIONS route type and ownerFieldParsers utility"
```

---

## Task 4: 前端 — OwnerStep1Form.tsx

**Files:**
- Create: `react-service/src/components/credential/OwnerStep1Form.tsx`

- [ ] **Step 1: 建立 OwnerStep1Form.tsx**

建立 `react-service/src/components/credential/OwnerStep1Form.tsx`：

```typescript
import { computeCompletion, DECLARATION_KEYS, REQUIRED_FIELD_KEYS } from "./ownerFieldParsers";

const ALL_FIELDS = [
    { key: "propertyAddress",    label: "房屋地址",          placeholder: "請填寫本次申請對應的房屋地址", required: true },
    { key: "ownershipDocNo",     label: "權狀字號",          placeholder: "若權狀或稅籍資料有字號請填寫", required: false },
    { key: "buildingType",       label: "建物類型",          placeholder: "大樓 / 公寓 / 透天 / 店面",   required: true },
    { key: "floor",              label: "樓層 / 總樓層",     placeholder: "例：5F / 24F",               required: true },
    { key: "mainArea",           label: "主建物面積（坪）",  placeholder: "例：38",                     required: true },
    { key: "rooms",              label: "格局（房 / 廳 / 衛）", placeholder: "例：3 房 2 廳 2 衛",     required: true },
    { key: "buildingAge",        label: "屋齡（年）",        placeholder: "例：10",                     required: true },
    { key: "buildingStructure",  label: "建物結構",          placeholder: "例：鋼骨鋼筋混凝土",         required: true },
    { key: "exteriorMaterial",   label: "外牆建材",          placeholder: "例：石材",                   required: true },
    { key: "buildingUsage",      label: "謄本用途",          placeholder: "例：集合住宅",               required: true },
    { key: "zoning",             label: "使用分區",          placeholder: "例：第一種住宅區",           required: true },
];

const DECLARATIONS = [
    { key: "no_sea_sand", text: "本物件非海砂屋，無使用海砂混凝土之情形" },
    { key: "no_radiation", text: "本物件非輻射屋，未受輻射污染" },
    { key: "no_haunted",   text: "本物件非凶宅，近期無發生非自然死亡事件" },
];

type Props = {
    fields: Record<string, string>;
    declarations: Record<string, boolean>;
    onFieldChange: (key: string, value: string) => void;
    onDeclarationChange: (key: string, checked: boolean) => void;
    onComplete: () => void;
    onCancel: () => void;
    submitting: boolean;
    error: string;
};

export default function OwnerStep1Form(props: Props) {
    const pct = computeCompletion(props.fields, props.declarations);
    const canComplete = pct === 100 && !props.submitting;

    return (
        <div className="space-y-6">
            {/* Header */}
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                <div className="space-y-3">
                    <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        OWNER CREDENTIAL
                    </div>
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                        屋主身分申請
                    </h1>
                    <p className="max-w-3xl text-sm leading-[1.85] text-on-surface-variant">
                        填寫物件基本資料與建物詳情，並確認聲明。可選擇上傳權狀或所有權證明以提升可信度（非必填）；上傳後可送出智能審核比對物件資料。
                    </p>
                </div>
            </section>

            {/* Completion Progress */}
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-on-surface">申請完成度</span>
                    <span className="text-sm font-bold text-primary-container">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary-container transition-all duration-300"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                    填寫所有必填欄位並勾選三項聲明後可提交申請
                </p>
            </section>

            {/* Fields */}
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="grid gap-4 md:grid-cols-2">
                    {ALL_FIELDS.map((field) => (
                        <label key={field.key} className="space-y-2">
                            <span className="text-sm font-semibold text-on-surface">
                                {field.label}
                                {!field.required && (
                                    <span className="ml-1 text-xs font-normal text-on-surface-variant">（選填）</span>
                                )}
                            </span>
                            <input
                                value={props.fields[field.key] ?? ""}
                                onChange={(e) => props.onFieldChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                            />
                        </label>
                    ))}
                </div>
            </section>

            {/* Declarations */}
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <p className="text-sm font-bold text-on-surface mb-1">物件聲明（必填）</p>
                <p className="text-xs text-on-surface-variant mb-4">以下三項均需勾選方可提交申請</p>
                <div className="space-y-3">
                    {DECLARATIONS.map((d) => (
                        <label key={d.key} className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={props.declarations[d.key] ?? false}
                                onChange={(e) => props.onDeclarationChange(d.key, e.target.checked)}
                                className="mt-0.5 h-4 w-4 accent-primary-container"
                            />
                            <span className="text-sm text-on-surface">{d.text}</span>
                        </label>
                    ))}
                </div>
            </section>

            {/* Error */}
            {props.error ? (
                <div className="rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">
                    {props.error}
                </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={props.onCancel}
                    disabled={props.submitting}
                    className="flex-1 rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                    取消
                </button>
                <button
                    type="button"
                    onClick={props.onComplete}
                    disabled={!canComplete}
                    className="flex-[2] rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {props.submitting ? "建立中..." : `完成（${pct}%）`}
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: 確認 lint 通過**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add react-service/src/components/credential/OwnerStep1Form.tsx
git commit -m "feat: add OwnerStep1Form component with progress bar and declarations"
```

---

## Task 5: 前端 — OwnerStep2Upload.tsx

**Files:**
- Create: `react-service/src/components/credential/OwnerStep2Upload.tsx`

- [ ] **Step 1: 建立 OwnerStep2Upload.tsx**

建立 `react-service/src/components/credential/OwnerStep2Upload.tsx`：

```typescript
import { useState } from "react";
import {
    analyzeCredentialSubmission,
    requestManualCredentialReview,
    uploadCredentialFiles,
} from "@/api/credentialApi";
import CredentialDocumentUploader from "./CredentialDocumentUploader";

type Props = {
    submissionId: number;
    onDone: () => void;
};

export default function OwnerStep2Upload(props: Props) {
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canSubmit = mainDoc !== null && !submitting;

    const handleSmartReview = async () => {
        if (!mainDoc) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await uploadCredentialFiles("OWNER", props.submissionId, mainDoc, supportDoc ?? undefined);
            await analyzeCredentialSubmission("OWNER", props.submissionId);
            setSuccess("智能審核已完成，請查看結果。物件已建立成功。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "送出失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    const handleManualReview = async () => {
        if (!mainDoc) return;
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            await uploadCredentialFiles("OWNER", props.submissionId, mainDoc, supportDoc ?? undefined);
            await requestManualCredentialReview("OWNER", props.submissionId);
            setSuccess("已送出人工審核，物件已建立成功。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "送出失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                <h2 className="text-2xl font-bold text-on-surface mb-2">提供證明文件（選填）</h2>
                <p className="text-sm leading-[1.8] text-on-surface-variant">
                    上傳權狀或所有權證明，可提升物件可信度。上傳後送出智能審核，系統將比對附件內容與填寫的物件資料。
                </p>
            </section>

            {error ? (
                <div className="rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">
                    {error}
                </div>
            ) : null}

            {success ? (
                <div className="rounded-2xl border border-tertiary/20 bg-tertiary/10 px-5 py-4 text-sm text-tertiary">
                    {success}
                </div>
            ) : null}

            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 space-y-4">
                <CredentialDocumentUploader
                    label="附件（選填）"
                    helperText="可上傳權狀或所有權證明；上傳後可送出智能審核比對物件資料。"
                    file={mainDoc}
                    onChange={(file) => { setMainDoc(file); setError(""); }}
                />
                <CredentialDocumentUploader
                    label="補充文件"
                    helperText="如有補充證明、來源資料或補件說明，可一併附上。"
                    file={supportDoc}
                    onChange={(file) => { setSupportDoc(file); setError(""); }}
                />

                <div className="space-y-4 pt-2">
                    <button
                        type="button"
                        onClick={() => void handleSmartReview()}
                        disabled={!canSubmit}
                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "處理中..." : "送出智能審核"}
                    </button>

                    <div className="flex justify-end">
                        <p className="text-right text-sm leading-[1.8] text-on-surface-variant">
                            可以選擇
                            <button
                                type="button"
                                disabled={!canSubmit}
                                onClick={() => void handleManualReview()}
                                className="mx-1 rounded-none bg-transparent p-0 font-semibold text-on-surface underline underline-offset-4 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                [人工審核]
                            </button>
                            ，將會耗時較久
                        </p>
                    </div>
                </div>
            </section>

            <button
                type="button"
                onClick={props.onDone}
                disabled={submitting}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
                稍後再說，前往我的物件
            </button>
        </div>
    );
}
```

- [ ] **Step 2: 確認 lint 通過**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add react-service/src/components/credential/OwnerStep2Upload.tsx
git commit -m "feat: add OwnerStep2Upload component for optional document review"
```

---

## Task 6: 前端 — OwnerCredentialPage.tsx 大改寫

**Files:**
- Rewrite: `react-service/src/pages/OwnerCredentialPage.tsx`

- [ ] **Step 1: 完整改寫 OwnerCredentialPage.tsx**

完整取代 `react-service/src/pages/OwnerCredentialPage.tsx`：

```typescript
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, createCredentialSubmission, activateCredentialSubmission } from "@/api/credentialApi";
import { createProperty, updateProperty } from "@/api/propertyApi";
import { parsePropertyFields } from "@/components/credential/ownerFieldParsers";
import OwnerStep1Form from "@/components/credential/OwnerStep1Form";
import OwnerStep2Upload from "@/components/credential/OwnerStep2Upload";

const DRAFT_KEY = "owner_credential_draft_v1";

type DraftData = {
    fields: Record<string, string>;
    declarations: Record<string, boolean>;
};

function readDraft(): DraftData | null {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        return raw ? (JSON.parse(raw) as DraftData) : null;
    } catch {
        return null;
    }
}

export default function OwnerCredentialPage() {
    const navigate = useNavigate();

    const [pageLoading, setPageLoading] = useState(true);
    const [authed, setAuthed] = useState(false);
    const [kycOk, setKycOk] = useState(false);
    const [alreadyOwner, setAlreadyOwner] = useState(false);

    const [step, setStep] = useState<1 | 2>(1);
    const [submissionId, setSubmissionId] = useState<number | null>(null);
    const [propertyId, setPropertyId] = useState<number | null>(null);

    const draft = readDraft();
    const [fields, setFields] = useState<Record<string, string>>(draft?.fields ?? {});
    const [declarations, setDeclarations] = useState<Record<string, boolean>>(draft?.declarations ?? {});

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showPostCompleteDialog, setShowPostCompleteDialog] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [auth, center] = await Promise.all([getAuthMe(), getCredentialCenter()]);
                if (cancelled) return;
                if (!auth.authenticated) {
                    setAuthed(false);
                    setKycOk(false);
                    setPageLoading(false);
                    return;
                }
                const isVerified = center.kycStatus === "VERIFIED";
                const ownerItem = center.items.find((i) => i.credentialType === "OWNER");
                const activated = ownerItem?.displayStatus === "ACTIVATED";
                setAuthed(true);
                setKycOk(isVerified);
                setAlreadyOwner(activated);
            } catch {
                setAuthed(false);
                setKycOk(false);
            } finally {
                if (!cancelled) setPageLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, []);

    const doComplete = async () => {
        setSubmitting(true);
        setError("");
        try {
            const { id: propId } = await createProperty({
                title: fields.propertyAddress ?? "未命名物件",
                address: fields.propertyAddress ?? "",
            });
            await updateProperty(propId, parsePropertyFields(fields));

            const { submissionId: subId } = await createCredentialSubmission("OWNER", {
                route: "DECLARATIONS",
                formPayload: fields,
                notes: "",
            });
            await activateCredentialSubmission("OWNER", subId);

            localStorage.removeItem(DRAFT_KEY);
            setSubmissionId(subId);
            setPropertyId(propId);
            setShowPostCompleteDialog(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "建立失敗，請重試");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = () => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, declarations }));
        navigate("/member");
    };

    const handleDeleteDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        navigate("/member");
    };

    if (pageLoading) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <div className="text-sm text-on-surface-variant">載入中…</div>
                </main>
            </SiteLayout>
        );
    }

    if (!authed || !kycOk) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">
                        返回身份中心
                    </Link>
                    <p className="text-sm text-on-surface-variant">請先完成 KYC 身份驗證才能申請角色憑證。</p>
                </main>
            </SiteLayout>
        );
    }

    if (alreadyOwner) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">
                        返回身份中心
                    </Link>
                    <p className="text-sm text-on-surface-variant">
                        你已擁有屋主身份。
                        <button
                            type="button"
                            onClick={() => navigate("/my/properties")}
                            className="ml-1 text-primary-container underline underline-offset-4"
                        >
                            前往我的物件
                        </button>
                    </p>
                </main>
            </SiteLayout>
        );
    }

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                <Link to="/member" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                    返回身份中心
                </Link>

                {step === 1 && (
                    <OwnerStep1Form
                        fields={fields}
                        declarations={declarations}
                        onFieldChange={(key, value) => { setFields((prev) => ({ ...prev, [key]: value })); setError(""); }}
                        onDeclarationChange={(key, checked) => setDeclarations((prev) => ({ ...prev, [key]: checked }))}
                        onComplete={() => void doComplete()}
                        onCancel={() => setShowCancelDialog(true)}
                        submitting={submitting}
                        error={error}
                    />
                )}

                {step === 2 && submissionId !== null && (
                    <OwnerStep2Upload
                        submissionId={submissionId}
                        onDone={() => navigate("/my/properties")}
                    />
                )}

                {/* Cancel Dialog */}
                {showCancelDialog && step === 1 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                            <h3 className="text-lg font-bold text-on-surface">確定要取消嗎？</h3>
                            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                                目前填寫的資料尚未提交。你可以選擇保留草稿，下次進入頁面時自動帶回。
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                >
                                    保留草稿，返回身份中心
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteDraft}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                                >
                                    刪除草稿，返回身份中心
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCancelDialog(false)}
                                    className="w-full rounded-xl px-5 py-3 text-sm font-medium text-on-surface-variant transition-opacity hover:opacity-80"
                                >
                                    繼續填寫
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Post Complete Dialog */}
                {showPostCompleteDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                            <h3 className="text-lg font-bold text-on-surface">物件已建立，身份已啟用！</h3>
                            <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                                是否現在提供證明文件？上傳權狀或所有權證明可提升物件可信度（選填）。
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPostCompleteDialog(false);
                                        setStep(2);
                                    }}
                                    className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                >
                                    現在提供
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate("/my/properties")}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                                >
                                    稍後再說，前往我的物件
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: 確認 lint 通過**

```bash
cd react-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: 確認 build 通過**

```bash
cd react-service && npm run build
```

Expected: `tsc -b && vite build` 0 errors

- [ ] **Step 4: Commit**

```bash
git add react-service/src/pages/OwnerCredentialPage.tsx
git commit -m "feat: rewrite OwnerCredentialPage as two-step flow with draft and dialogs"
```

---

## 驗證清單（實作完成後逐項手動確認）

1. [ ] 頁面載入：「目前狀態」區塊已消失
2. [ ] 欄位全空 + 聲明全未勾 → 完成度 0%，完成按鈕 disabled
3. [ ] 填寫 10 個必填欄位 + 勾選 3 項聲明 → 完成度 100%，完成按鈕啟用
4. [ ] 點「取消」→ 跳出 dialog（三個選項）
5. [ ] 「保留草稿」→ 重回頁面欄位恢復
6. [ ] 「刪除草稿」→ 重回頁面欄位清空
7. [ ] 「繼續填寫」→ dialog 關閉，留在頁面
8. [ ] 點「完成」（100%）→ 4 個 API 依序成功 → 跳出「物件已建立」dialog
9. [ ] 「稍後再說」→ 導向 `/my/properties`，看到新物件（待上架狀態）
10. [ ] 「現在提供」→ 進入 Step 2 上傳頁面
11. [ ] Step 2：未選檔案 → 送出按鈕 disabled
12. [ ] Step 2：選檔案 → 智能審核/人工審核按鈕啟用
13. [ ] Step 2：「稍後再說」→ 導向 `/my/properties`
14. [ ] 已有 OWNER credential 進入頁面 → 顯示「你已擁有屋主身份」訊息
