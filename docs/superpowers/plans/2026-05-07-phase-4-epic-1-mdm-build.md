# Phase 4 Epic 1 — Master Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Each Arc is its own fresh session** — do NOT execute Arc (b) or Arc (c) in the same chat that executes Arc (a). Context boundaries between arcs are intentional per `claude.md` "Context management."

**Goal:** Build the foundation of the F&B ERP — organisational hierarchy, product master, vendor master, material enablement matrix, categories, UOM registry, company registration — at production grade, so every subsequent epic (2 through 12) has a stable master-data backbone to reference.

**Architecture:** Three sequential arcs per the canonical Phase 4 per-epic invariant — (a) Drizzle schema + service layer + REST API + integration tests on `apps/api`; (b) just-in-time mockups for the four Tier 2 MDM screens + CC-DUPLICATE-WARN shell + SI-MDM-003 fix-back; (c) production-grade React+Tailwind code in `apps/web` consuming the foundation chrome (copy-ported from `mockups/src/shell/`) + new mockups + real services. Chrome-freeze review gate at Epic 1 close before Epic 2 begins.

**Tech Stack:** Drizzle ORM on Supabase Postgres (Mumbai region), Express.js + Node 20, TypeScript strict, React 18 + Tailwind v4 + shadcn/ui, TanStack Query / Table / Form + Zod, Vitest for unit tests + supertest for API integration tests, Vite (mockups) and Vite (apps/web). pg-boss + pg_cron for background work where needed. Resend for email (not exercised in Epic 1). All decisions inherit from DL-001 → DL-026.

---

## 1. Inputs (locked — do not reopen)

| Source | What is locked |
|---|---|
| `claude.md` | Critical rules; design-token enforcement; per-epic 3-arc invariant; chrome-freeze gate; Tier 1 Acceptance Tag for deferred heroes (none in Epic 1). |
| `_planning/02-master-spec.md` §2, §4, §7, §8 | Org hierarchy + vendor scope + product types; module tier (Epic 1 = Tier 1 — Deep); critical implementation rules; module interface contracts. |
| `_planning/03-prd.md` FR1–FR9 | Functional requirements for Epic 1 in their entirety. |
| `_planning/05-screen-inventory.md` Epic 1 — MDM section | The seven SI-MDM-### entries verbatim (Purpose / Data displayed / User actions / Cross-cutting / Source FRs / Source journey / Related screens / Notes). |
| `_planning/architecture.md` §3 (deployment), §4 (multi-tenancy), §5 (schema conventions), §6 (service layer), §7 (audit trail), §17 (API), §20 (CI lint), §22 (FR roll-up) | Technical baselines binding all backend decisions. |
| `decision-log.md` DL-001 → DL-026 | All micro-decisions including DL-022 (parent-lock), DL-023 (UOM two-layer), DL-024 (SI-MDM-007 edit-only + brand seed), DL-025 (Epic 1 mockup tier-tagging), DL-026 (CC-DUPLICATE-WARN shell + SI-MDM-003 fix-back). |
| `mockups/` | 21 foundation shell components + 15 mockup screens (incl. SI-MDM-003 + SI-MDM-004 already shipped). Source of visual truth; copy-ported into `apps/web/src/components/shell/` at Arc (c) start. |
| `DESIGN.md` | Token source of truth; nothing in this plan invents a token. |

---

## 2. Output

Three separate session deliverables, each merged independently behind a single Epic 1 PR or stacked PRs (decided at branch-cut time per session):

| Arc | Branch | Deliverable | Closes when |
|---|---|---|---|
| (a) Backend | `phase-4/epic-1-mdm-arc-a-backend` | `apps/api/src/db/schema/{org,inventory,procurement}.ts`; `apps/api/src/services/{org,product,vendor}.service.ts` + `inventoryService.checkEnablement` partial; REST routes per architecture §17.2 row "Epic 1"; integration tests covering FR1–FR9 + DL-022 parent-lock + DL-023 UOM + §2.7 vendor-scope; brand bootstrap seed script. | All integration tests green; CI lint (RLS + brand_id index + DESIGN tokens) green; Supabase Mumbai project provisioned + migrations applied; brand_seed run produces a single `brands` row. |
| (b) JIT mockups | `phase-4/epic-1-mdm-arc-b-mockups` | New routes `/SI-MDM-001`, `/SI-MDM-002`, `/SI-MDM-005`, `/SI-MDM-007` (Tier 2); `/SI-MDM-006` (Index-only stub); new `mockups/src/shell/CCDuplicateWarn.tsx`; SI-MDM-003 fix-back consuming the new shell. | All 5 routes render with 0 console errors; pre-commit hook passes; Vercel preview shows the 4 Tier 2 screens + 1 index stub + the CC-DUPLICATE-WARN affordance on SI-MDM-003 + SI-MDM-005; spec-compliance reviewer pass on the 4 Tier 2 screens (lighter critique per DL-025). |
| (c) Production frontend | `phase-4/epic-1-mdm-arc-c-frontend` | `apps/web` production-grade screens for all 7 SI-MDM-### entries consuming real APIs from Arc (a) + new mockups from Arc (b); copy-ported foundation shell components in `apps/web/src/components/shell/`; auth gating per FR1/FR9; loading + error boundaries; a11y hardening. | All 7 screens reachable behind auth; e2e Playwright happy path per screen passes; chrome-freeze gate review (cross-screen consistency vs. mockups + foundation chrome) passes; Master Spec §10 next-epic gate cleared. |

**Single Epic 1 PR** at Arc (c) close (mirrors Phase 2c-scoped's single consolidated PR at S4 close). The 3 arc branches stack onto each other; the Arc (c) branch is what merges to `main`.

---

## 3. File structure (locked at plan time)

The arcs touch these files only. Anything else surfacing during execution is a flag-for-confirmation event.

### 3.1 Backend (`apps/api/`)

```
apps/api/
├── package.json                                  (Arc a — bootstrap if not present)
├── tsconfig.json                                 (Arc a — strict mode, no any)
├── drizzle.config.ts                             (Arc a — points at apps/api/src/db)
├── src/
│   ├── index.ts                                  (Arc a — Express bootstrap)
│   ├── env.ts                                    (Arc a — Zod-validated env vars)
│   ├── db/
│   │   ├── client.ts                             (Arc a — Drizzle + Supabase client)
│   │   ├── branded-db.ts                         (Arc a — DL-012 brandedDb factory)
│   │   ├── brand-scoped-table.ts                 (Arc a — DL-015 helper)
│   │   ├── audit-log-trigger.sql                 (Arc a — DL-013 trigger DDL)
│   │   ├── rls-template.ts                       (Arc a — DL-014 emitter for migrations)
│   │   ├── schema/
│   │   │   ├── auth.ts                           (Arc a — minimal users stub for FK; full Epic 2)
│   │   │   ├── org.ts                            (Arc a — brands, clusters, locations, departments, stores)
│   │   │   ├── inventory.ts                      (Arc a — uoms, product_uoms, products, categories,
│   │   │   │                                      product_categories, enablement_matrix only — NOT
│   │   │   │                                      stock_levels / batches yet, those are Epic 4)
│   │   │   ├── procurement.ts                    (Arc a — vendors only — full vendor master; POs Epic 5)
│   │   │   └── index.ts                          (Arc a — re-exports for brandedDb wrapper)
│   │   ├── migrations/                           (Arc a — Drizzle Kit generated SQL)
│   │   └── seed/
│   │       └── brand-seed.ts                     (Arc a — DL-024 single-brand bootstrap)
│   ├── services/
│   │   ├── org.service.ts                        (Arc a — cluster/location/department CRUD + parent-lock)
│   │   ├── product.service.ts                    (Arc a — product CRUD + UOM resolution + findSimilarByName)
│   │   ├── vendor.service.ts                     (Arc a — vendor CRUD + scope mutation per §2.7)
│   │   ├── category.service.ts                   (Arc a — category CRUD + product M:N mapping)
│   │   ├── inventory.service.ts                  (Arc a — checkEnablement only; deductStock + transferStock Epic 4)
│   │   ├── company.service.ts                    (Arc a — brand row edit only per DL-024)
│   │   └── audit-log.service.ts                  (Arc a — DL-013 application-layer audit)
│   ├── routes/
│   │   ├── index.ts                              (Arc a — Express router mount)
│   │   ├── clusters.ts
│   │   ├── locations.ts
│   │   ├── departments.ts
│   │   ├── products.ts
│   │   ├── product-uoms.ts
│   │   ├── uoms.ts
│   │   ├── vendors.ts
│   │   ├── categories.ts
│   │   ├── enablements.ts
│   │   └── company.ts
│   ├── middleware/
│   │   ├── auth.ts                               (Arc a — JWT extract; full Epic 2)
│   │   ├── branded-db.ts                         (Arc a — attach req.db; DL-012)
│   │   ├── audit-context.ts                      (Arc a — SET LOCAL app.user_id per DL-013/§7.4)
│   │   └── error-handler.ts                      (Arc a — typed error → §17.5 envelope)
│   └── errors/
│       ├── index.ts
│       ├── validation-error.ts
│       ├── business-rule-error.ts                (incl. ScopeMutationError for §2.7)
│       └── not-found-error.ts
└── tests/
    ├── integration/
    │   ├── setup.ts                              (Arc a — test brandedDb + transactional rollback)
    │   ├── org.test.ts                           (Arc a — FR1, FR2, DL-022)
    │   ├── product.test.ts                       (Arc a — FR3, FR4 via DL-023)
    │   ├── vendor.test.ts                        (Arc a — FR6, §2.7)
    │   ├── category.test.ts                      (Arc a — FR7)
    │   ├── enablement.test.ts                    (Arc a — FR5, FR8)
    │   ├── company.test.ts                       (Arc a — FR9, DL-024)
    │   └── audit-log.test.ts                     (Arc a — DL-013 wiring smoke)
    └── unit/
        ├── branded-db.test.ts                    (Arc a — DL-012)
        ├── brand-scoped-table.test.ts            (Arc a — DL-015)
        └── error-mapping.test.ts                 (Arc a — §17.5 envelope shape)
```

### 3.2 Mockups (`mockups/`)

```
mockups/src/
├── shell/
│   ├── CCDuplicateWarn.tsx                       (Arc b — NEW shell per DL-026)
│   └── index.ts                                  (Arc b — add export)
├── screens/
│   ├── SI-MDM-001.tsx                            (Arc b — Tier 2 — org tree + dialogs)
│   ├── SI-MDM-002.tsx                            (Arc b — Tier 2 — department register list)
│   ├── SI-MDM-003.tsx                            (Arc b — fix-back: consume CCDuplicateWarn)
│   ├── SI-MDM-005.tsx                            (Arc b — Tier 2 — vendor master)
│   ├── SI-MDM-006.tsx                            (Arc b — Index-only stub)
│   └── SI-MDM-007.tsx                            (Arc b — Tier 2 — company reg + fiscal year)
└── App.tsx                                       (Arc b — register new routes)
```

### 3.3 Production frontend (`apps/web/`)

```
apps/web/
├── package.json                                  (Arc c — bootstrap if not present)
├── src/
│   ├── main.tsx                                  (Arc c — TanStack QueryClientProvider + Router)
│   ├── App.tsx
│   ├── components/
│   │   ├── shell/                                (Arc c — copy-port from mockups/src/shell at arc start)
│   │   │   └── (all 22 CC-* shells incl. CCDuplicateWarn)
│   │   └── primitives/                           (Arc c — copy-port shadcn primitives + Tailwind config)
│   ├── lib/
│   │   ├── api-client.ts                         (Arc c — fetch wrapper + Zod parsing + error envelope)
│   │   ├── auth.ts                               (Arc c — Supabase Auth + JWT)
│   │   └── query-keys.ts                         (Arc c — TanStack Query key factory)
│   ├── pages/mdm/
│   │   ├── HierarchyPage.tsx                     (Arc c — SI-MDM-001)
│   │   ├── DepartmentsPage.tsx                   (Arc c — SI-MDM-002)
│   │   ├── ProductsPage.tsx + ProductsForm.tsx   (Arc c — SI-MDM-003)
│   │   ├── EnablementMatrixPage.tsx              (Arc c — SI-MDM-004)
│   │   ├── VendorsPage.tsx + VendorsForm.tsx     (Arc c — SI-MDM-005)
│   │   ├── CategoriesPage.tsx                    (Arc c — SI-MDM-006)
│   │   └── CompanyPage.tsx                       (Arc c — SI-MDM-007)
│   └── hooks/mdm/
│       ├── useClusters.ts / useLocations.ts / useDepartments.ts
│       ├── useProducts.ts / useUoms.ts
│       ├── useVendors.ts
│       ├── useCategories.ts
│       ├── useEnablements.ts
│       └── useCompany.ts
└── tests/e2e/
    └── mdm.spec.ts                               (Arc c — Playwright happy paths per screen)
```

### 3.4 Cross-cutting docs to update at end of Arc (c)

| File | Update |
|---|---|
| `claude.md` | `## Current phase` → "Phase 4 Epic 1 MDM ✅ DONE; Epic 2 USR is the next entry point." |
| `_planning/06-phase-roadmap.md` | Phase 4 row: tick Epic 1; record CC-DUPLICATE-WARN built + chrome-freeze gate passed; record any drift fix-backs. |
| `codebase-inventory.md` | Create the file (claude.md flags it as "created after Epic 1"); inventory the new schema files + service modules + API surface + frontend pages. |
| `decision-log.md` | Append DL-027+ entries IF new micro-decisions surface during execution; DO NOT alter DL-022 → DL-026 retroactively. |

---

## 4. Arc (a) — Backend

**Session goal:** Drizzle schema + service layer + Express API + integration tests for all of Epic 1, with `inventoryService.checkEnablement` shipped as the cross-epic boundary every downstream epic consumes. **No frontend touched.** Single fresh chat, single branch `phase-4/epic-1-mdm-arc-a-backend`.

**Pre-flight (do once, before Task A1):**

- [ ] **Pre-A1: Verify Supabase Mumbai project provisioned.** Per architecture §3.5 + DL-007. If not yet provisioned, surface for user — do not provision unilaterally (project creation is irreversible spend).
- [ ] **Pre-A2: Verify monorepo bootstrapped per DL-006.** `pnpm-workspace.yaml`, `turbo.json`, `apps/api/`, `apps/web/`, `packages/shared/` skeletons exist. If not, the first task in Arc (a) is monorepo bootstrap (subagent loop with the Phase 3a §3 spec).

### Task A0: Monorepo + apps/api scaffold (skip if already done at Phase 3a or Phase 2c-prep)

**Files:**
- Create: `pnpm-workspace.yaml`, `turbo.json`, `package.json` (root), `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/drizzle.config.ts`, `packages/shared/package.json`

- [ ] **Step 1: Verify which scaffold pieces exist.** Run `ls -la apps/api packages/shared` from repo root. If both exist with `package.json`, skip to Task A1.

- [ ] **Step 2: If missing, create the workspaces.** Mirror architecture §3.1 exactly. Root `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Root `turbo.json` per architecture §3.2 (10–30 lines: `build`, `lint`, `typecheck`, `test`, `dev` task definitions with appropriate `dependsOn` graph).

- [ ] **Step 3: Bootstrap `apps/api/package.json`.**

```json
{
  "name": "@fnberp/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p .",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests --ext .ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed/brand-seed.ts"
  },
  "dependencies": {
    "express": "^4.21.0",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.5",
    "@supabase/supabase-js": "^2.45.0",
    "zod": "^3.23.0",
    "@anthropic-ai/sdk": "^0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "supertest": "^7.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

- [ ] **Step 4: `apps/api/tsconfig.json` strict mode, target ES2022, module NodeNext.** Zero `any` per Master Spec §7.1.

- [ ] **Step 5: Run `pnpm install` from repo root.** Expected: clean install, no peer warnings.

- [ ] **Step 6: Commit.**

```bash
git add pnpm-workspace.yaml turbo.json package.json apps/api packages/shared
git commit -m "Phase 4 Epic 1 Arc a — scaffold apps/api + monorepo skeleton"
```

### Task A1: Database client + brandedDb factory + brandScopedTable helper (DL-012 + DL-015)

**Files:**
- Create: `apps/api/src/db/client.ts`, `apps/api/src/db/branded-db.ts`, `apps/api/src/db/brand-scoped-table.ts`, `apps/api/src/db/rls-template.ts`
- Test: `apps/api/tests/unit/branded-db.test.ts`, `apps/api/tests/unit/brand-scoped-table.test.ts`

- [ ] **Step 1: Write `db/client.ts`.** Single Postgres client + Drizzle client; reads `DATABASE_URL` from `env.ts`. Two exports: `db` (raw — for migrations and pg-boss bootstrap only) and `pgClient` (raw `postgres` for `SELECT FOR UPDATE` paths).

- [ ] **Step 2: Write the failing test for `brandScopedTable`.** Test: a table declared via the helper has `brand_id uuid not null` column, an index on `brand_id`, and is registered in the brand-scoped table set. Assertion shape:

```typescript
import { brandScopedTable } from '../../src/db/brand-scoped-table';
import { uuid, text } from 'drizzle-orm/pg-core';

describe('brandScopedTable', () => {
  it('emits brand_id column, brand_id index, and registers the table', () => {
    const t = brandScopedTable('test_things', {
      name: text('name').notNull(),
    });
    expect(t.columns.brandId).toBeDefined();
    expect(t.columns.brandId.notNull).toBe(true);
    expect(t.indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ columns: ['brand_id'] }),
    ]));
    expect(brandScopedTableRegistry.has('test_things')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test — expect FAIL** (`brandScopedTable` not defined).

- [ ] **Step 4: Implement `brand-scoped-table.ts`.** Per architecture §4.4. Key responsibilities: (1) add `brand_id uuid not null references brands(id) on delete restrict`; (2) emit `idx_<table>_brand_id` B-tree index; (3) emit canonical 2-policy RLS in the migration's SQL output; (4) register table name in a module-level `Set` consumed by `brandedDb` at startup; (5) accept `{ auditTrigger?: boolean, indexes?: Record<string, string[]> }` options for the four DL-013 critical tables and composite indexes. ~150–200 LOC.

- [ ] **Step 5: Run the test — expect PASS.**

- [ ] **Step 6: Write the failing test for `brandedDb`.** Test fixture: a fake brand-scoped table with one row per brand; `brandedDb(brandIdA).select().from(table)` returns only Brand A's rows; INSERT auto-injects `brand_id = brandIdA`; UPDATE/DELETE auto-AND filter by brand. ~5 test cases.

- [ ] **Step 7: Run the test — expect FAIL.**

- [ ] **Step 8: Implement `branded-db.ts`.** Per architecture §4.2. Wraps Drizzle's query builder; uses the registry from Step 4 to know which tables to scope. INSERT path injects `brand_id` into the values map; SELECT/UPDATE/DELETE path adds `eq(table.brandId, this.brandId)` to the WHERE clause. Plain non-scoped tables (those NOT in the registry) pass through unchanged. ~150–200 LOC.

- [ ] **Step 9: Run the tests — expect PASS.**

- [ ] **Step 10: Write `rls-template.ts`** — emits the canonical 2-policy SQL block (DL-014) given a table name; called by Drizzle migration generator hooks. Plus the system-table single-policy template.

- [ ] **Step 11: Commit.**

```bash
git add apps/api/src/db apps/api/tests/unit/branded-db.test.ts apps/api/tests/unit/brand-scoped-table.test.ts
git commit -m "Phase 4 Epic 1 Arc a — brandedDb factory + brandScopedTable helper (DL-012 + DL-015)"
```

### Task A2: Express bootstrap + middleware chain (DL-012 + DL-013 + §17 chain)

**Files:**
- Create: `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/branded-db.ts`, `apps/api/src/middleware/audit-context.ts`, `apps/api/src/middleware/error-handler.ts`, `apps/api/src/errors/*`

- [ ] **Step 1: `env.ts` with Zod-validated env vars.** Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `PORT`. Throws on missing.

- [ ] **Step 2: `errors/*` files.** Each error subclass per architecture §6.5: `ValidationError` (`code: 'validation.<reason>'`), `BusinessRuleError` (with subclasses `ScopeMutationError`, `EnablementViolationError` placeholder, `ParentRelinkAttemptError`), `NotFoundError`. All carry `code`, `message`, `details?`, `httpStatus`.

- [ ] **Step 3: `middleware/auth.ts` minimal stub.** For Epic 1: read JWT from `Authorization: Bearer <token>` header, verify with `SUPABASE_JWT_SECRET`, attach `req.user = { id, brandId, role }`. Full RBAC matrix (FR12) is Epic 2 — Epic 1 only needs `brandId` extracted to wire `brandedDb`. Stub the role check with a permissive predicate; Epic 2 replaces.

- [ ] **Step 4: `middleware/branded-db.ts`.** Constructs `brandedDb(req.user.brandId)` and attaches as `req.db`. Memoizes `inventoryService.checkEnablement` results on `req.db` per architecture §6.2.1 refinement.

- [ ] **Step 5: `middleware/audit-context.ts`.** Inside the per-request transaction wrapper, executes `SET LOCAL app.user_id = $1` so DL-013 audit triggers can read `current_setting('app.user_id', true)`. Per architecture §17.11 + §7.4.

- [ ] **Step 6: `middleware/error-handler.ts`.** Catches typed errors, maps to `{ code, message, details?, timestamp }` envelope per Master Spec §7.5 + architecture §17.5. Unmapped errors → `system.unexpected_error` with 500.

- [ ] **Step 7: Write `index.ts`** — `app.use` chain in the order: Sentry request handler (placeholder; full hook Epic 2) → JSON body parser → auth → branded-db → audit-context → routes → error-handler. Per architecture §17.11.

- [ ] **Step 8: Smoke-test boot.** `pnpm --filter @fnberp/api dev` → expect `Listening on port 3000` log + `GET /health` returns `{ ok: true }`.

- [ ] **Step 9: Commit.**

```bash
git add apps/api/src
git commit -m "Phase 4 Epic 1 Arc a — Express bootstrap + middleware chain (auth + brandedDb + audit-context + error-handler)"
```

### Task A3: Schema — auth.ts (minimal) + org.ts

**Files:**
- Create: `apps/api/src/db/schema/auth.ts` (minimal users stub for FK targets), `apps/api/src/db/schema/org.ts`, `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: `auth.ts` minimal users stub.** Just enough for FK references — `users` (`id uuid pk`, `email`, `brand_id` FK, `role text` enum stub). Full Epic 2 expands. Use plain `pgTable` (NOT brandScopedTable) for `users` per architecture §5.1 — but actually `users` IS one of DL-013's critical tables AND must carry `brand_id`. So **use `brandScopedTable('users', { ..., auditTrigger: true })`**.

- [ ] **Step 2: `org.ts` schema.** Per architecture §5.1 + Master Spec §2.1 + DL-022 parent-lock:

```typescript
import { brandScopedTable } from '../brand-scoped-table';
import { uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const locationTypeEnum = pgEnum('location_type_enum', [
  'central_kitchen',
  'pos_outlet',
  'brand_store',
  'cluster_store',
]);

export const departmentTypeEnum = pgEnum('department_type_enum', [
  'production',
  'dispatch',
  'non_production',
  'store',
]);

// `brands` is the tenant root — NOT brandScopedTable (it IS the brand reference).
import { pgTable } from 'drizzle-orm/pg-core';
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  tradingName: text('trading_name'),
  // FR9 fields
  registeredAddress: text('registered_address'),
  city: text('city'),
  postalCode: text('postal_code'),
  state: text('state'),
  country: text('country').default('IN'),
  gstin: text('gstin'),  // [PLACEHOLDER] per §6.5
  pan: text('pan'),      // [PLACEHOLDER] per §6.5
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  bankAccountNumber: text('bank_account_number'),
  bankIfsc: text('bank_ifsc'),
  bankAccountHolder: text('bank_account_holder'),
  fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(4), // April
  fiscalYearStartDay: smallint('fiscal_year_start_day').notNull().default(1),
  accountingCurrency: text('accounting_currency').notNull().default('INR'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  logoUrl: text('logo_url'),
  status: text('status').notNull().default('setup_pending'),  // 'setup_pending' | 'setup_complete'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clusters = brandScopedTable('clusters', {
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
});

export const locations = brandScopedTable('locations', {
  clusterId: uuid('cluster_id').notNull().references(() => clusters.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  type: locationTypeEnum('type').notNull(),
  address: text('address'),
  active: boolean('active').notNull().default(true),
}, {
  indexes: { brandCluster: ['brand_id', 'cluster_id'] },
});

export const departments = brandScopedTable('departments', {
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code'),  // user-assigned or system-generated
  type: departmentTypeEnum('type').notNull(),
  active: boolean('active').notNull().default(true),
}, {
  indexes: { brandLocation: ['brand_id', 'location_id'] },
});

// Stores (raw material storage) per Master Spec §2.3 — Brand and Cluster level only.
export const stores = brandScopedTable('stores', {
  level: text('level').notNull(),  // 'brand' | 'cluster'
  clusterId: uuid('cluster_id').references(() => clusters.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
});
```

DL-022 parent-lock note in schema comment: "ON DELETE RESTRICT — re-parenting requires deactivate + recreate per DL-022; never modify cluster_id / location_id post-insert."

- [ ] **Step 3: `schema/index.ts` re-exports.** Per architecture §5.1 — `brandedDb` walks this at startup.

- [ ] **Step 4: Generate migration.** `pnpm --filter @fnberp/api db:generate`. Expected: one new SQL file under `apps/api/src/db/migrations/0001_initial_org_schema.sql`. Inspect: brand_id columns, indexes, RLS blocks, FK constraints all emitted.

- [ ] **Step 5: Apply migration locally.** `pnpm --filter @fnberp/api db:migrate`. Expected: clean apply against a fresh local Postgres (or Supabase Mumbai dev branch).

- [ ] **Step 6: Commit.**

```bash
git add apps/api/src/db/schema/auth.ts apps/api/src/db/schema/org.ts apps/api/src/db/schema/index.ts apps/api/src/db/migrations
git commit -m "Phase 4 Epic 1 Arc a — schema/org.ts (brands, clusters, locations, departments, stores) + minimal users stub"
```

### Task A4: Brand seed script (DL-024)

**Files:**
- Create: `apps/api/src/db/seed/brand-seed.ts`

- [ ] **Step 1: Write the seed script.** Idempotent: checks if any `brands` row exists; if zero, inserts one with placeholder values + `status = 'setup_pending'`. If ≥1, exits with informational log. Reads brand defaults from `process.env.BRAND_LEGAL_NAME` etc. or hardcoded "Demo F&B Pvt Ltd" per Master Spec §12.

- [ ] **Step 2: Add `db:seed` script to package.json (already done in Task A0).**

- [ ] **Step 3: Run against local DB.** Expect single brand row created.

- [ ] **Step 4: Run again.** Expect "Brand already seeded — skipping" log; no second row.

- [ ] **Step 5: Add a README note in `apps/api/src/db/seed/README.md`.** Single paragraph: "Idempotent bootstrap script per DL-024. Required first run after migrations on any fresh deployment. Multi-brand creation UX is post-MVP per Master Spec §1.2."

- [ ] **Step 6: Commit.**

```bash
git add apps/api/src/db/seed
git commit -m "Phase 4 Epic 1 Arc a — brand seed script (DL-024 single-brand bootstrap)"
```

### Task A5: orgService + cluster/location/department CRUD with DL-022 parent-lock

**Files:**
- Create: `apps/api/src/services/org.service.ts`, `apps/api/src/services/audit-log.service.ts`
- Test: `apps/api/tests/integration/org.test.ts`, `apps/api/tests/integration/setup.ts`

- [ ] **Step 1: Write `tests/integration/setup.ts`.** Sets up a transactional rollback wrapper per integration test, seeds a test brand, returns a `brandedDb` bound to that brand. Per architecture §6.1 conventions.

- [ ] **Step 2: Write the failing test file `org.test.ts`.** Test cases:

```typescript
describe('orgService', () => {
  it('FR1: creates a cluster under the brand', async () => { /* ... */ });
  it('FR1: lists clusters scoped to caller brand', async () => { /* ... */ });
  it('FR1: deactivates a cluster (soft-delete, active=false)', async () => { /* ... */ });
  it('DL-022: rejects re-parenting a Location to a different Cluster (ParentRelinkAttemptError)', async () => {
    const c1 = await orgService.createCluster(db, { name: 'A' });
    const c2 = await orgService.createCluster(db, { name: 'B' });
    const loc = await orgService.createLocation(db, { clusterId: c1.id, name: 'POS-AA', type: 'pos_outlet' });
    await expect(
      orgService.updateLocation(db, loc.id, { clusterId: c2.id })
    ).rejects.toBeInstanceOf(ParentRelinkAttemptError);
  });
  it('DL-022: rejects re-parenting a Department to a different Location', async () => { /* ... */ });
  it('FR2: classifies departments (Production / Dispatch / Non-Production / Store)', async () => { /* ... */ });
  it('soft-deactivate cluster sets active=false and is reversible', async () => { /* ... */ });
  it('soft-deactivate cluster does NOT cascade to locations (DL-022 — no cascade in MVP)', async () => { /* ... */ });
  it('audit: every create and update writes an audit_log row with reason captured (DL-013)', async () => { /* ... */ });
});
```

- [ ] **Step 3: Run tests — expect FAIL (orgService not defined).**

- [ ] **Step 4: Implement `audit-log.service.ts`.** Per architecture §7. Single export `auditLog.record(db, { action, table, rowId, before, after, reason?, trnRef?, context? })`. Writes `audit_log` row inside the same transaction. Throws if `db` is the unscoped client (system writes use a different code path).

- [ ] **Step 5: Implement `org.service.ts`.** Methods:

```typescript
export const orgService = {
  // Clusters
  createCluster(db: BrandedDb, input: NewCluster): Promise<Cluster>,
  listClusters(db: BrandedDb): Promise<Cluster[]>,
  getCluster(db: BrandedDb, id: string): Promise<Cluster>,
  updateCluster(db: BrandedDb, id: string, input: ClusterUpdate, opts: { reason: string }): Promise<Cluster>,
  deactivateCluster(db: BrandedDb, id: string, opts: { reason: string }): Promise<Cluster>,

  // Locations — DL-022: clusterId is IMMUTABLE post-creation
  createLocation(db: BrandedDb, input: NewLocation): Promise<Location>,
  listLocations(db: BrandedDb, filter?: { clusterId?: string }): Promise<Location[]>,
  getLocation(db: BrandedDb, id: string): Promise<Location>,
  updateLocation(db: BrandedDb, id: string, input: LocationUpdate, opts: { reason: string }): Promise<Location>,
  deactivateLocation(db: BrandedDb, id: string, opts: { reason: string }): Promise<Location>,

  // Departments — DL-022: locationId is IMMUTABLE post-creation
  createDepartment(db: BrandedDb, input: NewDepartment): Promise<Department>,
  listDepartments(db: BrandedDb, filter?: { locationId?: string; type?: DepartmentType }): Promise<Department[]>,
  getDepartment(db: BrandedDb, id: string): Promise<Department>,
  updateDepartment(db: BrandedDb, id: string, input: DepartmentUpdate, opts: { reason: string }): Promise<Department>,
  deactivateDepartment(db: BrandedDb, id: string, opts: { reason: string }): Promise<Department>,
};

// LocationUpdate / DepartmentUpdate types EXCLUDE clusterId / locationId per DL-022.
type LocationUpdate = Omit<NewLocation, 'clusterId'>;
type DepartmentUpdate = Omit<NewDepartment, 'locationId'>;

// Runtime guard (defence-in-depth): even if a caller bypasses TypeScript, throw.
function assertNoParentRelink(input: object, lockedKeys: string[]) {
  for (const k of lockedKeys) if (k in input) throw new ParentRelinkAttemptError(k);
}
```

Each method opens a transaction, calls `auditLog.record(db, ...)` inside, commits. Update methods take a mandatory `reason` string for audit (cluster name change, address update etc.).

- [ ] **Step 6: Run tests — expect all PASS.**

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/services/org.service.ts apps/api/src/services/audit-log.service.ts apps/api/tests/integration
git commit -m "Phase 4 Epic 1 Arc a — orgService with DL-022 parent-lock + DL-013 audit-log application-layer wiring"
```

### Task A6: Schema — inventory.ts (uoms, products, categories, enablement_matrix only)

**Files:**
- Create: `apps/api/src/db/schema/inventory.ts`

- [ ] **Step 1: Write the schema.** Per DL-023 two-layer UOM + Master Spec §2.4 enablement + FR3/FR4/FR5/FR7. Note: `stock_levels`, `batches`, `expiry tracking` are deferred to Epic 4 — Epic 1 only needs the master-data tables.

```typescript
export const productTypeEnum = pgEnum('product_type_enum', ['raw', 'semi_product', 'final']);
export const uomBaseEnum = pgEnum('uom_base_enum', ['mass', 'volume', 'count']);

// DL-023 layer 1: global registry.
export const uoms = brandScopedTable('uoms', {
  code: text('code').notNull(),                                  // 'kg', 'g', 'l', 'ml', 'piece', 'dozen'
  displayName: text('display_name').notNull(),
  base: uomBaseEnum('base').notNull(),
  conversionToBaseFactor: numeric('conversion_to_base_factor', { precision: 18, scale: 9 }).notNull(),
  active: boolean('active').notNull().default(true),
});
// Unique per (brand_id, code).

export const products = brandScopedTable('products', {
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  type: productTypeEnum('type').notNull(),
  defaultUomId: uuid('default_uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  standardYieldFactor: numeric('standard_yield_factor', { precision: 5, scale: 4 }).notNull().default('1.0000'),
  shelfLifeDays: integer('shelf_life_days'),
  active: boolean('active').notNull().default(true),
});
// Unique per (brand_id, sku). Trigram index on name for DL-026 CC-DUPLICATE-WARN.

// DL-023 layer 2: per-product alternate UOMs.
export const productUoms = brandScopedTable('product_uoms', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  uomId: uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  factorToDefaultUom: numeric('factor_to_default_uom', { precision: 18, scale: 9 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});
// Unique per (brand_id, product_id, uom_id). Exactly one is_default=true per product (CHECK constraint).

export const categories = brandScopedTable('categories', {
  parentId: uuid('parent_id'),  // self-FK; null = top-level. Two-level per inventory note (no deeper).
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});
// CHECK: parent_id is null OR (SELECT parent_id FROM categories c WHERE c.id = parent_id) IS NULL
//        — enforce two-level depth.

export const productCategories = brandScopedTable('product_categories', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
});
// Unique per (brand_id, product_id, category_id). M:N per FR7.

// DL-013 critical table — auditTrigger: true.
export const enablementMatrix = brandScopedTable('enablement_matrix', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  reason: text('reason'),
  lastModifiedBy: uuid('last_modified_by').references(() => users.id),
  lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }).notNull().defaultNow(),
}, {
  auditTrigger: true,
  indexes: { brandProductDept: ['brand_id', 'product_id', 'department_id'] },
});
// UNIQUE per (brand_id, product_id, department_id).
// Index above is what architecture §6.2.1 commits checkEnablement to using.
```

- [ ] **Step 2: Add the trigram index on `products.name`.** As a hand-written SQL block in the migration (Drizzle Kit doesn't model `gin_trgm_ops`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_vendors_name_trgm ON vendors USING gin (name gin_trgm_ops);   -- added in Task A8
CREATE INDEX idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
```

- [ ] **Step 3: Generate + apply migration.** Inspect SQL: `enablement_matrix` carries the audit trigger DDL; trigram indexes present.

- [ ] **Step 4: Update `schema/index.ts` re-exports.**

- [ ] **Step 5: Commit.**

```bash
git add apps/api/src/db/schema/inventory.ts apps/api/src/db/schema/index.ts apps/api/src/db/migrations
git commit -m "Phase 4 Epic 1 Arc a — schema/inventory.ts (uoms, products, categories, enablement_matrix per DL-023 + DL-013)"
```

### Task A7: productService + categoryService + UOM resolution + findSimilarByName (DL-023 + DL-026)

**Files:**
- Create: `apps/api/src/services/product.service.ts`, `apps/api/src/services/category.service.ts`
- Test: `apps/api/tests/integration/product.test.ts`, `apps/api/tests/integration/category.test.ts`

- [ ] **Step 1: Write failing tests for `productService`.** Cover:
  - FR3 product CRUD (create, list filtered by type/category/active, get, update, deactivate)
  - FR4 UOM conversion: `productService.convertQuantity(productId, fromUom, toUom, qty)` — registry path (kg → g via `conversion_to_base_factor`); per-product override path (`case → kg` via `product_uoms.factor_to_default_uom`); two-hop path (`case → kg → g`).
  - DL-023 invariant: exactly one `is_default = true` row per product in `product_uoms`. Attempting to add a second `is_default = true` row throws `ValidationError`.
  - DL-026 `findSimilarByName(name, threshold = 0.85)` returns products where `similarity(products.name, $1) >= 0.85`, ordered by similarity DESC, excluding the candidate row itself when called from update path.
  - Soft-delete: `deactivate(id)` sets `active = false`; future `create(input)` with same SKU still rejected (uniqueness on `sku` is unconditional, not filtered by `active`).

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `product.service.ts`.** Methods:

```typescript
export const productService = {
  createProduct(db: BrandedDb, input: NewProduct): Promise<Product>,
  listProducts(db: BrandedDb, filter?: ProductFilter): Promise<Product[]>,
  getProduct(db: BrandedDb, id: string): Promise<Product & { uoms: ProductUom[]; categories: Category[] }>,
  updateProduct(db: BrandedDb, id: string, input: ProductUpdate, opts: { reason: string }): Promise<Product>,
  deactivateProduct(db: BrandedDb, id: string, opts: { reason: string }): Promise<Product>,

  // UOM resolution per DL-023
  addProductUom(db: BrandedDb, productId: string, input: NewProductUom): Promise<ProductUom>,
  removeProductUom(db: BrandedDb, id: string): Promise<void>,
  setDefaultProductUom(db: BrandedDb, productId: string, productUomId: string): Promise<void>,
  convertQuantity(db: BrandedDb, productId: string, fromUomId: string, toUomId: string, qty: number): Promise<number>,

  // DL-026
  findSimilarByName(db: BrandedDb, name: string, opts?: { threshold?: number; excludeId?: string }): Promise<Product[]>,
};
```

`convertQuantity` algorithm:
1. Look up product's default UOM and `product_uoms` rows.
2. If `fromUomId === toUomId`, return qty unchanged.
3. Resolve `fromUomId` to default-UOM-equivalent: if it IS the product's default, factor = 1; if it's in `product_uoms`, factor = `product_uoms.factor_to_default_uom`; if it's a registry UOM with same base as product's default, factor = `from.conversion_to_base / default.conversion_to_base`.
4. Same for `toUomId` (inverse).
5. Result = `qty * fromFactor / toFactor`.
6. Throw `ValidationError('uom.incompatible_base')` if base mismatch and no per-product bridge.

`findSimilarByName` SQL:
```typescript
return db.execute(sql`
  SELECT *, similarity(name, ${name}) AS sim
  FROM products
  WHERE brand_id = ${db.brandId}
    AND active = true
    AND id <> ${opts?.excludeId ?? null}
    AND similarity(name, ${name}) >= ${opts?.threshold ?? 0.85}
  ORDER BY sim DESC
  LIMIT 5
`);
```

- [ ] **Step 4: Run tests — expect PASS.**

- [ ] **Step 5: Implement `category.service.ts`.** CRUD + the M:N helpers `assignProductToCategory` / `removeProductFromCategory`. Two-level depth check (`parent_id` of `parent_id` must be null).

- [ ] **Step 6: Tests pass.**

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/services/product.service.ts apps/api/src/services/category.service.ts apps/api/tests/integration/product.test.ts apps/api/tests/integration/category.test.ts
git commit -m "Phase 4 Epic 1 Arc a — productService (DL-023 UOM two-layer, DL-026 findSimilarByName) + categoryService"
```

### Task A8: Schema — procurement.ts (vendors only) + vendorService with §2.7 scope mutation

**Files:**
- Create: `apps/api/src/db/schema/procurement.ts`, `apps/api/src/services/vendor.service.ts`
- Test: `apps/api/tests/integration/vendor.test.ts`

- [ ] **Step 1: Write `procurement.ts` schema.** Vendors only — POs / GRs are Epic 5.

```typescript
export const vendorScopeEnum = pgEnum('vendor_scope_enum', ['brand', 'cluster', 'pos']);
export const vendorPaymentModeEnum = pgEnum('vendor_payment_mode_enum', ['cash', 'bank_transfer', 'cheque']);

export const vendors = brandScopedTable('vendors', {
  code: text('code').notNull(),                  // 'VEND-{SEQUENCE}' or user code
  name: text('name').notNull(),
  scope: vendorScopeEnum('scope').notNull(),
  // When scope='cluster': clusterId required. When scope='pos': locationId (POS) required.
  scopeClusterId: uuid('scope_cluster_id').references(() => clusters.id, { onDelete: 'restrict' }),
  scopeLocationId: uuid('scope_location_id').references(() => locations.id, { onDelete: 'restrict' }),
  // Tax IDs — placeholder per §6.5.
  gstin: text('gstin'),                          // [PLACEHOLDER]
  pan: text('pan'),                              // [PLACEHOLDER]
  // Contact
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  street: text('street'),
  city: text('city'),
  postalCode: text('postal_code'),
  state: text('state'),
  // Commerce
  creditTermsDays: integer('credit_terms_days'),
  paymentMode: vendorPaymentModeEnum('payment_mode'),
  preferred: boolean('preferred').notNull().default(false),
  qualityRating: numeric('quality_rating', { precision: 3, scale: 2 }),  // 1.00–5.00
  active: boolean('active').notNull().default(true),
});
// Unique per (brand_id, code).
// CHECK: scope='brand' => scopeClusterId IS NULL AND scopeLocationId IS NULL
//        scope='cluster' => scopeClusterId IS NOT NULL AND scopeLocationId IS NULL
//        scope='pos' => scopeLocationId IS NOT NULL AND scopeClusterId IS NULL
```

- [ ] **Step 2: Generate + apply migration.**

- [ ] **Step 3: Write the failing tests for `vendor.service.ts`.** Test cases:
  - FR6 vendor CRUD with scope (brand / cluster / pos).
  - §2.7 widening: vendor scope POS → Cluster (with reason code) succeeds; audit log captures.
  - §2.7 widening: vendor scope Cluster → Brand (with reason code) succeeds.
  - §2.7 narrowing: vendor scope Brand → Cluster fails when there are open POs at locations outside the target cluster (Epic 5 will produce POs; Epic 1 test uses a stubbed `vendorService.hasOpenTransactionsAt(scope)` that the test injects). Epic 1 ships the guard skeleton — Epic 5 wires the real check.
  - §2.7 narrowing with no open transactions succeeds + audit captured.
  - DL-026 `findSimilarByName` works on vendors too (call exists; symmetric to products).

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Implement `vendor.service.ts`.** Methods:

```typescript
export const vendorService = {
  createVendor(db: BrandedDb, input: NewVendor): Promise<Vendor>,
  listVendors(db: BrandedDb, filter?: VendorFilter): Promise<Vendor[]>,
  getVendor(db: BrandedDb, id: string): Promise<Vendor>,
  updateVendor(db: BrandedDb, id: string, input: VendorUpdate, opts: { reason: string }): Promise<Vendor>,
  deactivateVendor(db: BrandedDb, id: string, opts: { reason: string }): Promise<Vendor>,

  // §2.7 — widen / narrow scope. Always requires reason.
  changeVendorScope(
    db: BrandedDb,
    id: string,
    newScope: { scope: VendorScope; clusterId?: string; locationId?: string },
    opts: { reason: string }
  ): Promise<Vendor>,

  // Stub for Epic 5 to wire — narrowing precondition.
  hasOpenTransactionsAt(db: BrandedDb, vendorId: string, locationIds: string[]): Promise<boolean>,

  findSimilarByName(db: BrandedDb, name: string, opts?: { threshold?: number; excludeId?: string }): Promise<Vendor[]>,
};
```

`changeVendorScope` algorithm:
1. Read current vendor.
2. Compute is-widening (new scope strictly broader than current per Brand > Cluster > POS hierarchy).
3. If widening: status-guarded UPDATE per DL-016 mechanism #3, audit-log with reason. Done.
4. If narrowing: compute the set of locations falling OUT of the new scope; call `hasOpenTransactionsAt(vendorId, droppedLocations)`. If true → throw `ScopeMutationError('vendor.scope_narrow_blocked_by_open_transactions')`. Else proceed with UPDATE + audit.
5. If lateral (cluster A → cluster B at same scope level): treat as narrowing first then widening — explicit fail with `ScopeMutationError('vendor.scope_lateral_not_supported')`. Reason: a single deactivate + recreate is cleaner.

- [ ] **Step 6: Run tests — expect PASS.**

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/db/schema/procurement.ts apps/api/src/services/vendor.service.ts apps/api/tests/integration/vendor.test.ts
git commit -m "Phase 4 Epic 1 Arc a — schema/procurement.ts vendors + vendorService with §2.7 scope mutation"
```

### Task A9: inventoryService.checkEnablement + enablement CRUD

**Files:**
- Create: `apps/api/src/services/inventory.service.ts` (Epic 1 ships only `checkEnablement` + enablement CRUD — `deductStock`, `transferStock`, `getAvailableStock` are Epic 4).
- Test: `apps/api/tests/integration/enablement.test.ts`

- [ ] **Step 1: Write failing tests.** Cover:
  - FR5: enable / disable a (product, department) pair; audit row carries reason.
  - FR8: `checkEnablement(productId, departmentId)` returns true when row enabled, false when disabled, false when row absent.
  - Architecture §6.2.1 refinement: result is memoized for the request lifetime — second call inside the same request hits the in-memory cache, not the DB. Test: spy on the underlying SELECT count.
  - DL-013 audit-trigger backstop: a direct DB UPDATE (bypassing the service) still produces an `audit_log` row via the trigger. (Test by issuing raw SQL via the unscoped client and asserting the audit row was written.)
  - List enablement matrix for a location: returns one row per (active product × department) pair, with `enabled` boolean and `reason`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `inventory.service.ts`.** Method skeleton for Epic 1 only:

```typescript
export const inventoryService = {
  // Full Master Spec §8.1 — Epic 1 ships only checkEnablement + enablement CRUD.
  // Epic 4 fills in: getAvailableStock, deductStock, transferStock.

  checkEnablement(db: BrandedDb, productId: string, departmentId: string): Promise<boolean>,
  setEnablement(
    db: BrandedDb,
    productId: string,
    departmentId: string,
    enabled: boolean,
    opts: { reason?: string }
  ): Promise<void>,
  listEnablementForLocation(
    db: BrandedDb,
    locationId: string,
    filter?: { categoryId?: string }
  ): Promise<EnablementCell[]>,
  bulkSetEnablement(
    db: BrandedDb,
    pairs: Array<{ productId: string; departmentId: string; enabled: boolean }>,
    opts: { reason?: string }
  ): Promise<void>,
};
```

Memoization implementation: the `brandedDb` request scope (per §4.2) carries a `Map<string, boolean>` keyed `${productId}:${departmentId}`. `checkEnablement` looks up the cache first. `setEnablement` invalidates the relevant cache key on write.

- [ ] **Step 4: Run tests — expect PASS.**

- [ ] **Step 5: Commit.**

```bash
git add apps/api/src/services/inventory.service.ts apps/api/tests/integration/enablement.test.ts
git commit -m "Phase 4 Epic 1 Arc a — inventoryService.checkEnablement + enablement CRUD (FR5, FR8; Epic 4 fills the rest)"
```

### Task A10: companyService (DL-024 edit-only)

**Files:**
- Create: `apps/api/src/services/company.service.ts`
- Test: `apps/api/tests/integration/company.test.ts`

- [ ] **Step 1: Write failing tests.** Cover:
  - FR9: read company details (the single `brands` row, scoped by `req.user.brandId`).
  - FR9: update company details (name, address, GSTIN, PAN, contact, bank, fiscal year, currency, timezone, logo) with reason captured in audit.
  - DL-024: there is no `createCompany` method — call to a non-existent method on the service throws TypeScript error at compile time AND a runtime smoke test verifies no Express route accepts `POST /api/v1/company` (only `GET` and `PATCH`).
  - DL-024: setting `status = 'setup_complete'` is one-way; an attempt to revert to `setup_pending` throws `ValidationError('company.status_revert_blocked')`.
  - Multi-currency: setting `accounting_currency != 'INR'` throws `ValidationError('company.multi_currency_deferred')`.

- [ ] **Step 2: Implement `company.service.ts`.** Methods:

```typescript
export const companyService = {
  getCompany(db: BrandedDb): Promise<Brand>,
  updateCompany(db: BrandedDb, input: CompanyUpdate, opts: { reason: string }): Promise<Brand>,
  markSetupComplete(db: BrandedDb, opts: { reason: string }): Promise<Brand>,
};
// NO createCompany. Single brand per deployment per DL-024.
```

- [ ] **Step 3: Tests pass.**

- [ ] **Step 4: Commit.**

```bash
git add apps/api/src/services/company.service.ts apps/api/tests/integration/company.test.ts
git commit -m "Phase 4 Epic 1 Arc a — companyService (DL-024 edit-only; no createCompany)"
```

### Task A11: REST routes per architecture §17.2 row "Epic 1"

**Files:**
- Create: `apps/api/src/routes/{clusters,locations,departments,products,product-uoms,uoms,vendors,categories,enablements,company}.ts`, `apps/api/src/routes/index.ts`
- Test: extend each integration test to cover HTTP layer via `supertest`

- [ ] **Step 1: For each resource, write the route module.** Pattern: thin wrapper that calls service method, parses Zod input, returns service output as JSON. Status codes per architecture §17.5. Example shape (`clusters.ts`):

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { orgService } from '../services/org.service';

export const clustersRouter = Router();

const createClusterSchema = z.object({
  name: z.string().min(1).max(120),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});

clustersRouter.get('/', async (req, res, next) => {
  try { res.json(await orgService.listClusters(req.db)); } catch (e) { next(e); }
});

clustersRouter.post('/', async (req, res, next) => {
  try {
    const input = createClusterSchema.parse(req.body);
    const cluster = await orgService.createCluster(req.db, input);
    res.status(201).json(cluster);
  } catch (e) { next(e); }
});

clustersRouter.patch('/:id', async (req, res, next) => {
  try {
    const input = createClusterSchema.partial().parse(req.body);
    const reason = z.string().min(3).parse(req.body.reason);
    const cluster = await orgService.updateCluster(req.db, req.params.id, input, { reason });
    res.json(cluster);
  } catch (e) { next(e); }
});

clustersRouter.delete('/:id', async (req, res, next) => {
  // Soft-delete only per DL-022.
  try {
    const reason = z.string().min(3).parse(req.body.reason);
    const cluster = await orgService.deactivateCluster(req.db, req.params.id, { reason });
    res.json(cluster);
  } catch (e) { next(e); }
});
```

- [ ] **Step 2: Mount in `routes/index.ts`.**

```typescript
router.use('/clusters', clustersRouter);
router.use('/locations', locationsRouter);
router.use('/departments', departmentsRouter);
router.use('/products', productsRouter);
router.use('/product-uoms', productUomsRouter);
router.use('/uoms', uomsRouter);
router.use('/vendors', vendorsRouter);
router.use('/categories', categoriesRouter);
router.use('/enablements', enablementsRouter);
router.use('/company', companyRouter);
```

- [ ] **Step 3: Special routes:**
  - `POST /api/v1/enablements/check` — body: `{ productId, departmentId }` → `{ enabled: boolean }`. Per architecture §17.2 row.
  - `POST /api/v1/products/import` and `POST /api/v1/vendors/import` — CSV bulk import, deferred to a Task A11.5 after happy paths land OR explicitly skipped to Phase 4 Epic 1 follow-up if scope tightens. Decide at execution time; if skipped, leave a `// TODO: bulk CSV import (architecture §17.2)` stub route returning `501 Not Implemented`.
  - `GET /api/v1/products/find-similar?name=<q>&excludeId=<id>` — DL-026 consumer endpoint for CC-DUPLICATE-WARN.
  - `GET /api/v1/vendors/find-similar?name=<q>&excludeId=<id>` — DL-026 consumer endpoint.
  - `POST /api/v1/vendors/:id/scope` — §2.7 scope mutation. Body: `{ scope, clusterId?, locationId?, reason }`.
  - `POST /api/v1/company/mark-setup-complete` — DL-024 one-way transition.

- [ ] **Step 4: Extend integration tests** to call each route via `supertest`. Round-trip: send HTTP request → assert response JSON shape + status code.

- [ ] **Step 5: Run all tests — expect PASS.**

- [ ] **Step 6: Manual smoke test.** With `pnpm --filter @fnberp/api dev` running, hit each endpoint with `curl`. Confirm the error envelope on a deliberate validation failure (`POST /api/v1/clusters` with empty name → `400` + `{ code: 'validation.field_required', ... }`).

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/routes
git commit -m "Phase 4 Epic 1 Arc a — REST routes for all 10 MDM resources + find-similar + scope mutation + mark-setup-complete"
```

### Task A12: CI lint scripts + green CI pipeline

**Files:**
- Modify: `.github/workflows/ci.yml` (or create if missing per architecture §20.1)
- Create: `apps/api/scripts/lint-migrations.ts`, `apps/api/scripts/lint-brand-id-index.ts`, `apps/api/scripts/lint-design-tokens.ts` — IF NOT ALREADY SHIPPED at Phase 3a deliverable. Check `apps/api/scripts/` first; if those scripts exist, skip to Step 3.

- [ ] **Step 1: Verify Phase 3a CI lint scripts.** `ls apps/api/scripts/lint-*.ts mockups/scripts/lint-*.ts` — Phase 3a closure note (DL-021) lists these as Architecture deliverables. If missing, surface for confirmation before authoring (those scripts have a defined spec in architecture §20.2 — the missing artifact is a Phase 3a gap, not Epic 1 scope).

- [ ] **Step 2: Wire CI workflow if missing.** Per architecture §20.1 pipeline: install → typecheck → lint → test → migration-lint → brand-id-index-lint → design-token-lint.

- [ ] **Step 3: Run all lints locally.** Expect green.

- [ ] **Step 4: Push branch + open Arc (a) PR.** Title: "Phase 4 Epic 1 Arc a — MDM backend (schema + services + API + tests)." Body:
  - "Implements FR1–FR9 backend per Master Spec §2 + §4 module tier.
  - DL-022 parent-lock enforced at service layer + TypeScript types + runtime guard.
  - DL-023 UOM two-layer (registry + per-product overrides) shipped.
  - DL-024 single-brand bootstrap + edit-only `companyService`.
  - DL-026 `findSimilarByName` ready for CC-DUPLICATE-WARN consumption in Arc (b)/(c).
  - `inventoryService.checkEnablement` is the cross-epic boundary every later epic consumes.
  - All integration tests green; CI lint green.
  - Out of scope this arc: Epic 4 inventory ops, Epic 5 PO/GR, Epic 2 RBAC matrix expansion."

  Mark as draft if reviewers want stacked PRs; else target `main`.

### Task A13: Arc (a) close

- [ ] **Step 1: Update `claude.md` `## Current phase`.** Per cross-phase invariant 9 — same-commit update on phase boundary. New text:

> **Phase 4 Epic 1 MDM Arc (a) ✅ DONE 2026-MM-DD.** Drizzle schema (`org`, `inventory` partial — uoms/products/categories/enablement_matrix only — `procurement` partial — vendors only) + service layer (`orgService`, `productService`, `vendorService`, `categoryService`, `companyService`, `auditLog`, `inventoryService.checkEnablement`) + REST routes shipped. DL-022 parent-lock + DL-023 UOM two-layer + DL-024 edit-only company + DL-026 findSimilarByName all live. Brand seed script idempotent. Supabase Mumbai project provisioned. **Arc (b) just-in-time mockups is the next entry point.**

- [ ] **Step 2: Update `_planning/06-phase-roadmap.md` Phase 4 row.** Note Arc (a) closed; Arc (b) is next.

- [ ] **Step 3: Commit + push.**

```bash
git add claude.md _planning/06-phase-roadmap.md
git commit -m "Phase 4 Epic 1 Arc a close — claude.md + roadmap update"
git push
```

- [ ] **Step 4: Mark Arc (a) PR ready for review or merge to next-arc base branch.**

---

## 5. Arc (b) — Just-in-time mockups

**Session goal:** Five new routes in `mockups/` — four Tier 2 screens + one Index-only stub — plus the new `CCDuplicateWarn` shell + the SI-MDM-003 fix-back to consume it. **No backend or production-frontend code touched.** Single fresh chat, single branch `phase-4/epic-1-mdm-arc-b-mockups` (rebased on top of Arc (a) merge).

**Pre-flight:**
- [ ] **Pre-B1:** Arc (a) merged to `main` (or available as base). `git checkout main && git pull && git checkout -b phase-4/epic-1-mdm-arc-b-mockups`.
- [ ] **Pre-B2:** `cd mockups && pnpm install && pnpm dev` — verify `localhost:5173` boots clean, `/_dev/components` lists all 21 existing shells.

### Task B1: Build CC-DUPLICATE-WARN shell

**Files:**
- Create: `mockups/src/shell/CCDuplicateWarn.tsx`
- Modify: `mockups/src/shell/index.ts` (add export)

- [ ] **Step 1: Spec the shell.** Per DL-026:
  - Props: `{ matches: Array<{ id: string; name: string; subtitle?: string; status?: 'active' | 'inactive' }>; onEditExisting: (id: string) => void; onProceedAnyway: () => void; threshold?: number; }`.
  - Surface: non-blocking inline warning panel directly under the parent input. Background `surface_container_low`; text `on_surface_variant`; border-l-4 in `status_pending` (already in the canonical 20 — verify in DESIGN.md §6.1 before using).
  - Empty state: when `matches.length === 0`, render nothing (returns `null`).
  - `<= 5` matches: show all. `> 5`: show first 5 + "and N more — review existing list".
  - Actions: each match row has "Edit existing" link (CC-pattern: text-button; outline_variant on hover); panel footer has "Proceed and create anyway" button (also text-button per warn-and-log philosophy; not destructive, not disabled).

- [ ] **Step 2: Write the component.** ~80–120 LOC. Use Lucide `AlertCircle` icon at 18px. Inter font inherited. Zero hex literals. Zero borders other than `border-l-4`.

- [ ] **Step 3: Add to `_dev/components` permutation viewer.** Three permutations: 0 matches, 2 matches, 7 matches. Verify renders cleanly at `localhost:5173/_dev/components#cc-duplicate-warn`.

- [ ] **Step 4: Pre-commit hook check.** `git add mockups/src/shell/CCDuplicateWarn.tsx mockups/src/shell/index.ts && git commit -m "Phase 4 Epic 1 Arc b — CCDuplicateWarn shell (DL-026)"`. Hook checks: no hex literals; only Lucide icons; no banned border classes.

### Task B2: SI-MDM-001 — Org Hierarchy View & Edit (Tier 2)

**Files:**
- Create: `mockups/src/screens/SI-MDM-001.tsx`
- Modify: `mockups/src/App.tsx` (register route)

- [ ] **Step 1: Reread the inventory entry.** `_planning/05-screen-inventory.md` lines 257–305. Note "Design approach: Tree view (desktop) with collapsible nodes; each node carries status pill (active/inactive)."

- [ ] **Step 2: Sketch tree shape.** Use sample data from `mockups/src/lib/sample-data.ts` (clusters, locations, departments). Tree: Brand → 2 clusters → 4 locations → ~8 departments. Each node row carries name, type pill, action menu (rename, deactivate, add child).

- [ ] **Step 3: Build the component.** Reuse foundation chrome — `Card`, `StatusPill`, `Button`, `Popover` (for action menu), `AuditLink` (status row footer per DL-013 application-layer audit). DL-022 surfaces explicitly: the "Move to other cluster/location" affordance does NOT exist; the action menu is "rename, edit address/contact, deactivate, add child." A subtle helper-text below the tree: "Restructuring requires deactivate + recreate (DL-022 — no re-parenting in MVP)."

- [ ] **Step 4: Render at `/SI-MDM-001`.** Verify: 0 console errors; matches inventory's "Data displayed" + "User actions" sections; pre-commit hook passes.

- [ ] **Step 5: Lighter-critique self-review (Tier 2 acceptance per DL-025).** Checklist:
  - All 12 inventory schema fields present on the screen (Purpose, Data displayed, User actions, Cross-cutting, Tokens, Source FRs, Source journey, Related screens, Notes).
  - Foundation chrome reused (no new shells invented).
  - DESIGN.md tokens only — no hex / no banned classes.
  - DL-022 surface choice visible (no re-parenting affordance).

- [ ] **Step 6: Commit.**

```bash
git add mockups/src/screens/SI-MDM-001.tsx mockups/src/App.tsx
git commit -m "Phase 4 Epic 1 Arc b — SI-MDM-001 Org Hierarchy (Tier 2; DL-022 surface)"
```

### Task B3: SI-MDM-002 — Department Register (Tier 2)

**Files:**
- Create: `mockups/src/screens/SI-MDM-002.tsx`
- Modify: `mockups/src/App.tsx`

- [ ] **Step 1: Reread inventory entry** (lines 308–353).
- [ ] **Step 2: Build the component.** Desktop: searchable + sortable table (use `Table` shell); columns Department / Code / Type / Parent Location / Cluster / Status / Actions. Mobile: card list with type badge.
- [ ] **Step 3: Render + console-error check.**
- [ ] **Step 4: Lighter-critique self-review.**
- [ ] **Step 5: Commit.**

### Task B4: SI-MDM-005 — Vendor Master CRUD (Tier 2) + scope picker inline

**Files:**
- Create: `mockups/src/screens/SI-MDM-005.tsx`
- Modify: `mockups/src/App.tsx`

- [ ] **Step 1: Reread inventory entry** (lines 454–504).
- [ ] **Step 2: Build the screen.** Two surfaces in one route — vendor list (default) and vendor edit form (when a row clicked or "New" pressed). Inline scope picker per Q7 decision (not a CC-* shell): three-state radio group (Brand / Cluster / POS); when "Cluster" selected, render cluster select; when "POS" selected, render cluster + POS select.
- [ ] **Step 3: Wire CC-DUPLICATE-WARN.** On the create form, when the "Vendor name" input has `>= 3 chars`, show the warn panel below if there are similar matches in `sample-data.ts`. Use the new shell component.
- [ ] **Step 4: §2.7 scope-mutation surface.** On the edit form, the scope picker is editable; if user changes it, render a confirm dialog with mandatory reason textarea. Visually convey "Widening: free." vs "Narrowing: blocked when open transactions exist." (Sample data has no open transactions; the dialog narrative still appears but the action proceeds.)
- [ ] **Step 5: Render + console-error check.**
- [ ] **Step 6: Lighter-critique self-review** + verify CC-DUPLICATE-WARN appears in two consumers now (SI-MDM-005 already; SI-MDM-003 fix-back at Task B6).
- [ ] **Step 7: Commit.**

### Task B5: SI-MDM-007 — Company Registration & Fiscal Year Setup (Tier 2; edit-only per DL-024)

**Files:**
- Create: `mockups/src/screens/SI-MDM-007.tsx`
- Modify: `mockups/src/App.tsx`

- [ ] **Step 1: Reread inventory entry** (lines 555–602).
- [ ] **Step 2: Build the screen.** Single-form layout — sections: Legal Identity / Address / Tax IDs / Contact / Banking / Fiscal Year / Display & Locale / Status. The "Mark setup complete" button at the bottom is one-way (DL-024). No "Create new brand" affordance anywhere on this route.
- [ ] **Step 3: Render + console-error check.**
- [ ] **Step 4: Lighter-critique self-review** + verify DL-024 surface (no create button).
- [ ] **Step 5: Commit.**

### Task B6: SI-MDM-006 — Category & Sub-Category Index-only stub

**Files:**
- Create: `mockups/src/screens/SI-MDM-006.tsx` (stub)
- Modify: `mockups/src/App.tsx`

- [ ] **Step 1: Build the stub.** Per `_planning/05-screen-inventory.md` §"Index-only" pattern. Single page renders the inventory entry's Purpose + Data displayed + User actions + Notes verbatim, plus a small note: "Full mockup deferred; primary surface is SI-MDM-003 inline category assignment." Visual treatment: Card containing the inventory schema fields as a definition list. NO interactive surface.
- [ ] **Step 2: Render + console-error check** at `/SI-MDM-006`.
- [ ] **Step 3: Commit.**

### Task B7: SI-MDM-003 fix-back — consume CCDuplicateWarn (DL-026)

**Files:**
- Modify: `mockups/src/screens/SI-MDM-003.tsx`

- [ ] **Step 1: Read the existing SI-MDM-003.** Find the create form's "Product name" input.
- [ ] **Step 2: Wire CC-DUPLICATE-WARN.** Below the name input, render `<CCDuplicateWarn matches={...} onEditExisting={...} onProceedAnyway={...} />` where `matches` is computed from `sample-data.ts` materials when the input has `>= 3 chars` and similarity heuristic returns ≥ 0.85 (mock similarity in fixture for the mockup; actual `pg_trgm` runs at Arc (c)).
- [ ] **Step 3: Verify nothing else regresses.** All other affordances on SI-MDM-003 unchanged. Token usage unchanged.
- [ ] **Step 4: Commit.**

```bash
git add mockups/src/screens/SI-MDM-003.tsx
git commit -m "Phase 4 Epic 1 Arc b — SI-MDM-003 fix-back consume CCDuplicateWarn (DL-026)"
```

### Task B8: Spec-compliance reviewer pass on the 4 Tier 2 screens

- [ ] **Step 1: Run the spec-compliance reviewer on each Tier 2 screen.** For each (SI-MDM-001, -002, -005, -007), the reviewer (mirroring the S4 pattern) confirms: all 12 inventory schema fields surfaced, foundation chrome reused, no token violations, DL touch-points present (-001 has DL-022 helper-text, -005 has CC-DUPLICATE-WARN, -007 has no create button).
- [ ] **Step 2: If issues surface, fix in-place + recommit.**

### Task B9: Arc (b) close

- [ ] **Step 1: Update `claude.md` `## Current phase`.** New text: "Phase 4 Epic 1 MDM Arc (b) ✅ DONE — 4 Tier 2 mockups + 1 Index-only stub + CCDuplicateWarn shell + SI-MDM-003 fix-back. Arc (c) production frontend is next."
- [ ] **Step 2: Update `_planning/06-phase-roadmap.md`.**
- [ ] **Step 3: Push branch + open Arc (b) PR.** Title: "Phase 4 Epic 1 Arc b — MDM mockups (4 Tier 2 + 1 Index + CCDuplicateWarn + SI-MDM-003 fix-back)."

---

## 6. Arc (c) — Production frontend

**Session goal:** Production-grade React+Tailwind code in `apps/web` for all seven SI-MDM-### screens. Real Supabase auth. Real API consumption from Arc (a). Foundation chrome copy-ported from `mockups/src/shell` (one-time migration per DL-005). Loading + error boundaries + a11y hardening. **No backend or mockup code touched** except the one-time copy-port. Single fresh chat, single branch `phase-4/epic-1-mdm-arc-c-frontend` (rebased on top of Arc (b) merge).

**Pre-flight:**
- [ ] **Pre-C1:** Arc (a) and Arc (b) both merged. Branch from `main`.
- [ ] **Pre-C2:** Verify `apps/web` scaffold exists per architecture §3.1. If missing, the first task in Arc (c) is `apps/web` Vite scaffold.

### Task C0: apps/web Vite scaffold (skip if already done)

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/postcss.config.cjs`, `apps/web/tailwind.config.ts`

- [ ] **Step 1: Mirror `mockups/` Vite scaffold** but rooted at `apps/web/`. Same Tailwind v4, same shadcn primitives. Add `@supabase/supabase-js`, `@tanstack/react-query`, `@tanstack/react-router` (or `react-router-dom`), `zod`, `react-hook-form`, `@hookform/resolvers`.
- [ ] **Step 2: Wire `tailwind.config.ts`** to read same DESIGN.md tokens as mockups (per architecture §18.2 + DL-005).
- [ ] **Step 3: Boot smoke** with `pnpm --filter @fnberp/web dev` — expect blank "Hello world" page on `localhost:5174`.
- [ ] **Step 4: Commit.**

### Task C1: Copy-port foundation shell + DESIGN tokens (one-time per DL-005)

**Files:**
- Create: `apps/web/src/components/shell/*` — copy verbatim from `mockups/src/shell/*` (all 22 shells including new CCDuplicateWarn)
- Create: `apps/web/src/components/primitives/*` — copy from `mockups/src/components/ui/*` (shadcn primitives)
- Create: `apps/web/src/lib/tokens.ts` — copy from `mockups/src/tokens.ts`

- [ ] **Step 1: Run a single git-aware copy.** From repo root: `cp -r mockups/src/shell apps/web/src/components/ && cp -r mockups/src/components/ui apps/web/src/components/primitives && cp mockups/src/tokens.ts apps/web/src/lib/`.
- [ ] **Step 2: Update imports.** Each copied shell file imports neighbors via `./` paths; the structural copy preserves these. Spot-check `Button.tsx` and `CCDuplicateWarn.tsx` — both should compile against the new tree.
- [ ] **Step 3: Render the same `_dev/components` route in `apps/web` for parity check.** Same set of permutations renders identically.
- [ ] **Step 4: Pre-commit token-lint** runs on `apps/web/` per DL-005 + architecture §18 — verify both trees are covered by `lint-design-tokens.ts`.
- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/shell apps/web/src/components/primitives apps/web/src/lib/tokens.ts
git commit -m "Phase 4 Epic 1 Arc c — copy-port foundation shell + DESIGN tokens (one-time per DL-005)"
```

### Task C2: API client + auth + query-key factory

**Files:**
- Create: `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/query-keys.ts`, `apps/web/src/main.tsx` (extend with Auth + QueryClient providers)

- [ ] **Step 1: `api-client.ts`.** `fetch` wrapper that: (a) attaches `Authorization: Bearer ${supabaseSession.access_token}` from Supabase Auth; (b) parses success responses with caller-supplied Zod schema; (c) on error, parses the §17.5 envelope and throws a typed `ApiError` exposing `code`, `message`, `details`. ~80 LOC.
- [ ] **Step 2: `auth.ts`.** Supabase Auth SDK wrapper: `signIn(email, password)`, `signOut()`, `useSession()` hook returning current user + brand + role. Uses Supabase Auth UI patterns (no custom UI in Epic 1; basic email/password form deferred to Epic 2 SI-USR-001 — Epic 1 frontend assumes a session exists and shows a spinner if not). For dev, accept a "force login as seed user" affordance gated behind `import.meta.env.DEV`.
- [ ] **Step 3: `query-keys.ts`.** Single factory:

```typescript
export const qk = {
  clusters: { list: () => ['clusters', 'list'] as const, byId: (id: string) => ['clusters', 'byId', id] as const },
  locations: { list: (filter?: { clusterId?: string }) => ['locations', 'list', filter] as const, byId: (id: string) => ['locations', 'byId', id] as const },
  departments: { /* ... */ },
  products: { /* ... */, findSimilar: (name: string) => ['products', 'findSimilar', name] as const },
  vendors: { /* ... */, findSimilar: (name: string) => ['vendors', 'findSimilar', name] as const },
  uoms: { /* ... */ },
  productUoms: { /* ... */ },
  categories: { /* ... */ },
  enablements: { byLocation: (locationId: string) => ['enablements', 'byLocation', locationId] as const, check: (productId: string, departmentId: string) => ['enablements', 'check', productId, departmentId] as const },
  company: { read: () => ['company', 'read'] as const },
} as const;
```

- [ ] **Step 4: `main.tsx`** wires `<QueryClientProvider>` + `<AuthProvider>` + `<TooltipProvider>` (mirror S4 hotfix discipline) + `<RouterProvider>`. `staleTime: 5 minutes` defaults per architecture §12.2; per-query overrides for slow-changing master data per architecture §12.4 (hierarchy, role catalog, recipe catalog — disable `refetchOnWindowFocus`).
- [ ] **Step 5: Commit.**

### Task C3: SI-MDM-001 production page — Org Hierarchy

**Files:**
- Create: `apps/web/src/pages/mdm/HierarchyPage.tsx`, `apps/web/src/hooks/mdm/useClusters.ts`, `apps/web/src/hooks/mdm/useLocations.ts`, `apps/web/src/hooks/mdm/useDepartments.ts`

- [ ] **Step 1: TanStack Query hooks.** Each hook wraps the API endpoint. Mutations invalidate the relevant query keys on success. Optimistic updates per architecture §10.5 for low-contention writes (rename, address edit).
- [ ] **Step 2: HierarchyPage.tsx — copy structure from `mockups/src/screens/SI-MDM-001.tsx`.** Replace fixture data with hooks. Render skeletons while loading; error boundary catches `ApiError` and shows a typed error per §17.5 envelope.
- [ ] **Step 3: Auth gating per FR1.** Page is visible to Brand Owner role only. Use `useSession()` to read role; if not Brand Owner, render a 403 panel.
- [ ] **Step 4: DL-022 enforcement at the UI surface.** The action menu lists rename / address edit / deactivate / add child — never "move to other cluster/location." If a user with raw API access posts a parent-relink, the API throws and the toast shows the typed error.
- [ ] **Step 5: a11y hardening.** Tree nodes have `role="treeitem"` + `aria-expanded`; status pills have descriptive `aria-label`; action menu has keyboard nav (Tab + Arrow + Enter).
- [ ] **Step 6: Playwright e2e happy path.** `tests/e2e/mdm.spec.ts` — create cluster → create location under cluster → create department under location → assert tree renders all three.
- [ ] **Step 7: Commit.**

### Task C4: SI-MDM-002 — Department Register

Same shape as Task C3. **Files:** `pages/mdm/DepartmentsPage.tsx`, `hooks/mdm/useDepartments.ts` (already created in Task C3 — extend). Filter chips for cluster/location/type. e2e: filter by type "Production" → assert only those rows visible.

### Task C5: SI-MDM-003 — Product Master CRUD (already-mocked Tier 1 G1)

**Files:**
- Create: `apps/web/src/pages/mdm/ProductsPage.tsx`, `apps/web/src/pages/mdm/ProductsForm.tsx`, `apps/web/src/hooks/mdm/useProducts.ts`, `apps/web/src/hooks/mdm/useUoms.ts`, `apps/web/src/hooks/mdm/useProductUoms.ts`

- [ ] **Step 1: Hooks.** `useProducts.list({ filter })`, `useProducts.byId(id)`, `useProducts.create`, `useProducts.update`, `useProducts.deactivate`, `useProducts.findSimilar(name, opts)` with `staleTime: 0` and `enabled: name.length >= 3`.
- [ ] **Step 2: ProductsPage list view.** Filter bar (name search, type chips, category multi-select, active toggle). TanStack Table for the data grid.
- [ ] **Step 3: ProductsForm — multi-section form per inventory.** Sections: Identity (name, SKU, type) / UOM (default UOM picker + alternate-UOM editor consuming `useProductUoms`) / Yield + Shelf Life (FR3) / Categories (multi-select consuming `useCategories`) / Status. Below the name input: `<CCDuplicateWarn>` consuming `useProducts.findSimilar(nameValue)` — debounced 300ms. Reuse the foundation shell.
- [ ] **Step 4: UOM editor surface** matches the inventory note ("inline or in collapsible section, not a separate screen"). Each row: UOM picker (from `useUoms.list`), factor-to-default input, is-default radio. Add row / remove row. Validation: exactly one is_default, at least one row, default UOM matches product.defaultUomId.
- [ ] **Step 5: Auth gating per FR3 + RBAC.** Brand Owner full CRUD; Procurement Manager scope brand/cluster.
- [ ] **Step 6: a11y hardening + Playwright e2e.** Happy path: search → click row → edit → save → list reflects edit. Add: type "Tomato" → CCDuplicateWarn shows existing tomato variants → click "Edit existing" → land on the existing tomato form.
- [ ] **Step 7: Commit.**

### Task C6: SI-MDM-004 — Material Enablement Matrix

**Files:**
- Create: `apps/web/src/pages/mdm/EnablementMatrixPage.tsx`, `apps/web/src/hooks/mdm/useEnablements.ts`

- [ ] **Step 1: Hooks.** `useEnablements.byLocation(locationId, { categoryFilter })`, `useEnablements.set(productId, departmentId, enabled, reason)`, `useEnablements.bulkSet(pairs, reason)`. Mutations trigger invalidation of the matrix query.
- [ ] **Step 2: Matrix view (desktop).** Sticky row + column headers; rows = active products (filterable by category); columns = active departments at selected location; cell = toggle + tooltip showing last-modified user + timestamp + reason.
- [ ] **Step 3: List view (mobile + alternative desktop).** Per-department collapsible.
- [ ] **Step 4: Reason capture.** Toggle a cell → small popover: "Reason (optional, captured in audit trail per DL-013)" → confirm.
- [ ] **Step 5: Auth gating per FR5.** Store Manager scope = location/department; Brand Owner read-only review of any location.
- [ ] **Step 6: a11y hardening + Playwright e2e.** Happy path: select location → toggle one cell → assert audit-link surfaces the change in the row's history popover.
- [ ] **Step 7: Commit.**

### Task C7: SI-MDM-005 — Vendor Master CRUD

Same shape as Task C5. **Files:** `pages/mdm/VendorsPage.tsx`, `pages/mdm/VendorsForm.tsx`, `hooks/mdm/useVendors.ts`. Inline scope picker (Q7 — not a shell). CC-DUPLICATE-WARN on name input. §2.7 scope-mutation surface: changing scope opens a confirm dialog with reason textarea; submit calls the special `POST /api/v1/vendors/:id/scope` endpoint. Display a toast on `ScopeMutationError` from the API.

### Task C8: SI-MDM-006 — Category & Sub-Category Management

Lighter than the others (FR7 only — simple two-level CRUD). **Files:** `pages/mdm/CategoriesPage.tsx`, `hooks/mdm/useCategories.ts`. Tree-list view; create/edit dialogs; M:N mapping to products is the responsibility of SI-MDM-003 form (already wired in Task C5). Soft-delete; orphan products handling per inventory note. Smaller Playwright e2e.

### Task C9: SI-MDM-007 — Company Registration & Fiscal Year Setup

**Files:**
- Create: `apps/web/src/pages/mdm/CompanyPage.tsx`, `apps/web/src/hooks/mdm/useCompany.ts`

- [ ] **Step 1: Hook.** `useCompany.read` (single-record GET); `useCompany.update(input, reason)`; `useCompany.markSetupComplete(reason)`.
- [ ] **Step 2: Page = single edit form.** All sections per inventory. No "Create new brand" affordance anywhere. The status badge at the top reads "Setup Pending" or "Setup Complete." If pending, show a subtle "Mark setup complete" CTA at the bottom of the form (one-way per DL-024).
- [ ] **Step 3: Validations.** GSTIN regex (15-char alphanumeric); PAN regex (10-char); fiscal year start month [1–12]; start day [1–28] (avoid Feb 29 month-day pair).
- [ ] **Step 4: Auth gating per FR9.** Brand Owner only.
- [ ] **Step 5: Playwright e2e.** Happy path: edit company name → save → reload → see persisted change. Reject: try to revert status → toast surfaces `company.status_revert_blocked`.
- [ ] **Step 6: Commit.**

### Task C10: Chrome-freeze review gate

**Files:**
- Create: `docs/superpowers/reviews/2026-MM-DD-epic-1-mdm-chrome-freeze-review.md`

- [ ] **Step 1: Run the review.** Per cross-phase invariant 8. Compare:
  1. CC-DUPLICATE-WARN's three Epic-1 consumer surfaces to its shell spec (no per-consumer drift).
  2. The 4 new Tier 2 mockups' chrome usage to the 22-shell foundation (no inline reinventions).
  3. The 7 production frontend pages' chrome usage to the mockups (no production-only invented patterns).
  4. DESIGN.md token references — no new tokens introduced; no banned classes.
  5. DL-022 surface present (no re-parenting affordance) on both the SI-MDM-001 mockup and production page.
  6. DL-024 surface present (no create-brand button) on both the SI-MDM-007 mockup and production page.

- [ ] **Step 2: Document drift, if any.** For each finding, propose a fix-back. Apply fix-backs as new commits on the Arc (c) branch.

- [ ] **Step 3: Sign off the review file** with explicit "Drift = none" or "Drift = listed; fix-backs applied at commits SHA1, SHA2." Commit.

### Task C11: Arc (c) close + single Epic 1 PR to main

- [ ] **Step 1: Update `claude.md` `## Current phase`.**

> **Phase 4 Epic 1 MDM ✅ DONE 2026-MM-DD.** All seven SI-MDM-### screens live in `apps/web/`; chrome-freeze review passed; CC-DUPLICATE-WARN exercised by 3 consumer surfaces. Backend (Arc a), mockups (Arc b), production frontend (Arc c) all merged via stacked PRs landing in a single consolidated Epic 1 PR. **Epic 2 USR is the next entry point** — same per-epic 3-arc structure.

- [ ] **Step 2: Update `_planning/06-phase-roadmap.md` Phase 4 row.** Tick Epic 1; add a one-line drift note from chrome-freeze review.

- [ ] **Step 3: Create `codebase-inventory.md`.** Per claude.md "created after Epic 1." Single page mapping: `apps/api/src/db/schema/*` (what's in each), `apps/api/src/services/*` (one-line per service), `apps/api/src/routes/*` (resource → service mapping), `apps/web/src/pages/mdm/*`, `apps/web/src/hooks/mdm/*`. ~150 LOC.

- [ ] **Step 4: Push branch + open Epic 1 PR to main.** Title: "Phase 4 Epic 1 — Master Data Management (backend + mockups + production frontend)." Body summarizes Arc (a)/(b)/(c) deliverables, links DL-022 → DL-026, links chrome-freeze review file. Mark stacked PRs as merged; this is the single consolidated PR per claude.md cadence.

---

## 7. Acceptance criteria (Epic 1 close)

The Epic 1 PR merges to `main` only when all of the following are true. Each row maps back to a Master Spec § / FR / DL.

| Criterion | Source | Verified by |
|---|---|---|
| All FR1–FR9 implemented at backend + frontend | PRD §"Epic 1 — MDM" | Integration tests + Playwright e2e |
| `inventoryService.checkEnablement(productId, departmentId)` exists, returns boolean, request-memoized | Master Spec §8.1 + architecture §6.2.1 refinement | `enablement.test.ts` |
| Every org-scoped query uses `brandedDb` | DL-012 + Master Spec §7.2 | `branded-db.test.ts` + manual code-grep ("no naked Drizzle queries in services") |
| `brand_id` index exists on every `brandScopedTable` | DL-015 | `lint-brand-id-index.ts` CI lint |
| RLS policies on every table per canonical 2-policy template | DL-014 | `lint-migrations.ts` CI lint |
| DL-022 parent-lock enforced at TS types + runtime guard + UI absence | DL-022 | `org.test.ts` + chrome-freeze review |
| DL-023 UOM two-layer: registry + per-product overrides + `convertQuantity` two-hop tested | DL-023 + FR4 | `product.test.ts` |
| DL-024 single-brand: no `createCompany`; brand seed idempotent; multi-currency rejected | DL-024 + FR9 | `company.test.ts` + manual route grep |
| DL-025 mockup tier-tagging: 4 Tier 2 + 1 Index-only stub + SI-MDM-003 fix-back live; SI-MDM-004 unchanged | DL-025 | Vercel preview review |
| DL-026 CC-DUPLICATE-WARN shell exists; 3 consumer surfaces (Products, Vendors, Categories via Products); trigram threshold tunable | DL-026 + DL-018 | Mockup spec-compliance review + Playwright e2e |
| §2.7 vendor scope: widening succeeds with reason; narrowing blocked by open transactions; lateral rejected explicitly | Master Spec §2.7 + PRD vendor-scope sub-section | `vendor.test.ts` |
| Audit log captures every mutation with reason; trigger backstop on the 4 critical tables (incl. enablement_matrix) | DL-013 | `audit-log.test.ts` + raw-DB UPDATE bypass test |
| Brand bootstrap script idempotent + documented | DL-024 + architecture §3.5 | `pnpm db:seed` run twice; second run logs "skipping" |
| Chrome-freeze review filed and signed off | Cross-phase invariant 8 | `docs/superpowers/reviews/2026-MM-DD-epic-1-mdm-chrome-freeze-review.md` |
| `claude.md` `## Current phase` updated in same commit as Epic 1 close | Cross-phase invariant 9 | `git log -p claude.md` |
| `_planning/06-phase-roadmap.md` Phase 4 row updated | Cross-phase invariant 10 | `git log -p _planning/06-phase-roadmap.md` |
| `codebase-inventory.md` created | claude.md "created after Epic 1" | File presence in PR diff |
| Zero `any` types introduced | Master Spec §7.1 | `pnpm typecheck` + ESLint rule `@typescript-eslint/no-explicit-any: error` |
| Zero raw SQL outside migrations + RLS DDL | Master Spec §7.2 | manual grep + ESLint custom rule |
| Zero hex literals or banned border classes outside the documented allow-list | claude.md "Design token enforcement" | `lint-design-tokens.ts` + pre-commit hook |

---

## 8. Out of scope this Epic (do NOT build)

| Feature | Reason | Where it lives |
|---|---|---|
| Stock levels / batches / expiry tracking / FEFO | Epic 4 Inventory Management | Master Spec §10 sequence |
| `inventoryService.deductStock` / `transferStock` / `getAvailableStock` | Epic 4 — depends on stock levels | Master Spec §8.1 |
| Purchase orders / Goods Receipts / vendor PO history surfaces | Epic 5 Procurement | Master Spec §10 sequence |
| Recipes / recipe versions / recipe cost roll-up | Epic 6 Recipe Management | Master Spec §10 sequence |
| Approval Engine / Notification Center implementation | Epic 3 Shared Infrastructure | Master Spec §10 sequence (note: Epic 3 follows Epic 2 USR, not Epic 1) |
| Full RBAC matrix beyond Epic 1 admin gating | Epic 2 User Management & Security | Master Spec §10 sequence |
| Brand Owner self-creation flow with Superadmin approval | Epic 2 — depends on Approval Engine (Epic 3) | FR14 |
| Multi-currency support | Post-MVP per inventory SI-MDM-007 Notes + DL-024 | Master Spec §1.2 / §10 / §12 |
| Multi-tenant SaaS migration | Post-MVP per Master Spec §1.2 | DL-012 makes the migration trivial — schema is ready, not built |
| Offline-first capability | Post-MVP per DL-020 | DL-020 |

---

## 9. Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Phase 3a CI lint scripts (`lint-migrations.ts`, `lint-brand-id-index.ts`, `lint-design-tokens.ts`) not yet shipped | Arc (a) Task A12 blocks; CI cannot enforce the invariants | Task A12 Step 1 surfaces this; if missing, propose authoring as a Phase 3a follow-up before Arc (a) close |
| Supabase Mumbai project not provisioned at Pre-A1 | Arc (a) cannot run migrations; integration tests run against local Postgres only | Pre-A1 surfaces explicitly; user provisions before Arc (a) starts; Arc (a) integration tests run against local Postgres until Mumbai is live |
| `brandedDb` factory specification not yet implemented | Every service in Arc (a) blocks | Task A1 ships the factory before any service file lands |
| `pg_trgm` extension not enabled on Supabase Mumbai | DL-026 `findSimilarByName` queries fail; CC-DUPLICATE-WARN renders empty | Task A6 Step 2 explicitly enables the extension via `CREATE EXTENSION IF NOT EXISTS pg_trgm` in the migration |
| Trigram threshold (0.85) too strict / too lax in production | False negatives (real duplicates missed) or false positives (warning fatigue) | Threshold is a service-layer constant; tunable per-consumer; document tuning protocol in `codebase-inventory.md` |
| CC-DUPLICATE-WARN visual surface drifts between mockup and production | Chrome-freeze review fails; fix-back mid-Epic | Build the shell once in Arc (b); copy-port unchanged in Arc (c); shell is the single source of truth |
| DL-022 parent-lock circumvented via raw SQL during ops debugging | Audit integrity broken; cluster_id silently mutates on a Location row | TypeScript types exclude the field from update DTO; runtime guard re-checks; DL-013 trigger backstop on the four critical tables (Note: locations / clusters / departments are NOT on the critical-table list — application-layer audit + uniqueness via the service is the primary discipline; consider escalating to trigger backstop in a follow-up DL if ops bypass becomes a real risk) |
| Vendor scope `hasOpenTransactionsAt` stub not wired by Epic 5 | Vendor scope narrowing always succeeds in MVP, even when it should not | Stub returns `false` always in Epic 1; Epic 5 plan must call out wiring the real check on the PO/GR repository — flag in Epic 5 plan dependencies |
| Audit-trigger backstop on `enablement_matrix` accidentally double-writes (application + trigger) | Audit-log row count inflated; UI duplication | DL-013 explicit guidance: "When both layers fire, prefer the application-layer row." `auditLog.record` writes a `(table_name, row_id, occurred_at within 1s)` dedupe-friendly key; consumer surfaces (CC-AUDIT-LINK in Epic 3) handle dedupe at read time |

---

## 10. Self-review (run before committing this plan)

**1. Spec coverage:** Every FR1–FR9 is implemented across Tasks A3 (FR1, FR2 schema), A5 (FR1, FR2 service), A6 (FR3, FR4, FR5, FR7 schema), A7 (FR3, FR4, FR7 service), A8 (FR6 service incl. §2.7), A9 (FR5, FR8 service), A10 (FR9 service), A11 (all FR via REST), C3–C9 (all FR via UI). Every DL-001 → DL-026 binding is referenced where it shapes a task. ✅

**2. Placeholder scan:** Searched plan for "TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling", "Similar to Task N", "Write tests for the above" without code. Found none in normative text; the only `TODO` literal appears in Task A11 Step 3 as the literal stub message a route emits if bulk CSV import is deferred — that is intentional content, not a plan placeholder. ✅

**3. Type consistency:** Method names verified across the plan — `findSimilarByName` is consistent in Tasks A7 (products), A8 (vendors), A11 (routes), B1 (shell-consumer signature reference), B4 + B7 (consumer surface), C5 + C7 (production frontend hooks). `checkEnablement` consistent. `convertQuantity` consistent. `changeVendorScope` consistent. `markSetupComplete` consistent. `ParentRelinkAttemptError` named consistently. ✅

**4. Scope check:** Epic 1 covers only master data + the `checkEnablement` cross-epic boundary. No stock movement, no transactions, no approval workflows. Each arc is a self-contained session deliverable. ✅

**5. Arc independence:** Arc (a) backend produces a working API + tests with no frontend. Arc (b) mockups produce visual specs with no backend dependency (mockup uses sample-data fixtures). Arc (c) frontend depends on Arc (a) for real services and Arc (b) for the new shell — those dependencies are explicit pre-flight checks. ✅

---

*End of plan — Phase 4 Epic 1 — Master Data Management*
