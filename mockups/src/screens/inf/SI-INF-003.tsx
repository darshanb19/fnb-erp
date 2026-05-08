import { useState } from 'react'
import { Link } from 'react-router-dom'
import { History, Save } from 'lucide-react'

import {
  Button,
  CCNotificationPreferenceMatrix,
  SectionShift,
  type NotificationCategory,
  type NotificationPreferenceOverride,
  type PreferenceChannel,
  type QuietHoursWindow,
} from '@/shell'
import { personas } from '@/lib/personas'

/**
 * SI-INF-003 — Notification Preferences.
 *
 * Tier 2 Phase 4 Epic 3 INF mockup. Per-user surface — every role lands
 * here at onboarding to tune in-app / email / digest delivery + quiet
 * hours. FR18 (configurable channels) + FR19 (digest batching) drive the
 * service-layer behaviour; this screen surfaces the user-facing knobs.
 *
 * Persona context — current user is the Brand Owner (Aanya Khanna). The
 * production page (Arc (c)) reads `useSession()` to drive the same
 * framing; this mockup hard-codes to the BO persona to keep the framing
 * consistent across the persona switcher.
 *
 * Email channel is rendered greyed throughout per DL-035 — every email
 * toggle carries the "Email channel coming when sending domain
 * registered" tooltip. The matrix shell handles the affordance; this
 * screen just passes `emailDisabled` through.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — preference changes are audit-logged. Footer links
 *     to SI-INF-005 filtered to entity-type `notification_preference`.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface, surface_container_lowest,
 * surface_container_low, on_surface, on_surface_variant, status_confirmed,
 * primary, outline_variant.
 *
 * Animation: NONE per CLAUDE.md — admin form. Tailwind transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — canonical 13 notification types from migration 0011.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Categories sourced verbatim from
 * `apps/api/src/db/migrations/0011_seed_notification_type_config.sql`.
 * Seven of the thirteen are designated digest-eligible — the routine ops
 * signals that batch well. The other six are immediate-only because
 * they're either one-shot (account / role / export) or directly
 * actionable (assigned ticket, escalated approval).
 */
const CATEGORIES: ReadonlyArray<NotificationCategory> = [
  {
    type: 'approval.requested',
    label: 'Approval requests',
    description: 'New approval request routed to you.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'approval.decided',
    label: 'Approval decisions',
    description: 'Decision made on your approval request.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'approval.delegated',
    label: 'Approval delegated to you',
    description: 'An approval was delegated to you by another approver.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'approval.escalated',
    label: 'Approval escalated',
    description: 'An approval timed out and escalated to you.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'issue.assigned',
    label: 'Issue tickets assigned',
    description: 'A ticket was assigned to you.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'issue.commented',
    label: 'Issue ticket comments',
    description: 'New comment on a ticket you follow.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'issue.status_changed',
    label: 'Issue ticket status changes',
    description: 'Status changed on a ticket you follow.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'broadcast.received',
    label: 'Broadcast announcements',
    description: 'New brand-wide broadcast.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'user.created',
    label: 'New user added',
    description: 'A new user was added to your scope.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'user.role_changed',
    label: 'Your role or scope changed',
    description: 'Your role or scope was changed.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'permission.override_applied',
    label: 'Permission overrides applied',
    description: 'Permission overrides were applied to your account.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'permission.override_expiring',
    label: 'Permission overrides expiring',
    description: 'A temporary override is about to lapse.',
    digestEligible: true,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
  {
    type: 'audit.export_ready',
    label: 'Audit export ready',
    description: 'Your audit export is ready to download.',
    digestEligible: false,
    defaults: { inApp: true, emailMode: 'none', digestWindow: null },
  },
]

const currentUser = personas.find((p) => p.id === 'brand-owner')!

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf003() {
  const [overrides, setOverrides] = useState<
    ReadonlyArray<NotificationPreferenceOverride>
  >([])
  const [quietHours, setQuietHours] = useState<QuietHoursWindow>({
    startTime: null,
    endTime: null,
  })
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const handleToggle = (
    type: string,
    channel: PreferenceChannel,
    value: boolean,
  ) => {
    setOverrides((prev) => {
      const existing = prev.find((o) => o.type === type) ?? {
        type,
        inAppOverride: null as boolean | null,
        emailOverride: null as boolean | null,
        digestBatchOverride: null as boolean | null,
      }
      const next: NotificationPreferenceOverride = {
        type: existing.type,
        inAppOverride:
          channel === 'inApp' ? value : existing.inAppOverride,
        emailOverride:
          channel === 'email' ? value : existing.emailOverride,
        digestBatchOverride:
          channel === 'digestBatch' ? value : existing.digestBatchOverride,
      }
      const without = prev.filter((o) => o.type !== type)
      return [...without, next]
    })
    setSavedAt(null)
  }

  const handleSetQuietHours = (window: QuietHoursWindow) => {
    setQuietHours(window)
    setSavedAt(null)
  }

  const handleResetToDefaults = () => {
    setOverrides([])
    setSavedAt(null)
  }

  const handleSave = () => {
    // Visual only — surface a saved-just-now banner. Production page in
    // Arc (c) calls notificationPreferenceService.savePreferences.
    setSavedAt(new Date().toISOString())
  }

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
              Tune which notification categories deliver in-app, which deliver
              via email, and which batch into a digest. Each user manages
              their own preferences; defaults seed from your role at onboarding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-on-surface-variant">
              Editing as{' '}
              <span className="font-medium text-on-surface">
                {currentUser.name}
              </span>{' '}
              · {currentUser.role}
            </span>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" aria-hidden />
              Save preferences
            </Button>
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR18 (configurable channels) + FR19 (digest batching). Mutations
          write to the audit trail per FR20. Email channel rests in MVP per
          DL-035 — re-enables one row at a time once a sending domain is
          provisioned.
        </p>

        {savedAt ? (
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

        <section aria-label="Notification preferences" className="mt-6">
          <CCNotificationPreferenceMatrix
            categories={CATEGORIES}
            overrides={overrides}
            quietHours={quietHours}
            onTogglePreference={handleToggle}
            onSetQuietHours={handleSetQuietHours}
            onResetToDefaults={handleResetToDefaults}
            emailDisabled
          />
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/SI-INF-005?entity=notification_preference"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Preference change history (SI-INF-005)
          </Link>
          {' · '}
          <Link to="/SI-INF-004" className="text-primary hover:underline">
            Preview your next digest (SI-INF-004)
          </Link>
          {' · '}
          SI-INF-003 · Tier 2 · Phase 4 Epic 3 INF
        </footer>
      </div>
    </div>
  )
}
