-- =============================================================================
-- 0014_inv_goods_receipt.sql
-- Epic 4 W2 — Goods Receipt tables
--
-- Tables: goods_receipts, gr_lines, gr_attachments, gr_rejection_records
--
-- Apply to local dev DB via:
--   psql postgresql://darshan@localhost:5432/fnberp_test -f apps/api/src/db/migrations/0014_inv_goods_receipt.sql
--
-- RLS policies live in 0014_inv_goods_receipt_rls.sql (Supabase-only).
--
-- Design notes:
-- - goods_receipts.po_id: nullable uuid, NO FK (no purchase_orders table — Epic 5)
-- - goods_receipts.transfer_id: nullable uuid, NO FK (stock_transfers W3 adds the FK)
-- - gr_status_enum: 'draft' | 'confirmed' | 'pending_approval' | 'rejected'
-- - Unique constraint on (brand_id, gr_trn) — natural key for TRN lookup
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

CREATE TYPE "public"."gr_status_enum" AS ENUM('draft', 'confirmed', 'pending_approval', 'rejected');

-- ---------------------------------------------------------------------------
-- goods_receipts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "goods_receipts" (
    "id"                           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                     uuid NOT NULL,
    "created_at"                   timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"                   timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"                   uuid,
    "updated_by"                   uuid,
    "gr_trn"                       text NOT NULL,
    "po_id"                        uuid,                           -- nullable; no FK (Epic 5)
    "transfer_id"                  uuid,                           -- nullable; no FK (W3 adds FK to stock_transfers)
    "destination_department_id"    uuid NOT NULL,
    "status"                       "public"."gr_status_enum" NOT NULL DEFAULT 'draft',
    "received_by_user_id"          uuid,
    "received_at"                  timestamp with time zone
);

-- ---------------------------------------------------------------------------
-- gr_lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "gr_lines" (
    "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                uuid NOT NULL,
    "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"              uuid,
    "updated_by"              uuid,
    "goods_receipt_id"        uuid NOT NULL,
    "product_id"              uuid NOT NULL,
    "received_qty"            numeric(18, 4) NOT NULL,
    "yield_factor"            numeric(5, 4) NOT NULL DEFAULT '1.0000',
    "usable_qty"              numeric(18, 4) NOT NULL,
    "wastage_qty"             numeric(18, 4) NOT NULL,
    "unit_cost"               numeric(18, 4),
    "adjusted_cost_per_unit"  numeric(18, 4),
    "expiry_date"             date,
    "batch_number"            text,
    "variance_qty"            numeric(18, 4),
    "reason_code"             text
);

-- ---------------------------------------------------------------------------
-- gr_attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "gr_attachments" (
    "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"          uuid NOT NULL,
    "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"        timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"        uuid,
    "updated_by"        uuid,
    "goods_receipt_id"  uuid NOT NULL,
    "file_id"           uuid,
    "kind"              text NOT NULL
);

-- ---------------------------------------------------------------------------
-- gr_rejection_records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "gr_rejection_records" (
    "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id"                uuid NOT NULL,
    "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
    "created_by"              uuid,
    "updated_by"              uuid,
    "goods_receipt_id"        uuid NOT NULL,
    "rejection_reason_code"   text NOT NULL,
    "notes"                   text,
    "rejected_by_user_id"     uuid,
    "rejected_at"             timestamp with time zone NOT NULL,
    "vcn_deferred"            boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- Foreign key constraints
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_destination_department_id_fk"
    FOREIGN KEY ("destination_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_received_by_user_id_fk"
    FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_lines"
    ADD CONSTRAINT "gr_lines_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_lines"
    ADD CONSTRAINT "gr_lines_goods_receipt_id_fk"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_lines"
    ADD CONSTRAINT "gr_lines_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_attachments"
    ADD CONSTRAINT "gr_attachments_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_attachments"
    ADD CONSTRAINT "gr_attachments_goods_receipt_id_fk"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_rejection_records"
    ADD CONSTRAINT "gr_rejection_records_brand_id_brands_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_rejection_records"
    ADD CONSTRAINT "gr_rejection_records_goods_receipt_id_fk"
    FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "gr_rejection_records"
    ADD CONSTRAINT "gr_rejection_records_rejected_by_user_id_fk"
    FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- goods_receipts: composite lookup index (brand_id, gr_trn)
CREATE INDEX IF NOT EXISTS "idx_goods_receipts_brandGrTrn"
  ON "goods_receipts" ("brand_id", "gr_trn");

-- goods_receipts: list by destination department
CREATE INDEX IF NOT EXISTS "idx_goods_receipts_brand_dept"
  ON "goods_receipts" ("brand_id", "destination_department_id");

-- goods_receipts: filter by status (draft list view)
CREATE INDEX IF NOT EXISTS "idx_goods_receipts_brand_status"
  ON "goods_receipts" ("brand_id", "status");

-- gr_lines: all lines for a GR
CREATE INDEX IF NOT EXISTS "idx_gr_lines_brand_id"
  ON "gr_lines" ("brand_id");

CREATE INDEX IF NOT EXISTS "idx_gr_lines_goods_receipt_id"
  ON "gr_lines" ("goods_receipt_id");

-- gr_attachments
CREATE INDEX IF NOT EXISTS "idx_gr_attachments_brand_id"
  ON "gr_attachments" ("brand_id");

-- gr_rejection_records
CREATE INDEX IF NOT EXISTS "idx_gr_rejection_records_brand_id"
  ON "gr_rejection_records" ("brand_id");

-- ---------------------------------------------------------------------------
-- Unique constraints
-- ---------------------------------------------------------------------------

-- goods_receipts: one TRN per (brand, gr_trn)
ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_brand_gr_trn_unique"
  UNIQUE ("brand_id", "gr_trn");
