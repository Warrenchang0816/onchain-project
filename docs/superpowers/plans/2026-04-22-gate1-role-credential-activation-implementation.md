# Gate 1 Role Credential Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Gate 1A so `OWNER / TENANT / AGENT` each have a real end-to-end flow: submit evidence, choose smart review first or manual review second, receive pass/fail, optionally activate after passing, and mint the role NFT only when the user explicitly clicks activate.

**Architecture:** Reuse the current KYC module shape instead of inventing a parallel architecture. Add a new `credential_submissions` write model for role applications, keep `user_credentials` as the issued/read model, extend the existing `IdentityNFT` Go contract client for `mintCredential`, and add a dedicated `credential` module plus `CredentialMinted` worker. On the frontend, build one shared credential application shell and three separate role pages, while keeping Gate 0 listing/booking permissions unchanged until Gate 1B.

**Tech Stack:** Go 1.25 + Gin + PostgreSQL + existing MinIO/Vision/indexer stack, React 19 + TypeScript + Vite, ERC-1155 `IdentityNFT`, existing fetch-based API client pattern.

---

## File Structure

- Create: `infra/init/08-credential-submissions.sql`
- Modify: `infra/init/04-onboarding.sql`
- Modify: `infra/reset_identity.sql`
- Create: `go-service/internal/db/model/credential_submission_model.go`
- Modify: `go-service/internal/db/model/kyc_session_model.go`
- Create: `go-service/internal/db/repository/credential_submission_repo.go`
- Modify: `go-service/internal/db/repository/user_credential_repo.go`
- Create: `go-service/internal/modules/credential/domain.go`
- Create: `go-service/internal/modules/credential/domain_test.go`
- Create: `go-service/internal/modules/credential/review.go`
- Create: `go-service/internal/modules/credential/review_test.go`
- Create: `go-service/internal/modules/credential/dto.go`
- Create: `go-service/internal/modules/credential/service.go`
- Create: `go-service/internal/modules/credential/handler.go`
- Create: `go-service/internal/modules/credential/admin_handler.go`
- Create: `go-service/internal/modules/credential/event_handler.go`
- Modify: `go-service/internal/modules/user/identity_contract.go`
- Modify: `go-service/internal/bootstrap/wiring.go`
- Modify: `go-service/internal/bootstrap/router.go`
- Create: `react-service/src/api/credentialApi.ts`
- Create: `react-service/src/components/credential/CredentialDocumentUploader.tsx`
- Create: `react-service/src/components/credential/CredentialStatusPanel.tsx`
- Create: `react-service/src/components/credential/CredentialApplicationShell.tsx`
- Create: `react-service/src/pages/OwnerCredentialPage.tsx`
- Create: `react-service/src/pages/TenantCredentialPage.tsx`
- Create: `react-service/src/pages/AgentCredentialPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`
- Modify: `react-service/src/router/index.tsx`
- Modify: `docs/開發規劃書.md`
- Modify: `docs/database/relational-database-spec.md`
- Modify: `docs/database/relational-database-spec.csv`
- Modify: `dev_log/2026-04-22.md`

## Verification Rule

- Do not add a new frontend test framework in Gate 1A. Frontend verification remains `npm run lint`, `npm run build`, and manual smoke checks.
- Backend TDD in this Gate should focus on pure domain helpers and smart-review rules so we get stable automated coverage without fighting DB/network setup.
- Manual review closes the loop through authenticated admin APIs, not a new admin web console in this Gate.
- Gate 1B permission cutover is explicitly out of scope. `listing create` and `appointment booking` remain KYC-gated until this Gate is finished and separately accepted.
- Gate 1A smart review should stay on the existing image-upload OCR path (`jpg/png`) to match the current KYC infrastructure. PDF support can wait.

### Task 1: Add Credential Submission Storage And Domain State

**Files:**
- Create: `infra/init/08-credential-submissions.sql`
- Modify: `infra/init/04-onboarding.sql`
- Modify: `infra/reset_identity.sql`
- Create: `go-service/internal/db/model/credential_submission_model.go`
- Modify: `go-service/internal/db/model/kyc_session_model.go`
- Create: `go-service/internal/db/repository/credential_submission_repo.go`
- Modify: `go-service/internal/db/repository/user_credential_repo.go`
- Create: `go-service/internal/modules/credential/domain.go`
- Create: `go-service/internal/modules/credential/domain_test.go`

- [ ] **Step 1: Write the failing domain tests for type normalization and activation guards**

```go
package credential

import (
	"testing"

	"go-service/internal/db/model"
)

func TestNormalizeTypeAndTokenID(t *testing.T) {
	cases := []struct {
		input string
		want  string
		token int64
	}{
		{input: "owner", want: TypeOwner, token: model.NFTTokenOwner},
		{input: "TENANT", want: TypeTenant, token: model.NFTTokenTenant},
		{input: "Agent", want: TypeAgent, token: model.NFTTokenAgent},
	}

	for _, tc := range cases {
		got, err := NormalizeType(tc.input)
		if err != nil {
			t.Fatalf("NormalizeType(%q) returned error: %v", tc.input, err)
		}
		if got != tc.want {
			t.Fatalf("NormalizeType(%q) = %q, want %q", tc.input, got, tc.want)
		}
		token, err := TokenIDForType(got)
		if err != nil || token != tc.token {
			t.Fatalf("TokenIDForType(%q) = (%d, %v), want (%d, nil)", got, token, err, tc.token)
		}
	}

	if _, err := NormalizeType("broker"); err == nil {
		t.Fatal("expected invalid type error for broker")
	}
}

func TestEnsureActivatable(t *testing.T) {
	sub := &model.CredentialSubmission{
		CredentialType:   TypeOwner,
		ReviewStatus:     ReviewStatusPassed,
		ActivationStatus: ActivationStatusReady,
	}

	if err := EnsureActivatable(sub, false, false); err != nil {
		t.Fatalf("expected ready submission to activate, got %v", err)
	}
	if err := EnsureActivatable(sub, true, false); err == nil {
		t.Fatal("expected duplicate credential guard")
	}
	if err := EnsureActivatable(sub, false, true); err == nil {
		t.Fatal("expected superseded submission guard")
	}
}
```

- [ ] **Step 2: Implement `domain.go` so every later task shares one source of truth**

```go
const (
	TypeOwner  = "OWNER"
	TypeTenant = "TENANT"
	TypeAgent  = "AGENT"

	ReviewRouteSmart  = "SMART"
	ReviewRouteManual = "MANUAL"

	ReviewStatusSmartReviewing  = "SMART_REVIEWING"
	ReviewStatusManualReviewing = "MANUAL_REVIEWING"
	ReviewStatusPassed          = "PASSED"
	ReviewStatusFailed          = "FAILED"

	ActivationStatusNotReady   = "NOT_READY"
	ActivationStatusReady      = "READY"
	ActivationStatusActivated  = "ACTIVATED"
	ActivationStatusSuperseded = "SUPERSEDED"
)

func NormalizeType(raw string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case TypeOwner:
		return TypeOwner, nil
	case TypeTenant:
		return TypeTenant, nil
	case TypeAgent:
		return TypeAgent, nil
	default:
		return "", fmt.Errorf("unsupported credential type %q", raw)
	}
}

func TokenIDForType(credentialType string) (int64, error) {
	switch credentialType {
	case TypeOwner:
		return model.NFTTokenOwner, nil
	case TypeTenant:
		return model.NFTTokenTenant, nil
	case TypeAgent:
		return model.NFTTokenAgent, nil
	default:
		return 0, fmt.Errorf("unsupported credential type %q", credentialType)
	}
}

func TypeForTokenID(tokenID int64) (string, error) {
	switch tokenID {
	case model.NFTTokenOwner:
		return TypeOwner, nil
	case model.NFTTokenTenant:
		return TypeTenant, nil
	case model.NFTTokenAgent:
		return TypeAgent, nil
	default:
		return "", fmt.Errorf("unsupported credential token id %d", tokenID)
	}
}

func EnsureActivatable(sub *model.CredentialSubmission, hasActiveCredential bool, superseded bool) error {
	if sub == nil {
		return errors.New("submission not found")
	}
	if sub.ReviewStatus != ReviewStatusPassed || sub.ActivationStatus != ActivationStatusReady {
		return errors.New("only passed submissions waiting for activation can be activated")
	}
	if hasActiveCredential {
		return errors.New("credential already activated")
	}
	if superseded {
		return errors.New("only the latest passed submission can be activated")
	}
	return nil
}
```

- [ ] **Step 3: Add the new table and extend the existing read model for revoked state**

```sql
CREATE TABLE IF NOT EXISTS credential_submissions (
    id                          BIGSERIAL PRIMARY KEY,
    user_id                     BIGINT      NOT NULL REFERENCES users(id),
    credential_type             VARCHAR(20) NOT NULL,
    review_route                VARCHAR(20) NOT NULL,
    review_status               VARCHAR(30) NOT NULL,
    activation_status           VARCHAR(20) NOT NULL DEFAULT 'NOT_READY',
    form_payload_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    main_doc_path               VARCHAR(512) DEFAULT NULL,
    support_doc_path            VARCHAR(512) DEFAULT NULL,
    notes                       TEXT        NOT NULL DEFAULT '',
    ocr_text_main               TEXT        NOT NULL DEFAULT '',
    ocr_text_support            TEXT        NOT NULL DEFAULT '',
    check_result_json           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    decision_summary            TEXT        NOT NULL DEFAULT '',
    reviewer_note               TEXT        NOT NULL DEFAULT '',
    reviewed_by_wallet          VARCHAR(255) DEFAULT NULL,
    decided_at                  TIMESTAMPTZ DEFAULT NULL,
    activated_at                TIMESTAMPTZ DEFAULT NULL,
    activation_tx_hash          VARCHAR(66) DEFAULT NULL,
    activation_token_id         INT         DEFAULT NULL,
    superseded_by_submission_id BIGINT      DEFAULT NULL REFERENCES credential_submissions(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_submissions_user_type
    ON credential_submissions (user_id, credential_type, created_at DESC);

ALTER TABLE user_credentials
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS revoked_reason TEXT NOT NULL DEFAULT '';
```

```sql
-- infra/reset_identity.sql
DELETE FROM credential_submissions;
DELETE FROM user_credentials;
```

- [ ] **Step 3: Add the model and repository for the new write model**
- [ ] **Step 4: Add the model and repository for the new write model**

```go
package model

import "time"

type CredentialSubmission struct {
	ID                       int64
	UserID                   int64
	CredentialType           string
	ReviewRoute              string
	ReviewStatus             string
	ActivationStatus         string
	FormPayloadJSON          string
	MainDocPath              string
	SupportDocPath           string
	Notes                    string
	OCRTextMain              string
	OCRTextSupport           string
	CheckResultJSON          string
	DecisionSummary          string
	ReviewerNote             string
	ReviewedByWallet         string
	DecidedAt                *time.Time
	ActivatedAt              *time.Time
	ActivationTxHash         string
	ActivationTokenID        *int32
	SupersededBySubmissionID *int64
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

const (
	CredentialReviewPending  = "PENDING"
	CredentialReviewVerified = "VERIFIED"
	CredentialReviewRejected = "REJECTED"
	CredentialReviewRevoked  = "REVOKED"
)
```

```go
type CredentialSubmissionRepository struct {
	db *sql.DB
}

func (r *CredentialSubmissionRepository) Create(userID int64, credentialType, reviewRoute, formPayload, notes string) (int64, error) {
	var id int64
	err := r.db.QueryRow(`
		INSERT INTO credential_submissions (user_id, credential_type, review_route, review_status, form_payload_json, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, userID, credentialType, reviewRoute, ReviewStatusSmartReviewing, formPayload, notes).Scan(&id)
	return id, err
}

func (r *CredentialSubmissionRepository) SetFiles(id int64, mainDocPath, supportDocPath string) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET main_doc_path = $1, support_doc_path = $2, updated_at = NOW()
		WHERE id = $3
	`, mainDocPath, supportDocPath, id)
	return err
}

func (r *CredentialSubmissionRepository) SaveDecision(id int64, reviewStatus, activationStatus, ocrMain, ocrSupport, checksJSON, summary string) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_status = $1,
		    activation_status = $2,
		    ocr_text_main = $3,
		    ocr_text_support = $4,
		    check_result_json = $5::jsonb,
		    decision_summary = $6,
		    decided_at = NOW(),
		    updated_at = NOW()
		WHERE id = $7
	`, reviewStatus, activationStatus, ocrMain, ocrSupport, checksJSON, summary, id)
	return err
}

func (r *CredentialSubmissionRepository) MarkManualReview(id int64) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET review_route = $1, review_status = $2, activation_status = $3, updated_at = NOW()
		WHERE id = $4
	`, ReviewRouteManual, ReviewStatusManualReviewing, ActivationStatusNotReady, id)
	return err
}

func (r *CredentialSubmissionRepository) MarkActivated(id int64, txHash string, tokenID int32) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET activation_status = $1,
		    activated_at = NOW(),
		    activation_tx_hash = $2,
		    activation_token_id = $3,
		    updated_at = NOW()
		WHERE id = $4
	`, ActivationStatusActivated, txHash, tokenID, id)
	return err
}

func (r *CredentialSubmissionRepository) MarkOlderSubmissionsSuperseded(userID int64, credentialType string, exceptID int64) error {
	_, err := r.db.Exec(`
		UPDATE credential_submissions
		SET activation_status = $1, superseded_by_submission_id = $2, updated_at = NOW()
		WHERE user_id = $3 AND credential_type = $4 AND id <> $2 AND activation_status <> $5
	`, ActivationStatusSuperseded, exceptID, userID, credentialType, ActivationStatusActivated)
	return err
}

func (r *CredentialSubmissionRepository) FindLatestByUserAndType(userID int64, credentialType string) (*model.CredentialSubmission, error) {
	row := r.db.QueryRow(`
		SELECT id, user_id, credential_type, review_route, review_status, activation_status,
		       form_payload_json::text, COALESCE(main_doc_path, ''), COALESCE(support_doc_path, ''),
		       notes, ocr_text_main, ocr_text_support, check_result_json::text, decision_summary,
		       reviewer_note, COALESCE(reviewed_by_wallet, ''), decided_at, activated_at,
		       COALESCE(activation_tx_hash, ''), activation_token_id, superseded_by_submission_id,
		       created_at, updated_at
		FROM credential_submissions
		WHERE user_id = $1 AND credential_type = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, credentialType)
	return scanCredentialSubmission(row)
}

func (r *CredentialSubmissionRepository) FindPendingManual(limit, offset int) ([]*model.CredentialSubmission, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, credential_type, review_route, review_status, activation_status,
		       form_payload_json::text, COALESCE(main_doc_path, ''), COALESCE(support_doc_path, ''),
		       notes, ocr_text_main, ocr_text_support, check_result_json::text, decision_summary,
		       reviewer_note, COALESCE(reviewed_by_wallet, ''), decided_at, activated_at,
		       COALESCE(activation_tx_hash, ''), activation_token_id, superseded_by_submission_id,
		       created_at, updated_at
		FROM credential_submissions
		WHERE review_status = $1
		ORDER BY created_at ASC
		LIMIT $2 OFFSET $3
	`, ReviewStatusManualReviewing, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCredentialSubmissionRows(rows)
}

func scanCredentialSubmission(row *sql.Row) (*model.CredentialSubmission, error) {
	var item model.CredentialSubmission
	err := row.Scan(
		&item.ID, &item.UserID, &item.CredentialType, &item.ReviewRoute, &item.ReviewStatus, &item.ActivationStatus,
		&item.FormPayloadJSON, &item.MainDocPath, &item.SupportDocPath,
		&item.Notes, &item.OCRTextMain, &item.OCRTextSupport, &item.CheckResultJSON, &item.DecisionSummary,
		&item.ReviewerNote, &item.ReviewedByWallet, &item.DecidedAt, &item.ActivatedAt,
		&item.ActivationTxHash, &item.ActivationTokenID, &item.SupersededBySubmissionID,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func scanCredentialSubmissionRows(rows *sql.Rows) ([]*model.CredentialSubmission, error) {
	items := []*model.CredentialSubmission{}
	for rows.Next() {
		var item model.CredentialSubmission
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.CredentialType, &item.ReviewRoute, &item.ReviewStatus, &item.ActivationStatus,
			&item.FormPayloadJSON, &item.MainDocPath, &item.SupportDocPath,
			&item.Notes, &item.OCRTextMain, &item.OCRTextSupport, &item.CheckResultJSON, &item.DecisionSummary,
			&item.ReviewerNote, &item.ReviewedByWallet, &item.DecidedAt, &item.ActivatedAt,
			&item.ActivationTxHash, &item.ActivationTokenID, &item.SupersededBySubmissionID,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, &item)
	}
	return items, rows.Err()
}
```

- [ ] **Step 5: Extend `user_credentials` helpers so the read model can be upserted and revoked safely**

```go
func (r *UserCredentialRepository) UpsertIssuedCredential(userID int64, credentialType string, tokenID int32, txHash, reviewerWallet string) error {
	_, err := r.db.Exec(`
		INSERT INTO user_credentials (user_id, credential_type, review_status, nft_token_id, tx_hash, reviewed_by_wallet, verified_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (user_id, credential_type) DO UPDATE
		SET review_status = EXCLUDED.review_status,
		    nft_token_id = EXCLUDED.nft_token_id,
		    tx_hash = EXCLUDED.tx_hash,
		    reviewed_by_wallet = EXCLUDED.reviewed_by_wallet,
		    verified_at = NOW(),
		    revoked_at = NULL,
		    revoked_reason = '',
		    updated_at = NOW()
	`, userID, credentialType, model.CredentialReviewVerified, tokenID, txHash, reviewerWallet)
	return err
}

func (r *UserCredentialRepository) SetRevoked(userID int64, credentialType, reason, reviewerWallet string) error {
	_, err := r.db.Exec(`
		UPDATE user_credentials
		SET review_status = $1, revoked_at = NOW(), revoked_reason = $2, reviewed_by_wallet = $3, updated_at = NOW()
		WHERE user_id = $4 AND credential_type = $5
	`, model.CredentialReviewRevoked, reason, reviewerWallet, userID, credentialType)
	return err
}

func (r *UserCredentialRepository) FindByUserAndType(userID int64, credentialType string) (*model.UserCredential, error) {
	row := r.db.QueryRow(`
		SELECT id, user_id, credential_type,
		       doc_path, review_status, reviewer_note, reviewed_by_wallet,
		       nft_token_id, tx_hash, verified_at, created_at, updated_at
		FROM user_credentials
		WHERE user_id = $1 AND credential_type = $2
	`, userID, credentialType)

	var c model.UserCredential
	if err := row.Scan(
		&c.ID, &c.UserID, &c.CredentialType,
		&c.DocPath, &c.ReviewStatus, &c.ReviewerNote, &c.ReviewedByWallet,
		&c.NFTTokenID, &c.TxHash, &c.VerifiedAt, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}
```

- [ ] **Step 5: Run the backend verification for the new storage/domain layer**
- [ ] **Step 6: Run the backend verification for the new storage/domain layer**

Run: `go test ./internal/modules/credential -run "TestNormalizeTypeAndTokenID|TestEnsureActivatable" -v`  
Expected: both tests pass and `go test` exits `0`.

Run: `go test ./...`  
Expected: compile passes across the repo after the new model/repository files are wired in.

- [ ] **Step 6: Commit the storage/domain checkpoint**
- [ ] **Step 7: Commit the storage/domain checkpoint**

```bash
git add -- infra/init/08-credential-submissions.sql infra/init/04-onboarding.sql infra/reset_identity.sql go-service/internal/db/model/credential_submission_model.go go-service/internal/db/model/kyc_session_model.go go-service/internal/db/repository/credential_submission_repo.go go-service/internal/db/repository/user_credential_repo.go go-service/internal/modules/credential/domain.go go-service/internal/modules/credential/domain_test.go
git commit -m "feat: add credential submission storage model"
```

### Task 2: Implement Smart Review Rules And Contract Helpers

**Files:**
- Create: `go-service/internal/modules/credential/review.go`
- Create: `go-service/internal/modules/credential/review_test.go`
- Modify: `go-service/internal/modules/user/identity_contract.go`

- [ ] **Step 1: Write the failing smart-review tests for pass/fail decisions**

```go
package credential

import "testing"

func TestEvaluateSmartReviewAgentPassesLicenseDocument(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: TypeAgent,
		KYCName:        "王小明",
		MainOCRText:    "不動產經紀營業員 登錄字號 ABC123456 王小明",
		FormPayload: map[string]string{
			"holderName":    "王小明",
			"licenseNumber": "ABC123456",
		},
	})

	if decision.ReviewStatus != ReviewStatusPassed {
		t.Fatalf("expected passed, got %s", decision.ReviewStatus)
	}
}

func TestEvaluateSmartReviewOwnerFailsWithoutOwnershipKeyword(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: TypeOwner,
		KYCName:        "王小明",
		MainOCRText:    "租賃契約 王小明",
		FormPayload: map[string]string{
			"holderName":      "王小明",
			"propertyAddress": "台北市中山區南京東路一段 1 號",
		},
	})

	if decision.ReviewStatus != ReviewStatusFailed {
		t.Fatalf("expected failed, got %s", decision.ReviewStatus)
	}
}
```

- [ ] **Step 2: Implement a result-only smart-review engine with role-specific minimum rules**

```go
type ReviewInput struct {
	CredentialType string
	KYCName        string
	KYCAddress     string
	MainOCRText    string
	SupportOCRText string
	FormPayload    map[string]string
}

type ReviewDecision struct {
	ReviewStatus string
	Summary      string
	Checks       map[string]string
}

func EvaluateSmartReview(in ReviewInput) ReviewDecision {
	combined := strings.ToUpper(in.MainOCRText + "\n" + in.SupportOCRText)
	nameMatch := strings.Contains(combined, strings.ToUpper(in.KYCName))

	switch in.CredentialType {
	case TypeOwner:
		hasOwnershipKeyword := containsAny(combined, "建物所有權狀", "所有權人", "權利範圍", "不動產")
		addressHint := strings.TrimSpace(in.FormPayload["propertyAddress"]) != ""
		if hasOwnershipKeyword && nameMatch && addressHint {
			return passedDecision("文件符合屋主最低辨識條件", map[string]string{"keyword": "PASS", "nameMatch": "PASS", "addressHint": "PASS"})
		}
		return failedDecision("文件未通過屋主最低辨識條件", map[string]string{"keyword": passOrFail(hasOwnershipKeyword), "nameMatch": passOrFail(nameMatch), "addressHint": passOrFail(addressHint)})
	case TypeTenant:
		hasTenantKeyword := containsAny(combined, "薪資", "在職", "扣繳", "勞保", "所得")
		if hasTenantKeyword && nameMatch {
			return passedDecision("文件符合租客最低辨識條件", map[string]string{"keyword": "PASS", "nameMatch": "PASS"})
		}
		return failedDecision("文件未通過租客最低辨識條件", map[string]string{"keyword": passOrFail(hasTenantKeyword), "nameMatch": passOrFail(nameMatch)})
	case TypeAgent:
		hasAgentKeyword := containsAny(combined, "不動產經紀", "營業員", "經紀人", "登錄字號", "證照")
		licenseNumber := strings.TrimSpace(in.FormPayload["licenseNumber"]) != ""
		if hasAgentKeyword && nameMatch && licenseNumber {
			return passedDecision("文件符合仲介最低辨識條件", map[string]string{"keyword": "PASS", "nameMatch": "PASS", "licenseNumber": "PASS"})
		}
		return failedDecision("文件未通過仲介最低辨識條件", map[string]string{"keyword": passOrFail(hasAgentKeyword), "nameMatch": passOrFail(nameMatch), "licenseNumber": passOrFail(licenseNumber)})
	default:
		return failedDecision("不支援的身份類型", map[string]string{"credentialType": "FAIL"})
	}
}

func containsAny(text string, values ...string) bool {
	for _, value := range values {
		if strings.Contains(text, strings.ToUpper(value)) {
			return true
		}
	}
	return false
}

func passOrFail(ok bool) string {
	if ok {
		return "PASS"
	}
	return "FAIL"
}

func passedDecision(summary string, checks map[string]string) ReviewDecision {
	return ReviewDecision{ReviewStatus: ReviewStatusPassed, Summary: summary, Checks: checks}
}

func failedDecision(summary string, checks map[string]string) ReviewDecision {
	return ReviewDecision{ReviewStatus: ReviewStatusFailed, Summary: summary, Checks: checks}
}
```

- [ ] **Step 3: Extend the existing `IdentityNFT` contract client for role activation**

```go
type IdentityContractService interface {
	Mint(ctx context.Context, to string, provider string, referenceID [32]byte, identityHash [32]byte) (string, int64, error)
	MintCredential(ctx context.Context, to string, tokenID int64) (string, error)
	HasToken(ctx context.Context, walletAddress string, tokenID int64) (bool, error)
	IsVerified(ctx context.Context, walletAddress string) (bool, error)
}

func (s *identityContractService) MintCredential(ctx context.Context, to string, tokenID int64) (string, error) {
	data, err := s.contractABI.Pack("mintCredential", common.HexToAddress(to), big.NewInt(tokenID))
	if err != nil {
		return "", fmt.Errorf("identity_contract: pack mintCredential: %w", err)
	}
	txHash, _, err := s.sendMintTransaction(ctx, data)
	return txHash, err
}

func (s *identityContractService) HasToken(ctx context.Context, walletAddress string, tokenID int64) (bool, error) {
	viewABI, err := abi.JSON(strings.NewReader(identityNFTViewABIJSON))
	if err != nil {
		return false, err
	}
	data, err := viewABI.Pack("balanceOf", common.HexToAddress(walletAddress), big.NewInt(tokenID))
	if err != nil {
		return false, err
	}
	result, err := s.client.CallContract(ctx, ethereum.CallMsg{To: &s.contractAddress, Data: data}, nil)
	if err != nil {
		return false, err
	}
	outputs, err := viewABI.Unpack("balanceOf", result)
	if err != nil || len(outputs) == 0 {
		return false, fmt.Errorf("identity_contract: unpack balanceOf: %w", err)
	}
	return outputs[0].(*big.Int).Sign() > 0, nil
}
```

```json
{
  "name": "mintCredential",
  "inputs": [
    { "internalType": "address", "name": "to", "type": "address" },
    { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

- [ ] **Step 4: Run the smart-review and contract helper verification**

Run: `go test ./internal/modules/credential -run TestEvaluateSmartReview -v`  
Expected: the review tests pass and show the expected pass/fail cases.

Run: `go test ./...`  
Expected: the repo still compiles after the `IdentityContractService` interface expands.

- [ ] **Step 5: Commit the smart-review checkpoint**

```bash
git add -- go-service/internal/modules/credential/review.go go-service/internal/modules/credential/review_test.go go-service/internal/modules/user/identity_contract.go
git commit -m "feat: add credential smart review engine"
```

### Task 3: Build The Credential Application, Review, And Activation APIs

**Files:**
- Create: `go-service/internal/modules/credential/dto.go`
- Create: `go-service/internal/modules/credential/service.go`
- Create: `go-service/internal/modules/credential/handler.go`
- Create: `go-service/internal/modules/credential/admin_handler.go`
- Modify: `go-service/internal/bootstrap/router.go`
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1: Add DTOs that expose a role-centric snapshot instead of just `credentials[]`**

```go
type CreateSubmissionRequest struct {
	Route       string            `json:"route"`
	FormPayload map[string]string `json:"formPayload"`
	Notes       string            `json:"notes"`
}

type CredentialCenterItem struct {
	CredentialType     string  `json:"credentialType"`
	DisplayStatus      string  `json:"displayStatus"`
	LatestSubmissionID *int64  `json:"latestSubmissionId,omitempty"`
	ReviewRoute        *string `json:"reviewRoute,omitempty"`
	Summary            *string `json:"summary,omitempty"`
	CanActivate        bool    `json:"canActivate"`
	CanRetrySmart      bool    `json:"canRetrySmart"`
	CanRequestManual   bool    `json:"canRequestManual"`
	ActivationTxHash   *string `json:"activationTxHash,omitempty"`
}

type CredentialCenterResponse struct {
	KYCStatus string                 `json:"kycStatus"`
	Items     []CredentialCenterItem `json:"items"`
}
```

- [ ] **Step 2: Implement service methods for create, upload, analyze, manual review, activate, and snapshot**

```go
func (s *Service) AnalyzeSubmission(ctx context.Context, wallet string, submissionID int64) (*CredentialCenterItem, error) {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return nil, err
	}
	sub, err := s.requireOwnedSubmission(user.ID, submissionID)
	if err != nil {
		return nil, err
	}
	if s.storageSvc == nil || s.visionClient == nil {
		return nil, errors.New("智能審核服務目前未啟用，請改走人工審核")
	}

	mainData, err := s.storageSvc.Download(ctx, sub.MainDocPath)
	if err != nil {
		return nil, err
	}
	mainOCR, err := s.visionClient.ExtractText(mainData)
	if err != nil {
		return nil, err
	}
	supportOCR := ""
	if sub.SupportDocPath != "" {
		supportData, err := s.storageSvc.Download(ctx, sub.SupportDocPath)
		if err != nil {
			return nil, err
		}
		supportOCR, err = s.visionClient.ExtractText(supportData)
		if err != nil {
			return nil, err
		}
	}
	formPayload, err := decodeFormPayload(sub.FormPayloadJSON)
	if err != nil {
		return nil, err
	}

	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: sub.CredentialType,
		KYCName:        nullStr(user.DisplayName),
		KYCAddress:     nullStr(user.MailingAddress),
		MainOCRText:    mainOCR,
		SupportOCRText: supportOCR,
		FormPayload:    formPayload,
	})

	activationStatus := ActivationStatusNotReady
	if decision.ReviewStatus == ReviewStatusPassed {
		activationStatus = ActivationStatusReady
	}
	checksJSON, err := json.Marshal(decision.Checks)
	if err != nil {
		return nil, err
	}
	if err := s.submissionRepo.SaveDecision(sub.ID, decision.ReviewStatus, activationStatus, mainOCR, supportOCR, string(checksJSON), decision.Summary); err != nil {
		return nil, err
	}
	if decision.ReviewStatus == ReviewStatusPassed {
		_ = s.submissionRepo.MarkOlderSubmissionsSuperseded(user.ID, sub.CredentialType, sub.ID)
	}
	return s.buildCenterItem(user.ID, sub.CredentialType)
}

func decodeFormPayload(raw string) (map[string]string, error) {
	payload := map[string]string{}
	if strings.TrimSpace(raw) == "" {
		return payload, nil
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, err
	}
	return payload, nil
}
```

```go
func (s *Service) ActivateSubmission(ctx context.Context, wallet string, submissionID int64) error {
	user, err := s.requireVerifiedUser(wallet)
	if err != nil {
		return err
	}
	sub, err := s.requireOwnedSubmission(user.ID, submissionID)
	if err != nil {
		return err
	}
	activeCred, err := s.credentialRepo.FindByUserAndType(user.ID, sub.CredentialType)
	if err != nil {
		return err
	}
	hasNaturalPerson, err := s.identitySvc.HasToken(ctx, wallet, model.NFTTokenNaturalPerson)
	if err != nil {
		return err
	}
	if err := EnsureActivatable(sub, activeCred != nil && activeCred.ReviewStatus == model.CredentialReviewVerified, sub.SupersededBySubmissionID != nil); err != nil {
		return err
	}
	if !hasNaturalPerson {
		return errors.New("必須先持有自然人 NFT 才能啟用身份憑證")
	}

	tokenID, err := TokenIDForType(sub.CredentialType)
	if err != nil {
		return err
	}
	txHash, err := s.identitySvc.MintCredential(ctx, wallet, tokenID)
	if err != nil {
		return err
	}
	if err := s.submissionRepo.MarkActivated(sub.ID, txHash, int32(tokenID)); err != nil {
		return err
	}
	if err := s.credentialRepo.UpsertIssuedCredential(user.ID, sub.CredentialType, int32(tokenID), txHash, wallet); err != nil {
		return err
	}
	if s.chainSyncer != nil {
		_ = s.chainSyncer.SyncAll(ctx)
	}
	return nil
}
```

- [ ] **Step 3: Expose the new endpoints and wire the module into bootstrap**

```go
// go-service/internal/bootstrap/router.go
protected.GET("/credentials/me", credentialHandler.GetMyCredentials)
protected.POST("/credentials/:type/submissions", credentialHandler.CreateSubmission)
protected.POST("/credentials/:type/submissions/:id/files", credentialHandler.UploadFiles)
protected.POST("/credentials/:type/submissions/:id/analyze", credentialHandler.AnalyzeSubmission)
protected.POST("/credentials/:type/submissions/:id/manual", credentialHandler.RequestManualReview)
protected.POST("/credentials/:type/submissions/:id/activate", credentialHandler.ActivateSubmission)

protected.GET("/admin/credentials/pending", credentialAdminHandler.ListPendingManual)
protected.PUT("/admin/credentials/:id/review", credentialAdminHandler.ReviewSubmission)
```

```go
// go-service/internal/bootstrap/wiring.go
credentialSubmissionRepo := repository.NewCredentialSubmissionRepository(postgresDB)

credentialSvc := credentialmod.NewService(
	userRepo,
	credentialSubmissionRepo,
	credentialRepo,
	identityContractSvc,
	minioClient,
	visionClient,
	chainSyncer,
)
credentialHandler := credentialmod.NewHandler(credentialSvc)
credentialAdminHandler := credentialmod.NewAdminHandler(credentialSvc, blockchainConfig.GodModeWalletAddress)

r := SetupRouter(
	listingHandler,
	logHandler,
	authHandler,
	loginHandler,
	resetPasswordHandler,
	userHandler,
	adminHandler,
	onboardingHandler,
	credentialHandler,
	credentialAdminHandler,
	sessionRepo,
)
```

- [ ] **Step 4: Run backend verification for the new API surface**

Run: `go test ./...`  
Expected: exit code `0`, including the new credential package.

Run: `go build ./...`  
Expected: exit code `0` so the router/wiring additions are confirmed outside the test cache.

- [ ] **Step 5: Commit the API checkpoint**

```bash
git add -- go-service/internal/modules/credential/dto.go go-service/internal/modules/credential/service.go go-service/internal/modules/credential/handler.go go-service/internal/modules/credential/admin_handler.go go-service/internal/bootstrap/router.go go-service/internal/bootstrap/wiring.go
git commit -m "feat: add credential activation api"
```

### Task 4: Sync `CredentialMinted` Back Into The Read Model

**Files:**
- Create: `go-service/internal/modules/credential/event_handler.go`
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1: Create a `CredentialMinted` worker that updates `user_credentials` idempotently**

```go
type Worker struct {
	contractAddress common.Address
	userRepo        *repository.UserRepository
	credentialRepo  *repository.UserCredentialRepository
	parsedABI       abi.ABI
	checkpoint      *indexer.CheckpointStore
	startBlock      uint64
}

func (w *Worker) ProcessBlock(ctx context.Context, eth *ethclient.Client, blockNumber uint64) error {
	logs, err := eth.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(blockNumber)),
		ToBlock:   big.NewInt(int64(blockNumber)),
		Addresses: []common.Address{w.contractAddress},
	})
	if err != nil {
		return err
	}

	event := w.parsedABI.Events["CredentialMinted"]
	for _, vlog := range logs {
		if len(vlog.Topics) < 3 || vlog.Topics[0] != event.ID {
			continue
		}
		isNew, err := w.checkpoint.MarkProcessed(ctx, vlog.TxHash.Hex(), vlog.Index, "IdentityNFT", "CredentialMinted", blockNumber)
		if err != nil || !isNew {
			continue
		}

		wallet := common.HexToAddress(vlog.Topics[1].Hex()).Hex()
		tokenID := new(big.Int).SetBytes(vlog.Topics[2].Bytes()).Int64()
		credentialType, err := TypeForTokenID(tokenID)
		if err != nil {
			continue
		}
		user, err := w.userRepo.FindByWallet(wallet)
		if err != nil || user == nil {
			return fmt.Errorf("credential_worker: user not found for wallet %s", wallet)
		}
		if err := w.credentialRepo.UpsertIssuedCredential(user.ID, credentialType, int32(tokenID), vlog.TxHash.Hex(), wallet); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 2: Register the worker next to the existing `IdentityMinted` worker**

```go
if blockchainConfig.IdentityNFTAddress != "" {
	identityWorker, err := usermod.NewIdentityWorker(
		blockchainConfig.IdentityNFTAddress,
		userRepo,
		checkpointStore,
		blockchainConfig.IdentityNFTStartBlock,
	)
	if err == nil {
		idx.RegisterWorker(identityWorker)
	}

	credentialWorker, err := credentialmod.NewWorker(
		blockchainConfig.IdentityNFTAddress,
		userRepo,
		credentialRepo,
		checkpointStore,
		blockchainConfig.IdentityNFTStartBlock,
	)
	if err == nil {
		idx.RegisterWorker(credentialWorker)
	}
}
```

- [ ] **Step 3: Run indexer-related verification**

Run: `go test ./...`  
Expected: exit code `0`.

Run: `go build ./...`  
Expected: exit code `0` with both workers registered.

- [ ] **Step 4: Commit the sync checkpoint**

```bash
git add -- go-service/internal/modules/credential/event_handler.go go-service/internal/bootstrap/wiring.go
git commit -m "feat: sync credential minted events"
```

### Task 5: Build The Frontend Credential Client And Shared Application Shell

**Files:**
- Create: `react-service/src/api/credentialApi.ts`
- Create: `react-service/src/components/credential/CredentialDocumentUploader.tsx`
- Create: `react-service/src/components/credential/CredentialStatusPanel.tsx`
- Create: `react-service/src/components/credential/CredentialApplicationShell.tsx`

- [ ] **Step 1: Add a dedicated credential API client with full Gate 1 response types**

```ts
const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type CredentialType = "OWNER" | "TENANT" | "AGENT";
export type CredentialDisplayStatus =
    | "NOT_STARTED"
    | "SMART_REVIEWING"
    | "MANUAL_REVIEWING"
    | "PASSED_READY"
    | "FAILED"
    | "ACTIVATED"
    | "REVOKED";

export type CredentialCenterItem = {
    credentialType: CredentialType;
    displayStatus: CredentialDisplayStatus;
    latestSubmissionId?: number;
    reviewRoute?: "SMART" | "MANUAL";
    summary?: string;
    canActivate: boolean;
    canRetrySmart: boolean;
    canRequestManual: boolean;
    activationTxHash?: string;
};

async function unwrap<T>(res: Response): Promise<T> {
    const raw = await res.text();
    const parsed = raw ? JSON.parse(raw) as { success?: boolean; message?: string; data?: T } : {};
    if (!res.ok || !parsed.success) {
        throw new Error(parsed.message ?? `Request failed: ${res.status}`);
    }
    return parsed.data as T;
}

export async function getCredentialCenter(): Promise<{ kycStatus: string; items: CredentialCenterItem[] }> {
    const res = await fetch(`${API_BASE_URL}/credentials/me`, { credentials: "include" });
    return unwrap(res);
}

export async function createCredentialSubmission(
    type: CredentialType,
    payload: { route: "SMART" | "MANUAL"; formPayload: Record<string, string>; notes: string },
): Promise<{ submissionId: number }> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return unwrap(res);
}

export async function uploadCredentialFiles(type: CredentialType, submissionId: number, mainDoc: File, supportDoc?: File): Promise<void> {
    const form = new FormData();
    form.append("main_doc", mainDoc);
    if (supportDoc) form.append("support_doc", supportDoc);
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    await unwrap(res);
}

export async function analyzeCredentialSubmission(type: CredentialType, submissionId: number): Promise<CredentialCenterItem> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/analyze`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap(res);
}

export async function requestManualCredentialReview(type: CredentialType, submissionId: number): Promise<CredentialCenterItem> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/manual`, {
        method: "POST",
        credentials: "include",
    });
    return unwrap(res);
}

export async function activateCredentialSubmission(type: CredentialType, submissionId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/credentials/${type.toLowerCase()}/submissions/${submissionId}/activate`, {
        method: "POST",
        credentials: "include",
    });
    await unwrap(res);
}
```

- [ ] **Step 2: Build shared UI pieces for status, file upload, and result-first application flow**

```tsx
// CredentialStatusPanel.tsx
const STATUS_LABEL: Record<CredentialDisplayStatus, string> = {
    NOT_STARTED: "未申請",
    SMART_REVIEWING: "智能審核中",
    MANUAL_REVIEWING: "人工審核中",
    PASSED_READY: "通過待啟用",
    FAILED: "不通過",
    ACTIVATED: "已啟用",
    REVOKED: "已撤銷",
};
```

```tsx
// CredentialDocumentUploader.tsx
<input
    type="file"
    accept="image/*"
    onChange={(event) => onChange(event.target.files?.[0] ?? null)}
    className="hidden"
/>
```

```tsx
// CredentialApplicationShell.tsx
export default function CredentialApplicationShell(props: {
    credentialType: CredentialType;
    title: string;
    description: string;
    primaryFields: Array<{ key: string; label: string; placeholder: string }>;
    currentItem?: CredentialCenterItem;
    onSubmitSmart: (payload: Record<string, string>, notes: string, mainDoc: File, supportDoc?: File) => Promise<void>;
    onRequestManual: (payload: Record<string, string>, notes: string, mainDoc: File, supportDoc?: File) => Promise<void>;
    onActivate: (submissionId: number) => Promise<void>;
}) {
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState("");
    const [mainDoc, setMainDoc] = useState<File | null>(null);
    const [supportDoc, setSupportDoc] = useState<File | null>(null);

    const handleSmartSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await props.onSubmitSmart(formValues, notes, mainDoc!, supportDoc ?? undefined);
    };

    const handleManualSubmit = async () => {
        await props.onRequestManual(formValues, notes, mainDoc!, supportDoc ?? undefined);
    };

    return (
        <div className="space-y-6">
            <CredentialStatusPanel item={props.currentItem} />
            {props.currentItem?.displayStatus === "PASSED_READY" && props.currentItem.latestSubmissionId ? (
                <button type="button" onClick={() => props.onActivate(props.currentItem!.latestSubmissionId!)}>
                    啟用 NFT 憑證
                </button>
            ) : (
                <>
                    <form onSubmit={handleSmartSubmit} className="space-y-6">
                        {props.primaryFields.map((field) => (
                            <label key={field.key} className="block space-y-2">
                                <span className="text-sm font-medium text-on-surface">{field.label}</span>
                                <input value={formValues[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))} />
                            </label>
                        ))}
                        <CredentialDocumentUploader label="主文件" file={mainDoc} onChange={setMainDoc} required />
                        <CredentialDocumentUploader label="補充文件（選填）" file={supportDoc} onChange={setSupportDoc} />
                        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="補充說明（選填）" />
                        <button type="submit">送出智能審核</button>
                    </form>
                    <button type="button" onClick={handleManualSubmit} className="text-sm underline underline-offset-4">
                        改走人工審核
                    </button>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Run frontend verification for the shared client and shell**

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

- [ ] **Step 4: Commit the shared frontend checkpoint**

```bash
git add -- react-service/src/api/credentialApi.ts react-service/src/components/credential/CredentialDocumentUploader.tsx react-service/src/components/credential/CredentialStatusPanel.tsx react-service/src/components/credential/CredentialApplicationShell.tsx
git commit -m "feat: add credential application shell"
```

### Task 6: Add The Three Role Pages And Rewire Identity Center

**Files:**
- Create: `react-service/src/pages/OwnerCredentialPage.tsx`
- Create: `react-service/src/pages/TenantCredentialPage.tsx`
- Create: `react-service/src/pages/AgentCredentialPage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`
- Modify: `react-service/src/router/index.tsx`

- [ ] **Step 1: Add three separate pages with role-specific field configs and Traditional Chinese copy**

```tsx
// OwnerCredentialPage.tsx
const OWNER_FIELDS = [
    { key: "holderName", label: "權利人姓名", placeholder: "請填寫權狀上的姓名" },
    { key: "propertyAddress", label: "物件地址", placeholder: "請填寫權狀上的地址" },
    { key: "ownershipDocNo", label: "權狀字號", placeholder: "若文件可辨識可填寫" },
];

// TenantCredentialPage.tsx
const TENANT_FIELDS = [
    { key: "holderName", label: "申請人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "employerOrSchool", label: "工作或就學單位", placeholder: "例如：屋柱科技股份有限公司" },
    { key: "incomeHint", label: "收入或付款能力說明", placeholder: "例如：每月固定薪資 / 家庭支持" },
];

// AgentCredentialPage.tsx
const AGENT_FIELDS = [
    { key: "holderName", label: "登錄姓名", placeholder: "請填寫證照上的姓名" },
    { key: "licenseNumber", label: "登錄字號", placeholder: "例如：ABC123456" },
    { key: "brokerageName", label: "服務單位", placeholder: "例如：屋柱安心仲介" },
];
```

- [ ] **Step 2: Route the new pages and replace Gate 0 placeholders in `IdentityCenterPage.tsx`**

```tsx
// react-service/src/router/index.tsx
{
    path: "/credential/owner",
    element: <OwnerCredentialPage />,
},
{
    path: "/credential/tenant",
    element: <TenantCredentialPage />,
},
{
    path: "/credential/agent",
    element: <AgentCredentialPage />,
},
```

```tsx
// react-service/src/pages/IdentityCenterPage.tsx
const itemByType = new Map(center.items.map((item) => [item.credentialType, item]));
const ownerItem = itemByType.get("OWNER");

<RoleCard
    icon="home"
    title="屋主身份"
    stateLabel={ownerItem ? STATUS_LABEL[ownerItem.displayStatus] : "未申請"}
    description="這裡顯示的是身份認證進度，不是 Gate 1B 權限切換。現階段刊登與預約權限仍維持 KYC VERIFIED 規則。"
    action={{
        label: ownerItem?.canActivate ? "前往啟用" : "前往申請",
        description: ownerItem?.displayStatus === "PASSED_READY" ? "你的屋主審核已通過，點擊後可完成啟用。" : "前往屋主身份頁查看進度或重新送件。",
        onClick: () => navigate("/credential/owner"),
    }}
/>;
```

- [ ] **Step 3: Make smart review primary and manual review secondary on every page**

```tsx
<button type="submit" className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
    送出智能審核
</button>
<button
    type="button"
    onClick={handleManualRoute}
    className="text-sm text-on-surface-variant underline underline-offset-4"
>
    改走人工審核
</button>
```

- [ ] **Step 4: Keep activation user-driven and reapply paths explicit**

```tsx
{item.displayStatus === "PASSED_READY" && item.latestSubmissionId ? (
    <button type="button" onClick={() => onActivate(item.latestSubmissionId)}>
        啟用 NFT 憑證
    </button>
) : null}

{item.displayStatus === "FAILED" ? (
    <>
        <button type="button" onClick={retrySmart}>重新跑智能審核</button>
        <button type="button" onClick={switchToManual}>改走人工審核</button>
    </>
) : null}
```

- [ ] **Step 5: Run frontend verification for the role pages and identity center**

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

- [ ] **Step 6: Commit the Gate 1 role-page checkpoint**

```bash
git add -- react-service/src/pages/OwnerCredentialPage.tsx react-service/src/pages/TenantCredentialPage.tsx react-service/src/pages/AgentCredentialPage.tsx react-service/src/pages/IdentityCenterPage.tsx react-service/src/router/index.tsx
git commit -m "feat: add gate 1 role credential pages"
```

### Task 7: Final Verification, Docs Sync, And Manual Smoke Handoff

**Files:**
- Modify: `docs/開發規劃書.md`
- Modify: `docs/database/relational-database-spec.md`
- Modify: `docs/database/relational-database-spec.csv`
- Modify: `dev_log/2026-04-22.md`

- [ ] **Step 1: Update the project docs so Gate 1A is no longer described as missing**

```markdown
## Gate 1A 執行完成

- `/credential/owner`、`/credential/tenant`、`/credential/agent` 已接上正式頁面與 API。
- `credential_submissions` 為角色申請 write model。
- `user_credentials` 保留為已啟用憑證 read model。
- `CredentialMinted` 已同步回 PostgreSQL。
- Gate 1B 權限切換仍未啟用，刊登與預約規則維持 Gate 0。
```

- [ ] **Step 2: Run the full repo verification suite**

Run: `go test ./...`  
Expected: exit code `0`.

Run: `go build ./...`  
Expected: exit code `0`.

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

Run: `git diff --stat`  
Expected: only the files in this plan appear.

- [ ] **Step 3: Execute the manual smoke checklist**

```text
1. 已登入且 KYC VERIFIED 的使用者可打開三個身份頁，未登入或未通過 KYC 的使用者會被擋下。
2. 屋主頁可上傳主文件與補充文件，送出智能審核後看到「智能審核中」，完成後得到「通過待啟用」或「不通過」。
3. 仲介頁智能審核通過後，身份中心會同步顯示「通過待啟用」而不是直接發 NFT。
4. 使用者在「通過待啟用」狀態點擊啟用後，頁面回到「已啟用」，且資料中可看到 `activationTxHash`。
5. 使用者在「不通過」狀態可重新跑智能審核，也可切換到人工審核。
6. `GET /api/admin/credentials/pending` 會列出人工審核案件，`PUT /api/admin/credentials/:id/review` 可回覆通過或不通過。
7. `CredentialMinted` 上鏈後，重新整理身份中心仍可讀到已啟用狀態，不會只靠前端暫存。
8. `listing create` 和 `appointment booking` 行為維持 Gate 0，不因 Gate 1A 導入而提早切權限。
```

- [ ] **Step 4: Commit the Gate 1A handoff checkpoint**

```bash
git add -- docs/開發規劃書.md docs/database/relational-database-spec.md docs/database/relational-database-spec.csv dev_log/2026-04-22.md
git commit -m "docs: record gate 1 credential activation delivery"
```
