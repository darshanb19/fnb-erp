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

### Pass C — FR walkthrough (in progress)

Pass C reviews PRD §9 (FR1–FR119 + FR15a/b/c) epic-by-epic. The 13 sub-blocks correspond to PRD §9 sub-sections — note the actual FR ranges differ from the user-task-brief approximations. Confirmed ranges:

| Sub-block | PRD §9 sub-section | FR range |
|---|---|---|
| C.1 | Organisational & Master Data Management | FR1–FR9 |
| C.2 | User Management & Access Control | FR10–FR15 + FR15a/b/c |
| C.3 | Shared Infrastructure | FR16–FR24 |
| C.4 | Inventory & Stock Management | FR25–FR39 |
| C.5 | Procurement & Vendor Management | FR40–FR47 |
| C.6 | Recipe Management | FR48–FR56 |
| C.7 | Production Planning | FR57–FR70 |
| C.8 | Dispatch & Distribution | FR71–FR82 |
| C.9 | POS Integration | FR83–FR86 |
| C.10 | Accounting & Financial | FR87–FR99 |
| C.11 | HR & Workforce | FR100–FR103 |
| C.12 | Analytics, Reporting & Dashboards | FR104–FR111 |
| C.13 | Data Quality & Entry Safeguards (cross-cutting) | FR112–FR119 |

The 13th sub-block (Data Quality & Entry Safeguards) does not map to one epic — it is cross-cutting. Flagged as F-051 below.

### Pass C — new flags (analysis complete, awaiting decisions / fixes)

#### F-039 [RESOLVED — Pass C C.1, FR2 vs Master Spec §2.1]
**Decision (per product owner — option a):** Reconcile FR2 to Master Spec §2.1. Department types are Production / Non-Production only. Stores are separate organisational units at Brand- and Cluster-level (not Location-level departments). Dispatch is a Non-Production sub-category identified by department name (alongside Packaging, QC, Housekeeping). FR2 wording rewritten to make this binding explicit; downstream FRs that reference "the Dispatch department" or "the Store" now point to existing §2.1 / §2.3 structures.
**Files touched:** `_planning/03-prd.md` FR2.

---

#### F-039-original [archived for trail]
**FR2 four-type department classification (Production / Non-Production / Store / Dispatch) does not reconcile with Master Spec §2.1.**
- FR2: "type classification (Production, Non-Production, Store, Dispatch)" — four flat types.
- Master Spec §2.1: Stores are separate organisational units at Brand- and Cluster-level (Brand Store, Cluster Store), NOT department types of a Location. Within Locations (Central Kitchen, POS), the diagram lists only two department types: Production and Non-Production. Dispatch appears as a Non-Production Department example, not as a top-level type.
- The mismatch leaves an ambiguity for the data model: are Brand Store and Cluster Store first-class `departments` rows of `type=Store`? Is Dispatch promoted to a top-level type? Or does FR2 collapse §2.1's two-level structure (org units + department types) into one flat enum?
- Phase 3a routing: data-model implication is architecture, but the **conceptual taxonomy** (which is FR-level) needs a product-owner decision before architecture can encode it.
- **Decision needed:**
  - (a) Reconcile FR2 to Master Spec §2.1: only `Production / Non-Production` are department types. Stores remain org units. Dispatch is a Non-Production sub-category. FR2 wording rewritten.
  - (b) Reconcile §2.1 to FR2: promote Store and Dispatch to first-class department types. Update §2.1 diagram. Brand Store / Cluster Store become Locations with one department of type Store.
  - (c) Hybrid: keep Stores as org units, but make Dispatch a first-class type alongside Production/Non-Production for clearer downstream FR semantics (FR74 inventory decrement at Dispatched, FR89 internal-dispatch journal mapping, etc.).

#### F-040 [RESOLVED — Pass C C.1, FR3, inline fix]
**FR3 "yield factors" disambiguated.**
- FR3 is master-data registration; per Master Spec §2.5 yield factors are variable per-receipt. The master-data field is the **default** standard yield factor; the variable yield is recorded at GR per FR27.
- **Resolution applied:** rewrote "yield factors" to "default standard yield factor (variable per-receipt yield is recorded at GR per FR27)".
- **Files touched:** `_planning/03-prd.md` FR3.

#### F-041 [RESOLVED — Pass C C.1, FR6]
**Decision (per product owner — option a):** Vendor scope rule promoted to a domain rule.
- New sub-section "Vendor Scope" added to PRD §6 (between Multi-Location Data Integrity and Operational Continuity) covering: Brand-level vendor (any cluster, any location) / Cluster-level vendor (one cluster) / POS-level vendor (one POS only); enforcement at service layer at PO creation; widening allowed with reason code, narrowing only when no open transactions exist at affected locations; scope changes captured in audit trail.
- New §2.7 "Vendor Scope" added to Master Spec mirroring the rule (one paragraph) with cross-reference back to PRD §6 for full semantics.
- **Files touched:** `_planning/03-prd.md` (new sub-section under §6); `_planning/02-master-spec.md` (new §2.7).

---

#### F-041-original [archived for trail]
**Vendor type "Brand / Cluster / POS level" — operational scope rule not documented as a domain rule anywhere outside FR6.**
- FR6 introduces vendor type as a master-data field but doesn't bind the operational meaning ("Brand vendor supplies all clusters; Cluster vendor scoped to one cluster; POS vendor scoped to one POS").
- Master Spec §2 (domain rules) and PRD §6 (Domain-Specific Requirements) are silent on vendor scope semantics.
- **Decision needed:** confirm the intended operational meaning, then either (a) add a one-line domain rule to PRD §6 / Master Spec §2, or (b) leave it as a master-data field with no semantic enforcement (vendors of any type usable from anywhere — type is a labelling convenience).

#### F-042 [RESOLVED — Pass C C.3, FR20 + FR15c, inline fix]
**FR20 + FR15c "tamper-evident" → "append-only" — aligned to Pass B F-029.**
- F-029 settled audit-trail strength as append-only at DB level (UPDATE/DELETE blocked); cryptographic hash-chain hardening is post-MVP.
- **Resolution applied:** FR20 rewritten to "append-only audit trail … UPDATE and DELETE on audit-log rows are blocked at the database level (cross-references §6.5). Cryptographic hash-chain hardening for full tamper-evidence is post-MVP." FR15c parenthetical reference updated to "append-only audit trail (FR20)".
- **Files touched:** `_planning/03-prd.md` FR15c, FR20.

#### F-043 [RESOLVED — Pass C C.3, FR24, inline fix]
**FR24 "compliance-ready" disambiguated to operational/management audit scope.**
- After F-029 the audit-trail strength is append-only (operational, not cryptographic). "Compliance-ready" without qualification risks overpromising statutory compliance, which Master Spec §6.4 places out-of-MVP (statutory reports live in external accounting software).
- **Resolution applied:** FR24 rewritten to "Users can export audit-trail data in formats suitable for internal audit and management review (CSV, Excel, PDF). Statutory and regulatory compliance reporting (e.g. GST audit, ICAI standards) lives in the external accounting software per Master Spec §6.4 — the ERP supplies the operational audit trail; the accounting software produces statutory reports."
- **Files touched:** `_planning/03-prd.md` FR24.

#### F-044 [RESOLVED — Pass C C.4, Master Spec §8.1, inline fix]
**`inventoryService.deductStock()` FEFO ordering semantics now explicit.**
- FR31 mandates FEFO at the system level; §8.1 contract was silent on which side (caller or service) applies the ordering.
- **Resolution applied:** appended an `Ordering` line to the §8.1 deductStock contract: "Applies FEFO (First Expiry, First Out) batch selection per PRD FR31 — caller does not pick batches; service selects earliest-expiry batches first within the named department."
- **Files touched:** `_planning/02-master-spec.md` §8.1 inventoryService.deductStock contract.

#### F-045 [RESOLVED — Pass C C.4, FR38, inline fix]
**FR38 shelf-life-exception approval explicitly routed through the Unified Approval Engine.**
- F-019 carry-forward closes here. Per Master Spec §7.3, every approval workflow must route through the Approval Engine (Epic 3); FR38 had not made this explicit.
- **Resolution applied:** appended to FR38 — "Exception approvals (when a flagged GR is to be accepted anyway) route through the Unified Approval Engine (FR16) — no per-module approval logic."
- **Files touched:** `_planning/03-prd.md` FR38.

#### F-046 [RESOLVED — Pass C C.6, FR50, inline fix]
**FR50 recipe-default-version approval explicitly routed through the Unified Approval Engine.**
- Same Approval-Engine-binding pattern as F-045.
- **Resolution applied:** rewrote FR50 to "Users can designate a recipe version as the new default. The approval workflow routes through the Unified Approval Engine (FR16); the previous default version remains active until the new version is approved."
- **Files touched:** `_planning/03-prd.md` FR50.

#### F-047 [RESOLVED — Pass C C.7, FR61, inline fix]
**FR61 substitution wording aligned to Pass B F-021 resolution.**
- F-021 resolved §6.2 substitution as warn-and-log with mandatory reason code, enablement check on substitute, full audit trail, dashboard visibility. FR61 was missing the enablement check and dashboard visibility.
- **Resolution applied:** rewrote FR61 to make explicit: warn-and-log model with no Approval-Engine routing; mandatory reason code; enablement check on the substitute material against the consuming department per §2.4; full audit trail capture; affects batch cost only (master recipe unchanged); surfaced on the Brand Owner override-frequency dashboard (FR70) alongside other warn-and-log overrides.
- **Files touched:** `_planning/03-prd.md` FR61.

#### F-048 [RESOLVED — Pass C C.8, FR78, inline fix]
**FR78 actor expanded to "Finance Managers and Brand Owners" matching B2B Challan Spec §11 and PRD §7.2 RBAC.**
- F-027 carry-forward closes via FR78 + FR97.
- **Resolution applied:** rewrote FR78 to "Finance Managers and Brand Owners can fill GST placeholder fields on B2B challans and set `gst_invoice_raised` with IRN atomically (per B2B Challan Spec §11 and the §7.2 RBAC matrix). No other role can perform this action without an FR15a per-user override." Also updated FR119 to reference "Finance Manager or Brand Owner" for consistency.
- **Files touched:** `_planning/03-prd.md` FR78, FR119.

#### F-049 [RESOLVED — Pass C C.10, FR97, inline fix]
**FR97 role bindings made explicit by field family with cross-references.**
- F-027 carry-forward closure for the TDS/GST/IRN/e-way bill compliance placeholders.
- **Resolution applied:** rewrote FR97 to enumerate the four field families (TDS / GST / e-invoicing / e-way bill) with field-name lists, and bind them to roles: Finance Manager edits TDS; Finance Manager and Brand Owner edit GST, IRN, and e-way bill. Cross-references PRD §7.2 RBAC, B2B Challan Spec §11, Master Spec §6.5.
- **Files touched:** `_planning/03-prd.md` FR97.

#### F-050 [RESOLVED — Pass C C.10/C.12, FR95 + FR108]
**Decision (per product owner — option b, with elaboration):** Keep FR95 + FR108 with explicit scope split. Product owner emphasised: reports and analytics are of utmost importance, must cover overview to granularity in a user-friendly less-complex manner, with easy-to-understand and actionable insights / suggestions, without compromising the quality of reports and analysis.
- **FR95 — Food Cost Control Centre (Financial framing).** Rewrote to specify: theoretical vs actual food cost per item with variance % and trend; vendor price tracking with alerts (>10% above 30-day average), price drops, per-item lowest-vendor identification across the brand; margin analysis per item (cost as % of selling price, contribution margin per unit and per period, contribution-margin trend); wastage cost as % of total food cost broken down by reason / item / location; period comparisons (M-o-M, Q-o-Q, Y-o-Y, custom; side-by-side across periods or locations); drill-through to source transactions (recipe → ingredient → vendor → PO → GR) and back, never more than two clicks from any aggregate to any source row; cross-reference to FR108.
- **FR108 — Food Cost Control Centre (Operational analytics framing).** Rewrote to specify: menu engineering matrix using Stars / Puzzles / Plowhorses / Dogs taxonomy with per-quadrant action labels; real-time cost-per-serving tracking with brand-configurable threshold alert (default: actual cost > 35% of selling price); product mix analysis (revenue %, margin %, volume % per item with Pareto view); time-series trend lines for cost-per-serving and contribution margin with anomaly highlighting; **actionable suggestions** surfaced at top of view (items eligible for promotion, candidates for re-engineering, candidates for retirement, items where vendor switching would improve margin, recipes where yield variance is degrading actual margin); drill-down from any item to recipe, ingredient cost composition, vendor history, sales transactions, and production batches; cross-reference to FR95.
- **Light enhancements applied to neighboring analytics FRs (per product-owner emphasis on comprehensive reports and actionable insights):**
  - **FR105 (Brand Owner cross-location dashboard)** — added Pending GR resolution outcomes (per FR70 update), expiring permission overrides (FR15c), unresolved cross-module data quality alerts (FR116), key operational risks; tile drill-down within two clicks; persisted last-used scope filter per user.
  - **FR106 (standard operational reports)** — enumerated all functional areas explicitly with reasonable per-report coverage (Purchase Register and PO Status, Inventory Movement and Stock Valuation, Food Cost, Production Plan vs Output and Yield Variance, Wastage by Reason Code and by Item, Daily Closing Inventory and Variance, Dispatch Volume and B2B Sales Register, POS Sales by Item, by Location, and by Day-Part, Accounting per FR91, HR Roster and Attendance); standardised filter dimensions (period, location, cluster, item, vendor, customer, category); drill-down per FR109; performance bar (under 3s on seed dataset at brand-wide scope); export per FR107.
  - **FR110 (rule-based unusual activity detection)** — expanded triggers: wastage spikes (>30% above 30-day average per item per location), vendor price jumps (>10% above last 3-purchase average), production yield variance (>15% below standard for two consecutive batches), closing inventory variance patterns (>3 consecutive days), override frequency anomalies, unresolved provisional-cost aging, sales mix shocks (>50% volume change vs 7-day baseline), Pending-GR-then-rejected event spikes per location or vendor; each alert links to underlying data with suggested remediation; brand-configurable thresholds.
- **Implications for Phase 2b screen inventory:** the FCCC is now two complementary surfaces (financial and analytics) with shared underlying data — Phase 2b should design a tabbed FCCC or two distinct routes that cross-link (FR95 ↔ FR108) without duplicating drill-down state.
- **Files touched:** `_planning/03-prd.md` FR95, FR105, FR106, FR108, FR110.

#### F-051 [RESOLVED — Pass C C.13, default option a]
**Decision (auto-mode default per Pass C brief):** §9.13 kept as a cross-cutting section. Header rewritten with caveat that these FRs are implemented across multiple epics per Master Spec §5 epic implementation order. Each of FR112–FR119 annotated inline with its primary epic(s):
- FR112 → Epic 4 (Inventory) + Epic 7 (Production)
- FR113 → Epic 3 (Shared Infrastructure framework) + per-form usage in Epics 4–10
- FR114 → Epic 4 (Inventory) + Epic 7 (Production); uses Epic 3 warn-and-log
- FR115 → Epic 4 (Inventory) + Epic 8 (Dispatch); uses Epic 3 warn-and-log
- FR116 → Epic 1 (Master Data) for detection rules; surfaces in Epic 12 (Analytics) dashboards
- FR117 → Epic 3 (Shared Infrastructure)
- FR118 → Epic 8 (Dispatch) + Epic 10 (Accounting)
- FR119 → Epic 8 (Dispatch) + Epic 10 (Accounting)
- **Files touched:** `_planning/03-prd.md` §9.13 header + per-FR annotations.

---

#### F-051-original [archived for trail]
**§9.13 Data Quality & Entry Safeguards (FR112–FR119) is cross-cutting — does not map to one epic per Master Spec §5.**
- The 12 epics in Master Spec §5 do not include a "Data Quality" epic. FR112 (voice input) belongs in Inventory + Production; FR113 (form pre-fill) is universal; FR114 (implausible quantity) is per-form; FR115 (duplicate detection) is per-module; FR116 (cross-module inconsistency) crosses Inventory / Recipe / Procurement / Master Data; FR117 (reverse pre-confirmed) is Shared Infrastructure; FR118 (GST tax field validation) is Dispatch / Accounting; FR119 (Unregistered/Consumer GST warning) is Dispatch / Accounting.
- **Decision needed:**
  - (a) Keep §9.13 as a cross-cutting section. Add a one-line caveat at section header: "These FRs are cross-cutting safeguards implemented across multiple epics. See Master Spec §5 for epic implementation order; the relevant epic for each FR is annotated inline." Annotate per-FR.
  - (b) Reassign each FR to its primary epic sub-section (e.g. FR112 → Inventory + Production; FR118 → Accounting). Eliminate §9.13.
  - (c) Absorb FR113–FR117 into Shared Infrastructure (Epic 3); leave FR112, FR118, FR119 in their primary epics.
- Recommendation (auto-mode default if no answer): (a) — least churn, preserves the cross-cutting story.

### Pass C — carry-forward updates

#### F-001 [RESOLVED — Pass C C.10, FR88 + FR89, label-only fix]
**Decision (per product owner — option a):** Rename `Revenue — Internal Dispatch` → `Revenue — POS Sales`.
- Internal Dispatch is a stock movement only (no revenue, no journal — FR89 confirms `Internal Dispatch confirmed (inventory movement only, no journal)`). The revenue event is the POS sales import (FR84). The account credited on POS sales import was misnamed as "Revenue — Internal Dispatch" when it actually holds POS-sales revenue.
- **Resolution applied:** FR88 CoA seed updated to list `Revenue — POS Sales, Revenue — B2B Sales` (mirrors the B2B naming for symmetry). FR89 mapping rule updated to `Sales import confirmed (DR Cash/Bank, CR Revenue — POS Sales)`. Pure label change — no journal-flow semantics altered.
- **Files touched:** `_planning/03-prd.md` FR88, FR89.

#### F-002 [RESOLVED — Pass C C.7, FR68 — confirmed canonical]
**Production Order canonical 5-status lifecycle — confirmed canonical at FR68 and logged to decision-log.md (DL-001).**
- FR68 names the full lifecycle inline: Draft → Pending GR (no deduction) → Confirmed (no deduction yet) → In Progress (deduction fires) → Completed.
- Cross-checks pass: §6.3 retrospective adjustment block is consistent with deduction at In Progress; FR89 journal mapping rule fires at the same transition; FR67 retrospective adjustment fires after In Progress with provisional → actual cost replacement; FR67a closure path fires on linked GR rejection (new in this pass).
- **Action taken:** created `decision-log.md` (inaugural file per CLAUDE.md note "decision-log.md created when first decision is made"). Inaugural entry is DL-001 documenting this lifecycle.
- **Files touched:** `decision-log.md` (new file with DL-001).

#### F-005 [RESOLVED — Pass C end-of-pass consolidation, Master Spec §4 inline fix]
**Master Spec §4 Epic 7 row gained explicit Tier-1 carve-out for Pending GR + provisional costing.**
- Pass A Q2 confirmation already established the carve-out (Tier-1 priority within Epic 7 is strictly Pending GR + provisional costing; other features remain Tier 2). The §4 module-tier table did not surface this; risk of misaligned scoping during Phase 3b sprint planning.
- **Resolution applied:** Epic 7 row in §4 now reads `Tier 2 — Lean (with Tier 1 carve-out)` with the carve-out described inline: "Pending GR linkage and provisional costing (PRD FR64–FR67, FR67a) are built at Tier 1 depth — operational reality requires it (kitchens cannot wait for formal GR before starting production). All other Epic 7 features remain at Tier 2."
- Epic 10 row left unchanged: it cross-references §6 which provides full revised specification, so no dual-tier label is needed.
- **Files touched:** `_planning/02-master-spec.md` §4 Epic 7 row.

#### F-020 [RESOLVED → Pass C C.4, FR31]
**FEFO enforcement explicitly mandated at FR31.** "The system can enforce FEFO (First Expiry, First Out) prioritisation in material selection for production." Master Spec §8.1 deductStock contract still silent — addressed via F-044 inline fix.

#### F-025 [RESOLVED — Pass C C.5 + C.7]
**Pending GR rejected at QC scenario — full operational design landed via four new/amended FRs.**
- **Decision (per product owner — proceed as recommended):**
  1. **Provisional cost on the PO when GR rejected:** lock the PO at provisional figures (LKP × consumed quantity, standard yield factor) with a permanent `GR-Rejected` flag. No FR67 retrospective adjustment fires — there are no actuals to adopt.
  2. **Consumed-but-rejected portion:** reclassified from `COGS — Raw Material Consumption` to `Wastage and Write-offs` via a compensating reclassification journal at GR-rejection time, tagged with the PO TRN and GR-Reject TRN. Production output sellability is a separate concern, not addressed by this FR.
  3. **Vendor Credit Note coverage:** covers the **full delivered quantity** — both unconsumed (physically returned) and consumed-but-defective (non-physical refund claim against the vendor for defective delivery). Reduces Accounts Payable by the full delivered value.
  4. **Override-frequency dashboard distinction:** yes — Pending-GR-then-rejected events surface separately from Pending-GR-then-confirmed events. The rejected path is operationally higher-risk and operators should see it in isolation.
- **Resolution applied:**
  - **FR42 amendment:** PO lifecycle gains a `Closed — GR Rejected` terminal state with cross-reference to FR47a/FR47b.
  - **FR47a (new):** Store Manager rejects a GR at formal QC. Pending GR sub-status cleared, PO moves to `Closed — GR Rejected`, vendor CN auto-drafted per FR47b, linked PO follows FR67a closure path, mandatory reason code captured in audit trail.
  - **FR47b (new):** Vendor Credit Note from a rejected GR. TRN format `VCN-YYYY-LOC-SEQ`, references original GR TRN and source PO TRN, reduces Accounts Payable by full delivered value (consumed + unconsumed). FR80 cumulative-CN-not-exceeding-source-value validation applies analogously.
  - **FR67a (new):** Production order closure path when linked GR rejected. PO locks at provisional, gets permanent `GR-Rejected` flag, consumed-portion value reclassified to Wastage via compensating journal, Brand Owner notified, event surfaces on FR70 dashboard. Precise journal lines deferred to architecture phase per FR89 mapping rule additions.
  - **FR70 amendment:** Override-frequency dashboard now also surfaces Pending GR resolution outcomes (confirmed vs rejected events as distinct breakdowns).
- **Implications for Phase 2b:** dashboard widget design must allow drilling down from the Pending-GR-resolution-outcomes pane into the underlying rejected GR + linked PO + reclassification journal — useful audit thread when investigating vendor quality issues.
- **Implications for Phase 3a:** journal-line specifics for the FR67a reclassification entry and the FR47b vendor CN entry need precise mapping rules added to FR89's mapping rule set during the architecture phase. Logged to Phase 3a deferred-technicals if needed.
- **Files touched:** `_planning/03-prd.md` FR42 (amendment), FR47a (new), FR47b (new), FR67a (new), FR70 (amendment).

#### F-027 [RESOLVED — Pass C C.8, C.10; final Pass D verification]
- F-048 closes the FR78 leg (Finance Manager + Brand Owner named explicitly).
- F-049 closes the FR97 leg (cross-reference to §7.2 + Master Spec §6.5).
- B2B Challan Spec §11 + PRD §7.2 RBAC matrix verified consistent for IRN / GST / TDS bindings (re-verified in Pass D D.7 — Finance Manager + Brand Owner consistent across FR78, FR97, FR119, B2B Challan Spec §11, and PRD §7.2 RBAC matrix).

---

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

### F-021 [RESOLVED — Pass B §6.2]
**Ingredient substitution at production-order level — control surface underspecified.**
- PRD §6.2 said "A Kitchen Manager may substitute one ingredient for another" without naming the approval path, the enablement check on the substitute, or the reason-code requirement.
- Substitution carries real cost impact (visible on Food Cost Control Centre) and is operationally analogous to the FR67 Pending GR override.
- **Resolution (per product owner — option a, warn-and-log):** Kitchen Manager substitutes autonomously. No Approval Engine routing. Mandatory reason code at substitution time. Enablement check on the substitute material against the consuming department per §2.4. Full audit trail. Surfaced on the Brand Owner override-frequency dashboard so accumulating substitution patterns become operationally visible.
- **Rationale (per product owner):** Kitchens must keep moving. The whole Pending-GR + warn-and-log architecture is built on the principle that operational continuity beats blocking approval gates; substitution shares the same shape (raw material short, batch in progress, manager picks a substitute and keeps going). Brand Owner gets visibility via dashboard, not via a gate. Approval-gated substitution would push staff back to undocumented workarounds — exactly what the ERP is replacing.
- **Implications:**
  - §6.2 PRD line rewritten to make warn-and-log + enablement + reason code + dashboard visibility explicit.
  - Cross-cuts FR67 (Pending GR override) — both share the override-frequency dashboard widget. Phase 2b screen inventory should treat them as one widget showing override-pattern aggregates, not two separate widgets.
  - Pass C §15 (Production FRs) check item: confirm the FR backing substitution names the warn-and-log model, names the reason-code requirement, and names the enablement-on-substitute requirement explicitly. If not, surface as a Pass C flag.
- **Files touched:** `_planning/03-prd.md` §6.2 — Ingredient substitution bullet rewritten.

### F-037 [RESOLVED — Pass B §8.3, inline fix]
**"Stock level updates use database-level locking" in §8.3 prescribed mechanism, inconsistent with softened §6.8 wording (F-032).**
- §8.3 Data Management section had "database-level locking" as a concrete mechanism, while §6.8 risk-mitigation row 4 had already been softened to capability-level in F-032.
- **Resolution:** Applied same capability-level wording to §8.3 — "concurrency-safe with database-level guarantees (mechanism TBD in architecture phase; consistent with §6.8 domain risk mitigation)."
- **Files touched:** `_planning/03-prd.md` §8.3.

### F-035 [RESOLVED — Pass B §7.3]
**Notification channel depth deferred to architecture but not on the §11 OQ list.**
- §7.3 said "SMS/WhatsApp/Push channel-ready but implementation depth TBD in architecture" — an unbounded deferral not captured in Master Spec §11 open questions.
- **Resolution (per product owner — option b):** MVP delivers in-app notifications (primary) + email (secondary). The NotificationCenter abstraction (Epic 3) is built channel-agnostic so SMS/WhatsApp/Push can be enabled post-MVP without code changes to the abstraction. No SMS/WhatsApp/Push implementation in MVP.
- **Rationale:** In-app + email cover "must reach you" cases for desktop and async workflows. Brainstorming §3.1 mobile-first approval uses in-app push; building the abstraction now and lighting up additional channels post-MVP follows the same "build the structure, ship what's needed, extend later" pattern as the compliance-fields placeholder strategy. This removes a hidden unbounded deferral from §7.3 without adding it to the OQ list.
- **Files touched:** `_planning/03-prd.md` §7.3 Integration Architecture table — Notification Channels row.

### F-034 [RESOLVED — Pass B §7.2, inline fix]
**§7.2 didn't reference per-user permission overrides (FR15a–c from Pass A F-016).**
- RBAC matrix section only described fixed-role permissions and material enablement, leaving a reader unaware that Brand-Owner per-user overrides are part of the security model.
- **Resolution:** Added a "Per-user permission overrides" paragraph below the material-enablement paragraph in §7.2, referencing FR15a (grant/revoke), FR15c (audit trail), and forward-linking to the User Management & Access Control section.
- No new requirement; clarity-only addition surfaced during §7.2 cross-check.
- **Files touched:** `_planning/03-prd.md` §7.2.

### F-033 [RESOLVED — Pass B §7.2]
**RBAC matrix vs Master Spec §12 seed data — naming and coverage misalignment.**
- Master Spec §12 used "POS Managers (4)" while PRD §7.2 and Pass A Journey 8 (Neha) both used "POS Staff." Store Manager and Dispatch Staff had full Pass A journeys (Vikram, Ravi) but no seed user counts in §12.
- **Resolution (per product owner — option a, align Master Spec §12 to PRD §7.2):**
  - Renamed "POS Managers (4)" → "POS Staff (4)" in Master Spec §12 seed data.
  - Added seed counts for Store Manager (2 — one per cluster store) and Dispatch Staff (2 — one per central kitchen).
  - Superadmin remains unseeded (multi-tenant future-proofing role only).
- **Rationale:** Pass A already canonicalised "POS Staff" across exec summary, success criteria, capabilities matrix, journeys, and RBAC matrix. Reverting would be expensive churn. Store Manager and Dispatch Staff seed users are required to test journeys Vikram and Ravi, which Pass A added explicitly; a test fixture that can't cover all eight journeys is incomplete.
- **Files touched:** `_planning/02-master-spec.md` §12 seed data Users row.

### F-031 [RESOLVED — Pass B §6.8, inline fix]
**"Hookify rule" named a specific tool inside the §6.8 risks-mitigations table.**
- §6.8 row 2 mitigation read: "Hookify rule to detect missing checks."
- Hookify is the team's chosen tool per brainstorming §10.6 + §12, so the binding wasn't wrong — but PRD-discipline favours capability-level wording so the requirement survives a future tooling switch (ESLint custom rules, pre-commit hooks, etc.).
- **Resolution:** Softened to "automated CI/lint rule to detect missing checks at code-review time (mechanism — Hookify or equivalent — TBD in architecture phase)."
- **Files touched:** `_planning/03-prd.md` §6.8 row 2.

### F-032 [RESOLVED — Pass B §6.8, inline fix]
**"Database-level locking; optimistic concurrency with version checks" prescribed implementation mechanisms in the §6.8 risks table.**
- Architecture phase should select the concurrency mechanism. PRD should describe the requirement, not pick the implementation.
- **Resolution:** Softened to "Concurrency-safe stock updates with database-level guarantees (mechanism — row-level locking, optimistic concurrency with version checks, or layered — TBD in architecture phase)."
- **Files touched:** `_planning/03-prd.md` §6.8 row 4.

### F-029 [RESOLVED — Pass B §6.5]
**"Tamper-evident audit trail" — strength level was ambiguous between strong (cryptographic) and weak (append-only).**
- §6.5 said "Financial transaction audit logs must be tamper-evident." §8.2 separately specified "append-only" with DB-level UPDATE/DELETE blocks. Two different strength levels.
- **Resolution (per product owner — option c):** MVP delivers append-only at DB level (the §8.2 spec); cryptographic hash-chain hardening for full tamper-evidence is post-MVP. Single, honest commitment that matches the actual implementation.
- **Rationale:** Master Spec §6.1 places statutory audit trail with external accounting software, not the ERP — the operational/management use cases are well-served by append-only. Promising "tamper-evident" in MVP without delivering hash-chain semantics would be a credibility issue under formal scrutiny. Option (c) keeps the upgrade option open without overcommitting.
- **PRD edit:** §6.5 audit-trail bullet rewritten — "Append-only audit trail" header, UPDATE/DELETE blocked at DB level (cross-references §8.2), hash-chain hardening explicitly post-MVP.
- **Files touched:** `_planning/03-prd.md` §6.5.

### F-030 [RESOLVED — Pass B §6.5, inline fix]
**"ERP is the system of operational record. External accounting software is the system of financial record." undersold the ERP's management financial reporting role.**
- Original §6.5 wording implied the ERP has no financial-record role at all, which contradicts Master Spec §6.3 (and the PRD's own FR set rendering Trial Balance, P&L, Balance Sheet, Cash Flow from internal journal).
- **Resolution:** Wording refined to mirror Master Spec §6.1 — ERP is the system of operational record AND management financial reporting; external accounting software remains the system of statutory financial record (statutory audit, tax filings, regulatory disclosures).
- No new requirement; clarity-only fix surfaced as part of F-029 walkthrough.
- **Files touched:** `_planning/03-prd.md` §6.5.

### F-027 [LOG-ONLY → Pass C check, Pass B §6.4]
**"Users with appropriate roles can manually fill these in MVP" — roles unnamed in §6.4.**
- §6.4 line: "Users with appropriate roles can manually fill these in MVP."
- B2B Challan Spec §7 + §11 already name Finance Manager + Brand Owner specifically for `gst_invoice_raised`, IRN paste, GST field edits.
- Master Spec §6.5 says "Editable by Finance role" for TDS fields.
- §6.4 is the requirements view, not the role-by-action mapping; the role binding sits in PRD §7.2 RBAC matrix + the Approval Engine config.
- Not a flag for product owner. Pass C check item: when relevant FRs are reached (GST handling, IRN paste, TDS entry), confirm role names line up across PRD §6.4 ↔ PRD §7.2 ↔ B2B Challan Spec ↔ Master Spec §6.5.

### F-022 [RESOLVED — Pass B §6.3]
**"Recipe cost cascade triggered for all affected recipes" on retrospective GR confirmation conflated two distinct cascades.**
- The §6.3 retrospective-adjustment block listed cascade firing as one bullet in a flat list, ambiguous between (a) master-recipe standard-cost cascade brand-wide and (b) per-batch retrospective adjustment scoped to one production order.
- **Resolution (per product owner — α confirmed):** Both cascades fire on every GR confirmation, at different scopes. (a) fires automatically because LKP just updated, recalculates every dependent master recipe's standard cost. (b) fires only on the production order linked to the confirming Pending GR, replaces provisional with actuals on that single batch. They share the trigger but not the scope.
- **PRD edit:** Retrospective-adjustment block split into two clearly named sub-blocks `(a)` and `(b)`, each with its own bullet list. Made explicit that master yield in (a) is not touched by per-GR actuals.
- **Files touched:** `_planning/03-prd.md` §6.3.

### F-023 [RESOLVED — Pass B §6.3]
**Variance journal vs already-booked downstream COGS on dispatched/sold final products produced from the affected PO.**
- Realistic case: PO completed → final products dispatched (DC TRN) → POS sales import (SA TRN) with COGS journal entries booked at provisional cost. Then the linked GR confirms and the variance journal fires.
- PRD §6.3 was silent on whether the downstream booked COGS gets retro-corrected per-transaction. §6.5 transaction immutability binds.
- **Resolution (per product owner — β confirmed):** Variance journal is a **standalone compensating entry**, balanced (debits = credits), tagged to PO TRN + GR TRN. It nets brand-level COGS to the correct figure at period-end reconciliation. Already-booked DC and SA COGS entries are **not** retro-corrected per-transaction — they remain immutable per §6.5. Per-DC and per-SA COGS may be under- or over-stated by their share of the variance until period-end.
- **Rationale:** Preserves §6.5 immutability; keeps export-first integration with external accounting clean (no rolling per-transaction corrections); avoids reconciliation churn whenever a Pending GR resolution lags.
- **PRD edit:** Added a bullet to the §6.3 (b) sub-block making the immutability + period-end reconciliation rule explicit.
- **Files touched:** `_planning/03-prd.md` §6.3.

### F-025 [CARRY-FORWARD → Pass C §14/§15]
**Pending GR linked production-order behaviour when the GR is rejected at quality check.**
- Realistic edge case: Kitchen Manager starts production against a Pending GR using LKP/standard-yield → formal GR step fails QC (wrong specs, expired, contaminated) → rejected at receipt.
- Open questions (not for product owner now — surface during Pass C):
  - What replaces the provisional figures on the PO if there are no actuals to adopt?
  - Does the consumed-but-rejected portion get classified as wastage (WO TRN) or stay tagged to the PO with a flagged anomaly?
  - Vendor return for the unused portion — Credit Note covers what?
  - Does the override-frequency dashboard distinguish Pending-GR-then-rejected events from Pending-GR-then-confirmed events?
- **Action when reached:** Pass C §14 (Procurement) and §15 (Production) — confirm at least one FR addresses the GR-rejected-after-Pending-GR-link scenario explicitly. If absent, escalate as a Pass C ambiguity flag for product-owner decision.

### F-021 [RESOLVED — Pass B §6.2]

### F-018 [RESOLVED — Pass B §6.1]
**Cross-location expiry visibility scope vs raw-material flow rule.**
- PRD §6.1 said "surface transfer opportunities to other locations where the stock can be consumed" without scoping the destination set. Master Spec §2.2 forbids direct lateral raw-material moves between clusters. F-011 (Pass A) had already fixed the cross-cluster pattern as a paired Brand-Store-routed transfer.
- Risk if unresolved: Phase 2b screen inventory could put a "Transfer to Cluster B" affordance on the expiry dashboard that fires an illegal direct lateral.
- **Resolution (per product owner — option b):** Within-cluster destinations evaluated first. If no within-cluster consumer is viable for raw materials, the system may suggest a **paired Brand-Store-routed transfer** (return-to-Brand-Store + draw-to-other-Cluster) surfaced as a **single bundled suggestion** that requires Brand Owner approval. Never a direct cross-cluster lateral. Implementation must keep the paired structure visible in the UI (not hidden as an internal detail) so the §2.2 rule and the audit boundary stay legible.
- **Rationale:** Preserves §2.2 invariant explicitly at the suggestion level so Phase 2b builds the right affordance; keeps the Brand Store audit boundary visible; consistent with F-011 pattern; retains the operational value of cross-cluster surplus redistribution that the feature was originally added for.
- **Implication for Phase 2b:** Expiry dashboard must distinguish single-hop within-cluster transfer suggestions from paired Brand-Store-routed cross-cluster suggestions, and bundle the latter into a single approval object (same shape as P2B-002 from F-011).
- **Files touched:** `_planning/03-prd.md` §6.1 — Cross-location expiry visibility bullet rewritten.

### F-019 [RESOLVED-by-rule — Pass B §6.1, log only]
**Shelf-life acceptance "exception approval" path implicitly binds to Unified Approval Engine.**
- PRD §6.1 line: "the system must flag this for rejection or exception approval" — does not name the approval routing mechanism.
- Master Spec §7.3 binds: every approval workflow must route through the Unified Approval Engine (Epic 3); never per-module.
- Therefore: shelf-life exception approval is an instance of the Approval Engine pattern, not a bespoke flow. No PRD edit needed.
- **Action when reached:** During Pass C §13 (Inventory) or §14 (Procurement), confirm the relevant FR ties shelf-life-exception approval to the Approval Engine explicitly so Phase 3b doesn't accidentally build per-module approval logic for it.

### F-020 [CARRY-FORWARD → Pass C, log only]
**FEFO enforcement is stated at domain-rule level — confirm an FR backs it.**
- PRD §6.1 says FEFO selection is a system requirement (food safety, not preference). Master Spec §8.1 `inventoryService.deductStock` interface contract does not mention FEFO ordering.
- Action when reached: Pass C §13 (Inventory FRs) or §15 (Production FRs) — verify there is an explicit FR mandating FEFO ordering inside the production-order material picking flow (or at the service-layer level), and that the `deductStock` contract is updated if needed.
- Not a Pass B flag — just a checkpoint to remember.

---

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
- **P2B-005 [from §6.8 review + F-021]** Override-frequency widget on the Brand Owner dashboard must be a single aggregating widget covering all warn-and-log override types (at minimum: FR67 Pending GR overrides, F-021 ingredient substitutions; designed to absorb future warn-and-log overrides). Per-type filters/breakdowns inside the widget. Do NOT design separate per-feature widgets — the operational signal is "override pattern across the kitchen" not "Pending GR overrides specifically." Phase 2b should also confirm the widget surfaces both count and rate (e.g., overrides per 100 production orders) so spikes are visible at scales of 5 vs 50 daily orders.
- **P2B-004 [from F-018]** Expiry dashboard suggestion affordance must distinguish (a) single-hop within-cluster transfer suggestions from (b) paired Brand-Store-routed cross-cluster suggestions. The paired (b) variant must surface as a single bundled approval object to the Brand Owner, not as two unrelated transfers — same UX shape as P2B-002 from F-011. The paired structure should be visible to the user, not hidden as an implementation detail, so the §2.2 raw-material flow rule and the Brand Store audit boundary stay legible.

---

## Phase 3a — Technical decisions deferred

(Technical / architectural questions raised during PRD review that the product owner is not the right person to answer. To be proposed by the architect during Phase 3a and reviewed by the product owner. Each entry should state the question, the surrounding PRD context, and any constraints already implied by master-spec or PRD that narrow the answer space.)

- **F-028 [from Pass B §6.4]** Intra-state vs inter-state GST validation enforcement layer — service-layer (Express.js) only, Drizzle/DB CHECK constraint, or layered. PRD §6.4 binds the *rule* ("validation must prevent incorrect combinations") but not the *enforcement layer*. Constraints already implied: Master Spec §3.2 RLS = defence-in-depth, business logic = primary enforcement; §7.2 every query routes through Drizzle. Architect to propose, product owner to confirm.
- **F-038 [from Pass B §8.4]** 5-minute rollback target vs Drizzle migration rollback semantics. PRD §8.4 commits to "roll back to previous deployment within 5 minutes." Code rollback (Vercel instant, Railway/Render near-instant) is trivial. Rolling back a schema migration that ran mid-deployment (new column, renamed constraint) requires either (a) forward-only migration discipline (no destructive DDL in any single migration, so code rollback is always safe) or (b) a schema-rollback runbook. Architecture phase must define the strategy and encode it in migration conventions. PRD target stands; mechanism is architecture.
- **F-052 [from Pass C C.5/C.7, F-025 resolution]** Precise journal-line mapping for two new transitions introduced by FR47a/FR47b/FR67a (GR-rejected scenario). Need to extend FR89's mapping rule set with: (1) GR rejected → vendor Credit Note drafted (`VCN-YYYY-LOC-SEQ`) — reduce Accounts Payable by full delivered value; the contra side depends on whether/how Pending GR previously incremented a provisional inventory or AP-pending account. (2) Production order GR-Rejected closure → reclassification journal (DR Wastage and Write-offs, CR COGS — Raw Material Consumption — at provisional value of consumed portion, tagged with PO TRN and GR-Reject TRN). The Pending-GR-side journal flow itself (whether Pending GR provisionally increments Inventory or only operational stock) is currently underspecified across PRD §6.3 and Master Spec §6.3 — architect must pin down the provisional-inventory model before the new mapping rules can be finalised.

---

## Pass C close — handoff to Pass D

Pass C complete. All FRs from §9 (FR1–FR119 + FR15a/b/c) walked epic-by-epic against Master Spec §2–§8 + B2B Challan Spec + Pass A/B resolutions.

**Resolved this pass (14):** F-001, F-002, F-005, F-020, F-025, F-027, F-039, F-040, F-041, F-042, F-043, F-044, F-045, F-046, F-047, F-048, F-049, F-050, F-051. (F-027 partially closed via F-048/F-049.)

**New FRs added:** FR47a (GR rejection at QC), FR47b (vendor CN from rejected GR), FR67a (production-order GR-Rejected closure path).

**FRs amended:** FR2, FR3, FR15c, FR20, FR24, FR38, FR42, FR50, FR61, FR70, FR78, FR88, FR89, FR95, FR97, FR105, FR106, FR108, FR110, FR119, plus §9.13 cross-cutting header.

**Master Spec amended:** §2.7 Vendor Scope (new); §4 Epic 7 row (Tier 1 carve-out); §8.1 deductStock contract (FEFO ordering note).

**New file:** `decision-log.md` with inaugural entry DL-001 (canonical 5-status PO lifecycle).

**Logged to Phase 3a deferred-technicals:** F-052 (precise journal-line mapping for FR47b vendor CN + FR67a reclassification entry; Pending-GR provisional-inventory model needs architect pin-down).

**Phase 2b prep parking-lot — no new entries this pass beyond P2B-001 to P2B-005 from Pass A/B.** The new FCCC two-surface design (FR95/FR108) and the Pending-GR-resolution-outcomes drill-down (FR70) feed naturally into the existing parking lot but no new P2B-NNN ID was opened — they are absorbed into P2B-005 (override-frequency widget) and a new implicit "FCCC tabbed/dual-route layout" requirement that Phase 2b will surface when it does the screen inventory.

**Pass D scope (next):**
- Walk PRD §10 Pre-Implementation Gate ↔ Master Spec §11 Open Questions alignment.
- Verify the 9 still-open architecture-phase questions (OQ1–OQ9) all have a clear architecture-phase deliverable defined.
- Verify OQ10 resolution (PRD-level dual Tally + Zoho + Generic CSV) flows into FR96 wording cleanly — already done in Pass A but worth re-confirming.
- Cross-check: every F-NNN entry in this notes file is either RESOLVED or has a clear Phase-3a / Phase-2b / Pass-D destination.
- Surface anything else that should block Phase 2b kickoff.

---

## End-of-review consolidation

Filled at Pass D close (Phase 2a end). Three lists, per the Pass D brief.

### (a) Ambiguities — must resolve before architecture

**None remaining at PRD level.** Every product-owner-judgment ambiguity surfaced across Pass A / B / C was resolved inline, with the resolution captured against an F-NNN ID in this file. Architecture-phase work begins from a fully-resolved PRD with respect to product/operational ambiguity.

For completeness, the architecture phase still owns two distinct categories of forward-leaning items, neither of which is a PRD-level ambiguity:

- **Open Questions OQ1–OQ9** (Master Spec §11 + PRD §10) — technical / architectural decisions the architect is the right person to propose, with product-owner confirmation. OQ10 is already resolved at PRD level (FR96).
- **Phase 3a deferred-technicals** (this file, "Phase 3a — Technical decisions deferred" section) — F-028 (GST intra/inter-state validation enforcement layer), F-038 (5-minute rollback target vs Drizzle migration semantics), F-052 (precise journal-line mapping for FR47b vendor CN + FR67a reclassification entry; Pending-GR provisional-inventory model). Each entry states the question, the surrounding PRD context, and the constraints already implied by master-spec or PRD that narrow the answer space.

### (b) Potential contradictions with master spec / brainstorming / B2B challan spec

**All resolved during the review.** For trail, the contradictions surfaced and how they closed:

- **F-005** Master Spec §4 Epic 7 row missed the Tier-1 carve-out for Pending GR + provisional costing established in Pass A Q2 — fixed inline at Pass C close (`02-master-spec.md` §4 Epic 7 row).
- **F-011** Sameer's Journey 2 originally described a direct cross-cluster raw-material transfer, contradicting Master Spec §2.2 lateral-flow ban — rewritten as paired Brand-Store-routed transfer with Brand-Owner approval bundle.
- **F-018** PRD §6.1 cross-location expiry visibility was silent on whether suggestions could fire illegal direct cross-cluster laterals — rewritten to scope suggestions to within-cluster first, then paired Brand-Store-routed bundle for cross-cluster, never a direct lateral.
- **F-027 / F-048 / F-049** Role bindings for IRN / GST / TDS edits were under-specified in PRD §6.4 vs B2B Challan Spec §11 vs PRD §7.2 RBAC matrix — FR78 + FR97 + FR119 rewritten to name Finance Manager + Brand Owner explicitly and cross-reference all three sources. Re-verified consistent in Pass D D.7.
- **F-029** "Tamper-evident audit trail" (PRD §6.5) vs "append-only at DB level" (PRD §8.2) — strength level disagreement — resolved as append-only (the §8.2 honest commitment); cryptographic hash-chain hardening explicitly post-MVP.
- **F-033** Master Spec §12 seed data named "POS Managers (4)" while PRD §7.2 + Pass A Journey 8 (Neha) named "POS Staff" — Master Spec aligned to PRD wording; Store Manager (2) and Dispatch Staff (2) seed counts added.
- **F-039** PRD FR2 four-type department enum (Production / Non-Production / Store / Dispatch) did not reconcile with Master Spec §2.1 (Stores are separate org units; only Production / Non-Production are department types within Locations) — FR2 reconciled to Master Spec §2.1.
- **F-040** PRD FR3 "yield factors" was ambiguous against Master Spec §2.5 (variable per-receipt) — disambiguated to "default standard yield factor (variable per-receipt yield is recorded at GR per FR27)".
- **F-041** Vendor scope ("Brand / Cluster / POS level") was a master-data field on FR6 with no operational domain rule — promoted to a domain rule in PRD §6 and Master Spec §2.7.
- **F-042 / F-043** PRD FR15c, FR20, FR24 used "tamper-evident" / "compliance-ready" language inconsistent with the F-029 append-only resolution and Master Spec §6.4 statutory-out-of-MVP scope — rewritten.
- **F-044** Master Spec §8.1 `inventoryService.deductStock()` contract was silent on FEFO ordering despite FR31 mandating system-level FEFO — Ordering line appended to the §8.1 contract.
- **Account-naming conflation (F-001)** PRD FR88 + FR89 named the POS-sales revenue account "Revenue — Internal Dispatch", conflating internal stock movement (no journal) with retail sales recognition — renamed to "Revenue — POS Sales" with the FR89 mapping rule updated.

### (c) Phase 2b prep items — to inform UX / screen inventory work

The Phase 2b parking lot (above) is the canonical, machine-checkable list. Reproduced here for handoff:

- **P2B-001** [from F-010] Every form/screen that supports data entry must visibly indicate **draft** vs **confirmed** state. Cross-cutting UI requirement — flag on every form-bearing screen, not just transactional ones.
- **P2B-002** [from F-011] Cross-cluster reallocation needs a "paired Brand-Store-routed transfer" affordance — the Cluster Manager initiates the return-to-Brand-Store and the matching draw-from-Brand-Store as a bundled pair, surfaced as a single approval object to the Brand Owner.
- **P2B-003** [from F-016] Permission override management UI for Brand Owner: per-user effective-permissions view (role + grants + revokes consolidated), grant/revoke flow with mandatory reason code and optional expiry date, "overrides expiring soon" widget on Brand Owner dashboard, audit trail link from each override to its source change record.
- **P2B-004** [from F-018] Expiry dashboard suggestion affordance must distinguish (a) single-hop within-cluster transfer suggestions from (b) paired Brand-Store-routed cross-cluster suggestions. The paired (b) variant must surface as a single bundled approval object to the Brand Owner — same UX shape as P2B-002. Paired structure must be visible to the user, not hidden as an implementation detail.
- **P2B-005** [from §6.8 review + F-021] Override-frequency widget on the Brand Owner dashboard must be a single aggregating widget covering all warn-and-log override types (FR67 Pending GR overrides, F-021 ingredient substitutions, future warn-and-log overrides). Per-type filters/breakdowns inside the widget. Surface both count and rate (overrides per 100 production orders) so spikes are visible at scales of 5 vs 50 daily orders.

**Implicit Phase 2b items surfaced during Pass C (no P2B-NNN ID assigned yet — Phase 2b kickoff will absorb these):**

- **FCCC two-surface design** [from F-050] FR95 (financial framing) + FR108 (operational analytics framing) are now two complementary surfaces over shared underlying data. Phase 2b should design either a tabbed FCCC or two distinct routes that cross-link (FR95 ↔ FR108) without duplicating drill-down state.
- **Pending-GR-resolution-outcomes drill-down** [from F-025 / FR70] The Brand Owner dashboard must allow drill-down from the Pending-GR-resolution-outcomes pane into the underlying rejected GR + linked PO + reclassification journal (FR67a). Useful audit thread when investigating vendor quality issues. Likely absorbed into P2B-005 widget or surfaced as a peer pane.

---

## Pass D close — Phase 2a complete

Pass D scope was pre-implementation gate audit + final consolidation + Phase-2a close. No new product-owner-judgment ambiguities surfaced (as expected — Pass D is convergence, not exploration).

**Verifications performed:**

- **D.1** PRD §10 ↔ Master Spec §11: both have 10 OQs, OQ10 marked ✅ RESOLVED in both, the 9 still-open are aligned by topic and intent. Minor wording differences (e.g. PRD OQ3 frames "mechanism", Master Spec OQ3 frames "which events") describe the same architecture-phase decision from complementary angles — not a contradiction.
- **D.2** OQ1–OQ9 deliverables: each OQ in PRD §10 names what it "determines" (i.e. the deliverable scope). Pattern is consistent. None are bare questions without an output target.
- **D.3** OQ10 / FR96: dual Tally + Zoho Books + Generic CSV from MVP via format-agnostic data layer with pluggable renderers; column-name mapping spec listed as the architecture-phase deliverable for OQ10. Master Spec §11 OQ10 row mirrors this.
- **D.4** Phase 3a deferred-technicals: F-028, F-038, F-052 each logged with rationale and surrounding PRD context. None claim to map to an OQ slot — they explicitly stand outside the OQ list with their home in this file's "Phase 3a — Technical decisions deferred" section.
- **D.5** Phase 2b parking lot: P2B-001 through P2B-005 all have clear screen-inventory implications. (Numbering is ID-keyed, not order-keyed — P2B-004 trailing P2B-005 in file order is a quirk, not a defect.)
- **D.6** Orphan-flag check: every F-NNN entry is either RESOLVED or has a clear destination (Phase-3a deferred-technicals or Pass-D verification). ID gaps (F-012, F-015, F-024, F-026, F-036) are unused IDs, not orphans. F-027 promoted from PARTIALLY CLOSED → RESOLVED at Pass D close (both legs were already covered by F-048 and F-049).
- **D.7** Sanity passes: 8 roles aligned across exec summary / User Success / Journeys / capabilities matrix; Master Spec §12 seed data Users row matches §7.2 RBAC (8 seeded + Superadmin unseeded); B2B §11 ↔ FR78/FR97/FR119 consistent on Finance Manager + Brand Owner; Master Spec §5 epic dependency graph consistent with §9.13 primary-epic annotations; decision-log.md referenced from CLAUDE.md, Master Spec §7.6, §7.7, §7.9, and FR96.

**Inline doc-consistency fixes applied at Pass D close:**

- **F-027** status header updated PARTIALLY CLOSED → RESOLVED (both legs already covered).
- **PRD FR68** gained a forward cross-reference to `decision-log.md` DL-001 (the canonical 5-status PO lifecycle binding) — DL-001 already references back to FR68; symmetry restored.

**Phase 2a status: complete.** Inputs ready for Phase 2b (UX / screen inventory):

- `_planning/02-master-spec.md` v1.2 — single source of truth.
- `_planning/03-prd.md` — fully reviewed, FR1–FR119 + FR15a/b/c + FR47a/FR47b + FR67a, all OQ1–OQ10 surfaced.
- `_planning/04-b2b-challan-spec.md` — supplementary, consistent with PRD FR71–FR82 and FR97/FR118/FR119.
- `decision-log.md` — DL-001 logged.
- `_planning/prd-review-notes.md` — this file. End-of-review consolidation populated. Phase 2b prep parking lot (P2B-001 to P2B-005 + two implicit items above) ready to feed screen inventory work.
- Phase 3a deferred-technicals (F-028, F-038, F-052) ready to feed architecture-phase agenda alongside OQ1–OQ9.

---

## Phase 2c-prep close — DESIGN.md finalisation + logo adaptation

Phase 2c is canonically supposed to follow Phase 2b (screen inventory), but the product owner drafted `design.md` (FinFlow source) and `design-2.md` (Culinary Architect source) and supplied Wild Sugar logos in advance. This out-of-sequence session locks the design system so Phase 2b screen briefs reference real tokens instead of placeholders.

**Inputs at session start:**

- `design.md` — FinFlow brand book (wrong product entirely — mobile-first finance app, "Coastal Heirloom" teal/gold/coral palette, IBM Plex typography). Used as a *structural* template only (sections 2 logo, 3 voice, 8 motion, 13 print, 14 a11y, 15 India-native, 17 don't-list). Removed at session close.
- `design-2.md` — Culinary Architect F&B-ERP-specific Material 3 token system (Inter, teal-anchored, sidebar chrome, surface hierarchy, no-line rule, severity alerts). Used as the *technical* foundation. Preserved at project root as a historical source draft per DESIGN.md §21.1.
- `logos/logo-full.png` + `logos/logo-nibble.png` — Wild Sugar — Patisserie & Cafe artwork. Single-hue peach (~`#F5B17A`).

**Output:** finalised `DESIGN.md` (uppercase, per Master Spec §3.3 conventions) at project root. Single source of truth for tokens, typography, motion, voice, status palette, logo usage, and tenant-branding pattern. Approximately 21 sections, 700+ lines.

**Direction decisions made this session (product owner approvals captured for traceability):**

- **D2C-001** Wild Sugar = MVP tenant (single-tenant MVP per Master Spec §1.2). The F&B ERP wears Wild Sugar branding. Architecturally modelled as a tenant-brand token slot (`tenant_brand_accent`, `tenant_logo_full_url`, `tenant_logo_nibble_url`, `tenant_display_name`). Product chrome (palette, typography, components, status semantics) is product-owned and identical across tenants; tenant identity overlays at login / splash / sidebar logo / B2B PDF headers / customer-facing exports / outbound emails. Operational UI surfaces never use the tenant accent for status or state. Future tenant onboarding requires only a logo + accent hex + display name string — no product code change.
- **D2C-002** Brand voice for the operational UI is **operational-confident, never warm-saccharine**. Wild Sugar patisserie warmth is restricted to customer-facing surfaces (login italics, B2B challan PDF footers, marketing emails). Voice principles distilled from `design.md` §3 (plain over precise · Indian by default · confident never preachy · one question per screen · numbers in copy patterns) with the "warm" register dropped per the ERP context. Reason-code prompts use "Why is this happening?" not "Justify this exception" — pattern recorded in DESIGN.md §17.3.
- **D2C-003** Colour anchor is the **teal-anchored functional product palette from design-2.md** (`primary #00525b`, dark sidebar chrome `#001f24`, five-layer surface hierarchy, severity-coded alerts), with the Wild Sugar peach reserved as `tenant_brand_accent` for brand surfaces and decorative emphasis only. Peach is **never** a substitute for `warning`, `tertiary`, or any state-bearing token — confusing tenant warmth with product status would mislead operational users (verified contrast: peach-on-light fails AA for body text — DESIGN.md §15.1).
- **D2C-004** Typography: **Inter is the sole typeface** per Master Spec §3.1 (FINAL). The IBM Plex Serif/Sans/Mono stack proposed in `design.md` is rejected as it contradicts a closed Master Spec decision. Inter's tabular-nums and feature settings are sufficient for ledger and KPI surfaces. design-2.md's Inter scale (Display L → Label S, 56px → 11px) is adopted as-is. The ₹ rule (60% of value size, `on_surface_variant` colour, hair-space separator, Indian grouping) is preserved from design-2.md §3 and design.md §3.3 — these two source drafts agreed.
- **D2C-005** Filename: **`DESIGN.md` (uppercase)** per Master Spec §3.3 conventions (cited consistently across Master Spec lines 169, 225, 241, 256, 259, 495, 622). Old `design.md` (lowercase, FinFlow content) deleted in this PR. Note: macOS HFS/APFS is case-insensitive — git canonicalises to the chosen casing.

**New product-design decisions made this session (no PRD change required, anchored to existing FRs):**

- **D2C-006** The status-and-state palette in DESIGN.md §6 introduces 13 named status tokens (`status_draft`, `status_pending_approval`, `status_pending_gr`, `status_provisional`, `status_confirmed`, `status_in_progress`, `status_completed`, `status_closed`, `status_cancelled`, `status_gr_rejected`, `status_returned`, `status_overridden`, `status_variance_flagged`). Each is anchored to a PRD lifecycle FR or Master Spec rule (anchors cited inline in §6). Every status token pairs colour with a Lucide icon and a Label S word — colour is never the only cue (WCAG 1.4.1). Row-level statuses (`status_provisional`, `status_overridden`, `status_variance_flagged`) use a 4 px left pip on a `surface_container_lowest` row, not a tinted background, so dense list views remain legible.
- **D2C-007** Status-precedence rule for screen-level row colour when multiple statuses apply: gr_rejected > variance_flagged > overridden > provisional > pending_* > draft/lifecycle. Documented in DESIGN.md §6.3.
- **D2C-008** The Provisional flag (FR67a) gets a unified visual signature across surfaces: inline `flask-conical` icon + "PROVISIONAL" Label S chip in the UI, dotted stroke on chart series, italic " (provisional)" suffix on PDF cost values. DESIGN.md §6.5.
- **D2C-009** Variance and override widgets on the Brand Owner dashboard (anchored to P2B-005, F-021, FR70) get a unified visual signature: 30-day trend sparkline + hero-number current-period value, with the override widget surfacing a **rate** (per 100 production orders) per P2B-005's spike-visibility-at-different-scales requirement. DESIGN.md §6.6.
- **D2C-010** Five-layer surface hierarchy applies project-wide (chrome → base → section → action → wells), with tonal shifts (1–4 hex points between adjacent layers) creating depth instead of borders. The "no-line" rule (DESIGN.md §5.2) prohibits 1 px solid borders for sectioning; severity uses 4 px left pips, focus uses 2 px primary outer ring at 4 px offset. Mirrors design-2.md §2.3 verbatim.
- **D2C-011** Eight-persona density mapping (DESIGN.md §19): mobile-first comfortable density for Kitchen Manager / Store Manager / Dispatch Staff / POS Staff (operational personas, phones/tablets in active environments); laptop-comfortable-or-compact for Brand Owner / Cluster Manager / Procurement Manager / Finance Manager. `compact` density mode is opt-in for management personas working with very large tables; mobile is **always comfortable**. PRD persona journeys cited inline.

**Logo usage rules baked into DESIGN.md §4:**

- Full lockup (`logos/logo-full.png`) — login, splash, B2B PDF header, accountant export PDF header, email header, sidebar header (desktop expanded). Min 120 px screen / 24 mm print.
- Nibble (`logos/logo-nibble.png`) — mobile top bar, collapsed sidebar, favicon, app icon, push-notification icon. Min 24 px screen / 8 mm print. Below 24 px, omit and use tenant_display_name in text.
- Allowed backgrounds: white, `surface`, `surface_container_lowest`, cream/oat plates. Sidebar dark teal is borderline (peach-on-`#001f24` ≈ 3.4:1 — passes large-graphic exemption but not body text). Photographic, gradient, and warning-palette surfaces are forbidden.
- Don'ts: no recolouring (don't apply `tenant_brand_accent` via CSS filter), no rotation/skew/shadow/outline, no font-typed wordmark substitution, no pairing nibble + full lockup on the same line.

**Audit findings worth flagging:**

- **A-001 (resolved in this session)** `design-2.md` §2.2 set `on_sidebar` to white at 70% opacity. Effective contrast against `sidebar` (`#001f24`) is ~10.4:1 — passes AAA but borderline for AT users with reduced display gamma. Raised to **78%** in DESIGN.md §5.1.5 to clear AA cleanly across hardware. Same treatment for `on_sidebar_muted` (40% → 50%) for non-text component contrast.
- **A-002 (informational)** `design-2.md` §2.1 noted `success` and `warning` are application-level tokens not in M3 — must be added to `tailwind.config.ts` manually. DESIGN.md §6.4 preserves this note.
- **A-003 (informational)** `warning` foreground rule: never use `on_warning` `#ffffff`. White-on-`#F9A825` is ~2.4:1 — fails AA. Always use `on_warning` `#191c1d` (~9.5:1). DESIGN.md §6.4 + §15.1.
- **A-004 (informational)** `tenant_brand_accent` (peach `#F5B17A`) is decorative-only on light surfaces. Body-text use fails AA at ~1.9:1 against `surface`. Status-indication use is forbidden by §6 design-rule, not just contrast. DESIGN.md §15.1.
- **A-005 (informational)** Stitch-generated screens ship with Material Symbols; Lucide React conversion is required for Phase 4 implementation per Master Spec §3.3 + DESIGN.md §11.3. The conversion lookup table is a Phase 3a deliverable (not in DESIGN.md scope).

**No PRD or Master Spec amendments this session.** Phase 2a is closed; this session honours that. Where DESIGN.md surfaces a new operational pattern (e.g. paired-transfer approval-card affordance for P2B-002 / P2B-004), it consumes the existing PRD requirement — it does not extend it.

**Phase 2c-prep status: complete.** Carrying forward to Phase 2b (UX / screen inventory):

- `DESIGN.md` at project root — single source of truth for tokens. Screen briefs reference token names, not literal hex/px.
- `logos/logo-full.png` + `logos/logo-nibble.png` — canonical Wild Sugar artwork referenced via `tenant_logo_full_url` / `tenant_logo_nibble_url` slots.
- `design-2.md` preserved at root as a historical source draft (per DESIGN.md §21.1) — may be removed after the first frontend epic ships.
- `design.md` (FinFlow source) deleted — wrong product entirely.

**What remains for Phase 2c proper (deferred — runs after Phase 2b screen inventory):**

- Visual screen mockups for each of the 8 personas' canonical surfaces (morning briefings, approval inboxes, production planning, dispatch confirmation, closing inventory, FCCC two-surface design, accountant exports, B2B challan flow).
- Stitch-generated or Claude-generated comps using DESIGN.md tokens.
- Iteration against persona journeys.
- Acceptance handoff to Phase 3a (architecture).

Phase 2b (screen inventory) is the next session.
