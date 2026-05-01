---
inputDocuments:
  - master-spec.md
  - brainstorming-summary.md
  - b2b-challan-spec.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 3
classification:
  projectType: 'Vertical ERP — Internal Operations Platform (multi-tenant ready)'
  domain: 'Perishable Goods Manufacturing & Distribution — Multi-location F&B'
  complexity: 'High (unevenly distributed) — Very High on domain logic & data model; Medium on regulatory & integration'
  projectContext: 'Greenfield build, brownfield domain'
  deliveryModel: 'Solo developer, AI-assisted, sprint-based, epic-sequential'
  prdDepthRule: 'Depth proportional to risk tier — Tier 1 gets granular specs; Tier 2 complexity outliers (Epic 10) get Tier 1 depth; Tier 3 gets minimal specs'
  mvpScope: 'All 12 epics in scope — mile-wide-inch-deep. No modules deferred.'
---

# Product Requirements Document — F&B ERP

**Author:** Darshan
**Date:** 2026-04-05

## Executive Summary

The F&B ERP is a comprehensive Enterprise Resource Planning system purpose-built for multi-location Food & Beverage organisations. It replaces fragmented spreadsheet-and-WhatsApp operations with a single platform that tracks every material movement, recipe cost, production order, and financial transaction in real time — from the moment raw materials enter the Brand Store to the moment a finished product is sold at a POS location and the revenue appears on the P&L.

The system serves the full operational hierarchy of a multi-location F&B business: Brand Owners who need cross-location financial visibility, Cluster Managers who coordinate production and distribution across sites, Kitchen Managers who plan daily production against live stock levels, Store Managers who control raw material movement in and out of every store and apply yield factors at goods receipt, Dispatch Staff who move finished goods to POS locations and B2B customers, POS Staff who run customer-facing counters and close the day's inventory at every POS location, Finance Managers who close the books in hours instead of weeks, and Procurement Managers who track vendor performance and material costs. Every role opens one screen at the start of each day that tells them exactly what they need to know and act on — no chasing messages, no reconciling spreadsheets, no guessing at stock levels.

The system digitises established business processes that are currently running on manual workflows. User workflows are known and validated through daily operational experience, not speculative research. The MVP delivers all 12 modules at core-workflow depth following a "mile wide, inch deep" philosophy: every operational function is present from day one, with features deepening iteratively based on real daily usage post-launch.

**Named pain points this system eliminates:**
- Stock levels that exist only in someone's head or a WhatsApp message
- Recipe costs that are never updated when vendor prices change
- No visibility into which location holds excess stock before it expires
- Closing inventory conducted on paper with variances nobody can trace
- Financial reporting that arrives weeks after month-end because data lives in five separate spreadsheets

### What Makes This Special

This ERP is built by the operator, for the operator. The product owner is the first user — every rule in the system exists because a real F&B operation needs it, not because a product manager hypothesised it. Material enablement rules, yield factor cascading through recipe cost hierarchies, three-product-type directional flow enforcement, and the two-stage B2B accounting model all reflect how the business actually runs.

The core insight: F&B operations are uniquely constrained by perishability, recipe-driven production, and multi-site daily rhythms. Generic ERPs either ignore food-specific workflows (yield factors, FEFO, recipe cost roll-ups) or bury them under enterprise complexity designed for manufacturing plants, not kitchens. This system closes that gap — operationally complete from day one, simple enough for kitchen staff to actually use through quick entry modes, scan-first workflows, and smart defaults.

The "aha" moment is role-specific. The Kitchen Manager sees live stock levels and knows exactly what can be produced today without calling the store. The Brand Owner opens a dashboard showing food cost percentage, stock value, and daily sales across all locations in one view. The Finance Manager completes month-end close in hours instead of days because every transaction was already recorded in real time as it happened.

## Project Classification

| Dimension | Classification |
|---|---|
| **Project Type** | Vertical ERP — Internal Operations Platform (multi-tenant ready) |
| **Domain** | Perishable Goods Manufacturing & Distribution — Multi-location F&B |
| **Complexity** | High (unevenly distributed) — Very High on domain logic and data model; Medium on regulatory and integration |
| **Project Context** | Greenfield build, brownfield domain — new codebase digitising established manual processes |
| **Delivery Model** | Solo developer, AI-assisted (Claude Code + MCP servers), sprint-based, epic-sequential |
| **MVP Scope** | All 12 epics in scope — mile wide, inch deep. No modules deferred. |
| **UI Design Tool** | Decision deferred to Phase 2c — pre-validated options are Google Stitch (via `stitch-mcp` MCP) or Claude Imagine/Artifacts. Hybrid approach also viable. See Master Specification §3.3. |
| **PRD Depth Rule** | Depth proportional to risk tier. Tier 1 epics receive granular specifications. Tier 2 complexity outliers (Epic 10: Accounting) receive Tier 1 depth. Tier 3 epics receive minimal specifications. |

## Success Criteria

### User Success

- **Brand Owner:** Spots and assigns investigation to operational variances (food cost overruns, closing inventory deviations, expiry write-offs, override frequency spikes) within 24 hours of occurrence. Cross-location dashboard surfaces variances proactively rather than requiring discovery via month-end reconciliation.
- **Cluster Manager:** Clears the cluster's approval inbox daily within an hour of opening the system; closes assigned variance investigations within 48 hours of assignment.
- **Kitchen Manager:** Views live stock levels and determines today's production capacity without calling the store or checking WhatsApp. Completes daily production planning within the system using real data, not estimates.
- **Finance Manager:** Completes month-end close within 2 working days of month end (current state: 2-3 weeks). Achievable because every transaction — goods receipts, production orders, dispatch challans, sales — is recorded in real time as it happens. Month-end becomes aggregation and review, not data entry.
- **Dispatch Staff:** Records every dispatch (internal challan, B2B challan) on mobile in under 60 seconds. Digital delivery confirmation replaces signed paper challans.
- **POS Staff:** Receives daily dispatches with digital confirmation in under 30 seconds; submits closing inventory before the counter-close cut-off with mandatory reason codes for any variance.
- **Procurement Manager:** Side-by-side vendor comparison with historical price tracking is available before every PO. Yield variance flags surface in the system within 24 hours of GR confirmation.
- **Store Manager:** Records every goods receipt with barcode/QR scanning and yield factor application. Stock levels visible to dependent departments within 30 seconds.

### Business Success

- Within 90 days of go-live, all new operational transactions (goods receipts, production orders, dispatch challans, sales) are recorded in the ERP rather than in spreadsheets, WhatsApp, or paper. Historical data import is out of scope — selective imports for analytic baselines (recipe history, vendor price history) are post-MVP.
- Variance detection latency reduced from weeks to hours — issues surface on the same day they occur
- Recipe cost figures stay current — no more recipe costs unchanged for months while vendor prices climb
- B2B challan-to-revenue cycle is fully traceable — every DC TRN links from operational dispatch to financial recognition

### System Success

- Stock movements propagate within 30 seconds (real-time enforcement)
- Page loads under 2 seconds on a 4G mobile connection
- 99.5% uptime during operational hours (5am–11pm IST)
- Zero data loss on confirmed transactions. Drafts and in-progress entries that have not been confirmed are not covered — these are user-session state and may be lost on session interruption (closed browser, dead phone, network drop). The system must clearly indicate whether an entry is draft (not durable) versus confirmed (durable) so users know what state they're in.

## Project Vision

### Phase 1 — MVP (All 12 Epics, Mile-Wide-Inch-Deep)

- **Epic 1: Master Data Management** — Organisational hierarchy, departments, products (raw / semi / final), UOMs and conversions, material enablement, vendor master, categories, company registration. Tier 1 depth.
- **Epic 2: User Management & Security** — RBAC mapped to organisational hierarchy, user CRUD, authentication, session management, material enablement as domain-specific access layer. Core depth.
- **Epic 3: Shared Infrastructure** — Unified Approval Engine, Notification & Alert Center, tamper-evident Audit Trail, internal Issue Tracker. Core depth — built before Epics 4–12 so all subsequent modules use it.
- **Epic 4: Inventory Management** — Real-time stock visibility, goods receipt with yield factors, three-product-type flow rules, inter-location/department transfers, expiry tracking with FEFO, PAR levels, closing inventory. Tier 1 depth.
- **Epic 5: Procurement** — POs (all-items / category-wise / vendor-wise), approval engine integration, vendor price comparison and history, vendor master, PDF distribution. Tier 1 depth.
- **Epic 6: Recipe Management** — Recipe CRUD, multi-version (default + alternates), cost calculation, cost cascade through hierarchy, scaling, sub-recipes, multi-dimensional categorisation. Tier 1 depth.
- **Epic 7: Production Planning** — Production orders driven by recipes, ingredient availability/enablement checks (warn-and-log), partial orders, ingredient substitutions, Pending GR sub-status with provisional costing. Tier 2 depth with Pending GR/provisional cost as Tier 1 priority due to cross-epic dependencies.
- **Epic 8: Dispatch & Distribution** — Internal dispatch challans, B2B challans (Draft → Dispatched → Delivered → Closed lifecycle, two distinct close paths), B2B customer master, credit notes, digital delivery confirmation, daily closing inventory at Dispatch and POS departments. Tier 2 depth.
- **Epic 9: POS Integration** — Menu item-to-recipe mapping, sales import via REST API, inventory impact from sales. Tier 3 depth — integration layer, not POS replacement.
- **Epic 10: Accounting & Financial** — Universal TRN, simplified F&B Chart of Accounts, automated journal entries via mapping rules, internal ledger, Trial Balance / P&L / Balance Sheet / Cash Flow Statement, Daily Sales Report, Budget vs Actual, Food Cost Control Centre, accountant handoff exports (Tally / Zoho Books / Generic CSV), compliance placeholder fields, Integration Status Dashboard. Tier 1 depth (complexity outlier — receives Tier 1 attention despite Tier 2 classification).
- **Epic 11: HRMS** — Employee records, basic attendance tracking, shift definition and assignment, duty roster view. Tier 3 depth — no payroll, no performance management.
- **Epic 12: Analytics & Reporting** — Customisable dashboards, Food Cost Control Centre, multi-location financial reporting, role-based morning briefing views, cross-module operational reports. Non-negotiable alongside operational epics.

### Post-MVP & Vision

Post-MVP features are organised into Phase 2 (Operational Deepening) and Phase 3 (Platform & Compliance) in the Project Scoping & Phased Development section. Placeholder fields and export-first patterns are designed to enable post-MVP features without schema changes.

## User Journeys

### Journey 1: Darshan — Brand Owner

**Situation:** Darshan owns the F&B brand with 2 clusters, 2 central kitchens, and 4 POS locations. He needs to see the business health across all locations without calling six different managers.

**Opening Scene:** 8:00am. Darshan opens the Brand Owner dashboard on his laptop. One screen shows: yesterday's total sales across all 4 POS locations (₹4.2L), current food cost percentage (32.1% against a 35% target), total raw material stock value (₹18.5L), 2 purchase orders pending his approval above ₹50K threshold, and 1 variance flag from POS-AB where closing inventory showed a 7% deviation on sandwich inventory.

**Rising Action:** He drills into the food cost breakdown by location. POS-AA is at 30% (healthy). POS-AB is at 38% (above target) — the variance flag makes sense now. He taps the variance report: POS-AB's sandwich inventory shows 0.8kg unaccounted — no wastage entry, no adjustment. He assigns investigation to the Cluster Manager via the issue tracker. He then approves both purchase orders — one for flour (₹62K, Vendor A), one for packaging material (₹55K, Vendor C) — reviewing vendor price history before approving.

**Climax:** In 15 minutes, Darshan has a complete operational picture that previously required 2 hours of phone calls and spreadsheet reconciliation. He spots the POS-AB issue on the same day it happened, not 3 weeks later at month-end.

**Resolution:** Over weeks, the pattern becomes clear: the morning dashboard is the heartbeat check. The system surfaces problems proactively — expiry alerts, cost overruns, variance flags — instead of Darshan having to hunt for them. Decisions that used to wait for month-end reports now happen the next morning.

**Capabilities revealed:** Cross-location dashboard, food cost analytics, variance investigation, approval workflows with threshold routing, vendor price history, issue tracker assignment, drill-down from summary to detail.

---

### Journey 2: Sameer — Cluster Manager, Cluster A

**Situation:** Sameer manages Cluster A — Central Kitchen A and POS locations AA and AB. He's the link between the Brand Owner and the operational managers (Kitchen, Store, Dispatch) within his cluster. His day is approval-heavy and exception-driven: he doesn't run any single workflow himself, but he unblocks every workflow that crosses department lines inside the cluster and escalates anything that needs to leave it.

**Opening Scene:** 7:00am. Sameer opens the cluster dashboard on his laptop. Filtered to Cluster A, he sees: 4 material requisitions from Pastry and Bakery awaiting his approval, 2 POs under the ₹50K threshold where he's the auto-approver (already approved overnight by the system, listed for review), 1 Kitchen Manager override flagged from yesterday — Priya proceeded with production despite a Pending GR — and 1 variance investigation assigned to him by Darshan: POS-AB closing inventory deviation of 0.8kg on sandwich inventory. A separate notification flags that Cluster B has 80kg of tomatoes expiring in 48 hours.

**Rising Action:** He clears the approval inbox first. Three of the four requisitions are routine (flour, butter, cocoa powder for Pastry); enablement and stock checks pass automatically — he approves them in a single bulk action. The fourth is a semi-product transfer request (50kg pastry cream from Central Kitchen A to POS-AB for a special order); enablement is fine but the volume is unusual. He calls Priya to confirm the order is real, then approves. He reviews Priya's override from yesterday — the reason code reads "tomatoes arrived 5am, started prep before GR confirmed at 9am." It's a recurring Pending-GR pattern; he tags it for the next epic retrospective.

**Climax:** Sameer pulls up the POS-AB sandwich variance assigned by Darshan. He drills through the day's transactions — production output, dispatch challans, POS sales, closing inventory. Production matches dispatch; dispatch matches POS receipts; POS sales match menu-item recipe consumption — but the closing count is short by 0.8kg. He calls the POS-AB manager, who admits the count was rushed; they agree on a recount with photo evidence. Sameer records his findings in the issue tracker; status updated within four hours of assignment.

**Resolution:** Mid-morning, the Cluster B tomato surplus alert resurfaces. Sameer checks Cluster A's tomato consumption pattern — Central Kitchen A can absorb 60kg over the next 36 hours. Cross-cluster reallocation always routes via the Brand Store (raw materials never move laterally between clusters): Sameer initiates a return-to-Brand-Store transfer for 60kg out of Cluster B Store, paired with a draw-from-Brand-Store transfer into Cluster A Store. Both transfers escalate to Darshan for approval because cross-cluster surplus reallocation touches the Brand Store hop. By noon both transfers are approved, the goods are in transit, and 60kg of stock that would have written off as expiry is now productive inventory. By end of day his approval inbox is clear, the variance is closed, and tomorrow's morning briefing will not show new red flags.

**Capabilities revealed:** Cluster-scoped dashboard, unified approval inbox with bulk approval, semi-product transfer approval within cluster, Kitchen Manager override visibility with reason-code review, variance investigation drill-down across modules, issue tracker assignment and resolution, cross-cluster reallocation via paired Brand Store transfers, expiry-driven cross-location intelligence.

---

### Journey 3: Priya — Kitchen Manager, Central Kitchen A

**Situation:** Priya manages the Pastry and Bakery departments at Central Kitchen A. She starts work at 5:30am and needs to know immediately what she can produce today based on actual stock, not yesterday's WhatsApp estimates. She's responsible for output that feeds 2 POS locations and 3 B2B customers.

**Opening Scene:** It's 5:30am. Priya opens the ERP on her phone. Her morning briefing dashboard shows: 3 items below PAR level in Pastry (flour, butter, cocoa powder), 2 production orders pending from yesterday's demand, and a flag that 15kg of cream in Cluster Store A expires in 48 hours.

**Rising Action:** She taps into the production planning screen. The system shows today's production orders — 8 chocolate cakes, 12 croissant batches, 6 bread loaf runs — with real-time raw material availability against each. Flour is short for the full bread run. She adjusts the bread order down to 4 runs and creates a material requisition for the shortfall. The requisition routes through the Unified Approval Engine to the Cluster Manager. While waiting, she prioritises the cream (expiring in 48 hours) into today's pastry cream batch — FEFO in action.

**Climax:** By 7:00am, all production orders are confirmed, raw materials are deducted from department inventory automatically, and the Dispatch team can already see what will be ready for the afternoon delivery run. No phone calls made. No WhatsApp messages sent. Every gram accounted for.

**Resolution:** At end of day, Priya records production output — actual yield vs expected. The system captures a 0.3kg variance on chocolate cakes, she tags it as "batter stuck to mixing bowl" with a reason code. The variance is traceable. Tomorrow morning, the cycle repeats — but this time, the system's PAR suggestions have already adjusted based on today's actual consumption.

**Capabilities revealed:** Real-time stock visibility per department, production order management, material requisition with approval workflow, FEFO prioritisation, yield variance recording with reason codes, PAR level monitoring, morning briefing dashboard.

---

### Journey 4: Meera — Finance Manager

**Situation:** Meera handles all financial operations for the brand. Month-end close used to take her 2-3 weeks because she was chasing data from 6 locations, reconciling 5 spreadsheets, and manually creating journal entries. Her nightmare was unreconcilable numbers.

**Opening Scene:** It's the 1st of the month. Meera opens the Finance dashboard. The system shows: all transactions from the previous month already recorded with TRNs, automated journal entries generated for every confirmed PO, GR, production order, dispatch challan, and sales report. The Trial Balance is already available — she didn't enter a single journal manually.

**Rising Action:** She reviews the Trial Balance. Revenue figures match the daily sales reports. COGS aligns with production consumption records. Accounts Payable matches the Purchase Register. She spots 3 B2B challans from the previous month that are still in "Delivered" status — GST invoices haven't been confirmed yet. She downloads the Sales Register export, sends it to the accountant for GST invoice generation in Tally. For 2 of the 3 challans, the accountant raises GST invoices and sends back IRNs. Meera pastes the IRNs into the challan records, sets `gst_invoice_raised = true` — Stage 2 journal entries fire automatically. The third challan was for an unregistered customer — she closes it with `gst_invoice_raised = false`.

A customer dispute lands mid-close. Sunrise Cafe — the B2B customer who received DC-2026-CKA-000045 last month — reports that one of six croissant batches arrived damaged. Meera creates a Credit Note for the partial return: CN-2026-CKA-000087 referencing the original DC TRN. The system raises the reversal automatically; because the original challan had `gst_invoice_raised = false`, the reversal touches Stage 1 only (DR Revenue — B2B Sales, CR Accounts Receivable for the base value of one batch). One batch worth of stock is reinstated at Central Kitchen A's Dispatch department. The CN appears on next month's Sales Register export with a reference back to the original DC TRN — the accountant has end-to-end traceability without having to ask anyone where the reversal came from.

**Climax:** By end of day 2, the P&L statement, Balance Sheet, and Cash Flow Statement are generated from the internal journal. Meera reviews, validates, and the month is closed. What took 2-3 weeks now takes 2 working days.

**Resolution:** Meera's new routine is daily rather than monthly. She reviews the Integration Status Dashboard each morning — which transactions are exported, which are pending, when was the last handoff. Month-end is no longer a fire drill; it's a review and confirmation exercise. The TRN linking means every number in every report traces back to a specific operational transaction.

**Capabilities revealed:** Automated journal entry generation, TRN-based transaction linking, Trial Balance / P&L / Balance Sheet / Cash Flow generation, B2B challan GST workflow (two-stage), B2B credit note creation with conditional two-stage reversal, Sales Register export, Integration Status Dashboard, accountant handoff workflow, compliance placeholder fields.

---

### Journey 5: Ravi — Dispatch Staff, Central Kitchen A

**Situation:** Ravi manages dispatch from Central Kitchen A. He needs to move finished goods to 2 POS locations and occasionally to B2B customers. His day is physical — loading vehicles, confirming quantities, getting delivery acknowledgments.

**Opening Scene:** 10:00am. Production is wrapping up. Ravi opens the dispatch screen on his phone. He sees 3 internal dispatch orders: POS-AA needs 4 chocolate cakes + 12 croissants, POS-AB needs 3 chocolate cakes + 8 bread loaves, and a B2B challan for "Sunrise Cafe" — 2 chocolate cakes + 6 croissant batches.

**Rising Action:** Ravi starts with the internal challans. He confirms quantities against the production output — the system shows what was produced and what's available for dispatch. He generates internal challans for POS-AA and POS-AB. Stock is decremented from the Dispatch department. He loads the vehicle. At POS-AA, the receiving staff opens the challan on their phone, verifies quantities, and confirms receipt digitally. Inventory updates at both ends simultaneously.

For the B2B challan (Sunrise Cafe), Ravi confirms dispatch — status moves to "Dispatched," Stage 1 journal entry fires (Debit AR, Credit Revenue), TRN DC-2026-CKA-000045 is generated. He delivers to Sunrise Cafe, the customer signs off digitally, status moves to "Delivered."

**Climax:** By 2:00pm, all dispatches are complete. Every item is accounted for — production output minus dispatch quantities equals remaining inventory, no manual reconciliation needed. The Finance team can already see the B2B challan in the Sales Register.

**Resolution:** At end of day, Ravi does physical closing inventory of the Dispatch department. The system shows expected quantities based on production received minus dispatched. Actual matches expected within 0.1kg tolerance. Any variance is tagged with a reason code. Tomorrow, the cycle repeats.

**Capabilities revealed:** Dispatch order management, internal challan generation, B2B challan lifecycle, mobile-first dispatch workflow, digital delivery confirmation, real-time inventory decrement, closing inventory with variance, TRN generation.

---

### Journey 6: Anil — Procurement Manager

**Situation:** Anil manages purchasing for the brand. He needs to keep all locations stocked without over-ordering, get the best prices from vendors, and ensure goods receipt is accurate with yield factor adjustments.

**Opening Scene:** 7:30am. Anil's dashboard shows: 5 items below PAR level across 3 locations, 2 pending PO approvals awaiting Brand Owner sign-off, yesterday's goods receipts summary (3 GRs processed, 1 with a yield variance flag on tomatoes), and a vendor price alert — Vendor B increased butter prices by 8% on the last delivery.

**Rising Action:** Anil creates a new PO for the below-PAR items. The system suggests quantities based on PAR levels minus current stock. He pulls up vendor price comparison for flour — Vendor A at ₹42/kg (last 3 months: ₹40, ₹41, ₹42), Vendor B at ₹39/kg (last 3 months: ₹38, ₹38, ₹39). Vendor B is cheaper but has a lower quality rating. Anil selects Vendor A for flour, Vendor B for sugar (where quality matters less). The PO routes through the approval engine — under ₹50K, it's auto-approved by Cluster Manager.

Later, a delivery arrives. The Store Manager records the Goods Receipt. 100kg tomatoes received. The store staff inspects and enters yield factor 0.82 (lower than the standard 0.85). The system records 82kg usable inventory, 18kg wastage. The adjusted cost per kg is recalculated. Because tomato yield changed, the system flags: "Yield factor deviation on tomatoes — recipe costs affected for 3 recipes." Anil reviews and confirms the yield factor update. Recipe costs cascade automatically.

**Climax:** The butter price increase from Vendor B is now visible in the vendor price history. Anil sees that Vendor B's butter has increased 15% over 6 months. He compares with Vendor C — stable pricing. He flags this for the next purchase cycle. The Food Cost Control Centre shows the impact: butter cost increase will push pastry food cost from 31% to 33% if unchanged.

**Resolution:** Anil's procurement decisions are now data-driven. He sees price trends, yield patterns, and cost impacts before they hit the P&L. The system surfaces problems (yield deviations, price spikes) instead of hiding them in spreadsheets discovered weeks later.

**Capabilities revealed:** PAR-based reorder suggestions, vendor price comparison and history, purchase order creation with approval routing, goods receipt with yield factor application, yield-to-recipe cost cascading, vendor price tracking, Food Cost Control Centre integration.

---

### Journey 7: Vikram — Store Manager, Cluster Store A

**Situation:** Vikram manages Cluster Store A — the intermediate raw material storage that supplies Central Kitchen A and its departments. He handles goods receipt from the Brand Store, issues materials to departments, and tracks stock levels.

**Opening Scene:** 6:00am. Vikram opens the store management screen. His morning view shows: current stock levels for all 45 raw materials in the cluster store, 3 items flagged with expiry within 72 hours (cream, yoghurt, fresh herbs), 2 pending material requisitions from the Pastry and Bakery departments, and expected deliveries today (1 PO from Brand Store transfer).

**Rising Action:** He processes the material requisitions first. Pastry Department has requested 25kg flour and 10kg butter. The system checks: flour is enabled for Pastry (yes), butter is enabled for Pastry (yes), stock is sufficient (flour: 180kg available, butter: 45kg available). Vikram approves the issue. Stock transfers from Cluster Store A to Pastry Department — recorded with TRN, inventory updated at both ends.

The Bakery Department requests 5kg cocoa powder. The system checks: cocoa powder is enabled for Bakery (yes), but stock is only 3kg. The system flags insufficient stock. Vikram partially fulfills (3kg) and notes the shortfall for the Procurement Manager.

**Climax:** The Brand Store transfer arrives — 200kg mixed raw materials. Vikram records the Goods Receipt against the transfer challan, verifying quantities item by item using the batch entry screen (all items visible in a scrollable list, scan barcode to populate). Each item's expiry date is captured. The system slots items into FEFO order automatically.

**Resolution:** By mid-morning, all incoming and outgoing material movements are recorded. The store's stock position is accurate and visible to every department that draws from it. No phone calls needed to check "do we have flour?" — the answer is in the system, updated within 30 seconds of every movement.

**Capabilities revealed:** Store inventory management, material requisition processing, enablement rule enforcement, partial fulfillment handling, goods receipt with barcode scanning, batch entry mode, FEFO ordering, expiry tracking, inter-store transfer receipt, real-time stock visibility.

---

### Journey 8: Neha — POS Staff, POS-AA

**Situation:** Neha runs daily counter operations at POS-AA, one of the two POS locations in Cluster A. She is the customer-facing endpoint of the entire supply chain — finished goods land at her counter, customers buy them, and what is left at end of day is what the rest of the system has to reconcile against. Her workflows are short and frequent: dispatch receipt in the morning, sales throughout the day (mostly auto-imported via the POS system), closing inventory at night.

**Opening Scene:** 9:00am. Neha opens the POS-AA dashboard on the counter tablet. She sees: yesterday's sales summary auto-imported from the POS system (₹1.1L across 142 transactions), yesterday's closing inventory confirmed and locked, today's expected dispatch from Central Kitchen A (4 chocolate cakes + 12 croissants, due 11:30am), and a notification — 2 croissants from yesterday are inside the 24-hour expiry band and should be sold first or written off.

**Rising Action:** At 11:35am, Ravi arrives with the dispatch. Neha opens the internal challan on her phone, verifies the items match (4 cakes, 12 croissants), and confirms receipt digitally in under 30 seconds. POS-AA inventory auto-increments. She tags the 2 expiring croissants as "sell first" — they appear at the top of the menu display until sold. Through the day, sales flow in. The POS system records each transaction; the ERP imports them in near real-time, and each sale's recipe-driven inventory consumption deducts from POS-AA inventory automatically — she never manually decrements anything. Around 3pm she notices a transaction with a discount that does not match published policy. She tags it for the issue tracker — Sameer, her Cluster Manager, will review.

**Climax:** 9:00pm. Counter closing time. Neha runs the closing inventory routine on her phone — the system shows expected end-of-day stock for every item (opening + received − sold − wasted). She taps each item, scans or counts, enters the actual. Most items match. Cocoa-dust pastries show 2 missing: 1 was sampled by a customer who did not buy, 1 was dropped during service. She tags both with reason codes ("customer sample — no purchase" and "dropped — wastage"). The closing inventory submits before the cut-off; Sameer's morning briefing tomorrow will reflect it.

**Resolution:** Before locking up, Neha submits the next day's product request to Central Kitchen A — bread loaves are running thin and tomorrow's forecast looks busy. The request lands in Priya's morning briefing for production planning. Neha logs out. Tomorrow's cycle starts fresh — opening stock is yesterday's confirmed close, expected dispatch is on its way.

**Capabilities revealed:** POS-scoped dashboard, internal dispatch receipt with digital confirmation under 30 seconds, sales auto-import from POS system with recipe-driven inventory deduction, expiry-band sell-first prioritisation, end-of-day closing inventory with mandatory reason codes for variance, issue tracker creation for transaction queries, next-day product request to Central Kitchen.

---

### Journey Requirements Summary

| Journey | Primary Capabilities Revealed |
|---|---|
| **Darshan (Brand Owner)** | Cross-location dashboard, food cost analytics, approval workflows, variance investigation, issue tracking |
| **Sameer (Cluster Manager)** | Cluster-scoped dashboard, unified approval inbox with bulk approval, semi-product transfer approval, override visibility, variance investigation drill-down, cross-cluster reallocation via Brand Store |
| **Priya (Kitchen Manager)** | Production planning, material requisition, FEFO, yield variance, PAR monitoring, morning briefing |
| **Meera (Finance Manager)** | Automated journals, TRN linking, financial statements, B2B GST workflow, credit note creation with conditional two-stage reversal, accountant handoff exports |
| **Ravi (Dispatch Staff)** | Internal/B2B challans, mobile dispatch, digital delivery confirmation, closing inventory, TRN generation |
| **Anil (Procurement Manager)** | Vendor comparison, PO management, goods receipt with yield, price tracking, recipe cost cascade |
| **Vikram (Store Manager)** | Store inventory, enablement enforcement, requisition processing, batch entry, barcode scanning, FEFO |
| **Neha (POS Staff)** | POS-scoped dashboard, dispatch receipt with digital confirmation, sales auto-import, recipe-driven inventory deduction, expiry sell-first, closing inventory with reason codes, next-day product request |

**Cross-cutting capabilities revealed across all journeys:**
- Morning briefing / role-specific dashboard as the entry point for every user
- Real-time stock visibility within 30 seconds of any transaction
- Unified Approval Engine routing all approvals regardless of module
- Audit trail on every transaction with TRN linking
- Mobile-first workflows for operational staff (kitchen, dispatch, store, POS)
- Mandatory reason codes on all variances and adjustments
- Notification alerts for exceptions (PAR breaches, expiry warnings, price spikes, variance flags)

## Domain-Specific Requirements

### Food Safety & Perishability Constraints

- **FEFO enforcement (First Expiry, First Out):** The system must prioritise ingredients closest to expiry in production material selection. This is not a preference — in a food business, using older stock first is a food safety requirement.
- **Expiry tracking at receipt:** Every perishable raw material must have an expiry date captured at Goods Receipt. The system must support expiry countdown dashboards with 24h/48h/72h urgency bands.
- **Shelf-life acceptance rules:** Goods Receipt must enforce minimum remaining shelf-life thresholds. If a vendor delivers milk with only 2 days remaining shelf-life against a 5-day minimum, the system must flag this for rejection or exception approval.
- **Yield factor variability:** Unlike manufactured goods, food raw materials have variable usability rates. 100kg tomatoes may yield 82-88kg usable material depending on batch quality. The system must capture actual yield at receipt and cascade the cost impact through every dependent recipe.
- **Cross-location expiry visibility:** Before stock expires at a location, the system must surface transfer suggestions to consume the stock. Suggestions are scoped to destinations permitted by the §2.2 product-type flow rules — within-cluster destinations are evaluated first (downstream raw-material hops, or lateral semi-product hops between enabled departments). If no within-cluster consumer is viable for raw materials, the system may suggest a paired Brand-Store-routed transfer to another cluster (consistent with the cross-cluster reallocation pattern in Cluster Manager Journey 2) — surfaced as a single bundled suggestion that requires Brand Owner approval, never as a direct cross-cluster lateral. This is an inventory intelligence feature, not just a report.

### Recipe-Driven Production

- **Recipe versioning is operational, not theoretical:** Multiple active versions of the same recipe must be supported. A default version drives production by default; alternates can be selected explicitly. Version changes require approval workflow.
- **Cost cascade on every change:** A change to any raw material price or yield factor must propagate through all dependent semi-product and final-product recipes automatically. Cost figures must never go stale.
- **Sub-recipes as first-class citizens:** A recipe can reference another recipe as an ingredient (e.g., "pastry cream" used in 8 different cakes). The cost roll-up must traverse this hierarchy correctly.
- **Yield variance recording:** Production output recording must capture actual yield vs expected. Variances must be tagged with mandatory reason codes for traceability.
- **Ingredient substitution at production order level:** A Kitchen Manager may substitute one ingredient for another on a specific production order without modifying the master recipe — under the warn-and-log model (no approval gate, mirroring the FR67 Pending GR override pattern). The substitute material must be enabled for the consuming production department per the §2.4 enablement rule. A reason code is mandatory at substitution time. The substitution affects only that batch's cost — the master recipe is untouched. Substitutions are captured in the audit trail and surfaced on the Brand Owner override-frequency dashboard so accumulating substitution patterns become operationally visible.

### Pending GR & Provisional Costing — Daily Operational Reality

This is a Tier 1 implementation priority despite Epic 7's Tier 2 classification, because it affects daily operations and crosses Epics 6, 7, and 10.

**Operational Reality:**
- F&B operations frequently receive raw materials and immediately use them in production before the Goods Receipt is fully confirmed in the system.
- Example: tomatoes arrive at 5am, the Pastry Department starts using them at 5:30am, but the Store Manager only logs the formal GR at 9am after inspection.
- Forcing a "must-have-confirmed-GR-before-production" rule breaks daily operations.

**Solution: Pending GR Sub-Status with Provisional Costing**
- A Production Order can be created with a "Pending GR" link — the order proceeds, but cost figures are marked Provisional.
- The Kitchen Manager has an explicit override path to start production using Last Known Price for raw material cost (Option C — warn-and-log model).
- When the linked GR is confirmed, the production order's cost is retrospectively adjusted with the actual price and yield. A variance journal entry is created tagged to both the production order TRN and the GR TRN.

**Provisional Cost Rules:**
- **Price:** Uses Last Known Price — the most recent confirmed GR price for that ingredient
- **Yield:** Uses the standard yield factor from the recipe
- **Provisional flag:** Every cost figure derived from a Pending GR carries a visible **Provisional** flag throughout the system — on the production order, on the Food Cost Control Centre, on the Brand Owner dashboard, and in financial reports
- **Dashboard summary:** The Brand Owner dashboard shows a count of how many production orders currently carry provisional costs

**Retrospective Adjustment on GR Confirmation — Two Distinct Cascades:**

*(a) Master-recipe standard-cost cascade (brand-wide, recipe-scoped):*
- GR confirmation updates Last Known Price for the affected ingredient(s)
- The §2.5 cost cascade fires automatically — every dependent semi-product and final-product master recipe recalculates standard cost figures using the new LKP
- Standard yield used by master recipes is unchanged by this event (master yields are governed by master recipe edits, not by per-GR actuals)

*(b) Per-batch retrospective adjustment (PO-scoped, single batch):*
- Actual price and actual yield from this specific GR replace the provisional figures on the specific production order linked to this Pending GR
- The production order's batch cost is updated
- A variance journal entry is created tagged to both the production order TRN and the GR TRN — a balanced standalone compensating entry per §6.5
- Already-booked downstream COGS journal entries on Dispatch Challans and POS Sales produced from this PO are **not** retro-corrected per-transaction (per the §6.5 transaction immutability rule). The variance journal nets to brand-level COGS at period-end reconciliation; per-DC and per-SA COGS may be under- or over-stated by their share of the variance until then
- The Provisional flag is removed from the production order

**Cross-Epic Dependencies:**
- Epic 7 (Production Planning): provisional cost logic and Pending GR lifecycle
- Epic 6 (Recipe Management): cascade trigger on retrospective adjustment
- Epic 10 (Accounting): variance journal entries on GR confirmation

**Deferred:** Standard cost methodology (budgeted price with purchase price variance tracking) is post-MVP. Holding costs entirely until GR confirmation is not suitable — it creates gaps in daily food cost reporting, which is a stated north star.

### India-Specific Tax & Compliance

- **GST compliance fields:** GSTIN, HSN code, place of supply, tax rates (CGST/SGST/IGST) exist as optional nullable placeholder fields on all financially significant transactions from day one. System never fails on empty fields. Users with appropriate roles can manually fill these in MVP. When full compliance features are built post-MVP, the system writes to the same fields automatically — no duplicate columns ever created.
- **Intra-state vs inter-state tax logic:** Place of supply determines CGST+SGST (intra-state) vs IGST (inter-state). Validation must prevent incorrect combinations (e.g., both CGST and IGST populated simultaneously).
- **E-invoicing placeholder:** IRN field (64-char hash) exists for manual paste from IRP portal in MVP. System-generated via IRP API post-MVP.
- **TDS placeholder:** TDS section, rate, amount, and certificate number fields exist on vendor payment transactions. Editable by Finance role only.
- **E-way bill placeholder:** E-way bill number, validity date, transporter ID, and vehicle number on stock transfers and dispatch challans.
- **Deferred compliance engines:** GST return filing (GSTR-1, GSTR-3B), e-invoicing IRN generation, TDS management, and e-way bill generation are explicitly post-MVP. The placeholder strategy ensures zero schema changes when these features are built.

### Financial Integrity & Auditability

- **Transaction immutability:** Once a transaction reaches "confirmed" or "closed" status, it cannot be edited. Corrections require new compensating documents (credit notes, adjustment entries) with their own TRN.
- **Universal TRN:** Every financially significant transaction gets a typed, unique, human-readable Transaction Reference Number at creation. Format: `{TYPE}-{YYYY}-{LOCATION_CODE}-{SEQUENCE}`. The TRN is immutable, system-generated, and is the single linking key between the ERP and external accounting software.
- **Automated journal entries:** Every confirmed operational transaction auto-generates a journal entry via mapping rules. Triggered by status change to "confirmed." Debits must equal credits (balanced entry validation).
- **Two-stage B2B journal model:** B2B dispatch challans use a two-stage accounting model. Stage 1 fires on dispatch (base value: DR Accounts Receivable, CR Revenue). Stage 2 fires only when GST invoice is confirmed (tax amount: DR Accounts Receivable, CR GST Liability). Both stages carry the same DC TRN.
- **Export-first integration:** The ERP is the system of operational record and the system of management financial reporting (Trial Balance, P&L, Balance Sheet, Cash Flow rendered from the internal journal — see §6 of the Master Specification). External accounting software (Tally/Zoho Books) remains the system of statutory financial record (statutory audit trail, tax filings, regulatory disclosures). No live API adapter in MVP — structured exports keyed on TRN. Fixed column names on exports — no renaming without a `decision-log.md` entry.
- **Append-only audit trail:** Who changed what, when, and why — across all entities. Before/after snapshots for every change. Compliance-ready exports. Financial transaction audit tables are append-only and immutable in MVP — UPDATE and DELETE are blocked at the database level (per §8.2 Audit log integrity rule). Cryptographic hash-chain hardening for full tamper-evidence is a post-MVP enhancement; the §8.2 append-only guarantee is the MVP commitment.

### Multi-Location Data Integrity

- **Mandatory org-scoping:** Every query touching org-scoped data must include a `brand_id` filter. A missing `brand_id` filter is a security vulnerability, not a style issue. Every major table must have a `brand_id` index in its initial migration.
- **Four-level hierarchy on every row:** All org-scoped database tables carry `brand_id`, `cluster_id`, `location_id`, `department_id` as foreign keys. This is non-negotiable from Epic 1 onwards.
- **RLS as defence-in-depth:** Row Level Security policies defined from day one but Express.js business logic is the primary enforcement layer. All API calls use `service_role` key which bypasses RLS. RLS provides a backstop for direct DB access only.

### Operational Continuity

- **Daily rhythm dependency:** This system runs daily operations from 5am to 11pm. Kitchen staff cannot produce without stock levels. Dispatch cannot move goods without challan generation. Finance cannot close without transaction records. Unplanned downtime during operational hours directly impacts revenue.
- **Real-time data requirement:** Stock movements must reflect within 30 seconds. Decisions are made minute-to-minute in kitchen environments. Near-real-time is not acceptable for stock movements.
- **Concurrent multi-location operations:** Multiple locations operate simultaneously. A goods receipt at Cluster Store A and a production order at Central Kitchen B may reference the same raw material. The system must handle concurrent stock operations without data corruption.

### Domain-Specific Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Yield factor miscalculation cascades through recipe hierarchy | Incorrect food costs across all dependent products | Automatic cascade recalculation on any yield factor change; flag affected recipes for review |
| Enablement check skipped in a service method | Wrong materials delivered to wrong department; food safety risk | `checkEnablement()` call enforced before every stock movement at service layer; automated CI/lint rule to detect missing checks at code-review time (mechanism — Hookify or equivalent — TBD in architecture phase) |
| Stock movement recorded but journal entry not generated | Inventory decremented but no financial record; Balance Sheet mismatch | Journal entry generation is atomic with status change to "confirmed" — same database transaction |
| Concurrent stock operations cause race condition | Negative inventory or double-counting | Concurrency-safe stock updates with database-level guarantees (mechanism — row-level locking, optimistic concurrency with version checks, or layered — TBD in architecture phase) |
| B2B challan dispatched but never closed | Accounts Receivable remains open indefinitely | Integration Status Dashboard shows pending challans; aging report flags stale dispatched challans |
| GST fields filled incorrectly (intra/inter-state mismatch) | Tax miscalculation; compliance risk | Validation rule: place_of_supply determines which tax fields are valid; system rejects invalid combinations |
| Location fails to submit daily closing inventory | Next day's opening stock is wrong; production planning cascades incorrectly | Configurable cut-off time alert to Brand Owner; unclosed locations surfaced on dashboard |
| High frequency of production order overrides (Option C) | GR process not keeping pace with kitchen operations; provisional costs accumulating | Override frequency metric on Brand Owner dashboard; operational health indicator |
| Provisional costs not resolved (GR never confirmed) | Financial reports carry stale provisional figures | Aging report for unresolved provisional costs; escalation alert after configurable threshold |

## Vertical ERP — Specific Requirements

### Project-Type Overview

This is a Vertical ERP built as an Internal Operations Platform with multi-tenant readiness. It operates as a monorepo web application (React frontend + Express.js API backend + Supabase PostgreSQL) deployed as a single-tenant instance for MVP. The project-type-specific requirements below cover the tenant model, RBAC matrix, integration architecture, and non-functional requirements that shape the technical implementation.

### Tenant Model

**MVP:** Single-tenant. One brand ("Demo F&B Pvt Ltd" during development, live organisation at go-live). All data belongs to one brand.

**Schema design (from day one):**
- Every org-scoped table carries `brand_id` as a foreign key with an index
- RLS policies defined on every table but not enforced in MVP (Express.js uses `service_role` key)
- No tenant-switching UI, no onboarding flow, no subscription billing in MVP

**Migration path (post-MVP):** When product-market fit is validated, migrate to multi-tenant SaaS. Schema is ready — the migration adds tenant isolation enforcement (RLS activation, tenant-aware routing, onboarding UI), not schema restructuring.

### RBAC Matrix

Role-Based Access Control is mapped to the organisational hierarchy. Each role has a scope (which data they can see) and permissions (what actions they can take).

| Role | Scope | Key Permissions |
|---|---|---|
| **Brand Owner** | All data across entire brand | Full CRUD all modules. Approve high-value transactions. Access all reports. Manage users. Configure system settings. See all override/exception dashboards. |
| **Cluster Manager** | Data within assigned cluster | View/modify cluster data. Approve cluster-level transactions. Access cluster reports. Manage cluster users. See cluster-level overrides. |
| **Kitchen Manager** | Data within assigned kitchen departments | Manage recipes and production orders. View department stock levels. Create material requisitions. Record production output and variances. Override with reason codes (warn-and-log model). |
| **Store Manager** | Data within assigned store | Manage store inventory. Process goods receipts. Fulfill material requisitions. Conduct stock counts. Create Pending GR links on production orders. |
| **Procurement Manager** | Brand-wide procurement data | Create/manage purchase orders. Manage vendor records. View vendor price history and comparison. Process goods receipts. |
| **Finance Manager** | Brand-wide financial data | Access all financial reports. Manage B2B challan GST workflow. Set `gst_invoice_raised` and paste IRN. Create manual journal vouchers. Generate accountant handoff exports. Close periods. |
| **Dispatch Staff** | Data within assigned dispatch department | Manage dispatch orders. Generate internal and B2B challans. Confirm deliveries. Record closing inventory. |
| **POS Staff** | Data within assigned POS location | Record sales data. Manage POS inventory. Conduct closing inventory. Request products from Central Kitchen. |
| **Superadmin** | System-wide across all brands (applicable when the system migrates to multi-tenant) | Approve Brand Owner account creation. Manage brand-level configuration. Access system health dashboards. Perform data corrections not available to Brand Owner. In single-tenant MVP, the Brand Owner has equivalent access. Superadmin is a future-proofing role for multi-tenant migration. |

**Approval thresholds:** Configurable per role via the Unified Approval Engine (Epic 3). Example: POs under ₹50K auto-approved by Cluster Manager; above ₹50K require Brand Owner approval.

**Material enablement:** Operates as a domain-specific access control layer on top of RBAC. A user may have the role permission to create a stock transfer, but the transfer is blocked if the material is not enabled for the target department. Enablement is enforced at the service layer.

**Per-user permission overrides:** In addition to fixed role permissions, the Brand Owner can grant or revoke specific permissions on a per-user basis without modifying the underlying role definition (FR15a). Each user's effective permissions are the union of their role's baseline permissions and any active per-user grants or revocations. Override changes are captured in the audit trail with timestamp, modifying user, and mandatory reason code (FR15c). See User Management & Access Control section for FR15a–FR15c detail.

### Integration Architecture

**Internal Integration (Monorepo):**
- Shared TypeScript types in `packages/shared` — single source of truth for DTOs and interfaces
- Module interface contracts (`inventoryService`, `approvalEngine`, `notificationCenter`, `accountingService`) defined as stable public APIs
- Cross-module communication via service-layer method calls — no message bus in MVP

**External Integration Points:**

| System | Direction | Method | MVP Scope |
|---|---|---|---|
| External Accounting (Tally/Zoho Books) | ERP → External | Structured CSV/Excel exports keyed on TRN | Export-only. No live API adapter. |
| POS System | External → ERP | REST API import | Sales data import, menu item mapping. Integration layer, not replacement. |
| Notification Channels | ERP → External | In-app, Email, SMS, WhatsApp, Push | **MVP scope:** In-app notifications (primary) + Email (secondary). The Notification Center abstraction (Epic 3) is built channel-agnostic so additional channels (SMS, WhatsApp, Push) can be enabled post-MVP without code changes to the abstraction. No SMS, WhatsApp, or Push implementation in MVP. Post-MVP rollout determines which channels to activate based on user demand. |
| UI Design Tool (Stitch or Claude Imagine) | External → Dev | MCP server (`stitch-mcp` if Stitch chosen) or built-in Claude integration | Design-to-code pipeline. Development tooling only — not a runtime integration. Decision deferred to Phase 2c. |
| Supabase | ERP ↔ Supabase | Drizzle ORM + Supabase client | Database, Auth, Realtime subscriptions, Storage. All business logic in Express.js. |
| Barcode/QR Scanner | Device → ERP | Browser API (camera) | Scan-first workflows for goods receipt, stock counting. Progressive Web App capability. |

### Non-Functional Requirements

**Performance:**
- Page load: < 2 seconds for dashboard screens on a 4G mobile connection
- API response: < 500ms for standard CRUD operations; < 2s for complex reports (recipe cost roll-up, food cost calculation)
- Stock level update propagation: < 30 seconds (real-time via Supabase Realtime)
- Concurrent users: support all staff across all locations simultaneously (estimated 20-30 concurrent users at peak)

**Security:**
- Authentication: Supabase Auth (email/password). SSO deferred post-MVP.
- Authorisation: RBAC enforced at Express.js API layer. RLS as defence-in-depth.
- Data encryption: at rest (Supabase managed) and in transit (HTTPS).
- Session management: JWT tokens via Supabase Auth. Configurable session timeout.
- API security: All endpoints require authentication. Rate limiting on public endpoints.

**Scalability:**
- Single-tenant MVP supports one brand with up to 2 clusters, 4+ POS locations, 50+ users
- Schema designed for multi-tenant migration without restructuring
- Database indexing strategy: `brand_id` index on every major table from initial migration

**Accessibility:**
- WCAG 2.1 AA compliance for core workflows (not a hard MVP gate, but a design target)
- Keyboard navigation for all critical actions
- Screen reader compatibility for dashboard and data entry screens
- Responsive design: mobile-first for operational staff, desktop-optimised for management and finance

**Localisation:**
- UI language: English (MVP). Multi-language support is a post-MVP consideration.
- Currency: INR (₹). Multi-currency deferred post-MVP.
- Date/time: IST timezone. Date format: DD/MM/YYYY.
- Number format: Indian numbering system (lakhs, crores) for financial displays.

### Implementation Considerations

**Monorepo Structure:**
- `apps/web` — React frontend
- `apps/api` — Express.js backend
- `packages/shared` — Shared TypeScript types, interfaces, DTOs
- Monorepo tooling (Turborepo vs pnpm workspaces) — open question for architecture phase

**Database Schema Approach:**
- Drizzle ORM with modular schema files (one per domain) to prevent IDE responsiveness degradation
- Migration-first approach — all schema changes via Drizzle migrations
- Seed data matching Master Specification §12 requirements for consistent development and testing

**Development Workflow:**
- All phases conducted in VS Code using Claude Code
- MCP servers / plugins: Supabase (database management), Context7 (library docs); plus `stitch-mcp` only if Google Stitch is chosen as the UI design tool
- Sprint-based execution: one epic at a time, story-by-story
- Fresh Claude Code chat per workflow to manage context window

> **Methodology layer:** The team can layer any AI-assisted development methodology on top of this plan (e.g., Superpowers, BMAD, custom workflow). The phase ordering, epic sequencing, and reference-file conventions in this PRD are the canonical ground truth regardless of methodology choice.

## Project Scoping & Phased Development

### Why "Mile Wide, Inch Deep" for MVP

Every operational role in an F&B business needs at least the basics of every module to do daily work:
- A Kitchen Manager cannot plan production without recipes, inventory visibility, AND production orders.
- A Brand Owner cannot manage the business without dashboards spanning inventory, food cost, sales, and finance.
- A Finance Manager cannot close the books without operational data flowing from procurement, production, and dispatch.

Cutting any module entirely would leave a critical role unable to use the system for daily work — defeating the system's purpose. The "mile wide, inch deep" philosophy gives every role a minimum viable workflow from day one, with depth added iteratively based on actual usage.

The scope discipline is not in which modules to cut — it's in how deep each module goes. The tier system enforces this:
- Tier 1 (Epics 1, 4, 5, 6): deep build — these are the competitive advantage
- Tier 2 (Epics 7, 8, 10): functional but lean — core workflows only, no advanced features
- Tier 3 (Epics 9, 11): minimal viable — enough to be present, not enough to impress
- Core Infrastructure (Epics 2, 3): full depth — every subsequent epic depends on these
- Cross-module (Epic 12): dashboards and reports that make the whole system visible

**Resource Reality:** Solo developer, AI-assisted. One person with Claude Code. This means:
- Sequential epic execution — no parallel workstreams
- Each epic must be complete and tested before the next begins
- Story-level granularity prevents scope creep within epics
- Context management discipline (fresh chat per workflow, `/context` monitoring)

### MVP Feature Set (Phase 1) — All 12 Epics

**Core User Journeys Supported:**
All eight user journeys documented in this PRD are fully supported in MVP: Brand Owner (Darshan), Cluster Manager (Sameer), Kitchen Manager (Priya), Finance Manager (Meera), Dispatch Staff (Ravi), Procurement Manager (Anil), Store Manager (Vikram), POS Staff (Neha).

**Must-Have Capabilities by Epic:**
Detailed in the Product Scope section. The scoping decision is: every capability listed under each epic in that section is a must-have. Nothing is "nice-to-have" within the defined epic scope — the tier system already made that cut.

**Explicit scope boundaries within MVP:**
- No ML forecasting, no weather modelling (Epic 7)
- No route optimisation, no GPS tracking (Epic 8)
- No live API adapter to Tally/Zoho Books (Epic 10)
- No payroll calculation, no performance management (Epic 11)
- No GST return filing, no e-invoicing engine, no TDS engine, no e-way bill engine
- No native mobile apps (PWA covers mobile access)
- No human-to-human messaging (system notifications only)
- Pending GR dual-path and provisional costing ARE in scope (Epic 7) — not deferred

### Post-MVP Features

**Phase 2 — Operational Deepening (Post-launch, based on daily usage):**
- Live API adapter to external accounting software (Tally or Zoho Books — determined by launch customer's choice)
- Standard cost methodology (budgeted price with purchase price variance tracking)
- Advanced credit limit enforcement with automatic order blocking for B2B customers
- Rate contract management with expiry alerts
- Auto-suggest best vendor algorithm
- Full Document & SOP Management module
- Human-to-human messaging (location-to-location chat, shift handover notes)
- ML-based production forecasting (trained on accumulated operational data)
- Custom role builder with module × action × scope permission grids (extends the MVP per-user permission override mechanism in FR15a–FR15c into reusable role templates that the Brand Owner can define, rename, and assign to users at scale)

**Phase 3 — Platform & Compliance (Post product-market-fit validation):**
- Multi-tenant SaaS migration (tenant onboarding, subscription billing, brand isolation UI)
- GST return preparation engine (GSTR-1, GSTR-3B)
- E-invoicing / IRN generation via IRP API
- TDS management engine
- E-way bill generation via NIC portal API
- Native mobile applications (Kitchen, Inventory, Delivery)
- Full Quality Assurance module, Waste Management & Sustainability, CRM, Equipment Management
- Route optimisation and GPS tracking for dispatch
- Advanced predictive analytics across all modules

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Epic 1 schema design error cascades to all downstream epics | Medium | Very High | Architecture phase resolves all schema decisions before implementation. Seed data validates schema against real-world scenarios. |
| Recipe cost cascade performance degrades with scale | Low | High | Index strategy on ingredient-recipe relationships. Cascade runs as background job with Supabase Realtime notification on completion. |
| Concurrent stock operations cause data integrity issues | Medium | High | Database-level locking on stock updates. Optimistic concurrency with version checks. Integration tests for concurrent scenarios. |
| Context window exhaustion during complex story implementation | High | Medium | Story sizing discipline. Fresh chat per workflow. Commit progress before context reaches 60%. |

**Delivery Risks:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo developer velocity lower than estimated | Medium | High | Mile-wide-inch-deep philosophy limits depth per epic. Sequential execution prevents partial work across multiple epics. |
| Burnout at mid-project (Epic 6-7) | Medium | High | Retrospective after each epic. Adjust velocity expectations based on actuals. Epic 12 (Analytics) provides a visible payoff for accumulated work. |
| Scope creep within epics | High | Medium | Story-level acceptance criteria. Formal change-request workflow for any scope change. Post-MVP features list serves as a parking lot. |
| Architecture decisions prove wrong mid-implementation | Low | Very High | All open questions (Master Specification §11) resolved in architecture phase. ADRs document rationale. Formal change-request workflow for plan changes. |

**Contingency — Absolute Last Resort Only:**
If unforeseen delivery risk forces a scope reduction, the only epics that could theoretically slip are Epic 9 (POS Integration) and Epic 11 (HRMS). Even this should be avoided. Epic 12 (Analytics & Reporting) is non-negotiable — the Food Cost Control Centre, multi-location financial reporting, and operational dashboards are core business value.

### Circular Build-Order Dependencies — Architecture Phase Deliverables

The following three circular dependencies must be resolved during the architecture phase before epic sequencing begins:

- **(CD1) Epic 8 (Dispatch) → Epic 10 (Accounting):** Epic 8 fires journal entries but Epic 10 is not built yet. Resolution: the accounting service interface contract (`accountingService.createJournalEntry()`) must be defined and stubbed during Epic 3 (Shared Infrastructure) so Epic 8 can call it safely.
- **(CD2) Epic 4 (Inventory) → Epic 5 (Procurement):** Epic 4 records GRs against POs but Epic 5 is not built yet. Resolution: PO master data structures must be defined in Epic 1 (Master Data) so Epic 4 can reference them.
- **(CD3) Epic 7 (Production) → Epic 10 (Accounting):** Epic 7 uses provisional costing that depends on the accounting ledger. Resolution: the provisional cost flag and retrospective adjustment mechanism is built in Epic 7 with accounting service stubs; the full journal entry fires when Epic 10 is complete and the stub is replaced.

## Functional Requirements

### Organisational & Master Data Management

- **FR1:** Administrators can define and manage the organisational hierarchy (Brand → Clusters → Locations → Departments) with all relationships enforced
- **FR2:** Administrators can register and manage department records including type classification (Production, Non-Production, Store, Dispatch)
- **FR3:** Administrators can register and manage raw materials, semi-products, and final products with product type classification, default UOM, yield factors, shelf life, and category/sub-category assignment
- **FR4:** Administrators can define and manage units of measurement with conversion factors between units (multi-level conversion chains supported)
- **FR5:** Administrators can enable or disable specific raw materials for specific departments, controlling which departments can consume, request, or receive each material
- **FR6:** Administrators can register and manage vendor records including contact information, tax identifiers (GSTIN, PAN), credit terms, product categories supplied, and vendor type (Brand/Cluster/POS level)
- **FR7:** Administrators can register and manage categories and sub-categories with many-to-many mappings
- **FR8:** The system can enforce material enablement rules at the service layer before any stock movement operation
- **FR9:** Administrators can manage company registration details including registered address, tax identifiers, fiscal year settings, and default currency

### User Management & Access Control

- **FR10:** Administrators can create, modify, activate, and deactivate user accounts with role assignment and department mapping
- **FR11:** Users can authenticate via email and password with session management
- **FR12:** The system can enforce role-based access control mapped to the organisational hierarchy, restricting data visibility and actions by role and scope
- **FR13:** The system can enforce material enablement as a domain-specific access control layer on top of RBAC
- **FR14:** Brand Owners can create new users for their brand; Brand Owner accounts require Superadmin approval
- **FR15:** Users can reset their passwords through a self-service workflow
- **FR15a:** Brand Owners can grant or revoke individual permissions on a per-user basis on top of the user's fixed role assignment. Each override records timestamp, modifying user, mandatory reason code, and optional expiry date. Granted permissions add to the user's effective permission set; revoked permissions are removed from it. The fixed role definitions (Brand Owner, Cluster Manager, Kitchen Manager, Store Manager, Procurement Manager, Finance Manager, Dispatch Staff, POS Staff, Superadmin) themselves are not editable in MVP — full custom-role definition with module × action × scope permission grids is deferred to Phase 2.
- **FR15b:** Users and Brand Owners can view a user's effective permission set, showing role-inherited permissions, granted overrides, and revoked overrides as a single consolidated view that makes it explicit what each user can and cannot do at any moment.
- **FR15c:** Permission override changes (grants and revocations) are captured by the tamper-evident audit trail (FR20) and surfaced on the Brand Owner's audit dashboards. Active overrides with future expiry dates appear on a "permission overrides expiring soon" widget so Brand Owners can renew or let lapse before access changes.

### Shared Infrastructure

- **FR16:** The system can route approval requests through configurable approval chains with threshold-based routing and delegation rules for unavailable approvers
- **FR17:** Approvers can view a unified approval inbox across all modules and perform bulk approvals
- **FR18:** The system can send notifications through configurable channels (in-app as MVP priority, email as second priority) with user-configurable preferences
- **FR19:** The system can batch non-urgent notifications into digests and escalate unacknowledged notifications based on timeout rules
- **FR20:** The system can maintain a tamper-evident audit trail recording who changed what, when, and why, with before/after snapshots for every change
- **FR21:** Users can view an activity timeline per entity showing chronological history
- **FR22:** Users can create, assign, track, and resolve internal issue tickets from any module with unique reference numbers, status tracking, and priority assignment
- **FR23:** Brand Owners can broadcast announcements to all locations
- **FR24:** The system can export compliance-ready audit trail data

### Inventory & Stock Management

- **FR25:** Users can view real-time stock levels for any item at any location/department with data freshness within 30 seconds
- **FR26:** Store Managers can record goods receipts against purchase orders or transfer challans, including partial receipts, with barcode/QR scanning support
- **FR27:** Store Managers can apply variable yield factors at goods receipt, with the system recording usable quantity, wastage, and adjusted cost per unit
- **FR28:** The system can enforce three-product-type directional flow rules (raw materials downward only, semi-products lateral within cluster, final products production→dispatch→POS) at the service layer
- **FR29:** Users can create and process stock transfers between locations/departments with enablement and flow rule validation
- **FR30:** The system can track expiry dates on perishable items and surface expiry countdown dashboards with 24h/48h/72h urgency bands
- **FR31:** The system can enforce FEFO (First Expiry, First Out) prioritisation in material selection for production
- **FR32:** The system can suggest cross-location transfers when stock approaches expiry at one location but can be consumed at another
- **FR33:** Administrators can define PAR levels by item and location with day-of-week adjustments
- **FR34:** The system can flag items below PAR level and suggest reorder quantities
- **FR35:** Users can perform physical closing inventory for final products at POS and Dispatch departments daily, with mandatory reason codes for variances
- **FR36:** The system can surface locations that have not submitted closing inventory by a configurable cut-off time and alert the Brand Owner
- **FR37:** Users can record inventory adjustments with mandatory reason codes and approval workflows
- **FR38:** The system can enforce shelf-life acceptance rules at goods receipt, flagging items below minimum remaining shelf-life thresholds
- **FR39:** Users can attach files (photos, documents) to goods receipt records

### Procurement & Vendor Management

- **FR40:** Users can create purchase orders (all items, category-wise, vendor-wise) with PAR-based quantity suggestions
- **FR41:** The system can route purchase orders through the approval engine based on configurable value thresholds
- **FR42:** Users can track purchase order status through the full lifecycle (created → approved → sent to vendor → partially received → fully received → closed)
- **FR43:** Users can view side-by-side vendor price comparison per item with historical price tracking
- **FR44:** Users can distribute purchase orders to vendors via PDF generation
- **FR45:** Users can create recurring purchase order templates
- **FR46:** The system can detect and alert on vendor price spikes compared to historical averages
- **FR47:** Users can manage vendor performance ratings and preferred vendor flagging

### Recipe Management

- **FR48:** Users can create and manage recipes with ingredients (raw materials and semi-products), quantities, UOM, preparation instructions, and yield information
- **FR49:** The system can maintain multiple versions per recipe with a designated default version, version comparison, and version history
- **FR50:** Users can designate a recipe version as the new default with approval workflow
- **FR51:** The system can calculate recipe costs based on current ingredient prices and yield factors, with automatic recalculation when prices or yields change
- **FR52:** The system can cascade cost changes through the recipe hierarchy — raw material cost changes propagate through semi-product recipes to final product recipes automatically
- **FR53:** Users can scale recipes to different batch sizes with automatic ingredient quantity adjustment
- **FR54:** Users can create sub-recipes (component recipes) that are referenced as ingredients in parent recipes
- **FR55:** Users can categorise and tag recipes with multi-dimensional classification (dietary, allergen, seasonal, complexity)
- **FR56:** Users can simulate recipe cost impact from ingredient price changes before committing

### Production Planning

- **FR57:** Users can create production orders driven by recipes, specifying batch size, target department, and scheduled date
- **FR58:** The system defaults to the current default recipe version on production order creation, with a warning requiring confirmation if a non-default version is selected
- **FR59:** The system can check ingredient availability and enablement at production order creation using the warn-and-log model (red warnings for critical ingredients, yellow warnings for non-critical, override with reason code always available)
- **FR60:** Users can create partial production orders when stock is insufficient, with the system showing maximum producible quantity
- **FR61:** Users can record ingredient substitutions on a production order with reason codes, affecting batch cost only (not master recipe)
- **FR62:** Kitchen Managers can override enablement or stock warnings with reason codes, with all overrides permanently logged and visible on management dashboards
- **FR63:** Kitchen Managers can raise enablement requests for systematic fixes or use emergency overrides for immediate unblocking
- **FR64:** Store Managers can create Pending GR links on production orders, moving them to Pending GR sub-status that auto-progresses when the linked GR is confirmed
- **FR65:** Kitchen Managers can override unconfirmed GR situations with reason codes, proceeding immediately while notifying the Store Manager
- **FR66:** The system can use Last Known Price and standard yield factor as provisional costs for Pending GR production orders, with a visible Provisional flag throughout the system
- **FR67:** The system can perform retrospective cost adjustment when a linked GR is confirmed, replacing provisional figures with actuals and creating a tagged variance entry
- **FR68:** The system can deduct raw materials from department inventory when a production order transitions to In Progress status (not at Confirmed status), using `inventoryService.deductStock()`. The full lifecycle is: Draft → Pending GR (no deduction) → Confirmed (no deduction yet — order is confirmed but not started) → In Progress (deduction fires) → Completed. This ensures that a production order in Pending GR sub-status or in Confirmed status does not prematurely decrement inventory. The Kitchen Manager explicitly starts the production order (moves to In Progress) which triggers deduction
- **FR69:** Users can record production output with actual yield versus expected, with variance recording and mandatory reason codes
- **FR70:** The Brand Owner dashboard can display override frequency metrics (Option C vs Option A usage) and provisional cost counts as operational health indicators

### Dispatch & Distribution

- **FR71:** Users can create internal dispatch challans from production departments to POS locations with item quantities and delivery confirmation
- **FR72:** Users can create B2B dispatch challans for external business customers with items, quantities, rates, and B2B customer reference
- **FR73:** Administrators can manage B2B customer master records (name, address, GSTIN, credit terms, contact, status, system-generated customer code in format `CUST-{SEQUENCE}` auto-assigned at creation, GST registration type as enum: Regular / Composition / Unregistered / Consumer). GST registration type is required for edge case validation — if a customer with Unregistered or Consumer registration type requests a GST invoice, the system must show a warning and require a mandatory reason code override before Finance Manager can set `gst_invoice_raised = true`
- **FR74:** The system can enforce the complete B2B challan lifecycle with inventory decrement only at Dispatched status. The lifecycle statuses are: Draft → Dispatched → Delivered → Closed — GST Invoiced (Stage 2 journal fires) OR Closed — No GST Invoice (Stage 1 only, no Stage 2). Additional terminal statuses: Cancelled (valid only from Draft — clean no-op, no inventory or accounting impact) and Closed — Returned (for dispute scenario where customer refuses delivery, full credit note raised, stock reinstated). The two distinct Closed statuses (Closed — GST Invoiced vs Closed — No GST Invoice) are what determines whether Stage 2 of the two-stage B2B journal model fires — this distinction must be explicit in the challan state machine
- **FR75:** The system can generate TRNs for dispatch challans (`DC-YYYY-LOC-SEQ`) at Dispatched status and credit notes (`CN-YYYY-LOC-SEQ`) at creation. The CN TRN must store a mandatory reference to the original DC TRN it is reversing. This cross-reference must appear on the credit note document and in all exports
- **FR76:** Receiving staff can confirm delivery digitally with quantity verification, updating inventory at both dispatch and receiving locations
- **FR77:** Users can perform daily physical closing inventory at Dispatch and POS departments for final products with variance recording
- **FR78:** Finance Managers can fill GST placeholder fields on B2B challans and set `gst_invoice_raised` with IRN atomically
- **FR79:** Users can create credit notes against dispatched challans for full or partial returns, with stock reinstatement and conditional two-stage reversal logic. When a credit note is raised against a B2B challan, the system must check `gst_invoice_raised` on the source challan. If true, the credit note must reverse BOTH Stage 1 (base value: DR Revenue, CR Accounts Receivable) AND Stage 2 (tax amount: DR GST Liability, CR Accounts Receivable). If false, the credit note reverses Stage 1 only. Both reversal entries carry the CN TRN referencing the original DC TRN
- **FR80:** The system can validate that cumulative credit note values do not exceed the original challan value
- **FR81:** Users can attach files to dispatch challan records
- **FR82:** The system can generate challan PDFs for printing/sharing

### POS Integration

- **FR83:** Administrators can map menu items to recipes, linking POS sales to recipe-based inventory consumption
- **FR84:** The system can import sales data from external POS systems via REST API
- **FR85:** The system can calculate inventory impact from sales transactions based on recipe-to-menu-item mappings
- **FR86:** Users can manage menu item availability and pricing within the ERP

### Accounting & Financial

- **FR87:** The system can generate a Universal Transaction Reference Number (TRN) for every financially significant transaction at creation, with the TRN being immutable and human-readable
- **FR88:** Administrators can configure a simplified, F&B-focused Chart of Accounts with the following minimum default account structure pre-seeded at launch. Assets: Inventory — Raw Materials, Inventory — Semi-Products, Inventory — Final Products, Accounts Receivable — B2B Customers, Cash and Bank. Liabilities: Accounts Payable — Vendors, GST Liability — Output. Revenue: Revenue — Internal Dispatch, Revenue — B2B Sales. Cost of Goods Sold: Raw Material Consumption, Production Labour Cost. Expenses: Wastage and Write-offs, Overhead — Kitchen, Overhead — Packaging. The architecture phase will define the full CoA with account codes and hierarchy. The PRD establishes the minimum named accounts referenced by the journal mapping rules
- **FR89:** The system can auto-generate balanced journal entries (debits = credits) for every confirmed operational transaction via configurable mapping rules. Each journal mapping rule consists of: trigger event (the transaction type and status change that fires it, e.g. "Purchase Order confirmed"), debit account (account name from CoA), credit account (account name from CoA), amount formula (e.g. "total_amount excluding tax"), and conditions (e.g. "only if `gst_invoice_raised = true`"). PO confirmation is an operational commitment only — no journal entry fires (the financially significant event is the Goods Receipt). The minimum set of mapping rules pre-configured at launch: GR confirmed (DR Inventory — Raw Materials, CR Accounts Payable), Production Order moved to In Progress (DR COGS — Raw Material Consumption, CR Inventory — Raw Materials — fires at the same transition as `inventoryService.deductStock()` per FR68), Internal Dispatch confirmed (inventory movement only, no journal), B2B Challan dispatched — Stage 1 (DR Accounts Receivable, CR Revenue — B2B Sales), B2B Challan — Stage 2 GST invoice confirmed (DR Accounts Receivable, CR GST Liability), Credit Note created (reversal of source challan entries per FR79 conditional logic), Sales import confirmed (DR Cash/Bank, CR Revenue — Internal Dispatch). The architecture phase will define the full mapping rule engine implementation
- **FR90:** The system can maintain an internal ledger as the source of truth for all financial reports, with period-based, multi-dimensional balances (by location, department)
- **FR91:** Finance Managers can generate Trial Balance, P&L Statement, Balance Sheet, and Cash Flow Statement from the internal journal, filterable by period, location, and cluster. The Cash Flow Statement uses the indirect method — the standard method used by Indian businesses and CAs — starting from net profit and adjusting for non-cash items and working capital changes. The architecture phase will define the specific line items and adjustments
- **FR92:** The system can execute the two-stage B2B journal model — Stage 1 on dispatch (base value AR/Revenue), Stage 2 on GST invoice confirmation (tax amount AR/GST Liability)
- **FR93:** Users can capture and validate Daily Sales Reports by location with sales categories, settlement modes, and expense categories
- **FR94:** Users can create and track budgets by cluster, location, and department with Budget vs Actual variance reporting
- **FR95:** The Food Cost Control Centre can display theoretical vs actual food cost per item, menu engineering matrix, and vendor price tracking with alerts
- **FR96:** Finance Managers can generate structured accountant handoff exports (Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost) with fixed column names keyed on TRN. The export engine supports three target formats simultaneously, selectable by the user: (1) **Tally format** — exports structured as Tally-compatible XML or CSV with column names and field mappings matching TallyPrime import specifications, (2) **Zoho Books format** — exports structured as Zoho Books-compatible CSV with column names and field mappings matching Zoho Books import specifications, (3) **Generic CSV format** — a universal option with human-readable column names for organisations using neither Tally nor Zoho Books, or for ad-hoc analysis. The organisation-level default target format is set in system configuration (configurable by Brand Owner or Finance Manager). Individual export sessions can override the default. The selected format is recorded in the export history log alongside who exported and when. Within each format, column names are fixed and documented — an accountant configures their import mapping once and it works for every subsequent export. Column names must not change between exports of the same format without a `decision-log.md` entry and accountant notification. Vendor AP Aging: vendor-wise outstanding payables with aging buckets (0-30, 31-60, 61-90, 90+ days), keyed on TRN. Customer AR Aging: B2B customer-wise outstanding receivables with aging buckets (0-30, 31-60, 61-90, 90+ days), keyed on DC TRN. Bank Reconciliation is excluded — the system has no bank transaction data; bank reconciliation is handled entirely in Tally or Zoho Books using the Transaction Journal Export as input. The export engine architecture must be designed as a format-agnostic data layer with pluggable format renderers — one renderer per target system. Adding a new accounting software format post-MVP (e.g. QuickBooks) requires only a new renderer, not changes to the data layer. This is an architecture phase deliverable — the PRD specifies the requirement, the architecture specifies the implementation pattern and produces the column name mapping specifications for each format
- **FR97:** The system can maintain compliance placeholder fields (GST, e-invoicing, TDS, e-way bill) as optional nullable fields on relevant transactions, editable by authorised roles
- **FR98:** Finance Managers can view an Integration Status Dashboard showing export status, pending transactions, and last export date per type
- **FR99:** Finance Managers can create manual journal vouchers with their own TRN for adjustments not covered by automated entries

### HR & Workforce

- **FR100:** Administrators can manage employee records including personal details, employment information, department and role assignments, and location mapping
- **FR101:** The system can track basic employee attendance (time in/out, absences, leave balance)
- **FR102:** Administrators can create shift definitions and assign shifts to employees by role and location
- **FR103:** Users can view duty rosters and shift schedules

### Analytics, Reporting & Dashboards

- **FR104:** Each role can view a personalised morning briefing dashboard showing role-specific actionable information at login
- **FR105:** Brand Owners can view cross-location dashboards showing food cost %, stock value, daily sales, variance flags, pending approvals, override frequency, and provisional cost counts
- **FR106:** The system can generate standard operational reports (purchase, inventory, food cost, production, wastage, closing, dispatch, sales, accounting, HR)
- **FR107:** Users can export reports in CSV, Excel, and PDF formats
- **FR108:** The Food Cost Control Centre can display theoretical vs actual food cost per item sold, menu engineering matrix (Stars/Puzzles/Plowhorses/Dogs), and real-time cost per serving tracking
- **FR109:** Users can drill down from summary dashboards to detailed transaction-level data
- **FR110:** The system can detect and alert on unusual activity (wastage spikes, vendor price jumps, variance patterns) using rule-based logic
- **FR111:** The system can generate PAR level drift detection reports with update recommendations based on consumption patterns

### Data Quality & Entry Safeguards

- **FR112:** The system can accept voice input for quantity fields during goods receipt and production output recording, for kitchen and store environments where hands may be unavailable. Scoped to quantity fields only — not a full voice interface. Implementation depth (Web Speech API vs third-party) determined during architecture.
- **FR113:** Forms can pre-fill from the most recent equivalent entry where applicable — yesterday's closing inventory quantities, last GR quantities for the same vendor/items, PAR levels as default request quantities on material requisitions. Users can override any pre-filled value before submitting.
- **FR114:** The system can flag entries where quantities are physically implausible — a goods receipt quantity more than 150% of the PO quantity, a production output quantity greater than the theoretical maximum from available raw materials, a closing inventory quantity greater than opening stock plus receipts minus dispatches. Flagged entries show a warning requiring reason code override to proceed, consistent with the warn-and-log model.
- **FR115:** The system can detect and warn on likely duplicate entries — a GR being created against a PO that already has a completed GR for the same items and quantities within the same day, a dispatch challan being generated for a production order that was already fully dispatched. Duplicate detection shows a warning with the conflicting record reference. Users can confirm and proceed with a reason code if the entry is legitimate.
- **FR116:** The system can automatically flag cross-module inconsistencies — a raw material deactivated in master data while still present as an active ingredient in a published recipe version, a vendor deactivated while having open purchase orders, a department deactivated while having enabled materials. Inconsistencies are surfaced on the Brand Owner and relevant manager dashboards as data quality alerts requiring resolution.
- **FR117:** Users can reverse or cancel a transaction before it reaches confirmed status — a Draft or Pending GR production order can be cancelled cleanly with no inventory or accounting impact. Once a transaction is confirmed, the correction path is always a compensating document (credit note, adjustment entry, reversal journal) with its own TRN. No direct edit or delete on confirmed transactions. Undo applies only to pre-confirmation states.
- **FR118:** The system must validate that GST tax field combinations are consistent with the place of supply. If the dispatching location's state matches the place of supply state (intra-state), only CGST and SGST fields are valid — IGST must be null. If they differ (inter-state), only IGST is valid — CGST and SGST must be null. The system must reject saves where an invalid combination is entered and display a clear error message identifying the conflicting fields.
- **FR119:** When a Finance Manager attempts to set `gst_invoice_raised = true` on a B2B challan for a customer whose GST registration type is Unregistered or Consumer, the system must display a warning: "This customer is not GST-registered. Raising a GST invoice may not be legally valid." The Finance Manager can proceed with a mandatory reason code entry. This override is logged and visible on the Brand Owner dashboard.

## Non-Functional Requirements

> **Note:** Performance, Security, Scalability, Accessibility, and Localisation targets are defined in the Vertical ERP Specific Requirements section. This section covers additional quality attributes.

### Reliability & Availability

- **Uptime:** 99.5% minimum during operational hours (5am-11pm IST). Measured monthly.
- **Maintenance window:** 1am-5am IST (4 hours). Scheduled maintenance must not extend beyond this window.
- **Unplanned downtime:** Maximum 30 minutes per incident during operational hours before escalation. No data loss on any unplanned outage.
- **Data durability:** Zero tolerance for transaction data loss. Every confirmed transaction must survive any single point of failure. Supabase managed PostgreSQL provides this via WAL and point-in-time recovery.
- **Graceful degradation:** If Supabase Realtime is temporarily unavailable, the system must continue to function for write operations. Dashboard freshness may degrade but transactional workflows must not block.

### Observability & Monitoring

- **Error tracking:** All unhandled errors captured in Sentry with full stack trace, user context, and request context. Alert on error rate spikes.
- **API monitoring:** Response time tracking on all endpoints. Alert when P95 latency exceeds 1 second for standard CRUD or 5 seconds for report generation.
- **Business metric monitoring:** Daily closing inventory submission rate, override frequency, provisional cost aging, pending approval queue depth — surfaced on Brand Owner dashboard and available as system health metrics.
- **Audit log integrity:** Audit trail entries must be append-only. No UPDATE or DELETE operations on audit tables. Verified via database-level constraints.

### Data Management

- **Backup:** Supabase managed daily backups with point-in-time recovery. Minimum 7-day retention for MVP.
- **Data retention:** Operational data retained indefinitely in MVP. Archival strategy (moving historical data to cold storage) is a post-MVP consideration when data volume warrants it.
- **Data export:** Full data export capability in CSV and JSON formats for portability. Users can export any report, any register, and any transaction list.
- **Concurrent data access:** Multiple users can read and write to the same module simultaneously without data corruption. Stock level updates must be concurrency-safe with database-level guarantees (mechanism — row-level locking, optimistic concurrency with version checks, or layered — TBD in architecture phase; consistent with §6.8 domain risk mitigation).

### Browser & Device Compatibility

- **Browsers:** Chrome (latest 2 versions), Safari (latest 2 versions), Firefox (latest 2 versions), Edge (latest 2 versions). Chrome is the primary target.
- **Devices:** Desktop (1280px+), tablet (768px-1279px), mobile (320px-767px). Mobile-first design for operational staff workflows (goods receipt, dispatch, closing inventory, production recording). Desktop-optimised for management and finance workflows (dashboards, reports, financial statements).
- **Offline capability:** Depth determined during architecture phase (open question #4 in Master Specification §11). At minimum, the application must show a clear offline indicator and queue user actions for sync when connectivity is restored, rather than silently failing.

### Deployment & DevOps

- **CI/CD:** GitHub Actions for linting, type-checking, and test execution on every push. No merge to main without passing CI.
- **Environment strategy:** Development → Staging → Production. Staging mirrors production configuration.
- **Deployment:** Zero-downtime deployments for frontend (Vercel). Backend deployment strategy (Railway/Render/Fly.io) determined in architecture phase.
- **Rollback:** Ability to roll back to the previous deployment within 5 minutes if a critical issue is detected post-deploy.

## Pre-Implementation Gate — Open Questions Requiring Architecture Phase Resolution

The following open questions from Master Specification §11 must be resolved and documented in the Architecture Document before implementation of any epic can begin:

1. **Monorepo tooling:** Turborepo vs pnpm workspaces vs Nx — determines build pipeline, caching strategy, and CI configuration.
2. **Backend deployment target:** Railway vs Render vs Fly.io — determines containerisation approach, scaling model, and deployment pipeline.
3. **Real-time strategy:** Supabase Realtime (DB changes) vs WebSockets (application events) vs hybrid — determines how stock level updates, notifications, and dashboard refreshes propagate.
4. **Offline capability depth:** Service worker scope, local storage strategy, sync conflict resolution — determines whether operational staff can continue working during connectivity interruptions and how data reconciles on reconnection.
5. **PDF generation library:** Server-side (Puppeteer, pdfkit) vs client-side (jsPDF, react-pdf) — determines where challan, PO, and report PDFs are generated and how they handle templates and localisation.
6. **Full-text search strategy:** PostgreSQL full-text search vs Supabase pg_trgm vs external service (Meilisearch) — determines search UX for materials, recipes, vendors, and transactions.
7. **Background job engine:** pg_cron vs BullMQ vs Supabase Edge Functions on schedule — determines how recipe cost cascades, provisional cost aging checks, notification digests, and PAR level recalculations execute.
8. **Caching layer:** In-memory (Node.js) vs Redis vs Supabase CDN — determines response time for dashboards, CoA lookups, and frequently accessed master data.
9. **UI design tool selection:** Google Stitch vs Claude Imagine/Artifacts vs hybrid — see Master Specification §3.3 for full discussion. Decision can be made at the start of Phase 2c (Visual Design); architecture must accommodate either.
10. **Accountant export format mapping:** ✅ RESOLVED in PRD (FR96). Both Tally and Zoho Books are supported simultaneously from MVP via the dual-format export engine with pluggable renderers. The architecture phase must produce the column name mapping specifications for each format (Tally, Zoho Books, Generic CSV) — this is the remaining deliverable. The choice of which system the launch customer's accountant uses no longer gates architecture decisions.

**Gate rule:** Implementation of any epic cannot begin until all open questions are resolved and documented in the Architecture Document. OQ10 is resolved at the PRD level — the remaining 9 require architecture phase resolution (or Phase 2c resolution for OQ9).

---

*End of Document · F&B ERP Product Requirements · April 2026*
