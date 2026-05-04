# Phase 2c — Visual Mockup Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:brainstorming first to resolve the open kickoff questions in §13, then superpowers:writing-plans to firm this into per-task instructions, then superpowers:subagent-driven-development for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a working Vite + React + Tailwind reference implementation of foundation chrome and most-novel pattern screens under `mockups/` in this repo. Phase 4 (Epic implementation) builds the remaining screens just-in-time per epic, using these foundation mockups + the screen inventory as visual reference. Mockups are visual specification, not production code.

**Status:** Plan committed; SCOPED DOWN per phase-roadmap re-sequencing decision (2026-05-05). Originally specced 89 mockups across 8–12 sessions; revised to 13 mockups across 3 sessions (S2 scaffold + S3 Tier 1 Group 1 + S4 Tier 1 Group 4 + selected G2). Tier 2 / Tier 3 / Index mockups move into Phase 4 epic-by-epic territory. See `_planning/06-phase-roadmap.md` for canonical phase sequence.

**⚠ Gating: Phase 2c executes ONLY AFTER Phase 3a Architecture closes.** Architecture decisions (Master Spec §11 OQ1–OQ8 resolution + OQ9 capture + OQ10 column-mapping deliverable) directly affect mockup design choices (real-time vs polling, file-storage UX, multi-tenancy data wiring, auth flow, API surface, optimistic-update patterns). Building mockups before architecture risks aspirational designs that can't be implemented as drawn. Phase 3a must land `_planning/architecture.md` before Session 2 (scaffold) starts.

**Date:** 2026-05-04 (revised 2026-05-05 with phase-roadmap re-sequencing)

---

## 1 Inputs (locked — do not reopen)

| Artefact | Path | Role |
|---|---|---|
| Screen inventory | `_planning/05-screen-inventory.md` | What to mockup (112 screens × 12 schema fields each) |
| Design system | `DESIGN.md` | Tokens, layout, type, status palette, no-line rule, glass+gradient rule |
| PRD | `_planning/03-prd.md` | FR text where Source FRs need lookup |
| Master spec | `_planning/02-master-spec.md` | Org hierarchy, service contracts |
| B2B challan spec | `_planning/04-b2b-challan-spec.md` | B2B challan lifecycle |
| Phase-2b digest | `_planning/_internal/phase-2b-digest.md` | Journey moments §A, FRs by epic §B |
| Tenant logos | `logos/logo-full.png`, `logos/logo-nibble.png` | Wild Sugar tenant artwork |
| PRD review notes | `_planning/prd-review-notes.md` | Phase-2b close note + accumulated decisions |

---

## 2 Output

```
mockups/                                    (NEW — Vite + React 18 + Tailwind 4 + TypeScript + shadcn/ui)
├── package.json                            (Tailwind v4 pinned exact, no caret)
├── tailwind.config.ts                      (DESIGN.md §5/§6/§7/§8 → Tailwind v4 @theme tokens)
├── vite.config.ts
├── tsconfig.json
├── components.json                         (shadcn/ui CLI config; aliases set per token reconciliation)
├── index.html
├── README.md                               (how to run; how to add a screen; token rules)
├── .git-hooks/
│   └── pre-commit                          (token-enforcement hook; ships with snapshot test cases)
├── src/
│   ├── main.tsx                            (router; one route per screen ID + /_dev/components)
│   ├── globals.css                         (M3 tokens at :root + shadcn alias layer + tenant accent
│   │                                        var + .dark empty stub with anti-drift comment)
│   ├── tokens.ts                           (DESIGN.md tokens as named TS exports for SVG/chart fills)
│   ├── components/
│   │   └── ui/                             (shadcn/ui pulled primitives — UNMODIFIED; override
│   │                                        via globals.css aliases + wrappers in shell/. EXCLUDED
│   │                                        from pre-commit token-enforcement hook scope.)
│   ├── lib/
│   │   ├── sample-data.ts                  (Wild Sugar / Indian F&B fixtures)
│   │   ├── personas.ts                     (8 personas + scope context)
│   │   └── voice.ts                        (D2C-002 microcopy patterns: ₹ rule, reason prompts)
│   ├── shell/                              (~21 shared components, one per CC-* pattern; PLUS
│   │                                        the 6 wrapper components that override shadcn defaults
│   │                                        per the §10.7 exception list — Card, Separator-stand-in,
│   │                                        Table chrome, Input, Button outline variant, Popover)
│   │   ├── AppShell.tsx                    (sidebar §5.1.5 + top bar; persona-switchable)
│   │   ├── StatusPill.tsx                  (one component, all 19 status_* variants)
│   │   ├── DraftPill.tsx                   (CC-DRAFT-PILL canonical)
│   │   ├── ApprovalInboxCard.tsx           (CC-APPROVAL-INBOX-CARD canonical)
│   │   ├── DashboardTile.tsx               (CC-DASHBOARD-TILE canonical)
│   │   ├── OverrideWidget.tsx              (CC-OVERRIDE-WIDGET / P2B-005)
│   │   ├── FCCCDualSurface.tsx             (Implicit FCCC dual-surface chrome)
│   │   ├── PendingGRDrill.tsx              (CC-PENDING-GR-DRILL)
│   │   ├── PairedTransferBundle.tsx        (CC-PAIRED-TRANSFER-BUNDLE / P2B-002)
│   │   ├── PermissionOverrideMgmt.tsx      (CC-PERMISSION-OVERRIDE-MGMT / P2B-003)
│   │   ├── TRNDisplay.tsx                  (CC-TRN-DISPLAY)
│   │   ├── AuditLink.tsx                   (CC-AUDIT-LINK)
│   │   ├── IssueTicketLink.tsx             (CC-ISSUE-TICKET-LINK)
│   │   ├── ReverseCancelDialog.tsx         (CC-REVERSE-CANCEL)
│   │   ├── ExportTrigger.tsx               (CC-EXPORT-TRIGGER)
│   │   ├── DataQualityAlert.tsx            (CC-DATA-QUALITY-ALERT)
│   │   ├── GSTFieldValidation.tsx          (CC-GST-FIELD-VALIDATION)
│   │   ├── UnregisteredCustomerWarn.tsx    (CC-UNREGISTERED-CUSTOMER-WARN)
│   │   ├── ImplausibilityWarn.tsx          (CC-IMPLAUSIBILITY-WARN)
│   │   ├── VoiceInput.tsx                  (CC-VOICE-INPUT)
│   │   ├── ProvisionalFlag.tsx             (CC-PROVISIONAL-FLAG / FR67a)
│   │   └── Prefill.tsx                     (CC-PREFILL)
│   ├── screens/
│   │   ├── mdm/
│   │   │   ├── SI-MDM-001.tsx              (Tier 2)
│   │   │   ├── SI-MDM-003.tsx              (Tier 1 — first build)
│   │   │   └── ...
│   │   ├── usr/
│   │   ├── inf/
│   │   ├── inv/
│   │   ├── pur/
│   │   ├── rec/
│   │   ├── pro/
│   │   ├── dsp/
│   │   ├── pos/
│   │   ├── acc/
│   │   ├── hrm/
│   │   └── rpt/
│   ├── patterns/                           (Tier 3 — markdown docs)
│   │   ├── SI-INF-006-activity-timeline.md
│   │   ├── SI-INF-010-reverse-cancel.md
│   │   └── SI-RPT-001-morning-briefing.md
│   ├── dev/
│   │   └── ComponentsIndex.tsx             (rendered at /_dev/components — per-shell-component
│   │                                        permutation grids; 19-variant <StatusPill> grid is
│   │                                        the highest-value view. Internal/scaffolding only;
│   │                                        deletable later if ScreenIndex grows component coverage.)
│   └── pages/
│       └── ScreenIndex.tsx                 (clickable list of all 112 screens; Index-only entries
│                                            link to parents; small "developer view" affordance
│                                            in footer links to /_dev/components)
└── public/
    └── logos/                              (symlink or copy from project-root /logos/)
```

---

## 3 Tooling decision (already made)

**Chosen: in-repo Vite + React + Tailwind harness in this Claude Code workspace.**

Rejected alternatives and why:
- **claude.ai Artifacts** — sandboxed Tailwind, no shared component file (paste-the-block discipline fails at scale), engineer handoff requires translation, Inter font load unreliable, voice drift across chats
- **Stitch MCP** — Gemini-powered (not Claude; voice drift), structured design-system data model can hold ~25% of DESIGN.md (rest collapses into free-form `designMd`), output format not directly extractable as React, async generation (minutes per call) hurts iteration scale

The Claude Code path wins because: real Tailwind config = mechanical token enforcement (typo = build error), shared shell components = true cross-screen consistency (edit once, all screens update), engineer handoff = `git checkout`, design:* and superpowers:* skills run natively, git history = design history.

---

## 4 Tiering — definitions

| Tier | Count | Treatment |
|---|---|---|
| **1 — Hero** | 28 | Full design critique + accessibility audit + voice review per screen. Build first; establish the chrome. |
| **2 — Standard** | 58 | Structural mockup using shared shell components + lighter critique (combined spec+quality). |
| **3 — Pattern docs** | 3 | Markdown documentation page in `mockups/src/patterns/` rather than React component file. |
| **Index-only** | 23 | One-line entry in `ScreenIndex.tsx` linking to parent screen + inventory entry. No bespoke mockup. |
| **Total** | 112 | |

**Tier 1 promotion rules** (any one suffices):
- Anchors a primary journey moment from digest §A
- Defines or first-instantiates a parking-lot pattern (P2B-001..005, FCCC dual-surface, Pending-GR drill)
- Workflow-weighted (initiates approval, fires journal/TRN, mandatory reason-code workflow)
- Persona-defining (each persona's daily-driver surface)
- Sets visual chrome reused by 5+ other screens (the FIRST instance — siblings drop to Tier 2/Index)

**Tier 2** = operationally meaningful but reuses chrome from a Tier-1 instance.

**Tier 3** = inventory Notes explicitly flag the entry as "pattern-reference / not a standalone route".

**Index-only** = sub-view / sibling sharing 90%+ chrome with a Tier-1 or Tier-2 parent; visual would teach engineers nothing beyond what the inventory schema already says.

---

## 5 Per-epic tier tables

### Epic 1 — MDM (7)

| ID | Name | Tier |
|---|---|---|
| SI-MDM-001 | Organisational Hierarchy View & Edit | 2 |
| SI-MDM-002 | Department Register | 2 |
| SI-MDM-003 | Product Master CRUD | **1** |
| SI-MDM-004 | Material Enablement Matrix | **1** |
| SI-MDM-005 | Vendor Master CRUD | 2 |
| SI-MDM-006 | Category & Sub-Category Management | Index |
| SI-MDM-007 | Company Registration & Fiscal Year Setup | 2 |

### Epic 2 — USR (8)

| ID | Name | Tier |
|---|---|---|
| SI-USR-001 | User List & Filter | 2 |
| SI-USR-002 | User Create / Edit | 2 |
| SI-USR-003 | Login | Index |
| SI-USR-004 | Self-Service Password Reset | Index |
| SI-USR-005 | User Effective Permissions View | 2 |
| SI-USR-006 | Permission Grant / Revoke Flow | **1** |
| SI-USR-007 | Overrides Expiring Soon | 2 |
| SI-USR-008 | Brand Owner Account Approval | 2 |

### Epic 3 — INF (10)

| ID | Name | Tier |
|---|---|---|
| SI-INF-001 | Unified Approval Inbox | **1** |
| SI-INF-002 | Approval Chain Configuration | 2 |
| SI-INF-003 | Notification Preferences | 2 |
| SI-INF-004 | Notification Digest Preview | 2 |
| SI-INF-005 | Audit Trail Viewer | **1** |
| SI-INF-006 | Activity Timeline Reference | **3** |
| SI-INF-007 | Issue Ticket List | 2 |
| SI-INF-008 | Issue Ticket Create / Edit | 2 |
| SI-INF-009 | Broadcast Announcement Composer | 2 |
| SI-INF-010 | Reverse / Cancel Confirmation Pattern | **3** |

### Epic 4 — INV (16)

| ID | Name | Tier |
|---|---|---|
| SI-INV-001 | Real-Time Stock View | **1** |
| SI-INV-002 | Department Stock Detail | Index |
| SI-INV-003 | Below-PAR Flag List | 2 |
| SI-INV-004 | PAR Level Configuration | 2 |
| SI-INV-005 | Stock Transfer Create | 2 |
| SI-INV-006 | Stock Transfer Detail & Status | Index |
| SI-INV-007 | Paired Brand-Store Cross-Cluster Transfer | **1** |
| SI-INV-008 | Expiry Countdown Dashboard | 2 |
| SI-INV-009 | Cross-Location Transfer Suggestions | 2 |
| SI-INV-010 | Goods Receipt Entry — PO-Driven | **1** |
| SI-INV-011 | Goods Receipt Entry — Transfer-Driven | Index |
| SI-INV-012 | Goods Receipt Rejection at QC | **1** |
| SI-INV-013 | Inventory Adjustment | 2 |
| SI-INV-014 | Closing Inventory Entry — POS Daily | **1** |
| SI-INV-015 | Closing Inventory Entry — Dispatch Daily | Index |
| SI-INV-016 | Closing Inventory Cluster Review | **1** |

### Epic 5 — PUR (9)

| ID | Name | Tier |
|---|---|---|
| SI-PUR-001 | PO Create with PAR Suggestions | 2 |
| SI-PUR-002 | PO List & Filter | Index |
| SI-PUR-003 | PO Detail & Lifecycle Status | **1** |
| SI-PUR-004 | PO Approval | **1** |
| SI-PUR-005 | Vendor Price Comparison | 2 |
| SI-PUR-006 | Vendor Price Spike Alerts | Index |
| SI-PUR-007 | Recurring PO Template | 2 |
| SI-PUR-008 | Vendor Performance & Preferred Flag | Index |
| SI-PUR-009 | Vendor Credit Note Issuance | **1** |

### Epic 6 — REC (8)

| ID | Name | Tier |
|---|---|---|
| SI-REC-001 | Recipe List & Search | 2 |
| SI-REC-002 | Recipe Detail — Current Default | 2 |
| SI-REC-003 | Recipe Edit | **1** |
| SI-REC-004 | Recipe Version Comparison | 2 |
| SI-REC-005 | Designate Default Approval | 2 |
| SI-REC-006 | Recipe Scaling Preview | Index |
| SI-REC-007 | Cost-Impact Simulation | 2 |
| SI-REC-008 | Recipe Categories & Tags Admin | Index |

### Epic 7 — PRO (11)

| ID | Name | Tier |
|---|---|---|
| SI-PRO-001 | Production Order List & Filter | 2 |
| SI-PRO-002 | Production Order Create | 2 |
| SI-PRO-003 | Production Order Detail | 2 |
| SI-PRO-004 | Ingredient Substitution Flow | **1** |
| SI-PRO-005 | Enablement / Stock Override Flow | 2 |
| SI-PRO-006 | Enablement Request | 2 |
| SI-PRO-007 | Pending GR Linkage Interface | 2 |
| SI-PRO-008 | Pending GR Override | **1** |
| SI-PRO-009 | Pending GR Resolution Outcomes | 2 |
| SI-PRO-010 | Production Output Entry | 2 |
| SI-PRO-011 | In Progress Transition Confirm | **1** |

### Epic 8 — DSP (12)

| ID | Name | Tier |
|---|---|---|
| SI-DSP-001 | Internal Dispatch Challan List | Index |
| SI-DSP-002 | Internal Dispatch Challan Create | 2 |
| SI-DSP-003 | Dispatch Receipt Sign-off | **1** |
| SI-DSP-004 | B2B Customer Master | 2 |
| SI-DSP-005 | B2B Challan List | Index |
| SI-DSP-006 | B2B Challan Create | 2 |
| SI-DSP-007 | B2B Challan Detail | 2 |
| SI-DSP-008 | B2B Dispatch Confirmation | 2 |
| SI-DSP-009 | B2B Delivery Confirmation | Index |
| SI-DSP-010 | B2B GST Closure | **1** |
| SI-DSP-011 | B2B Closure Without GST Invoice | Index |
| SI-DSP-012 | B2B Credit Note Creation | **1** |

### Epic 9 — POS (3)

| ID | Name | Tier |
|---|---|---|
| SI-POS-001 | Menu Item List | 2 |
| SI-POS-002 | Menu Item Recipe Mapping | 2 |
| SI-POS-003 | POS Sales Integration Status | 2 |

### Epic 10 — ACC (14)

| ID | Name | Tier |
|---|---|---|
| SI-ACC-001 | Chart of Accounts Admin | 2 |
| SI-ACC-002 | Journal Mapping Rules Admin | 2 |
| SI-ACC-003 | Trial Balance | **1** |
| SI-ACC-004 | Profit & Loss Statement | Index |
| SI-ACC-005 | Balance Sheet | Index |
| SI-ACC-006 | Cash Flow Statement | Index |
| SI-ACC-007 | Daily Sales Report Capture | Index |
| SI-ACC-008 | Budget Create / Edit | 2 |
| SI-ACC-009 | Budget vs Actual Variance | Index |
| SI-ACC-010 | FCCC Financial Framing | **1** |
| SI-ACC-011 | Accountant Handoff Exports | Index |
| SI-ACC-012 | Compliance Placeholder Editor | 2 |
| SI-ACC-013 | Integration Status Dashboard | **1** |
| SI-ACC-014 | Manual Journal Voucher | **1** |

### Epic 11 — HRM (5)

| ID | Name | Tier |
|---|---|---|
| SI-HRM-001 | Employee List | 2 |
| SI-HRM-002 | Employee Create / Edit | 2 |
| SI-HRM-003 | Attendance Entry / Log | 2 |
| SI-HRM-004 | Shift Definition Admin | Index |
| SI-HRM-005 | Duty Roster View | 2 |

### Epic 12 — RPT (9)

| ID | Name | Tier |
|---|---|---|
| SI-RPT-001 | Personalised Morning Briefing | **3** |
| SI-RPT-002 | Brand Owner Cross-Location Dashboard | **1** |
| SI-RPT-003 | Cluster Manager Cluster Dashboard | 2 |
| SI-RPT-004 | Reports Library Index | 2 |
| SI-RPT-005 | Report Detail Runner | **1** |
| SI-RPT-006 | FCCC Operational Analytics Framing | **1** |
| SI-RPT-007 | Menu Engineering Matrix | 2 |
| SI-RPT-008 | Unusual Activity Feed | Index |
| SI-RPT-009 | PAR Drift Recommendations | Index |

**Verified totals: Tier 1: 28 | Tier 2: 58 | Tier 3: 3 | Index: 23 = 112**

---

## 6 Tier 1 build order (28 screens, 4 groups)

Build in numbered order. The grouping is the key sequencing principle: **chrome-bearing screens before chrome-consuming screens**.

### Group 1 — Foundation chrome (build first; 10 screens)

These establish the most-reused visual chrome. Get them right; everything downstream inherits.

1. **SI-RPT-002** — Brand Owner Cross-Location Dashboard *(dashboard tile chrome; P2B-005 widget; Pending-GR drill pane)*
2. **SI-INF-005** — Audit Trail Viewer *(every CC-AUDIT-LINK destination)*
3. **SI-INF-001** — Unified Approval Inbox *(bulk-action list chrome reused by every approval surface)*
4. **SI-RPT-005** — Report Detail Runner *(report runner chrome reused by every report)*
5. **SI-ACC-003** — Trial Balance *(first report instance; account-tree report layout)*
6. **SI-ACC-013** — Integration Status Dashboard *(dashboard chrome reused by ACC-011/POS-003)*
7. **SI-INV-001** — Real-Time Stock View *(stock-grid chrome reused by INV-002/003)*
8. **SI-PUR-003** — PO Detail & Lifecycle Status *(canonical 5-status lifecycle chrome reused across PO/transfer/challan)*
9. **SI-MDM-003** — Product Master CRUD *(heavy form chrome reused by recipe/POS/inventory)*
10. **SI-MDM-004** — Material Enablement Matrix *(enablement-grid chrome gating every stock movement)*

### Group 2 — Workflow-weighted (mandatory reason / journal-fire / atomic state; 10 screens)

11. **SI-DSP-010** — B2B GST Closure *(Stage 2 journal + IRN paste atomic; FR78 hero)*
12. **SI-DSP-012** — B2B Credit Note Creation *(conditional two-stage reversal)*
13. **SI-PRO-011** — In Progress Transition Confirm *(atomic deduction + COGS journal fire)*
14. **SI-PRO-008** — Pending GR Override *(P2B-005 warn-and-log canonical)*
15. **SI-PRO-004** — Ingredient Substitution Flow *(P2B-005 sibling; mandatory reason)*
16. **SI-PUR-009** — Vendor Credit Note Issuance *(FR47b workflow with cumulative validation)*
17. **SI-INV-012** — Goods Receipt Rejection at QC *(triggers vendor CN; reason workflow)*
18. **SI-PUR-004** — PO Approval *(Brand Owner approval action; threshold logic)*
19. **SI-ACC-014** — Manual Journal Voucher *(mandatory reason + journal fire)*
20. **SI-USR-006** — Permission Grant / Revoke Flow *(P2B-003 mandatory reason+expiry)*

### Group 3 — Per-persona daily drivers (5 screens)

21. **SI-INV-014** — Closing Inventory Entry — POS Daily *(POS Staff mobile daily routine)*
22. **SI-INV-010** — Goods Receipt Entry — PO-Driven *(Procurement + Store Manager joint hero; yield factor)*
23. **SI-DSP-003** — Dispatch Receipt Sign-off *(Dispatch Staff mobile sign-off)*
24. **SI-REC-003** — Recipe Edit *(Kitchen Manager recipe authoring; cost cascade)*
25. **SI-INV-016** — Closing Inventory Cluster Review *(Cluster Manager cluster-overview)*

### Group 4 — Specialised dashboards & dual-surface partners (3 screens)

26. **SI-ACC-010** — FCCC Financial Framing *(Implicit FCCC dual-surface — financial half)*
27. **SI-RPT-006** — FCCC Operational Analytics Framing *(Implicit FCCC dual-surface — operational half; build immediately after #26 to validate cross-link + shared drill state)*
28. **SI-INV-007** — Paired Brand-Store Cross-Cluster Transfer *(P2B-002 paired-bundle pattern; specialised approval object)*

---

## 7 Tier 2 batching strategy (58 screens)

Don't dispatch one subagent per Tier 2 screen — too granular. Batch by epic; one subagent per epic produces all that epic's Tier 2 screens in a single pass, importing the shell components built during Tier 1.

Suggested batches:

| Batch | Epic | Tier 2 count | Recommended after Tier 1 group |
|---|---|---|---|
| B1 | MDM | 4 | Group 1 (MDM-003, MDM-004 done) |
| B2 | USR | 5 | Group 2 (USR-006 done) |
| B3 | INF | 6 | Group 1 (INF-001, INF-005 done) |
| B4 | INV | 6 | Group 3 (INV-001, INV-007, INV-010, INV-012, INV-014, INV-016 done) |
| B5 | PUR | 3 | Group 2 (PUR-003, PUR-004, PUR-009 done) |
| B6 | REC | 5 | Group 3 (REC-003 done) |
| B7 | PRO | 8 | Group 2 (PRO-004, PRO-008, PRO-011 done) |
| B8 | DSP | 5 | Group 2 (DSP-003, DSP-010, DSP-012 done) |
| B9 | POS | 3 | Group 1 (ACC-013 done — POS-003 reuses its chrome) |
| B10 | ACC | 5 | Group 2 (ACC-003, ACC-010, ACC-013, ACC-014 done) |
| B11 | HRM | 4 | Group 2 (USR chrome reused) |
| B12 | RPT | 4 | Group 4 (RPT-002, RPT-005, RPT-006 done) |

Per-batch subagent prompt template lives at `docs/superpowers/plans/2026-MM-DD-phase-2c-tier2-batch-template.md` (to be drafted during execution).

---

## 8 Tier 3 — pattern documentation (3 screens)

Write as markdown pages, not React components:

- `mockups/src/patterns/SI-INF-006-activity-timeline.md` — canonical embedded usage with code snippet showing `<ActivityTimeline entityRef="…" />` invocation; references screens that use it
- `mockups/src/patterns/SI-INF-010-reverse-cancel.md` — canonical confirmation pattern with code snippet showing `<ReverseCancelDialog action="…" reason={true} />` invocation
- `mockups/src/patterns/SI-RPT-001-morning-briefing.md` — meta-screen describing per-role tile composition; lists which dashboard tile each persona sees, drawn from the actual SI-RPT-002/003 components

Each pattern doc gets a `ScreenIndex.tsx` entry that opens the markdown in a side panel (use `react-markdown` or similar).

---

## 9 Index-only (23 screens)

For each, add a one-line entry in `mockups/src/pages/ScreenIndex.tsx`:

```tsx
{ id: 'SI-INV-002', name: 'Department Stock Detail', parent: 'SI-INV-001',
  note: 'Drill-down view; shares 90% of stock-grid chrome with parent.' }
```

Clicking the entry shows a stub page: parent screen ID + link, this screen's inventory entry quote, and a "no bespoke mockup" note. Engineers extrapolate from the parent + the inventory schema fields.

Index-only screens by epic:
- MDM: SI-MDM-006
- USR: SI-USR-003, SI-USR-004
- INV: SI-INV-002, SI-INV-006, SI-INV-011, SI-INV-015
- PUR: SI-PUR-002, SI-PUR-006, SI-PUR-008
- REC: SI-REC-006, SI-REC-008
- DSP: SI-DSP-001, SI-DSP-005, SI-DSP-009, SI-DSP-011
- ACC: SI-ACC-004, SI-ACC-005, SI-ACC-006, SI-ACC-007, SI-ACC-009, SI-ACC-011
- HRM: SI-HRM-004
- RPT: SI-RPT-008, SI-RPT-009

---

## 10 Vite harness scaffold spec (Task 0 of execution)

One-time scaffold task. Single subagent dispatch.

### 10.1 Dependencies (`package.json`)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.460.0",
    "@fontsource/inter": "^5.1.0",
    "recharts": "^2.13.0",
    "react-markdown": "^9.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 10.2 `tailwind.config.ts` — derived mechanically from DESIGN.md

Map every M3 underscore token from DESIGN.md §5.1 + every status_* token from §6.1 to a Tailwind utility. Map type scale §7.2 (`Display L`, `Body M`, etc.) to text-* utilities with explicit size/weight/letter-spacing/line-height. Map §8.2 radius tokens (`radius-md`, `radius-lg`, `radius-xl`, `radius-pill`) to `borderRadius` extension. Spacing uses Tailwind's default 4 px scale (matches DESIGN.md §8.1).

The translation is mechanical — single subagent task at scaffold time, never edited by hand thereafter.

### 10.3 `src/tokens.ts` — TS-named exports for runtime use

For things Tailwind classes can't express directly (chart fill colours, computed contrast pairs, spacing references in inline styles for SVG), expose a typed `tokens` object:

```ts
export const tokens = {
  primary: '#00525b',
  surface_container_lowest: '#ffffff',
  // ... all M3 tokens
  status_draft: { bg: '#e7e8e9', fg: '#3f484a', icon: 'PencilLine' },
  status_confirmed: { bg: '#00525b', fg: '#ffffff', icon: 'Check' },
  // ... all status_* tokens
} as const
```

### 10.4 `vite.config.ts`

Standard Vite + React + Tailwind 4 plugin setup. No exotic config needed.

### 10.5 Routing

`src/main.tsx` mounts a `BrowserRouter` with one `<Route path="/SI-XXX-###" />` per screen ID, plus `/` → `<ScreenIndex />`.

### 10.6 `globals.css` — runtime token wiring (canonical layer)

Single file declares M3 tokens at `:root`, aliases shadcn's expected variable names, defines tenant-accent override mechanism, and ships the empty `.dark` stub. Sketch:

```css
@import "tailwindcss";

@theme {
  /* DESIGN.md M3 tokens — canonical (§5.1.x) */
  --color-primary: #00525b;
  --color-primary-container: #1f6b75;
  --color-on-primary: #ffffff;
  --color-surface: #f8f9fa;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f3f4f5;
  --color-surface-container: #edeeef;
  --color-surface-container-high: #e7e8e9;
  --color-surface-container-highest: #e1e3e4;
  --color-surface-variant: #e1e3e4;
  --color-surface-tint: #1a6872;
  --color-on-surface: #191c1d;
  --color-on-surface-variant: #3f484a;
  --color-outline: #6f797a;
  --color-outline-variant: #bfc8ca;
  /* … all M3 tokens from DESIGN.md §5.1.1–§5.1.6 */
  /* … all status_* tokens from DESIGN.md §6.1 (19 tokens including
        the 7 added in Phase-2b close-out) */
  /* … sidebar tokens from DESIGN.md §5.1.5 */
  /* … semantic functional tokens from DESIGN.md §6.4 */

  /* Tenant accent slot — DESIGN.md §3.
     Default = Wild Sugar peach. Future tenants override at brand boot via :root[data-tenant="…"] */
  --color-tenant-brand-accent: #F5B17A;
}

/* shadcn alias layer — points shadcn's expected variable names at our M3 tokens */
:root {
  /* Confirmed mappings (per Phase 2c plan §13 Q6) */
  --background: var(--color-surface);
  --foreground: var(--color-on-surface);
  --card: var(--color-surface-container-lowest);    /* §5.4 "soft lift" */
  --card-foreground: var(--color-on-surface);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-on-primary);
  --secondary: var(--color-secondary);
  --secondary-foreground: var(--color-on-secondary);
  --destructive: var(--color-error);
  --destructive-foreground: var(--color-on-error);
  --ring: var(--color-primary);                     /* §9.3 focus ring spec */

  /* §13 Q6 pre-resolved mappings */
  --popover: var(--color-surface-container-lowest); /* solid default; glass = opt-in per §5.3.1 */
  --popover-foreground: var(--color-on-surface);
  --muted: var(--color-surface-container);          /* "active elements" semantic */
  --muted-foreground: var(--color-on-surface-variant);
  --accent: var(--color-surface-container-high);    /* hover/pressed state */
  --accent-foreground: var(--color-on-surface);

  /* §5.2 no-line rule — neutralize shadcn's default border presence.
     Re-enable per-component for focus rings (§9.3) and severity 4-px left pips (§6.1). */
  --border: transparent;
  --input: var(--color-outline-variant);            /* used at 15-20% opacity per §9.3 */

  /* Radius defaults — DESIGN.md §8.2 */
  --radius: 0.5rem;                                 /* radius-md (8 px) baseline; per-component
                                                        overrides for radius-lg/xl/pill via Tailwind utils */
}

/* Dark mode reserved.
   Populate ONLY when DESIGN.md adds a dark palette section.
   Do NOT fill in piecemeal during Phase 2c — dark-mode token design needs
   explicit DESIGN.md decisions on:
   - dark-mode surface hierarchy (5 layers in dark palette)
   - status_* contrast pairs in dark mode (each of the 19 tokens needs a
     dark variant or explicit "no change" decision)
   - sidebar chrome behaviour (already dark — does it become lighter?)
   - FCCC dual-surface chart fill variants
   Until then, fnb-erp ships light-only. The selector exists so the
   wiring doesn't refactor when dark-mode lands. (Phase-3 work, not Phase-2c.) */
.dark {
  /* Empty until DESIGN.md ships dark palette */
}
```

### 10.7 Six-component wrapper / override package (the §5.2 + §5.4 exception list)

shadcn primitives ship with conventions that contradict DESIGN.md §5.2 (no-line rule) and §5.4 (5-layer surface hierarchy). The CSS-variable aliasing in §10.6 handles the token layer; these 6 wrappers / overrides handle the component-behaviour layer. Wrappers live in `mockups/src/shell/`; shadcn primitives in `mockups/src/components/ui/` remain unmodified.

| Component | DESIGN.md rule | Wrapper / override approach |
|---|---|---|
| **`Card`** | §5.4 — `surface_container_lowest` "soft lift"; §5.2 — no border | `<Card>` wrapper sets background via `--card` alias; `--border: transparent` in `globals.css` neutralizes default border. Wrapper enforces no `border` class at variant level. |
| **`Separator`** | §5.2 — 1-px dividers prohibited | Do NOT pull shadcn `Separator`. Use `<SectionShift>` wrapper that renders a 4-px tonal background change between sections. Hook bans `<Separator>` import. |
| **`Table`** | §5.2 + §9.2 — row striping via `surface_variant`, no horizontal divider lines | `<Table>` wrapper applies `divide-y-0` + alternating-row class; ban `divide-y` in screens via hook. |
| **`Input`** | §5.1.3 — fill = `surface_container_highest`; §9.3 — ghost border at 15-20% opacity only on focus/error, never default | `<Input>` wrapper sets fill via Tailwind class; default border transparent; `focus-visible:` and `aria-invalid:` apply 2-px ring per §9.3. |
| **`Button` outline variant** | §5.2 — no opaque outlines for routine buttons | Skip the shadcn `outline` variant entirely; substitute a "ghost" variant that uses tonal hover background. Document in shell README. |
| **`Popover` / `DropdownMenu` / `Tooltip`** | §5.3 — solid default per §10.6 alias; glassmorphism opt-in per §5.3.1 | Wrapper exposes a `variant="solid" \| "glass"` prop; "solid" uses `--popover` alias (default), "glass" applies the §5.3 backdrop-blur pattern. |

### 10.8 Pre-commit hook — token enforcement

Hook lives at `mockups/.git-hooks/pre-commit` (configured via `git config core.hooksPath mockups/.git-hooks`). Ships with snapshot test cases at `mockups/.git-hooks/test-cases.md` so future regex edits don't regress the rules.

**Hook scope:** files under `mockups/src/screens/`, `mockups/src/shell/`, `mockups/src/dev/`, `mockups/src/lib/`. **EXCLUDES** `mockups/src/components/ui/` (shadcn primitives — neutralized via `--border: transparent` in `globals.css`, not via source modification).

**Bans (fail commit):**
1. Hex literals `#[0-9a-fA-F]{3,8}` in `.tsx` files
2. Invented tokens: `font-body|font-display|border-default|space-md|space-lg`
3. Material Symbols / Material Icons via either:
   - Imports: `from\s+['"](@?material-(symbols|icons)|@mui/icons)`
   - Class names: `material-icons|material-symbols|ms-(outlined|rounded|sharp)|mso-`
4. Inline `font-family:` declarations not equal to `Inter`
5. Status references not in the canonical 19-token list (FR67a status_provisional + the 18 others enumerated in DESIGN.md §6.1)
6. `<Separator>` import (use `<SectionShift>` per §10.7)
7. `tenant_brand_accent` used in any state / status context (per DESIGN.md §3 — accent is decorative-only, never status)
8. **Border / divide patterns** — bans the bare class `border` and directional siblings (`border-t`, `border-b`, `border-r`, `border-x`, `border-y`, `divide-y`, `divide-x`) **EXCEPT**:
   - When preceded by `focus:`, `focus-visible:`, or `aria-invalid:` modifiers (focus rings + error states per §9.3)
   - The narrow-pip family `border-l-{2,4,8}` (always allowed — §6.1 status pip patterns)
   - `border-2` only when paired with `focus-visible:` modifier

**Snapshot test cases** (committed as `mockups/.git-hooks/test-cases.md`):
```
✓ allow:  className="border-l-4 border-tertiary"        (4-px left pip per §6.1)
✓ allow:  className="border-l-2 border-error"           (narrow pip)
✓ allow:  className="focus:border focus:border-primary" (focus ring per §9.3)
✓ allow:  className="aria-invalid:border aria-invalid:border-error"
✗ ban:    className="border border-outline_variant"     (sectioning border)
✗ ban:    className="border-t border-outline_variant"   (top divider)
✗ ban:    className="divide-y divide-outline_variant"   (sibling divider)
✗ ban:    className="border-2 border-outline"           (heavy outline, not a focus ring)
```

The hook author writes these cases as a runnable shell test (or simple bash snippet) alongside the script.

### 10.9 `mockups/src/dev/ComponentsIndex.tsx` — permutation viewer

Single Vite-rendered route at `localhost:5173/_dev/components` that mounts permutation grids for shell components. No deps beyond what's already in `package.json`. Underscore prefix on the route (`_dev`) marks it as internal/scaffolding.

**Per-component grid coverage targets:**

- `<StatusPill>` — all 19 `status_*` variants in a single grid (highest-value view; eyeball contrast and consistency in one place)
- `<Button>` — variant × size matrix (default, primary, secondary, ghost, destructive × sm, md, lg)
- `<Card>` — with/without header, with/without action, with/without status badge, with/without footer
- `<ApprovalInboxCard>` — pending / approved / rejected / batch states + scope variants
- `<DashboardTile>` — KPI / sparkline / count / mixed
- `<OverrideWidget>` — variance / override / mixed
- `<DraftPill>` — draft / saving / saved transitions
- `<TRNDisplay>` — DC / CN / VCN / JV / IRN format variants
- `<ProvisionalFlag>` — inline / chart-series / tile / PDF format variants
- `<FCCCDualSurface>` — financial half / operational half / cross-link state
- … (one row per shell component)

**Cost:** ~30-80 lines per component grid. For 21 shell components, ~600-1500 lines of tooling code.

**Deletability:** if Storybook ever lands or ScreenIndex grows component coverage, this folder retires cleanly. ScreenIndex links to it via a small "developer view" affordance in the footer.

### 10.10 DESIGN.md edits to land in scaffold session

Three additive edits to DESIGN.md, all in a single diff with the scaffold commit:

1. **§5.3.1 Glassmorphism opt-in path** — formalize the default-solid / opt-in-glass pattern that the §10.6 alias already implements:
   > Default for floating elements (popovers, dropdowns, tooltips) is solid `surface_container_lowest`. Glassmorphism per §5.3 is opt-in via `variant="glass"` on the `<Popover>` wrapper, reserved for high-signal moments: dashboard hero cards, tenant-onboarding overlays, command palette. Performance note: backdrop-blur on every popover taxes slow store-floor Android devices; default solid is the operationally-correct choice.
2. **§10.5 Animation library policy** — library hierarchy + GSAP carve-out + no-entrance-on-data-tables:
   > Tailwind transitions and Radix primitives by default. Motion (motion.dev) for React-specific layout animations and gestures. GSAP reserved for Wild Sugar marketing site (separate repo), ERP onboarding/login, and dashboard chart reveals only — NEVER inventory, procurement, accounting, or transaction screens. No entrance animations on data tables, forms, or dashboards. `prefers-reduced-motion: reduce` is honoured per §10.3.
3. **No revision to §5.3 body** — verified neutral/descriptive; §5.3.1 lands clean.

### 10.11 `claude.md` edits to land in scaffold session

Two updates in a single diff:

1. **`## Current phase` update** — currently stale at "Phase 2a — PRD review"; update to current state (Phase 2c — visual mockups, scaffold landed; Tier 1 build in progress per the §6 build order).
2. **New `## Design token enforcement (Phase 2c+)` section** — generation-side rules that complement the pre-commit hook. Contents include: no hex literals, only Lucide imports AND class names (Material Symbols banned via both paths), only Inter font-family, only canonical 19 `status_*` tokens with "stop and surface as gap" rule for invented states, no `border` Tailwind class for sectioning per §5.2 (allow-list per §10.8), animation policy per §10.5, `tenant_brand_accent` decorative-only never status. Pre-commit hook is the safety net; CLAUDE.md generation rules shape first-pass output so the hook rarely fires.

### 10.12 Acceptance for Task 0 (scaffold session close)

- `cd mockups && npm install && npm run dev` starts the server at `localhost:5173`
- `localhost:5173/` shows the empty ScreenIndex (placeholder rows for all 112 screens)
- `localhost:5173/_dev/components` shows the 19-variant `<StatusPill>` grid + at least 5 other shell-component permutation grids
- `localhost:5173/SI-RPT-002` shows a "not yet built" placeholder using the `<AppShell>` skeleton with sidebar (DESIGN.md §5.1.5 dark teal cockpit) and Wild Sugar tenant logo
- shadcn/ui CLI initialised with `components.json` + 6 wrapper components in `mockups/src/shell/` (`<Card>`, `<SectionShift>`, `<Table>` wrapper, `<Input>` wrapper, `<Button>` ghost-variant overlay, `<Popover variant>`)
- `globals.css` declares all M3 tokens + shadcn alias layer + tenant accent + empty `.dark` stub with anti-drift comment
- Pre-commit hook installed (`git config core.hooksPath mockups/.git-hooks`); snapshot test cases in `mockups/.git-hooks/test-cases.md`
- DESIGN.md ships §5.3.1 + §10.5 in same commit as scaffold (single coherent diff)
- `claude.md` ships `## Design token enforcement (Phase 2c+)` section + `## Current phase` update in same commit

After Task 0 lands, Tier 1 build can begin.

---

## 11 Acceptance criteria (per tier)

### Tier 1 acceptance (per screen)

- [ ] All 12 inventory schema fields are visibly satisfied (Purpose, Data displayed bullets, User actions bullets, Cross-cutting CC-* patterns, Source FRs, Source journey moments)
- [ ] Only DESIGN.md tokens used (verified by `grep` for hex literals; should return 0 in screen file)
- [ ] All cited CC-* patterns visible as actual shell-component instances
- [ ] Voice matches D2C-002 (operational-confident; ₹ rule; reason prompts use "Why is this happening?" pattern)
- [ ] Mobile-first screens have ≥44 px tap targets, bottom-sheet modals
- [ ] WCAG 2.1 AA pass (`design:accessibility-review` skill on the JSX file): contrast pairs, keyboard tab order, focus rings, colour-not-only status indication
- [ ] Realistic Wild Sugar / Indian F&B sample data (recipes like "Mutton Galouti Kebab"; vendors like "Bharat Spice Traders"; ₹ amounts with Indian grouping)
- [ ] `design:design-critique` skill returns ✅ APPROVED (or all flagged issues resolved)

### Tier 2 acceptance (per screen)

- [ ] All 12 inventory schema fields satisfied
- [ ] Only DESIGN.md tokens used
- [ ] Reuses Tier-1-built shell components where applicable (no duplicated chrome)
- [ ] Combined spec+quality critique pass (single critique chat per screen, not separate accessibility audit)
- [ ] Realistic sample data

### Tier 3 acceptance (per pattern doc)

- [ ] Documents the canonical pattern usage with a code snippet
- [ ] Lists every screen that uses the pattern (cross-reference inventory)
- [ ] No bespoke layout / styling — the pattern lives in the shell components, the doc just describes how to invoke

### Index-only acceptance

- [ ] Entry present in `ScreenIndex.tsx` with parent reference and one-line note explaining the shared chrome
- [ ] Stub route returns the "no bespoke mockup; see {parent} + inventory entry" page

---

## 12 Skills to apply (per phase of execution)

| Phase | Skill | Use |
|---|---|---|
| Kickoff | superpowers:brainstorming | Resolve §13 open questions before any code |
| Plan firming | superpowers:writing-plans | Convert each Tier 1 group into a numbered task plan |
| Per-screen build | superpowers:subagent-driven-development | Dispatch implementer subagent per Tier 1 screen / per Tier 2 batch |
| Token enforcement | superpowers:verification-before-completion | Run `grep` for hex literals + Tailwind class audit before claiming done |
| Per-screen critique | design:design-critique | Run on the JSX file after each Tier 1 screen builds |
| Tier 1 only | design:accessibility-review | WCAG 2.1 AA audit on canonical surfaces |
| Microcopy | design:ux-copy | Voice-check every label, button, error, empty state |
| Phase close | design:design-handoff | Generate per-screen handoff specs to `_planning/handoff/` for Phase 3a engineers |

---

## 13 Open kickoff questions (resolve via superpowers:brainstorming before scaffolding)

1. **Wild Sugar tenant render fidelity** — DESIGN.md §3 shows tenant accent (peach `#F5B17A`) at login, sidebar logo, B2B PDF headers. Confirm the mockups should render Wild Sugar branding throughout (not generic-grey-placeholder). Decision: which screens carry the tenant accent vs the operational palette?
2. **Sample-data realism budget** — Should we build a comprehensive `sample-data.ts` (50 recipes, 200 menu items, 500 PO history rows, 1000 inventory positions) so dashboards/charts feel real? Or sketch-level (3-5 of each)? Affects Tier 1 dashboard fidelity heavily.
3. **Mobile vs desktop variants for `responsive-equal` screens** — When the inventory says `responsive-equal`, do we build BOTH variants (desktop tab + mobile tab in the same route) or one with breakpoint-driven responsive layout? Decision affects screen-file count.
4. **Static export hosting** — Will mockups be deployed to Vercel/Netlify/Cloudflare Pages for stakeholder review? If yes, set up CI from this branch; if no, screenshots-only handoff.
5. **Iteration cadence** — All 28 Tier 1 in one sprint, or persona-by-persona spread over multiple sprints? Affects branch strategy and PR cadence.

6. **shadcn ↔ DESIGN.md token reconciliation specifics** — three sub-decisions are PRE-RESOLVED via the Phase 2c-prep web review (2026-05-05). Brainstorming session confirms-and-moves rather than re-debates:
   - **`--popover` → `surface_container_lowest` solid default** (RESOLVED — performance argument re: backdrop-blur on slow store-floor Android devices; glass = opt-in via §5.3.1 for high-signal moments only)
   - **`--muted` → `surface_container`** (RESOLVED — matches §5.1.3 "active elements" semantic)
   - **`--accent` → `surface_container_high`** (RESOLVED — hover/pressed state per §5.1.3; explicitly NOT `tenant_brand_accent` per §3 guard rail)

   Three sub-decisions still OPEN for Session 1 confirmation:
   - **6-component wrapper pattern** — composition vs CVA override for the §10.7 exception list (`<Card>`, `<SectionShift>`, `<Table>`, `<Input>`, `<Button>` ghost variant, `<Popover variant>`). Recommendation: thin composition wrappers in `mockups/src/shell/`, no CVA gymnastics. Confirm.
   - **Hook scope confirmation** — `mockups/src/components/ui/` excluded from token-enforcement hook (shadcn primitives untouched). Confirm.
   - **Dark-mode selector convention** — `.dark` (shadcn / next-themes default) vs `[data-theme="dark"]`. Recommendation: `.dark` to follow shadcn upstream. Confirm.

   Tailwind v4 target with exact-version pinning (no caret) — confirm at scaffold time.

---

## 14 Phase-3a deferred items (do NOT design these in Phase 2c)

Tagged `[→ Phase 3a]` inline in the screen inventory; these need architecture context (routing, state machine, data fetching) before visual design:

- Force-override roster-assignment flow (SI-HRM-005 sub-affordance)
- Inventory-movement-detail surface (RPT drill target)
- Per-row closing-inventory variance entry (RPT drill target)
- Dedicated wastage entry surface (RPT drill target)
- Per-record POS sales drill-down (RPT drill target)

For these, mockups point to nearest-proxy screens already in scope (e.g. SI-INV-001 for movement detail, SI-INV-013 for wastage entry). The proxy screens get a `Notes:` mention that the dedicated drill is Phase-3a.

---

## 15 Single residual Phase-2c interaction-design item

Quiet-hours / muted-notification visual treatment on SI-INF-003 (Notification Preferences). This is NOT a token gap (DESIGN.md is clean); it's an interaction-design affordance that should be resolved during the SI-INF-003 mockup pass via design critique iteration. Acceptance: a treatment that visually distinguishes "notification muted during quiet hours" from "notification disabled entirely" using existing tokens (likely `surface_container_high` for muted vs `surface_container_highest` for disabled, with iconography difference).

---

## 16 Session breakdown — Phase 2c is multi-session (SCOPED DOWN per 2026-05-05 re-sequencing)

**Originally specced 8–12 sessions with all 89 bespoke mockups built upfront. Revised to 3 sessions with 13 foundation mockups; remaining ~75 mockups move into Phase 4 epic-by-epic territory** (built just-in-time per epic alongside that epic's backend + frontend code). See `_planning/06-phase-roadmap.md` for canonical phase sequence.

**Gating:** Phase 2c executes ONLY AFTER Phase 3a Architecture closes (`_planning/architecture.md` lands). Mockup design choices are downstream of architecture decisions on real-time strategy, file storage, auth flow, multi-tenancy data wiring, API surface, optimistic update patterns.

| Session | Scope | Output |
|---|---|---|
| ~~**2c-S1** Kickoff~~ | ~~Brainstorming the 5 §13 open questions only~~ | ✅ DONE in source session 2026-05-05; decisions captured in §19. Q1–Q6 closed (Q6 added during web-review lock). |
| **2c-S2** Scaffold | Task 0 per §10 expanded (§10.6 globals.css + §10.7 6-wrapper package + §10.8 hook + §10.9 ComponentsIndex + §10.10 DESIGN.md §5.3.1/§10.5 + §10.11 claude.md edits in same diff) + 21 shell components | `mockups/` directory; `npm run dev` renders empty ScreenIndex AND `_dev/components` permutation viewer; pre-commit hook live; first Vercel preview URL |
| **2c-S3** Tier 1 Group 1 (foundation) | 10 chrome-bearing hero screens (SI-RPT-002, INF-005, INF-001, RPT-005, ACC-003, ACC-013, INV-001, PUR-003, MDM-003, MDM-004) | Foundation chrome locked; design critique passes per screen; cross-screen consistency validated |
| **2c-S4** Tier 1 Group 4 + selected G2 | 3 dual-surface partners (ACC-010 + RPT-006 FCCC pair, INV-007 paired transfer) + 2–3 most-novel workflow screens (DSP-010 GST closure, PRO-011 In Progress transition, optionally PUR-009 Vendor CN) | Most-complex/novel patterns visually explored before code; design system validated against the hardest cases. Phase 2c closes here. |
| **(Phase 4 takes over)** | Tier 1 Group 2 (8 workflow screens) + Tier 1 Group 3 (5 daily drivers) + all 58 Tier 2 + 3 Tier 3 + 23 Index entries | Built epic-by-epic during Phase 4. Each epic's session = backend code + frontend code + mockups for that epic's remaining screens (just-in-time, not upfront). |

**Phase 2c new total: 3 sessions of mockup work** (down from 10 in the original plan), producing 13 mockup screens (down from 89). The reduction is intentional: foundation chrome + most-novel patterns is enough mockup foundation to validate the design system; remaining standard CRUD/list/admin screens are repetitive enough that mockup-as-you-build during Phase 4 is more efficient and avoids stale-mockup risk.

**Per-session checkpoint principle:** each session ends at a commit-and-resumable checkpoint; the next session starts fresh with a self-contained prompt. If S3 burns context faster than expected, split into S3a (Group 1 first 5) + S3b (Group 1 last 5). The 3-session estimate assumes clean execution; budget for 1 extra session as float.

**Stakeholder review:** Vercel preview URL (per §19 Q4) updates on every commit. Call review sessions reactively after S3 (foundation chrome live) and S4 (most-novel patterns live); no pre-scheduled checkpoints.

---

## 17 Session 1 kickoff prompt (paste in fresh Claude Code session)

```
Phase 2c — Visual mockups. Session 1: Kickoff brainstorming only.

CLAUDE.md auto-loaded. Update "Current phase" to Phase 2c as a first
concrete edit.

Working branch: phase-2c-prep/mockup-plan exists locally with the
build plan committed. Check it out first; pull if needed. (If the
branch was pushed and merged before you start, pull main and create
a new branch phase-2c/visual-mockups.)

## Required reading (in order)

1. CLAUDE.md
2. docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md
   — read end-to-end; this is THE plan that drives every Phase 2c
   session. Note especially §13 (open kickoff questions — this
   session's scope), §16 (session breakdown — your session is S1),
   §17 (this prompt).
3. DESIGN.md §3 (tenant-brand token slot), §6 (status palette),
   §8.4 (mobile/desktop), §15 (accessibility)
4. _planning/05-screen-inventory.md §4 (roles & scope) for orientation

## This session's scope (DO NOT exceed)

ONE thing: superpowers:brainstorming on the 6 open questions in §13
of the plan.

Q1–Q5 are fully open. Q6 has THREE sub-decisions pre-resolved via the
Phase 2c-prep web review (2026-05-05) — popover solid default, muted
→ surface_container, accent → surface_container_high. Q6's session
job is to confirm-and-move on the remaining three sub-decisions
(6-wrapper pattern, hook-scope exclusion of components/ui/, dark-mode
selector convention) — not to re-debate the pre-resolved picks.

The 6 questions (verbatim from §13):

1. Wild Sugar tenant render fidelity — which screens carry the tenant
   accent vs the operational palette?
2. Sample-data realism budget — comprehensive (50 recipes, 200 menu
   items, 500 PO history rows, 1000 inventory positions) vs sketch-
   level (3-5 of each)?
3. Mobile vs desktop variants for `responsive-equal` screens — both
   variants in the same route, or one with breakpoint-driven
   responsive layout?
4. Static export hosting — Vercel / Netlify / Cloudflare Pages /
   none?
5. Iteration cadence — all 28 Tier 1 in one push, or persona-by-
   persona spread across multiple weeks?
6. shadcn ↔ DESIGN.md token reconciliation specifics — confirm the
   3 still-open sub-decisions per §13 Q6 (the 3 mapping picks are
   PRE-RESOLVED, do not re-debate).

Run brainstorming honestly on Q1–Q5: present trade-offs, ask the
user, do NOT decide unilaterally. For Q6: confirm the recommended
answers on the 3 still-open sub-decisions; if the user wants to
revisit a pre-resolved mapping, surface it explicitly as a scope
expansion rather than silently re-deciding.

After each question is answered, capture the decision verbatim into
a NEW §19 "Kickoff decisions" section of the plan doc with rationale
and any follow-up implications. Commit per decision OR batch at
session end.

When all 6 questions are answered AND captured in §19, STOP.

Surface a fresh-session prompt for Session 2 (Vite harness scaffold
per §10), incorporating any §18 decisions that affect scaffolding
(e.g. if hosting is Vercel, mention it in the scaffold prompt).

## Out of scope this session
- No npm install
- No mockups/ directory creation
- No code, no JSX, no Tailwind config
- No subagent dispatching beyond brainstorming context
- No Tier 1 screen design

## Auto-mode posture
The source session that prepared this plan was in auto mode. Honour
the user's posture in this session — likely also auto, but
brainstorming is INHERENTLY interactive, so expect interruptions and
real conversation. Auto mode does not mean unilateral decisions on
brainstorming questions.

Begin with brainstorming.
```

---

## 18 Self-review (before kickoff)

**Tiering arithmetic:** 28 + 58 + 3 + 23 = 112 ✓ (matches inventory total)

**Per-epic spot-check:** Epic counts sum correctly (MDM 7, USR 8, INF 10, INV 16, PUR 9, REC 8, PRO 11, DSP 12, POS 3, ACC 14, HRM 5, RPT 9 = 112)

**Build-order coverage:** every Tier 1 screen appears in exactly one of the 4 Groups (10 + 10 + 5 + 3 = 28) ✓

**No invented IDs:** every screen ID in tier tables matches a real entry in `_planning/05-screen-inventory.md` (verifiable via `grep -E '^#### SI-' _planning/05-screen-inventory.md`)

**No invented patterns:** every CC-* shell component in §2 matches a row in `_planning/05-screen-inventory.md` §3 catalogue (21 patterns)

**Session-breakdown realism check:** Phase 2b ran ~30 commits in one extended controller session and used substantial context. Phase 2c per-screen work generates real React+Tailwind code (denser than markdown), with critique loops, so the per-task context cost is 3–5× higher. The 8–12 session estimate assumes each session targets one of the §16 rows; if a session tries to span multiple rows, it will likely hit the CLAUDE.md 60-70% context ceiling mid-row and have to split anyway.

**Token reconciliation arithmetic:** 9 shadcn variables × 3 buckets — 6 clean aliases (`--background`, `--foreground`, `--card-foreground`, `--primary`, `--secondary`, `--destructive`, `--ring` family), 3 pre-resolved-ambiguous (`--popover`, `--muted`, `--accent`), 1 actively-neutralized (`--border` → `transparent` per §5.2 no-line rule). Plus 6-component wrapper package (§10.7) for behavioural overrides. Net effort: ~6 wrapper files vs forking ~50 shadcn primitives.

**Tooling decisions cross-check:** `magic` MCP fully disabled for fnb-erp (overlap with shadcn-ui MCP); Playwright MCP pre-installed for Session 3 onward; `gsap-skills` deferred to Session 5+; Storybook deferred indefinitely; `frontend-design` skill explicitly excluded from fnb-erp (Inter / Clinical Artisan conflict); Owl-Listener `designer-skills` deferred until `design:design-handoff` proves insufficient on a real handoff.

---

## 19 Kickoff decisions (Session 1 capture, 2026-05-05)

Session 1 ran in the same controller session as the §13 Q6 web-review lock (commit `d8333db`). Brainstorming surfaced 6 questions; all 6 decided this session. Each decision below carries the chosen option, rationale, and follow-up implications that land in Session 2 scaffold.

### Q1 — Wild Sugar tenant render fidelity → **A: Full Wild Sugar branding**

**Decision:** Render actual Wild Sugar peach (`#F5B17A`) and `logos/logo-full.png` / `logos/logo-nibble.png` at every surface specified by DESIGN.md §3 (login splash, sidebar logo area, B2B PDF headers, accountant export PDF headers, email headers, sidebar header desktop expanded). Operational chrome (teal-anchored `primary #00525b`) everywhere else. Tenant accent is decorative-only per §3 + §6 — never status / state.

**Rationale:** fnb-erp is single-tenant MVP per D2C-001; Wild Sugar IS the tenant for this product. The §3.3 future-tenant onboarding mechanism is architectural (logo + accent hex + display-name string), not visual — mockups don't need to demonstrate that abstraction. Stakeholder review benefits from seeing the actual product.

**Implications for Session 2 (scaffold):**
- `mockups/public/logos/` carries copies of `logo-full.png` and `logo-nibble.png` from project-root `/logos/`
- `globals.css` sets `--color-tenant-brand-accent: #F5B17A` per §10.6 spec
- `mockups/README.md` documents the tenant slot mechanism per §3.3 explicitly so a Phase-3a engineer doesn't misread the visual as "hardcoded to Wild Sugar"

### Q2 — Sample-data realism budget → **C: Tier-aware fixtures**

**Decision:** Comprehensive fixtures for anything Tier 1; sketch-level for Tier 2 lists / forms / admin; all consume a single typed fixture library at `mockups/src/lib/sample-data.ts`.

**Concrete sizes:**
- 30–40 recipes (Wild Sugar's ~8–10 menu categories; enough for FCCC menu-engineering matrix to populate all quadrants)
- 60–80 menu items (one realistic POS outlet)
- ~270 PO rows over 90 days (~3 POs/day; enough for 30-day sparkline trends + FR46 price-spike detection)
- 200–400 inventory positions (1 cluster × 4–6 locations × 50–80 SKUs)
- 15–20 vendors (mix of brand-scope + cluster-scope per Master Spec §2.7)
- 8–12 B2B customers (mix of Regular / Composition / Unregistered / Consumer for FR118/119 demonstration)
- 60 days of sales data
- 30 days of closing inventory entries

**Rationale:** Sketch-level breaks Tier 1 dashboards too visibly to be defensible (a sparkline with 3 data points is a triangle, not a sparkline). Comprehensive is overkill for Tier 2 list patterns. C is the middle that pays off across all 89 bespoke screens.

**Implications for Session 2 (scaffold):**
- Authoring estimate: ~1.5 days of fixture work, lands during scaffold session
- Authentic Indian F&B vocabulary mandatory: vendor names ("Bharat Spice Traders", "Mumbai Dairy Co", "Coastal Seafoods Pvt Ltd"), recipe names ("Mutton Galouti Kebab", "Hyderabadi Biryani", "Goan Pork Vindaloo") drawn from actual Wild Sugar menu categories; ₹ amounts in Indian grouping (`₹4,28,500` not `₹428,500`); cluster names like "Bandra-West Cluster" not "Region 1"; GST types per FR118 enum
- TypeScript `as const` exports, NOT JSON — type-safe, refactor-safe; engineers can reuse shapes verbatim in Phase-3 integration tests
- Single source of truth: every screen consumes from the same fixture lib; no per-screen data inlining

### Q3 — `responsive-equal` screens → **A: Single component with breakpoint-driven responsive**

**Decision:** One component file per `responsive-equal` screen. Tailwind responsive utilities (`md:`, `lg:`, `xl:`) drive variant rendering. Mobile width: stacked / card layout. Desktop width: multi-column / table.

**Standardized breakpoints:**
- `md` (768 px) = mobile → tablet flip
- `lg` (1024 px) = tablet → desktop flip
Per DESIGN.md §8.3 breakpoint definitions.

**Rationale:** Mirrors how engineers will actually build it; single-file = single source of truth (no drift between mobile / desktop variants); Tailwind responsive utilities are mature for parity flows; DevTools device mode covers per-screen review. Genuinely-different-flow cases are already handled by inventory-level splits (e.g., SI-INV-014 mobile POS daily vs SI-INV-016 desktop cluster review).

**Implications for Session 2 (scaffold):**
- `_dev/components` viewport toggle enhancement: render shell components at three fixed widths (375 / 768 / 1280 px) side-by-side using CSS-grid layout — confirms responsive behaviour without DevTools-toggling
- Watch-for during Tier 1 build: if any screen's `if (isMobile) … else …` logic appears more than 1–2 times, that's a signal the inventory should have split it into separate IDs. Surface as inventory-feedback if encountered.

### Q4 — Static export hosting → **A: Vercel free tier**

**Decision:** Vercel free tier, configured during Session 2 scaffold. Auto-deploy per commit on every branch; preview URL per PR; URL posted automatically to GitHub PR comments.

**Privacy posture:** Public preview URLs accepted. Mockups display Wild Sugar branding + sample Indian F&B data + product UI flow — none of which is competitively secret (planning artefacts already public on GitHub). Public mockup previews also signal commitment-to-quality and double as recruiting/talent material.

**Fallback if privacy posture changes:** Cloudflare Pages + Cloudflare Access (free basic-auth-style protection).

**Implications for Session 2 (scaffold):**
- `vercel.json` at repo root: `{ "rootDirectory": "mockups", "outputDirectory": "dist" }` — two lines
- GitHub OAuth + repo import + auto-detected Vite config — ~5 minutes UI setup
- Every commit on `phase-2c/visual-mockups` (or whatever the build branch becomes) auto-deploys → preview URL available immediately for stakeholder review and cross-side Claude review threads

### Q5 — Iteration cadence → **A: §16 plan as-is, reactive (not pre-scheduled) stakeholder review**

**Decision:** Tier 1 builds in 3 consecutive sessions (S3–S5) per §16 build order — Group 1 chrome-bearers → Group 2 workflow-weighted → Groups 3+4 daily-driver + dual-surface partners. Tier 2 batches by epic (S6–S8). Stakeholder review sessions called reactively when Vercel preview URLs land at natural milestones, not pre-scheduled checkpoints that interrupt momentum.

**Rationale:** Foundation chrome MUST come first; persona-by-persona discards chrome-reuse leverage and creates rebuild risk. Persona-complete review packets emerge naturally after Tier 1 + early Tier 2 batches without sacrificing chrome-reuse. Vercel preview URLs (per Q4) make any session-end a stakeholder-reviewable artifact, so reactive review is friction-free.

**Implications for Session 2 (scaffold):**
- §16 session breakdown unchanged — S2 (scaffold) → S3 (Tier 1 G1) → S4 (Tier 1 G2) → S5 (Tier 1 G3+4) → S6–S8 (Tier 2 batches) → S9 (Tier 3 + Index) → S10 (handoff specs + close)
- After each Tier 1 session lands, the closing prompt of that session surfaces a "preview URL available at vercel-…/SI-XXX-### — call a stakeholder review session if appropriate before proceeding" note

### Q6 — shadcn ↔ DESIGN.md token reconciliation → **All three sub-decisions confirmed as recommended**

**Q6.a 6-component wrapper pattern → thin composition wrappers (no CVA).** Each wrapper imports the shadcn primitive from `mockups/src/components/ui/`, applies DESIGN.md-correct defaults via Tailwind classes, re-exports. Composition wins for the 6-wrapper case (each has 2–3 variants at most); CVA gymnastics not needed. Concrete pattern lands in §10.7.

**Q6.b Pre-commit hook scope: `mockups/src/components/ui/` excluded.** Confirmed. shadcn primitives stay unmodified; DESIGN.md compliance enforced at the wrapper layer (`mockups/src/shell/`) which IS in scope. Keeps shadcn upgrades clean.

**Q6.c Dark-mode selector convention: `.dark`.** Confirmed. shadcn / next-themes default; one less config drift surface. Empty `.dark {}` stub ships with anti-drift comment per §10.6 spec.

**Plus three pre-resolved Q6 sub-decisions captured for completeness** (decided in web review 2026-05-05, locked at commit `d8333db`):
- `--popover` → solid `surface_container_lowest` default; glass = opt-in per §5.3.1
- `--muted` → `surface_container` (active elements semantic per §5.1.3)
- `--accent` → `surface_container_high` (hover/pressed state); explicitly NOT `tenant_brand_accent` per §3 guard rail

### Q7 (post-Session-1 follow-up) — Phase sequencing: Architecture-first, mockup-foundation-second

**Decision:** Phase 3a Architecture executes BEFORE Phase 2c mockup work. Phase 2c scoped down from 89 mockups across 8–12 sessions to 13 mockups across 3 sessions (foundation chrome + most-novel patterns). Tier 2 / Tier 3 / Index mockups move into Phase 4 epic-by-epic territory, built just-in-time per epic alongside that epic's backend + frontend code. Mockups are visual specification, not production code.

**Rationale:**
- Master Spec §11 OQs (real-time strategy, file storage, multi-tenancy, auth, API surface, background jobs, caching, search, monorepo, deployment) directly affect mockup design choices. Mockups built before architecture risk aspirational designs the architecture can't support, requiring rework.
- Solo non-technical founder velocity: 3 mockup sessions + 4–6 architecture sessions + epic-by-epic implementation gets to working software faster than 10 mockup sessions + architecture + implementation.
- The screen inventory (`_planning/05-screen-inventory.md`) is already the canonical specification. Phase 2c is a visual layer ON TOP of that, not a parallel comprehensive deliverable. Foundation chrome + most-novel patterns is enough.
- Cross-epic chrome consistency is preserved because Phase 2c S3 + S4 still locks the shared shell components before Phase 4 epic implementation begins.
- Mockup-as-you-build during Phase 4 keeps mockups fresh because they're paired with real code; mockups built upfront drift as architecture and code surface decisions.

**Implications for Phase 2c (this plan):**
- §1 (Status) updated with the gating note + scope-down acknowledgement
- §16 (Session breakdown) revised: S1 done (above), S2 scaffold gated by Phase 3a closure, S3 + S4 build the 13 foundation mockups, S5–S10 removed (work moves to Phase 4)
- §20 (Session 2 kickoff prompt) updated to acknowledge Phase 3a prerequisite

**Implications for Phase 3a (new phase, own plan):**
- Becomes the immediate next phase (not Phase 2c)
- Resolves Master Spec §11 OQ1–OQ8 from scratch + formally captures OQ9 (in-repo Vite/shadcn already chosen during Phase 2c-prep tooling review) + produces OQ10 column-mapping deliverable
- Decides "mockups visual reference vs production-code seed" relationship explicitly
- Lands `_planning/architecture.md` as canonical deliverable
- See `_planning/06-phase-roadmap.md` for canonical phase sequence

**Implications for Phase 4 (epic implementation):**
- Tier 1 Group 2 (8 workflow screens) + Tier 1 Group 3 (5 daily drivers) + all 58 Tier 2 + 3 Tier 3 + 23 Index entries all built here, just-in-time per epic
- Each epic's session = backend code + frontend code + remaining mockups for that epic (folded into one workflow per epic)
- Canonical Master Spec §10 epic order: MDM → USR → INF → INV → PUR → REC → PRO → DSP → POS → ACC → HRM → RPT

---

## 20 Session 2 kickoff prompt (paste in fresh Claude Code session — AFTER Phase 3a closes)

```
Phase 2c — Visual mockups. Session 2: Vite harness scaffold.

⚠ PREREQUISITE: Phase 3a Architecture must have closed before this
session runs. Verify _planning/architecture.md exists and Master
Spec §11 OQ1-OQ9 decisions have been captured. If not, STOP and
run Phase 3a first per _planning/06-phase-roadmap.md.

CLAUDE.md auto-loaded. Branch phase-2c-prep/mockup-plan (or whatever
its successor is) should be checked out; pull origin first.

The plan at docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md
is locked through Session 1 — all 6 §13 questions + Q7 re-sequencing
captured in §19. This session executes the scaffold per §10, with
architecture knowledge from _planning/architecture.md informing
specific scaffold choices (API client, routing, auth wiring stubs,
file-storage placeholder pattern).

## Required reading (in order)

1. CLAUDE.md
2. docs/superpowers/plans/2026-05-04-phase-2c-mockup-build.md
   — §10 (full scaffold spec, §10.6 globals.css, §10.7 6-wrapper
   package, §10.8 pre-commit hook, §10.9 ComponentsIndex, §10.10
   DESIGN.md edits, §10.11 claude.md edits, §10.12 acceptance) and
   §19 (Session 1 decisions that drive this session's behaviour)
3. DESIGN.md §5 (colour), §6 (status), §7 (typography), §8
   (spacing/breakpoints/radius), §11 (Lucide React)
4. _planning/05-screen-inventory.md §3 (CC-* catalogue, 21 patterns)

## This session's scope

Execute Task 0 per §10 of the plan. Concretely:

1. **Branch** — rename `phase-2c-prep/mockup-plan` to `phase-2c/visual-mockups`
   (or create the new branch off it). Push.
2. **Vite harness** — scaffold `mockups/` with Vite + React 18 +
   TypeScript + Tailwind v4 (exact version pin, no caret) +
   shadcn/ui + lucide-react + @fontsource/inter. `package.json` per
   §10.1; `vite.config.ts` per §10.4; `index.html`; `tsconfig.json`.
3. **shadcn init** — `npx shadcn@latest init`; `components.json`
   configured for Tailwind v4. Pull primitive set: Button, Card,
   Dialog, Input, Select, Table, Badge, Sidebar.
4. **`globals.css`** per §10.6 — M3 tokens at `:root` derived from
   DESIGN.md §5.1.x (mechanical translation; ALL tokens including
   the 7 added in Phase-2b close-out); shadcn alias layer mapping
   shadcn's expected variable names to our M3 tokens; tenant accent
   slot per §10.6; empty `.dark {}` stub WITH anti-drift comment
   verbatim from §10.6 spec.
5. **`tailwind.config.ts`** — generates Tailwind utilities from the
   `:root` CSS variables; status_* tokens become `bg-status-*` /
   `text-on-*` utilities; radius family per §8.2.
6. **`tokens.ts`** — TypeScript named exports of DESIGN.md tokens
   for SVG/chart fills and inline-style use cases.
7. **6-wrapper component package** per §10.7 — `<Card>`, `<SectionShift>`
   (replaces shadcn Separator per §5.2), `<Table>` chrome wrapper,
   `<Input>` wrapper, `<Button>` ghost variant package, `<Popover>`
   variant=solid|glass. Composition pattern per Q6.a; no CVA.
8. **Sample-data fixtures** at `mockups/src/lib/sample-data.ts`
   per §19 Q2 sizes — 30-40 recipes, 60-80 menu items, ~270 PO
   rows, 200-400 inventory positions, 15-20 vendors, 8-12 B2B
   customers, 60 days sales, 30 days closing inventory.
   AUTHENTIC Indian F&B vocabulary throughout. TypeScript
   `as const` exports.
9. **Pre-commit hook** per §10.8 — `mockups/.git-hooks/pre-commit`
   shell script; `mockups/.git-hooks/test-cases.md` snapshot tests;
   `git config core.hooksPath mockups/.git-hooks` setup. Scope
   per Q6.b (excludes `mockups/src/components/ui/`). Border
   allow-list per §10.8 (`border-l-{2,4,8}`, focus-visible,
   aria-invalid).
10. **`mockups/src/dev/ComponentsIndex.tsx`** per §10.9 — at
    minimum the 19-variant `<StatusPill>` grid; ideally 5-7 other
    shell-component permutation grids ready to extend. Three-
    viewport toggle per §19 Q3 (375 / 768 / 1280 px).
11. **`mockups/src/pages/ScreenIndex.tsx`** — placeholder rows
    for all 112 screens, organized by epic, with "developer view"
    affordance in footer linking to `/_dev/components`.
12. **AppShell skeleton** — sidebar (§5.1.5 dark teal cockpit) +
    top bar + Wild Sugar logo per Q1; persona switcher per §16.
13. **DESIGN.md edits in same diff per §10.10:**
    - §5.3.1 glassmorphism opt-in path
    - §10.5 animation library policy
14. **`claude.md` edits in same diff per §10.11:**
    - `## Current phase` updated from stale "Phase 2a — PRD review"
      to "Phase 2c — visual mockups, scaffold complete; Tier 1
      build pending per §6 build order"
    - New `## Design token enforcement (Phase 2c+)` section with
      generation-side rules complementing the pre-commit hook
15. **Vercel setup per §19 Q4** — `vercel.json` at repo root with
    `rootDirectory: "mockups"` + `outputDirectory: "dist"`; user
    completes the GitHub OAuth + repo-import UI step manually
    (5-min); first preview URL surfaces before session close.
16. **Acceptance per §10.12** — `npm run dev` works; ScreenIndex
    renders empty placeholders for all 112 screens; `/_dev/components`
    shows StatusPill grid + at least 5 other shell-component grids;
    `/SI-RPT-002` shows "not yet built" placeholder using AppShell
    skeleton with Wild Sugar branding; pre-commit hook installed
    and snapshot tests pass.

## Methodology

Use superpowers:subagent-driven-development. Dispatch one
implementer subagent per major scaffold area:
- A. Vite harness + shadcn init + Tailwind config (steps 2-3, 5)
- B. globals.css + tokens.ts (steps 4, 6) — runs after A
- C. 6-wrapper component package (step 7) — runs after B
- D. Sample-data fixtures (step 8) — can run in parallel with C
- E. Pre-commit hook + test cases (step 9) — runs after C
- F. ComponentsIndex + ScreenIndex + AppShell skeleton (steps 10-12)
  — runs after C and D
- G. DESIGN.md + claude.md edits in same diff (steps 13-14) — runs
  in parallel with F
- H. Vercel setup (step 15) — runs after F lands and pushes

Per superpowers:subagent-driven-development: dispatch ONE subagent
per area; combined spec+quality reviewer per area; loop fix → review
until ✅. Don't run multiple implementer subagents in parallel against
the mockups/ directory (file conflicts).

Do NOT begin Tier 1 screen builds in this session. Tier 1 Group 1
starts in Session 3.

## Out of scope this session
- Tier 1 / Tier 2 screen content
- Storybook
- gsap-skills install
- Owl-Listener install
- Dark-mode token population (stub only, per §10.6)

## Auto-mode posture
Auto mode active in source session that ran Session 1; honour user's
posture in this session. Scaffold is mostly mechanical (file
generation, tool setup), so subagent dispatching can run with
minimal interruption. Surface for confirmation only when:
- Vercel UI step needs user action (OAuth + repo import)
- An ambiguous DESIGN.md interpretation surfaces during token
  translation that wasn't pre-resolved in §19
- A subagent reports BLOCKED

## Session close
End-state checklist per §10.12. Surface a Session 3 (Tier 1 Group
1 build) kickoff prompt for the next fresh session. Capture any
scaffold-time decisions or surprises in a new §21 "Scaffold notes"
section of the plan if they affect future sessions.

Begin with subagent A.
```

---

*End of plan — 2026-05-04 (revised 2026-05-05: §16 session breakdown + §17 Session 1 kickoff prompt; revised 2026-05-05 again: §13 Q6 token reconciliation pre-resolved sub-decisions, §10.6–§10.12 expanded scaffold spec, §18 augmented checks, §19 Kickoff decisions stub for Session 1 capture; revised 2026-05-05 third pass: §19 fully populated with Session 1 Q1–Q6 decisions, §20 Session 2 scaffold kickoff prompt added)*
