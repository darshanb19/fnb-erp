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

### F-003 [RESOLVED — Pass A §1]
**MVP scope wording inconsistency across three locations.**
- Three subtly different framings: front matter (`Contingency-only deferral: Epic 9/11`), Classification table (`No modules deferred`), Project Scoping § Risk Mitigation (`Epic 9/11 could theoretically slip`).
- **Resolution:** Bind to the absolute framing — "All 12 epics; no modules deferred" — in every public-scope section. Contingency note (Epic 9/11 last resort) stays only in Project Scoping § Risk Mitigation Strategy as internal risk management.
- **Rationale (per product owner):** Contingency is internal risk management, not a scope commitment. Published scope = all 12, no exceptions.
- **Files touched:** `_planning/03-prd.md` line 18 (front matter `mvpScope` field). Classification table (line 58) was already absolute — no change. Project Scoping § Risk Mitigation Strategy (lines 521–522) intentionally preserved as the single internal-only home for the contingency.

### F-004 [RESOLVED — Pass A §1]
**Store Manager missing from Executive Summary role list.**
- Six roles named in exec summary; Store Manager appears in Success Criteria and has a full Journey 6 (Vikram) but was not in the exec summary's role list.
- **Resolution:** Make it seven. Insert Store Manager between Kitchen Manager and Dispatch Staff (matches the operational flow: production support sits with production, then distribution downstream). Wording: *"Store Managers who control raw material movement in and out of every store and apply yield factors at goods receipt"*.
- **Rationale (per product owner):** Role inclusion in Executive Summary follows whether the role has a full user journey in the PRD. All seven roles with journeys must be listed.
- **Files touched:** `_planning/03-prd.md` Executive Summary (line 30).

### F-006 [RESOLVED — Pass A §2]
**Cluster Manager missing from Success Criteria and Journeys.**
- Exec summary now lists 7 roles (after F-004) but User Success had 6 entries and Journeys had 6 personas — Cluster Manager was absent from both, despite being referenced repeatedly elsewhere (RBAC matrix, journey delegation, approval routing).
- **Resolution:** Full inclusion. Added Cluster Manager success criterion with measurable target ("clears approval inbox within an hour daily; closes assigned variance investigations within 48 hours"). Added new Journey 2 — Sameer, Cluster Manager of Cluster A — covering cluster-scoped morning briefing, approval inbox (material requisitions, semi-product transfers, sub-threshold POs, Kitchen Manager overrides), variance investigation, cross-cluster transfer escalation. Updated capabilities matrix.
- **Rationale (per product owner):** Cluster Manager has a distinct daily workflow (cluster-scoped approvals, variance investigation, intra-cluster coordination) not reducible to Brand Owner with a filter. Doc was inconsistent — RBAC matrix and journey delegation already referenced the role.
- **Reorder note:** User instruction was "follows the org hierarchy: Brand → Cluster → Kitchen". Existing doc had Kitchen Manager first. Honored the hierarchy intent: User Success now ordered Brand Owner → Cluster Manager → Kitchen Manager → Finance → Dispatch → Procurement → Store. Journeys now ordered Darshan (J1) → Sameer (J2 NEW) → Priya (J3) → Meera (J4) → Ravi (J5) → Anil (J6) → Vikram (J7). If the doc author prefers the original Kitchen-first narrative-archetype framing, request a journey reorder.
- **Files touched:** `_planning/03-prd.md` User Success section (~lines 64–72), Journeys section (lines 110–222), Capabilities matrix (lines ~215–222).

### F-007 [RESOLVED — Pass A §2]
**Brand Owner success criterion was descriptive, not measurable.**
- Original wording: "Opens a single dashboard… Makes cross-location decisions from one screen, not five spreadsheets." Behavioural change, not testable.
- **Resolution:** Replaced with measurable time-to-detect target — "Spots and assigns investigation to operational variances (food cost overruns, closing inventory deviations, expiry write-offs, override frequency spikes) within 24 hours of occurrence."
- **Rationale (per product owner):** Behavioural targets are not testable. Time-to-detect is the operational pain this dashboard solves; making it the success metric anchors the dashboard's design and acceptance criteria.
- **Files touched:** `_planning/03-prd.md` Brand Owner success criterion in User Success section.

### F-008 [RESOLVED — Pass A §2]
**"All operational data exists in one system within 90 days of go-live" — ambiguous (migration vs adoption).**
- Original was unclear whether 90 days was a data-migration target or a new-transaction-adoption target.
- **Resolution:** Clarified as adoption-only. New wording: "Within 90 days of go-live, all new operational transactions (goods receipts, production orders, dispatch challans, sales) are recorded in the ERP rather than in spreadsheets, WhatsApp, or paper. Historical data import is out of scope — selective imports for analytic baselines (recipe history, vendor price history) are post-MVP."
- **Rationale (per product owner):** F&B operations don't have years of clean historical data worth importing. The pain is that new transactions today don't flow through one system. 90-day target = adoption of new transactions, not retroactive migration.
- **Files touched:** `_planning/03-prd.md` Business Success bullet 1.

### F-009 [RESOLVED — Pass A §2]
**"Yield variance flags surface within 24 hours" — system commitment vs workflow norm.**
- Original wording was ambiguous between system delay and workflow expectation.
- **Resolution:** Specified as a system commitment. New wording: "Yield variance flags surface in the system within 24 hours of GR confirmation."
- **Rationale (per product owner):** PRD commits to system behaviour, not workflow norms. Operating procedures live elsewhere.
- **Files touched:** `_planning/03-prd.md` Procurement Manager success criterion in User Success section.

### F-010 [RESOLVED — Pass A §2]
**"Zero data loss on confirmed transactions" — draft scope was implicit, not explicit.**
- Original line said "Zero data loss on confirmed transactions." Drafts/in-progress entries were silently excluded.
- **Resolution:** Pinned down explicitly. New wording: "Zero data loss on confirmed transactions. Drafts and in-progress entries that have not been confirmed are not covered — these are user-session state and may be lost on session interruption (closed browser, dead phone, network drop). The system must clearly indicate whether an entry is draft (not durable) versus confirmed (durable) so users know what state they're in."
- **Rationale (per product owner):** Confirmed-only data durability is the right scope. Adds a UI obligation — every form must surface its draft/confirmed state visibly.
- **Implication for Phase 2b:** This adds a screen-inventory requirement — every form/screen must display its draft/confirmed state. Logged to Phase 2b parking lot.
- **Files touched:** `_planning/03-prd.md` System Success bullet 4.

---

## Phase 2b prep parking lot

(Items surfaced during this review that should feed into the Phase 2b screen inventory.)

- **P2B-001 [from F-010]** Every form/screen that supports data entry must visibly indicate whether the current entry is in **draft** state (not durable; will be lost on session interruption) or **confirmed** state (durable; survives any single point of failure). Treat this as a cross-cutting UI requirement during screen inventory — flag it on every form-bearing screen, not just transactional ones.

---

## Phase 3a — Technical decisions deferred

(Technical / architectural questions raised during PRD review that the product owner is not the right person to answer. To be proposed by the architect during Phase 3a and reviewed by the product owner. Each entry should state the question, the surrounding PRD context, and any constraints already implied by master-spec or PRD that narrow the answer space.)

*— none yet —*

---

## End-of-review consolidation

This section will be filled in at the close of the full review (after Pass D). Three lists:
- **(a) Ambiguities** — must resolve before architecture
- **(b) Potential contradictions** with master spec / brainstorming / B2B challan spec
- **(c) Phase 2b prep items** — to inform UX / screen inventory work

*— pending —*
