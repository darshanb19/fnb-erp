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
**Phase 4 Epic 2 USR ✅ DONE 2026-05-08.** Production frontend shipped on branch `phase-4/epic-2-usr-arc-c-frontend` (15 commits stacked on `main` post-Arc-(a)+(b)-merge — the prep commit and close-out commit added on top of the 13 task commits): C0 one-time copy-port of 3 new files per DL-005 (CCPermissionOverrideMgmt + CCRoleBadge shells + `lib/user-roles.ts`); pre-C1 prep across two commits (Mumbai Supabase project wire-up + bootstrap-BO seed script at `apps/api/scripts/bootstrap-supabase-bo.ts` + apps/api ES256/JWKS verification rewrite using jose with dual-path test/prod — Arc (a) infrastructure gap caught and closed); C1 DL-029 → real Supabase Auth swap (DL-033 single-commit big-bang) — `apps/web/src/lib/auth.ts` rewritten on top of `@supabase/supabase-js` (Mumbai project), `useSession()` consumer surface preserved verbatim so all 7 Epic 1 pages kept working, bootstrap BO created in Mumbai Auth (`bootstrap-bo@fnberp.local`) + matched into local fnberp_dev `users` row by UUID, Playwright `globalSetup` signs in once and reuses storageState across e2e specs (Tier 1 invariant satisfied: 15/15 e2e green post-swap); C2 extended `qk` factory with USR namespaces + added `useEffectivePermissions` hook + `<RequirePermission>` + `<RequireRole>` route guards; 8 production pages: **SI-USR-003** LoginPage (Tier 1 hero — brand-accent header band + generic invalid-creds banner) + **SI-USR-004** PasswordResetPage (split into `/reset-password` request + `/reset-password/:token` confirm routes) at C3, **SI-USR-001** UsersPage list + **SI-USR-002** UserCreateEditPage (Tier 1 hero — multi-section RHF+Zod form with role-conditional scope per `roleScopeShape` + mandatory reason code + FR14 BO-role pending_approval banner; verified end-to-end against real DB) at C4, **SI-USR-005** EffectivePermissionsPage + **SI-USR-006** PermissionOverridePage (Tier 1 hero on USR-006; added two missing apps/api endpoints — GET `/api/v1/permissions` catalog + GET `/api/v1/users/:id/permission-overrides` per-user list — and promoted reason-codes.ts canonical 7-code catalog to `apps/web/src/lib/`; `reasonCode` payload composed as `"<code>: <notes>"` for audit-row preservation, design choice flagged in chrome-freeze review) at C5, **SI-USR-007** OverridesExpiringPage (extended `permissionOverrideService.listExpiringSoon` to include user + permission joins; bulk renew/revoke surfaces rendered + disabled with "coming in Epic 3" tooltip) at C6, **SI-USR-008** AccountApprovalPage (route-only per DL-030 — wrapped in `<RequireRole role="superadmin">` with 403 panel fallback; intentionally NOT in nav) at C7. C8 Epic 1 RBAC audit replaced ad-hoc `useSession().user.role === 'brand_owner'` checks with `<RequirePermission>` across all 7 MDM pages and caught + fixed an over-permission bug in EnablementMatrixPage (previously allowed `procurement_manager` to edit despite ROLE_BASELINE not granting `mdm.enablement.write`); C9 closed Epic 1 chrome-freeze deferred gap by wiring DL-026 third-consumer (Categories CC-DUPLICATE-WARN now live via `useFindSimilarCategories` + `<CCDuplicateWarn>` on both create-top and create-sub paths). Chrome-freeze review (file at `docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md`) signed off "no drift; chrome consistent across both epics." **Token discipline: zero hex literals, no banned borders, Lucide-only, Inter-only, no `<Separator>`, foundation chrome reused throughout.** Cumulative diff vs main: +8,277 lines / -899 lines across 58 files. Typecheck silent + vite build clean + 15/15 e2e Playwright tests pass against real Mumbai Supabase Auth + apps/api on local fnberp_dev. New micro-decisions: **DL-030** (SI-USR-008 build-now route-only no-menu) + **DL-031** (MFA + SSO + custom role builder all post-MVP) + **DL-032** (incremental per-epic permissions catalog) + **DL-033** (DL-029 swap is single-commit big-bang) + **DL-034** (Arc (a) closes Epic 1 third-consumer gap via `categoryService.findSimilarByName`) — all written to `decision-log.md` at planning landing. **Next entry point: Phase 4 Epic 3 INF (Approval Engine + Notification Center + Audit Timeline) on a fresh chat** — same per-epic 3-arc structure.

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