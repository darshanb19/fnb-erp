# Phase 3a — Architecture Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `_planning/architecture.md` (the canonical Phase 3a deliverable that survives reset and binds Phase 4 epic implementation), produce the OQ10 accountant-export column-mapping spec, and commit the optional diagrams that make the architecture inspectable. Close Phase 3a so Phase 2c-scoped (mockup foundation) is unblocked.

**Architecture:** Documentation authoring against an already-decided design — the 15 architectural decisions live in `decision-log.md` as DL-006 → DL-020, plus DL-001/DL-004/DL-005 carried forward. This plan assembles those decisions plus Master Spec §3, §7, §8, §11 + PRD FRs into a single canonical reference document, organized for engineers/AI-agents executing Phase 4 epics. No new architectural debate; if a section author wants to change a decision, they STOP, surface it as a critique, and re-open the OQ via `superpowers:brainstorming` before continuing.

**Tech Stack:** Documentation only. Markdown files, no code. Optional diagrams use Mermaid (renders natively in GitHub + VS Code preview) for ERD / service graph / sequence diagrams. No diagram-rendering tooling beyond Mermaid.

---

## Source-of-truth references for every task

Every task below cites these sources by exact number — the section author must read each cited entry verbatim before drafting. Do not paraphrase from memory.

| Source | Location |
|---|---|
| Master Spec | `_planning/02-master-spec.md` (§3 tech stack, §6 accounting, §7 critical rules, §8 service contracts, §11 OQs) |
| PRD | `_planning/03-prd.md` (FR1–FR119) |
| B2B Challan Spec | `_planning/04-b2b-challan-spec.md` |
| Screen Inventory | `_planning/05-screen-inventory.md` (CC-* catalogue §3, roles & scope §4) |
| Phase Roadmap | `_planning/06-phase-roadmap.md` (canonical phase sequence + cross-phase invariants) |
| DESIGN.md | project root (§3 multi-tenancy slot mechanism) |
| CLAUDE.md | project root (`## Current phase`, critical rules, methodology) |
| Decision Log | `decision-log.md` (DL-001 through DL-020) |

DL-006 → DL-020 cover the 15 OQ resolutions decided in this Phase 3a brainstorming session. DL-001 (Production Order 5-status), DL-004 (OQ9 in-repo Vite/shadcn), DL-005 (mockups vs production-code seed) carry forward and are formally captured in `architecture.md` per their respective sections below.

---

## Deliverables

| # | Path | Authored in tasks |
|---|---|---|
| D1 | `_planning/architecture.md` | Tasks 1–22 |
| D2 | `_planning/architecture-oq10-export-mappings.md` | Task 23 |
| D3 | `_planning/architecture-diagrams/data-model-erd.md` (Mermaid) | Task 24 |
| D4 | `_planning/architecture-diagrams/service-graph.md` (Mermaid) | Task 25 |
| D5 | `_planning/architecture-diagrams/sequence-b2b-challan.md` (Mermaid) | Task 26 |
| D6 | `_planning/architecture-diagrams/sequence-production-order-lifecycle.md` (Mermaid) | Task 27 |
| D7 | `_planning/architecture-diagrams/sequence-approval-routing.md` (Mermaid) | Task 28 |
| D8 | `_planning/02-master-spec.md` (§11 OQ status edits) | Task 29 |
| D9 | `_planning/06-phase-roadmap.md` (Phase 3a → ✅ DONE; Phase 2c-scoped → 🔄 NEXT) | Task 30 |
| D10 | `CLAUDE.md` (`## Current phase` update) | Task 30 |
| D11 | PR opened to merge to main | Task 31 |

---

## Session chunking (estimated 3 sessions)

| Session | Tasks | Closes when |
|---|---|---|
| **A** | 1–10 (architecture.md §1–§9 — foundation: stack, deploy, multi-tenancy, schema, services, audit, concurrency, jobs) | First 9 sections committed; intermediate PR optional |
| **B** | 11–22 (architecture.md §10–§20 — real-time, notifications, caching, storage, search, PDF, resilience, REST API, UI tool, mockups, CI/CD, cross-ref) | Architecture document feature-complete |
| **C** | 23–31 (OQ10 spec, 5 diagrams, master-spec/roadmap/CLAUDE.md updates, PR) | Phase 3a closed; PR merged |

Per CLAUDE.md `## Context management`: monitor `/context` during each session; if approaching 60–70%, STOP at the current task boundary and split. Each task is structured to be self-contained so a fresh session can pick up at the next task.

---

## File structure of the architecture document

`_planning/architecture.md` will have 20 numbered sections + 1 cross-reference index. Section numbering in the output document matches task numbering 1–21 in this plan (Task 1 → §1, Task 2 → §2, etc.; Task 22 = cross-reference index = §21).

```
_planning/architecture.md
  §1  Executive Summary & Reading Order
  §2  Tech Stack — Final Confirmed (with OQ resolutions)
  §3  Monorepo Structure & Deployment Topology       [DL-006, DL-007]
  §4  Multi-Tenancy Implementation                   [DL-012, DL-014, DL-015]
  §5  Database & Schema Conventions                  [Master §3.2, §6.5, §7.2; DL-015]
  §6  Service Layer Architecture                     [Master §8; Master §7.3]
  §7  Audit Trail Architecture                       [DL-013; FR20, FR21; CC-AUDIT-LINK]
  §8  Concurrency & Idempotency Patterns             [DL-016; DL-001]
  §9  Background Jobs & Scheduling                   [DL-009]
  §10 Real-Time Subscriptions                        [DL-010]
  §11 Notification Center                            [DL-011; FR19; Master §8.3]
  §12 Caching Strategy                               [DL-008]
  §13 File Storage                                   [DL-017; FR39, FR81]
  §14 Search Strategy                                [DL-018]
  §15 PDF Generation                                 [DL-019]
  §16 Resilience & Offline                           [DL-020]
  §17 REST API Conventions                           [Master §3.2, §7.5]
  §18 UI Design Tool Workflow                        [DL-004; OQ9 capture]
  §19 Mockups vs Production Code Relationship       [DL-005]
  §20 CI/CD Quality Gates                            [DL-014, DL-015; Master §3.1]
  §21 Cross-Reference Index                          (FR# → §; CC-* → §; DL-NNN → §)
```

---

## Task 1: §1 Executive Summary & Reading Order

**Files:**
- Create: `_planning/architecture.md` (entire file is created in this task; later tasks append sections)

**Source material:**
- Phase Roadmap `_planning/06-phase-roadmap.md` Phase 3a definition
- Master Spec §10 Phase 3a row + §11 OQ list
- decision-log.md DL-006 → DL-020 (count + summary)

**Section content outline:**
- One-paragraph mission: "What this document is and why it exists." (mirrors phrasing of Master Spec §11 closing note: "must be resolved before any epic implementation begins")
- "Reading order" subsection: prescribed reading flow for engineer/AI-agent picking up a Phase 4 epic for the first time. Order: Master Spec §1–§4 → this doc §1–§4 (orientation) → relevant epic-specific sections in this doc → relevant FRs in PRD → screen inventory entries.
- "How this doc relates to other reference files" subsection: a one-line role for each of CLAUDE.md, Master Spec, PRD, Screen Inventory, Phase Roadmap, DESIGN.md, decision-log.md, codebase-inventory.md (post-Epic-1).
- "Decision-log binding" subsection: enumerate DL-001 + DL-004 + DL-005 + DL-006 → DL-020 with one-line summary of each, as the architectural-decision provenance trail.
- "How to amend this doc" subsection: amendments require a new DL entry + same-commit update of this doc; never silent edit.

- [ ] **Step 1: Draft §1** — Write `_planning/architecture.md` with the structure above. Front-matter: title "F&B ERP — Architecture Reference", subtitle "Phase 3a deliverable — single source of truth for all architectural decisions", version line ("Version 1.0 — 2026-05-05"), status line ("LIVING — amendment via DL entry"). Include a table of contents listing §1–§21 (placeholder anchors; fill as sections land).

- [ ] **Step 2: Verify cross-references** — Confirm every cited DL number actually exists in `decision-log.md` and the one-line summary matches the DL entry's "Decision:" line.

- [ ] **Step 3: No-placeholder scan** — `grep -nE 'TBD|TODO|xxx|placeholder' _planning/architecture.md` should return no hits in §1 content.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §1: architecture.md scaffold + executive summary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: §2 Tech Stack — Final Confirmed (with OQ resolutions)

**Files:**
- Modify: `_planning/architecture.md` (append §2)

**Source material:**
- Master Spec §3.1 (canonical tech-stack tables — Frontend / Backend / Infrastructure)
- DL-002 (Tailwind v4 amendment)
- DL-006 (OQ1 — Turborepo on pnpm workspaces)
- DL-007 (OQ2 — Railway-Mumbai)
- DL-008 (OQ8 — no Redis)
- DL-009 (OQ7 — pg-boss + pg_cron)
- DL-018 (OQ6 — tsvector + pg_trgm)
- DL-019 (OQ5 — @react-pdf/renderer)

**Section content outline:**
- Reproduce Master Spec §3.1 tables verbatim (Frontend / Backend / Infrastructure).
- Add one row to Backend table: `pg-boss | latest | Postgres-backed job queue | ✅ FINAL — DL-009`
- Update Backend table row: `Background jobs | pg-boss + pg_cron | DL-009 | ✅ FINAL` (replace earlier "TBD" if shown)
- Update Infrastructure table row: `Backend deployment | Railway (Mumbai region) | DL-007 | ✅ FINAL` (replace earlier "Railway/Render/Fly.io ⚠ TBD")
- Add Infrastructure rows: `Email transport | Resend | DL-011 | ✅ FINAL` and `Search extension | tsvector + pg_trgm (Postgres) | DL-018 | ✅ FINAL` and `PDF library | @react-pdf/renderer | DL-019 | ✅ FINAL` and `Monorepo orchestrator | Turborepo on pnpm workspaces | DL-006 | ✅ FINAL`
- Subsection "What is intentionally NOT in this stack" — explicit rejections from OQ resolutions: no Redis (DL-008), no BullMQ (DL-009), no Inngest (DL-009), no Meilisearch/Typesense (DL-018), no Puppeteer (DL-019), no PWA / IndexedDB / sync engine (DL-020). One-line reason for each.
- Subsection "Reconsider triggers" — table of post-MVP reconsider conditions per DL: Redis if P95 latency >300ms attributable to recurring reads (DL-008); BullMQ if jobs >100/sec sustained (DL-009); Inngest if multi-step durable workflows surface (DL-009); Meilisearch if search latency >100ms or facet-count needs (DL-018); PWA if `network_offline_during_submit` events show real lost work (DL-020).

- [ ] **Step 1: Draft §2** — Append §2 to `_planning/architecture.md` per outline above. Use Master Spec §3.1's column headers verbatim for table consistency.

- [ ] **Step 2: Verify against Master Spec** — Read Master Spec §3.1 line-by-line and confirm every FINAL row from §3.1 is reflected in §2 of architecture.md, with TBD rows replaced by the resolved OQ entries.

- [ ] **Step 3: Verify reconsider triggers** — For each "Reconsider trigger" row, check the cited DL has the same trigger language. Fix mismatches in the DL or the doc — they must agree.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §2: tech stack with OQ resolutions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: §3 Monorepo Structure & Deployment Topology

**Files:**
- Modify: `_planning/architecture.md` (append §3)

**Source material:**
- DL-006 (Turborepo on pnpm workspaces)
- DL-007 (Railway-Mumbai + implicit Supabase ap-south-1 commitment)
- Master Spec §3.2 ("Monorepo. Shared TypeScript types in `packages/shared`. Frontend in `apps/web`, backend in `apps/api`.")
- Master Spec §3.1 (Vercel FINAL frontend deployment; Supabase FINAL DB)
- DL-009 (pg-boss worker is a separate Railway service sibling to apps/api)

**Section content outline:**
- Subsection "Monorepo layout" — directory tree:
  ```
  /
    apps/
      web/         (React + Vite + TS frontend, deploys to Vercel)
      api/         (Express + TS backend, deploys to Railway)
      worker/      (pg-boss worker process, deploys to Railway as separate service)
    packages/
      shared/      (TS types + Zod schemas + shared business constants)
    mockups/       (Phase 2c-scoped Vite harness — visual specification, NOT production code per DL-005)
    _planning/
    docs/
    DESIGN.md
    CLAUDE.md
    decision-log.md
    turbo.json
    pnpm-workspace.yaml
    package.json
  ```
- Subsection "Turborepo task graph" — list pipeline tasks: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`. For each, show inputs/outputs/dependencies (e.g., `build` depends on `^build` to build dependencies first; `test` depends on `build`). Show `turbo.json` skeleton (~30 lines) as a code block.
- Subsection "pnpm workspace setup" — show `pnpm-workspace.yaml` (3 lines: `apps/*`, `packages/*`, `mockups`).
- Subsection "Deployment topology" — diagram (Mermaid) of the three deploy targets:
  - Vercel ← `apps/web` (frontend)
  - Railway service "api" (Mumbai) ← `apps/api` (Express)
  - Railway service "worker" (Mumbai) ← `apps/worker` (pg-boss consumer)
  - Supabase project (ap-south-1 Mumbai) ← all three connect here
- Subsection "Bootstrap obligations for Phase 4 Epic 1" — checklist:
  - [ ] Create Supabase project in `ap-south-1` (Mumbai) region — NOT default us-east-1
  - [ ] Create Vercel project linked to `apps/web`
  - [ ] Create Railway "api" service in Mumbai region linked to `apps/api`
  - [ ] Create Railway "worker" service in Mumbai region linked to `apps/worker`
  - [ ] Wire env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (api + worker), SUPABASE_ANON_KEY (web), RESEND_API_KEY (worker), DATABASE_URL (api + worker for direct Postgres + pg-boss)
- Subsection "Remote cache enablement criterion" — only enable Turborepo Remote Cache once GitHub Actions CI minutes become a measurable cost (deferred default per DL-006).

- [ ] **Step 1: Draft §3** — Append §3 per outline above. Include the Mermaid deployment-topology diagram inline.

- [ ] **Step 2: Verify region commitment** — Confirm the bootstrap-obligation checklist includes `ap-south-1 / Mumbai` for Supabase explicitly. This is the implicit downstream commitment from DL-007 — easy to miss.

- [ ] **Step 3: Verify against DL-009** — `apps/worker` as a separate Railway service must match DL-009's "worker process subscribes to pg-boss queues" + "API process produces jobs."

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §3: monorepo + deployment topology

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: §4 Multi-Tenancy Implementation

**Files:**
- Modify: `_planning/architecture.md` (append §4)

**Source material:**
- DL-012 (`brandedDb` Drizzle factory)
- DL-014 (RLS canonical 2-policy template + per-epic authoring + CI lint)
- DL-015 (`brandScopedTable` Drizzle helper consolidating DL-012 + DL-014 + DL-015)
- Master Spec §3.2 (Single-tenant now multi-tenant ready; brand_id index every table)
- Master Spec §7.2 (Database rules — brand_id filter mandatory)
- DESIGN.md §3 (Multi-tenancy / tenant slot — read for UI-side coupling: tenant theme accent slot)

**Section content outline:**
- Subsection "Three-layer enforcement model":
  - Layer 1 (application primary): `brandedDb` wrapper around Drizzle — mechanically scopes every query. (DL-012)
  - Layer 2 (database backstop): RLS policies — protect against direct DB access bypass. (DL-014)
  - Layer 3 (declaration): `brandScopedTable` helper — emits the brand_id column + index + RLS pair in one declaration. (DL-015)
- Subsection "`brandedDb` factory specification":
  - API: `const db = brandedDb(brandId)` returns Drizzle-shape interface
  - Behavior on org-scoped tables: SELECT auto-filters `brand_id = $brandId`; UPDATE/DELETE auto-filters; INSERT auto-injects `brand_id`
  - Behavior on system tables (declared with plain `pgTable`): unchanged Drizzle
  - Express middleware wiring: extracts `brand_id` from Supabase JWT (`auth.jwt().user_metadata.brand_id`); attaches `req.db = brandedDb(brandId)` and sets Postgres session variable `app.user_id` (for trigger backstop in §7)
  - Service-method signature pattern: `async function someService(db: BrandedDb, ...args)` — db is always first arg
  - Bypass mechanism for migrations / pg-boss worker init: explicit `unscopedDb()` import, reserved use only
- Subsection "RLS canonical 2-policy template":
  - Show the SQL block from DL-014 verbatim
  - Subsection: how non-org-scoped tables get the service_role-only single policy
- Subsection "`brandScopedTable` helper specification":
  - Show the conceptual usage from DL-015 verbatim
  - Composite-index option syntax: `{ indexes: { brandLocation: ['brand_id', 'location_id'] } }`
  - Audit-trigger opt-in flag for the 4 critical tables (DL-013 cross-ref)
- Subsection "Tenant theme integration with DESIGN.md §3" — the brand record carries an accent-color tuple consumed by the frontend tenant slot mechanism in DESIGN.md §3.3. Schema reference: `brands.accent_primary` + `brands.accent_secondary` (hex columns). Frontend reads via `useTenantTheme()` hook (specified in §10 real-time / §17 REST). Cross-reference DESIGN.md §3.
- Subsection "Multi-tenant SaaS migration path (post-MVP)" — single-line summary: today, JWT carries one fixed `brand_id` (single-tenant deployment); post-MVP, JWT carries the tenant binding from auth flow, application code unchanged. (Master Spec §1.2)

- [ ] **Step 1: Draft §4** — Append §4 per outline above.

- [ ] **Step 2: Verify three-layer model coherence** — Each of `brandedDb` (Layer 1), RLS (Layer 2), and `brandScopedTable` (Layer 3) must reference its DL entry. Confirm Layer 1 + Layer 2 + Layer 3 together honor Master Spec §3.2's "RLS = Defence-in-depth, not primary enforcement" — Layer 1 is primary, Layer 2 is backstop, Layer 3 is the declaration that wires both.

- [ ] **Step 3: Verify DESIGN.md cross-reference** — Open DESIGN.md §3 and confirm the tenant slot mechanism actually maps to a brand-record column (or note in the architecture doc what the bridge looks like if DESIGN.md leaves it abstract).

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §4: multi-tenancy implementation (3-layer model)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: §5 Database & Schema Conventions

**Files:**
- Modify: `_planning/architecture.md` (append §5)

**Source material:**
- Master Spec §3.2 (Drizzle modular schema files; ORM rationale)
- Master Spec §6.5 (Compliance placeholder field convention — nullable, [PLACEHOLDER] tag)
- Master Spec §7.2 (Database rules — brand_id index, no raw SQL, RLS enabled)
- DL-015 (`brandScopedTable` helper)
- DL-013 (audit_log schema sketch)

**Section content outline:**
- Subsection "Schema file organization" — Drizzle schema files modular per domain in `apps/api/src/db/schema/`:
  ```
  schema/
    auth.ts            (users, roles, sessions)
    org.ts             (brands, clusters, locations, departments)
    inventory.ts       (items, batches, stock_levels, enablement_matrix)
    procurement.ts     (vendors, purchase_orders, goods_receipts)
    recipes.ts         (recipes, recipe_versions, recipe_lines)
    production.ts      (production_orders, production_outputs)
    dispatch.ts        (challans, challan_lines)
    pos.ts             (pos_locations, pos_sales, pos_imports)
    accounting.ts      (chart_of_accounts, journal_entries, journal_lines)
    hrm.ts             (employees, attendance, shifts)
    audit.ts           (audit_log)
    notifications.ts   (notifications, notification_type_config)
    approvals.ts       (approval_requests, approval_actions)
    files.ts           (file_attachments)
    index.ts           (re-exports for the brandedDb wrapper to discover org-scoped tables)
  ```
- Subsection "Naming conventions" — table names plural snake_case (`purchase_orders`); column names snake_case (`vendor_id`, `created_at`); enum types end `_enum` (`po_status_enum`); FK columns `{referenced_table_singular}_id` (`vendor_id`, `cluster_id`).
- Subsection "Standard columns on every table" — `id uuid pk default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `created_by uuid fk users.id`, `updated_by uuid fk users.id`. For org-scoped tables (via `brandScopedTable`), additionally `brand_id uuid not null fk brands.id` (cascade RESTRICT).
- Subsection "Compliance placeholder field convention" — reproduce Master Spec §6.5 verbatim. Reinforce: nullable always, `[PLACEHOLDER]` tag in Drizzle schema comment, never create a duplicate field in v2.
- Subsection "TRN columns" — every transactional table carries `trn varchar(40) not null unique` per Master Spec §6.2 format. Generation via `accountingService.getTRN(type, locationCode)` (Master Spec §8.4) inside the same transaction as the row insert.
- Subsection "Migration discipline":
  - Migrations in `apps/api/src/db/migrations/` (Drizzle's filesystem migration store)
  - One migration per logical change (table create / column add / index add / RLS policy add)
  - Every CREATE TABLE migration must include the canonical RLS policy block (CI lint enforces — see §20)
  - `brandScopedTable` declarations auto-include the RLS pair; manual `pgTable` declarations for system tables author RLS manually
- Subsection "Forbidden patterns" — bullet list mirroring Master Spec §7.9 database rows: no `any` types, no raw SQL strings, no missing brand_id filter, no NOT NULL on placeholder fields, no duplicate v2 fields.

- [ ] **Step 1: Draft §5** — Append §5 per outline above.

- [ ] **Step 2: Verify Master Spec §6.5 reproduction** — The placeholder field convention must be quoted accurately (compliance fields are nullable, never NOT NULL, no duplicate columns).

- [ ] **Step 3: Verify schema file list completeness** — Cross-check that every Master Spec §10 epic + Epic 3 INF tables (audit_log, notifications, approvals) has a schema file listed. Add any missing ones.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §5: database & schema conventions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: §6 Service Layer Architecture

**Files:**
- Modify: `_planning/architecture.md` (append §6)

**Source material:**
- Master Spec §8 (entire section — 8.1 inventory, 8.2 approval engine, 8.3 notification center, 8.4 accounting service)
- Master Spec §7.3 (Business logic rules — enablement check, approval routing, recipe roll-up)
- Master Spec §7.5 (API rules — error envelope, REST conventions)
- DL-001 (Production Order 5-status — deductStock fires at In Progress)
- DL-008 (recipe_cost_snapshot materialization carve-out)
- DL-016 (concurrency patterns — row lock, unique constraint, status-guarded UPDATE)

**Section content outline:**
- Subsection "Service-layer principles":
  - One service module per domain (`inventoryService`, `procurementService`, `recipeService`, `productionService`, `dispatchService`, `accountingService`, `approvalEngine`, `notificationCenter`, `auditLog`).
  - Services receive `brandedDb` (DL-012) as first arg. No service reads `brand_id` from elsewhere.
  - Services compose, do not call HTTP. One service calling another = direct function call inside the same Express request.
  - Mutations are wrapped in transactions; transaction span covers business write + audit_log write + pg-boss enqueue.
- Subsection "Refined Master Spec §8 contracts" — for each contract, reproduce the signature from Master Spec §8 verbatim, plus add Phase-3a refinements:
  - **§8.1 inventoryService.deductStock**: add the row-lock pattern from DL-016 ("`SELECT ... FOR UPDATE` on stock-batch rows inside the transaction; FEFO selection happens inside the lock; throws InsufficientStockError on rollback"). Add: invocation point fixed at Production Order In Progress transition per DL-001.
  - **§8.1 inventoryService.checkEnablement**: clarify it's a pure read; no transaction needed; cached for the duration of a single request via `brandedDb`'s request-scope.
  - **§8.1 inventoryService.transferStock**: clarify product type flow rules + cluster boundary rules enforced at this contract (FR-cited per PRD).
  - **§8.2 approvalEngine**: add status-guarded UPDATE pattern from DL-016 for idempotency on approve/reject actions. Add: approval routing matrix configured per-entity-type via `approval_matrix` table; Notification Center notified on state transitions.
  - **§8.3 notificationCenter.send / sendBulk**: add the data-driven dispatch model from DL-011 — payload includes `type` field; type determines in-app/immediate-email/digest behavior via `notification_type_config`. send returns immediately; pg-boss handles async work.
  - **§8.4 accountingService.createJournalEntry**: clarify trigger event = source transaction status change to "confirmed" per Master Spec §7.6. Validate balanced (debits === credits) before write. Atomic with source mutation.
  - **§8.4 accountingService.getTRN**: clarify atomic increment via Postgres `RETURNING` clause + sequence per (type × location × year).
- Subsection "Service catalogue (new services beyond Master Spec §8)":
  - **`recipeService`** — `recomputeCost(recipeId)`: refreshes `recipe_cost_snapshot` row per DL-008 carve-out. Triggered by yield-factor write or ingredient-price write via pg-boss event.
  - **`exportService`** — `generateExport(format, dateRange, type)`: Tally / Zoho Books / Generic CSV per FR96 + OQ10 column-mapping spec (Task 23). Runs on pg-boss worker; output to Supabase Storage.
  - **`auditLog.record`** — already specified in §7 (Audit Trail Architecture); cross-reference.
- Subsection "Service file location" — `apps/api/src/services/{domain}.service.ts`. Each service exports an object with named methods (not class instances) — easier to mock in tests, easier to tree-shake.
- Subsection "Error model" — services throw typed errors (`InsufficientStockError`, `EnablementViolationError`, `ApprovalConflictError`, `ValidationError`, `BusinessRuleViolationError`). Express middleware (specified in §17) maps thrown errors to the standard error envelope per Master Spec §7.5.

- [ ] **Step 1: Draft §6** — Append §6 per outline above. Include all method signatures from Master Spec §8 verbatim, with Phase-3a refinements clearly tagged ("Refinement: ...").

- [ ] **Step 2: Verify against Master Spec §8** — Every signature in §8 must appear in §6 of architecture.md unchanged (Phase 3a refinements are additions, not signature changes — if a signature change is genuinely needed, that's a Master Spec amendment requiring a new DL entry).

- [ ] **Step 3: Verify DL-001 invocation point** — Confirm `deductStock` documentation explicitly states "fires at Production Order In Progress transition, never earlier" per DL-001. This is the most-cited contract in the spec; precision matters.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §6: service layer architecture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: §7 Audit Trail Architecture

**Files:**
- Modify: `_planning/architecture.md` (append §7)

**Source material:**
- DL-013 (audit trail mechanism — application primary + 4-table trigger backstop)
- DL-012 (`brandedDb` middleware sets `app.user_id` Postgres session variable for trigger backstop to read)
- PRD FR20, FR21 (audit FRs — read for exact wording)
- Screen Inventory CC-AUDIT-LINK pattern entry (read §3 of `_planning/05-screen-inventory.md`)

**Section content outline:**
- Subsection "Two-layer audit model" — application-layer primary (`auditLog.record(...)` in service methods, captures business reason); trigger backstop on 4 critical tables (`users`, `enablement_matrix`, `recipes`, `chart_of_accounts`).
- Subsection "audit_log schema" — reproduce from DL-013 verbatim:
  ```
  audit_log (
    id uuid pk, brand_id uuid fk, occurred_at timestamptz,
    actor_user_id uuid, table_name text, row_id text,
    action text,         -- 'insert' | 'update' | 'delete' | 'business_action'
    changed_fields jsonb,
    before jsonb, after jsonb,
    reason text,         -- application-layer only; null from trigger
    trn_reference text,
    context jsonb
  )
  ```
- Subsection "Application-layer pattern" — code shape:
  ```typescript
  // Inside a service method, after the mutation
  await auditLog.record(db, {
    action: 'update',
    tableName: 'purchase_orders',
    rowId: poId,
    before: oldRow,
    after: newRow,
    changedFields: diffKeys,
    reason: input.reason,            // human-supplied
    trnReference: oldRow.trn,
    context: { screen: 'PUR-004', source: 'approval_action' },
  });
  ```
- Subsection "Trigger backstop pattern" — show plpgsql trigger template:
  ```sql
  CREATE OR REPLACE FUNCTION audit_critical_table_trigger() RETURNS trigger AS $$
  BEGIN
    INSERT INTO audit_log (
      brand_id, occurred_at, actor_user_id, table_name, row_id,
      action, before, after, reason
    ) VALUES (
      COALESCE(NEW.brand_id, OLD.brand_id), now(),
      current_setting('app.user_id', true)::uuid,
      TG_TABLE_NAME, COALESCE(NEW.id, OLD.id)::text,
      TG_OP::text, to_jsonb(OLD), to_jsonb(NEW), null
    );
    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;
  ```
  Apply via `CREATE TRIGGER audit_users_trigger AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_critical_table_trigger();` (and same for the other 3 tables).
- Subsection "Reason field discipline" — for "business_action" actions (override price, manual adjustment, force-close production order), `reason` is required (validated at service-method input). For routine CRUD, `reason` is optional. Document the list of "reason-required" actions in the catalogue subsection.
- Subsection "Reason-required action catalogue" — table of (action, screen, why-required). Examples: override price (PUR-* line item), manual stock adjustment (INV-*), force-close production order (PRO-*). Source: read PRD for FR-tagged "with reason" workflows.
- Subsection "CC-AUDIT-LINK consumer pattern" — the screen pattern from `_planning/05-screen-inventory.md` §3 reads `audit_log` rows scoped to the entity (`WHERE table_name = $entity AND row_id = $id`) and renders the audit timeline. Standard component: `<AuditTimeline tableName entityId />`. Spec the props interface.

- [ ] **Step 1: Draft §7** — Append §7 per outline above.

- [ ] **Step 2: Verify DL-013 schema match** — `audit_log` schema in §7 must exactly match DL-013's "Schema sketch:". Any divergence = update both to agree.

- [ ] **Step 3: Verify reason-required catalogue** — Read PRD; grep for "with reason" / "reason required" / "manual override". List every match. Add any missing rows to the catalogue.

- [ ] **Step 4: Verify CC-AUDIT-LINK cross-ref** — Open `_planning/05-screen-inventory.md` §3, find the CC-AUDIT-LINK entry, confirm the consumer-pattern subsection here matches its description.

- [ ] **Step 5: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §7: audit trail architecture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: §8 Concurrency & Idempotency Patterns

**Files:**
- Modify: `_planning/architecture.md` (append §8)

**Source material:**
- DL-016 (three patterns: row lock for deductStock; unique constraint for IRN paste; status-guarded UPDATE for approval)
- DL-001 (Production Order 5-status — In Progress is the deductStock invocation point)
- Master Spec §8.1 (deductStock contract — FEFO ordering)
- Master Spec §6.5 (IRN placeholder field)

**Section content outline:**
- Subsection "Pattern 1: Row-lock for stock deduction":
  - Use case: `inventoryService.deductStock` (DL-001 In Progress transition)
  - Mechanism: `SELECT ... FROM stock_batches WHERE item_id = $i AND department_id = $d FOR UPDATE ORDER BY expiry_date` inside transaction; FEFO selection from locked rows; UPDATE batches; INSERT journal_entry; INSERT audit_log; COMMIT
  - Code shape (TypeScript-pseudo):
    ```typescript
    await db.transaction(async (tx) => {
      const batches = await tx.select().from(stockBatches)
        .where(/* item, dept, qty available */)
        .orderBy(stockBatches.expiryDate)
        .for('update');
      // FEFO deduct
      // write journal entry
      // record audit
    });
    ```
  - Why row lock not advisory lock: DL-016 rationale (data-scoped vs convention-managed)
- Subsection "Pattern 2: Unique constraint for paste-style idempotency":
  - Use case: IRN paste in DSP-010 (Master Spec §6.5)
  - Mechanism: unique constraint `(brand_id, irn)` on the receiving table; INSERT/UPDATE with ON CONFLICT DO NOTHING; UI surfaces "already attached" state
  - Generalization: any user-pasted external identifier (future: e-way bill number, IRN cancel reason, transporter ID) follows this pattern
- Subsection "Pattern 3: Status-guarded UPDATE for state-transition idempotency":
  - Use case: PO approval (PUR-004), and every approval-engine state transition
  - Mechanism: `UPDATE entity SET status = $new WHERE id = $id AND status = $expected_old AND brand_id = $brand RETURNING *`. Zero rows affected = transition already happened (or never valid); return current state from a follow-up SELECT.
  - Code shape:
    ```typescript
    const updated = await db.update(purchaseOrders)
      .set({ status: 'approved', approvedAt: new Date(), approvedBy: userId })
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.status, 'pending'),
      ))
      .returning();
    if (updated.length === 0) {
      const current = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
      return { alreadyTransitioned: true, current: current[0] };
    }
    ```
  - Generalization: this is the canonical pattern for ANY state-machine transition in the system. Document a `transitionStatus(table, id, fromStatus, toStatus, otherFields)` helper signature; recommend per-domain wrappers in service modules.
- Subsection "Transaction discipline":
  - Every mutation that touches >1 table runs in a transaction.
  - Transaction span includes: business write + audit_log write + pg-boss enqueue (pg-boss client supports transactional enqueue per DL-009).
  - Rule: if a side effect must NOT fire when the business write rolls back, the side effect goes through pg-boss inside the same transaction.

- [ ] **Step 1: Draft §8** — Append §8 per outline above.

- [ ] **Step 2: Verify DL-016 alignment** — Each of the three patterns in §8 must match the corresponding pattern in DL-016. Any variance: update both to agree.

- [ ] **Step 3: Verify generalization claims** — Subsection "Pattern 3 generalization" claims this is the canonical pattern for ALL state-machine transitions. Cross-check against Master Spec §10 epic features — list any state-machine transitions in the spec (PO status, GR status, production order 5-status, dispatch challan status, approval status). Confirm pattern fits each.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §8: concurrency & idempotency patterns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: §9 Background Jobs & Scheduling

**Files:**
- Modify: `_planning/architecture.md` (append §9)

**Source material:**
- DL-009 (pg-boss + pg_cron; worker as separate Railway service)
- DL-011 (Notification Center email dispatch via pg-boss)
- DL-008 (recipe_cost_snapshot — pg_cron nightly safety-net refresh)
- DL-019 (PDF rendering on pg-boss worker)

**Section content outline:**
- Subsection "Job engine topology" — pg-boss runs as Node module inside `apps/worker` Railway service. API process (`apps/api`) is the producer (enqueues jobs); worker process is the consumer (executes jobs). Both connect to same Supabase Postgres.
- Subsection "Transactional enqueue pattern" — pg-boss `boss.send(name, data, { db: tx })` inside a transaction. Job and business write commit/rollback atomically. Show code shape:
  ```typescript
  await db.transaction(async (tx) => {
    // business write
    await boss.send('send_email', { to, template, data }, { db: tx });
  });
  ```
- Subsection "Job catalogue (MVP)" — table:
  | Job name | Producer | Consumer | Trigger |
  |---|---|---|---|
  | `send_email` | notificationCenter, exportService (notify-when-ready) | worker | Notification Center type config (DL-011) |
  | `render_pdf` | dispatch / accounting export endpoints | worker | User clicks "Download PDF" or batch-print |
  | `generate_export` | exportService (FR96) | worker | User clicks "Generate Tally export" / scheduled |
  | `recompute_recipe_cost` | recipeService (yield-factor or price write) | worker | DL-008 event-driven refresh |
  | `pos_sales_import` | scheduled (pg-boss cron) | worker | FR84 daily POS sync |
  | `approval_escalate` | approvalEngine (timer-driven) | worker | Approval timeout per Epic 3 config |
  | `daily_sales_finalize` | scheduled (pg-boss cron) | worker | End-of-day per POS location |
  | `low_stock_digest` | scheduled (pg-boss cron) | worker | Daily aggregation |
  | `notification_digest` | scheduled (pg-boss cron) | worker | Per-user daily digest aggregation (DL-011) |
- Subsection "pg_cron complement (DB-only scheduled tasks)" — pg_cron jobs configured via Supabase:
  | Cron schedule | Job |
  |---|---|
  | `0 2 * * *` (daily 02:00 IST) | `REFRESH MATERIALIZED VIEW recipe_cost_snapshot` (DL-008 backstop) |
  | `0 3 * * 0` (weekly Sunday 03:00 IST) | `DELETE FROM audit_log WHERE created_at < now() - interval '180 days'` |
  | `*/15 * * * *` (every 15min) | Health check function — surfaces in integration dashboard |
- Subsection "Retry & dead-letter policy" — pg-boss config: 3 retries with exponential backoff (1s, 5s, 30s); failed-after-retries jobs land in `pgboss.archive` for ops review; integration dashboard (FR98) surfaces failed-job count.
- Subsection "Worker observability" — log aggregation via Sentry (Master Spec §3.1 FINAL); job-level success/failure metrics surfaced in admin operations dashboard (polling endpoint per DL-010).

- [ ] **Step 1: Draft §9** — Append §9 per outline above.

- [ ] **Step 2: Verify job catalogue completeness** — Cross-reference every "background work" mentioned in PRD FRs (FR19 notifications, FR84 POS sync, FR96 exports, FR67 retrospective recipe cost adjust, etc.). Add any missing jobs to the catalogue.

- [ ] **Step 3: Verify pg_cron schedule sensible** — IST (UTC+5:30) is operating-hours timezone for India ops; 02:00 / 03:00 IST = lowest load window. Confirm the pg_cron schedules use UTC syntax with IST offset documented.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §9: background jobs & scheduling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Session A close — checkpoint commit + (optional) intermediate PR

**Files:**
- No new content; this is a session-boundary checkpoint.

- [ ] **Step 1: Verify §1–§9 land complete** — Read `_planning/architecture.md` end-to-end. Every section has content; no placeholders; cross-references resolve.

- [ ] **Step 2: Run a `grep` sweep for placeholders**
```bash
grep -nE 'TBD|TODO|xxx|FIXME|placeholder|fill in' _planning/architecture.md
```
Expected: returns only legitimate uses (e.g., the Master Spec §6.5 "PLACEHOLDER" tag for compliance fields). Fix any drafting placeholders.

- [ ] **Step 3: Run a `grep` sweep for DL references** — Confirm every DL reference cited in §1–§9 actually exists.
```bash
for dl in 001 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020; do
  grep -q "DL-$dl" _planning/architecture.md && echo "DL-$dl ✓" || echo "DL-$dl ✗ NOT cited"
done
```
At end of Session A, expect the foundation DLs (001, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 015, 016) to all be cited. The remainder come in Session B.

- [ ] **Step 4: Optional intermediate PR** — If Session A is shipping at a clear checkpoint and the user wants partial review, open a PR with title "Phase 3a Session A: architecture.md §1–§9". Body summarizes which DL entries land. Do NOT mark Phase 3a complete (Phase Roadmap update lands in Task 30).

---

## Task 11: §10 Real-Time Subscriptions

**Files:**
- Modify: `_planning/architecture.md` (append §10)

**Source material:**
- DL-010 (5 Realtime channels + polling endpoints + on-demand refresh patterns)
- Master Spec §3.1 (Supabase Realtime FINAL)
- Phase Roadmap re-sequencing rationale §3 (dashboards explicitly NOT Realtime — visible refresh button + last-updated stamp)

**Section content outline:**
- Subsection "Channel catalogue" — reproduce table from DL-010:
  | # | Channel | Filter | Why Realtime |
  | 1 | `approval_requests` | `WHERE approver_id = me` | … |
  | (etc., all 5 channels) |
- Subsection "`useRealtimeChannel` hook spec":
  - Signature: `useRealtimeChannel<T>(channelName: string, filter: RealtimeFilter, queryKey: QueryKey): void`
  - Behavior: subscribes to Supabase Realtime channel on mount, calls `queryClient.invalidateQueries(queryKey)` on each event, cleans up on unmount
  - Pattern: paired with a `useQuery(queryKey, fetcher)` so the same data path serves initial load (REST) and live updates (Realtime invalidates Query cache, which re-fetches via REST)
  - Show code shape (~20 lines)
- Subsection "Polling endpoints" — reproduce list from DL-010 (POS sync 60s, integration dashboard 30s, job queue depth 10s). Configured via TanStack Query `refetchInterval` option.
- Subsection "On-demand refresh pattern":
  - All dashboards/reports: visible "Refresh" button + "Last updated: HH:MM" timestamp.
  - Implementation: `useQuery({ queryKey, refetchOnWindowFocus: false, refetchOnMount: false, staleTime: Infinity })` — explicit refresh only.
  - Reload UI affordance: `<RefreshButton onClick={refetch} lastFetched={dataUpdatedAt} />` reusable component (cross-reference Phase 2c-scoped foundation chrome — this is part of the SI-RPT-002 dashboard pattern).
- Subsection "Optimistic UI pattern":
  - Form submission with low contention: `useMutation({ onMutate, onError: rollback, onSuccess })` standard TanStack Query pattern.
  - Show code shape for "approve PO" optimistic mutation: cache-write the approved status; if mutation fails, rollback.
- Subsection "What is explicitly NOT Realtime" — bullet list from DL-010: dashboards, reports, inventory levels, master data. Reason: avoid quota burn + UX doesn't need push.

- [ ] **Step 1: Draft §10** — Append §10 per outline above.

- [ ] **Step 2: Verify channel filter syntax** — Supabase Realtime filter syntax (e.g., `approver_id=eq.${userId}`) — confirm the actual filter strings in §10 use the correct Supabase Realtime syntax. Reference Supabase docs for the exact format if uncertain.

- [ ] **Step 3: Verify "explicitly NOT Realtime" matches Phase Roadmap §3 rationale** — The rationale calls out dashboards specifically; confirm §10's exclusion list aligns.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §10: real-time subscriptions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: §11 Notification Center

**Files:**
- Modify: `_planning/architecture.md` (append §11)

**Source material:**
- DL-011 (Notification Center transport + dispatch — Resend + pg-boss + data-driven)
- DL-010 channel #2 (in-app inbox = `notifications` table read side)
- Master Spec §8.3 (`notificationCenter.send` / `sendBulk` contracts)
- PRD FR19 (Notification & Alert Center capability)

**Section content outline:**
- Subsection "Three-channel model" — in-app (write to `notifications` → Realtime push), email (Resend via pg-boss), no SMS/WhatsApp/push in MVP.
- Subsection "`notification_type_config` table" — schema:
  ```
  notification_type_config (
    type text pk,             -- 'po_approved', 'low_stock', etc.
    in_app boolean,
    email_mode text,          -- 'none' | 'immediate' | 'digest'
    digest_window text,       -- 'daily' | 'weekly' | null if not digest
    template_key text,        -- React Email template identifier
    description text          -- human-readable for ops
  )
  ```
- Subsection "Notification type catalogue (MVP)" — initial seed list. Source: read PRD for every "send notification" / "alert" / "notify" surface. Examples:
  - `po_approved` — in-app + immediate email
  - `po_rejected` — in-app + immediate email
  - `gr_received` — in-app only
  - `low_stock_alert` — in-app + digest (daily)
  - `production_order_overdue` — in-app + immediate email
  - `dispatch_acknowledged` — in-app only
  - `approval_pending_for_you` — in-app + digest (daily) for managers; in-app + immediate for high-priority
  - `recipe_cost_changed_significantly` — in-app + digest (weekly)
  - `pos_sales_sync_failed` — in-app + immediate email
  - `export_ready_for_download` — in-app + immediate email
  - `approval_escalated` — in-app + immediate email
  (Continue list — comprehensive draft, can be augmented per epic during Phase 4.)
- Subsection "Send pipeline":
  1. Service calls `notificationCenter.send({ type, userId, data, brand })` inside transaction
  2. Center reads `notification_type_config` to determine channels
  3. If `in_app`: INSERT into `notifications` table (Realtime channel #2 picks up automatically — DL-010)
  4. If `email_mode = 'immediate'`: enqueue `send_email` pg-boss job inside same transaction (DL-009)
  5. If `email_mode = 'digest'`: INSERT into `notifications` with `digest_eligible: true`; pg_cron daily/weekly job aggregates
  6. Transaction commits → Realtime fires → email worker picks up → email lands
- Subsection "Resend configuration":
  - From-address: `noreply@{brand.domain}` (per-brand sender via Resend domain feature)
  - React Email templates in `apps/worker/src/email-templates/{templateKey}.tsx`
  - DESIGN.md tokens (Inter font, accent colors) referenced in templates via plain CSS objects
- Subsection "Per-user notification preferences" — `notification_preferences (user_id, type, in_app, email)` table for opt-out/opt-in overrides per user. Defaults from `notification_type_config`. Settings screen (Epic 3 INF or Epic 2 USR) lets users edit.

- [ ] **Step 1: Draft §11** — Append §11 per outline above.

- [ ] **Step 2: Verify type catalogue completeness** — `grep -niE 'notif|alert|notify' _planning/03-prd.md` and confirm every match has a corresponding `notification_type_config` row in §11. Add missing.

- [ ] **Step 3: Verify Master Spec §8.3 contract preservation** — `notificationCenter.send` signature in §11 must match Master Spec §8.3. Phase-3a refinements clarify *behavior* (channels, dispatch model) — not signature.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §11: notification center

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: §12 Caching Strategy

**Files:**
- Modify: `_planning/architecture.md` (append §12)

**Source material:**
- DL-008 (no Redis in MVP; TanStack Query + Postgres only; recipe_cost_snapshot carve-out)
- Master Spec §3.1 (TanStack Query FINAL)
- Master Spec §2.5 (yield factors / recipe cost cascade)

**Section content outline:**
- Subsection "Two-layer cache model":
  - Client side: TanStack Query (`staleTime`, `cacheTime`, `refetchOnWindowFocus` defaults)
  - Server side: Postgres shared buffer cache (managed by Postgres) + indexed reads on `brand_id`-scoped tables
- Subsection "Standard TanStack Query defaults" — recommended app-wide config: `staleTime: 30_000`, `cacheTime: 5 * 60_000`, `refetchOnWindowFocus: true`, `retry: 2`, `retryDelay: exponential`. Per-query overrides for slow-changing master data: `staleTime: Infinity`, `refetchOnWindowFocus: false`, manual invalidation only.
- Subsection "Recipe cost snapshot carve-out":
  - Materialized table: `recipe_cost_snapshot (recipe_id pk, version_id, brand_id, computed_cost decimal, last_computed_at, source_yield_factors jsonb, source_ingredient_prices jsonb)`
  - Refresh trigger: `recipeService.recomputeCost(recipeId)` enqueued as pg-boss job on yield-factor write OR ingredient-price write OR sub-recipe cost change
  - Read path: `recipeService.getCost(recipeId)` reads from `recipe_cost_snapshot`; if missing or stale (`last_computed_at` older than threshold), trigger immediate recompute synchronously and return result.
  - Backstop: pg_cron nightly `REFRESH MATERIALIZED VIEW recipe_cost_snapshot` (catches drift if any event-driven refresh failed)
- Subsection "Reconsider trigger" — reproduce DL-008's reconsider trigger: P95 API latency >300ms attributable to recurring read patterns → evaluate Upstash Redis. Until then, no Redis.
- Subsection "Anti-patterns" — bullet list:
  - Don't add Redis "just in case" — invalidation discipline is a security risk per DL-008.
  - Don't memoize at the service-method level using in-process cache — survives restart only on the same instance (Railway can scale to multiple instances).
  - Don't query `recipe_cost_snapshot` and the source tables in the same request — choose one (cached vs live) per call site.

- [ ] **Step 1: Draft §12** — Append §12 per outline above.

- [ ] **Step 2: Verify DL-008 reconsider trigger language** — Match exactly.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §12: caching strategy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: §13 File Storage

**Files:**
- Modify: `_planning/architecture.md` (append §13)

**Source material:**
- DL-017 (per-brand bucket; Express signed URL flow)
- PRD FR39 (vendor docs), FR81 (production batch photos)
- Master Spec §3.1 (Supabase Storage FINAL)
- Master Spec §3.2 (Business logic in Express only)

**Section content outline:**
- Subsection "Bucket layout" — per-brand bucket `brand-${brand_slug}`; path structure `${entityType}/${entityId}/${filename}`. Reproduce examples from DL-017.
- Subsection "Bucket provisioning" — Phase 4 Epic 1 setup creates `brand-demofb` bucket for the seed brand (`demofb` slug per `_planning/02-master-spec.md` §12 seed data). Future brands provision bucket on brand-create event (post-MVP multi-tenant SaaS).
- Subsection "Upload flow" — sequence:
  1. Browser calls `POST /api/v1/files/upload-intent` with `{ entityType, entityId, filename, contentType, sizeBytes }`
  2. Express validates: user has write access to entityType+entityId; sizeBytes ≤ 25MB (raise as needed per file type); contentType in allowlist per entity type
  3. Express calls Supabase Storage `createSignedUploadUrl(path, { expiresIn: 300 })` → returns signed URL
  4. Express records `file_attachments` row (`id, brand_id, entity_type, entity_id, path, original_filename, content_type, size_bytes, uploaded_by, uploaded_at = null`)
  5. Express returns `{ uploadUrl, attachmentId }`
  6. Browser PUTs file directly to signed URL
  7. Browser POSTs `PATCH /api/v1/files/{attachmentId}/confirm` once upload completes
  8. Express updates `file_attachments.uploaded_at`; logs audit event
- Subsection "Read flow" — `GET /api/v1/files/{attachmentId}/download-url` → Express checks user has read access → calls Supabase Storage `createSignedUrl(path, { expiresIn: 300 })` → returns to browser → browser GETs file
- Subsection "MIME / size allowlist per entity type" — table:
  | entity_type | Allowed MIME | Max size |
  |---|---|---|
  | `vendor_doc` | application/pdf, image/jpeg, image/png | 10 MB |
  | `production_photo` | image/jpeg, image/png | 5 MB |
  | `accountant_export` | text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | 25 MB |
  | `issue_attachment` | image/*, application/pdf | 5 MB |
  | (extend per epic as new file-bearing entities surface) |
- Subsection "Deletion policy" — `DELETE /api/v1/files/{attachmentId}` removes both the storage object and the `file_attachments` row, audit-logged. No "soft delete" of files — explicit hard delete with audit trail.

- [ ] **Step 1: Draft §13** — Append §13 per outline above.

- [ ] **Step 2: Verify file_attachments schema includes all needed columns** — Cross-check against PRD FR39 (vendor docs need original-filename retention) and FR81 (production photos need entity link).

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §13: file storage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: §14 Search Strategy

**Files:**
- Modify: `_planning/architecture.md` (append §14)

**Source material:**
- DL-018 (tsvector + pg_trgm)

**Section content outline:**
- Subsection "Searchable entities" — list from DL-018: items, vendors, recipes, customers, transactions (TRN lookup).
- Subsection "tsvector pattern" — code:
  ```sql
  ALTER TABLE items ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(sku, '')
      )
    ) STORED;
  CREATE INDEX idx_items_search ON items USING GIN(search_vector);
  ```
- Subsection "pg_trgm fuzzy fallback" — code:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_items_name_trgm ON items USING GIN(name gin_trgm_ops);
  -- Query: SELECT * FROM items WHERE name % 'tomate' ORDER BY similarity(name, 'tomate') DESC;
  ```
- Subsection "Combined search query pattern":
  ```sql
  -- Primary tsvector match, ranked by ts_rank
  SELECT *, ts_rank(search_vector, query) AS rank
  FROM items, plainto_tsquery('english', $1) query
  WHERE search_vector @@ query AND brand_id = $2
  UNION ALL
  -- Fuzzy fallback if no primary matches; client merges
  SELECT *, similarity(name, $1) AS rank
  FROM items
  WHERE name % $1 AND brand_id = $2 AND NOT (search_vector @@ plainto_tsquery('english', $1))
  ORDER BY rank DESC LIMIT 50;
  ```
- Subsection "Service contract" — `searchService.search(brandedDb, entityType, queryText, options)` returns `SearchResult<T>[]` with rank score.
- Subsection "Reconsider triggers" — from DL-018: latency >100ms or facet-count needs.

- [ ] **Step 1: Draft §14** — Append §14 per outline above.

- [ ] **Step 2: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §14: search strategy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: §15 PDF Generation

**Files:**
- Modify: `_planning/architecture.md` (append §15)

**Source material:**
- DL-019 (@react-pdf/renderer on pg-boss worker; SVG embed for charts)
- DL-017 (per-brand bucket — PDF output destination)
- DL-009 (pg-boss worker hosts the renderer)

**Section content outline:**
- Subsection "Render pipeline":
  1. API endpoint receives "generate PDF" request (e.g., `POST /api/v1/dispatch-challans/{id}/pdf`)
  2. Express enqueues `render_pdf` pg-boss job with `{ documentType, sourceId, brandId, requestedBy }`
  3. API returns `{ jobId, status: 'queued' }` (or, for fast renders, `{ url }` if synchronous mode chosen for sub-100ms documents)
  4. Worker processes job: fetches source data via `brandedDb`, renders React component to PDF via `@react-pdf/renderer`'s `renderToStream`, uploads to Supabase Storage at `brand-${slug}/exports/${type}/${YYYY-MM-DD}/${id}.pdf`
  5. Worker updates `file_attachments` row (or document-specific table column) with the path
  6. Worker fires `export_ready_for_download` notification (DL-011)
  7. Frontend polls `GET /api/v1/jobs/{jobId}/status` (or receives via Notification Center) → fetches signed download URL via §13 read flow
- Subsection "Document component organization" — `apps/worker/src/pdf-templates/{documentType}.tsx`:
  - `Challan.tsx`, `Invoice.tsx`, `PurchaseOrder.tsx`, `GoodsReceipt.tsx`, `ProductionOrder.tsx`
  - `TrialBalance.tsx`, `ProfitAndLoss.tsx`, `BalanceSheet.tsx`, `CashFlow.tsx`, `DailySalesReport.tsx`
- Subsection "DESIGN.md token reuse" — PDF styles reference DESIGN.md tokens via plain JS objects:
  ```typescript
  const styles = StyleSheet.create({
    header: { fontFamily: 'Inter', fontSize: 24, color: tokens.color.text.primary },
    // ...
  });
  ```
  Inter font registered via `Font.register({ family: 'Inter', src: '/fonts/Inter.ttf' })` at worker init.
- Subsection "Chart embedding" — chart-heavy reports (Food Cost Control Centre PDF):
  1. Render chart server-side using `recharts-to-png` or D3 to SVG string
  2. Embed SVG in PDF via `<Svg>` primitive from @react-pdf/renderer
  Excel is the **primary** path for chart-heavy reports (clearer data interaction); PDF is the **secondary** snapshot path.
- Subsection "Batch generation" — "Print all dispatch challans for today" — single parent pg-boss job that fans out child render jobs; parent waits for all children, then ZIPs the outputs and writes to Storage; user gets one signed URL to the ZIP.

- [ ] **Step 1: Draft §15** — Append §15 per outline above.

- [ ] **Step 2: Verify Inter font registration** — DESIGN.md §3.1 / §5 specifies Inter as canonical font. Ensure §15 references the same font and registers it correctly.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §15: PDF generation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: §16 Resilience & Offline

**Files:**
- Modify: `_planning/architecture.md` (append §16)

**Source material:**
- DL-020 (offline deferred; TanStack Query retry + LocalStorage drafts cover MVP)
- Master Spec §4.1 (Native Mobile Apps deferred)
- `_planning/05-screen-inventory.md` (device-class designations per screen)

**Section content outline:**
- Subsection "Position statement" — quote DL-020 verbatim: offline-first deferred post-MVP; PWA / IndexedDB / sync engine NOT built in MVP.
- Subsection "MVP resilience mechanism 1: TanStack Query retry":
  - Mutation retry config: `retry: 3`, `retryDelay: exponentialBackoffWithJitter`
  - Failure UX: after retries exhausted, surface error toast with "Try again" button that re-runs mutation; data preserved in form
- Subsection "MVP resilience mechanism 2: LocalStorage form-draft auto-save":
  - Hook: `useFormDraft(formKey, formState, options)` — debounce 5s, write to `localStorage[`draft:${formKey}`]`
  - On mount: detect existing draft for same `formKey`; surface "You have an unsaved draft from HH:MM. Restore?" prompt
  - On successful submit: clear draft from LocalStorage
  - Apply to: GR Entry, Recipe authoring, Production Order create, B2B challan create, Vendor onboarding, Recipe versioning
- Subsection "Reconsider trigger" — from DL-020: production telemetry on `network_offline_during_submit` events. Threshold not yet defined; revisit after first 3 months of production usage.
- Subsection "Out of scope (MVP)" — explicitly: no service worker, no IndexedDB sync, no conflict resolution engine, no offline-capable POS workflow (POS is third-party per Master Spec §4 Tier 3).

- [ ] **Step 1: Draft §16** — Append §16 per outline above.

- [ ] **Step 2: Verify form-draft hook coverage** — Cross-check `_planning/05-screen-inventory.md` for "long form" screens (GR Entry, Recipe author, etc.). Add any to the LocalStorage-draft list.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §16: resilience & offline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: §17 REST API Conventions

**Files:**
- Modify: `_planning/architecture.md` (append §17)

**Source material:**
- Master Spec §3.2 (REST not GraphQL; endpoint pattern `/api/v1/{resource}`)
- Master Spec §7.5 (API rules — error envelope, error categories)
- Master Spec §6.2 (TRN format — for TRN-keyed lookup endpoints)
- DL-012 (brandedDb middleware — auth pipeline)
- DL-013 (audit_log — audit middleware)

**Section content outline:**
- Subsection "URL structure":
  - Collection: `/api/v1/{resource}` (e.g., `/api/v1/purchase-orders`)
  - Item: `/api/v1/{resource}/{id}` (e.g., `/api/v1/purchase-orders/uuid-abc`)
  - TRN lookup: `/api/v1/transactions/by-trn/{trn}` (cross-resource lookup by TRN)
  - Sub-resources: `/api/v1/{resource}/{id}/{sub}` (e.g., `/api/v1/purchase-orders/{id}/lines`)
  - Action endpoints: `POST /api/v1/{resource}/{id}/{action}` (e.g., `POST /api/v1/purchase-orders/{id}/approve`) — for state-machine transitions per §8
- Subsection "Resource list" — table mapping epic → resources → endpoints. Source: PRD FRs + Master Spec §10 epic list. Each row: epic, resource, base path, key endpoints. Comprehensive draft; can be augmented per epic during Phase 4.
- Subsection "Standard response envelope" — for collection: `{ data: T[], pagination: { page, pageSize, total }, meta: {} }`. For item: `{ data: T, meta: {} }`.
- Subsection "Standard error envelope" — reproduce Master Spec §7.5 verbatim: `{ code: string, message: string, details?: object, timestamp: string }`. Error categories: `validation` | `authorization` | `not_found` | `business_rule_violation` | `system`.
- Subsection "Error → HTTP status mapping" — table:
  | Category | HTTP status | Example error code |
  |---|---|---|
  | `validation` | 400 | `validation.field_required` |
  | `authorization` | 401 / 403 | `auth.token_expired`, `auth.insufficient_role` |
  | `not_found` | 404 | `not_found.purchase_order` |
  | `business_rule_violation` | 422 | `business.insufficient_stock`, `business.enablement_violation`, `business.approval_conflict` |
  | `system` | 500 | `system.unexpected_error` |
- Subsection "Pagination" — query params `?page=1&pageSize=50` (default pageSize 50, max 200). Cursor pagination reserved for high-volume endpoints (audit_log query, transaction history) — `?cursor={opaque}&limit=100`.
- Subsection "Filtering & sorting" — query params `?filter[status]=approved&filter[brand_id]=...&sort=-created_at`. Server-side validation against an allowlist per resource (no arbitrary SQL injection vector).
- Subsection "Authentication" — `Authorization: Bearer {supabaseAccessToken}`. Express middleware validates JWT via Supabase; extracts `user_id` + `brand_id`; constructs `req.db = brandedDb(brandId)` per DL-012; sets Postgres session var `app.user_id` for trigger backstop per DL-013.
- Subsection "Versioning policy" — `/api/v1/...` is the MVP version. Breaking changes go to `/api/v2/...`; v1 maintained for the deprecation window. Non-breaking additions land in v1.
- Subsection "Idempotency" — for mutation endpoints that may be retried (POST /api/v1/...): client may send `Idempotency-Key: {uuid}` header; server stores key → response mapping for 24h, returns cached response on duplicate. Apply to: PO approve, GR create, Production Order start, IRN paste (DSP-010), accountant export request.
- Subsection "Standard middleware stack" — order:
  1. Request logging (Sentry)
  2. CORS
  3. Body parsing
  4. Authentication (JWT extract → req.user)
  5. Tenant binding (`req.db = brandedDb(req.user.brand_id)`)
  6. Audit context (`SET app.user_id = ...`)
  7. Idempotency cache check
  8. Route handler
  9. Error handler (maps thrown service errors → error envelope)
- Subsection "OpenAPI" — generated from Zod schemas in `packages/shared/src/api/`. Each endpoint authored as `defineRoute({ method, path, request: zodSchema, response: zodSchema, handler })` pattern. OpenAPI spec served at `/api/openapi.json` for tooling.

- [ ] **Step 1: Draft §17** — Append §17 per outline above.

- [ ] **Step 2: Verify Master Spec §7.5 reproduction** — Error envelope format must match exactly.

- [ ] **Step 3: Verify resource-list completeness** — Cross-reference Master Spec §10 epic list and PRD FRs; add any missing resources.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §17: REST API conventions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: §18 UI Design Tool Workflow (formal capture per DL-004)

**Files:**
- Modify: `_planning/architecture.md` (append §18)

**Source material:**
- DL-004 (OQ9 RESOLVED — in-repo Vite + shadcn)
- Master Spec §3.3 (UI design tooling strategy — Stitch / Imagine / hybrid options now SUPERSEDED)
- Master Spec §3.1 (shadcn/ui FINAL, Tailwind v4 FINAL per DL-002)
- Phase 2c plan §3 Tooling decision (already made)
- DESIGN.md (entire document — DESIGN.md is canonical for tokens per CLAUDE.md critical rules)

**Section content outline:**
- Subsection "Decision (formal capture per DL-004)" — quote: "UI design tooling for this project is in-repo Vite + React + Tailwind + shadcn/ui in this Claude Code workspace. NOT Google Stitch, NOT claude.ai Artifacts, NOT a hybrid of the two. Original Master Spec §3.3 options list (Stitch / Imagine / hybrid) is superseded — the chosen path was not on that list."
- Subsection "Why the in-repo path won" — reproduce DL-004 reasoning verbatim:
  - shadcn/ui is FINAL §3.1; in-repo workflow gives mechanical token enforcement (Tailwind config typo = build error)
  - Shared shell components (edit once, all screens update)
  - Engineer handoff fidelity (`git checkout` instead of paste-the-block translation)
  - Stitch rejected: Gemini-powered (voice drift), structured design-system data model holds ~25% of DESIGN.md, output not directly extractable as React, async generation hurts iteration
  - Artifacts rejected: sandboxed Tailwind, no shared component file, engineer handoff requires translation, Inter font load unreliable
- Subsection "Workflow" — per Phase 2c plan:
  1. Designer authors / iterates a screen mockup in `mockups/src/{epic}/{screen-id}.tsx`
  2. Pre-commit hook (Phase 2c-scoped deliverable) enforces DESIGN.md token reference (no hardcoded hex / spacing)
  3. Vercel preview deployment auto-builds the mockup harness on PR
  4. Stakeholder review via the preview URL
  5. Phase 4 epic implementation copies the mockup into `apps/web/src/screens/{epic}/{ScreenName}.tsx` and adapts (real auth, real API, error boundaries) per DL-005
- Subsection "Master Spec §3.3 amendment notice" — Master Spec §3.3 OQ9 status updated in Task 29 to mark Stitch/Imagine options as SUPERSEDED; the §3.3 OAuth setup instructions for Stitch become historical context only.

- [ ] **Step 1: Draft §18** — Append §18 per outline above.

- [ ] **Step 2: Verify DL-004 reasoning preservation** — All five rejection rationales (Stitch + Artifacts) must appear in §18 for the formal capture to be complete.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §18: UI design tool workflow (DL-004 formal capture)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: §19 Mockups vs Production Code Relationship

**Files:**
- Modify: `_planning/architecture.md` (append §19)

**Source material:**
- DL-005 (mockups = visual specification; production = fresh code in apps/web + apps/api; 21 shell components copy-port at Phase 4 start)
- Master Spec §3.2 (Monorepo with apps/web + apps/api + packages/shared)
- Phase 2c plan §1 (Goal — visual specification language)
- Phase Roadmap Phase 4 (per-epic frontend code consuming foundation chrome)

**Section content outline:**
- Subsection "Two trees, one source of design truth":
  - `mockups/` (Vite + shadcn + Tailwind harness — Phase 2c-scoped) = visual specification
  - `apps/web/` (production React + TanStack Query + real auth + error boundaries) = production code
  - Both reference DESIGN.md as the single source of design truth
- Subsection "Copy-port discipline (one-time at Phase 4 Epic 1 start)":
  - 21 shell components from `mockups/src/shell/` → copy → `apps/web/src/components/shell/`
  - Adapt: replace fixture data with TanStack Query hooks; wire real Supabase auth; add error boundaries; add accessibility hardening (focus management, ARIA, keyboard nav)
  - After copy-port: mockups become *frozen visual reference*. Subsequent Phase 4 changes do NOT propagate back to mockups. Chrome-freeze gate per epic (Phase Roadmap invariant 8) catches drift.
- Subsection "Why not import from mockups/" — Reproduce DL-005 reasoning: avoids forcing Phase 2c mockup decisions (Vite-isms, no real auth, no real API) into production code constraints. Phase 4 production code gets fresh React with proper Drizzle data layer + real auth + accessibility — without dragging mockup-only fixtures forward.
- Subsection "Mockup → production migration checklist (per shell component)" — applied at Phase 4 Epic 1 setup:
  - [ ] Copy file to apps/web
  - [ ] Replace fixture data with TanStack Query hook
  - [ ] Add Suspense / loading state
  - [ ] Add error boundary
  - [ ] Add ARIA labels + focus management
  - [ ] Add keyboard shortcuts where applicable
  - [ ] Add tests (component test + integration test)
- Subsection "Just-in-time mockups during Phase 4" — Phase Roadmap Phase 4 §Per-epic 3-arc structure: each epic produces NEW mockups for its deferred screens during Arc (b). These new mockups get the same copy-port treatment to apps/web during Arc (c). The mockups/ tree continues to grow during Phase 4 — but the *foundation 21 shell components* copy-ported at Phase 4 Epic 1 start are the canonical chrome; subsequent additions follow the chrome-freeze gate discipline.

- [ ] **Step 1: Draft §19** — Append §19 per outline above.

- [ ] **Step 2: Verify Phase Roadmap invariant 8 cross-ref** — Chrome-freeze gate language must match.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §19: mockups vs production-code relationship (DL-005)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: §20 CI/CD Quality Gates

**Files:**
- Modify: `_planning/architecture.md` (append §20)

**Source material:**
- Master Spec §3.1 (GitHub Actions FINAL, Sentry FINAL)
- DL-006 (Turborepo task graph caches CI runs)
- DL-014 (CI lint flags any new table without RLS policies)
- DL-015 (`brandScopedTable` helper makes brand_id index mechanical — but verify post-condition)
- Master Spec §7.1 (TypeScript strict, zero `any`)

**Section content outline:**
- Subsection "Pipeline stages (per PR)" — GitHub Actions workflow steps:
  1. Checkout + pnpm install (cached)
  2. `turbo run typecheck` — TypeScript strict, zero `any` (Master Spec §7.1)
  3. `turbo run lint` — ESLint + Prettier
  4. `turbo run test` — unit tests (Vitest or Jest)
  5. `turbo run test:integration` — integration tests against ephemeral Postgres (Supabase test instance or local)
  6. Migration lint — see "Lint scripts" below
  7. Build all apps (`turbo run build`)
  8. Vercel preview deploy (`apps/web`) + Railway PR-environment deploy (`apps/api`, `apps/worker`)
- Subsection "Lint scripts (custom)":
  - **`scripts/lint-migrations.ts`**: parses every SQL migration; for each `CREATE TABLE`, asserts ENABLE ROW LEVEL SECURITY + at least one CREATE POLICY in the same migration (DL-014). Fails build on violation.
  - **`scripts/lint-brand-id-index.ts`**: parses every CREATE TABLE in migrations; for each table that includes `brand_id` column, asserts a `brand_id` index exists (DL-015 enforcement post-condition — even though `brandScopedTable` should auto-emit, the lint catches manual bypass).
  - **`scripts/lint-design-tokens.ts`**: scans `apps/web/src/**/*.tsx` and `mockups/src/**/*.tsx` for hardcoded hex / spacing values; fails on regex match outside DESIGN.md / `tailwind.config.ts` (CLAUDE.md critical rule).
  - **`scripts/lint-no-any.ts`**: greps for `: any` outside test files; fails on match (Master Spec §7.1).
- Subsection "Pre-commit hook" — `lefthook` or `husky` config runs the design-tokens lint + no-any lint on staged files only (fast feedback before push). Migration lints + integration tests run only in CI (slower).
- Subsection "Branch protection rules" — `main` requires:
  - All CI checks passing
  - At least one approving review (post-MVP; solo dev for now means self-review or AI-review pass)
  - Linear history (squash merges)
- Subsection "Sentry integration" — `apps/api` and `apps/worker` initialize Sentry on boot; PR previews use a separate Sentry project to avoid noise; production environment auto-tags release SHA.

- [ ] **Step 1: Draft §20** — Append §20 per outline above.

- [ ] **Step 2: Verify Master Spec §3.1 GitHub Actions claim** — `turbo` caching across CI runs requires Turbo's Remote Cache for cross-PR cache reuse; per DL-006, Remote Cache deferred. Local-cache benefits exist within a single workflow run (e.g., typecheck+lint share install cache). Document this explicitly so Phase 4 doesn't expect cross-PR cache benefits prematurely.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §20: CI/CD quality gates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: §21 Cross-Reference Index

**Files:**
- Modify: `_planning/architecture.md` (append §21)

**Source material:**
- All preceding sections (§1–§20)
- PRD FR1–FR119 (full FR list)
- Screen Inventory CC-* catalogue (`_planning/05-screen-inventory.md` §3)
- decision-log.md DL-001 → DL-020

**Section content outline:**
- Subsection "FR# → architecture section" — table mapping every FR# touched by an architecture decision to the section that addresses it. Examples:
  - FR19 (Notification & Alert Center) → §11
  - FR20, FR21 (audit) → §7
  - FR31 (FEFO ordering) → §6 (refined deductStock contract) + §8 (row-lock pattern)
  - FR39 (vendor docs) → §13
  - FR67, FR67a (retrospective recipe cost adjust) → §6 + §9 (pg-boss recompute job)
  - FR68 (Production Order In Progress deduction) → §6 (deductStock contract) + §8 (row-lock pattern) + DL-001
  - FR81 (production batch photos) → §13
  - FR84 (POS sales import) → §9 (pg-boss cron job)
  - FR89 (production journal mapping) → §6 (accountingService.createJournalEntry refinement)
  - FR96 (multi-format export) → §6 (exportService) + Task 23 (OQ10 column-mapping spec)
  - FR98 (integration dashboard) → §10 (polling endpoint)
  - (Full table — read PRD; add every FR touched by any §1–§20 section)
- Subsection "CC-* → architecture section" — table mapping each cross-cutting screen pattern to the architecture section that supports it:
  - CC-AUDIT-LINK → §7
  - CC-BRAND-ID-FILTER (if present in catalogue) → §4
  - CC-OVERRIDE-WIDGET → §7 (reason-required action catalogue)
  - CC-PROVISIONAL-FLAG → §6 (refined deductStock — provisional figures path per FR66)
  - CC-VOICE-INPUT → §16 (resilience — TanStack retry on submit)
  - CC-IMPLAUSIBILITY-WARN → §6 (validation in service layer)
  - CC-DUPLICATE-WARN → §8 (Pattern 2: unique constraint)
  - CC-GST-FIELD-VALIDATION → §5 (placeholder field convention) + §6 (validation)
  - CC-UNREGISTERED-CUSTOMER-WARN → §6 (validation)
  - (Full table — read screen inventory CC-* catalogue; add every CC-* pattern)
- Subsection "DL-NNN → architecture section" — table:
  | DL | Title | Section |
  | DL-001 | Production Order 5-status | §6, §8 |
  | DL-002 | Tailwind v4 | §2 |
  | DL-003 | Phase re-sequencing | §1 (reading order context) |
  | DL-004 | OQ9 in-repo Vite/shadcn | §18 |
  | DL-005 | Mockups vs production | §19 |
  | DL-006 | OQ1 Turborepo | §3 |
  | DL-007 | OQ2 Railway-Mumbai | §3 |
  | DL-008 | OQ8 no Redis | §12 |
  | DL-009 | OQ7 pg-boss | §9 |
  | DL-010 | OQ3 Realtime triage | §10 |
  | DL-011 | OQ16 Notification Center transport | §11 |
  | DL-012 | OQ11 brandedDb | §4 |
  | DL-013 | OQ12 Audit trail | §7 |
  | DL-014 | OQ14 RLS authoring | §4, §20 |
  | DL-015 | OQ15 brandScopedTable | §4, §5 |
  | DL-016 | OQ17 Concurrency patterns | §8 |
  | DL-017 | OQ13 File storage | §13 |
  | DL-018 | OQ6 Search | §14 |
  | DL-019 | OQ5 PDF | §15 |
  | DL-020 | OQ4 Offline | §16 |

- [ ] **Step 1: Draft §21** — Append §21 per outline above.

- [ ] **Step 2: Build the FR-to-section table** — Read PRD; for each FR, decide which architecture section(s) bind it; add a row. Some FRs are pure UX with no architectural binding — those can be omitted (note "no architectural binding" if uncertain).

- [ ] **Step 3: Build the CC-to-section table** — Read screen inventory §3; for each CC-*, find the section that addresses it; add a row.

- [ ] **Step 4: Verify the DL table is complete** — All 20 DL entries (DL-001 through DL-020) accounted for.

- [ ] **Step 5: Commit**
```bash
git add _planning/architecture.md
git commit -m "Phase 3a §21: cross-reference index (FR / CC / DL → §)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: OQ10 — Accountant Export Column-Mapping Spec

**Files:**
- Create: `_planning/architecture-oq10-export-mappings.md`

**Source material:**
- PRD FR96 (dual Tally + Zoho Books + Generic CSV from MVP)
- Master Spec §6 (entire — Epic 10 Accounting & Financial)
- Master Spec §6.3 In-scope features (export catalogue: Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost)
- Master Spec §6.5 (placeholder fields — what's available to export per transaction)
- Master Spec §6.2 (TRN format — TRN is the primary export key)
- Tally export reference: Tally's standard XML/Excel import templates (look up via Context7 if needed for current syntax)
- Zoho Books reference: Zoho's chart-of-accounts and journal-import CSV format (Context7)

**Section content outline:**
- §1 Purpose — column-mapping spec for the three formats; consumed by `exportService` (architecture.md §6) at Phase 4 Epic 10 implementation.
- §2 Data layer (format-agnostic) — internal export domain model:
  ```
  ExportRow = {
    trn: string,
    date: ISO8601,
    type: TransactionType,
    location: { brand, cluster, location, department },
    parties: { vendor?, customer?, employee? },
    lines: ExportLine[],
    compliance: { gst?, irn?, eway?, tds? },  -- §6.5 placeholder fields
    totals: { subtotal, taxes, total },
    metadata: { createdBy, createdAt, lastUpdated }
  }
  ```
- §3 Tally format — column mapping per export type:
  - Transaction Journal: column-by-column table (Tally column name → ExportRow path → format/transformation rule)
  - Purchase Register: column table
  - Sales Register: column table
  - Vendor AP Aging: column table
  - Customer AR Aging: column table
  - Food Cost: column table
- §4 Zoho Books format — column mapping per export type (same six exports)
- §5 Generic CSV format — opinionated standard column set per export type (when neither Tally nor Zoho is the target accounting software). Designed to be importable by any accounting tool with a CSV mapper.
- §6 Format-selection logic — `exportService.generateExport(format, dateRange, type)` reads `brand.preferred_export_format` (one of 'tally' | 'zoho' | 'generic'); user can override per-export.
- §7 Edge cases:
  - Multi-line transactions (PO with N lines) — one row per line vs one row per transaction with line subtotals (Tally vs Zoho conventions differ)
  - GST fields when not applicable (intra-state with B2C — fields blank)
  - IRN field when not generated (placeholder field empty per §6.5)
  - Refund / credit notes — sign convention per format
  - Foreign-currency transactions (post-MVP placeholder — note column reserved)
- §8 Validation pre-export — checklist that `exportService` runs before generating:
  - All transactions in date range have TRN
  - Required-for-format fields populated (e.g., Tally requires `place_of_supply`)
  - Compliance fields valid format (GSTIN regex, IRN length)
  - Surface validation errors to user with row-level remediation guidance

- [ ] **Step 1: Draft the file** — Create `_planning/architecture-oq10-export-mappings.md` with the structure above.

- [ ] **Step 2: Research Tally + Zoho actual column formats** — Use Context7 (`mcp__claude_ai_Context7__query-docs`) to fetch current Tally Import format reference + Zoho Books journal-import CSV reference. Cite the source version in the doc so future maintainers can re-check.

- [ ] **Step 3: Author each format's column tables** — Per export type × per format = 18 column-mapping tables (3 formats × 6 exports). Drafted comprehensively, no placeholders. Where Tally / Zoho require columns we don't capture in MVP (e.g., Tally's "Cost Centre" classification), document them as "deferred — populate from `location.department.cost_center` once Epic 11 HRMS adds cost center to dept master" or similar honest-deferred notes.

- [ ] **Step 4: Verify FR96 coverage** — `grep` PRD for FR96 and confirm every export type listed in FR96 is covered.

- [ ] **Step 5: Commit**
```bash
git add _planning/architecture-oq10-export-mappings.md
git commit -m "Phase 3a OQ10: accountant-export column-mapping spec

Tally + Zoho Books + Generic CSV formats × 6 export types
(Transaction Journal, Purchase Register, Sales Register,
Vendor AP Aging, Customer AR Aging, Food Cost) per FR96.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Diagram — Data Model ERD (Mermaid)

**Files:**
- Create: `_planning/architecture-diagrams/data-model-erd.md`

**Source material:**
- architecture.md §5 (schema file organization → table list)
- Master Spec §2 Domain Model (entities + relationships)
- DL-015 (every brand-scoped table FK to brands)

**Section content outline:**
- Title + 1-paragraph "How to read this diagram" preamble
- Mermaid `erDiagram` covering:
  - Org core: brands, clusters, locations, departments
  - Auth: users, roles, user_roles, sessions
  - Inventory: items, batches, stock_levels, enablement_matrix
  - Procurement: vendors, purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines
  - Recipes: recipes, recipe_versions, recipe_lines, recipe_cost_snapshot
  - Production: production_orders, production_outputs
  - Dispatch: dispatch_challans, dispatch_challan_lines
  - POS: pos_locations, pos_sales, pos_imports
  - Accounting: chart_of_accounts, journal_entries, journal_lines
  - Audit & Notifications: audit_log, notifications, notification_type_config
  - Approvals: approval_requests, approval_actions, approval_matrix
  - Files: file_attachments
- Use Mermaid relationship cardinality (`||--o{`, `}o--||`) accurately
- Group related entities visually using Mermaid subgraphs if supported by syntax, or split into multiple diagrams per epic if the single diagram becomes unreadable (acceptable pivot)

- [ ] **Step 1: Author the Mermaid ERD** — Comprehensive coverage of every table named in architecture.md §5. Confirm every brand-scoped table shows the brand_id FK to brands.

- [ ] **Step 2: Verify diagram renders** — Open the file in VS Code; confirm Mermaid preview renders without syntax errors. (No browser-side validation needed; VS Code's Mermaid extension handles parsing.)

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture-diagrams/data-model-erd.md
git commit -m "Phase 3a diagram: data model ERD (Mermaid)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 25: Diagram — Service Graph (Mermaid)

**Files:**
- Create: `_planning/architecture-diagrams/service-graph.md`

**Source material:**
- architecture.md §6 (service catalogue)
- Master Spec §8 (service contracts)
- DL-009 (pg-boss + worker process)
- DL-011 (Notification Center pipeline)

**Section content outline:**
- Title + 1-paragraph "How to read this diagram" preamble
- Mermaid `graph LR` (or `flowchart`) covering:
  - HTTP request → Express middleware stack (auth, brandedDb, audit context)
  - → service layer (inventoryService, procurementService, recipeService, productionService, dispatchService, accountingService, approvalEngine, notificationCenter, exportService, recipeService, searchService, auditLog)
  - → brandedDb → Drizzle → Supabase Postgres
  - → pg-boss enqueue → worker process
  - Worker process handles: send_email (→ Resend), render_pdf, generate_export, recompute_recipe_cost, pos_sales_import, approval_escalate
  - Realtime channels emerge from Postgres → frontend (5 channels per DL-010)
  - Sentry receives errors from API + worker

- [ ] **Step 1: Author the Mermaid service graph**.

- [ ] **Step 2: Verify diagram renders** in VS Code preview.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture-diagrams/service-graph.md
git commit -m "Phase 3a diagram: service graph (Mermaid)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 26: Diagram — B2B Challan Two-Stage Journal Flow (Mermaid sequence)

**Files:**
- Create: `_planning/architecture-diagrams/sequence-b2b-challan.md`

**Source material:**
- `_planning/04-b2b-challan-spec.md` (entire B2B challan spec)
- architecture.md §6 (accountingService refinement)
- DL-016 (concurrency — relevant if any state transitions involved)

**Section content outline:**
- Title + 1-paragraph context: "B2B challan two-stage journal flow per spec §X"
- Mermaid `sequenceDiagram` showing:
  - Actors: Dispatch Staff, Express API, accountingService, dispatchService, notificationCenter, customer
  - Steps: dispatch challan creation → first journal entry (stock-out, AR-customer DR, inventory CR) → customer acknowledges → second journal entry (final settlement) → notification fan-out
  - Include the TRN reference passed between steps
  - Annotate concurrency / atomicity boundaries

- [ ] **Step 1: Read `_planning/04-b2b-challan-spec.md`** to confirm the two-stage flow matches what the spec describes. If divergence: the architecture follows the spec; update diagram accordingly.

- [ ] **Step 2: Author the Mermaid sequence diagram**.

- [ ] **Step 3: Verify diagram renders** in VS Code preview.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture-diagrams/sequence-b2b-challan.md
git commit -m "Phase 3a diagram: B2B challan two-stage journal sequence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 27: Diagram — Production Order 5-Status Lifecycle (Mermaid sequence + state)

**Files:**
- Create: `_planning/architecture-diagrams/sequence-production-order-lifecycle.md`

**Source material:**
- DL-001 (Production Order 5-status: Draft → Pending GR → Confirmed → In Progress → Completed; deductStock fires at In Progress)
- architecture.md §6 (deductStock refinement, row-lock pattern)
- architecture.md §7 (audit trail at every transition)
- architecture.md §11 (notifications fired per transition)
- DL-016 (status-guarded UPDATE pattern for transition idempotency)
- PRD FR64, FR66, FR67, FR67a, FR68, FR89 (cited in DL-001)

**Section content outline:**
- Title + 1-paragraph context referencing DL-001
- Mermaid `stateDiagram-v2` showing 5 states + transitions, with annotations on what fires at each transition:
  - Draft → Pending GR (no deduction, provisional figures per FR66)
  - Pending GR → Confirmed (linked GR confirmation; FR67 retrospective adjust)
  - Pending GR → Closed (linked GR rejection; FR67a closure path)
  - Confirmed → In Progress (Kitchen Manager start; deductStock + journal entry per FR68 + FR89)
  - In Progress → Completed (production output recorded)
- Followed by Mermaid `sequenceDiagram` for the In Progress transition specifically (the high-stakes one per DL-001):
  - Actors: Kitchen Manager UI, Express API, productionService, inventoryService, accountingService, notificationCenter, auditLog
  - Show row-lock acquisition, FEFO batch select, deduct, journal entry, audit, notification fan-out — all in single transaction

- [ ] **Step 1: Author the state diagram + sequence diagram** in one file.

- [ ] **Step 2: Verify diagram renders** in VS Code preview (Mermaid supports both `stateDiagram-v2` and `sequenceDiagram`; render both blocks).

- [ ] **Step 3: Verify FR cross-references** — every FR cited in DL-001 should appear in diagram annotations.

- [ ] **Step 4: Commit**
```bash
git add _planning/architecture-diagrams/sequence-production-order-lifecycle.md
git commit -m "Phase 3a diagram: production order 5-status lifecycle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 28: Diagram — Approval Routing (Mermaid sequence)

**Files:**
- Create: `_planning/architecture-diagrams/sequence-approval-routing.md`

**Source material:**
- Master Spec §8.2 (approvalEngine contracts)
- architecture.md §6 (approvalEngine refinement, approval_matrix table)
- DL-016 (status-guarded UPDATE pattern for approval idempotency)
- DL-010 (Realtime channel #1 for approval queue)
- DL-011 (notification on state transitions)

**Section content outline:**
- Title + 1-paragraph context: "Approval routing for any approval-eligible action; PO approval as worked example (PUR-004)"
- Mermaid `sequenceDiagram`:
  - Actors: Initiator UI, Express API, approvalEngine, approval_matrix, notificationCenter, Approver UI (Realtime), Approver UI (action)
  - Steps:
    1. Initiator creates PO → approvalEngine.createApprovalRequest reads approval_matrix to determine approver(s)
    2. Approval request inserted; notification fires to approver
    3. Realtime channel #1 (`approval_requests WHERE approver_id = me`) pushes to approver's UI
    4. Approver clicks Approve → API endpoint → status-guarded UPDATE per DL-016 → audit log → notification back to initiator + downstream consumers
    5. Idempotent on double-click (zero-row-affected return path)
  - Show timeout / escalation branch: pg-boss `approval_escalate` job timer-driven per Epic 3 config; on timeout, escalates to next approver per matrix; notification fires.

- [ ] **Step 1: Author the Mermaid sequence diagram**.

- [ ] **Step 2: Verify diagram renders** in VS Code preview.

- [ ] **Step 3: Commit**
```bash
git add _planning/architecture-diagrams/sequence-approval-routing.md
git commit -m "Phase 3a diagram: approval routing sequence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 29: Update Master Spec §11 — mark all OQs as RESOLVED

**Files:**
- Modify: `_planning/02-master-spec.md` (§11 OQ table rows + closing note)

**Source material:**
- decision-log.md DL-006 → DL-020 (per-OQ resolution citations)
- The just-authored architecture.md sections (per-OQ binding section)

**Section content outline:**
- Per-row OQ status update — for each row OQ1 → OQ17, append "✅ RESOLVED — DL-NNN, architecture.md §X" to the row content (or restructure as a status column).
- §3.3 amendment block — at the top of §3.3, add: "⚠ SUPERSEDED. UI design tooling decision is RESOLVED per DL-004 + architecture.md §18. The Stitch / Imagine / hybrid options below are historical context; do not act on them. The chosen tool is in-repo Vite + React + Tailwind + shadcn/ui."
- Closing note update — replace "Architecture phase must resolve the still-open questions (OQ1–OQ8 + OQ11–OQ17) and document the decisions in `architecture.md` before any epic implementation begins" with "Architecture phase complete. All §11 OQs RESOLVED per `_planning/architecture.md` + `decision-log.md` DL-001 → DL-020. Phase 4 epic implementation may proceed once Phase 2c-scoped (mockup foundation) closes."
- Tech stack table updates in §3.1 — `Backend deployment` row: change "⚠ TBD" to "✅ FINAL — DL-007 — Railway (Mumbai)". Any other "⚠ TBD" rows resolved by Phase 3a get the same treatment.

- [ ] **Step 1: Read Master Spec §11 and §3.1, §3.3** as currently written.

- [ ] **Step 2: Update §3.1 TBD rows** to reference DL entries.

- [ ] **Step 3: Add §3.3 SUPERSEDED notice block** at the top.

- [ ] **Step 4: Update §11 OQ table** — every row gets RESOLVED status + DL reference + architecture.md section anchor.

- [ ] **Step 5: Update §11 closing note** per outline above.

- [ ] **Step 6: Commit**
```bash
git add _planning/02-master-spec.md
git commit -m "Phase 3a close: Master Spec §11 OQs marked RESOLVED

Updates §3.1 (Railway-Mumbai FINAL per DL-007), §3.3 (UI tooling
SUPERSEDED notice referencing DL-004), §11 (every OQ row tagged
RESOLVED with DL reference + architecture.md section anchor).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 30: Update Phase Roadmap + CLAUDE.md current-phase + decision-log close note

**Files:**
- Modify: `_planning/06-phase-roadmap.md` (Phase 3a → ✅ DONE; Phase 2c-scoped → 🔄 NEXT)
- Modify: `CLAUDE.md` (`## Current phase` paragraph)
- Modify: `decision-log.md` (append a Phase 3a close note as DL-021, or as a non-DL "Phase 3a close note" entry)

**Source material:**
- `_planning/06-phase-roadmap.md` Phase status table + Phase 3a section
- `CLAUDE.md` `## Current phase` block
- All architecture.md sections + diagrams just authored
- Cross-phase invariant 9 (CLAUDE.md `## Current phase` update is mandatory at phase boundary)

**Section content outline:**

**Phase Roadmap edits:**
- Phase 3a row: `🔄 NEXT` → `✅ DONE`; deliverable column adds "+ 5 Mermaid diagrams (data ERD, service graph, B2B challan / production order / approval sequences)"; branch column shows `phase-3a/architecture` merged
- Phase 2c-scoped row: `⏸️ Gated by 3a` → `🔄 NEXT`; gate-cleared note added
- Phase 4 row: stays gated by 2c-scoped
- Phase 3a "What this phase produces" section: append "Closure note (2026-MM-DD)" with one-paragraph summary: 15 OQs resolved, architecture.md authored across N tasks / N sessions, OQ10 spec produced, 5 diagrams committed, Master Spec §11 status updated.
- Cross-phase invariants table: confirm invariant 9 (Phase boundary crossing requires same-commit update of `## Current phase`) reflects this update happening this commit.

**CLAUDE.md edits:**
- `## Current phase` paragraph — replace "Phase 3a — Architecture (NEXT)" with "Phase 2c-scoped — Visual mockup foundation (NEXT). Phases 1, 2a, 2b, 2c-prep, 3a ✅ DONE (see `_planning/06-phase-roadmap.md` for canonical sequence). Phase 2c-scoped executes the mockup harness build per `docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md`. Phase 4 (epic implementation) gated on Phase 2c-scoped closing."
- Verify `## Phase 4 invariants` block remains (mirror of roadmap §"Cross-phase invariants") — no edit needed unless invariants changed (none did this phase).

**decision-log.md close note (as DL-021):**
- Title: "DL-021 — 2026-MM-DD — Phase 3a close note"
- Body: enumerates all deliverables shipped (architecture.md §1–§21, OQ10 spec, 5 diagrams, Master Spec §11 status updates), confirms all 15 OQs resolved + OQ9 captured per DL-004 + OQ10 spec produced, notes the chrome-freeze gate + Tier 1 Acceptance Tag invariants carry forward unchanged.

- [ ] **Step 1: Edit Phase Roadmap** per outline above. Update Phase status table, append Phase 3a closure note, verify invariants table.

- [ ] **Step 2: Edit CLAUDE.md `## Current phase`** per outline above.

- [ ] **Step 3: Edit `## Phase 4 invariants` if needed** — read carefully; if DL-021 surfaces any new invariant (e.g., "architecture.md amendments require new DL entry"), add it. Otherwise no edit.

- [ ] **Step 4: Append DL-021 to decision-log.md** per outline above.

- [ ] **Step 5: Commit**
```bash
git add _planning/06-phase-roadmap.md CLAUDE.md decision-log.md
git commit -m "Phase 3a close: roadmap → DONE, CLAUDE.md → Phase 2c-scoped, DL-021

Phase 3a Architecture deliverables shipped:
- _planning/architecture.md §1–§21
- _planning/architecture-oq10-export-mappings.md (FR96)
- 5 Mermaid diagrams in _planning/architecture-diagrams/
- Master Spec §11 OQs marked RESOLVED (Task 29 commit)

Phase boundary crossed; CLAUDE.md ## Current phase updated per
cross-phase invariant 9. Phase 2c-scoped (mockup foundation) is
NEXT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 31: Open PR to merge phase-3a/architecture → main

**Files:**
- No file edits; PR creation via `gh` CLI.

- [ ] **Step 1: Verify branch state**
```bash
git status                       # clean
git log main..HEAD --oneline     # all Phase 3a commits visible
```

- [ ] **Step 2: Push branch**
```bash
git push -u origin phase-3a/architecture
```

- [ ] **Step 3: Open PR**
```bash
gh pr create --title "Phase 3a — Architecture (closes 15 OQs + ships architecture.md + OQ10 spec + 5 diagrams)" --body "$(cat <<'EOF'
## Summary
- Resolves all 15 still-open OQs from Master Spec §11 (DL-006 → DL-020)
- Ships `_planning/architecture.md` as the canonical Phase 3a deliverable (21 sections)
- Ships `_planning/architecture-oq10-export-mappings.md` per FR96 (Tally + Zoho Books + Generic CSV × 6 export types)
- Ships 5 Mermaid diagrams in `_planning/architecture-diagrams/` (data ERD, service graph, B2B challan / production order / approval sequences)
- Updates Master Spec §11 (OQs marked RESOLVED), §3.1 (Railway-Mumbai FINAL), §3.3 (UI tooling SUPERSEDED notice referencing DL-004)
- Updates Phase Roadmap (Phase 3a → DONE; Phase 2c-scoped → NEXT) and CLAUDE.md `## Current phase`

Phase 3a unblocks Phase 2c-scoped (mockup foundation). Phase 4 (epic implementation) remains gated on Phase 2c-scoped closing per the canonical phase sequence.

## Decisions captured
| OQ | Topic | DL | Architecture § |
|---|---|---|---|
| OQ1 | Monorepo: Turborepo on pnpm workspaces | DL-006 | §3 |
| OQ2 | Backend deploy: Railway (Mumbai) | DL-007 | §3 |
| OQ3 | Realtime: 5-channel triage | DL-010 | §10 |
| OQ4 | Offline: deferred post-MVP | DL-020 | §16 |
| OQ5 | PDF: @react-pdf/renderer on worker | DL-019 | §15 |
| OQ6 | Search: tsvector + pg_trgm | DL-018 | §14 |
| OQ7 | Background jobs: pg-boss + pg_cron | DL-009 | §9 |
| OQ8 | Caching: no Redis; recipe_cost_snapshot | DL-008 | §12 |
| OQ9 | UI tool: in-repo Vite/shadcn (formal capture) | DL-004 | §18 |
| OQ10 | Export column-mappings (deliverable) | — | architecture-oq10-export-mappings.md |
| OQ11 | Multi-tenant: brandedDb factory | DL-012 | §4 |
| OQ12 | Audit: app-layer + 4-table trigger backstop | DL-013 | §7 |
| OQ13 | File storage: per-brand bucket + Express signed URL | DL-017 | §13 |
| OQ14 | RLS authoring: per-epic from canonical template + CI lint | DL-014 | §4, §20 |
| OQ15 | brand_id index: brandScopedTable helper | DL-015 | §4, §5 |
| OQ16 | Notifications: Resend + pg-boss + data-driven dispatch | DL-011 | §11 |
| OQ17 | Concurrency: row-lock / unique constraint / status-guarded UPDATE | DL-016 | §8 |

## Test plan
- [ ] Read `_planning/architecture.md` end-to-end; confirm every section is self-contained and actionable
- [ ] Verify Mermaid diagrams render in VS Code Mermaid preview
- [ ] `grep -nE 'TBD|TODO|xxx|FIXME' _planning/architecture.md` returns only legitimate hits
- [ ] All DL-006 → DL-020 cited at least once in architecture.md (per §21 cross-reference index)
- [ ] Master Spec §11 every OQ row shows RESOLVED status
- [ ] CLAUDE.md `## Current phase` reads "Phase 2c-scoped"
- [ ] Phase Roadmap Phase 3a row shows ✅ DONE; Phase 2c-scoped shows 🔄 NEXT

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify PR opens** — `gh pr view` to confirm. Return PR URL to user.

---

## Self-Review

(To be performed after the plan is written, before saving — see writing-plans skill checklist.)

**1. Spec coverage:**
- [x] All 15 still-open OQs (OQ1–OQ8 + OQ11–OQ17) addressed in architecture.md sections (per §21 cross-reference DL table) and in tasks 1–22.
- [x] OQ9 formal capture per DL-004 → Task 19 (§18).
- [x] OQ10 column-mapping deliverable → Task 23.
- [x] Optional diagrams (data model ERD, service graph, sequence diagrams for B2B challan, production order, approval routing) → Tasks 24–28.
- [x] Master Spec §11 OQ status updates → Task 29.
- [x] Phase Roadmap update + CLAUDE.md ## Current phase update → Task 30 (per cross-phase invariant 9).
- [x] PR open → Task 31.

**2. Placeholder scan:**
- The plan uses "TBD" only inside `grep` commands (legitimate — searching for the pattern). No drafting placeholders.
- "Comprehensive draft, can be augmented per epic during Phase 4" appears in Task 12 (notification type catalogue) and Task 18 (resource list). These are honest acknowledgments that the catalogue is initial-seed for Phase 4 expansion — not placeholders for "fill in later" content. The Phase-3a authored content is comprehensive at MVP-architecture level; Phase 4 epic-by-epic adds new entries through normal evolution.

**3. Type / signature consistency:**
- `brandedDb` (Task 4) ↔ `brandScopedTable` (Task 4 + Task 5) ↔ `BrandedDb` type in service signatures (Task 6) — all reference each other consistently.
- `auditLog.record` signature consistent across Task 7 (definition) and Task 6 (service-layer usage).
- `notificationCenter.send` signature in Task 12 matches Master Spec §8.3 (preserved per Task 12 verify step).
- `inventoryService.deductStock` row-lock pattern referenced in Task 6 (refinement), Task 8 (pattern 1 detail), Task 27 (sequence diagram). All three reference the same FOR UPDATE + FEFO mechanism.
- `useRealtimeChannel` hook (Task 11) and `useFormDraft` hook (Task 17) — both authored as new hook specs in their respective sections.
- pg-boss `boss.send(name, data, { db: tx })` transactional enqueue pattern consistent across Task 9 (definition) and Task 12 (notification pipeline) and Task 16 (PDF render pipeline).

---

## Execution Handoff

Plan complete. Recommended approach: **Subagent-Driven** for Sessions A–C — each task is self-contained with explicit source-of-truth citations, ideal for fresh-subagent-per-task execution. Two-stage review between tasks catches cross-section drift before it propagates.

Inline execution is also viable if context budget is generous (the source material is large but each task only needs a focused subset).

Saved to `docs/superpowers/plans/2026-05-05-phase-3a-architecture-build.md`.
