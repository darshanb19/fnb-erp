-- =============================================================================
-- 0010_seed_inf_permissions.sql — Phase 4 Epic 3 INF Arc (a) Task A5
-- Seed inf.* permissions catalog + role_permissions baseline (DL-032).
--
-- Hand-authored sidecar — NOT registered in meta/_journal.json. Same pattern
-- as 0008_seed_permissions.sql. Apply via psql to fnberp_dev + fnberp_test;
-- via Supabase MCP (apply_migration) to fnberp-prod.
--
-- Re-run safe: ON CONFLICT DO NOTHING on every insert.
--
-- 13 new permission rows (inf.* module). Role baseline grants:
--   brand_owner       — all 13
--   cluster_manager   — 10 (8 baseline + inf.audit.read + inf.issue.assign)
--   finance_manager   — 10 (8 baseline + inf.audit.read + inf.audit.export)
--   superadmin        — 4 (DL-040 BO-approval inbox flow: approval.read/write,
--                          notification.read, notification.preferences.write)
--   kitchen_manager   — 8 baseline
--   store_manager     — 8 baseline
--   procurement_manager — 8 baseline
--   dispatch_staff    — 8 baseline
--   pos_staff         — 8 baseline
--
-- "8 baseline" = inf.approval.{read,write}, inf.notification.{read,preferences.write},
-- inf.issue.{read,write,close}, inf.broadcast.read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions catalog (13 rows)
-- -----------------------------------------------------------------------------
INSERT INTO permissions (module, action, scope, key, description) VALUES
  ('inf', 'read',              'self',  'inf.approval.read',                'View own approval inbox'),
  ('inf', 'write',             'self',  'inf.approval.write',               'Approve / reject / delegate own pending approvals'),
  ('inf', 'configure_chains',  'brand', 'inf.approval.configure_chains',    'Author + edit approval chains'),
  ('inf', 'read',              'self',  'inf.notification.read',            'Read own notifications + preview digest'),
  ('inf', 'preferences.write', 'self',  'inf.notification.preferences.write', 'Edit own notification preferences'),
  ('inf', 'read',              'brand', 'inf.audit.read',                   'View audit trail viewer'),
  ('inf', 'export',            'brand', 'inf.audit.export',                 'Export filtered audit slices'),
  ('inf', 'read',              'self',  'inf.issue.read',                   'List + open issue tickets'),
  ('inf', 'write',             'self',  'inf.issue.write',                  'Create + comment + attach'),
  ('inf', 'assign',            'brand', 'inf.issue.assign',                 'Reassign tickets'),
  ('inf', 'close',             'self',  'inf.issue.close',                  'Close own tickets (originator) or any (BO)'),
  ('inf', 'read',              'self',  'inf.broadcast.read',               'See broadcasts targeted to self'),
  ('inf', 'compose',           'brand', 'inf.broadcast.compose',            'Author broadcasts')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- role_permissions
-- -----------------------------------------------------------------------------

-- brand_owner — all 13.
INSERT INTO role_permissions (role, permission_id)
SELECT 'brand_owner'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write', 'inf.approval.configure_chains',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.audit.read', 'inf.audit.export',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.assign', 'inf.issue.close',
  'inf.broadcast.read', 'inf.broadcast.compose'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- cluster_manager — 10.
INSERT INTO role_permissions (role, permission_id)
SELECT 'cluster_manager'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.audit.read',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.assign', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- finance_manager — 10.
INSERT INTO role_permissions (role, permission_id)
SELECT 'finance_manager'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.audit.read', 'inf.audit.export',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- superadmin — 4 (DL-040 BO-approval inbox flow).
INSERT INTO role_permissions (role, permission_id)
SELECT 'superadmin'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- kitchen_manager — 8 baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT 'kitchen_manager'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- store_manager — 8 baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT 'store_manager'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- procurement_manager — 8 baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT 'procurement_manager'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- dispatch_staff — 8 baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT 'dispatch_staff'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- pos_staff — 8 baseline.
INSERT INTO role_permissions (role, permission_id)
SELECT 'pos_staff'::user_role, id FROM permissions WHERE key IN (
  'inf.approval.read', 'inf.approval.write',
  'inf.notification.read', 'inf.notification.preferences.write',
  'inf.issue.read', 'inf.issue.write', 'inf.issue.close',
  'inf.broadcast.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;
