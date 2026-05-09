import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Inbox,
  Minus,
  Plus,
  ShieldOff,
  Sparkles,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { isStatusPipToken, tokens } from '@/tokens'

import { AuditLink } from './AuditLink'
import { Button } from './Button'
import { StatusPill, type StatusToken } from './StatusPill'
import { TrnDisplay } from './TrnDisplay'

/**
 * CCActivityTimeline — chronological per-entity activity timeline.
 *
 * SI-INF-006 pattern reference (`_planning/05-screen-inventory.md` lines
 * 1260–1303). Realises FR21 (per-entity activity timeline showing chronological
 * history). NOT a standalone route — the shell ships in Phase 4 Epic 3 INF
 * Arc (b) and is mounted in Arc (c) Task C7 on `apps/web/src/pages/usr/
 * UserCreateEditPage.tsx` view-mode as the canonical first production consumer
 * (DL-038). Subsequent epics (4–12) embed it on transactional entity-detail
 * surfaces (PO detail, GR detail, Production Order detail, Challan detail,
 * Journal detail, etc.) using the same prop contract.
 *
 * Cross-cutting affordances:
 *   - CC-AUDIT-LINK — header-strip "View full history" chip drills to
 *     SI-INF-005 filtered to the current entity reference (uses `<AuditLink>`
 *     for visual consistency).
 *   - CC-TRN-DISPLAY — events that carry a TRN reference render `<TrnDisplay>`
 *     inline so financially significant status changes (PO confirmed, GR
 *     completed, etc.) carry the canonical TRN affordance per inventory
 *     line 1288.
 *
 * Visual contract:
 *   - Vertical list of event rows. Each row carries a thin status-token pip on
 *     the LEFT (allow-listed `border-l-2` / `border-l-4` per CLAUDE.md token
 *     enforcement; this is the §6.1 status-pip pattern, not a sectioning
 *     border).
 *   - `status-change` events show "from → to" via two `<StatusPill>`s inline
 *     in the body row.
 *   - Optional inline before/after diff (for `update` events) is collapsed
 *     by default with a "Show diff" toggle so the timeline stays scannable.
 *   - Newest first ordering (standard activity-timeline convention; spec
 *     wording in inventory line 1274 ambiguous — "oldest at bottom or top per
 *     persona" — newest-first is the chosen default and is consistent with
 *     SI-INF-005 Audit Trail Viewer).
 *   - Embedded mode shows a collapse/expand affordance; standalone mode is
 *     always expanded.
 *
 * Borders: only `border-l-2` and `border-l-4` (allow-listed status pips) and
 * `focus-visible:` rings on interactive elements. No sectioning borders.
 *
 * Animation: NONE per CLAUDE.md (entrance animations on data lists banned).
 * Tailwind hover/focus colour transitions only.
 *
 * Status-token mapping for the per-row left pip (canonical 20 only;
 * verified against `mockups/src/tokens.ts`):
 *   - create / update / prefill-applied   → neutral (surface_container_low)
 *   - status-change                       → row's `statusTo` token if present
 *   - override                            → status_overridden
 *   - reverse                             → status_returned
 *   - cancel                              → status_cancelled
 *   - delete-blocked                      → semantic `error` (FR20 — DELETE
 *                                            blocked at DB; warning palette
 *                                            per inventory line 1244)
 *   - approve                             → status_confirmed
 *   - reject                              → status_rejected
 *   - delegate                            → status_pending_approval
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timeline action types. Kebab-case literals (not snake_case) to align with
 * SI-INF-005 `AuditAction` and to avoid pre-commit rule-5 false-positives —
 * the rule treats any `status_<name>` token as a design-token reference and
 * flags invented names (the snake-case form would collide). Kebab-case keeps the
 * action namespace cleanly separated from the canonical 20 status_* tokens.
 */
export type TimelineActionType =
  | 'create'
  | 'update'
  | 'status-change'
  | 'override'
  | 'reverse'
  | 'cancel'
  | 'delete-blocked'
  | 'approve'
  | 'reject'
  | 'delegate'
  | 'prefill-applied'

export interface TimelineDiffField {
  readonly field: string
  readonly fieldLabel: string
  readonly before: string | number | null
  readonly after: string | number | null
}

export interface TimelineEvent {
  /** Stable id (audit_log.id in production). NEVER use array index as React key. */
  readonly id: string
  /** ISO-8601 timestamp. */
  readonly timestamp: string
  readonly actorUserId: string
  readonly actorLabel: string
  /** Optional resolved role display label (e.g., "Brand Owner"). */
  readonly actorRoleLabel?: string
  readonly action: TimelineActionType
  /** Human-readable change description. */
  readonly description: string
  /** Optional inline diff for `update` events. */
  readonly diff?: ReadonlyArray<TimelineDiffField>
  /** Canonical status_* token name WITHOUT the `status_` prefix (e.g., 'draft'). */
  readonly statusFrom?: string
  readonly statusTo?: string
  /** Optional reason code (override / delegate / cancel / reverse always carry one). */
  readonly reasonCode?: string
  /** TRN reference chip — set on status-change events for financially significant entities. */
  readonly trnReference?: string
}

export interface CCActivityTimelineProps {
  /** Entity-type slug — used in screen-reader label and "View full history". */
  readonly entityType: string
  /** Entity primary id or business reference (e.g., "PO-2026-001"). */
  readonly entityRef: string
  /** Current canonical status_* token name without prefix (e.g., 'in_progress'). */
  readonly entityCurrentStatus?: string
  readonly events: ReadonlyArray<TimelineEvent>
  /** Initial collapse state when `mode='embedded'`. Default `false`. */
  readonly defaultCollapsed?: boolean
  /** Filter chip values. Empty/undefined = no filter applied. */
  readonly actionFilter?: ReadonlyArray<TimelineActionType>
  readonly onActionFilterChange?: (next: ReadonlyArray<TimelineActionType>) => void
  /** Drill-through to SI-INF-005 filtered to this entity. */
  readonly onViewFullHistory: () => void
  /** Drill-through to SI-INF-005 filtered to a specific event. */
  readonly onOpenEvent?: (eventId: string) => void
  /** Render mode — embedded on a detail screen vs. standalone surface. */
  readonly mode: 'embedded' | 'standalone'
  /** Optional human-readable entity-type label (e.g., "Purchase Order"). */
  readonly entityTypeLabel?: string
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Action-type metadata
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<TimelineActionType, string> = {
  create: 'Created',
  update: 'Updated',
  'status-change': 'Status changed',
  override: 'Override applied',
  reverse: 'Reversed',
  cancel: 'Cancelled',
  'delete-blocked': 'Delete blocked',
  approve: 'Approved',
  reject: 'Rejected',
  delegate: 'Delegated',
  'prefill-applied': 'Prefill applied',
}

/** Pip-token resolution for the row-left pip (canonical 20 only). */
function pipTokenFor(event: TimelineEvent): StatusToken | null {
  switch (event.action) {
    case 'override':
      return 'status_overridden'
    case 'reverse':
      return 'status_returned'
    case 'cancel':
      return 'status_cancelled'
    case 'approve':
      return 'status_confirmed'
    case 'reject':
      return 'status_rejected'
    case 'delegate':
      return 'status_pending_approval'
    case 'status-change':
      if (event.statusTo) {
        const candidate = `status_${event.statusTo}` as StatusToken
        // Defensive: only return if the token actually exists in canonical 20.
        return candidate in tokens ? candidate : null
      }
      return null
    case 'create':
    case 'update':
    case 'prefill-applied':
    case 'delete-blocked':
    default:
      return null
  }
}

/** Resolve the hex colour for the row-left pip. Falls back to outline_variant. */
function pipColourFor(event: TimelineEvent): string {
  if (event.action === 'delete-blocked') return tokens.error
  const tokenKey = pipTokenFor(event)
  if (!tokenKey) return tokens.outline_variant
  const t = tokens[tokenKey]
  return isStatusPipToken(t) ? t.pip : t.bg
}

// ─────────────────────────────────────────────────────────────────────────────
// Time formatting — relative ("3 hours ago") with absolute tooltip.
// ─────────────────────────────────────────────────────────────────────────────

function formatRelative(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.max(0, Math.round((nowMs - then) / 1000))
  if (deltaSec < 60) return `${deltaSec}s ago`
  const deltaMin = Math.round(deltaSec / 60)
  if (deltaMin < 60) return `${deltaMin}m ago`
  const deltaHr = Math.round(deltaMin / 60)
  if (deltaHr < 24) return `${deltaHr}h ago`
  const deltaDay = Math.round(deltaHr / 24)
  if (deltaDay < 30) return `${deltaDay}d ago`
  const deltaMonth = Math.round(deltaDay / 30)
  if (deltaMonth < 12) return `${deltaMonth}mo ago`
  const deltaYear = Math.round(deltaDay / 365)
  return `${deltaYear}y ago`
}

function formatAbsolute(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionFilterChips({
  available,
  selected,
  onChange,
}: {
  available: ReadonlyArray<TimelineActionType>
  selected: ReadonlyArray<TimelineActionType>
  onChange: (next: ReadonlyArray<TimelineActionType>) => void
}) {
  const isSelected = (a: TimelineActionType) => selected.includes(a)
  const toggle = (a: TimelineActionType) => {
    if (isSelected(a)) {
      onChange(selected.filter((s) => s !== a))
    } else {
      onChange([...selected, a])
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        <Filter className="h-3 w-3" aria-hidden /> Filter
      </span>
      {available.map((a) => {
        const active = isSelected(a)
        return (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            {ACTION_LABEL[a]}
          </button>
        )
      })}
      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium',
            'text-on-surface-variant hover:text-on-surface',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

function DiffTable({ diff }: { diff: ReadonlyArray<TimelineDiffField> }) {
  return (
    <div className="mt-2 rounded-sm bg-surface-container-lowest p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
        <div className="font-medium uppercase tracking-wider text-on-surface-variant">
          Field
        </div>
        <div className="font-medium uppercase tracking-wider text-on-surface-variant">
          Before
        </div>
        <div className="font-medium uppercase tracking-wider text-on-surface-variant">
          After
        </div>
        {diff.map((d) => (
          <div key={d.field} className="contents">
            <div className="text-on-surface-variant">{d.fieldLabel}</div>
            <div className="font-mono text-on-surface-variant">
              {d.before === null ? <span className="opacity-50">—</span> : String(d.before)}
            </div>
            <div className="font-mono text-on-surface">
              {d.after === null ? <span className="opacity-50">—</span> : String(d.after)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineRow({
  event,
  nowMs,
  onOpenEvent,
}: {
  event: TimelineEvent
  nowMs: number
  onOpenEvent?: (eventId: string) => void
}) {
  const [diffOpen, setDiffOpen] = useState(false)
  const pipColour = pipColourFor(event)
  const showStatusTransition =
    event.action === 'status-change' && (event.statusFrom || event.statusTo)
  const fromToken =
    event.statusFrom && (`status_${event.statusFrom}` in tokens)
      ? (`status_${event.statusFrom}` as StatusToken)
      : null
  const toToken =
    event.statusTo && (`status_${event.statusTo}` in tokens)
      ? (`status_${event.statusTo}` as StatusToken)
      : null
  const hasDiff = event.diff && event.diff.length > 0

  return (
    <li
      className={cn(
        'rounded-sm bg-surface-container-lowest pl-3 pr-3 py-2.5 border-l-4',
      )}
      style={{ borderLeftColor: pipColour }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-on-surface">{event.actorLabel}</span>
        {event.actorRoleLabel ? (
          <span className="rounded-pill bg-surface-container px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
            {event.actorRoleLabel}
          </span>
        ) : null}
        <span className="text-xs text-on-surface-variant">{ACTION_LABEL[event.action]}</span>
        <span className="ml-auto text-[11px] text-on-surface-variant" title={formatAbsolute(event.timestamp)}>
          {formatRelative(event.timestamp, nowMs)}
        </span>
      </div>

      <p className="mt-1 text-sm text-on-surface">{event.description}</p>

      {showStatusTransition ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {fromToken ? <StatusPill status={fromToken} size="sm" /> : null}
          {fromToken && toToken ? (
            <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          ) : null}
          {toToken ? <StatusPill status={toToken} size="sm" /> : null}
          {event.trnReference ? (
            <span className="ml-1">
              <TrnDisplay trn={event.trnReference} />
            </span>
          ) : null}
        </div>
      ) : null}

      {event.action === 'delete-blocked' ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-on-error-container">
          <ShieldOff className="h-3 w-3" aria-hidden /> DB blocked the delete (FR20)
        </div>
      ) : null}

      {event.action === 'prefill-applied' ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
          <Sparkles className="h-3 w-3" aria-hidden /> Form value derived from prefill (FR113)
        </div>
      ) : null}

      {event.reasonCode ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 font-mono text-[11px] text-on-surface-variant">
          Reason: {event.reasonCode}
        </div>
      ) : null}

      {hasDiff ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setDiffOpen((v) => !v)}
            aria-expanded={diffOpen}
            className={cn(
              'inline-flex items-center gap-1 rounded-pill bg-surface-container-low px-2 py-0.5 text-[11px] font-medium text-on-surface-variant',
              'hover:bg-surface-container-high hover:text-on-surface transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            {diffOpen ? (
              <Minus className="h-3 w-3" aria-hidden />
            ) : (
              <Plus className="h-3 w-3" aria-hidden />
            )}
            {diffOpen ? 'Hide diff' : `Show diff (${event.diff!.length})`}
          </button>
          {diffOpen ? <DiffTable diff={event.diff!} /> : null}
        </div>
      ) : null}

      {onOpenEvent ? (
        <div className="mt-1.5">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-[11px]"
            onClick={() => onOpenEvent(event.id)}
          >
            Open event
          </Button>
        </div>
      ) : null}
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CCActivityTimeline({
  entityType,
  entityRef,
  entityCurrentStatus,
  events,
  defaultCollapsed = false,
  actionFilter,
  onActionFilterChange,
  onViewFullHistory,
  onOpenEvent,
  mode,
  entityTypeLabel,
  className,
}: CCActivityTimelineProps) {
  const [collapsed, setCollapsed] = useState(mode === 'embedded' && defaultCollapsed)
  const [internalFilter, setInternalFilter] = useState<ReadonlyArray<TimelineActionType>>([])

  // Caller-controlled filter takes precedence; otherwise fall back to internal.
  const activeFilter = actionFilter ?? internalFilter
  const handleFilterChange = (next: ReadonlyArray<TimelineActionType>) => {
    if (onActionFilterChange) onActionFilterChange(next)
    else setInternalFilter(next)
  }

  // Newest-first ordering. We compute once per render — typical timeline sizes
  // are small (tens of events on a per-entity surface).
  const sorted = useMemo(() => {
    const copy = [...events]
    copy.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      return tb - ta
    })
    return copy
  }, [events])

  const filtered = useMemo(() => {
    if (activeFilter.length === 0) return sorted
    return sorted.filter((e) => activeFilter.includes(e.action))
  }, [sorted, activeFilter])

  const distinctActions = useMemo(() => {
    const seen = new Set<TimelineActionType>()
    for (const e of events) seen.add(e.action)
    return Array.from(seen)
  }, [events])

  const currentStatusToken: StatusToken | null = useMemo(() => {
    if (!entityCurrentStatus) return null
    const candidate = `status_${entityCurrentStatus}` as StatusToken
    return candidate in tokens ? candidate : null
  }, [entityCurrentStatus])

  // Stable "now" timestamp captured at first render. We deliberately avoid a
  // ticking clock; "3h ago" → "4h ago" jumping mid-view adds noise without
  // signal. If the host page wants live-updating timestamps it can re-mount.
  const [nowMs] = useState(() => Date.now())

  const heading = entityTypeLabel ?? entityType
  const isEmpty = sorted.length === 0
  const isFilteredEmpty = !isEmpty && filtered.length === 0

  return (
    <section
      data-slot="cc-activity-timeline"
      aria-label={`Activity timeline for ${heading} ${entityRef}`}
      className={cn(
        'rounded-md bg-surface-container-low p-3',
        className,
      )}
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {mode === 'embedded' ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm p-1 text-on-surface-variant',
              'hover:bg-surface-container-high hover:text-on-surface transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {heading}
          </span>
          <span className="font-mono text-xs text-on-surface">{entityRef}</span>
          {currentStatusToken ? (
            <StatusPill status={currentStatusToken} size="sm" />
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant">
            {sorted.length} event{sorted.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onViewFullHistory}
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View full audit history for ${entityRef}`}
          >
            <AuditLink entityRef={entityRef} label="Full history" compact />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          {/* Filter strip — only when >1 distinct action types in events. */}
          {distinctActions.length > 1 ? (
            <div className="mt-2">
              <ActionFilterChips
                available={distinctActions}
                selected={activeFilter}
                onChange={handleFilterChange}
              />
            </div>
          ) : null}

          {/* Event list */}
          {isEmpty ? (
            <div className="mt-3 rounded-sm bg-surface-container-lowest p-6 text-center">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-on-surface-variant" aria-hidden />
              <p className="text-sm text-on-surface-variant">
                No activity yet for this {heading.toLowerCase()}.
              </p>
            </div>
          ) : isFilteredEmpty ? (
            <div className="mt-3 rounded-sm bg-surface-container-lowest p-6 text-center">
              <Filter className="mx-auto mb-2 h-6 w-6 text-on-surface-variant" aria-hidden />
              <p className="text-sm text-on-surface-variant">
                No events match the active filter.
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-[11px]"
                onClick={() => handleFilterChange([])}
              >
                Clear filter
              </Button>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {filtered.map((e) => (
                <TimelineRow
                  key={e.id}
                  event={e}
                  nowMs={nowMs}
                  onOpenEvent={onOpenEvent}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}

    </section>
  )
}
