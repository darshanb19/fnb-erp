-- =============================================================================
-- 0017_inv_par.sql
-- Epic 4 W5 — PAR Levels table (FR33/FR34)
--
-- Apply to local dev DB via:
--   psql postgresql://darshan@localhost:5432/fnberp_test \
--     -f apps/api/src/db/migrations/0017_inv_par.sql
--
-- RLS policies live in 0017_inv_par_rls.sql (Supabase-only).
--
-- Design notes:
-- - par_levels unique on (brand_id, product_id, location_id, department_id).
--   Both location_id and department_id are nullable:
--     NULL location_id  = brand-wide default PAR
--     NULL department_id = location-wide default PAR
-- - dayOfWeekOverrides is JSONB: { mon?, tue?, wed?, thu?, fri?, sat?, sun? }
-- - auditTrigger: true — PAR changes are audit-significant per SI-INV-004.
-- - Unique constraint uses partial indexes to handle NULLs correctly
--   (NULL != NULL in standard SQL unique constraints).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- par_levels — §3.6 (FR33/FR34)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "par_levels" (
    "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                  uuid NOT NULL,
    "created_at"                timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"                timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"                uuid,
    "updated_by"                uuid,
    "product_id"                uuid NOT NULL,
    "location_id"               uuid,           -- nullable: NULL = brand-wide default
    "department_id"             uuid,           -- nullable: NULL = location-wide default
    "base_par"                  numeric(18, 4) NOT NULL,
    "day_of_week_overrides"     jsonb,
    "last_modified_by_user_id"  uuid,
    "last_modified_at"          timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- Foreign key constraints
-- ---------------------------------------------------------------------------

-- par_levels → brands
DO $$ BEGIN
  ALTER TABLE "par_levels"
    ADD CONSTRAINT "par_levels_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- par_levels → products
DO $$ BEGIN
  ALTER TABLE "par_levels"
    ADD CONSTRAINT "par_levels_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- par_levels → locations (nullable)
DO $$ BEGIN
  ALTER TABLE "par_levels"
    ADD CONSTRAINT "par_levels_location_id_fk"
    FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- par_levels → departments (nullable)
DO $$ BEGIN
  ALTER TABLE "par_levels"
    ADD CONSTRAINT "par_levels_department_id_fk"
    FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- par_levels → users (lastModifiedByUserId, nullable)
DO $$ BEGIN
  ALTER TABLE "par_levels"
    ADD CONSTRAINT "par_levels_last_modified_by_user_id_fk"
    FOREIGN KEY ("last_modified_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary lookup: product × location × department within brand
CREATE INDEX IF NOT EXISTS "idx_par_levels_brand_product_location_dept"
  ON "par_levels" ("brand_id", "product_id", "location_id", "department_id");

-- For below-PAR queries: scan by brand + product or brand + location
CREATE INDEX IF NOT EXISTS "idx_par_levels_brand_location"
  ON "par_levels" ("brand_id", "location_id");

CREATE INDEX IF NOT EXISTS "idx_par_levels_brand_product"
  ON "par_levels" ("brand_id", "product_id");

-- ---------------------------------------------------------------------------
-- Unique constraints — handle nullable columns with partial indexes
-- (NULL != NULL in SQL; use four partial indexes to cover the 2x2 matrix)
-- ---------------------------------------------------------------------------

-- Case 1: both location and department are non-null
CREATE UNIQUE INDEX IF NOT EXISTS "idx_par_levels_unique_loc_dept_not_null"
  ON "par_levels" ("brand_id", "product_id", "location_id", "department_id")
  WHERE "location_id" IS NOT NULL AND "department_id" IS NOT NULL;

-- Case 2: location non-null, department null (location-wide default)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_par_levels_unique_loc_not_null_dept_null"
  ON "par_levels" ("brand_id", "product_id", "location_id")
  WHERE "location_id" IS NOT NULL AND "department_id" IS NULL;

-- Case 3: location null, department non-null (unusual but allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_par_levels_unique_loc_null_dept_not_null"
  ON "par_levels" ("brand_id", "product_id", "department_id")
  WHERE "location_id" IS NULL AND "department_id" IS NOT NULL;

-- Case 4: both null (brand-wide default per product)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_par_levels_unique_both_null"
  ON "par_levels" ("brand_id", "product_id")
  WHERE "location_id" IS NULL AND "department_id" IS NULL;
