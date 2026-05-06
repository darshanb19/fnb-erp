CREATE TYPE "public"."department_type_enum" AS ENUM('production', 'dispatch', 'non_production', 'store');--> statement-breakpoint
CREATE TYPE "public"."location_type_enum" AS ENUM('central_kitchen', 'pos_outlet', 'brand_store', 'cluster_store');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"email" text NOT NULL,
	"full_name" text,
	"role" text DEFAULT 'store_manager' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"registered_address" text,
	"city" text,
	"postal_code" text,
	"state" text,
	"country" text DEFAULT 'IN',
	"gstin" text,
	"pan" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_account_holder" text,
	"fiscal_year_start_month" smallint DEFAULT 4 NOT NULL,
	"fiscal_year_start_day" smallint DEFAULT 1 NOT NULL,
	"accounting_currency" text DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"logo_url" text,
	"status" text DEFAULT 'setup_pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"name" text NOT NULL,
	"contact_person" text,
	"contact_phone" text,
	"address" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"type" "department_type_enum" NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"cluster_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "location_type_enum" NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"level" text NOT NULL,
	"cluster_id" uuid,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clusters" ADD CONSTRAINT "clusters_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."clusters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stores" ADD CONSTRAINT "stores_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stores" ADD CONSTRAINT "stores_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."clusters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_brand_id" ON "users" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clusters_brand_id" ON "clusters" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_departments_brandLocation" ON "departments" USING btree ("brand_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locations_brandCluster" ON "locations" USING btree ("brand_id","cluster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_brand_id" ON "stores" USING btree ("brand_id");