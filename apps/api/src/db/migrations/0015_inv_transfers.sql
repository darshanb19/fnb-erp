-- =============================================================================
-- 0015_inv_transfers.sql
-- Epic 4 W3 — Stock Transfer + Bundle + Suggestion Dismissal tables
--
-- Apply to local dev DB via:
--   psql postgresql://darshan@localhost:5432/fnberp_test -f apps/api/src/db/migrations/0015_inv_transfers.sql
--
-- RLS policies live in 0015_inv_transfers_rls.sql (Supabase-only).
--
-- Design notes:
-- - stock_transfers.bundle_leg_id ↔ transfer_bundle_legs mutual reference:
--     Both columns declared as plain uuid (no FK at CREATE TABLE time).
--     Both FKs added after BOTH tables exist (see bottom of this file).
-- - goods_receipts.transfer_id deferred FK (W2 deferred this to W3):
--     Added at bottom of this file after stock_transfers exists.
-- - approval_chain_entity_type enum extended with 'stock_transfer' value.
-- - Unique constraints: (brand_id, st_trn) and (brand_id, bundle_ref).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend approval_chain_entity_type enum with 'stock_transfer'
-- (safe to add; existing rows unaffected)
-- ---------------------------------------------------------------------------

ALTER TYPE "public"."approval_chain_entity_type" ADD VALUE IF NOT EXISTS 'stock_transfer';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "public"."transfer_status_enum" AS ENUM(
  'draft',
  'pending_approval',
  'approved',
  'in_transit',
  'received',
  'cancelled'
);

CREATE TYPE "public"."bundle_status_enum" AS ENUM(
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);

CREATE TYPE "public"."leg_status_enum" AS ENUM(
  'pending',
  'in_transit',
  'received',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- stock_transfers
-- bundle_leg_id: plain uuid (no FK here — mutual ref; FK added at end)
-- approval_request_id: plain uuid (cross-domain; no FK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "stock_transfers" (
    "id"                           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                     uuid NOT NULL,
    "created_at"                   timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"                   timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"                   uuid,
    "updated_by"                   uuid,
    "st_trn"                       text NOT NULL,
    "source_department_id"         uuid NOT NULL,
    "destination_department_id"    uuid NOT NULL,
    "status"                       "public"."transfer_status_enum" NOT NULL DEFAULT 'draft',
    "reason_code"                  text,
    "bundle_leg_id"                uuid,           -- plain uuid; FK added below after transfer_bundle_legs exists
    "requested_by_user_id"         uuid,
    "requested_at"                 timestamp with time zone,
    "approval_request_id"          uuid            -- cross-domain link; no FK constraint
);

-- ---------------------------------------------------------------------------
-- stock_transfer_lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "stock_transfer_lines" (
    "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"            uuid NOT NULL,
    "created_at"          timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"          timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"          uuid,
    "updated_by"          uuid,
    "stock_transfer_id"   uuid NOT NULL,
    "product_id"          uuid NOT NULL,
    "requested_qty"       numeric(18, 4) NOT NULL,
    "fulfilled_qty"       numeric(18, 4),
    "source_batch_id"     uuid,
    "reason_code"         text
);

-- ---------------------------------------------------------------------------
-- transfer_bundles
-- approval_request_id: plain uuid (cross-domain; no FK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "transfer_bundles" (
    "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                uuid NOT NULL,
    "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"              uuid,
    "updated_by"              uuid,
    "bundle_ref"              text NOT NULL,
    "originating_cluster_id"  uuid NOT NULL,
    "destination_cluster_id"  uuid NOT NULL,
    "status"                  "public"."bundle_status_enum" NOT NULL DEFAULT 'draft',
    "approval_request_id"     uuid            -- cross-domain link; no FK constraint
);

-- ---------------------------------------------------------------------------
-- transfer_bundle_legs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "transfer_bundle_legs" (
    "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"             uuid NOT NULL,
    "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"           timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"           uuid,
    "updated_by"           uuid,
    "transfer_bundle_id"   uuid NOT NULL,
    "leg_no"               integer NOT NULL,
    "from_store_id"        uuid,
    "to_store_id"          uuid,
    "status"               "public"."leg_status_enum" NOT NULL DEFAULT 'pending'
);

-- ---------------------------------------------------------------------------
-- transfer_suggestion_dismissals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "transfer_suggestion_dismissals" (
    "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"              uuid NOT NULL,
    "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"            uuid,
    "updated_by"            uuid,
    "product_id"            uuid NOT NULL,
    "batch_id"              uuid,
    "dismissed_by_user_id"  uuid,
    "dismissed_at"          timestamp with time zone NOT NULL,
    "reason_code"           text
);

-- ---------------------------------------------------------------------------
-- Foreign key constraints — non-mutual references
-- ---------------------------------------------------------------------------

-- stock_transfers → brands
DO $$ BEGIN
  ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfers → departments (source)
DO $$ BEGIN
  ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_source_department_id_fk"
    FOREIGN KEY ("source_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfers → departments (destination)
DO $$ BEGIN
  ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_destination_department_id_fk"
    FOREIGN KEY ("destination_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfers → users (requestedByUserId)
DO $$ BEGIN
  ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_requested_by_user_id_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfer_lines → brands
DO $$ BEGIN
  ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfer_lines → stock_transfers
DO $$ BEGIN
  ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_fk"
    FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfer_lines → products
DO $$ BEGIN
  ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- stock_transfer_lines → stock_batches (sourceBatchId, nullable)
DO $$ BEGIN
  ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_source_batch_id_fk"
    FOREIGN KEY ("source_batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundles → brands
DO $$ BEGIN
  ALTER TABLE "transfer_bundles"
    ADD CONSTRAINT "transfer_bundles_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundles → clusters (originating)
DO $$ BEGIN
  ALTER TABLE "transfer_bundles"
    ADD CONSTRAINT "transfer_bundles_originating_cluster_id_fk"
    FOREIGN KEY ("originating_cluster_id") REFERENCES "public"."clusters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundles → clusters (destination)
DO $$ BEGIN
  ALTER TABLE "transfer_bundles"
    ADD CONSTRAINT "transfer_bundles_destination_cluster_id_fk"
    FOREIGN KEY ("destination_cluster_id") REFERENCES "public"."clusters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundle_legs → brands
DO $$ BEGIN
  ALTER TABLE "transfer_bundle_legs"
    ADD CONSTRAINT "transfer_bundle_legs_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundle_legs → transfer_bundles
DO $$ BEGIN
  ALTER TABLE "transfer_bundle_legs"
    ADD CONSTRAINT "transfer_bundle_legs_transfer_bundle_id_fk"
    FOREIGN KEY ("transfer_bundle_id") REFERENCES "public"."transfer_bundles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundle_legs → stores (fromStoreId, nullable)
DO $$ BEGIN
  ALTER TABLE "transfer_bundle_legs"
    ADD CONSTRAINT "transfer_bundle_legs_from_store_id_fk"
    FOREIGN KEY ("from_store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_bundle_legs → stores (toStoreId, nullable)
DO $$ BEGIN
  ALTER TABLE "transfer_bundle_legs"
    ADD CONSTRAINT "transfer_bundle_legs_to_store_id_fk"
    FOREIGN KEY ("to_store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_suggestion_dismissals → brands
DO $$ BEGIN
  ALTER TABLE "transfer_suggestion_dismissals"
    ADD CONSTRAINT "transfer_suggestion_dismissals_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_suggestion_dismissals → products
DO $$ BEGIN
  ALTER TABLE "transfer_suggestion_dismissals"
    ADD CONSTRAINT "transfer_suggestion_dismissals_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_suggestion_dismissals → stock_batches (nullable)
DO $$ BEGIN
  ALTER TABLE "transfer_suggestion_dismissals"
    ADD CONSTRAINT "transfer_suggestion_dismissals_batch_id_fk"
    FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- transfer_suggestion_dismissals → users (nullable)
DO $$ BEGIN
  ALTER TABLE "transfer_suggestion_dismissals"
    ADD CONSTRAINT "transfer_suggestion_dismissals_dismissed_by_user_id_fk"
    FOREIGN KEY ("dismissed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Mutual FK resolution — stock_transfers.bundle_leg_id ↔ transfer_bundle_legs
-- (Both tables now exist; add the FKs in both directions)
-- ---------------------------------------------------------------------------

-- stock_transfers.bundle_leg_id → transfer_bundle_legs.id
DO $$ BEGIN
  ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_bundle_leg_id_fk"
    FOREIGN KEY ("bundle_leg_id") REFERENCES "public"."transfer_bundle_legs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Deferred FK: goods_receipts.transfer_id → stock_transfers.id
-- (W2 left this nullable without FK; W3 adds the FK now that stock_transfers exists)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "fk_gr_transfer"
    FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- stock_transfers: TRN lookup (natural key)
CREATE INDEX IF NOT EXISTS "idx_stock_transfers_brand_st_trn"
  ON "stock_transfers" ("brand_id", "st_trn");

-- stock_transfers: filter by status
CREATE INDEX IF NOT EXISTS "idx_stock_transfers_brand_status"
  ON "stock_transfers" ("brand_id", "status");

-- stock_transfers: filter by source department
CREATE INDEX IF NOT EXISTS "idx_stock_transfers_brand_source_dept"
  ON "stock_transfers" ("brand_id", "source_department_id");

-- stock_transfers: filter by destination department
CREATE INDEX IF NOT EXISTS "idx_stock_transfers_brand_dest_dept"
  ON "stock_transfers" ("brand_id", "destination_department_id");

-- stock_transfer_lines: all lines for a transfer
CREATE INDEX IF NOT EXISTS "idx_stock_transfer_lines_transfer_id"
  ON "stock_transfer_lines" ("stock_transfer_id");

CREATE INDEX IF NOT EXISTS "idx_stock_transfer_lines_brand_id"
  ON "stock_transfer_lines" ("brand_id");

-- transfer_bundles: bundle_ref lookup
CREATE INDEX IF NOT EXISTS "idx_transfer_bundles_brand_bundle_ref"
  ON "transfer_bundles" ("brand_id", "bundle_ref");

-- transfer_bundle_legs: all legs for a bundle
CREATE INDEX IF NOT EXISTS "idx_transfer_bundle_legs_bundle_id"
  ON "transfer_bundle_legs" ("transfer_bundle_id");

CREATE INDEX IF NOT EXISTS "idx_transfer_bundle_legs_brand_id"
  ON "transfer_bundle_legs" ("brand_id");

-- transfer_suggestion_dismissals: lookup by product
CREATE INDEX IF NOT EXISTS "idx_transfer_suggestion_dismissals_brand_product"
  ON "transfer_suggestion_dismissals" ("brand_id", "product_id");

CREATE INDEX IF NOT EXISTS "idx_transfer_suggestion_dismissals_brand_id"
  ON "transfer_suggestion_dismissals" ("brand_id");

-- ---------------------------------------------------------------------------
-- Unique constraints
-- ---------------------------------------------------------------------------

-- stock_transfers: one TRN per (brand, st_trn)
ALTER TABLE "stock_transfers"
  ADD CONSTRAINT "stock_transfers_brand_st_trn_unique"
  UNIQUE ("brand_id", "st_trn");

-- transfer_bundles: one bundle_ref per brand
ALTER TABLE "transfer_bundles"
  ADD CONSTRAINT "transfer_bundles_brand_bundle_ref_unique"
  UNIQUE ("brand_id", "bundle_ref");
