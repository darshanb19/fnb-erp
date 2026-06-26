/**
 * screen-routes — maps built screen ids to their real route paths.
 *
 * Single source of truth for which catalog screens are *navigable* from the
 * AppShell sidebar. The screen-catalog lists all 112 planned screens, but only
 * the ids present here have a real page mounted in App.tsx. The sidebar filters
 * `screensByEpic` against this map so it never renders dead links.
 *
 * EXCLUDED on purpose (built, but not top-level nav targets):
 *   - SI-USR-002 (User Create/Edit — form, reached from SI-USR-001)
 *   - SI-USR-003 (Login — pre-auth surface)
 *   - SI-USR-004 (Password Reset — pre-auth surface)
 *   - SI-USR-006 (Permission Grant/Revoke — flow reached from SI-USR-005)
 *   - SI-USR-008 (BO Account Approval — DL-030 route-only, superadmin, not in nav)
 *   - SI-INV-002 (Dept Stock Detail — drill-through only)
 *   - SI-INF-006 / SI-INF-008 / SI-INF-010 (pattern shells / sub-forms)
 *
 * Keep this in lockstep with the route table in App.tsx.
 */

export const SCREEN_ROUTES: Readonly<Record<string, string>> = {
  // MDM — Master Data
  'SI-MDM-001': '/mdm/hierarchy',
  'SI-MDM-002': '/mdm/departments',
  'SI-MDM-003': '/mdm/products',
  'SI-MDM-004': '/mdm/enablement',
  'SI-MDM-005': '/mdm/vendors',
  'SI-MDM-006': '/mdm/categories',
  'SI-MDM-007': '/mdm/company',

  // USR — Users & Auth
  'SI-USR-001': '/users',
  'SI-USR-007': '/users/overrides/expiring',

  // INF — Infrastructure
  'SI-INF-001': '/approvals/inbox',
  'SI-INF-002': '/approvals/chains',
  'SI-INF-003': '/notifications/preferences',
  'SI-INF-004': '/notifications/digest',
  'SI-INF-005': '/audit',
  'SI-INF-007': '/issues',
  'SI-INF-009': '/broadcasts',

  // INV — Inventory
  'SI-INV-001': '/inventory/stock',
  'SI-INV-003': '/inventory/below-par',
  'SI-INV-004': '/inventory/par-levels',
  'SI-INV-005': '/inventory/transfers/new',
  'SI-INV-006': '/inventory/transfers',
  'SI-INV-007': '/inventory/transfers/paired',
  'SI-INV-008': '/inventory/expiry',
  'SI-INV-009': '/inventory/suggestions',
  'SI-INV-010': '/inventory/goods-receipts/new',
  'SI-INV-011': '/inventory/goods-receipts/transfer',
  'SI-INV-012': '/inventory/goods-receipts/reject',
  'SI-INV-013': '/inventory/adjustments/new',
  'SI-INV-014': '/inventory/closing/pos',
  'SI-INV-015': '/inventory/closing/dispatch',
  'SI-INV-016': '/inventory/closing/review',
}
