# Project Relational Database Spec

## Scope
This document describes the **current live relational schema** after cleanup.
It is intentionally limited to tables that are wired into the running backend, frontend, or blockchain indexer.

Excel-friendly column details are provided in:
- `docs/database/relational-database-spec.csv`

## Current Delivery Status
- As of 2026-04-18, **Phase 1 KYC initial delivery is complete**.
- The primary live onboarding flow is:
  `email OTP -> phone OTP -> ID upload -> confirm -> second doc -> selfie -> wallet bind -> set password`.
- The primary product rule is:
  once onboarding reaches wallet bind successfully, the platform finalizes natural-person KYC and issues `IdentityNFT` tokenId `1`.
- `kyc_sessions` stores in-progress onboarding state.
- `kyc_submissions` stores the formal audit trail after user creation.
- `users.kyc_status` is the account-level status consumed by the current identity center and profile pages.

## Initialization Order
1. `infra/init/01-init.sql`
2. `infra/init/02-house-platform.sql`
3. `infra/init/03-kyc-submissions.sql`
4. `infra/init/04-onboarding.sql`
5. `infra/init/05-auth-password.sql`

## Current Schema Domains

### Task Domain
- `tasks`: current listing/task workflow backbone used by task APIs.
- `task_submissions`: submission payloads uploaded for a task.
- `task_blockchain_logs`: on-chain action log timeline for a task.

### Auth Domain
- `auth_nonce`: SIWE nonce store.
- `wallet_session`: authenticated cookie-backed wallet session store.

### Identity / KYC Domain
- `users`: platform account root table.
- `kyc_submissions`: formal KYC review record tied to a user.
- `kyc_sessions`: onboarding-in-progress session before wallet bind.
- `otp_codes`: email / SMS OTP records.
- `user_credentials`: OWNER / TENANT / AGENT credential applications.

### Indexer Domain
- `indexer_checkpoints`: last processed block per active contract worker.
- `processed_events`: idempotency store for processed chain events.

## Cleanup Result

### Removed Tables
These tables were removed from the active schema because they were not used by the current backend or frontend flow:
- `properties`
- `property_owners`
- `property_authorizations`
- `agent_profiles`
- `listings`
- `listing_views`
- `tenant_demands`
- `cases`
- `case_events`

### Removed User Columns
These columns were removed from `users` because they had no live write path, no active read path, or duplicated future-planning concerns:
- `role`
- `kyc_provider`
- `kyc_reference_id`
- `occupation`
- `income_range`
- `family_status`
- `household_size`
- `profile_completed`
- `agent_license_no`
- `agent_company`
- `agent_brand`

### Added / Fixed Tables
- `task_blockchain_logs`
  This table was added back into the schema because the task module already writes and reads it, but the SQL init files previously did not create it.

## Design Rules
- `users` is the root identity table.
- `kyc_sessions` is only for in-progress onboarding state.
- `kyc_submissions` is the formal audit trail after user creation.
- `user_credentials` is reserved for secondary role credentials on top of a verified natural person.
- `tasks` remains the current production workflow table until a future listing/case split is truly implemented.
- `indexer_checkpoints` and `processed_events` must stay in sync with active blockchain workers.

## Schema Governance Rules
- DB comes first for any new business feature.
- Contract events must be designed before backend-chain synchronization is implemented.
- Backend state changes that mirror chain state must be replayable from events.
- Schema should reflect the **current live flow**, not speculative future modules that are not wired yet.
- If a future module is only directional planning, keep it in docs, not in active schema.

## Current Technical Notes
- `kyc_submissions.review_status` currently carries both pipeline states and review states. This works today, but it should be split later into `pipeline_status` and `review_status` if the KYC module becomes more complex.
- `users.identity_hash` and `kyc_submissions.identity_hash` are both kept on purpose.
  `users.identity_hash` is the current account identity binding.
  `kyc_submissions.identity_hash` is the submission-time audit record.
- `tasks` is still the current workflow backbone even though the product language is moving toward listings.
  The schema should only be renamed when backend workflow and domain boundaries are ready together.
