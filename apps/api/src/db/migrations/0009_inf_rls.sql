-- =============================================================================
-- 0009_inf_rls.sql
-- RLS policies for Phase 4 Epic 3 INF schema (DL-014 canonical templates).
--
-- !! DO NOT APPLY TO LOCAL POSTGRES !!
-- This file depends on auth.uid() and the service_role which are Supabase-only.
-- Apply this migration only when deploying to Supabase (production / preview).
--
-- Hand-authored Supabase-only counterpart to 0009_epic3_inf.sql (which contains
-- the Drizzle-generated DDL for Epic 3 INF).
--
-- Scope notes:
--   - 10 brand-scoped tables get the canonical 2-policy template
--     (brand_isolation + service_role_bypass).
--   - notification_type_config is GLOBAL (non-brand-scoped) — same documented
--     exception as the permissions table from Epic 2. Reads are unrestricted
--     to any authenticated user (UI needs the dispatch-policy metadata to
--     render preference toggles); writes are service-role-only (seeds in
--     migration 0011 + post-MVP email-mode flips). RLS is enabled with a
--     service_role-only WRITE policy and a permissive SELECT policy.
-- =============================================================================

-- approval_chains
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_chains_brand_isolation ON approval_chains
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY approval_chains_service_role_bypass ON approval_chains
  FOR ALL TO service_role
  USING (true);

-- approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_requests_brand_isolation ON approval_requests
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY approval_requests_service_role_bypass ON approval_requests
  FOR ALL TO service_role
  USING (true);

-- approval_request_steps
ALTER TABLE approval_request_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_request_steps_brand_isolation ON approval_request_steps
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY approval_request_steps_service_role_bypass ON approval_request_steps
  FOR ALL TO service_role
  USING (true);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_brand_isolation ON notifications
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY notifications_service_role_bypass ON notifications
  FOR ALL TO service_role
  USING (true);

-- notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_brand_isolation ON notification_preferences
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY notification_preferences_service_role_bypass ON notification_preferences
  FOR ALL TO service_role
  USING (true);

-- notification_type_config (GLOBAL — service_role-only writes; permissive reads)
ALTER TABLE notification_type_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_type_config_authenticated_read ON notification_type_config
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY notification_type_config_service_role_write ON notification_type_config
  FOR ALL TO service_role
  USING (true);

-- issue_tickets
ALTER TABLE issue_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY issue_tickets_brand_isolation ON issue_tickets
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY issue_tickets_service_role_bypass ON issue_tickets
  FOR ALL TO service_role
  USING (true);

-- issue_ticket_comments
ALTER TABLE issue_ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY issue_ticket_comments_brand_isolation ON issue_ticket_comments
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY issue_ticket_comments_service_role_bypass ON issue_ticket_comments
  FOR ALL TO service_role
  USING (true);

-- issue_ticket_attachments
ALTER TABLE issue_ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY issue_ticket_attachments_brand_isolation ON issue_ticket_attachments
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY issue_ticket_attachments_service_role_bypass ON issue_ticket_attachments
  FOR ALL TO service_role
  USING (true);

-- broadcast_announcements
ALTER TABLE broadcast_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY broadcast_announcements_brand_isolation ON broadcast_announcements
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY broadcast_announcements_service_role_bypass ON broadcast_announcements
  FOR ALL TO service_role
  USING (true);

-- broadcast_acknowledgements
ALTER TABLE broadcast_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY broadcast_acknowledgements_brand_isolation ON broadcast_acknowledgements
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));
CREATE POLICY broadcast_acknowledgements_service_role_bypass ON broadcast_acknowledgements
  FOR ALL TO service_role
  USING (true);
