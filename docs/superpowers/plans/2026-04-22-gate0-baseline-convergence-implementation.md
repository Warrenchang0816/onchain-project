# Gate 0 Baseline Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current repo truthful and executable by delivering a real listing-create flow, removing fake listing fallbacks from live pages, aligning member actions to the real KYC-gated workflow, and deleting the remaining Task Tracker residue that would mislead Gate 1 work.

**Architecture:** Keep Gate 0 constrained to the live baseline only. Reuse the existing `listings` REST endpoints and DTOs, share one listing editor form between create and edit, replace placeholder data with explicit loading/empty/error states, and remove dead Task Tracker code and docs now while deferring live env/config cleanup until after the repo still verifies cleanly. Do not add Gate 1 credential application pages or any new on-chain Property / Agency / Case / Stake behavior in this Gate.

**Tech Stack:** React 19 + TypeScript + Vite frontend, existing fetch-based API clients, Go 1.25 service config, existing listing REST endpoints, Markdown/docs updates.

---

## File Structure

- Create: `react-service/src/components/listing/ListingEditorForm.tsx`
- Create: `react-service/src/pages/ListingCreatePage.tsx`
- Modify: `react-service/src/pages/ListingDetailPage.tsx`
- Modify: `react-service/src/pages/ListingListPage.tsx`
- Modify: `react-service/src/pages/HomePage.tsx`
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`
- Modify: `react-service/src/components/common/Header.tsx`
- Modify: `react-service/src/pages/BlockchainLogsPage.tsx`
- Modify: `react-service/src/router/index.tsx`
- Modify: `react-service/src/api/listingApi.ts`
- Modify: `react-service/tsconfig.app.json`
- Modify: `react-service/eslint.config.js`
- Modify: `react-service/CLAUDE.md`
- Delete: `react-service/src/types/task.ts`
- Delete: `react-service/src/types/listing.ts`
- Delete: `react-service/src/types/case.ts`
- Delete: `react-service/src/api/caseApi.ts`
- Delete: `react-service/src/api/dashboardApi.ts`
- Delete: `react-service/src/api/taskApi.ts.bak`
- Delete: `react-service/src/pages/TaskListPage.tsx`
- Delete: `react-service/src/pages/TaskDetailPage.tsx`
- Delete: `react-service/src/components/task/ClaimOnchainButton.tsx`
- Delete: `react-service/src/components/task/FundTaskButton.tsx`
- Delete: `react-service/src/components/task/PropertyCard.tsx`
- Delete: `react-service/src/components/task/TaskCard.tsx`
- Delete: `react-service/src/components/task/TaskForm.tsx`
- Delete: `react-service/src/components/task/TaskSubmitModal.tsx`
- Delete: `react-service/src/lib/wallet/taskOnchain.ts`
- Delete: `react-service/src/lib/wallet/constants.ts`
- Delete: `react-service/src/lib/wallet/abi/taskRewardVaultAbi.ts`
- Delete: `go-service/docs/Onchain Task Tracker：Docker 標準化部署指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：v2 公版開發指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：區塊鏈與合約建立指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：組員本地開發指南.md`
- Modify: `go-service/internal/platform/config/config.go`
- Modify: `go-service/.env.example`
- Modify: `dev_log/2026-04-22.md`

## Verification Rule

- Do not introduce a new frontend test framework in this Gate. `react-service/CLAUDE.md` explicitly says not to add one unless requested.
- Frontend verification for this Gate is `npm run lint`, `npm run build`, plus manual smoke checks on the affected routes.
- Backend verification for this Gate is `go test ./...` because the Go changes are wording/config only.

### Task 1: Add A Real Listing Create Flow

**Files:**
- Create: `react-service/src/components/listing/ListingEditorForm.tsx`
- Create: `react-service/src/pages/ListingCreatePage.tsx`
- Modify: `react-service/src/pages/ListingDetailPage.tsx`
- Modify: `react-service/src/router/index.tsx`

- [ ] **Step 1: Create the shared listing editor component**

```tsx
import { useMemo, useState } from "react";
import type {
    CreateListingPayload,
    ListingType,
    UpdateListingPayload,
} from "../api/listingApi";

type ListingEditorMode = "create" | "edit";

type ListingEditorValues = {
    title: string;
    description: string;
    address: string;
    district: string;
    listType: ListingType;
    price: string;
    areaPing: string;
    floor: string;
    totalFloors: string;
    roomCount: string;
    bathroomCount: string;
    isPetAllowed: boolean;
    isParkingIncluded: boolean;
    durationDays: string;
};

interface ListingEditorFormProps {
    mode: ListingEditorMode;
    initialValues: ListingEditorValues;
    submitting: boolean;
    submitLabel: string;
    onSubmit: (payload: CreateListingPayload | UpdateListingPayload) => Promise<void> | void;
    onCancel?: () => void;
}

function toOptionalNumber(value: string): number | undefined {
    return value.trim() === "" ? undefined : Number(value);
}

export default function ListingEditorForm(props: ListingEditorFormProps) {
    const [form, setForm] = useState<ListingEditorValues>(props.initialValues);
    const [error, setError] = useState("");

    const canSubmit = useMemo(() => {
        return form.title.trim() !== "" && form.address.trim() !== "" && Number(form.price) > 0;
    }, [form]);

    const handleSubmit = async () => {
        try {
            setError("");
            const base = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                address: form.address.trim(),
                district: form.district.trim() || undefined,
                price: Number(form.price),
                area_ping: toOptionalNumber(form.areaPing),
                floor: toOptionalNumber(form.floor),
                total_floors: toOptionalNumber(form.totalFloors),
                room_count: toOptionalNumber(form.roomCount),
                bathroom_count: toOptionalNumber(form.bathroomCount),
                is_pet_allowed: form.isPetAllowed,
                is_parking_included: form.isParkingIncluded,
            };

            if (props.mode === "create") {
                await props.onSubmit({
                    ...base,
                    list_type: form.listType,
                    duration_days: Number(form.durationDays || "30"),
                } satisfies CreateListingPayload);
                return;
            }

            await props.onSubmit(base satisfies UpdateListingPayload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save listing.");
        }
    };
}
```

- [ ] **Step 2: Replace the inline `EditForm` in `ListingDetailPage.tsx` with the shared component**

```tsx
import ListingEditorForm from "../components/listing/ListingEditorForm";

const editInitialValues = listing
    ? {
        title: listing.title,
        description: listing.description ?? "",
        address: listing.address,
        district: listing.district ?? "",
        listType: listing.list_type,
        price: String(listing.price),
        areaPing: listing.area_ping ? String(listing.area_ping) : "",
        floor: listing.floor ? String(listing.floor) : "",
        totalFloors: listing.total_floors ? String(listing.total_floors) : "",
        roomCount: listing.room_count ? String(listing.room_count) : "",
        bathroomCount: listing.bathroom_count ? String(listing.bathroom_count) : "",
        isPetAllowed: listing.is_pet_allowed,
        isParkingIncluded: listing.is_parking_included,
        durationDays: "30",
    }
    : null;

<Modal isOpen={modal === "edit"} title="Edit listing" onClose={() => setModal(null)}>
    {listing && editInitialValues ? (
        <ListingEditorForm
            mode="edit"
            initialValues={editInitialValues}
            submitting={isActionLoading}
            submitLabel="Save changes"
            onSubmit={(payload) => handleEdit(payload as UpdateListingPayload)}
            onCancel={() => setModal(null)}
        />
    ) : null}
</Modal>
```

- [ ] **Step 3: Create `ListingCreatePage.tsx` and wire it to `createListing()`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createListing,
    type CreateListingPayload,
    type UpdateListingPayload,
} from "../api/listingApi";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus } from "../api/kycApi";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import SiteLayout from "../layouts/SiteLayout";

export default function ListingCreatePage() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated" | "kyc-required">("loading");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            const auth = await getAuthMe().catch(() => ({ authenticated: false }));
            if (!auth.authenticated) {
                setStatus("unauthenticated");
                return;
            }
            const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as const }));
            setStatus(kyc.kycStatus === "VERIFIED" ? "ready" : "kyc-required");
        };
        void load();
    }, []);

    const handleSubmit = async (payload: CreateListingPayload | UpdateListingPayload) => {
        setSubmitting(true);
        try {
            const created = await createListing(payload as CreateListingPayload);
            navigate(`/listings/${created.id}`);
        } finally {
            setSubmitting(false);
        }
    };
}
```

- [ ] **Step 4: Add the new route in `react-service/src/router/index.tsx`**

```tsx
import ListingCreatePage from "../pages/ListingCreatePage";

{
    path: "/listings/new",
    element: <ListingCreatePage />,
},
```

- [ ] **Step 5: Run frontend verification for the new create flow**

Run: `npm run lint`  
Expected: exit code `0` with no ESLint errors from the new form/page/router wiring.

Run: `npm run build`  
Expected: exit code `0` and a successful Vite production build.

- [ ] **Step 6: Commit the create-flow checkpoint**

```bash
git add -- react-service/src/components/listing/ListingEditorForm.tsx react-service/src/pages/ListingCreatePage.tsx react-service/src/pages/ListingDetailPage.tsx react-service/src/router/index.tsx
git commit -m "feat: add real listing creation flow"
```

### Task 2: Remove Fake Listing Fallbacks From Live Pages

**Files:**
- Modify: `react-service/src/pages/HomePage.tsx`
- Modify: `react-service/src/pages/ListingListPage.tsx`
- Modify: `react-service/src/pages/ListingDetailPage.tsx`

- [ ] **Step 1: Remove placeholder arrays and negative-ID shortcuts**

```tsx
// Delete these blocks entirely:
// - PLACEHOLDER_CARDS in HomePage.tsx
// - PLACEHOLDER_LISTINGS / PLACEHOLDER_MY_LISTING in ListingListPage.tsx
// - PLACEHOLDER_DETAIL / PLACEHOLDER_THUMBS in ListingDetailPage.tsx
// - listingId < 0 shortcut in ListingDetailPage.load()
```

- [ ] **Step 2: Make `HomePage.tsx` render honest loading / empty / ready states**

```tsx
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState("");

useEffect(() => {
    const load = async () => {
        try {
            setLoading(true);
            setLoadError("");
            const data = await getListings();
            setListings(data);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Failed to load listings.");
        } finally {
            setLoading(false);
        }
    };
    void load();
}, []);

const recentListings = listings.filter((l) => l.status === "ACTIVE").slice(0, 3);

{loading ? (
    <div className="py-16 text-sm text-on-surface-variant">Loading recent listings...</div>
) : loadError ? (
    <div className="py-16 text-sm text-error">{loadError}</div>
) : recentListings.length === 0 ? (
    <div className="py-16 rounded-xl bg-surface-container-low text-on-surface-variant">
        No active listings yet. Check back after the first verified owner publishes a listing.
    </div>
) : (
    recentListings.map((listing) => ...)
)}
```

- [ ] **Step 3: Make `ListingListPage.tsx` honest about public data and "My Listings"**

```tsx
const featureListing = myListings[0] ?? null;
const myActiveCount = myListings.filter((l) => l.status === "ACTIVE").length;
const myNegotiatingCount = myListings.filter((l) => l.status === "NEGOTIATING").length;
const myDraftCount = myListings.filter((l) => l.status === "DRAFT").length;

{displayListings.length === 0 ? (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
        <h3 className="text-xl font-bold text-on-surface">No listings match this filter yet</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
            Verified users can still create a draft listing from the owner flow.
        </p>
    </div>
) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
        {displayListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/listings/${listing.id}`)} />
        ))}
    </div>
)}

{auth.authenticated ? (
    featureListing ? (
        <FeatureMyListingBlock listing={featureListing} />
    ) : (
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
            <h3 className="text-2xl font-bold text-on-surface">You do not have any listings yet</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
                Complete KYC, then create a draft listing to start the owner flow.
            </p>
            <button type="button" onClick={() => navigate("/listings/new")}>Create draft listing</button>
        </div>
    )
) : null}
```

- [ ] **Step 4: Make `ListingDetailPage.tsx` handle only real records**

```tsx
const load = async () => {
    if (isNaN(listingId)) {
        setErrorMsg("Invalid listing id.");
        setIsLoading(false);
        return;
    }

    try {
        setIsLoading(true);
        setErrorMsg("");
        setListing(await getListing(listingId));
    } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load listing.");
        setListing(null);
    } finally {
        setIsLoading(false);
    }
};

if (!isLoading && !listing) {
    return (
        <SiteLayout>
            <main className="max-w-[960px] mx-auto px-6 py-20">
                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                    <h1 className="text-2xl font-bold text-on-surface">Listing not available</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">{errorMsg || "The listing was removed or does not exist."}</p>
                </div>
            </main>
        </SiteLayout>
    );
}
```

- [ ] **Step 5: Run frontend verification for the honest listing surfaces**

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

- [ ] **Step 6: Commit the truthfulness cleanup checkpoint**

```bash
git add -- react-service/src/pages/HomePage.tsx react-service/src/pages/ListingListPage.tsx react-service/src/pages/ListingDetailPage.tsx
git commit -m "refactor: remove fake listing fallbacks from live pages"
```

### Task 3: Align Member Actions To The Real KYC-Gated Workflow

**Files:**
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`

- [ ] **Step 1: Replace broken `/credential/*` navigation with real Gate 0 actions**

```tsx
const ownerAction = hasOwner
    ? { label: "Manage listings", onClick: () => navigate("/listings") }
    : isVerified
        ? { label: "Create draft listing", onClick: () => navigate("/listings/new") }
        : { label: "Complete KYC first", disabled: true };

const tenantAction = hasTenant
    ? { label: "Browse listings", onClick: () => navigate("/listings") }
    : isVerified
        ? { label: "Start booking viewings", onClick: () => navigate("/listings") }
        : { label: "Complete KYC first", disabled: true };

const agentAction = hasAgent
    ? { label: "View credential details", onClick: () => navigate("/profile") }
    : { label: "Opens in Gate 1", disabled: true };
```

- [ ] **Step 2: Update card copy so it distinguishes current capability vs future credential minting**

```tsx
<p className="text-sm text-on-surface-variant leading-[1.75]">
    Gate 0 live flow: verified users can already create and manage draft listings.
    Formal OWNER credential application and minting arrive in Gate 1.
</p>

<p className="text-sm text-on-surface-variant leading-[1.75]">
    Gate 0 live flow: verified users can browse listings and book viewings.
    Formal TENANT credential application and minting arrive in Gate 1.
</p>

<p className="text-sm text-on-surface-variant leading-[1.75]">
    AGENT onboarding is intentionally deferred. The button must stay disabled until Gate 1 APIs and pages exist.
</p>
```

- [ ] **Step 3: Ensure every role card ends in one of only three states**

```text
Allowed Gate 0 outcomes:
1. A real live action (`/listings/new`, `/listings`, `/profile`)
2. A KYC-blocked disabled action
3. A Gate 1 disabled action

Forbidden Gate 0 outcomes:
- Any navigation to `/credential/owner`
- Any navigation to `/credential/tenant`
- Any navigation to `/credential/agent`
```

- [ ] **Step 4: Run frontend verification for the member center**

Run: `npm run build`  
Expected: exit code `0`.

- [ ] **Step 5: Commit the member-center alignment checkpoint**

```bash
git add -- react-service/src/pages/IdentityCenterPage.tsx
git commit -m "refactor: align identity center with gate 0 live actions"
```

### Task 4: Downgrade The Old Logs Surface To Legacy Debug Status

**Files:**
- Modify: `react-service/src/components/common/Header.tsx`
- Modify: `react-service/src/pages/BlockchainLogsPage.tsx`
- Modify: `react-service/src/api/listingApi.ts`

- [ ] **Step 1: Remove `/logs` from the primary user navigation**

```tsx
<nav className="hidden md:flex items-center gap-8">
    <NavLink to="/" end className={navLinkCls}>Home</NavLink>
    <NavLink to="/listings" className={navLinkCls}>Listings</NavLink>
</nav>
```

- [ ] **Step 2: Reframe `BlockchainLogsPage.tsx` as a legacy/operator debug page**

```tsx
const LEGACY_BANNER =
    "This page is a legacy/operator debug feed. It is not yet the user-facing on-chain proof feed for Property, Agency, Case, or Stake.";

<div className="mb-6 rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
    {LEGACY_BANNER}
</div>
```

- [ ] **Step 3: Replace task-first wording with neutral wording**

```tsx
const ACTION_LABELS: Record<string, string> = {
    FUND: "Funding",
    ASSIGN_WORKER: "Assignment",
    APPROVE_TASK: "Approval",
    CLAIM_REWARD: "Claim",
};

// UI labels:
// "Task ID" -> "Reference ID"
// "No blockchain logs yet" -> "No legacy debug events yet"
// "Activity" copy should not imply current housing-platform proof completeness
```

- [ ] **Step 4: Keep the wire format stable, but document the legacy field in `listingApi.ts`**

```ts
export type BlockchainLog = {
    id: number;
    taskId: string; // legacy reference id from pre-housing task logs; keep field name for current backend payload
    walletAddress: string;
    action: string;
    txHash: string;
    chainId: number;
    contractAddress: string;
    status: string;
    createdAt: string;
};
```

- [ ] **Step 5: Run frontend verification for header + logs**

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

- [ ] **Step 6: Commit the log-surface downgrade checkpoint**

```bash
git add -- react-service/src/components/common/Header.tsx react-service/src/pages/BlockchainLogsPage.tsx react-service/src/api/listingApi.ts
git commit -m "refactor: downgrade legacy logs surface"
```

### Task 5: Converge Config, Agent Guidance, And Archive Markers

**Files:**
- Modify: `react-service/tsconfig.app.json`
- Modify: `react-service/eslint.config.js`
- Modify: `react-service/CLAUDE.md`
- Delete: `react-service/src/types/task.ts`
- Delete: `react-service/src/types/listing.ts`
- Delete: `react-service/src/types/case.ts`
- Delete: `react-service/src/api/caseApi.ts`
- Delete: `react-service/src/api/dashboardApi.ts`
- Delete: `react-service/src/api/taskApi.ts.bak`
- Delete: `react-service/src/pages/TaskListPage.tsx`
- Delete: `react-service/src/pages/TaskDetailPage.tsx`
- Delete: `react-service/src/components/task/ClaimOnchainButton.tsx`
- Delete: `react-service/src/components/task/FundTaskButton.tsx`
- Delete: `react-service/src/components/task/PropertyCard.tsx`
- Delete: `react-service/src/components/task/TaskCard.tsx`
- Delete: `react-service/src/components/task/TaskForm.tsx`
- Delete: `react-service/src/components/task/TaskSubmitModal.tsx`
- Delete: `react-service/src/lib/wallet/taskOnchain.ts`
- Delete: `react-service/src/lib/wallet/constants.ts`
- Delete: `react-service/src/lib/wallet/abi/taskRewardVaultAbi.ts`
- Delete: `go-service/docs/Onchain Task Tracker：Docker 標準化部署指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：v2 公版開發指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：區塊鏈與合約建立指南.md`
- Delete: `go-service/docs/Onchain Task Tracker：組員本地開發指南.md`
- Modify: `go-service/internal/platform/config/config.go`
- Modify: `go-service/.env.example`

- [ ] **Step 1: Delete the dead Task Tracker frontend bundle**

```bash
git rm -- react-service/src/pages/TaskListPage.tsx react-service/src/pages/TaskDetailPage.tsx react-service/src/components/task/ClaimOnchainButton.tsx react-service/src/components/task/FundTaskButton.tsx react-service/src/components/task/PropertyCard.tsx react-service/src/components/task/TaskCard.tsx react-service/src/components/task/TaskForm.tsx react-service/src/components/task/TaskSubmitModal.tsx react-service/src/types/task.ts react-service/src/types/listing.ts react-service/src/types/case.ts react-service/src/api/caseApi.ts react-service/src/api/dashboardApi.ts react-service/src/api/taskApi.ts.bak react-service/src/lib/wallet/taskOnchain.ts react-service/src/lib/wallet/constants.ts react-service/src/lib/wallet/abi/taskRewardVaultAbi.ts
```

- [ ] **Step 2: Remove the obsolete exclude rules that referenced the deleted files**

```json
// react-service/tsconfig.app.json
"exclude": []
```

```js
// react-service/eslint.config.js
ignores: [],
```

- [ ] **Step 3: Rewrite `react-service/CLAUDE.md` so it matches the real frontend**

```markdown
# CLAUDE.md -- trusted-housing-platform / react-service

## Project Overview
React SPA for the trusted housing platform. Mainline flows today are KYC/onboarding, wallet + password auth, member/profile views, listing CRUD, and viewing appointments.

## Mainline Routes
| Path | Page | Description |
| --- | --- | --- |
| `/` | `HomePage` | Public landing + recent listings |
| `/listings` | `ListingListPage` | Public listing index + owner dashboard section |
| `/listings/:id` | `ListingDetailPage` | Listing detail + owner actions + appointments |
| `/listings/new` | `ListingCreatePage` | Verified-user listing creation |
| `/member` | `IdentityCenterPage` | KYC / live capability overview |

## What To Avoid
- Do not reintroduce Task Tracker terminology into mainline pages.
- Do not add a frontend test framework unless the user explicitly asks.
- Do not treat `/logs` as a primary user-facing proof surface.
```

- [ ] **Step 4: Delete the old `go-service/docs/*` Task Tracker guides**

```bash
git rm -- "go-service/docs/Onchain Task Tracker：Docker 標準化部署指南.md" "go-service/docs/Onchain Task Tracker：v2 公版開發指南.md" "go-service/docs/Onchain Task Tracker：區塊鏈與合約建立指南.md" "go-service/docs/Onchain Task Tracker：組員本地開發指南.md"
```

- [ ] **Step 5: Run verification after aggressive deletion, before touching live env/config**

Run: `npm run lint`  
Expected: exit code `0`.

Run: `npm run build`  
Expected: exit code `0`.

Run: `go test ./...`  
Expected: exit code `0`.

- [ ] **Step 6: Commit the aggressive cleanup checkpoint**

```bash
git add -- react-service/tsconfig.app.json react-service/eslint.config.js react-service/CLAUDE.md
git commit -m "chore: remove legacy task tracker bundle"
```

- [ ] **Step 7: Update the default SIWE wording to the housing-platform baseline**

```go
func LoadSIWEConfig() *SIWEConfig {
    return &SIWEConfig{
        AppDomain:         GetEnv("APP_DOMAIN", "localhost:5173"),
        AppURI:            GetEnv("APP_URI", "http://localhost:5173"),
        SIWEStatement:     GetEnv("SIWE_STATEMENT", "Sign in to Trusted Housing Platform."),
        SIWEVersion:       GetEnv("SIWE_VERSION", "1"),
        SIWEChainID:       GetEnv("SIWE_CHAIN_ID", "11155111"),
        NonceExpire:       GetEnv("SIWE_NONCE_EXPIRE", "300"),
        AuthSessionExpire: GetEnv("AUTH_SESSION_EXPIRE", "86400"),
        AuthCookieName:    GetEnv("AUTH_COOKIE_NAME", "go_service_session"),
        AuthSessionSecure: GetEnv("AUTH_SESSION_SECURE", "false"),
    }
}
```

```dotenv
SIWE_STATEMENT=Sign in to Trusted Housing Platform.
```

- [ ] **Step 8: Run Go + frontend verification for the remaining wording/config changes**

Run: `go test ./...`  
Expected: exit code `0`.

Run: `npm run lint`  
Expected: exit code `0`.

- [ ] **Step 9: Commit the convergence checkpoint**

```bash
git add -- go-service/internal/platform/config/config.go go-service/.env.example
git commit -m "chore: converge gate 0 wording and config defaults"
```

### Task 6: Final Verification And Handoff

**Files:**
- Modify: `dev_log/2026-04-22.md`
- Verify: `git diff --stat`
- Verify: `git status --short --branch`

- [ ] **Step 1: Append a Gate 0 execution entry to the dev log**

```markdown
## Gate 0 baseline convergence execution

- Added a real `/listings/new` flow using the live listing API.
- Removed fake listing placeholder fallbacks from the public/home/detail surfaces.
- Reframed member-center actions around the actual KYC-gated Gate 0 behavior.
- Downgraded `/logs` to a legacy/operator debug page instead of a mainline trust surface.
- Added archive markers to old Task Tracker guidance and compatibility shims.
```

- [ ] **Step 2: Run the final repo verification commands**

Run: `npm run build`  
Expected: exit code `0`.

Run: `go test ./...`  
Expected: exit code `0`.

Run: `git diff --stat`  
Expected: only the files listed in this plan.

Run: `git status --short --branch`  
Expected: clean working tree after the final commit.

- [ ] **Step 3: Execute the manual smoke checklist**

```text
1. Unauthenticated user opens `/listings/new` and is redirected or blocked toward `/login`.
2. Authenticated but non-verified user opens `/listings/new` and sees a KYC-required state, not a broken page.
3. Verified user opens `/listings/new`, submits a draft, and lands on `/listings/:id`.
4. `/` and `/listings` show honest empty states when there are no active listings instead of fake cards.
5. `/listings/:id` with an invalid or removed id shows a "not available" state instead of placeholder data.
6. `/member` contains no working path to `/credential/*`.
7. Header no longer advertises `/logs` as a primary user flow.
8. Visiting `/logs` manually shows the legacy/debug disclaimer.
```

- [ ] **Step 4: Commit the final Gate 0 handoff checkpoint**

```bash
git add -- dev_log/2026-04-22.md
git commit -m "docs: record gate 0 baseline convergence execution"
```
