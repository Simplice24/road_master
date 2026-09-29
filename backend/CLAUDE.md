# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A NestJS API for a provisional driving-license exam platform (candidates pay/use a free
attempt to sit a timed multiple-choice exam drawn from a question bank; wallet top-ups fund
exam fees). Backing store is MySQL/MariaDB via Prisma ORM 7.

This is the `backend/` half of a monorepo — `../frontend` is a Next.js app (with its own
CLAUDE.md/AGENTS.md) that consumes this API. Nothing under `frontend/` is part of this
tsconfig's compilation (`include` is pinned to `src/` and `test/` — see the comment there for
why that matters). Run backend commands from inside `backend/`, not the repo root.

## Commands

```bash
npm run start:dev          # watch mode
npm run build               # nest build
npm run lint                 # eslint --fix over src/apps/libs/test
npm run format               # prettier --write src/** test/**

npm run test                 # unit tests (jest, rootDir=src, *.spec.ts)
npm run test -- users.service   # run a single unit test by filename/pattern
npm run test:watch
npm run test:cov
npm run test:e2e             # e2e tests — WIPE DATA; refuse to run unless the DATABASE_URL db name contains "test"

npx prisma migrate dev       # create/apply a migration from schema.prisma
npx prisma generate          # regenerate the client into generated/prisma
npm run seed                  # seed the default "client" role (by config permission name) + DefaultRole pointer
```

There is no `.env.example`; `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` are read from `.env` via `dotenv/config`.

## Architecture

### RBAC is entirely database-driven (CASL, spatie/laravel-permission-style)

Roles and role→permission grants are rows, not code. **The only two things allowed to branch on
directly are `Role.isSuperAdmin` and the `DefaultRole` singleton pointer — never a role or
permission name.** New roles/grants (`/roles`, `/users/:id/roles`) take effect on a user's very
next request with zero redeploy.

**The set of permissions itself is config-driven:** `src/access/access.config.ts` defines every
permission as a stable name (`<module>.<action>`, e.g. `categories.create`, `examAttempts.viewOwn`)
mapped to one CASL rule. `PermissionSyncService` (`src/access/`) makes the `permissions` table
match it on startup and whenever a role is saved — creating missing rows, adopting pre-config
rows with the same action/subject/conditions by setting their `name`, and never deleting
anything (rows that match no config entry stay enforced for roles that hold them, are logged as
a warning, and can't be newly assigned). There is no API to create/edit/delete permissions: add
an entry to the config instead. `GET /permissions/catalog` serves the config to the frontend;
`POST/PATCH /roles` take `permissions: string[]` (unknown names → 400); `GET /auth/me` returns the
caller's profile, roles, `isSuperAdmin` and effective permission names.

**SuperAdmin guard rails** (the bypass itself lives only in `CaslAbilityFactory`): `isSuperAdmin`
is rejected in role DTOs; the SuperAdmin role can't be deleted, given permissions, or made the
default role; only a SuperAdmin can grant/revoke it; the last active SuperAdmin can't lose it or
be deactivated.

**Deactivated users** (`User.isActive = false`) can't log in, get a 401 from `JwtStrategy` on
every request with an existing token, and get an empty ability from `CaslAbilityFactory`.

**`passwordHash` is omitted globally** (`GLOBAL_OMIT` in `src/prisma/prisma.service.ts`, typed so
user rows don't carry it); only `UsersService#findCredentialsByPhone` opts back in, for login.

- `Permission` rows: `name` (config key, unique; null only for legacy rows) + `action` (`create|read|update|delete|manage`) + `subject` (any
  `Prisma.ModelName`, or `all`) + optional `conditions` (CASL-style JSON, supports
  `${user.path}` placeholders interpolated against the real user record) + optional `fields`
  (JSON array restricting which payload fields the rule permits).
- `Role` → `RolePermission` → `Permission`, and `User` → `UserRole` → `Role`. No direct
  user→permission grants.
- `DefaultRole` is a singleton table (`id` pinned to `1`) pointing at the role every
  self-registered user *after the first* receives. Seeded as `client` by `prisma/seed.ts`.

**Request pipeline** (`src/app.module.ts`, order matters): `JwtAuthGuard` runs first and
attaches `request.user`; `PoliciesGuard` runs second and builds `request.ability` via
`CaslAbilityFactory.createForUser()` (cached on the request for the rest of its lifetime — read
it with `@CurrentAbility()` rather than rebuilding it). `CaslAbilityFactory` loads the user's
roles/permissions in one query; if any role has `isSuperAdmin: true` it short-circuits to
`can('manage', 'all')` with no `Permission` rows needed.

**Enforcement is layered — controllers only check the first layer:**
1. `@RequirePermission(action, subject)` / `@CheckPolicies(...)` (`src/casl/decorators/check-policies.decorator.ts`) on the controller method — checked by `PoliciesGuard`, subject-*type*-level only.
2. `accessibleBy(ability, action).ofType('Model')` (`@casl/prisma`) — services fold this into the Prisma `where` clause so a `findMany`/`findFirst` only returns/matches rows the caller's `conditions` allow (see `exam-attempts.service.ts` `listAttempts`/`getAttempt` for the pattern).
3. `assertCanCreate(ability, subjectType, proposedRow)` (`src/casl/policy-assertions.ts`) — for creates, since there's no row yet to run `conditions` against.
4. `assertFieldsAllowed(ability, action, subjectType, allFields, submittedFields)` — enforces a `Permission.fields` restriction, since neither `PoliciesGuard` nor `accessibleBy` check *which* fields of a payload the caller may set.

New mutating endpoints that accept a client-supplied body should call both 3 and 4 (see
`exam-attempts.service.ts#startAttempt` or `transactions.service.ts#topUp`). Server-authored
writes that aren't driven by client input (e.g. `TransactionsService#chargeExamFee`, called only
from inside `startAttempt`'s own transaction) deliberately skip them.

`UsersService.create()` is the single code path all user creation goes through. Inside one
`Serializable`-isolation transaction: if this is the very first user (`user.count() === 0`), it
gets a fresh `isSuperAdmin` role (found-or-created by that flag, never by name); otherwise it
gets whatever role `DefaultRole` currently points at. `Serializable` matters here because a
plain read would let two concurrent registrations both observe `count() === 0`.

### Prisma specifics

- The generated client lives at `generated/prisma/` (not the default `node_modules/@prisma/client`) — import as `'../../generated/prisma/client'` (relative depth varies by file). `generator client { output = "../generated/prisma" }` in `prisma/schema.prisma`.
- Connects via `@prisma/adapter-mariadb` (driver adapter), not Prisma's built-in MySQL connector — see `src/prisma/prisma.service.ts`.
- Money fields (`walletBalance`, `Transaction.amount`, exam `price`) are `Decimal`; compare/arithmetic with `Prisma.Decimal`, never plain JS numbers.
- Balance and one-shot-flag mutations (wallet debit in `chargeExamFee`, `hasUsedFreeExam` claim in `startAttempt`) use a conditional `updateMany` with the guard in the `WHERE` clause as a compare-and-swap, not `findUnique` + `update` — under MySQL/InnoDB REPEATABLE READ, the `UPDATE ... WHERE` becomes a locking read, so concurrent requests serialize on the row lock instead of racing past a stale snapshot read.

### Exam attempt lifecycle (`src/exam-attempts/exam-attempts.service.ts`)

`startAttempt` → auto-abandons any stale `IN_PROGRESS` attempt whose duration has elapsed,
draws questions (category-scoped shuffle, or `selectBalancedQuestions` which splits the quota
evenly across every category with active questions and redistributes shortfalls round-robin so
small categories don't get starved), snapshots the question set into
`ExamAttemptQuestion`, then charges the exam fee (or consumes the free-attempt CAS) inside the
same transaction as attempt creation. `submitAnswer` enforces the time limit per-call (abandons
and rejects if the deadline has passed) and upserts one `ExamAttemptAnswer`/
`ExamAttemptAnswerOption` set per question. `completeAttempt` scores from persisted answers and
is deliberately *not* subject to the deadline check (a late finisher can still submit). Across
all three, `shapeAttempt()` strips `isCorrect`/`explanation`/`isCorrect` while the attempt is
`IN_PROGRESS` so a candidate can't read the answer key mid-exam, and reveals them once
`COMPLETED`/`ABANDONED`.

### Module layout

Each domain (`auth`, `users`, `roles`, `permissions`, `category`, `question`, `exam-config`,
`exam-attempts`, `transactions`) follows the standard Nest `*.module.ts` / `*.controller.ts` /
`*.service.ts` / `dto/*.ts` split, wired into `AppModule`. `casl/`, `access/` and `prisma/` are
cross-cutting infrastructure modules imported everywhere else needs them, not domain modules
themselves.

All intra-`src/` imports are relative (`../prisma/prisma.service`, etc.) — a handful of files
used to import via a bare `src/...` path (which only worked because `tsc`/`ts-node` resolve
`tsconfig.json`'s `baseUrl` for non-relative specifiers); that was normalized to relative
imports everywhere because Jest's resolver doesn't do the same baseUrl resolution, which broke
`npm run test:e2e` outright. Keep new imports relative.
