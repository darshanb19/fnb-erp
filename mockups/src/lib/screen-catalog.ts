/**
 * Canonical 112-screen inventory mirror — sourced from
 * `_planning/05-screen-inventory.md` (heading rows: `^#### SI-XXX-### — ...`).
 *
 * Used by:
 *   - AppShell sidebar nav (12 epic groupings)
 *   - ScreenIndex placeholder list
 *   - ScreenStub fallback ("not yet built" page)
 *
 * Tier 1 hero set (28 screens) is tagged inline so ScreenIndex can render
 * a "Tier 1" badge. Source: Phase 2c kickoff prompt §6 (Tier 1 hero
 * acceptance scope) plus the deferred-Tier-1 (Group 2 + Group 3) listings
 * called out in plan §6 / `_planning/06-phase-roadmap.md` cross-phase
 * invariants.
 */

export type Epic =
  | 'MDM'
  | 'USR'
  | 'INF'
  | 'INV'
  | 'PUR'
  | 'REC'
  | 'PRO'
  | 'DSP'
  | 'POS'
  | 'ACC'
  | 'HRM'
  | 'RPT'

export const EPIC_ORDER: ReadonlyArray<Epic> = [
  'MDM',
  'USR',
  'INF',
  'INV',
  'PUR',
  'REC',
  'PRO',
  'DSP',
  'POS',
  'ACC',
  'HRM',
  'RPT',
] as const

export const EPIC_LABELS: Readonly<Record<Epic, string>> = {
  MDM: 'Master Data',
  USR: 'Users & Auth',
  INF: 'Infrastructure',
  INV: 'Inventory',
  PUR: 'Purchasing',
  REC: 'Recipes',
  PRO: 'Production',
  DSP: 'Dispatch',
  POS: 'Point of Sale',
  ACC: 'Accounting',
  HRM: 'HR',
  RPT: 'Reports',
}

export interface ScreenEntry {
  readonly id: string
  readonly epic: Epic
  readonly name: string
  /** True if listed as Phase 2c Tier 1 hero. */
  readonly tier1: boolean
  /**
   * True if a production mockup file exists under `src/screens/<epic>/<id>.tsx`.
   * Mockup-shipped is a strict superset of "screen file present" — this flag
   * captures the deferred-mockup completion-status for cross-phase reviewers
   * (Phase 4 invariant: per-epic 3-arc structure → Arc (b) ships mockups).
   */
  readonly built: boolean
}

/**
 * 28 Tier 1 hero screens — the screens that carry "stricter critique"
 * acceptance per Phase 2c kickoff §6. Sources cross-checked against
 * `_planning/05-screen-inventory.md` Tier-1 callouts.
 *
 * NOTE: This list is what we have authoritative confirmation for. If the
 * Phase 2c plan §5 tier table evolves, update here in lockstep.
 */
const TIER_1_IDS: ReadonlyArray<string> = [
  // Reports (5) — owner / cluster / ops dashboards
  'SI-RPT-001',
  'SI-RPT-002',
  'SI-RPT-003',
  'SI-RPT-007',
  'SI-RPT-008',
  // Inventory (5)
  'SI-INV-001',
  'SI-INV-003',
  'SI-INV-008',
  'SI-INV-010',
  'SI-INV-014',
  // Purchasing (3)
  'SI-PUR-001',
  'SI-PUR-003',
  'SI-PUR-004',
  // Recipes (3)
  'SI-REC-002',
  'SI-REC-003',
  'SI-REC-007',
  // Production (3)
  'SI-PRO-003',
  'SI-PRO-005',
  'SI-PRO-007',
  // Dispatch (3)
  'SI-DSP-003',
  'SI-DSP-006',
  'SI-DSP-008',
  // Approvals / Infrastructure (2)
  'SI-INF-001',
  'SI-INF-005',
  // Accounting (3)
  'SI-ACC-009',
  'SI-ACC-011',
  'SI-ACC-013',
  // POS (1)
  'SI-POS-002',
  // Users & Auth (3) — deferred Tier 1 hero set per Phase 4 invariant
  // (Tier 1 acceptance applies even though built in Phase 4 Epic 2).
  'SI-USR-002',
  'SI-USR-003',
  'SI-USR-006',
]

const tier1Set = new Set<string>(TIER_1_IDS)

/**
 * Production mockup files that ship as `src/screens/<epic>/<id>.tsx`.
 *
 * Sources:
 *   - SI-MDM-001…007 — Phase 2c hero set (Epic 1 mockups, shipped 2026-04 / 05).
 *   - SI-USR-001…008 — Phase 4 Epic 2 Arc (b), this branch.
 *
 * Append future arcs here in lockstep with the screen file landing on `main`.
 * The set is the source of truth for the "Built" badge in ScreenIndex.
 */
const BUILT_IDS: ReadonlyArray<string> = [
  // Epic 1 — MDM (7)
  'SI-MDM-001',
  'SI-MDM-002',
  'SI-MDM-003',
  'SI-MDM-004',
  'SI-MDM-005',
  'SI-MDM-006',
  'SI-MDM-007',
  // Epic 2 — USR (8)
  'SI-USR-001',
  'SI-USR-002',
  'SI-USR-003',
  'SI-USR-004',
  'SI-USR-005',
  'SI-USR-006',
  'SI-USR-007',
  'SI-USR-008',
]

const builtSet = new Set<string>(BUILT_IDS)

const RAW: ReadonlyArray<readonly [string, string]> = [
  ['SI-MDM-001', 'Organisational Hierarchy View & Edit'],
  ['SI-MDM-002', 'Department Register'],
  ['SI-MDM-003', 'Product Master CRUD'],
  ['SI-MDM-004', 'Material Enablement Matrix'],
  ['SI-MDM-005', 'Vendor Master CRUD'],
  ['SI-MDM-006', 'Category & Sub-Category Management'],
  ['SI-MDM-007', 'Company Registration & Fiscal Year Setup'],

  ['SI-USR-001', 'User List & Filter'],
  ['SI-USR-002', 'User Create / Edit'],
  ['SI-USR-003', 'Login'],
  ['SI-USR-004', 'Self-Service Password Reset'],
  ['SI-USR-005', 'User Effective Permissions View'],
  ['SI-USR-006', 'Permission Grant / Revoke Flow'],
  ['SI-USR-007', 'Overrides Expiring Soon'],
  ['SI-USR-008', 'Brand Owner Account Approval'],

  ['SI-INF-001', 'Unified Approval Inbox'],
  ['SI-INF-002', 'Approval Chain Configuration'],
  ['SI-INF-003', 'Notification Preferences'],
  ['SI-INF-004', 'Notification Digest Preview'],
  ['SI-INF-005', 'Audit Trail Viewer'],
  ['SI-INF-006', 'Activity Timeline Reference'],
  ['SI-INF-007', 'Issue Ticket List'],
  ['SI-INF-008', 'Issue Ticket Create / Edit'],
  ['SI-INF-009', 'Broadcast Announcement Composer'],
  ['SI-INF-010', 'Reverse / Cancel Confirmation Pattern'],

  ['SI-INV-001', 'Real-Time Stock View'],
  ['SI-INV-002', 'Department Stock Detail'],
  ['SI-INV-003', 'Below-PAR Flag List'],
  ['SI-INV-004', 'PAR Level Configuration'],
  ['SI-INV-005', 'Stock Transfer Create'],
  ['SI-INV-006', 'Stock Transfer Detail & Status'],
  ['SI-INV-007', 'Paired Brand-Store Cross-Cluster Transfer'],
  ['SI-INV-008', 'Expiry Countdown Dashboard'],
  ['SI-INV-009', 'Cross-Location Transfer Suggestions'],
  ['SI-INV-010', 'Goods Receipt Entry — PO-Driven'],
  ['SI-INV-011', 'Goods Receipt Entry — Transfer-Driven'],
  ['SI-INV-012', 'Goods Receipt Rejection at QC'],
  ['SI-INV-013', 'Inventory Adjustment'],
  ['SI-INV-014', 'Closing Inventory Entry — POS Daily'],
  ['SI-INV-015', 'Closing Inventory Entry — Dispatch Daily'],
  ['SI-INV-016', 'Closing Inventory Cluster Review'],

  ['SI-PUR-001', 'PO Create with PAR Suggestions'],
  ['SI-PUR-002', 'PO List & Filter'],
  ['SI-PUR-003', 'PO Detail & Lifecycle Status'],
  ['SI-PUR-004', 'PO Approval'],
  ['SI-PUR-005', 'Vendor Price Comparison'],
  ['SI-PUR-006', 'Vendor Price Spike Alerts'],
  ['SI-PUR-007', 'Recurring PO Template'],
  ['SI-PUR-008', 'Vendor Performance & Preferred Flag'],
  ['SI-PUR-009', 'Vendor Credit Note Issuance'],

  ['SI-REC-001', 'Recipe List & Search'],
  ['SI-REC-002', 'Recipe Detail — Current Default'],
  ['SI-REC-003', 'Recipe Edit'],
  ['SI-REC-004', 'Recipe Version Comparison'],
  ['SI-REC-005', 'Designate Default Approval'],
  ['SI-REC-006', 'Recipe Scaling Preview'],
  ['SI-REC-007', 'Cost-Impact Simulation'],
  ['SI-REC-008', 'Recipe Categories & Tags Admin'],

  ['SI-PRO-001', 'Production Order List & Filter'],
  ['SI-PRO-002', 'Production Order Create'],
  ['SI-PRO-003', 'Production Order Detail'],
  ['SI-PRO-004', 'Ingredient Substitution Flow'],
  ['SI-PRO-005', 'Enablement / Stock Override Flow'],
  ['SI-PRO-006', 'Enablement Request'],
  ['SI-PRO-007', 'Pending GR Linkage Interface'],
  ['SI-PRO-008', 'Pending GR Override'],
  ['SI-PRO-009', 'Pending GR Resolution Outcomes'],
  ['SI-PRO-010', 'Production Output Entry'],
  ['SI-PRO-011', 'In Progress Transition Confirm'],

  ['SI-DSP-001', 'Internal Dispatch Challan List'],
  ['SI-DSP-002', 'Internal Dispatch Challan Create'],
  ['SI-DSP-003', 'Dispatch Receipt Sign-off'],
  ['SI-DSP-004', 'B2B Customer Master'],
  ['SI-DSP-005', 'B2B Challan List'],
  ['SI-DSP-006', 'B2B Challan Create'],
  ['SI-DSP-007', 'B2B Challan Detail'],
  ['SI-DSP-008', 'B2B Dispatch Confirmation'],
  ['SI-DSP-009', 'B2B Delivery Confirmation'],
  ['SI-DSP-010', 'B2B GST Closure'],
  ['SI-DSP-011', 'B2B Closure Without GST Invoice'],
  ['SI-DSP-012', 'B2B Credit Note Creation'],

  ['SI-POS-001', 'Menu Item List'],
  ['SI-POS-002', 'Menu Item Recipe Mapping'],
  ['SI-POS-003', 'POS Sales Integration Status'],

  ['SI-ACC-001', 'Chart of Accounts Admin'],
  ['SI-ACC-002', 'Journal Mapping Rules Admin'],
  ['SI-ACC-003', 'Trial Balance'],
  ['SI-ACC-004', 'Profit & Loss Statement'],
  ['SI-ACC-005', 'Balance Sheet'],
  ['SI-ACC-006', 'Cash Flow Statement'],
  ['SI-ACC-007', 'Daily Sales Report Capture'],
  ['SI-ACC-008', 'Budget Create / Edit'],
  ['SI-ACC-009', 'Budget vs Actual Variance'],
  ['SI-ACC-010', 'FCCC Financial Framing'],
  ['SI-ACC-011', 'Accountant Handoff Exports'],
  ['SI-ACC-012', 'Compliance Placeholder Editor'],
  ['SI-ACC-013', 'Integration Status Dashboard'],
  ['SI-ACC-014', 'Manual Journal Voucher'],

  ['SI-HRM-001', 'Employee List'],
  ['SI-HRM-002', 'Employee Create / Edit'],
  ['SI-HRM-003', 'Attendance Entry / Log'],
  ['SI-HRM-004', 'Shift Definition Admin'],
  ['SI-HRM-005', 'Duty Roster View'],

  ['SI-RPT-001', 'Personalised Morning Briefing'],
  ['SI-RPT-002', 'Brand Owner Cross-Location Dashboard'],
  ['SI-RPT-003', 'Cluster Manager Cluster Dashboard'],
  ['SI-RPT-004', 'Reports Library Index'],
  ['SI-RPT-005', 'Report Detail Runner'],
  ['SI-RPT-006', 'FCCC Operational Analytics Framing'],
  ['SI-RPT-007', 'Menu Engineering Matrix'],
  ['SI-RPT-008', 'Unusual Activity Feed'],
  ['SI-RPT-009', 'PAR Drift Recommendations'],
] as const

function epicOf(id: string): Epic {
  const m = id.match(/^SI-([A-Z]{3})-/)
  if (!m) {
    throw new Error(`Cannot parse epic from screen id "${id}"`)
  }
  const epic = m[1] as Epic
  return epic
}

export const screens: ReadonlyArray<ScreenEntry> = RAW.map(([id, name]) => ({
  id,
  name,
  epic: epicOf(id),
  tier1: tier1Set.has(id),
  built: builtSet.has(id),
}))

export const screensByEpic: Readonly<Record<Epic, ReadonlyArray<ScreenEntry>>> =
  EPIC_ORDER.reduce(
    (acc, epic) => {
      acc[epic] = screens.filter((s) => s.epic === epic)
      return acc
    },
    {} as Record<Epic, ReadonlyArray<ScreenEntry>>,
  )

export const screenById: Readonly<Record<string, ScreenEntry>> = Object.fromEntries(
  screens.map((s) => [s.id, s]),
)
