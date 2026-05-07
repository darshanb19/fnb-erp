-- Phase 4 Epic 1 Arc (a) — procurement constraints + trigram for vendor name (DL-026).
--
-- Split from the Drizzle-generated migration so that:
--   0005_procurement.sql               — Drizzle-generated DDL (table, enums, FKs, basic index)
--   0006_procurement_constraints.sql   — hand-written: trigram index, unique + CHECK constraints
--
-- Applied manually (same pattern as 0004_inventory_constraints.sql):
--   psql $DATABASE_URL -f src/db/migrations/0006_procurement_constraints.sql

-- ---------------------------------------------------------------------------
-- pg_trgm already enabled in 0004_inventory_constraints.sql.
-- Re-creating is a no-op via IF NOT EXISTS.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index on vendor name (DL-026 CC-DUPLICATE-WARN for vendors).
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm
  ON vendors USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Unique vendor code per brand.
-- ---------------------------------------------------------------------------
ALTER TABLE vendors
  ADD CONSTRAINT vendors_brand_code_unique UNIQUE (brand_id, code);

-- ---------------------------------------------------------------------------
-- Scope consistency CHECK constraints (Master Spec §2.7):
--   brand  → both scope_cluster_id and scope_location_id must be NULL
--   cluster → scope_cluster_id must be set; scope_location_id must be NULL
--   pos    → scope_location_id must be set; scope_cluster_id must be NULL
-- ---------------------------------------------------------------------------
ALTER TABLE vendors
  ADD CONSTRAINT vendors_scope_consistency CHECK (
    (scope = 'brand'   AND scope_cluster_id IS NULL AND scope_location_id IS NULL) OR
    (scope = 'cluster' AND scope_cluster_id IS NOT NULL AND scope_location_id IS NULL) OR
    (scope = 'pos'     AND scope_location_id IS NOT NULL AND scope_cluster_id IS NULL)
  );

-- ---------------------------------------------------------------------------
-- Quality rating range 1.00–5.00 (when supplied).
-- ---------------------------------------------------------------------------
ALTER TABLE vendors
  ADD CONSTRAINT vendors_quality_rating_range CHECK (
    quality_rating IS NULL OR (quality_rating >= 1.00 AND quality_rating <= 5.00)
  );
