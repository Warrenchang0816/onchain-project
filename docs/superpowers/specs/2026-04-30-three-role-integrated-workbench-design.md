# Three Role Integrated Workbench Design

> Date: 2026-04-30  
> Scope: Frontend-first consolidation for the OWNER / TENANT / AGENT role workbench surfaces.  
> References:
> - `docs/superpowers/specs/2026-04-24-role-workbench-and-tenant-demand-design.md`
> - `docs/superpowers/plans/2026-04-24-role-workbench-and-tenant-demand-implementation.md`
> - `docs/superpowers/plans/2026-04-30-gate2-listing-details-frontend-flow.md`

## 1. Goal

Build a clear first version of the three-role workbench before adding matching, recommendations, messaging, or case-management flows.

The product should feel like one platform with three role surfaces, not three unrelated feature islands. `/member` becomes the integrated dashboard that shows which roles are active, what each role needs next, and where each role's detailed work happens.

## 2. Current Context

The project already has the main backend and frontend primitives for the three roles:

- OWNER has property/listing work, listing drafts, publish gates, and rent/sale detail editing.
- TENANT has tenant profile APIs, requirement APIs, and tenant requirement pages.
- AGENT has profile APIs, public agent list/detail APIs, and private profile editing surfaces.
- Routes already exist for `/member`, `/my/listings`, `/my/requirements`, `/my/tenant-profile`, `/my/agent-profile`, `/requirements`, and `/agents`.

The gap is mostly product coherence:

- `/member` reads role data but needs to become a clearer command center.
- Some touched pages still have corrupted Traditional Chinese copy.
- Role entry points need consistent empty states, next-step guidance, and status summaries.
- The detailed pages need to be framed as workbench pages, not isolated admin forms.

## 3. Product Direction

### 3.1 Integrated `/member` Dashboard

`/member` is the role command center.

It should show:

- Account and KYC status.
- Activated roles.
- Available role activation paths for inactive roles.
- OWNER workbench card if OWNER is active.
- TENANT workbench card if TENANT is active.
- AGENT workbench card if AGENT is active.

Each active role card should include:

- Current status summary.
- One primary next action.
- One or two secondary navigation actions.
- A clear empty state if the role has no data yet.

Inactive role cards should stay visible as activation entry points so users understand the full three-role system.

### 3.2 OWNER Workbench

Primary route: `/my/listings`  
Detail route: `/my/listings/:id`

OWNER workbench should emphasize listing readiness:

- Incomplete drafts.
- Property-ready but listing-intent-missing drafts.
- RENT/SALE detail-missing drafts.
- Publish-ready drafts.
- Active listings.
- Removed or closed listings.

The listing detail page remains the main place for:

- Completing rent/sale listing details.
- Publishing.
- Editing.
- Removing or closing active listings.

Matching hooks are intentionally deferred. The page may reserve future space for demand or agent matches, but it should not fake matching results.

### 3.3 TENANT Workbench

Primary route: `/my/requirements`  
Profile route: `/my/tenant-profile`  
Owner/agent demand routes: `/requirements`, `/requirements/:id`

TENANT workbench should make two things obvious:

- The tenant's active rental requirements.
- Whether the tenant profile is basic or advanced.

`/my/requirements` should act as the tenant's requirement management page:

- Create a requirement.
- Edit requirement details.
- Open, pause, or close a requirement.
- See the count of open, paused, and closed requirements.

`/my/tenant-profile` should act as the tenant trust/profile page:

- Show profile completeness.
- Explain what data improves owner/agent confidence.
- Manage occupation, organization, income range, household size, move-in timeline, notes, and documents supported by existing APIs.

`/requirements` and `/requirements/:id` are OWNER/AGENT-facing surfaces:

- Owners and agents can browse demand.
- Sensitive tenant profile details must only appear according to existing backend response rules.
- The UI must label restricted data clearly instead of implying missing data is an error.

### 3.4 AGENT Workbench

Private profile route: `/my/agent-profile`  
Public list route: `/agents`  
Public detail route: `/agents/:wallet`

AGENT workbench should make profile readiness concrete:

- Public headline.
- Bio.
- Service areas.
- License note.
- Contact preferences for private editing.
- Public profile completeness.

`/my/agent-profile` is the editable workbench page. `/agents/:wallet` is the public profile page. `/agents` is the discovery page with simple filters.

Matching and case assignment are deferred until the role surfaces are stable.

## 4. Information Architecture

### 4.1 Routes

Keep these routes as the first workbench map:

- `/member`: integrated dashboard for account, KYC, and role workbench cards.
- `/my/listings`: OWNER listing workbench.
- `/my/listings/:id`: OWNER listing detail and publish flow.
- `/my/requirements`: TENANT requirement management.
- `/my/tenant-profile`: TENANT profile management.
- `/requirements`: OWNER/AGENT demand browsing.
- `/requirements/:id`: OWNER/AGENT demand detail.
- `/my/agent-profile`: AGENT profile management.
- `/agents`: public agent directory.
- `/agents/:wallet`: public agent detail page.

### 4.2 Header Navigation

The header should stay compact:

- Public listings.
- Demand list only when OWNER or AGENT is active.
- Agent list.
- Member dashboard.

Role-specific management links belong in `/member` and the account menu, not as a crowded top-level nav.

## 5. UI Behavior

### 5.1 Dashboard Cards

The `/member` dashboard should use dense, operational cards:

- Cards have compact headings and metrics.
- Each card has one primary button.
- Secondary actions are small buttons or text links.
- Empty states give a concrete next action.

Avoid decorative hero layouts here. This is a workbench, not marketing.

### 5.2 Status Language

Status labels should be plain Traditional Chinese:

- KYC: 未驗證, 審核中, 已驗證, 已退回.
- Credential: 未申請, 審核中, 可啟用, 已啟用, 已退回.
- Listing readiness: 待補物件資料, 待選出租/出售, 待補出租資料, 待補出售資料, 可發布, 已上架.
- Tenant requirement: 開放中, 暫停, 已關閉.
- Agent profile: 未完成, 已完成.

Touched frontend files should not keep corrupted copy.

### 5.3 Loading and Error States

Every role block on `/member` should degrade independently:

- If OWNER data fails, the OWNER card shows a retry/error note but the TENANT and AGENT cards still render.
- If TENANT data fails, the tenant block shows an error note and keeps navigation available.
- If AGENT profile fetch fails, the card should still offer the private profile route.

This mirrors the current `Promise.all` pattern but should make partial failures visible.

## 6. Data Flow

The workbench should reuse existing frontend APIs:

- `getAuthMe`
- `getKYCStatus`
- `getCredentialCenter`
- `getMyListings`
- `getMyRequirements`
- `getMyTenantProfile`
- `getMyAgentProfile`

No new backend table is required for this workbench consolidation.

New backend endpoints should only be added later if matching needs aggregate data that cannot be derived cleanly from existing APIs.

## 7. Testing and Verification

Because the frontend currently has no test runner, implementation verification for this slice should include:

- `npm run lint`
- `npm run build`
- Manual route smoke checks for:
  - `/member`
  - `/my/listings`
  - `/my/requirements`
  - `/my/tenant-profile`
  - `/my/agent-profile`
  - `/requirements`
  - `/agents`
- Temp-file scan from repo root:
  - `rg --files | rg "\.(tmp|temp|bak|orig|log)$|\.go\.[0-9]+$|~$"`

If a test runner is added later, dashboard summary mapping and form payload mapping should be the first frontend units covered.

## 8. Out of Scope

This slice does not include:

- Matching score calculation.
- Recommendation ranking.
- Chat or messaging.
- Agent case assignment.
- Favorites.
- New database tables.
- Full-site copy cleanup outside touched workbench surfaces.

## 9. Acceptance Criteria

The workbench slice is complete when:

- `/member` clearly presents all three role surfaces.
- Active roles show current summaries and concrete next actions.
- Inactive roles show activation entry points.
- OWNER, TENANT, and AGENT detail routes are discoverable from `/member`.
- Tenant demand browsing remains OWNER/AGENT gated.
- Public agent browsing remains public.
- Touched workbench pages use readable Traditional Chinese.
- Frontend lint and build pass.
- No temp files are left in the repo.
