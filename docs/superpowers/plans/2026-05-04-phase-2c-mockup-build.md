# Phase 2c — Visual Mockup Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:brainstorming first to resolve the open kickoff questions in §13, then superpowers:writing-plans to firm this into per-task instructions, then superpowers:subagent-driven-development for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a working Vite + React + Tailwind reference implementation of the F&B ERP screen inventory under `mockups/` in this repo. Engineers in Phase 3a fork the components as their starting point. Stakeholders review at `localhost:5173` (or a deployed static build) clicking through every screen.

**Status:** Plan committed; not yet executed. Phase 2b screen inventory locked at `_planning/05-screen-inventory.md` (PR #4 merged).

**Date:** 2026-05-04

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
mockups/                                    (NEW — Vite + React 18 + Tailwind 4 + TypeScript)
├── package.json
├── tailwind.config.ts                      (DESIGN.md §5/§6/§7/§8 → Tailwind tokens)
├── vite.config.ts
├── tsconfig.json
├── index.html
├── README.md                               (how to run; how to add a screen; token rules)
├── src/
│   ├── main.tsx                            (router; one route per screen ID)
│   ├── tokens.ts                           (DESIGN.md tokens as named TS exports)
│   ├── lib/
│   │   ├── sample-data.ts                  (Wild Sugar / Indian F&B fixtures)
│   │   ├── personas.ts                     (8 personas + scope context)
│   │   └── voice.ts                        (D2C-002 microcopy patterns: ₹ rule, reason prompts)
│   ├── shell/                              (~21 shared components, one per CC-* pattern)
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
│   └── pages/
│       └── ScreenIndex.tsx                 (clickable list of all 112 screens; Index-only entries link to parents)
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

### 10.6 Acceptance for Task 0

- `cd mockups && npm install && npm run dev` starts the server at `localhost:5173`
- `localhost:5173/` shows the empty ScreenIndex (placeholder rows for all 112 screens)
- `localhost:5173/SI-RPT-002` shows a "not yet built" placeholder using the `<AppShell>` skeleton

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

## 16 Session breakdown — Phase 2c is multi-session

Phase 2c is too large for one Claude Code session. Estimated total work: ~30–40 hours of subagent dispatching, ~89 bespoke screen files + 21 shell components + scaffold + handoff specs. Realistically ~8–12 sessions, each ending at a clean git checkpoint with a fresh-session prompt for the next.

| Session | Scope | Output |
|---|---|---|
| **2c-S1** Kickoff | Brainstorming the 5 §13 open questions only | 5 decisions captured back into the plan as §17 — no scaffolding, no code |
| **2c-S2** Scaffold | Task 0 (§10): Vite harness + tailwind.config.ts + 21 shell components | `mockups/` directory; `npm run dev` renders empty ScreenIndex |
| **2c-S3** Tier 1 Group 1 (foundation) | 10 chrome-bearing hero screens (SI-RPT-002, INF-005, INF-001, RPT-005, ACC-003, ACC-013, INV-001, PUR-003, MDM-003, MDM-004) | Foundation chrome live; design critique passes per screen |
| **2c-S4** Tier 1 Group 2 (workflow) | 10 workflow-weighted screens (DSP-010, DSP-012, PRO-011, PRO-008, PRO-004, PUR-009, INV-012, PUR-004, ACC-014, USR-006) | Mandatory-reason + journal/TRN-firing flows live |
| **2c-S5** Tier 1 Groups 3+4 | 5 daily-driver screens + 3 dual-surface partners (INV-014, INV-010, DSP-003, REC-003, INV-016, ACC-010, RPT-006, INV-007) | All 28 Tier 1 done |
| **2c-S6** Tier 2 batches B1–B4 | MDM (4), USR (5), INF (6), INV (6) = 21 screens | Foundation epics' Tier 2 done |
| **2c-S7** Tier 2 batches B5–B8 | PUR (3), REC (5), PRO (8), DSP (5) = 21 screens | Operational epics' Tier 2 done |
| **2c-S8** Tier 2 batches B9–B12 | POS (3), ACC (5), HRM (4), RPT (4) = 16 screens | All 58 Tier 2 done |
| **2c-S9** Tier 3 + Index | 3 pattern docs + 23 ScreenIndex stub entries | All 112 entries reachable from `localhost:5173/` |
| **2c-S10** Handoff specs + close | `design:design-handoff` per Tier 1 screen → `_planning/handoff/` ; Phase-2c close note appended to `prd-review-notes.md` ; PR opened | Phase-3a-ready package |

Optional intervening sessions:
- **2c-Sx** Stakeholder review pass — after S5 (all Tier 1 done), deploy static build, gather feedback, iterate on Tier 1 screens
- **2c-Sy** Cross-persona consistency review — after S8 (all Tier 1+2 done), audit for token/voice/layout drift

The session count is a guide, not a contract. If S3 burns context faster than expected, split into S3a (Group 1 first 5) + S3b (Group 1 last 5). If S6 is light, fold into S5. The principle: each session ends at a commit-and-resumable checkpoint; the next session starts fresh with a self-contained prompt.

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

ONE thing: superpowers:brainstorming on the 5 open questions in §13
of the plan.

The 5 questions (verbatim from §13):

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

Run brainstorming honestly: present trade-offs, ask the user, do NOT
decide unilaterally. After each question is answered, capture the
decision verbatim into a NEW §18 "Kickoff decisions" section of the
plan doc with rationale and any follow-up implications. Commit per
decision OR batch at session end.

When all 5 questions are answered AND captured in §18, STOP.

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

---

*End of plan — 2026-05-04 (revised 2026-05-05 with §16 session breakdown + §17 Session 1 kickoff prompt)*
