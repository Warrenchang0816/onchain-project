# CLAUDE.md — onchain-task-tracker / react-service

## Project Overview

React SPA for an on-chain task tracker. Manages tasks with create/update/archive/filter functionality. Designed to integrate with a Go backend and eventually support wallet (blockchain) connections.

## Tech Stack

- **React 19** + **TypeScript 5** (strict mode)
- **Vite 8** (build tool, dev server)
- **React Router v7** (SPA routing)
- **Plain CSS** — all styles live in `src/index.css`; no Tailwind, no CSS-in-JS
- **Fetch API** — no axios or HTTP client libraries
- **No state management library** — local `useState` only

## Project Structure

```
src/
  api/          # Fetch-based API clients (taskApi.ts, dashboardApi.ts)
  components/
    common/     # Reusable UI (AppModal, AppButton, FilterTabs, Header, ...)
    task/       # Task-specific UI (TaskCard, TaskForm)
  layouts/      # AppLayout (wraps pages with Header)
  pages/        # Route-level components (HomePage, TaskListPage)
  router/       # Route definitions (index.tsx)
  types/        # Shared TypeScript types (task.ts)
  index.css     # ALL active styles — single stylesheet
  main.tsx      # Entry point
```

## Routes

| Path     | Page            | Description                        |
|----------|-----------------|------------------------------------|
| `/`      | `HomePage`      | Dashboard: summary cards + recent tasks |
| `/tasks` | `TaskListPage`  | Full task list with CRUD + filters |

## Environment Variables

Defined in `.env`:

```
VITE_API_GO_SERVICE_URL=http://localhost:8081/api
```

Referenced in `src/api/taskApi.ts` via `import.meta.env.VITE_API_GO_SERVICE_URL`.

## API Layer Conventions

- All API calls are in `src/api/`
- Use native `fetch`, async/await, try/catch
- Backend response shape: `{ success: boolean, data: T, message: string }`
- Errors are surfaced as feedback banners in pages (not thrown globally)

## Component Conventions

- Functional components with explicit TypeScript prop interfaces
- Controlled forms: single `useState` object + one `handleChange` handler
- Modal pattern: `isOpen: boolean` + `onClose: () => void` props
- Callbacks passed down from pages: `onEdit`, `onDelete`, `onSubmit`
- No global context currently used

## Styling Conventions

- CSS class names: `kebab-case`
- All styles in `src/index.css` — add new styles here, do not create per-component CSS files
- Responsive breakpoint: `@media (max-width: 1024px)`
- Key color tokens (defined inline in CSS):
  - Header bg: `#111827`
  - Page bg: `#f5f7fb`
  - Accent blue: `#0369a1`
  - Text: `#1f2937`

## Naming Conventions

- **Components/Types:** PascalCase
- **Files:** PascalCase for components, camelCase for utilities/API
- **CSS classes:** kebab-case
- **Type files:** `*.ts` (not `.d.ts`)

## Code Quality

- ESLint (flat config, v9) + Prettier (4-space indent, double quotes, trailing commas)
- `noUnusedLocals` and `noUnusedParameters` enforced by TypeScript
- No test framework configured

## Dev Commands

```bash
npm run dev       # Start dev server
npm run build     # tsc -b && vite build
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## What to Avoid

- Do not add state management libraries (Zustand, Redux) unless explicitly requested
- Do not create per-component CSS files — use `index.css`
- Do not add axios or other HTTP clients — use fetch
- Do not add a testing framework unless asked
- Do not use `contexts/` or `hooks/` directories unless there is a real need — they are currently empty placeholders
