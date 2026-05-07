# Codebase Inventory — F&B ERP

Living index of where things live in this monorepo. Created at end of Phase 4 Epic 1 MDM (2026-05-07) per claude.md "Read first, every session" — `codebase-inventory.md` map of project structure (created after Epic 1).

Updated at the end of each Phase 4 epic. The phase roadmap (`_planning/06-phase-roadmap.md`) is canonical for "what's done / what's next"; this file is canonical for "where does X live".

---

## Top-level layout

```
fnb-erp/
├── _planning/                  # Specs, PRDs, screen inventory, phase roadmap (Phase 1–3a artefacts; canonical authority)
├── apps/
│   ├── api/                    # Backend — Express + Drizzle + Postgres (Phase 4 Epic 1 Arc (a))
│   └── web/                    # Production frontend — React 18 + Tailwind v4 (Phase 4 Epic 1 Arc (c))
├── mockups/                    # Visual spec mockups — Vite + shadcn (Phase 2c-scoped + Epic 1 Arc (b))
├── packages/
│   └── shared/                 # Shared TypeScript types (currently minimal — placeholder for cross-package code)
├── docs/superpowers/
│   ├── plans/                  # Implementation plans (one per major effort)
│   └── reviews/                # Chrome-freeze + spec-compliance review files (one per gate)
├── DESIGN.md                   # Design tokens + visual rules (canonical; pre-commit hook enforces token discipline)
├── claude.md                   # Project-level Claude rules + current phase pointer
├── decision-log.md             # DL-001 through DL-029 — micro-decisions accumulated during build
└── codebase-inventory.md       # This file
```

---

## apps/api (Phase 4 Epic 1 Arc (a))

Express + Drizzle ORM. Branded multi-tenancy per DL-012 + DL-027. Application-layer audit log per DL-013 + DL-028.

### Schema (`apps/api/src/db/schema/`)

- `brand.ts` — single `brands` row (one per tenant; DL-024 single-brand bootstrap; multi-brand UI deferred post-MVP)
- `auth.ts` — minimal `users` stub (FK target only; full RBAC + login lands in Epic 2 USR)
- `org.ts` — `clusters`, `locations`, `departments`, `stores` (DL-022 parent-lock at TS types + runtime guard + RLS)
- `inventory.ts` — `uoms`, `product_uoms` (DL-023 two-layer UOM), `products`, `categories`, `product_categories`, `enablement_matrix` (FR5 + FR8). Stock levels / batches / FEFO are Epic 4.
- `procurement.ts` — `vendors` (Master Spec §2.7 scope tier columns + idx_vendors_brand_scope). Purchase orders are Epic 5.
- `audit.ts` — `audit_log` table (DL-028 carved into Epic 1; consumer-side query API + trigger backstop deferred to Epic 3)
- `index.ts` — re-exports for the brandedDb wrapper

### Services (`apps/api/src/services/`)

| File | What it does |
|---|---|
| `org.service.ts` | Cluster/location/department/store CRUD + DL-022 parent-lock enforcement (no re-parenting) |
| `product.service.ts` | Product CRUD + UOM resolution two-layer (DL-023) + `findSimilarByName` (pg_trgm ≥ 0.85; DL-026) |
| `vendor.service.ts` | Vendor CRUD + §2.7 `mutateScope` (widening / narrowing / lateral semantics) + `findSimilarByName` |
| `category.service.ts` | Two-level category CRUD (depth-enforced) + product M:N mapping. **Note: no `findSimilarByName` yet — DL-026 third-consumer gap; flagged in 2026-05-07 chrome-freeze review for Epic 2 cleanup.** |
| `inventory.service.ts` | `checkEnablement(productId, departmentId)` + setEnablement (FR5 + FR8). `deductStock` / `transferStock` / `getAvailableStock` are Epic 4. |
| `company.service.ts` | Brand row read + update + `markSetupComplete` (one-way per DL-024). No `createCompany` method — multi-brand UI deferred post-MVP. |
| `audit-log.service.ts` | `record(tx, ...)` + `computeChangedFields` helpers for DL-013 application-layer audit (called inside every mutation transaction) |

### REST routes (`apps/api/src/routes/`)

10 resources × ~3 endpoints = 31 routes total. Mounted under `/api/v1/*` after auth + branded-db + audit-context middleware. Each sub-router operates on `req.db` (BrandedDb) and `req.user`. Files: `clusters.ts`, `locations.ts`, `departments.ts`, `uoms.ts`, `products.ts`, `product-uoms.ts`, `vendors.ts`, `categories.ts`, `enablements.ts`, `company.ts` + `index.ts` (router mount).

### Middleware (`apps/api/src/middleware/`)

- `auth.ts` — JWT verify (HS256 against `SUPABASE_JWT_SECRET`); attaches `req.user`. Accepts both real Supabase JWTs (Epic 2) and DL-029 dev-stub JWTs (claim shape identical).
- `branded-db.ts` — attaches `req.db` (BrandedDb factory per DL-012)
- `audit-context.ts` — `SET LOCAL app.user_id` per DL-013 / Master Spec §7.4
- `error-handler.ts` — typed error → §17.5 envelope `{ code, message, details?, timestamp }`

### Tests (`apps/api/tests/`)

178 tests passing (1 skipped — DL-013 trigger backstop test deferred to Phase 3a follow-up). Files: `org.test.ts`, `product.test.ts`, `vendor.test.ts`, `category.test.ts`, `enablement.test.ts`, `company.test.ts`, `routes.test.ts` (integration); `branded-db.test.ts`, `brand-scoped-table.test.ts`, `error-mapping.test.ts` (unit).

### Migrations (`apps/api/src/db/migrations/`)

Drizzle Kit generated. Six SQL files (0000–0005 + 0001_rls_and_constraints + 0002_audit_log + 0002_audit_log_rls + 0004_inventory_constraints + 0006_procurement_constraints) cover schema + canonical 2-policy RLS template per DL-014 + critical-table audit triggers (function body deferred to Phase 3a follow-up per DL-028).

### Seed (`apps/api/src/db/seed/brand-seed.ts`)

Idempotent single-brand bootstrap (DL-024). Run via `pnpm --filter @fnberp/api db:seed`. Prints `Created brand id=...` on first run; logs "skipping" on subsequent runs.

---

## apps/web (Phase 4 Epic 1 Arc (c))

React 18 + Vite 5 + Tailwind v4 + TanStack Query. Foundation chrome copy-ported from `mockups/` per DL-005 (one-time migration at Arc (c) start).

### Layout

```
apps/web/
├── playwright.config.ts        # e2e config; webServer auto-starts pnpm dev on :5174
├── src/
│   ├── App.tsx                 # Routes — / + /dev-login + /_dev/components + /mdm/* (7 page routes)
│   ├── main.tsx                # Provider stack: QueryClientProvider → AuthProvider → TooltipProvider → BrowserRouter
│   ├── components/
│   │   ├── shell/              # 25 chrome shell components (CCDuplicateWarn + 24 others) — copy-port per DL-005
│   │   └── primitives/         # 14 shadcn primitives (badge, button, card, dialog, dropdown-menu, input, popover, select, separator, sheet, sidebar, skeleton, table, tooltip)
│   ├── lib/
│   │   ├── api-client.ts       # Fetch wrapper; Zod parsing; ApiError class; §17.5 envelope handling
│   │   ├── api-config.ts       # API_BASE_URL constant (default :3001)
│   │   ├── auth.ts             # DL-029 dev-stub: jose-based HS256 JWT minted in browser; gated by import.meta.env.DEV. Replaces with real @supabase/supabase-js in Epic 2.
│   │   ├── query-keys.ts       # qk factory — covers all 10 MDM resources (clusters, locations, departments, products, vendors, uoms, productUoms, categories, enablements, company)
│   │   ├── RequireAuth.tsx     # Route guard — spinner on loading, redirect to /dev-login in DEV, static notice in PROD
│   │   ├── tokens.ts           # DESIGN.md token mirror (hex-exempt; canonical TypeScript token reference)
│   │   ├── utils.ts            # cn() class-merge helper
│   │   ├── personas.ts         # Mockup-only persona data (kept for AppShell parity; Epic 2 swaps for real session)
│   │   ├── screen-catalog.ts   # Mockup-only navigation catalog (kept for AppShell parity)
│   │   └── sample-data.ts      # Mockup-only fixtures (kept for ComponentsIndex dev parity check)
│   ├── hooks/
│   │   ├── use-api-client.ts   # Constructs ApiClient with bearer token from useSession
│   │   ├── use-mobile.ts       # Sidebar primitive's responsive helper (copy-port sidecar)
│   │   └── mdm/
│   │       ├── schemas.ts      # Zod schemas for all 10 MDM resources (response parsing + form validation)
│   │       ├── useClusters.ts / useLocations.ts / useDepartments.ts  (org)
│   │       ├── useProducts.ts (incl. useFindSimilarProducts) / useUoms.ts / useProductUoms.ts (inventory)
│   │       ├── useCategories.ts (read-only + CRUD added at C8)
│   │       ├── useVendors.ts (incl. useFindSimilarVendors + useMutateVendorScope)
│   │       ├── useEnablements.ts (byLocation + set + check + bulkSet)
│   │       └── useCompany.ts (read + update + markSetupComplete)
│   ├── pages/mdm/
│   │   ├── HierarchyPage.tsx          # SI-MDM-001 — DL-022 surface (no re-parenting)
│   │   ├── DepartmentsPage.tsx        # SI-MDM-002 — sortable table + responsive dual-view
│   │   ├── ProductsPage.tsx           # SI-MDM-003 list — Tier 1 acceptance
│   │   ├── ProductsForm.tsx           # SI-MDM-003 form — DL-023 UOM + DL-026 CC-DUPLICATE-WARN consumer
│   │   ├── EnablementMatrixPage.tsx   # SI-MDM-004 — Tier 1; FR5 + DL-013
│   │   ├── VendorsPage.tsx            # SI-MDM-005 list
│   │   ├── VendorsForm.tsx            # SI-MDM-005 form — §2.7 scope picker + DL-026 CC-DUPLICATE-WARN consumer #2
│   │   ├── CategoriesPage.tsx         # SI-MDM-006 — FR7 two-level tree CRUD
│   │   └── CompanyPage.tsx            # SI-MDM-007 — DL-024 edit-only; brand_owner-gated
│   └── dev/
│       └── ComponentsIndex.tsx # /_dev/components route — chrome parity check
└── tests/e2e/                  # Playwright happy paths — one spec per page (mdm-hierarchy, mdm-departments, mdm-products, mdm-enablement, mdm-vendors, mdm-categories, mdm-company)
```

### Env

- `apps/web/.env.local` — local-only (gitignored): VITE_API_BASE_URL + VITE_DEV_JWT_SECRET + VITE_SEED_BRAND_ID + VITE_SEED_USER_ID + VITE_AUTO_DEV_SIGNIN
- `apps/web/.env.example` — committed reference; documents required vars

---

## mockups (Phase 2c-scoped + Phase 4 Epic 1 Arc (b))

Vite + shadcn + Tailwind v4. Visual spec for production. Chrome shells live here first; copy-port to apps/web at the start of each new arc per DL-005 (one-time migration; subsequent sync via deliberate fix-back).

- `mockups/src/shell/` — 25 chrome shell components + index.ts (CCDuplicateWarn added in Arc (b))
- `mockups/src/components/ui/` — 14 shadcn primitives (re-export targets; renamed to `primitives/` in apps/web at C1)
- `mockups/src/screens/` — Phase 2c-S3 G1 (10 screens) + S4 (5 screens) + Epic 1 Arc (b) (4 Tier 2 + 1 Index stub + 1 fix-back)
- `mockups/.git-hooks/pre-commit` + `check-rules.sh` — DESIGN.md token-enforcement hook (scope: `mockups/src/(screens|shell|dev|lib|pages)/` + `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` after C1 extension)

---

## docs/superpowers/

- `plans/2026-05-04-phase-2c-mockup-build.md` — Phase 2c-scoped plan (visual mockup foundation)
- `plans/2026-05-07-phase-4-epic-1-mdm-build.md` — Phase 4 Epic 1 plan (3 arcs, ~34 tasks)
- `reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md` — Epic 1 chrome-freeze review (sign-off: drift = listed; fix-back at SHA `34f41d4`)

---

## Cross-references

- `_planning/02-master-spec.md` — single source of truth for scope, decisions, rules
- `_planning/03-prd.md` — FR1–FR119 functional requirements
- `_planning/05-screen-inventory.md` — 112 screens × 12 schema fields each
- `_planning/06-phase-roadmap.md` — canonical phase sequence
- `_planning/architecture.md` — Phase 3a output (data ERD, service graph, API contracts §17, sequence diagrams)
- `decision-log.md` — DL-001 through DL-029
- `DESIGN.md` — design tokens + visual rules
- `claude.md` — project-level Claude rules + `## Current phase`
