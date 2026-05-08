/**
 * user-roles — canonical 9-role registry for apps/web (Phase 4 Epic 2 USR).
 *
 * Updated in C1 (DL-033) from the mockups source (`mockups/src/lib/user-roles.ts`)
 * to match the apps/api `userRoleEnum` (the BACKEND TRUTH at
 * `apps/api/src/db/schema/auth.ts`). The mockups copy intentionally diverges —
 * it was written from the PRD draft 9-role list before the backend enum was
 * finalised in Arc (a) Task A3. The mockups file stays unchanged because it is
 * visual-only reference; the Epic 2 chrome-freeze review (C10) will note this
 * divergence as expected.
 *
 * Single source of truth in apps/web for the `UserRole` enum, label map,
 * narrative description map, and role → scope-shape mapping. Every USR
 * production page (SI-USR-001 / 002 / 005 / 006 / 007) imports from this file.
 *
 * If the API enum gains a new value, update this file in the same commit so
 * apps/web keeps telling the truth.
 *
 * Source FRs:
 *   - FR12 — canonical 9-role registry; each role has a fixed scope shape.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical 9 roles (mirror of apps/api auth schema enum, in enum order)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'brand_owner'
  | 'cluster_manager'
  | 'kitchen_manager'
  | 'store_manager'
  | 'procurement_manager'
  | 'finance_manager'
  | 'dispatch_staff'
  | 'pos_staff'
  | 'superadmin'

/** Ordered list — order is the canonical render order in selectors. */
export const USER_ROLES: ReadonlyArray<UserRole> = [
  'brand_owner',
  'cluster_manager',
  'kitchen_manager',
  'store_manager',
  'procurement_manager',
  'finance_manager',
  'dispatch_staff',
  'pos_staff',
  'superadmin',
]

// ─────────────────────────────────────────────────────────────────────────────
// Display labels
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  brand_owner: 'Brand Owner',
  cluster_manager: 'Cluster Manager',
  kitchen_manager: 'Kitchen Manager',
  store_manager: 'Store Manager',
  procurement_manager: 'Procurement Manager',
  finance_manager: 'Finance Manager',
  dispatch_staff: 'Dispatch Staff',
  pos_staff: 'POS Staff',
  superadmin: 'Superadmin',
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-role narrative description (used by SI-USR-002 form Section 2 + role badges)
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_DESCRIPTION: Readonly<Record<UserRole, string>> = {
  brand_owner:
    'Owns the entire brand. Approves staff, manages global settings, and grants permission overrides. Self-creation routes through Superadmin approval (FR14).',
  cluster_manager:
    'Manages one cluster end-to-end — locations, staff, vendors, and approvals scoped to that cluster only.',
  kitchen_manager:
    'Runs a single kitchen department at one location — recipes, BOMs, production runs, dispatch handoff scoped to that kitchen.',
  store_manager:
    'Runs a single store department at one location — receipts, transfers, stocktake, closing scoped to that store.',
  procurement_manager:
    'Brand-wide procurement domain — vendors, POs, GR exceptions, payment terms across all clusters.',
  finance_manager:
    'Brand-wide finance domain — ledgers, payments, accountant exports, reconciliations across all clusters.',
  dispatch_staff:
    'Single dispatch desk at one location and department. Picks, packs, and signs B2B challans.',
  pos_staff:
    'Front-of-house staff at a single POS outlet (location + department). Operates POS, scans inventory, raises closing.',
  superadmin:
    'Multi-tenant platform operator. No brand scope — sees all tenants. Reserved for the F&B ERP team itself.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Role → scope shape (drives SI-USR-002 conditional scope section)
// ─────────────────────────────────────────────────────────────────────────────

export type RoleScopeShape = 'none' | 'cluster' | 'location_department'

export const roleScopeShape: Readonly<Record<UserRole, RoleScopeShape>> = {
  brand_owner: 'none',
  cluster_manager: 'cluster',
  kitchen_manager: 'location_department',
  store_manager: 'location_department',
  procurement_manager: 'none',
  finance_manager: 'none',
  dispatch_staff: 'location_department',
  pos_staff: 'location_department',
  superadmin: 'none',
}
