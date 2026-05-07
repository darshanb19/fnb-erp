-- =============================================================================
-- 0008_seed_permissions.sql — Phase 4 Epic 2 USR Arc (a) Task A4
-- Seed permissions catalog + role_permissions (DL-032 incremental Epic 1+2).
--
-- Source of truth: apps/api/src/db/seed/permissions-catalog.ts
-- Re-run safe: ON CONFLICT DO NOTHING on every insert.
--
-- Hand-authored sidecar — NOT registered in meta/_journal.json. Drizzle-kit
-- does not model seed data; this seed is applied manually via psql to fnberp_dev
-- + fnberp_test, and via Supabase MCP to fnberp-prod by the controller.
--
-- Pattern matches 0001_rls_and_constraints.sql / 0004_*_constraints.sql /
-- 0006_procurement_constraints.sql / 0007_usr_rls.sql (all hand-authored,
-- all journal-absent).
--
-- A3 fix-back: drop permissions_module_action_scope_idx if present. The Task
-- A3 unique index over (module, action, scope) was based on a key-shape
-- assumption ('users.create.brand' = exactly one row) that is wrong for the
-- final catalog ('mdm.products.read' and 'mdm.vendors.read' both share
-- (mdm, read, brand)). `key` uniqueness is the canonical guard. See updated
-- schema header in apps/api/src/db/schema/permissions.ts.
-- =============================================================================

DROP INDEX IF EXISTS permissions_module_action_scope_idx;

-- -----------------------------------------------------------------------------
-- Permissions catalog (18 rows: 12 MDM + 6 USR)
-- -----------------------------------------------------------------------------
INSERT INTO permissions (module, action, scope, key, description) VALUES
  ('mdm', 'read',  'brand', 'mdm.org.read',         'View org hierarchy (clusters/locations/departments)'),
  ('mdm', 'write', 'brand', 'mdm.org.write',        'Create/edit org hierarchy'),
  ('mdm', 'read',  'brand', 'mdm.products.read',    'View product master'),
  ('mdm', 'write', 'brand', 'mdm.products.write',   'Create/edit products'),
  ('mdm', 'read',  'brand', 'mdm.categories.read',  'View category tree'),
  ('mdm', 'write', 'brand', 'mdm.categories.write', 'Create/edit categories'),
  ('mdm', 'read',  'brand', 'mdm.vendors.read',     'View vendor master'),
  ('mdm', 'write', 'brand', 'mdm.vendors.write',    'Create/edit vendors'),
  ('mdm', 'read',  'brand', 'mdm.enablement.read',  'View material enablement matrix'),
  ('mdm', 'write', 'brand', 'mdm.enablement.write', 'Edit material enablement'),
  ('mdm', 'read',  'brand', 'mdm.company.read',     'View company registration + fiscal year'),
  ('mdm', 'write', 'brand', 'mdm.company.write',    'Edit company registration + fiscal year'),
  ('usr', 'read',    'brand',   'usr.users.read',         'View users'),
  ('usr', 'read',    'cluster', 'usr.users.read.cluster', 'View users within own cluster'),
  ('usr', 'write',   'brand',   'usr.users.write',        'Create/edit users'),
  ('usr', 'read',    'brand',   'usr.permissions.read',   'View effective permissions'),
  ('usr', 'write',   'brand',   'usr.permissions.write',  'Grant/revoke permission overrides'),
  ('usr', 'approve', 'brand',   'usr.accounts.approve',   'Approve Brand Owner accounts (Superadmin)')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- role_permissions (one INSERT-SELECT per role; explicit key lists mirror
-- ROLE_BASELINE in apps/api/src/db/seed/permissions-catalog.ts).
-- Total: 16 + 5 + 4 + 4 + 7 + 6 + 3 + 2 + 1 = 48 rows.
-- -----------------------------------------------------------------------------

-- brand_owner — 16 keys (full MDM + USR self-management; NO accounts.approve, NO cluster variant).
INSERT INTO role_permissions (role, permission_id)
SELECT 'brand_owner'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read', 'mdm.org.write',
  'mdm.products.read', 'mdm.products.write',
  'mdm.categories.read', 'mdm.categories.write',
  'mdm.vendors.read', 'mdm.vendors.write',
  'mdm.enablement.read', 'mdm.enablement.write',
  'mdm.company.read', 'mdm.company.write',
  'usr.users.read', 'usr.users.write',
  'usr.permissions.read', 'usr.permissions.write'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- cluster_manager — 5 keys (read-only MDM views + cluster-scoped user listing).
INSERT INTO role_permissions (role, permission_id)
SELECT 'cluster_manager'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read',
  'mdm.categories.read',
  'mdm.enablement.read',
  'usr.users.read.cluster'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- kitchen_manager — 4 keys (read-only MDM views).
INSERT INTO role_permissions (role, permission_id)
SELECT 'kitchen_manager'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read',
  'mdm.categories.read',
  'mdm.enablement.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- store_manager — 4 keys (read-only MDM views).
INSERT INTO role_permissions (role, permission_id)
SELECT 'store_manager'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read',
  'mdm.categories.read',
  'mdm.enablement.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- procurement_manager — 7 keys (vendor + product write access).
INSERT INTO role_permissions (role, permission_id)
SELECT 'procurement_manager'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read', 'mdm.products.write',
  'mdm.categories.read',
  'mdm.vendors.read', 'mdm.vendors.write',
  'mdm.enablement.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- finance_manager — 6 keys (company registration write access).
INSERT INTO role_permissions (role, permission_id)
SELECT 'finance_manager'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read',
  'mdm.categories.read',
  'mdm.vendors.read',
  'mdm.company.read', 'mdm.company.write'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- dispatch_staff — 3 keys (minimal read-only).
INSERT INTO role_permissions (role, permission_id)
SELECT 'dispatch_staff'::user_role, id FROM permissions WHERE key IN (
  'mdm.org.read',
  'mdm.products.read',
  'mdm.enablement.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- pos_staff — 2 keys (minimal read-only).
INSERT INTO role_permissions (role, permission_id)
SELECT 'pos_staff'::user_role, id FROM permissions WHERE key IN (
  'mdm.products.read',
  'mdm.categories.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- superadmin — 1 key (cross-tenant approval; other superadmin abilities are platform-level).
INSERT INTO role_permissions (role, permission_id)
SELECT 'superadmin'::user_role, id FROM permissions WHERE key IN (
  'usr.accounts.approve'
)
ON CONFLICT (role, permission_id) DO NOTHING;
