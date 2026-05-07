# CLAUDE.md — onchain-task-tracker

## Project Overview

Full-stack task tracker with a Go REST API backend and a React SPA frontend. The project is designed as a boilerplate ("公版") that team members extend by adding their own resource (e.g. books, transactions, workout logs) following the established patterns.

## Repository Structure

```
onchain-task-tracker/
├── go-service/       # Go backend (Gin + PostgreSQL)
├── react-service/    # React frontend (Vite + TypeScript)
├── infra/            # Docker Compose for PostgreSQL
└── docs/             # Developer guides (Chinese)
```

## Services

| Service        | Port  | Description              |
|----------------|-------|--------------------------|
| PostgreSQL      | 5432  | via `infra/docker-compose.yml` |
| go-service     | 8081  | REST API (maps to container :8080) |
| react-service  | 5173  | Vite dev server          |

## Quick Start

```bash
# 1. Start database
cd infra && cp .env.example .env && docker compose up -d && cd ..

# 2. Start backend
cd go-service && docker compose up -d && cd ..

# 3. Start frontend
cd react-service && npm install && npm run dev
```

## Go Backend (go-service)

**Stack:** Go 1.25, Gin, `lib/pq` (PostgreSQL driver). No ORM.

**Layered architecture — strict top-to-bottom dependency:**

```
router → handler → service → repository → PostgreSQL
```

**Internal package layout:**

```
internal/
  config/       # .env loader
  db/           # DB connection (postgres.go)
  model/        # Plain Go structs matching DB columns
  dto/          # Request / Response JSON shapes
  repository/   # Raw SQL (no business logic)
  service/      # Business logic (calls repository)
  handler/      # HTTP layer (parses request, calls service)
  router/       # Route registration + CORS config
cmd/server/main.go  # Wires everything together
```

**Adding a new resource** — create files in this order:
1. `infra/init/<resource>.sql` (or run directly via pgcli)
2. `internal/model/<resource>.go`
3. `internal/dto/<resource>_dto.go`
4. `internal/repository/<resource>_repository.go`
5. `internal/service/<resource>_service.go`
6. `internal/handler/<resource>_handler.go`
7. Edit `internal/router/router.go` — add handler param + routes
8. Edit `cmd/server/main.go` — wire `repo → service → handler`

**Rebuild after changes:**
```bash
cd go-service && docker compose up --build -d
```

**Current API endpoints:**

| Method | Path                    | Description        |
|--------|-------------------------|--------------------|
| GET    | `/api/tasks`            | List all tasks     |
| POST   | `/api/tasks`            | Create task        |
| PUT    | `/api/tasks/:id`        | Update task        |
| PUT    | `/api/tasks/:id/status` | Update status only |

**Response envelope:**
```json
{ "success": true, "data": <T>, "message": "" }
```

## React Frontend (react-service)

See [react-service/CLAUDE.md](react-service/CLAUDE.md) for full detail.

**Stack:** React 19, TypeScript 5 (strict), Vite, React Router v7, plain CSS, native fetch.

**Key constraints:**
- All styles in `src/index.css` — no per-component CSS files
- No state management library (useState only)
- No axios — use fetch
- No test framework configured

**Dev commands:**
```bash
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## Environment Variables

**go-service/.env**
```
APP_PORT=8080
DB_HOST=host.docker.internal
DB_PORT=5432
DB_USER=postgres
DB_PASS=<password>
DB_NAME=TASK
DB_SSLMODE=disable
```

**react-service/.env**
```
VITE_API_BASE_URL=http://localhost:8081/api
```

**infra/.env** (copy from `.env.example`, password must match `DB_PASS` above)

## Git Conventions

- `main` is stable — never commit directly
- Branch naming: `feat/<feature>` or `feat/<name>/<feature>`
- Stage specific files only — never `git add .` (avoid accidental `.env` commits)
- Commit format: `feat: 新增 xxx 功能`

## Superpowers Skills

Superpowers plugin is installed and enabled. Before responding to ANY request — including clarifying questions — check whether a skill applies and invoke it via the `Skill` tool.

**Mandatory skill checks:**

| Situation | Skill to invoke |
|-----------|----------------|
| 設計新功能 / 規劃下一步 | `superpowers:brainstorming` |
| 有 spec，開始寫實作計畫 | `superpowers:writing-plans` |
| 有 plan，開始執行 | `superpowers:executing-plans` |
| 遇到 bug / 測試失敗 | `superpowers:systematic-debugging` |
| 實作任何功能前 | `superpowers:test-driven-development` |
| 宣稱完成 / 準備 commit | `superpowers:verification-before-completion` |
| 完成實作，決定如何整合 | `superpowers:finishing-a-development-branch` |
| 收到 code review 意見 | `superpowers:receiving-code-review` |

**Rules:**
- If there is even a 1% chance a skill applies, invoke it before doing anything else.
- User typing `@Superpowers` in a message means: you MUST invoke the relevant skill before responding.
- Do NOT rationalize skipping. "This is simple" or "I need context first" are not valid reasons to skip.

## What to Avoid

- Do not add ORM libraries to the Go service — keep raw SQL in repositories
- Do not add axios or HTTP client libs to the frontend
- Do not add state management (Zustand, Redux) to the frontend
- Do not create per-component CSS files
- Do not commit `.env` files

# Compact instructions
When the /compact command is used:

**Preserve:**
1. The next task in the active implementation plan (or the explicit next step if no formal plan).
2. Any uncommitted code changes or unresolved terminal errors.
3. Current git state: active branch, worktree path (if any), and commits not yet merged to main.

**Discard:**
- Verbose logs, long command outputs, reasoning paths, and conversational filler.

# Context management

## When to /compact
- Mid-task: there are uncommitted changes, an active plan task, or an unresolved error.
- Context is large but work is ongoing and continuity matters.

## When to /clear
- The current task is fully done (committed, verified, merged).
- Starting an unrelated new topic where accumulated context adds no value.

## Claude's responsibility
At natural breakpoints, proactively suggest /compact or /clear to the user:
- Task just completed → suggest /clear before the next topic.
- Context growing large mid-task → suggest /compact.

**Always ask for user confirmation before executing /compact or /clear — never trigger them automatically.**
