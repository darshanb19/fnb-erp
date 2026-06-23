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
**Phase 4 Epic 4 INV — Arc (b) mockups ✅ BUILT on branch `phase-4/epic-4-inv-arc-a-backend` (co-located with Arc a; NOT on `main`/production) 2026-06-23.** Just-in-time mockups for the 14 deferred SI-INV screens (002–006, 008–016) + 2 new reusable pattern shells **CCImplausibilityWarn** (CC-IMPLAUSIBILITY-WARN / FR114, inline per-line warn-and-log) + **CCVoiceInput** (CC-VOICE-INPUT / FR112, mic-on-quantity-field) + the `mockups/src/lib/inv-sample-data.ts` fixtures module (real Arc-a data shapes). Built via **subagent-driven-development** in 3 waves (W1 read/list, W2 config+transfer, W3 GR+adjust+closing) with a per-task two-stage review gate; every task independently verified against real `tsc --noEmit` / `vite build` / `git log` (not subagent self-reports). **Token discipline held: zero hex, Lucide-only, Inter-only, closed status palette (no new `status_*` token), no banned borders, no entrance animations — the sole motion is CCVoiceInput's reduced-motion-guarded (`motion-reduce:animate-none`) listening-pulse on the indicator dots only.** Tier-1 acceptance rigor applied to SI-INV-003/008/010/014 + **SI-INV-015 added to `TIER_1_IDS`** (deferred Tier-1). typecheck silent + vite build clean at every wave gate. New micro-decision: **DL-047**. Spec/plan/per-task reviews under `docs/superpowers/{specs,plans}/` + `.superpowers/sdd/`. **Next: Epic 4 Arc (c) production frontend** (consume foundation chrome + these mockups + real Arc-a services; **apply the chrome-freeze review gate at Epic 4 close**, after Arc c).

_Prior — Arc (a) backend (✅ BUILT 2026-06-23, PR #25, NOT merged to `main`):_ The full Epic 4 inventory backend (widened from the 3-table brief per **DL-044**, founder direction) shipped in 5 TDD waves via subagent-driven-development: **W1** core stock engine (`stock_levels`/`stock_batches`/`stock_movements`, FEFO `SELECT…FOR UPDATE` row-lock per DL-016) + foundations (`trn_sequences` §6.2.4 allocator, `journal_events` Epic-10 stub); **W2** goods receipt (FR27 yield, FR114/FR115 warn-and-log, QC reject); **W3** transfers + paired bundles + suggestions (FR28/§2.2 flow rules incl. **DL-043** raw dept→dept-within-cluster allowance; full `submit→approve→dispatch→confirmReceipt` lifecycle, atomic status-guarded UPDATEs); **W4** adjustments (FR37) + closing inventory (FR35/36/77; cut-off TZ limitation **DL-046**); **W5** PAR + below-PAR (FR33/34). Cross-epic seams stubbed: PO (Epic 5), vendor CN (Epic 5), real journals (Epic 10), production deductStock-caller (Epic 7), recipe/POS expected counts (Epics 6/9). Migrations 0013–0017 (DL-045 strategy). Tests: **522 passing, 1 skipped, deterministic** (a pre-existing test-isolation bug — `issue_ticket_seq_*` not reset by truncate — was found and fixed in `setup.ts`). typecheck + build clean; eslint not installed in env. New DLs: **DL-043, DL-044, DL-046** (DL-045 added by build). Implementation report files under `.superpowers/sdd/`. (Arc (a)'s forward pointer to Arc (b)/Arc (c) is superseded by the Arc (b) status above.)

_Prior:_ **Phase 4 Epic 3 INF ✅ DONE + chrome-freeze gate CLOSED 2026-06-23. App is LIVE in production.** Shared Infrastructure shipped across all three arcs on `main`: Arc (a) backend (PR #23 — approval engine, notification center, append-only audit, issue tracker, broadcasts; schema + services + REST routes + RBAC/integration test sweep; deviations captured as DL-041), Arc (b) just-in-time mockups + 6 new shells (PR #24 — `CCApprovalChainEditor`, `CCNotificationPreferenceMatrix`, `CCIssueCommentThread`, `CCFileAttachUploader`, `CCActivityTimeline`, `CCReverseCancelDialog`; B7 pre-flight NO DRIFT), Arc (c) production frontend (Tasks C0–C10 committed direct to `main`): 8 INF pages — **SI-INF-001** ApprovalInboxPage (Tier 1 hero; DL-040 drill-through for BO approvals) + **SI-INF-002** ApprovalChainConfigPage (Tier 1; DL-036 full editor) + **SI-INF-003** NotificationPreferencesPage + **SI-INF-004** NotificationDigestPage (email channel greyed per DL-035) + **SI-INF-005** AuditTrailViewerPage (Tier 1) + **SI-INF-007** IssueTicketsListPage + **SI-INF-008** IssueTicketFormPage (comments + signed-URL attachments + Realtime channel #5) + **SI-INF-009** BroadcastsPage + BroadcastBanner — plus 2 embedded pattern shells **SI-INF-006** CCActivityTimeline (first consumer USR-002 per DL-038) + **SI-INF-010** CCReverseCancelDialog (first consumer Epic 4). Realtime channels #1/#2/#5 wired via a `realtime-bridge` primitive (DL-010). **First production deployment 2026-06-22 (DL-042): all-on-Vercel full-stack** — Vite SPA + Express-as-serverless-function + Supabase Mumbai (pooler, port 6543) as the live DB; public link **https://fnb-erp-smoky.vercel.app** (demo `bootstrap-bo@fnberp.local` / `BootstrapBO!2026-Dev`); pushes to `main` auto-deploy. Serverless constraint: pg-boss background jobs (escalation timers + digests) no-op cleanly — they need a persistent host (deferred). **Epic 3 close-out 2026-06-23** (this session, after the deploy interrupted the original close): **Fix-back A** finished the provisional Task C10 audit-link sweep — made `AuditLink.entityRef` optional so list/config pages link to a type-only audit filter instead of placeholder sentinels that matched no rows (10 call sites corrected across MDM/USR/INF), and fixed the viewer's stale `ENTITY_TYPE_LABELS` (`enablements`→`enablement_matrix`, `company`→`brands`); chrome-freeze review at `docs/superpowers/reviews/2026-06-23-epic-3-inf-chrome-freeze-review.md` signed off **"no drift; chrome consistent across all three shipped epics"**; typecheck silent + vite build clean (e2e not re-run this session — needs dev DB; Fix-back A is presentational-only). **Token discipline held: zero hex literals, no banned borders, Lucide-only, Inter-only, no `<Separator>`, foundation chrome reused.** Latest micro-decision: **DL-042** (first production deployment). Decision log runs through DL-042; new entries start at DL-043. **Next entry point: Phase 4 Epic 4 INV (Inventory Management) on a fresh chat** — same per-epic 3-arc structure; CC-IMPLAUSIBILITY-WARN + CC-VOICE-INPUT patterns first surface here (apply the chrome-freeze gate again at Epic 4 close).

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