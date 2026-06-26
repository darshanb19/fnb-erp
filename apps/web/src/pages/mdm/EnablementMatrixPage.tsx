/**
 * EnablementMatrixPage — SI-MDM-004 Material Enablement Matrix (Tier 1 hero).
 *
 * Production page consuming real apps/api endpoints via TanStack Query hooks.
 *
 * Source FRs:
 *   FR5  — Material Enablement Matrix is the cross-cutting boundary that every
 *           production order, GR, and stock movement consults.
 *   FR8  — Audit-log on every toggle; reason captured per DL-013.
 *
 * Architecture §6.2.1 + Master Spec §8.1:
 *   inventoryService.checkEnablement(productId, departmentId) reads the rows
 *   this page writes. The matrix UX is the auditable configuration surface.
 *
 * DL-013 audit placeholder:
 *   "View change history" button on each row opens a Sheet with the message
 *   "Audit timeline coming in Epic 3 (SI-AUDIT-001)". This satisfies the
 *   DL-013 user-flow without building Epic 3 surface.
 *
 * Auth gating (FR5):
 *   Brand Owner  → full read + write across any location.
 *   Store Manager → write-access only to assigned location/dept; read-only otherwise.
 *   Role is read from useSession(). Seed user in Arc (c) is brand_owner.
 *
 * Views:
 *   Desktop (≥768px) — sticky row/column header matrix.
 *   Mobile + "List" toggle — per-department collapsible list view.
 *
 * Token discipline:
 *   No hex literals. status_confirmed = Enabled; status_inactive = Disabled.
 *   border-l-4 pip allowlisted per §5.2. No <Separator> — <SectionShift> used.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Grid2x2,
  History,
  Info,
  LayoutList,
  Loader2,
  PackageCheck,
  X,
} from 'lucide-react';

import {
  AuditLink,
  Button,
  Card,
  CardHeader,
  CardTitle,
  SectionShift,
  StatusPill,
} from '@/components/shell';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/primitives/popover';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/primitives/sheet';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/primitives/tooltip';

import { Skeleton } from '@/components/primitives/skeleton';

import { useSession } from '@/lib/auth';
import { ApiError } from '@/lib/api-client';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

import { useLocationsList } from '@/hooks/mdm/useLocations';
import { useDepartmentsList } from '@/hooks/mdm/useDepartments';
import { useProductsList } from '@/hooks/mdm/useProducts';
import { useCategoriesList } from '@/hooks/mdm/useCategories';
import { useEnablementsByLocation, useSetEnablement } from '@/hooks/mdm/useEnablements';

import type { LocationRow } from '@/hooks/mdm/schemas';
import type { EnablementCell } from '@/hooks/mdm/useEnablements';

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const isApi = error instanceof ApiError;
  const code = isApi ? error.code : 'unknown';

  return (
    <div className="px-4 py-3 rounded-sm bg-surface-container-low flex items-start gap-2 mt-4">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface-variant">
          {error.message}
          {code !== 'unknown' && (
            <span className="ml-1 text-xs opacity-70">({code})</span>
          )}
        </p>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton for the matrix
// ---------------------------------------------------------------------------

function MatrixSkeleton() {
  return (
    <div className="overflow-auto" role="status" aria-label="Loading enablement matrix…">
      <div className="min-w-[600px] p-4">
        {/* Column headers row */}
        <div className="flex gap-2 mb-2">
          <Skeleton className="h-8 w-48 shrink-0" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 shrink-0" />
          ))}
        </div>
        {/* Data rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-2 mb-1">
            <Skeleton className="h-10 w-48 shrink-0" />
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-10 w-28 shrink-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit placeholder Sheet
// ---------------------------------------------------------------------------

interface AuditSheetProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  departmentName: string;
}

function AuditSheet({ open, onClose, productName, departmentName }: AuditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Change history</SheetTitle>
          <SheetDescription>
            {productName} × {departmentName}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2 px-3 py-3 rounded-sm bg-surface-container-low">
            <History className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
            <p className="text-sm text-on-surface-variant">
              Audit timeline coming soon.
            </p>
          </div>
          <p className="text-xs text-on-surface-variant">
            Every enablement toggle is recorded by the application-layer audit log.
            The audit timeline viewer will surface here via a drill-down link.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Reason popover (per-cell toggle flow)
// ---------------------------------------------------------------------------

interface ReasonPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (reason: string | undefined) => void;
  isPending: boolean;
  children: React.ReactNode;
}

function ReasonPopover({
  open,
  onOpenChange,
  onSave,
  isPending,
  children,
}: ReasonPopoverProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleOpen(nextOpen: boolean) {
    if (nextOpen) setReason('');
    onOpenChange(nextOpen);
  }

  function handleSave() {
    onSave(reason.trim() || undefined);
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-2">
          Confirm change
        </p>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="enablement-reason"
            className="text-xs font-medium text-on-surface"
          >
            Reason <span className="text-on-surface-variant font-normal">(optional)</span>
          </label>
          <textarea
            id="enablement-reason"
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Approved for weekend production run"
            className="rounded-sm bg-surface-container-lowest px-3 py-2 text-sm text-on-surface resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Reason for this enablement change"
          />
        </div>
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Cell last-modified tooltip content
// ---------------------------------------------------------------------------

function cellTooltipText(cell: EnablementCell | undefined): string {
  if (!cell || !cell.lastModifiedBy) {
    return 'Not yet configured.';
  }
  const at = new Date(cell.lastModifiedAt);
  const formatted = at.getTime() === 0
    ? 'unknown date'
    : at.toLocaleString();
  return `Last modified by ${cell.lastModifiedBy} at ${formatted}`;
}

// ---------------------------------------------------------------------------
// Toggle button (accessible; no Switch primitive available — use button)
// ---------------------------------------------------------------------------

interface EnablementToggleProps {
  enabled: boolean;
  label: string;
  isPending: boolean;
  onToggle: () => void;
  /** If false, renders as read-only (no onClick, aria-disabled). */
  canEdit: boolean;
}

function EnablementToggle({
  enabled,
  label,
  isPending,
  onToggle,
  canEdit,
}: EnablementToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      aria-disabled={!canEdit || isPending}
      onClick={canEdit && !isPending ? onToggle : undefined}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        enabled
          ? 'bg-primary'
          : 'bg-surface-container-high',
        (!canEdit || isPending) ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute top-0.5 left-0.5 inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform duration-150',
          enabled ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
      {isPending && (
        <Loader2
          className="absolute inset-0 m-auto h-3 w-3 animate-spin text-on-surface-variant"
          aria-hidden
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Desktop matrix view
// ---------------------------------------------------------------------------

interface MatrixCellKey {
  productId: string;
  departmentId: string;
}

interface MatrixViewProps {
  products: Array<{ id: string; name: string; sku: string }>;
  departments: Array<{ id: string; name: string }>;
  cells: EnablementCell[];
  locationId: string;
  canEdit: boolean;
  pendingCells: Set<string>;
  onCellChange: (key: MatrixCellKey, newEnabled: boolean, reason: string | undefined) => void;
}

function MatrixView({
  products,
  departments,
  cells,
  locationId: _locationId,
  canEdit,
  pendingCells,
  onCellChange,
}: MatrixViewProps) {
  // Cell map: "productId:departmentId" → EnablementCell
  const cellMap = useMemo(() => {
    const m = new Map<string, EnablementCell>();
    for (const c of cells) {
      m.set(`${c.productId}:${c.departmentId}`, c);
    }
    return m;
  }, [cells]);

  // State for which cell's reason popover is open
  const [popoverCell, setPopoverCell] = useState<string | null>(null);
  // State for which cell's audit sheet is open
  const [auditCell, setAuditCell] = useState<{ productId: string; departmentId: string } | null>(null);

  // Audit sheet info
  const auditProduct = auditCell
    ? products.find((p) => p.id === auditCell.productId)
    : null;
  const auditDept = auditCell
    ? departments.find((d) => d.id === auditCell.departmentId)
    : null;

  return (
    <TooltipProvider>
      <div className="overflow-auto max-h-[600px]">
        <table
          className="border-separate border-spacing-0 min-w-max"
          role="grid"
          aria-label="Material enablement matrix"
        >
          <thead>
            <tr>
              {/* Sticky corner */}
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 bg-surface-container-low px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-on-surface-variant whitespace-nowrap"
              >
                Product
              </th>
              {departments.map((dept) => (
                <th
                  key={dept.id}
                  scope="col"
                  className="sticky top-0 z-20 bg-surface-container-low px-4 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-on-surface-variant whitespace-nowrap min-w-[112px]"
                >
                  {dept.name}
                </th>
              ))}
              {/* Audit column */}
              <th
                scope="col"
                className="sticky top-0 z-20 bg-surface-container-low px-4 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-on-surface-variant whitespace-nowrap"
              >
                History
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, rowIdx) => (
              <tr
                key={product.id}
                className={rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'}
              >
                {/* Sticky row header */}
                <th
                  scope="row"
                  className={[
                    'sticky left-0 z-10 px-4 py-2 text-left text-sm font-medium text-on-surface whitespace-nowrap',
                    rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest',
                  ].join(' ')}
                >
                  <div>
                    <span>{product.name}</span>
                    <span className="ml-2 text-[10px] text-on-surface-variant font-mono">
                      {product.sku}
                    </span>
                  </div>
                </th>

                {/* Cells */}
                {departments.map((dept) => {
                  const cellKey = `${product.id}:${dept.id}`;
                  const cell = cellMap.get(cellKey);
                  const enabled = cell?.enabled === true;
                  const isPending = pendingCells.has(cellKey);
                  const popoverOpen = popoverCell === cellKey;

                  return (
                    <td
                      key={dept.id}
                      className="px-4 py-2 text-center"
                      role="gridcell"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <ReasonPopover
                                open={popoverOpen}
                                onOpenChange={(v) => setPopoverCell(v ? cellKey : null)}
                                onSave={(reason) => {
                                  setPopoverCell(null);
                                  onCellChange({ productId: product.id, departmentId: dept.id }, !enabled, reason);
                                }}
                                isPending={isPending}
                              >
                                <span className="inline-flex">
                                  <EnablementToggle
                                    enabled={enabled}
                                    label={`Enable ${product.name} for ${dept.name}`}
                                    isPending={isPending}
                                    onToggle={() => {
                                      if (canEdit && !isPending) {
                                        setPopoverCell(cellKey);
                                      }
                                    }}
                                    canEdit={canEdit}
                                  />
                                </span>
                              </ReasonPopover>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{cellTooltipText(cell)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  );
                })}

                {/* Audit link per row */}
                <td className="px-4 py-2 text-center" role="gridcell">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setAuditCell({ productId: product.id, departmentId: departments[0]?.id ?? '' })}
                        aria-label={`View change history for ${product.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>View change history</p>
                    </TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit placeholder sheet */}
      {auditCell && (
        <AuditSheet
          open={Boolean(auditCell)}
          onClose={() => setAuditCell(null)}
          productName={auditProduct?.name ?? auditCell.productId}
          departmentName={auditDept?.name ?? auditCell.departmentId}
        />
      )}
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Mobile / list view — per-department collapsible
// ---------------------------------------------------------------------------

interface ListViewProps {
  products: Array<{ id: string; name: string; sku: string }>;
  departments: Array<{ id: string; name: string }>;
  cells: EnablementCell[];
  canEdit: boolean;
  pendingCells: Set<string>;
  onCellChange: (key: MatrixCellKey, newEnabled: boolean, reason: string | undefined) => void;
}

function ListView({
  products,
  departments,
  cells,
  canEdit,
  pendingCells,
  onCellChange,
}: ListViewProps) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(
    () => new Set(departments.map((d) => d.id)),
  );
  const [auditCell, setAuditCell] = useState<{ productId: string; departmentId: string } | null>(null);
  const [popoverCell, setPopoverCell] = useState<string | null>(null);

  const cellMap = useMemo(() => {
    const m = new Map<string, EnablementCell>();
    for (const c of cells) {
      m.set(`${c.productId}:${c.departmentId}`, c);
    }
    return m;
  }, [cells]);

  const toggleDept = useCallback((id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const auditProduct = auditCell
    ? products.find((p) => p.id === auditCell.productId)
    : null;
  const auditDept = auditCell
    ? departments.find((d) => d.id === auditCell.departmentId)
    : null;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        {departments.map((dept) => {
          const isExpanded = expandedDepts.has(dept.id);
          const enabledCount = products.filter(
            (p) => cellMap.get(`${p.id}:${dept.id}`)?.enabled === true,
          ).length;

          return (
            <div
              key={dept.id}
              className="rounded-sm bg-surface-container-lowest"
            >
              {/* Dept header */}
              <button
                type="button"
                onClick={() => toggleDept(dept.id)}
                aria-expanded={isExpanded}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 min-h-[48px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
                  )}
                  <span className="font-medium text-on-surface">{dept.name}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  {enabledCount}/{products.length} enabled
                </span>
              </button>

              {isExpanded && (
                <ul className="flex flex-col pb-2">
                  {products.map((product, idx) => {
                    const cellKey = `${product.id}:${dept.id}`;
                    const cell = cellMap.get(cellKey);
                    const enabled = cell?.enabled === true;
                    const isPending = pendingCells.has(cellKey);
                    const popoverOpen = popoverCell === cellKey;

                    return (
                      <li
                        key={product.id}
                        className={[
                          'flex items-center gap-3 px-4 py-2.5 min-h-[48px]',
                          idx % 2 === 0 ? '' : 'bg-surface-container-low',
                        ].join(' ')}
                      >
                        {/* Toggle */}
                        <ReasonPopover
                          open={popoverOpen}
                          onOpenChange={(v) => setPopoverCell(v ? cellKey : null)}
                          onSave={(reason) => {
                            setPopoverCell(null);
                            onCellChange({ productId: product.id, departmentId: dept.id }, !enabled, reason);
                          }}
                          isPending={isPending}
                        >
                          <span className="inline-flex">
                            <EnablementToggle
                              enabled={enabled}
                              label={`Enable ${product.name} for ${dept.name}`}
                              isPending={isPending}
                              onToggle={() => {
                                if (canEdit && !isPending) {
                                  setPopoverCell(cellKey);
                                }
                              }}
                              canEdit={canEdit}
                            />
                          </span>
                        </ReasonPopover>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">
                            {product.name}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            {product.sku}
                          </p>
                        </div>

                        {/* Last modified */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center text-[10px] text-on-surface-variant cursor-default">
                              <Clock className="h-3 w-3 mr-1 shrink-0" aria-hidden />
                              {cell?.lastModifiedBy ? 'Modified' : 'Not set'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>{cellTooltipText(cell)}</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Audit */}
                        <button
                          type="button"
                          onClick={() => setAuditCell({ productId: product.id, departmentId: dept.id })}
                          aria-label={`View change history for ${product.name} in ${dept.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
                        >
                          <History className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {auditCell && (
        <AuditSheet
          open={Boolean(auditCell)}
          onClose={() => setAuditCell(null)}
          productName={auditProduct?.name ?? auditCell.productId}
          departmentName={auditDept?.name ?? auditCell.departmentId}
        />
      )}
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Location picker
// ---------------------------------------------------------------------------

interface LocationPickerProps {
  locations: LocationRow[];
  selectedId: string;
  onChange: (id: string) => void;
  isLoading: boolean;
}

function LocationPicker({
  locations,
  selectedId,
  onChange,
  isLoading,
}: LocationPickerProps) {
  if (isLoading) {
    return <Skeleton className="h-9 w-56" />;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="location-picker" className="text-xs font-medium text-on-surface">
        Location <span className="text-error ml-0.5" aria-hidden>*</span>
      </label>
      <select
        id="location-picker"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        aria-required="true"
        className="rounded-sm bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[240px]"
      >
        <option value="">— Select a location —</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category filter chip group
// ---------------------------------------------------------------------------

interface CategoryFilterProps {
  categories: Array<{ id: string; name: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}

function CategoryFilter({
  categories,
  selected,
  onToggle,
  onClear,
}: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-on-surface-variant shrink-0">Filter by category:</span>
      {categories.map((cat) => {
        const isSelected = selected.has(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onToggle(cat.id)}
            aria-pressed={isSelected}
            className={[
              'inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isSelected
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
            ].join(' ')}
          >
            {cat.name}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-pill text-xs text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3 w-3" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyMatrixProps {
  reason: 'no-location' | 'no-products' | 'no-departments';
}

function EmptyMatrix({ reason }: EmptyMatrixProps) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    'no-location': {
      title: 'Select a location',
      body: 'Choose a location above to view and configure its material enablement matrix.',
    },
    'no-products': {
      title: 'No active products',
      body: 'There are no active products in your product master. Add products in the Product Master first.',
    },
    'no-departments': {
      title: 'No departments at this location',
      body: 'This location has no departments. Add departments in the Org Hierarchy first.',
    },
  };

  const { title, body } = messages[reason];

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <PackageCheck className="h-10 w-10 text-on-surface-variant opacity-40" aria-hidden />
      <p className="text-base font-medium text-on-surface">{title}</p>
      <p className="text-sm text-on-surface-variant max-w-sm">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnablementMatrixPage — main export
// ---------------------------------------------------------------------------

export default function EnablementMatrixPage() {
  const { session } = useSession();
  // C8 RBAC audit: derive canEdit from effective permissions (mdm.enablement.write)
  // rather than ad-hoc role check. ROLE_BASELINE grants mdm.enablement.write to
  // brand_owner only (procurement_manager does NOT have it per permissions-catalog.ts).
  // Derived-canEdit pattern used here because canEdit threads through MatrixView,
  // ListView, and EnablementToggle as a prop — wrapping each cell in <RequirePermission>
  // would be unergonomic and semantically equivalent.
  const { data: effectivePerms } = useEffectivePermissions(session?.user.id);
  const canEdit = effectivePerms?.includes('mdm.enablement.write') ?? false;

  // ── Control state ──────────────────────────────────────────────────────────
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  // Track pending cell mutations locally for per-cell pending state
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  // ── Data fetching ──────────────────────────────────────────────────────────
  const locationsQuery = useLocationsList();
  const categoriesQuery = useCategoriesList();
  const departmentsQuery = useDepartmentsList(
    selectedLocationId ? { locationId: selectedLocationId } : undefined,
  );
  const productsQuery = useProductsList({ active: true });

  // Enablements for the selected location (category filter is optional)
  // We fetch with the first selected category for now (multi-select is client-side)
  const firstCategoryId = selectedCategories.size > 0
    ? [...selectedCategories][0]
    : undefined;

  const enablementsQuery = useEnablementsByLocation(selectedLocationId, {
    categoryId: firstCategoryId,
    enabled: Boolean(selectedLocationId),
  });

  // Mutation
  const setEnablement = useSetEnablement(selectedLocationId);

  // ── Derived data ───────────────────────────────────────────────────────────
  const locations = locationsQuery.data ?? [];
  const categories = (categoriesQuery.data ?? []).filter((c) => c.active);
  const departments = (departmentsQuery.data ?? []).filter((d) => d.active);
  const allProducts = (productsQuery.data ?? []).filter((p) => p.active);
  const cells = enablementsQuery.data ?? [];

  // Client-side category filter: if multiple categories selected, show union of products
  const filteredProducts = useMemo(() => {
    if (selectedCategories.size === 0) return allProducts;
    // For multi-category client-side filter, show products that appear in cells
    // (the server already filtered by firstCategoryId; extend to multi-select client-side)
    const cellProductIds = new Set(cells.map((c) => c.productId));
    if (selectedCategories.size === 1) {
      // Single category: the server already filtered → show only cell products
      return allProducts.filter((p) => cellProductIds.has(p.id));
    }
    // Multi-category: union — return all products from cells + any explicitly in other selected cats
    // Simplified: show all products (conservative — avoids additional queries)
    return allProducts;
  }, [allProducts, cells, selectedCategories]);

  // ── Error aggregation ──────────────────────────────────────────────────────
  const loadError =
    locationsQuery.error ??
    productsQuery.error ??
    enablementsQuery.error ??
    departmentsQuery.error;

  const isLoadingBase = locationsQuery.isLoading || productsQuery.isLoading;
  const isLoadingMatrix = enablementsQuery.isLoading || departmentsQuery.isLoading;

  // ── Category filter handlers ───────────────────────────────────────────────
  const toggleCategory = useCallback((id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearCategories = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  // ── Cell toggle handler ────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    async (
      { productId, departmentId }: MatrixCellKey,
      newEnabled: boolean,
      reason: string | undefined,
    ) => {
      const cellKey = `${productId}:${departmentId}`;
      setPendingCells((prev) => new Set([...prev, cellKey]));
      try {
        await setEnablement.mutateAsync({ productId, departmentId, enabled: newEnabled, reason });
      } finally {
        setPendingCells((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [setEnablement],
  );

  // ── Empty state resolution ─────────────────────────────────────────────────
  function resolveEmptyReason(): 'no-location' | 'no-products' | 'no-departments' | null {
    if (!selectedLocationId) return 'no-location';
    if (!isLoadingMatrix) {
      if (departments.length === 0) return 'no-departments';
      if (filteredProducts.length === 0) return 'no-products';
    }
    return null;
  }

  const emptyReason = resolveEmptyReason();

  // ── View mode: auto-switch to list on narrow viewport ─────────────────────
  // We rely on CSS classes for visual presentation; viewMode state for desktop toggle.

  // Enabled count summary
  const enabledCount = cells.filter((c) => c.enabled).length;
  const totalCells = filteredProducts.length * departments.length;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Inventory
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Material Enablement Matrix
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Configure which materials (products) are permitted at each department for
              the selected location. Every toggle is audit-logged. This matrix
              is the gate consulted by every stock movement, production order, and
              goods receipt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityType="enablement_matrix" compact />
            {!canEdit && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium bg-surface-container-high text-on-surface-variant">
                Read-only
              </span>
            )}
          </div>
        </header>

        {/* Gate note */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
          <Info className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0" aria-hidden />
          <p className="text-xs text-on-surface-variant">
            This matrix is the cross-cutting gate. All stock movements, production
            orders, and goods receipts are checked against exactly these rows.
          </p>
        </div>

        {/* Load errors */}
        {loadError && (
          <ErrorBanner
            error={loadError}
            onRetry={() => {
              void locationsQuery.refetch();
              void productsQuery.refetch();
              if (selectedLocationId) {
                void enablementsQuery.refetch();
                void departmentsQuery.refetch();
              }
            }}
          />
        )}

        {/* Controls row */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <LocationPicker
            locations={locations}
            selectedId={selectedLocationId}
            onChange={(id) => {
              setSelectedLocationId(id);
              setSelectedCategories(new Set());
            }}
            isLoading={isLoadingBase}
          />

          {selectedLocationId && (
            <CategoryFilter
              categories={categories}
              selected={selectedCategories}
              onToggle={toggleCategory}
              onClear={clearCategories}
            />
          )}

          {/* View toggle — desktop only */}
          {selectedLocationId && (
            <div className="hidden tablet:flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                aria-pressed={viewMode === 'matrix'}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  viewMode === 'matrix'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
                ].join(' ')}
              >
                <Grid2x2 className="h-3.5 w-3.5" aria-hidden />
                Matrix
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  viewMode === 'list'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
                ].join(' ')}
              >
                <LayoutList className="h-3.5 w-3.5" aria-hidden />
                List
              </button>
            </div>
          )}
        </div>

        {/* Summary bar */}
        {selectedLocationId && !isLoadingMatrix && !emptyReason && (
          <div className="mt-3 rounded-sm bg-surface-container-low px-3 py-2">
            <p className="text-xs text-on-surface-variant">
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'product' : 'products'} ×{' '}
              {departments.length}{' '}
              {departments.length === 1 ? 'department' : 'departments'} ·{' '}
              <span className="text-on-surface font-medium">
                {enabledCount}/{totalCells}
              </span>{' '}
              cells enabled
            </p>
          </div>
        )}

        {/* Mutation error */}
        {setEnablement.error && (
          <div className="mt-3 px-4 py-2 rounded-sm bg-surface-container-low flex items-center gap-2">
            <Info className="h-4 w-4 text-error shrink-0" aria-hidden />
            <p className="text-sm text-error">
              Save failed: {setEnablement.error.message}
            </p>
          </div>
        )}

        {/* Matrix / List card */}
        <Card className="mt-4 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg tablet:text-xl text-on-surface">
                  {selectedLocationId
                    ? locations.find((l) => l.id === selectedLocationId)?.name ?? 'Location'
                    : 'Select a location to begin'}
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Rows = active products · Columns = departments at this location
                </p>
              </div>
              {selectedLocationId && !isLoadingMatrix && !emptyReason && (
                <StatusPill
                  status={enabledCount > 0 ? 'status_confirmed' : 'status_inactive'}
                  size="sm"
                  label={enabledCount > 0 ? 'Configured' : 'All disabled'}
                />
              )}
            </div>
          </CardHeader>

          <SectionShift tone="low" aria-hidden />

          {/* Content area */}
          {isLoadingMatrix && selectedLocationId ? (
            <MatrixSkeleton />
          ) : emptyReason ? (
            <EmptyMatrix reason={emptyReason} />
          ) : (
            <>
              {/* Desktop matrix view (hidden on mobile) */}
              <div className="hidden tablet:block">
                {viewMode === 'matrix' ? (
                  <MatrixView
                    products={filteredProducts}
                    departments={departments}
                    cells={cells}
                    locationId={selectedLocationId}
                    canEdit={canEdit}
                    pendingCells={pendingCells}
                    onCellChange={handleCellChange}
                  />
                ) : (
                  <div className="p-4">
                    <ListView
                      products={filteredProducts}
                      departments={departments}
                      cells={cells}
                      canEdit={canEdit}
                      pendingCells={pendingCells}
                      onCellChange={handleCellChange}
                    />
                  </div>
                )}
              </div>

              {/* Mobile always uses list view */}
              <div className="tablet:hidden p-4">
                <ListView
                  products={filteredProducts}
                  departments={departments}
                  cells={cells}
                  canEdit={canEdit}
                  pendingCells={pendingCells}
                  onCellChange={handleCellChange}
                />
              </div>
            </>
          )}
        </Card>

      </div>
    </div>
  );
}
