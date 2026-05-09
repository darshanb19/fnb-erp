/**
 * NotificationDigestPage — SI-INF-004 Notification Digest Preview (production frontend).
 *
 * Phase 4 Epic 3 INF Arc (c), Task C5. Mirrors the Arc (b) mockup at
 * mockups/src/screens/inf/SI-INF-004.tsx — same chrome adapted for real data.
 *
 * FR19 (batch non-urgent + escalate unacknowledged). Header reads
 * "Digest preview (in-app)" per DL-035 — email digest activates when a
 * sending domain is registered.
 *
 * Two sections:
 *   1. Digest preview — useNotificationDigestPreview(). In MVP the digest
 *      will always be empty (no batching job yet wired); show friendly empty
 *      state explaining DL-035 constraint.
 *   2. Recent notifications feed — useNotifications({ limit: 20 }) showing
 *      type label, age, and per-item "Mark seen" button. "Mark all seen"
 *      at the top via useMarkAllNotificationsSeen().
 *
 * Token discipline:
 *   - Zero hex literals.
 *   - Lucide icons only.
 *   - No banned border classes.
 *   - Inter font inherited (no inline font-family).
 *   - No entrance animations (list view — CLAUDE.md policy).
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Clock,
  History,
  Inbox,
  MailQuestion,
} from 'lucide-react'

import {
  Button,
  SectionShift,
} from '@/components/shell'
import {
  useNotificationDigestPreview,
  useNotifications,
  useMarkNotificationSeen,
  useMarkAllNotificationsSeen,
  type NotificationRow,
} from '@/hooks/useNotifications'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical type → human label. Falls back to raw type string. */
const TYPE_LABEL: Record<string, string> = {
  'approval.requested': 'Approval request',
  'approval.decided': 'Approval decision',
  'approval.delegated': 'Approval delegated',
  'approval.escalated': 'Approval escalated',
  'issue.assigned': 'Issue assigned',
  'issue.commented': 'Issue comment',
  'issue.status_changed': 'Issue status changed',
  'broadcast.received': 'Broadcast',
  'user.created': 'New user added',
  'user.role_changed': 'Role or scope changed',
  'permission.override_applied': 'Permission override applied',
  'permission.override_expiring': 'Permission override expiring',
  'audit.export_ready': 'Audit export ready',
}

function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type
}

function ageLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const h = Math.max(0, Math.round(diffMs / 3_600_000))
  if (h < 1) return 'just now'
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} d ago`
}

function notificationTitle(row: NotificationRow): string {
  // payload is `unknown` — cast defensively for a display title.
  if (
    row.payload !== null &&
    row.payload !== undefined &&
    typeof row.payload === 'object'
  ) {
    const p = row.payload as Record<string, unknown>
    if (typeof p['title'] === 'string' && p['title'].length > 0) return p['title']
    if (typeof p['message'] === 'string' && p['message'].length > 0) return p['message']
    if (typeof p['entityRef'] === 'string' && p['entityRef'].length > 0) {
      return `${typeLabel(row.type)} — ${p['entityRef']}`
    }
  }
  return typeLabel(row.type)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationRowItemProps {
  readonly row: NotificationRow
  readonly onMarkSeen: (id: string) => void
  readonly markSeenPending: boolean
}

function NotificationRowItem({
  row,
  onMarkSeen,
  markSeenPending,
}: NotificationRowItemProps) {
  const isSeen = row.inAppSeenAt !== null

  return (
    <li
      className={[
        'flex items-stretch transition-colors',
        !isSeen ? 'hover:bg-surface-container-low' : 'opacity-70 hover:bg-surface-container-low',
      ].join(' ')}
    >
      {/* Unseen pip */}
      {!isSeen ? (
        <span aria-hidden className="w-1 shrink-0 bg-primary" />
      ) : (
        <span aria-hidden className="w-1 shrink-0" />
      )}

      <div className="flex flex-1 flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              {typeLabel(row.type)}
            </span>
            {!isSeen ? (
              <span className="rounded-pill bg-primary px-2 py-0.5 text-[10px] font-medium text-on-primary">
                New
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-on-surface">
            {notificationTitle(row)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <span className="tabular-nums">{ageLabel(row.createdAt)}</span>
          </p>
        </div>

        {!isSeen ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={markSeenPending}
            onClick={() => onMarkSeen(row.id)}
            aria-label={`Mark as seen: ${notificationTitle(row)}`}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Mark seen
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-on-surface-variant pt-1">
            <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Seen
          </span>
        )}
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationDigestPage() {
  const digestQuery = useNotificationDigestPreview()
  const notificationsQuery = useNotifications({ limit: 20 })
  const markSeen = useMarkNotificationSeen()
  const markAllSeen = useMarkAllNotificationsSeen()

  const notifications = notificationsQuery.data?.items ?? []

  const unseenCount = useMemo(
    () => notifications.filter((n) => n.inAppSeenAt === null).length,
    [notifications],
  )

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1200px] px-6 py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Notifications
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Digest preview (in-app)
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Preview your pending digest and recent notification activity.
              Items configured for digest delivery batch here; urgent items
              surface separately when they exceed their per-category timeout.
            </p>
          </div>
          {unseenCount > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="tonal"
                size="sm"
                disabled={markAllSeen.isPending}
                onClick={() => { void markAllSeen.mutateAsync() }}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Mark all seen ({unseenCount})
              </Button>
            </div>
          ) : null}
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR19 (batch non-urgent + escalate unacknowledged). Header reads
          &ldquo;in-app&rdquo; per DL-035 — email digest activates when a
          sending domain is registered.
        </p>

        {/* ── Section 1: Digest preview ─────────────────────────────────── */}
        <section aria-label="Digest preview" className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-on-surface-variant" aria-hidden />
            <h2 className="text-base font-semibold text-on-surface">
              Next digest
            </h2>
          </div>

          {digestQuery.isLoading ? (
            <div className="rounded-md bg-surface-container-lowest p-6">
              <div className="h-4 w-64 rounded bg-surface-container-high animate-pulse" />
              <div className="mt-3 h-4 w-48 rounded bg-surface-container-high animate-pulse" />
            </div>
          ) : digestQuery.isError ? (
            <div
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              Failed to load digest preview. Please refresh.
            </div>
          ) : (
            /* DL-035: email digest delivery is not active in MVP. The
               digest preview API returns an empty items list because the
               batching job does not yet dispatch. Show a friendly explanation. */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <MailQuestion
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                Digest currently empty.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant max-w-md mx-auto">
                Email-based digest delivery is coming when a sending domain is
                registered (DL-035). Notifications you configure for digest
                batching will accumulate here once the sending domain is
                provisioned.
              </p>
              {digestQuery.data && digestQuery.data.startedAt ? (
                <p className="mt-3 text-xs text-on-surface-variant tabular-nums">
                  Window started: {digestQuery.data.startedAt}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <SectionShift tone="high" className="mt-8" />

        {/* ── Section 2: Recent notifications feed ──────────────────────── */}
        <section aria-label="Recent notifications" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-on-surface-variant" aria-hidden />
              <h2 className="text-base font-semibold text-on-surface">
                Recent notifications
              </h2>
              {notificationsQuery.isLoading ? null : (
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant tabular-nums">
                  {notifications.length} shown
                  {unseenCount > 0 ? ` · ${unseenCount} unseen` : ''}
                </span>
              )}
            </div>
          </div>

          {notificationsQuery.isLoading ? (
            <div className="overflow-hidden rounded-md bg-surface-container-lowest">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-4 min-h-[68px]"
                >
                  <div className="h-4 w-32 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-3 w-48 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-7 w-24 rounded-sm bg-surface-container-high animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : notificationsQuery.isError ? (
            <div
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              Failed to load notifications. Please refresh the page.
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <Inbox
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No notifications yet.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                In-app notifications will appear here as activity occurs in the
                system.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md bg-surface-container-lowest">
              <ul className="flex flex-col" aria-label="Notification list">
                {notifications.map((row) => (
                  <NotificationRowItem
                    key={row.id}
                    row={row}
                    onMarkSeen={(id) => {
                      markSeen.mutate({ notificationId: id })
                    }}
                    markSeenPending={markSeen.isPending}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
          <Link
            to="/notifications/preferences"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Tune notification preferences (SI-INF-003)
          </Link>
          <span aria-hidden>·</span>
          <Link
            to="/SI-INF-005?entity=notification_dispatch"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <History className="h-3 w-3" aria-hidden />
            Dispatch history (SI-INF-005)
          </Link>
          <span aria-hidden>·</span>
          <span>SI-INF-004 · Tier 2 · Phase 4 Epic 3 INF</span>
        </footer>
      </div>
    </div>
  )
}
