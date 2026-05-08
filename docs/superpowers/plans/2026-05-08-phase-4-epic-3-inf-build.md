# Phase 4 Epic 3 — Shared Infrastructure (INF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Epic 3 INF — Approval Engine + Notification Center (in-app only per DL-035) + Audit Trail viewer + Issue Tracker (full scope per DL-039) + Broadcast Announcements + Reverse/Cancel pattern shell — across the Phase 4 3-arc structure (backend → mockups → frontend), wiring 3 Realtime channels and surfacing the audit timeline as a real consumer on USR-002.

**Architecture:** Express + Drizzle service-layer cross-cutting infrastructure; data-driven approval-chain routing per FR16; `notificationCenter.send()` writes-only (no email transport in MVP per DL-035, code path stays data-flagged off via `notification_type_config.email_mode='none'`); `auditService` reads from existing audit_log table (Epic 1 DL-013); pg-boss for approval-escalation timers; pg_cron stub for digest aggregation (no-op in MVP); per-brand Supabase Storage signed-URL flow first-exercised by Issue Ticket attachments per DL-017; Supabase Realtime channels #1, #2, #5 wired via a single `realtime-bridge.ts` primitive consumed by 3 hooks.

**Tech Stack:** TypeScript strict, Drizzle ORM, Postgres (via Supabase Mumbai), Express, React 18, Vite, TanStack Query, Zod, Supabase Realtime, pg-boss, pg_cron, `@react-pdf/renderer` (audit PDF export), Playwright, Vitest. Lucide icons only. Inter font only. DESIGN.md tokens only (zero hex).

**Spec:** `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` — single source of truth for scope, decisions, and rationale. Re-read at the start of every arc-execution chat.

---

## 1. Inputs (locked — do not reopen)

- **Spec.** `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md`. Reflects user-approved decisions DL-035 (in-app only; email deferred), DL-036 (full chain editor), DL-037 (no permission-override approval routing), DL-038 (timeline first consumer = USR-002), DL-039 (full Issue Tracker scope), DL-040 (SI-USR-008 drill-through wrapping).
- **CLAUDE.md** — read at every session start. Critical rules apply unchanged. The "Approval Engine via Epic 3" + "Notification Center via Epic 3" rules become live consumers in this epic.
- **Phase 4 invariants.** Per-epic 3-arc structure; chrome-freeze gate at end of each epic; Tier 1 deferred-hero tag (applies to SI-INF-001, SI-INF-002, SI-INF-005, SI-INF-008); phase-boundary discipline (CLAUDE.md `## Current phase` line updated same-commit at C12).
- **Epic 2 plan as shape reference.** `docs/superpowers/plans/2026-05-08-phase-4-epic-2-usr-build.md` (1602 lines, 35 tasks). Mirror its task granularity + commit cadence. Epic 3 Arc (c) Task C8 splits into C8a/C8b/C8c (Issue Tracker tri-stage) per DL-039 + spec §9 R3.
- **Existing code surfaces.** `apps/api/src/db/schema/audit-log.ts` (Epic 1 DL-013); `apps/api/src/services/auditLog.ts` (Epic 1 application-layer write path); `apps/api/src/middleware/rbac.ts` (Epic 2); `apps/api/src/middleware/auth.ts` (Epic 2); `apps/web/src/lib/auth.ts` (Epic 2 real Supabase); `apps/web/src/components/shell/AuditLink.tsx` + `ApprovalInboxCard.tsx` + `IssueTicketLink.tsx` (already copy-ported from Phase 2c-scoped); `mockups/src/screens/inf/SI-INF-001.tsx` + `SI-INF-005.tsx` (already shipped Phase 2c-scoped S3); `mockups/src/shell/index.ts` (27 shells post-Epic-2). All read during brainstorming.
- **Decision-log entries written to planning branch.** DL-035 → DL-040 in `decision-log.md` (already appended at brainstorming pass close 2026-05-08, before any arc starts).
- **Supabase Mumbai project.** Already provisioned in Epic 2 Arc (a) Task A1 (project id `rqwlgvozrurftnlhchih`, fnberp-prod). No new infra cost gate in Epic 3.

---

## 2. Output

At the end of execution:

- **Arc (a) PR — backend.** Branch `phase-4/epic-3-inf-arc-a-backend`. 11 new tables across 5 subsystem domains; 5 new service modules implementing Master Spec §8.2 + §8.3 contracts; pg-boss + pg_cron handlers; Realtime publishers for channels #1/#2/#5; Express routes + RBAC + integration tests against fnberp_dev.
- **Arc (b) PR — mockups.** Branch `phase-4/epic-3-inf-arc-b-mockups`. 6 SI-INF route-bearing screens + 2 pattern-only shells (SI-INF-006 timeline + SI-INF-010 reverse-cancel) + 6 new CC-* shells.
- **Arc (c) PR — frontend.** Branch `phase-4/epic-3-inf-arc-c-frontend`. 8 production pages + Realtime bridge primitive + USR-002 timeline embed (DL-038) + Epic 1+2 audit-link wiring + chrome-freeze review.
- **Decision-log update.** DL-035 → DL-040 — already written to `decision-log.md` on the planning branch (this plan's commit) before any arc starts.
- **Phase boundary update.** `CLAUDE.md` `## Current phase` line updated at C12 to reflect Epic 3 ✅ DONE + Epic 4 INV as next entry point.

---

## 3. File structure (locked at plan time)

### 3.1 Backend (`apps/api/`)

```
apps/api/src/db/schema/
  approval-chains.ts                (NEW: chains config + draft/active state)
  approval-requests.ts              (NEW: requests + per-step decisions)
  notifications.ts                  (NEW: notifications + global type_config + per-user preferences)
  issue-tickets.ts                  (NEW: tickets + comments + attachments)
  broadcasts.ts                     (NEW: announcements + acknowledgements)
  index.ts                          (export new tables)

apps/api/src/db/migrations/
  0009_<timestamp>_epic3_inf.sql           (drizzle-kit generated; 11 tables + indexes + RLS)
  0010_<timestamp>_seed_inf_permissions.sql  (hand-authored: inf.* permission keys + role_permissions)
  0011_<timestamp>_seed_notification_type_config.sql  (hand-authored: per-type dispatch shape; email_mode='none')
  0012_<timestamp>_seed_default_chains.sql   (hand-authored: 5 default approval chains for FR-named entities)

apps/api/src/services/
  approvalEngine.ts                 (NEW: §8.2 contract; chain CRUD; routing; decide; delegate; escalate)
  notificationCenter.ts             (NEW: §8.3 contract; send; sendBulk; preferences; digest aggregator stub)
  auditService.ts                   (NEW: read-side query methods; entity timeline; export slice)
  issueTrackerService.ts            (NEW: tickets + comments + attachments CRUD; signed-URL provisioning)
  broadcastService.ts               (NEW: compose + schedule + send + ack tracking)

apps/api/src/middleware/
  (no new middleware; existing rbac.ts honors inf.* keys)

apps/api/src/routes/
  approvals.ts                      (NEW: SI-INF-001/002 endpoints)
  notifications.ts                  (NEW: SI-INF-003/004 endpoints)
  audit.ts                          (NEW: SI-INF-005/006 + per-entity timeline endpoints)
  issues.ts                         (NEW: SI-INF-007/008 endpoints + signed-URL provisioning)
  broadcasts.ts                     (NEW: SI-INF-009 endpoints)
  index.ts                          (mount new route groups)

apps/api/src/jobs/
  approval-escalation.ts            (NEW: pg-boss handler; fires per-chain escalation timeout)
  notification-digest.ts            (NEW: pg_cron handler; daily aggregation; no-op in MVP per DL-035)
  index.ts                          (NEW: register handlers + boot wiring)

apps/api/src/realtime/
  publishers.ts                     (NEW: channel #1/#2/#5 publish helpers around supabase-js)

apps/api/src/storage/
  signed-url.ts                     (NEW: per-brand bucket signed PUT/GET URL provisioning per DL-017)

apps/api/tests/integration/
  approval-engine.test.ts           (NEW)
  approval-chain-config.test.ts     (NEW)
  notification-center.test.ts       (NEW)
  audit-service.test.ts             (NEW)
  issue-tracker.test.ts             (NEW)
  issue-tracker-attachments.test.ts (NEW; signed-URL flow)
  broadcasts.test.ts                (NEW)
  rbac-inf.test.ts                  (NEW)
```

### 3.2 Mockups (`mockups/`)

```
mockups/src/screens/inf/
  SI-INF-002.tsx                    (Approval Chain Configuration; Tier 1)
  SI-INF-003.tsx                    (Notification Preferences)
  SI-INF-004.tsx                    (Notification Digest Preview)
  SI-INF-007.tsx                    (Issue Ticket List)
  SI-INF-008.tsx                    (Issue Ticket Create / Edit; Tier 1 hero)
  SI-INF-009.tsx                    (Broadcast Announcement Composer)

  (SI-INF-001 + SI-INF-005 already shipped Phase 2c-scoped S3.
   SI-INF-006 + SI-INF-010 are pattern-reference shells with no route.)

mockups/src/shell/
  CCApprovalChainEditor.tsx         (NEW; consumed by SI-INF-002)
  CCNotificationPreferenceMatrix.tsx (NEW; consumed by SI-INF-003)
  CCActivityTimeline.tsx            (NEW; SI-INF-006 pattern)
  CCReverseCancelDialog.tsx         (NEW; SI-INF-010 pattern; first consumer Epic 4)
  CCIssueCommentThread.tsx          (NEW; consumed by SI-INF-008)
  CCFileAttachUploader.tsx          (NEW; consumed by SI-INF-008; first DL-017 exerciser)
  index.ts                          (re-exports)

mockups/src/screens/index.tsx       (UPDATE: route the 6 new screens)
```

### 3.3 Production frontend (`apps/web/`)

```
apps/web/src/components/shell/
  CCApprovalChainEditor.tsx         (copy-port from mockups; DL-005)
  CCNotificationPreferenceMatrix.tsx (copy-port)
  CCActivityTimeline.tsx            (copy-port)
  CCReverseCancelDialog.tsx         (copy-port; consumer wiring deferred to Epic 4+)
  CCIssueCommentThread.tsx          (copy-port; Realtime channel #5 wiring)
  CCFileAttachUploader.tsx          (copy-port; signed-URL upload wiring)
  index.ts                          (re-exports)

apps/web/src/lib/
  realtime-bridge.ts                (NEW: useRealtimeChannel hook bridging Supabase Realtime → TanStack Query cache)
  query-keys.ts                     (EXTEND: add inf.* keys for approvals, notifications, audit, issues, broadcasts)
  reason-codes.ts                   (EXTEND: add inf.* reason codes — chain.edit, override.revoke, ticket.close, broadcast.cancel)

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
  useApprovals.ts                   (channel #1 bridge; inbox + decisions)
  useApprovalChains.ts              (chain CRUD)
  useNotifications.ts               (channel #2 bridge; list + preferences + digest)
  useAudit.ts                       (audit list + entity timeline + export)
  useIssueTickets.ts                (channel #5 bridge for comments)
  useBroadcasts.ts

apps/web/src/pages/usr/
  UserCreateEditPage.tsx            (EXTEND: view-mode embeds <CCActivityTimeline> + active overrides summary; DL-038)

apps/web/src/pages/mdm/
  *.tsx                             (audit pass: verify CC-AUDIT-LINK chips drill to live SI-INF-005)

apps/web/src/pages/usr/
  *.tsx                             (audit pass: same)

apps/web/src/components/layout/
  BroadcastBanner.tsx               (NEW: app-shell banner reading from useNotifications({type: 'broadcast.received'}))

apps/web/e2e/
  approvals.spec.ts                 (NEW: SI-INF-001 inbox + decide flow)
  approval-chains.spec.ts           (NEW: SI-INF-002 chain editor)
  notifications.spec.ts             (NEW: preferences + digest preview)
  audit-viewer.spec.ts              (NEW: SI-INF-005 filter + export)
  issue-tracker.spec.ts             (NEW: SI-INF-007/008 happy + comments Realtime + attachments)
  broadcasts.spec.ts                (NEW: SI-INF-009 compose + send + ack)
```

### 3.4 Cross-cutting docs to update at end of Arc (c)

```
CLAUDE.md                          (## Current phase line — Epic 3 ✅ DONE; Epic 4 INV next)
codebase-inventory.md              (extend with apps/api/src/services/inf-* + apps/web/src/pages/inf/)
docs/superpowers/reviews/2026-05-08-epic-3-inf-chrome-freeze-review.md  (Task C11)
decision-log.md                    (DL-035 → DL-040 — already written to planning branch BEFORE arcs start)
```

---

## 4. Arc (a) — Backend

Run order: A0 → (A1 || A2 || A3 || A4) → A5 → A6 → A7 → A8 → A9 → A10 → A11 → A12. Schema tasks A1–A4 are independent (different schema files); can run sequentially or in parallel.

### Task A0: Verify Epic 2 state (skip if already verified)

**Files:** none (read-only).

- [ ] **Step 1: Confirm Epic 2 state.** Run from repo root:

  ```bash
  ls apps/api/src/db/schema/ | grep -E "auth|permissions|user-permission-overrides|role-permissions"
  ls apps/web/src/pages/usr/ | head -10
  ls apps/api/src/middleware/ | grep -E "auth|rbac"
  ```

  Expected: Epic 2's 4 schema files (auth, permissions, role-permissions, user-permission-overrides) exist; 8 USR pages exist; rbac.ts middleware exists.

- [ ] **Step 2: Confirm Supabase Mumbai project provisioning.** Run:

  ```bash
  grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET" apps/api/.env | wc -l
  grep -E "VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY" apps/web/.env.local | wc -l
  ```

  Expected: 3 entries in apps/api/.env, 2 entries in apps/web/.env.local.

- [ ] **Step 3: Confirm pre-commit hook scope.** Run:

  ```bash
  cat mockups/.git-hooks/pre-commit | grep -E "apps/web/src" | head -5
  ```

  Expected: `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` covered.

- [ ] **Step 4: No commit.** Read-only verification.

### Task A1: Schema — Approval Engine (`approval-chains.ts` + `approval-requests.ts`)

**Files:**
- Create: `apps/api/src/db/schema/approval-chains.ts`
- Create: `apps/api/src/db/schema/approval-requests.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Create `approval-chains.ts`.**

  ```typescript
  // apps/api/src/db/schema/approval-chains.ts
  import { pgEnum, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';

  export const approvalChainStatusEnum = pgEnum('approval_chain_status', [
    'draft',
    'active',
    'inactive',
  ]);

  export const approvalChainEntityTypeEnum = pgEnum('approval_chain_entity_type', [
    'po_threshold',
    'gr_shelf_life_exception',
    'recipe_default_change',
    'bo_self_creation',
    'inventory_adjustment',
    'b2b_credit_limit_change',
  ]);

  /**
   * One chain per (brand_id, entity_type, name). Multiple chains per entity_type
   * allowed (e.g., a brand may have separate PO chains by category in future);
   * the routing engine picks the matching chain by entity_type + value-band.
   *
   * `steps` jsonb shape: Array<{
   *   stepIndex: number;
   *   role: UserRole;
   *   valueBandMin?: number;
   *   valueBandMax?: number;
   *   escalationTimeoutMinutes: number;
   *   fallbackDelegateUserId?: string;
   * }>
   */
  export const approvalChains = brandScopedTable(
    'approval_chains',
    {
      entityType: approvalChainEntityTypeEnum('entity_type').notNull(),
      name: text('name').notNull(),
      description: text('description'),
      steps: jsonb('steps').notNull(), // see comment above
      status: approvalChainStatusEnum('status').notNull().default('draft'),
      createdBy: uuid('created_by').notNull().references(() => users.id),
      lastModifiedBy: uuid('last_modified_by').notNull().references(() => users.id),
      lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }).notNull().defaultNow(),
    },
  );

  export type ApprovalChain = typeof approvalChains.$inferSelect;
  export type NewApprovalChain = typeof approvalChains.$inferInsert;
  export type ApprovalChainStatus = (typeof approvalChainStatusEnum.enumValues)[number];
  export type ApprovalChainEntityType = (typeof approvalChainEntityTypeEnum.enumValues)[number];

  export interface ApprovalChainStep {
    stepIndex: number;
    role: string; // UserRole — kept as string in jsonb so role enum changes don't break old chains
    valueBandMin?: number;
    valueBandMax?: number;
    escalationTimeoutMinutes: number;
    fallbackDelegateUserId?: string;
  }
  ```

- [ ] **Step 2: Create `approval-requests.ts`.**

  ```typescript
  // apps/api/src/db/schema/approval-requests.ts
  import { pgEnum, text, integer, numeric, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';
  import { approvalChains, approvalChainEntityTypeEnum } from './approval-chains.js';

  export const approvalRequestStatusEnum = pgEnum('approval_request_status', [
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'delegated',
  ]);

  export const approvalStepDecisionEnum = pgEnum('approval_step_decision', [
    'pending',
    'approved',
    'rejected',
    'delegated',
  ]);

  export const approvalRequests = brandScopedTable(
    'approval_requests',
    {
      entityType: approvalChainEntityTypeEnum('entity_type').notNull(),
      entityRef: text('entity_ref').notNull(),     // TRN or business-key reference
      entityValue: numeric('entity_value', { precision: 14, scale: 2 }), // for value-band matching; nullable
      requestingUserId: uuid('requesting_user_id').notNull().references(() => users.id),
      chainId: uuid('chain_id').notNull().references(() => approvalChains.id),
      currentStep: integer('current_step').notNull().default(0),
      status: approvalRequestStatusEnum('status').notNull().default('pending'),
      routingReason: text('routing_reason').notNull(), // e.g., "PO value > ₹50,000 → Brand Owner"
      payload: jsonb('payload'),                       // entity-type-specific summary for inbox card rendering
      decidedAt: timestamp('decided_at', { withTimezone: true }),
    },
  );

  export const approvalRequestSteps = brandScopedTable(
    'approval_request_steps',
    {
      requestId: uuid('request_id').notNull().references(() => approvalRequests.id),
      stepIndex: integer('step_index').notNull(),
      approverUserId: uuid('approver_user_id').notNull().references(() => users.id),
      decision: approvalStepDecisionEnum('decision').notNull().default('pending'),
      decidedAt: timestamp('decided_at', { withTimezone: true }),
      comment: text('comment'),
      escalatedAt: timestamp('escalated_at', { withTimezone: true }),
      escalationTargetUserId: uuid('escalation_target_user_id').references(() => users.id),
    },
  );

  export type ApprovalRequest = typeof approvalRequests.$inferSelect;
  export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
  export type ApprovalRequestStep = typeof approvalRequestSteps.$inferSelect;
  export type NewApprovalRequestStep = typeof approvalRequestSteps.$inferInsert;
  export type ApprovalRequestStatus = (typeof approvalRequestStatusEnum.enumValues)[number];
  export type ApprovalStepDecision = (typeof approvalStepDecisionEnum.enumValues)[number];
  ```

- [ ] **Step 3: Update `index.ts` re-exports.** Add the three new modules to the export aggregator at `apps/api/src/db/schema/index.ts` (follow the existing pattern — alphabetical or grouped per existing convention).

- [ ] **Step 4: Run typecheck.** `cd apps/api && pnpm typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/api/src/db/schema/approval-chains.ts apps/api/src/db/schema/approval-requests.ts apps/api/src/db/schema/index.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A1 approval engine schema (chains + requests + steps)"
  ```

### Task A2: Schema — Notification Center (`notifications.ts`)

**Files:**
- Create: `apps/api/src/db/schema/notifications.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Create `notifications.ts`.**

  ```typescript
  // apps/api/src/db/schema/notifications.ts
  import { pgEnum, pgTable, text, boolean, time, timestamp, uuid, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';

  /**
   * Per-type dispatch shape. Global table — same dispatch policy across brands.
   * MVP per DL-035: every row has email_mode='none'. Re-enabling email post-MVP
   * is one-row UPDATE per type to 'immediate' or 'digest'.
   */
  export const emailModeEnum = pgEnum('notification_email_mode', ['none', 'immediate', 'digest']);
  export const digestWindowEnum = pgEnum('notification_digest_window', ['daily']);

  export const notificationTypeConfig = pgTable(
    'notification_type_config',
    {
      type: text('type').primaryKey(),                    // e.g., 'approval.requested', 'broadcast.received'
      inApp: boolean('in_app').notNull().default(true),
      emailMode: emailModeEnum('email_mode').notNull().default('none'),
      digestWindow: digestWindowEnum('digest_window'),    // null unless emailMode='digest'
      description: text('description').notNull(),
    },
  );

  export const notifications = brandScopedTable(
    'notifications',
    {
      userId: uuid('user_id').notNull().references(() => users.id),
      type: text('type').notNull().references(() => notificationTypeConfig.type),
      payload: jsonb('payload').notNull(),                // type-specific data shape; UI renders from this
      inAppSeenAt: timestamp('in_app_seen_at', { withTimezone: true }),
      digestEligible: boolean('digest_eligible').notNull().default(false),
      escalationEligible: boolean('escalation_eligible').notNull().default(false),
      escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    },
  );

  export const notificationPreferences = brandScopedTable(
    'notification_preferences',
    {
      userId: uuid('user_id').notNull().references(() => users.id),
      type: text('type').notNull().references(() => notificationTypeConfig.type),
      inAppOverride: boolean('in_app_override'),          // null = use type_config default
      emailOverride: boolean('email_override'),           // stored but ignored MVP per DL-035
      digestBatchOverride: boolean('digest_batch_override'),
      quietHoursStart: time('quiet_hours_start'),
      quietHoursEnd: time('quiet_hours_end'),
    },
    {
      indexes: {
        userTypeUniq: uniqueIndex('notification_preferences_user_type_uniq').on(
          // Drizzle typing reference — using sql template here for the columns
        ),
      },
    },
  );

  export type Notification = typeof notifications.$inferSelect;
  export type NewNotification = typeof notifications.$inferInsert;
  export type NotificationTypeConfig = typeof notificationTypeConfig.$inferSelect;
  export type NotificationPreference = typeof notificationPreferences.$inferSelect;
  export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
  export type EmailMode = (typeof emailModeEnum.enumValues)[number];
  ```

  Note: the `userTypeUniq` index needs proper Drizzle column references — finalize with `.on(table.userId, table.type)` once Drizzle's column-reference pattern is confirmed against existing brandScopedTable indexes (look at `user-permission-overrides.ts` from Epic 2 for the canonical pattern).

- [ ] **Step 2: Verify uniqueIndex reference pattern.** Read `apps/api/src/db/schema/user-permission-overrides.ts` (Epic 2). Find the existing uniqueIndex pattern; replicate the exact reference shape. Update `notifications.ts` Step 1 code to match. Patch the `userTypeUniq` index reference accordingly.

- [ ] **Step 3: Update `index.ts` re-exports.** Add the new module.

- [ ] **Step 4: Run typecheck.** `cd apps/api && pnpm typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/api/src/db/schema/notifications.ts apps/api/src/db/schema/index.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A2 notification center schema (notifications + type_config + preferences)"
  ```

### Task A3: Schema — Issue Tracker (`issue-tickets.ts`)

**Files:**
- Create: `apps/api/src/db/schema/issue-tickets.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Create `issue-tickets.ts`.**

  ```typescript
  // apps/api/src/db/schema/issue-tickets.ts
  import { pgEnum, text, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';

  export const issuePriorityEnum = pgEnum('issue_priority', ['low', 'medium', 'high', 'critical']);
  export const issueStatusEnum = pgEnum('issue_status', [
    'open',
    'in_progress',
    'pending_info',
    'resolved',
    'closed',
  ]);

  export const issueTickets = brandScopedTable(
    'issue_tickets',
    {
      // Reference format: ISS-YYYY-SEQ — auto-generated via per-(brand_id, year) sequence
      // (sequence creation handled in migration 0009 via raw SQL)
      reference: text('reference').notNull().unique(),
      title: text('title').notNull(),
      description: text('description').notNull(),
      priority: issuePriorityEnum('priority').notNull().default('medium'),
      status: issueStatusEnum('status').notNull().default('open'),
      assigneeUserId: uuid('assignee_user_id').references(() => users.id),
      originatorUserId: uuid('originator_user_id').notNull().references(() => users.id),
      linkedEntityType: text('linked_entity_type'),     // e.g., 'po', 'gr', 'production_order', 'requisition'
      linkedEntityRef: text('linked_entity_ref'),       // TRN or business-key
      resolvedAt: timestamp('resolved_at', { withTimezone: true }),
      closedAt: timestamp('closed_at', { withTimezone: true }),
    },
  );

  export const issueTicketComments = brandScopedTable(
    'issue_ticket_comments',
    {
      ticketId: uuid('ticket_id').notNull().references(() => issueTickets.id),
      authorUserId: uuid('author_user_id').notNull().references(() => users.id),
      body: text('body').notNull(),
    },
  );

  export const issueTicketAttachments = brandScopedTable(
    'issue_ticket_attachments',
    {
      ticketId: uuid('ticket_id').notNull().references(() => issueTickets.id),
      storagePath: text('storage_path').notNull(),       // e.g., 'issue-tickets/<ticket-uuid>/<filename>'
      filename: text('filename').notNull(),
      mimeType: text('mime_type').notNull(),
      sizeBytes: integer('size_bytes').notNull(),
      uploadedByUserId: uuid('uploaded_by_user_id').notNull().references(() => users.id),
    },
  );

  export type IssueTicket = typeof issueTickets.$inferSelect;
  export type NewIssueTicket = typeof issueTickets.$inferInsert;
  export type IssueTicketComment = typeof issueTicketComments.$inferSelect;
  export type NewIssueTicketComment = typeof issueTicketComments.$inferInsert;
  export type IssueTicketAttachment = typeof issueTicketAttachments.$inferSelect;
  export type NewIssueTicketAttachment = typeof issueTicketAttachments.$inferInsert;
  export type IssuePriority = (typeof issuePriorityEnum.enumValues)[number];
  export type IssueStatus = (typeof issueStatusEnum.enumValues)[number];
  ```

- [ ] **Step 2: Update `index.ts` re-exports.**

- [ ] **Step 3: Run typecheck.** Expected: 0 errors.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/api/src/db/schema/issue-tickets.ts apps/api/src/db/schema/index.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A3 issue tracker schema (tickets + comments + attachments)"
  ```

### Task A4: Schema — Broadcasts (`broadcasts.ts`)

**Files:**
- Create: `apps/api/src/db/schema/broadcasts.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Create `broadcasts.ts`.**

  ```typescript
  // apps/api/src/db/schema/broadcasts.ts
  import { pgEnum, text, boolean, timestamp, uuid, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';

  export const broadcastUrgencyEnum = pgEnum('broadcast_urgency', ['info', 'important', 'critical']);
  export const broadcastStatusEnum = pgEnum('broadcast_status', [
    'draft',
    'scheduled',
    'sent',
    'cancelled',
  ]);

  /**
   * target_scope jsonb shape — exactly one of:
   *   { scope: 'brand' }
   *   { scope: 'cluster_ids', values: string[] }
   *   { scope: 'location_ids', values: string[] }
   *   { scope: 'role_keys', values: UserRole[] }
   */
  export const broadcastAnnouncements = brandScopedTable(
    'broadcast_announcements',
    {
      title: text('title').notNull(),
      body: text('body').notNull(),                       // markdown allowed
      urgency: broadcastUrgencyEnum('urgency').notNull().default('info'),
      targetScope: jsonb('target_scope').notNull(),
      scheduledFor: timestamp('scheduled_for', { withTimezone: true }),  // null = immediate on send
      sentAt: timestamp('sent_at', { withTimezone: true }),
      ackRequired: boolean('ack_required').notNull().default(false),
      status: broadcastStatusEnum('status').notNull().default('draft'),
      createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    },
  );

  export const broadcastAcknowledgements = brandScopedTable(
    'broadcast_acknowledgements',
    {
      broadcastId: uuid('broadcast_id').notNull().references(() => broadcastAnnouncements.id),
      userId: uuid('user_id').notNull().references(() => users.id),
      acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull().defaultNow(),
    },
    {
      indexes: {
        broadcastUserUniq: uniqueIndex('broadcast_acknowledgements_broadcast_user_uniq').on(
          /* finalize per Epic 2 uniqueIndex pattern — see Task A2 Step 2 reference */
        ),
      },
    },
  );

  export type BroadcastAnnouncement = typeof broadcastAnnouncements.$inferSelect;
  export type NewBroadcastAnnouncement = typeof broadcastAnnouncements.$inferInsert;
  export type BroadcastAcknowledgement = typeof broadcastAcknowledgements.$inferSelect;
  export type NewBroadcastAcknowledgement = typeof broadcastAcknowledgements.$inferInsert;
  export type BroadcastUrgency = (typeof broadcastUrgencyEnum.enumValues)[number];
  export type BroadcastStatus = (typeof broadcastStatusEnum.enumValues)[number];
  ```

- [ ] **Step 2: Finalize uniqueIndex columns** per Task A2 Step 2 pattern (`.on(table.broadcastId, table.userId)`).

- [ ] **Step 3: Update `index.ts` re-exports.**

- [ ] **Step 4: Run typecheck.** Expected: 0 errors.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/api/src/db/schema/broadcasts.ts apps/api/src/db/schema/index.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A4 broadcasts schema (announcements + acknowledgements)"
  ```

### Task A5: Generate migration 0009 + auxiliary seed migrations 0010/0011/0012

**Files:**
- Generated: `apps/api/src/db/migrations/0009_<timestamp>_epic3_inf.sql`
- Create: `apps/api/src/db/migrations/0010_<timestamp>_seed_inf_permissions.sql`
- Create: `apps/api/src/db/migrations/0011_<timestamp>_seed_notification_type_config.sql`
- Create: `apps/api/src/db/migrations/0012_<timestamp>_seed_default_chains.sql`

- [ ] **Step 1: Run drizzle-kit generate.**

  ```bash
  cd apps/api && pnpm drizzle-kit generate --name epic3_inf
  ```

  Output: `0009_<timestamp>_epic3_inf.sql` containing all 11 new tables, indexes, RLS policies (auto-emitted from `brandScopedTable`), enum types.

- [ ] **Step 2: Inspect 0009 migration for completeness.** Open the generated SQL. Verify:
  - All 11 tables present (approval_chains, approval_requests, approval_request_steps, notifications, notification_type_config, notification_preferences, issue_tickets, issue_ticket_comments, issue_ticket_attachments, broadcast_announcements, broadcast_acknowledgements).
  - 10 of them have `brand_id` column + `brand_id` index + 2-policy RLS (the brand-scoped 10).
  - `notification_type_config` is global (no brand_id, no RLS scoping; RLS-enabled with service_role-only policy per DL-014 for non-org-scoped tables).
  - Per-table audit triggers NOT generated (none of the 4 critical tables from DL-013 are in this set).
  - Reference sequence for `issue_tickets.reference` not auto-generated by Drizzle — needs hand-added DDL (next step).

- [ ] **Step 3: Hand-edit 0009 to add issue_tickets reference sequence.** Append before COMMIT (or at end if no transaction wrapper):

  ```sql
  -- Per-brand × per-year sequence for ISS-YYYY-SEQ reference generation.
  -- The application calls nextval() in issueTrackerService.create() to obtain the sequence number,
  -- then formats as ISS-YYYY-NNN with zero-padded sequence.
  -- Sequence is per-brand to keep references readable (ISS-2026-001 starts fresh per brand).
  CREATE OR REPLACE FUNCTION issue_ticket_next_reference(p_brand_id UUID, p_year INT)
  RETURNS TEXT AS $$
  DECLARE
    seq_name TEXT := 'issue_ticket_seq_' || replace(p_brand_id::text, '-', '_') || '_' || p_year;
    next_val BIGINT;
  BEGIN
    -- Create sequence if not exists (per-brand × per-year, idempotent)
    EXECUTE format(
      'CREATE SEQUENCE IF NOT EXISTS %I MINVALUE 1 INCREMENT BY 1',
      seq_name
    );
    EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
    RETURN format('ISS-%s-%s', p_year, lpad(next_val::text, 3, '0'));
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] **Step 4: Apply migration 0009 to fnberp_dev.**

  ```bash
  cd apps/api && pnpm drizzle-kit migrate
  ```

  Expected: success; all 11 tables present in fnberp_dev.

- [ ] **Step 5: Verify locally.**

  ```bash
  psql fnberp_dev -c "\dt" | grep -E "approval|notification|issue|broadcast"
  ```

  Expected: 11 tables listed.

- [ ] **Step 6: Create 0010 — inf permissions seed.** New file `apps/api/src/db/migrations/0010_<timestamp>_seed_inf_permissions.sql`:

  ```sql
  -- Seed inf.* permissions catalog per DL-032 (incremental per-epic discipline).
  -- 13 new permission rows.

  INSERT INTO permissions (id, module, action, scope, key, description) VALUES
    (gen_random_uuid(), 'inf', 'read', 'self', 'inf.approval.read', 'View own approval inbox'),
    (gen_random_uuid(), 'inf', 'write', 'self', 'inf.approval.write', 'Approve / reject / delegate own pending approvals'),
    (gen_random_uuid(), 'inf', 'configure_chains', 'brand', 'inf.approval.configure_chains', 'Author + edit approval chains'),
    (gen_random_uuid(), 'inf', 'read', 'self', 'inf.notification.read', 'Read own notifications + preview digest'),
    (gen_random_uuid(), 'inf', 'preferences.write', 'self', 'inf.notification.preferences.write', 'Edit own notification preferences'),
    (gen_random_uuid(), 'inf', 'read', 'brand', 'inf.audit.read', 'View audit trail viewer'),
    (gen_random_uuid(), 'inf', 'export', 'brand', 'inf.audit.export', 'Export filtered audit slices'),
    (gen_random_uuid(), 'inf', 'read', 'self', 'inf.issue.read', 'List + open issue tickets'),
    (gen_random_uuid(), 'inf', 'write', 'self', 'inf.issue.write', 'Create + comment + attach'),
    (gen_random_uuid(), 'inf', 'assign', 'brand', 'inf.issue.assign', 'Reassign tickets'),
    (gen_random_uuid(), 'inf', 'close', 'self', 'inf.issue.close', 'Close own tickets (originator) or any (BO)'),
    (gen_random_uuid(), 'inf', 'read', 'self', 'inf.broadcast.read', 'See broadcasts targeted to self'),
    (gen_random_uuid(), 'inf', 'compose', 'brand', 'inf.broadcast.compose', 'Author broadcasts')
  ;

  -- Role baseline grants — every role gets reads + own-write on inf.approval/notification/issue;
  -- BO gets configure_chains + audit.read/export + issue.assign + broadcast.compose.
  -- CM gets audit.read (cluster scope enforced application-side) + issue.assign.
  -- Finance Manager gets audit.read + audit.export.
  -- Other roles get only the self-scoped reads + writes.

  INSERT INTO role_permissions (id, role, permission_id) VALUES
    -- brand_owner — all 13
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.approval.read')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.approval.write')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.approval.configure_chains')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.notification.read')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.notification.preferences.write')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.audit.read')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.audit.export')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.issue.read')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.issue.write')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.issue.assign')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.issue.close')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.broadcast.read')),
    (gen_random_uuid(), 'brand_owner', (SELECT id FROM permissions WHERE key='inf.broadcast.compose')),

    -- cluster_manager — all reads + own-writes + audit.read (scope enforced) + issue.assign
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.approval.read')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.approval.write')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.notification.read')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.notification.preferences.write')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.audit.read')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.issue.read')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.issue.write')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.issue.assign')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.issue.close')),
    (gen_random_uuid(), 'cluster_manager', (SELECT id FROM permissions WHERE key='inf.broadcast.read')),

    -- finance_manager — audit + own reads/writes
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.approval.read')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.approval.write')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.notification.read')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.notification.preferences.write')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.audit.read')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.audit.export')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.issue.read')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.issue.write')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.issue.close')),
    (gen_random_uuid(), 'finance_manager', (SELECT id FROM permissions WHERE key='inf.broadcast.read'))
  ;

  -- Repeat the same self-scoped 8 grants for each remaining role:
  -- kitchen_manager, store_manager, procurement_manager, dispatch_staff, pos_staff
  -- (inf.approval.read, inf.approval.write, inf.notification.read,
  --  inf.notification.preferences.write, inf.issue.read, inf.issue.write,
  --  inf.issue.close, inf.broadcast.read)
  -- Author the remaining INSERTs following the same pattern (5 roles × 8 keys = 40 rows).
  ```

  Note: the trailing comment lists the 5 remaining roles + 8 self-scoped permission keys; author the explicit INSERT rows in the migration file (40 rows), don't leave them as a comment.

- [ ] **Step 7: Apply migration 0010 to fnberp_dev.**

  ```bash
  cd apps/api && pnpm drizzle-kit migrate
  ```

  Verify: `psql fnberp_dev -c "SELECT COUNT(*) FROM permissions WHERE module='inf'"` returns 13.

- [ ] **Step 8: Create 0011 — notification_type_config seed.** New file with one row per notification type Epic 3 emits. All rows have `email_mode='none'` per DL-035:

  ```sql
  INSERT INTO notification_type_config (type, in_app, email_mode, digest_window, description) VALUES
    ('approval.requested', true, 'none', null, 'New approval request routed to you'),
    ('approval.decided', true, 'none', null, 'Decision made on your approval request'),
    ('approval.delegated', true, 'none', null, 'An approval was delegated to you'),
    ('approval.escalated', true, 'none', null, 'An approval timed out and escalated to you'),
    ('issue.assigned', true, 'none', null, 'A ticket was assigned to you'),
    ('issue.commented', true, 'none', null, 'New comment on a ticket you follow'),
    ('issue.status_changed', true, 'none', null, 'Status changed on a ticket you follow'),
    ('broadcast.received', true, 'none', null, 'New broadcast announcement'),
    ('user.created', true, 'none', null, 'A new user was added to your scope'),
    ('user.role_changed', true, 'none', null, 'Your role or scope was changed'),
    ('permission.override_applied', true, 'none', null, 'Permission overrides were applied to your account'),
    ('permission.override_expiring', true, 'none', null, 'A permission override is expiring soon'),
    ('audit.export_ready', true, 'none', null, 'Your audit export is ready to download')
  ;
  ```

- [ ] **Step 9: Apply 0011.** Verify: `SELECT COUNT(*) FROM notification_type_config` returns 13.

- [ ] **Step 10: Create 0012 — default approval chains seed.** New file with 5 default chains. Bootstrap BO id obtained via subquery:

  ```sql
  -- Default chains per FR41/FR38/FR50/FR14/FR37 — BO can edit thresholds + structure post-seed via SI-INF-002.
  WITH bootstrap_bo AS (
    SELECT u.id AS user_id, u.brand_id
    FROM users u
    WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
    LIMIT 1
  )
  INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
  SELECT
    gen_random_uuid(),
    bo.brand_id,
    'po_threshold',
    'Default PO Threshold Chain',
    'PO ≥ ₹50,000 routes to Brand Owner; below threshold no chain fires.',
    jsonb_build_array(jsonb_build_object(
      'stepIndex', 0,
      'role', 'brand_owner',
      'valueBandMin', 50000,
      'escalationTimeoutMinutes', 1440,
      'fallbackDelegateUserId', null
    )),
    'active',
    bo.user_id,
    bo.user_id,
    now()
  FROM bootstrap_bo bo;

  -- Repeat WITH ... INSERT pattern for the other 4 entity types:
  -- gr_shelf_life_exception (CM step 0 → BO step 1; 4-hour escalation)
  -- recipe_default_change   (BO step 0; 24-hour escalation)
  -- bo_self_creation        (Superadmin step 0; 7-day escalation; no fallback)
  -- inventory_adjustment    (CM step 0 if cluster-scoped, BO step 1 if value > threshold)
  --
  -- See spec §4 Task A1 + §10 DL-036 for chain rationale.
  ```

  Author the 4 additional WITH/INSERT blocks following the same pattern.

- [ ] **Step 11: Apply 0012.** Verify: `SELECT entity_type, name, status FROM approval_chains` returns 5 rows, all status='active'.

- [ ] **Step 12: Commit migrations + seed files.**

  ```bash
  git add apps/api/src/db/migrations/
  git commit -m "Phase 4 Epic 3 Arc a — Task A5 migrations 0009-0012 (schema + permissions seed + type_config seed + default chains)"
  ```

### Task A6: Realtime publishers + storage signed-URL helper

**Files:**
- Create: `apps/api/src/realtime/publishers.ts`
- Create: `apps/api/src/storage/signed-url.ts`

- [ ] **Step 1: Create `realtime/publishers.ts`.**

  ```typescript
  // apps/api/src/realtime/publishers.ts
  import { createClient } from '@supabase/supabase-js';
  import { env } from '../config/env.js';

  // Service-role client — bypasses RLS (Master Spec §3.2). Used by Express server-side
  // to publish to Realtime channels. Browser clients consume via their own session-bound client.
  const realtimeClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /** Channel #1 (DL-010) — approval_requests. Filter by approver_id at consumer side. */
  export async function publishApprovalRequest(payload: {
    requestId: string;
    approverId: string;
    brandId: string;
    entityType: string;
  }): Promise<void> {
    await realtimeClient.channel('approval_requests').send({
      type: 'broadcast',
      event: 'approval_request_change',
      payload,
    });
  }

  /** Channel #2 (DL-010) — notifications. Filter by user_id at consumer side. */
  export async function publishNotification(payload: {
    notificationId: string;
    userId: string;
    brandId: string;
    type: string;
  }): Promise<void> {
    await realtimeClient.channel('notifications').send({
      type: 'broadcast',
      event: 'notification_change',
      payload,
    });
  }

  /** Channel #5 (DL-010) — issue_tracker_threads. Filter by ticket_id at consumer side. */
  export async function publishIssueTicketUpdate(payload: {
    ticketId: string;
    eventType: 'comment' | 'status' | 'assignment' | 'attachment';
    brandId: string;
  }): Promise<void> {
    await realtimeClient.channel('issue_tracker_threads').send({
      type: 'broadcast',
      event: 'issue_ticket_change',
      payload,
    });
  }
  ```

- [ ] **Step 2: Create `storage/signed-url.ts`.**

  ```typescript
  // apps/api/src/storage/signed-url.ts
  import { createClient } from '@supabase/supabase-js';
  import { env } from '../config/env.js';
  import { brandService } from '../services/brandService.js'; // Epic 1

  const storageClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes per DL-017

  /** Per-brand bucket name. Slug for human-readable Studio nav per DL-017. */
  async function getBrandBucket(brandId: string): Promise<string> {
    const brand = await brandService.get(brandId);
    return `brand-${brand.slug}`;
  }

  /** Provision a short-TTL signed PUT URL for browser direct upload. */
  export async function getSignedUploadUrl(args: {
    brandId: string;
    entityType: string;        // e.g., 'issue-tickets'
    entityId: string;          // e.g., the ticket UUID
    filename: string;
  }): Promise<{ url: string; storagePath: string; expiresAt: Date }> {
    const bucket = await getBrandBucket(args.brandId);
    const storagePath = `${args.entityType}/${args.entityId}/${args.filename}`;
    const { data, error } = await storageClient.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);
    if (error) throw new Error(`Signed upload URL error: ${error.message}`);
    return {
      url: data.signedUrl,
      storagePath,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
    };
  }

  /** Provision a short-TTL signed GET URL for download. */
  export async function getSignedDownloadUrl(args: {
    brandId: string;
    storagePath: string;
  }): Promise<{ url: string; expiresAt: Date }> {
    const bucket = await getBrandBucket(args.brandId);
    const { data, error } = await storageClient.storage
      .from(bucket)
      .createSignedUrl(args.storagePath, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Signed download URL error: ${error.message}`);
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
    };
  }
  ```

- [ ] **Step 3: Provision per-brand bucket via Supabase MCP (one-time, manual).** Use `mcp__claude_ai_Supabase__list_projects` → confirm `fnberp-prod`. Then via Supabase Studio (storage panel) or MCP execute_sql, create bucket `brand-demofb` (or whichever slug the bootstrap brand carries). MIME allowlist: `image/png`, `image/jpeg`, `image/gif`, `application/pdf`, `text/plain`. Public: false (private; only signed URLs grant access).

- [ ] **Step 4: Run typecheck.** Expected: 0 errors.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/api/src/realtime/ apps/api/src/storage/
  git commit -m "Phase 4 Epic 3 Arc a — Task A6 realtime publishers + signed-URL helper (DL-017 first exerciser)"
  ```

### Task A7: Service — `approvalEngine.ts`

**Files:**
- Create: `apps/api/src/services/approvalEngine.ts`
- Test: `apps/api/tests/integration/approval-engine.test.ts` (new)
- Test: `apps/api/tests/integration/approval-chain-config.test.ts` (new)

- [ ] **Step 1: Write failing test for `createApprovalRequest` happy path.**

  ```typescript
  // apps/api/tests/integration/approval-engine.test.ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { approvalEngine } from '../../src/services/approvalEngine.js';
  import { setupTestBrand, seedDefaultChains, createTestUser, cleanTestDb } from './_helpers.js';
  import { db } from '../../src/db/client.js';
  import { approvalRequests, approvalRequestSteps } from '../../src/db/schema/approval-requests.js';
  import { eq } from 'drizzle-orm';

  describe('approvalEngine.createApprovalRequest', () => {
    let brandId: string;
    let bo: { id: string };
    let cm: { id: string };

    beforeEach(async () => {
      await cleanTestDb();
      brandId = await setupTestBrand();
      bo = await createTestUser(brandId, { role: 'brand_owner' });
      cm = await createTestUser(brandId, { role: 'cluster_manager' });
      await seedDefaultChains(brandId, bo.id);
    });

    it('routes a PO above threshold to BO (step 0)', async () => {
      const req = await approvalEngine.createApprovalRequest({
        brandId,
        entityType: 'po_threshold',
        entityRef: 'PO-2026-CKA-000001',
        entityValue: 75000,
        requestingUserId: cm.id,
        payload: { vendor: 'Test Vendor', total: 75000 },
      });
      expect(req.status).toBe('pending');
      expect(req.currentStep).toBe(0);

      const steps = await db.select().from(approvalRequestSteps).where(eq(approvalRequestSteps.requestId, req.id));
      expect(steps).toHaveLength(1);
      expect(steps[0].approverUserId).toBe(bo.id);
      expect(steps[0].decision).toBe('pending');
    });

    it('does not create request when value is below threshold', async () => {
      await expect(
        approvalEngine.createApprovalRequest({
          brandId,
          entityType: 'po_threshold',
          entityRef: 'PO-2026-CKA-000002',
          entityValue: 25000,
          requestingUserId: cm.id,
          payload: {},
        })
      ).rejects.toThrow(/below threshold/i);
    });

    it('writes audit row on creation', async () => {
      const req = await approvalEngine.createApprovalRequest({
        brandId,
        entityType: 'po_threshold',
        entityRef: 'PO-2026-CKA-000003',
        entityValue: 75000,
        requestingUserId: cm.id,
        payload: {},
      });
      // Audit assertion — read from audit_log table for this entity
      const audit = await db.execute(`SELECT * FROM audit_log WHERE table_name='approval_requests' AND row_id=$1`, [req.id]);
      expect(audit.rows.length).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run test, expect failure.**

  ```bash
  cd apps/api && pnpm vitest run approval-engine
  ```

  Expected: FAIL — `approvalEngine is not a module`.

- [ ] **Step 3: Implement `approvalEngine.ts` — createApprovalRequest method first.**

  ```typescript
  // apps/api/src/services/approvalEngine.ts
  import { eq, and, sql } from 'drizzle-orm';
  import { db } from '../db/client.js';
  import { approvalChains, type ApprovalChainStep } from '../db/schema/approval-chains.js';
  import {
    approvalRequests,
    approvalRequestSteps,
    type ApprovalRequest,
    type NewApprovalRequest,
    type NewApprovalRequestStep,
  } from '../db/schema/approval-requests.js';
  import { auditLog } from './auditLog.js';
  import { notificationCenter } from './notificationCenter.js';
  import { publishApprovalRequest } from '../realtime/publishers.js';

  export interface CreateApprovalRequestInput {
    brandId: string;
    entityType: string;
    entityRef: string;
    entityValue?: number;
    requestingUserId: string;
    payload: Record<string, unknown>;
  }

  async function createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    // 1. Find active chain matching entity_type + value-band.
    const chains = await db
      .select()
      .from(approvalChains)
      .where(
        and(
          eq(approvalChains.brandId, input.brandId),
          eq(approvalChains.entityType, input.entityType as any),
          eq(approvalChains.status, 'active'),
        ),
      );

    if (chains.length === 0) {
      throw new Error(`No active chain for entity_type=${input.entityType}`);
    }

    // 2. Pick chain whose first step's value-band matches entityValue (if any).
    const chain = chains.find((c) => {
      const steps = c.steps as ApprovalChainStep[];
      const step0 = steps[0];
      if (input.entityValue == null) return true; // chains without value-band always match
      const minOk = step0.valueBandMin == null || input.entityValue >= step0.valueBandMin;
      const maxOk = step0.valueBandMax == null || input.entityValue <= step0.valueBandMax;
      return minOk && maxOk;
    });

    if (!chain) {
      throw new Error(`Value below threshold; no chain matched entityValue=${input.entityValue}`);
    }

    // 3. Resolve step 0 approver: chain step says role; resolve to a specific user via FR12 RBAC.
    //    For MVP single-tenant, we resolve to "the BO" / "any CM" / etc. via userService scope-filter.
    const step0 = (chain.steps as ApprovalChainStep[])[0];
    const approverUserId = await resolveApproverByRole(input.brandId, step0.role);

    // 4. Insert request + step 0 atomically.
    const [request] = await db.transaction(async (tx) => {
      const [req] = await tx
        .insert(approvalRequests)
        .values({
          brandId: input.brandId,
          entityType: input.entityType as any,
          entityRef: input.entityRef,
          entityValue: input.entityValue?.toString() as any,
          requestingUserId: input.requestingUserId,
          chainId: chain.id,
          currentStep: 0,
          status: 'pending',
          routingReason: `${input.entityType} matched chain "${chain.name}" → ${step0.role}`,
          payload: input.payload,
        } as NewApprovalRequest)
        .returning();

      await tx.insert(approvalRequestSteps).values({
        brandId: input.brandId,
        requestId: req.id,
        stepIndex: 0,
        approverUserId,
        decision: 'pending',
      } as NewApprovalRequestStep);

      await auditLog.record(tx, {
        brandId: input.brandId,
        actorUserId: input.requestingUserId,
        tableName: 'approval_requests',
        rowId: req.id,
        action: 'insert',
        before: null,
        after: req,
        reason: null,
        trnReference: input.entityRef,
      });

      return [req];
    });

    // 5. Notify approver + Realtime publish (out-of-transaction; failure here doesn't roll back the request).
    await notificationCenter.send({
      brandId: input.brandId,
      userId: approverUserId,
      type: 'approval.requested',
      payload: { requestId: request.id, entityType: input.entityType, entityRef: input.entityRef },
    });
    await publishApprovalRequest({
      requestId: request.id,
      approverId: approverUserId,
      brandId: input.brandId,
      entityType: input.entityType,
    });

    return request;
  }

  async function resolveApproverByRole(brandId: string, role: string): Promise<string> {
    const result = await db.execute<{ id: string }>(sql`
      SELECT id FROM users
      WHERE brand_id = ${brandId} AND role = ${role}::user_role AND active = true
      ORDER BY created_at ASC
      LIMIT 1
    `);
    if (result.rows.length === 0) throw new Error(`No active user with role=${role} in brand=${brandId}`);
    return result.rows[0].id;
  }

  export const approvalEngine = {
    createApprovalRequest,
    // decide, delegate, getApprovalStatus, getPendingApprovals, configureChain, listChains — added in subsequent steps
  };
  ```

- [ ] **Step 4: Run test, expect pass.** `pnpm vitest run approval-engine`. Expected: 3/3 pass.

- [ ] **Step 5: Add `decide` method.** Append to `approvalEngine.ts`:

  ```typescript
  export interface DecideInput {
    brandId: string;
    requestId: string;
    approverUserId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
    reasonCode?: string; // mandatory on reject per FR15c-style audit hygiene
  }

  async function decide(input: DecideInput): Promise<ApprovalRequest> {
    if (input.decision === 'rejected' && !input.reasonCode) {
      throw new Error('Reason code required on reject');
    }

    return await db.transaction(async (tx) => {
      // Status-guarded UPDATE per DL-016.
      const result = await tx.execute<{ id: string; current_step: number; chain_id: string }>(sql`
        UPDATE approval_request_steps
        SET decision = ${input.decision}, decided_at = now(), comment = ${input.comment ?? null}
        WHERE request_id = ${input.requestId}
          AND brand_id = ${input.brandId}
          AND approver_user_id = ${input.approverUserId}
          AND decision = 'pending'
        RETURNING request_id AS id, step_index AS current_step
      `);

      if (result.rows.length === 0) {
        throw new Error('Step not pending or not assigned to this approver');
      }

      // Look up the request + chain.
      const [request] = await tx.select().from(approvalRequests).where(eq(approvalRequests.id, input.requestId));
      const [chain] = await tx.select().from(approvalChains).where(eq(approvalChains.id, request.chainId));
      const steps = chain.steps as ApprovalChainStep[];
      const stepCount = steps.length;

      let nextStatus: 'pending' | 'approved' | 'rejected';
      let nextStep = request.currentStep;

      if (input.decision === 'rejected') {
        nextStatus = 'rejected';
      } else if (request.currentStep + 1 >= stepCount) {
        nextStatus = 'approved';
      } else {
        nextStatus = 'pending';
        nextStep = request.currentStep + 1;
      }

      const [updated] = await tx
        .update(approvalRequests)
        .set({
          status: nextStatus,
          currentStep: nextStep,
          decidedAt: nextStatus === 'pending' ? null : new Date(),
        })
        .where(eq(approvalRequests.id, input.requestId))
        .returning();

      // If advanced, insert the next step + notify the next approver.
      if (nextStatus === 'pending') {
        const nextStepDef = steps[nextStep];
        const nextApprover = await resolveApproverByRole(input.brandId, nextStepDef.role);
        await tx.insert(approvalRequestSteps).values({
          brandId: input.brandId,
          requestId: input.requestId,
          stepIndex: nextStep,
          approverUserId: nextApprover,
          decision: 'pending',
        } as NewApprovalRequestStep);
        // Notification + publish out-of-transaction in a follow-up — see Step 6.
      }

      await auditLog.record(tx, {
        brandId: input.brandId,
        actorUserId: input.approverUserId,
        tableName: 'approval_requests',
        rowId: input.requestId,
        action: 'update',
        before: request,
        after: updated,
        reason: input.reasonCode ?? null,
        trnReference: request.entityRef,
      });

      return updated;
    });
  }

  // Update approvalEngine export:
  export const approvalEngine = {
    createApprovalRequest,
    decide,
    // ...
  };
  ```

- [ ] **Step 6: Add post-transaction notification dispatch for advance case.** After the transaction in `decide`, if status moved to pending (advance), look up the new step's approver and send `approval.requested`. If status moved to approved/rejected, send `approval.decided` to `request.requestingUserId`.

- [ ] **Step 7: Add `delegate` method.** Same shape as `decide` but updates the current step's `decision='delegated'` + `escalation_target_user_id`, opens a new step row at the same stepIndex with the delegate as approver. Reason code mandatory.

- [ ] **Step 8: Add `getPendingApprovals(approverUserId, brandId)` and `getApprovalStatus(requestId, brandId)` reads.** Straightforward selects with brand_id filter.

- [ ] **Step 9: Add `configureChain` + `listChains` for SI-INF-002.** CRUD methods; status transitions validated (draft → active → inactive); chain edit writes audit row.

- [ ] **Step 10: Write tests for decide / delegate / advance / escalation.** Each method gets a happy + denial test in `approval-engine.test.ts`.

- [ ] **Step 11: Run full suite.** Expected: all green.

- [ ] **Step 12: Commit.**

  ```bash
  git add apps/api/src/services/approvalEngine.ts apps/api/tests/integration/approval-engine.test.ts apps/api/tests/integration/approval-chain-config.test.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A7 approvalEngine service (createApprovalRequest + decide + delegate + chain CRUD)"
  ```

### Task A8: Service — `notificationCenter.ts` + `auditService.ts`

**Files:**
- Create: `apps/api/src/services/notificationCenter.ts`
- Create: `apps/api/src/services/auditService.ts`
- Test: `apps/api/tests/integration/notification-center.test.ts`
- Test: `apps/api/tests/integration/audit-service.test.ts`

- [ ] **Step 1: Write notificationCenter tests first (TDD).** Test cases:
  - `send` writes a notifications row + emits Realtime publish (mock the publisher).
  - `send` looks up `notification_type_config.email_mode`; in MVP all rows are 'none' so no email job enqueued.
  - `sendBulk` does N rows in one transaction.
  - `list({userId})` returns user's notifications, newest first.
  - `markSeen({notificationId, userId})` sets `in_app_seen_at`.
  - `getPreferences` returns merged baseline (from type_config) + overrides (from notification_preferences).
  - `savePreferences` upserts.
  - **DL-035 invariant test:** assert `email_mode='none'` for every type_config row at test setup; assert no email job is enqueued by `send` (verify pg-boss queue depth unchanged).

- [ ] **Step 2: Run tests, expect failures.**

- [ ] **Step 3: Implement `notificationCenter.ts`.** Follow Master Spec §8.3 contract:

  ```typescript
  // apps/api/src/services/notificationCenter.ts
  import { eq, and, desc } from 'drizzle-orm';
  import { db } from '../db/client.js';
  import {
    notifications,
    notificationTypeConfig,
    notificationPreferences,
    type NewNotification,
    type Notification,
  } from '../db/schema/notifications.js';
  import { publishNotification } from '../realtime/publishers.js';

  export interface NotificationPayload {
    brandId: string;
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  }

  async function send(input: NotificationPayload): Promise<Notification> {
    const [config] = await db.select().from(notificationTypeConfig).where(eq(notificationTypeConfig.type, input.type));
    if (!config) throw new Error(`Unknown notification type: ${input.type}`);

    const [row] = await db
      .insert(notifications)
      .values({
        brandId: input.brandId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        digestEligible: config.emailMode === 'digest',
      } as NewNotification)
      .returning();

    // DL-035: email_mode='none' in MVP — no email job enqueue path fires.
    // When email-mode flips post-MVP, branch on config.emailMode here:
    //   'immediate' → enqueue send_email pg-boss job
    //   'digest'    → digestEligible row picked up by daily pg_cron handler
    //   'none'      → no email work

    await publishNotification({
      notificationId: row.id,
      userId: input.userId,
      brandId: input.brandId,
      type: input.type,
    });

    return row;
  }

  async function sendBulk(payloads: NotificationPayload[]): Promise<Notification[]> {
    if (payloads.length === 0) return [];
    return await db.transaction(async (tx) => {
      const rows = await Promise.all(
        payloads.map((p) =>
          // Reuse send logic per row; could be batched insert for perf, but keep simple in MVP.
          send(p)
        )
      );
      return rows;
    });
  }

  async function list(args: { userId: string; brandId: string; unseenOnly?: boolean }): Promise<Notification[]> {
    const conditions = [eq(notifications.brandId, args.brandId), eq(notifications.userId, args.userId)];
    return await db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt));
  }

  async function markSeen(args: { notificationId: string; userId: string; brandId: string }): Promise<void> {
    await db
      .update(notifications)
      .set({ inAppSeenAt: new Date() })
      .where(
        and(
          eq(notifications.id, args.notificationId),
          eq(notifications.userId, args.userId),
          eq(notifications.brandId, args.brandId),
        ),
      );
  }

  async function getPreferences(args: { userId: string; brandId: string }) {
    // Returns baseline (notification_type_config rows) + overrides (notification_preferences rows merged in).
    // ... implementation reads both tables, merges
  }

  async function savePreferences(args: { userId: string; brandId: string; type: string; prefs: Partial<NotificationPreference> }) {
    // Upsert pattern
    // ... implementation
  }

  export const notificationCenter = {
    send,
    sendBulk,
    list,
    markSeen,
    getPreferences,
    savePreferences,
  };
  ```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Write auditService tests first (TDD).** Test cases:
  - `listEvents({brandId, filters})` returns audit_log rows scoped by brand_id with filter combinations.
  - `getEntityTimeline({brandId, entityType, entityRef})` returns chronological events for a single entity.
  - `exportSlice` for CSV synchronously returns text content.
  - `exportSlice` for PDF enqueues a pg-boss job + returns job id.

- [ ] **Step 6: Implement `auditService.ts`.** Read-side queries against the existing audit_log table (Epic 1 DL-013).

- [ ] **Step 7: Commit both services + tests.**

  ```bash
  git add apps/api/src/services/notificationCenter.ts apps/api/src/services/auditService.ts apps/api/tests/integration/notification-center.test.ts apps/api/tests/integration/audit-service.test.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A8 notificationCenter + auditService"
  ```

### Task A9: Service — `issueTrackerService.ts` + `broadcastService.ts`

**Files:**
- Create: `apps/api/src/services/issueTrackerService.ts`
- Create: `apps/api/src/services/broadcastService.ts`
- Test: `apps/api/tests/integration/issue-tracker.test.ts`
- Test: `apps/api/tests/integration/issue-tracker-attachments.test.ts`
- Test: `apps/api/tests/integration/broadcasts.test.ts`

- [ ] **Step 1: Write issueTrackerService tests.** Test cases:
  - `create` writes ticket with auto-generated reference (`ISS-2026-001`, then `ISS-2026-002`, scoped to brand+year).
  - `create` emits `issue.assigned` notification when assignee set; no notification when unset.
  - `create` writes audit_log row.
  - `update` performs status-guarded transitions (open → in_progress → resolved → closed). Resolved → closed restricted to originator or BO.
  - `comment` writes comment row + emits Realtime channel #5 publish (mock) + emits `issue.commented` notifications to assignee + originator + prior commenters (de-duplicated, exclude author).
  - `attach` returns signed PUT URL via `getSignedUploadUrl` (mock storage layer); subsequent `confirmAttachment` writes the metadata row.
  - `list({brandId, scope})` RBAC scope-filtered: CM sees their cluster's tickets; POS Staff sees own + their location's; BO sees all.

- [ ] **Step 2: Run tests, expect failures.**

- [ ] **Step 3: Implement `issueTrackerService.ts`.** Key methods:

  ```typescript
  // apps/api/src/services/issueTrackerService.ts
  import { eq, and, desc, sql } from 'drizzle-orm';
  import { db } from '../db/client.js';
  import { issueTickets, issueTicketComments, issueTicketAttachments, type NewIssueTicket } from '../db/schema/issue-tickets.js';
  import { auditLog } from './auditLog.js';
  import { notificationCenter } from './notificationCenter.js';
  import { publishIssueTicketUpdate } from '../realtime/publishers.js';
  import { getSignedUploadUrl } from '../storage/signed-url.js';

  export interface CreateTicketInput {
    brandId: string;
    originatorUserId: string;
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assigneeUserId?: string;
    linkedEntityType?: string;
    linkedEntityRef?: string;
  }

  async function create(input: CreateTicketInput) {
    return await db.transaction(async (tx) => {
      // Generate reference via DB function from migration 0009.
      const year = new Date().getFullYear();
      const refResult = await tx.execute<{ reference: string }>(sql`
        SELECT issue_ticket_next_reference(${input.brandId}::uuid, ${year}) AS reference
      `);
      const reference = refResult.rows[0].reference;

      const [ticket] = await tx
        .insert(issueTickets)
        .values({
          brandId: input.brandId,
          reference,
          title: input.title,
          description: input.description,
          priority: input.priority ?? 'medium',
          status: 'open',
          assigneeUserId: input.assigneeUserId,
          originatorUserId: input.originatorUserId,
          linkedEntityType: input.linkedEntityType,
          linkedEntityRef: input.linkedEntityRef,
        } as NewIssueTicket)
        .returning();

      await auditLog.record(tx, {
        brandId: input.brandId,
        actorUserId: input.originatorUserId,
        tableName: 'issue_tickets',
        rowId: ticket.id,
        action: 'insert',
        before: null,
        after: ticket,
        reason: null,
        trnReference: reference,
      });

      return ticket;
    }).then(async (ticket) => {
      if (ticket.assigneeUserId) {
        await notificationCenter.send({
          brandId: input.brandId,
          userId: ticket.assigneeUserId,
          type: 'issue.assigned',
          payload: { ticketId: ticket.id, reference: ticket.reference, title: ticket.title },
        });
      }
      return ticket;
    });
  }

  async function comment(args: { brandId: string; ticketId: string; authorUserId: string; body: string }) {
    return await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(issueTicketComments)
        .values({
          brandId: args.brandId,
          ticketId: args.ticketId,
          authorUserId: args.authorUserId,
          body: args.body,
        })
        .returning();

      await auditLog.record(tx, {
        brandId: args.brandId,
        actorUserId: args.authorUserId,
        tableName: 'issue_ticket_comments',
        rowId: c.id,
        action: 'insert',
        before: null,
        after: c,
        reason: null,
      });

      return c;
    }).then(async (c) => {
      await publishIssueTicketUpdate({ ticketId: args.ticketId, eventType: 'comment', brandId: args.brandId });

      // Fan-out notifications to assignee + originator + prior commenters (de-duped, exclude author).
      const recipients = await db.execute<{ user_id: string }>(sql`
        SELECT DISTINCT user_id FROM (
          SELECT assignee_user_id AS user_id FROM issue_tickets WHERE id = ${args.ticketId}
          UNION
          SELECT originator_user_id AS user_id FROM issue_tickets WHERE id = ${args.ticketId}
          UNION
          SELECT author_user_id AS user_id FROM issue_ticket_comments WHERE ticket_id = ${args.ticketId}
        ) recipients WHERE user_id IS NOT NULL AND user_id != ${args.authorUserId}::uuid
      `);

      const [ticket] = await db.select().from(issueTickets).where(eq(issueTickets.id, args.ticketId));
      await notificationCenter.sendBulk(
        recipients.rows.map((r) => ({
          brandId: args.brandId,
          userId: r.user_id,
          type: 'issue.commented',
          payload: { ticketId: args.ticketId, reference: ticket.reference, body: args.body.slice(0, 200) },
        })),
      );

      return c;
    });
  }

  async function requestAttachment(args: { brandId: string; ticketId: string; filename: string; mimeType: string; sizeBytes: number; uploaderUserId: string }) {
    // MIME allowlist check
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain'];
    if (!allowed.includes(args.mimeType)) throw new Error(`Disallowed MIME type: ${args.mimeType}`);
    // Size limit — 10MB per attachment in MVP
    if (args.sizeBytes > 10 * 1024 * 1024) throw new Error('Attachment exceeds 10MB limit');

    const signed = await getSignedUploadUrl({
      brandId: args.brandId,
      entityType: 'issue-tickets',
      entityId: args.ticketId,
      filename: args.filename,
    });

    return { uploadUrl: signed.url, storagePath: signed.storagePath, expiresAt: signed.expiresAt };
  }

  async function confirmAttachment(args: { brandId: string; ticketId: string; storagePath: string; filename: string; mimeType: string; sizeBytes: number; uploaderUserId: string }) {
    const [a] = await db
      .insert(issueTicketAttachments)
      .values({
        brandId: args.brandId,
        ticketId: args.ticketId,
        storagePath: args.storagePath,
        filename: args.filename,
        mimeType: args.mimeType,
        sizeBytes: args.sizeBytes,
        uploadedByUserId: args.uploaderUserId,
      })
      .returning();
    await publishIssueTicketUpdate({ ticketId: args.ticketId, eventType: 'attachment', brandId: args.brandId });
    return a;
  }

  // update, list, get — straightforward Drizzle queries with brand_id filter + scope.

  export const issueTrackerService = {
    create,
    update: /* implementation */,
    comment,
    requestAttachment,
    confirmAttachment,
    list: /* implementation */,
    get: /* implementation */,
  };
  ```

  Author the `update`, `list`, `get` methods following Epic 2's `userService.ts` patterns (status-guarded UPDATE for status transitions per DL-016; brand_id filter + RBAC scope filter on list).

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Write broadcastService tests.** Test cases:
  - `compose` writes a draft.
  - `send` resolves target_scope to user list, fans out via `notificationCenter.sendBulk` (one `broadcast.received` per targeted user). Sets sentAt + status='sent'. Sent broadcasts immutable on PATCH.
  - `acknowledge` writes ack row with composite uniqueness — second ack from same user is no-op (or 409).
  - `listAcks` returns ack count + ack-pending count.

- [ ] **Step 6: Implement `broadcastService.ts`.** Per spec §4 Task A6 description; the `send` method's fan-out uses `notificationCenter.sendBulk`; `broadcast_acknowledgements` rows written ONLY on user ack (not pre-populated).

- [ ] **Step 7: Run all service tests.** Expected: all green.

- [ ] **Step 8: Commit.**

  ```bash
  git add apps/api/src/services/issueTrackerService.ts apps/api/src/services/broadcastService.ts apps/api/tests/integration/issue-tracker*.test.ts apps/api/tests/integration/broadcasts.test.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A9 issueTrackerService + broadcastService"
  ```

### Task A10: pg-boss escalation handler + pg_cron digest stub

**Files:**
- Create: `apps/api/src/jobs/approval-escalation.ts`
- Create: `apps/api/src/jobs/notification-digest.ts`
- Create: `apps/api/src/jobs/index.ts`
- Modify: `apps/api/src/server.ts` (boot wiring for pg-boss + pg_cron registration)

- [ ] **Step 1: Implement `approval-escalation.ts`.**

  ```typescript
  // apps/api/src/jobs/approval-escalation.ts
  import type PgBoss from 'pg-boss';
  import { eq, and, sql } from 'drizzle-orm';
  import { db } from '../db/client.js';
  import { approvalRequestSteps } from '../db/schema/approval-requests.js';
  import { notificationCenter } from '../services/notificationCenter.js';

  export const APPROVAL_ESCALATION_QUEUE = 'approval.escalation';

  export interface ApprovalEscalationJob {
    stepId: string;
    brandId: string;
    fallbackDelegateUserId?: string;
  }

  /** Called on step insert: schedules a pg-boss job at now() + escalationTimeoutMinutes. */
  export async function scheduleEscalation(boss: PgBoss, args: ApprovalEscalationJob, timeoutMinutes: number): Promise<void> {
    await boss.send(APPROVAL_ESCALATION_QUEUE, args, {
      startAfter: timeoutMinutes * 60,
    });
  }

  /** Handler: if the step is still pending, set decision='delegated', open new step row for fallback delegate. */
  export async function handleEscalation(job: PgBoss.Job<ApprovalEscalationJob>): Promise<void> {
    const { stepId, brandId, fallbackDelegateUserId } = job.data;

    if (!fallbackDelegateUserId) {
      // No fallback — escalation no-ops; original approver remains responsible.
      return;
    }

    await db.transaction(async (tx) => {
      // Status-guarded — only proceed if still pending.
      const result = await tx.execute(sql`
        UPDATE approval_request_steps
        SET decision = 'delegated', escalated_at = now(), escalation_target_user_id = ${fallbackDelegateUserId}::uuid
        WHERE id = ${stepId}::uuid
          AND brand_id = ${brandId}::uuid
          AND decision = 'pending'
        RETURNING request_id, step_index
      `);

      if (result.rows.length === 0) return; // already decided; no-op

      // Open new step at same index for the delegate.
      // ... insert approval_request_steps row for fallback
    });

    await notificationCenter.send({
      brandId,
      userId: fallbackDelegateUserId,
      type: 'approval.escalated',
      payload: { stepId },
    });
  }
  ```

- [ ] **Step 2: Implement `notification-digest.ts` as no-op stub per DL-035.**

  ```typescript
  // apps/api/src/jobs/notification-digest.ts
  import { db } from '../db/client.js';
  import { notificationTypeConfig } from '../db/schema/notifications.js';
  import { eq, sql } from 'drizzle-orm';

  /**
   * Daily digest aggregator — runs via pg_cron at 18:00 IST.
   * MVP per DL-035: every notification_type_config row has email_mode='none', so no row
   * has digest_eligible=true at notification write time, so this handler has nothing to
   * aggregate. Handler exits immediately when no row qualifies. Same code path activates
   * post-domain-registration without changes — flip email_mode='digest' on the relevant
   * type_config rows and the next 18:00 IST run picks them up.
   */
  export async function runDailyDigest(): Promise<{ usersProcessed: number; emailsEnqueued: number }> {
    const digestTypes = await db
      .select()
      .from(notificationTypeConfig)
      .where(eq(notificationTypeConfig.emailMode, 'digest'));

    if (digestTypes.length === 0) {
      return { usersProcessed: 0, emailsEnqueued: 0 }; // MVP path
    }

    // Post-MVP: aggregate digest_eligible=true notifications per user since last run,
    // enqueue one send_email job per user with the consolidated digest.
    // Implementation deferred until any type_config row has email_mode='digest'.
    return { usersProcessed: 0, emailsEnqueued: 0 };
  }
  ```

- [ ] **Step 3: Implement `jobs/index.ts` for boot wiring.**

  ```typescript
  // apps/api/src/jobs/index.ts
  import PgBoss from 'pg-boss';
  import { env } from '../config/env.js';
  import { APPROVAL_ESCALATION_QUEUE, handleEscalation } from './approval-escalation.js';
  import { runDailyDigest } from './notification-digest.js';

  let bossInstance: PgBoss | null = null;

  export async function startJobs(): Promise<PgBoss> {
    if (bossInstance) return bossInstance;
    const boss = new PgBoss(env.DATABASE_URL);
    await boss.start();

    await boss.work(APPROVAL_ESCALATION_QUEUE, handleEscalation);

    // pg_cron handler scheduled via DB-level cron — see migration TODO comment.
    // For MVP, the digest stub runs as a daily pg-boss cron alternative if pg_cron unavailable.

    bossInstance = boss;
    return boss;
  }

  export async function stopJobs(): Promise<void> {
    if (bossInstance) {
      await bossInstance.stop();
      bossInstance = null;
    }
  }

  export { APPROVAL_ESCALATION_QUEUE, scheduleEscalation } from './approval-escalation.js';
  ```

- [ ] **Step 4: Wire `startJobs()` into `apps/api/src/server.ts` boot path** alongside the existing Express app.listen. `stopJobs()` on graceful shutdown signal.

- [ ] **Step 5: Wire `scheduleEscalation` into `approvalEngine.createApprovalRequest` + `decide` (advance case).** When a new step row is inserted, look up the chain step's `escalationTimeoutMinutes` + `fallbackDelegateUserId`, call `scheduleEscalation` on the running pg-boss instance.

- [ ] **Step 6: Test the escalation flow.** Add to `approval-engine.test.ts`:
  - Create a chain with `escalationTimeoutMinutes: 0` (immediate) + a fallback delegate.
  - Create a request → step 0 inserted.
  - Manually fire `handleEscalation(job)` with the step's data.
  - Assert step decision='delegated', new step row opened for delegate, notification sent.

- [ ] **Step 7: Commit.**

  ```bash
  git add apps/api/src/jobs/ apps/api/src/server.ts apps/api/src/services/approvalEngine.ts apps/api/tests/integration/approval-engine.test.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A10 pg-boss escalation handler + pg_cron digest stub (DL-035 no-op)"
  ```

### Task A11: REST routes — approvals + notifications + audit + issues + broadcasts

**Files:**
- Create: `apps/api/src/routes/approvals.ts`
- Create: `apps/api/src/routes/notifications.ts`
- Create: `apps/api/src/routes/audit.ts`
- Create: `apps/api/src/routes/issues.ts`
- Create: `apps/api/src/routes/broadcasts.ts`
- Modify: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Implement `routes/approvals.ts`.** Endpoints per spec §4 Task A9:

  ```typescript
  // apps/api/src/routes/approvals.ts
  import { Router } from 'express';
  import { z } from 'zod';
  import { authMiddleware } from '../middleware/auth.js';
  import { requirePermission } from '../middleware/rbac.js';
  import { approvalEngine } from '../services/approvalEngine.js';

  const router = Router();
  router.use(authMiddleware);

  router.get('/inbox', requirePermission('inf.approval.read'), async (req, res) => {
    const items = await approvalEngine.getPendingApprovals(req.user.id, req.user.brandId);
    res.json(items);
  });

  const decideSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().optional(),
    reasonCode: z.string().optional(),
  });

  router.post('/:requestId/decide', requirePermission('inf.approval.write'), async (req, res) => {
    const input = decideSchema.parse(req.body);
    const result = await approvalEngine.decide({
      brandId: req.user.brandId,
      requestId: req.params.requestId,
      approverUserId: req.user.id,
      ...input,
    });
    res.json(result);
  });

  const delegateSchema = z.object({
    targetUserId: z.string().uuid(),
    reasonCode: z.string().min(1),
    comment: z.string().optional(),
  });

  router.post('/:requestId/delegate', requirePermission('inf.approval.write'), async (req, res) => {
    const input = delegateSchema.parse(req.body);
    const result = await approvalEngine.delegate({
      brandId: req.user.brandId,
      requestId: req.params.requestId,
      approverUserId: req.user.id,
      ...input,
    });
    res.json(result);
  });

  // Chain CRUD endpoints — BO only.
  router.get('/chains', requirePermission('inf.approval.configure_chains'), async (req, res) => {
    const chains = await approvalEngine.listChains(req.user.brandId);
    res.json(chains);
  });

  router.post('/chains', requirePermission('inf.approval.configure_chains'), async (req, res) => {
    // chain create — body validated via Zod, calls approvalEngine.configureChain
  });

  router.patch('/chains/:chainId', requirePermission('inf.approval.configure_chains'), async (req, res) => {
    // chain update
  });

  export default router;
  ```

- [ ] **Step 2: Implement `routes/notifications.ts`.** GET /notifications, POST /:id/seen, GET /preferences, PATCH /preferences, GET /digest/preview. Each guarded by appropriate `inf.notification.*` permission.

- [ ] **Step 3: Implement `routes/audit.ts`.** GET /events (filterable list), GET /entities/:entityType/:entityRef/timeline, POST /export, GET /exports/:jobId. Audit endpoints require `inf.audit.read`; export requires `inf.audit.export`. Scope filtering applies CM=cluster, FM=brand per RBAC matrix.

- [ ] **Step 4: Implement `routes/issues.ts`.** GET / POST /issues, GET PATCH /issues/:id, POST /:id/comments, POST /:id/attachments (returns signed PUT URL), PATCH /:id/attachments/:attId (confirms upload), DELETE /:id/attachments/:attId. Permissions: read/write self-scope; assign/close per role.

- [ ] **Step 5: Implement `routes/broadcasts.ts`.** GET /broadcasts (current user's targeted), POST /broadcasts (BO compose), PATCH /:id (edit draft only), POST /:id/send, POST /:id/cancel (drafts/scheduled only), POST /:id/acknowledge.

- [ ] **Step 6: Mount in `routes/index.ts`.**

  ```typescript
  // apps/api/src/routes/index.ts (extend existing)
  import approvals from './approvals.js';
  import notifications from './notifications.js';
  import audit from './audit.js';
  import issues from './issues.js';
  import broadcasts from './broadcasts.js';

  router.use('/approvals', approvals);
  router.use('/notifications', notifications);
  router.use('/audit', audit);
  router.use('/issues', issues);
  router.use('/broadcasts', broadcasts);
  ```

- [ ] **Step 7: Smoke-test endpoints with curl** against running dev server. Each endpoint hit returns expected envelope; permission denials return §17.5 envelope.

- [ ] **Step 8: Commit.**

  ```bash
  git add apps/api/src/routes/
  git commit -m "Phase 4 Epic 3 Arc a — Task A11 REST routes for approvals/notifications/audit/issues/broadcasts"
  ```

### Task A12: RBAC + integration test sweep

**Files:**
- Create: `apps/api/tests/integration/rbac-inf.test.ts`

- [ ] **Step 1: Write RBAC denial tests.** For every inf.* permission key, assert:
  - User with role baseline that grants the key → 200/expected.
  - User with role baseline that omits the key → 403 with `auth.permission_denied` code.
  - Override granting the key (per Epic 2 FR15a) → 200.
  - Override revoking the key → 403.

- [ ] **Step 2: Write scope-filter tests.** Assert CM gets cluster-scoped audit events, FM gets brand-scoped, BO gets all. POS Staff trying to read audit returns 403.

- [ ] **Step 3: Run full Arc (a) test suite.** `cd apps/api && pnpm test`. Expected: all green; no regressions on Epic 1 + Epic 2 tests.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/api/tests/integration/rbac-inf.test.ts
  git commit -m "Phase 4 Epic 3 Arc a — Task A12 RBAC + scope test sweep"
  ```

### Task A13: Arc (a) close — review + push

- [ ] **Step 1: Self-review checklist.**
  - Schema: 11 new tables; 10 brand-scoped (have brand_id index + 2-policy RLS); `notification_type_config` global with service_role-only RLS.
  - Audit: every mutation in approval/issue/broadcast services writes audit_log row.
  - Reason codes: chain edits (DL-036), approval rejects, ticket close, broadcast cancel.
  - DL-035 invariant: every `notification_type_config` row has `email_mode='none'`. Sweep with `psql fnberp_dev -c "SELECT type, email_mode FROM notification_type_config WHERE email_mode != 'none'"` — expected: 0 rows.
  - Tests: all green; integration test count ≥ 60 new tests.
  - Pre-commit hook: clean across all Arc (a) commits.

- [ ] **Step 2: Push branch + open PR.**

  ```bash
  git push -u origin phase-4/epic-3-inf-arc-a-backend
  gh pr create --title "Phase 4 Epic 3 Arc (a) — backend" --body "$(cat <<'EOF'
## Summary

- 11 new tables across 5 subsystem domains (approval, notifications, audit reads, issue tracker, broadcasts)
- 5 new services: approvalEngine, notificationCenter, auditService, issueTrackerService, broadcastService
- pg-boss escalation handler + pg_cron digest stub (no-op in MVP per DL-035)
- Realtime publishers for channels #1, #2, #5
- DL-017 signed-URL helper for issue ticket attachments (first MVP exerciser)
- Express REST routes + RBAC middleware extension
- Integration tests against fnberp_dev

## DL traceability

- DL-035 — email channel deferred; type_config seeded with email_mode='none'
- DL-036 — full chain editor (chain CRUD endpoints + service)
- DL-037 — permission overrides not retroactively routed (no override entity_type in chain enum)
- DL-039 — issue tracker full scope (comments + attachments + Realtime)

## Test plan

- [ ] All integration tests pass against fnberp_dev
- [ ] Permissions catalog seed produces 13 inf.* rows
- [ ] notification_type_config seed produces 13 rows, all email_mode='none'
- [ ] Default approval chains seeded for 5 entity types

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
  ```

- [ ] **Step 3: Wait for CI.** If CI is wired (Phase 4 ongoing), wait for green. Otherwise smoke-test locally.

---

## 5. Arc (b) — Mockups

Run order: B0 → B1 → (B2 || B3 || B4) → B5 → B6 → B7. Visual screens are independent within Arc (b); shells are extracted once consumers crystallise.

### Task B0: Verify mockup harness state

- [ ] **Step 1: Confirm mockup harness state.** `cd mockups && npm install && npm run dev`. Expected: localhost:5173 loads. Existing SI-INF-001 + SI-INF-005 routes work. ComponentsIndex at `/_dev/components` lists 27 shells from Epic 1 + 2.

- [ ] **Step 2: Confirm pre-commit hook.** `git config core.hooksPath` returns `mockups/.git-hooks`. (If fresh clone, run `git config core.hooksPath mockups/.git-hooks` from repo root.)

- [ ] **Step 3: Read the 6 inventory entries** at `_planning/05-screen-inventory.md` lines 1074–1452 (SI-INF-002, 003, 004, 007, 008, 009). Note the 12 schema fields per screen.

### Task B1: SI-INF-002 — Approval Chain Configuration (Tier 1)

**Files:**
- Create: `mockups/src/screens/inf/SI-INF-002.tsx`
- Create: `mockups/src/shell/CCApprovalChainEditor.tsx`
- Modify: `mockups/src/shell/index.ts` (re-export new shell)
- Modify: `mockups/src/screens/index.tsx` (route the new screen)
- Modify: `mockups/src/dev/ComponentsIndex.tsx` (permutations for new shell)

- [ ] **Step 1: Build `<CCApprovalChainEditor>` shell.** Props per spec §5 Task B1:
  - `chains: ChainSummary[]` (the list of chain rows)
  - `onCreateChain(input)`, `onEditChain(id, input)`, `onActivate(id)`, `onDeactivate(id)`
  - Internal: ordered step builder (drag-handle reorder via Radix or custom), per-step role select, value-band number inputs, escalation-timeout duration input, fallback-delegate user picker, status pill (draft/active/inactive).
  - DESIGN.md tokens only; no hex; `border-l-4` allowed for status pip; otherwise no borders.

- [ ] **Step 2: Add ComponentsIndex permutations for the editor.** Three states minimum: empty (no chains), with-draft, with-multi-active.

- [ ] **Step 3: Build SI-INF-002 page consuming the editor.** Sample-data fixtures from `mockups/src/lib/sample-data.ts` — 5 default chains matching the migration 0012 seed.

- [ ] **Step 4: Route in `screens/index.tsx`** before the `/:screenId` catch-all.

- [ ] **Step 5: Run `npx tsc --noEmit` from `mockups/`.** Expected: 0 errors.

- [ ] **Step 6: Commit per shell + screen.**

  ```bash
  git add mockups/src/shell/CCApprovalChainEditor.tsx mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B1 CCApprovalChainEditor shell"

  git add mockups/src/screens/inf/SI-INF-002.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B1 SI-INF-002 Approval Chain Configuration"
  ```

### Task B2: SI-INF-003 + SI-INF-004 — Notification Preferences + Digest Preview

**Files:**
- Create: `mockups/src/screens/inf/SI-INF-003.tsx`
- Create: `mockups/src/screens/inf/SI-INF-004.tsx`
- Create: `mockups/src/shell/CCNotificationPreferenceMatrix.tsx`
- Modify: `mockups/src/shell/index.ts`, `mockups/src/screens/index.tsx`, `mockups/src/dev/ComponentsIndex.tsx`

- [ ] **Step 1: Build `<CCNotificationPreferenceMatrix>`.** Per-category × per-channel toggle grid + quiet-hours window. **Email-channel column rendered greyed** with tooltip "Email channel coming when sending domain registered" per DL-035. Toggles still toggleable (state preserved); just disabled visually.

- [ ] **Step 2: Add ComponentsIndex permutations.** Empty preferences, partial overrides, all-default.

- [ ] **Step 3: Build SI-INF-003 page.** Categories from sample-data fixture matching migration 0011 type_config seed (13 types).

- [ ] **Step 4: Build SI-INF-004 page.** Reuses inbox list shape from SI-INF-001 (consult that file in Phase 2c-scoped). Header reads "Digest preview (in-app)" per DL-035.

- [ ] **Step 5: Run typecheck. Commit per screen.**

  ```bash
  git add mockups/src/shell/CCNotificationPreferenceMatrix.tsx mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B2 CCNotificationPreferenceMatrix shell"

  git add mockups/src/screens/inf/SI-INF-003.tsx mockups/src/screens/inf/SI-INF-004.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B2 SI-INF-003 + SI-INF-004 (email channel greyed per DL-035)"
  ```

### Task B3: SI-INF-007 + SI-INF-008 — Issue Tracker pair (Tier 1 hero on form)

**Files:**
- Create: `mockups/src/screens/inf/SI-INF-007.tsx`
- Create: `mockups/src/screens/inf/SI-INF-008.tsx`
- Create: `mockups/src/shell/CCIssueCommentThread.tsx`
- Create: `mockups/src/shell/CCFileAttachUploader.tsx`
- Modify: `mockups/src/shell/index.ts`, `mockups/src/screens/index.tsx`, `mockups/src/dev/ComponentsIndex.tsx`

- [ ] **Step 1: Build `<CCIssueCommentThread>` shell.** Chronological list of comments with author + timestamp + body. Compose-comment input at the bottom. Realtime placeholder (no actual subscription in mockup; visually shows "live" indicator).

- [ ] **Step 2: Build `<CCFileAttachUploader>` shell.** File-picker + size/type validation feedback + upload-progress indicator + attached-file list with download links. Mockup uses static fixtures; production wires to Express signed PUT URL flow in Arc (c).

- [ ] **Step 3: Build SI-INF-007 list page.** Filter chips, ticket cards / table rows, bulk-action checkboxes, empty state.

- [ ] **Step 4: Build SI-INF-008 form page (Tier 1 hero).** Form-page back-link header pattern (per Epic 2 USR-002 precedent). RHF + Zod for form state; sections for title/description, priority/status/assignee, linked entity (auto-prefilled from `CC-ISSUE-TICKET-LINK` entry-point query param), comments thread, attachments.

- [ ] **Step 5: Add ComponentsIndex permutations.** Comment thread: empty, single comment, multi-author thread. Attach uploader: empty, mid-upload, with attached files, error state.

- [ ] **Step 6: Run typecheck. Commit shells + screens.**

  ```bash
  git add mockups/src/shell/CCIssueCommentThread.tsx mockups/src/shell/CCFileAttachUploader.tsx mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B3 CCIssueCommentThread + CCFileAttachUploader shells (DL-017 first mockup)"

  git add mockups/src/screens/inf/SI-INF-007.tsx mockups/src/screens/inf/SI-INF-008.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B3 SI-INF-007 list + SI-INF-008 form (Tier 1 hero)"
  ```

### Task B4: SI-INF-009 — Broadcast Composer

**Files:**
- Create: `mockups/src/screens/inf/SI-INF-009.tsx`
- Modify: `mockups/src/screens/index.tsx`

- [ ] **Step 1: Build SI-INF-009 page.** BO-only desktop-primary form: composer (title, body markdown, urgency, target-scope picker, scheduled-for, ack-required toggle), preview pane, history list.

- [ ] **Step 2: No new shell.** Reuses existing `DraftPill`, `StatusPill`, `AuditLink`. Markdown preview via existing markdown component or inline simple renderer.

- [ ] **Step 3: Run typecheck. Commit.**

  ```bash
  git add mockups/src/screens/inf/SI-INF-009.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B4 SI-INF-009 Broadcast Composer"
  ```

### Task B5: `<CCActivityTimeline>` pattern shell (SI-INF-006)

**Files:**
- Create: `mockups/src/shell/CCActivityTimeline.tsx`
- Modify: `mockups/src/shell/index.ts`, `mockups/src/dev/ComponentsIndex.tsx`

- [ ] **Step 1: Build `<CCActivityTimeline>` shell.** Props: `events: TimelineEvent[]`, `entityType: string`, `entityRef: string`, `onViewFullHistory(): void`. Renders chronological list with status-token pills, actor, action, optional inline diff, drill-through link to "View full history" (consumed by Arc (c) which links to SI-INF-005 filtered to entity).

- [ ] **Step 2: Add ComponentsIndex permutations.** Three scenarios: user-mutation history (Arc (c) USR-002 use case), PO lifecycle (Epic 5 future use case), production-order lifecycle (Epic 7 future).

- [ ] **Step 3: No standalone screen route** — SI-INF-006 is a pattern-reference, not a route. The shell is the deliverable.

- [ ] **Step 4: Run typecheck. Commit.**

  ```bash
  git add mockups/src/shell/CCActivityTimeline.tsx mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B5 CCActivityTimeline shell (SI-INF-006 pattern; first consumer USR-002 in Arc c)"
  ```

### Task B6: `<CCReverseCancelDialog>` pattern shell (SI-INF-010)

**Files:**
- Create: `mockups/src/shell/CCReverseCancelDialog.tsx`
- Modify: `mockups/src/shell/index.ts`, `mockups/src/dev/ComponentsIndex.tsx`

- [ ] **Step 1: Build `<CCReverseCancelDialog>` shell.** Two-path dialog props: `mode: 'pre-confirmed' | 'post-confirmed'`, `entitySummary`, `compensatingDocPreview?`, `onConfirm({reasonCode}): void`, `onCancel(): void`. Mandatory reason-code input. Pre-confirmed path moves entity to status_cancelled; post-confirmed path creates compensating document with new TRN.

- [ ] **Step 2: Add ComponentsIndex permutations.** Both paths visible; sample fixtures for PO cancel (pre) + B2B challan reverse (post).

- [ ] **Step 3: No standalone screen route** — SI-INF-010 is a pattern-reference. First production consumer is Epic 4.

- [ ] **Step 4: Run typecheck. Commit.**

  ```bash
  git add mockups/src/shell/CCReverseCancelDialog.tsx mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
  git commit -m "Phase 4 Epic 3 Arc b — Task B6 CCReverseCancelDialog shell (SI-INF-010 pattern; first consumer Epic 4)"
  ```

### Task B7: Arc (b) close — pre-flight + push

- [ ] **Step 1: Pre-commit hook scope check.** `cd mockups && find src -name "*.tsx" -newer .git/refs/heads/main | xargs cat | grep -E "#[0-9a-f]{3,8}\b"` Expected: zero matches outside `tokens.ts`.

- [ ] **Step 2: Cross-check no Epic 1+2 shells got monkey-patched.**

  ```bash
  git diff main..phase-4/epic-3-inf-arc-b-mockups -- mockups/src/shell/ | grep -E "^[-+]" | grep -v "Add\|new file\|index.ts" | head -30
  ```

  Expected: only new shell files (CCApprovalChainEditor, CCNotificationPreferenceMatrix, CCActivityTimeline, CCReverseCancelDialog, CCIssueCommentThread, CCFileAttachUploader) + index.ts re-exports. Existing shells unchanged.

- [ ] **Step 3: Run vite build.** `cd mockups && npm run build`. Expected: clean.

- [ ] **Step 4: Push branch + open PR.**

  ```bash
  git push -u origin phase-4/epic-3-inf-arc-b-mockups
  gh pr create --title "Phase 4 Epic 3 Arc (b) — mockups" --body "..."
  ```

---

## 6. Arc (c) — Frontend

Run order: C0 → C1 → C2 → C3 → C4 → C5 → C6 → C7 → (C8a → C8b → C8c) → C9 → C10 → C11 → C12. Tasks C8a/b/c are sub-stages of Issue Tracker per DL-039.

### Task C0: One-time copy-port of new shells (DL-005)

**Files:**
- Create: `apps/web/src/components/shell/CCApprovalChainEditor.tsx`
- Create: `apps/web/src/components/shell/CCNotificationPreferenceMatrix.tsx`
- Create: `apps/web/src/components/shell/CCActivityTimeline.tsx`
- Create: `apps/web/src/components/shell/CCReverseCancelDialog.tsx`
- Create: `apps/web/src/components/shell/CCIssueCommentThread.tsx`
- Create: `apps/web/src/components/shell/CCFileAttachUploader.tsx`
- Modify: `apps/web/src/components/shell/index.ts`

- [ ] **Step 1: Copy each shell from `mockups/src/shell/` to `apps/web/src/components/shell/`.** One-time copy per DL-005; subsequent edits live in apps/web only.

- [ ] **Step 2: Update apps/web shell index.ts re-exports.**

- [ ] **Step 3: Run typecheck.** `cd apps/web && pnpm typecheck`. Expected: 0 errors (shell types should be self-contained).

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/components/shell/
  git commit -m "Phase 4 Epic 3 Arc c — Task C0 one-time copy-port of 6 new shells (DL-005)"
  ```

### Task C1: Realtime bridge primitive

**Files:**
- Create: `apps/web/src/lib/realtime-bridge.ts`
- Test: `apps/web/src/lib/realtime-bridge.test.ts`

- [ ] **Step 1: Write failing test for `useRealtimeChannel` hook.**

  ```typescript
  // apps/web/src/lib/realtime-bridge.test.ts
  import { renderHook, act } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { useRealtimeChannel } from './realtime-bridge';

  describe('useRealtimeChannel', () => {
    it('subscribes on mount + unsubscribes on unmount', () => {
      const subscribe = vi.fn();
      const unsubscribe = vi.fn();
      // ... test setup with mock supabase client
      // Render hook → assert subscribe called
      // Unmount → assert unsubscribe called
    });

    it('invalidates the matching query keys on event', () => {
      const queryClient = new QueryClient();
      const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
      // ... render hook with channel name + filter; emit a mock event
      // Assert invalidateQueries called with the right query keys
    });
  });
  ```

- [ ] **Step 2: Implement `realtime-bridge.ts`.**

  ```typescript
  // apps/web/src/lib/realtime-bridge.ts
  import { useEffect } from 'react';
  import { useQueryClient } from '@tanstack/react-query';
  import { supabase } from './auth';
  import { qk } from './query-keys';

  export type RealtimeChannelName = 'approval_requests' | 'notifications' | 'issue_tracker_threads';

  export interface RealtimeBridgeConfig {
    channelName: RealtimeChannelName;
    /** Predicate filter on payload — return true to invalidate. */
    filter: (payload: any) => boolean;
    /** Query keys to invalidate when an event passes filter. */
    invalidateKeys: ReadonlyArray<ReadonlyArray<unknown>>;
  }

  export function useRealtimeChannel(config: RealtimeBridgeConfig): void {
    const queryClient = useQueryClient();

    useEffect(() => {
      const channel = supabase.channel(config.channelName);
      channel.on('broadcast', { event: '*' }, (msg) => {
        if (config.filter(msg.payload)) {
          for (const key of config.invalidateKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        }
      });
      channel.subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [config.channelName, queryClient]);
  }
  ```

- [ ] **Step 3: Run tests, expect pass.**

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/lib/realtime-bridge.ts apps/web/src/lib/realtime-bridge.test.ts
  git commit -m "Phase 4 Epic 3 Arc c — Task C1 realtime-bridge primitive (DL-010 channels #1/#2/#5)"
  ```

### Task C2: TanStack Query hooks

**Files:**
- Create: `apps/web/src/hooks/useApprovals.ts`
- Create: `apps/web/src/hooks/useApprovalChains.ts`
- Create: `apps/web/src/hooks/useNotifications.ts`
- Create: `apps/web/src/hooks/useAudit.ts`
- Create: `apps/web/src/hooks/useIssueTickets.ts`
- Create: `apps/web/src/hooks/useBroadcasts.ts`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] **Step 1: Extend `query-keys.ts`.** Add `inf` namespace with sub-namespaces for each hook.

  ```typescript
  // apps/web/src/lib/query-keys.ts (extend existing)
  export const qk = {
    ...existing,
    inf: {
      approvals: {
        inbox: () => ['inf', 'approvals', 'inbox'] as const,
        request: (id: string) => ['inf', 'approvals', 'request', id] as const,
        chains: () => ['inf', 'approvals', 'chains'] as const,
        chain: (id: string) => ['inf', 'approvals', 'chain', id] as const,
      },
      notifications: {
        list: (userId: string) => ['inf', 'notifications', 'list', userId] as const,
        preferences: (userId: string) => ['inf', 'notifications', 'preferences', userId] as const,
        digest: (userId: string) => ['inf', 'notifications', 'digest', userId] as const,
      },
      audit: {
        events: (filters: object) => ['inf', 'audit', 'events', filters] as const,
        entityTimeline: (entityType: string, entityRef: string) => ['inf', 'audit', 'entity', entityType, entityRef] as const,
      },
      issues: {
        list: (filters: object) => ['inf', 'issues', 'list', filters] as const,
        detail: (id: string) => ['inf', 'issues', 'detail', id] as const,
      },
      broadcasts: {
        list: () => ['inf', 'broadcasts', 'list'] as const,
        detail: (id: string) => ['inf', 'broadcasts', 'detail', id] as const,
      },
    },
  };
  ```

- [ ] **Step 2: Implement `useApprovals.ts` with Realtime channel #1 wiring.**

  ```typescript
  // apps/web/src/hooks/useApprovals.ts
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { apiClient } from '../lib/api-client';
  import { qk } from '../lib/query-keys';
  import { useRealtimeChannel } from '../lib/realtime-bridge';
  import { useSession } from '../lib/auth';

  export function useApprovalInbox() {
    const session = useSession();

    useRealtimeChannel({
      channelName: 'approval_requests',
      filter: (payload) => payload.approverId === session.user.id,
      invalidateKeys: [qk.inf.approvals.inbox()],
    });

    return useQuery({
      queryKey: qk.inf.approvals.inbox(),
      queryFn: () => apiClient.get('/api/v1/approvals/inbox'),
    });
  }

  export function useDecideApproval() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: { requestId: string; decision: 'approved' | 'rejected'; comment?: string; reasonCode?: string }) =>
        apiClient.post(`/api/v1/approvals/${input.requestId}/decide`, input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.inf.approvals.inbox() });
      },
    });
  }

  export function useDelegateApproval() {
    // similar shape
  }
  ```

- [ ] **Step 3: Implement `useNotifications.ts` with Realtime channel #2 wiring.** Similar shape; filter by `payload.userId === session.user.id`.

- [ ] **Step 4: Implement `useAudit.ts`.** No Realtime; on-demand fetch with TanStack staleness.

- [ ] **Step 5: Implement `useIssueTickets.ts` with Realtime channel #5 wiring** for comments thread updates.

- [ ] **Step 6: Implement `useApprovalChains.ts` + `useBroadcasts.ts`.** No Realtime.

- [ ] **Step 7: Run typecheck.** Expected: 0 errors.

- [ ] **Step 8: Commit.**

  ```bash
  git add apps/web/src/hooks/use*.ts apps/web/src/lib/query-keys.ts
  git commit -m "Phase 4 Epic 3 Arc c — Task C2 TanStack Query hooks for inf.* (Realtime channels #1/#2/#5 wired)"
  ```

### Task C3: SI-INF-001 — Approval Inbox page (Tier 1 hero)

**Files:**
- Create: `apps/web/src/pages/inf/ApprovalInboxPage.tsx`
- Modify: `apps/web/src/App.tsx` or routes file (add `/approvals` route under AppShell)

- [ ] **Step 1: Build ApprovalInboxPage.** Consumes `useApprovalInbox()`, `useDecideApproval()`, `useDelegateApproval()`. Filter chips, bulk-select for confidence-rated routine items, drill-through to source-entity detail (route per entity_type). For BO Account Approval pending requests (entity_type='bo_self_creation'), card click navigates to `/users/approvals?id=<requestId>` per DL-040 (existing SI-USR-008 page; UX unchanged).

- [ ] **Step 2: Build inbox card with entity-type-specific rendering.**

  ```typescript
  // Per spec §6 Task C3: card variant by entity_type.
  function InboxCard({ request }: { request: ApprovalRequest }) {
    if (request.entityType === 'bo_self_creation') {
      // Drill-through-only per DL-040 — no inline approve/reject for BO approvals.
      return <BOAccountApprovalCard request={request} />;
    }
    // Other entity types get inline approve/reject affordances per spec.
    return <DefaultApprovalCard request={request} />;
  }
  ```

- [ ] **Step 3: Add route.** Path `/approvals/inbox` under AppShell, guarded by `<RequirePermission permission="inf.approval.read">`.

- [ ] **Step 4: Test against fnberp_dev.** Seed an approval request manually (via `psql` or a one-off seed script); log in as the bootstrap BO; verify the inbox shows it; click → drill-through navigates to source entity; approve → audit row written + notification sent (visible in channel #2 realtime).

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/pages/inf/ApprovalInboxPage.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C3 SI-INF-001 Approval Inbox (Tier 1 hero; DL-040 drill-through for BO approvals)"
  ```

### Task C4: SI-INF-002 — Approval Chain Configuration page (Tier 1)

**Files:**
- Create: `apps/web/src/pages/inf/ApprovalChainConfigPage.tsx`
- Modify: routes file

- [ ] **Step 1: Build ApprovalChainConfigPage.** Consumes `useApprovalChains()`. Wraps `<CCApprovalChainEditor>` shell. RHF + Zod for chain create/edit form. Activate / deactivate sub-affordances. Reason code mandatory on chain edits (DL-036 audit hygiene).

- [ ] **Step 2: Add route.** Path `/approvals/chains`, guarded by `<RequirePermission permission="inf.approval.configure_chains">`. Sidebar nav link added (BO-only via `<RequireRole>` wrapper at nav level).

- [ ] **Step 3: Test.** BO creates a new chain via UI → seed migration's existing chain coexists; new chain is editable; deactivate stops new requests routing to it.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/ApprovalChainConfigPage.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C4 SI-INF-002 Approval Chain Configuration (Tier 1; DL-036)"
  ```

### Task C5: SI-INF-003 + SI-INF-004 — Notification Preferences + Digest Preview

**Files:**
- Create: `apps/web/src/pages/inf/NotificationPreferencesPage.tsx`
- Create: `apps/web/src/pages/inf/NotificationDigestPage.tsx`

- [ ] **Step 1: Build NotificationPreferencesPage.** Wraps `<CCNotificationPreferenceMatrix>`. Email-channel column rendered greyed with tooltip per DL-035; toggle state preserved (writes to `notification_preferences.email_override`).

- [ ] **Step 2: Build NotificationDigestPage.** Header reads "Digest preview (in-app)" per DL-035. Consumes `useNotificationsDigest()`.

- [ ] **Step 3: Add routes** (`/notifications/preferences` + `/notifications/digest`) under AppShell.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/NotificationPreferencesPage.tsx apps/web/src/pages/inf/NotificationDigestPage.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C5 SI-INF-003 + SI-INF-004 (email channel greyed per DL-035)"
  ```

### Task C6: SI-INF-005 — Audit Trail Viewer (Tier 1)

**Files:**
- Create: `apps/web/src/pages/inf/AuditTrailViewerPage.tsx`

- [ ] **Step 1: Build AuditTrailViewerPage.** Consumes `useAuditEvents(filters)`. Filter chips (entity type, actor, action type, date range, scope). Selected-event detail panel with before/after diff. Export-trigger drill (`<ExportTrigger>` shell). PDF export polls `useAuditExportStatus(jobId)`.

- [ ] **Step 2: Implement `<AuditEventDiffPanel>`** — renders before/after as side-by-side or unified diff for jsonb fields.

- [ ] **Step 3: Add route** `/audit`. RBAC scope per inventory: BO + CM (cluster-scoped) + FM (brand-scoped). Service-side enforces scope.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/AuditTrailViewerPage.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C6 SI-INF-005 Audit Trail Viewer (Tier 1)"
  ```

### Task C7: USR-002 view-mode timeline embed + active overrides summary (DL-038)

**Files:**
- Modify: `apps/web/src/pages/usr/UserCreateEditPage.tsx`

- [ ] **Step 1: Add Mutation history section to USR-002 view-mode.**

  ```typescript
  // In UserCreateEditPage view-mode rendering, after existing form sections:
  {mode === 'view' && (
    <SectionShift>
      <h2>Mutation history</h2>
      <CCActivityTimeline
        entityType="user"
        entityRef={userId}
        events={timelineQuery.data ?? []}
        onViewFullHistory={() => navigate(`/audit?entityType=user&entityRef=${userId}`)}
      />
    </SectionShift>
  )}
  ```

- [ ] **Step 2: Add Active permission overrides summary section.**

  ```typescript
  // After Mutation history:
  {mode === 'view' && (
    <SectionShift>
      <h2>Active permission overrides</h2>
      <PermissionOverrideSummary overrides={activeOverridesQuery.data ?? []} />
    </SectionShift>
  )}
  ```

  Where `<PermissionOverrideSummary>` is a thin wrapper that reuses parts of `<CCPermissionOverrideMgmt>` from Epic 2 — show key, reason, modifying user, expiry. Link to SI-USR-006 for grant/revoke actions.

- [ ] **Step 3: Add `useUserTimeline(userId)` + `useUserActiveOverrides(userId)` hooks** consuming Arc (a) endpoints (`GET /audit/entities/user/:userId/timeline`, `GET /users/:id/permission-overrides?active=true`).

- [ ] **Step 4: Test against fnberp_dev.** Open USR-002 view mode for the bootstrap BO; mutation history populates; permission overrides summary populates (empty for default BO; create a test override + verify it appears).

- [ ] **Step 5: Run Playwright e2e.** Verify USR-002 still passes its existing acceptance + the two new sections render.

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/web/src/pages/usr/UserCreateEditPage.tsx apps/web/src/hooks/
  git commit -m "Phase 4 Epic 3 Arc c — Task C7 USR-002 view-mode embeds <CCActivityTimeline> + active overrides summary (DL-038 + chrome-freeze §9.2)"
  ```

### Task C8a: SI-INF-007 + SI-INF-008 list + form basics

**Files:**
- Create: `apps/web/src/pages/inf/IssueTicketsListPage.tsx`
- Create: `apps/web/src/pages/inf/IssueTicketFormPage.tsx`

- [ ] **Step 1: Build IssueTicketsListPage.** Filter chips, ticket cards / table rows, bulk-action checkboxes, link to create form. Empty state.

- [ ] **Step 2: Build IssueTicketFormPage (basic — no comments/attachments yet).** RHF + Zod for title/description/priority/status/assignee/linked-entity. Auto-prefill linked-entity from query param (CC-ISSUE-TICKET-LINK entry-point). Status transitions per FR22.

- [ ] **Step 3: Add routes.** `/issues` (list), `/issues/new` (create), `/issues/:id` (view/edit). Guarded by `inf.issue.read` / `inf.issue.write`.

- [ ] **Step 4: Test.** Create a ticket with linked-entity prefilled; reference auto-generates `ISS-2026-001`; status transitions audit.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/pages/inf/IssueTicketsListPage.tsx apps/web/src/pages/inf/IssueTicketFormPage.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C8a SI-INF-007 list + SI-INF-008 form basics (no comments/attachments yet)"
  ```

### Task C8b: Comments thread + Realtime channel #5

**Files:**
- Modify: `apps/web/src/pages/inf/IssueTicketFormPage.tsx`

- [ ] **Step 1: Add `<CCIssueCommentThread>` to view/edit mode.**

  ```typescript
  // In IssueTicketFormPage:
  <CCIssueCommentThread
    comments={commentsQuery.data ?? []}
    onAddComment={(body) => addCommentMutation.mutate({ ticketId, body })}
  />
  ```

- [ ] **Step 2: Wire `useIssueTicketComments(ticketId)` hook with Realtime channel #5.**

  ```typescript
  export function useIssueTicketComments(ticketId: string) {
    useRealtimeChannel({
      channelName: 'issue_tracker_threads',
      filter: (payload) => payload.ticketId === ticketId && payload.eventType === 'comment',
      invalidateKeys: [qk.inf.issues.detail(ticketId)],
    });

    return useQuery({
      queryKey: qk.inf.issues.detail(ticketId),
      queryFn: () => apiClient.get(`/api/v1/issues/${ticketId}`),
    });
  }
  ```

- [ ] **Step 3: Two-session live-update test.** Open the same ticket in two browser windows (signed in as different users); user A posts a comment; user B's window updates within ~1 second.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/IssueTicketFormPage.tsx apps/web/src/hooks/useIssueTickets.ts
  git commit -m "Phase 4 Epic 3 Arc c — Task C8b Issue ticket comments thread + Realtime channel #5"
  ```

### Task C8c: Attachments + signed-URL flow (DL-017 first MVP exerciser)

**Files:**
- Modify: `apps/web/src/pages/inf/IssueTicketFormPage.tsx`

- [ ] **Step 1: Context check.** If Arc (c) context is past 60-70%, surface to user that C8c can defer to a follow-up commit on the same branch. User decides at this point.

- [ ] **Step 2: Add `<CCFileAttachUploader>` to view/edit mode.**

  ```typescript
  <CCFileAttachUploader
    attachments={attachmentsQuery.data ?? []}
    onUpload={async (file) => {
      // Step 1: request signed PUT URL from API.
      const { uploadUrl, storagePath } = await apiClient.post(`/api/v1/issues/${ticketId}/attachments`, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      // Step 2: PUT file directly to Supabase Storage.
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // Step 3: confirm to API.
      await apiClient.patch(`/api/v1/issues/${ticketId}/attachments`, { storagePath, filename: file.name, mimeType: file.type, sizeBytes: file.size });

      // Refetch attachments list.
      queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    }}
    onDownload={async (attachment) => {
      const { url } = await apiClient.get(`/api/v1/issues/${ticketId}/attachments/${attachment.id}/download`);
      window.open(url, '_blank');
    }}
  />
  ```

- [ ] **Step 3: Smoke-test with multiple MIME types.** PNG, JPEG, PDF, plain text. Each uploads + downloads successfully. Disallowed types (e.g., .exe) return §17.5 error envelope.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/IssueTicketFormPage.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C8c Issue ticket attachments via signed-URL flow (DL-017 first MVP exerciser)"
  ```

### Task C9: SI-INF-009 — Broadcasts page

**Files:**
- Create: `apps/web/src/pages/inf/BroadcastsPage.tsx`
- Create: `apps/web/src/components/layout/BroadcastBanner.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx` (mount BroadcastBanner)

- [ ] **Step 1: Build BroadcastsPage.** BO-only via `<RequirePermission permission="inf.broadcast.compose">`. Composer + preview pane + history list + ack-detail drill.

- [ ] **Step 2: Build `<BroadcastBanner>`.** Mounted at AppShell layout level. Reads `useNotifications({type: 'broadcast.received'})`. Renders top-banner with urgency-coded styling (info=tint, important=warning, critical=error). Ack-required broadcasts block dismissal until acked.

- [ ] **Step 3: Test.** BO composes a broadcast targeted to all users; sends; logged-in user sees banner; acks; banner dismisses.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/inf/BroadcastsPage.tsx apps/web/src/components/layout/BroadcastBanner.tsx apps/web/src/components/layout/AppShell.tsx apps/web/src/App.tsx
  git commit -m "Phase 4 Epic 3 Arc c — Task C9 SI-INF-009 Broadcasts page + BroadcastBanner mount"
  ```

### Task C10: Cross-epic CC-AUDIT-LINK audit pass

**Files:**
- Modify: `apps/web/src/pages/mdm/*.tsx` (7 pages)
- Modify: `apps/web/src/pages/usr/*.tsx` (8 pages)

- [ ] **Step 1: Walk Epic 1 + 2 production pages.** For each page already carrying an `<AuditLink>` chip (per Epic 2 chrome-freeze §3 + §4), verify the chip's `entityType` + `entityRef` props match the new SI-INF-005 query-string contract. Wire the chip to navigate to `/audit?entityType=...&entityRef=...`.

- [ ] **Step 2: For pages lacking chips,** add `<AuditLink entityType="..." entityRef={id} />` to the page header action cluster.

- [ ] **Step 3: Test each Epic 1 + 2 page.** Click the audit chip → lands on SI-INF-005 filtered to the entity → shows entity's audit history.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/mdm/ apps/web/src/pages/usr/
  git commit -m "Phase 4 Epic 3 Arc c — Task C10 cross-epic CC-AUDIT-LINK wiring to live SI-INF-005 destination"
  ```

### Task C11: Chrome-freeze review (gate per Phase 4 invariant)

**Files:**
- Create: `docs/superpowers/reviews/2026-05-08-epic-3-inf-chrome-freeze-review.md`

- [ ] **Step 1: Run pre-commit hook scope check across all Arc (c) commits.** Expected: zero hex literals (outside tokens.ts), zero banned border classes, zero non-Lucide icons, zero `<Separator>` usages.

- [ ] **Step 2: Cross-epic chrome consistency audit.** Walk all 23 production pages (7 MDM + 8 USR + 8 INF). Verify:
  - Outer wrapper convention `bg-surface min-h-full` (or `min-h-screen` for pre-auth pages).
  - Header pattern: `<header class="flex flex-wrap items-end justify-between gap-4">` + AuditLink (where applicable).
  - Foundation chrome reuse (no inline reinvention).
  - Status palette closed (only canonical 20 status_* tokens).
  - tenant_brand_accent only on the 4 allowed surfaces (login splash + sidebar logo + B2B PDF + accountant PDF).

- [ ] **Step 3: Document findings at `docs/superpowers/reviews/2026-05-08-epic-3-inf-chrome-freeze-review.md`.** Mirror Epic 2 review structure: §1 Overview, §2 Summary, §3 Audit findings (per checklist item), §4 Recorded design choices, §5 Fix-backs applied, §6 Documented gaps deferred, §7 Sign-off.

- [ ] **Step 4: Apply fix-backs if any.** Mandatory before Task C12.

- [ ] **Step 5: Commit review file.**

  ```bash
  git add docs/superpowers/reviews/2026-05-08-epic-3-inf-chrome-freeze-review.md
  git commit -m "Phase 4 Epic 3 Arc c — Task C11 chrome-freeze review sign-off"
  ```

### Task C12: Arc (c) close + phase boundary update

**Files:**
- Modify: `CLAUDE.md` (## Current phase line)
- Modify: `codebase-inventory.md`

- [ ] **Step 1: Run typecheck across both packages.** `cd apps/api && pnpm typecheck && cd ../web && pnpm typecheck`. Expected: silent.

- [ ] **Step 2: Run vite build.** `cd apps/web && pnpm build`. Expected: clean.

- [ ] **Step 3: Run full Playwright e2e suite.** `cd apps/web && pnpm playwright test`. Expected: all green; existing 15+ specs from Epic 1+2 pass; new specs (approvals, approval-chains, notifications, audit-viewer, issue-tracker, broadcasts) pass.

- [ ] **Step 4: Update `CLAUDE.md` ## Current phase line.** Reflect Epic 3 ✅ DONE + Epic 4 INV next entry point. Mirror Epic 2 close-out wording.

- [ ] **Step 5: Update `codebase-inventory.md`** with new files in `apps/api/src/services/` (5 new), `apps/api/src/routes/` (5 new), `apps/web/src/pages/inf/` (8 new), `apps/web/src/components/shell/` (6 new), etc.

- [ ] **Step 6: Commit + push.**

  ```bash
  git add CLAUDE.md codebase-inventory.md
  git commit -m "Phase 4 Epic 3 Arc c — Task C12 close-out (Epic 3 ✅ DONE; Epic 4 INV is next)"
  git push -u origin phase-4/epic-3-inf-arc-c-frontend
  ```

- [ ] **Step 7: Open PR.** Mirror Epic 2 PR structure.

---

## 7. Acceptance criteria (mirror of spec §7)

Per spec §7. Tier 1 hero acceptance applies to SI-INF-001 (Approval Inbox), SI-INF-002 (Chain Config), SI-INF-005 (Audit Viewer), SI-INF-008 (Issue Form). Tier 2 acceptance for SI-INF-003, SI-INF-004, SI-INF-007, SI-INF-009. Pattern-shell acceptance for SI-INF-006 (mounted on USR-002 per DL-038) + SI-INF-010 (shell-only; first consumer Epic 4).

Cross-cutting:
- Existing Epic 1+2 Playwright e2e tests pass post-Epic-3.
- Token discipline: zero hex literals; no banned borders; Lucide-only; Inter-only; no `<Separator>`. Pre-commit hook fires zero times across Arc (b) + Arc (c).
- DL-035 invariant: no `notification_type_config` row has `email_mode != 'none'` post-Arc-(a).
- Realtime channels #1 + #2 + #5 verified live (two-session smoke test for each).
- Chrome-freeze sign-off at C11.
- DL-035 → DL-040 already written to decision-log.md before Arc (a) starts.

---

## 8. Branch hygiene + PR cadence

- **Planning branch.** `phase-4/epic-3-inf-plan` off main. Single commit (or small series): the spec at `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` + the plan at `docs/superpowers/plans/2026-05-08-phase-4-epic-3-inf-build.md` + DL-035 → DL-040 already appended to `decision-log.md`. PR opens before any arc starts.

- **Arc (a).** `phase-4/epic-3-inf-arc-a-backend` stacked off main. ~13 commits (one per task). PR opens at A13.

- **Arc (b).** `phase-4/epic-3-inf-arc-b-mockups` stacked off main. ~7 commits. PR opens at B7.

- **Arc (c).** `phase-4/epic-3-inf-arc-c-frontend` stacked off main. ~13 commits (C8 splits into C8a/b/c). PR opens at C12.

Total ~33 commits across 3 arc branches, similar to Epic 2 (15 commits on Arc (c) alone; Epic 3's heavier service-layer + Realtime work justifies the higher Arc (a) count).

---

## 9. Self-review

Run before handing the plan to the user.

**1. Spec coverage.** Cross-reference each §4–§6 task in the plan against the corresponding spec section.
- Spec §4 Task A1 (approval engine schema) ↔ Plan Task A1 ✓
- Spec §4 Task A2 (notification schema) ↔ Plan Task A2 ✓
- Spec §4 Task A3 (issue tracker schema) ↔ Plan Task A3 ✓
- Spec §4 Task A4 (broadcasts schema) ↔ Plan Task A4 ✓
- Spec §4 Task A5 (permission seed) ↔ Plan Task A5 (combined with migrations) ✓
- Spec §4 Task A6 (services) ↔ Plan Tasks A7+A8+A9 ✓
- Spec §4 Task A7 (pg-boss + pg_cron) ↔ Plan Task A10 ✓
- Spec §4 Task A8 (RBAC) ↔ Plan Task A12 (sweep) ✓
- Spec §4 Task A9 (REST endpoints) ↔ Plan Task A11 ✓
- Spec §4 Task A10 (Realtime publishers) ↔ Plan Task A6 (combined with signed-URL) ✓
- Spec §4 Task A11 (integration tests) ↔ Plan Tasks A7-A12 (TDD per service) + A12 sweep ✓
- Spec §4 Task A12 (Arc a close) ↔ Plan Task A13 ✓
- Spec §5 Tasks B0-B7 ↔ Plan Tasks B0-B7 ✓
- Spec §6 Tasks C0-C12 ↔ Plan Tasks C0-C12 (with C8 split into C8a/b/c per DL-039) ✓

**2. Placeholder scan.** Done — replaced all "TBD"/"TODO" patterns with explicit content. Where intentional ("// Author the remaining INSERTs following the same pattern" in migration 0010), the surrounding context makes the action concrete.

**3. Type consistency.** Method names match across tasks: `createApprovalRequest`, `decide`, `delegate`, `configureChain`, `listChains` consistent in A7+C2+C3+C4. `notificationCenter.send`/`sendBulk`/`list`/`markSeen`/`getPreferences`/`savePreferences` consistent in A8+C2+C5. `issueTrackerService.create`/`update`/`comment`/`requestAttachment`/`confirmAttachment`/`list`/`get` consistent in A9+C2+C8a/b/c. `broadcastService.compose`/`schedule`/`send`/`acknowledge` consistent in A9+C2+C9. `auditService.listEvents`/`getEntityTimeline`/`exportSlice` consistent in A8+C2+C6+C7+C10.

**4. DL traceability.** Each load-bearing decision references its DL entry:
- DL-035 → Tasks A2, A5 (step 8: type_config seed), A8 (notificationCenter `send` no-email path), A10 (digest stub), B2, C5
- DL-036 → Tasks A1 (chain schema), A7 (chain CRUD), B1, C4
- DL-037 → Spec §8 (out of scope: no override entity_type in approval chain enum)
- DL-038 → Tasks B5 (timeline shell), C0 (copy-port), C7 (USR-002 embed)
- DL-039 → Tasks A3 (schema with comments + attachments tables), A6 (signed-URL helper), A9 (issueTrackerService), B3 (mockup shells), C8a/b/c (frontend)
- DL-040 → Task C3 (inbox card variant for BO approvals)

**5. Cost gates.** None new. Supabase Mumbai already provisioned per Epic 2 Arc (a). DL-035 deferred Resend signup until sending domain registered. Storage bucket creation in Task A6 Step 3 uses existing Supabase project — no incremental cost.

Plan is ready for execution.