/**
 * UsersPage — SI-USR-001 User List & Filter (production frontend).
 *
 * Phase 4 Epic 2 USR Arc (c), Task C4. Mirrors the Arc (b) mockup at
 * mockups/src/screens/usr/SI-USR-001.tsx — same chrome, same filter row,
 * same table columns, real data via useUsers().
 *
 * The mockup carried a "view variant" toggle (BO-view vs CM-view) for
 * reviewer ergonomics. Production drops the toggle — the API enforces
 * cluster scope server-side based on req.user.role, so the list this
 * page receives is already correctly filtered.
 *
 * Filters (client-side — GET /users does not yet wire ?role=&status=&q=):
 *   - role: select from the 9-role enum (or "All roles").
 *   - status: 'active' | 'inactive' | 'pending_approval' (derived from
 *             approvalStatus + active on each row).
 *   - q: name/email substring (debounced 300ms; future-proofing for when
 *        the backend wires a server-side ?q= filter).
 *
 * Mutating affordances:
 *   - "Add user" CTA (header) — gated by usr.users.write.
 *   - Per-row "Edit" → /users/:id/edit — gated by usr.users.write.
 *   - Per-row "Deactivate" → opens a confirm dialog with mandatory reason
 *     ≥ 10 chars — gated by usr.users.write.
 *   The READ side of the page is NOT permission-gated — usr.users.read
 *   is a wider grant covered by RequireAuth + the API's own RBAC check.
 *
 * Token discipline (DESIGN.md):
 *   - No hex literals; status_confirmed = Active, status_inactive =
 *     Deactivated, status_pending_approval = Pending approval.
 *   - No `<Separator>`; SectionShift for tonal breaks (none needed here).
 *   - No banned border classes.
 *   - Lucide-only icons.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  MoreHorizontal,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RoleBadge,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell';
import RequirePermission from '@/lib/RequirePermission';
import { ApiError } from '@/lib/api-client';
import { useUsers, useDeactivateUser, type UserRow } from '@/hooks/useUsers';
import { useClustersList } from '@/hooks/mdm/useClusters';
import { useLocationsList } from '@/hooks/mdm/useLocations';
import { useDepartmentsList } from '@/hooks/mdm/useDepartments';
import { ROLE_LABEL, USER_ROLES, type UserRole } from '@/lib/user-roles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DerivedStatus = 'active' | 'inactive' | 'pending_approval';

function deriveStatus(u: UserRow): DerivedStatus {
  if (u.approvalStatus === 'pending_approval') return 'pending_approval';
  if (!u.active) return 'inactive';
  return 'active';
}

function statusToToken(s: DerivedStatus) {
  if (s === 'active') return 'status_confirmed' as const;
  if (s === 'inactive') return 'status_inactive' as const;
  return 'status_pending_approval' as const;
}

function statusLabel(s: DerivedStatus): string {
  if (s === 'active') return 'Active';
  if (s === 'inactive') return 'Inactive';
  return 'Pending approval';
}

function formatLastLogin(iso: string | null): string {
  if (iso === null) return 'Never';
  // Stable label — `2026-05-08 08:14`. Locale-free.
  return iso.slice(0, 16).replace('T', ' ');
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: DerivedStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending_approval', label: 'Pending approval' },
];

// ---------------------------------------------------------------------------
// Row action menu
// ---------------------------------------------------------------------------

interface RowActionMenuProps {
  readonly user: UserRow;
  readonly onEdit: () => void;
  readonly onViewPermissions: () => void;
  readonly onDeactivate: () => void;
}

function RowActionMenu({
  user,
  onEdit,
  onViewPermissions,
  onDeactivate,
}: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const canDeactivate = user.active && user.approvalStatus === 'approved';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Row actions for ${user.fullName}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <ul className="flex flex-col" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit user
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onViewPermissions();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View permissions
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={!canDeactivate}
              onClick={() => {
                onDeactivate();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-error min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
            >
              Deactivate
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Deactivate confirm dialog (popover-as-dialog)
// ---------------------------------------------------------------------------

interface DeactivateDialogProps {
  readonly user: UserRow;
  readonly onClose: () => void;
}

function DeactivateDialog({ user, onClose }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const deactivate = useDeactivateUser();
  const canSubmit = reason.trim().length >= 10;

  async function handleConfirm() {
    if (!canSubmit) return;
    await deactivate.mutateAsync({ id: user.id, reason: reason.trim() });
    onClose();
  }

  return (
    <Card
      role="dialog"
      aria-label={`Deactivate ${user.fullName}`}
      className="mt-4 p-0 max-w-md"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-error mt-0.5"
            aria-hidden
          />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Deactivate user
            </p>
            <p className="mt-1 text-sm text-on-surface">
              You are about to deactivate{' '}
              <span className="font-medium">{user.fullName}</span> (
              <span className="font-mono text-xs">{user.email}</span>).
              This is a soft-delete — the user can be reactivated later.
            </p>
          </div>
        </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="deactivate-user-reason"
              className="text-xs font-medium text-on-surface"
            >
              Reason
              <span className="text-error ml-0.5" aria-hidden>
                *
              </span>
              <span className="ml-1 text-on-surface-variant font-normal">
                (min. 10 characters)
              </span>
            </label>
            <Input
              id="deactivate-user-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you are deactivating this user"
              aria-describedby="deactivate-user-reason-hint"
            />
            <p
              id="deactivate-user-reason-hint"
              className="text-[11px] text-on-surface-variant"
            >
              {reason.trim().length}/10 minimum
            </p>
          </div>
          {deactivate.isError ? (
            <p className="text-xs text-error" role="alert">
              {deactivate.error instanceof ApiError
                ? deactivate.error.message
                : 'Deactivation failed — please try again.'}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmit || deactivate.isPending}
              onClick={() => {
                void handleConfirm();
              }}
              className="bg-error text-on-error hover:bg-error/90"
            >
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate user'}
            </Button>
          </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const navigate = useNavigate();

  // ── Filter state ───────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<DerivedStatus | ''>('');

  // ── Deactivate dialog state ────────────────────────────────────────────
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  // Filters applied client-side (server ignores ?role=&status=&q= today).
  const usersQuery = useUsers({
    role: roleFilter === '' ? undefined : roleFilter,
    status: statusFilter === '' ? undefined : statusFilter,
    q: debouncedSearch.trim() === '' ? undefined : debouncedSearch.trim(),
  });
  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();
  const departmentsQuery = useDepartmentsList();

  // ── Lookup maps for scope summaries ────────────────────────────────────
  const clusterById = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    (clustersQuery.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clustersQuery.data]);
  const locationById = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    (locationsQuery.data ?? []).forEach((l) => m.set(l.id, l.name));
    return m;
  }, [locationsQuery.data]);
  const departmentById = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    (departmentsQuery.data ?? []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departmentsQuery.data]);

  const scopeSummary = useCallback(
    (u: UserRow): string => {
      if (u.role === 'superadmin') return 'Multi-tenant';
      if (
        u.role === 'brand_owner' ||
        u.role === 'procurement_manager' ||
        u.role === 'finance_manager'
      ) {
        return 'Brand-wide';
      }
      if (u.role === 'cluster_manager') {
        const name = u.clusterId ? clusterById.get(u.clusterId) : null;
        return name ?? 'Cluster (unset)';
      }
      // kitchen_manager / store_manager / dispatch_staff / pos_staff
      const loc = u.locationId ? locationById.get(u.locationId) : null;
      const dept = u.departmentId ? departmentById.get(u.departmentId) : null;
      if (loc && dept) return `${loc} · ${dept}`;
      if (loc) return loc;
      return 'Location (unset)';
    },
    [clusterById, locationById, departmentById],
  );

  // ── Client-side filter ─────────────────────────────────────────────────
  const filtered = useMemo<UserRow[]>(() => {
    const all = usersQuery.data ?? [];
    return all.filter((u) => {
      if (roleFilter !== '' && u.role !== roleFilter) return false;
      if (statusFilter !== '' && deriveStatus(u) !== statusFilter) return false;
      const q = debouncedSearch.trim().toLowerCase();
      if (q.length > 0) {
        const hay = `${u.fullName} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [usersQuery.data, roleFilter, statusFilter, debouncedSearch]);

  const totalCount = usersQuery.data?.length ?? 0;
  const anyFilterActive =
    roleFilter !== '' ||
    statusFilter !== '' ||
    debouncedSearch.trim().length > 0;

  const isLoading = usersQuery.isLoading;
  const fetchError = usersQuery.error;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Users
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface flex items-center gap-2">
              <Users className="h-6 w-6 text-on-surface-variant" aria-hidden />
              Users
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {isLoading
                ? 'Loading…'
                : `${totalCount} user${totalCount !== 1 ? 's' : ''} in this brand. Brand Owners and Superadmins see the whole register; Cluster Managers see only users scoped to their own cluster (FR12).`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RequirePermission permission="usr.users.write">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/users/new')}
                aria-label="Create new user"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                New user
              </Button>
            </RequirePermission>
          </div>
        </header>

        {/* ── Deactivate dialog (inline above filter strip) ─────────────── */}
        {deactivateTarget !== null ? (
          <DeactivateDialog
            user={deactivateTarget}
            onClose={() => setDeactivateTarget(null)}
          />
        ) : null}

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading users: ${fetchError.message}`
              : 'Failed to load users. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Filter strip ──────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="grid grid-cols-1 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2">
            {/* Role filter */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="users-role-filter"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Role
              </label>
              <select
                id="users-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                className="h-10 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">All roles</option>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="users-status-filter"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Status
              </label>
              <select
                id="users-status-filter"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as DerivedStatus | '')
                }
                className="h-10 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="users-search"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  id="users-search"
                  aria-label="Search users by name or email"
                  placeholder="Search by name or email"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {anyFilterActive ? (
            <div className="mt-2 flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1"
                onClick={() => {
                  setRoleFilter('');
                  setStatusFilter('');
                  setSearch('');
                }}
                aria-label="Reset all filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Reset</span>
              </Button>
            </div>
          ) : null}
        </div>

        {/* ── Result table ──────────────────────────────────────────────── */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Users</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${filtered.length} of ${totalCount}`}
            </span>
          </div>

          {isLoading ? (
            <div
              role="status"
              aria-label="Loading users…"
              className="flex flex-col gap-0"
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 min-h-[48px]"
                >
                  <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-3 w-32 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-5 w-28 rounded-pill bg-surface-container-high animate-pulse" />
                  <div className="h-5 w-20 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : fetchError ? null : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Users
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                No users match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {anyFilterActive
                  ? 'Adjust the filters above or reset them to see every user.'
                  : 'Add the first user to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Name</TableHead>
                    <TableHead scope="col" className="hidden tablet:table-cell">
                      Email
                    </TableHead>
                    <TableHead scope="col">Role</TableHead>
                    <TableHead scope="col" className="hidden tablet:table-cell">
                      Scope
                    </TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead
                      scope="col"
                      className="hidden desktop:table-cell"
                    >
                      Last login
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="w-12"
                      aria-label="Row actions"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const status = deriveStatus(u);
                    return (
                      <TableRow
                        key={u.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-on-surface">
                              {u.fullName}
                            </span>
                            <span className="tablet:hidden text-[11px] text-on-surface-variant">
                              {u.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden tablet:table-cell text-xs text-on-surface-variant">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} size="sm" />
                        </TableCell>
                        <TableCell className="hidden tablet:table-cell text-xs text-on-surface-variant">
                          {scopeSummary(u)}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            status={statusToToken(status)}
                            size="sm"
                            label={statusLabel(status)}
                          />
                        </TableCell>
                        <TableCell className="hidden desktop:table-cell text-xs text-on-surface-variant tabular-nums">
                          {formatLastLogin(u.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <RequirePermission
                            permission="usr.users.write"
                            fallback={
                              <span className="inline-block w-9" aria-hidden />
                            }
                          >
                            <RowActionMenu
                              user={u}
                              onEdit={() => navigate(`/users/${u.id}/edit`)}
                              onViewPermissions={() =>
                                navigate(`/users/${u.id}/effective-permissions`)
                              }
                              onDeactivate={() => setDeactivateTarget(u)}
                            />
                          </RequirePermission>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
            <Plus className="h-3 w-3" aria-hidden />
            FR11 — multi-criteria user register · FR12 — role-scope filtering.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
