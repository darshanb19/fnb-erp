CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"table_name" text NOT NULL,
	"row_id" text NOT NULL,
	"action" text NOT NULL,
	"changed_fields" jsonb,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"trn_reference" text,
	"context" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_brand_id" ON "audit_log" USING btree ("brand_id");

-- ---------------------------------------------------------------------------
-- DL-013 append-only enforcement + composite index for FR21 timeline query.
-- Application code uses the service_role and INSERTs only; nothing UPDATEs
-- or DELETEs audit_log. A future role/grant model lands in Epic 2.
-- ---------------------------------------------------------------------------

-- Composite index for FR21 timeline query: (brand_id, table_name, row_id, occurred_at DESC).
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row_time
  ON audit_log (brand_id, table_name, row_id, occurred_at DESC);