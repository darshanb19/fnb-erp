/**
 * user-roles — canonical 9-role registry for Phase 4 Epic 2 USR.
 *
 * Single source of truth for the `UserRole` enum, label map, narrative
 * description map, and role → scope-shape mapping. Every USR mockup
 * (SI-USR-001 / 002 / 005 / 006 / 007) imports from this file rather than
 * duplicating its own copy. Consolidated in Task B6 — previously the same
 * `UserRole` + `ROLE_LABEL` declarations lived inline at the top of every
 * USR screen, drifting from the apps/api enum if anyone touched one without
 * touching the others.
 *
 * Mirror of `apps/api/src/db/schema/auth.ts` `userRoleEnum`. If the API
 * enum gains a new value, update this file in the same commit so the
 * mockups keep telling the truth.
 *
 * Source FRs:
 *   - FR12 — canonical 9-role registry; each role has a fixed scope shape.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical 9 roles (mirror of apps/api auth schema enum)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'superadmin'
  | 'brand_owner'
  | 'cluster_manager'
  | 'procurement_manager'
  | 'production_manager'
  | 'pos_manager'
  | 'pos_staff'
  | 'accountant'
  | 'viewer'

/** Ordered list — order is the canonical render order in selectors. */
export const USER_ROLES: ReadonlyArray<UserRole> = [
  'superadmin',
  'brand_owner',
  'cluster_manager',
  'procurement_manager',
  'production_manager',
  'pos_manager',
  'pos_staff',
  'accountant',
  'viewer',
]

// ─────────────────────────────────────────────────────────────────────────────
// Display labels
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  superadmin: 'Superadmin',
  brand_owner: 'Brand Owner',
  cluster_manager: 'Cluster Manager',
  procurement_manager: 'Procurement Manager',
  production_manager: 'Production Manager',
  pos_manager: 'POS Manager',
  pos_staff: 'POS Staff',
  accountant: 'Accountant',
  viewer: 'Viewer',
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-role narrative description (SI-USR-002 form Section 2)
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_DESCRIPTION: Readonly<Record<UserRole, string>> = {
  superadmin:
    'Multi-tenant platform operator. No brand scope — sees all tenants. Reserved for the F&B ERP team itself.',
  brand_owner:
    'Owns the entire brand. Approves Brand Owner sign-up requests, manages global settings, and grants permission overrides. Self-creation routes through Superadmin approval (FR14).',
  cluster_manager:
    'Manages one cluster end-to-end — locations, staff, vendors, and approvals scoped to that cluster only.',
  procurement_manager:
    'Brand-wide procurement domain — vendors, POs, GR exceptions, payment terms across all clusters.',
  production_manager:
    'Brand-wide production domain — recipes, BOMs, central-kitchen yields, dispatch challans across all clusters.',
  pos_manager:
    'Single POS outlet manager (location + department). Closes shift, manages POS staff for the assigned outlet.',
  pos_staff:
    'Front-of-house / kitchen staff at a single POS outlet (location + department). Operates POS, scans inventory, raises closing.',
  accountant:
    'Brand-wide accounting domain. Read-write on ledgers, exports; read-only on operational data.',
  viewer:
    'Brand-wide read-only. Cannot mutate any record. Useful for auditors, advisors, board members.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Role → scope shape (drives SI-USR-002 conditional scope section)
// ─────────────────────────────────────────────────────────────────────────────

export type RoleScopeShape = 'none' | 'cluster' | 'location_department'

export const roleScopeShape: Readonly<Record<UserRole, RoleScopeShape>> = {
  superadmin: 'none',
  brand_owner: 'none',
  cluster_manager: 'cluster',
  procurement_manager: 'none',
  production_manager: 'none',
  pos_manager: 'location_department',
  pos_staff: 'location_department',
  accountant: 'none',
  viewer: 'none',
}
