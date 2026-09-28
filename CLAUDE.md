# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

This is a monorepo with two independent projects — there is no root `package.json` tying them
together, and no shared build/test command:

- **`backend/`** — NestJS + Prisma API (MySQL/MariaDB). Dynamic, database-driven RBAC via CASL.
  See `backend/CLAUDE.md` for architecture, commands, and gotchas.
- **`frontend/`** — Next.js (App Router) client, consumes the backend API. Trilingual
  (English/Kinyarwanda/French) via `next-intl`, shadcn/ui components, Tailwind v4. See
  `frontend/CLAUDE.md` / `frontend/AGENTS.md` for the framework-specific notes Next.js itself
  generates there.

Run each project's commands from inside its own directory (`cd backend` / `cd frontend`) —
neither project's tooling (tsconfig, jest, eslint, next.config) is aware of the other, and
they intentionally don't share `node_modules`.

## Local dev ports

Both dev servers default to port 3000. Start the backend first (`cd backend && npm run
start:dev`) so it claims 3000 — that's the port the Postman collection
(`backend/postman/RoadMaster.postman_collection.json`) and the frontend's API calls assume.
Next.js auto-falls-back to 3001 when 3000 is taken (`cd frontend && npm run dev`); NestJS does
not auto-fallback and will crash with `EADDRINUSE` if started second.
