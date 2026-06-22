CREATE TYPE "public"."movement_type_enum" AS ENUM('receipt', 'consumption', 'transfer_in', 'transfer_out', 'adjustment', 'closing_variance');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"trn_reference" text,
	"event_type" text NOT NULL,
	"debit_account" text,
	"credit_account" text,
	"amount" numeric(18, 4),
	"source_movement_id" uuid,
	"posted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"product_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"quantity_remaining" numeric(18, 4) NOT NULL,
	"expiry_date" date,
	"received_date" date NOT NULL,
	"yield_factor" numeric(5, 4) DEFAULT '1.0000' NOT NULL,
	"cost_per_unit" numeric(18, 4) DEFAULT '0' NOT NULL,
	"uom_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" uuid,
	"provisional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"product_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"uom_id" uuid NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"product_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"batch_id" uuid,
	"movement_type" "movement_type_enum" NOT NULL,
	"quantity_delta" numeric(18, 4) NOT NULL,
	"uom_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"dest_type" text,
	"dest_id" uuid,
	"reason" text,
	"reason_code" text,
	"trn_reference" text,
	"journal_event_id" uuid,
	"actor_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trn_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"transaction_type" text NOT NULL,
	"location_code" text NOT NULL,
	"year" integer NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journal_events" ADD CONSTRAINT "journal_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_journal_event_id_journal_events_id_fk" FOREIGN KEY ("journal_event_id") REFERENCES "public"."journal_events"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trn_sequences" ADD CONSTRAINT "trn_sequences_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_events_brand_id" ON "journal_events" USING btree ("brand_id");--> statement-breakpoint
-- Drizzle emits a plain FEFO index; we replace it with a partial index (quantity_remaining > 0)
-- so the FEFO deduction path only scans live batches (DL-016).
CREATE INDEX IF NOT EXISTS "idx_stock_batches_fefo" ON "stock_batches" ("brand_id","product_id","department_id","expiry_date") WHERE quantity_remaining > 0;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_levels_brandProductDept" ON "stock_levels" USING btree ("brand_id","product_id","department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stock_movements_brandProductDeptCreatedAt" ON "stock_movements" USING btree ("brand_id","product_id","department_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trn_sequences_brand_id" ON "trn_sequences" USING btree ("brand_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-edited section: unique constraints + natural-key composites
-- (Drizzle does not emit these; mirrors 0004_inventory_constraints.sql pattern)
-- ---------------------------------------------------------------------------

-- stock_levels: one on-hand rollup row per (product, department) within brand
ALTER TABLE "stock_levels"
  ADD CONSTRAINT stock_levels_brand_product_dept_unique
  UNIQUE (brand_id, product_id, department_id);

-- stock_batches: batch number is unique within (product, department, brand)
ALTER TABLE "stock_batches"
  ADD CONSTRAINT stock_batches_brand_product_dept_batch_unique
  UNIQUE (brand_id, product_id, department_id, batch_number);

-- trn_sequences: one counter row per (transaction type, location code, year) within brand
ALTER TABLE "trn_sequences"
  ADD CONSTRAINT trn_sequences_brand_type_loc_year_unique
  UNIQUE (brand_id, transaction_type, location_code, year);

-- ---------------------------------------------------------------------------
-- Non-negative quantity guards (review fix)
-- Prevents stock_batches and stock_levels from storing negative values, which
-- should be enforced at the DB layer in addition to the service-layer FEFO walk.
-- ---------------------------------------------------------------------------
ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_qty_non_negative CHECK (quantity_remaining >= 0);
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_qty_non_negative CHECK (quantity >= 0);