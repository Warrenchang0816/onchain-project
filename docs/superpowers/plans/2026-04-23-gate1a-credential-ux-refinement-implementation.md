# Gate 1A Credential UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Gate 1A role credential UX so users can preview uploads, confirm every important action, switch from editable form to read-only submission snapshot, stop only manual review, restart with a fresh blank draft, and activate NFT credentials only after a final confirmation.

**Architecture:** Keep the existing `credential` module as the single source of truth. Extend backend status handling with `STOPPED`, add a latest-submission detail API plus protected file-preview endpoints, and rework the React credential shell into a two-mode flow: editable draft and read-only submission snapshot. Preserve old submissions for audit, but keep the frontend focused on the latest submission only.

**Tech Stack:** Go 1.25 + Gin + PostgreSQL + MinIO, React 19 + TypeScript + Vite, existing fetch-based API client pattern, existing `IdentityNFT` activation flow.

---

## File Structure

- Modify: `go-service/internal/modules/credential/domain.go`
- Modify: `go-service/internal/modules/credential/domain_test.go`
- Modify: `go-service/internal/modules/credential/dto.go`
- Modify: `go-service/internal/db/repository/credential_submission_repo.go`
- Modify: `go-service/internal/modules/credential/service.go`
- Modify: `go-service/internal/modules/credential/handler.go`
- Modify: `go-service/internal/bootstrap/router.go`
- Modify: `react-service/src/api/credentialApi.ts`
- Create: `react-service/src/components/credential/CredentialConfirmDialog.tsx`
- Create: `react-service/src/components/credential/CredentialSubmissionSnapshot.tsx`
- Create: `react-service/src/components/credential/CredentialRolePage.tsx`
- Modify: `react-service/src/components/credential/CredentialDocumentUploader.tsx`
- Modify: `react-service/src/components/credential/CredentialApplicationShell.tsx`
- Modify: `react-service/src/components/credential/CredentialStatusPanel.tsx`
- Modify: `react-service/src/components/credential/credentialStatusLabels.ts`
- Modify: `react-service/src/pages/OwnerCredentialPage.tsx`
- Modify: `react-service/src/pages/TenantCredentialPage.tsx`
- Modify: `react-service/src/pages/AgentCredentialPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`
- Modify: `docs/開發規劃書.md`
- Create: `dev_log/2026-04-23.md`

---

### Task 1: Extend Credential State With `STOPPED` And Deterministic Display Mapping

**Files:**
- Modify: `go-service/internal/modules/credential/domain.go`
- Modify: `go-service/internal/modules/credential/domain_test.go`
- Modify: `go-service/internal/modules/credential/dto.go`
- Modify: `go-service/internal/modules/credential/service.go`

- [ ] **Step 1: Add failing tests for stop eligibility and display-status mapping**

```go
package credential

import (
	"testing"

	"go-service/internal/db/model"
)

func TestCanStopReview(t *testing.T) {
	if !CanStopReview(CredentialReviewManualReviewing) {
		t.Fatal("manual reviewing should be stoppable")
	}
	for _, status := range []string{
		CredentialReviewSmartReviewing,
		CredentialReviewPassed,
		CredentialReviewFailed,
		CredentialReviewStopped,
	} {
		if CanStopReview(status) {
			t.Fatalf("status %s should not be stoppable", status)
		}
	}
}

func TestDisplayStatusForSubmission(t *testing.T) {
	cases := []struct {
		name string
		sub  *model.CredentialSubmission
		want string
	}{
		{
			name: "stopped manual submission",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewStopped,
				ActivationStatus: ActivationStatusNotReady,
			},
			want: DisplayStatusStopped,
		},
		{
			name: "manual reviewing",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewManualReviewing,
				ActivationStatus: ActivationStatusNotReady,
			},
			want: DisplayStatusManualReviewing,
		},
		{
			name: "passed ready",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewPassed,
				ActivationStatus: ActivationStatusReady,
			},
			want: DisplayStatusPassedReady,
		},
		{
			name: "activated",
			sub: &model.CredentialSubmission{
				ReviewStatus:     CredentialReviewPassed,
				ActivationStatus: ActivationStatusActivated,
			},
			want: DisplayStatusActivated,
		},
	}

	for _, tc := range cases {
		if got := DisplayStatusForSubmission(tc.sub); got != tc.want {
			t.Fatalf("%s: got %s want %s", tc.name, got, tc.want)
		}
	}
}
```

- [ ] **Step 2: Run the focused backend tests and confirm they fail before implementation**

Run: `go test ./internal/modules/credential -run "TestCanStopReview|TestDisplayStatusForSubmission" -v`  
Expected: FAIL with undefined identifiers for `CredentialReviewStopped`, `DisplayStatusStopped`, `CanStopReview`, or `DisplayStatusForSubmission`.

- [ ] **Step 3: Add the new status constant and pure helper functions in `domain.go`**

```go
const (
	CredentialReviewSmartReviewing  = "SMART_REVIEWING"
	CredentialReviewManualReviewing = "MANUAL_REVIEWING"
	CredentialReviewStopped         = "STOPPED"
	CredentialReviewPassed          = "PASSED"
	CredentialReviewFailed          = "FAILED"
)

func CanStopReview(reviewStatus string) bool {
	return reviewStatus == CredentialReviewManualReviewing
}

func DisplayStatusForSubmission(sub *model.CredentialSubmission) string {
	if sub == nil {
		return DisplayStatusNotStarted
	}

	switch {
	case sub.ActivationStatus == ActivationStatusActivated:
		return DisplayStatusActivated
	case sub.ReviewStatus == CredentialReviewStopped:
		return DisplayStatusStopped
	case sub.ReviewStatus == CredentialReviewManualReviewing:
		return DisplayStatusManualReviewing
	case sub.ReviewStatus == CredentialReviewSmartReviewing:
		return DisplayStatusSmartReviewing
	case sub.ReviewStatus == CredentialReviewPassed && sub.ActivationStatus == ActivationStatusReady:
		return DisplayStatusPassedReady
	case sub.ReviewStatus == CredentialReviewFailed:
		return DisplayStatusFailed
	default:
		return DisplayStatusNotStarted
	}
}
```

- [ ] **Step 4: Expose the new display status in `dto.go` and reuse the helper in `service.go`**

```go
const (
	DisplayStatusNotStarted      = "NOT_STARTED"
	DisplayStatusSmartReviewing  = "SMART_REVIEWING"
	DisplayStatusManualReviewing = "MANUAL_REVIEWING"
	DisplayStatusStopped         = "STOPPED"
	DisplayStatusPassedReady     = "PASSED_READY"
	DisplayStatusFailed          = "FAILED"
	DisplayStatusActivated       = "ACTIVATED"
	DisplayStatusRevoked         = "REVOKED"
)
```

```go
displayStatus := DisplayStatusForSubmission(sub)
item.DisplayStatus = displayStatus

switch displayStatus {
case DisplayStatusActivated:
	item.CanRetrySmart = false
	item.CanRequestManual = false
case DisplayStatusManualReviewing, DisplayStatusSmartReviewing, DisplayStatusPassedReady:
	item.CanRetrySmart = false
	item.CanRequestManual = false
case DisplayStatusStopped, DisplayStatusFailed:
	item.CanRetrySmart = true
	item.CanRequestManual = true
default:
	item.CanRetrySmart = true
	item.CanRequestManual = true
}

if displayStatus == DisplayStatusPassedReady {
	item.CanActivate = true
}
```

- [ ] **Step 5: Re-run backend verification for the new state helpers**

Run: `go test ./internal/modules/credential -run "TestCanStopReview|TestDisplayStatusForSubmission" -v`  
Expected: PASS.

Run: `go test ./...`  
Expected: PASS.

- [ ] **Step 6: Commit the state-mapping checkpoint**

```bash
git add -- go-service/internal/modules/credential/domain.go go-service/internal/modules/credential/domain_test.go go-service/internal/modules/credential/dto.go go-service/internal/modules/credential/service.go
git commit -m "feat: add stopped credential review state"
```

### Task 2: Add Latest Submission Detail, Stop Review, And Protected File Preview APIs

**Files:**
- Modify: `go-service/internal/db/repository/credential_submission_repo.go`
- Modify: `go-service/internal/modules/credential/dto.go`
- Modify: `go-service/internal/modules/credential/service.go`
- Modify: `go-service/internal/modules/credential/handler.go`
- Modify: `go-service/internal/bootstrap/router.go`

- [ ] **Step 1: Extend DTOs with a detail response that can fully rebuild the submission snapshot**

```go
type CredentialSubmissionDetailResponse struct {
	SubmissionID    int64             `json:"submissionId"`
	CredentialType  string            `json:"credentialType"`
	ReviewRoute     string            `json:"reviewRoute"`
	DisplayStatus   string            `json:"displayStatus"`
	FormPayload     map[string]string `json:"formPayload"`
	Notes           string            `json:"notes"`
	Summary         *string           `json:"summary,omitempty"`
	MainFileURL     *string           `json:"mainFileUrl,omitempty"`
	SupportFileURL  *string           `json:"supportFileUrl,omitempty"`
	CanStopReview   bool              `json:"canStopReview"`
	CanRestartReview bool             `json:"canRestartReview"`
	CanActivate     bool              `json:"canActivate"`
	ActivationTxHash *string          `json:"activationTxHash,omitempty"`
}
```

- [ ] **Step 2: Add repository support for stopping a manual review**

```go
func (r *CredentialSubmissionRepository) MarkStopped(id int64) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_status = $1,
		    activation_status = $2,
		    updated_at = NOW()
		WHERE id = $3
	`, reviewStatusStopped, activationStatusNotReady, id)
	if err != nil {
		return fmt.Errorf("credential_submission_repo: mark stopped: %w", err)
	}
	return nil
}

const (
	reviewStatusSmartReviewing  = "SMART_REVIEWING"
	reviewStatusManualReviewing = "MANUAL_REVIEWING"
	reviewStatusStopped         = "STOPPED"
	activationStatusNotReady    = "NOT_READY"
)
```

- [ ] **Step 3: Add service methods for latest detail, stop review, and file download**

```go
func (s *Service) GetLatestSubmissionDetail(ctx context.Context, wallet, credentialType string) (*CredentialSubmissionDetailResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.submissionRepo.FindLatestByUserAndType(user.ID, credentialType)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, nil
	}
	return s.buildSubmissionDetail(sub)
}

func (s *Service) StopSubmission(ctx context.Context, wallet, credentialType string, submissionID int64) (*CredentialSubmissionDetailResponse, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, err
	}
	if !CanStopReview(sub.ReviewStatus) {
		return nil, errors.New("目前只有人工審核中的案件可以停止")
	}
	if err := s.submissionRepo.MarkStopped(sub.ID); err != nil {
		return nil, err
	}
	updated, err := s.submissionRepo.FindByID(sub.ID)
	if err != nil {
		return nil, err
	}
	return s.buildSubmissionDetail(updated)
}

func (s *Service) GetSubmissionFile(ctx context.Context, wallet, credentialType string, submissionID int64, kind string) ([]byte, string, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, "", err
	}
	sub, err := s.requireOwnedSubmission(user.ID, credentialType, submissionID)
	if err != nil {
		return nil, "", err
	}
	if s.storageSvc == nil {
		return nil, "", errors.New("檔案儲存服務未啟用")
	}

	var objectPath string
	switch kind {
	case "main":
		objectPath = nullStringOrEmpty(sub.MainDocPath)
	case "support":
		objectPath = nullStringOrEmpty(sub.SupportDocPath)
	default:
		return nil, "", errors.New("unknown file kind")
	}
	if strings.TrimSpace(objectPath) == "" {
		return nil, "", errors.New("file not found")
	}

	data, err := s.storageSvc.Download(ctx, objectPath)
	if err != nil {
		return nil, "", err
	}
	return data, http.DetectContentType(data), nil
}
```

- [ ] **Step 4: Build the snapshot/detail payload in one backend helper**

```go
func (s *Service) buildSubmissionDetail(sub *model.CredentialSubmission) (*CredentialSubmissionDetailResponse, error) {
	formPayload, err := decodeFormPayload(sub.FormPayloadJSON)
	if err != nil {
		return nil, err
	}

	detail := &CredentialSubmissionDetailResponse{
		SubmissionID:     sub.ID,
		CredentialType:   sub.CredentialType,
		ReviewRoute:      sub.ReviewRoute,
		DisplayStatus:    DisplayStatusForSubmission(sub),
		FormPayload:      formPayload,
		Notes:            sub.Notes,
		CanStopReview:    CanStopReview(sub.ReviewStatus),
		CanRestartReview: sub.ReviewStatus == CredentialReviewStopped || sub.ReviewStatus == CredentialReviewFailed,
		CanActivate:      sub.ReviewStatus == CredentialReviewPassed && sub.ActivationStatus == ActivationStatusReady,
	}

	if summary := strings.TrimSpace(sub.DecisionSummary); summary != "" {
		detail.Summary = stringPtr(summary)
	}
	if txHash := strings.TrimSpace(nullStringOrEmpty(sub.ActivationTxHash)); txHash != "" {
		detail.ActivationTxHash = stringPtr(txHash)
	}
	if sub.MainDocPath.Valid && strings.TrimSpace(sub.MainDocPath.String) != "" {
		detail.MainFileURL = stringPtr(fmt.Sprintf("/api/credentials/%s/submissions/%d/files/main", strings.ToLower(sub.CredentialType), sub.ID))
	}
	if sub.SupportDocPath.Valid && strings.TrimSpace(sub.SupportDocPath.String) != "" {
		detail.SupportFileURL = stringPtr(fmt.Sprintf("/api/credentials/%s/submissions/%d/files/support", strings.ToLower(sub.CredentialType), sub.ID))
	}
	return detail, nil
}
```

- [ ] **Step 5: Add the new handlers and routes**

```go
func (h *Handler) GetLatestSubmission(c *gin.Context) {
	resp, err := h.svc.GetLatestSubmissionDetail(c.Request.Context(), getWallet(c), c.Param("type"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) StopSubmission(c *gin.Context) {
	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}
	resp, err := h.svc.StopSubmission(c.Request.Context(), getWallet(c), c.Param("type"), submissionID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已停止審核", "data": resp})
}

func (h *Handler) GetMainFile(c *gin.Context) { h.getSubmissionFile(c, "main") }
func (h *Handler) GetSupportFile(c *gin.Context) { h.getSubmissionFile(c, "support") }
```

```go
protected.GET("/credentials/:type/submissions/latest", credentialHandler.GetLatestSubmission)
protected.POST("/credentials/:type/submissions/:id/stop", credentialHandler.StopSubmission)
protected.GET("/credentials/:type/submissions/:id/files/main", credentialHandler.GetMainFile)
protected.GET("/credentials/:type/submissions/:id/files/support", credentialHandler.GetSupportFile)
```

- [ ] **Step 6: Run backend verification for the new API surface**

Run: `go test ./...`  
Expected: PASS.

Run: `go build ./...`  
Expected: PASS.

- [ ] **Step 7: Commit the backend API checkpoint**

```bash
git add -- go-service/internal/db/repository/credential_submission_repo.go go-service/internal/modules/credential/dto.go go-service/internal/modules/credential/service.go go-service/internal/modules/credential/handler.go go-service/internal/bootstrap/router.go
git commit -m "feat: add credential snapshot and stop review api"
```

### Task 3: Build Frontend Snapshot Primitives, Preview Uploader, And Expanded API Client

**Files:**
- Modify: `react-service/src/api/credentialApi.ts`
- Create: `react-service/src/components/credential/CredentialConfirmDialog.tsx`
- Create: `react-service/src/components/credential/CredentialSubmissionSnapshot.tsx`
- Modify: `react-service/src/components/credential/CredentialDocumentUploader.tsx`
- Modify: `react-service/src/components/credential/credentialStatusLabels.ts`
- Modify: `react-service/src/components/credential/CredentialStatusPanel.tsx`

- [ ] **Step 1: Expand the frontend API types and functions**

```ts
export type CredentialDisplayStatus =
    | "NOT_STARTED"
    | "SMART_REVIEWING"
    | "MANUAL_REVIEWING"
    | "STOPPED"
    | "PASSED_READY"
    | "FAILED"
    | "ACTIVATED"
    | "REVOKED";

export type CredentialSubmissionDetail = {
    submissionId: number;
    credentialType: CredentialType;
    reviewRoute: CredentialReviewRoute;
    displayStatus: CredentialDisplayStatus;
    formPayload: Record<string, string>;
    notes: string;
    summary?: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
    canStopReview: boolean;
    canRestartReview: boolean;
    canActivate: boolean;
    activationTxHash?: string;
};

export async function getLatestCredentialSubmission(type: CredentialType): Promise<CredentialSubmissionDetail | null> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/latest`, {
        method: "GET",
        credentials: "include",
    });
    return unwrap<CredentialSubmissionDetail | null>(res);
}

export async function stopCredentialSubmission(type: CredentialType, submissionId: number): Promise<CredentialSubmissionDetail> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/stop`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap<CredentialSubmissionDetail>(res);
}

export function getCredentialSubmissionFileUrl(type: CredentialType, submissionId: number, kind: "main" | "support"): string {
    return `${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/files/${kind}`;
}
```

- [ ] **Step 2: Upgrade the uploader so local files immediately show image previews**

```tsx
import { useEffect, useId, useState } from "react";

export default function CredentialDocumentUploader(props: Props) {
    const inputId = useId();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!props.file) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(props.file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [props.file]);

    return (
        <div className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor={inputId} className="text-sm font-semibold text-on-surface">{props.label}</label>
                <div className="flex gap-2">
                    <label htmlFor={inputId} className="inline-flex cursor-pointer rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface">
                        選擇檔案
                    </label>
                    {props.file ? (
                        <button type="button" onClick={() => props.onChange(null)} className="rounded-xl border border-outline-variant/20 px-4 py-2 text-sm text-on-surface-variant">
                            清除
                        </button>
                    ) : null}
                </div>
            </div>

            <input id={inputId} type="file" accept="image/*" className="hidden" onChange={(event) => props.onChange(event.target.files?.[0] ?? null)} />

            <div className="rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                {props.file ? props.file.name : "尚未選擇檔案"}
            </div>

            {previewUrl ? (
                <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface">
                    <img src={previewUrl} alt={`${props.label}預覽`} className="h-64 w-full object-contain bg-surface-container-low" />
                </div>
            ) : null}
        </div>
    );
}
```

- [ ] **Step 3: Add a reusable confirmation dialog and a reusable submission snapshot component**

```tsx
// CredentialConfirmDialog.tsx
type Props = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
};

export default function CredentialConfirmDialog(props: Props) {
    if (!props.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
            <div className="w-full max-w-[520px] rounded-[28px] bg-surface-container-lowest p-6 shadow-2xl">
                <h2 className="text-2xl font-bold text-on-surface">{props.title}</h2>
                <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">{props.description}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={props.onCancel} className="rounded-xl border border-outline-variant/20 px-4 py-2 text-sm font-semibold text-on-surface">
                        {props.cancelLabel ?? "取消"}
                    </button>
                    <button type="button" disabled={props.busy} onClick={props.onConfirm} className="rounded-xl bg-primary-container px-4 py-2 text-sm font-bold text-on-primary-container">
                        {props.busy ? "處理中..." : props.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

```tsx
// CredentialSubmissionSnapshot.tsx
type Props = {
    fields: Array<{ key: string; label: string }>;
    values: Record<string, string>;
    notes: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
};

export default function CredentialSubmissionSnapshot(props: Props) {
    return (
        <section className="space-y-6 rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <div className="grid gap-4 md:grid-cols-2">
                {props.fields.map((field) => (
                    <div key={field.key} className="rounded-2xl bg-surface-container-low p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{field.label}</div>
                        <div className="mt-2 text-sm leading-[1.8] text-on-surface">{props.values[field.key] || "未填寫"}</div>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">補充說明</div>
                <div className="mt-2 text-sm leading-[1.8] text-on-surface">{props.notes || "未填寫"}</div>
            </div>

            {props.mainFileUrl ? <img src={props.mainFileUrl} alt="主文件預覽" className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low object-contain" /> : null}
            {props.supportFileUrl ? <img src={props.supportFileUrl} alt="補充文件預覽" className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low object-contain" /> : null}
        </section>
    );
}
```

- [ ] **Step 4: Add the new `STOPPED` label and help copy**

```ts
export const CREDENTIAL_STATUS_LABEL: Record<CredentialDisplayStatus, string> = {
    NOT_STARTED: "尚未申請",
    SMART_REVIEWING: "智能審核中",
    MANUAL_REVIEWING: "人工審核中",
    STOPPED: "已停止審核",
    PASSED_READY: "已通過，待啟用",
    FAILED: "未通過",
    ACTIVATED: "已啟用",
    REVOKED: "已撤銷",
};
```

```tsx
const STATUS_HELP_TEXT: Record<CredentialDisplayStatus, string> = {
    NOT_STARTED: "可先走智能審核，若不採用結果也可改送人工審核。",
    SMART_REVIEWING: "系統正在整理智能判定結果，完成後會直接更新結果頁。",
    MANUAL_REVIEWING: "案件已送入人工審核，目前只能查看成品或停止審核。",
    STOPPED: "你已停止這次人工審核，如需繼續請重新發起一筆新申請。",
    PASSED_READY: "結果已通過，是否啟用 NFT 憑證由你自行決定。",
    FAILED: "本次申請未通過，你可以重新審核並從空白表單重新開始。",
    ACTIVATED: "此身份 NFT 憑證已啟用，可回身份中心查看狀態。",
    REVOKED: "此身份憑證已被撤銷，如需恢復請重新提出申請。",
};
```

- [ ] **Step 5: Run frontend verification for the API client and UI primitives**

Run: `npm run lint`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit the frontend primitives checkpoint**

```bash
git add -- react-service/src/api/credentialApi.ts react-service/src/components/credential/CredentialConfirmDialog.tsx react-service/src/components/credential/CredentialSubmissionSnapshot.tsx react-service/src/components/credential/CredentialDocumentUploader.tsx react-service/src/components/credential/CredentialStatusPanel.tsx react-service/src/components/credential/credentialStatusLabels.ts
git commit -m "feat: add credential submission snapshot ui"
```

### Task 4: Rework The Credential Shell And Rewire The Three Role Pages

**Files:**
- Create: `react-service/src/components/credential/CredentialRolePage.tsx`
- Modify: `react-service/src/components/credential/CredentialApplicationShell.tsx`
- Modify: `react-service/src/pages/OwnerCredentialPage.tsx`
- Modify: `react-service/src/pages/TenantCredentialPage.tsx`
- Modify: `react-service/src/pages/AgentCredentialPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`

- [ ] **Step 1: Create a shared role-page container that owns fetch/refresh logic**

```tsx
type Props = {
    credentialType: CredentialType;
    title: string;
    description: string;
    primaryFields: Array<{ key: string; label: string; placeholder: string }>;
};

export default function CredentialRolePage(props: Props) {
    const [state, setState] = useState<{
        loading: boolean;
        authenticated: boolean;
        center?: CredentialCenterResponse;
        detail?: CredentialSubmissionDetail | null;
        error?: string;
    }>({ loading: true, authenticated: false });

    const refresh = async () => {
        const [center, detail] = await Promise.all([
            getCredentialCenter(),
            getLatestCredentialSubmission(props.credentialType),
        ]);
        setState((current) => ({ ...current, loading: false, authenticated: true, center, detail, error: undefined }));
    };

    useEffect(() => {
        const load = async () => {
            const auth = await getAuthMe().catch(() => ({ authenticated: false }));
            if (!auth.authenticated) {
                setState({ loading: false, authenticated: false });
                return;
            }
            await refresh();
        };
        void load();
    }, []);

    const currentItem = state.center?.items.find((item) => item.credentialType === props.credentialType);
    const isVerified = state.center?.kycStatus === "VERIFIED";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                <Link to="/member" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                    返回身份中心
                </Link>
                {state.authenticated && isVerified ? (
                    <CredentialApplicationShell
                        credentialType={props.credentialType}
                        title={props.title}
                        description={props.description}
                        primaryFields={props.primaryFields}
                        currentItem={currentItem}
                        currentDetail={state.detail ?? undefined}
                        onRefresh={refresh}
                    />
                ) : null}
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 2: Rebuild the shell into explicit edit-mode, smart-loading, and snapshot-mode states**

```tsx
type ConfirmAction = "SMART_SUBMIT" | "MANUAL_SUBMIT" | "STOP_REVIEW" | "ACTIVATE" | null;

export default function CredentialApplicationShell(props: Props) {
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState("");
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [smartLoading, setSmartLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

    const detail = props.currentDetail;
    const snapshotMode = Boolean(detail && detail.displayStatus !== "SMART_REVIEWING");
    const showStopButton = detail?.canStopReview ?? false;
    const showRestartButton = detail?.canRestartReview ?? false;
    const showActivateButton = detail?.canActivate ?? false;

    const resetDraft = () => {
        setFormValues({});
        setNotes("");
        setMainDoc(null);
        setSupportDoc(null);
    };

    const confirmSmartSubmit = async () => {
        setConfirmAction(null);
        setSmartLoading(true);
        await props.onSubmitSmart(formValues, notes, mainDoc!, supportDoc ?? undefined);
        await props.onRefresh();
        resetDraft();
        setSmartLoading(false);
    };

    const confirmManualSubmit = async () => {
        setConfirmAction(null);
        await props.onSubmitManual(formValues, notes, mainDoc!, supportDoc ?? undefined);
        await props.onRefresh();
        resetDraft();
    };

    const confirmStop = async () => {
        setConfirmAction(null);
        await props.onStopReview(detail!.submissionId);
        await props.onRefresh();
    };

    const confirmActivate = async () => {
        setConfirmAction(null);
        await props.onActivate(detail!.submissionId);
        await props.onRefresh();
    };
}
```

- [ ] **Step 3: Render the manual-review CTA as copy under the smart button, aligned to the right**

```tsx
<div className="space-y-3">
    <button type="submit" className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
        送出智能審核
    </button>
    <p className="text-right text-sm leading-[1.8] text-on-surface-variant">
        可以選擇
        <button
            type="button"
            onClick={() => setConfirmAction("MANUAL_SUBMIT")}
            className="mx-1 font-semibold text-on-surface underline underline-offset-4"
        >
            人工審核
        </button>
        ，將會耗時較久
    </p>
</div>
```

- [ ] **Step 4: Render the read-only snapshot page and only the actions allowed for that state**

```tsx
{smartLoading ? (
    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 text-sm leading-[1.8] text-on-surface-variant">
        智能審核中，系統正在整理結果，完成後會直接更新本頁。
    </section>
) : snapshotMode && detail ? (
    <>
        <CredentialSubmissionSnapshot
            fields={props.primaryFields.map(({ key, label }) => ({ key, label }))}
            values={detail.formPayload}
            notes={detail.notes}
            mainFileUrl={detail.mainFileUrl}
            supportFileUrl={detail.supportFileUrl}
        />

        <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <div className="space-y-3">
                {showStopButton ? (
                    <button type="button" onClick={() => setConfirmAction("STOP_REVIEW")} className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface">
                        停止審核
                    </button>
                ) : null}
                {showRestartButton ? (
                    <button type="button" onClick={resetDraft} className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface">
                        重新審核
                    </button>
                ) : null}
                {showActivateButton ? (
                    <button type="button" onClick={() => setConfirmAction("ACTIVATE")} className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
                        啟用身份
                    </button>
                ) : null}
            </div>
        </section>
    </>
) : (
    <form onSubmit={(event) => { event.preventDefault(); setConfirmAction("SMART_SUBMIT"); }} className="space-y-6">
        {/* existing editable fields */}
    </form>
)}
```

- [ ] **Step 5: Collapse the three role pages into simple wrappers over the shared role-page container**

```tsx
// OwnerCredentialPage.tsx
import CredentialRolePage from "@/components/credential/CredentialRolePage";

const OWNER_FIELDS = [
    { key: "holderName", label: "持有人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "propertyAddress", label: "房屋地址", placeholder: "請填寫本次申請對應的房屋地址" },
    { key: "ownershipDocNo", label: "權狀字號", placeholder: "可填寫文件上的權狀字號" },
];

export default function OwnerCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="OWNER"
            title="屋主身份認證"
            description="提交權狀與相關文件後，可先走智能審核；若不採用智能結果，也可自行改走人工審核。通過後是否啟用身份 NFT，仍由你最後決定。"
            primaryFields={OWNER_FIELDS}
        />
    );
}
```

```tsx
// TenantCredentialPage.tsx
const TENANT_FIELDS = [
    { key: "holderName", label: "申請人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "employerOrSchool", label: "任職公司或就讀學校", placeholder: "例如：屋柱科技股份有限公司" },
    { key: "incomeHint", label: "收入或支付能力說明", placeholder: "例如：每月固定薪資 60,000 元" },
];
```

```tsx
// AgentCredentialPage.tsx
const AGENT_FIELDS = [
    { key: "holderName", label: "執業人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "licenseNumber", label: "證照字號", placeholder: "例如：ABC123456" },
    { key: "brokerageName", label: "服務品牌或公司", placeholder: "例如：屋柱安心仲介" },
];
```

- [ ] **Step 6: Update identity center so `STOPPED` has an explicit label and explanation**

```tsx
case "STOPPED":
    return {
        label: "重新審核",
        description: "這筆人工審核已停止，若要繼續需重新開一筆新的申請。",
        onClick: () => navigate(fallbackPath),
    };
```

- [ ] **Step 7: Run frontend verification for the integrated role flow**

Run: `npm run lint`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 8: Commit the role-flow checkpoint**

```bash
git add -- react-service/src/components/credential/CredentialRolePage.tsx react-service/src/components/credential/CredentialApplicationShell.tsx react-service/src/pages/OwnerCredentialPage.tsx react-service/src/pages/TenantCredentialPage.tsx react-service/src/pages/AgentCredentialPage.tsx react-service/src/pages/IdentityCenterPage.tsx
git commit -m "feat: refine gate 1a credential role flow"
```

### Task 5: Sync Project Docs And Run Full Verification + Manual Smoke

**Files:**
- Modify: `docs/開發規劃書.md`
- Create: `dev_log/2026-04-23.md`

- [ ] **Step 1: Update the project roadmap doc to record the Gate 1A UX refinement**

```markdown
## Gate 1A UX 補強

- 三個身份頁已改為「表單送件 -> 唯讀成品頁」模式
- 智能審核為主路徑，送出後顯示 loading 到結果
- 人工審核可在等待中停止，停止後進入 `已停止審核`
- `已停止審核` 與 `未通過` 皆可重新審核，且會重開空白表單
- 啟用身份前需再次確認，確認後才鑄造 NFT
```

- [ ] **Step 2: Add a dated development log entry for implementation, verification, and local run notes**

```markdown
# 2026-04-23

## Gate 1A Credential UX Refinement

- 補上身份申請文件預覽圖
- 補上智能審核、人工審核、停止審核、啟用身份四種確認彈窗
- 送件後改為唯讀成品頁
- 新增 `STOPPED` 狀態與手動停止人工審核 API
- 重新審核會保留舊 submission，但前台重開空白表單

## Verification

- `go test ./...`
- `go build ./...`
- `npm run lint`
- `npm run build`
```

- [ ] **Step 3: Run the full automated verification suite**

Run: `go test ./...`  
Expected: PASS.

Run: `go build ./...`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

Run: `git diff --stat`  
Expected: Only the files listed in this plan are changed.

- [ ] **Step 4: Execute the manual smoke checklist**

```text
1. 重新登入後進入 `/credential/owner`，上傳主文件與補充文件，確認兩張預覽圖都立即出現。
2. 點擊 `送出智能審核`，先看到確認彈窗；確認後看到 `智能審核中` loading，最後自動切成結果頁。
3. 智能審核結果若為 `未通過`，點 `重新審核` 後回到全新空白表單，資料與檔案都被清空。
4. 點人工審核文案中的 `[人工審核]`，先看到確認彈窗；確認後切到 `人工審核中` 唯讀成品頁。
5. 在 `人工審核中` 頁面只能看到成品與 `停止審核`，不可直接編輯原表單。
6. 點 `停止審核`，先看到確認彈窗；確認後狀態變成 `已停止審核`，並出現 `重新審核`。
7. 重新整理頁面後，最新 submission 的表單資料與文件預覽仍正確回顯。
8. 在 `已通過，待啟用` 狀態點 `啟用身份`，先看到確認彈窗；確認後完成 NFT 啟用並顯示 `activationTxHash`。
9. 身份中心中若某個角色為 `STOPPED`，卡片文案會引導重新審核，不會誤顯示成 `未通過`。
```

- [ ] **Step 5: Commit the docs + verification checkpoint**

```bash
git add -- docs/開發規劃書.md dev_log/2026-04-23.md
git commit -m "docs: record gate 1a credential ux refinement"
```
