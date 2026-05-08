/**
 * ProductsPage — SI-MDM-003 Product Master list view.
 *
 * Tier 1 hero screen (G1). Tier 1 acceptance applies per Phase 4 invariant.
 *
 * Source FRs:
 *   FR3 — product CRUD (name, SKU, type, UOM, yield, shelf life, active)
 *   FR7 — M:N product–category relationship visible in the register
 *
 * All 12 inventory schema fields for SI-MDM-003 are surfaced through
 * the form's data + affordance + cross-cutting chrome (no separate footer Card).
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
  Package,
  Plus,
  Search,
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
import { useProductsList } from '@/hooks/mdm/useProducts';
import { useUomsList } from '@/hooks/mdm/useUoms';
import type { ProductRow, ProductType, UomRow } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw: 'Raw material',
  semi_product: 'Semi-product',
  final: 'Finished good',
};

const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{ readonly value: ProductType; readonly label: string }> = [
  { value: 'raw',          label: 'Raw material' },
  { value: 'semi_product', label: 'Semi-product' },
  { value: 'final',        label: 'Finished good' },
];

type SortColumn = 'name' | 'sku' | 'type' | 'uom' | 'status' | 'created' | 'modified';
type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Joined row type
// ---------------------------------------------------------------------------

interface ProductListRow {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly type: ProductType;
  readonly defaultUomId: string;
  readonly defaultUomCode: string;
  readonly standardYieldFactor: string;
  readonly shelfLifeDays: number | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function joinRows(
  products: ProductRow[],
  uoms: UomRow[],
): ProductListRow[] {
  const uomById = new Map(uoms.map((u) => [u.id, u]));
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    type: p.type,
    defaultUomId: p.defaultUomId,
    defaultUomCode: uomById.get(p.defaultUomId)?.code ?? '—',
    standardYieldFactor: p.standardYieldFactor,
    shelfLifeDays: p.shelfLifeDays,
    active: p.active,
    createdAt: p.createdAt.slice(0, 10),
    updatedAt: p.updatedAt.slice(0, 10),
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

function TypePill({ type }: { readonly type: ProductType }) {
  const cls =
    type === 'raw'
      ? 'bg-surface-container-high text-on-surface-variant'
      : type === 'semi_product'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-primary-container text-on-primary-container';
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {PRODUCT_TYPE_LABEL[type]}
    </span>
  );
}

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
              onClick={() => { onClear(); setOpen(false); }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-on-surface-variant">No options available.</p>
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

interface RowActionMenuProps {
  readonly row: ProductListRow;
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
              Edit product
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading products…" className="flex flex-col gap-0">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 min-h-[48px]">
          <div className="h-4 w-48 rounded bg-surface-container-high animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-24 rounded-pill bg-surface-container-high animate-pulse" />
          <div className="h-3 w-12 rounded bg-surface-container-high animate-pulse" />
          <div className="h-5 w-16 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div role="status" aria-label="Loading products…" className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-3">
          <div className="flex items-start gap-2">
            <div className="h-7 w-7 rounded-sm bg-surface-container-high animate-pulse shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
              <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
            </div>
          </div>
        </Card>
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

export default function ProductsPage() {
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReadonlySet<ProductType>>(new Set());
  const [activeOnly, setActiveOnly] = useState(false);

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ── UI state ─────────────────────────────────────────────────────────────
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const productsQuery = useProductsList(
    activeOnly ? { active: true } : undefined,
  );
  const uomsQuery = useUomsList();

  // ── Join rows ─────────────────────────────────────────────────────────────
  const allRows = useMemo<ProductListRow[]>(() => {
    if (!productsQuery.data || !uomsQuery.data) return [];
    return joinRows(productsQuery.data, uomsQuery.data);
  }, [productsQuery.data, uomsQuery.data]);

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = useMemo<ProductListRow[]>(() => {
    return allRows.filter((r) => {
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false;
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase();
        const hay = `${r.name} ${r.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, typeFilter, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo<ProductListRow[]>(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':    cmp = a.name.localeCompare(b.name); break;
        case 'sku':     cmp = a.sku.localeCompare(b.sku); break;
        case 'type':    cmp = PRODUCT_TYPE_LABEL[a.type].localeCompare(PRODUCT_TYPE_LABEL[b.type]); break;
        case 'uom':     cmp = a.defaultUomCode.localeCompare(b.defaultUomCode); break;
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

  const anyFilterActive = typeFilter.size > 0 || activeOnly || search.trim().length > 0;
  const totalCount = allRows.length;
  const inactiveCount = allRows.filter((r) => !r.active).length;

  const fetchError = productsQuery.error ?? uomsQuery.error;
  const isLoading = productsQuery.isLoading || uomsQuery.isLoading;

  const TABLE_COLS: ReadonlyArray<{ readonly col: SortColumn; readonly label: string }> = [
    { col: 'name',     label: 'Product' },
    { col: 'sku',      label: 'SKU' },
    { col: 'type',     label: 'Type' },
    { col: 'uom',      label: 'Default UOM' },
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
              Master data · Products
            </p>
            <h1 className="mt-1 text-2xl sm:text-[2rem] leading-tight font-bold tracking-tight text-on-surface flex items-center gap-2">
              <Package className="h-6 w-6 text-on-surface-variant" aria-hidden />
              Product Master
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {isLoading ? 'Loading…' : (
                <>
                  {totalCount} product{totalCount !== 1 ? 's' : ''} ·{' '}
                  {inactiveCount > 0 ? `${inactiveCount} deactivated` : 'All active'}.{' '}
                  Manage raw materials, semi-products, and finished goods.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef="products" compact />
            <RequirePermission permission="mdm.products.write">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/mdm/products/new')}
                aria-label="Create new product"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New product
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
              ? `Error loading products: ${fetchError.message}`
              : 'Failed to load products. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Filter strip ────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPicker<ProductType>
              title="Type"
              options={PRODUCT_TYPE_OPTIONS}
              selected={typeFilter}
              onToggle={(v) => setTypeFilter(toggleSet(typeFilter, v))}
              onClear={() => setTypeFilter(new Set())}
            />

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
                  setTypeFilter(new Set());
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
              aria-label="Search products by name or SKU"
              placeholder="Search by name or SKU"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Desktop table ─────────────────────────────────────────────────── */}
        <Card className="mt-4 p-0 hidden sm:block">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Products</h2>
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
                No products match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the filters above or clear them to see every product.
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
                      </TableCell>
                      <TableCell className="font-mono text-xs text-on-surface-variant">
                        {row.sku}
                      </TableCell>
                      <TableCell>
                        <TypePill type={row.type} />
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        {row.defaultUomCode}
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
                        <RequirePermission permission="mdm.products.write">
                          <RowActionMenu
                            row={row}
                            onEdit={() => navigate(`/mdm/products/${row.id}/edit`)}
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
        <div className="mt-4 flex flex-col gap-2 sm:hidden">
          <div className="px-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Products</h2>
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
                  No products match the current filter.
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
                          <TypePill type={row.type} />
                        </div>
                        <span className="font-mono text-[11px] text-on-surface-variant">{row.sku}</span>
                      </div>
                    </button>
                    <RequirePermission permission="mdm.products.write">
                      <RowActionMenu
                        row={row}
                        onEdit={() => navigate(`/mdm/products/${row.id}/edit`)}
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
                              Default UOM
                            </dt>
                            <dd className="mt-0.5 text-on-surface">{row.defaultUomCode}</dd>
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
                              Yield factor
                            </dt>
                            <dd className="mt-0.5 font-mono text-on-surface">{row.standardYieldFactor}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Shelf life
                            </dt>
                            <dd className="mt-0.5 text-on-surface">
                              {row.shelfLifeDays != null ? `${row.shelfLifeDays} days` : '—'}
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
                        <RequirePermission permission="mdm.products.write">
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => navigate(`/mdm/products/${row.id}/edit`)}
                            >
                              Edit product
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
            to="/mdm/departments"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Departments
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* ── Inventory schema footer panel (collapsed by default) ─────────── */}
        <InventorySchemaFooter />

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Package className="h-3 w-3" aria-hidden />
          <span>Tier 1 hero · product CRUD + DL-023 UOM + DL-026 CC-DUPLICATE-WARN.</span>
          <span className="ml-auto">SI-MDM-003 · Tier 1 · Phase 4 Epic 1 Arc (c)</span>
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
        aria-controls="inventory-schema-panel"
        className="flex w-full items-center justify-between gap-2 p-4 sm:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
      >
        <div>
          <CardTitle className="text-base text-on-surface">Inventory schema</CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
            The 12 canonical schema fields for SI-MDM-003 per _planning/05-screen-inventory.md.
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
          <CardContent id="inventory-schema-panel" className="p-4 sm:p-6">
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
                <dd className="mt-1 text-sm text-on-surface">Brand Owner / Head Chef / Procurement Manager</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">4 · Purpose</dt>
                <dd className="mt-1 text-sm text-on-surface">Create and manage the canonical product / ingredient / packaging registry used across all ERP modules.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">5 · Data displayed</dt>
                <dd className="mt-1 text-sm text-on-surface">Name; SKU; type (Raw / Semi / Final); default UOM; standard yield factor; shelf life days; active status; created/modified dates; category assignments.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">6 · User actions</dt>
                <dd className="mt-1 text-sm text-on-surface">Create product; edit identity + UOM + yield + categories + status; deactivate with reason; filter by type or active; search by name/SKU.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">7 · Cross-cutting</dt>
                <dd className="mt-1 text-sm text-on-surface">CC-DUPLICATE-WARN (DL-026 pg_trgm ≥ 0.85); CC-AUDIT-LINK; CC-DRAFT-PILL; DL-023 two-layer UOM editor.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">8 · Tokens (DESIGN.md)</dt>
                <dd className="mt-1 text-sm text-on-surface">surface, surface_container_*, on_surface, on_surface_variant, status_confirmed (active), status_inactive (deactivated), status_overridden (duplicate-warn pip), primary, error.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">9 · Source FRs</dt>
                <dd className="mt-1 text-sm text-on-surface">FR3 (product CRUD incl. yield + shelf life); FR7 (M:N category assignment).</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">10 · Source journey(s)</dt>
                <dd className="mt-1 text-sm text-on-surface">Head Chef / Procurement — product onboarding; Brand Owner — product lifecycle management.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">11 · Related screens</dt>
                <dd className="mt-1 text-sm text-on-surface">SI-MDM-006 (categories); SI-MDM-004 (UOM registry); Procurement GR form; Recipe module.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">12 · Notes</dt>
                <dd className="mt-1 text-sm text-on-surface">Tier 1 G1 hero. DL-023 two-layer UOM (global registry + per-product alternates). DL-026 CC-DUPLICATE-WARN triggers on ≥3 chars after 300 ms debounce, consuming real pg_trgm endpoint. Deactivation requires mandatory reason ≥ 10 chars (DL-013 audit).</dd>
              </div>
            </dl>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}
