/**
 * VendorsPage — SI-MDM-005 Vendor Master list view.
 *
 * Tier 2 acceptance applies (lighter chrome bar than Tier 1 hero screens).
 *
 * Source FRs:
 *   FR6 — vendor CRUD (name, code, GSTIN, PAN, scope, contact, address, active)
 *   Master Spec §2.7 — vendor scope hierarchy (Brand > Cluster > POS)
 *
 * Token discipline:
 *   No hex literals. status_confirmed = Active; status_inactive = Deactivated.
 *   No <Separator> — <SectionShift> for tonal breaks.
 *   border-l-4 pip allowlisted per §5.2.
 */

import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Search,
  Truck,
  X,
} from 'lucide-react';

import {
  AuditLink,
  Button,
  Card,
  CardContent,
  CardTitle,
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
import RequirePermission from '@/lib/RequirePermission';
import { useVendorsList } from '@/hooks/mdm/useVendors';
import { useClustersList } from '@/hooks/mdm/useClusters';
import { useLocationsList } from '@/hooks/mdm/useLocations';
import type { VendorRow, VendorScope } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_LABEL: Record<VendorScope, string> = {
  brand: 'Brand',
  cluster: 'Cluster',
  pos: 'POS',
};

type SortColumn = 'name' | 'code' | 'scope' | 'gstin' | 'contact' | 'status' | 'modified';
type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Joined row type
// ---------------------------------------------------------------------------

interface VendorListRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly scope: VendorScope;
  readonly scopeLabel: string;
  readonly gstin: string | null;
  readonly contactPerson: string | null;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly active: boolean;
  readonly preferred: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function buildScopeLabel(
  vendor: VendorRow,
  clusterById: Map<string, string>,
  locationById: Map<string, string>,
): string {
  if (vendor.scope === 'brand') return 'Brand — all locations';
  if (vendor.scope === 'cluster') {
    const name = vendor.scopeClusterId ? clusterById.get(vendor.scopeClusterId) : undefined;
    return name ? `Cluster · ${name}` : 'Cluster';
  }
  if (vendor.scope === 'pos') {
    const name = vendor.scopeLocationId ? locationById.get(vendor.scopeLocationId) : undefined;
    return name ? `POS · ${name}` : 'POS';
  }
  return SCOPE_LABEL[vendor.scope];
}

function joinRows(
  vendors: VendorRow[],
  clusterById: Map<string, string>,
  locationById: Map<string, string>,
): VendorListRow[] {
  return vendors.map((v) => ({
    id: v.id,
    code: v.code,
    name: v.name,
    scope: v.scope,
    scopeLabel: buildScopeLabel(v, clusterById, locationById),
    gstin: v.gstin,
    contactPerson: v.contactPerson,
    contactPhone: v.contactPhone,
    contactEmail: v.contactEmail,
    active: v.active,
    preferred: v.preferred,
    createdAt: v.createdAt.slice(0, 10),
    updatedAt: v.updatedAt.slice(0, 10),
  }));
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

function ScopePill({ scope, label }: { readonly scope: VendorScope; readonly label: string }) {
  const cls =
    scope === 'brand'
      ? 'bg-primary-container text-on-primary-container'
      : scope === 'cluster'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-surface-variant';
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium truncate max-w-[160px] ${cls}`}
      title={label}
    >
      {label}
    </span>
  );
}

interface RowActionMenuProps {
  readonly row: VendorListRow;
  readonly onEdit: () => void;
}

function RowActionMenu({ row, onEdit }: RowActionMenuProps) {
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
      <PopoverContent align="end" className="w-48 p-1">
        <ul className="flex flex-col" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit vendor
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading vendors…" className="flex flex-col gap-0">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 min-h-[48px]">
          <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
          <div className="h-3 w-20 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-28 rounded-pill bg-surface-container-high animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-16 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

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
// Main page component
// ---------------------------------------------------------------------------

export default function VendorsPage() {
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ── Mobile expand state ──────────────────────────────────────────────────
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const vendorsQuery = useVendorsList(activeOnly ? { activeOnly: true } : undefined);
  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();

  // ── Build lookup maps ──────────────────────────────────────────────────────
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

  // ── Join rows ─────────────────────────────────────────────────────────────
  const allRows = useMemo<VendorListRow[]>(() => {
    if (!vendorsQuery.data) return [];
    return joinRows(vendorsQuery.data, clusterById, locationById);
  }, [vendorsQuery.data, clusterById, locationById]);

  // ── Client-side search filter ─────────────────────────────────────────────
  const filtered = useMemo<VendorListRow[]>(() => {
    return allRows.filter((r) => {
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const hay = `${r.name} ${r.code} ${r.gstin ?? ''} ${r.contactPerson ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo<VendorListRow[]>(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':     cmp = a.name.localeCompare(b.name); break;
        case 'code':     cmp = a.code.localeCompare(b.code); break;
        case 'scope':    cmp = a.scopeLabel.localeCompare(b.scopeLabel); break;
        case 'gstin':    cmp = (a.gstin ?? '').localeCompare(b.gstin ?? ''); break;
        case 'contact':  cmp = (a.contactPerson ?? '').localeCompare(b.contactPerson ?? ''); break;
        case 'status':   cmp = Number(b.active) - Number(a.active); break;
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

  const anyFilterActive = activeOnly || search.trim().length > 0;
  const totalCount = allRows.length;
  const inactiveCount = allRows.filter((r) => !r.active).length;

  const fetchError = vendorsQuery.error;
  const isLoading = vendorsQuery.isLoading;

  const TABLE_COLS: ReadonlyArray<{ readonly col: SortColumn; readonly label: string }> = [
    { col: 'name',     label: 'Vendor' },
    { col: 'code',     label: 'Code' },
    { col: 'scope',    label: 'Scope' },
    { col: 'gstin',    label: 'GSTIN' },
    { col: 'contact',  label: 'Contact' },
    { col: 'status',   label: 'Status' },
    { col: 'modified', label: 'Last modified' },
  ];

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">

        {/* ── Page header ────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Vendors
            </p>
            <h1 className="mt-1 text-2xl sm:text-[2rem] leading-tight font-bold tracking-tight text-on-surface flex items-center gap-2">
              <Truck className="h-6 w-6 text-on-surface-variant" aria-hidden />
              Vendor Master
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {isLoading ? 'Loading…' : (
                <>
                  {totalCount} vendor{totalCount !== 1 ? 's' : ''} ·{' '}
                  {inactiveCount > 0 ? `${inactiveCount} deactivated` : 'All active'}.{' '}
                  Manage supplier scope (Brand / Cluster / POS) per §2.7.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityType="vendors" compact />
            <RequirePermission permission="mdm.vendors.write">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/mdm/vendors/new')}
                aria-label="Create new vendor"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New vendor
              </Button>
            </RequirePermission>
          </div>
        </header>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading vendors: ${fetchError.message}`
              : 'Failed to load vendors. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Filter strip ────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeOnly ? 'tonal' : 'ghost'}
              size="sm"
              className="h-9 px-3 gap-1.5 rounded-pill"
              onClick={() => setActiveOnly((v) => !v)}
              aria-pressed={activeOnly}
              aria-label={activeOnly ? 'Showing active only — click to show all' : 'Show active only'}
            >
              <span className="text-xs font-medium">Active only</span>
              {activeOnly ? (
                <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
                  1
                </span>
              ) : null}
            </Button>

            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setActiveOnly(false);
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
              aria-label="Search vendors by name, code, or GSTIN"
              placeholder="Search by name, code, or GSTIN"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Desktop table ─────────────────────────────────────────────────── */}
        <Card className="mt-4 p-0 hidden sm:block" data-view="desktop">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Vendors</h2>
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
                No vendors match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the filters above or create a new vendor.
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
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              row.active
                                ? 'font-medium text-on-surface'
                                : 'font-medium text-on-surface-variant line-through'
                            }
                          >
                            {row.name}
                          </span>
                          {row.preferred ? (
                            <span className="inline-flex items-center rounded-pill bg-primary-container px-1.5 py-0.5 text-[10px] font-semibold text-on-primary-container">
                              Preferred
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-on-surface-variant">
                        {row.code}
                      </TableCell>
                      <TableCell>
                        <ScopePill scope={row.scope} label={row.scopeLabel} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-on-surface-variant">
                        {row.gstin ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        <div className="flex flex-col gap-0.5">
                          {row.contactPerson ? (
                            <span>{row.contactPerson}</span>
                          ) : null}
                          {row.contactPhone ? (
                            <span className="text-[11px]">{row.contactPhone}</span>
                          ) : null}
                          {!row.contactPerson && !row.contactPhone ? '—' : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ActiveStatusPill active={row.active} />
                      </TableCell>
                      <TableCell className="tabular-nums text-on-surface-variant text-xs">
                        {row.updatedAt}
                      </TableCell>
                      <TableCell>
                        <RequirePermission permission="mdm.vendors.write">
                          <RowActionMenu
                            row={row}
                            onEdit={() => navigate(`/mdm/vendors/${row.id}/edit`)}
                          />
                        </RequirePermission>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* ── Mobile card list ─────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-2 sm:hidden" data-view="mobile">
          <div className="px-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Vendors</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${sorted.length} of ${totalCount}`}
            </span>
          </div>
          {isLoading ? (
            <div role="status" aria-label="Loading vendors…" className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-3">
                  <div className="h-5 w-40 rounded bg-surface-container-high animate-pulse" />
                  <div className="mt-2 h-3 w-24 rounded bg-surface-container-high animate-pulse" />
                </Card>
              ))}
            </div>
          ) : fetchError ? null : sorted.length === 0 ? (
            <Card>
              <CardContent className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-on-surface">
                  No vendors match the current filter.
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
                      aria-label={expanded ? `Collapse ${row.name}` : `Expand ${row.name}`}
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
                          <ScopePill scope={row.scope} label={row.scopeLabel} />
                        </div>
                        <span className="font-mono text-[11px] text-on-surface-variant">{row.code}</span>
                      </div>
                    </button>
                    <RequirePermission permission="mdm.vendors.write">
                      <RowActionMenu
                        row={row}
                        onEdit={() => navigate(`/mdm/vendors/${row.id}/edit`)}
                      />
                    </RequirePermission>
                  </div>
                  {expanded ? (
                    <>
                      <SectionShift tone="low" aria-hidden />
                      <CardContent className="p-3">
                        <dl className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Scope
                            </dt>
                            <dd className="mt-0.5">
                              <ScopePill scope={row.scope} label={row.scopeLabel} />
                            </dd>
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
                              GSTIN
                            </dt>
                            <dd className="mt-0.5 font-mono text-on-surface">{row.gstin ?? '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Contact
                            </dt>
                            <dd className="mt-0.5 text-on-surface">
                              {row.contactPerson ?? row.contactPhone ?? '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Last modified
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-on-surface">{row.updatedAt}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Preferred
                            </dt>
                            <dd className="mt-0.5 text-on-surface">{row.preferred ? 'Yes' : 'No'}</dd>
                          </div>
                        </dl>
                        <RequirePermission permission="mdm.vendors.write">
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => navigate(`/mdm/vendors/${row.id}/edit`)}
                            >
                              Edit vendor
                            </Button>
                          </div>
                        </RequirePermission>
                      </CardContent>
                    </>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>

        {/* ── Quick links ───────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/mdm/hierarchy"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Org hierarchy
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            to="/mdm/products"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Product Master
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* ── Inventory schema footer panel ────────────────────────────────── */}
        <InventorySchemaFooter />

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Truck className="h-3 w-3" aria-hidden />
          <span>Tier 2 · FR6 vendor CRUD + §2.7 scope hierarchy + DL-026 CC-DUPLICATE-WARN.</span>
          <span className="ml-auto">SI-MDM-005 · Tier 2 · Phase 4 Epic 1 Arc (c)</span>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory schema footer
// ---------------------------------------------------------------------------

function InventorySchemaFooter() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mt-8 p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="vendor-schema-panel"
        className="flex w-full items-center justify-between gap-2 p-4 sm:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
      >
        <div>
          <CardTitle className="text-base text-on-surface">Inventory schema</CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
            The 12 canonical schema fields for SI-MDM-005 per _planning/05-screen-inventory.md.
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
        )}
      </button>
      {open ? (
        <>
          <SectionShift tone="low" aria-hidden />
          <CardContent id="vendor-schema-panel" className="p-4 sm:p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">1 · Primary epic</dt>
                <dd className="mt-1 text-sm text-on-surface">Epic 1 — Master Data Management</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">2 · Primary device</dt>
                <dd className="mt-1 text-sm text-on-surface">responsive-equal — desktop = sortable table; mobile = card list with collapsible metadata</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">3 · Roles &amp; scope</dt>
                <dd className="mt-1 text-sm text-on-surface">Brand Owner / Procurement Manager</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">4 · Purpose</dt>
                <dd className="mt-1 text-sm text-on-surface">Create and manage the vendor registry with scope-aware access control per Master Spec §2.7.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">5 · Data displayed</dt>
                <dd className="mt-1 text-sm text-on-surface">Name; code; scope (Brand/Cluster/POS + ref); GSTIN; PAN; contact person + phone + email; address; credit terms; payment mode; preferred flag; quality rating; active status.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">6 · User actions</dt>
                <dd className="mt-1 text-sm text-on-surface">Create vendor; edit identity + scope + address + status; scope mutation with mandatory reason; deactivate with reason; filter active; search by name/code/GSTIN.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">7 · Cross-cutting</dt>
                <dd className="mt-1 text-sm text-on-surface">CC-DUPLICATE-WARN (DL-026 pg_trgm ≥ 0.85); CC-AUDIT-LINK; CC-DRAFT-PILL; §2.7 scope mutation (widening/narrowing/lateral).</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">8 · Tokens (DESIGN.md)</dt>
                <dd className="mt-1 text-sm text-on-surface">surface, surface_container_*, on_surface, on_surface_variant, status_confirmed (active), status_inactive (deactivated), status_overridden (duplicate-warn pip), primary, error, primary_container, secondary_container.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">9 · Source FRs</dt>
                <dd className="mt-1 text-sm text-on-surface">FR6 (vendor CRUD); Master Spec §2.7 (scope hierarchy + mutation rules).</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">10 · Source journey(s)</dt>
                <dd className="mt-1 text-sm text-on-surface">Procurement Manager — vendor onboarding + scope management; Brand Owner — vendor lifecycle.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">11 · Related screens</dt>
                <dd className="mt-1 text-sm text-on-surface">SI-MDM-001 (org hierarchy — cluster/POS refs); Epic 5 Purchase Orders (vendor PO history).</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">12 · Notes</dt>
                <dd className="mt-1 text-sm text-on-surface">Tier 2. §2.7 scope mutation: widening is unconditional with reason; narrowing is blocked if open transactions at dropped locations; lateral is always rejected. DL-026 CC-DUPLICATE-WARN on name input ≥3 chars after 300ms debounce. GSTIN 15-char regex; PAN 10-char regex.</dd>
              </div>
            </dl>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}
