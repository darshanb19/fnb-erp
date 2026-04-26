# PRD Review Notes — Working Document

**Phase:** 2a (PRD review)
**Started:** 2026-04-27
**Source PRD:** `_planning/03-prd.md` (FR1–FR119)
**Cross-check sources:** `_planning/02-master-spec.md` v1.2, `_planning/01-brainstorming-summary.md`, `_planning/04-b2b-challan-spec.md`, `CLAUDE.md`

## Purpose

Living log of issues surfaced during the section-by-section PRD review. Captured here so the actual PRD stays clean and the consolidated end-of-review summary has a single source.

## Categories

Each entry is tagged with one of:

- **AMB** — Ambiguity to resolve before architecture
- **CONTRA** — Potential contradiction with master spec, brainstorming summary, or B2B challan spec
- **PHASE2B** — Item to think about before Phase 2b (UX / screen inventory)
- **DEFERRED** — Flag raised mid-pass, deferred to a later section for the substantive discussion
- **RESOLVED** — Logged and closed during review

Each entry also tagged with the section it came from (e.g. `Pass A §1`, `Pass C §15`).

---

## Open entries

### Deferred to relevant pass

#### F-001 [DEFERRED → Pass C §19 (Accounting FR87–FR99)]
**"Revenue — Internal Dispatch" account vs Internal Dispatch journal mapping — possible conflation.**
- FR88 seeds a `Revenue — Internal Dispatch` account in the CoA.
- FR89 simultaneously says "Internal Dispatch confirmed (inventory movement only, no journal)".
- FR89 also says "Sales import confirmed → DR Cash/Bank, CR Revenue — Internal Dispatch".
- This conflates the **internal movement** (Production → Dispatch → POS, intra-entity, no revenue) with the **POS sales recognition** (which is the actual revenue event).
- Suggests either a misnaming of the account (it's really "Revenue — POS Sales" or similar) or a missing distinction between internal movement and final retail sale.
- Cross-check: B2B has its own clear `Revenue — B2B Sales` line, so the internal-vs-retail distinction matters for COGS recognition timing too.
- **Action when reached:** Decide whether to (a) rename the account, (b) split into two accounts, or (c) revise FR89's mapping rule wording.

#### F-002 [DEFERRED → Pass C §15 (Production FR57–FR70)]
**Production Order lifecycle vocabulary — confirm canonical state machine.**
- FR68 specifies: Draft → Pending GR (no deduction) → Confirmed (no deduction yet) → In Progress (deduction fires via `inventoryService.deductStock()`) → Completed.
- Master Spec §2.6 just says "Material deduction from enabled dept" — silent on which status triggers it.
- Master Spec §6.3 journal mapping rule (per FR89 above) ties COGS journal to "Production Order moved to In Progress" — consistent with FR68.
- Brainstorming summary doesn't pin down the lifecycle.
- **Likely no contradiction**, but PRD is the only place the full 5-status lifecycle is named. Confirm this is canonical, then ensure §11 module-interface-contract for `inventoryService.deductStock()` is invoked exactly at the In Progress transition.
- **Action when reached:** Confirm canonical, log to decision-log if accepted, and verify FR67 (retrospective adjustment on GR confirmation) works correctly given that deduction has already happened at In Progress with provisional costs.

---

## Resolved entries

### R-001 [RESOLVED — Pass A startup]
**Open-question count drift between docs (9 vs 10).**
- CLAUDE.md said "9 open questions in master-spec §11".
- Master spec §10 Phase 3a row said "the 9 open questions in §11".
- Master spec §11 had 9 rows; closing line said "all 9 questions".
- PRD §"Pre-Implementation Gate" had 10 OQs, with OQ10 marked resolved at PRD level (FR96 — dual Tally + Zoho + Generic CSV exports).
- **Resolution:** Updated all three places to reflect 10 OQs total, OQ10 resolved at PRD level, 9 still-open for architecture. Architecture-phase deliverable for OQ10 = column-name mapping spec per format.
- **Files touched:** `CLAUDE.md` line 47, `_planning/02-master-spec.md` lines 633 and 656 (and OQ10 row added to §11 table).

---

## Phase 2b prep parking lot

(Items surfaced during this review that should feed into the Phase 2b screen inventory.)

*— none yet —*

---

## End-of-review consolidation

This section will be filled in at the close of the full review (after Pass D). Three lists:
- **(a) Ambiguities** — must resolve before architecture
- **(b) Potential contradictions** with master spec / brainstorming / B2B challan spec
- **(c) Phase 2b prep items** — to inform UX / screen inventory work

*— pending —*
