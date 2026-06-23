-- =============================================================================
-- 0016_inv_adjust_closing.sql
-- Epic 4 W4 — Inventory Adjustments + Closing Inventory + Cut-Off Registry tables
--
-- Apply to local dev DB via:
--   psql postgresql://darshan@localhost:5432/fnberp_test \
--     -f apps/api/src/db/migrations/0016_inv_adjust_closing.sql
--
-- RLS policies live in 0016_inv_adjust_closing_rls.sql (Supabase-only).
--
-- Design notes:
-- - adjustment_lines.reason_code is NOT NULL (FR37 mandatory reason).
-- - closing_inventory unique on (brand_id, location_id, department_id, business_date).
-- - cut_off_registry.department_id is nullable (NULL = location-level default).
-- - Extends approval_chain_entity_type enum with 'inventory_adjustment'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend approval_chain_entity_type enum with 'inventory_adjustment'
-- (safe to add; existing rows unaffected)
-- ---------------------------------------------------------------------------

ALTER TYPE "public"."approval_chain_entity_type" ADD VALUE IF NOT EXISTS 'inventory_adjustment';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "public"."adjustment_status_enum" AS ENUM(
  'draft',
  'pending_approval',
  'confirmed',
  'cancelled'
);

CREATE TYPE "public"."closing_status_enum" AS ENUM(
  'draft',
  'confirmed',
  'variance_flagged'
);

-- ---------------------------------------------------------------------------
-- inventory_adjustments — §3.4 (FR37)
-- approval_request_id: plain uuid (cross-domain; no FK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
    "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                uuid NOT NULL,
    "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"              uuid,
    "updated_by"              uuid,
    "adj_trn"                 text NOT NULL,
    "department_id"           uuid NOT NULL,
    "status"                  "public"."adjustment_status_enum" NOT NULL DEFAULT 'draft',
    "aggregate_value_impact"  numeric(18, 4),
    "approval_request_id"     uuid,           -- cross-domain link; no FK constraint
    "requested_by_user_id"    uuid,
    "requested_at"            timestamp with time zone,
    "confirmed_at"            timestamp with time zone
);

-- ---------------------------------------------------------------------------
-- adjustment_lines — §3.4; reason_code NOT NULL (FR37)
-- batchId nullable (assigned at confirm time for FEFO deductions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "adjustment_lines" (
    "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                  uuid NOT NULL,
    "created_at"                timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"                timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"                uuid,
    "updated_by"                uuid,
    "inventory_adjustment_id"   uuid NOT NULL,
    "product_id"                uuid NOT NULL,
    "batch_id"                  uuid,
    "current_on_hand"           numeric(18, 4),
    "delta"                     numeric(18, 4) NOT NULL,
    "reason_code"               text NOT NULL
);

-- ---------------------------------------------------------------------------
-- closing_inventory — §3.5 (FR35/FR36/FR77)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "closing_inventory" (
    "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"              uuid NOT NULL,
    "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"            uuid,
    "updated_by"            uuid,
    "ci_trn"                text NOT NULL,
    "location_id"           uuid NOT NULL,
    "department_id"         uuid NOT NULL,
    "business_date"         date NOT NULL,
    "status"                "public"."closing_status_enum" NOT NULL DEFAULT 'draft',
    "submission_timestamp"  timestamp with time zone,
    "cut_off_status"        text,           -- 'on_time' | 'late' | 'not_submitted'
    "total_variance_value"  numeric(18, 4),
    "variance_items_count"  integer,
    "variance_acceptable"   boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- closing_inventory_lines — §3.5
-- reason_code nullable — enforced in service when variance ≠ 0
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "closing_inventory_lines" (
    "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"              uuid NOT NULL,
    "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"            uuid,
    "updated_by"            uuid,
    "closing_inventory_id"  uuid NOT NULL,
    "product_id"            uuid NOT NULL,
    "expected_qty"          numeric(18, 4) NOT NULL,
    "counted_qty"           numeric(18, 4) NOT NULL,
    "variance"              numeric(18, 4) NOT NULL,
    "reason_code"           text
);

-- ---------------------------------------------------------------------------
-- cut_off_registry — §3.5 (FR36)
-- department_id nullable = location-level default
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "cut_off_registry" (
    "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"        uuid NOT NULL,
    "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"      timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"      uuid,
    "updated_by"      uuid,
    "location_id"     uuid NOT NULL,
    "department_id"   uuid,               -- nullable = location-level default
    "cut_off_time"    text NOT NULL       -- 'HH:MM'
);

-- ---------------------------------------------------------------------------
-- Foreign key constraints — inventory_adjustments
-- ---------------------------------------------------------------------------

-- inventory_adjustments → brands
DO $$ BEGIN
  ALTER TABLE "inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- inventory_adjustments → departments
DO $$ BEGIN
  ALTER TABLE "inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_department_id_fk"
    FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- inventory_adjustments → users (requestedByUserId, nullable)
DO $$ BEGIN
  ALTER TABLE "inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_requested_by_user_id_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Foreign key constraints — adjustment_lines
-- ---------------------------------------------------------------------------

-- adjustment_lines → brands
DO $$ BEGIN
  ALTER TABLE "adjustment_lines"
    ADD CONSTRAINT "adjustment_lines_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- adjustment_lines → inventory_adjustments
DO $$ BEGIN
  ALTER TABLE "adjustment_lines"
    ADD CONSTRAINT "adjustment_lines_inventory_adjustment_id_fk"
    FOREIGN KEY ("inventory_adjustment_id") REFERENCES "public"."inventory_adjustments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- adjustment_lines → products
DO $$ BEGIN
  ALTER TABLE "adjustment_lines"
    ADD CONSTRAINT "adjustment_lines_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- adjustment_lines → stock_batches (batchId, nullable)
DO $$ BEGIN
  ALTER TABLE "adjustment_lines"
    ADD CONSTRAINT "adjustment_lines_batch_id_fk"
    FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Foreign key constraints — closing_inventory
-- ---------------------------------------------------------------------------

-- closing_inventory → brands
DO $$ BEGIN
  ALTER TABLE "closing_inventory"
    ADD CONSTRAINT "closing_inventory_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- closing_inventory → locations
DO $$ BEGIN
  ALTER TABLE "closing_inventory"
    ADD CONSTRAINT "closing_inventory_location_id_fk"
    FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- closing_inventory → departments
DO $$ BEGIN
  ALTER TABLE "closing_inventory"
    ADD CONSTRAINT "closing_inventory_department_id_fk"
    FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Foreign key constraints — closing_inventory_lines
-- ---------------------------------------------------------------------------

-- closing_inventory_lines → brands
DO $$ BEGIN
  ALTER TABLE "closing_inventory_lines"
    ADD CONSTRAINT "closing_inventory_lines_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- closing_inventory_lines → closing_inventory
DO $$ BEGIN
  ALTER TABLE "closing_inventory_lines"
    ADD CONSTRAINT "closing_inventory_lines_closing_inventory_id_fk"
    FOREIGN KEY ("closing_inventory_id") REFERENCES "public"."closing_inventory"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- closing_inventory_lines → products
DO $$ BEGIN
  ALTER TABLE "closing_inventory_lines"
    ADD CONSTRAINT "closing_inventory_lines_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Foreign key constraints — cut_off_registry
-- ---------------------------------------------------------------------------

-- cut_off_registry → brands
DO $$ BEGIN
  ALTER TABLE "cut_off_registry"
    ADD CONSTRAINT "cut_off_registry_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- cut_off_registry → locations
DO $$ BEGIN
  ALTER TABLE "cut_off_registry"
    ADD CONSTRAINT "cut_off_registry_location_id_fk"
    FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- cut_off_registry → departments (nullable)
DO $$ BEGIN
  ALTER TABLE "cut_off_registry"
    ADD CONSTRAINT "cut_off_registry_department_id_fk"
    FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- inventory_adjustments: TRN lookup
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_brand_adj_trn"
  ON "inventory_adjustments" ("brand_id", "adj_trn");

-- inventory_adjustments: filter by status
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_brand_status"
  ON "inventory_adjustments" ("brand_id", "status");

-- inventory_adjustments: filter by department
CREATE INDEX IF NOT EXISTS "idx_inventory_adjustments_brand_dept"
  ON "inventory_adjustments" ("brand_id", "department_id");

-- adjustment_lines: all lines for an adjustment
CREATE INDEX IF NOT EXISTS "idx_adjustment_lines_adjustment_id"
  ON "adjustment_lines" ("inventory_adjustment_id");

CREATE INDEX IF NOT EXISTS "idx_adjustment_lines_brand_id"
  ON "adjustment_lines" ("brand_id");

-- closing_inventory: natural key lookup
CREATE INDEX IF NOT EXISTS "idx_closing_inventory_brand_location_dept_date"
  ON "closing_inventory" ("brand_id", "location_id", "department_id", "business_date");

-- closing_inventory: filter by status
CREATE INDEX IF NOT EXISTS "idx_closing_inventory_brand_status"
  ON "closing_inventory" ("brand_id", "status");

-- closing_inventory_lines: all lines for a closing
CREATE INDEX IF NOT EXISTS "idx_closing_inventory_lines_closing_id"
  ON "closing_inventory_lines" ("closing_inventory_id");

CREATE INDEX IF NOT EXISTS "idx_closing_inventory_lines_brand_id"
  ON "closing_inventory_lines" ("brand_id");

-- cut_off_registry: primary lookup
CREATE INDEX IF NOT EXISTS "idx_cut_off_registry_brand_location_dept"
  ON "cut_off_registry" ("brand_id", "location_id", "department_id");

CREATE INDEX IF NOT EXISTS "idx_cut_off_registry_brand_id"
  ON "cut_off_registry" ("brand_id");

-- ---------------------------------------------------------------------------
-- Unique constraints
-- ---------------------------------------------------------------------------

-- inventory_adjustments: one TRN per (brand, adj_trn)
ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_brand_adj_trn_unique"
  UNIQUE ("brand_id", "adj_trn");

-- closing_inventory: one closing per (brand, location, department, business_date)
ALTER TABLE "closing_inventory"
  ADD CONSTRAINT "closing_inventory_brand_location_dept_date_unique"
  UNIQUE ("brand_id", "location_id", "department_id", "business_date");

-- cut_off_registry: one cut-off config per (brand, location, department)
-- department_id may be NULL (location default); NULL != NULL in SQL so NULLS are allowed
-- to co-exist under a simple UNIQUE. We use a partial unique index instead:
--   1. Unique per (brand_id, location_id) WHERE department_id IS NULL (the location default).
--   2. Unique per (brand_id, location_id, department_id) WHERE department_id IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_cut_off_registry_brand_location_null_dept"
  ON "cut_off_registry" ("brand_id", "location_id")
  WHERE "department_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_cut_off_registry_brand_location_dept_not_null"
  ON "cut_off_registry" ("brand_id", "location_id", "department_id")
  WHERE "department_id" IS NOT NULL;
