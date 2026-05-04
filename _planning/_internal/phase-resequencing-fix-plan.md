# Phase Re-Sequencing — Fix Plan (v2)

> **Purpose:** Synthesise findings from two independent critiques (Claude Code + claude.ai web) of the 2026-05-05 phase re-sequencing, prioritise them as a fix plan, and propose concrete edits for a single fix session before Phase 3a kicks off.
> **Source critiques:** `phase-resequencing-critique.md` (Claude Code) + `claude-web-phase-resequencing-critique.md` (claude.ai web), both 2026-05-05
> **Cross-verification:** Same Claude Code session that ran the original critique cross-reviewed v1 of this fix plan; this is v2 incorporating all reviewer corrections.
> **Status:** Ready for execution after user confirms D1 (Tailwind path) + authorises fix session.
> **Date:** 2026-05-05.

---

## 1. Cross-critique synthesis (corrected per cross-verify)

### 1.1 Both critiques AGREE (high confidence — fix without further debate)

| # | Finding | CC | Web |
|---|---|---|---|
| A | **Tailwind v3 vs v4 governance violation** — Master Spec §3.1 says "Tailwind 3.x ✅ FINAL"; Phase 2c plan §10.1 + §19 Q6 + §20 step 2 all say v4 with exact pin. §3 governance: "do not work around it silently." | ✅ | ✅ |
| B | **`claude.md ## Current phase` stale** — says "Phase 2a — PRD review"; reality is 2c-prep DONE, 3a NEXT. | ✅ | ✅ |
| D | **Mockup count arithmetic broken** — roadmap + §16 say "13 mockups: 10 + 3 + 2-3" = 15 or 16. Pick a number, state it consistently. | ✅ | ✅ |
| E | **`_planning/06-phase-roadmap.md` missing from `claude.md ## Read first`** — canonical phase doc isn't in auto-load list. | ✅ | ✅ |
| G | **OQ9 needs rationale citation + §11 row update** — actual decision (in-repo Vite/shadcn) isn't in §11 OQ9's option list (still says Stitch/Imagine/hybrid). | ✅ | ✅ |
| H | **Phase 4 cognitive overload risk** — interleaving backend + frontend + 6 mockups in one workflow per epic violates `claude.md ## Context management` 60-70% rule. | ✅ | ✅ |
| K | **OQ list missing items** — §11 is non-exhaustive. CC + web both name several. (Specific items + my picks in P1.1 below.) | ✅ | ✅ |
| W1 | **OQ3 (real-time strategy) is constrained by §3.1 Supabase Realtime FINAL** — OQ3 is event-triage scope (which events use Realtime vs polling), NOT vendor selection. | ✅ (CC §1) | ✅ |

### 1.2 Web-only findings (CC missed; worth folding in)

| # | Finding | Severity |
|---|---|---|
| C | **`claude.md` "10 open questions" wording is internally contradictory** — same line says "10 open questions … OQ10 resolved at the PRD level … other 9 remain". CC flagged the staleness but not the OQ-count contradiction. | Medium |
| F2 | **Phase 2c plan §13 still flags Q1–Q5 as "Open kickoff questions"** — §19 captures all 6 as resolved. Add status banner. | Medium |
| F3 | **Phase 2c plan §19 Q5 "Implications for Session 2" references old §16 (S5–S10)** — Q7 superseded but Q5's implication block wasn't updated. | Low |
| I | **Q7 re-sequencing itself isn't in `decision-log.md`** — same failure mode as the deleted StockFlow chat. By the log's own rubric, textbook DL entry. (CC §10 flagged mockups-vs-production as DL-worthy, but not Q7 itself.) | High |
| W2 | **OQ8 (caching) is constrained by §3.1 TanStack Query FINAL** — OQ8 is "Redis additionally?", not binary. | High |
| W3 | **OQ9's options list in §11 is stale** — still presents Stitch/Imagine/hybrid; actual decision isn't on the list at all. §11 amendment needed (not just status flip). | High |
| W4 | **"~75 standard screens" framing distortion** — silently demotes 12–13 leftover Tier 1 heroes into "standard CRUD" treatment. They're not standard. | High |
| W5 | **Stale-mockup risk reverses sign in Phase 4** — mockups built during Epic N absorb that epic's ad-hoc patterns and don't propagate back. Without chrome-freeze gate per epic, chrome drifts. | Medium-high |
| W6 | **Tier 2 "lighter critique" applied to leftover Tier 1 heroes is wrong by design** — full Tier 1 acceptance needed even when built mid-Phase-4. | High |
| W7 | **DESIGN.md §21.4 (per-tenant theme bundle build pipeline) defers to Phase 3a but isn't in §11.** | Medium |
| W8 | **DESIGN.md §11.3 (Stitch→Lucide conversion table) defers to architecture.md but is now MOOT** because OQ9 abandoned the Stitch path. | Low |
| W9 | **Roadmap "Phase status table 2c-prep DONE" claim is technically false** — DESIGN.md §5.3.1 + §10.5 edits scheduled for Phase 2c S2 per §10.10. | Low |

### 1.3 CC-only findings (web missed; worth folding in)

| # | Finding | Severity |
|---|---|---|
| C-only_C | **`claude.md` "10 open questions" internal contradiction** (corrected attribution — was misattributed to "both" in v1). | Medium |
| C-only_F1 | **Phase 2c plan §17 not marked superseded** — S1 closed in source session; §17 is historical. (Web didn't surface this; F2/F3 above are different sections.) | Medium |
| C1 | **tRPC slip in roadmap reason 3** — uses "tRPC query" as example phrasing; Master Spec §3.2 says REST API (not GraphQL) FINAL. | Low |
| C2 | **Cross-phase invariants doesn't name `_planning/06-phase-roadmap.md` itself as invariant doc** — self-referentially missing. | Low |
| C3 | **CC-IMPLAUSIBILITY-WARN, CC-VOICE-INPUT, CC-DUPLICATE-WARN not exercised in any of the 13–15 candidates** — surface for first time mid-Epic. Worth a known-gap-for-Phase-4 list. | Medium |
| C4 | **Phase 3a 4-6 session estimate is "padded"** — CC recommends 3-4. Web pushes back: "4-6 plausible, don't shrink". My call: keep 4-5. | Low |
| C5 | **CC §10 discipline-gap observation** — `claude.md ## Current phase` mechanism exists, discipline doesn't (hasn't been updated since Phase-2b close). Worth a single-line addition to roadmap §"Cross-phase invariants" naming the discipline. | Medium |
| CC §4 | **CC named 8 missing OQs; v1 absorbed 6 + dropped 2 silently.** Cross-verify pushed back: notification transport + concurrency/idempotency are NOT absorbable by "non-exhaustive footnote". (Now added explicitly per §1.4 row 3 below.) | High |

### 1.4 Where the critiques DIVERGE — my call on each (revised per cross-verify)

| Topic | CC position | Web position | My call (rationale) |
|---|---|---|---|
| **Phase 3a session count** | 3-4 sessions (current 4-6 padded) | 4-6 plausible, don't shrink | **4-5 sessions.** Decision-log writing + architecture.md synthesis effort for non-technical founder warrants the upper bound, not the lower. |
| **Foundation mockup widening** | Add 4-5 Group-2 workflow screens (DSP-010, PRO-011, PUR-009, ACC-014, USR-006) → 17-18 total | Tag leftover Tier 1 with "Tier 1 acceptance in Phase 4" + chrome-freeze gate per epic; keep at 13-16 | **HYBRID — corrected per cross-verify.** v1 said "pure-tagging" but P0.4 already committed to including DSP-010 + PRO-011 in the 15-mockup foundation. Aligning §1.4 with P0.4: hybrid = pick 2 of CC's candidates (DSP-010 + PRO-011 — exercises CC-PROVISIONAL-FLAG, CC-GST-FIELD-VALIDATION, CC-UNREGISTERED-CUSTOMER-WARN, atomic journal-fire) + tag remaining Tier 1 heroes "Tier 1 acceptance in Phase 4" + chrome-freeze gate per epic. ~1 extra session vs pure-tagging; meaningfully reduces blind first-encounter risk for the highest-concentration CC-* novel patterns. |
| **OQ list expansion** | Add OQ11–OQ18 explicitly (audit, notification transport, file storage, concurrency, etc.) | Add specific gaps + footnote constrained OQs to §3.1 locks | **HYBRID — revised per cross-verify.** Add web's OQ amendments (footnote OQ3/OQ8 to §3.1 locks, fix OQ9's option list). Add specific gaps as new OQ entries (multi-tenant query pattern, audit trail mechanism, file storage layout, RLS authoring, brand_id index migration template, **notification transport, concurrency/idempotency** — last two added per cross-verify pushback as not absorbable by "non-exhaustive footnote"). DON'T pre-list everything; add a "§11 non-exhaustive" note for the rest. |
| **Alternative sequence (3a-narrow → 2c-scoped+ all 28 Tier 1 → 3a-rest → 4)** | Raised in CC §8 (resolve OQs that affect UI design first; defer OQ1/2/5/6/7) | Raised in web §8 ("not strongly recommended over your current plan") | **Skip.** Both critiques raised structurally similar variants; both arrived at "not recommended over current plan". Pays 2-3 extra sessions for chrome-drift insurance. Hybrid mockup widening (above) + chrome-freeze gate is cheaper insurance for similar coverage. Attribution corrected per cross-verify (CC did raise it). |

---

## 2. Decision points needing user input

**ONE decision blocks fix execution:**

### D1 — Tailwind v3 vs v4

Both critiques flag this as the most serious unflagged issue. **Cross-verify confirmed Path A.** Reviewer's exact words: *"Path A is the right call. Master Spec §3 governance explicitly permits formal change request; that's exactly what DL-002 + §3.1 amendment does. Practical considerations support it: shadcn/ui defaults to v4 by 2026-05 (the §3.1 v3 lock dates from a spec written when v3 was the shadcn default); v4's @theme directive is what Phase 2c plan §10.6 globals.css spec is built around; Path B (rollback) means rewriting the scaffold spec for ~no benefit."*

**Path A: Amend Master Spec §3.1 to v4 (with formal change request + DL entry).** RECOMMENDED.

**Need user confirmation: Path A before fix session executes.**

---

## 3. Scope — in-scope vs explicitly out

### 3.1 In scope: artefact corrections (P0 + P1.1–P1.6 + P2)

These are documentation hygiene fixes for inconsistencies, attribution errors, stale state, missing entries. Mechanical edits to existing files.

### 3.2 In scope: methodology additions per critique mitigations (P1.7 — flagged explicitly per cross-verify)

These are **new commitments derived from the critiques**, not corrections to existing artefacts. Per cross-verify pushback: "P1.3 is scope expansion, not artefact correction. Defensible inclusion but should be explicitly named so the user signs off on the methodology change rather than slipping it through under 'fixes.'"

The methodology additions:

- **Phase 4 per-epic 3-arc structure** — each Phase 4 epic decomposes into 3 sub-sessions: (a) backend schema + service-layer + integration tests; (b) just-in-time mockups for that epic's deferred screens; (c) production frontend code consuming foundation chrome + new mockups + real services.
- **Chrome-freeze review gate per Phase 4 epic** — at end of each epic, review cross-epic chrome consistency before next epic starts. Drift = mandatory fix-back.
- **Tier 1 Acceptance Tag for deferred heroes** — the 12–13 leftover Tier 1 hero screens (Group 2 + Group 3) carry "Tier 1 acceptance applies even though built in Phase 4" tag. Tier 2 lighter-critique acceptance does NOT apply.
- **Phase boundary crossing discipline** — single line in roadmap §"Cross-phase invariants" naming "phase boundary crossing requires same-commit update of `## Current phase`". Addresses CC §10 recurrence pattern.

These are governance changes the user must explicitly sign off on, not silent edits.

### 3.3 Out of scope (explicitly NOT in this fix session)

- Re-debating the Phase 3a-before-2c re-sequencing itself (both critiques confirmed it's sound)
- Adding the alternative sequence variant (web's "3a-narrow → 2c-scoped+ → 3a-rest → 4") — skipped per §1.4
- Pre-deciding OQ resolutions (Phase 3a brainstorming territory)
- Architecture-level decisions on missing OQs (Phase 3a will produce these; this fix session only adds them as OQ entries)
- Implementing scaffold work (gated on Phase 3a closure)
- DESIGN.md §5.3.1 (glassmorphism opt-in) and §10.5 (animation library policy) — defer to Phase 2c S2 per §10.10 (P2.5 footnote suffices for now)
- Per-tenant theme bundle build pipeline (DESIGN.md §21.4 + web W7) — surface as DL during Phase 4 first multi-tenant work
- Roadmap reason 2 rhetorical strengthening — not worth re-editing the rationale doc

---

## 4. Fix list — prioritised (P0 critical → P1 important → P2 hygiene)

### P0 — Critical: governance / blocks Phase 2c S2 readiness

**P0.1 — Resolve Tailwind v3 vs v4** (per D1 decision; Path A recommended)
- Amend Master Spec §3.1 row "Tailwind CSS | 3.x | ✅ FINAL" to "Tailwind CSS | 4.x | ✅ FINAL — superseded 3.x at Phase 2c-prep, see DL-002".
- Add DL-002 to `decision-log.md` with rationale + cross-references to commits `d8333db` + `da1c35f` + Phase 2c plan §19 Q6 + §20.

**P0.2 — Update `claude.md` `## Current phase`**
- Change from "Phase 2a — PRD review. No implementation yet…" to:
  > **Phase 3a — Architecture (NEXT).** Phases 1, 2a, 2b, 2c-prep ✅ DONE (see `_planning/06-phase-roadmap.md` for canonical sequence). Phase 3a resolves Master Spec §11 OQ1–OQ8 + captures OQ9 already-decided + produces OQ10 column-mapping deliverable. Phase 2c-scoped (visual mockup foundation) and Phase 4 (epic implementation) gated on Phase 3a closing (`_planning/architecture.md` lands).
- Fix the contradictory "10 open questions" wording to: "9 still-open OQs (OQ1–OQ9); OQ10 resolved at the PRD level (FR96 — dual-format export) with column-name mapping spec deferred to Phase 3a deliverable."

**P0.3 — Add Q7 re-sequencing to `decision-log.md` as DL-003**
- One-paragraph entry: Decision (Phase 3a Architecture before Phase 2c-scoped mockups; Phase 2c scoped down 89→15 mockups; Tier 2/3/Index defer to Phase 4 mockup-as-you-build) + Source (Phase 2c plan §19 Q7) + Why + Cross-references (`_planning/06-phase-roadmap.md`, Phase 2c plan §19 Q7, commit `eaf0959`).

**P0.4 — Fix mockup arithmetic; commit to 15**
- Roadmap "Phase status table" row 6: state explicitly "**15 foundation mockups** (10 chrome-bearing + 3 dual-surface partners + 2 most-novel workflow [DSP-010 GST closure, PRO-011 In Progress transition])".
- Phase 2c plan §1, §16, §19, §20: same fix consistently.
- Hybrid mockup-widening rationale per §1.4 row 2 (corrected): include DSP-010 + PRO-011 as committed scope; PUR-009 as stretch goal noted but not committed.
- Note: technically blocks Phase 2c S2, not Phase 3a directly. Kept at P0 for low-cost framing; the "blocks downstream phases" framing is loose but tolerable per cross-verify.

### P1 — Important: prevents Phase 3a re-debate / mid-execution surprises

**P1.1 — Amend Master Spec §11 OQ list:**
- **OQ3:** add footnote: "Constrained by §3.1 Supabase Realtime FINAL — OQ3 scope is event-triage (which specific events use Realtime subscriptions vs polling vs optimistic UI), NOT vendor selection."
- **OQ8:** add footnote: "Constrained by §3.1 TanStack Query FINAL — OQ8 scope is 'Redis additionally for hot paths?', not binary cache choice."
- **OQ9:** mark RESOLVED. Rewrite the row: "✅ RESOLVED at Phase 2c-prep (2026-05-05). Decision: in-repo Vite + React + Tailwind + shadcn/ui (NOT Stitch, NOT Claude Artifacts). Rationale: shadcn/ui is FINAL per §3.1; in-repo workflow gives mechanical token enforcement (typo = build error), shared component reuse, and engineer handoff fidelity vs sandboxed alternatives. See DL-004 + Phase 2c-prep tooling review thread + commits `d8333db`, `da1c35f`. Original options (Stitch / Imagine / hybrid) superseded."
- Add DL-004 entry capturing OQ9 resolution.
- **Add new OQ entries** (per CC + web + cross-verify pushback):
  - **OQ11** Multi-tenant query pattern enforcement (Express middleware? Drizzle wrapper? `withBrand` builder? — note: §3.1 doesn't preclude any of these since REST is the chosen API, but the in-process query pattern is the question)
  - **OQ12** Audit trail mechanism (trigger-based vs application-layer; FR20/21 + CC-AUDIT-LINK)
  - **OQ13** File storage layout pattern (per-brand vs per-entity bucket; signed-URL vs direct upload; FR39, FR81)
  - **OQ14** RLS policy authoring strategy (when, by whom, template?)
  - **OQ15** brand_id index migration template (every major table per §3.2)
  - **OQ16** Notification Center transport + dispatch model (Supabase Realtime in-app channel + email transport — Resend/Postmark? — + dispatch model — queue/direct/batched per FR19)
  - **OQ17** Concurrency / idempotency (advisory locks vs optimistic-with-version for `inventoryService.deductStock`; idempotency keys for IRN paste in DSP-010 + PO approval in PUR-004)
- **Footnote at end of §11:** "This list is non-exhaustive. Phase 3a may surface additional architecture decisions; capture as DL-NNN entries with explicit rationale that §11 was non-exhaustive at scoping time."
- **Add DL-005 (mockups-vs-production-code-seed):** Master Spec §3.2 implies the answer (`apps/web` + `apps/api` separate from `mockups/`). Capture explicitly so Phase 3a doesn't re-litigate. *Not added as an OQ entry per cross-verify — DL captures resolved decisions, not open questions.*

**P1.2 — Add `_planning/06-phase-roadmap.md` AND `_planning/05-screen-inventory.md` to `claude.md ## Read first, every session`**

**P1.3 — Add Phase 4 invariants to roadmap §"Cross-phase invariants" + mirror in `claude.md`** (per §3.2 methodology additions sign-off)
- **Per-epic 3-arc structure** (text per §3.2 above)
- **Chrome-freeze review gate** (text per §3.2 above)
- **Tier 1 Acceptance Tag for deferred heroes** (text per §3.2 above)
- **Phase boundary crossing discipline** — one line: "Phase boundary crossing requires same-commit update of `## Current phase` in `claude.md`. Mechanism existed since Phase 2a; discipline lapsed across 2b/2c-prep (caught in Phase-3a-prep critique)."

**P1.4 — Mark Phase 2c plan §17 SUPERSEDED**
- Add header: `> **SUPERSEDED 2026-05-05 — see §20 (Session 2 kickoff prompt) for current cadence. §17 retained as historical artefact of Session 1 brainstorming setup.**`

**P1.5 — Update Phase 2c plan §13 with status banner**
- Add at top of §13: `> **STATUS: All 6 questions resolved 2026-05-05 — see §19 for captured decisions. Section retained as historical context. Do NOT re-brainstorm.**`

**P1.6 — Update Phase 2c plan §19 Q5 "Implications for Session 2"**
- Strike obsolete "§16 unchanged — S2 → S3 (G1) → S4 (G2) → S5 (G3+4) → S6–S8 (Tier 2)…" reference.
- Replace with: "§16 session breakdown reflects current scoped cadence (3 sessions: S2 scaffold + S3 G1 + S4 G4 + selected G2 [DSP-010 + PRO-011]). Q5 reactive-review principle still holds — call review sessions after S3 and S4 land via Vercel preview URLs."

**P1.7 — Phase 3a kickoff prompt §3.1/§3.2 reading instruction** *(promoted from P2.3 per cross-verify — this is the active mitigation for "Phase 3a re-debates closed ground" risk; not hygiene)*
- Add line before brainstorming instructions in roadmap §"Phase 3a kickoff prompt": "**Before brainstorming each OQ, read Master Spec §3.1 + §3.2 to confirm what's already locked. Don't re-debate FINAL decisions.** For OQ3, scope is event-triage; for OQ8, scope is 'Redis additionally?'; for OQ9, scope is formal capture of Phase 2c-prep decision (no re-debate). For OQ11–OQ17, scope is fresh resolution."

### P2 — Hygiene: documentation polish

**P2.1 — Fix tRPC slip in roadmap "Why this sequence" reason 3**
- Change "dashboards refresh on demand via tRPC query, not real-time subscription" → "dashboards refresh on demand via REST query (Master Spec §3.2 FINAL), not Realtime subscription (Master Spec §3.1 FINAL — used selectively per OQ3 triage)".

**P2.2 — Add `_planning/06-phase-roadmap.md` to roadmap §"Cross-phase invariants" as itself an invariant doc**
- Self-referential reminder: future phases must keep this doc current.

**P2.3 — Add specific known-chrome-gap list to roadmap Phase 4 section** *(was P2.4 in v1; specifics per cross-verify)*
- List the patterns that will first surface during Phase 4 epic-by-epic (since they're not in foundation Tier 1 Group 1 + Group 4 + DSP-010 + PRO-011):
  - **CC-IMPLAUSIBILITY-WARN** — first surfaces in Epic 4 INV (closing inventory POS, possibly GR Entry on mobile)
  - **CC-VOICE-INPUT** — first surfaces in Epic 4 INV (mobile-first data entry contexts) and Epic 7 PRO (production output entry)
  - **CC-DUPLICATE-WARN** — first surfaces wherever it's defined (verify CC catalogue)
  - **CC-OVERRIDE-WIDGET** — wait, this IS in SI-RPT-002 which IS in foundation Group 1; verify during fix execution whether it's actually deferred
  - Note: CC-PROVISIONAL-FLAG, CC-GST-FIELD-VALIDATION, CC-UNREGISTERED-CUSTOMER-WARN are NOW exercised by DSP-010 + PRO-011 in foundation per the hybrid widening; remove from gap list
- Chrome-freeze gate per P1.3 catches retroactive applicability; this list is the "watch for them" list.

**P2.4 — Resolve roadmap "Phase status table 2c-prep DONE" technical inaccuracy**
- Add asterisk: "2c-prep DONE\* (\* = DESIGN.md §5.3.1 + §10.5 amendments scheduled to land in Phase 2c S2 per Phase 2c plan §10.10; treat as carry-over)".

**P2.5 — Resolve DESIGN.md §11.3 Stitch→Lucide conversion table moot status**
- Add note: "✅ MOOT 2026-05-05. OQ9 resolved as in-repo Vite/shadcn (NOT Stitch). Conversion table no longer needed. Lucide is the only icon path per DESIGN.md §11.1."

---

## 5. Fix-session execution order

Single fix session, **~75 minutes total** *(corrected per cross-verify — v1 said 45-60 but steps summed to 65; v2 adds PR ceremony per cross-verify pattern-consistency point)*.

1. **(2 min)** Confirm Tailwind v3 vs v4 with user (D1) — Path A confirmed by cross-verify, await user explicit OK.
2. **(15 min)** P0.1 (Tailwind decision + Master Spec §3.1 amendment + DL-002).
3. **(5 min)** P0.2 (`claude.md ## Current phase` + OQ count wording).
4. **(5 min)** P0.3 (Q7 re-sequencing → DL-003).
5. **(5 min)** P0.4 (mockup arithmetic — commit to 15: 10 + 3 + 2 [DSP-010, PRO-011]; propagate to roadmap + Phase 2c plan §1/§16/§19/§20).
6. **(20 min)** P1.1 (Master Spec §11 amendments: OQ3/OQ8 footnotes + OQ9 RESOLVED row + OQ11–OQ17 additions + non-exhaustive footnote + DL-004 OQ9 + DL-005 mockups-vs-production).
7. **(2 min)** P1.2 (CLAUDE.md `## Read first` adds).
8. **(10 min)** P1.3 (Phase 4 invariants in roadmap + claude.md mirror — including phase-boundary discipline line).
9. **(3 min)** P1.4 (§17 SUPERSEDED header).
10. **(2 min)** P1.5 (§13 status banner).
11. **(3 min)** P1.6 (Q5 implications update).
12. **(2 min)** P1.7 (Phase 3a kickoff prompt §3.1/§3.2 reading instruction — promoted from P2.3 per cross-verify).
13. **(2 min)** P2.1 (tRPC → REST slip fix).
14. **(3 min)** P2.2 + P2.3 (roadmap polish + known-chrome-gap list with specific patterns).
15. **(1 min)** P2.4 (2c-prep asterisk footnote).
16. **(1 min)** P2.5 (DESIGN.md §11.3 moot note).
17. **(15 min)** **PR + self-review + merge** *(corrected per cross-verify — v1 said no-PR; pattern consistency with PR #2/#3/#4 + fix scope touches §3.1/§11 enough to warrant a final visual cross-check via PR diff)*:
    - Single commit on `phase-3a-prep/critique-fixes` branch off main
    - `git push -u origin phase-3a-prep/critique-fixes`
    - `gh pr create --title "Phase 3a-prep: critique fixes" --body "..."` (full PR body referencing cross-verify findings + acceptance criteria from §6)
    - Self-review the PR diff in browser — final visual cross-check that all P0/P1/P2 fixes landed correctly
    - `gh pr merge --squash --delete-branch` (or fast-forward if cleaner)

---

## 6. Acceptance criteria for fix session (revised)

- [ ] D1 Tailwind decision (Path A) captured; Master Spec §3.1 amended to v4; DL-002 entry exists with cross-references
- [ ] `claude.md ## Current phase` accurately reflects "Phase 3a NEXT"
- [ ] OQ count wording in `claude.md` is internally consistent (9 + 1 PRD-resolved)
- [ ] Mockup count states **15** consistently across roadmap + Phase 2c plan §1/§16/§19/§20 (10 + 3 + 2)
- [ ] DSP-010 + PRO-011 explicitly named as the 2 committed Group-2 workflow screens in Phase 2c-scoped foundation
- [ ] Decision-log has DL-002 (Tailwind), DL-003 (re-sequencing), DL-004 (OQ9 capture), DL-005 (mockups-vs-production)
- [ ] Master Spec §11 has updated OQ3/OQ8 footnotes
- [ ] Master Spec §11 OQ9 row is RESOLVED with full options-list rewrite (Stitch/Imagine triple superseded)
- [ ] Master Spec §11 has new OQ11–OQ17 entries (multi-tenant query pattern, audit, file storage layout, RLS authoring, brand_id index migration, **notification transport, concurrency/idempotency**)
- [ ] OQ16 mockups-vs-production NOT in §11 OQ list (kept as DL-005 only per cross-verify)
- [ ] Master Spec §11 has non-exhaustive footnote
- [ ] `claude.md ## Read first` includes both `_planning/05-screen-inventory.md` AND `_planning/06-phase-roadmap.md`
- [ ] Roadmap §"Cross-phase invariants" includes per-epic 3-arc + chrome-freeze gate + Tier 1 acceptance tag for deferred heroes + phase-boundary discipline line; mirrored in `claude.md`
- [ ] Phase 2c plan §17 marked SUPERSEDED
- [ ] Phase 2c plan §13 has resolved-status banner
- [ ] Phase 2c plan §19 Q5 implications text updated to current §16 cadence (no S5–S10 refs)
- [ ] Roadmap §"Phase 3a kickoff prompt" includes "read §3.1 + §3.2 before brainstorming each OQ" instruction
- [ ] Roadmap reason 3 says REST query (not tRPC)
- [ ] Roadmap §"Cross-phase invariants" names itself as an invariant doc
- [ ] Roadmap Phase 4 section has known-chrome-gap list with specific patterns (CC-IMPLAUSIBILITY-WARN, CC-VOICE-INPUT, etc.)
- [ ] Roadmap Phase status table has asterisk on "2c-prep DONE\*" with footnote
- [ ] DESIGN.md §11.3 marked MOOT with note
- [ ] Single commit on `phase-3a-prep/critique-fixes` branch, pushed, PR opened, self-reviewed in browser, merged to main, branch deleted (per cross-verify pattern-consistency)
- [ ] CLAUDE.md state cross-checks: `## Current phase` updated; `## Read first` updated; Phase 4 invariants added; in sync with roadmap

---

## 7. After the fix session

Once acceptance criteria pass and PR merges to main:

1. Phase 3a kickoff prompt (in `_planning/06-phase-roadmap.md`) is the next-fresh-session paste target
2. Phase 3a kickoff prompt now includes the §3.1/§3.2 reading instruction per P1.7
3. Master Spec §11 has constraint-aware OQ list per P1.1 (OQ1–OQ17 + non-exhaustive footnote)
4. `claude.md` accurately reflects Phase 3a starting state
5. Decision-log carries DL-002 through DL-005 as evidence trail
6. Phase 4 invariants (per-epic 3-arc + chrome-freeze + Tier 1 tag + boundary discipline) survive session resets via roadmap + claude.md mirror

Ready to start Phase 3a in a fresh session.

---

## 8. Changelog v1 → v2 (cross-verify corrections)

Per the same Claude Code session that ran the original critique cross-reviewing v1:

- **5 attribution corrections** in §1 (rows C, F, I; W1; alternative sequence). Misattributions didn't change conclusions but erode synthesis confidence; corrected throughout.
- **Materially missing OQs added** — notification transport (OQ16) and concurrency/idempotency (OQ17). Reviewer's pushback: not absorbable by "non-exhaustive footnote" — affect Notification Center §10 spec entirely; mechanism for `inventoryService.deductStock` atomicity is genuinely open per DL-001.
- **Mockup widening: pure-tagging → hybrid.** v1 §1.4 row 2 said "pure-tagging" but P0.4 already committed to DSP-010 + PRO-011 (= partial widening). v2 aligns §1.4 with P0.4: hybrid = include 2 of CC's 5 candidates + tag remaining + chrome-freeze gate.
- **OQ16 (mockups-vs-production) DROPPED from OQ list per cross-verify** — semantic conflict (an OQ is a question; a DL is the answer; §3.2 implies the answer; should be DL-005 only, not OQ + DL).
- **P2.3 (Phase 3a §3.1/§3.2 reading instruction) PROMOTED from P2 hygiene to P1.7** — active mitigation for "Phase 3a re-debates closed ground" risk; without binding §3.1 reading per OQ, the OQ3/OQ8 footnotes alone don't prevent re-litigation.
- **§3 renamed: "Out of scope" → "Scope: in-scope vs explicitly out"** — methodology additions per critique mitigations explicitly named (§3.2) so user signs off on the methodology change rather than slipping it through under "fixes". Per cross-verify pushback that P1.3 is scope expansion, not artefact correction.
- **§5 step 16 changed from "no PR — direct merge" to "PR + self-review + merge"** — pattern consistency with PR #2/#3/#4; fix scope touches Master Spec §3.1 + §11 enough to warrant a final visual cross-check via PR diff. v1 said no-PR; cross-verify pushed back.
- **§5 time estimate corrected** — v1 header said 45-60 min but steps summed to 65 min; v2 says ~75 min (added PR ceremony).
- **CC §10 discipline-gap recurrence pattern** addressed via P1.3 single-line addition to roadmap §"Cross-phase invariants" naming the discipline.
- **P2.4 (now P2.3) known-chrome-gap list specifics** — explicit pattern names (CC-IMPLAUSIBILITY-WARN, CC-VOICE-INPUT, CC-DUPLICATE-WARN), with note that CC-PROVISIONAL-FLAG / CC-GST-FIELD-VALIDATION / CC-UNREGISTERED-CUSTOMER-WARN are now exercised by DSP-010 + PRO-011 (no longer deferred).
- **D1 Tailwind**: cross-verify confirmed Path A explicitly; quoted reviewer's confirmation in §2.

Net: v2 is ~95% there. Land the additions, execute per §5, verify against §6.

---

*End of fix plan v2 — 2026-05-05*
