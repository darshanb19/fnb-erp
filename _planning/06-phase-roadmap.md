# Phase Roadmap — F&B ERP

> **Status:** Living document. Single canonical reference for "what phase are we in / what's next / what gates what".
> Authority: Master Spec §10 (epic ordering); claude.md §Current phase; this roadmap supersedes any phase ordering implied elsewhere.
> Last updated: 2026-05-06 (Phase 2c-scoped S2 scaffold landed; status: IN PROGRESS).

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
| 2c-prep | DESIGN.md | ✅ DONE\* | `DESIGN.md` (M3 tokens, 19 status_* including 7 added in Phase-2b close-out, 5-layer surface hierarchy, type scale, motion, voice, tenant slot) | PR #3 merged + Phase-2b close additions |
| 3a | Architecture | ✅ DONE | `_planning/architecture.md` (resolves Master Spec §11 OQ1–OQ8 + OQ11–OQ17; captures OQ9 already-decided per DL-004; produces OQ10 column-mapping deliverable) + 5 Mermaid diagrams (data ERD, service graph, B2B challan / production order / approval sequences) | `phase-3a/architecture` (PR pending — Task 31; will merge to `main` after PR review) |
| **2c-scoped** | **Visual mockup foundation** | **🔄 IN PROGRESS** | `mockups/` (Vite + shadcn + Tailwind v4; **15 foundation mockups** — 10 chrome-bearing + 3 dual-surface partners + 2 most-novel workflow [DSP-010 GST closure, PRO-011 In Progress transition]); `globals.css` token wiring; pre-commit hook; Vercel preview | `phase-2c/visual-mockups` branch — **S2 scaffold landed 2026-05-06** (Vite + Tailwind v4 + shadcn harness, 6-wrapper shell package, M3 token wiring, fixtures, pre-commit hook, AppShell + ComponentsIndex + ScreenIndex, DESIGN.md §5.3.1/§10.5 + claude.md token-enforcement edits, Vercel preview live). S3 (Tier 1 G1, 10 chrome-bearing screens) and S4 (Tier 1 G4 + DSP-010 + PRO-011) remain. Phase 2c-scoped closes after S4; PR to main at that point. Plan: `docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md` (§21 captures S2 scaffold notes; §21 supersedes §10/§13/§19 on contradictions). |
| 4 | Epic implementation | ⏸️ Gated by 2c-scoped | Real working app, epic-by-epic per Master Spec §10 canonical order. Each epic = backend (Drizzle schema + services + API) + frontend (production code consuming foundation chrome) + just-in-time mockups for that epic's remaining screens. | TBD per-epic branches |

> \* **2c-prep DONE\***: DESIGN.md §5.3.1 (glassmorphism opt-in) and §10.5 (animation library policy) amendments are scheduled to land in Phase 2c S2 per Phase 2c plan §10.10. Treat as carry-over — does not block Phase 3a kickoff.

---

## Why this sequence (not the previous one)

Originally implied: 2c (all 89 mockups) → 3a (architecture) → 4 (epic implementation).

Re-sequenced 2026-05-05 to: **3a (architecture) → 2c-scoped (15 foundation mockups) → 4 (epic implementation with mockup-as-you-build)**.

Five reasons for the re-sequencing:

1. **Architecture decisions ripple into UI design.** OQ3 (real-time strategy), OQ4 (offline depth), OQ5 (PDF library), OQ7 (background jobs), OQ8 (caching) all directly shape what mockups should show. Mockups built before architecture risk aspirational designs the architecture can't deliver — requiring rework when reality surfaces.

2. **Master Spec §11 OQs are real gating decisions, not abstract.** They cover technology stacks (monorepo tool, deployment target, search engine, job runner), integration patterns (real-time strategy, caching layer, PDF generation), and architectural primitives. Mockups don't help discover these — the screen inventory + DESIGN.md already specify the desired UX/visual; architecture decides how to make it real.

3. **Foundation chrome benefits from architecture knowledge.** Building SI-RPT-002 (Brand Owner Dashboard) with knowledge of "dashboards refresh on demand via REST query (Master Spec §3.2 FINAL), not Realtime subscription (Master Spec §3.1 FINAL — used selectively per OQ3 triage)" produces different design choices (visible refresh button, last-updated timestamp) than assuming real-time and discovering otherwise.

4. **Phase 4 epic implementation is cleaner.** Architecture done + foundation mockups done → each epic is "execute the spec for this epic" using both as reference. Cross-epic consistency stays high because both layers were locked first.

5. **Scope reduction is a real win.** 89 mockups upfront is a lot of work for a solo non-technical founder — and most of it is repetitive standard CRUD/list/admin patterns that the screen inventory already specifies and that engineers can build efficiently from inventory schema fields + foundation chrome reference. Foundation + most-novel patterns is enough mockup foundation.

---

## What each phase produces

### Phase 3a — Architecture (✅ DONE — 2026-05-06)

**Goal:** Resolve all open architectural decisions before any code or visual mockup work commits to a stack / pattern that may need to change.

**Deliverables:**
- `_planning/architecture.md` — canonical architecture document. Sections cover the 9 OQ resolutions + the OQ10 column-mapping spec + cross-cutting decisions (multi-tenancy implementation pattern per DESIGN.md §3.3, mockups-vs-production relationship, file-naming conventions for backend code).
- Decision-log entries (DL-002 onward) capturing each OQ resolution rationale.
- Optional: data model ERD, service-graph diagram, sequence diagrams for B2B challan two-stage journal flow / production order 5-status lifecycle / approval routing.

**OQs to resolve** (Master Spec §11):
- **OQ1** Monorepo tooling — Turborepo vs Nx vs pnpm workspaces
- **OQ2** Backend deployment — Railway vs Render vs Fly.io
- **OQ3** Real-time strategy — which events need WebSocket vs polling vs optimistic UI (constrained by §3.1 Supabase Realtime FINAL — scope is event-triage, not vendor selection)
- **OQ4** Offline capability depth — core for MVP or deferred; if core, which workflows
- **OQ5** PDF generation library — react-pdf vs puppeteer vs @react-pdf/renderer
- **OQ6** Full-text search strategy — PostgreSQL tsvector vs Meilisearch / Typesense
- **OQ7** Background job engine — BullMQ vs Inngest vs pg_cron via Supabase
- **OQ8** Caching layer — Redis additionally for hot paths? (constrained by §3.1 TanStack Query FINAL — scope is "Redis additionally?", not binary cache choice)
- **OQ9** UI design tool — ✅ RESOLVED in Phase 2c-prep tooling review (in-repo Vite + shadcn + Tailwind via Claude Code workflow; NOT Stitch, NOT claude.ai Artifacts). Phase 3a captures this formally in `architecture.md` referencing DL-004.
- **OQ10** Accountant export format mapping — PRD-resolved (FR96); architecture phase produces column-name mapping spec for Tally + Zoho Books + Generic CSV
- **OQ11** Multi-tenant query pattern enforcement — Express middleware vs Drizzle wrapper vs `withBrand` builder
- **OQ12** Audit trail mechanism — trigger-based vs application-layer (FR20/21 + CC-AUDIT-LINK)
- **OQ13** File storage layout — per-brand vs per-entity bucket; signed-URL vs direct upload (FR39, FR81)
- **OQ14** RLS policy authoring strategy — when, by whom, from what template
- **OQ15** brand_id index migration template — canonical Drizzle helper / migration template per §3.2
- **OQ16** Notification Center transport + dispatch model — Supabase Realtime in-app + email transport (Resend/Postmark?) + dispatch model (queue/direct/batched per FR19)
- **OQ17** Concurrency / idempotency — advisory locks vs optimistic-with-version for `inventoryService.deductStock`; idempotency keys for IRN paste (DSP-010) + PO approval (PUR-004)

**Methodology:** `superpowers:brainstorming` per OQ; `superpowers:writing-plans` to firm into a Phase-3a build plan; decisions captured in `decision-log.md` as DL-NNN entries; final synthesis into `_planning/architecture.md`.

**Estimated:** 4–5 sessions across brainstorming + decision capture + plan-writing + architecture-doc synthesis.

**Closes when:** `_planning/architecture.md` lands with all OQ1–OQ8 + OQ11–OQ17 decisions documented + OQ9 formal capture + OQ10 column-mapping spec; PR merged to main.

**Closure note (2026-05-06).** Phase 3a closed 2026-05-06. 16 OQs resolved (OQ1–OQ8 + OQ10–OQ17; OQ9 captured per DL-004 already-resolved at Phase 2c-prep), `_planning/architecture.md` authored across 21 sections in 3 sessions (A: §1–§9; B: §10–§21; C: OQ10 + 5 diagrams + Master Spec §11 status updates). 5 Mermaid diagrams committed under `_planning/architecture-diagrams/`. Master Spec §11 status updated; §3.1 Backend deployment row marked FINAL; §3.3 SUPERSEDED notice added per DL-004.

### Phase 2c-scoped — Visual mockup foundation (🔄 IN PROGRESS — S2 scaffold landed 2026-05-06)

**Goal:** Validate the design system in real React+Tailwind code via 15 foundation mockups; produce shared shell components (~21 CC-* patterns) that Phase 4 epic implementation reuses.

**Deliverables:**
- `mockups/` Vite + shadcn + Tailwind v4 harness
- `mockups/src/globals.css` runtime token wiring (M3 tokens at `:root` + shadcn alias layer + tenant accent slot + empty `.dark` stub)
- `mockups/src/shell/` 21 shared components (one per CC-* pattern) + 6 wrapper overrides for shadcn primitives that conflict with DESIGN.md §5.2 / §5.4
- **15 mockup screens**: Tier 1 Group 1 (10 chrome-bearing) + Tier 1 Group 4 (3 dual-surface partners) + 2 most-novel Group 2 workflow screens (**DSP-010 GST closure** + **PRO-011 In Progress transition**)
- `mockups/src/dev/ComponentsIndex.tsx` permutation viewer
- Pre-commit hook for token enforcement
- Vercel preview deployment with PR-comment automation
- DESIGN.md edits: §5.3.1 glassmorphism opt-in, §10.5 animation library policy
- claude.md edit: `## Design token enforcement (Phase 2c+)` section + Current-phase update

**Sessions:** 3 (S2 scaffold ✅ DONE 2026-05-06 + S3 Tier 1 G1 + S4 Tier 1 G4 + selected G2 [DSP-010 + PRO-011]). See Phase 2c plan §16. S2 scaffold notes captured in plan §21.

**Closes when:** Foundation chrome live on Vercel preview; design critique passes per Tier 1 screen; cross-screen consistency validated; 21 shell components + 15 mockup screens visible at `localhost:5173/_dev/components` and `localhost:5173/SI-XXX-###`. PR `phase-2c/visual-mockups` → `main` opens at S4 close (single consolidated PR per plan §16 cadence; matches Phase 3a's PR #8 pattern).

### Phase 4 — Epic implementation (after 2c-scoped)

**Goal:** Build the actual working software, epic-by-epic, in canonical Master Spec §10 order.

**Per-epic 3-arc structure** (canonical for every Phase 4 epic):
- **Arc (a) — Backend.** Drizzle schema for that epic's entities, service-layer methods per Master Spec §8 contracts, API surface per Phase 3a decisions, integration tests.
- **Arc (b) — Just-in-time mockups.** Tier 2 / Tier 3 / Index mockups for this epic's deferred screens, plus any leftover Tier 1 hero screens (Group 2 + Group 3) carrying the **Tier 1 Acceptance Tag** — full Tier 1 acceptance applies even though built mid-Phase-4. Tier 2 lighter-critique acceptance does NOT apply to tagged screens.
- **Arc (c) — Production frontend.** Production-grade React+Tailwind screens for that epic, consuming the design system + foundation chrome from Phase 2c-scoped + new mockups from Arc (b) + real services from Arc (a), with real auth / loading states / error boundaries / accessibility hardening.

**Chrome-freeze review gate per epic.** At the end of each Phase 4 epic, review cross-epic chrome consistency before the next epic starts. Mockups built during Epic N can silently absorb Epic N's ad-hoc patterns without propagating back to earlier mockups; the gate catches this. Drift = mandatory fix-back before the next epic begins.

**Stakeholder review:** each epic's working software gets a review milestone; Vercel preview shows real working app, not mockups.

**Known chrome gaps (patterns NOT exercised by foundation 15 mockups; first surface in Phase 4):**
- **CC-IMPLAUSIBILITY-WARN** — first surfaces in Epic 4 INV (closing inventory POS, possibly GR Entry on mobile)
- **CC-VOICE-INPUT** — first surfaces in Epic 4 INV (mobile-first data entry contexts) and Epic 7 PRO (production output entry)
- **CC-DUPLICATE-WARN** — first surfaces wherever its host screen is defined (verify CC catalogue when that screen builds)

> **Note:** CC-PROVISIONAL-FLAG, CC-GST-FIELD-VALIDATION, and CC-UNREGISTERED-CUSTOMER-WARN are exercised by DSP-010 + PRO-011 in the foundation per the hybrid mockup-widening; not in this gap list. CC-OVERRIDE-WIDGET is exercised by SI-RPT-002 in foundation Group 1; not in this gap list. The chrome-freeze gate above is the active mitigation when these patterns first surface — verify retroactive applicability across already-built screens at gate time.

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
5. **Decision-log (`decision-log.md`)** accumulates micro-decisions across phases. DL-001 (Production Order 5-status lifecycle), DL-002 (Tailwind v4), DL-003 (re-sequencing), DL-004 (OQ9 capture), DL-005 (mockups-vs-production) already captured at Phase 3a-prep close. Phase 3a will produce DL-006 onward.
6. **prd-review-notes.md** accumulates phase close notes + ambiguities surfaced. Each phase appends a close note; Phase-2b close note is the most recent (2026-05-04).
7. **Phase 4 per-epic 3-arc structure** is canonical for every epic (per "Phase 4 — Epic implementation" section above): backend → just-in-time mockups (with Tier 1 Acceptance Tag for deferred heroes) → production frontend. Don't merge arcs.
8. **Chrome-freeze review gate per Phase 4 epic** is mandatory: cross-epic chrome consistency review at every epic close before next epic begins. Drift = fix-back before continuing.
9. **Phase boundary crossing requires same-commit update of `## Current phase`** in `claude.md`. The mechanism existed since Phase 2a; the discipline lapsed across 2b → 2c-prep → 3a-prep (caught in Phase-3a-prep critique 2026-05-05). Naming this discipline explicitly to break the recurrence pattern.
10. **This roadmap (`_planning/06-phase-roadmap.md`)** is itself an invariant doc. Every phase that crosses a boundary or changes a deliverable scope must update this roadmap in the same commit. Self-referentially: keep this doc current, or it stops being canonical.

---

## Phase 2c-scoped Session 3 kickoff prompt (paste in fresh Claude Code session)

> **Note:** Phase 3a kickoff prompt that lived here previously is removed (Phase 3a closed 2026-05-06; the prompt is no longer load-bearing). Per the doc's pattern, kickoff prompts cover the *next* fresh-session entry point.

```
Phase 2c — Visual mockups. Session 3: Tier 1 Group 1 build (10 chrome-bearing screens).

Phase 2c-S2 scaffold closed 2026-05-06 on branch phase-2c/visual-mockups
(11 commits, pushed). The harness is live: Vite + React 18 + Tailwind v4
+ shadcn/ui, M3 token wiring per DESIGN.md §5–§8, 6-wrapper shell
package (Card, SectionShift, Table, Input, Button, Popover), Indian
F&B sample-data fixtures, pre-commit token hook, AppShell skeleton
with Wild Sugar branding, ComponentsIndex permutation viewer at
/_dev/components, ScreenIndex placeholder list at /. DESIGN.md §5.3.1
+ §10.5 + claude.md token-enforcement section also landed.

Sanity-check before starting:
  git checkout phase-2c/visual-mockups && git pull
  cd mockups && npm install && npm run dev   # localhost:5173

If you cloned fresh, also run from repo root:
  git config core.hooksPath mockups/.git-hooks

## Required reading (in order)

1. CLAUDE.md — note the new "Design token enforcement (Phase 2c+)"
   section that layers atop the pre-commit hook
2. docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md
   — §6 Group 1 build order (the 10 screens), §11 Tier 1 acceptance,
   §21 Scaffold notes (as-built record; supersedes §10/§13/§19 on
   contradictions). 20 status tokens, not 19. Lucide-name renames in
   §21.2. ComponentsIndex inline-style pattern in §21.9.
3. _planning/05-screen-inventory.md — read the 12 schema fields for
   each of the 10 Group 1 screens (SI-RPT-002, INF-005, INF-001,
   RPT-005, ACC-003, ACC-013, INV-001, PUR-003, MDM-003, MDM-004).
   These are the 12 things every Tier 1 screen must visibly satisfy.
4. DESIGN.md — full read; §5.4 surface hierarchy + §6 status palette
   + §7.2 type scale + §12 component quick-reference are the most
   load-bearing for Tier 1.
5. _planning/architecture.md — for any data-fetching / real-time /
   file-storage / auth UX that's referenced in a screen's chrome.

## This session's scope

Build the 10 Tier 1 Group 1 chrome-bearing screens per plan §6:
  1. SI-RPT-002 — Brand Owner Cross-Location Dashboard
  2. SI-INF-005 — Audit Trail Viewer
  3. SI-INF-001 — Unified Approval Inbox
  4. SI-RPT-005 — Report Detail Runner
  5. SI-ACC-003 — Trial Balance
  6. SI-ACC-013 — Integration Status Dashboard
  7. SI-INV-001 — Real-Time Stock View
  8. SI-PUR-003 — PO Detail & Lifecycle Status
  9. SI-MDM-003 — Product Master CRUD
 10. SI-MDM-004 — Material Enablement Matrix

Establish the 21 CC-* shell components along the way (catalogue in
inventory §3) — first Tier 1 instance establishes each CC-* surface;
later screens reuse them. StatusPill is the canonical first build.

Tier 1 acceptance per plan §11: all 12 inventory schema fields visibly
satisfied; only DESIGN.md tokens; D2C-002 voice; ≥44 px tap targets on
mobile; WCAG 2.1 AA pass; authentic Wild Sugar / Indian F&B fixtures
(consume from mockups/src/lib/sample-data.ts); design:design-critique
returns ✅.

Per-screen workflow (apply via subagent-driven-development OR
one-screen-per-session if context budget tightens):
  1. Read the inventory entry's 12 fields
  2. Identify which CC-* shell components the screen needs; build the
     ones not yet built (StatusPill first, others as triggered)
  3. Author the screen file at mockups/src/screens/{epic}/{ID}.tsx
  4. Wire the route in App.tsx (replaces ScreenStub for that ID)
  5. Run design:design-critique on the JSX file; fix until ✅
  6. Run design:accessibility-review (Tier 1 only); fix until ✅
  7. Verify pre-commit hook passes
  8. Commit per screen; push; reactive stakeholder review via Vercel
     preview URL after each commit

Methodology: superpowers:subagent-driven-development with
test-driven-development + verification-before-completion per screen.

If context budget approaches 60–70% mid-build, split into S3a
(first 5 screens) + S3b (remaining 5) per plan §16 float clause.

## Out of scope this session

- Group 2 (workflow-weighted) — Session 4
- Group 3 (per-persona daily drivers) — Phase 4
- Group 4 (FCCC dual-surface, paired transfer) — Session 4
- Tier 2 / Tier 3 / Index — Phase 4 epic-by-epic
- Real backend wiring — Phase 4
- Merge to main — happens at Phase 2c-scoped close (after S4) per
  plan §16 cadence; do NOT open mid-phase PR to main

## Auto-mode posture

Inherit from prior session. Surface for confirmation only when:
- design:design-critique surfaces an irreducible spec contradiction
- A new CC-* pattern emerges that needs cataloguing in inventory §3
- Pre-commit hook fires repeatedly on a pattern that signals a deeper
  rule design issue

Begin with screen 1 (SI-RPT-002) — Brand Owner Cross-Location
Dashboard. This screen anchors three CC-* patterns: CC-DASHBOARD-TILE,
CC-OVERRIDE-WIDGET (P2B-005), CC-PENDING-GR-DRILL. Building it first
establishes dashboard chrome reused by every future dashboard.
```

---

### Historical: Phase 3a kickoff prompt (Phase 3a closed 2026-05-06)

The original Phase 3a kickoff prompt is preserved in git history; pulling it forward is unnecessary now that the phase is closed. Run `git log -p _planning/06-phase-roadmap.md` if you need the verbatim text for archival reasons.

```
Phase 3a — Architecture. Starting fresh session.

This is the immediate next phase per _planning/06-phase-roadmap.md
re-sequencing decision (2026-05-05). Phase 2c (mockups) is GATED on
this phase closing. Architecture decisions ripple into UI design;
build architecture before mockups.

CLAUDE.md auto-loaded — `## Current phase` already updated to
"Phase 3a — Architecture (NEXT)" at Phase-3a-prep close (2026-05-05).
No edit needed at session start; just verify it reads "Phase 3a"
not "Phase 2a" before proceeding. If stale, fix as the first edit.

Working branch: create phase-3a/architecture off main. (Do NOT
continue on phase-2c-prep/mockup-plan — that's Phase 2c-prep work,
done.)

## Required reading (in order)

1. CLAUDE.md (auto-loaded; verify Current phase update lands first)
2. _planning/06-phase-roadmap.md — canonical phase sequence; this
   session executes Phase 3a per its definition there
3. _planning/02-master-spec.md §11 (Open Questions for Architecture
   Phase) — 16 still-open OQs (OQ1–OQ8 + OQ11–OQ17) to resolve +
   OQ9 formal capture per DL-004 + OQ10 PRD-resolved column-mapping
   carve-out; plus the non-exhaustive footnote
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

**Before brainstorming each OQ, read Master Spec §3.1 + §3.2 to
confirm what's already locked. Don't re-debate FINAL decisions.**
For OQ3, scope is event-triage (Supabase Realtime is FINAL — not
vendor selection); for OQ8, scope is "Redis additionally?" (TanStack
Query is FINAL — not binary cache choice); for OQ9, scope is formal
capture of the Phase 2c-prep decision per DL-004 (no re-debate).
For OQ11–OQ17, scope is fresh resolution.

Use superpowers:brainstorming to work through the 16 still-open
OQs in sequence. Treat them as connected, not independent — many
decisions constrain each other (e.g., monorepo tooling affects
deployment; real-time strategy affects caching layer; background
job engine affects deployment target).

Suggested order (constraint-flow):
1. OQ1 Monorepo tooling — affects every downstream choice
2. OQ2 Backend deployment target — affects job engine + real-time
3. OQ8 Caching layer (Redis additionally?) — affects real-time + search
4. OQ7 Background job engine — affects deployment + caching
5. OQ3 Real-time strategy (event-triage) — depends on caching + job engine
6. OQ16 Notification Center transport + dispatch — depends on OQ7 + OQ3
7. OQ11 Multi-tenant query pattern — affects every service implementation
8. OQ12 Audit trail mechanism — affects schema + service-layer wrappers
9. OQ14 RLS policy authoring strategy — depends on OQ11 + OQ12
10. OQ15 brand_id index migration template — depends on OQ11
11. OQ17 Concurrency / idempotency — affects DL-001 deductStock atomicity
12. OQ13 File storage layout — independent enough to slot anywhere
13. OQ6 Full-text search — independent
14. OQ5 PDF generation — independent
15. OQ4 Offline capability depth — affects every screen's data layer
16. OQ9 UI design tool — RESOLVED per DL-004 (in-repo Vite/shadcn);
    capture formally in architecture.md, no re-debate
17. OQ10 column-mapping deliverable — defer to plan-writing

Per-OQ flow:
- Brainstorm tradeoffs (real options, not strawman)
- Recommend with rationale
- User confirms or redirects
- Capture decision in decision-log.md as DL-NNN entry
- Move to next OQ

Note on already-captured cross-cutting decision:
- "Mockups visual reference vs production-code seed" — RESOLVED at
  Phase-3a-prep close per DL-005 (mockups = visual specification,
  production = fresh code in apps/web + apps/api per Master Spec
  §3.2 monorepo structure; 21 shell components copy-port one-time
  at Phase 4 start). No re-debate; capture in architecture.md
  referencing DL-005.

When all 16 still-open OQs decided + OQ9 formal capture + OQ10
column-mapping deliverable scoped:
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

*End of roadmap — last edit 2026-05-06 (Phase 2c-scoped S2 scaffold landed; status badge + branch + Session-3 kickoff prompt updated; Phase 3a kickoff prompt demoted to historical artefact)*
