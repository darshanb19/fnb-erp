/**
 * IssueTicketsListPage — SI-INF-007 Issue Ticket List (Tier 2).
 *
 * Phase 4 Epic 3 INF Arc (c) Task C8a. Production frontend consuming real
 * hooks: useIssueTickets (cursor-paginated, server-side status/priority/
 * assignee filters) + useUsers (assignee dropdown). Client-side search and
 * linked-entity-type filter layer on top.
 *
 * Token discipline: ZERO hex, Lucide-only, status palette closed, no banned
 * border classes, Inter only, SectionShift for tonal breaks.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Filter,
  History,
  Inbox,
  Plus,
  Search,
  X,
} from 'lucide-react';

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  type StatusToken,
} from '@/components/shell';

import { useIssueTickets, type IssueStatus, type IssuePriority } from '@/hooks/useIssueTickets';
import { useUsers } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Label maps + status token map
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
};

// Mapped per mockup SI-INF-007 + SI-INF-008 comments.
// open → status_pending_approval (closest semantic for "raised but not yet actioned").
// in_progress → status_in_progress (exact).
// pending_info → status_waiting_info (closest — "waiting for more info").
// resolved → status_completed (exact semantic).
// closed → status_closed (exact).
const STATUS_TOKEN: Record<IssueStatus, StatusToken> = {
  open: 'status_pending_approval',
  in_progress: 'status_in_progress',
  pending_info: 'status_waiting_info',
  resolved: 'status_completed',
  closed: 'status_closed',
};

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FilterChipPickerProps<V extends string> {
  readonly title: string;
  readonly options: ReadonlyArray<{ value: V; label: string }>;
  readonly selected: ReadonlySet<V>;
  readonly onToggle: (v: V) => void;
  readonly onClear: () => void;
}

function FilterChipPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipPickerProps<V>) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Filter by {title.toLowerCase()}
          </span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {options.map((opt) => {
            const active = selected.has(opt.value);
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{opt.label}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Selected</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface PriorityChipProps {
  readonly priority: IssuePriority;
}

function PriorityChip({ priority }: PriorityChipProps) {
  if (priority === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-error-container text-on-error-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Critical
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-tertiary-container text-on-tertiary-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high text-on-surface px-2 py-0.5 text-[11px] font-medium">
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Age helpers
// ---------------------------------------------------------------------------

function ageLabel(iso: string): string {
  const hrs = Math.max(
    0,
    (Date.now() - new Date(iso).getTime()) / 3600000,
  );
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 48) return `${Math.round(hrs)}h`;
  return `${Math.round(hrs / 24)}d`;
}

// ---------------------------------------------------------------------------
// toggleSet helper
// ---------------------------------------------------------------------------

function toggleSet<V>(set: ReadonlySet<V>, v: V): ReadonlySet<V> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IssueTicketsListPage() {
  const navigate = useNavigate();

  // Server-side filter state (status + priority + assignee fed to the hook).
  const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | undefined>(undefined);
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>(undefined);

  // Client-side UI filter state (for chips that send to server + local search).
  const [selectedStatuses, setSelectedStatuses] = useState<ReadonlySet<IssueStatus>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<ReadonlySet<IssuePriority>>(new Set());
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [linkedEntityTypeSearch, setLinkedEntityTypeSearch] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Data fetching
  const ticketsQuery = useIssueTickets({
    status: statusFilter,
    priority: priorityFilter,
    assigneeUserId: assigneeFilter,
    cursor,
  });
  const usersQuery = useUsers();

  const tickets = ticketsQuery.data?.items ?? [];
  const nextCursor = ticketsQuery.data?.nextCursor ?? null;

  // Client-side search + linked entity type filter
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (linkedEntityTypeSearch.trim().length > 0) {
        const q = linkedEntityTypeSearch.trim().toLowerCase();
        const hay = (t.linkedEntityType ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const hay = `${t.reference} ${t.title} ${t.linkedEntityRef ?? ''} ${t.linkedEntityType ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, linkedEntityTypeSearch]);

  // Assignee options from useUsers
  const assigneeOptions = useMemo(() => {
    return (usersQuery.data ?? [])
      .filter((u) => u.active)
      .map((u) => ({ value: u.id, label: u.fullName }));
  }, [usersQuery.data]);

  const anyFilterActive =
    selectedStatuses.size > 0 ||
    selectedPriorities.size > 0 ||
    selectedAssigneeId !== '' ||
    linkedEntityTypeSearch.trim().length > 0 ||
    search.trim().length > 0;

  // Handlers that sync chip state to server-side query params
  const handleToggleStatus = (v: IssueStatus) => {
    const next = toggleSet(selectedStatuses, v);
    setSelectedStatuses(next);
    // For server: only filter if exactly one status selected (else no filter = "all")
    if (next.size === 1) {
      setStatusFilter([...next][0]);
    } else {
      setStatusFilter(undefined);
    }
    setCursor(undefined);
  };

  const handleTogglePriority = (v: IssuePriority) => {
    const next = toggleSet(selectedPriorities, v);
    setSelectedPriorities(next);
    if (next.size === 1) {
      setPriorityFilter([...next][0]);
    } else {
      setPriorityFilter(undefined);
    }
    setCursor(undefined);
  };

  const handleSelectAssignee = (v: string) => {
    setSelectedAssigneeId(v);
    setAssigneeFilter(v || undefined);
    setCursor(undefined);
  };

  const handleResetFilters = () => {
    setSelectedStatuses(new Set());
    setSelectedPriorities(new Set());
    setSelectedAssigneeId('');
    setLinkedEntityTypeSearch('');
    setSearch('');
    setStatusFilter(undefined);
    setPriorityFilter(undefined);
    setAssigneeFilter(undefined);
    setCursor(undefined);
  };

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Issue Tracker
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Issue tickets
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Browse, filter, and triage internal issue tickets across
              procurement, inventory, production, dispatch, POS, and finance.
              Tickets are raised from any transactional screen via the{' '}
              <span className="font-mono">CC-ISSUE-TICKET-LINK</span> affordance
              or via the <span className="font-medium">+ New ticket</span> CTA.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              aria-label="View issue ticket audit trail"
            >
              <Link to="/audit?entityType=issue_tickets">
                <History className="h-4 w-4" aria-hidden />
                Audit trail
              </Link>
            </Button>
            <Button
              size="default"
              onClick={() => navigate('/issues/new')}
              aria-label="Create a new issue ticket"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New ticket
            </Button>
          </div>
        </header>

        {/* Filter strip */}
        <section
          aria-label="Issue ticket filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mr-1">
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filter
            </span>

            {/* Status chip */}
            <FilterChipPicker<IssueStatus>
              title="Status"
              options={(
                ['open', 'in_progress', 'pending_info', 'resolved', 'closed'] as const
              ).map((v) => ({ value: v, label: STATUS_LABEL[v] }))}
              selected={selectedStatuses}
              onToggle={handleToggleStatus}
              onClear={() => {
                setSelectedStatuses(new Set());
                setStatusFilter(undefined);
                setCursor(undefined);
              }}
            />

            {/* Priority chip */}
            <FilterChipPicker<IssuePriority>
              title="Priority"
              options={(['low', 'medium', 'high', 'critical'] as const).map(
                (v) => ({ value: v, label: PRIORITY_LABEL[v] }),
              )}
              selected={selectedPriorities}
              onToggle={handleTogglePriority}
              onClear={() => {
                setSelectedPriorities(new Set());
                setPriorityFilter(undefined);
                setCursor(undefined);
              }}
            />

            {/* Assignee chip (popover with user list) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedAssigneeId ? 'tonal' : 'ghost'}
                  size="sm"
                  className="h-9 px-3 gap-1.5 rounded-pill"
                >
                  <span className="text-xs font-medium">
                    {selectedAssigneeId
                      ? (assigneeOptions.find((o) => o.value === selectedAssigneeId)?.label ?? 'Assignee')
                      : 'Assignee'}
                  </span>
                  {selectedAssigneeId ? (
                    <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
                      1
                    </span>
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1 max-h-80 overflow-auto">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Filter by assignee
                  </span>
                  {selectedAssigneeId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleSelectAssignee('')}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <ul className="flex flex-col">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleSelectAssignee('')}
                      aria-pressed={selectedAssigneeId === ''}
                      className={[
                        'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                        'hover:bg-surface-container-high transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        selectedAssigneeId === '' ? 'bg-surface-container' : '',
                      ].join(' ')}
                    >
                      <span className="text-sm text-on-surface">All assignees</span>
                    </button>
                  </li>
                  {assigneeOptions.map((opt) => {
                    const active = selectedAssigneeId === opt.value;
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          onClick={() => handleSelectAssignee(opt.value)}
                          aria-pressed={active}
                          className={[
                            'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                            'hover:bg-surface-container-high transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            active ? 'bg-surface-container' : '',
                          ].join(' ')}
                        >
                          <span className="text-sm text-on-surface">{opt.label}</span>
                          {active ? (
                            <span className="text-xs font-medium text-primary">Selected</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>

            {/* Linked entity type — free-text */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant"
                aria-hidden
              />
              <Input
                aria-label="Filter by linked entity type"
                placeholder="Entity type…"
                className="h-9 pl-8 w-36 text-xs"
                value={linkedEntityTypeSearch}
                onChange={(e) => setLinkedEntityTypeSearch(e.target.value)}
              />
            </div>

            <div className="ml-auto flex w-full items-center gap-2 tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search issue tickets"
                  placeholder="Search ISS-, title, entity ref…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 gap-1"
                  onClick={handleResetFilters}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Ticket list */}
        <section aria-label="Issue tickets" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Tickets</h2>
            {ticketsQuery.isSuccess ? (
              <span className="text-xs text-on-surface-variant tabular-nums">
                {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} in window
              </span>
            ) : null}
          </header>

          {ticketsQuery.isLoading ? (
            <div
              role="status"
              aria-label="Loading tickets…"
              className="flex flex-col gap-3 animate-pulse"
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
                >
                  <div className="h-3 w-32 rounded bg-surface-container-high" />
                  <div className="h-4 w-3/4 rounded bg-surface-container-high" />
                  <div className="h-3 w-1/2 rounded bg-surface-container-high" />
                </div>
              ))}
            </div>
          ) : ticketsQuery.isError ? (
            <div
              role="alert"
              className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              Failed to load tickets. Please refresh the page.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <Inbox className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No tickets in this window.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Try broadening the filters above, or raise a new ticket.
              </p>
              {anyFilterActive ? (
                <Button
                  variant="tonal"
                  size="sm"
                  className="mt-4"
                  onClick={handleResetFilters}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Reset filters
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate('/issues/new')}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  New ticket
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile — compact card stack */}
              <ul className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md bg-surface-container-lowest p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        {t.reference}
                      </span>
                      <PriorityChip priority={t.priority} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-on-surface">
                      {t.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill
                        status={STATUS_TOKEN[t.status]}
                        label={STATUS_LABEL[t.status]}
                        size="sm"
                      />
                      {t.linkedEntityType ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface">
                          <span className="text-on-surface-variant">{t.linkedEntityType}</span>
                          {t.linkedEntityRef ? (
                            <span className="font-mono">{t.linkedEntityRef}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden />
                        {ageLabel(t.createdAt)} old
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button asChild variant="tonal" size="sm">
                        <Link
                          to={`/issues/${t.id}`}
                          aria-label={`Open ${t.reference}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop — data-grid rows */}
              <div className="hidden tablet:block rounded-md bg-surface-container-lowest overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2.8fr)_auto_auto_minmax(0,1fr)_auto_auto] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                  <span>Reference</span>
                  <span>Title</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Linked entity</span>
                  <span>Age</span>
                  <span className="text-right">Action</span>
                </div>
                <ul>
                  {filtered.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2.8fr)_auto_auto_minmax(0,1fr)_auto_auto] gap-3 px-4 py-3 items-center hover:bg-surface-container-low transition-colors"
                    >
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[11px] text-on-surface-variant truncate">
                          {t.reference}
                        </span>
                      </span>
                      <span
                        className="text-sm text-on-surface truncate"
                        title={t.title}
                      >
                        {t.title}
                      </span>
                      <StatusPill
                        status={STATUS_TOKEN[t.status]}
                        label={STATUS_LABEL[t.status]}
                        size="sm"
                      />
                      <PriorityChip priority={t.priority} />
                      <span className="min-w-0">
                        {t.linkedEntityType ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface truncate max-w-full">
                            <span className="text-on-surface-variant shrink-0">{t.linkedEntityType}</span>
                            {t.linkedEntityRef ? (
                              <span className="font-mono truncate">{t.linkedEntityRef}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">—</span>
                        )}
                      </span>
                      <span className="text-[11px] text-on-surface-variant tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {ageLabel(t.createdAt)}
                        </span>
                      </span>
                      <Button asChild variant="tonal" size="sm">
                        <Link
                          to={`/issues/${t.id}`}
                          aria-label={`Open ${t.reference}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Load more */}
              {nextCursor ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="tonal"
                    size="sm"
                    onClick={() => setCursor(nextCursor)}
                    disabled={ticketsQuery.isFetching}
                  >
                    {ticketsQuery.isFetching ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/audit?entityType=issue_tickets"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Issue ticket change history (SI-INF-005 — filtered to issue_tickets)
          </Link>
          {' · '}
          SI-INF-007 · Tier 2 · Phase 4 Epic 3 INF Arc (c) C8a
        </footer>
      </div>
    </div>
  );
}
