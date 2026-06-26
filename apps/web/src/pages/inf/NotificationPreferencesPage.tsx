/**
 * NotificationPreferencesPage — SI-INF-003 Notification Preferences (production frontend).
 *
 * Phase 4 Epic 3 INF Arc (c), Task C5. Mirrors the Arc (b) mockup at
 * mockups/src/screens/inf/SI-INF-003.tsx — same chrome, same matrix shell,
 * real data via useNotificationPreferences() + useUpdateNotificationPreference().
 *
 * FR18 (configurable channels) + FR19 (digest batching) + FR20 (audit trail).
 * DL-035: emailDisabled is always true — every email toggle renders greyed
 * with the "Email channel coming when sending domain registered" tooltip.
 * The CCNotificationPreferenceMatrix shell handles that affordance; this
 * page just passes emailDisabled.
 *
 * Adapter: API PreferenceRow[] → shell NotificationCategory[] + overrides.
 * Quiet hours: global in MVP — we derive startTime/endTime from the first
 * non-null preference row, and broadcast updates to all types when the user
 * changes the quiet-hours window.
 *
 * Token discipline:
 *   - Zero hex literals.
 *   - Lucide icons only.
 *   - No banned border classes.
 *   - Inter font inherited (no inline font-family).
 *   - No entrance animations (admin form — CLAUDE.md policy).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'

import {
  CCNotificationPreferenceMatrix,
  SectionShift,
  type NotificationCategory,
  type NotificationPreferenceOverride,
  type PreferenceChannel,
  type QuietHoursWindow,
} from '@/components/shell'
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
  type PreferenceRow,
} from '@/hooks/useNotifications'

// ─────────────────────────────────────────────────────────────────────────────
// Canonical type → label mapping (verbatim from 0011_seed_notification_type_config.sql).
// Unknown types fall through to raw type string — future-proofing.
// ─────────────────────────────────────────────────────────────────────────────

interface TypeMeta {
  readonly label: string
  readonly description: string
  readonly digestEligible: boolean
}

const TYPE_META: Record<string, TypeMeta> = {
  'approval.requested': {
    label: 'Approval requests',
    description: 'New approval request routed to you.',
    digestEligible: false,
  },
  'approval.decided': {
    label: 'Approval decisions',
    description: 'Decision made on your approval request.',
    digestEligible: true,
  },
  'approval.delegated': {
    label: 'Approval delegated to you',
    description: 'An approval was delegated to you by another approver.',
    digestEligible: false,
  },
  'approval.escalated': {
    label: 'Approval escalated',
    description: 'An approval timed out and escalated to you.',
    digestEligible: false,
  },
  'issue.assigned': {
    label: 'Issue tickets assigned',
    description: 'A ticket was assigned to you.',
    digestEligible: false,
  },
  'issue.commented': {
    label: 'Issue ticket comments',
    description: 'New comment on a ticket you follow.',
    digestEligible: true,
  },
  'issue.status_changed': {
    label: 'Issue ticket status changes',
    description: 'Status changed on a ticket you follow.',
    digestEligible: true,
  },
  'broadcast.received': {
    label: 'Broadcast announcements',
    description: 'New brand-wide broadcast.',
    digestEligible: true,
  },
  'user.created': {
    label: 'New user added',
    description: 'A new user was added to your scope.',
    digestEligible: true,
  },
  'user.role_changed': {
    label: 'Your role or scope changed',
    description: 'Your role or scope was changed.',
    digestEligible: false,
  },
  'permission.override_applied': {
    label: 'Permission overrides applied',
    description: 'Permission overrides were applied to your account.',
    digestEligible: false,
  },
  'permission.override_expiring': {
    label: 'Permission overrides expiring',
    description: 'A temporary override is about to lapse.',
    digestEligible: true,
  },
  'audit.export_ready': {
    label: 'Audit export ready',
    description: 'Your audit export is ready to download.',
    digestEligible: false,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowToCategory(row: PreferenceRow): NotificationCategory {
  const meta = TYPE_META[row.type]
  return {
    type: row.type,
    label: meta?.label ?? row.type,
    description: meta?.description,
    digestEligible: meta?.digestEligible ?? false,
    defaults: {
      inApp: row.inApp,
      emailMode: row.emailMode,
      digestWindow: row.digestWindow,
    },
  }
}

function rowToOverride(row: PreferenceRow): NotificationPreferenceOverride | null {
  const hasOverride =
    row.inAppOverride !== null ||
    row.emailOverride !== null ||
    row.digestBatchOverride !== null
  if (!hasOverride) return null
  return {
    type: row.type,
    inAppOverride: row.inAppOverride,
    emailOverride: row.emailOverride,
    digestBatchOverride: row.digestBatchOverride,
  }
}

function deriveQuietHours(rows: readonly PreferenceRow[]): QuietHoursWindow {
  for (const row of rows) {
    if (row.quietHoursStart !== null || row.quietHoursEnd !== null) {
      return {
        startTime: row.quietHoursStart,
        endTime: row.quietHoursEnd,
      }
    }
  }
  return { startTime: null, endTime: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  const prefsQuery = useNotificationPreferences()
  const updatePref = useUpdateNotificationPreference()

  // Local optimistic override state — seeded from API, then mutated locally
  // while async writes in-flight. Resets on next successful invalidation.
  const [localOverrides, setLocalOverrides] = useState<
    ReadonlyArray<NotificationPreferenceOverride>
  >([])
  const [localQuietHours, setLocalQuietHours] = useState<QuietHoursWindow | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const rows = prefsQuery.data ?? []

  const categories: ReadonlyArray<NotificationCategory> = useMemo(
    () => rows.map(rowToCategory),
    [rows],
  )

  // Merge API overrides + local optimistic state. Local wins.
  const apiOverrides: ReadonlyArray<NotificationPreferenceOverride> = useMemo(
    () => rows.flatMap((r) => rowToOverride(r) ?? []),
    [rows],
  )

  const overrides: ReadonlyArray<NotificationPreferenceOverride> = useMemo(() => {
    // Start with API overrides; replace any types present in localOverrides.
    const localTypes = new Set(localOverrides.map((o) => o.type))
    const base = apiOverrides.filter((o) => !localTypes.has(o.type))
    return [...base, ...localOverrides]
  }, [apiOverrides, localOverrides])

  const quietHours: QuietHoursWindow = useMemo(() => {
    if (localQuietHours !== null) return localQuietHours
    return deriveQuietHours(rows)
  }, [localQuietHours, rows])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = (
    type: string,
    channel: PreferenceChannel,
    value: boolean,
  ) => {
    // Optimistic local state update.
    setLocalOverrides((prev) => {
      const existing = prev.find((o) => o.type === type) ?? {
        type,
        inAppOverride: null as boolean | null,
        emailOverride: null as boolean | null,
        digestBatchOverride: null as boolean | null,
      }
      const next: NotificationPreferenceOverride = {
        type: existing.type,
        inAppOverride: channel === 'inApp' ? value : existing.inAppOverride,
        emailOverride: channel === 'email' ? value : existing.emailOverride,
        digestBatchOverride:
          channel === 'digestBatch' ? value : existing.digestBatchOverride,
      }
      const without = prev.filter((o) => o.type !== type)
      return [...without, next]
    })
    setSavedAt(null)

    // Map channel → API field name.
    const payload: {
      inAppOverride?: boolean | null
      emailOverride?: boolean | null
      digestBatchOverride?: boolean | null
    } = {}
    if (channel === 'inApp') payload.inAppOverride = value
    if (channel === 'email') payload.emailOverride = value
    if (channel === 'digestBatch') payload.digestBatchOverride = value

    updatePref.mutate(
      { type, ...payload },
      {
        onSuccess: () => setSavedAt(new Date().toISOString()),
      },
    )
  }

  const handleSetQuietHours = (window: QuietHoursWindow) => {
    setLocalQuietHours(window)
    setSavedAt(null)

    // MVP shortcut: upsert quiet hours on every known type (one PATCH each).
    // The API deduplicates via ON CONFLICT; no double-write risk.
    rows.forEach((row) => {
      updatePref.mutate(
        {
          type: row.type,
          quietHoursStart: window.startTime,
          quietHoursEnd: window.endTime,
        },
        {
          onSuccess: () => setSavedAt(new Date().toISOString()),
        },
      )
    })
  }

  const handleResetToDefaults = () => {
    setLocalOverrides([])
    setLocalQuietHours(null)
    setSavedAt(null)

    rows.forEach((row) => {
      updatePref.mutate({
        type: row.type,
        inAppOverride: null,
        emailOverride: null,
        digestBatchOverride: null,
      })
    })
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (prefsQuery.isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1200px] px-6 py-8 desktop:px-10 desktop:py-10">
          <div className="h-8 w-64 rounded bg-surface-container-high animate-pulse" />
          <div className="mt-6 h-64 rounded-md bg-surface-container-low animate-pulse" />
        </div>
      </div>
    )
  }

  if (prefsQuery.isError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1200px] px-6 py-8 desktop:px-10 desktop:py-10">
          <div
            role="alert"
            className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            Failed to load notification preferences. Please refresh the page.
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1200px] px-6 py-8 desktop:px-10 desktop:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Notifications
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Notification preferences
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Tune which notification categories deliver in-app, which deliver via
              email, and which batch into a digest. Each user manages their own
              preferences; defaults seed from your role at onboarding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/audit?entityType=notification_preference"
              className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors min-h-[44px] tablet:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-medium uppercase tracking-wider text-[11px]">
                Preference history
              </span>
            </Link>
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          Configure delivery channels and digest batching. Mutations write
          to the audit trail. The email channel is not yet available —
          it re-enables one row at a time once a sending domain is provisioned.
        </p>

        {savedAt !== null ? (
          <div
            role="status"
            className="mt-4 rounded-md bg-surface-container-lowest p-3"
          >
            <p className="text-sm text-on-surface">
              <span className="font-medium">Preferences saved.</span> The
              notification engine will respect these on the next dispatch.
            </p>
          </div>
        ) : null}

        {updatePref.isError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            Failed to save preference — please try again.
          </div>
        ) : null}

        <section aria-label="Notification preferences" className="mt-6">
          {categories.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <p className="text-sm text-on-surface-variant">
                No notification types configured yet.
              </p>
            </div>
          ) : (
            <CCNotificationPreferenceMatrix
              categories={categories}
              overrides={overrides}
              quietHours={quietHours}
              onTogglePreference={handleToggle}
              onSetQuietHours={handleSetQuietHours}
              onResetToDefaults={handleResetToDefaults}
              emailDisabled
            />
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
          <Link
            to="/notifications/digest"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Preview your next digest
          </Link>
          <span aria-hidden>·</span>
          <Link
            to="/approvals/inbox"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <History className="inline h-3 w-3" aria-hidden />
            Back to Approval inbox
          </Link>
        </footer>
      </div>
    </div>
  )
}
