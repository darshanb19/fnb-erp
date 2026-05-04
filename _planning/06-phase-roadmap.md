# Phase Roadmap — F&B ERP

> **Status:** Living document. Single canonical reference for "what phase are we in / what's next / what gates what".
> Authority: Master Spec §10 (epic ordering); claude.md §Current phase; this roadmap supersedes any phase ordering implied elsewhere.
> Last updated: 2026-05-05 (re-sequencing decision — Phase 3a Architecture moved BEFORE Phase 2c mockup work).

---

## Why this doc exists

Phases sprawled. Phase 2a → 2b → 2c-prep → 2c → (originally) 3a accumulated as decisions were made; the relationship between them was implicit across multiple plans + claude.md notes. This doc names the canonical sequence in one place so future sessions don't re-debate ordering.

The roadmap is **deliberately sequential, not parallel**, for solo-non-technical-founder workflow: each phase produces a concrete deliverable that the next phase consumes; deferring phases prevents speculative work that gets reworked when downstream decisions surface.

---

## Phase status table

| # | Phase | Status | Deliverable | Branch / Commit |
|---|---|---|---|---|
| 1 | Initial brainstorming | ✅ DONE | `_planning/01-brainstorming-summary.md` | merged to `main` |
| 2a | PRD review | ✅ DONE | `_planning/03-prd.md` (FR1–FR119) + `_planning/04-b2b-challan-spec.md` + `_planning/prd-review-notes.md` | PR #2 merged |
| 2b | Screen inventory | ✅ DONE | `_planning/05-screen-inventory.md` (112 screens, 12 epics, 21 CC-* patterns, 4 traceability appendices) | PR #4 merged |
| 2c-prep | DESIGN.md | ✅ DONE | `DESIGN.md` (M3 tokens, 19 status_* including 7 added in Phase-2b close-out, 5-layer surface hierarchy, type scale, motion, voice, tenant slot) | PR #3 merged + Phase-2b close additions |
| **3a** | **Architecture** | **🔄 NEXT** | `_planning/architecture.md` (resolves Master Spec §11 OQ1–OQ9; captures OQ9 already-decided; produces OQ10 column-mapping deliverable) | TBD branch |
| 2c-scoped | Visual mockup foundation | ⏸️ Gated by 3a | `mockups/` (Vite + shadcn + Tailwind v4; 13 foundation mockups: 10 chrome-bearing + 3 dual-surface partners + 2–3 most-novel workflow); `globals.css` token wiring; pre-commit hook; Vercel preview | `phase-2c-prep/mockup-plan` branch (plan committed, execution gated) |
| 4 | Epic implementation | ⏸️ Gated by 2c-scoped | Real working app, epic-by-epic per Master Spec §10 canonical order. Each epic = backend (Drizzle schema + services + API) + frontend (production code consuming foundation chrome) + just-in-time mockups for that epic's remaining screens. | TBD per-epic branches |

---

## Why this sequence (not the previous one)

Originally implied: 2c (all 89 mockups) → 3a (architecture) → 4 (epic implementation).

Re-sequenced 2026-05-05 to: **3a (architecture) → 2c-scoped (13 foundation mockups) → 4 (epic implementation with mockup-as-you-build)**.

Five reasons for the re-sequencing:

1. **Architecture decisions ripple into UI design.** OQ3 (real-time strategy), OQ4 (offline depth), OQ5 (PDF library), OQ7 (background jobs), OQ8 (caching) all directly shape what mockups should show. Mockups built before architecture risk aspirational designs the architecture can't deliver — requiring rework when reality surfaces.

2. **Master Spec §11 OQs are real gating decisions, not abstract.** They cover technology stacks (monorepo tool, deployment target, search engine, job runner), integration patterns (real-time strategy, caching layer, PDF generation), and architectural primitives. Mockups don't help discover these — the screen inventory + DESIGN.md already specify the desired UX/visual; architecture decides how to make it real.

3. **Foundation chrome benefits from architecture knowledge.** Building SI-RPT-002 (Brand Owner Dashboard) with knowledge of "dashboards refresh on demand via tRPC query, not real-time subscription" produces different design choices (visible refresh button, last-updated timestamp) than assuming real-time and discovering otherwise.

4. **Phase 4 epic implementation is cleaner.** Architecture done + foundation mockups done → each epic is "execute the spec for this epic" using both as reference. Cross-epic consistency stays high because both layers were locked first.

5. **Scope reduction is a real win.** 89 mockups upfront is a lot of work for a solo non-technical founder — and most of it is repetitive standard CRUD/list/admin patterns that the screen inventory already specifies and that engineers can build efficiently from inventory schema fields + foundation chrome reference. Foundation + most-novel patterns is enough mockup foundation.

---

## What each phase produces

### Phase 3a — Architecture (NEXT)

**Goal:** Resolve all open architectural decisions before any code or visual mockup work commits to a stack / pattern that may need to change.

**Deliverables:**
- `_planning/architecture.md` — canonical architecture document. Sections cover the 9 OQ resolutions + the OQ10 column-mapping spec + cross-cutting decisions (multi-tenancy implementation pattern per DESIGN.md §3.3, mockups-vs-production relationship, file-naming conventions for backend code).
- Decision-log entries (DL-002 onward) capturing each OQ resolution rationale.
- Optional: data model ERD, service-graph diagram, sequence diagrams for B2B challan two-stage journal flow / production order 5-status lifecycle / approval routing.

**OQs to resolve** (Master Spec §11):
- **OQ1** Monorepo tooling — Turborepo vs Nx vs pnpm workspaces
- **OQ2** Backend deployment — Railway vs Render vs Fly.io
- **OQ3** Real-time strategy — which events need WebSocket vs polling vs optimistic UI
- **OQ4** Offline capability depth — core for MVP or deferred; if core, which workflows
- **OQ5** PDF generation library — react-pdf vs puppeteer vs @react-pdf/renderer
- **OQ6** Full-text search strategy — PostgreSQL tsvector vs Meilisearch / Typesense
- **OQ7** Background job engine — BullMQ vs Inngest vs pg_cron via Supabase
- **OQ8** Caching layer — Redis vs TanStack Query client-side only
- **OQ9** UI design tool — ✅ already decided in Phase 2c-prep tooling review (in-repo Vite + shadcn + Tailwind via Claude Code workflow; NOT Stitch, NOT claude.ai Artifacts). Phase 3a captures this formally in `architecture.md` and `decision-log.md`.
- **OQ10** Accountant export format mapping — PRD-resolved (FR96); architecture phase produces column-name mapping spec for Tally + Zoho Books + Generic CSV

**Methodology:** `superpowers:brainstorming` per OQ; `superpowers:writing-plans` to firm into a Phase-3a build plan; decisions captured in `decision-log.md` as DL-NNN entries; final synthesis into `_planning/architecture.md`.

**Estimated:** 4–6 sessions across brainstorming + decision capture + plan-writing + architecture-doc synthesis.

**Closes when:** `_planning/architecture.md` lands with all 9 OQ decisions documented + OQ10 column-mapping spec; PR merged to main.

### Phase 2c-scoped — Visual mockup foundation (after 3a)

**Goal:** Validate the design system in real React+Tailwind code via 13 foundation mockups; produce shared shell components (~21 CC-* patterns) that Phase 4 epic implementation reuses.

**Deliverables:**
- `mockups/` Vite + shadcn + Tailwind v4 harness
- `mockups/src/globals.css` runtime token wiring (M3 tokens at `:root` + shadcn alias layer + tenant accent slot + empty `.dark` stub)
- `mockups/src/shell/` 21 shared components (one per CC-* pattern) + 6 wrapper overrides for shadcn primitives that conflict with DESIGN.md §5.2 / §5.4
- 13 mockup screens: Tier 1 Group 1 (10 chrome-bearing) + Tier 1 Group 4 (3 dual-surface partners) + 2–3 most-novel Group 2 workflow screens
- `mockups/src/dev/ComponentsIndex.tsx` permutation viewer
- Pre-commit hook for token enforcement
- Vercel preview deployment with PR-comment automation
- DESIGN.md edits: §5.3.1 glassmorphism opt-in, §10.5 animation library policy
- claude.md edit: `## Design token enforcement (Phase 2c+)` section + Current-phase update

**Sessions:** 3 (S2 scaffold + S3 Tier 1 G1 + S4 Tier 1 G4 + selected G2). See Phase 2c plan §16.

**Closes when:** Foundation chrome live on Vercel preview; design critique passes per Tier 1 screen; cross-screen consistency validated; 21 shell components + 13 mockup screens visible at `localhost:5173/_dev/components` and `localhost:5173/SI-XXX-###`.

### Phase 4 — Epic implementation (after 2c-scoped)

**Goal:** Build the actual working software, epic-by-epic, in canonical Master Spec §10 order.

**Per-epic scope (12 epic-implementation arcs):**
- Backend code: Drizzle schema for that epic's entities, service-layer methods per Master Spec §8 contracts, API surface per Phase 3a decisions, integration tests
- Frontend code: production-grade React+Tailwind screens for that epic, consuming the design system + foundation chrome from Phase 2c-scoped, with real auth / loading states / error boundaries / accessibility hardening
- Remaining mockups for that epic: built JUST-IN-TIME (Tier 2 + Tier 3 + Index entries that fall in this epic's scope)
- Stakeholder review: each epic's working software gets a review milestone; Vercel preview shows real working app, not mockups

**Canonical epic order (Master Spec §10):**
1. Epic 1 MDM (Master Data Management)
2. Epic 2 USR (User Management & Security)
3. Epic 3 INF (Shared Infrastructure — approval engine, notifications, audit, issue tracking)
4. Epic 4 INV (Inventory Management)
5. Epic 5 PUR (Procurement)
6. Epic 6 REC (Recipe Management)
7. Epic 7 PRO (Production Planning)
8. Epic 8 DSP (Dispatch & Distribution)
9. Epic 9 POS (POS Integration)
10. Epic 10 ACC (Accounting & Financial)
11. Epic 11 HRM (HRMS)
12. Epic 12 RPT (Analytics & Reporting)

**Sessions:** Many (4–8 sessions per epic, depending on complexity). Each epic produces its own plan via `superpowers:writing-plans`, executed via `superpowers:subagent-driven-development`.

**Closes when:** All 12 epics shipped; cross-epic integration tests pass; production-ready release candidate.

---

## Cross-phase invariants

1. **DESIGN.md is canonical** for every visual decision in every phase (Master Spec §3.3). Generation rules in claude.md `## Design token enforcement` enforce this at first-pass output; pre-commit hook enforces at commit boundary.
2. **Screen inventory `_planning/05-screen-inventory.md` is canonical** for every screen's schema (Purpose, Data displayed, User actions, Cross-cutting, Source FRs, Source journey). Phase 2c mockups + Phase 4 frontend code both reference inventory entries verbatim.
3. **Master Spec §10 epic order** is the canonical implementation sequence. Don't skip ahead.
4. **Master Spec §8 service contracts** (`inventoryService.deductStock()`, `approvalEngine`, `notificationCenter`, `accountingService`) are the canonical integration boundaries. Phase 3a refines their precise interface signatures; Phase 4 implements per epic.
5. **Decision-log (`decision-log.md`)** accumulates micro-decisions across phases. DL-001 already captured (Production Order canonical 5-status lifecycle). Phase 3a will produce DL-002 onward.
6. **prd-review-notes.md** accumulates phase close notes + ambiguities surfaced. Each phase appends a close note; Phase-2b close note is the most recent (2026-05-04).

---

## Phase 3a kickoff prompt (paste in fresh Claude Code session)

```
Phase 3a — Architecture. Starting fresh session.

This is the immediate next phase per _planning/06-phase-roadmap.md
re-sequencing decision (2026-05-05). Phase 2c (mockups) is GATED on
this phase closing. Architecture decisions ripple into UI design;
build architecture before mockups.

CLAUDE.md auto-loaded. Update "Current phase" line to:
"Phase 3a — Architecture. Resolving Master Spec §11 OQ1-OQ8 + OQ9
formal capture + OQ10 column-mapping deliverable. Phase 2c (visual
mockups, scoped) and Phase 4 (epic implementation) gated on this
closing. See _planning/06-phase-roadmap.md."

Working branch: create phase-3a/architecture off main. (Do NOT
continue on phase-2c-prep/mockup-plan — that's Phase 2c-prep work,
done.)

## Required reading (in order)

1. CLAUDE.md (auto-loaded; verify Current phase update lands first)
2. _planning/06-phase-roadmap.md — canonical phase sequence; this
   session executes Phase 3a per its definition there
3. _planning/02-master-spec.md §11 (Open Questions for Architecture
   Phase) — the 9 OQs to resolve + the OQ10 column-mapping carve-out
4. _planning/02-master-spec.md §8 (Service contracts) — interface
   signatures need refining as part of architecture
5. _planning/02-master-spec.md §3 (Tech stack) — what's already FINAL
   (Inter §3.1, shadcn/ui, DESIGN.md filename) vs what's open
6. decision-log.md — DL-001 (Production Order 5-status lifecycle)
   sets the format for DL-NNN entries this phase will produce
7. DESIGN.md §3 (Multi-tenancy) — tenant slot mechanism that
   architecture must implement at the data layer
8. _planning/05-screen-inventory.md §3 (CC-* catalogue) + §4 (roles
   & scope) for orientation on what the architecture must support
9. _planning/03-prd.md — read on demand for FR-specific architecture
   questions (e.g., FR84 POS sales import, FR98 integration dashboard)

## This session's scope

Use superpowers:brainstorming to work through the 9 open OQs in
sequence. Treat them as connected, not independent — many decisions
constrain each other (e.g., monorepo tooling affects deployment;
real-time strategy affects caching layer; background job engine
affects deployment target).

Suggested order (constraint-flow):
1. OQ1 Monorepo tooling — affects every downstream choice
2. OQ2 Backend deployment target — affects job engine + real-time
3. OQ8 Caching layer — affects real-time + search
4. OQ7 Background job engine — affects deployment + caching
5. OQ3 Real-time strategy — depends on caching + job engine
6. OQ6 Full-text search — independent enough to slot anywhere
7. OQ5 PDF generation — independent
8. OQ4 Offline capability depth — affects every screen's data layer
9. OQ9 UI design tool — already decided (in-repo Vite/shadcn);
   capture formally with rationale referencing Phase 2c-prep
   tooling review thread
10. OQ10 column-mapping deliverable — defer to plan-writing

Per-OQ flow:
- Brainstorm tradeoffs (real options, not strawman)
- Recommend with rationale
- User confirms or redirects
- Capture decision in decision-log.md as DL-NNN entry
- Move to next OQ

Plus one cross-cutting decision the roadmap surfaced:
- "Mockups visual reference vs production-code seed" — does the
  mockups/ harness become the production app, or does Phase 4 fork
  fresh code? Recommendation per roadmap: mockups as visual reference,
  production fresh. Confirm explicitly.

When all 9 OQs decided + cross-cutting "mockups vs production"
decision captured + OQ10 column-mapping deliverable scoped:
- Author docs/superpowers/plans/2026-MM-DD-phase-3a-architecture-build.md
  via superpowers:writing-plans skill (this is the writing-plans
  invocation per superpowers:brainstorming workflow)
- The plan covers: writing _planning/architecture.md (the canonical
  deliverable), producing the OQ10 column-mapping spec, optional
  diagrams (data model ERD, service graph, sequence diagrams)
- Plan execution may take 2-4 additional sessions

## Out of scope this session
- No code, no scaffold, no Drizzle schema authoring
- No mockup work
- No Phase 4 epic-implementation planning
- Don't pre-commit to specific table structures or service signatures
  beyond what the OQ resolutions imply

## Auto-mode posture
Brainstorming is INHERENTLY interactive. Auto mode active in source
session means execute the planning loop autonomously, but the OQ
resolutions themselves require user input — present tradeoffs, ask,
wait, capture. Don't decide unilaterally on OQ choices that affect
$$$ (deployment target, hosting tier) or fundamental tech stack
(monorepo tool).

Begin with brainstorming OQ1 (monorepo tooling).
```

---

## How to add a new phase

When a new phase emerges (e.g., Phase 5 — production deployment, Phase 6 — first 10 stores rollout), append to:

1. **Phase status table** above with deliverable + branch + status
2. **What each phase produces** section with goal, deliverables, methodology, sessions estimate, closes-when criteria
3. **Cross-phase invariants** if the new phase introduces a new invariant
4. **A kickoff prompt section** for that phase's first session

Update `claude.md` `## Current phase` line whenever phase boundary crosses.

Update `decision-log.md` with any phase-level decisions.

---

*End of roadmap — 2026-05-05*
