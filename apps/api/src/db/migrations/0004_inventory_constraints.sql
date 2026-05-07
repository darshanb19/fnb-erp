-- Phase 4 Epic 1 Arc (a) — inventory constraints + pg_trgm
-- Per plan Task A6 Step 2 + DL-023 + DL-026.
--
-- Split from the Drizzle-generated migration so that:
--   0003_lonely_paper_doll.sql  — Drizzle-generated DDL (tables, FKs, basic indexes)
--   0004_inventory_constraints.sql — hand-written constraints, trigram, self-FK, depth trigger
--   (RLS DDL is Supabase-only; not shipped locally — same pattern as Task A3)
--
-- Audit-trigger function body remains a Phase 3a follow-up.
-- The enablement_matrix entry in auditTriggerRegistry (brand-scoped-table.ts) is the
-- gating mechanism used by downstream code; the actual PL/pgSQL trigger body is deferred.

-- ---------------------------------------------------------------------------
-- pg_trgm for fuzzy-name lookup (DL-026 CC-DUPLICATE-WARN).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes on duplicate-warn target tables.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_categories_name_trgm
  ON categories USING gin (name gin_trgm_ops);

-- vendors trigram will be added in Task A8 migration.

-- ---------------------------------------------------------------------------
-- Composite unique constraints per the brand_id + natural-key pattern.
-- ---------------------------------------------------------------------------

ALTER TABLE uoms
  ADD CONSTRAINT uoms_brand_code_unique UNIQUE (brand_id, code);

ALTER TABLE products
  ADD CONSTRAINT products_brand_sku_unique UNIQUE (brand_id, sku);

ALTER TABLE product_uoms
  ADD CONSTRAINT product_uoms_brand_product_uom_unique UNIQUE (brand_id, product_id, uom_id);

-- Exactly one is_default=true per product (per brand). A partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS product_uoms_one_default_per_product
  ON product_uoms (brand_id, product_id)
  WHERE is_default = true;

ALTER TABLE product_categories
  ADD CONSTRAINT product_categories_brand_product_category_unique
  UNIQUE (brand_id, product_id, category_id);

ALTER TABLE enablement_matrix
  ADD CONSTRAINT enablement_matrix_brand_product_dept_unique
  UNIQUE (brand_id, product_id, department_id);

-- ---------------------------------------------------------------------------
-- Categories self-FK + two-level depth trigger.
-- ---------------------------------------------------------------------------

ALTER TABLE categories
  ADD CONSTRAINT categories_parent_fk
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT;

-- Two-level depth: a category's parent (if any) must itself have a NULL parent.
-- Postgres does not natively support subquery CHECK constraints on rows,
-- so we enforce with a trigger.
CREATE OR REPLACE FUNCTION categories_two_level_depth_check() RETURNS trigger AS $$
DECLARE
  parent_parent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT c.parent_id INTO parent_parent FROM categories c WHERE c.id = NEW.parent_id;
  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'categories_two_level_depth_check: parent % is not a top-level category (it has parent %)',
      NEW.parent_id, parent_parent;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_two_level_depth_trigger
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION categories_two_level_depth_check();
