CREATE TYPE "public"."approval_chain_entity_type" AS ENUM('po_threshold', 'gr_shelf_life_exception', 'recipe_default_change', 'bo_self_creation', 'inventory_adjustment', 'b2b_credit_limit_change');--> statement-breakpoint
CREATE TYPE "public"."approval_chain_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."approval_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'delegated');--> statement-breakpoint
CREATE TYPE "public"."approval_step_decision" AS ENUM('pending', 'approved', 'rejected', 'delegated');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."broadcast_urgency" AS ENUM('info', 'important', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'pending_info', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_window" AS ENUM('daily');--> statement-breakpoint
CREATE TYPE "public"."notification_email_mode" AS ENUM('none', 'immediate', 'digest');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"entity_type" "approval_chain_entity_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"status" "approval_chain_status" DEFAULT 'draft' NOT NULL,
	"last_modified_by" uuid NOT NULL,
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_request_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"request_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"approver_user_id" uuid NOT NULL,
	"decision" "approval_step_decision" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"comment" text,
	"escalated_at" timestamp with time zone,
	"escalation_target_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"entity_type" "approval_chain_entity_type" NOT NULL,
	"entity_ref" text NOT NULL,
	"entity_value" numeric(14, 2),
	"requesting_user_id" uuid NOT NULL,
	"chain_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" "approval_request_status" DEFAULT 'pending' NOT NULL,
	"routing_reason" text NOT NULL,
	"payload" jsonb,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcast_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"broadcast_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcast_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"urgency" "broadcast_urgency" DEFAULT 'info' NOT NULL,
	"target_scope" jsonb NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"ack_required" boolean DEFAULT false NOT NULL,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"ticket_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" "issue_priority" DEFAULT 'medium' NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"assignee_user_id" uuid,
	"originator_user_id" uuid NOT NULL,
	"linked_entity_type" text,
	"linked_entity_ref" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "issue_tickets_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"in_app_override" boolean,
	"email_override" boolean,
	"digest_batch_override" boolean,
	"quiet_hours_start" time,
	"quiet_hours_end" time
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_type_config" (
	"type" text PRIMARY KEY NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email_mode" "notification_email_mode" DEFAULT 'none' NOT NULL,
	"digest_window" "notification_digest_window",
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"in_app_seen_at" timestamp with time zone,
	"digest_eligible" boolean DEFAULT false NOT NULL,
	"escalation_eligible" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX IF EXISTS "permissions_module_action_scope_idx";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_last_modified_by_users_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_escalation_target_user_id_users_id_fk" FOREIGN KEY ("escalation_target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesting_user_id_users_id_fk" FOREIGN KEY ("requesting_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_chain_id_approval_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."approval_chains"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcast_acknowledgements" ADD CONSTRAINT "broadcast_acknowledgements_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcast_acknowledgements" ADD CONSTRAINT "broadcast_acknowledgements_broadcast_id_broadcast_announcements_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcast_announcements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcast_acknowledgements" ADD CONSTRAINT "broadcast_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcast_announcements" ADD CONSTRAINT "broadcast_announcements_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcast_announcements" ADD CONSTRAINT "broadcast_announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_attachments" ADD CONSTRAINT "issue_ticket_attachments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_attachments" ADD CONSTRAINT "issue_ticket_attachments_ticket_id_issue_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."issue_tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_attachments" ADD CONSTRAINT "issue_ticket_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_comments" ADD CONSTRAINT "issue_ticket_comments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_comments" ADD CONSTRAINT "issue_ticket_comments_ticket_id_issue_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."issue_tickets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_ticket_comments" ADD CONSTRAINT "issue_ticket_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_originator_user_id_users_id_fk" FOREIGN KEY ("originator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_type_notification_type_config_type_fk" FOREIGN KEY ("type") REFERENCES "public"."notification_type_config"("type") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_notification_type_config_type_fk" FOREIGN KEY ("type") REFERENCES "public"."notification_type_config"("type") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_chains_brand_id" ON "approval_chains" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_request_steps_brand_id" ON "approval_request_steps" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_requests_brand_id" ON "approval_requests" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_broadcast_acknowledgements_broadcastUser" ON "broadcast_acknowledgements" USING btree ("broadcast_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_broadcast_announcements_brand_id" ON "broadcast_announcements" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_ticket_attachments_brand_id" ON "issue_ticket_attachments" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_ticket_comments_brand_id" ON "issue_ticket_comments" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_tickets_brand_id" ON "issue_tickets" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_preferences_userType" ON "notification_preferences" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_brand_id" ON "notifications" USING btree ("brand_id");
--> statement-breakpoint
-- =============================================================================
-- Hand-edits — Phase 4 Epic 3 INF Arc (a) Task A5 Step 3
-- =============================================================================

-- Composite UNIQUE constraints (one row per user × notification type;
-- one ack per user × broadcast). Drizzle's brandScopedTable helper emits
-- non-unique composite indexes; these constraints add the uniqueness.
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_type_uniq"
  UNIQUE ("user_id", "type");
--> statement-breakpoint
ALTER TABLE "broadcast_acknowledgements"
  ADD CONSTRAINT "broadcast_acknowledgements_broadcast_user_uniq"
  UNIQUE ("broadcast_id", "user_id");
--> statement-breakpoint

-- Per-brand × per-year sequence function for ISS-YYYY-SEQ reference generation.
-- The application calls SELECT issue_ticket_next_reference(brand_id, year) in
-- issueTrackerService.create() to obtain the formatted reference.
-- Sequences are per-brand to keep references readable (ISS-2026-001 starts
-- fresh per brand) and per-year to reset the counter at year boundaries.
CREATE OR REPLACE FUNCTION issue_ticket_next_reference(p_brand_id UUID, p_year INT)
RETURNS TEXT AS $$
DECLARE
  seq_name TEXT := 'issue_ticket_seq_' || replace(p_brand_id::text, '-', '_') || '_' || p_year;
  next_val BIGINT;
BEGIN
  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS %I MINVALUE 1 INCREMENT BY 1',
    seq_name
  );
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN format('ISS-%s-%s', p_year, lpad(next_val::text, 3, '0'));
END;
$$ LANGUAGE plpgsql;
