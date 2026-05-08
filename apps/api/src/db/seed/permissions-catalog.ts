/**
 * permissions-catalog.ts — Phase 4 Epic 2 USR Arc (a) Task A4.
 *
 * Source-of-truth TypeScript catalog for the application's permission keys
 * AND the role baseline (FR15a + FR15b). The hand-authored migration
 * `0008_seed_permissions.sql` is generated FROM this data — same shape, same
 * keys, same description strings.
 *
 * DL-032: incremental per-epic catalog. The list grows as each future epic
 * ships — new entries append, never re-edit historical ones. Re-running the
 * migration is idempotent (`ON CONFLICT DO NOTHING`).
 *
 *   - Epic 1 MDM CRUD seed   (12 entries — landed with this Arc (a) seed).
 *   - Epic 2 USR seed         (6 entries — landed with this Arc (a) seed).
 *   - Future epics extend.
 *
 * `ROLE_BASELINE` is intentionally written as explicit literal arrays per
 * role (rather than computed predicates over `PERMISSIONS_CATALOG`) so:
 *   - Postgres-side determinism: each role's permission set is visually
 *     identical between this file and the SQL migration's WHERE-IN list.
 *   - No subtle operator-precedence bugs (e.g. accidentally including a
 *     cluster-scoped variant for brand_owner via prefix-match predicates).
 *   - Diff-friendly: when a future epic adds a permission, the reviewer
 *     sees per-role grants explicitly rather than parsing a regex/filter.
 *
 * Module-load self-check: throws on import if `ROLE_BASELINE` references
 * any key that does not exist in `PERMISSIONS_CATALOG`. Catches future-edit
 * drift (e.g. typo in a role array, deletion of a catalog entry without
 * updating the baseline).
 */

import type { UserRole } from '../schema/auth.js';

export interface PermissionDef {
  module: string;
  action: string;
  scope: string;
  key: string;
  description: string;
}

export const PERMISSIONS_CATALOG: PermissionDef[] = [
  // Epic 1 MDM
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.org.read',         description: 'View org hierarchy (clusters/locations/departments)' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.org.write',        description: 'Create/edit org hierarchy' },
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.products.read',    description: 'View product master' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.products.write',   description: 'Create/edit products' },
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.categories.read',  description: 'View category tree' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.categories.write', description: 'Create/edit categories' },
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.vendors.read',     description: 'View vendor master' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.vendors.write',    description: 'Create/edit vendors' },
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.enablement.read',  description: 'View material enablement matrix' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.enablement.write', description: 'Edit material enablement' },
  { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.company.read',     description: 'View company registration + fiscal year' },
  { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.company.write',    description: 'Edit company registration + fiscal year' },
  // Epic 2 USR
  { module: 'usr', action: 'read',    scope: 'brand',   key: 'usr.users.read',         description: 'View users' },
  { module: 'usr', action: 'read',    scope: 'cluster', key: 'usr.users.read.cluster', description: 'View users within own cluster' },
  { module: 'usr', action: 'write',   scope: 'brand',   key: 'usr.users.write',        description: 'Create/edit users' },
  { module: 'usr', action: 'read',    scope: 'brand',   key: 'usr.permissions.read',   description: 'View effective permissions' },
  { module: 'usr', action: 'write',   scope: 'brand',   key: 'usr.permissions.write',  description: 'Grant/revoke permission overrides' },
  { module: 'usr', action: 'approve', scope: 'brand',   key: 'usr.accounts.approve',   description: 'Approve Brand Owner accounts (Superadmin)' },
  // Epic 3 INF (Phase 4 — seeded by migration 0010_seed_inf_permissions.sql)
  { module: 'inf', action: 'read',              scope: 'self',  key: 'inf.approval.read',                description: 'View own approval inbox' },
  { module: 'inf', action: 'write',             scope: 'self',  key: 'inf.approval.write',               description: 'Approve / reject / delegate own pending approvals' },
  { module: 'inf', action: 'configure_chains',  scope: 'brand', key: 'inf.approval.configure_chains',    description: 'Author + edit approval chains' },
  { module: 'inf', action: 'read',              scope: 'self',  key: 'inf.notification.read',            description: 'Read own notifications + preview digest' },
  { module: 'inf', action: 'preferences.write', scope: 'self',  key: 'inf.notification.preferences.write', description: 'Edit own notification preferences' },
  { module: 'inf', action: 'read',              scope: 'brand', key: 'inf.audit.read',                   description: 'View audit trail viewer' },
  { module: 'inf', action: 'export',            scope: 'brand', key: 'inf.audit.export',                 description: 'Export filtered audit slices' },
  { module: 'inf', action: 'read',              scope: 'self',  key: 'inf.issue.read',                   description: 'List + open issue tickets' },
  { module: 'inf', action: 'write',             scope: 'self',  key: 'inf.issue.write',                  description: 'Create + comment + attach' },
  { module: 'inf', action: 'assign',            scope: 'brand', key: 'inf.issue.assign',                 description: 'Reassign tickets' },
  { module: 'inf', action: 'close',             scope: 'self',  key: 'inf.issue.close',                  description: 'Close own tickets (originator) or any (BO)' },
  { module: 'inf', action: 'read',              scope: 'self',  key: 'inf.broadcast.read',               description: 'See broadcasts targeted to self' },
  { module: 'inf', action: 'compose',           scope: 'brand', key: 'inf.broadcast.compose',            description: 'Author broadcasts' },
];

/**
 * Per-role permission baseline (FR15b). Explicit literal arrays — NOT computed
 * over PERMISSIONS_CATALOG. See file header for rationale.
 *
 * Notes:
 *   - brand_owner: full MDM + USR self-management; NO `usr.accounts.approve`
 *     (that's Superadmin-only) and NO `usr.users.read.cluster` (cluster-scoped
 *     variant; brand_owner has the brand-scoped `usr.users.read`).
 *   - cluster_manager: read-only MDM views + cluster-scoped user listing.
 *   - kitchen_manager / store_manager: read-only MDM views.
 *   - procurement_manager: vendor + product write access.
 *   - finance_manager: company registration write access.
 *   - dispatch_staff / pos_staff: minimal read-only.
 *   - superadmin: cross-tenant; only `usr.accounts.approve` baseline (other
 *     superadmin abilities are platform-level and out of RBAC scope).
 */
// INF baseline per migration 0010_seed_inf_permissions.sql.
// Eight-key "INF baseline" common to most roles:
//   inf.approval.{read,write}, inf.notification.{read,preferences.write},
//   inf.issue.{read,write,close}, inf.broadcast.read.
const INF_BASELINE_8 = [
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read',
];

export const ROLE_BASELINE: Record<UserRole, string[]> = {
  brand_owner: [
    'mdm.org.read', 'mdm.org.write',
    'mdm.products.read', 'mdm.products.write',
    'mdm.categories.read', 'mdm.categories.write',
    'mdm.vendors.read', 'mdm.vendors.write',
    'mdm.enablement.read', 'mdm.enablement.write',
    'mdm.company.read', 'mdm.company.write',
    'usr.users.read', 'usr.users.write',
    'usr.permissions.read', 'usr.permissions.write',
    // INF — all 13.
    'inf.approval.read', 'inf.approval.write', 'inf.approval.configure_chains',
    'inf.notification.read', 'inf.notification.preferences.write',
    'inf.audit.read', 'inf.audit.export',
    'inf.issue.read', 'inf.issue.write', 'inf.issue.assign', 'inf.issue.close',
    'inf.broadcast.read', 'inf.broadcast.compose',
  ],
  cluster_manager: [
    'mdm.org.read',
    'mdm.products.read',
    'mdm.categories.read',
    'mdm.enablement.read',
    'usr.users.read.cluster',
    // INF — 10 = 8 baseline + inf.audit.read + inf.issue.assign.
    ...INF_BASELINE_8,
    'inf.audit.read',
    'inf.issue.assign',
  ],
  kitchen_manager: [
    'mdm.org.read',
    'mdm.products.read',
    'mdm.categories.read',
    'mdm.enablement.read',
    // INF — 8 baseline.
    ...INF_BASELINE_8,
  ],
  store_manager: [
    'mdm.org.read',
    'mdm.products.read',
    'mdm.categories.read',
    'mdm.enablement.read',
    // INF — 8 baseline.
    ...INF_BASELINE_8,
  ],
  procurement_manager: [
    'mdm.org.read',
    'mdm.products.read', 'mdm.products.write',
    'mdm.categories.read',
    'mdm.vendors.read', 'mdm.vendors.write',
    'mdm.enablement.read',
    // INF — 8 baseline.
    ...INF_BASELINE_8,
  ],
  finance_manager: [
    'mdm.org.read',
    'mdm.products.read',
    'mdm.categories.read',
    'mdm.vendors.read',
    'mdm.company.read', 'mdm.company.write',
    // INF — 10 = 8 baseline + inf.audit.read + inf.audit.export.
    ...INF_BASELINE_8,
    'inf.audit.read', 'inf.audit.export',
  ],
  dispatch_staff: [
    'mdm.org.read',
    'mdm.products.read',
    'mdm.enablement.read',
    // INF — 8 baseline.
    ...INF_BASELINE_8,
  ],
  pos_staff: [
    'mdm.products.read',
    'mdm.categories.read',
    // INF — 8 baseline.
    ...INF_BASELINE_8,
  ],
  superadmin: [
    'usr.accounts.approve',
    // INF — 4 (DL-040 BO-approval inbox flow).
    'inf.approval.read', 'inf.approval.write',
    'inf.notification.read', 'inf.notification.preferences.write',
  ],
};

// ---------------------------------------------------------------------------
// Self-check at module load: every key referenced in ROLE_BASELINE exists in
// PERMISSIONS_CATALOG. Throws a typed Error if mismatched, breaking fast at
// import time rather than at runtime mid-test.
// ---------------------------------------------------------------------------

(function selfCheckRoleBaselineAgainstCatalog(): void {
  const catalogKeys = new Set(PERMISSIONS_CATALOG.map((p) => p.key));
  const orphanRefs: { role: string; key: string }[] = [];
  for (const [role, keys] of Object.entries(ROLE_BASELINE)) {
    for (const key of keys) {
      if (!catalogKeys.has(key)) {
        orphanRefs.push({ role, key });
      }
    }
  }
  if (orphanRefs.length > 0) {
    const detail = orphanRefs
      .map((r) => `  - role=${r.role} key=${r.key}`)
      .join('\n');
    throw new Error(
      `[permissions-catalog] ROLE_BASELINE references permission keys not in PERMISSIONS_CATALOG:\n${detail}`,
    );
  }
})();
