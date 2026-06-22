/**
 * EffectivePermissionsPage — SI-USR-005 Effective Permissions View (production).
 *
 * Phase 4 Epic 2 USR Arc (c), Task C5. Mirrors the Arc (b) mockup at
 * mockups/src/screens/usr/SI-USR-005.tsx — same chrome, same source-pill
 * column via `<OverrideSourceBadge>`, same source filter, real data.
 *
 * Source resolution (FR15b):
 *   The effective key set comes from /users/:id/effective-permissions (already
 *   resolved server-side: baseline ∪ active grants − active revokes). For the
 *   per-row source pill we additionally fetch /users/:id/permission-overrides
 *   and build a Map<permissionId → mode>; rows in the effective set whose
 *   permission has an active grant override → 'grant_override', whose
 *   permission has an active revoke → would be filtered out by the resolver
 *   (so they shouldn't appear), and otherwise → 'role_baseline'.
 *
 *   Important: the API resolver already filters out revoke-overridden keys
 *   from the effective set, so we never render a `revoke_override` row in the
 *   primary table — the source filter still includes the 'revoke_override'
 *   chip for completeness (so the user can confirm "no revoke overrides
 *   active") and renders an empty state if selected.
 *
 * URL state:
 *   ?source=role_baseline|grant_override|revoke_override survives refresh.
 *   Multi-select is encoded via repeated query params (URLSearchParams.getAll).
 *
 * Token discipline:
 *   - No hex literals.
 *   - Source pill via shared `<OverrideSourceBadge>` (no inline tone re-impl).
 *   - <SectionShift> not needed here (no multi-section layout).
 *   - Lucide-only icons.
 *
 * Permission gating:
 *   - Page reads (fetching the catalog + overrides) require usr.permissions.read
 *     server-side; the API will 403 if missing.
 *   - Header CTAs ("Grant override", "Revoke baseline") gated by
 *     <RequirePermission permission="usr.permissions.write"> — same canonical
 *     replacement for raw role checks used across Epic 2.
 */

import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Minus, Plus, Search, Shield, X } from 'lucide-react';

import {
  AuditLink,
  Button,
  Card,
  Input,
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
import { ApiError } from '@/lib/api-client';
import { useUser } from '@/hooks/useUsers';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { usePermissions, type PermissionRow } from '@/hooks/usePermissions';
import { useUserOverrides, type OverrideRow } from '@/hooks/usePermissionOverrides';
import { REASON_CODE_LABEL } from '@/lib/reason-codes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_OPTIONS: ReadonlyArray<{ value: OverrideSource; label: string }> = [
  { value: 'role_baseline', label: 'Role baseline' },
  { value: 'grant_override', label: 'Grant override' },
  { value: 'revoke_override', label: 'Revoke override' },
];

const SOURCE_SORT_RANK: Record<OverrideSource, number> = {
  grant_override: 0,
  revoke_override: 1,
  role_baseline: 2,
};

function isValidSource(s: string): s is OverrideSource {
  return s === 'role_baseline' || s === 'grant_override' || s === 'revoke_override';
}

/** Active = expires_at IS NULL OR expires_at > NOW(). Mirrors API resolver. */
function isActiveOverride(o: OverrideRow): boolean {
  if (o.expiresAt === null) return true;
  return new Date(o.expiresAt).getTime() > Date.now();
}

interface ResolvedRow {
  readonly key: string;
  readonly permission: PermissionRow;
  readonly source: OverrideSource;
  readonly override: OverrideRow | null;
}

// ---------------------------------------------------------------------------
// Source filter chip (mirrors SI-USR-005 mockup)
// ---------------------------------------------------------------------------

interface SourceFilterChipProps {
  readonly selected: ReadonlySet<OverrideSource>;
  readonly onToggle: (s: OverrideSource) => void;
  readonly onClear: () => void;
}

function SourceFilterChip({ selected, onToggle, onClear }: SourceFilterChipProps) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by source${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">Source</span>
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
            Filter by source
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
          {SOURCE_OPTIONS.map((opt) => {
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
// Page
// ---------------------------------------------------------------------------

export default function EffectivePermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  // ── Source filter — URL-backed so refresh preserves it ─────────────────
  const sourceFilter = useMemo<ReadonlySet<OverrideSource>>(() => {
    const raw = searchParams.getAll('source').filter(isValidSource);
    return new Set(raw);
  }, [searchParams]);

  const updateSourceFilter = useCallback(
    (next: ReadonlySet<OverrideSource>) => {
      const params = new URLSearchParams(searchParams);
      params.delete('source');
      for (const s of next) params.append('source', s);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const toggleSource = useCallback(
    (s: OverrideSource) => {
      const next = new Set(sourceFilter);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      updateSourceFilter(next);
    },
    [sourceFilter, updateSourceFilter],
  );

  const clearSourceFilter = useCallback(() => {
    updateSourceFilter(new Set());
  }, [updateSourceFilter]);

  // ── Data fetching ──────────────────────────────────────────────────────
  const userQuery = useUser(userId);
  const effectiveQuery = useEffectivePermissions(userId);
  const permissionsQuery = usePermissions();
  const overridesQuery = useUserOverrides(userId);

  const isLoading =
    userQuery.isLoading ||
    effectiveQuery.isLoading ||
    permissionsQuery.isLoading ||
    overridesQuery.isLoading;

  const fetchError =
    userQuery.error ??
    effectiveQuery.error ??
    permissionsQuery.error ??
    overridesQuery.error;

  // ── Resolution: build the Map<permissionKey → source> ──────────────────
  const resolvedRows = useMemo<ResolvedRow[]>(() => {
    const effectiveKeys = new Set(effectiveQuery.data ?? []);
    const permissions = permissionsQuery.data ?? [];
    const overrides = overridesQuery.data ?? [];

    // Build override-by-permissionId map of the active overrides.
    const overrideByPermId = new Map<string, OverrideRow>();
    for (const o of overrides) {
      if (!isActiveOverride(o)) continue;
      // If multiple, the latest createdAt wins (defensive — schema does not
      // enforce uniqueness).
      const existing = overrideByPermId.get(o.permissionId);
      if (!existing || o.createdAt > existing.createdAt) {
        overrideByPermId.set(o.permissionId, o);
      }
    }

    const rows: ResolvedRow[] = [];
    for (const perm of permissions) {
      const inEffective = effectiveKeys.has(perm.key);
      const ovr = overrideByPermId.get(perm.id);
      let source: OverrideSource | null = null;
      let overrideForRow: OverrideRow | null = null;

      if (inEffective) {
        if (ovr && ovr.mode === 'grant') {
          source = 'grant_override';
          overrideForRow = ovr;
        } else {
          source = 'role_baseline';
        }
      } else if (ovr && ovr.mode === 'revoke') {
        // Revoke active → key NOT in effective set; we can still show it for
        // transparency when the source filter explicitly includes 'revoke_override'.
        source = 'revoke_override';
        overrideForRow = ovr;
      }

      if (source === null) continue;
      rows.push({
        key: perm.key,
        permission: perm,
        source,
        override: overrideForRow,
      });
    }

    rows.sort((a, b) => {
      const sa = SOURCE_SORT_RANK[a.source];
      const sb = SOURCE_SORT_RANK[b.source];
      if (sa !== sb) return sa - sb;
      return a.permission.key.localeCompare(b.permission.key);
    });
    return rows;
  }, [effectiveQuery.data, permissionsQuery.data, overridesQuery.data]);

  // ── Apply source + search filters ──────────────────────────────────────
  const filtered = useMemo<ResolvedRow[]>(() => {
    return resolvedRows.filter((row) => {
      if (sourceFilter.size > 0 && !sourceFilter.has(row.source)) return false;
      const q = search.trim().toLowerCase();
      if (q.length > 0) {
        const hay = `${row.permission.key} ${row.permission.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [resolvedRows, sourceFilter, search]);

  // ── Counts ─────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let baseline = 0;
    let grants = 0;
    let revokes = 0;
    for (const r of resolvedRows) {
      if (r.source === 'role_baseline') baseline += 1;
      else if (r.source === 'grant_override') grants += 1;
      else revokes += 1;
    }
    return {
      total: resolvedRows.length,
      baseline,
      overrides: grants + revokes,
      grants,
      revokes,
    };
  }, [resolvedRows]);

  const anyFilterActive = sourceFilter.size > 0 || search.trim().length > 0;

  if (!userId) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6">
          <p className="text-sm text-error">Missing user ID in route.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Effective permissions
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {userQuery.data?.fullName ?? (userQuery.isLoading ? 'Loading…' : 'Unknown user')}
            </h1>
            {userQuery.data ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-on-surface-variant">
                  {userQuery.data.email}
                </span>
                <RoleBadge role={userQuery.data.role} />
              </div>
            ) : null}
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Resolved effective permission set — role baseline plus any grant
              or revoke overrides. Read-only on this screen; mutate via the
              grant / revoke flow (FR15b).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RequirePermission permission="usr.permissions.write">
              <Button
                variant="tonal"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/users/${userId}/overrides/grant`)}
                aria-label="Grant a permission override"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Grant override
              </Button>
            </RequirePermission>
            <RequirePermission permission="usr.permissions.write">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/users/${userId}/overrides/revoke`)}
                aria-label="Revoke a baseline permission"
              >
                <Minus className="h-4 w-4" aria-hidden />
                Revoke baseline
              </Button>
            </RequirePermission>
            <Button asChild variant="ghost" size="sm">
              <Link to="/users">Back to users</Link>
            </Button>
          </div>
        </header>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading permissions: ${fetchError.message}`
              : 'Failed to load effective permissions. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Quick stats ──────────────────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 tablet:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Effective total
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {isLoading ? '…' : counts.total}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Role baseline
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {isLoading ? '…' : counts.baseline}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Overrides
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {isLoading ? '…' : counts.overrides}
            </p>
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {isLoading ? '' : `${counts.grants} grant · ${counts.revokes} revoke`}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Audit trail
            </p>
            <div className="mt-1">
              <AuditLink entityType="users" entityRef={userId} compact />
            </div>
          </Card>
        </div>

        {/* ── Filter strip ─────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <SourceFilterChip
              selected={sourceFilter}
              onToggle={toggleSource}
              onClear={clearSourceFilter}
            />
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  clearSourceFilter();
                  setSearch('');
                }}
                aria-label="Reset filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Reset</span>
              </Button>
            ) : null}
          </div>
          <div className="mt-2 relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
            <Input
              aria-label="Search permissions by key or description"
              placeholder="Search by permission key or description"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Result table ─────────────────────────────────────────────── */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Effective permissions
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${filtered.length} of ${counts.total}`}
            </span>
          </div>
          {isLoading ? (
            <div role="status" aria-label="Loading permissions…" className="flex flex-col gap-0">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 min-h-[48px]"
                >
                  <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-3 w-32 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-5 w-28 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Shield
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                No permissions match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {anyFilterActive
                  ? 'Adjust the source chip above or clear the search.'
                  : 'This user has no effective permissions.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Permission</TableHead>
                    <TableHead scope="col" className="hidden tablet:table-cell">
                      Description
                    </TableHead>
                    <TableHead scope="col">Source</TableHead>
                    <TableHead scope="col" className="hidden desktop:table-cell">
                      Reason
                    </TableHead>
                    <TableHead scope="col" className="hidden desktop:table-cell">
                      Expires
                    </TableHead>
                    <TableHead scope="col" className="hidden tablet:table-cell">
                      Audit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const expiresDate =
                      row.override?.expiresAt
                        ? new Date(row.override.expiresAt)
                        : undefined;
                    const reasonLabel =
                      row.override?.reasonCode
                        ? REASON_CODE_LABEL[row.override.reasonCode] ??
                          row.override.reasonCode
                        : null;
                    return (
                      <TableRow
                        key={row.permission.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs text-on-surface">
                              {row.permission.key}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {row.permission.module}
                            </span>
                            <span className="tablet:hidden text-[11px] text-on-surface-variant">
                              {row.permission.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden tablet:table-cell text-xs text-on-surface-variant">
                          {row.permission.description}
                        </TableCell>
                        <TableCell>
                          <OverrideSourceBadge source={row.source} />
                        </TableCell>
                        <TableCell className="hidden desktop:table-cell">
                          {reasonLabel ? (
                            <span className="text-[11px] font-medium text-on-surface">
                              {reasonLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden desktop:table-cell text-xs tabular-nums">
                          {row.override === null ? (
                            <span className="text-on-surface-variant">—</span>
                          ) : expiresDate ? (
                            <OverrideExpiryBand expiresAt={expiresDate} />
                          ) : (
                            <span className="text-on-surface-variant">Permanent</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden tablet:table-cell">
                          {row.override ? (
                            <RequirePermission
                              permission="usr.permissions.write"
                              fallback={
                                <AuditLink entityType="user_permission_overrides" entityRef={row.override.id} compact />
                              }
                            >
                              <div className="flex items-center gap-1.5">
                                <AuditLink entityType="user_permission_overrides" entityRef={row.override.id} compact />
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                >
                                  <Link
                                    to={`/users/${userId}/overrides/edit/${row.override.id}`}
                                  >
                                    Edit
                                  </Link>
                                </Button>
                              </div>
                            </RequirePermission>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-005 · Phase 4 Epic 2 Arc (c). Source pill rendered via the
          shared CC-PERMISSION-OVERRIDE-MGMT shell.
        </p>
      </div>
    </div>
  );
}
