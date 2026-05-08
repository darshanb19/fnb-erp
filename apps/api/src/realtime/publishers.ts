/**
 * realtime/publishers.ts — Phase 4 Epic 3 INF Arc (a) Task A6.
 *
 * Server-side Realtime publish helpers for the 3 channels Epic 3 wires:
 *   #1 — approval_requests (consumed by SI-INF-001 Approval Inbox)
 *   #2 — notifications     (consumed by in-app notification banner / drawer)
 *   #5 — issue_tracker_threads (consumed by SI-INF-008 comments thread)
 *
 * Channels #3 (presence) + #4 (recipe edit-locks) are not exercised in Epic 3.
 *
 * Service-role client per Master Spec §3.2 — bypasses RLS. Browser clients
 * subscribe via their own session-bound clients with row-level isolation.
 *
 * Realtime broadcast payloads are intentionally minimal (entity ids only,
 * no payload bodies). Subscribers refetch via REST to honour RLS + pick up
 * the canonical state. This avoids reasoning about cross-client cache
 * coherency and keeps the Realtime channels cheap.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let _client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// ---------------------------------------------------------------------------
// Channel #1 — approval_requests
// ---------------------------------------------------------------------------

export interface ApprovalRequestPublishPayload {
  requestId: string;
  approverId: string;
  brandId: string;
  entityType: string;
}

export async function publishApprovalRequest(
  payload: ApprovalRequestPublishPayload,
): Promise<void> {
  try {
    await getClient().channel('approval_requests').send({
      type: 'broadcast',
      event: 'approval_request_change',
      payload,
    });
  } catch (err) {
    // Realtime publish must NOT throw into callers — the DB state is already
    // committed by the time we get here, so a Realtime outage cannot be allowed
    // to surface as a 500. Subscribers will reconcile via REST refetch.
    console.error('[realtime] publishApprovalRequest failed', { err, payload });
  }
}

// ---------------------------------------------------------------------------
// Channel #2 — notifications
// ---------------------------------------------------------------------------

export interface NotificationPublishPayload {
  notificationId: string;
  userId: string;
  brandId: string;
  type: string;
}

export async function publishNotification(
  payload: NotificationPublishPayload,
): Promise<void> {
  try {
    await getClient().channel('notifications').send({
      type: 'broadcast',
      event: 'notification_change',
      payload,
    });
  } catch (err) {
    console.error('[realtime] publishNotification failed', { err, payload });
  }
}

// ---------------------------------------------------------------------------
// Channel #5 — issue_tracker_threads
// ---------------------------------------------------------------------------

export interface IssueTicketPublishPayload {
  ticketId: string;
  eventType: 'comment' | 'status' | 'assignment' | 'attachment';
  brandId: string;
}

export async function publishIssueTicketUpdate(
  payload: IssueTicketPublishPayload,
): Promise<void> {
  try {
    await getClient().channel('issue_tracker_threads').send({
      type: 'broadcast',
      event: 'issue_ticket_change',
      payload,
    });
  } catch (err) {
    console.error('[realtime] publishIssueTicketUpdate failed', { err, payload });
  }
}
