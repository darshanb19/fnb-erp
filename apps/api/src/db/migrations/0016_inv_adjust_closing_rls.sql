-- =============================================================================
-- 0016_inv_adjust_closing_rls.sql
-- RLS policies for Epic 4 W4 Adjustment + Closing Inventory tables (DL-014).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Mirrors the pattern from 0015_inv_transfers_rls.sql.
-- Tables covered: inventory_adjustments, adjustment_lines,
--                 closing_inventory, closing_inventory_lines, cut_off_registry
-- =============================================================================

-- inventory_adjustments
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_adjustments_brand_isolation ON inventory_adjustments
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY inventory_adjustments_service_role_bypass ON inventory_adjustments
  FOR ALL TO service_role
  USING (true);

-- adjustment_lines
ALTER TABLE adjustment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY adjustment_lines_brand_isolation ON adjustment_lines
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY adjustment_lines_service_role_bypass ON adjustment_lines
  FOR ALL TO service_role
  USING (true);

-- closing_inventory
ALTER TABLE closing_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY closing_inventory_brand_isolation ON closing_inventory
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY closing_inventory_service_role_bypass ON closing_inventory
  FOR ALL TO service_role
  USING (true);

-- closing_inventory_lines
ALTER TABLE closing_inventory_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY closing_inventory_lines_brand_isolation ON closing_inventory_lines
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY closing_inventory_lines_service_role_bypass ON closing_inventory_lines
  FOR ALL TO service_role
  USING (true);

-- cut_off_registry
ALTER TABLE cut_off_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY cut_off_registry_brand_isolation ON cut_off_registry
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY cut_off_registry_service_role_bypass ON cut_off_registry
  FOR ALL TO service_role
  USING (true);
