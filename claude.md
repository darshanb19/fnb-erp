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
**Phase 2c-scoped — Visual mockup foundation (NEXT).** Phases 1, 2a, 2b, 2c-prep, 3a ✅ DONE (see `_planning/06-phase-roadmap.md` for canonical sequence). Phase 3a closed 2026-05-06: all §11 OQs RESOLVED per `_planning/architecture.md` + `decision-log.md` DL-001 → DL-021. Phase 2c-scoped executes the mockup harness build per `docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md`. Phase 4 (epic implementation) remains gated on Phase 2c-scoped closing.

## Phase 4 invariants (mirror of `_planning/06-phase-roadmap.md` §"Cross-phase invariants")

These commitments survive session resets. Source of truth is the roadmap; this is the auto-loaded mirror.

- **Per-epic 3-arc structure.** Each Phase 4 epic decomposes into 3 sub-sessions: (a) backend schema + service-layer + integration tests; (b) just-in-time mockups for that epic's deferred screens; (c) production frontend code consuming foundation chrome + new mockups + real services.
- **Chrome-freeze review gate per epic.** At the end of each Phase 4 epic, review cross-epic chrome consistency before the next epic starts. Drift = mandatory fix-back before the next epic begins. Prevents "mockups built during Epic N silently absorb Epic N's ad-hoc patterns" drift.
- **Tier 1 Acceptance Tag for deferred heroes.** The 12–13 leftover Tier 1 hero screens (Group 2 + Group 3) carry "Tier 1 acceptance applies even though built in Phase 4" tag. Tier 2 lighter-critique acceptance does NOT apply to these screens.
- **Phase boundary crossing discipline.** Crossing a phase boundary requires same-commit update of `## Current phase` in this file. The mechanism existed since Phase 2a; the discipline lapsed across 2b → 2c-prep → 3a-prep (caught in Phase-3a-prep critique 2026-05-05). Discipline now named explicitly to break the recurrence pattern.