-- =============================================================================
-- 0007_epic2_usr.sql — Phase 4 Epic 2 USR Arc (a) Task A3
--
-- Hand-edits applied to drizzle-kit output:
--   - Removed regenerated CREATE TYPE for vendor_payment_mode_enum and
--     vendor_scope_enum (already created by 0005_procurement.sql).
--   - Removed regenerated CREATE TABLE "vendors" + its FK ADDs + brand_id
--     index (already created by 0005_procurement.sql + 0006_procurement_constraints.sql).
--   These regenerations leaked because no 0005-snapshot was committed; with
--   IF NOT EXISTS / EXCEPTION guards they would be no-ops, but the Epic 2
--   migration should not pretend to own Epic 1 procurement DDL.
--   - Made the role column type-cast explicit: USING role::user_role.
-- =============================================================================

CREATE TYPE "public"."approval_status" AS ENUM('pending_approval', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('brand_owner', 'cluster_manager', 'kitchen_manager', 'store_manager', 'procurement_manager', 'finance_manager', 'dispatch_staff', 'pos_staff', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."override_mode" AS ENUM('grant', 'revoke');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role" "user_role" NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_permission_id_pk" PRIMARY KEY("role","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"mode" "override_mode" NOT NULL,
	"reason_code" text NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;--> statement-breakpoint
-- Hand-edit: drop role's text default BEFORE the type change.
-- Original drizzle order put DROP DEFAULT after the type cast, which fails:
-- "default for column role cannot be cast automatically to type user_role".
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE user_role USING role::user_role;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_status" "approval_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_module_action_scope_idx" ON "permissions" USING btree ("module","action","scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_permission_overrides_brand_id" ON "user_permission_overrides" USING btree ("brand_id");
