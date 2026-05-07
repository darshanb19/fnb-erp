# Project: F&B ERP

A multi-location Food & Beverage Enterprise Resource Planning system.
Solo developer, AI-assisted, sprint-based, epic-sequential.

## Read first, every session
- `_planning/02-master-spec.md` — single source of truth for scope, decisions, rules
- `_planning/03-prd.md` — functional requirements (FR1–FR119)
- `_planning/05-screen-inventory.md` — 112 screens × 12 schema fields each; canonical UI inventory
- `_planning/06-phase-roadmap.md` — canonical phase sequence; what gates what
- `_planning/01-brainstorming-summary.md` — context and rationale
- `_planning/04-b2b-challan-spec.md` — supplementary spec for B2B dispatch
- `decision-log.md` — micro-decisions accumulated during build (created when first decision is made)
- `codebase-inventory.md` — map of project structure (created after Epic 1)

## Critical rules
- TypeScript strict mode, zero `any` types
- Every org-scoped query includes `brand_id` filter
- Use Drizzle ORM, no raw SQL
- Reference `DESIGN.md` tokens, never hardcode hex/spacing
- Route approvals through the Unified Approval Engine (Epic 3), not per-module
- Route notifications through the Notification Center (Epic 3), not per-module
- Always call `inventoryService.checkEnablement()` before any stock movement
- If instructions are vague or ambiguous, push back and ask before coding

## Context management
- Monitor with `/context` during long story implementations
- If approaching 60–70% context usage, STOP — story is too big. Commit progress, start fresh chat, or split the story.
- Do NOT use `/compact` during story implementation — it loses nuance
- High context usage is a story-sizing problem, not a context-management problem

## Methodology — Superpowers plugin

This project uses the official Superpowers plugin (https://claude.com/plugins/superpowers).
Anyone working on this repo needs it installed: in Claude Code, run `/plugin`, find Superpowers, install.

Apply skills per phase:

- **New epic kickoff** → `/brainstorming` then writing-plans
- **Story implementation** → execute-plan + test-driven-development + verification-before-completion
- **Stuck on a bug ≥ 15 minutes** → systematic-debugging
- **Before opening PR** → requesting-code-review then finishing-a-development-branch
- **Parallel work across modules** → subagent-driven-development + dispatching-parallel-agents

The phase ordering and rules in `_planning/02-master-spec.md` are canonical.
Superpowers methodology layers on top — it doesn't replace the phases.

## Current phase
**Phase 4 Epic 1 MDM Arc (a) ✅ DONE 2026-05-07.** Backend shipped on branch `phase-4/epic-1-mdm-arc-a-backend` (16 commits stacked on `phase-4/epic-1-mdm-plan`): Drizzle schema (`brands` system table with FR9 fields; `users` audit-trigger stub; `clusters` / `locations` / `departments` / `stores` per Master Spec §2; `uoms` + `products` + `product_uoms` + `categories` + `product_categories` + `enablement_matrix` per DL-023 + DL-013; `vendors` per §2.7; `audit_log` carved-out from Epic 3 to support application-layer audit assertions); service layer (`orgService` with DL-022 parent-lock; `productService` with DL-023 two-layer UOM resolution + DL-026 trigram findSimilarByName; `categoryService`; `vendorService` with §2.7 widening / narrowing / lateral classification; `inventoryService.checkEnablement` request-memoised + enablement CRUD; `companyService` edit-only per DL-024 with one-way `markSetupComplete`; `auditLogService` writing append-only rows inside the same txn as the mutation it records); 31 REST routes under `/api/v1/*` covering all 10 MDM resources + DL-026 find-similar + §2.7 scope-mutation + DL-024 mark-setup-complete + 501 stubs for products/import + vendors/import; brand seed script idempotent; CI workflow shipped (typecheck + test); `pg_trgm` extension enabled with trigram indexes on `products.name`, `vendors.name`, `categories.name`. **178 tests green (1 skipped — DL-013 trigger backstop deferred to Phase 3a follow-up); zero `any` types; Supabase Mumbai project NOT yet provisioned (Arc (a) ran against local Postgres `fnberp_dev` + `fnberp_test`).** New micro-decisions captured as **DL-027** (brandedDb explicit scoped methods over transparent Proxy due to Drizzle 0.36 type variance) and **DL-028** (`audit_log` table carved into Arc (a) from Epic 3 scope; trigger function body remains Phase 3a follow-up). **Next entry point: Phase 4 Epic 1 Arc (b) just-in-time mockups** on a fresh chat — branch `phase-4/epic-1-mdm-arc-b-mockups` from `phase-4/epic-1-mdm-arc-a-backend` once Arc (a) merges.

## Phase 4 invariants (mirror of `_planning/06-phase-roadmap.md` §"Cross-phase invariants")

These commitments survive session resets. Source of truth is the roadmap; this is the auto-loaded mirror.

- **Per-epic 3-arc structure.** Each Phase 4 epic decomposes into 3 sub-sessions: (a) backend schema + service-layer + integration tests; (b) just-in-time mockups for that epic's deferred screens; (c) production frontend code consuming foundation chrome + new mockups + real services.
- **Chrome-freeze review gate per epic.** At the end of each Phase 4 epic, review cross-epic chrome consistency before the next epic starts. Drift = mandatory fix-back before the next epic begins. Prevents "mockups built during Epic N silently absorb Epic N's ad-hoc patterns" drift.
- **Tier 1 Acceptance Tag for deferred heroes.** The 12–13 leftover Tier 1 hero screens (Group 2 + Group 3) carry "Tier 1 acceptance applies even though built in Phase 4" tag. Tier 2 lighter-critique acceptance does NOT apply to these screens.
- **Phase boundary crossing discipline.** Crossing a phase boundary requires same-commit update of `## Current phase` in this file. The mechanism existed since Phase 2a; the discipline lapsed across 2b → 2c-prep → 3a-prep (caught in Phase-3a-prep critique 2026-05-05). Discipline now named explicitly to break the recurrence pattern.

## Design token enforcement (Phase 2c+)

Generation-side rules that complement the pre-commit hook at `mockups/.git-hooks/pre-commit`. The hook is the safety net; these rules shape first-pass output so the hook rarely fires.

- **No hex literals in source.** All colour values come from DESIGN.md tokens. The single exception is `mockups/src/tokens.ts` (the canonical TypeScript mirror of `globals.css`).
- **Lucide React only.** Import icons from `lucide-react`. Material Symbols / Material Icons are banned via both module path (`@material-symbols/*`, `@mui/icons*`) and class name (`material-icons`, `material-symbols`, `ms-outlined/rounded/sharp`, `mso-`). Lucide is the project icon library per DESIGN.md §11.
- **Inter only.** Inline `font-family:` declarations must equal `Inter` (or omit the property and inherit). No companion serif, no companion mono per DESIGN.md §7.1.
- **Status palette is closed.** Only the canonical 20 `status_*` tokens defined in DESIGN.md §6.1 may be referenced. Inventing a new status name (e.g., `status_pending_revision`) is a stop-the-line moment — surface as a gap and propose adding the token to DESIGN.md before using it.
- **No sectioning borders.** The `border` and directional siblings (`border-t`, `border-b`, `border-r`, `border-x`, `border-y`, `divide-y`, `divide-x`) Tailwind classes are banned per DESIGN.md §5.2. Allow-list:
  - `border-l-2`, `border-l-4`, `border-l-8` (the §6.1 status-pip pattern; always allowed)
  - When prefixed by `focus:` / `focus-visible:` / `aria-invalid:` (focus rings + error states per DESIGN.md §9.3)
  - `border-2` only when paired with `focus-visible:`
  Use `<SectionShift>` from `mockups/src/shell/` for tonal section breaks instead of `<Separator>`.
- **Animation policy.** Tailwind transitions and Radix primitives by default. Motion (motion.dev) for React-specific layout animations and gestures. GSAP reserved for Wild Sugar marketing site (separate repo), ERP onboarding/login, and dashboard chart reveals only — NEVER on inventory, procurement, accounting, or transaction screens. No entrance animations on data tables, forms, or dashboards. `prefers-reduced-motion: reduce` is honoured per DESIGN.md §10.3 (and §10.5).
- **`tenant_brand_accent` is decorative-only.** Per DESIGN.md §3 + §6, the tenant brand accent (e.g. Wild Sugar peach `#F5B17A`) appears at login splash, sidebar logo, B2B PDF headers, accountant-export PDF headers — and nowhere else. NEVER use as a status / state colour.