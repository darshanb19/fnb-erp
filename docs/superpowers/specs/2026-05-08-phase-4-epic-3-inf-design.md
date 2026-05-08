# Phase 4 Epic 3 — Shared Infrastructure (INF) — Design Spec

**Date:** 2026-05-08
**Phase:** 4
**Epic:** 3 (INF — Shared Infrastructure)
**Status:** Approved (brainstorming pass complete; pending implementation plan)

This spec is the input to `superpowers:writing-plans` for the Epic 3 implementation
plan at `docs/superpowers/plans/2026-05-08-phase-4-epic-3-inf-build.md`.

---

## §1 Inputs

Canonical sources read during the brainstorming pass:

- `_planning/02-master-spec.md` — Epic 3 row (line 271 — Tier "Core"; "Approval
  engine, notifications, audit trail — built before all other epics"); §5 Epic
  Implementation Sequence (lines 290–331 — Epic 3 must be built before Epics
  4–12); §8.2 `approvalEngine` service contract (lines 591–595); §8.3
  `notificationCenter` service contract (lines 599–602); §11 OQ12 audit-trail
  resolution (DL-013 — application-layer primary, trigger backstop on 4 critical
  tables); §11 OQ16 notification transport resolution (DL-011 — Resend +
  pg-boss + data-driven dispatch).
- `_planning/03-prd.md` — Shared Infrastructure FRs at lines 618–626: FR16
  (configurable approval chains + threshold-based routing + delegation), FR17
  (unified approval inbox + bulk approvals), FR18 (notification channels —
  in-app primary, email secondary), FR19 (digest batching + escalation
  timeouts), FR20 (append-only audit trail with before/after snapshots —
  UPDATE/DELETE blocked at DB layer; hash-chain hardening post-MVP), FR21
  (per-entity activity timeline), FR22 (issue tickets — create / assign /
  track / resolve / linked-entity), FR23 (broadcast announcements), FR24
  (audit export — CSV / Excel / PDF). Cross-references: FR15c (permission
  override audit), FR38 (GR shelf-life exception via FR16), FR41 (PO threshold
  via FR16), FR50 (recipe default-version change via FR16), FR67a (production
  order GR-rejection closure path), FR117 (transaction reverse / cancel
  semantics).
- `_planning/05-screen-inventory.md` — SI-INF-001 through SI-INF-010 (lines
  1002–1497), each with full 12-field schema. SI-INF-006 (Activity Timeline
  Reference) and SI-INF-010 (Reverse / Cancel Confirmation Pattern) are
  **pattern-reference entries, not standalone routes** — they document
  embedded shells consumed by every transactional entity-detail screen across
  Epics 4–12.
- `_planning/06-phase-roadmap.md` — Phase 4 invariants (3-arc structure per
  epic; chrome-freeze review gate; Tier 1 deferred-hero tag). Known chrome
  gaps inherited from Phase 2c-scoped foundation (CC-IMPLAUSIBILITY-WARN +
  CC-VOICE-INPUT first surface in Epic 4; CC-DUPLICATE-WARN closed by Epic 2
  Arc c per DL-026/DL-034 — not Epic 3's territory).
- `decision-log.md` DL-001 → DL-034. Load-bearing for Epic 3:
  - DL-007 (Supabase Mumbai region pin) — already provisioned per Epic 2
    Arc (a); Epic 3 reuses, no new infra cost gate.
  - DL-009 (pg-boss + pg_cron job engine) — Epic 3 schedules digest
    aggregation (pg_cron) and approval escalation timers (pg-boss).
  - DL-010 (5-channel Realtime triage) — channels #1 (`approval_requests`),
    #2 (`notifications`), #5 (`issue_tracker_threads`) all wired in Epic 3.
  - DL-011 (Resend + pg-boss email transport) — **amended by DL-035** —
    email channel deferred until sending domain registered.
  - DL-012 (`brandedDb` factory) — Epic 3 brand-scoped tables use
    `brandScopedTable` per DL-015.
  - DL-013 (audit log application-layer primary; 4-table trigger backstop) —
    audit_log table already exists since Epic 1; Epic 3 ships query routes +
    timeline UI consuming the existing data.
  - DL-014 (canonical 2-policy RLS template) — applied to every brand-scoped
    table.
  - DL-015 (`brandScopedTable` Drizzle helper) — applied to every
    brand-scoped table.
  - DL-016 (status-guarded UPDATE pattern for approval state transitions) —
    `approval_request_steps.decision` mutations follow this pattern.
  - DL-017 (per-brand Supabase Storage bucket; Express signed-URL access) —
    **first exercised in production** by Issue Ticket attachments (DL-039).
  - DL-019 (`@react-pdf/renderer` on pg-boss worker) — audit export PDF path.
  - DL-024 (single-brand bootstrap) — bootstrap BO is the only Approval
    Engine actor in MVP; no real Superadmin user holds approval authority
    over the bootstrap BO until multi-tenant.
  - DL-030 (SI-USR-008 route-only carve-out) — Epic 3 wraps SI-USR-008 via
    inbox-card-links-out only; SI-USR-008 page UX unchanged (DL-040).
  - DL-032 (incremental per-epic permission catalog) — Epic 3 seeds its own
    permission rows via migration 0009.
- `apps/api/src/db/schema/audit-log.ts` — already shipped Epic 1 per DL-013;
  Epic 3 reads from it for SI-INF-005 + SI-INF-006 timeline embed.
- `apps/api/src/services/auditLog.ts` — application-layer primary write path
  per DL-013; every Epic 1 + 2 mutation already calls it. Epic 3 adds
  read-side query methods.
- `apps/web/src/components/shell/AuditLink.tsx` + `ApprovalInboxCard.tsx` +
  `IssueTicketLink.tsx` — already copy-ported per DL-005 from Phase 2c-scoped
  foundation. Epic 3 wires the destinations these chips drill to.
- `mockups/src/screens/inf/SI-INF-001.tsx` + `SI-INF-005.tsx` — already drawn
  in Phase 2c-scoped Tier 1 Group 1 (S3 close 2026-05-06). Epic 3 Arc (b)
  draws the remaining 8 (3 of which are pattern-reference shells, not
  routes).

---

## §2 Output

Epic 3 ships:

- **Backend (Arc a).** 11 new tables across 5 subsystem domains; 5 new service
  modules implementing Master Spec §8.2 + §8.3 contracts; Express RBAC
  middleware additions for inf.* permissions; pg-boss + pg_cron wiring for
  approval escalations + digest aggregation; Realtime channels #1 + #2 + #5
  publish-side wiring; integration tests against fnberp_dev.
- **Mockups (Arc b).** 8 SI-INF screens (SI-INF-002, 003, 004, 007, 008, 009)
  drawn in `mockups/src/screens/inf/`; SI-INF-006 + SI-INF-010 ship as shell
  components only (no routes); 6 new CC-* shells in `mockups/src/shell/` —
  CCApprovalChainEditor, CCNotificationPreferenceMatrix, CCActivityTimeline,
  CCReverseCancelDialog, CCIssueCommentThread, CCFileAttachUploader.
- **Frontend (Arc c).** 8 production pages in `apps/web/src/pages/inf/` (one
  per route-bearing SI-INF screen); shell components copy-ported per DL-005;
  Epic 1 + 2 pages get retroactive `CC-AUDIT-LINK` chips wherever entity
  surfaces exist; SI-USR-002 view-mode gets the embedded `<CCActivityTimeline>`
  + the deferred "active permission overrides" summary (chrome-freeze §9.2
  follow-through); inbox-card-links-out wiring for SI-USR-008.
- **Decision log entries.** DL-035 → DL-040 written to `decision-log.md` at
  plan landing.
- **Phase boundary update.** `claude.md` `## Current phase` line updated to
  reflect Epic 3 ✅ DONE + Epic 4 INV as next entry point at Arc (c) close.

---

## §3 File structure (locked)

### Arc (a) — Backend

```
apps/api/src/db/schema/
  approval-chains.ts                (new: chains + steps config)
  approval-requests.ts              (new: requests + per-step decisions)
  notifications.ts                  (new: notifications + type_config + preferences)
  issue-tickets.ts                  (new: tickets + comments + attachments)
  broadcasts.ts                     (new: announcements + acknowledgements)
  index.ts                          (export new tables)

apps/api/src/db/migrations/
  0009_<timestamp>_epic3_inf.sql    (11 tables + indexes + 2-policy RLS)
  0010_<timestamp>_seed_inf_permissions.sql  (inf.* permissions; default chains seed)
  0011_<timestamp>_seed_notification_type_config.sql  (per-type dispatch shape; email_mode='none')

apps/api/src/services/
  approvalEngine.ts                 (new: §8.2 contract; chain CRUD; routing; decide; delegate; escalate)
  notificationCenter.ts             (new: §8.3 contract; send; sendBulk; preferences; digest aggregator)
  auditService.ts                   (new: read-side query methods; entity timeline; export slice)
  issueTrackerService.ts            (new: tickets + comments + attachments CRUD)
  broadcastService.ts               (new: compose + schedule + send + ack tracking)

apps/api/src/middleware/
  rbac.ts                           (extend: inf.* permission keys honored)

apps/api/src/routes/
  approvals.ts                      (new: REST for SI-INF-001/002)
  notifications.ts                  (new: REST for SI-INF-003/004)
  audit.ts                          (new: REST for SI-INF-005/006 + per-entity timeline)
  issues.ts                         (new: REST for SI-INF-007/008)
  broadcasts.ts                     (new: REST for SI-INF-009)

apps/api/src/jobs/
  approval-escalation.ts            (new: pg-boss handler — fires per-chain escalation timeout)
  notification-digest.ts            (new: pg_cron handler — daily digest aggregation per user)

apps/api/src/realtime/
  publishers.ts                     (new: thin helpers wrapping Supabase Realtime publish for channels #1/#2/#5)

apps/api/tests/integration/
  approval-engine.test.ts           (new)
  notification-center.test.ts       (new)
  audit-service.test.ts             (new)
  issue-tracker.test.ts             (new)
  broadcasts.test.ts                (new)
  rbac-inf.test.ts                  (new)
```

### Arc (b) — Mockups

```
mockups/src/screens/inf/
  SI-INF-002.tsx                    (Approval Chain Configuration; Tier 1)
  SI-INF-003.tsx                    (Notification Preferences; Tier 2)
  SI-INF-004.tsx                    (Notification Digest Preview; Tier 2)
  SI-INF-007.tsx                    (Issue Ticket List; Tier 2)
  SI-INF-008.tsx                    (Issue Ticket Create / Edit; Tier 1 hero)
  SI-INF-009.tsx                    (Broadcast Announcement Composer; Tier 2)

  (SI-INF-001 + SI-INF-005 already shipped in Phase 2c-scoped S3.
   SI-INF-006 + SI-INF-010 are pattern-reference shells, not routes.)

mockups/src/shell/
  CCApprovalChainEditor.tsx         (new shell; consumed by SI-INF-002)
  CCNotificationPreferenceMatrix.tsx (new shell; consumed by SI-INF-003)
  CCActivityTimeline.tsx            (new shell; SI-INF-006 pattern; consumed by USR-002 in Arc c
                                     + every transactional entity-detail in Epics 4–12)
  CCReverseCancelDialog.tsx         (new shell; SI-INF-010 pattern; consumed by Epic 4+ transactional pages)
  CCIssueCommentThread.tsx          (new shell; consumed by SI-INF-008)
  CCFileAttachUploader.tsx          (new shell; consumed by SI-INF-008; first DL-017 exerciser)
  index.ts                          (re-exports updated)
```

### Arc (c) — Frontend

```
apps/web/src/components/shell/
  CCApprovalChainEditor.tsx         (copy-port from mockups per DL-005)
  CCNotificationPreferenceMatrix.tsx (copy-port)
  CCActivityTimeline.tsx            (copy-port)
  CCReverseCancelDialog.tsx         (copy-port; consumer wiring deferred to Epic 4+)
  CCIssueCommentThread.tsx          (copy-port; Realtime channel #5 wiring)
  CCFileAttachUploader.tsx          (copy-port; signed-URL upload wiring)

apps/web/src/pages/inf/
  ApprovalInboxPage.tsx             (SI-INF-001; Tier 1 hero)
  ApprovalChainConfigPage.tsx       (SI-INF-002; Tier 1)
  NotificationPreferencesPage.tsx   (SI-INF-003)
  NotificationDigestPage.tsx        (SI-INF-004)
  AuditTrailViewerPage.tsx          (SI-INF-005; Tier 1)
  IssueTicketsListPage.tsx          (SI-INF-007)
  IssueTicketFormPage.tsx           (SI-INF-008; Tier 1 hero)
  BroadcastsPage.tsx                (SI-INF-009; composer + history)

apps/web/src/hooks/
  useApprovals.ts                   (TanStack Query consumers; Realtime channel #1 bridge)
  useNotifications.ts               (Realtime channel #2 bridge; preferences + digest)
  useAudit.ts                       (audit list + entity timeline)
  useIssueTickets.ts                (Realtime channel #5 bridge for comments)
  useBroadcasts.ts

apps/web/src/lib/
  realtime-bridge.ts                (new: Supabase Realtime → TanStack Query cache invalidation hook
                                     per DL-010 implementation pattern)
  reason-codes.ts                   (extend: add inf.* reason codes for chain edits + override revoke +
                                     ticket close + broadcast cancel)

apps/web/src/pages/usr/
  UserCreateEditPage.tsx            (extend: view-mode embeds <CCActivityTimeline> + active overrides
                                     summary per chrome-freeze §9.2 deferral)

apps/web/src/pages/mdm/
  *.tsx                             (audit pass: add CC-AUDIT-LINK chips wherever entity-detail
                                     surfaces exist if missing — chrome-freeze gate at C10
                                     equivalent catches drift)
```

---

## §4 Arc (a) Backend — work items

**Task A0 — verify Epic 2 Arc (a) state.** Skip-if-already-done: Supabase Mumbai
project is provisioned (per Epic 2 Arc (a) Task A1; project id
`rqwlgvozrurftnlhchih`); 0007/0008 migrations applied; bootstrap BO seeded.
Pre-commit hook scope still covers `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/`.
**No new infra cost gate.** Email transport (Resend) deferred per DL-035 — no
account / domain / API key needed in Epic 3.

**Task A1 — Approval Engine schema (migration 0009 part 1).**
- `approval_chains` (brand-scoped) — `id, brand_id, entity_type, name, steps
  (jsonb [{ stepIndex, role, valueBandMin?, valueBandMax?, escalationTimeoutMinutes,
  fallbackDelegateUserId? }]), status (draft|active|inactive), created_by,
  created_at, last_modified_by, last_modified_at`. Default chains seeded in
  migration 0010 for the FR-named entities (PO threshold per FR41; GR
  shelf-life exception per FR38; recipe default change per FR50; BO
  self-creation per FR14; inventory adjustment per FR37).
- `approval_requests` (brand-scoped) — `id, brand_id, entity_type, entity_ref
  (text — TRN or business-key reference), entity_value (numeric — for
  threshold matching; nullable), requesting_user_id, chain_id, current_step,
  status (pending|approved|rejected|cancelled|delegated), routing_reason
  (text), created_at, decided_at`. Status-guarded UPDATE pattern per DL-016.
- `approval_request_steps` (brand-scoped) — `id, brand_id, request_id,
  step_index, approver_user_id, decision (pending|approved|rejected|delegated),
  decided_at, comment, escalated_at, escalation_target_user_id`. Per-step row
  per chain step; one-row-per-decision audit trail.

**Task A2 — Notification Center schema (migration 0009 part 2).**
- `notifications` (brand-scoped) — `id, brand_id, user_id, type (text — keys
  the type_config row), payload (jsonb — type-specific data shape;
  app-rendering reads payload), in_app_seen_at (nullable timestamp),
  digest_eligible (bool), escalation_eligible (bool), escalated_at (nullable),
  created_at`. Realtime channel #2 publish on insert.
- `notification_type_config` (**global / non-brand-scoped** — same documented
  exception as `permissions` table per Epic 2 Arc (a) Task A3) — `type
  (PK, text), in_app (bool), email_mode (enum 'none'|'immediate'|'digest';
  **all rows seed with 'none' per DL-035**), digest_window (enum 'daily';
  nullable), description`. Seeded in migration 0011 — every notification
  type Epic 3 emits has a row.
- `notification_preferences` (brand-scoped) — `id, brand_id, user_id, type,
  in_app_override (nullable bool — overrides type_config default per user),
  email_override (nullable bool — stored but ignored MVP per DL-035),
  digest_batch_override (nullable bool), quiet_hours_start (time; nullable),
  quiet_hours_end (time; nullable), updated_at`. Per-user × per-type;
  insert-on-first-edit semantics.

**Task A3 — Issue Tracker schema (migration 0009 part 3).**
- `issue_tickets` (brand-scoped) — `id, brand_id, reference (text unique
  per brand — `ISS-YYYY-SEQ` auto-generated), title, description (text),
  priority (enum 'low'|'medium'|'high'|'critical'), status (enum
  'open'|'in_progress'|'pending_info'|'resolved'|'closed'), assignee_user_id
  (nullable), originator_user_id, linked_entity_type (nullable text),
  linked_entity_ref (nullable text), created_at, updated_at, resolved_at,
  closed_at`. Reference auto-generated via Postgres sequence per (brand_id,
  YYYY).
- `issue_ticket_comments` (brand-scoped) — `id, brand_id, ticket_id,
  author_user_id, body (text), created_at`. Realtime channel #5 publish on
  insert.
- `issue_ticket_attachments` (brand-scoped) — `id, brand_id, ticket_id,
  storage_path (text — `${entityType}/${entityId}/${filename}` per DL-017),
  filename, mime_type, size_bytes, uploaded_by_user_id, uploaded_at`.
  Per-brand bucket per DL-017.

**Task A4 — Broadcasts schema (migration 0009 part 4).**
- `broadcast_announcements` (brand-scoped) — `id, brand_id, title, body
  (text — markdown allowed), urgency (enum 'info'|'important'|'critical'),
  target_scope (jsonb — `{ scope: 'brand' | 'cluster_ids' | 'location_ids' |
  'role_keys', values: [...] }`), scheduled_for (nullable timestamp;
  null=immediate), sent_at (nullable), ack_required (bool), status (enum
  'draft'|'scheduled'|'sent'|'cancelled'), created_by_user_id, created_at`.
- `broadcast_acknowledgements` (brand-scoped) — `id, brand_id, broadcast_id,
  user_id, acknowledged_at`. Composite uniqueness `(broadcast_id, user_id)`.

**Task A5 — Permission catalog seed (migration 0010).**
Per DL-032 incremental discipline. New permission rows:
- `inf.approval.read` — see one's own approval inbox (every authenticated user).
- `inf.approval.write` — approve / reject / delegate one's own pending requests.
- `inf.approval.configure_chains` — author + edit approval chains (BO only).
- `inf.notification.read` — read one's own notifications + preview digest.
- `inf.notification.preferences.write` — edit one's own preferences (every user).
- `inf.audit.read` — view audit trail viewer (BO + CM brand-scoped + Finance Manager brand-scoped per SI-INF-005 inventory).
- `inf.audit.export` — export filtered audit slices (same scope as read).
- `inf.issue.read` — list + open tickets (every user; scope-filtered).
- `inf.issue.write` — create + comment + attach (every user).
- `inf.issue.assign` — reassign tickets (BO + CM + originator).
- `inf.issue.close` — close tickets (BO + originator).
- `inf.broadcast.read` — see broadcasts targeted to self (every user).
- `inf.broadcast.compose` — author broadcasts (BO only).

Default chains seeded per FR-named entities; default chain values inferred from
PRD examples (PO ≥ ₹50,000 → BO; GR shelf-life exception → CM then BO;
recipe default change → BO; BO self-creation → Superadmin; inventory
adjustment → CM for cluster-scoped, BO for brand-scoped). Brand Owner can
edit thresholds + step structure post-seed via SI-INF-002.

**Task A6 — Service modules (Master Spec §8.2 + §8.3 contracts).**
- `approvalEngine.ts`:
  - `createApprovalRequest({entityType, entityRef, entityValue?, requestingUserId, brandId, payload})` →
    selects active chain matching entity_type + value-band; creates
    approval_requests row + N approval_request_steps rows; routes step 0 to
    its approver; emits notification to approver via notificationCenter; emits
    Realtime publish on channel #1.
  - `getApprovalStatus(requestId)` — read.
  - `getPendingApprovals(approverId)` — list approver's pending step rows
    grouped by request.
  - `decide({stepId, approverId, decision: 'approve'|'reject', comment?})` —
    status-guarded UPDATE per DL-016; advances chain on approve; closes chain
    on reject; emits notification to requesting user; emits notification +
    Realtime publish to next-step approver on advance.
  - `delegate({stepId, approverId, targetUserId, comment})` — same step-row
    UPDATE pattern with `decision='delegated'`, opens new step row for
    `targetUserId`. Reason code mandatory.
  - `configureChain({entityType, steps, ...})` — chain CRUD; BO only.
  - `listChains(brandId)` — read.
- `notificationCenter.ts`:
  - `send({userId, type, payload, brandId})` — writes notifications row;
    looks up notification_type_config for `email_mode`; in MVP per DL-035 all
    types have `email_mode='none'` so no email job is enqueued; emits
    Realtime publish on channel #2.
  - `sendBulk(payloads[])` — one transaction batch.
  - `list({userId, brandId, filters})` — read.
  - `markSeen({notificationId, userId})` — sets `in_app_seen_at`.
  - `getPreferences(userId, brandId)` / `savePreferences(...)` — per-user pref CRUD.
  - **No email send path implemented in MVP** — the `notification_type_config`
    rows all default to `email_mode='none'` (DL-035). When email is activated
    post-MVP, dispatcher branches on `email_mode`; MVP code path doesn't fire
    at all because the config never says 'immediate'/'digest'. No dead-code
    risk; feature is data-flagged off.
- `auditService.ts` (consumes existing audit_log table per DL-013):
  - `listEvents({brandId, filters: {entityType?, actorUserId?, action?, dateRange?, scope?}})` — paginated.
  - `getEntityTimeline({brandId, entityType, entityRef})` — per-entity
    chronological for SI-INF-006 embed.
  - `exportSlice({brandId, filters, format: 'csv'|'excel'|'pdf'})` — CSV +
    Excel sync; PDF enqueues @react-pdf/renderer job per DL-019.
- `issueTrackerService.ts`:
  - `create({brandId, originatorUserId, ...})` — auto-generates `ISS-YYYY-SEQ`
    reference via per-(brand,year) sequence; writes ticket; emits notification
    to assignee if set; audit row per DL-013.
  - `update(id, {...changes})` — status-guarded for status transitions.
  - `comment({ticketId, authorUserId, body})` — writes comment; emits
    Realtime channel #5 publish; emits notification to assignee + originator
    + everyone-who-commented (de-duplicated, excluding author).
  - `attach({ticketId, fileMetadata})` — Express signed-URL flow per DL-017;
    writes attachment row after browser PUT confirms.
  - `list({brandId, scope, filters})` — RBAC scope-filtered.
  - `get(id, brandId)` — single ticket with comments + attachments.
- `broadcastService.ts`:
  - `compose(payload)` — draft.
  - `schedule(id, scheduledFor)` — sets status='scheduled'.
  - `send(id)` — fan-out via `notificationCenter.sendBulk`. Resolves
    `target_scope` (jsonb) into a user list (per scope-key: brand → all
    users; cluster_ids → users in those clusters; location_ids → users at
    those locations; role_keys → users with those roles); for each
    targeted user writes a notifications row of type `broadcast.received`;
    UI banner consumes the notification + drills to the broadcast detail.
    `broadcast_acknowledgements` rows are written ONLY when a user
    acknowledges — not pre-populated. Composite uniqueness `(broadcast_id,
    user_id)` ensures one ack per user per broadcast.
  - `listSent(brandId)` / `listAcks(broadcastId)` / `acknowledge({broadcastId, userId})`.

**Task A7 — pg-boss + pg_cron wiring.**
- pg-boss handler `approval-escalation` — runs per-step escalation timer;
  scheduled when `approval_request_steps` row inserted with
  `escalationTimeoutMinutes` from chain. On fire: delegates to
  `fallbackDelegateUserId` per chain definition; emits notification.
- pg_cron handler `notification-digest` — daily at 18:00 IST per user
  preference quiet-hours window; aggregates `digest_eligible=true`
  notifications since prior digest; **in MVP per DL-035, this handler
  no-ops** (every notification_type_config has `email_mode='none'` so
  digest_eligible is always false at write time). Handler ships as a
  scheduled job that immediately exits when no email mode is active —
  same code path activates post-domain-registration without changes.

**Task A8 — RBAC middleware extension.** Existing `requirePermission(key)` from
Epic 2 honors new `inf.*` keys; service code consumes
`permissionService.userHasPermission(userId, key)` per Epic 2 patterns. No new
middleware shape; just route-level decorator wiring.

**Task A9 — REST endpoints.**
- `GET /approvals/inbox` (SI-INF-001) — current user's pending approvals.
- `POST /approvals/:requestId/decide` — approve/reject (with optional
  comment); body `{decision, comment?, reasonCode?}`.
- `POST /approvals/:requestId/delegate` — delegate; body `{targetUserId,
  reasonCode}`.
- `GET/POST/PATCH /approval-chains` (SI-INF-002) — chain CRUD; BO only.
- `GET /notifications` (SI-INF-003 + SI-INF-004 + inbox banner) — current
  user's notifications.
- `POST /notifications/:id/seen` — mark seen.
- `GET/PATCH /notifications/preferences` (SI-INF-003) — per-user pref CRUD.
- `GET /notifications/digest/preview` (SI-INF-004) — current pending digest.
- `GET /audit/events` (SI-INF-005) — filterable audit list.
- `GET /audit/entities/:entityType/:entityRef/timeline` (SI-INF-006 embed) —
  per-entity timeline; consumed by USR-002 view-mode in Arc (c).
- `POST /audit/export` — enqueue export job; returns job id.
- `GET /audit/exports/:jobId` — poll status; returns signed URL when done.
- `GET/POST /issues` (SI-INF-007 + SI-INF-008) — list + create.
- `GET/PATCH /issues/:id` — single + update.
- `POST /issues/:id/comments` — add comment.
- `POST /issues/:id/attachments` — request signed PUT URL; actual upload is
  browser → Storage direct per DL-017; `PATCH /issues/:id/attachments/:attId`
  confirms upload.
- `DELETE /issues/:id/attachments/:attId` — remove attachment.
- `GET/POST/PATCH /broadcasts` (SI-INF-009) — broadcast CRUD.
- `POST /broadcasts/:id/acknowledge` — user acks.

**Task A10 — Realtime publishers.** Thin helpers around Supabase Realtime
publish for channels #1 (`approval_requests`), #2 (`notifications`), #5
(`issue_tracker_threads`). Server-side publish triggered by the corresponding
service mutation; client-side consumption via `realtime-bridge.ts` in Arc (c).

**Task A11 — Integration tests.** Run against fnberp_dev (same pattern as
Epic 1 + 2). Coverage matrix:
- Approval Engine end-to-end: chain seed → createApprovalRequest with valueBand
  match → step 0 routes to BO → BO approves → status='approved' → notification
  fires to requestingUser. Plus: reject path; delegate path; escalation timer;
  status-guarded UPDATE idempotency.
- Notification Center: send + list + markSeen; preferences override; digest
  preview returns batched items; bulk send transaction.
- Audit Service: existing audit_log rows queried + filtered + exported (CSV +
  Excel synchronous; PDF enqueue + status poll).
- Issue Tracker: create + reference auto-generation (`ISS-2026-001` then
  `ISS-2026-002` …); comment + Realtime publish; attachment signed-URL flow
  (mock the browser PUT step in tests; verify the signed URL is returned + the
  metadata row writes after PATCH-confirm); status transitions with audit
  rows; assignee notification on create + reassign.
- Broadcasts: compose + schedule + send fan-out; ack tracking; immutability
  of sent broadcasts (PATCH on sent broadcast returns 409).
- RBAC denial paths per inf.* key.

**Task A12 — Arc (a) close.** Self-review:
- Schema: every brand-scoped table has brand_id index (DL-015), 2-policy RLS
  (DL-014). `notification_type_config` global-table exception documented.
- Audit: every mutation writes audit_log row (DL-013). Reason code mandatory
  on chain edits, override revokes, ticket close, broadcast cancel.
- Tests pass against provisioned Supabase Mumbai. Commit + push to
  `phase-4/epic-3-inf-arc-a-backend` branch. Open PR.

---

## §5 Arc (b) Mockups — work items

**Task B0 — Just-in-time mockups discipline.** Only the 6 SI-INF route-bearing
screens not already shipped (002, 003, 004, 007, 008, 009) plus 2 pattern-only
shells (006 timeline + 010 reverse/cancel). Don't pre-mock anything from
later epics; that's their own arc (b).

**Task B1 — Approval Chain Configuration (Tier 1).** SI-INF-002. Anchors
new shell `<CCApprovalChainEditor>` — ordered step builder with role per step,
value-band selector, escalation timeout, fallback delegate, draft / active /
inactive state. Editor is the most novel surface in Epic 3.

**Task B2 — Notification Preferences + Digest Preview.** SI-INF-003 +
SI-INF-004. New shell `<CCNotificationPreferenceMatrix>` — per-category × per-channel
toggle grid + quiet-hours window. SI-INF-004 reuses the digest list pattern
from SI-INF-001 inbox structure (similar list shape, different content
grouping). **Email channel toggles render greyed with tooltip "Email channel
coming when sending domain registered"** per DL-035.

**Task B3 — Issue Tracker pair (Tier 1 hero on SI-INF-008).** SI-INF-007 list
+ SI-INF-008 form. New shells: `<CCIssueCommentThread>` (comments thread w/
Realtime placeholder), `<CCFileAttachUploader>` (signed-URL upload — first
appearance of DL-017 pattern in mockup library). SI-INF-008 form-page back-link
header pattern (per Epic 2 USR-002 USR-002 precedent).

**Task B4 — Broadcast Composer.** SI-INF-009. BO-only desktop-primary form;
preview pane; history list; ack-required toggle; draft / scheduled / sent /
cancelled status. **Acknowledgement-reminder-emails surface deferred** per
DL-035 — the ack-required toggle still works but the cross-channel
escalation reminder is in-app only in MVP.

**Task B5 — Activity Timeline pattern shell.** `<CCActivityTimeline>` —
SI-INF-006 pattern. Chronological event list with status-token pills, actor,
action, optional inline diff, drill-through to SI-INF-005. ComponentsIndex
permutation includes a "user mutation history" example (the Arc (c) USR-002
consumer scenario).

**Task B6 — Reverse/Cancel pattern shell.** `<CCReverseCancelDialog>` —
SI-INF-010 pattern. Two-path dialog (pre-confirmed clean cancel vs
post-confirmed compensating-document creation). ComponentsIndex permutation
for both paths. **No production page mounts this in Epic 3.** First
real consumer is Epic 4 INV (PO cancel, inventory adjustment reverse).

**Task B7 — Arc (b) chrome-freeze pre-flight.** Run pre-commit hook scope
check (token discipline, no banned borders, Lucide-only). Cross-check no
Epic 1 + 2 shells got monkey-patched. Commit + push to
`phase-4/epic-3-inf-arc-b-mockups` branch. Open PR.

---

## §6 Arc (c) Frontend — work items

**Task C0 — One-time copy-port (DL-005).** Copy 6 new shells from
`mockups/src/shell/` to `apps/web/src/components/shell/`:
CCApprovalChainEditor, CCNotificationPreferenceMatrix, CCActivityTimeline,
CCReverseCancelDialog, CCIssueCommentThread, CCFileAttachUploader. Update
`apps/web/src/components/shell/index.ts`.

**Task C1 — Realtime bridge primitive.** New `apps/web/src/lib/realtime-bridge.ts`
implementing the DL-010 pattern: `useRealtimeChannel(channelName, filter)` hook
that bridges Supabase Realtime events to TanStack Query cache invalidation. One
consistent pattern across all three Epic 3 channels (#1, #2, #5). Lands as
infra primitive consumed by C2's hooks.

**Task C2 — TanStack Query hooks.** `useApprovals` (channel #1 wiring),
`useNotifications` (channel #2), `useIssueTickets` (channel #5),
`useAudit`, `useBroadcasts`. Query keys per the existing factory.

**Task C3 — Approval Inbox page (Tier 1 hero).** SI-INF-001
ApprovalInboxPage. Full FR17 happy path: filter + bulk-approve confidence-rated
items + drill-through to source-entity detail screens (e.g., USR-008 for BO
self-creation pending; Epic 4+ entity details when those land). Bulk-approve
gated to "confidence-rated routine actions" (e.g., routine material
requisitions under cluster-defined threshold per inventory note line 1070).
Per DL-040, BO Account Approval pending-requests render as inbox cards that
link out to `/users/approvals` (existing SI-USR-008 page from Epic 2);
no inline approve/reject for BO approvals to keep SI-USR-008 unchanged.

**Task C4 — Approval Chain Configuration page (Tier 1).** SI-INF-002
ApprovalChainConfigPage. Full editor per DL-036: ordered steps, role per
step, value-band, escalation timeout, fallback delegate, draft / activate /
deactivate. BO-only via `<RequirePermission permission="inf.approval.configure_chains">`.

**Task C5 — Notification Preferences + Digest Preview.** SI-INF-003
NotificationPreferencesPage + SI-INF-004 NotificationDigestPage. Email
channel toggles render greyed with tooltip per DL-035; in-app + digest-batch
toggles fully functional. Quiet-hours window editable.

**Task C6 — Audit Trail Viewer (Tier 1).** SI-INF-005 AuditTrailViewerPage.
Full FR20 + FR24 surface: filter by entity type + actor + action + date
range + scope; before/after diff panel; export trigger (CSV / Excel sync;
PDF async enqueue + poll). RBAC-gated to BO + CM (cluster-scoped) +
Finance Manager (brand-scoped) per inventory.

**Task C7 — Activity Timeline embed on USR-002 (DL-038).** Re-open
`apps/web/src/pages/usr/UserCreateEditPage.tsx` view-mode. Add
`<CCActivityTimeline entityType="user" entityRef={userId} />` section.
Add the deferred "active permission overrides" inline summary per the Epic 2
chrome-freeze §9.2 follow-through. Both surfaces consume Arc (a) read-side
methods (`auditService.getEntityTimeline` + `permissionOverrideService.list`).

**Task C8 — Issue Tracker pair (Tier 1 hero on form).** SI-INF-007
IssueTicketsListPage + SI-INF-008 IssueTicketFormPage. Full
scope per Q5 lock A: comments thread + attachments + Realtime channel #5.
Three-stage commit progression (per R3 mitigation):
- C8a — list + form basics + status transitions + linked-entity wiring.
- C8b — comments thread + Realtime channel #5 wiring.
- C8c — attachments via `<CCFileAttachUploader>` + Express signed-URL flow.
If Arc (c) context tightens, C8c can defer to a follow-up commit on
`phase-4/epic-3-inf-arc-c-frontend` branch (not a separate epic) — flag at
Task C8b close if needed.

**Task C9 — Broadcasts page.** SI-INF-009 BroadcastsPage. BO-only via
`<RequirePermission permission="inf.broadcast.compose">`. Composer +
preview pane + history list + ack detail drill. Recipient-side banner
rendering on every page (urgency-coded; ack-required blocks dismissal)
ships as a thin layout-level component reading from
`useNotifications({type: 'broadcast.received'})`.

**Task C10 — Cross-epic `CC-AUDIT-LINK` audit pass.** Walk Epic 1 + 2
production pages. Where an entity-detail surface exists and lacks a
`<AuditLink>` chip drilling to SI-INF-005 filtered to that entity, add one.
Pages already carrying audit chips per Epic 2 chrome-freeze §3 stay as-is.
Specifically:
- HierarchyPage, DepartmentsPage, ProductsPage, EnablementMatrixPage,
  VendorsPage, CategoriesPage, CompanyPage — chips already present per
  Epic 2 chrome-freeze §4. Verify they now drill to live SI-INF-005 (Epic 2
  shipped chip-without-target; Epic 3 wires the target).
- USR-001 through USR-008 — chips wired similarly.

**Task C11 — Chrome-freeze review (gate per Phase 4 invariant).** Cross-epic
chrome consistency check: any drift in Epic 1 + 2 pages caused by Arc (c)'s
audit-link wiring or USR-002 timeline embed? File review at
`docs/superpowers/reviews/2026-05-08-epic-3-inf-chrome-freeze-review.md`
(or whichever date the review actually runs). Sign-off or fix-back.

**Task C12 — Arc (c) close.** Run typecheck + vite build + full Playwright
suite. Update `claude.md` "## Current phase" line to reflect Epic 3 ✅ DONE +
Epic 4 INV as next entry point. Update `codebase-inventory.md`. Commit +
push to `phase-4/epic-3-inf-arc-c-frontend` branch. Open PR.

---

## §7 Acceptance criteria

**Tier 1 hero acceptance** (per Phase 4 invariant — applies to deferred Tier 1
heroes built in Phase 4):

- **SI-INF-001 Approval Inbox.** Full FR16 + FR17 happy path: an Epic 2 BO
  self-creation request (or seeded test request for the FR-named entities)
  shows up in the inbox; filter + bulk-select + bulk-approve work for
  confidence-rated items; high-value items require single-action confirm;
  delegate path captures reason code + target user; drill-through to
  source-entity detail screens lands on the right URL; Realtime channel #1
  pushes new requests live to the open inbox.
- **SI-INF-002 Approval Chain Configuration.** Full FR16 chain editor: BO
  creates a new chain with ordered steps + value bands + fallback delegate;
  saves draft; activates; mutation writes audit row; chain is consumed by
  next `createApprovalRequest` call. Edit-existing-chain preserves chain id;
  deactivate stops new requests routing to it; existing pending requests on
  the chain continue per their original routing.
- **SI-INF-005 Audit Trail Viewer.** Full FR20 + FR24 surface: filter by
  every dimension (entity type, actor, action, date range, scope); before/after
  diff renders for update events; export filtered slice in CSV (sync), Excel
  (sync), PDF (async — enqueue + poll); per-event drill-down to current
  entity state; per-entity drill-through filter (used by USR-002 timeline
  embed via "View full history" link).
- **SI-INF-008 Issue Ticket Create / Edit.** Full FR22 form: title +
  description + priority + assignee + linked-entity (auto-prefilled from
  CC-ISSUE-TICKET-LINK entry point) saves a ticket with auto-generated
  `ISS-2026-NNN` reference. Comment thread renders chronologically with
  Realtime live-update across two browser sessions. Attachment upload
  succeeds via Express signed PUT URL; attachment row appears in the
  thread; signed GET URL renders a download link for the attachment.
  Status transitions Open → In Progress → Pending Info / Resolved → Closed
  each write audit rows; Resolved → Closed restricted to originator + BO.

**Tier 2 acceptance** (lighter critique):

- **SI-INF-003, SI-INF-004, SI-INF-007, SI-INF-009.** Functional, FR-compliant,
  follows token discipline, passes pre-commit hook. Edge-case-deep
  acceptance not required.

**Pattern-shell acceptance** (no production-page mount in Epic 3 except where noted):

- **SI-INF-006 (`<CCActivityTimeline>`).** Mounted on USR-002 view-mode per
  Arc (c) Task C7. Renders chronologically; status-token pills; "View full
  history" drill to SI-INF-005 filtered to user; collapse/expand works.
- **SI-INF-010 (`<CCReverseCancelDialog>`).** Shell + ComponentsIndex
  permutation only. No production-page mount. First real consumer Epic 4 INV.

**Cross-cutting acceptance:**

- All Epic 1 + 2 production pages keep working after Arc (c) (15/15 Playwright
  e2e pass + any Epic 3 specs added).
- Token discipline: zero hex literals, no banned borders, Lucide-only,
  Inter-only, no `<Separator>`. Pre-commit hook fires zero times across
  Arc (b) + Arc (c).
- Realtime channels #1 + #2 + #5 all wired and verified live (manual
  smoke-test with two browser sessions for each).
- Chrome-freeze sign-off at C11 (or documented fix-back).
- DL-035 → DL-040 written to `decision-log.md` at plan landing (not at Arc
  close — these are decisions made *during* brainstorming, before
  implementation).

---

## §8 Out of scope (explicit)

- **Email transport** (Resend integration, sending domain, DKIM/SPF DNS, React
  Email templates). Deferred per DL-035 until sending domain registered.
  Re-enabling is a one-row update per type in `notification_type_config`
  (`email_mode='immediate'` or `'digest'`) plus Resend account + API key.
- **SMS / WhatsApp / mobile push channels.** Canonical post-MVP per Master
  Spec §3.1 (Supabase Auth FINAL — email/password; SSO post-MVP — same
  pattern applies to non-email channels).
- **Cryptographic hash-chain audit hardening.** FR20 explicitly post-MVP:
  "Cryptographic hash-chain hardening for full tamper-evidence is post-MVP."
- **Issue ticket SLA timers + automatic-escalation rules.** `overdue` flag
  surfaces visually but no automated routing. Manual reassignment only.
- **Broadcast acknowledgement reminder messages.** Depends on email channel
  (DL-035) for cross-channel reminder; in-app banner persists as the only
  reminder mechanism.
- **Permission overrides routed through Approval Engine.** Per DL-037 +
  DL-040 / Epic 2 carry-over: permission overrides remain Brand-Owner-direct
  writes; audit trail (FR15c) is the accountability layer.
- **Reverse/Cancel dialog mounted on production transactional pages.**
  `<CCReverseCancelDialog>` ships as shell + ComponentsIndex permutation
  only. First production consumer is Epic 4 INV (FR117 cleanly-cancellable
  pre-confirmed states + compensating-document post-confirmed states).
- **Custom approval-chain entity types.** Chain seed covers the FR-named
  entities only (PO threshold per FR41, GR shelf-life per FR38, recipe
  default change per FR50, BO self-creation per FR14, inventory adjustment
  per FR37). Adding new entity types is a code change + migration
  (declarative chain seed pattern is reusable; UI isn't editable past the
  seed list in MVP).
- **Issue-ticket-attachment image preview / inline rendering.** MVP shows
  filename + download link; in-thread image preview deferred. Acceptable
  because the workflow is "describe + attach," not "rich media commentary."
- **Bulk operations on broadcasts** (e.g., bulk-cancel scheduled broadcasts;
  multi-broadcast ack-status export). Single-broadcast operations only.
- **Multi-language broadcast composition.** English-only in MVP; same
  posture as Epic 1 + 2.

---

## §9 Risks + mitigations

**R1. Approval Engine consumed by Epic 5 PUR (FR41) immediately after Epic 3
closes — interface contract has to be right first time.** Mitigation: Master
Spec §8.2 already names the contract; integration test suite covers
`createApprovalRequest` + `decide` + `delegate` end-to-end against fnberp_dev.
Arc (a) Task A11 explicitly tests the full chain: chain seed → request creation
→ multi-step routing → decision → notification. If the contract changes during
Epic 5, the change is additive (new fields on payload) rather than breaking
(rename/remove of contract methods).

**R2. Notification Center email-mode='none' may rot if Epic 3 closes and
email channel isn't activated for many months.** Mitigation: DL-035 records
the deferral cleanly; the dispatch table is data-driven, so flipping
`email_mode='immediate'` per type is a one-row update post-domain-registration.
The `notification-digest` pg_cron handler ships as a no-op until any row has
`email_mode='digest'` — same code path activates without changes.

**R3. Issue Tracker comments + attachments + Realtime is Epic 3's biggest
scope add — could blow Arc (c).** Mitigation: split Arc (c) Task C8 into C8a
(list + form basics) → C8b (comments thread + Realtime) → C8c (attachments
+ DL-017 wiring) commits. If Arc (c) context tightens past 60–70%, C8c
defers to a follow-up commit on the same branch (not a separate epic).
Stop-the-line moment surfaces at Task C8b close; user decides at that
point whether to land C8c in this branch or open a small follow-up PR.

**R4. Chrome-freeze gate at end of Arc (c) catches drift from Epic 1 + Epic 2
retroactive `CC-AUDIT-LINK` audit-link wiring.** Mitigation: same pattern as
Epic 2 C10 review — Task C11 explicitly runs the chrome-freeze review;
fix-back is mandatory before C12 commits. Audit-link wiring is purely
additive (chip already present on Epic 1 + 2 pages, just lacking a
destination); risk vector is minimal.

**R5. Realtime channel-bridge primitive (`realtime-bridge.ts`) lands in
Epic 3 as foundation infra used by 3 channels — bug here cascades across all
three.** Mitigation: ship in Task C1 ahead of channel consumers (C2 onwards);
unit-test the bridge with a mock Realtime client; wire one channel (#2 first
— smallest blast radius) end-to-end before wiring the others.

**R6. SI-USR-002 view-mode timeline embed could regress USR-002 acceptance
(Tier 1 hero from Epic 2).** Mitigation: Arc (c) Task C7 is purely additive
(adds a section below existing form sections); existing form behaviour
unchanged; Playwright e2e tests for USR-002 re-run before Arc (c) close.
Chrome-freeze review explicitly covers cross-epic chrome consistency.

**R7. DL-017 signed-URL flow first exercised in production by Issue Ticket
attachments — bug here means Epic 4 INV (which depends on DL-017 for FR39
vendor docs + FR81 production batch photos) inherits the bug class.**
Mitigation: integration test for attachment flow in Arc (a) Task A11; manual
smoke-test in Arc (c) C8c with several MIME types (PNG, JPEG, PDF, plain
text); document the upload flow at `architecture.md` cross-reference for
Epic 4's inheritance.

---

## §10 New decision-log entries (DL-035 → DL-040)

To be written to `decision-log.md` at plan landing.

**DL-035. Epic 3 ships in-app notifications only; email channel deferred until
sending domain registered.** *Decision:* The Notification Center
(`notificationCenter.send`) writes notifications rows + emits Realtime channel
#2 publish for in-app delivery. Email transport (Resend per DL-011) is
deferred — `notification_type_config` rows seed with `email_mode='none'`
across all types; the email-send code path is built but never fires in MVP
because no row has `email_mode='immediate'` or `'digest'`. The
`notification-digest` pg_cron handler ships as a no-op for the same reason.
Re-enabling email post-MVP is one-row updates per type plus Resend account
provisioning. *Why:* Resend signup requires a verified sending domain
(DKIM/SPF DNS records); user has no registered domain at Epic 3 start.
Domain registration is non-trivial out-of-band work (registrar choice,
purchase, DNS configuration) that shouldn't block Epic 3 implementation.
In-app notifications cover the daily-driver case (every user lives in the
inbox per the source journeys); email is the off-system / escalation
channel — useful but not mission-critical for MVP single-tenant.
*Cross-references:* DL-011 (Resend + pg-boss + data-driven dispatch — this
DL amends the email-mode default but does not supersede DL-011), FR18, FR19,
PRD line 620 ("in-app as MVP priority, email as second priority"). *Source:*
2026-05-08 brainstorming, user choice "A" on email-channel deferral.

**DL-036. SI-INF-002 ships as full chain editor in MVP, not seed-via-migration.**
*Decision:* Approval Chain Configuration (SI-INF-002) ships as a real CRUD
editor with ordered step builder, role assignment per step, value-band
selectors, escalation timeout, fallback delegate, draft / active / inactive
state. Brand Owner-only via `<RequirePermission permission="inf.approval.configure_chains">`.
*Why:* User judgment call — preferred operational flexibility (BO can tune
thresholds + chain shape post-launch) over seed-via-migration shortcut
(faster but rigid). Chain-tuning is a real BO activity over time
(comfort threshold grows; new entity types start routing). Cost: substantial
engineering scope (1–2 weeks of focused editor work in Arc (c) Task C4).
*Why not seed-via-migration:* Functional but inflexible; every threshold
change becomes a code-deploy-migration cycle. Rejected.
*Cross-references:* FR16, SI-INF-002 inventory entry. *Source:*
2026-05-08 brainstorming, user choice "A" on chain-editor scope.

**DL-037. Permission overrides remain Brand-Owner-direct writes; not
retroactively routed through Approval Engine.** *Decision:* Epic 2 ships
permission overrides as direct writes (no approval routing); Epic 3 does not
retroactively route them through the Approval Engine. The Approval Engine
routes only the entities the canonical FRs name: PO threshold (FR41), GR
shelf-life exception (FR38), recipe default change (FR50), BO self-creation
(FR14), inventory adjustment (FR37), B2B credit-limit changes. *Why:*
FR15a/b/c don't name approval routing; the override system is intentionally
Brand-Owner-direct in MVP per the PRD. The audit trail (FR15c via FR20) is
the accountability layer — every override is captured with mandatory reason
code, modifying user, timestamp, expiry. In single-tenant MVP, the only
Brand Owner is the founder; no second approver exists to route to anyway.
Multi-tenant ships post-MVP and revisits this. *Cross-references:* FR15a,
FR15b, FR15c, DL-024 (single-brand bootstrap), Epic 2 chrome-freeze review.
*Source:* 2026-05-08 brainstorming, user choice "A" on retroactive routing.

**DL-038. SI-INF-006 Activity Timeline first production consumer is SI-USR-002
view-mode user mutation history.** *Decision:* The `<CCActivityTimeline>` shell
ships in Arc (b) and is mounted in Arc (c) Task C7 on
`apps/web/src/pages/usr/UserCreateEditPage.tsx` view-mode as a "mutation
history" section. Epic 2 already writes audit rows for every user mutation,
so data exists; the embed validates the shell against real data before
Epic 4 INV mounts it on transactional entity-detail surfaces. Same task
also lands the deferred "active permission overrides" inline summary per
the Epic 2 chrome-freeze §9.2 follow-through. *Why:* Shell-only ship (no
production mount in Epic 3) risks integration gaps surfacing late in Epic 4.
One real consumer in Epic 3 catches gaps in the Epic 3 cycle. USR-002 is the
natural pick because Epic 2 already deferred a follow-up section to Epic 3 on
the same page; both sections ship together. *Cross-references:* SI-INF-006
inventory entry, FR21, Epic 2 chrome-freeze review §9.2 (deferred items).
*Source:* 2026-05-08 brainstorming, user choice "B" on timeline mount scope.

**DL-039. Issue Tracker ships full scope in Epic 3 — comments + attachments +
Realtime channel #5 — not lite scope.** *Decision:* SI-INF-007 + SI-INF-008
ship complete per inventory: ticket CRUD, status transitions, assignee picker,
linked-entity reference, comments thread (Realtime channel #5), file
attachments (DL-017 signed-URL flow first exercised here, before Epic 4
GR/production photos). *Why:* User judgment call — preferred shipping the
full ticket affordance over deferring attachments to Epic 4. Comments thread
is core to variance-investigation journey ("Cluster Manager records findings
on variance and updates status" per inventory source-journey). Attachments
in Epic 3 mean DL-017 signed-URL flow is integration-tested ahead of Epic 4
inheriting it. Cost: Arc (c) Task C8 splits into C8a/C8b/C8c for
context-managed delivery (R3 mitigation). *Cross-references:* FR22, DL-017
(per-brand bucket + Express signed-URL), DL-010 channel #5 (`issue_tracker_threads`),
SI-INF-007 + SI-INF-008 inventory entries. *Source:*
2026-05-08 brainstorming, user choice "A" on Issue Tracker scope.

**DL-040. SI-USR-008 wrapped by Approval Engine via inbox-card-links-out
only; SI-USR-008 page UX unchanged.** *Decision:* SI-INF-001 Unified Approval
Inbox renders BO Account Approval pending requests as cards. Card click
navigates to `/users/approvals?id=<requestId>` (the existing Epic 2
SI-USR-008 page) where Superadmin reviews + decides. Inbox is a discovery
affordance only; the existing page stays the action surface. No inline
approve/reject in inbox for BO approvals. *Why:* Kickoff prompt explicit
that "wrapping is purely additive (no UX-breaking changes)." Drill-through is
the cleanest read of "additive" — SI-USR-008 is untouched. Inline
approve/reject would duplicate UI logic across the inbox card and the
standalone page; Approval Engine semantics (audit row, notification dispatch,
escalation timer) belong in one place. For Cluster Manager-style PO
approvals (Epic 5) there's no standalone page yet, so the inbox WILL have
inline actions there — but the BO-creation case keeps drill-through.
*Cross-references:* DL-030 (SI-USR-008 route-only carve-out from Epic 2),
FR14, SI-USR-008 + SI-INF-001 inventory entries. *Source:* 2026-05-08
brainstorming, user choice "A" on SI-USR-008 wrapping pattern.

---

## §11 Self-review

Run before handing the spec to the user for written-spec review.

- [ ] No "TBD" / "TODO" / placeholder content.
- [ ] Internal consistency: §3 file structure matches §4–§6 task descriptions.
- [ ] Internal consistency: §7 acceptance criteria match §4–§6 task outputs.
- [ ] Scope check: 8 SI-INF route-bearing pages + 2 pattern shells + USR-002
      timeline embed + Epic 1+2 audit-link wiring + Realtime bridge primitive —
      coherent for one implementation plan, splittable into Arcs as documented.
- [ ] Ambiguity check: every load-bearing decision has a §10 DL entry or
      cross-references to existing canonical source.
- [ ] DL-035 → DL-040 verbiage matches user's actual choices (A on scope,
      A on chain editor, A on permission-override routing, B on timeline mount,
      A on Issue Tracker, A on email-channel deferral, A on SI-USR-008 wrapping).
- [ ] Risk mitigations are concrete (not "be careful").
- [ ] Out-of-scope list has rationale for each item.
- [ ] No drift from Phase 4 invariants (3-arc structure, chrome-freeze gate,
      Tier 1 deferred-hero tag, phase-boundary discipline).
