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

### F-011 [RESOLVED — Pass A §3]
**Cross-cluster raw-material reallocation contradiction in Sameer's journey vs §2.2 flow rules.**
- Sameer's freshly written Journey 2 described a direct Cluster B → Cluster A tomato transfer for surplus/expiry redistribution. Master Spec §2.2 states raw materials are "Never lateral between clusters."
- **Resolution (per product owner — option a):** Two-step routing via the Brand Store. Sameer's journey rewritten to: he initiates a return-to-Brand-Store transfer out of Cluster B Store paired with a draw-from-Brand-Store transfer into Cluster A Store. Both escalate to the Brand Owner for approval because cross-cluster surplus reallocation touches the Brand Store hop. Master Spec §2.2 flow rules remain unchanged.
- **Rationale (per product owner):** Raw-material flow direction is non-negotiable. Cross-cluster reallocation must always traverse the Brand Store as the central node, both as a system rule and as an audit-friendly accounting boundary.
- **Implication for Phase 2b:** Cross-cluster reallocation is a paired-transfer workflow — the screen inventory needs an "initiate paired Brand-Store-routed transfer" affordance with a single approval bundle. Logged to Phase 2b parking lot.
- **Files touched:** `_planning/03-prd.md` Sameer journey Resolution paragraph and Capabilities revealed line; capabilities matrix Sameer row.

### Q2 confirmation [Pass A §3]
**Epic 7 Tier-1 carve-out scope.**
- Per product owner: Tier-1 priority within Epic 7 is **strictly** Pending GR + provisional costing. Other Epic 7 features (warn-and-log overrides, ingredient substitutions, production output recording with yield variance) remain at Tier 2 depth.
- No PRD edit required — Epic 7 wording in Project Vision (Phase 1 — MVP) already says exactly this.

### F-013 [RESOLVED — Pass A §4]
**POS Staff missing from journeys despite being a daily-user role.**
- POS Staff appeared in RBAC matrix and FRs (FR83–FR86, FR76, FR77) but was absent from the exec summary role list, Success Criteria, and Journeys. Implicitly visible inside Ravi's and Sameer's narratives.
- **Resolution (per product owner — option a):** Full inclusion. Eighth journey added — "Neha — POS Staff at POS-AA" — covering dispatch receipt with digital confirmation, sales auto-import with recipe-driven inventory deduction, expiry-band sell-first prioritisation, end-of-day closing inventory with reason codes, issue tracker creation for transaction queries, next-day product request to Central Kitchen. Exec summary now lists 8 roles. User Success now includes POS Staff with measurable target (dispatch confirmation under 30s; closing inventory before counter-close cut-off). Capabilities matrix has 8 rows. Cross-cutting capabilities list updated to include POS in mobile-first ops bullet.
- **Rationale (per product owner):** Goal is to make the system robust, user-friendly, and useful to all users. POS Staff has a distinct daily workflow (counter operations + closing inventory) that does not collapse into another role.
- **Files touched:** `_planning/03-prd.md` Executive Summary role list, User Success section, Journeys section (new Journey 8), Capabilities matrix (new row), cross-cutting capabilities bullet.

### F-014 [RESOLVED — Pass A §4]
**B2B credit note workflow not journey'd.**
- Critical UC-3 / UC-4 / UC-7 scenarios in B2B Challan Spec described credit notes (partial return, full return, refused-delivery) but no journey showed Meera (Finance Manager) creating one. Risk: Phase 2b screen inventory could underweight the credit note workflow.
- **Resolution (per product owner):** Add a credit-note moment to Meera's journey. Inserted a new paragraph between her existing Rising Action (GST handling) and Climax (financial statement generation). Shows her create CN-2026-CKA-000087 against original DC-2026-CKA-000045 (Sunrise Cafe partial return, one croissant batch damaged). Demonstrates conditional Stage-1-only reversal because original challan had `gst_invoice_raised = false`, stock reinstatement at Central Kitchen A's Dispatch department, and CN appearance on next month's Sales Register export with reference to original DC TRN.
- **Rationale (per product owner):** Should be added.
- **Files touched:** `_planning/03-prd.md` Meera journey Rising Action (new paragraph), Capabilities revealed line (added "B2B credit note creation with conditional two-stage reversal"), capabilities matrix Meera row.

### F-017 [RESOLVED — Pass A §5 — inline fix]
**"All six user journeys" wording stale in Project Scoping & Phased Development.**
- Project Scoping section had: "All six user journeys documented in this PRD are fully supported in MVP" with the original 6-persona roster.
- After F-006 (Sameer added) + F-013 (Neha added), the journey count is 8.
- **Resolution:** Inline mechanical fix — wording updated to "All eight user journeys" with the full 8-persona roster in hierarchy / supply-chain order.
- **Files touched:** `_planning/03-prd.md` Project Scoping & Phased Development → "Core User Journeys Supported" subsection.

### F-016 [RESOLVED — Pass A §4]
**Custom roles + granular per-module permissions for Brand Owner.**
- Product owner asked: "how about we give admin or brand owner option to create custom roles and define user permissions for different modules of the system, in granular yet effective manner."
- **Resolution (per product owner — option b):** Per-user permission override in MVP. Existing 9 fixed roles remain. Brand Owner can grant/revoke specific permissions on top of any user's fixed role on a per-user basis. Full custom-role builder deferred to Phase 2.
- **PRD additions:**
  - **FR15a** — Per-user grant/revoke with timestamp, modifying user, mandatory reason code, optional expiry date. Fixed role definitions themselves are not editable in MVP.
  - **FR15b** — Effective-permission view per user (role-inherited + granted + revoked).
  - **FR15c** — Override changes captured in audit trail (FR20); "expiring soon" widget on Brand Owner audit dashboards.
- **Phase 2 addition:** "Custom role builder with module × action × scope permission grids" added to Phase 2 — Operational Deepening list, framed as an extension of FR15a–FR15c into reusable role templates.
- **Rationale (per Section 5 review):** 9 fixed roles + material enablement give substantial granularity already; remaining real-world need is "let this specific person do X this season" — a per-user override solves it. (b) is a strict subset of (a), so post-launch upgrade is additive, not rework.
- **Files touched:** `_planning/03-prd.md` User Management & Access Control section (FR15a/b/c added), Project Scoping & Phased Development → Phase 2 list (custom-role builder appended).

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
- **P2B-002 [from F-011]** Cross-cluster reallocation needs a "paired Brand-Store-routed transfer" workflow — the screen inventory should include an affordance that lets a Cluster Manager initiate the return-to-Brand-Store and the matching draw-from-Brand-Store as a bundled pair, with a single approval object presented to the Brand Owner. Don't surface them as two unrelated transfers in the approval inbox.
- **P2B-003 [from F-016]** Permission override management UI for Brand Owner: per-user effective-permissions view (role + grants + revokes consolidated), grant/revoke flow with mandatory reason code and optional expiry date, "overrides expiring soon" widget on Brand Owner dashboard, audit trail link from each override to its source change record.

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
