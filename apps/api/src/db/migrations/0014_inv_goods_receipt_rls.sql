-- =============================================================================
-- 0014_inv_goods_receipt_rls.sql
-- RLS policies for Epic 4 W2 Goods Receipt tables (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0014_inv_goods_receipt.sql.
-- Mirrors the pattern from 0013_inv_rls.sql and 0009_inf_rls.sql.
--
-- Tables covered: goods_receipts, gr_lines, gr_attachments, gr_rejection_records
-- =============================================================================

-- goods_receipts
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY goods_receipts_brand_isolation ON goods_receipts
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY goods_receipts_service_role_bypass ON goods_receipts
  FOR ALL TO service_role
  USING (true);

-- gr_lines
ALTER TABLE gr_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_lines_brand_isolation ON gr_lines
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY gr_lines_service_role_bypass ON gr_lines
  FOR ALL TO service_role
  USING (true);

-- gr_attachments
ALTER TABLE gr_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_attachments_brand_isolation ON gr_attachments
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY gr_attachments_service_role_bypass ON gr_attachments
  FOR ALL TO service_role
  USING (true);

-- gr_rejection_records
ALTER TABLE gr_rejection_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_rejection_records_brand_isolation ON gr_rejection_records
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY gr_rejection_records_service_role_bypass ON gr_rejection_records
  FOR ALL TO service_role
  USING (true);
