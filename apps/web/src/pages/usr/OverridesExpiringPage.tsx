/**
 * OverridesExpiringPage — SI-USR-007 Permission Overrides Expiring Soon.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C6. Mirrors the Arc (b) mockup at
 * mockups/src/screens/usr/SI-USR-007.tsx — sortable/filterable table of
 * every time-limited permission override within the selected day window,
 * sorted by expires_at ASC with tonal expiry-band pills.
 *
 * Tier 2 acceptance (lighter critique — functional + token-clean is the bar).
 *
 * URL state:
 *   ?days=30  (default) — window selector (7 / 30 / 60 / 90).
 *   Changing days re-fetches from a distinct cache entry.
 *
 * Header metric tiles:
 *   - Total expiring within window
 *   - Urgent (0–7 days)  → bg-error-container
 *   - Soon (8–30 days)   → bg-tertiary-container
 *   - Routine (>30 days) → neutral
 *
 * Bulk actions:
 *   Row-select checkboxes + "Renew" / "Revoke now" CTAs.
 *   No bulk endpoint exists in apps/api (Epic 3 concern); buttons are rendered
 *   but disabled with a tooltip: "Bulk endpoint coming in Epic 3. Use
 *   per-row actions for now."
 *   Per-row Renew links to the PermissionOverridePage (edit mode).
 *   Per-row Revoke calls useRevokeOverrideEntirely (expires the row immediately).
 *
 * Token discipline:
 *   - Zero hex literals.
 *   - Lucide-only icons.
 *   - Inter font (inherited — no inline font-family).
 *   - No <Separator>; no banned borders.
 *   - <OverrideExpiryBand> + <OverrideSourceBadge variant="compact"> from shell.
 *   - <RoleBadge size="sm"> from shell.
 */

import { useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Pencil,
  ShieldX,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  OverrideExpiryBand,
  OverrideSourceBadge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RoleBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type OverrideSource,
} from '@/components/shell';

import RequirePermission from '@/lib/RequirePermission';
import {
  useExpiringOverrides,
  useRevokeOverrideEntirely,
  type ExpiringOverrideRow,
} from '@/hooks/usePermissionOverrides';
import { REASON_CODE_LABEL } from '@/lib/reason-codes';
import { type UserRole } from '@/lib/user-roles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExpiryBand = 'urgent' | 'soon' | 'routine';

function daysUntil(isoString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoString);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function bandFor(days: number): ExpiryBand {
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'routine';
}

const DAYS_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
] as const;

function modeToSource(mode: 'grant' | 'revoke'): OverrideSource {
  return mode === 'grant' ? 'grant_override' : 'revoke_override';
}

// ---------------------------------------------------------------------------
// FilterChip — same pattern as SI-USR-007 mockup
// ---------------------------------------------------------------------------

interface FilterChipProps<V extends string> {
  readonly title: string;
  readonly options: ReadonlyArray<{ value: V; label: string }>;
  readonly selected: ReadonlySet<V>;
  readonly onToggle: (v: V) => void;
  readonly onClear: () => void;
}

function FilterChip<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipProps<V>) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by ${title.toLowerCase()}${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : null}
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

// ---------------------------------------------------------------------------
// Mode + band filter options
// ---------------------------------------------------------------------------

const BAND_OPTIONS: ReadonlyArray<{ value: ExpiryBand; label: string }> = [
  { value: 'urgent', label: 'Urgent (0–7 days)' },
  { value: 'soon', label: 'Soon (8–30 days)' },
  { value: 'routine', label: 'Routine (> 30 days)' },
];

const MODE_OPTIONS: ReadonlyArray<{ value: OverrideSource; label: string }> = [
  { value: 'grant_override', label: 'Grant override' },
  { value: 'revoke_override', label: 'Revoke override' },
];

// ---------------------------------------------------------------------------
// BulkDisabledTooltip — explains why bulk actions are disabled
// ---------------------------------------------------------------------------

function BulkDisabledTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="center" className="w-64 p-3">
        <p className="text-xs text-on-surface">
          Bulk actions are coming soon. Use per-row actions for now.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function OverridesExpiringPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-backed days param — default 30
  const daysParam = parseInt(searchParams.get('days') ?? '30', 10);
  const days = DAYS_OPTIONS.some((o) => o.value === daysParam) ? daysParam : 30;

  function setDays(d: number) {
    const params = new URLSearchParams(searchParams);
    params.set('days', String(d));
    setSearchParams(params, { replace: true });
  }

  const { data, isLoading, isError } = useExpiringOverrides(days);
  const revokeOverride = useRevokeOverrideEntirely();

  // Filter state
  const [bandFilter, setBandFilter] = useState<ReadonlySet<ExpiryBand>>(new Set());
  const [modeFilter, setModeFilter] = useState<ReadonlySet<OverrideSource>>(new Set());
  const [userFilter, setUserFilter] = useState<ReadonlySet<string>>(new Set());

  // Bulk selection
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback(<V extends string>(
    set: ReadonlySet<V>,
    v: V,
  ): ReadonlySet<V> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }, []);

  // User options for the filter chip (derived from loaded data)
  const userOptions = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const r of data) {
      if (!seen.has(r.userId)) seen.set(r.userId, r.userFullName);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [data]);

  // Filtered rows
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      const d = daysUntil(r.expiresAt);
      const band = bandFor(d);
      if (bandFilter.size > 0 && !bandFilter.has(band)) return false;
      const source = modeToSource(r.mode);
      if (modeFilter.size > 0 && !modeFilter.has(source)) return false;
      if (userFilter.size > 0 && !userFilter.has(r.userId)) return false;
      return true;
    });
  }, [data, bandFilter, modeFilter, userFilter]);

  // Header metric counts (over the full un-filtered data for the days window)
  const counts = useMemo(() => {
    if (!data) return { total: 0, urgent: 0, soon: 0, routine: 0 };
    let urgent = 0;
    let soon = 0;
    let routine = 0;
    for (const r of data) {
      const b = bandFor(daysUntil(r.expiresAt));
      if (b === 'urgent') urgent += 1;
      else if (b === 'soon') soon += 1;
      else routine += 1;
    }
    return { total: data.length, urgent, soon, routine };
  }, [data]);

  const anyFilterActive = bandFilter.size > 0 || modeFilter.size > 0 || userFilter.size > 0;

  // Bulk selection helpers
  const allFilteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => toggle(prev, id));
  }

  function handleRowRevoke(row: ExpiringOverrideRow) {
    revokeOverride.mutate({ userId: row.userId, overrideId: row.id });
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Expiring overrides
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Permission overrides expiring soon
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Time-limited grants and revokes sorted by upcoming expiry.
              Renew, revoke now, or open the user's effective view to act
              before access lapses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Days window selector */}
            <div className="flex items-center gap-1 rounded-sm bg-surface-container-low p-1">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDays(opt.value)}
                  className={[
                    'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    days === opt.value
                      ? 'bg-surface text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  ].join(' ')}
                  aria-pressed={days === opt.value}
                  aria-label={`Show overrides expiring within ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/users">Back to users</Link>
            </Button>
          </div>
        </header>

        {/* Quick-stats tiles */}
        <div className="mt-4 grid grid-cols-2 tablet:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Expiring within {days} days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {isLoading ? '—' : counts.total}
            </p>
          </Card>
          <Card className="p-3 bg-error-container">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-error-container">
              Urgent · 0–7 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-error-container tabular-nums">
              {isLoading ? '—' : counts.urgent}
            </p>
            {!isLoading && counts.urgent > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-on-error-container">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Action recommended this week
              </p>
            ) : null}
          </Card>
          <Card className="p-3 bg-tertiary-container">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-tertiary-container">
              Soon · 8–30 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-tertiary-container tabular-nums">
              {isLoading ? '—' : counts.soon}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Routine · &gt;30 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {isLoading ? '—' : counts.routine}
            </p>
          </Card>
        </div>

        {/* Filter row + bulk actions */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip<ExpiryBand>
              title="Time band"
              options={BAND_OPTIONS}
              selected={bandFilter}
              onToggle={(v) => setBandFilter(toggle(bandFilter, v))}
              onClear={() => setBandFilter(new Set())}
            />
            <FilterChip<OverrideSource>
              title="Mode"
              options={MODE_OPTIONS}
              selected={modeFilter}
              onToggle={(v) => setModeFilter(toggle(modeFilter, v))}
              onClear={() => setModeFilter(new Set())}
            />
            {userOptions.length > 0 ? (
              <FilterChip<string>
                title="User"
                options={userOptions}
                selected={userFilter}
                onToggle={(v) => setUserFilter(toggle(userFilter, v))}
                onClear={() => setUserFilter(new Set())}
              />
            ) : null}
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setBandFilter(new Set());
                  setModeFilter(new Set());
                  setUserFilter(new Set());
                }}
                aria-label="Reset filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Reset</span>
              </Button>
            ) : null}

            {/* Bulk actions — disabled (no bulk endpoint yet; Epic 3) */}
            {selected.size > 0 ? (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {selected.size} selected
                </span>
                <BulkDisabledTooltip>
                  <Button
                    variant="tonal"
                    size="sm"
                    disabled
                    aria-label="Bulk renew — coming soon"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Renew selected
                  </Button>
                </BulkDisabledTooltip>
                <BulkDisabledTooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    aria-label="Bulk revoke — coming soon"
                  >
                    <ShieldX className="h-3.5 w-3.5" aria-hidden />
                    Revoke selected
                  </Button>
                </BulkDisabledTooltip>
              </div>
            ) : null}
          </div>
        </div>

        {/* Table */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Expiring overrides
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${filtered.length} of ${counts.total}`}
            </span>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" aria-hidden />
              <p className="text-sm text-on-surface-variant">Loading expiring overrides…</p>
            </div>
          ) : isError ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-semibold text-error">
                Failed to load expiring overrides.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Check your permissions (usr.permissions.read) and try again.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CalendarClock
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                {anyFilterActive
                  ? 'No expiring overrides match the current filter.'
                  : `No overrides expiring within ${days} days.`}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {anyFilterActive
                  ? 'Adjust the chips above or clear them to see every expiry.'
                  : 'Great — all time-limited overrides have comfortable runway.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible rows"
                      className="h-4 w-4 rounded-sm accent-primary"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead className="hidden tablet:table-cell">Mode</TableHead>
                  <TableHead className="hidden desktop:table-cell">Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-surface-container-low transition-colors"
                    aria-selected={selected.has(row.id)}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select override for ${row.userFullName}`}
                        className="h-4 w-4 rounded-sm accent-primary"
                      />
                    </TableCell>

                    {/* User column */}
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Link
                          to={`/users/${row.userId}/effective-permissions`}
                          className="font-medium text-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                        >
                          {row.userFullName}
                        </Link>
                        <span className="text-[11px] text-on-surface-variant">
                          {row.userEmail}
                        </span>
                        <RoleBadge role={row.userRole as UserRole} size="sm" />
                      </div>
                    </TableCell>

                    {/* Permission column */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-on-surface">
                          {row.permissionKey}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {row.permissionDescription}
                        </span>
                      </div>
                    </TableCell>

                    {/* Mode column (tablet+) */}
                    <TableCell className="hidden tablet:table-cell">
                      <OverrideSourceBadge
                        source={modeToSource(row.mode)}
                        variant="compact"
                      />
                    </TableCell>

                    {/* Reason column (desktop+) */}
                    <TableCell className="hidden desktop:table-cell">
                      <span className="text-[11px] font-medium text-on-surface">
                        {REASON_CODE_LABEL[row.reasonCode] ?? row.reasonCode}
                      </span>
                    </TableCell>

                    {/* Expiry pill */}
                    <TableCell>
                      <OverrideExpiryBand expiresAt={new Date(row.expiresAt)} />
                    </TableCell>

                    {/* Row actions */}
                    <TableCell>
                      <RequirePermission permission="usr.permissions.write">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button asChild variant="tonal" size="sm">
                            <Link
                              to={`/users/${row.userId}/overrides/edit/${row.id}`}
                              aria-label={`Renew override for ${row.userFullName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Renew
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRowRevoke(row)}
                            disabled={revokeOverride.isPending}
                            aria-label={`Revoke override now for ${row.userFullName}`}
                          >
                            <ShieldX className="h-3.5 w-3.5" aria-hidden />
                            Revoke now
                          </Button>
                        </div>
                      </RequirePermission>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

      </div>
    </div>
  );
}
