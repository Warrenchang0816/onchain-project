# CLAUDE.md -- trusted-housing-platform / react-service

## Project Overview

React SPA for the trusted housing platform. Mainline flows today are KYC/onboarding, wallet plus password auth, member/profile views, listing CRUD, and viewing appointments.

## Tech Stack

- React 19 + TypeScript 5 in strict mode
- Vite 8 for build and dev server
- React Router for SPA routing
- Tailwind utility classes already embedded in the UI layer
- Native `fetch` for API access
- Local component state with `useState` and `useEffect`

## Mainline Routes

| Path | Page | Description |
| --- | --- | --- |
| `/` | `HomePage` | Public landing page and recent live listings |
| `/listings` | `ListingListPage` | Public listing index plus authenticated owner dashboard section |
| `/listings/:id` | `ListingDetailPage` | Listing detail, owner actions, and viewing appointments |
| `/listings/new` | `ListingCreatePage` | Verified-user listing creation |
| `/kyc` | `OnboardingPage` | KYC and onboarding flow |
| `/member` | `IdentityCenterPage` | KYC status, live Gate 0 actions, and credential overview |
| `/profile` | `MemberProfilePage` | Account and profile details |

## API Conventions

- API clients live in `src/api/`
- Use native `fetch` with `credentials: "include"`
- Backend responses are parsed in the local API client layer, not in pages
- Listing pages must render honest loading, empty, and error states instead of placeholder inventory

## What To Avoid

- Do not reintroduce Task Tracker terminology into mainline pages
- Do not add a frontend test framework unless the user explicitly asks
- Do not treat `/logs` as a primary user-facing proof surface
- Do not create fake listing cards or mock owner dashboards on live routes
