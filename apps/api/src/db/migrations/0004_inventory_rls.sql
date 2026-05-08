-- =============================================================================
-- 0004_inventory_rls.sql
-- RLS policies for inventory tables (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0003_lonely_paper_doll.sql + 0004_inventory_constraints.sql
-- (which together contain the Drizzle-generated DDL + non-RLS constraints for the inventory tables).
--
-- Epic 2 USR Arc (a) fix-back: surfaced when provisioning fnberp-prod Supabase project
-- as a security advisor warning ("RLS disabled on 6 tables" — anon-key holders could
-- read/modify all rows). Locally on fnberp_dev this didn't matter (no Supabase Auth);
-- on Supabase it's a real hole. Mirroring the 0002_audit_log_rls.sql pattern.
-- =============================================================================

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_brand_isolation ON categories
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY categories_service_role_bypass ON categories
  FOR ALL TO service_role
  USING (true);

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_brand_isolation ON products
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY products_service_role_bypass ON products
  FOR ALL TO service_role
  USING (true);

-- uoms
ALTER TABLE uoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY uoms_brand_isolation ON uoms
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY uoms_service_role_bypass ON uoms
  FOR ALL TO service_role
  USING (true);

-- product_uoms
ALTER TABLE product_uoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_uoms_brand_isolation ON product_uoms
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY product_uoms_service_role_bypass ON product_uoms
  FOR ALL TO service_role
  USING (true);

-- product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_categories_brand_isolation ON product_categories
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY product_categories_service_role_bypass ON product_categories
  FOR ALL TO service_role
  USING (true);

-- enablement_matrix
ALTER TABLE enablement_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY enablement_matrix_brand_isolation ON enablement_matrix
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY enablement_matrix_service_role_bypass ON enablement_matrix
  FOR ALL TO service_role
  USING (true);
