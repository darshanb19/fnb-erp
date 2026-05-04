Perfect. Now I have everything I need. Let me create the comprehensive digest report:

---

## PHASE 2B SCREEN INVENTORY INPUT — STRUCTURED SYNTHESIS DIGEST

**Synthesis Date:** 2026-05-04  
**Source Documents:**  
- `_planning/03-prd.md` (834 lines, FR1–FR119 + FR15a/b/c, FR47a, FR47b, FR67a)
- `_planning/prd-review-notes.md` (669 lines, Phase 2a consolidation)
- `_planning/04-b2b-challan-spec.md` (372 lines, Epic 8 supplement)
- `DESIGN.md` (972 lines, design system tokens & patterns)

---

## SECTION A — ALL 8 USER JOURNEYS: JOURNEY MOMENTS BY ROLE

### Journey 1: Darshan — Brand Owner

- **Morning dashboard review** (FR104, FR105, FR70): Views cross-location sales, food cost %, raw material stock value, pending approvals above threshold, variance flags, override frequency metrics, provisional cost counts, Pending-GR resolution outcomes, expiring permission overrides, cross-module data quality alerts
- **Variance investigation & assignment** (FR105, FR22): Drills into variance report (e.g., closing inventory deviation), assigns investigation to Cluster Manager via issue tracker
- **Purchase order approval** (FR16, FR41, FR40, FR43): Reviews two POs above ₹50K threshold; pulls vendor price history before approval
- **Cross-location drill-down & scope persistence** (FR105): Adapts dashboard to selected scope (single location, cluster, or brand-wide); system persists choice across sessions
- **Override pattern monitoring** (FR70, FR70 amendment, P2B-005): Reviews override frequency metrics on dashboard (Pending GR overrides + ingredient substitutions); surfaces as count and rate (per 100 production orders)
- **Pending-GR resolution outcomes review** (FR70 amendment, implicit Phase 2b item): Drills from dashboard pane into rejected GR + linked PO + reclassification journal to investigate vendor quality issues

### Journey 2: Sameer — Cluster Manager

- **Cluster-scoped morning briefing** (FR104): Views 4 material requisitions pending approval, 2 auto-approved POs for review, 1 Kitchen Manager override flagged, 1 variance investigation assigned by Brand Owner, 1 cross-cluster surplus alert (Cluster B tomatoes expiring in 48h)
- **Unified approval inbox with bulk approval** (FR17): Clears 3 routine material requisitions in bulk action; confirms 1 unusual semi-product transfer with Kitchen Manager call
- **Kitchen Manager override visibility** (FR62): Reviews Priya's override from yesterday with reason-code ("tomatoes arrived 5am, started prep before GR confirmed at 9am"); tags for epic retrospective
- **Variance investigation drill-down** (FR25, FR29, FR84, FR85, FR35): Pulls up POS-AB sandwich variance; drills through production output → dispatch challans → POS receipts → POS sales → closing inventory count; traces 0.8kg discrepancy to rushed recount
- **Issue tracker assignment & resolution** (FR22): Records findings on variance; updates status within 4 hours; calls POS-AB manager for photo-evidence recount
- **Cross-cluster reallocation initiation** (P2B-002): Initiates paired Brand-Store-routed transfer bundle (return Cluster B tomatoes to Brand Store + draw into Cluster A Store); escalates single approval object to Brand Owner
- **Expiry-driven cross-location intelligence** (FR32, FR30): Receives Cluster B tomato expiry alert; checks Cluster A consumption capacity; evaluates within-cluster absorption before escalating to Brand Owner for cross-cluster approval

### Journey 3: Priya — Kitchen Manager

- **Morning briefing dashboard** (FR104): Views real-time stock levels, 3 items below PAR, 2 pending production orders, expiry warning (cream expires in 48h)
- **Production planning against real-time availability** (FR57, FR59): Pulls production planning screen; checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves
- **Partial production order creation** (FR60): Finds flour short; scales bread order down to 4 runs; creates material requisition for shortfall
- **FEFO prioritisation** (FR31, FR37): Prioritises expiring cream (48h band) into today's pastry cream batch; material selection auto-ordered by system
- **Pending GR override under warn-and-log** (FR65, FR62): Can override unconfirmed GR situations with reason code; proceeds immediately with notification to Store Manager
- **Ingredient substitution at production order level** (FR61): Can substitute ingredient on specific batch (warn-and-log); mandatory reason code; enablement check on substitute; audit trail capture; affects batch cost only; surfaced on Brand Owner override-frequency dashboard
- **Production output recording** (FR69, FR35): Records actual yield vs expected; tags variance with mandatory reason code; system captures variance traceability

### Journey 4: Meera — Finance Manager

- **Month-end financial snapshot** (FR90, FR91): Opens Finance dashboard; sees all transactions from previous month already recorded with TRNs; automated journal entries generated; Trial Balance already available
- **Trial Balance review** (FR91): Validates revenue matches daily sales reports; COGS aligns with production consumption; AP matches Purchase Register
- **B2B challan GST workflow — Stage 2 initiation** (FR78, FR92): Identifies 3 B2B challans in "Delivered" status needing GST invoice confirmation; downloads Sales Register export (FR96); sends to accountant for external GST invoice generation in Tally
- **IRN paste & Stage 2 journal trigger** (FR78, FR92): Receives IRNs from accountant for 2 challans; pastes IRNs into challan records; sets `gst_invoice_raised = true`; Stage 2 journal entries fire automatically; AR balance increments with tax amount
- **B2B challan closure without GST invoice** (FR74): Closes third challan with `gst_invoice_raised = false` (unregistered customer); Stage 1 only, no Stage 2
- **Credit note creation with conditional two-stage reversal** (FR79): Customer dispute arrives; creates Credit Note for partial return (1 of 6 croissant batches); system checks source challan's `gst_invoice_raised` flag; reversal fires on Stage 1 only (no GST invoice on source); stock reinstated at originating department
- **Integration Status Dashboard review** (FR98): Checks daily Integration Status Dashboard for export status, pending transactions, last export date per type; visibility into handoff pipeline
- **Financial statement generation** (FR91): Generates P&L, Balance Sheet, Cash Flow Statement from internal journal; reviews, validates, closes month within 2 working days

### Journey 5: Ravi — Dispatch Staff

- **Dispatch order visibility** (FR71, FR72): Opens dispatch screen on mobile; sees 2 internal dispatch orders (POS-AA, POS-AB) + 1 B2B challan (Sunrise Cafe)
- **Internal challan generation** (FR71): Confirms quantities against production output; generates internal challans for POS-AA and POS-AB; stock decremented from Dispatch department; loads vehicle
- **Digital delivery confirmation — receiving** (FR76): At POS-AA, receiving staff opens internal challan on phone, verifies quantities, confirms receipt digitally; inventory updates simultaneously at both ends
- **B2B challan dispatch & Stage 1 journal trigger** (FR72, FR74, FR92): Confirms dispatch on B2B challan for Sunrise Cafe; status moves to "Dispatched"; DC TRN generated (`DC-2026-CKA-000045`); Stage 1 journal entry fires (DR Accounts Receivable, CR Revenue — B2B Sales)
- **B2B delivery confirmation** (FR76): Delivers to customer; customer signs off digitally; status moves to "Delivered"
- **Daily closing inventory** (FR77, FR35): At end of day, performs physical closing inventory of Dispatch department; system shows expected quantities (production received − dispatched); actual vs expected reconciliation; tags variance with reason code

### Journey 6: Anil — Procurement Manager

- **Morning dashboard** (FR40, FR34, FR43, FR46): Views 5 items below PAR across 3 locations, 2 POs pending Brand Owner approval, yesterday's GR summary (3 processed, 1 with yield variance flag on tomatoes), vendor price alert (Vendor B butter price +8%)
- **Purchase order creation with PAR-based suggestions** (FR40): Creates PO for below-PAR items; system suggests quantities based on PAR levels minus current stock
- **Vendor price comparison before selection** (FR43): Pulls vendor price comparison for flour; reviews 3-month history for Vendor A vs Vendor B; selects based on price + quality rating
- **PO approval routing** (FR41): Routes PO under ₹50K to Cluster Manager; auto-approval within the system
- **Goods receipt with yield factor application** (FR27): Store Manager records GR for 100kg tomatoes; enters yield factor 0.82 (lower than standard 0.85); system records 82kg usable, 18kg wastage; adjusted cost per kg recalculated
- **Yield-to-recipe cost cascade** (FR52): System flags "Yield factor deviation on tomatoes — recipe costs affected for 3 recipes"; Anil confirms yield update; recipe costs cascade automatically through all dependent recipes
- **Vendor price spike monitoring** (FR46): Observes Vendor B butter price increased 15% over 6 months; compares with Vendor C (stable pricing); flags for next procurement cycle
- **Food Cost Control Centre impact visibility** (FR95): Sees butter cost increase will push pastry food cost from 31% to 33% if unchanged; uses this data for vendor negotiation decisions

### Journey 7: Vikram — Store Manager

- **Morning store management screen** (FR25): Views real-time stock levels for 45 raw materials in Cluster Store A; 3 items flagged with expiry within 72h; 2 pending material requisitions from departments; 1 expected PO delivery today
- **Material requisition processing with enablement check** (FR29, FR8): Approves Pastry requisition (25kg flour, 10kg butter); system checks enablement for both items; requisition routes with approval workflow
- **Partial fulfillment handling** (FR29): Bakery requests 5kg cocoa powder but only 3kg in stock; fulfills 3kg; notes shortfall for Procurement Manager
- **Goods receipt against transfer challan** (FR26): Records GR from Brand Store transfer (200kg mixed items); verifies quantities item-by-item using batch entry screen; captures expiry date for each item; system slots items into FEFO order automatically
- **Barcode/QR scanning support** (FR26): Uses mobile barcode scanner to populate GR details; fast entry at receiving
- **Stock visibility enablement for downstream departments** (FR25): Stock position is accurate and visible to every department within 30 seconds of movement completion; supports dependent planning without phone calls

### Journey 8: Neha — POS Staff

- **POS-scoped morning dashboard** (FR104): Views yesterday's sales auto-imported from POS system (₹1.1L across 142 transactions); yesterday's closing inventory confirmed and locked; today's expected dispatch from Central Kitchen A (4 cakes + 12 croissants); expiry-band notification (2 croissants within 24h expiry, mark as "sell first")
- **Digital dispatch receipt confirmation** (FR76): At 11:35am, receives internal challan from Ravi; verifies items match; confirms receipt digitally in <30 seconds; POS-AA inventory auto-increments
- **Expiry-band sell-first prioritisation** (FR30, FR35): Tags 2 expiring croissants; they appear at top of menu display; promoted for sale before regular items
- **Sales auto-import with recipe-driven inventory deduction** (FR84, FR85): Through the day, sales flow in from POS system; ERP imports near-real-time; each sale's recipe-driven inventory consumption auto-deducts from POS-AA inventory; no manual decrement
- **Discount variance flagging** (FR22): Notices a transaction with discount not matching published policy; tags for issue tracker; Cluster Manager will review
- **Daily closing inventory routine** (FR35): At 9pm, runs closing inventory on phone; system shows expected end-of-day stock (opening + received − sold − wasted); scans/counts actual items; most items match; cocoa-dust pastries show 2 missing (1 customer sample no-purchase, 1 dropped wastage); tags each with mandatory reason code; submits before cut-off
- **Next-day product request** (FR57, FR34): Submits next-day product request to Central Kitchen A (bread loaves running thin, forecast busy); request lands in Priya's morning briefing for production planning

---

## SECTION B — ALL FRs GROUPED BY EPIC WITH UI SURFACE FLAG

### Epic 1: Master Data Management (FR1–FR9)

| FR | Summary | UI Surface |
|---|---|---|
| **FR1** | Define and manage organisational hierarchy (Brand → Clusters → Locations → Departments) | Yes |
| **FR2** | Register and manage department records with type classification (Production / Non-Production); Stores as separate units; Dispatch as Non-Production sub-category | Yes |
| **FR3** | Register raw / semi / final products with type, default UOM, default standard yield factor, shelf life, category assignment | Yes |
| **FR4** | Define UOM with multi-level conversion factors | Yes |
| **FR5** | Enable/disable specific raw materials for specific departments (material enablement) | Yes |
| **FR6** | Register vendor records with contact, tax IDs, credit terms, product categories, scope (Brand/Cluster/POS level) | Yes |
| **FR7** | Register categories and sub-categories with many-to-many mappings | Yes |
| **FR8** | Enforce material enablement rules at service layer before stock movement | No (backend only) |
| **FR9** | Manage company registration details (address, tax IDs, fiscal year, currency) | Yes |

### Epic 2: User Management & Access Control (FR10–FR15c)

| FR | Summary | UI Surface |
|---|---|---|
| **FR10** | Create, modify, activate, deactivate user accounts with role assignment and department mapping | Yes |
| **FR11** | Authenticate via email and password with session management | Yes |
| **FR12** | Enforce RBAC mapped to organisational hierarchy | No (backend enforcement) |
| **FR13** | Enforce material enablement as domain-specific access control | No (backend enforcement) |
| **FR14** | Brand Owners create new users; Superadmin approval for Brand Owner accounts | Yes |
| **FR15** | Self-service password reset | Yes |
| **FR15a** | Grant/revoke per-user permissions on top of fixed role assignment; track timestamp, modifying user, mandatory reason code, optional expiry | Yes |
| **FR15b** | View user's effective permission set (role + grants + revokes consolidated) | Yes |
| **FR15c** | Capture permission override changes in audit trail; surface "overrides expiring soon" widget on Brand Owner dashboard | Yes |

### Epic 3: Shared Infrastructure (FR16–FR24)

| FR | Summary | UI Surface |
|---|---|---|
| **FR16** | Route approval requests through configurable approval chains with threshold-based routing and delegation | Yes |
| **FR17** | Unified approval inbox across all modules; bulk approval capability | Yes |
| **FR18** | Send notifications through configurable channels (in-app primary, email secondary) with user preferences | Yes |
| **FR19** | Batch non-urgent notifications into digests; escalate unacknowledged per timeout rules | Yes |
| **FR20** | Append-only audit trail with before/after snapshots; UPDATE and DELETE blocked at DB level | Yes (read-only audit views) |
| **FR21** | Activity timeline per entity showing chronological history | Yes |
| **FR22** | Create, assign, track, resolve internal issue tickets with unique reference numbers, status, priority | Yes |
| **FR23** | Broadcast announcements to all locations | Yes |
| **FR24** | Export audit-trail data (CSV, Excel, PDF) for internal/management audit; statutory reports in external accounting software | Yes |

### Epic 4: Inventory & Stock Management (FR25–FR39)

| FR | Summary | UI Surface |
|---|---|---|
| **FR25** | View real-time stock levels for any item at any location/department (within 30 seconds) | Yes |
| **FR26** | Record goods receipts against POs or transfers; partial receipts; barcode/QR scanning | Yes |
| **FR27** | Apply variable yield factors at GR; record usable qty, wastage, adjusted cost per unit | Yes |
| **FR28** | Enforce three-product-type directional flow rules (raw materials downward only, semi-products lateral within cluster, final products production→dispatch→POS) | No (service-layer enforcement) |
| **FR29** | Create/process stock transfers between locations/departments with enablement and flow validation | Yes |
| **FR30** | Track expiry dates on perishables; surface expiry countdown dashboards with 24h/48h/72h urgency bands | Yes |
| **FR31** | Enforce FEFO (First Expiry, First Out) in material selection for production | No (service-layer enforcement in deductStock) |
| **FR32** | Suggest cross-location transfers when stock approaches expiry (single-hop within-cluster or paired Brand-Store-routed) | Yes |
| **FR33** | Define PAR levels by item and location with day-of-week adjustments | Yes |
| **FR34** | Flag items below PAR; suggest reorder quantities | Yes |
| **FR35** | Perform physical closing inventory at POS and Dispatch departments daily; mandatory reason codes for variance | Yes |
| **FR36** | Surface locations not submitted closing inventory by cut-off time; alert Brand Owner | Yes |
| **FR37** | Record inventory adjustments with mandatory reason codes and approval workflows | Yes |
| **FR38** | Enforce shelf-life acceptance rules at GR; exception approvals route through Unified Approval Engine | Yes |
| **FR39** | Attach files (photos, documents) to GR records | Yes |

### Epic 5: Procurement & Vendor Management (FR40–FR47b)

| FR | Summary | UI Surface |
|---|---|---|
| **FR40** | Create POs (all items, category-wise, vendor-wise) with PAR-based quantity suggestions | Yes |
| **FR41** | Route POs through approval engine based on configurable value thresholds | Yes |
| **FR42** | Track PO lifecycle (Draft → Approved → Sent → Partially Received → Fully Received → Closed; also "Closed — GR Rejected") | Yes |
| **FR43** | View side-by-side vendor price comparison per item with historical tracking | Yes |
| **FR44** | Distribute POs to vendors via PDF generation | Yes |
| **FR45** | Create recurring PO templates | Yes |
| **FR46** | Detect and alert on vendor price spikes (>10% above 30-day average) | Yes |
| **FR47** | Manage vendor performance ratings and preferred vendor flagging | Yes |
| **FR47a** | Store Managers reject GR at formal QC; clears Pending GR sub-status, moves PO to "Closed — GR Rejected", auto-drafts vendor CN, linked PO takes FR67a closure path | Yes |
| **FR47b** | Vendor Credit Notes from rejected GR (TRN: `VCN-YYYY-LOC-SEQ`); reference original GR + source PO; reduce Accounts Payable by full delivered value | Yes |

### Epic 6: Recipe Management (FR48–FR56)

| FR | Summary | UI Surface |
|---|---|---|
| **FR48** | Create/manage recipes with ingredients (raw + semi-products), qty, UOM, prep instructions, yield info | Yes |
| **FR49** | Maintain multiple versions per recipe; designated default; version comparison and history | Yes |
| **FR50** | Designate recipe version as new default; approval workflow via Unified Approval Engine | Yes |
| **FR51** | Calculate recipe costs from current ingredient prices and yield factors; auto-recalculate on price/yield change | Yes |
| **FR52** | Cascade cost changes through recipe hierarchy (raw material → semi-product → final product) | No (backend cascade process) |
| **FR53** | Scale recipes to different batch sizes with automatic ingredient qty adjustment | Yes |
| **FR54** | Create sub-recipes referenced as ingredients in parent recipes | Yes |
| **FR55** | Categorise and tag recipes with multi-dimensional classification (dietary, allergen, seasonal, complexity) | Yes |
| **FR56** | Simulate recipe cost impact from ingredient price changes before committing | Yes |

### Epic 7: Production Planning (FR57–FR70)

| FR | Summary | UI Surface |
|---|---|---|
| **FR57** | Create production orders driven by recipes; specify batch size, target department, scheduled date | Yes |
| **FR58** | Default to current default recipe version on PO creation; warning if non-default selected | Yes |
| **FR59** | Check ingredient availability and enablement at PO creation using warn-and-log model | Yes |
| **FR60** | Create partial POs when stock insufficient; show maximum producible qty | Yes |
| **FR61** | Kitchen Managers substitute ingredient on PO using warn-and-log (mandatory reason code, enablement check on substitute, audit trail, batch cost only, surfaces on override-frequency dashboard) | Yes |
| **FR62** | Kitchen Managers override enablement or stock warnings with reason codes; visible on management dashboards | Yes |
| **FR63** | Kitchen Managers raise enablement requests or emergency overrides for immediate unblocking | Yes |
| **FR64** | Store Managers create Pending GR links on POs; auto-progress when linked GR confirmed | Yes |
| **FR65** | Kitchen Managers override unconfirmed GR situations with reason codes; proceed immediately with Store Manager notification | Yes |
| **FR66** | Use Last Known Price and standard yield factor as provisional costs for Pending GR POs; visible Provisional flag throughout system | Yes |
| **FR67** | Perform retrospective cost adjustment when linked GR confirmed; replace provisional with actuals; create tagged variance journal entry | No (journal entry generated, but cost adjustment is backend) |
| **FR67a** | When PO linked to Pending GR is rejected at QC (FR47a): lock at provisional, permanent `GR-Rejected` flag, reclassify consumed-portion value from COGS to Wastage via compensating journal, notify Brand Owner, surface on FR70 dashboard | Yes |
| **FR68** | Deduct raw materials from department inventory when PO moves to In Progress status (lifecycle: Draft → Pending GR → Confirmed → In Progress → Completed) | No (inventory decrement is backend) |
| **FR69** | Record production output with actual yield vs expected; variance recording with mandatory reason codes | Yes |
| **FR70** | Brand Owner dashboard displays override frequency metrics (Option C usage), provisional cost counts, Pending GR resolution outcomes (confirmed vs rejected as distinct breakdowns) as operational health indicators | Yes |

### Epic 8: Dispatch & Distribution (FR71–FR82)

| FR | Summary | UI Surface |
|---|---|---|
| **FR71** | Create internal dispatch challans from production departments to POS with items, qty, delivery confirmation | Yes |
| **FR72** | Create B2B dispatch challans for external business customers with items, qty, rates, customer reference | Yes |
| **FR73** | Manage B2B customer master records (name, address, GSTIN, credit terms, contact, system-generated `CUST-{SEQUENCE}` code, GST registration type enum) | Yes |
| **FR74** | Enforce complete B2B challan lifecycle (Draft → Dispatched → Delivered → Closed — GST Invoiced OR Closed — No GST Invoice; also Cancelled, Closed — Returned) with inventory decrement only at Dispatched | Yes |
| **FR75** | Generate TRNs for dispatch challans (`DC-YYYY-LOC-SEQ`) at Dispatched status; credit notes (`CN-YYYY-LOC-SEQ`) at creation with mandatory reference to original DC TRN | Yes |
| **FR76** | Receiving staff confirm delivery digitally with quantity verification; inventory updates at both locations | Yes |
| **FR77** | Perform daily physical closing inventory at Dispatch and POS departments for final products; variance recording | Yes |
| **FR78** | Finance Managers and Brand Owners fill GST placeholder fields and set `gst_invoice_raised` with IRN atomically (no other role without FR15a override) | Yes |
| **FR79** | Create credit notes against dispatched challans for full/partial returns; stock reinstatement; conditional two-stage reversal (check `gst_invoice_raised` on source challan) | Yes |
| **FR80** | Validate cumulative credit note values ≤ original challan value | No (backend validation) |
| **FR81** | Attach files to dispatch challan records | Yes |
| **FR82** | Generate challan PDFs for printing/sharing | Yes |

### Epic 9: POS Integration (FR83–FR86)

| FR | Summary | UI Surface |
|---|---|---|
| **FR83** | Map menu items to recipes; link POS sales to recipe-based inventory consumption | Yes |
| **FR84** | Import sales data from external POS systems via REST API | No (integration layer) |
| **FR85** | Calculate inventory impact from sales transactions based on recipe-to-menu-item mappings | No (backend calculation) |
| **FR86** | Manage menu item availability and pricing within the ERP | Yes |

### Epic 10: Accounting & Financial (FR87–FR99)

| FR | Summary | UI Surface |
|---|---|---|
| **FR87** | Generate Universal Transaction Reference Number (TRN) for every financially significant transaction; immutable, human-readable | No (TRN generation is backend, but displayed on all transactions) |
| **FR88** | Configure simplified F&B Chart of Accounts with minimum default account structure pre-seeded at launch | Yes |
| **FR89** | Auto-generate balanced journal entries for confirmed operational transactions via configurable mapping rules; minimum set pre-configured (GR confirmed, PO moved to In Progress, B2B Challan Dispatched Stage 1, B2B Challan Stage 2 GST confirmed, Credit Note created, Sales import confirmed) | No (journal generation is backend) |
| **FR90** | Maintain internal ledger as source of truth for financial reports; period-based multi-dimensional balances | No (ledger maintained in backend) |
| **FR91** | Generate Trial Balance, P&L Statement, Balance Sheet, Cash Flow Statement from internal journal; filterable by period, location, cluster | Yes |
| **FR92** | Execute two-stage B2B journal model (Stage 1 on dispatch, Stage 2 on GST invoice confirmation) | No (backend journal logic) |
| **FR93** | Capture and validate Daily Sales Reports by location with sales categories, settlement modes, expense categories | Yes |
| **FR94** | Create and track budgets by cluster, location, department with Budget vs Actual variance reporting | Yes |
| **FR95** | Food Cost Control Centre — financial framing (theoretical vs actual per item, vendor price tracking with alerts >10% above 30-day avg, margin analysis per item, wastage cost %, period comparisons M-o-M/Q-o-Q/Y-o-Y, drill-through to source transactions recipe→ingredient→vendor→PO→GR never >2 clicks) | Yes |
| **FR96** | Generate structured accountant handoff exports (Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost) in three simultaneous formats (Tally, Zoho Books, Generic CSV) with fixed column names keyed on TRN; format selection recorded in export history | Yes |
| **FR97** | Maintain compliance placeholder fields (GST, e-invoicing, TDS, e-way bill) as optional nullable on relevant transactions; role bindings: Finance Manager edits TDS; Finance Manager + Brand Owner edit GST, IRN, e-way bill | Yes |
| **FR98** | View Integration Status Dashboard showing export status, pending transactions, last export date per type | Yes |
| **FR99** | Create manual journal vouchers with own TRN for adjustments not covered by automated entries | Yes |

### Epic 11: HR & Workforce (FR100–FR103)

| FR | Summary | UI Surface |
|---|---|---|
| **FR100** | Manage employee records (personal details, employment info, department/role assignment, location mapping) | Yes |
| **FR101** | Track basic employee attendance (time in/out, absences, leave balance) | Yes |
| **FR102** | Create shift definitions and assign shifts to employees by role and location | Yes |
| **FR103** | View duty rosters and shift schedules | Yes |

### Epic 12: Analytics, Reporting & Dashboards (FR104–FR111)

| FR | Summary | UI Surface |
|---|---|---|
| **FR104** | Personalised morning briefing dashboard per role showing role-specific actionable information at login | Yes |
| **FR105** | Brand Owner cross-location dashboard (food cost %, stock value, daily sales, variance flags, pending approvals, override frequency FR70, provisional cost counts, Pending GR resolution outcomes, expiring permission overrides FR15c, unresolved data quality alerts FR116, key operational risks); tile drill-down ≤2 clicks; persisted scope filter per user | Yes |
| **FR106** | Standard operational reports (Purchase Register, Inventory Movement, Food Cost, Production vs Yield Variance, Wastage by Reason/Item, Closing Inventory Variance, Dispatch Volume, B2B Sales Register, POS Sales by Item/Location/Day-Part, Accounting, HR Roster/Attendance); support filtering (period, location, cluster, item, vendor, customer, category), drill-down to transaction detail per FR109, export per FR107, <3s render time | Yes |
| **FR107** | Export reports in CSV, Excel, PDF formats | Yes |
| **FR108** | Food Cost Control Centre — operational analytics framing (menu engineering matrix Stars/Puzzles/Plowhorses/Dogs with per-quadrant actions, real-time cost-per-serving with brand-configurable threshold alert default 35%, product mix analysis with Pareto view, time-series trend lines for cost-per-serving + contribution margin with anomaly highlighting, actionable suggestions surfaced at top promotion/re-engineer/retire/vendor-switch/yield-variance items, drill-down from any item to recipe/ingredients/vendor/sales/batches) | Yes |
| **FR109** | Drill-down from summary dashboards to detailed transaction-level data | Yes |
| **FR110** | Rule-based unusual activity detection (wastage spikes >30% above 30-day avg, vendor price jumps >10% above last 3-purchase avg, production yield variance >15% below standard for 2 consecutive batches, closing inventory variance patterns >3 consecutive days, override frequency anomalies, unresolved provisional-cost aging, sales mix shocks >50% volume change vs 7-day baseline, Pending-GR-then-rejected event spikes per location/vendor); each alert links to underlying data with suggested remediation; brand-configurable thresholds | Yes |
| **FR111** | PAR level drift detection reports with update recommendations based on consumption patterns | Yes |

### Cross-Cutting Data Quality & Entry Safeguards (FR112–FR119)

| FR | Summary | Primary Epic | UI Surface |
|---|---|---|---|
| **FR112** | Voice input for quantity fields during GR and production output recording (scoped to quantity fields only) | Epic 4 + Epic 7 | Yes |
| **FR113** | Forms pre-fill from most recent equivalent entry (yesterday's closing inventory, last GR quantities, PAR levels as default requisition quantities); users can override | Epic 3 framework + per-form usage Epics 4–10 | Yes |
| **FR114** | Flag implausible quantities (GR qty >150% of PO, PO output qty > theoretical max from raw materials, closing inventory > opening + receipts − dispatches); warn-and-log override with reason code | Epic 4 + Epic 7 | Yes |
| **FR115** | Detect and warn on likely duplicate entries (same-day GR for same items/qty against already-completed GR, dispatch challan for already-fully-dispatched PO); users can confirm with reason code | Epic 4 + Epic 8 | Yes |
| **FR116** | Auto-flag cross-module inconsistencies (raw material deactivated while active in published recipe, vendor deactivated with open POs, department deactivated with enabled materials); surface on dashboards as data quality alerts | Epic 1 detection + Epic 12 dashboards | Yes |
| **FR117** | Reverse or cancel transactions before confirmed status (Draft/Pending GR PO cleanly cancellable); once confirmed, correction path is always compensating document (CN, adjustment, reversal journal) with own TRN | Epic 3 | Yes |
| **FR118** | Validate GST tax field combinations consistent with place of supply (intra-state: CGST+SGST valid, IGST must be null; inter-state: IGST valid, CGST+SGST must be null); reject save on invalid combination | Epic 8 + Epic 10 | Yes |
| **FR119** | When Finance Manager or Brand Owner attempts to set `gst_invoice_raised = true` on B2B challan for Unregistered/Consumer GST registration type customer, display warning; user can proceed with mandatory reason code | Epic 8 + Epic 10 | Yes |

---

## SECTION C — PHASE 2B PARKING LOT ITEMS (VERBATIM WITH FR CROSS-REFERENCES)

### P2B-001 [from F-010, PRD line 87, FR68]

**Every form/screen that supports data entry must visibly indicate whether the current entry is in `status_draft` (not durable; will be lost on session interruption) or in any non-draft status (durable; survives session interruption).**

The `status_draft` pill is the canonical indicator. Forms that auto-save drafts to the server still show `status_draft` until the user explicitly confirms. The eyebrow label "DRAFT — NOT YET SAVED" can accompany the pill in mobile contexts where the pill alone may be missed. (PRD §6.2 Status durability rule; cross-cutting UI requirement — flag on every form-bearing screen, not just transactional ones.)

**FR cross-refs:** FR68 (canonical 5-status PO lifecycle), FR87 (TRN generation at confirmation), FR117 (reverse/cancel pre-confirmed only), DESIGN.md §6.2 Status durability rule

---

### P2B-002 [from F-011, PRD Journey 2, FR29, FR32]

**Cross-cluster reallocation needs a "paired Brand-Store-routed transfer" workflow.**

The screen inventory should include an affordance that lets a Cluster Manager initiate the return-to-Brand-Store and the matching draw-from-Brand-Store as a bundled pair, with a single approval object presented to the Brand Owner. Don't surface them as two unrelated transfers in the approval inbox. 

**Operational context (from Sameer's Journey 2):** Cluster B has 80kg tomatoes expiring in 48 hours. Cluster A can consume 60kg over 36 hours. Sameer initiates a paired reallocation: return-to-Brand-Store transfer for 60kg out of Cluster B Store paired with a draw-from-Brand-Store transfer into Cluster A Store. Both escalate to Brand Owner as a single bundled approval object. After approval, goods are in transit and stock that would have written off as expiry is now productive.

**FR cross-refs:** FR29 (create/process stock transfers with enablement and flow validation), FR32 (cross-location expiry transfer suggestions with Brand-Store-routed option), FR16 (Unified Approval Engine routing), Master Spec §2.2 (raw materials never lateral between clusters — must route via Brand Store)

---

### P2B-003 [from F-016, PRD §7.2 RBAC + FR15a/b/c]

**Permission override management UI for Brand Owner.**

The screen inventory should include:

1. **Per-user effective-permissions view** (role + grants + revokes consolidated): Shows which permissions each user can and cannot exercise at any given moment — single consolidated view, not scattered across permission screens
2. **Grant/revoke flow** with mandatory reason code and optional expiry date: UI for Brand Owner to issue new grants or revoke existing permissions; reason code entry required; optional date field for temporary overrides that auto-expire
3. **"Overrides expiring soon" widget on Brand Owner dashboard**: Surfaces permission overrides with future expiry dates so Brand Owners can renew or let lapse before access changes
4. **Audit trail link from each override** to its source change record: Each grant/revoke is an audit entry (FR20); the UI must link from the permission view to the underlying audit event

**FR cross-refs:** FR10 (user CRUD), FR15a (grant/revoke per-user permissions on top of fixed role), FR15b (view user's effective permission set), FR15c (capture permission override changes in audit trail; surface "overrides expiring soon" widget), FR20 (append-only audit trail), FR22 (issue tracker), RBAC matrix §7.2

---

### P2B-004 [from F-018, PRD §6.1, FR30, FR32]

**Expiry dashboard suggestion affordance must distinguish two types of cross-location transfers.**

The screen inventory should design the affordance to surface:

1. **(a) Single-hop within-cluster transfer suggestions** from a location approaching expiry to another location within the same cluster that can consume the stock (e.g., Cluster A Store → Central Kitchen A departments)
2. **(b) Paired Brand-Store-routed cross-cluster suggestions** (same shape as P2B-002): When no within-cluster consumer is viable for raw materials, the system may suggest a paired Brand-Store-routed transfer to another cluster. The paired variant must surface as a single bundled approval object to the Brand Owner, not as two unrelated transfers.

**Key design requirement:** The paired structure must be visible to the user, not hidden as an implementation detail, so the §2.2 raw-material flow rule (raw materials never lateral between clusters) and the Brand Store audit boundary stay legible.

**FR cross-refs:** FR30 (track expiry dates; surface countdown dashboards), FR32 (suggest cross-location transfers when stock approaches expiry; suggestions scoped to permitted destinations by §2.2 product-type flow rules; if no within-cluster consumer, suggest paired Brand-Store-routed transfer as single bundled suggestion requiring Brand Owner approval, never as direct cross-cluster lateral), FR16 (approval engine routing), Master Spec §2.2 (raw materials never lateral between clusters)

---

### P2B-005 [from §6.8 review + F-021, FR61, FR62, FR65, FR70]

**Override-frequency widget on the Brand Owner dashboard must be a single aggregating widget covering all warn-and-log override types.**

The widget should:

1. **Aggregate all warn-and-log override types** at minimum: FR67 Pending GR overrides (Kitchen Manager proceeds with production using LKP despite unconfirmed GR), FR61 ingredient substitutions (Kitchen Manager swaps one ingredient for another on a specific PO batch). The widget is designed to absorb future warn-and-log overrides as the system evolves.
2. **Per-type filters/breakdowns inside the widget**: Not separate per-feature widgets. The operational signal is "override pattern across the kitchen" not "Pending GR overrides specifically."
3. **Surface both count and rate**: Hero number should be **overrides per 100 production orders** (rate, not count) so spikes are visible at scales of 5 vs 50 daily orders. This allows operators to see the absolute frequency as well as the normalised rate.

**Visual signature (per DESIGN.md §6.6):** Same shape as variance widget — 30-day trend sparkline + hero-number current-period value (rate). Line draws in `error` (`#ba1a1a`) when rate > rolling-7-day average, otherwise `surface_tint` (`#1a6872`).

**FR cross-refs:** FR70 (Brand Owner dashboard displays override frequency metrics as operational health indicators), FR61 (ingredient substitution surfaces on override-frequency dashboard), FR67 (Pending GR override with reason code), FR65 (Kitchen Manager override unconfirmed GR), FR62 (override enablement/stock warnings), DESIGN.md §6.6 (Variance & override visual signature)

---

### IMPLICIT PHASE 2B ITEMS (No P2B-NNN ID yet — Phase 2b will absorb)

#### FCCC Two-Surface Design [from F-050, FR95, FR108]

**FR95 + FR108 define two complementary surfaces over shared underlying data for the Food Cost Control Centre.**

- **FR95 — Food Cost Control Centre (Financial framing):** Theoretical vs actual food cost per item, vendor price tracking with alerts, margin analysis per item, wastage cost %, period comparisons, drill-through to source transactions (recipe → ingredient → vendor → PO → GR)
- **FR108 — Food Cost Control Centre (Operational analytics framing):** Menu engineering matrix (Stars/Puzzles/Plowhorses/Dogs), cost-per-serving tracking with alerts, product mix analysis with Pareto view, time-series trends with anomaly highlighting, actionable suggestions (promotion/re-engineer/retire/vendor-switch/yield-variance), drill-down from items to recipe/ingredients/vendor/sales/batches

**Phase 2b design approach:** Either a tabbed FCCC interface or two distinct routes that cross-link (FR95 ↔ FR108) without duplicating drill-down state. Both surfaces must be accessible and must share underlying queries and drill-down state to avoid orphaned analytics.

---

#### Pending-GR-Resolution-Outcomes Drill-Down [from F-025, FR67a, FR70]

**The Brand Owner dashboard Pending-GR-resolution-outcomes pane (FR70 amendment) must allow drill-down into the underlying rejected GR + linked PO + reclassification journal.**

When a production order is linked to a Pending GR (FR64) and that GR is subsequently rejected at formal QC (FR47a), the PO takes the GR-Rejected closure path (FR67a). The Brand Owner should be able to:

1. Drill from the override-frequency dashboard Pending-GR-resolution-outcomes pane into the rejected event
2. See the rejected GR, the original PO, the rejection reason code, and the reclassification journal entry (consumed-but-rejected value reclassified from COGS — Raw Material Consumption to Wastage and Write-offs)
3. Trace the audit thread back to the vendor quality issue

This is useful when investigating vendor quality patterns and cumulative defect rates.

**FR cross-refs:** FR47a (Store Manager rejects GR at formal QC), FR67a (PO takes GR-Rejected closure path with permanent flag and reclassification journal), FR70 (Pending-GR-resolution-outcomes surfaces as distinct breakdown on override-frequency dashboard), FR22 (issue tracker for vendor investigation)

---

## SECTION D — B2B CHALLAN SPEC UI SURFACES

### B2B Customer Master Management Screen (FR73)

**Screen:** B2B Customer master record CRUD

- Create/edit/deactivate B2B customers with fields: customer name, registered address, GSTIN (optional), GST registration type (enum: Regular / Composition / Unregistered / Consumer), credit terms (days), contact person name and phone, status (Active / Inactive)
- System auto-generates `CUST-{SEQUENCE}` customer code at creation
- **FR cross-ref:** FR73

### B2B Dispatch Challan Creation & Lifecycle Screen (FR72, FR74, FR75, FR81, FR82)

**Screen:** B2B Challan entry, status progression, and document generation

- Create B2B challan in Draft status: select customer (dropdown), specify items and quantities, rates, optional B2B customer reference field
- Confirm dispatch → status moves to Dispatched; DC TRN (`DC-YYYY-LOC-SEQ`) auto-generated; inventory decremented; Stage 1 journal fires (DR Accounts Receivable, CR Revenue — B2B Sales)
- Receive confirmation → status moves to Delivered
- Attach files (photos, documents) to challan records
- Generate challan PDF for printing/sharing
- **FR cross-refs:** FR72, FR74, FR75, FR81, FR82

### B2B Challan GST & Closure Workflow Screen (FR78, FR92)

**Screen:** GST field entry and Stage 2 journal trigger (two-stage B2B model)

**Roles permitted:** Finance Manager, Brand Owner only (no other role without FR15a per-user override)

- In Delivered status, Finance Manager/Brand Owner can fill GST placeholder fields: buyer_gstin, hsn_code, place_of_supply, tax_rate_percent, cgst_amount, sgst_amount, igst_amount
- Set `gst_invoice_raised = true` and paste IRN (64-char hash from IRP portal) atomically as a single save operation
- Validation rule: `irn` cannot be saved without `gst_invoice_raised = true`, and vice versa
- Validation rule: place_of_supply determines tax structure — intra-state (CGST+SGST valid, IGST null) vs inter-state (IGST valid, CGST+SGST null) — system rejects invalid combinations with error message
- When `gst_invoice_raised = true` is saved → status moves to "Closed — GST Invoiced" → Stage 2 journal fires (DR Accounts Receivable, CR GST Liability, for tax amount only)
- When challan closes without GST invoice → status moves to "Closed — No GST Invoice" → no Stage 2 entry
- **FR cross-refs:** FR78, FR92, FR118 (GST tax field validation), FR119 (Unregistered/Consumer customer warning)

### B2B Credit Note Creation & Reversal Screen (FR79)

**Screen:** Credit note entry for full or partial returns

- Create credit note against a dispatched B2B challan, specifying returned items and quantities
- System checks `gst_invoice_raised` on the source challan
- If source challan had `gst_invoice_raised = true` → credit note reversal fires BOTH Stage 1 (base value: DR Revenue, CR Accounts Receivable) AND Stage 2 (tax amount: DR GST Liability, CR Accounts Receivable)
- If source challan had `gst_invoice_raised = false` → credit note reversal fires Stage 1 only
- CN TRN (`CN-YYYY-LOC-SEQ`) auto-generated; CN must store mandatory reference to original DC TRN
- Validation rule: cumulative CN values across all credit notes against source challan must not exceed original challan value
- Stock reinstated at originating location/department
- **FR cross-refs:** FR79, FR80 (cumulative CN validation)

### Vendor Credit Note from Rejected GR Screen (FR47a, FR47b)

**Screen:** Vendor credit note auto-drafted and managed

- When Store Manager rejects a GR at formal QC (FR47a), system auto-drafts a vendor credit note
- Vendor CN TRN format: `VCN-YYYY-LOC-SEQ`
- CN references both original GR TRN and source PO TRN
- CN covers both unconsumed portion (physically returned) and consumed-but-defective portion (non-physical refund claim against vendor for defective delivery)
- Reduces Accounts Payable by full delivered value
- Cumulative-CN-not-exceeding-source-value validation (FR80) applies analogously to vendor CNs
- **FR cross-refs:** FR47a, FR47b

### B2B Challan Unregistered/Consumer Customer Warning Screen (FR119)

**Screen:** Override confirmation for GST invoice issuance to unregistered customers

- When Finance Manager or Brand Owner attempts to set `gst_invoice_raised = true` on B2B challan for customer with GST registration type Unregistered or Consumer, system displays warning: *"This customer is not GST-registered. Raising a GST invoice may not be legally valid."*
- User can proceed with mandatory reason code entry
- Override is logged and visible on Brand Owner dashboard
- **FR cross-refs:** FR119, FR73 (GST registration type on customer master), FR97 (role bindings for editing GST fields)

---

## SECTION E — DESIGN.MD TOKEN INVENTORY (NAMES ONLY)

### Semantic Colour Token Names (Status & Functional)

**Lifecycle Status Tokens:**
- `status_draft`
- `status_pending_approval`
- `status_pending_gr`
- `status_provisional`
- `status_confirmed`
- `status_in_progress`
- `status_completed`
- `status_closed`
- `status_cancelled`
- `status_gr_rejected`
- `status_returned`
- `status_overridden`
- `status_variance_flagged`

**Semantic Functional Tokens:**
- `success`
- `warning`
- `error`
- `error_container`

**Product Palette Tokens:**
- `primary` / `primary_container` / `on_primary` / `on_primary_container` / `primary_fixed` / `primary_fixed_dim` / `on_primary_fixed` / `on_primary_fixed_variant`
- `secondary` / `secondary_container` / `on_secondary` / `on_secondary_container`
- `tertiary` / `tertiary_container` / `on_tertiary` / `on_tertiary_container` / `tertiary_fixed` / `tertiary_fixed_dim`
- `surface` / `surface_bright` / `surface_dim` / `surface_container_lowest` / `surface_container_low` / `surface_container` / `surface_container_high` / `surface_container_highest` / `surface_variant`
- `on_surface` / `on_surface_variant` / `on_background`
- `outline` / `outline_variant`
- `surface_tint`

**Sidebar Chrome Tokens:**
- `sidebar`
- `sidebar_hover`
- `sidebar_active`
- `on_sidebar`
- `on_sidebar_active`
- `on_sidebar_muted`

**Inverse (Overlay) Tokens:**
- `inverse_surface`
- `inverse_on_surface`
- `inverse_primary`

**Tenant Brand Tokens:**
- `tenant_brand_accent`
- `tenant_brand_accent_soft`
- `on_tenant_brand_accent`
- `tenant_logo_full_url`
- `tenant_logo_nibble_url`
- `tenant_display_name`

---

### Density Preset Names (from §19)

Density modes are contextual (mobile-first operational staff vs desktop management/finance). No enumerated preset names defined in DESIGN.md §19 as standalone tokens; density is applied contextually via responsive breakpoints and component type (mobile vs desktop variants). Screens themselves adapt via breakpoint-driven layout (§8.3), not via named density presets.

---

### Component Pattern Names (Recurring in §12)

- **data-table** (with alternate-row striping, status pills in rows)
- **approval-inbox-card** (unified approval entry with action buttons, threshold routing indicator)
- **metric-card** (KPI display with ₹ value, secondary text, optional trend sparkline)
- **status-pill** (background + foreground + icon, colour/icon paired per WCAG 1.4.1)
- **severity-coded-alert-row** (4px left margin-accent pip + background, supporting high-density datasets)
- **form-field** (input field with label, optional placeholder, optional helper text, status pill below for draft/validation state)
- **sidebar-nav-item** (hover state, active pill indicator on left, chevron collapse/expand)
- **breadcrumb** (navigation path, separation via `/` character, not borders)
- **modal-overlay** (glassmorphism at 80% opacity with 20px backdrop-blur, surface layer)
- **dropdown-popover** (floated, elevation via ambient shadow, `outline_variant` ghost border optional)
- **timeline** (per entity activity, chronological entries, TRN and timestamp visible)
- **chart-series** (Recharts; solid stroke for confirmed data, dotted stroke for provisional data; tooltip on hover)
- **badge** (status badge shape with background + foreground, used for markers like "PROVISIONAL")
- **button-primary** (linear gradient primary → primary_container at 135deg; reserved for page-level primary CTA on Brand-Owner / Finance dashboards)
- **button-secondary** (secondary background, secondary-container states)

---

### DESIGN.md Top-Level Section Headings

1. Creative North Star — *Clinical Artisan*
2. Token taxonomy — three-layer system
3. Multi-tenant branding pattern
4. Logo usage — Wild Sugar
5. Colour system
6. F&B status & state palette
7. Typography
8. Spacing, radius, layout, breakpoints
9. Elevation, surface hierarchy, no-line rule
10. Motion
11. Iconography — Lucide React
12. Components — quick reference
13. Charts & data viz
14. Reports & print (PDF / B2B / accountant exports)
15. Accessibility — WCAG 2.1 AA gates
16. India-native details
17. Voice & tone for the ERP UI
18. Imagery & illustration
19. Density modes & persona contexts
20. Quick don't list
21. References & change control

---

## SECTION F — CROSS-CUTTING SAFEGUARD FRs (FR112–FR119)

Per PRD §9.13, these FRs are cross-cutting safeguards implemented across multiple epics. Each is annotated with its **primary epic(s)** per Master Spec §5 implementation order:

| FR | Safeguard | Primary Epic(s) | Implementation Note |
|---|---|---|---|
| **FR112** | Voice input for quantity fields during goods receipt and production output recording (scoped to quantity fields only) | Epic 4 (Inventory) + Epic 7 (Production) | Implementation depth (Web Speech API vs third-party) determined during architecture. Hands-free workflow support for kitchen and store environments. |
| **FR113** | Forms pre-fill from most recent equivalent entry (yesterday's closing inventory quantities, last GR quantities for same vendor/items, PAR levels as default requisition quantities); users can override | Epic 3 (Shared Infrastructure) framework + per-form usage Epics 4–10 | Universal capability; built into the form framework in Epic 3, then applied to each form in its parent epic. Reduces data entry friction. |
| **FR114** | Flag entries where quantities are physically implausible (GR qty >150% of PO, PO output qty > theoretical max from raw materials, closing inventory qty > opening + receipts − dispatches); warn-and-log override with reason code | Epic 4 (Inventory) + Epic 7 (Production); uses Epic 3 warn-and-log | Validation rules applied at save time. Reason code required to override flag. Prevents common data entry errors. |
| **FR115** | Detect and warn on likely duplicate entries (GR same-day against already-completed GR for same items/qty, dispatch challan for already-fully-dispatched PO); users can confirm with reason code | Epic 4 (Inventory) + Epic 8 (Dispatch); uses Epic 3 warn-and-log | Duplicate detection fires at save time. Conflicting record reference shown in warning. Prevents accidental double-entry. |
| **FR116** | Auto-flag cross-module inconsistencies (raw material deactivated while active in published recipe version, vendor deactivated with open POs, department deactivated with enabled materials); surface on dashboards as data quality alerts | Epic 1 (Master Data) for detection rules; surfaces in Epic 12 (Analytics) dashboards | Detection logic in Epic 1; dashboard surfaces in FR105 (Brand Owner cross-location dashboard), FR110 (unusual activity detection). Ensures master data stays internally consistent. |
| **FR117** | Reverse or cancel transaction before confirmed status (Draft/Pending GR PO cleanly cancellable); once confirmed, correction path is always compensating document (credit note, adjustment entry, reversal journal) with own TRN | Epic 3 (Shared Infrastructure) | Transaction immutability rule. Cleanable states are pre-confirmed only. Preserves audit trail and prevents data loss. |
| **FR118** | Validate GST tax field combinations consistent with place of supply (intra-state: CGST+SGST valid, IGST null; inter-state: IGST valid, CGST+SGST null); reject save on invalid combination | Epic 8 (Dispatch) + Epic 10 (Accounting) | Validation fires at save time on B2B challan. Error message identifies conflicting fields. Prevents GST compliance errors. |
| **FR119** | When Finance Manager or Brand Owner attempts to set `gst_invoice_raised = true` on B2B challan for Unregistered/Consumer GST registration customer, display warning; user can proceed with mandatory reason code | Epic 8 (Dispatch) + Epic 10 (Accounting) | Warning shown; override logged and visible on Brand Owner dashboard. Prevents legally invalid GST invoice issuance. |

---

## CLOSING NOTES

This digest is a complete structured synthesis of all four source documents, designed to be loaded into Phase 2b screen inventory planning conversations. Key design:

- **Section A** lists discrete journey moments (user-perceivable actions) mapped to FR numbers, enabling screens to map backward to their user journeys and forward to their FRs
- **Section B** provides a complete FR-by-FR reference with epic, UI surface flag, and role interactions — enabling PM/designer to scope screen-by-screen coverage
- **Section C** documents all Phase 2b parking lot items with full text and cross-references — operational constraints that shape UX affordances
- **Section D** lists B2B-specific UI surfaces derived from the supplementary spec — ensuring dispatch/accounting workflows surface the challan lifecycle correctly
- **Section E** provides the token inventory that screen design must reference — semantic colour names, density modes, component patterns, design-system structure
- **Section F** annotates cross-cutting safeguards to their primary epics — ensures data-quality and validation patterns are understood per epic, not scattered

No extrapolation or invention — every item is sourced directly from the four documents with explicit line/section citations. Accuracy and completeness prioritized for Phase 2b team to operate from a single source of truth.