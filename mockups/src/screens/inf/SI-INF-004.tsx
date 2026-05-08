import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock,
  History,
  Inbox,
  Send,
  Sparkles,
} from 'lucide-react'

import { Button, SectionShift } from '@/shell'
import { personas } from '@/lib/personas'

/**
 * SI-INF-004 — Notification Digest Preview.
 *
 * Tier 2 Phase 4 Epic 3 INF mockup. Shows the user the next pending
 * digest as it will arrive (in-app per DL-035 — header reads "Digest
 * preview (in-app)"). FR19 (batch non-urgent notifications + escalate
 * unacknowledged per timeout) drives the underlying behaviour; this
 * screen surfaces the resulting state.
 *
 * Layout reuses the SI-INF-001 inbox row shape: a compact list of items
 * grouped by category with an entity-ref + age + drill chevron. A
 * separate escalation pane surfaces items overdue beyond per-category
 * timeout (FR19) so the eye separates "batched" from "needs-attention-now".
 *
 * Two modes via tab toggle:
 *   - Next digest        — items currently batched, not yet delivered
 *   - Previous digests   — read-only history (last delivered + n-1)
 *
 * Persona context — Brand Owner (Aanya Khanna). Production page reads
 * `useSession()`.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — digest delivery + escalation events recorded.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface, surface_container_lowest,
 * surface_container_low, on_surface, on_surface_variant,
 * status_pending_approval (batched), warning / error tones via §6.1
 * pip-pattern for escalations, primary, outline_variant.
 *
 * Animation: NONE — list view per CLAUDE.md. Tailwind transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & fixtures
// ─────────────────────────────────────────────────────────────────────────────

interface DigestItem {
  readonly id: string
  readonly category: string
  readonly categoryLabel: string
  readonly title: string
  readonly entityRef: string
  readonly entityRoute: string
  readonly batchedAt: string
}

interface EscalationItem {
  readonly id: string
  readonly category: string
  readonly categoryLabel: string
  readonly title: string
  readonly entityRef: string
  readonly entityRoute: string
  readonly overdueByHours: number
  readonly escalationTarget: string
  readonly triggerReason: string
}

interface DigestSnapshot {
  readonly id: string
  readonly scheduledAt: string
  readonly deliveredAt?: string
  readonly mode: 'next' | 'previous'
  readonly items: ReadonlyArray<DigestItem>
  readonly escalations: ReadonlyArray<EscalationItem>
}

const NOW_ISO = '2026-05-09T16:00:00+05:30'

const NEXT_DIGEST: DigestSnapshot = {
  id: 'digest-next',
  scheduledAt: '2026-05-09T20:00:00+05:30',
  mode: 'next',
  items: [
    {
      id: 'd-1',
      category: 'approval.decided',
      categoryLabel: 'Approval decisions',
      title: 'PO-2026-WST-0418 approved by Cluster Manager',
      entityRef: 'PO-2026-WST-0418',
      entityRoute: '/SI-PUR-003',
      batchedAt: '2026-05-09T09:14:00+05:30',
    },
    {
      id: 'd-2',
      category: 'approval.decided',
      categoryLabel: 'Approval decisions',
      title: 'REC-MGT-V32 default-version change rejected',
      entityRef: 'REC-MGT-V32',
      entityRoute: '/SI-REC-003',
      batchedAt: '2026-05-09T11:02:00+05:30',
    },
    {
      id: 'd-3',
      category: 'broadcast.received',
      categoryLabel: 'Broadcast announcements',
      title: 'Closing inventory window changes from May 12',
      entityRef: 'BR-2026-0084',
      entityRoute: '/SI-INF-009',
      batchedAt: '2026-05-09T07:30:00+05:30',
    },
    {
      id: 'd-4',
      category: 'broadcast.received',
      categoryLabel: 'Broadcast announcements',
      title: 'Q1 menu engineering review uploaded',
      entityRef: 'BR-2026-0085',
      entityRoute: '/SI-INF-009',
      batchedAt: '2026-05-09T08:10:00+05:30',
    },
    {
      id: 'd-5',
      category: 'permission.override_expiring',
      categoryLabel: 'Permission overrides expiring',
      title: '3 temporary overrides expire in the next 48 h',
      entityRef: 'OVR-EXP-0421',
      entityRoute: '/SI-USR-007',
      batchedAt: '2026-05-09T06:00:00+05:30',
    },
    {
      id: 'd-6',
      category: 'issue.commented',
      categoryLabel: 'Issue ticket comments',
      title: 'Cluster Manager replied on TKT-2026-1192',
      entityRef: 'TKT-2026-1192',
      entityRoute: '/SI-INF-007',
      batchedAt: '2026-05-09T12:45:00+05:30',
    },
  ],
  escalations: [
    {
      id: 'e-1',
      category: 'approval.requested',
      categoryLabel: 'Approval requests',
      title: 'Cross-cluster paired transfer PTR-2026-WST-0042',
      entityRef: 'PTR-2026-WST-0042',
      entityRoute: '/SI-INV-007',
      overdueByHours: 26,
      escalationTarget: 'Asha Kapoor (Brand Owner)',
      triggerReason: 'No decision within 24-hour SLA on Step 2.',
    },
    {
      id: 'e-2',
      category: 'issue.assigned',
      categoryLabel: 'Issue tickets assigned',
      title: 'TKT-2026-1184 cold-room thermometer drift',
      entityRef: 'TKT-2026-1184',
      entityRoute: '/SI-INF-007',
      overdueByHours: 7,
      escalationTarget: 'Rohan Mehta (Cluster Manager)',
      triggerReason: 'Acknowledgement not received within 4-hour timeout.',
    },
  ],
}

const PREVIOUS_DIGEST: DigestSnapshot = {
  id: 'digest-prev',
  scheduledAt: '2026-05-08T20:00:00+05:30',
  deliveredAt: '2026-05-08T20:00:00+05:30',
  mode: 'previous',
  items: [
    {
      id: 'p-1',
      category: 'approval.decided',
      categoryLabel: 'Approval decisions',
      title: 'PO-2026-WST-0411 approved by Brand Owner',
      entityRef: 'PO-2026-WST-0411',
      entityRoute: '/SI-PUR-003',
      batchedAt: '2026-05-08T15:30:00+05:30',
    },
    {
      id: 'p-2',
      category: 'broadcast.received',
      categoryLabel: 'Broadcast announcements',
      title: 'Vendor onboarding window — May 9 cutoff',
      entityRef: 'BR-2026-0083',
      entityRoute: '/SI-INF-009',
      batchedAt: '2026-05-08T11:00:00+05:30',
    },
    {
      id: 'p-3',
      category: 'user.created',
      categoryLabel: 'New user added',
      title: 'Karthik Naidu (Dispatch Staff) joined CK Powai',
      entityRef: 'USR-0119',
      entityRoute: '/SI-USR-001',
      batchedAt: '2026-05-08T10:14:00+05:30',
    },
  ],
  escalations: [],
}

const currentUser = personas.find((p) => p.id === 'brand-owner')!

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ageHours(iso: string, nowIso = NOW_ISO): number {
  const then = new Date(iso).getTime()
  const now = new Date(nowIso).getTime()
  return Math.max(0, Math.round((now - then) / 3600000))
}

function ageLabel(iso: string): string {
  const h = ageHours(iso)
  if (h < 1) return 'just now'
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} d ago`
}

function formatScheduledTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

interface CategoryGroup {
  readonly category: string
  readonly categoryLabel: string
  readonly items: ReadonlyArray<DigestItem>
}

function groupByCategory(items: ReadonlyArray<DigestItem>): ReadonlyArray<CategoryGroup> {
  const map = new Map<string, CategoryGroup>()
  items.forEach((it) => {
    const existing = map.get(it.category)
    if (existing) {
      map.set(it.category, {
        ...existing,
        items: [...existing.items, it],
      })
    } else {
      map.set(it.category, {
        category: it.category,
        categoryLabel: it.categoryLabel,
        items: [it],
      })
    }
  })
  return Array.from(map.values())
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'next' | 'previous'

export default function SiInf004() {
  const [mode, setMode] = useState<Mode>('next')

  const snapshot = mode === 'next' ? NEXT_DIGEST : PREVIOUS_DIGEST
  const groups = useMemo(() => groupByCategory(snapshot.items), [snapshot])
  const empty = snapshot.items.length === 0 && snapshot.escalations.length === 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1200px] px-6 py-8 desktop:px-10 desktop:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Notifications
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Digest preview (in-app)
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Preview your next pending digest as it will arrive in the
              notification inbox. Items batch by category; urgent or
              overdue items surface separately as escalations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-on-surface-variant">
              Previewing as{' '}
              <span className="font-medium text-on-surface">
                {currentUser.name}
              </span>{' '}
              · {currentUser.role}
            </span>
            {mode === 'next' ? (
              <Button variant="tonal" size="sm">
                <Send className="h-3.5 w-3.5" aria-hidden />
                Trigger immediate delivery
              </Button>
            ) : null}
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR19 (batch non-urgent + escalate unacknowledged). Header reads
          &ldquo;in-app&rdquo; per DL-035 — email digest activates when a
          sending domain is registered.
        </p>

        {/* Mode tabs ─────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Digest mode"
          className="mt-6 inline-flex gap-1 rounded-pill bg-surface-container-low p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'next'}
            onClick={() => setMode('next')}
            className={
              mode === 'next'
                ? 'rounded-pill bg-primary px-4 py-1.5 text-xs font-medium text-on-primary'
                : 'rounded-pill px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors'
            }
          >
            Next digest
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'previous'}
            onClick={() => setMode('previous')}
            className={
              mode === 'previous'
                ? 'rounded-pill bg-primary px-4 py-1.5 text-xs font-medium text-on-primary'
                : 'rounded-pill px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors'
            }
          >
            Previous digests
          </button>
        </div>

        {/* Header strip ─────────────────────────────────────────────── */}
        <section
          aria-label="Digest summary"
          className="mt-6 flex flex-wrap items-center gap-4 rounded-md bg-surface-container-lowest p-4"
        >
          <div className="flex items-center gap-3">
            <Sparkles
              className="h-5 w-5 text-on-surface-variant"
              aria-hidden
            />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                {mode === 'next' ? 'Scheduled delivery' : 'Delivered at'}
              </p>
              <p className="mt-0.5 text-sm font-medium text-on-surface tabular-nums">
                {formatScheduledTime(
                  mode === 'next'
                    ? snapshot.scheduledAt
                    : (snapshot.deliveredAt ?? snapshot.scheduledAt),
                )}
              </p>
            </div>
          </div>
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Batched items"
            value={snapshot.items.length}
            icon={<Inbox className="h-4 w-4" aria-hidden />}
          />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Categories"
            value={groups.length}
            icon={<Bell className="h-4 w-4" aria-hidden />}
          />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Escalations"
            value={snapshot.escalations.length}
            icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            emphasis={snapshot.escalations.length > 0 ? 'warning' : 'default'}
          />
        </section>

        {/* Empty state ──────────────────────────────────────────────── */}
        {empty ? (
          <div className="mt-6 rounded-md bg-surface-container-lowest p-10 text-center">
            <Inbox
              className="mx-auto h-10 w-10 text-on-surface-variant"
              aria-hidden
            />
            <p className="mt-3 text-base font-semibold text-on-surface">
              {mode === 'next'
                ? 'No items batched for the next digest yet.'
                : 'No previous digests on file.'}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {mode === 'next'
                ? 'Notifications you have configured for digest delivery will accumulate here until the next scheduled window.'
                : 'Your delivery history will populate as digests dispatch.'}
            </p>
          </div>
        ) : (
          <>
            {/* Escalations pane ─────────────────────────────────────── */}
            {snapshot.escalations.length > 0 ? (
              <section
                aria-label="Escalations"
                className="mt-6 overflow-hidden rounded-md bg-surface-container-lowest"
              >
                <header className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className="h-4 w-4 text-tertiary"
                      aria-hidden
                    />
                    <h2 className="text-base font-semibold text-on-surface">
                      Escalations
                    </h2>
                    <span className="text-xs text-on-surface-variant">
                      Items overdue beyond per-category timeout
                    </span>
                  </div>
                </header>
                <SectionShift tone="high" />
                <ul className="flex flex-col">
                  {snapshot.escalations.map((esc) => (
                    <li
                      key={esc.id}
                      className="flex items-stretch hover:bg-surface-container-low transition-colors"
                    >
                      <span
                        aria-hidden
                        className={
                          esc.overdueByHours >= 24
                            ? 'w-1 shrink-0 bg-error'
                            : 'w-1 shrink-0 bg-tertiary'
                        }
                      />
                      <Link
                        to={esc.entityRoute}
                        className="flex flex-1 flex-wrap items-start justify-between gap-3 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                              {esc.categoryLabel}
                            </span>
                            <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface">
                              {esc.entityRef}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-on-surface">
                            {esc.title}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Overdue by{' '}
                            <span className="tabular-nums font-medium">
                              {esc.overdueByHours} h
                            </span>{' '}
                            · escalated to{' '}
                            <span className="font-medium text-on-surface">
                              {esc.escalationTarget}
                            </span>
                            . {esc.triggerReason}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {mode === 'next' ? (
                            <Button
                              variant="tonal"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                              }}
                            >
                              Acknowledge
                            </Button>
                          ) : null}
                          <ChevronRight
                            className="h-4 w-4 text-on-surface-variant"
                            aria-hidden
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Per-category groups ─────────────────────────────────── */}
            <section aria-label="Batched items" className="mt-6 flex flex-col gap-4">
              {groups.map((group) => (
                <div
                  key={group.category}
                  className="overflow-hidden rounded-md bg-surface-container-lowest"
                >
                  <header className="flex items-center justify-between gap-3 px-4 py-3">
                    <h3 className="text-sm font-semibold text-on-surface">
                      {group.categoryLabel}
                    </h3>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant tabular-nums">
                      {group.items.length}{' '}
                      {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </header>
                  <SectionShift tone="high" />
                  <ul className="flex flex-col">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <Link
                          to={item.entityRoute}
                          className="flex flex-wrap items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-on-surface">
                                {item.title}
                              </span>
                              <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface">
                                {item.entityRef}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
                              <Clock className="h-3 w-3" aria-hidden />
                              Batched {ageLabel(item.batchedAt)}
                            </p>
                          </div>
                          <ChevronRight
                            className="h-4 w-4 text-on-surface-variant"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/SI-INF-003"
            className="text-primary hover:underline"
          >
            Tune notification preferences (SI-INF-003)
          </Link>
          {' · '}
          <Link
            to="/SI-INF-005?entity=notification_dispatch"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Dispatch history (SI-INF-005)
          </Link>
          {' · '}
          SI-INF-004 · Tier 2 · Phase 4 Epic 3 INF
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CounterCell — local copy of the SI-INF-001 / SI-INF-002 pattern.
// ─────────────────────────────────────────────────────────────────────────────

interface CounterCellProps {
  readonly label: string
  readonly value: number
  readonly icon?: React.ReactNode
  readonly emphasis?: 'default' | 'warning' | 'error'
}

function CounterCell({ label, value, icon, emphasis = 'default' }: CounterCellProps) {
  const emphasisClass =
    emphasis === 'error'
      ? 'text-error'
      : emphasis === 'warning'
        ? 'text-tertiary'
        : 'text-on-surface'
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {icon ? <span className="text-on-surface-variant">{icon}</span> : null}
      <div className="flex items-baseline gap-2">
        <span
          className={['text-2xl font-semibold tabular-nums', emphasisClass].join(' ')}
        >
          {value.toLocaleString('en-IN')}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
      </div>
    </div>
  )
}
