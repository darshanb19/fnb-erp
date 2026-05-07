# Phase Roadmap — F&B ERP

> **Status:** Living document. Single canonical reference for "what phase are we in / what's next / what gates what".
> Authority: Master Spec §10 (epic ordering); claude.md §Current phase; this roadmap supersedes any phase ordering implied elsewhere.
> Last updated: 2026-05-07 (Phase 4 Epic 1 MDM Arc (a) backend ✅ DONE — schema + services + REST routes + 178 tests green on `phase-4/epic-1-mdm-arc-a-backend` with new micro-decisions DL-027 + DL-028; **Arc (b) just-in-time mockups is the next entry point on a fresh chat against `phase-4/epic-1-mdm-arc-b-mockups`** once Arc (a) merges).

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
| 2c-scoped | Visual mockup foundation | ✅ DONE | `mockups/` (Vite + shadcn + Tailwind v4; **15 foundation mockups** — 10 chrome-bearing + 3 dual-surface partners + 2 most-novel workflow [DSP-010 GST closure, PRO-011 In Progress transition]); `globals.css` token wiring; pre-commit hook; Vercel preview | `phase-2c/visual-mockups` branch — **S2 scaffold landed 2026-05-06** + **S3 Tier 1 G1 landed 2026-05-06** (10 chrome-bearing screens — SI-RPT-002, SI-INF-005, SI-INF-001, SI-RPT-005, SI-ACC-003, SI-ACC-013, SI-INV-001, SI-PUR-003, SI-MDM-003, SI-MDM-004 — plus 13 new CC-* shell components: StatusPill, DashboardTile, OverrideWidget, PendingGRDrill, DataQualityAlert, ExportTrigger, AuditLink, ApprovalInboxCard, TrnDisplay, ProvisionalFlag, LifecycleStepper, IssueTicketLink, DraftPill) + **S4 landed 2026-05-07** (5 most-novel screens — SI-ACC-010, SI-RPT-006, SI-INV-007, SI-DSP-010, SI-PRO-011 — plus 4 new CC-* shell components: FCCCDualSurface, PairedTransferBundle, GSTFieldValidation, UnregisteredCustomerWarn — plus additive PRODUCTION_ORDER_LIFECYCLE_STEPS export on the existing LifecycleStepper). PR `phase-2c/visual-mockups` → `main` opens at S4 close per plan §16 cadence. Plan: `docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md` (§21 captures S2 scaffold notes; §21 supersedes §10/§13/§19 on contradictions). |
| **4** | **Epic implementation** | **🔄 IN PROGRESS** | Real working app, epic-by-epic per Master Spec §10 canonical order. Each epic = backend (Drizzle schema + services + API) + just-in-time mockups (Tier 1 Acceptance Tag for deferred Group 2 + Group 3 heroes; Tier 2 / Tier 3 / Index for the rest) + production frontend consuming foundation chrome from Phase 2c-scoped. Chrome-freeze review gate at every epic boundary. **Epic 1 MDM kickoff complete 2026-05-07** — brainstorming Q1–Q7 → DL-022 → DL-026; canonical implementation plan at `docs/superpowers/plans/2026-05-07-phase-4-epic-1-mdm-build.md` (3 arcs, ~34 tasks). **Epic 1 Arc (a) backend ✅ DONE 2026-05-07** — Drizzle schema (org + inventory partial + procurement vendors-only + audit_log carve-out per DL-028) + 7 services (orgService DL-022, productService DL-023 + DL-026, categoryService, vendorService §2.7, inventoryService.checkEnablement, companyService DL-024 edit-only, auditLogService) + 31 REST routes + 178 tests green (1 skipped — DL-013 trigger backstop deferred to Phase 3a follow-up); zero `any`; brand seed idempotent; CI workflow (typecheck + test) shipped; new micro-decisions DL-027 (brandedDb explicit scoped methods) + DL-028 (audit_log carve-out). **Arc (b) just-in-time mockups is the next entry point** on a fresh chat against `phase-4/epic-1-mdm-arc-b-mockups` once Arc (a) merges. | `phase-4/epic-1-mdm-plan` (planning PR #13) → `phase-4/epic-1-mdm-arc-a-backend` (Arc (a) backend PR — next to open) → `phase-4/epic-1-mdm-arc-b-mockups` + `phase-4/epic-1-mdm-arc-c-frontend` open per-arc as each starts |

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

### Phase 2c-scoped — Visual mockup foundation (✅ DONE 2026-05-07)

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

**Sessions:** 3 — all closed. S2 scaffold ✅ DONE 2026-05-06 (Vite + Tailwind v4 + shadcn harness; 21 shell components; pre-commit hook; tokens.ts canonical mirror). S3 Tier 1 G1 ✅ DONE 2026-05-06 (10 chrome-bearing screens, 13 new CC-* shell components). **S4 Tier 1 G4 + selected G2 ✅ DONE 2026-05-07** — 5 most-novel screens (SI-ACC-010, SI-RPT-006, SI-INV-007, SI-DSP-010, SI-PRO-011) + 4 new CC-* shells (FCCCDualSurface, PairedTransferBundle, GSTFieldValidation, UnregisteredCustomerWarn) + additive PRODUCTION_ORDER_LIFECYCLE_STEPS export on the existing LifecycleStepper. See Phase 2c plan §16. S2 scaffold notes captured in plan §21.

**Closure note (2026-05-07).** Phase 2c-scoped closed 2026-05-07. 15 foundation mockups live; 4 new CC-* shells anchored in S4; cross-link state contract verified for the FCCC dual-surface pair via URL search params (item / period / scope / comparison preserved across the tab switch); LifecycleStepper's prop-driven `steps` abstraction held for the new DL-001 production-order lifecycle without shell-level patching beyond the additive export; CC-PROVISIONAL-FLAG / CC-GST-FIELD-VALIDATION / CC-UNREGISTERED-CUSTOMER-WARN exercised early via the hybrid widening (DSP-010 + PRO-011). PR `phase-2c/visual-mockups` → `main` opens at S4 close (single consolidated PR per plan §16 cadence; mirrors Phase 3a's PR #8 pattern).

**Closed when (criteria all met):** Foundation chrome live on Vercel preview ✅; per-screen design critique passes ✅ (S3 closed each Tier 1 screen; S4 spec-compliance reviewer ran on the FCCC pair); cross-screen consistency validated ✅; 21 shell components + 15 mockup screens visible at `localhost:5173/_dev/components` and `localhost:5173/SI-XXX-###` ✅.

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

## Phase 2c-scoped Session 4 kickoff prompt (HISTORICAL — DEMOTED 2026-05-07 AFTER S4 CLOSED)

> **Note:** Per the doc's pattern, kickoff prompts cover the *next* fresh-session entry point. Phase 3a kickoff prompt was demoted to historical 2026-05-06; Phase 2c-S3 kickoff prompt was demoted to historical 2026-05-06 after S3 closed; **Phase 2c-S4 kickoff prompt below was demoted to historical 2026-05-07 after S4 closed and Phase 2c-scoped fully closed.** All preserved in git history; pull via `git log -p _planning/06-phase-roadmap.md` if needed. **Next fresh-session entry point: Phase 4 Epic 1 MDM kickoff** — that prompt will be authored when Epic 1 is ready to start (after this PR merges and Epic 1 plan is written via `superpowers:writing-plans`).

```
Phase 2c — Visual mockups. Session 4: Tier 1 Group 4 + selected G2
(5 screens; closes Phase 2c-scoped).

Phase 2c-S3 Tier 1 Group 1 closed 2026-05-06 on branch
phase-2c/visual-mockups (12 commits, pushed). HEAD: 23a5b0f.

The harness now ships:
- 10 chrome-bearing screens at /SI-RPT-002, /SI-INF-005, /SI-INF-001,
  /SI-RPT-005, /SI-ACC-003, /SI-ACC-013, /SI-INV-001, /SI-PUR-003,
  /SI-MDM-003, /SI-MDM-004
- 13 new CC-* shell components in mockups/src/shell/ (re-exported
  from shell/index.ts): StatusPill, DashboardTile, OverrideWidget,
  PendingGRDrill, DataQualityAlert, ExportTrigger, AuditLink,
  ApprovalInboxCard, TrnDisplay, ProvisionalFlag, LifecycleStepper,
  IssueTicketLink, DraftPill
- ComponentsIndex permutations for every shell at /_dev/components
- DESIGN.md token enforcement section in CLAUDE.md + pre-commit
  hook live; both unchanged from S2

Sanity-check before starting:
  git checkout phase-2c/visual-mockups && git pull
  cd mockups && npm install && npm run dev   # localhost:5173

If you cloned fresh, also run from repo root:
  git config core.hooksPath mockups/.git-hooks

## Required reading (in order)

1. CLAUDE.md — full file. The "Current phase" line was updated
   2026-05-06 to record S3 close; the "Design token enforcement
   (Phase 2c+)" section is unchanged but still binding.
2. docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md
   — §6 Group 4 (lines 372–376), §6 Group 2 (lines 351–362; only
   DSP-010 + PRO-011 land in S4 — the rest carry the Tier 1
   Acceptance Tag and land mid-Phase-4 per the chrome-freeze gate),
   §11 Tier 1 acceptance, §16 session breakdown (especially line
   800 — DSP-010 + PRO-011 hybrid widening exercises CC-PROVISIONAL-
   FLAG, CC-GST-FIELD-VALIDATION, CC-UNREGISTERED-CUSTOMER-WARN
   early), §21 Scaffold notes (still the as-built record).
3. _planning/05-screen-inventory.md — read the 12 schema fields
   for each of the 5 S4 screens:
   - SI-ACC-010 — FCCC Financial Framing
   - SI-RPT-006 — FCCC Operational Analytics Framing
   - SI-INV-007 — Paired Brand-Store Cross-Cluster Transfer
   - SI-DSP-010 — B2B GST Closure
   - SI-PRO-011 — In Progress Transition Confirm
   Also re-read inventory §3 cross-cutting catalogue — the new CC-*
   patterns this session anchors are CC-FCCC-DUAL-SURFACE,
   CC-PAIRED-TRANSFER-BUNDLE, CC-GST-FIELD-VALIDATION,
   CC-UNREGISTERED-CUSTOMER-WARN.
4. _planning/04-b2b-challan-spec.md — supplementary spec for B2B
   dispatch + GST closure. SI-DSP-010 is the FR78 hero; this spec
   defines the IRN paste + Stage 2 journal atomicity contract.
5. DESIGN.md — refresh §6.5 (Provisional flag visual treatment),
   §6.1 status palette (status_overridden, status_provisional,
   status_pending_gr for PRO-011), §12.5 severity-coded alert rows.
6. _planning/architecture.md — useful for ACC-010 + RPT-006 cross-
   link state contract (the pair shares underlying queries + drill-
   down state per FR95/FR108) and DSP-010 IRN-paste atomic-write
   pattern. Not strictly required for visual fidelity.

## This session's scope

Build the 5 S4 mockups in this order (per plan §6 + §16):

1. SI-ACC-010 — FCCC Financial Framing
2. SI-RPT-006 — FCCC Operational Analytics Framing
   *Build immediately after #1 to validate cross-link + shared drill
   state contract. Anchors CC-FCCC-DUAL-SURFACE — the implicit
   Pass-C parking-lot item. The new <FCCCDualSurface> shell should
   be designed in #1 with both halves in mind so #2 plugs in
   cleanly.*
3. SI-INV-007 — Paired Brand-Store Cross-Cluster Transfer
   *Anchors CC-PAIRED-TRANSFER-BUNDLE / P2B-002. Bundled approval
   object surfaces in SI-INF-001 — verify the inbox card built in
   S3 still renders the bundle correctly after this screen lands.*
4. SI-DSP-010 — B2B GST Closure
   *FR78 hero. Anchors CC-GST-FIELD-VALIDATION,
   CC-UNREGISTERED-CUSTOMER-WARN. Exercises the existing
   CC-PROVISIONAL-FLAG (built in S3 via SI-INV-001).*
5. SI-PRO-011 — In Progress Transition Confirm
   *Atomic deduction + COGS journal fire. Exercises the existing
   <LifecycleStepper> against the production-order lifecycle
   (DL-001: Draft → Pending GR → Confirmed → In Progress →
   Completed). Likely no new shell — verify the stepper's
   prop-driven steps array supports the production lifecycle as
   designed in S3.*

New CC-* shells to build along the way:
- FCCCDualSurface (#1 + #2 — design with both halves in scope)
- PairedTransferBundle (#3)
- GSTFieldValidation (#4)
- UnregisteredCustomerWarn (#4)
- (PRO-011 should consume existing shells; new shell only if a
  truly novel pattern emerges — surface as confirmation point)

Stretch goal if S4 has bandwidth: SI-PUR-009 — Vendor Credit Note
Issuance (FR47b workflow with cumulative validation). Skip if
context tightens; it's flagged for Phase 4 with the Tier 1
Acceptance Tag regardless.

Tier 1 acceptance per plan §11: all 12 inventory schema fields
visibly satisfied; only DESIGN.md tokens; D2C-002 voice; ≥44 px tap
targets on mobile; WCAG 2.1 AA pass; authentic Wild Sugar / Indian
F&B fixtures from mockups/src/lib/sample-data.ts.

Per-screen workflow (apply via subagent-driven-development, same as S3):
  1. Read the inventory entry's 12 fields
  2. Identify which CC-* shells the screen needs; build new ones
     following the S3 pattern (named exports, re-export from
     shell/index.ts, ComponentsIndex permutations, no hex literals
     outside tokens.ts, Lucide-only with §21.2 renames)
  3. Author the screen file at mockups/src/screens/{epic}/{ID}.tsx
  4. Wire the route in App.tsx BEFORE the /:screenId catch-all
  5. Run npx tsc --noEmit; pre-commit hook fires on commit
  6. Commit per screen with the established message format; push;
     reactive stakeholder review via Vercel preview after each
     commit
  7. Optional: dispatch independent spec-compliance reviewer
     subagent after each screen (the workflow this user requested
     mid-S3) — gives second-opinion verification before moving on

Methodology: superpowers:subagent-driven-development with
test-driven-development + verification-before-completion per screen.

If context budget approaches 60–70% mid-build, split into S4a (FCCC
pair + INV-007) + S4b (DSP-010 + PRO-011 + optional PUR-009) per
plan §16 float clause.

## Phase 2c-scoped close (after S4 lands)

In the same final commit:
- Update CLAUDE.md "Current phase" to record S4 close → Phase 2c
  closing → Phase 4 next
- Update _planning/06-phase-roadmap.md status badge + table row
- Per cross-phase boundary discipline (CLAUDE.md Phase 4 invariants
  §"Phase boundary crossing discipline")

Then open a single consolidated PR: phase-2c/visual-mockups → main
per plan §16 cadence (matches Phase 3a's PR #8 pattern).

After the PR merges, Phase 4 (epic implementation) starts in Master
Spec §10 order — Epic 1 (MDM) first — via the per-epic 3-arc
structure (backend / just-in-time mockups / production frontend)
with the chrome-freeze review gate at every epic boundary.

## Out of scope this session

- Tier 1 Group 2 remaining 8 screens (Tier 1 Acceptance Tag;
  Phase 4 epic-by-epic)
- Tier 1 Group 3 (5 per-persona daily drivers; Phase 4)
- All 58 Tier 2, 3 Tier 3, 23 Index entries — Phase 4
- Real backend wiring — Phase 4
- Per-screen design:design-critique skill runs (only triggered if
  the spec-compliance reviewer surfaces visual concerns)

## Auto-mode posture

Inherit from S3. Surface for confirmation only when:
- design:design-critique surfaces an irreducible spec contradiction
- A new CC-* pattern emerges that needs cataloguing in inventory §3
  (additive growth allowed; existing IDs must NOT be renamed)
- Pre-commit hook fires repeatedly on a pattern that signals a
  deeper rule design issue
- ACC-010 + RPT-006 cross-link / shared drill state contract needs
  a design decision that can't be inferred from FR95 + FR108
- LifecycleStepper for PRO-011 reveals a gap in the prop-driven
  steps abstraction designed in S3

Begin with screen 1 (SI-ACC-010) — FCCC Financial Framing. Build it
back-to-back with screen 2 (SI-RPT-006) so the shared CC-FCCC-DUAL-
SURFACE shell + cross-link state contract land in a coherent pair.
The independent-reviewer step is opt-in but recommended after each
screen — particularly screens 1+2 (the FCCC pair has the highest
cross-link complexity in S4).
```

---

### Historical: Phase 3a kickoff prompt (Phase 3a closed 2026-05-06) + Phase 2c-S3 kickoff prompt (S3 closed 2026-05-06)

The original Phase 3a kickoff prompt and the Phase 2c-S3 kickoff prompt are both preserved in git history; pulling them forward is unnecessary now that those sessions are closed. Run `git log -p _planning/06-phase-roadmap.md` if you need either verbatim text for archival reasons.

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

*End of roadmap — last edit 2026-05-06 (Phase 2c-scoped S3 Tier 1 G1 landed — 10 chrome-bearing screens + 13 new CC-* shell components; status badge + branch + S4 kickoff prompt swapped in; Phase 2c-S3 kickoff prompt demoted to historical artefact alongside the Phase 3a one)*
