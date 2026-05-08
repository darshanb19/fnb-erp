-- =============================================================================
-- 0007_usr_rls.sql
-- RLS policies for user_permission_overrides (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0007_epic2_usr.sql (which contains
-- the Drizzle-generated DDL for Epic 2 USR).
--
-- Scope notes:
--   - permissions and role_permissions are GLOBAL (non-brand-scoped) tables and
--     intentionally do NOT have RLS. Reads are unrestricted to any authenticated
--     user (need to look up permission metadata); writes are service-role-only
--     (Drizzle migrations + DL-032 incremental seeds). RLS would only complicate
--     read paths without adding meaningful protection.
--   - user_permission_overrides IS brand-scoped — same 2-policy template as
--     other brand-scoped tables.
--   - users table RLS is owned by 0001_rls_and_constraints.sql (the RLS policies
--     there already cover the new columns added by 0007 — no change needed).
-- =============================================================================

-- user_permission_overrides
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permission_overrides_brand_isolation ON user_permission_overrides
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY user_permission_overrides_service_role_bypass ON user_permission_overrides
  FOR ALL TO service_role
  USING (true);
