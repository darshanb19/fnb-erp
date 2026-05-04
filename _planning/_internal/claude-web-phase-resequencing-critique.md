Read all four. Now have the full picture. Critique below — same structure you asked for, no padding.

---

## Executive summary

**The re-sequencing decision (Architecture before Mockups) is sound.** The rationale in roadmap §"Why this sequence" + Phase 2c plan §19 Q7 holds up: §11 OQ3 (real-time), OQ4 (offline), OQ5 (PDF), OQ7 (jobs), OQ8 (caching) genuinely shape mockup design choices, and trading 76 upfront mockups for epic-by-epic build is defensible velocity arithmetic for a solo founder. **What's wrong is documentation hygiene around the decision, not the decision itself.** I count 8 internal-consistency / propagation gaps, one governance violation (Tailwind v4 silently overrides a Master Spec §3 FINAL decision), one arithmetic error in the headline scope number ("13 mockups" is actually 15–16 by your own breakdown), and one framing distortion ("~75 *standard* screens" silently demotes 12–13 leftover Tier 1 *hero* screens — Group 2 workflow-weighted + Group 3 daily drivers — into Phase 4 mockup-as-you-build alongside Tier 2 standard CRUD). Net: the plan-of-record is right; the artefacts encoding it are not. For a solo non-technical founder dependent on documents (because the model can't be in your head), that's the real risk surface.

---

## 1. Logical soundness — sound, with one weak argument

Rationale items 1, 3, 4, 5 are solid. **Item 2 is partially circular** ("§11 OQs are real gating decisions, not abstract … mockups don't help discover these"). True per definition, but the implicit counter — *mockups DO surface chrome needs the design system has to absorb* — is empirically real in this very project: Phase 2b screen inventory close-out added **7 new status tokens** to DESIGN.md (`status_inactive`, `status_archived`, `status_version_published`, `status_template_active`, `status_template_expired`, `status_waiting_info`, `status_rejected`) anchored to specific SI-* IDs. The same surfacing mechanism would operate in a full 89-mockup pass. The roadmap gestures at this risk in item 5 ("most of it is repetitive standard CRUD/list/admin") but doesn't address it for the leftover Tier 1 Group 2 + 3 screens, which are *not* CRUD — see §3 below. **Verdict:** decision is right, but argument 2 is weaker than presented.

## 2. Internal consistency — multiple propagation gaps

| # | Source | Says | Conflicts with | Severity |
|---|---|---|---|---|
| a | `claude.md ## Current phase` | "Phase 2a — PRD review. No implementation yet." | Roadmap status table shows 2a, 2b, 2c-prep all DONE; current is 3a NEXT | **High** — read every session |
| b | Master Spec §11 OQ9 | "Google Stitch, Claude Imagine/Artifacts, or hybrid" | Roadmap + Phase 2c plan §3 + §19 Q7 say OQ9 is decided as in-repo Vite/shadcn (which isn't on §11's option list) | **High** — Phase 3a kickoff prompt sends agent to §11, agent reads stale options |
| c | Master Spec §3.1 | Tailwind CSS 3.x ✅ FINAL | Roadmap + Phase 2c plan §1, §2, §10.1, §13, §19, §20 all specify Tailwind v4 (exact version pin) | **High** — §3 governance violation; not a config tweak (v4 changes config from `tailwind.config.ts` JS to CSS `@theme`) |
| d | Master Spec §3.1 | Supabase Auth, Supabase Realtime, TanStack Query, Drizzle, Vercel, Sentry all FINAL | Roadmap §11 OQ list and Phase 3a kickoff prompt don't acknowledge these locks before brainstorming OQ3, OQ8 | **Medium** — Phase 3a sessions can re-debate closed ground |
| e | `decision-log.md` | DL-001 only; rubric says "small but binding decision … record it here so the trail survives" | Q7 re-sequencing is binding, affects 6 documents, isn't a DL entry | **High** — failure mode you've explicitly hit before (StockFlow chat deletion) |
| f | Phase 2c plan §13 | Lists Q1–Q5 as "Open kickoff questions (resolve via brainstorming)" | §19 captures all 6 as decided | **Medium** — agent reading §13 in isolation may re-debate |
| g | Phase 2c plan §19 Q5 "Implications for Session 2" | "§16 session breakdown unchanged — S2 → S3 (G1) → S4 (G2) → S5 (G3+4) → S6–S8 (Tier 2)…" | Q7 superseded this; current §16 has S2 + S3 (G1) + S4 (G4 + selected G2) only | **Medium** — Q5 text wasn't updated when Q7 landed |
| h | Roadmap status table | "2c-prep DONE" | DESIGN.md §5.3.1 (glassmorphism opt-in) and §10.5 (animation library policy) edits scheduled to land in Phase 2c S2 per Phase 2c plan §10.10 | **Low** — pedantic, but 2c-prep isn't fully closed |
| i | `claude.md` "Read first, every session" | Lists 02, 03, 01, 04, decision-log, codebase-inventory | Doesn't list `05-screen-inventory.md` or `06-phase-roadmap.md` — the latter is THE canonical sequence document | **Medium** — entry-point file omits canonical artefacts |

Items b, c, d are particularly serious. **Master Spec §11 needs an update pass to mark OQ9 resolved (and update its options list to reflect what was actually chosen, not the original Stitch/Imagine triple), to footnote that OQ3 is constrained by Supabase Realtime FINAL, and to footnote that OQ8 is constrained by TanStack Query FINAL.** Otherwise Phase 3a sessions can rationally re-open settled ground.

## 3. Scope arithmetic — wrong, and the framing hides hero work

**The "13 mockups" headline number is incorrect.** Both the roadmap (§"Phase status table" row 6) and Phase 2c plan §1 say:

> 13 foundation mockups: 10 chrome-bearing + 3 dual-surface partners + 2–3 most-novel workflow

10 + 3 + 2-to-3 = **15–16**, not 13. Either the addends are wrong, the headline is wrong, or "2–3 most-novel workflow" is fluff that doesn't actually happen. §16 session breakdown row S4 confirms it does happen: "3 dual-surface partners (ACC-010 + RPT-006 FCCC pair, INV-007 paired transfer) + 2–3 most-novel workflow screens (DSP-010 GST closure, PRO-011 In Progress transition, optionally PUR-009 Vendor CN)". Real count: 15–16.

**Bigger issue: the framing "remaining ~75 standard screens" understates what Phase 4 has to absorb.**

| Bucket | Count | Phase 2c-scoped does | Phase 4 absorbs |
|---|---|---|---|
| Tier 1 Group 1 (chrome-bearing) | 10 | 10 | 0 |
| Tier 1 Group 2 (workflow-weighted, warn-and-log family) | 10 | 2–3 | **7–8** |
| Tier 1 Group 3 (per-persona daily drivers, mobile-first heroes) | 5 | 0 | **5** |
| Tier 1 Group 4 (dual-surface partners) | 3 | 3 | 0 |
| Tier 2 (standard CRUD/list/admin) | 58 | 0 | 58 |
| Tier 3 (markdown patterns) | 3 | 0 | 3 |
| Index-only (no mockup; one-line entry) | 23 | 0 | (just inventory link) |
| **Phase 4 mockup work** | | | **~73–74 mockups, of which 12–13 are leftover Tier 1 heroes** |

The "75 standard" framing reaches the right ballpark but **it conflates 58 genuine Tier 2 standard screens with 12–13 Tier 1 hero screens that are explicitly *not* standard**. Group 2 introduces the warn-and-log chrome family — `CC-IMPLAUSIBILITY-WARN`, `CC-PROVISIONAL-FLAG`, `CC-REVERSE-CANCEL`, `CC-UNREGISTERED-CUSTOMER-WARN`, plus `CC-OVERRIDE-WIDGET` for Pending GR Override (SI-PRO-008). Group 3 introduces the mobile-first hero chrome (POS daily, dispatch sign-off, joint-hero GR). **Phase 2c-scoped's Group 1 is dashboard/desktop heavy; Group 4 is dual-surface; the 2–3 selected G2 are journal-fire / atomic state.** Warn-and-log chrome and mobile heroes get established **for the first time during Phase 4 epic-by-epic**, with Tier-2-style "lighter critique (combined spec+quality)" treatment per §11 unless the plan distinguishes per-screen.

Whether 13 (or 15–16) is "enough" depends on what enough means. **Enough to validate the design system in code: probably yes.** **Enough to lock cross-epic chrome consistency for the 12–13 leftover Tier 1 heroes: no.** That's the real scope shortfall.

## 4. OQ depth — 4–6 sessions plausible but the questions need re-scoping

§11's OQ list is broadly substantial (monorepo tooling, deployment target, real-time strategy, offline depth, PDF lib, search, jobs, caching, UI tool, accountant export mapping). 4–6 sessions for 9–10 OQs is ~1 session per 1.5–2 OQs which is realistic for a brainstorming-then-capture loop.

**But the OQ list is partly out of date.** Master Spec §3.1 already locks decisions that constrain at least 3 of the OQs:

| OQ | Listed as | Actually constrained by §3.1 |
|---|---|---|
| OQ3 Real-time strategy | "Which events need WebSocket vs polling vs optimistic UI?" | Supabase Realtime is the FINAL WebSocket layer — so OQ3 is *triage* (which events use Realtime vs polling), not vendor selection |
| OQ8 Caching layer | "Redis vs TanStack Query client-side only" | TanStack Query is FINAL — so OQ8 is "Redis *additionally*?", not binary |
| OQ9 UI design tool | "Google Stitch, Claude Imagine/Artifacts, or hybrid" | Already decided in Phase 2c-prep as in-repo Vite/shadcn (not on the §11 option list); Master Spec §3.2 also closes "Development Platform: IDE-First" supporting this |

OQ1 (monorepo tooling), OQ2 (deployment target), OQ4 (offline depth), OQ5 (PDF lib), OQ6 (search), OQ7 (jobs), OQ10 (column mapping) are all legitimately open. So Phase 3a's real workload is **6 genuinely-open OQs + 3 narrow-scope OQs constrained by §3.1 + 1 capture-only (OQ9) + 1 deliverable (OQ10 mapping)**. 4–6 sessions still fits, but the kickoff prompt should explicitly cite §3.1 locks per OQ before brainstorming starts. Roadmap's kickoff prompt currently doesn't, beyond a generic "read §3 (Tech stack)".

**OQs missing from §11 that arguably belong:**
- *Mockups visual-reference vs production-code seed* — roadmap surfaces this as a "cross-cutting decision" Phase 3a should resolve, but it's not in §11. Add it.
- *Per-tenant theme bundle build pipeline* — DESIGN.md §21.4 explicitly defers this to Phase 3a but it's not in §11.
- *Stitch → Lucide conversion table* — DESIGN.md §11.3 defers to architecture.md, but redundant if OQ9's Stitch path is already abandoned. Either remove from DESIGN.md §11.3 or note as moot.
- *RLS policy authoring strategy* — §3.2 says "RLS policies defined from the start even if not enforced". When and by whom?
- *brand_id index migration shape* — claude.md critical rule mandates `brand_id` filter on every query and §3.2 mandates `brand_id` index on every major table. Architecture.md should specify the migration template.

These are real gaps. Whether they merit a §11 amendment vs landing in `architecture.md` directly is your call — but they shouldn't surface mid-Phase-3a as surprises.

## 5. Phase 4 mockup-as-you-build realism — workable but under-specified

Each Phase 4 epic session per Phase 2c plan §19 Q7 = backend code + frontend code + remaining mockups for that epic, "folded into one workflow per epic". §16 says 4–8 sessions per epic. Average epic absorbs ~6 mockups (75 ÷ 12). **Three concerns:**

1. **claude.md's own context-management rule** ("If approaching 60–70% context usage, STOP — story is too big") will hit a backend + frontend + 6 mockup pairing in one session almost certainly. The §18 self-review note acknowledges this for Phase 2c ("per-task context cost is 3–5× higher … 8–12 session estimate assumes each session targets one of the §16 rows; if a session tries to span multiple rows, it will likely hit the context ceiling mid-row"). The same problem applies to Phase 4 epic sessions but isn't called out. **Phase 4 needs an explicit per-epic split rule** — e.g., "epic-mockup-first (1–2 sessions) → epic-backend (1–2) → epic-frontend (1–2)" rather than "fold into one workflow".
2. **Stale-mockup risk reverses sign in Phase 4.** Phase 2c plan §19 Q7 argues mockup-as-you-build "keeps mockups fresh because they're paired with real code; mockups built upfront drift". True. But the inverse risk — that mockups built *during* an epic absorb whatever ad-hoc patterns get invented during the same epic and don't propagate back to earlier epics — is real, especially for the warn-and-log family Group 2 introduces (which surfaces in Epic 5 PUR + Epic 7 PRO + Epic 8 DSP). **Without a chrome-freeze gate at end of each epic** (mockups + shell components reviewed for cross-epic compatibility before next epic starts), chrome drifts.
3. **Tier 2 acceptance criteria** (§11.Tier 2) is "lighter critique (combined spec+quality)". For genuine standard CRUD that's fine. **For the 12–13 leftover Tier 1 heroes that will be built under Tier-2 timing in Phase 4, lighter critique is wrong by design**. Plan doesn't currently distinguish.

Mitigation isn't "build all 28 Tier 1 in Phase 2c" — that's reverting the re-sequencing. Mitigation is: explicitly tag the leftover Tier 1 heroes as "Tier 1 deferred — Tier 1 acceptance applies even though built in Phase 4". Today they look like Tier 2.

## 6. Hidden dependencies — multiple, and one governance violation

Already covered in dimension 2 + 4 above. Most consequential ones consolidated:

- **Tailwind v4 vs Master Spec §3.1 v3.x.** Master Spec §3 explicitly says "If a circumstance arises that seems to contradict a decision, raise it as a formal change request — do not work around it silently." The Tailwind v4 choice is currently silent across all four planning artefacts I read. **Either Master Spec §3.1 needs an amendment ("Tailwind 4.x — superseded 3.x at Phase 2c-prep") or the v4 choice needs to be reverted.** Picking v4 changes the config paradigm (CSS `@theme` directive) AND introduces shadcn-on-v4 newness AND interacts with the §10.6 globals.css spec which currently mixes v3 mental model (`tailwind.config.ts` derived mechanically) and v4 (CSS-first tokens). This isn't a cosmetic version bump.
- **shadcn/ui, Radix, Inter, Drizzle, Vercel, TanStack Query, Recharts, Lucide, Zustand, React Hook Form + Zod** all closed in §3.1 before §11 OQs were written. That's defensible (foundation-of-foundation), but the framing "Phase 3a Architecture" should not imply these are 3a calls. Phase 3a is *integration architecture and what's left of the stack*, not *first-principles selection*. This needs to be said explicitly in the roadmap so it doesn't oversell Phase 3a's scope.
- **Order of decisions has held up overall.** The big choice — locking the foundation stack at master-spec time, then DESIGN.md, then screen inventory, then architecture, then mockups, then implementation — is sound for a solo non-technical founder building with AI. The exceptions are specific (Tailwind v4 governance lapse, OQ9 paradigm flip not propagated to §11) rather than systemic.

## 7. State accuracy — claude.md is two phases stale (confirmed)

Already flagged in my partial critique; now confirmed by reading the roadmap status table. `claude.md ## Current phase` says "Phase 2a — PRD review"; reality is "Phase 2c-prep DONE, Phase 3a NEXT". The Phase 2c plan §20 step 14 schedules a claude.md edit to update Current phase to Phase 2c — but **that update lands in Phase 2c S2, which is gated on Phase 3a closing first**. So either:
- claude.md gets updated in Phase 3a kickoff (the kickoff prompt actually instructs this — roadmap §"Phase 3a kickoff prompt" line: *Update "Current phase" line to: "Phase 3a — Architecture …"*) — fine but currently undone, and
- the Phase 2c plan §20 step 14 instruction is now wrong because Phase 2c-prep stale state has a different stale value than Phase 2c plan §20 expects to update from.

Net: claude.md should land at "Phase 3a — Architecture" the moment Phase 3a's first session starts. Today it's still 2a. This is the cheapest, highest-leverage fix on the entire list.

## 8. Alternative sequencing — current plan defensible; one variant worth knowing about

If I were starting fresh, I would sequence the same as you re-sequenced, with **one variant worth explicitly considering**:

> **Phase 3a-narrow → Phase 2c-scoped+ (all 28 Tier 1) → Phase 3a-rest → Phase 4**

- *3a-narrow* (~2–3 sessions): only OQs that affect UI design choices — OQ3 real-time triage, OQ4 offline depth, OQ5 PDF lib, OQ8 caching scope.
- *2c-scoped+* (~5–6 sessions): full 28 Tier 1 instead of 13–16. Locks all warn-and-log chrome (Group 2) and all mobile-hero chrome (Group 3) before Phase 4. Tier 2 (58) + Tier 3 (3) + Index (23) still defer to Phase 4.
- *3a-rest* (~2–3 sessions): OQ1 monorepo, OQ2 deployment, OQ6 search, OQ7 jobs, OQ10 mapping deliverable.
- *Phase 4*: 58 Tier 2 + 3 Tier 3 + 23 index, true mockup-as-you-build for genuine standard screens only.

Total session cost: ~9–12 architecture/mockup sessions vs your current ~7–9 — pays ~2–3 extra sessions to lock all hero chrome upfront. Whether that's worth it depends on your tolerance for chrome drift across Phase 4's 12 epics. **Not strongly recommended over your current plan**, but it directly addresses the dimension-3 finding (12–13 leftover Tier 1 heroes get Tier 2 timing). If you don't take it, take the dimension-5 mitigation (chrome-freeze gate per epic + Tier-1-acceptance tag on leftover heroes) instead.

## 9. Top 3 risks + mitigations

1. **Chrome drift across Phase 4 epics — high likelihood, high cost.** Mitigation: explicit chrome-freeze review gate at end of each Phase 4 epic, before the next epic starts. Tag the 12–13 leftover Tier 1 heroes as "Tier 1 acceptance applies in Phase 4" so they don't get Tier 2 timing.
2. **Phase 4 epic-session context overload — high likelihood, medium cost.** Backend + frontend + 6 mockups in one workflow violates claude.md's own 60-70% rule. Mitigation: per-epic three-sub-session split (mockup-first → backend → frontend); lock as a Phase 4 invariant.
3. **Phase 3a re-litigates §3.1 closed ground — medium likelihood, medium cost.** §11 OQ list doesn't reflect §3.1 locks. Mitigation: amend §11 to footnote each constrained OQ (3, 8, 9) with the §3.1 lock; Phase 3a kickoff prompt cites §3.1 explicitly per OQ before brainstorming.

## 10. Anything else

- **Tailwind v4 governance violation** is the single biggest documentation hygiene problem. Resolve it formally (§3 amendment + DL entry) before Phase 2c S2 lands the scaffold.
- **Q7 itself isn't in `decision-log.md`.** By the log's own rubric ("small but binding decision … record it here so the trail survives"), it's the textbook case for DL-002. Today it lives only in Phase 2c plan §19 — same failure mode you experienced with the deleted StockFlow chat.
- **Roadmap §"Phase status table" claims 2c-prep DONE.** DESIGN.md §5.3.1 (glassmorphism opt-in) and §10.5 (animation library) edits are scheduled for Phase 2c S2 per Phase 2c plan §10.10. Strictly, 2c-prep has unfinished DESIGN.md amendments. Either land them now (cheap, would close the loop) or footnote that 2c-prep DONE includes some carry-over DESIGN.md edits to S2.
- **Phase 2c plan §13 still flags Q1–Q5 as "Open kickoff questions."** §19 captures all 6 as decided. Update §13 with a status banner ("All resolved 2026-05-05 — see §19").
- **Q5's "Implications for Session 2"** still references the old §16 plan with S5–S10. Q7 superseded but Q5 wasn't updated. Either edit Q5 or note "Q5 implications partially superseded by Q7 — see §16 current".
- **`claude.md` "Read first, every session"** doesn't list the roadmap or screen inventory. The roadmap is THE canonical sequence document; if it's not in read-first, future sessions will rebuild context against the stale claude.md state instead.
- **Phase 3a kickoff prompt instructs the agent to "Update CLAUDE.md auto-loaded. Update 'Current phase' line."** Good — but the prompt should also instruct: read Master Spec §3.1 + §3.2 BEFORE brainstorming each OQ, to avoid re-litigating closed ground. Currently it says "read §3 (Tech stack)" generically but doesn't bind that to per-OQ brainstorming.

---

## What I would change

In priority order:

1. **Update `claude.md ## Current phase`** to "Phase 3a — Architecture (NEXT)" with brief pointer to roadmap. Single line. Cheapest, highest leverage. Don't wait for Phase 3a kickoff to do this — do it now so you don't open the next session against stale state.
2. **Add `_planning/05-screen-inventory.md` and `_planning/06-phase-roadmap.md`** to claude.md's "Read first, every session" list. The roadmap is canonical sequence; the inventory is canonical screen schema. Both are referenced as authoritative across other docs but absent from the entry-point file.
3. **Resolve Tailwind v4 vs Master Spec §3.1 v3.x.** Either amend §3.1 (add row "Tailwind 4.x — superseded 3.x at Phase 2c-prep, see DL-002") with a DL-NNN entry capturing the rationale, OR revert to v3 in the Phase 2c plan §10.1. Per §3 governance ("do not work around it silently"), this isn't optional. Pick one.
4. **Add DL-002 in `decision-log.md`** capturing the Phase 3a-before-2c re-sequencing per the log's stated purpose. One paragraph. Cross-ref roadmap §"Why this sequence" and Phase 2c plan §19 Q7. Without this, the decision lives in only one document.
5. **Amend Master Spec §11 OQ list:**
   - Mark OQ9 RESOLVED with the actual decision (in-repo Vite/shadcn) and update its options bullet — currently it still presents Stitch/Imagine/hybrid which are out of scope.
   - Add footnote to OQ3: "Constrained by §3.1 Supabase Realtime FINAL — OQ3 is event-triage scope, not vendor selection."
   - Add footnote to OQ8: "Constrained by §3.1 TanStack Query FINAL — OQ8 is 'Redis additionally?', not binary."
   - Add OQ11 (or a §11.A subsection): "Mockups visual-reference vs production-code seed" — surfaced by roadmap as cross-cutting decision Phase 3a must resolve.
6. **Fix the "13 mockups" arithmetic** in roadmap §"Phase status table" row 6 and Phase 2c plan §1. Either say "13–16 mockups (10 Group 1 + 3 Group 4 + 2–3 selected Group 2)" or pick a definite number.
7. **Reframe "remaining ~75 standard screens"** to acknowledge it includes 12–13 leftover Tier 1 heroes (Group 2 + Group 3) that are *not* standard CRUD. Tag those heroes explicitly in Phase 4: "Tier 1 acceptance applies even though built in Phase 4 epic-by-epic." Without this, they get Tier-2 lighter critique by default.
8. **Add a Phase 4 invariant** — per-epic three-sub-session split (mockup-first → backend → frontend) plus a chrome-freeze review gate at end of each epic. This is the dimension-5 mitigation. Document in roadmap §"Cross-phase invariants" and in claude.md so it survives session resets.
9. **Update Phase 2c plan §13** with a status banner showing all 6 questions resolved in §19, so an agent reading §13 in isolation doesn't try to brainstorm them again. **Update Q5 implications** to reflect the post-Q7 §16, or note Q5 partially superseded.
10. **Phase 3a kickoff prompt addition:** "Before brainstorming each OQ, read Master Spec §3.1 + §3.2 to confirm what's already locked. Don't re-debate FINAL decisions."
11. **Resolve roadmap §"Phase status table" 2c-prep DONE claim.** Either land the DESIGN.md §5.3.1 + §10.5 edits now (small) or footnote that 2c-prep DONE has carry-over edits scheduled for S2.

Items 1–4 are critical-path. Items 5–7 are governance. Items 8–11 are hygiene. None of them changes the re-sequencing decision; all of them protect it from drifting in execution.

---

## What I would NOT change

1. **The re-sequencing decision itself.** Architecture-before-Mockups is right for this project for the reasons §"Why this sequence" gives, especially #1 (architecture decisions ripple into UI choices) and #5 (89-mockup upfront cost vs solo founder velocity). The counter-argument (mockups surface chrome needs the design system absorbs) is real but weaker than the case for going first.
2. **The 13–16 foundation mockup scope.** Group 1 (chrome-bearing) + Group 4 (dual-surface partners) + 2–3 G2 (most-novel workflow) is a defensible foundation set if you mitigate the dimension-3 + dimension-5 concerns above (chrome-freeze gate, leftover-Tier-1 acceptance tag).
3. **Phase 3a's 4–6 session estimate.** Realistic for the actual open OQ scope. Don't shrink it.
4. **DESIGN.md.** It's the strongest document in the project. The 985-line discipline (M3 token taxonomy, 19-token status palette, "no-line" rule, Indian-numeric rules, 4 px left pip pattern, tenant accent guard rails) is exactly what you want a design system to look like. The Phase-2b token additions absorbed cleanly via the SI-* anchoring rule. Protect this file.
5. **`decision-log.md` format from DL-001.** Right shape, right discipline. Keep adding to it (starting with DL-002 for the re-sequencing per recommendation 4 above).
6. **Master Spec §3.1's lock list.** Locking React 18, TS strict, Tailwind, shadcn/ui, Radix, Inter, TanStack Table/Query, RHF+Zod, Zustand, Recharts, Node 20, Express, Supabase (Auth/Realtime/RLS/Storage), Drizzle, Vercel, Sentry at master-spec stage is the right move for a solo founder. The exception is Tailwind 3 vs 4 (recommendation 3); the rest of the lock list is sound.
7. **Phase 2c plan tier classification.** Tier 1 / 2 / 3 / Index split is well-reasoned. The 28 Tier 1 promotion rules are the right rules. Tier 2's "structural mockup + lighter critique" is right *for genuine Tier 2 screens*. The fix isn't reclassification; it's the leftover-Tier-1 acceptance tag (recommendation 7).
8. **The screen inventory's 21 CC-* catalogue + per-epic schema.** Comprehensive, traceable, anchored to journey moments and FRs. The bridge between PRD/DESIGN.md and Phase 2c/3a is doing its job.

