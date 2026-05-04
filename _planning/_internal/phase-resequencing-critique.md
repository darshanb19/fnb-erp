# Critique — Phase Re-Sequencing Decision

> Independent review of the 2026-05-05 re-sequencing (Phase 3a Architecture before Phase 2c-scoped mockup foundation, then Phase 4 epic implementation with mockup-as-you-build).
> Reviewer: cold read of planning artefacts (`CLAUDE.md`, `_planning/06-phase-roadmap.md`, `_planning/02-master-spec.md` §11 + §3, `docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md` §1/§16/§19/§20, `_planning/05-screen-inventory.md`, `DESIGN.md`, `decision-log.md`).
> Date: 2026-05-05.
> Status: critique only — no implementation, no commits.

---

## Executive summary

**Verdict: re-sequencing is directionally sound but has real caveats.** Architecture-before-mockups is the right call for this codebase given how many of §11's OQs (real-time scope, offline depth, file storage, caching) materially shape UI choices. But the plan as written has (a) an **arithmetic discrepancy** (13 vs 15-16 mockups), (b) a **stale `CLAUDE.md` Current-phase line and inconsistent OQ count** ("10 open questions"), (c) **a Tailwind v3 vs v4 stack contradiction with Master Spec §3.1** that nobody has flagged, (d) **OQ list under-specifies real architecture decisions** (file storage, audit mechanism, notification transport, concurrency/locking, idempotency, multi-tenant data pattern), and (e) **Phase 4's "mockup-as-you-build alongside backend + frontend" is genuinely risky** for a solo non-technical founder given the 60-70% context ceiling already documented in `CLAUDE.md`. Defer or de-scope before kickoff.

---

## 1. Logical soundness — Architecture-before-Mockups for THIS project

**Holds up — for the specific reasons given, but reason #3 is overclaimed.**

- Reason 1 (architecture ripples into UI) is real — OQ4 (offline depth) alone changes every data-bearing screen's empty/loading/conflict UX; OQ3 (real-time scope) determines whether dashboards need refresh affordances vs subscription animations.
- Reason 3 says "...with knowledge of 'dashboards refresh on demand via tRPC query, not real-time subscription'". **tRPC is not in the spec.** [Master Spec §3.1](_planning/02-master-spec.md) locks REST API ✅ FINAL. Either an idle slip or genuine drift; either way, a roadmap shouldn't introduce stack vocabulary not in the canonical spec.
- Reason 5 (scope reduction is a real win) is true but partially conflates two issues: the *scope-down* is good independently; *sequencing* is good independently. Bundling them rhetorically obscures whether each stands alone (they do, but the doc reads as "you only get the scope reduction if you also re-sequence" which isn't true).

**Counter-argument the rationale missed:** mockups can surface architecture inputs the spec doesn't. The 10 Group-2 "workflow-weighted" screens (DSP-010 GST closure, PRO-011 In Progress transition, PUR-009 Vendor CN, ACC-014 MJV, etc. — see [phase-2c plan §6 Group 2](docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md)) involve **journal-fire atomicity, mandatory-reason capture, and conditional two-stage reversals**. Whether those need server-side transactions vs client-side optimistic UI vs background-job confirmation is *partly* an architecture question and *partly* a UX-discovery question. The current plan only puts 2-3 of these 10 in the foundation set. If novel patterns surface mid-Phase-4 architecture gaps (e.g., DSP-010 needs an idempotency key for IRN paste), it'll be reactive rework rather than upfront planning.

## 2. Internal consistency

Several real contradictions:

- **`CLAUDE.md` `## Current phase` is stale.** Says "Phase 2a — PRD review. No implementation yet." Roadmap says Phase 2a ✅ DONE; current is "Phase 3a NEXT". `CLAUDE.md` ALSO references **"the 10 open questions in master-spec §11"** — there are 10 numbered, but OQ10 is PRD-resolved. The spec itself says "9 still-open questions (OQ1–OQ9)". The `CLAUDE.md` sentence is contradictory within itself ("the 10 open questions... OQ10 resolved at the PRD level... The other 9 remain").
- **Tailwind version conflict — unflagged.** [Master Spec §3.1](_planning/02-master-spec.md) Frontend table: `Tailwind CSS | 3.x | ✅ FINAL`. Phase 2c plan §10.1 + §19 Q6 + §20 step 2: `Tailwind v4 (exact version pin, no caret)`. This is a stack-level FINAL decision that Phase 2c-prep silently flipped. Either flip §3.1 with an amendment note, or acknowledge that v4 was a Phase 2c-prep call needing formal capture in Phase 3a alongside OQ9. **Right now no document acknowledges the conflict.**
- **Mockup count arithmetic.** Roadmap: "13 foundation mockups: 10 chrome-bearing + 3 dual-surface partners + 2-3 most-novel workflow". 10+3+2 = 15 (or 16). [Phase 2c §16](docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md) repeatedly says "13 mockup screens" but its S4 row reads "3 dual-surface partners + 2–3 most-novel workflow screens (DSP-010, PRO-011, optionally PUR-009)". Either the 2-3 workflow are aspirational extras and 13 is real, or they're committed scope and 13 is wrong. Pick one.
- **Q7 implication "S5–S10 removed"** is in §19 [phase-2c plan §19 Q7](docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md). But §16 still references "S5+ moved to Phase 4" implicitly via the "(Phase 4 takes over)" final row — so consistent at first read. However, [§17 (Session 1 kickoff prompt)](docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md) is left intact and references the old S2-S10 cadence in its surface-fresh-prompt text ("§16 session breakdown unchanged — S2 → S3 → ... → S10"). If §17 stays, future readers may pick up the deprecated multi-session vision before they read §19's correction. §17 should be marked superseded.
- **Roadmap "OQ9 already-decided"** vs Phase 3a kickoff prompt's order which includes "9. OQ9 UI design tool — already decided; capture formally". Internally consistent, but the Phase 2c-prep tooling review thread isn't *cited* (no commit ref or doc link) — when the architecture phase tries to capture it formally, a future session will have to reverse-engineer the rationale.

## 3. Scope arithmetic — is 13 (or 15) foundation mockups enough?

**Probably yes for chrome consistency, but at real risk for novel workflows.**

The 21 CC-* patterns in [inventory §3](_planning/05-screen-inventory.md) and the 6 wrapper components in §10.7 are mostly exercised by the 10 Group-1 screens. SI-RPT-002 alone hits CC-DASHBOARD-TILE, CC-OVERRIDE-WIDGET, CC-PENDING-GR-DRILL; INF-001 hits CC-APPROVAL-INBOX-CARD; INF-005 hits CC-AUDIT-LINK; PUR-003 hits CC-DRAFT-PILL + CC-TRN-DISPLAY + CC-REVERSE-CANCEL; MDM-003 hits heavy-form chrome; MDM-004 hits the enablement-grid. Group 4's three dual-surface partners exercise CC-FCCC-DUAL-SURFACE + CC-PAIRED-TRANSFER-BUNDLE — these are the most architecturally-novel patterns (cross-screen shared drill state, paired bundle as a single approval object) and getting them in the foundation is correct.

**Gaps**: CC-VOICE-INPUT, CC-IMPLAUSIBILITY-WARN, CC-DUPLICATE-WARN, CC-DATA-QUALITY-ALERT, CC-PROVISIONAL-FLAG, CC-UNREGISTERED-CUSTOMER-WARN, CC-GST-FIELD-VALIDATION — these mostly live on the Group-2 workflow screens that are deferred. The plan handwaves: "the 2-3 most-novel workflow screens (DSP-010 GST closure, PRO-011 In Progress, optionally PUR-009)". DSP-010 alone gets you CC-GST-FIELD-VALIDATION + CC-UNREGISTERED-CUSTOMER-WARN; PRO-011 gets CC-PROVISIONAL-FLAG. **CC-IMPLAUSIBILITY-WARN and CC-VOICE-INPUT are not exercised in any of the 13-15 candidates** — they'll surface for the first time mid-Epic-4 (INV) or mid-Epic-7 (PRO). That's tolerable but worth naming as a known-gap-for-Phase-4 rather than an oversight.

## 4. OQ depth — are 9 OQs substantial enough for 4-6 sessions?

**The 9 are roughly right for 3-4 sessions, NOT 4-6 — but the OQ list is incomplete.**

Per-OQ realistic effort:

- OQ1 (monorepo): 30-60 min — pnpm workspaces is the obvious solo-founder pick, Turborepo overkill until you have shared CI matrix
- OQ2 (deployment): 1 hour — Railway is the fashionable pick; Render is the boring-and-reliable pick
- OQ3 (real-time scope): 2-3 hours — needs per-event analysis. Substantial.
- OQ4 (offline depth): 2-3 hours — substantial; affects every screen
- OQ5 (PDF library): 30-60 min — react-pdf vs puppeteer is well-trodden
- OQ6 (search): 1 hour — pg tsvector is the right answer for MVP scale
- OQ7 (jobs): 1-2 hours — pg_cron + Supabase has gotten reliable enough
- OQ8 (caching): 1 hour — TanStack Query only until you measure a hot path needs Redis
- OQ9: capture only

That's a single intensive day or two ~brainstorming sessions, plus 2 more sessions to write `architecture.md` + the OQ10 column-mapping deliverable. **4 sessions, not 6.** The 4-6 estimate is padded.

**More importantly, the §11 list is missing real architecture decisions:**

1. **Multi-tenant data pattern at the row level.** [Master Spec §3.2](_planning/02-master-spec.md) says every table has `brand_id` + RLS policies from start. But the *concrete pattern* — how a query layer enforces `brand_id` (tRPC middleware? Drizzle wrapper? a `withBrand` builder?) — needs to be decided once and reused. `CLAUDE.md` `## Critical rules` says "Every org-scoped query includes brand_id filter" — that's a check, not a pattern.
2. **Audit trail mechanism.** CC-AUDIT-LINK + FR20/21 imply append-only audit. Trigger-based? Application-layer? Supabase Realtime broadcast for the timeline? Big design call, not in §11.
3. **File storage strategy.** Supabase Storage is FINAL but bucket layout (per-brand? per-entity?), private vs signed-URL, MIME validation, and *where in the API surface uploads happen* are open. The §20 prompt mentions "file-storage placeholder pattern" without an OQ behind it.
4. **Notification Center transport.** Master Spec §8.3 names it; channels (in-app via Realtime? Email via Resend/Postmark? SMS?) and the dispatch model (queue? direct? batched?) are open.
5. **Concurrency and idempotency.** DL-001 already established that `inventoryService.deductStock()` fires exactly at one transition. What prevents two concurrent In-Progress transitions on the same PR? Advisory lock? Optimistic with version column? Same question for IRN paste in DSP-010, PO approval in PUR-004. Not in §11.
6. **Migration / seed / dev-prod parity.** §3.1 marks GitHub Actions FINAL but no OQ for migration ordering, seed data refresh, or branch-preview database strategy.
7. **Test strategy.** Integration tests need a real Postgres — Testcontainers? supabase local? DL-001 implies inventory + journal must be atomic-tested.
8. **Approval engine state machine schema.** §8.2 names the engine; a single decision on parallel-vs-sequential, threshold expression DSL, and re-routing on permission revocation is a hard architectural call.

**Recommendation: add OQ11–OQ18 (or a single "additional architecture decisions" appendix) before Phase 3a kicks off, or Phase 3a will surface them organically and stretch from 4 sessions to 6-8.**

## 5. Phase 4 mockup-as-you-build realism

**The single biggest risk in the re-sequenced plan, and the doc under-acknowledges it.**

A solo non-technical founder doing Epic 4 (INV, 16 screens, of which **6 are Tier 2 + several Index-only deferred to Phase 4**) in Phase 4 is being asked to:

1. Author Drizzle schema for inventory entities
2. Implement `inventoryService.deductStock` + `checkEnablement` + transfer logic per Master Spec §8.1
3. Build 5+ Tier 2 mockups (INV-002, INV-006, INV-011, INV-015, plus any chrome touch-ups)
4. Build production frontend code consuming foundation chrome
5. Wire integration tests
6. Maintain stakeholder review on Vercel preview

…all while staying under the 60-70% context ceiling `CLAUDE.md` `## Context management` enforces.

This is **3-5 distinct cognitive modes** (data-modeling, service-design, visual-design, frontend-engineering, test-writing) interleaved per epic. The original brief named "epic-by-epic" but didn't say "all five interleaved in one session". If interpreted faithfully, the per-epic session count balloons (5-8 sessions per epic × 12 epics = 60-96 sessions). If interpreted as "per epic, separate sub-arcs for backend, frontend, mockups", it's *still* fine but should be named as such — the current wording lets the reader hope it'll all fit together cleanly when it won't.

**Mitigation the plan doesn't state:** within each epic, prescribe the order — (a) backend schema + service, (b) Tier 2 mockups for that epic's deferred screens, (c) production frontend code consuming both. This is closer to a 3-part-per-epic arc with explicit hand-off boundaries. Without this the founder will conflate steps and burn context.

## 6. Hidden dependencies / order-of-decisions soundness

Two architecture decisions were made during Phase 2c-prep that are flagged as needing Phase 3a formal capture:

- **OQ9 (UI design tool: in-repo Vite/shadcn)** — acknowledged. Order is sound (the 2c-prep tooling review fed back, the roadmap captures it as "already-decided, formalise in 3a").
- **Tailwind v4 adoption** — **NOT acknowledged.** This contradicts §3.1's "Tailwind 3.x ✅ FINAL". v4 is materially different: `@theme` directive replaces `tailwind.config.ts` extend; CSS variables become first-class. The Phase 2c-prep web review picked v4 (commit `d8333db`) without a formal change request. This is a decision that *should* surface as a §3.1 amendment in Phase 3a alongside OQ9.
- **Vercel** — already FINAL in §3.1, so Q4 was confirming-the-decision, not making it. Fine.

**Other pre-decisions worth auditing in Phase 3a:**

- Pre-commit hook scope rules (§10.8)
- 6-wrapper-vs-fork pattern for shadcn primitives (§10.7 / Q6.a)
- `.dark` selector convention (Q6.c)

These are scaffold-level, not architecture-level, so leaving them in Phase 2c-prep capture is fine — but they should be cross-referenced from the architecture doc when it lands so a future engineer sees the chain.

## 7. State accuracy

- **`CLAUDE.md` `## Current phase` is wrong** by 4 phase boundaries (says 2a; reality is 3a NEXT after 1, 2a, 2b, 2c-prep all done). Has been wrong since at least the Phase-2b close on 2026-05-04.
- The roadmap correctly reflects current state (2026-05-05 update).
- Phase 2c plan §1 status reflects current re-sequenced state.
- `decision-log.md` only has DL-001 — fine, that's intentional (the format note says "created when first decision is made").
- The `## Read first, every session` list in `CLAUDE.md` doesn't include `_planning/06-phase-roadmap.md` — which IS the canonical phase doc per its own header. **Newest project artefact, not in the read-first list.**

## 8. Alternative sequencing — would I do it the same way?

**Mostly yes. Two changes I'd make:**

1. **Architecture first — yes**, but in a *thinner* form: just resolve OQs that materially affect UI design (OQ3 real-time scope, OQ4 offline depth, OQ8 caching, plus the missing OQs on file storage and notification transport). Defer OQ1 (monorepo), OQ2 (deployment), OQ5 (PDF), OQ6 (search), OQ7 (jobs) until just before Epic 1 implementation — these don't affect mockups and can be made in 1-2 hours when the time comes. This shrinks Phase 3a to 2-3 sessions. The current "resolve all 9 + missing OQs upfront" risks Phase 3a-bloat that delays everything.

2. **Foundation mockups should include 4-5 Group-2 workflow screens, not 2-3.** Specifically: DSP-010 (GST closure) + PRO-011 (In Progress) + PUR-009 (Vendor CN) + ACC-014 (MJV) + USR-006 (permission grant). These exercise the remaining CC-* patterns (provisional-flag, GST-validation, mandatory-reason workflow, two-stage journal fire, permission expiry) that the current 13-15 don't. Adds ~1 session to Phase 2c, eliminates "discovered chrome gap mid-Epic-4" risk.

Net: Phase 3a 2-3 sessions, Phase 2c-scoped 4 sessions (instead of 3), Phase 4 less reactive churn. Same wall-clock total, lower risk surface.

## 9. Top 3 risks in re-sequenced plan + mitigations

1. **Phase 4 cognitive overload** — interleaving backend + frontend + per-epic mockups in one session arc per epic exceeds context budget. **Mitigate:** explicitly prescribe a 3-arc-per-epic structure (backend/services → just-in-time mockups → production frontend) in the roadmap, with each arc as a separate session.
2. **Architecture-phase scope creep from missing §11 OQs** (file storage, audit, notification transport, concurrency, multi-tenant pattern) surfacing organically and turning 4 sessions into 8. **Mitigate:** preemptively expand §11 with the 5-7 additional OQs identified above before Phase 3a brainstorming begins.
3. **Foundation mockups don't surface chrome gaps that emerge in deferred Group-2 patterns**, causing rework when CC-IMPLAUSIBILITY-WARN or CC-VOICE-INPUT first appears in Phase 4. **Mitigate:** widen Phase 2c-scoped from 13 to 17-18 mockups by including 4-5 Group-2 workflow screens (per §8 above), or at minimum write a Phase-4 "expect chrome additions when these CC-* patterns first surface" note as a known unknowns list.

## 10. Other gaps and unstated assumptions

- The roadmap "Cross-phase invariants" mentions `decision-log.md` but doesn't name `_planning/06-phase-roadmap.md` as itself an invariant doc that future phases must keep current. Self-referentially missing.
- The Phase 2c plan §17 (S1 kickoff prompt) is now obsolete — S1 closed 2026-05-05 in the source session — but isn't marked superseded. A future session reader could mistake it for live guidance.
- "Foundation chrome benefits from architecture knowledge" is the strongest reason for re-sequencing and should arguably *lead* the rationale. It's currently reason 3 of 5.
- The roadmap calls Phase 3a's deliverable "`_planning/architecture.md`" but [Master Spec §3.2](_planning/02-master-spec.md) already references "endpoints follow conventions defined in `architecture.md`" as if that file existed. So `architecture.md` was always the planned deliverable name, just unbuilt. Worth noting in the architecture-phase plan that this is the canonical path — which the roadmap does, fine.
- "Mockups visual reference vs production-code seed" is named in the Phase 3a kickoff prompt as a cross-cutting decision — this is a substantial call (does Phase 4 fork fresh, or extend the mockup harness?). It deserves its own decision-log entry, not just a passing mention. Given §3.2 says "Frontend in `apps/web`, backend in `apps/api`" — the answer is clearly "fork fresh" because mockups live in `mockups/` not `apps/web/`. But the framing as "open" is misleading.
- The roadmap says `CLAUDE.md` `## Current phase` updates "whenever phase boundary crosses" — but it hasn't been updated since at least the Phase-2b close. Mechanism exists, discipline doesn't.

---

## What I would change

1. **Update [`CLAUDE.md`](CLAUDE.md) `## Current phase` immediately** to reflect Phase 3a NEXT, and fix the "10 open questions" wording to "9 open + OQ10 PRD-resolved".
2. **Add `_planning/06-phase-roadmap.md` to `CLAUDE.md`'s `## Read first, every session`** list. It's the canonical phase doc; auto-load is the right surface.
3. **Resolve the Tailwind v3-vs-v4 contradiction.** Either amend Master Spec §3.1 to flip to v4 with a footnoted change-request reference, or roll back Phase 2c-prep's v4 pick. Don't leave it unaddressed.
4. **Fix the 13 vs 15-16 mockup arithmetic** in both the roadmap and Phase 2c §16. State the real number unambiguously.
5. **Expand §11 with 5-7 missing OQs** (file storage, audit mechanism, notification transport, concurrency/idempotency, multi-tenant data pattern, test strategy, approval engine schema) before Phase 3a kickoff, OR explicitly carve out a "Phase 3a may discover additional architecture decisions; capture them as DL-NNN entries with the rationale that §11 was non-exhaustive".
6. **Mark [phase-2c plan §17](docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md) as SUPERSEDED — see §20** so future readers don't follow obsolete guidance.
7. **Prescribe per-epic 3-arc structure for Phase 4** in the roadmap (backend → just-in-time mockups → production frontend, each its own session). Don't leave the "interleaved" interpretation open.
8. **Reduce Phase 3a estimate to 3-4 sessions, not 4-6** — the current padding signals lower-confidence in the OQ list completeness, which is the wrong signal to send.
9. **Consider widening Phase 2c-scoped from 13 to 17-18** by adding DSP-010, PRO-011, PUR-009, ACC-014, USR-006. Adds ~1 session, surfaces remaining CC-* patterns now rather than mid-Epic-4.
10. **Capture "mockups as visual reference vs production-code seed" as a decision in `decision-log.md`** before Phase 3a opens, not as an "open" cross-cutting question. The answer is already implied by [Master Spec §3.2](_planning/02-master-spec.md) (`apps/web` vs `mockups/`).

---

## What I would NOT change

- **Architecture-before-mockups direction is right.** The five reasons in the roadmap are mostly load-bearing (with the tRPC slip in reason 3 fixable as a one-line edit).
- **The scope-down from 89 to ~13-15 is right.** 89 mockups upfront is solo-founder over-investment. The screen inventory is already canonical specification; mockups are visual layer on top.
- **Foundation chrome before workflow screens is right.** Group 1's 10 chrome-bearing screens DO unlock CC-* patterns reused everywhere. This is correct sequencing.
- **Mockup-as-you-build during Phase 4 is conceptually right** — it keeps mockups fresh against architecture decisions that emerge during implementation. The execution risk (cognitive load) is fixable with structure, not with reverting the decision.
- **Phase 3a kickoff prompt's "constraint-flow" OQ ordering** (OQ1 → OQ2 → OQ8 → OQ7 → OQ3 → OQ6 → OQ5 → OQ4 → OQ9) is well-thought-out; downstream OQs really do depend on upstream ones in roughly that order.
- **Branch hygiene** (separate branches per phase, `phase-3a/architecture` not on `phase-2c-prep/mockup-plan`) is correct.
- **`decision-log.md` format** (DL-NNN entries with Decision/Source/Why/Cross-references) is appropriate and DL-001 is a good template.
- **`DESIGN.md` token authority + the 21 CC-* pattern catalogue** are excellent canonical assets — those *should* survive every phase boundary unchanged.

---

*End of critique — 2026-05-05*
