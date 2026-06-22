-- =============================================================================
-- 0013_inv_rls.sql
-- RLS policies for Epic 4 W1 stock engine tables (DL-014 canonical 2-policy template).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0013_epic4_inv.sql.
-- Mirrors the pattern from 0004_inventory_rls.sql and 0009_inf_rls.sql.
--
-- Tables covered: trn_sequences, journal_events, stock_levels, stock_batches, stock_movements
-- =============================================================================

-- trn_sequences
ALTER TABLE trn_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY trn_sequences_brand_isolation ON trn_sequences
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY trn_sequences_service_role_bypass ON trn_sequences
  FOR ALL TO service_role
  USING (true);

-- journal_events
ALTER TABLE journal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_events_brand_isolation ON journal_events
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY journal_events_service_role_bypass ON journal_events
  FOR ALL TO service_role
  USING (true);

-- stock_levels
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_levels_brand_isolation ON stock_levels
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_levels_service_role_bypass ON stock_levels
  FOR ALL TO service_role
  USING (true);

-- stock_batches
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_batches_brand_isolation ON stock_batches
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_batches_service_role_bypass ON stock_batches
  FOR ALL TO service_role
  USING (true);

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_brand_isolation ON stock_movements
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_movements_service_role_bypass ON stock_movements
  FOR ALL TO service_role
  USING (true);
