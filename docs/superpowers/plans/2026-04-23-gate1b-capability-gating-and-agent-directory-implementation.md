# Gate 1B: Capability Gating & Agent Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate listing detail and creation pages behind activated role credentials, and ship a public MVP agent directory showing AGENT-credentialed users.

**Architecture:** Frontend-only role guards via a new `useIdentity` hook + `RequireCredential` component, consuming the existing `credentials[]` array from `GET /api/kyc/me`. A lightweight Go `modules/agent` package queries `user_credentials JOIN users` to serve two new public endpoints. No DB schema changes.

**Tech Stack:** React 19, TypeScript 5 (strict), React Router v7, Tailwind CSS; Go 1.25, Gin, `database/sql`, PostgreSQL. No ORM, no new npm packages.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `react-service/src/hooks/useIdentity.ts` | Calls getAuthMe + getKYCStatus, returns auth/role state |
| `react-service/src/components/common/RequireCredential.tsx` | Router-level guard component |
| `react-service/src/api/agentApi.ts` | Agent API client |
| `react-service/src/pages/AgentListPage.tsx` | `/agents` — public certified-agent list |
| `react-service/src/pages/AgentDetailPage.tsx` | `/agents/:wallet` — agent detail |
| `go-service/internal/modules/agent/dto.go` | Response types for agent endpoints |
| `go-service/internal/modules/agent/service.go` | Business logic, maps DB rows to DTOs |
| `go-service/internal/modules/agent/handler.go` | HTTP handlers |
| `go-service/internal/modules/agent/service_test.go` | Unit tests for mapping helpers |

### Modified files
| File | Change |
|---|---|
| `go-service/internal/db/repository/user_credential_repo.go` | Add `AgentRecord` struct + `FindAllAgents()` + `FindAgentByWallet()` |
| `go-service/internal/bootstrap/router.go` | Add agent handler param + public `/api/agents` routes |
| `go-service/internal/bootstrap/wiring.go` | Wire agent service + handler |
| `react-service/src/router/index.tsx` | Wrap listing routes with guards; add agent routes |
| `react-service/src/pages/ListingCreatePage.tsx` | Remove auth/KYC gate (replaced by router-level guard) |
| `react-service/src/pages/ListingListPage.tsx` | Gate "Create listing" button on OWNER credential |
| `react-service/src/pages/ListingDetailPage.tsx` | Gate appointment booking section on TENANT credential |
| `react-service/src/components/common/Header.tsx` | Add "仲介列表" nav link |

---

### Task 1: Backend — AgentRecord type + Repository Methods

**Files:**
- Modify: `go-service/internal/db/repository/user_credential_repo.go`

- [ ] **Step 1: Add `AgentRecord` struct and two query methods at the end of `user_credential_repo.go`**

```go
// AgentRecord is the result of user_credentials JOIN users for AGENT type.
type AgentRecord struct {
	WalletAddress string
	DisplayName   sql.NullString
	NFTTokenID    sql.NullInt32
	TxHash        sql.NullString
	ActivatedAt   time.Time
}

// FindAllAgents returns all non-revoked AGENT credentials joined with user data.
func (r *UserCredentialRepository) FindAllAgents() ([]AgentRecord, error) {
	rows, err := r.db.Query(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		WHERE uc.credential_type = $1
		  AND uc.review_status = $2
		  AND uc.revoked_at IS NULL
		ORDER BY uc.verified_at DESC
	`, model.CredentialTypeAgent, model.CredentialReviewVerified)
	if err != nil {
		return nil, fmt.Errorf("user_credential_repo: find all agents: %w", err)
	}
	defer rows.Close()

	var result []AgentRecord
	for rows.Next() {
		var rec AgentRecord
		if err := rows.Scan(
			&rec.WalletAddress, &rec.DisplayName,
			&rec.NFTTokenID, &rec.TxHash, &rec.ActivatedAt,
		); err != nil {
			return nil, fmt.Errorf("user_credential_repo: find all agents scan: %w", err)
		}
		result = append(result, rec)
	}
	return result, rows.Err()
}

// FindAgentByWallet returns the AGENT credential for a given wallet address, or nil if not found.
func (r *UserCredentialRepository) FindAgentByWallet(walletAddress string) (*AgentRecord, error) {
	row := r.db.QueryRow(`
		SELECT u.wallet_address, u.display_name,
		       uc.nft_token_id, uc.tx_hash, uc.verified_at
		FROM user_credentials uc
		JOIN users u ON u.id = uc.user_id
		WHERE u.wallet_address = $1
		  AND uc.credential_type = $2
		  AND uc.review_status = $3
		  AND uc.revoked_at IS NULL
		LIMIT 1
	`, walletAddress, model.CredentialTypeAgent, model.CredentialReviewVerified)

	var rec AgentRecord
	if err := row.Scan(
		&rec.WalletAddress, &rec.DisplayName,
		&rec.NFTTokenID, &rec.TxHash, &rec.ActivatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("user_credential_repo: find agent by wallet: %w", err)
	}
	return &rec, nil
}
```

- [ ] **Step 2: Build to verify compilation**

```bash
cd go-service && go build ./...
```

Expected: no output (clean build).

- [ ] **Step 3: Commit**

```bash
git add go-service/internal/db/repository/user_credential_repo.go
git commit -m "feat: add AgentRecord and agent query methods to user credential repo"
```

---

### Task 2: Backend — Agent Module (dto + service + handler)

**Files:**
- Create: `go-service/internal/modules/agent/dto.go`
- Create: `go-service/internal/modules/agent/service.go`
- Create: `go-service/internal/modules/agent/service_test.go`
- Create: `go-service/internal/modules/agent/handler.go`

- [ ] **Step 1: Create `go-service/internal/modules/agent/dto.go`**

```go
package agent

// AgentListItem is one entry in the public agent list.
type AgentListItem struct {
	WalletAddress string  `json:"walletAddress"`
	DisplayName   *string `json:"displayName,omitempty"`
	ActivatedAt   string  `json:"activatedAt"`
	NFTTokenID    int32   `json:"nftTokenId"`
}

// AgentDetailResponse is the full detail for a single certified agent.
type AgentDetailResponse struct {
	WalletAddress string  `json:"walletAddress"`
	DisplayName   *string `json:"displayName,omitempty"`
	ActivatedAt   string  `json:"activatedAt"`
	NFTTokenID    int32   `json:"nftTokenId"`
	TxHash        string  `json:"txHash"`
}

// AgentListResponse wraps the items slice for the list endpoint.
type AgentListResponse struct {
	Items []AgentListItem `json:"items"`
}
```

- [ ] **Step 2: Create `go-service/internal/modules/agent/service.go`**

```go
package agent

import (
	"database/sql"
	"fmt"
	"time"

	"go-service/internal/db/repository"
)

// Service handles agent directory queries.
type Service struct {
	credentialRepo *repository.UserCredentialRepository
}

// NewService constructs an agent Service.
func NewService(credentialRepo *repository.UserCredentialRepository) *Service {
	return &Service{credentialRepo: credentialRepo}
}

// ListAgents returns all non-revoked certified AGENT users.
func (s *Service) ListAgents() (*AgentListResponse, error) {
	records, err := s.credentialRepo.FindAllAgents()
	if err != nil {
		return nil, fmt.Errorf("agent service: list agents: %w", err)
	}

	items := make([]AgentListItem, 0, len(records))
	for _, r := range records {
		items = append(items, AgentListItem{
			WalletAddress: r.WalletAddress,
			DisplayName:   nullStrPtr(r.DisplayName),
			ActivatedAt:   r.ActivatedAt.UTC().Format(time.RFC3339),
			NFTTokenID:    r.NFTTokenID.Int32,
		})
	}
	return &AgentListResponse{Items: items}, nil
}

// GetByWallet returns the agent detail for a given wallet, or nil if not found.
func (s *Service) GetByWallet(walletAddress string) (*AgentDetailResponse, error) {
	r, err := s.credentialRepo.FindAgentByWallet(walletAddress)
	if err != nil {
		return nil, fmt.Errorf("agent service: get by wallet: %w", err)
	}
	if r == nil {
		return nil, nil
	}
	return &AgentDetailResponse{
		WalletAddress: r.WalletAddress,
		DisplayName:   nullStrPtr(r.DisplayName),
		ActivatedAt:   r.ActivatedAt.UTC().Format(time.RFC3339),
		NFTTokenID:    r.NFTTokenID.Int32,
		TxHash:        r.TxHash.String,
	}, nil
}

// nullStrPtr converts a sql.NullString to *string, returning nil for NULL or empty.
func nullStrPtr(ns sql.NullString) *string {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	return &ns.String
}
```

- [ ] **Step 3: Create `go-service/internal/modules/agent/service_test.go`**

```go
package agent

import (
	"database/sql"
	"testing"
	"time"

	"go-service/internal/db/repository"
)

func TestNullStrPtr(t *testing.T) {
	t.Run("null returns nil", func(t *testing.T) {
		if nullStrPtr(sql.NullString{Valid: false}) != nil {
			t.Error("expected nil for null NullString")
		}
	})
	t.Run("empty valid string returns nil", func(t *testing.T) {
		if nullStrPtr(sql.NullString{String: "", Valid: true}) != nil {
			t.Error("expected nil for empty valid NullString")
		}
	})
	t.Run("non-empty valid string returns pointer", func(t *testing.T) {
		result := nullStrPtr(sql.NullString{String: "Alice", Valid: true})
		if result == nil || *result != "Alice" {
			t.Errorf("expected 'Alice', got %v", result)
		}
	})
}

func TestAgentListItemMapping(t *testing.T) {
	rec := repository.AgentRecord{
		WalletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
		DisplayName:   sql.NullString{String: "Bob Chen", Valid: true},
		NFTTokenID:    sql.NullInt32{Int32: 2, Valid: true},
		TxHash:        sql.NullString{String: "0xdeadbeef", Valid: true},
		ActivatedAt:   time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC),
	}

	item := AgentListItem{
		WalletAddress: rec.WalletAddress,
		DisplayName:   nullStrPtr(rec.DisplayName),
		ActivatedAt:   rec.ActivatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		NFTTokenID:    rec.NFTTokenID.Int32,
	}

	if item.WalletAddress != "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" {
		t.Errorf("unexpected WalletAddress: %v", item.WalletAddress)
	}
	if item.DisplayName == nil || *item.DisplayName != "Bob Chen" {
		t.Errorf("unexpected DisplayName: %v", item.DisplayName)
	}
	if item.NFTTokenID != 2 {
		t.Errorf("unexpected NFTTokenID: %v", item.NFTTokenID)
	}
	if item.ActivatedAt != "2026-04-01T12:00:00Z" {
		t.Errorf("unexpected ActivatedAt format: %v", item.ActivatedAt)
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd go-service && go test ./internal/modules/agent/...
```

Expected output:
```
ok      go-service/internal/modules/agent       0.XXXs
```

- [ ] **Step 5: Create `go-service/internal/modules/agent/handler.go`**

```go
package agent

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler serves the public agent directory endpoints.
type Handler struct {
	svc *Service
}

// NewHandler constructs an agent Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ListAgents handles GET /api/agents.
func (h *Handler) ListAgents(c *gin.Context) {
	resp, err := h.svc.ListAgents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GetAgentByWallet handles GET /api/agents/:wallet.
func (h *Handler) GetAgentByWallet(c *gin.Context) {
	wallet := c.Param("wallet")
	resp, err := h.svc.GetByWallet(wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if resp == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}
```

- [ ] **Step 6: Build**

```bash
cd go-service && go build ./...
```

Expected: no output (clean build).

- [ ] **Step 7: Commit**

```bash
git add go-service/internal/modules/agent/
git commit -m "feat: add agent module with list and detail endpoints"
```

---

### Task 3: Backend — Wire Agent Routes + Rebuild

**Files:**
- Modify: `go-service/internal/bootstrap/router.go`
- Modify: `go-service/internal/bootstrap/wiring.go`

- [ ] **Step 1: Add agent import and handler param to `router.go`**

Add to the import block in `go-service/internal/bootstrap/router.go`:
```go
agentmod "go-service/internal/modules/agent"
```

Add `agentHandler *agentmod.Handler` as the last parameter of `SetupRouter`:
```go
func SetupRouter(
    listingHandler *listingmod.Handler,
    logHandler *logsmod.Handler,
    authHandler *authmod.Handler,
    loginHandler *authmod.LoginHandler,
    resetPasswordHandler *authmod.ResetPasswordHandler,
    userHandler *usermod.Handler,
    adminHandler *usermod.AdminHandler,
    onboardingHandler *onboardingmod.Handler,
    credentialHandler *credentialmod.Handler,
    credentialAdminHandler *credentialmod.AdminHandler,
    sessionRepo *repository.SessionRepository,
    agentHandler *agentmod.Handler,
) *gin.Engine {
```

- [ ] **Step 2: Add public agent routes in `router.go`**

After the `// ── Blockchain logs (public) ──` block and before the `// ── Auth ──` block, add:

```go
		// ── Agent directory (public) ─────────────────────────────
		api.GET("/agents", agentHandler.ListAgents)
		api.GET("/agents/:wallet", agentHandler.GetAgentByWallet)
```

- [ ] **Step 3: Wire agent in `wiring.go`**

Add to the import block in `go-service/internal/bootstrap/wiring.go`:
```go
agentmod "go-service/internal/modules/agent"
```

After the `// ── 13. Listing module ──` block (after `listingHandler` is constructed), add:

```go
	// ── 14. Agent directory module ────────────────────────────
	agentSvc := agentmod.NewService(credentialRepo)
	agentHandler := agentmod.NewHandler(agentSvc)
```

Update the `SetupRouter` call at the bottom to pass `agentHandler` as the last argument:

```go
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
		agentHandler,
	)
```

- [ ] **Step 4: Build**

```bash
cd go-service && go build ./...
```

Expected: no output.

- [ ] **Step 5: Rebuild Docker container**

```bash
cd go-service && docker compose up --build -d
```

Expected: container rebuilds and starts successfully.

- [ ] **Step 6: Smoke test the new endpoints**

```bash
curl -s http://localhost:8081/api/agents | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const p=JSON.parse(d); console.log('success:', p.success, '| items:', p.data?.items?.length ?? 0)"
```

Expected output: `success: true | items: 0` (or more if test data exists).

```bash
curl -s http://localhost:8081/api/agents/0xNonExistentWallet | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d))"
```

Expected: `{ success: false, message: 'agent not found' }`.

- [ ] **Step 7: Commit**

```bash
git add go-service/internal/bootstrap/router.go go-service/internal/bootstrap/wiring.go
git commit -m "feat: wire agent module routes in bootstrap"
```

---

### Task 4: Frontend — `useIdentity` Hook

**Files:**
- Create: `react-service/src/hooks/useIdentity.ts`

- [ ] **Step 1: Create `react-service/src/hooks/useIdentity.ts`**

```typescript
import { useEffect, useState } from "react";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus, type KYCStatus } from "../api/kycApi";

export interface IdentityState {
    loading: boolean;
    authenticated: boolean;
    kycStatus: KYCStatus | null;
    activatedRoles: string[];
    hasRole: (role: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
}

export function useIdentity(): IdentityState {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
    const [activatedRoles, setActivatedRoles] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe().catch(() => ({ authenticated: false, isPlatformWallet: false }));
                if (!auth.authenticated) {
                    setAuthenticated(false);
                    setLoading(false);
                    return;
                }
                setAuthenticated(true);
                const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] }));
                setKycStatus(kyc.kycStatus);
                setActivatedRoles(kyc.credentials ?? []);
            } catch {
                setAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const hasRole = (role: string) => activatedRoles.includes(role);
    const hasAnyRole = (roles: string[]) => roles.some((r) => activatedRoles.includes(r));

    return { loading, authenticated, kycStatus, activatedRoles, hasRole, hasAnyRole };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/hooks/useIdentity.ts
git commit -m "feat: add useIdentity hook for auth and role state"
```

---

### Task 5: Frontend — `RequireCredential` Component

**Files:**
- Create: `react-service/src/components/common/RequireCredential.tsx`

- [ ] **Step 1: Create `react-service/src/components/common/RequireCredential.tsx`**

```tsx
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import PageLoading from "./PageLoading";
import { useIdentity } from "../../hooks/useIdentity";

type CredentialType = "OWNER" | "TENANT" | "AGENT";

interface RequireCredentialProps {
    requiredRole?: CredentialType;
    anyOf?: CredentialType[];
    children: ReactNode;
}

function GateFallback({ title, description, actionLabel, actionPath }: {
    title: string;
    description: string;
    actionLabel: string;
    actionPath: string;
}) {
    const navigate = useNavigate();
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="max-w-md w-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-10 text-center shadow-sm">
                <span
                    className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                >
                    lock
                </span>
                <h2 className="text-xl font-bold text-on-surface mb-2">{title}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-8">{description}</p>
                <button
                    type="button"
                    onClick={() => navigate(actionPath)}
                    className="w-full rounded-xl bg-[#E8B800] py-3 px-6 font-bold text-[#1C1917] hover:brightness-105 transition-all"
                >
                    {actionLabel}
                </button>
            </div>
        </div>
    );
}

export default function RequireCredential({ requiredRole, anyOf, children }: RequireCredentialProps) {
    const { loading, authenticated, kycStatus, hasRole, hasAnyRole } = useIdentity();

    if (loading) return <PageLoading />;

    if (!authenticated) {
        return (
            <GateFallback
                title="請先登入"
                description="你需要登入才能繼續查看此頁面的內容。"
                actionLabel="前往登入"
                actionPath="/login"
            />
        );
    }

    if (kycStatus !== "VERIFIED") {
        return (
            <GateFallback
                title="請先完成身份驗證"
                description="查看此頁面需要先通過 KYC 身份驗證。"
                actionLabel="前往身份驗證"
                actionPath="/kyc"
            />
        );
    }

    const roleGranted = requiredRole
        ? hasRole(requiredRole)
        : anyOf
          ? hasAnyRole(anyOf)
          : true;

    if (!roleGranted) {
        return (
            <GateFallback
                title="需要角色認證"
                description="此功能需要先在身份中心完成對應的角色認證並啟用身份。"
                actionLabel="前往身份中心"
                actionPath="/member"
            />
        );
    }

    return <>{children}</>;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add react-service/src/components/common/RequireCredential.tsx
git commit -m "feat: add RequireCredential route guard component"
```

---

### Task 6: Frontend — Router Updates + `ListingCreatePage` Cleanup

**Files:**
- Modify: `react-service/src/router/index.tsx`
- Modify: `react-service/src/pages/ListingCreatePage.tsx`

- [ ] **Step 1: Update `react-service/src/router/index.tsx`**

Add the import at the top of the imports section:
```tsx
import RequireCredential from "../components/common/RequireCredential";
import AgentListPage from "../pages/AgentListPage";
import AgentDetailPage from "../pages/AgentDetailPage";
```

Replace the `/listings/:id` and `/listings/new` route definitions:
```tsx
    {
        path: "/listings/new",
        element: (
            <RequireCredential requiredRole="OWNER">
                <ListingCreatePage />
            </RequireCredential>
        ),
    },
    {
        path: "/listings/:id",
        element: (
            <RequireCredential anyOf={["OWNER", "TENANT", "AGENT"]}>
                <ListingDetailPage />
            </RequireCredential>
        ),
    },
```

Add agent routes after `/forgot-password`:
```tsx
    {
        path: "/agents",
        element: <AgentListPage />,
    },
    {
        path: "/agents/:wallet",
        element: <AgentDetailPage />,
    },
```

- [ ] **Step 2: Clean up `react-service/src/pages/ListingCreatePage.tsx`**

Remove:
- The `type LoadState` declaration (`"loading" | "ready" | "unauthenticated" | "kyc-required"`)
- The `loadState` and `loadError` useState declarations
- The entire auth/KYC guard `useEffect` (the one that calls `getAuthMe` + `getKYCStatus` and sets `loadState`)
- The `import { getAuthMe } from "../api/authApi"` line
- The `import { getKYCStatus } from "../api/kycApi"` line
- All `if (loadState === "loading")`, `if (loadState === "unauthenticated")`, `if (loadState === "kyc-required")` conditional render blocks
- Any `loadError` display block

Keep:
- The `submitting` state and `handleSubmit` function
- The form JSX (the actual `<SiteLayout>` content with `<ListingEditorForm>`)

After edits, the component should open with only: `const [submitting, setSubmitting] = useState(false);` and the `handleSubmit` handler.

- [ ] **Step 3: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors. If `AgentListPage` / `AgentDetailPage` don't exist yet, TypeScript will error — create stub files to unblock:

```tsx
// react-service/src/pages/AgentListPage.tsx (stub)
export default function AgentListPage() { return <div>Agent List</div>; }

// react-service/src/pages/AgentDetailPage.tsx (stub)
export default function AgentDetailPage() { return <div>Agent Detail</div>; }
```

- [ ] **Step 4: Start dev server and verify guards**

```bash
cd react-service && npm run dev
```

- Navigate to `http://localhost:5173/listings/new` without OWNER credential → should see "需要角色認證" gate screen
- Navigate to `http://localhost:5173/listings/1` (replace with any listing id) without a role → should see gate screen
- Navigate without being logged in → should see "請先登入" gate screen

- [ ] **Step 5: Commit**

```bash
git add react-service/src/router/index.tsx react-service/src/pages/ListingCreatePage.tsx
git commit -m "feat: add role guards to listing routes and remove KYC gate from ListingCreatePage"
```

---

### Task 7: Frontend — `ListingListPage` + `ListingDetailPage`

**Files:**
- Modify: `react-service/src/pages/ListingListPage.tsx`
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

- [ ] **Step 1: Add OWNER check to `ListingListPage`**

In `ListingListPage.tsx`, add a new state variable alongside `isAuthenticated`:
```tsx
const [isOwner, setIsOwner] = useState(false);
```

In the `load` async function inside `useEffect`, after `setIsAuthenticated(auth.authenticated)`, add a KYC check when authenticated:
```tsx
if (auth.authenticated) {
    const mine = await getMyListings().catch(() => [] as Listing[]);
    setMyListings(mine);
    // Gate "Create listing" on OWNER credential
    const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] as string[] }));
    setIsOwner(kyc.credentials?.includes("OWNER") ?? false);
}
```

Add the missing import at the top:
```tsx
import { getKYCStatus, type KYCStatus } from "../api/kycApi";
```

Change the "Create draft listing" button condition from `isAuthenticated` to `isOwner`:

Find this block (around line 195):
```tsx
{isAuthenticated ? (
    <button
        type="button"
        onClick={() => navigate("/listings/new")}
        className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-surface transition-colors hover:bg-inverse-primary"
    >
        <span className="material-symbols-outlined text-sm">add</span>
        <span className="text-sm font-medium">Create draft listing</span>
    </button>
) : null}
```

Replace `isAuthenticated` with `isOwner` and update the button label:
```tsx
{isOwner ? (
    <button
        type="button"
        onClick={() => navigate("/listings/new")}
        className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-surface transition-colors hover:bg-inverse-primary"
    >
        <span className="material-symbols-outlined text-sm">add</span>
        <span className="text-sm font-medium">刊登房源</span>
    </button>
) : null}
```

- [ ] **Step 2: Gate appointment booking in `ListingDetailPage`**

In `ListingDetailPage.tsx`, add the `useIdentity` import:
```tsx
import { useIdentity } from "../hooks/useIdentity";
```

Inside the `ListingDetailPage` component function, add at the top of the component body (after the existing state declarations):
```tsx
const { hasRole } = useIdentity();
```

Find the `canBook` constant (around line 343):
```tsx
const canBook = isAuthenticated && !isOwner && listing.status === "ACTIVE";
```

Replace it with:
```tsx
const canBook = hasRole("TENANT") && !isOwner && listing.status === "ACTIVE";
```

This single change gates the booking button (`canBook` is used at the render call site around line 666). No other wrapping is needed — `canBook` already controls all booking-related UI in the component.

- [ ] **Step 3: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Start dev server if not running:
```bash
cd react-service && npm run dev
```

- Log in with a TENANT-activated account → navigate to a listing detail → confirm appointment booking section is visible
- Log in with an OWNER-activated account (no TENANT) → navigate to listing detail → confirm appointment section is NOT visible
- Log in with no roles → `/listings/:id` should show the RequireCredential gate (won't reach the page)

- [ ] **Step 5: Commit**

```bash
git add react-service/src/pages/ListingListPage.tsx react-service/src/pages/ListingDetailPage.tsx
git commit -m "feat: gate listing create button on OWNER and appointment section on TENANT"
```

---

### Task 8: Frontend — Header Update

**Files:**
- Modify: `react-service/src/components/common/Header.tsx`

- [ ] **Step 1: Add "仲介列表" NavLink to the nav section in `Header.tsx`**

Find the `<nav>` element (around line 100):
```tsx
<nav className="hidden md:flex items-center gap-8">
    <NavLink to="/" end className={navLinkCls}>首頁</NavLink>
    <NavLink to="/listings" className={navLinkCls}>列表</NavLink>
</nav>
```

Add the agent list link:
```tsx
<nav className="hidden md:flex items-center gap-8">
    <NavLink to="/" end className={navLinkCls}>首頁</NavLink>
    <NavLink to="/listings" className={navLinkCls}>房源列表</NavLink>
    <NavLink to="/agents" className={navLinkCls}>仲介列表</NavLink>
</nav>
```

- [ ] **Step 2: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Check that "仲介列表" link appears in the nav bar and navigates to `/agents` (the stub page for now).

- [ ] **Step 4: Commit**

```bash
git add react-service/src/components/common/Header.tsx
git commit -m "feat: add 仲介列表 nav link to header"
```

---

### Task 9: Frontend — Agent API + AgentListPage + AgentDetailPage

**Files:**
- Create (or replace stub): `react-service/src/api/agentApi.ts`
- Create (or replace stub): `react-service/src/pages/AgentListPage.tsx`
- Create (or replace stub): `react-service/src/pages/AgentDetailPage.tsx`

- [ ] **Step 1: Create `react-service/src/api/agentApi.ts`**

```typescript
const API_BASE_URL = import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type AgentListItem = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
};

export type AgentDetailResponse = {
    walletAddress: string;
    displayName?: string;
    activatedAt: string;
    nftTokenId: number;
    txHash: string;
};

type ApiEnvelope<T> = {
    success?: boolean;
    message?: string;
    error?: string;
    data?: T;
};

async function unwrap<T>(res: Response): Promise<T> {
    const raw = await res.text();
    let parsed: ApiEnvelope<T> | null = null;
    if (raw) {
        try {
            parsed = JSON.parse(raw) as ApiEnvelope<T>;
        } catch {
            throw new Error(raw.trim() || `Request failed: ${res.status}`);
        }
    }
    if (!res.ok || !parsed?.success) {
        throw new Error(parsed?.message || parsed?.error || `Request failed: ${res.status}`);
    }
    return parsed.data as T;
}

export async function getAgentList(): Promise<{ items: AgentListItem[] }> {
    const res = await fetch(`${API_BASE_URL}/agents`);
    return unwrap<{ items: AgentListItem[] }>(res);
}

export async function getAgentDetail(wallet: string): Promise<AgentDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/agents/${wallet}`);
    return unwrap<AgentDetailResponse>(res);
}
```

- [ ] **Step 2: Create `react-service/src/pages/AgentListPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "../layouts/SiteLayout";
import { getAgentList, type AgentListItem } from "../api/agentApi";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export default function AgentListPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [agents, setAgents] = useState<AgentListItem[]>([]);

    useEffect(() => {
        getAgentList()
            .then((resp) => setAgents(resp.items))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "載入失敗"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SiteLayout>
            <section className="mx-auto max-w-[1440px] px-6 md:px-12 py-12">
                <h1 className="text-3xl font-extrabold text-on-surface mb-2">認證仲介列表</h1>
                <p className="text-on-surface-variant text-sm mb-10">
                    以下仲介已通過 IdentityNFT 鏈上認證，身份可公開驗證。
                </p>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">載入中…</span>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">
                        {error}
                    </div>
                ) : agents.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-on-surface-variant text-sm">目前尚無認證仲介</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {agents.map((agent) => (
                            <Link
                                key={agent.walletAddress}
                                to={`/agents/${agent.walletAddress}`}
                                className="block rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 hover:-translate-y-0.5 transition-transform"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="material-symbols-outlined text-2xl text-[#E8B800]"
                                        style={{ fontVariationSettings: "'FILL' 1" }}>
                                        verified_user
                                    </span>
                                    <div>
                                        <p className="font-bold text-on-surface text-sm">
                                            {agent.displayName ?? formatWallet(agent.walletAddress)}
                                        </p>
                                        <p className="font-mono text-xs text-on-surface-variant">
                                            {formatWallet(agent.walletAddress)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                                    <span>NFT #{agent.nftTokenId}</span>
                                    <span>認證於 {formatDate(agent.activatedAt)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </SiteLayout>
    );
}
```

- [ ] **Step 3: Create `react-service/src/pages/AgentDetailPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteLayout from "../layouts/SiteLayout";
import { getAgentDetail, type AgentDetailResponse } from "../api/agentApi";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export default function AgentDetailPage() {
    const { wallet } = useParams<{ wallet: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [agent, setAgent] = useState<AgentDetailResponse | null>(null);

    useEffect(() => {
        if (!wallet) return;
        getAgentDetail(wallet)
            .then(setAgent)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "載入失敗"))
            .finally(() => setLoading(false));
    }, [wallet]);

    return (
        <SiteLayout>
            <div className="mx-auto max-w-2xl px-6 py-12">
                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">載入中…</span>
                    </div>
                ) : error || !agent ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-on-surface-variant text-sm mb-4">找不到此仲介</p>
                        <button
                            type="button"
                            onClick={() => navigate("/agents")}
                            className="text-sm text-[#006c4a] hover:underline bg-transparent"
                        >
                            返回仲介列表
                        </button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary mb-6">
                            <span className="material-symbols-outlined text-base"
                                style={{ fontVariationSettings: "'FILL' 1" }}>
                                verified_user
                            </span>
                            鏈上認證仲介
                        </div>

                        <h1 className="text-2xl font-extrabold text-on-surface mb-1">
                            {agent.displayName ?? formatWallet(agent.walletAddress)}
                        </h1>
                        <p className="font-mono text-sm text-on-surface-variant mb-8">
                            {agent.walletAddress}
                        </p>

                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-surface-container pb-3">
                                <dt className="text-on-surface-variant">認證日期</dt>
                                <dd className="font-medium text-on-surface">{formatDate(agent.activatedAt)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-surface-container pb-3">
                                <dt className="text-on-surface-variant">NFT Token ID</dt>
                                <dd className="font-mono text-on-surface">#{agent.nftTokenId}</dd>
                            </div>
                            {agent.txHash && (
                                <div className="flex justify-between pb-3">
                                    <dt className="text-on-surface-variant">鏈上交易</dt>
                                    <dd className="font-mono text-xs text-on-surface truncate max-w-[200px]">
                                        {agent.txHash.slice(0, 10)}…{agent.txHash.slice(-6)}
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <p className="mt-8 text-xs text-on-surface-variant/60 text-center">
                            完整仲介主頁（服務區域、履歷、評價）將於後續版本開放
                        </p>
                    </div>
                )}
            </div>
        </SiteLayout>
    );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify in browser**

Start dev server:
```bash
cd react-service && npm run dev
```

- Navigate to `http://localhost:5173/agents` → should render agent list (empty or with data)
- Navigate to `http://localhost:5173/agents/0xNonExistent` → should show "找不到此仲介"
- If an AGENT-credentialed user exists in your test data, navigate to their wallet URL → should show detail card
- Click an agent card in the list → navigates to detail page

- [ ] **Step 6: Commit**

```bash
git add react-service/src/api/agentApi.ts react-service/src/pages/AgentListPage.tsx react-service/src/pages/AgentDetailPage.tsx
git commit -m "feat: add agent API client and agent list/detail pages"
```

---

### Task 10: Final Integration Verification

- [ ] **Step 1: Run Go tests**

```bash
cd go-service && go test ./...
```

Expected: all packages pass, no failures.

- [ ] **Step 2: Run TypeScript check**

```bash
cd react-service && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run frontend lint**

```bash
cd react-service && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Verify capability matrix in browser**

Start the dev server (`cd react-service && npm run dev`) and confirm each scenario:

| Scenario | URL | Expected |
|---|---|---|
| Not logged in | `/listings/1` | "請先登入" gate |
| KYC only (no role) | `/listings/1` | "需要角色認證" gate |
| OWNER activated | `/listings/1` | ✅ listing detail renders |
| OWNER activated | `/listings/new` | ✅ create form renders |
| TENANT activated | `/listings/new` | "需要角色認證" gate |
| TENANT activated | `/listings/1` | ✅ listing detail with appointment section |
| OWNER activated | `/listings/1` | ✅ listing detail WITHOUT appointment section |
| Any user | `/agents` | ✅ public agent list |
| Any user | `/agents/:wallet` | ✅ public agent detail |
| OWNER activated | `/listings` | ✅ "刊登房源" button visible |
| KYC only (no OWNER) | `/listings` | "刊登房源" button NOT visible |

- [ ] **Step 5: Final commit if any cleanups needed**

```bash
git add -p  # stage only what's clean
git commit -m "feat: gate 1b capability gating and agent directory complete"
```
