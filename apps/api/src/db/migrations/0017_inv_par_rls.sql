-- =============================================================================
-- 0017_inv_par_rls.sql
-- RLS policies for Epic 4 W5 PAR Levels table (DL-014).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Mirrors the pattern from 0016_inv_adjust_closing_rls.sql.
-- Tables covered: par_levels
-- =============================================================================

-- par_levels
ALTER TABLE par_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY par_levels_brand_isolation ON par_levels
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY par_levels_service_role_bypass ON par_levels
  FOR ALL TO service_role
  USING (true);
