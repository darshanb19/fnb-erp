CREATE TYPE "public"."vendor_payment_mode_enum" AS ENUM('cash', 'bank_transfer', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."vendor_scope_enum" AS ENUM('brand', 'cluster', 'pos');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"scope" "vendor_scope_enum" NOT NULL,
	"scope_cluster_id" uuid,
	"scope_location_id" uuid,
	"gstin" text,
	"pan" text,
	"contact_person" text,
	"contact_phone" text,
	"contact_email" text,
	"street" text,
	"city" text,
	"postal_code" text,
	"state" text,
	"credit_terms_days" integer,
	"payment_mode" "vendor_payment_mode_enum",
	"preferred" boolean DEFAULT false NOT NULL,
	"quality_rating" numeric(3, 2),
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_scope_cluster_id_clusters_id_fk" FOREIGN KEY ("scope_cluster_id") REFERENCES "public"."clusters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_scope_location_id_locations_id_fk" FOREIGN KEY ("scope_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_brand_id" ON "vendors" USING btree ("brand_id");