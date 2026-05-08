-- =============================================================================
-- 0008_global_rls.sql — Phase 4 Epic 2 USR Arc (a) Task A8 close-out fix-back
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on the service_role which is Supabase-only. Local tests
-- run as superuser and bypass RLS — no local apply needed.
--
-- RLS policies for the two GLOBAL (non-brand-scoped) tables introduced in
-- 0007_epic2_usr.sql: permissions, role_permissions.
--
-- Policy shape differs from the brand-scoped 2-policy template (DL-014):
--   GLOBAL tables: every authenticated user reads ALL rows (the catalog is
--                  application-wide, identical across brands per FR15a + DL-032);
--                  only service_role writes (seeded incrementally via
--                  0008_seed_permissions.sql + future epic seeds).
--
-- Rationale: the A3-time decision header in apps/api/src/db/schema/permissions.ts
-- said "GLOBAL — RLS not needed". Supabase advisor flagged this as a hole at
-- A8 close-out: anon-key holders could INSERT into permissions / role_permissions
-- to grant themselves arbitrary roles. Fix is to enable RLS with the correct
-- policy shape (read-all + service-role-write), not to leave RLS off.
--
-- Sibling file: 0007_usr_rls.sql (RLS for the brand-scoped user_permission_overrides).
-- =============================================================================

-- permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY permissions_read_all_authenticated ON permissions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY permissions_service_role_writes ON permissions
  FOR ALL TO service_role
  USING (true);

-- role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_read_all_authenticated ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY role_permissions_service_role_writes ON role_permissions
  FOR ALL TO service_role
  USING (true);
