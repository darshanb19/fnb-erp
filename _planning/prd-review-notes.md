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

---

## End-of-review consolidation

This section will be filled in at the close of the full review (after Pass D). Three lists:
- **(a) Ambiguities** — must resolve before architecture
- **(b) Potential contradictions** with master spec / brainstorming / B2B challan spec
- **(c) Phase 2b prep items** — to inform UX / screen inventory work

*— pending —*
