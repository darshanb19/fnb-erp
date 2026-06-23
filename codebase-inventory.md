# Codebase Inventory — F&B ERP

Living index of where things live in this monorepo. Created at end of Phase 4 Epic 1 MDM (2026-05-07) per claude.md "Read first, every session" — `codebase-inventory.md` map of project structure (created after Epic 1). Last updated end of Phase 4 Epic 2 USR (2026-05-08).

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

## apps/api (Phase 4 Epic 1 Arc (a) + Epic 2 Arc (a))

Express + Drizzle ORM. Branded multi-tenancy per DL-012 + DL-027. Application-layer audit log per DL-013 + DL-028.

### Schema (`apps/api/src/db/schema/`)

- `brand.ts` — single `brands` row (one per tenant; DL-024 single-brand bootstrap; multi-brand UI deferred post-MVP)
- `auth.ts` — minimal `users` stub (FK target only; full RBAC + login lands in Epic 2 USR)
- `org.ts` — `clusters`, `locations`, `departments`, `stores` (DL-022 parent-lock at TS types + runtime guard + RLS)
- `inventory.ts` — Epic 1: `uoms`, `product_uoms` (DL-023 two-layer UOM), `products`, `categories`, `product_categories`, `enablement_matrix` (FR5 + FR8). **Epic 4 Arc (a):** core stock engine `stock_levels`, `stock_batches` (FEFO index on `expiry_date` + partial `WHERE quantity_remaining>0`), `stock_movements`; foundations `trn_sequences` (§6.2.4 TRN allocator), `journal_events` (Epic 10 accounting stub); goods receipt `goods_receipts`/`gr_lines`/`gr_attachments`/`gr_rejection_records`; transfers `stock_transfers`/`stock_transfer_lines`/`transfer_bundles`/`transfer_bundle_legs`/`transfer_suggestion_dismissals`; adjustments `inventory_adjustments`/`adjustment_lines`; closing `closing_inventory`/`closing_inventory_lines`/`cut_off_registry`; `par_levels` (auditTrigger, day-of-week jsonb).
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
| `inventory.service.ts` | Epic 1: `checkEnablement`/`setEnablement`/`bulkSetEnablement`/`listEnablementForLocation` (FR5 + FR8). **Epic 4 Arc (a):** `getAvailableStock`, `deductStock` (DL-016 FEFO + `SELECT…FOR UPDATE` row-lock), `incrementStock`, `getExpiringBatches` (FR30 24/48/72h bands); goods receipt `recordGoodsReceipt`/`confirmGoodsReceipt`/`rejectGoodsReceipt` (FR27 yield, FR114/FR115 warn-and-log); `recordAdjustment`/`confirmAdjustment`/`cancelAdjustment` (FR37); closing `getExpectedClosingStock`/`recordClosingInventory`/`confirmClosing`/`markVarianceAcceptable`/`getClosingInventorySummary`/`checkCutOffCompliance` (FR35/36/77; cut-off TZ limitation per DL-046); PAR `setParLevel`/`bulkSetParLevel`/`listBelowPar` (FR33/34). |
| `transfer.service.ts` | **Epic 4 Arc (a):** transfer lifecycle `createDraft`→`submitTransfer`→`approveTransfer`→`dispatchTransfer`→`confirmReceipt` (atomic status-guarded UPDATEs; deduction at dispatch) + `cancelTransfer` (FR117 guard) + `getTransferDetail`; `validateTransferFlow` (FR28/§2.2 + DL-043 raw-lateral allowance); paired bundles `createBundledTransfer`/`confirmBundleApproval` + `validateCrossClusterFlow`; suggestions `rankTransferSuggestions`/`suggestTransfers`/`dismissSuggestion` (FR32). Over-threshold → `approvalEngine.createApprovalRequest`. |
| `trn.service.ts` | **Epic 4 Arc (a):** `allocate(type, locationCode)` — atomic `{TYPE}-{YYYY}-{LOC}-{NNNNNN}` per architecture §6.2.4. |
| `journal-stub.service.ts` | **Epic 4 Arc (a):** `record(...)` writes a `journal_events` row (Epic 10 accounting seam; satisfies §8.1 `journalEntryId`). |
| `company.service.ts` | Brand row read + update + `markSetupComplete` (one-way per DL-024). No `createCompany` method — multi-brand UI deferred post-MVP. |
| `audit-log.service.ts` | `record(tx, ...)` + `computeChangedFields` helpers for DL-013 application-layer audit (called inside every mutation transaction) |

### REST routes (`apps/api/src/routes/`)

Mounted under `/api/v1/*` after auth + branded-db + audit-context middleware. Each sub-router operates on `req.db` (BrandedDb) and `req.user`.

- Epic 1 (MDM): `clusters.ts`, `locations.ts`, `departments.ts`, `uoms.ts`, `products.ts`, `product-uoms.ts`, `vendors.ts`, `categories.ts` (+ `find-similar` endpoint added Epic 2 Arc (a) for DL-026 third consumer / DL-034), `enablements.ts`, `company.ts`.
- Epic 2 (USR): `auth.ts` (sign-in/out + session helpers), `users.ts` (CRUD + per-user permission-overrides list endpoint added at C5), `permissions.ts` (catalog endpoint added at C5), `permission-overrides.ts` (grant/revoke + listExpiringSoon).
- Epic 3 (INF): `approvals.ts`, `notifications.ts`, `audit.ts`, `issues.ts`, `broadcasts.ts`.
- **Epic 4 Arc (a) (INV):** `stock.ts` (available/expiring/movements), `goods-receipts.ts`, `stock-transfers.ts` (+ bundles + suggestions), `inventory-adjustments.ts`, `closing-inventory.ts`, `par-levels.ts`. (`deductStock` has no public route — internal, called by Epic 7.)
- `index.ts` mounts the full router tree.

### Middleware (`apps/api/src/middleware/`)

- `auth.ts` — JWT verify. Pre-Epic-2: HS256-only against `SUPABASE_JWT_SECRET`. Post-Epic-2-Arc-(a): rewritten using jose to dual-path verify ES256/JWKS in prod (fetches from Supabase `/auth/v1/.well-known/jwks.json`) AND HS256 in test mode (gated by env). Attaches `req.user` from JWT claims.
- `branded-db.ts` — attaches `req.db` (BrandedDb factory per DL-012)
- `audit-context.ts` — `SET LOCAL app.user_id` per DL-013 / Master Spec §7.4
- `rbac.ts` — `requirePermission(perm)` + `requireRole(role)` Express middleware (Epic 2)
- `rate-limit.ts` — basic per-IP throttle on auth-sensitive endpoints (Epic 2)
- `request-logger.ts` — structured request log lines
- `error-handler.ts` — typed error → §17.5 envelope `{ code, message, details?, timestamp }`

### Scripts (`apps/api/scripts/`)

- `bootstrap-supabase-bo.ts` — idempotent Mumbai bootstrap (creates `bootstrap-bo@fnberp.local` in Supabase Auth + matched fnberp_dev `users` row by UUID). Run once at Epic 2 pre-C1.
- `drizzle-kit-generate.sh` — wrapper that loads `.env` before invoking `drizzle-kit generate`.

### Tests (`apps/api/tests/`)

178 tests passing (1 skipped — DL-013 trigger backstop test deferred to Phase 3a follow-up). Files: `org.test.ts`, `product.test.ts`, `vendor.test.ts`, `category.test.ts`, `enablement.test.ts`, `company.test.ts`, `routes.test.ts` (integration); `branded-db.test.ts`, `brand-scoped-table.test.ts`, `error-mapping.test.ts` (unit).

### Migrations (`apps/api/src/db/migrations/`)

Drizzle Kit generated, hand-edited for constraints/RLS. Epic 1–3 cover 0000–0012. **Epic 4 Arc (a): 0013–0017** — `0013_epic4_inv` (core stock + foundations, FEFO partial index), `0014_inv_goods_receipt`, `0015_inv_transfers` (incl. deferred GR→transfer FK + bundle mutual FK), `0016_inv_adjust_closing`, `0017_inv_par` — each with a companion `_rls.sql` (canonical 2-policy template, Supabase-only; not applied to local/test DB, which runs without RLS enforcement). Migration apply path: `psql … -f <file>` (the `db:migrate` npm script references a missing runner — known gap). Strategy per DL-045.

### Seed (`apps/api/src/db/seed/brand-seed.ts`)

Idempotent single-brand bootstrap (DL-024). Run via `pnpm --filter @fnberp/api db:seed`. Prints `Created brand id=...` on first run; logs "skipping" on subsequent runs.

---

## apps/web (Phase 4 Epic 1 Arc (c) + Epic 2 Arc (c))

React 18 + Vite 5 + Tailwind v4 + TanStack Query. Foundation chrome copy-ported from `mockups/` per DL-005 (one-time migration at each Arc (c) start; Epic 2 added 2 new shells + 1 lib helper).

### Layout

```
apps/web/
├── playwright.config.ts        # e2e config; webServer auto-starts pnpm dev on :5174
├── src/
│   ├── App.tsx                 # Routes — / + /dev-login + /_dev/components + /mdm/* (7 page routes) + /usr/* (8 page routes incl. /login + /reset-password + /reset-password/:token)
│   ├── main.tsx                # Provider stack: QueryClientProvider → AuthProvider → TooltipProvider → BrowserRouter
│   ├── components/
│   │   ├── shell/              # 27 chrome shell components — copy-port per DL-005. Epic 1: CCDuplicateWarn + 24 others. Epic 2 added: CCPermissionOverrideMgmt.tsx, CCRoleBadge.tsx.
│   │   └── primitives/         # 14 shadcn primitives (badge, button, card, dialog, dropdown-menu, input, popover, select, separator, sheet, sidebar, skeleton, table, tooltip)
│   ├── lib/
│   │   ├── api-client.ts       # Fetch wrapper; Zod parsing; ApiError class; §17.5 envelope handling
│   │   ├── api-config.ts       # API_BASE_URL constant (default :3001)
│   │   ├── auth.ts             # Epic 2 C1 (DL-033): rewritten on top of @supabase/supabase-js (Mumbai project). Preserves the useSession() consumer surface from the previous DL-029 dev-stub so all 7 Epic 1 pages keep working unchanged.
│   │   ├── supabase.ts         # Singleton @supabase/supabase-js client (anon key + Mumbai URL from VITE_SUPABASE_*). Epic 2 C1.
│   │   ├── query-keys.ts       # qk factory — covers Epic 1 (10 MDM resources) + Epic 2 USR namespaces (users, roles, permissions, permissionOverrides, effectivePermissions). Extended at C2.
│   │   ├── RequireAuth.tsx     # Route guard — spinner on loading; in Epic 2, redirect to /login on no-session
│   │   ├── RequirePermission.tsx # Epic 2 C2: gate children behind a single permission key; falls through to 403 panel if denied
│   │   ├── RequireRole.tsx     # Epic 2 C2: gate children behind a role; used by SI-USR-008 superadmin-only route
│   │   ├── reason-codes.ts     # Epic 2 C5: canonical 7-code reason catalog (promoted from earlier ad-hoc usage). Composed payload format: "<code>: <notes>".
│   │   ├── user-roles.ts       # Epic 2 C0 copy-port (DL-005): role enum + roleScopeShape (per-role scope-field expectations) + ROLE_BASELINE permission grants
│   │   ├── tokens.ts           # DESIGN.md token mirror (hex-exempt; canonical TypeScript token reference)
│   │   ├── utils.ts            # cn() class-merge helper
│   │   ├── personas.ts         # Mockup-only persona data (kept for AppShell parity)
│   │   ├── screen-catalog.ts   # Mockup-only navigation catalog (kept for AppShell parity)
│   │   └── sample-data.ts      # Mockup-only fixtures (kept for ComponentsIndex dev parity check)
│   ├── hooks/
│   │   ├── use-api-client.ts   # Constructs ApiClient with bearer token from useSession
│   │   ├── use-mobile.ts       # Sidebar primitive's responsive helper (copy-port sidecar)
│   │   ├── useUsers.ts         # Epic 2: list / get / create / update users; FR14 BO-pending-approval state included
│   │   ├── useRoles.ts         # Epic 2: read-only catalog of available roles
│   │   ├── usePermissions.ts   # Epic 2 C5: read-only permissions catalog (calls GET /api/v1/permissions added Epic 2 Arc (a)+C5)
│   │   ├── usePermissionOverrides.ts # Epic 2: list / grant / revoke / per-user list / listExpiringSoon
│   │   ├── useEffectivePermissions.ts # Epic 2 C2: combined ROLE_BASELINE + per-user overrides for a target user
│   │   └── mdm/
│   │       ├── schemas.ts      # Zod schemas for all 10 MDM resources (response parsing + form validation)
│   │       ├── useClusters.ts / useLocations.ts / useDepartments.ts  (org)
│   │       ├── useProducts.ts (incl. useFindSimilarProducts) / useUoms.ts / useProductUoms.ts (inventory)
│   │       ├── useCategories.ts (read + CRUD; useFindSimilarCategories added Epic 2 C9 — DL-026 third consumer)
│   │       ├── useVendors.ts (incl. useFindSimilarVendors + useMutateVendorScope)
│   │       ├── useEnablements.ts (byLocation + set + check + bulkSet)
│   │       └── useCompany.ts (read + update + markSetupComplete)
│   ├── pages/mdm/
│   │   ├── HierarchyPage.tsx          # SI-MDM-001 — DL-022 surface (no re-parenting)
│   │   ├── DepartmentsPage.tsx        # SI-MDM-002 — sortable table + responsive dual-view
│   │   ├── ProductsPage.tsx           # SI-MDM-003 list — Tier 1 acceptance
│   │   ├── ProductsForm.tsx           # SI-MDM-003 form — DL-023 UOM + DL-026 CC-DUPLICATE-WARN consumer
│   │   ├── EnablementMatrixPage.tsx   # SI-MDM-004 — Tier 1; FR5 + DL-013. RBAC tightened at Epic 2 C8 (over-permission bug fixed: procurement_manager no longer allowed to edit).
│   │   ├── VendorsPage.tsx            # SI-MDM-005 list
│   │   ├── VendorsForm.tsx            # SI-MDM-005 form — §2.7 scope picker + DL-026 CC-DUPLICATE-WARN consumer #2
│   │   ├── CategoriesPage.tsx         # SI-MDM-006 — FR7 two-level tree CRUD. DL-026 third-consumer wired at Epic 2 C9 (CC-DUPLICATE-WARN on create-top + create-sub).
│   │   └── CompanyPage.tsx            # SI-MDM-007 — DL-024 edit-only; brand_owner-gated. RBAC switched to <RequirePermission> at Epic 2 C8.
│   ├── pages/usr/                     # Epic 2 production pages
│   │   ├── LoginPage.tsx              # SI-USR-003 (Tier 1 hero) — brand-accent header band + generic invalid-creds banner
│   │   ├── PasswordResetPage.tsx      # SI-USR-004 — split into /reset-password (request) + /reset-password/:token (confirm)
│   │   ├── UsersPage.tsx              # SI-USR-001 — list + filters
│   │   ├── UserCreateEditPage.tsx     # SI-USR-002 (Tier 1 hero) — multi-section RHF+Zod; role-conditional scope per roleScopeShape; mandatory reason code; FR14 BO-role pending_approval banner
│   │   ├── EffectivePermissionsPage.tsx # SI-USR-005 — read-only ROLE_BASELINE + overrides view
│   │   ├── PermissionOverridePage.tsx # SI-USR-006 (Tier 1 hero) — grant/revoke + audit-row preservation
│   │   ├── OverridesExpiringPage.tsx  # SI-USR-007 — listExpiringSoon view; bulk renew/revoke surfaces stubbed with "coming in Epic 3" tooltip
│   │   └── AccountApprovalPage.tsx    # SI-USR-008 — DL-030 route-only no-menu; <RequireRole role="superadmin"> with 403 fallback
│   └── dev/
│       └── ComponentsIndex.tsx # /_dev/components route — chrome parity check
└── tests/e2e/                  # Playwright. Epic 2 added: global-setup.ts (Supabase sign-in once + storageState reuse) + _auth-helper.ts. Specs: mdm-hierarchy, mdm-departments, mdm-products, mdm-enablement, mdm-vendors, mdm-categories, mdm-company (one per Epic 1 page).
```

### Env

- `apps/web/.env.local` — local-only (gitignored). Pre-Epic-2: VITE_API_BASE_URL + VITE_DEV_JWT_SECRET + VITE_SEED_BRAND_ID + VITE_SEED_USER_ID + VITE_AUTO_DEV_SIGNIN. Post-Epic-2-C1: + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + VITE_E2E_BO_EMAIL + VITE_E2E_BO_PASSWORD (for Playwright globalSetup sign-in).
- `apps/web/.env.example` — committed reference; documents required vars.

---

## mockups (Phase 2c-scoped + Phase 4 Epic 1 Arc (b))

Vite + shadcn + Tailwind v4. Visual spec for production. Chrome shells live here first; copy-port to apps/web at the start of each new arc per DL-005 (one-time migration; subsequent sync via deliberate fix-back).

- `mockups/src/shell/` — 27 chrome shell components + index.ts (Epic 1: CCDuplicateWarn; Epic 2: CCPermissionOverrideMgmt + CCRoleBadge)
- `mockups/src/components/ui/` — 14 shadcn primitives (re-export targets; renamed to `primitives/` in apps/web at C1)
- `mockups/src/screens/` — Phase 2c-S3 G1 (10 screens) + S4 (5 screens) + Epic 1 Arc (b) (4 Tier 2 + 1 Index stub + 1 fix-back)
- `mockups/.git-hooks/pre-commit` + `check-rules.sh` — DESIGN.md token-enforcement hook (scope: `mockups/src/(screens|shell|dev|lib|pages)/` + `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` after C1 extension)

---

## docs/superpowers/

- `plans/2026-05-04-phase-2c-mockup-build.md` — Phase 2c-scoped plan (visual mockup foundation)
- `plans/2026-05-07-phase-4-epic-1-mdm-build.md` — Phase 4 Epic 1 plan (3 arcs, ~34 tasks)
- `reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md` — Epic 1 chrome-freeze review (sign-off: drift = listed; fix-back at SHA `34f41d4`)
- `reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md` — Epic 2 chrome-freeze review (sign-off: no drift; chrome consistent across both epics)

---

## Cross-references

- `_planning/02-master-spec.md` — single source of truth for scope, decisions, rules
- `_planning/03-prd.md` — FR1–FR119 functional requirements
- `_planning/05-screen-inventory.md` — 112 screens × 12 schema fields each
- `_planning/06-phase-roadmap.md` — canonical phase sequence
- `_planning/architecture.md` — Phase 3a output (data ERD, service graph, API contracts §17, sequence diagrams)
- `decision-log.md` — DL-001 through DL-034
- `DESIGN.md` — design tokens + visual rules
- `claude.md` — project-level Claude rules + `## Current phase`
