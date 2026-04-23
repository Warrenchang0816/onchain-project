# Smart Review Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TENANT smart review false-failure caused by OCR misreading rare Chinese characters, and expose per-check results to the frontend so users understand why a review failed.

**Architecture:** Two independent improvements — (1) replace exact name matching in `review.go` with a 2-character sliding-window partial match so a single OCR-misread character no longer fails the whole check; (2) add a `checks` field to `CredentialSubmissionDetailResponse` and render it in `CredentialSubmissionSnapshot` so users see `keyword: PASS / nameMatch: FAIL` instead of a generic failure message.

**Tech Stack:** Go 1.25 (backend), React 19 + TypeScript 5 (frontend), Tailwind CSS utility classes from the existing design system.

---

## File Map

| File | Change |
|------|--------|
| `go-service/internal/modules/credential/review.go` | Add `partialNameMatch()`, replace `strings.Contains` name check |
| `go-service/internal/modules/credential/review_test.go` | Add 2 tests for OCR-mismatch tolerance |
| `go-service/internal/modules/credential/dto.go` | Add `Checks map[string]string` field to `CredentialSubmissionDetailResponse` |
| `go-service/internal/modules/credential/service.go` | Populate `Checks` in `buildSubmissionDetail` by parsing `CheckResultJSON` |
| `react-service/src/api/credentialApi.ts` | Add `checks?: Record<string, string>` to `CredentialSubmissionDetail` type |
| `react-service/src/components/credential/CredentialSubmissionSnapshot.tsx` | Add optional `checks` prop, render check-result section |
| `react-service/src/components/credential/CredentialApplicationShell.tsx` | Pass `checks={detail.checks}` to `CredentialSubmissionSnapshot` |

---

### Task 1: Partial name matching in review engine

**Context:** `review.go:35` currently does `strings.Contains(combined, normalizeReviewText(subjectName))`. If OCR misreads a single rare character (e.g., "徫" → "偉"), the entire `nameMatch` fails. A 2-character sliding window means "張期徫" will match if OCR returns "張期偉" because the bigram "張期" is still correct.

**Files:**
- Modify: `go-service/internal/modules/credential/review.go` (lines 35, 148–155 area — add new function)
- Modify: `go-service/internal/modules/credential/review_test.go` (add 2 test cases after existing tests)

- [ ] **Step 1: Add the failing tests**

Append to `go-service/internal/modules/credential/review_test.go`:

```go
func TestEvaluateSmartReviewTenantPassesWhenOCRMisreadsOneCharacter(t *testing.T) {
	// KYCName has rare character "徫"; OCR returns "偉" instead — bigram "張期" still matches
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeTenant,
		KYCName:        "張期徫",
		MainOCRText:    "在職證明 薪資 張期偉 2026/04",
	})

	if decision.ReviewStatus != CredentialReviewPassed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s (OCR mismatch on last char should still pass)", decision.ReviewStatus, CredentialReviewPassed)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s (bigram '張期' should match)", decision.Checks["nameMatch"], checkPass)
	}
}

func TestEvaluateSmartReviewTenantFailsWhenNameCompletelyAbsent(t *testing.T) {
	// OCR text has correct keywords but a completely different name — should still fail
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeTenant,
		KYCName:        "張期徫",
		MainOCRText:    "在職證明 薪資 李明德 2026/04",
	})

	if decision.ReviewStatus != CredentialReviewFailed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s (completely wrong name should fail)", decision.ReviewStatus, CredentialReviewFailed)
	}
	if decision.Checks["nameMatch"] != checkFail {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkFail)
	}
}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd go-service && go test ./internal/modules/credential/... -run "TestEvaluateSmartReviewTenantPassesWhenOCRMisreads|TestEvaluateSmartReviewTenantFailsWhenNameCompletely" -v
```

Expected: both tests FAIL (function not changed yet).

- [ ] **Step 3: Add `partialNameMatch` to review.go and replace line 35**

In `go-service/internal/modules/credential/review.go`, replace line 35:

```go
// Before:
nameMatch := subjectName != "" && strings.Contains(combined, normalizeReviewText(subjectName))

// After:
nameMatch := partialNameMatch(subjectName, combined)
```

Then append the new helper at the bottom of `review.go` (after `firstNonEmpty`):

```go
// partialNameMatch returns true if any consecutive 2-character bigram from name
// appears in combined (both already normalised via normalizeReviewText).
// A 2-char sliding window tolerates one OCR-misread character at the end of a
// 3-char name without losing the whole match.
func partialNameMatch(name, combined string) bool {
	if name == "" {
		return false
	}
	runes := []rune(name)
	if len(runes) < 2 {
		return strings.Contains(combined, normalizeReviewText(name))
	}
	for i := 0; i <= len(runes)-2; i++ {
		bigram := normalizeReviewText(string(runes[i : i+2]))
		if strings.Contains(combined, bigram) {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: Run all credential tests — verify they pass**

```bash
cd go-service && go test ./internal/modules/credential/... -v
```

Expected: ALL tests PASS including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add go-service/internal/modules/credential/review.go go-service/internal/modules/credential/review_test.go
git commit -m "fix: use bigram partial match in smart review name check to tolerate OCR character errors"
```

---

### Task 2: Expose check results in submission detail API

**Context:** `credential_submissions.check_result_json` stores `{"keyword":"PASS","nameMatch":"FAIL"}` after every smart review. `CredentialSubmissionDetailResponse` currently omits it. Adding it lets the frontend show the per-check breakdown.

**Files:**
- Modify: `go-service/internal/modules/credential/dto.go` (add `Checks` field)
- Modify: `go-service/internal/modules/credential/service.go` (`buildSubmissionDetail`, parse `CheckResultJSON`)

- [ ] **Step 1: Add `Checks` to the DTO**

In `go-service/internal/modules/credential/dto.go`, update `CredentialSubmissionDetailResponse` — add the `Checks` field after `Summary`:

```go
type CredentialSubmissionDetailResponse struct {
	SubmissionID     int64             `json:"submissionId"`
	CredentialType   string            `json:"credentialType"`
	ReviewRoute      string            `json:"reviewRoute"`
	DisplayStatus    string            `json:"displayStatus"`
	FormPayload      map[string]string `json:"formPayload"`
	Notes            string            `json:"notes"`
	Summary          *string           `json:"summary,omitempty"`
	Checks           map[string]string `json:"checks,omitempty"`
	MainFileURL      *string           `json:"mainFileUrl,omitempty"`
	SupportFileURL   *string           `json:"supportFileUrl,omitempty"`
	CanStopReview    bool              `json:"canStopReview"`
	CanRestartReview bool              `json:"canRestartReview"`
	CanActivate      bool              `json:"canActivate"`
	ActivationTxHash *string           `json:"activationTxHash,omitempty"`
}
```

- [ ] **Step 2: Populate `Checks` in `buildSubmissionDetail`**

In `go-service/internal/modules/credential/service.go`, inside `buildSubmissionDetail`, add the following block directly after the `Summary` block (around line 73–75):

```go
if raw := strings.TrimSpace(sub.CheckResultJSON); raw != "" && raw != "{}" {
    checks := map[string]string{}
    if jsonErr := json.Unmarshal([]byte(raw), &checks); jsonErr == nil && len(checks) > 0 {
        detail.Checks = checks
    }
}
```

`encoding/json` is already imported in `service.go` — no new import needed.

- [ ] **Step 3: Build the Go service to verify it compiles**

```bash
cd go-service && go build ./...
```

Expected: exits 0 with no errors.

- [ ] **Step 4: Commit**

```bash
git add go-service/internal/modules/credential/dto.go go-service/internal/modules/credential/service.go
git commit -m "feat: expose check result breakdown in credential submission detail response"
```

---

### Task 3: Display check results in the frontend snapshot

**Context:** `CredentialSubmissionDetail` type and `CredentialSubmissionSnapshot` component need a `checks` field. When a FAILED smart review result is displayed, the user will see a table like "關鍵字符合 ✓ 通過 / 姓名比對 ✗ 未通過" instead of a generic summary.

**Files:**
- Modify: `react-service/src/api/credentialApi.ts` (add `checks?` to type)
- Modify: `react-service/src/components/credential/CredentialSubmissionSnapshot.tsx` (add checks section)
- Modify: `react-service/src/components/credential/CredentialApplicationShell.tsx` (pass `checks` prop)

- [ ] **Step 1: Add `checks` to the API type**

In `react-service/src/api/credentialApi.ts`, update `CredentialSubmissionDetail` — add `checks?` after `summary?`:

```typescript
export type CredentialSubmissionDetail = {
    submissionId: number;
    credentialType: CredentialType;
    reviewRoute: CredentialReviewRoute;
    displayStatus: CredentialDisplayStatus;
    formPayload: Record<string, string>;
    notes: string;
    summary?: string;
    checks?: Record<string, string>;
    mainFileUrl?: string;
    supportFileUrl?: string;
    canStopReview: boolean;
    canRestartReview: boolean;
    canActivate: boolean;
    activationTxHash?: string;
};
```

- [ ] **Step 2: Add checks section to `CredentialSubmissionSnapshot`**

Replace the full contents of `react-service/src/components/credential/CredentialSubmissionSnapshot.tsx` with:

```tsx
const CHECK_LABELS: Record<string, string> = {
    keyword: "關鍵字符合",
    nameMatch: "姓名比對",
    addressHint: "地址提供",
    licenseNumber: "證照號碼比對",
    credentialType: "身份類型",
};

type Props = {
    fields: Array<{ key: string; label: string }>;
    values: Record<string, string>;
    notes: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
    checks?: Record<string, string>;
};

function SnapshotField(props: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{props.label}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.8] text-on-surface">
                {props.value || "未填寫"}
            </div>
        </div>
    );
}

function SnapshotImageCard(props: { title: string; imageUrl?: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{props.title}</div>
            {props.imageUrl ? (
                <div className="mt-3 flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/15 bg-white p-4">
                    <img src={props.imageUrl} alt={props.title} className="block max-h-[380px] w-full object-contain" />
                </div>
            ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-outline-variant/20 bg-surface px-4 py-12 text-center text-sm text-on-surface-variant">
                    尚未提供文件
                </div>
            )}
        </div>
    );
}

function CheckResultPanel(props: { checks: Record<string, string> }) {
    const entries = Object.entries(props.checks);
    if (entries.length === 0) return null;
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">審核項目明細</div>
            <div className="mt-3 divide-y divide-outline-variant/10">
                {entries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                        <span className="text-sm text-on-surface">{CHECK_LABELS[key] ?? key}</span>
                        <span
                            className={`text-xs font-bold ${
                                value === "PASS" ? "text-tertiary" : "text-error"
                            }`}
                        >
                            {value === "PASS" ? "通過" : "未通過"}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function CredentialSubmissionSnapshot(props: Props) {
    return (
        <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">送件成品</div>
                    <h2 className="text-2xl font-bold text-on-surface">已送出的身份認證資料</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {props.fields.map((field) => (
                        <SnapshotField key={field.key} label={field.label} value={props.values[field.key] ?? ""} />
                    ))}
                </div>

                <SnapshotField label="補充說明" value={props.notes} />

                {props.checks && Object.keys(props.checks).length > 0 ? (
                    <CheckResultPanel checks={props.checks} />
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                    <SnapshotImageCard title="主要文件" imageUrl={props.mainFileUrl} />
                    <SnapshotImageCard title="補充文件" imageUrl={props.supportFileUrl} />
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 3: Pass `checks` from `CredentialApplicationShell`**

In `react-service/src/components/credential/CredentialApplicationShell.tsx`, find the `<CredentialSubmissionSnapshot` block (around line 343) and add the `checks` prop:

```tsx
<CredentialSubmissionSnapshot
    fields={props.primaryFields.map((field) => ({ key: field.key, label: field.label }))}
    values={detail.formPayload}
    notes={detail.notes}
    checks={detail.checks}
    mainFileUrl={
        detail.mainFileUrl
            ? getCredentialSubmissionFileUrl(props.credentialType, detail.submissionId, "main")
            : undefined
    }
    supportFileUrl={
        detail.supportFileUrl
            ? getCredentialSubmissionFileUrl(props.credentialType, detail.submissionId, "support")
            : undefined
    }
/>
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd react-service && npm run build 2>&1 | head -40
```

Expected: exits 0 (or only unrelated warnings, no new TS errors).

- [ ] **Step 5: Commit**

```bash
git add react-service/src/api/credentialApi.ts react-service/src/components/credential/CredentialSubmissionSnapshot.tsx react-service/src/components/credential/CredentialApplicationShell.tsx
git commit -m "feat: show smart review check breakdown in submission snapshot"
```

---

### Task 4: Rebuild Go service and smoke-test end-to-end

- [ ] **Step 1: Rebuild and restart Go service**

```bash
cd go-service && docker compose up --build -d
```

Expected: container restarts cleanly, no build errors in logs.

- [ ] **Step 2: Verify Go service logs are clean**

```bash
cd go-service && docker compose logs --tail=30
```

Expected: no panic, no port conflict, service listening on :8080.

- [ ] **Step 3: Commit done marker (if needed)**

If no additional files were changed, this task needs no commit. Otherwise:
```bash
git add <any changed file>
git commit -m "chore: rebuild go service after smart review changes"
```
