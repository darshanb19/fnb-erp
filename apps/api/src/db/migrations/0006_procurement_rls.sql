-- =============================================================================
-- 0006_procurement_rls.sql
-- RLS policy for procurement tables (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0005_procurement.sql + 0006_procurement_constraints.sql.
--
-- Epic 2 USR Arc (a) fix-back: same advisor warning as 0004_inventory_rls.sql.
-- =============================================================================

-- vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_brand_isolation ON vendors
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY vendors_service_role_bypass ON vendors
  FOR ALL TO service_role
  USING (true);
