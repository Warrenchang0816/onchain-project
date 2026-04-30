# Three Role Integrated Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/member` into the integrated OWNER / TENANT / AGENT workbench dashboard and make the related role pages discoverable, readable, and coherent before matching work begins.

**Architecture:** Keep the existing backend and API clients. Add small frontend view helpers for role summaries, then refactor `IdentityCenterPage` to render independent role cards from existing API data. Clean the touched role pages and header navigation so the first three-role skeleton is understandable without adding new database tables or matching endpoints.

**Tech Stack:** React 19, TypeScript 5, React Router v7, Tailwind utility classes, existing native `fetch` API clients, Vite build and ESLint verification.

---

## File Map

### New Files

- `react-service/src/pages/identityCenterViewModel.ts`: Pure summary helpers for OWNER, TENANT, and AGENT dashboard cards.

### Modified Files

- `react-service/src/pages/IdentityCenterPage.tsx`: Integrated `/member` dashboard layout and role cards.
- `react-service/src/components/common/Header.tsx`: Compact navigation labels and account menu labels.
- `react-service/src/pages/MyListingsPage.tsx`: OWNER workbench labels, empty state, and readiness copy.
- `react-service/src/pages/MyRequirementsPage.tsx`: TENANT requirement management labels and empty state.
- `react-service/src/pages/TenantProfilePage.tsx`: TENANT profile/workbench framing and copy.
- `react-service/src/pages/MyAgentProfilePage.tsx`: AGENT profile/workbench framing and copy.
- `react-service/src/pages/AgentListPage.tsx`: AGENT discovery labels and filters.
- `react-service/src/pages/AgentDetailPage.tsx`: AGENT public profile labels and private profile CTA.
- `react-service/src/pages/RequirementsPage.tsx`: OWNER/AGENT tenant-demand browsing labels and empty state.
- `react-service/src/pages/RequirementDetailPage.tsx`: OWNER/AGENT demand-detail labels and restricted-data messaging.

---

### Task 1: Dashboard Summary View Model

**Files:**
- Create: `react-service/src/pages/identityCenterViewModel.ts`

- [ ] **Step 1: Create pure role summary helpers**

Create `react-service/src/pages/identityCenterViewModel.ts`:

```ts
import type { AgentDetailResponse } from "@/api/agentApi";
import type { CredentialCenterItem, CredentialType } from "@/api/credentialApi";
import type { Listing } from "@/api/listingApi";
import type { TenantProfile, TenantRequirement } from "@/api/tenantApi";

export type RoleActivationState = "inactive" | "pending" | "ready" | "active" | "rejected";

export type RoleDashboardSummary = {
    title: string;
    state: RoleActivationState;
    statusLabel: string;
    primaryActionLabel: string;
    primaryActionPath: string;
    secondaryActions: Array<{ label: string; path: string }>;
    metrics: Array<{ label: string; value: string | number }>;
    nextStep: string;
};

const credentialPaths: Record<CredentialType, string> = {
    OWNER: "/credential/owner",
    TENANT: "/credential/tenant",
    AGENT: "/credential/agent",
};

function activationState(item?: CredentialCenterItem): RoleActivationState {
    if (!item) return "inactive";
    if (item.displayStatus === "ACTIVATED") return "active";
    if (item.displayStatus === "PASSED_READY") return "ready";
    if (item.displayStatus === "REJECTED") return "rejected";
    return "pending";
}

function inactiveSummary(type: CredentialType, title: string, nextStep: string): RoleDashboardSummary {
    return {
        title,
        state: "inactive",
        statusLabel: "未啟用",
        primaryActionLabel: "啟用身分",
        primaryActionPath: credentialPaths[type],
        secondaryActions: [],
        metrics: [{ label: "狀態", value: "未申請" }],
        nextStep,
    };
}

export function buildOwnerSummary(item: CredentialCenterItem | undefined, listings: Listing[]): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("OWNER", "房東工作台", "啟用房東身分後，可以管理物件、補齊刊登資料並發布出租或出售資訊。");
    }

    const draft = listings.filter((listing) => listing.status === "DRAFT");
    const active = listings.filter((listing) => listing.status === "ACTIVE");
    const incomplete = draft.filter((listing) => listing.setup_status === "INCOMPLETE");
    const ready = draft.filter((listing) => listing.setup_status === "READY");

    return {
        title: "房東工作台",
        state,
        statusLabel: "已啟用",
        primaryActionLabel: "管理物件",
        primaryActionPath: "/my/listings",
        secondaryActions: [{ label: "新增刊登", path: "/my/listings/new" }],
        metrics: [
            { label: "待補資料", value: incomplete.length },
            { label: "可發布草稿", value: ready.length },
            { label: "已上架", value: active.length },
        ],
        nextStep: listings.length === 0 ? "目前沒有物件，先建立或啟用房東資料來產生第一筆草稿。" : "檢查草稿是否已補齊出租或出售明細。",
    };
}

export function buildTenantSummary(
    item: CredentialCenterItem | undefined,
    requirements: TenantRequirement[],
    profile?: TenantProfile,
): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("TENANT", "租客工作台", "啟用租客身分後，可以建立租屋需求並補充租客資料。");
    }

    const open = requirements.filter((requirement) => requirement.status === "OPEN");
    const paused = requirements.filter((requirement) => requirement.status === "PAUSED");

    return {
        title: "租客工作台",
        state,
        statusLabel: profile?.advancedDataStatus === "ADVANCED" ? "進階資料已完成" : "基本資料",
        primaryActionLabel: "管理需求",
        primaryActionPath: "/my/requirements",
        secondaryActions: [{ label: "租客資料", path: "/my/tenant-profile" }],
        metrics: [
            { label: "開放中", value: open.length },
            { label: "暫停", value: paused.length },
            { label: "資料狀態", value: profile?.advancedDataStatus === "ADVANCED" ? "進階" : "基本" },
        ],
        nextStep: requirements.length === 0 ? "建立第一筆租屋需求，讓房東與仲介看見你的條件。" : "維護需求狀態，讓開放中的需求保持可被瀏覽。",
    };
}

export function buildAgentSummary(item: CredentialCenterItem | undefined, profile: AgentDetailResponse | null, wallet?: string): RoleDashboardSummary {
    const state = activationState(item);
    if (state !== "active") {
        return inactiveSummary("AGENT", "仲介工作台", "啟用仲介身分後，可以建立公開個人頁並出現在仲介列表。");
    }

    return {
        title: "仲介工作台",
        state,
        statusLabel: profile?.isProfileComplete ? "公開頁已完成" : "公開頁未完成",
        primaryActionLabel: "編輯個人頁",
        primaryActionPath: "/my/agent-profile",
        secondaryActions: wallet ? [{ label: "查看公開頁", path: `/agents/${wallet}` }] : [{ label: "仲介列表", path: "/agents" }],
        metrics: [
            { label: "服務區域", value: profile?.serviceAreas.length ?? 0 },
            { label: "公開頁", value: profile?.isProfileComplete ? "已完成" : "未完成" },
            { label: "聯絡設定", value: profile?.licenseNote ? "已填寫" : "待補" },
        ],
        nextStep: profile?.isProfileComplete ? "定期更新服務區域與公開說明。" : "補齊標題、介紹、服務區域與證照說明，讓公開頁可被信任。",
    };
}
```

- [ ] **Step 2: Run build to verify the new helper compiles**

Run: `npm run build`  
Working directory: `react-service`  
Expected: build succeeds, with the existing Vite chunk-size warning allowed.

- [ ] **Step 3: Commit Task 1**

```bash
git add react-service/src/pages/identityCenterViewModel.ts
git commit -m "feat: add role dashboard summary helpers"
```

---

### Task 2: Integrated `/member` Dashboard

**Files:**
- Modify: `react-service/src/pages/IdentityCenterPage.tsx`

- [ ] **Step 1: Import the view-model helpers**

Update the imports:

```ts
import { getMyTenantProfile, getMyRequirements, type TenantProfile, type TenantRequirement } from "@/api/tenantApi";
import {
    buildAgentSummary,
    buildOwnerSummary,
    buildTenantSummary,
    type RoleDashboardSummary,
} from "./identityCenterViewModel";
```

- [ ] **Step 2: Extend page state with tenant profile and agent profile data**

Use this state shape:

```ts
type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    center?: CredentialCenterResponse;
    ownerListings: Listing[];
    tenantRequirements: TenantRequirement[];
    tenantProfile?: TenantProfile;
    agentProfile: AgentDetailResponse | null;
    roleErrors: Partial<Record<CredentialType, string>>;
    error?: string;
};
```

- [ ] **Step 3: Fetch role data independently**

Keep the current auth/KYC/credential load, then fetch role data with independent catches:

```ts
const ownerListings = credentials.includes("OWNER")
    ? await getMyListings().catch((err) => {
          roleErrors.OWNER = err instanceof Error ? err.message : "房東資料讀取失敗";
          return [] as Listing[];
      })
    : [];
```

Apply the same pattern for:

- `getMyRequirements`
- `getMyTenantProfile`
- `getMyAgentProfile`

- [ ] **Step 4: Render a reusable role dashboard card**

Add a local component:

```tsx
function WorkbenchCard(props: { summary: RoleDashboardSummary; error?: string; onNavigate: (path: string) => void }) {
    return (
        <section className="flex flex-col gap-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-on-surface">{props.summary.title}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{props.summary.statusLabel}</p>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {props.summary.state === "active" ? "已啟用" : "未啟用"}
                </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                {props.summary.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl bg-surface-container-low p-4">
                        <p className="text-xs text-on-surface-variant">{metric.label}</p>
                        <p className="mt-1 text-lg font-extrabold text-on-surface">{metric.value}</p>
                    </div>
                ))}
            </div>
            <p className="text-sm leading-[1.7] text-on-surface-variant">{props.summary.nextStep}</p>
            {props.error ? <p className="text-sm text-error">{props.error}</p> : null}
            <div className="mt-auto flex flex-wrap gap-3">
                <button type="button" onClick={() => props.onNavigate(props.summary.primaryActionPath)} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
                    {props.summary.primaryActionLabel}
                </button>
                {props.summary.secondaryActions.map((action) => (
                    <button key={action.path} type="button" onClick={() => props.onNavigate(action.path)} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">
                        {action.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 5: Replace the old role-card/workbench area with three integrated cards**

Build the summaries after `ownerItem`, `tenantItem`, and `agentItem`:

```ts
const ownerSummary = buildOwnerSummary(ownerItem, state.ownerListings);
const tenantSummary = buildTenantSummary(tenantItem, state.tenantRequirements, state.tenantProfile);
const agentSummary = buildAgentSummary(agentItem, state.agentProfile, state.address);
```

Render:

```tsx
<section className="grid gap-6 xl:grid-cols-3">
    <WorkbenchCard summary={ownerSummary} error={state.roleErrors.OWNER} onNavigate={navigate} />
    <WorkbenchCard summary={tenantSummary} error={state.roleErrors.TENANT} onNavigate={navigate} />
    <WorkbenchCard summary={agentSummary} error={state.roleErrors.AGENT} onNavigate={navigate} />
</section>
```

- [ ] **Step 6: Run frontend verification for `/member`**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: pass.

Run: `npm run build`  
Expected: pass, with the existing Vite chunk-size warning allowed.

- [ ] **Step 7: Commit Task 2**

```bash
git add react-service/src/pages/IdentityCenterPage.tsx
git commit -m "feat: integrate three role member dashboard"
```

---

### Task 3: Navigation and Workbench Copy Cleanup

**Files:**
- Modify: `react-service/src/components/common/Header.tsx`
- Modify: `react-service/src/pages/MyListingsPage.tsx`
- Modify: `react-service/src/pages/MyRequirementsPage.tsx`
- Modify: `react-service/src/pages/TenantProfilePage.tsx`
- Modify: `react-service/src/pages/MyAgentProfilePage.tsx`

- [ ] **Step 1: Clean header labels**

Use these labels in `Header.tsx`:

```ts
function deriveRole(kycStatus: KYCStatus, credentials: string[]): string {
    if (credentials.includes("AGENT")) return "仲介";
    if (credentials.includes("OWNER")) return "房東";
    if (credentials.includes("TENANT")) return "租客";
    if (kycStatus === "VERIFIED") return "已驗證";
    if (kycStatus === "PENDING") return "審核中";
    return "訪客";
}
```

Use menu items:

```ts
const menuItems = [
    { label: "會員資料", path: "/profile" },
    { label: "身分工作台", path: "/member" },
    { label: "收藏", path: "/favorites" },
    { label: "鏈上紀錄", path: "/logs" },
    { label: "設定", path: "/settings" },
];
```

Use nav labels:

- `首頁`
- `房源列表`
- `租屋需求`
- `仲介列表`

- [ ] **Step 2: Clean OWNER workbench labels**

In `MyListingsPage.tsx`, use status labels:

```ts
const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "已上架",
    NEGOTIATING: "洽談中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已結案",
    EXPIRED: "已過期",
    REMOVED: "已下架",
    SUSPENDED: "已停權",
};
```

Use page heading `我的物件` and empty-state copy `目前沒有物件草稿。啟用房東身分或新增刊登後，會在這裡管理物件資料、出租/出售明細和發布狀態。`

- [ ] **Step 3: Clean TENANT requirement labels**

In `MyRequirementsPage.tsx`, use:

```ts
const statusLabel: Record<TenantRequirementStatus, string> = {
    OPEN: "開放中",
    PAUSED: "暫停",
    CLOSED: "已關閉",
};
```

Use page heading `我的租屋需求`, form heading `新增需求` or `編輯需求`, buttons `儲存需求`, `取消編輯`, `開放`, `暫停`, `關閉`.

- [ ] **Step 4: Clean TENANT and AGENT profile workbench framing**

In `TenantProfilePage.tsx`, ensure the first heading is `租客資料` and the page explains that advanced data improves owner/agent confidence.

In `MyAgentProfilePage.tsx`, ensure the first heading is `仲介個人頁` and the page explains that public completeness affects the public directory.

- [ ] **Step 5: Run frontend verification**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: pass.

Run: `npm run build`  
Expected: pass, with the existing Vite chunk-size warning allowed.

- [ ] **Step 6: Commit Task 3**

```bash
git add react-service/src/components/common/Header.tsx \
  react-service/src/pages/MyListingsPage.tsx \
  react-service/src/pages/MyRequirementsPage.tsx \
  react-service/src/pages/TenantProfilePage.tsx \
  react-service/src/pages/MyAgentProfilePage.tsx
git commit -m "chore: clean role workbench navigation copy"
```

---

### Task 4: Public Demand and Agent Page Copy Cleanup

**Files:**
- Modify: `react-service/src/pages/RequirementsPage.tsx`
- Modify: `react-service/src/pages/RequirementDetailPage.tsx`
- Modify: `react-service/src/pages/AgentListPage.tsx`
- Modify: `react-service/src/pages/AgentDetailPage.tsx`

- [ ] **Step 1: Clean OWNER/AGENT demand list copy**

In `RequirementsPage.tsx`, use:

- Heading: `租屋需求列表`
- Supporting copy: `房東與仲介可以在這裡瀏覽租客公開的需求條件。租客敏感資料只會依照後端授權規則顯示。`
- Empty state: `目前沒有符合條件的租屋需求。`
- Filter labels: `行政區`, `狀態`, `全部`, `開放中`, `暫停`, `已關閉`

- [ ] **Step 2: Clean demand detail copy**

In `RequirementDetailPage.tsx`, use:

- Back label: `返回需求列表`
- Heading fallback: `租屋需求`
- Restricted-data label: `進階租客資料`
- Restricted-data empty copy: `租客尚未提供進階資料，或目前身分無法查看。`

- [ ] **Step 3: Clean agent list copy**

In `AgentListPage.tsx`, use:

- Heading: `仲介列表`
- Supporting copy: `瀏覽已啟用仲介身分的公開個人頁。`
- Filters: `服務區域`, `個人頁狀態`, `全部`, `已完成`, `未完成`
- Empty state: `目前沒有符合條件的仲介。`

- [ ] **Step 4: Clean agent detail copy**

In `AgentDetailPage.tsx`, use:

- Back label: `返回仲介列表`
- Public sections: `仲介介紹`, `服務區域`, `證照與備註`
- Private CTA label: `編輯我的仲介頁`

- [ ] **Step 5: Run frontend verification**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: pass.

Run: `npm run build`  
Expected: pass, with the existing Vite chunk-size warning allowed.

- [ ] **Step 6: Commit Task 4**

```bash
git add react-service/src/pages/RequirementsPage.tsx \
  react-service/src/pages/RequirementDetailPage.tsx \
  react-service/src/pages/AgentListPage.tsx \
  react-service/src/pages/AgentDetailPage.tsx
git commit -m "chore: clean public demand and agent workbench copy"
```

---

### Task 5: Final Verification and Cleanup

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run lint**

Run: `npm run lint`  
Working directory: `react-service`  
Expected: pass.

- [ ] **Step 2: Run build**

Run: `npm run build`  
Working directory: `react-service`  
Expected: pass, with the existing Vite chunk-size warning allowed.

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check`  
Working directory: repo root  
Expected: no whitespace errors. Windows CRLF warnings are acceptable only if there are no error lines.

- [ ] **Step 4: Run temp-file scan**

Run:

```bash
rg --files | rg "\.(tmp|temp|bak|orig|log)$|\.go\.[0-9]+$|~$"
```

Working directory: repo root  
Expected: no output. Exit code 1 is acceptable because `rg` returns 1 when no files match.

- [ ] **Step 5: Confirm branch state**

Run: `git status --short --branch`  
Expected: clean working tree on `main`.

---

## Self-Review

### Spec Coverage

- Integrated `/member` dashboard: Task 2.
- Active/inactive role summaries and activation paths: Tasks 1 and 2.
- OWNER workbench discoverability and labels: Task 3.
- TENANT requirement/profile discoverability and labels: Task 3.
- OWNER/AGENT demand browsing labels and restricted-data messaging: Task 4.
- AGENT private/public profile discoverability and labels: Tasks 3 and 4.
- Header compact navigation: Task 3.
- No backend/database changes: enforced by file map and task scope.
- Verification and temp-file scan: Task 5.

### Placeholder Scan

The plan contains no unresolved markers or undefined future tasks. Matching, recommendations, chat, and case assignment are intentionally excluded from this implementation slice.

### Type Consistency

- `CredentialCenterItem`, `CredentialType`, `Listing`, `TenantProfile`, `TenantRequirement`, and `AgentDetailResponse` are imported from existing API types.
- `advancedDataStatus`, `displayStatus`, `setup_status`, and `status` match existing frontend API fields.
- All new helper functions are consumed by `IdentityCenterPage.tsx` only.
