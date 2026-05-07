-- =============================================================================
-- 0002_audit_log_rls.sql
-- RLS policies for audit_log table.
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- The audit_log table DDL (CREATE TABLE + indexes) lives in 0002_audit_log.sql
-- which IS safe to apply locally. This file is the Supabase-only counterpart.
--
-- Per DL-013 (application-layer audit primary): the service-layer auditLog.record()
-- is the primary write path. RLS here enforces brand isolation for read access.
-- =============================================================================

-- RLS — canonical 2-policy template (same pattern as other org-scoped tables in 0001_rls_and_constraints.sql)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_brand_isolation ON audit_log
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY audit_log_service_role_bypass ON audit_log
  FOR ALL TO service_role
  USING (true);
