-- =============================================================================
-- 0001_rls_and_constraints.sql
-- Hand-augmented migration — Phase 4 Epic 1 Arc (a) Task A3
--
-- Drizzle Kit does not model RLS, audit triggers, or arbitrary CHECK constraints.
-- This file adds:
--   (a) RLS on brands (system table — single-policy template)
--   (b) RLS on org-scoped tables: users, clusters, locations, departments, stores
--       (canonical 2-policy template per DL-014 / rls-template.ts)
--   (c) stores level CHECK constraints (DL-022 §2.3)
--   (d) Comment documenting the intentional absence of brands.created_by FK (DL-024)
--   (e) Stub comment for DL-013 audit trigger (blocked on audit_log table — Epic 3)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- (a) RLS on brands — system table
-- ---------------------------------------------------------------------------

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY brands_service_role_only ON brands
  FOR ALL TO service_role
  USING (true);


-- ---------------------------------------------------------------------------
-- (b) RLS on org-scoped tables — canonical 2-policy pattern (DL-014)
-- ---------------------------------------------------------------------------

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_brand_isolation ON users
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY users_service_role_bypass ON users
  FOR ALL TO service_role
  USING (true);

-- clusters
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY clusters_brand_isolation ON clusters
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY clusters_service_role_bypass ON clusters
  FOR ALL TO service_role
  USING (true);

-- locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY locations_brand_isolation ON locations
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY locations_service_role_bypass ON locations
  FOR ALL TO service_role
  USING (true);

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY departments_brand_isolation ON departments
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY departments_service_role_bypass ON departments
  FOR ALL TO service_role
  USING (true);

-- stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY stores_brand_isolation ON stores
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY stores_service_role_bypass ON stores
  FOR ALL TO service_role
  USING (true);


-- ---------------------------------------------------------------------------
-- (c) stores level CHECK constraints — Master Spec §2.3 + DL-022
--     Drizzle does not emit arbitrary CHECK constraints; hand-written here.
-- ---------------------------------------------------------------------------

ALTER TABLE stores ADD CONSTRAINT stores_level_check
  CHECK (level IN ('brand', 'cluster'));

ALTER TABLE stores ADD CONSTRAINT stores_level_cluster_consistency
  CHECK (
    (level = 'brand'   AND cluster_id IS NULL) OR
    (level = 'cluster' AND cluster_id IS NOT NULL)
  );


-- ---------------------------------------------------------------------------
-- (d) brands.created_by / updated_by — intentionally plain UUID, no FK
--
-- These columns reference users.id conceptually, but we do NOT add the FK here.
-- Reason: the brand-seed bootstrap (DL-024 Task A4) runs before any user row
-- exists. A FK would block seed inserts. A future epic can add the FK once the
-- user-bootstrap flow is in place and seed rows carry real user IDs.
--
-- Foreign key to add in a future migration (example, do NOT run now):
--   ALTER TABLE brands
--     ADD CONSTRAINT brands_created_by_users_id_fk
--     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- (e) DL-013 audit trigger backstop — STUB (Phase 3a follow-up)
--
-- DL-013 requires an audit_log_trigger_fn() Postgres trigger on critical tables
-- (users, products, recipes, purchase_orders). The trigger fires on UPDATE/DELETE
-- and inserts a row into the audit_log table, reading current_setting('app.user_id').
--
-- Blocked: the audit_log table is Epic 3 territory (audit.ts schema not yet defined).
-- For Arc (a), the application-layer auditLog.record(...) call in the service layer
-- is the PRIMARY audit path (DL-013: "When both layers fire, prefer the app-layer row").
-- The trigger is a backstop for raw-DB writes that bypass the service layer.
--
-- TODO Phase 3a / Epic 3: ship audit_log table + audit_log_trigger_fn() DDL, then
-- attach the trigger to: users, products, recipes, purchase_orders.
--
-- Example trigger DDL (do NOT run now — audit_log table does not exist yet):
--   CREATE OR REPLACE FUNCTION audit_log_trigger_fn()
--   RETURNS TRIGGER LANGUAGE plpgsql AS $$
--   BEGIN
--     INSERT INTO audit_log (table_name, record_id, operation, actor_id, old_data, new_data, occurred_at)
--     VALUES (
--       TG_TABLE_NAME,
--       COALESCE(NEW.id, OLD.id),
--       TG_OP,
--       current_setting('app.user_id', true)::uuid,
--       to_jsonb(OLD),
--       to_jsonb(NEW),
--       now()
--     );
--     RETURN NEW;
--   END;
--   $$;
--
--   CREATE TRIGGER users_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON users
--     FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
-- ---------------------------------------------------------------------------
