-- =============================================================================
-- 0015_inv_transfers_rls.sql
-- RLS policies for Epic 4 W3 Stock Transfer tables (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0015_inv_transfers.sql.
-- Mirrors the pattern from 0014_inv_goods_receipt_rls.sql.
--
-- Tables covered: stock_transfers, stock_transfer_lines,
--                 transfer_bundles, transfer_bundle_legs,
--                 transfer_suggestion_dismissals
-- =============================================================================

-- stock_transfers
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfers_brand_isolation ON stock_transfers
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfers_service_role_bypass ON stock_transfers
  FOR ALL TO service_role
  USING (true);

-- stock_transfer_lines
ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfer_lines_brand_isolation ON stock_transfer_lines
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfer_lines_service_role_bypass ON stock_transfer_lines
  FOR ALL TO service_role
  USING (true);

-- transfer_bundles
ALTER TABLE transfer_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfer_bundles_brand_isolation ON transfer_bundles
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY transfer_bundles_service_role_bypass ON transfer_bundles
  FOR ALL TO service_role
  USING (true);

-- transfer_bundle_legs
ALTER TABLE transfer_bundle_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfer_bundle_legs_brand_isolation ON transfer_bundle_legs
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY transfer_bundle_legs_service_role_bypass ON transfer_bundle_legs
  FOR ALL TO service_role
  USING (true);

-- transfer_suggestion_dismissals
ALTER TABLE transfer_suggestion_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfer_suggestion_dismissals_brand_isolation ON transfer_suggestion_dismissals
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY transfer_suggestion_dismissals_service_role_bypass ON transfer_suggestion_dismissals
  FOR ALL TO service_role
  USING (true);
