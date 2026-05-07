/**
 * DepartmentsPage — SI-MDM-002 Department Register production page.
 *
 * Consuming real apps/api endpoints via TanStack Query hooks.
 * Mirrors the Arc (b) mockup chrome (mockups/src/screens/mdm/SI-MDM-002.tsx)
 * with live data, loading skeletons, error surfaces, and a11y.
 *
 * Source FRs:
 *   FR1 — department is part of the organisation hierarchy
 *   FR2 — department type classification visible on every row
 *
 * Data join strategy:
 *   The /api/v1/departments endpoint returns only locationId (FK).
 *   Location names and cluster names are resolved client-side by joining
 *   against useLocationsList and useClustersList responses.
 *
 * Filter strategy:
 *   - type: sent to the API as a query param (server-side filter)
 *   - clusterId: client-side (API does not support clusterId param)
 *   - locationId: sent to the API as a query param (server-side filter)
 *   - q: client-side full-text match on department name
 *   When both type and locationId are provided, type is applied server-side;
 *   clusterId and q are applied after the API response is received.
 *
 * DL-022 surface:
 *   No re-parenting affordance; locationId is immutable.
 *
 * Token discipline:
 *   No hex literals. status_confirmed = Active; status_inactive = Deactivated.
 *   No <Separator> — <SectionShift> for tonal breaks.
 *   border-l-4 pip allowlisted per §5.2.
 */

import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Search,
  Workflow,
  X,
} from 'lucide-react';

import {
  AuditLink,
  Button,
  Card,
  CardContent,
  CardTitle,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell';

import { ApiError } from '@/lib/api-client';
import { useDepartmentsList, useUpdateDepartment, useDeactivateDepartment } from '@/hooks/mdm/useDepartments';
import { useLocationsList } from '@/hooks/mdm/useLocations';
import { useClustersList } from '@/hooks/mdm/useClusters';
import type { DepartmentRow, DepartmentType, LocationRow, ClusterRow } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const DEPT_TYPE_LABEL: Record<DepartmentType, string> = {
  production: 'Production',
  non_production: 'Non-Production',
  dispatch: 'Dispatch',
  store: 'Store',
};

const DEPT_TYPE_OPTIONS: ReadonlyArray<{ readonly value: DepartmentType; readonly label: string }> = [
  { value: 'production', label: 'Production' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'non_production', label: 'Non-Production' },
  { value: 'store', label: 'Store' },
];

const LOCATION_TYPE_LABEL: Record<string, string> = {
  central_kitchen: 'Central Kitchen',
  pos_outlet: 'POS Outlet',
  brand_store: 'Brand Store',
  cluster_store: 'Cluster Store',
};

type SortColumn = 'name' | 'type' | 'location' | 'cluster' | 'status' | 'created' | 'modified';
type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Joined row type (department + resolved location + cluster names)
// ---------------------------------------------------------------------------

interface DeptRow {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly type: DepartmentType;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationType: string;
  readonly clusterId: string;
  readonly clusterName: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function joinRows(
  departments: DepartmentRow[],
  locations: LocationRow[],
  clusters: ClusterRow[],
): DeptRow[] {
  const locById = new Map(locations.map((l) => [l.id, l]));
  const clsByIdFn = (clusterId: string) => clusters.find((c) => c.id === clusterId);

  return departments.flatMap((dept) => {
    const loc = locById.get(dept.locationId);
    if (!loc) return [];
    const cls = clsByIdFn(loc.clusterId);
    return [
      {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        type: dept.type,
        locationId: dept.locationId,
        locationName: loc.name,
        locationType: loc.type,
        clusterId: loc.clusterId,
        clusterName: cls?.name ?? '—',
        active: dept.active,
        createdAt: dept.createdAt.slice(0, 10),
        updatedAt: dept.updatedAt.slice(0, 10),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveStatusPill({ active }: { readonly active: boolean }) {
  return active ? (
    <StatusPill status="status_confirmed" size="sm" label="Active" />
  ) : (
    <StatusPill status="status_inactive" size="sm" label="Deactivated" />
  );
}

function TypePill({ type }: { readonly type: DepartmentType }) {
  const isOperational = type === 'production' || type === 'dispatch';
  const cls = isOperational
    ? 'bg-secondary-container text-on-secondary-container'
    : 'bg-surface-container-high text-on-surface-variant';
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {DEPT_TYPE_LABEL[type]}
    </span>
  );
}

// Generic filter picker — multi-select popover chip
interface FilterPickerProps<V extends string> {
  readonly title: string;
  readonly options: ReadonlyArray<{ readonly value: V; readonly label: string }>;
  readonly selected: ReadonlySet<V>;
  readonly onToggle: (v: V) => void;
  readonly onClear: () => void;
}

function FilterPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterPickerProps<V>) {
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
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-on-surface-variant">
            No options available at the current scope.
          </p>
        ) : (
          <ul className="flex flex-col" role="listbox" aria-label={`${title} options`}>
            {options.map((opt) => {
              const isActive = selected.has(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    aria-pressed={isActive}
                    className={[
                      'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                      'hover:bg-surface-container-high transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive ? 'bg-surface-container' : '',
                    ].join(' ')}
                  >
                    <span className="text-sm text-on-surface">{opt.label}</span>
                    {isActive ? (
                      <span className="text-xs font-medium text-primary">Selected</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Row action menu
interface RowActionMenuProps {
  readonly row: DeptRow;
  readonly onEdit: () => void;
  readonly onDeactivate: () => void;
}

function RowActionMenu({ row, onEdit, onDeactivate }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Row actions for ${row.name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <ul className="flex flex-col" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Rename
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onDeactivate(); setOpen(false); }}
              disabled={!row.active}
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

// ── Edit dialog ────────────────────────────────────────────────────────────────

interface EditDialogProps {
  readonly row: DeptRow;
  readonly onClose: () => void;
}

function EditDialog({ row, onClose }: EditDialogProps) {
  const [name, setName] = useState(row.name);
  const [reason, setReason] = useState('');
  const updateDepartment = useUpdateDepartment();

  const isDirty = name.trim() !== row.name || reason.trim().length > 0;
  const canSubmit = name.trim().length > 0 && reason.trim().length >= 3 && isDirty;

  async function handleSubmit() {
    if (!canSubmit) return;
    await updateDepartment.mutateAsync({ id: row.id, name: name.trim(), reason: reason.trim() });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Rename department
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-dept-name" className="text-xs font-medium text-on-surface">
          Department name <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="edit-dept-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pastry Section"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-reason" className="text-xs font-medium text-on-surface">
          Reason for change <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="edit-reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="At least 3 characters"
        />
      </div>
      {updateDepartment.isError ? (
        <p className="text-xs text-error" role="alert">
          {updateDepartment.error instanceof ApiError
            ? updateDepartment.error.message
            : 'Update failed — please try again.'}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!canSubmit || updateDepartment.isPending}
          onClick={() => { void handleSubmit(); }}
        >
          {updateDepartment.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ── Deactivate dialog ──────────────────────────────────────────────────────────

interface DeactivateDialogProps {
  readonly row: DeptRow;
  readonly onClose: () => void;
}

function DeactivateDialog({ row, onClose }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const deactivate = useDeactivateDepartment();

  const canSubmit = reason.trim().length >= 3;

  async function handleSubmit() {
    if (!canSubmit) return;
    await deactivate.mutateAsync({ id: row.id, reason: reason.trim() });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Deactivate department
      </p>
      <p className="text-sm text-on-surface">
        You are about to deactivate <span className="font-medium">{row.name}</span>. This is a
        soft-delete — the department can be reactivated later.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deactivate-reason" className="text-xs font-medium text-on-surface">
          Reason <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="deactivate-reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="At least 3 characters"
        />
      </div>
      {deactivate.isError ? (
        <p className="text-xs text-error" role="alert">
          {deactivate.error instanceof ApiError
            ? deactivate.error.message
            : 'Deactivation failed — please try again.'}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={!canSubmit || deactivate.isPending}
          onClick={() => { void handleSubmit(); }}
        >
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
        </Button>
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading departments…" className="flex flex-col gap-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 min-h-[48px]">
          <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-20 rounded-pill bg-surface-container-high animate-pulse" />
          <div className="h-4 w-32 rounded bg-surface-container-high animate-pulse" />
          <div className="h-4 w-24 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-16 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div role="status" aria-label="Loading departments…" className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-3">
          <div className="flex items-start gap-2">
            <div className="h-7 w-7 rounded-sm bg-surface-container-high animate-pulse shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-4 w-36 rounded bg-surface-container-high animate-pulse" />
              <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Sort icon ──────────────────────────────────────────────────────────────────

function SortIcon({
  col,
  sortColumn,
  sortDirection,
}: {
  readonly col: SortColumn;
  readonly sortColumn: SortColumn;
  readonly sortDirection: SortDirection;
}) {
  if (col !== sortColumn) {
    return <ChevronDown className="h-3 w-3 text-on-surface-variant opacity-30" aria-hidden />;
  }
  return sortDirection === 'asc' ? (
    <ChevronUp className="h-3 w-3 text-on-surface" aria-hidden />
  ) : (
    <ChevronDown className="h-3 w-3 text-on-surface" aria-hidden />
  );
}

// ---------------------------------------------------------------------------
// Dialog state
// ---------------------------------------------------------------------------

type DialogState =
  | { kind: 'none' }
  | { kind: 'edit'; row: DeptRow }
  | { kind: 'deactivate'; row: DeptRow };

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DepartmentsPage() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState<ReadonlySet<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<ReadonlySet<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<ReadonlySet<DepartmentType>>(new Set());

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ── UI state ─────────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  // Fetch all departments (no type param — filter client-side for multi-select support)
  const depsQuery = useDepartmentsList();
  const locsQuery = useLocationsList();
  const clsQuery = useClustersList();

  // ── Join rows ─────────────────────────────────────────────────────────────
  const allRows = useMemo<DeptRow[]>(() => {
    if (!depsQuery.data || !locsQuery.data || !clsQuery.data) return [];
    return joinRows(depsQuery.data, locsQuery.data, clsQuery.data);
  }, [depsQuery.data, locsQuery.data, clsQuery.data]);

  // ── Filter options derived from joined data ──────────────────────────────
  const clusterOptions = useMemo(
    () => (clsQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clsQuery.data],
  );

  const locationOptions = useMemo(() => {
    const locs = locsQuery.data ?? [];
    const filtered =
      clusterFilter.size === 0 ? locs : locs.filter((l) => clusterFilter.has(l.clusterId));
    return filtered.map((l) => ({ value: l.id, label: l.name }));
  }, [locsQuery.data, clusterFilter]);

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = useMemo<DeptRow[]>(() => {
    return allRows.filter((r) => {
      if (clusterFilter.size > 0 && !clusterFilter.has(r.clusterId)) return false;
      if (locationFilter.size > 0 && !locationFilter.has(r.locationId)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false;
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const hay = `${r.name} ${r.code ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, clusterFilter, locationFilter, typeFilter, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo<DeptRow[]>(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':    cmp = a.name.localeCompare(b.name); break;
        case 'type':    cmp = DEPT_TYPE_LABEL[a.type].localeCompare(DEPT_TYPE_LABEL[b.type]); break;
        case 'location': cmp = a.locationName.localeCompare(b.locationName); break;
        case 'cluster': cmp = a.clusterName.localeCompare(b.clusterName); break;
        case 'status':  cmp = Number(b.active) - Number(a.active); break;
        case 'created': cmp = a.createdAt.localeCompare(b.createdAt); break;
        case 'modified': cmp = a.updatedAt.localeCompare(b.updatedAt); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortColumn, sortDirection]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleSort = useCallback((col: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('asc');
      return col;
    });
  }, []);

  function toggleSet<V>(set: ReadonlySet<V>, v: V): ReadonlySet<V> {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }

  const anyFilterActive =
    clusterFilter.size > 0 || locationFilter.size > 0 || typeFilter.size > 0 || search.trim().length > 0;

  const totalCount = allRows.length;
  const inactiveCount = allRows.filter((r) => !r.active).length;

  // ── Error state ───────────────────────────────────────────────────────────
  const fetchError = depsQuery.error ?? locsQuery.error ?? clsQuery.error;
  const isLoading = depsQuery.isLoading || locsQuery.isLoading || clsQuery.isLoading;

  // ── Table column definitions ──────────────────────────────────────────────
  const TABLE_COLS: ReadonlyArray<{ readonly col: SortColumn; readonly label: string }> = [
    { col: 'name',     label: 'Department' },
    { col: 'type',     label: 'Type' },
    { col: 'location', label: 'Parent location' },
    { col: 'cluster',  label: 'Cluster' },
    { col: 'status',   label: 'Status' },
    { col: 'created',  label: 'Created' },
    { col: 'modified', label: 'Last modified' },
  ];

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">

        {/* ── Page header ────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Departments
            </p>
            <h1 className="mt-1 text-2xl sm:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Department register
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {isLoading ? 'Loading…' : (
                <>
                  {totalCount} department{totalCount !== 1 ? 's' : ''} ·{' '}
                  {inactiveCount > 0 ? `${inactiveCount} deactivated` : 'All active'}.
                  {' '}Filter by cluster, location, or type. Jump to{' '}
                  <Link
                    to="/mdm/hierarchy"
                    className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  >
                    hierarchy view
                  </Link>{' '}
                  for a tree-shaped affordance.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef="departments" compact />
          </div>
        </header>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading departments: ${fetchError.message}`
              : 'Failed to load departments. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Filter strip ────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPicker<string>
              title="Cluster"
              options={clusterOptions}
              selected={clusterFilter}
              onToggle={(v) => setClusterFilter(toggleSet(clusterFilter, v))}
              onClear={() => {
                setClusterFilter(new Set());
                setLocationFilter(new Set());
              }}
            />
            <FilterPicker<string>
              title="Location"
              options={locationOptions}
              selected={locationFilter}
              onToggle={(v) => setLocationFilter(toggleSet(locationFilter, v))}
              onClear={() => setLocationFilter(new Set())}
            />
            <FilterPicker<DepartmentType>
              title="Type"
              options={DEPT_TYPE_OPTIONS}
              selected={typeFilter}
              onToggle={(v) => setTypeFilter(toggleSet(typeFilter, v))}
              onClear={() => setTypeFilter(new Set())}
            />
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setClusterFilter(new Set());
                  setLocationFilter(new Set());
                  setTypeFilter(new Set());
                  setSearch('');
                }}
                aria-label="Reset all filters"
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
              aria-label="Search departments by name or code"
              placeholder="Search by name or code"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Inline dialog (edit / deactivate) ──────────────────────────── */}
        {dialog.kind !== 'none' ? (
          <div className="mt-4">
            <Card className="p-0 max-w-md">
              {dialog.kind === 'edit' ? (
                <EditDialog row={dialog.row} onClose={() => setDialog({ kind: 'none' })} />
              ) : (
                <DeactivateDialog row={dialog.row} onClose={() => setDialog({ kind: 'none' })} />
              )}
            </Card>
          </div>
        ) : null}

        {/* ── Desktop table — hidden on mobile ─────────────────────────────── */}
        <Card className="mt-4 p-0 hidden sm:block">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Departments</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${sorted.length} of ${totalCount}`}
            </span>
          </div>
          <SectionShift tone="low" aria-hidden />

          {isLoading ? (
            <TableSkeleton />
          ) : fetchError ? null : sorted.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-semibold text-on-surface">
                No departments match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the filters above or clear them to see every department.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {TABLE_COLS.map(({ col, label }) => (
                      <TableHead key={col} scope="col">
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          aria-label={`Sort by ${label}`}
                          aria-sort={
                            sortColumn === col
                              ? sortDirection === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                          className="inline-flex items-center gap-1 text-left font-medium hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm min-h-[36px]"
                        >
                          {label}
                          <SortIcon col={col} sortColumn={sortColumn} sortDirection={sortDirection} />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead scope="col" className="w-12" aria-label="Row actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <TableCell>
                        <span
                          className={
                            row.active
                              ? 'font-medium text-on-surface'
                              : 'font-medium text-on-surface-variant line-through'
                          }
                        >
                          {row.name}
                        </span>
                        {row.code ? (
                          <span className="ml-2 font-mono text-[11px] text-on-surface-variant">
                            {row.code}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <TypePill type={row.type} />
                      </TableCell>
                      <TableCell className="text-on-surface-variant text-xs">
                        <div className="flex flex-col">
                          <span className="text-on-surface text-sm">{row.locationName}</span>
                          <span className="text-[11px]">
                            {LOCATION_TYPE_LABEL[row.locationType] ?? row.locationType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-on-surface-variant text-xs">
                        {row.clusterName}
                      </TableCell>
                      <TableCell>
                        <ActiveStatusPill active={row.active} />
                      </TableCell>
                      <TableCell className="tabular-nums text-on-surface-variant text-xs">
                        {row.createdAt}
                      </TableCell>
                      <TableCell className="tabular-nums text-on-surface-variant text-xs">
                        {row.updatedAt}
                      </TableCell>
                      <TableCell>
                        <RowActionMenu
                          row={row}
                          onEdit={() => setDialog({ kind: 'edit', row })}
                          onDeactivate={() => setDialog({ kind: 'deactivate', row })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* ── Mobile card list — chevron-toggle pattern ─────────────────────── */}
        <div className="mt-4 flex flex-col gap-2 sm:hidden">
          <div className="px-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Departments</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${sorted.length} of ${totalCount}`}
            </span>
          </div>
          {isLoading ? (
            <CardSkeleton />
          ) : fetchError ? null : sorted.length === 0 ? (
            <Card>
              <CardContent className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-on-surface">
                  No departments match the current filter.
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Adjust the filters above or clear them to see every department.
                </p>
              </CardContent>
            </Card>
          ) : (
            sorted.map((row) => {
              const expanded = expandedCardId === row.id;
              return (
                <Card key={row.id} className="p-0">
                  <div className="p-3 flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedCardId(expanded ? null : row.id)}
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? `Collapse details for ${row.name}`
                          : `Expand details for ${row.name}`
                      }
                      className="flex flex-1 items-start gap-2 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm shrink-0">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
                        )}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              row.active
                                ? 'font-medium text-on-surface'
                                : 'font-medium text-on-surface-variant line-through'
                            }
                          >
                            {row.name}
                          </span>
                          <TypePill type={row.type} />
                        </div>
                        <span className="text-[11px] text-on-surface-variant">
                          {row.locationName}
                        </span>
                      </div>
                    </button>
                    <RowActionMenu
                      row={row}
                      onEdit={() => setDialog({ kind: 'edit', row })}
                      onDeactivate={() => setDialog({ kind: 'deactivate', row })}
                    />
                  </div>
                  {expanded ? (
                    <>
                      <SectionShift tone="low" aria-hidden />
                      <CardContent className="p-3">
                        <dl className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Code
                            </dt>
                            <dd className="mt-0.5 font-mono text-on-surface">
                              {row.code ?? '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Cluster
                            </dt>
                            <dd className="mt-0.5 text-on-surface">{row.clusterName}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Status
                            </dt>
                            <dd className="mt-0.5">
                              <ActiveStatusPill active={row.active} />
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Location type
                            </dt>
                            <dd className="mt-0.5 text-on-surface">
                              {LOCATION_TYPE_LABEL[row.locationType] ?? row.locationType}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Created
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-on-surface">{row.createdAt}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Last modified
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-on-surface">{row.updatedAt}</dd>
                          </div>
                        </dl>
                      </CardContent>
                    </>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>

        {/* ── Quick-link to material enablement ─────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/mdm/hierarchy"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View org hierarchy
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* ── Inventory schema footer panel ─────────────────────────────────── */}
        <Card className="mt-8 p-0">
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            aria-expanded={schemaOpen}
            aria-controls="inventory-schema-panel"
            className="flex w-full items-center justify-between gap-2 p-4 sm:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <div>
              <CardTitle className="text-base text-on-surface">Inventory schema</CardTitle>
              <p className="mt-1 text-xs text-on-surface-variant">
                The 12 canonical schema fields surfaced for SI-MDM-002 per
                _planning/05-screen-inventory.md (Tier 2 acceptance, DL-025).
              </p>
            </div>
            {schemaOpen ? (
              <ChevronDown className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
            )}
          </button>
          {schemaOpen ? (
            <>
              <SectionShift tone="low" aria-hidden />
              <CardContent id="inventory-schema-panel" className="p-4 sm:p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      1 · Primary epic
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">Epic 1 — Master Data Management</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      2 · Primary device
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      responsive-equal — desktop = sortable table; mobile = card list with collapsible metadata
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      3 · Roles &amp; scope
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner (brand) / Cluster Manager (cluster) / Store Manager (location/department)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      4 · Purpose
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Provide a searchable register of all departments across the brand, filterable to
                      cluster or location scope, with type classification.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      5 · Data displayed
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Department name; code; type (Production / Dispatch / Non-Production / Store);
                      parent location name and cluster; active status; creation date; last-modified date;
                      row action menu (rename, deactivate).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      6 · User actions
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Filter by cluster, location, type; search by name or code; rename department;
                      deactivate department.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      7 · Cross-cutting
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">CC-AUDIT-LINK, CC-DRAFT-PILL (for inline editing).</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      8 · Tokens (DESIGN.md)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface, on_surface_variant,
                      status_confirmed (active pill), status_inactive (deactivated pill),
                      surface_container_high, outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      9 · Source FRs
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR1 (department part of hierarchy); FR2 (department type classification visible on row).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      10 · Source journey(s)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner / Cluster Manager — department onboarding &amp; type classification
                      (admin/setup surface; no operational journey moment).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      11 · Related screens
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      parent: SI-MDM-001 (hierarchy view); sibling: SI-MDM-004 (material enablement).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      12 · Notes
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Desktop = multi-column sortable table with type filtering. Mobile = card list with
                      type badge + collapsible metadata. Department type values come from FR2 enumeration
                      (Production / Dispatch / Non-Production / Store).
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </>
          ) : null}
        </Card>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Workflow className="h-3 w-3" aria-hidden />
          <span>Tier 2 admin / setup surface · register-and-filter pattern paired with SI-MDM-001 hierarchy.</span>
          <span className="ml-auto">SI-MDM-002 · Tier 2 · Phase 4 Epic 1 Arc (c)</span>
        </footer>
      </div>
    </div>
  );
}
