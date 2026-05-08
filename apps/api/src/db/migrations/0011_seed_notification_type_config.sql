-- =============================================================================
-- 0011_seed_notification_type_config.sql — Phase 4 Epic 3 INF Arc (a) Task A5
-- Seed notification_type_config (per-type dispatch shape).
--
-- Hand-authored sidecar — NOT registered in meta/_journal.json. Apply via psql
-- to fnberp_dev + fnberp_test; via Supabase MCP (apply_migration) to
-- fnberp-prod.
--
-- DL-035: every row seeds with email_mode='none'. The notificationCenter.send()
-- code path looks up email_mode and never enqueues email jobs in MVP. Re-
-- enabling email post-MVP is a one-row UPDATE per type ('immediate' or
-- 'digest') plus Resend / DKIM / SPF provisioning.
--
-- Re-run safe: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO notification_type_config (type, in_app, email_mode, digest_window, description) VALUES
  ('approval.requested',          true, 'none', null, 'New approval request routed to you'),
  ('approval.decided',            true, 'none', null, 'Decision made on your approval request'),
  ('approval.delegated',          true, 'none', null, 'An approval was delegated to you'),
  ('approval.escalated',          true, 'none', null, 'An approval timed out and escalated to you'),
  ('issue.assigned',              true, 'none', null, 'A ticket was assigned to you'),
  ('issue.commented',             true, 'none', null, 'New comment on a ticket you follow'),
  ('issue.status_changed',        true, 'none', null, 'Status changed on a ticket you follow'),
  ('broadcast.received',          true, 'none', null, 'New broadcast announcement'),
  ('user.created',                true, 'none', null, 'A new user was added to your scope'),
  ('user.role_changed',           true, 'none', null, 'Your role or scope was changed'),
  ('permission.override_applied', true, 'none', null, 'Permission overrides were applied to your account'),
  ('permission.override_expiring',true, 'none', null, 'A permission override is expiring soon'),
  ('audit.export_ready',          true, 'none', null, 'Your audit export is ready to download')
ON CONFLICT (type) DO NOTHING;
