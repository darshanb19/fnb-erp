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
**Phase 4 Epic 1 MDM Arc (b) ✅ DONE 2026-05-07.** Just-in-time mockups shipped on branch `phase-4/epic-1-mdm-arc-b-mockups` (8 commits stacked on `phase-4/epic-1-mdm-arc-a-backend`): new shell `CCDuplicateWarn` per DL-026 (CC-DUPLICATE-WARN) consuming `surface_container_low` + `border-l-4 border-status-overridden-pip` (token substitution from plan-named `status_pending` to canonical `status_overridden` documented in shell JSDoc); 4 Tier 2 mockups per DL-025 — **SI-MDM-001** Org Hierarchy with DL-022 parent-lock helper-text + tree+chevron+action-menu chrome (no re-parenting affordance), **SI-MDM-002** Department Register with sortable table + responsive card-collapse mobile pattern, **SI-MDM-005** Vendor Master with §2.7 inline 3-state scope picker (Brand/Cluster/POS) + scope-mutation Popover-as-dialog (mandatory reason ≥10 chars; widening-free vs narrowing/lateral-narrowing narrative) + CC-DUPLICATE-WARN consumer #1, **SI-MDM-007** Company Reg + Fiscal Year (DL-024 edit-only — no "Create new brand" affordance; one-way "Mark setup complete" CTA replaced by status pill on transition); 1 Index-only stub **SI-MDM-006** Categories (zero interactive surface; renders inventory schema verbatim per DL-025); SI-MDM-003 fix-back consuming `<CCDuplicateWarn />` below the create-form name input (CC-DUPLICATE-WARN consumer #2; mock similarity heuristic against `materials` fixture — pg_trgm runs in Arc (c)). All 4 Tier 2 screens carry the canonical "Inventory schema" footer Card surfacing 12 fields each. Spec-compliance reviewer pass clean (B8). **Token discipline: zero hex literals, only canonical 20 status_* tokens (status_confirmed for active, status_inactive for deactivated, status_pending_approval for company-setup pending, status_overridden for the new duplicate-warn pip), no banned border classes, Lucide-only, Inter-only, no `<Separator>` (SectionShift used).** Cumulative diff vs Arc (a): +6,240 lines across 10 files (1 new shell + 4 new Tier 2 screens + 1 Index stub + SI-MDM-003 fix-back + ComponentsIndex permutations + App.tsx route registrations). Typecheck silent + vite build clean throughout. Pre-commit hook fired twice mid-arc on canonical-status enforcement (rule 5) — both resolved without `--no-verify`. **Next entry point: Phase 4 Epic 1 Arc (c) production frontend** on a fresh chat — branch `phase-4/epic-1-mdm-arc-c-frontend` from `main` once Arc (a) + Arc (b) both merge. Arc (c) copy-ports `mockups/src/shell/*` (now 22 shells incl. CCDuplicateWarn) into `apps/web/src/components/shell/*` per DL-005 one-time migration, then builds 7 production pages (SI-MDM-001 through 007) consuming real Arc (a) services + Supabase Auth.

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