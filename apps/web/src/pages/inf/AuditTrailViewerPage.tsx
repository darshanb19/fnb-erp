/**
 * AuditTrailViewerPage — SI-INF-005 Audit Trail Viewer (Tier 1 hero).
 *
 * Phase 4 Epic 3 INF Arc (c), Task C6.
 *
 * FR20 (append-only audit trail with before/after snapshots) + FR24 (export
 * audit-trail data). The destination screen for every CC-AUDIT-LINK chip
 * dropped on entity-detail surfaces across Epics 1–12.
 *
 * Accepts ?entityType= and ?entityRef= query-string params so AuditLink chips
 * drill into a pre-filtered view.
 *
 * RBAC: gated by inf.audit.read (service-side enforces scope — BO sees all,
 * CM cluster-only, FM brand-only). A scope chip in the header indicates the
 * current user's effective scope.
 *
 * Token discipline:
 *   - Zero hex literals — all colour from DESIGN.md token classes.
 *   - Lucide icons only.
 *   - No banned border classes (border-l-4 is the status-pip allow-list).
 *   - Inter font inherited (no inline font-family).
 *   - No entrance animations (audit table — CLAUDE.md animation policy bans
 *     these on data tables).
 */

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Filter,
  History,
  Loader2,
  Search,
  X,
} from 'lucide-react'

import {
  Button,
  ExportTrigger,
  Input,
  SectionShift,
  type ExportFormat,
} from '@/components/shell'
import {
  useAuditEvents,
  useAuditExportStatus,
  useEnqueueAuditExport,
  type AuditEventsFilter,
  type AuditLogRow,
} from '@/hooks/useAudit'
import { useUsers } from '@/hooks/useUsers'
import { useSession } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Entity type label map
// Covers the known table names from apps/api/src/db/schema/index.ts
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABELS: Record<string, string> = {
  users: 'Users',
  products: 'Products',
  vendors: 'Vendors',
  categories: 'Categories',
  departments: 'Departments',
  clusters: 'Clusters',
  locations: 'Locations',
  enablements: 'Enablement Matrix',
  company: 'Company',
  approval_chains: 'Approval Chains',
  approval_requests: 'Approval Requests',
  issue_tickets: 'Issue Tickets',
  broadcast_announcements: 'Broadcast Announcements',
  notification_preferences: 'Notification Preferences',
  user_permission_overrides: 'Permission Overrides',
  audit_log: 'Audit Log',
}

const KNOWN_ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS)

function humanizeEntityType(tableName: string): string {
  return ENTITY_TYPE_LABELS[tableName] ?? tableName
}

// ---------------------------------------------------------------------------
// Role → audit scope label
// ---------------------------------------------------------------------------

const ROLE_SCOPE_LABEL: Record<string, string> = {
  brand_owner: 'All brand data',
  superadmin: 'System-wide',
  cluster_manager: 'Cluster scope',
  kitchen_manager: 'Location scope',
  store_manager: 'Location scope',
  procurement_manager: 'Brand scope',
  finance_manager: 'Brand scope',
  dispatch_staff: 'Location scope',
  pos_staff: 'Location scope',
}

// ---------------------------------------------------------------------------
// AuditEventDiffPanel — inline component for before/after JSON diff
// ---------------------------------------------------------------------------

function AuditEventDiffPanel({ event }: { event: AuditLogRow }) {
  const before = event.before
  const after = event.after
  const changedFields = event.changedFields

  const changedFieldsList = useMemo(() => {
    if (!changedFields) return []
    if (Array.isArray(changedFields)) return changedFields as string[]
    if (typeof changedFields === 'string') {
      try {
        const parsed = JSON.parse(changedFields)
        return Array.isArray(parsed) ? (parsed as string[]) : []
      } catch {
        return [changedFields]
      }
    }
    return []
  }, [changedFields])

  if (!before && !after) {
    return (
      <div className="px-4 py-3">
        <p className="text-sm text-on-surface-variant italic">
          No before/after snapshot recorded for this event.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {changedFieldsList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">
            Changed fields:
          </span>
          {changedFieldsList.map((f) => (
            <span
              key={f}
              className="rounded-sm bg-primary-container px-1.5 py-0.5 text-[11px] font-medium text-on-primary-container"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {before !== undefined && before !== null && (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Before
            </p>
            <pre className="overflow-auto rounded-sm bg-surface-container-lowest p-3 text-[11px] text-on-surface leading-relaxed max-h-64">
              {JSON.stringify(before, null, 2)}
            </pre>
          </div>
        )}
        {after !== undefined && after !== null && (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              After
            </p>
            <pre className="overflow-auto rounded-sm bg-surface-container-lowest p-3 text-[11px] text-on-surface leading-relaxed max-h-64">
              {JSON.stringify(after, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AuditEventRow — single row in the list
// ---------------------------------------------------------------------------

interface AuditEventRowProps {
  event: AuditLogRow
  actorName: string | undefined
  selected: boolean
  onSelect: () => void
}

function AuditEventRow({
  event,
  actorName,
  selected,
  onSelect,
}: AuditEventRowProps) {
  const localTime = useMemo(() => {
    try {
      return new Date(event.occurredAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return event.occurredAt
    }
  }, [event.occurredAt])

  const actionBadgeClass = useMemo(() => {
    switch (event.action) {
      case 'create':
        return 'bg-status_draft text-on-surface'
      case 'update':
        return 'bg-status_in_progress text-on-surface'
      case 'delete':
        return 'bg-status_cancelled text-on-surface'
      case 'approve':
        return 'bg-status_completed text-on-surface'
      case 'reject':
        return 'bg-status_rejected text-on-surface'
      case 'override':
        return 'bg-status_overridden text-on-surface'
      case 'business_action':
        return 'bg-status_confirmed text-on-surface'
      default:
        return 'bg-surface-container text-on-surface-variant'
    }
  }, [event.action])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={[
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'bg-primary-container'
          : 'hover:bg-surface-container-low',
      ].join(' ')}
    >
      {/* Action badge */}
      <span
        className={[
          'mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
          actionBadgeClass,
        ].join(' ')}
      >
        {event.action}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-on-surface truncate">
            {humanizeEntityType(event.tableName)}
          </span>
          <span className="font-mono text-[11px] text-on-surface-variant">
            {event.rowId}
          </span>
          {event.trnReference && (
            <span className="rounded-sm bg-surface-container px-1 py-0.5 font-mono text-[10px] text-on-surface-variant">
              {event.trnReference}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
          <span>{localTime}</span>
          <span aria-hidden>·</span>
          <span>{actorName ?? (event.actorUserId ? event.actorUserId : 'System')}</span>
          {event.reason && (
            <>
              <span aria-hidden>·</span>
              <span className="italic truncate max-w-xs">{event.reason}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight
        className={[
          'h-4 w-4 shrink-0 mt-0.5 text-on-surface-variant transition-transform',
          selected ? 'rotate-90' : '',
        ].join(' ')}
        aria-hidden
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function AuditTrailViewerPage() {
  const { session } = useSession()
  const [searchParams] = useSearchParams()

  // Initialise from query-string params
  const qsEntityType = searchParams.get('entityType') ?? ''
  const qsEntityRef = searchParams.get('entityRef') ?? ''

  // Filter state
  const [entityType, setEntityType] = useState(qsEntityType)
  const [entityRef, setEntityRef] = useState(qsEntityRef)
  const [actorUserId, setActorUserId] = useState('')
  const [action, setAction] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('') // client-side rowId/trnReference filter

  // Pagination cursor
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  // Selected event for diff panel
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  // PDF export job tracking
  const [pdfJobId, setPdfJobId] = useState<string | undefined>(undefined)

  // Build query filters
  const filters = useMemo<AuditEventsFilter>(() => {
    const f: AuditEventsFilter = {}
    if (entityType) f.entityType = entityType
    if (entityRef) f.entityRef = entityRef
    if (actorUserId) f.actorUserId = actorUserId
    if (action) f.action = action
    if (startDate) f.startDate = startDate
    if (endDate) f.endDate = endDate
    if (cursor) f.cursor = cursor
    return f
  }, [entityType, entityRef, actorUserId, action, startDate, endDate, cursor])

  const { data, isLoading, isError, error } = useAuditEvents(filters)
  const { data: usersData } = useUsers()
  const enqueueExport = useEnqueueAuditExport()
  const { data: exportJobStatus } = useAuditExportStatus(pdfJobId)

  // Actor name lookup map
  const actorNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of usersData ?? []) {
      map.set(u.id, u.fullName)
    }
    return map
  }, [usersData])

  // Client-side search filter (rowId / trnReference substring)
  const displayedItems = useMemo(() => {
    const items = data?.items ?? []
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(
      (e) =>
        e.rowId.toLowerCase().includes(q) ||
        (e.trnReference ?? '').toLowerCase().includes(q),
    )
  }, [data, search])

  const selectedEvent = useMemo(
    () => displayedItems.find((e) => e.id === selectedEventId) ?? null,
    [displayedItems, selectedEventId],
  )

  // Is query-string-filtered?
  const isQsFiltered = Boolean(qsEntityType || qsEntityRef)

  const clearQsFilter = useCallback(() => {
    setEntityType('')
    setEntityRef('')
    setCursor(undefined)
  }, [])

  // Export handler
  const handleExport = useCallback(
    (format: ExportFormat) => {
      const exportFilters: AuditEventsFilter = {
        entityType: entityType || undefined,
        entityRef: entityRef || undefined,
        actorUserId: actorUserId || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }

      if (format === 'csv' || format === 'excel') {
        enqueueExport.mutate(
          { format, filters: exportFilters },
          {
            onSuccess: (result) => {
              if (result.format === 'csv' || result.format === 'excel') {
                const ext = result.format === 'csv' ? 'csv' : 'xlsx'
                const mimeType =
                  result.format === 'csv'
                    ? 'text/csv'
                    : 'application/octet-stream'
                const blob = new Blob([result.data], { type: mimeType })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `audit-${Date.now()}.${ext}`
                a.click()
                URL.revokeObjectURL(url)
              }
            },
          },
        )
      } else if (format === 'pdf') {
        enqueueExport.mutate(
          { format: 'pdf', filters: exportFilters },
          {
            onSuccess: (result) => {
              if (result.format === 'pdf') {
                setPdfJobId(result.jobId)
              }
            },
          },
        )
      }
    },
    [entityType, entityRef, actorUserId, action, startDate, endDate, enqueueExport],
  )

  const scopeLabel =
    ROLE_SCOPE_LABEL[session?.user.role ?? ''] ?? 'Scoped access'

  const resetFilters = () => {
    setEntityType('')
    setEntityRef('')
    setActorUserId('')
    setAction('')
    setStartDate('')
    setEndDate('')
    setSearch('')
    setCursor(undefined)
    setSelectedEventId(null)
  }

  return (
    <div className="bg-surface min-h-full">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-on-surface-variant" aria-hidden />
              <h1 className="text-xl font-semibold text-on-surface">
                Audit trail
              </h1>
            </div>
            <p className="text-sm text-on-surface-variant">
              Append-only event log — FR20. No mutations allowed.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Scope indicator */}
            <span className="rounded-sm bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              Viewing: {scopeLabel}
            </span>
            <ExportTrigger
              entityLabel="audit slice"
              onExport={handleExport}
            />
          </div>
        </header>

        {/* PDF export status */}
        {pdfJobId && (
          <div className="mt-3 rounded-sm bg-surface-container-low px-3 py-2 flex items-center gap-2">
            {exportJobStatus?.status === 'completed' ? (
              <span className="text-sm text-on-surface">
                PDF ready — download from your downloads folder.
              </span>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" aria-hidden />
                <span className="text-sm text-on-surface-variant">
                  PDF export queued (job {pdfJobId}) — PDF generation lands
                  post-MVP per DL-019.
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => setPdfJobId(undefined)}
              className="ml-auto rounded-sm p-0.5 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Dismiss export status"
            >
              <X className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
            </button>
          </div>
        )}

        {/* Query-string filter chip */}
        {isQsFiltered && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-container px-2.5 py-1 text-xs font-medium text-on-primary-container">
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filtered to {qsEntityType || 'entity'}
              {qsEntityRef && (
                <span className="font-mono">{qsEntityRef}</span>
              )}
            </span>
            <button
              type="button"
              onClick={clearQsFilter}
              className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          </div>
        )}
      </div>

      <SectionShift />

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-wrap gap-3 items-end bg-surface-container-lowest">
        {/* Entity type */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-entity-type"
            className="text-xs font-medium text-on-surface-variant"
          >
            Entity type
          </label>
          <div className="relative">
            <select
              id="filter-entity-type"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value)
                setCursor(undefined)
              }}
              className="h-9 appearance-none rounded-sm bg-surface-container pl-2.5 pr-8 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[160px]"
            >
              <option value="">All entity types</option>
              {KNOWN_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
          </div>
        </div>

        {/* Actor */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-actor"
            className="text-xs font-medium text-on-surface-variant"
          >
            Actor
          </label>
          <div className="relative">
            <select
              id="filter-actor"
              value={actorUserId}
              onChange={(e) => {
                setActorUserId(e.target.value)
                setCursor(undefined)
              }}
              className="h-9 appearance-none rounded-sm bg-surface-container pl-2.5 pr-8 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[160px]"
            >
              <option value="">All actors</option>
              <option value="__system__">System (no actor)</option>
              {(usersData ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-action"
            className="text-xs font-medium text-on-surface-variant"
          >
            Action
          </label>
          <Input
            id="filter-action"
            type="text"
            placeholder="e.g. create, update"
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setCursor(undefined)
            }}
            className="h-9 w-36 bg-surface-container text-sm"
          />
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">
            Date range
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCursor(undefined)
              }}
              className="h-9 rounded-sm bg-surface-container px-2.5 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <span className="text-xs text-on-surface-variant" aria-hidden>
              to
            </span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCursor(undefined)
              }}
              className="h-9 rounded-sm bg-surface-container px-2.5 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Search (rowId / trnReference) */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-search"
            className="text-xs font-medium text-on-surface-variant"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
            <Input
              id="filter-search"
              type="text"
              placeholder="Row ID or TRN ref"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-44 bg-surface-container pl-8 text-sm"
            />
          </div>
        </div>

        {/* Reset */}
        <Button
          variant="ghost"
          onClick={resetFilters}
          className="h-9 gap-1.5 text-sm text-on-surface-variant"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Reset
        </Button>
      </div>

      <SectionShift />

      {/* ── Main two-pane layout ──────────────────────────────────────────── */}
      <div className="flex min-h-[calc(100svh-22rem)] divide-x-0">
        {/* Left pane — event list */}
        <div
          className={[
            'flex flex-col',
            selectedEvent ? 'w-full lg:w-1/2' : 'w-full',
          ].join(' ')}
        >
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading audit events…
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="px-6 py-6">
              <p className="text-sm text-on-surface-variant">
                Failed to load audit events:{' '}
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && displayedItems.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12">
              <History
                className="h-8 w-8 text-on-surface-variant opacity-40"
                aria-hidden
              />
              <p className="text-sm text-on-surface-variant">
                No audit events match your filters.
              </p>
            </div>
          )}

          {/* Event rows */}
          {!isLoading && !isError && displayedItems.length > 0 && (
            <div
              role="list"
              aria-label="Audit events"
              className="flex flex-col"
            >
              {displayedItems.map((event) => (
                <div role="listitem" key={event.id}>
                  <AuditEventRow
                    event={event}
                    actorName={
                      event.actorUserId
                        ? actorNameMap.get(event.actorUserId)
                        : undefined
                    }
                    selected={selectedEventId === event.id}
                    onSelect={() =>
                      setSelectedEventId(
                        selectedEventId === event.id ? null : event.id,
                      )
                    }
                  />
                  {/* Inline diff panel on mobile (below row) */}
                  {selectedEventId === event.id && (
                    <div className="lg:hidden bg-surface-container-low">
                      <AuditEventDiffPanel event={event} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !isError && (data?.nextCursor || cursor) && (
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              {cursor && (
                <Button
                  variant="outline"
                  onClick={() => setCursor(undefined)}
                  className="text-sm"
                >
                  ← Previous
                </Button>
              )}
              {data?.nextCursor && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCursor(data.nextCursor ?? undefined)
                    setSelectedEventId(null)
                  }}
                  className="ml-auto text-sm"
                >
                  Load more →
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right pane — diff detail panel (desktop) */}
        {selectedEvent && (
          <div className="hidden lg:flex lg:w-1/2 flex-col bg-surface-container-lowest">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-on-surface">
                  Event detail
                </span>
                <span className="text-xs text-on-surface-variant font-mono">
                  {selectedEvent.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="rounded-sm p-1 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close detail panel"
              >
                <X className="h-4 w-4 text-on-surface-variant" aria-hidden />
              </button>
            </div>

            {/* Event metadata */}
            <div className="px-4 pb-3 flex flex-wrap gap-3">
              <MetaChip label="Table" value={selectedEvent.tableName} />
              <MetaChip label="Row" value={selectedEvent.rowId} mono />
              <MetaChip label="Action" value={selectedEvent.action} />
              {selectedEvent.trnReference && (
                <MetaChip
                  label="TRN ref"
                  value={selectedEvent.trnReference}
                  mono
                />
              )}
              {selectedEvent.reason && (
                <MetaChip label="Reason" value={selectedEvent.reason} />
              )}
              {selectedEvent.actorUserId && (
                <MetaChip
                  label="Actor"
                  value={
                    actorNameMap.get(selectedEvent.actorUserId) ??
                    selectedEvent.actorUserId
                  }
                />
              )}
            </div>

            <SectionShift />

            <AuditEventDiffPanel event={selectedEvent} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetaChip — small key-value display for the detail panel header
// ---------------------------------------------------------------------------

function MetaChip({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span
        className={[
          'text-xs text-on-surface',
          mono ? 'font-mono' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}
