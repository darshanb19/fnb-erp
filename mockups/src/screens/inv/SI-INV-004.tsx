import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckSquare,
  CircleOff,
  Plus,
  Square,
  TrendingUp,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'

import { materials, departments, locations } from '@/lib/sample-data'

import { parLevels, type ParLevel } from '@/lib/inv-sample-data'

/**
 * SI-INV-004 — PAR Level Configuration.
 *
 * Tier 2 Group 1 (deferred), Epic 4 Arc (b). Desktop-primary configuration
 * surface for setting base PAR levels and day-of-week overrides per
 * item × location/department. Changes stage in local React state (CC-DRAFT-PILL)
 * and are committed via "Confirm changes".
 *
 * FRs: FR33 (PAR level per item × scope), FR34 (DoW overrides for weekend
 * spikes), FR111 (system drift-recommendation badge — visual only here; full
 * Epic 12 AI integration deferred).
 *
 * Cross-cutting patterns consumed:
 *   - CC-DRAFT-PILL — DraftPill shows status_draft while any cell is edited,
 *     flips to status_confirmed on "Confirm changes".
 *   - CC-AUDIT-LINK — AuditLink per row, entityRef = par-level id.
 *   - FR111 drift-recommendation badge — visual badge on two fixture rows;
 *     accept/ignore sub-affordance is visual chrome only (§11 comment below).
 *
 * Scope filters (Location vs Department), product type, category filters are
 * FilterChipPicker chrome-only; the fixture is already scoped to CK Bandra
 * Hot Kitchen + Cold Kitchen + Bakery + Tandoor departments — narrowing by
 * filter cannot meaningfully differ from "show all" given a single-location
 * fixture set. This is noted inline per §11 constraint.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards / forms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ScopeFilter = 'location' | 'department'
type ProductType = 'raw' | 'semi' | 'final'

interface DowOverrides {
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  sat: string
  sun: string
}

interface CellState {
  basePar: string
  dowOverrides: DowOverrides
}

type EditMap = Record<string, CellState>

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: ReadonlyArray<{ value: ScopeFilter; label: string }> = [
  { value: 'location', label: 'Location' },
  { value: 'department', label: 'Department' },
]

const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{ value: ProductType; label: string }> = [
  { value: 'raw', label: 'Raw' },
  { value: 'semi', label: 'Semi-product' },
  { value: 'final', label: 'Final product' },
]

const DOW_KEYS: ReadonlyArray<keyof DowOverrides> = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]
const DOW_LABELS: Record<keyof DowOverrides, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

// FR111 drift recommendation fixture — two rows that carry a visual badge.
// §11 — accept/ignore actions are chrome only; Epic-12 AI integration deferred.
const DRIFT_RECOMMENDATION_IDS: ReadonlySet<string> = new Set(['par-001', 'par-004'])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initialDow(par: ParLevel): DowOverrides {
  return {
    mon: par.dayOfWeekOverrides?.mon?.toString() ?? '',
    tue: par.dayOfWeekOverrides?.tue?.toString() ?? '',
    wed: par.dayOfWeekOverrides?.wed?.toString() ?? '',
    thu: par.dayOfWeekOverrides?.thu?.toString() ?? '',
    fri: par.dayOfWeekOverrides?.fri?.toString() ?? '',
    sat: par.dayOfWeekOverrides?.sat?.toString() ?? '',
    sun: par.dayOfWeekOverrides?.sun?.toString() ?? '',
  }
}

function initialCellState(par: ParLevel): CellState {
  return {
    basePar: par.basePar.toString(),
    dowOverrides: initialDow(par),
  }
}

/** True if any DoW override has a value. */
function hasAnyDow(dow: DowOverrides): boolean {
  return DOW_KEYS.some((k) => dow[k].trim() !== '')
}

/** All categories from the PAR fixture materials. */
const ALL_CATEGORIES: ReadonlyArray<string> = Array.from(
  new Set(
    parLevels
      .map((p) => materials.find((m) => m.id === p.materialId)?.category)
      .filter((c): c is string => c !== undefined),
  ),
).sort()

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface FilterChipPickerProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ value: V; label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterChipPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipPickerProps<V>) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-11 px-3 gap-1.5 rounded-pill min-w-[44px] tablet:h-9"
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
      <PopoverContent align="start" className="w-64 p-1">
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
                onClear()
                setOpen(false)
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {options.map((opt) => {
            const active = selected.has(opt.value)
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
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DoW Popover content
// ─────────────────────────────────────────────────────────────────────────────

interface DowPopoverProps {
  readonly parId: string
  readonly basePar: string
  readonly dow: DowOverrides
  readonly onDowChange: (parId: string, key: keyof DowOverrides, value: string) => void
}

function DowPopoverPanel({ parId, basePar, dow, onDowChange }: DowPopoverProps) {
  return (
    <div className="w-72 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
        Day-of-week overrides
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        Leave blank to inherit base PAR ({basePar || '—'}). Set a positive integer to
        override that day only.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {DOW_KEYS.map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-on-surface">
              {DOW_LABELS[k]}
            </span>
            <Input
              aria-label={`${DOW_LABELS[k]} PAR override`}
              type="number"
              min="1"
              placeholder={basePar || '—'}
              value={dow[k]}
              onChange={(e) => onDowChange(parId, k, e.target.value)}
              className="h-9 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift recommendation badge (FR111, visual-only)
// §11 — accept/ignore actions are chrome only; Epic-12 AI integration deferred.
// ─────────────────────────────────────────────────────────────────────────────

function DriftBadge() {
  return (
    <span
      title="System drift recommendation — PAR may be under-set based on recent consumption (FR111). Accept or ignore in Epic 12."
      className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-warning cursor-default"
      aria-label="PAR drift recommendation pending"
    >
      <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
      Drift rec.
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv004() {
  // Filter state — chrome only for scope/product-type/category since fixture is
  // already department-scoped to CK Bandra departments.
  // §11 — scope + product-type + category filters are visual chrome only here.
  const [scopeFilters, setScopeFilters] = useState<ReadonlySet<ScopeFilter>>(new Set())
  const [productTypeFilters, setProductTypeFilters] = useState<ReadonlySet<ProductType>>(
    new Set(),
  )
  const [categoryFilters, setCategoryFilters] = useState<ReadonlySet<string>>(new Set())

  // Row selection for bulk-set
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkValue, setBulkValue] = useState<string>('')

  // Edit map — keyed by par-level id
  const [editMap, setEditMap] = useState<EditMap>(() => {
    const init: EditMap = {}
    for (const par of parLevels) {
      init[par.id] = initialCellState(par)
    }
    return init
  })

  const [isDraft, setIsDraft] = useState(false)

  // Drift recommendation ignore toggle (visual-only, §11)
  const [driftDismissed, setDriftDismissed] = useState<ReadonlySet<string>>(new Set())

  // ── Derived data ─────────────────────────────────────────────────────────

  // Only department-scoped PAR levels (locationId + departmentId both set)
  const deptParLevels = useMemo(
    () => parLevels.filter((p) => p.locationId !== null && p.departmentId !== null),
    [],
  )

  // §11 — filtered list is the same as deptParLevels; scope/type/category chips
  // are visual chrome because the fixture only has CK Bandra data.
  const filteredLevels = deptParLevels

  // Unique departments that appear in the filtered set — used for column headers
  const deptIds = useMemo(
    () => Array.from(new Set(filteredLevels.map((p) => p.departmentId!))),
    [filteredLevels],
  )

  // Unique material ids in filtered set
  const materialIds = useMemo(
    () => Array.from(new Set(filteredLevels.map((p) => p.materialId))),
    [filteredLevels],
  )

  // Group par-levels by materialId → departmentId
  const parMatrix = useMemo(() => {
    const map = new Map<string, Map<string, ParLevel>>()
    for (const par of filteredLevels) {
      if (!map.has(par.materialId)) map.set(par.materialId, new Map())
      map.get(par.materialId)!.set(par.departmentId!, par)
    }
    return map
  }, [filteredLevels])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleBaseParChange(parId: string, value: string) {
    setEditMap((prev) => ({
      ...prev,
      [parId]: { ...prev[parId], basePar: value },
    }))
    setIsDraft(true)
  }

  function handleDowChange(parId: string, key: keyof DowOverrides, value: string) {
    setEditMap((prev) => ({
      ...prev,
      [parId]: {
        ...prev[parId],
        dowOverrides: { ...prev[parId].dowOverrides, [key]: value },
      },
    }))
    setIsDraft(true)
  }

  function handleConfirm() {
    setIsDraft(false)
    setSelectedIds(new Set())
    setBulkValue('')
  }

  function handleBulkSet() {
    if (!bulkValue.trim() || selectedIds.size === 0) return
    setEditMap((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) {
        next[id] = { ...next[id], basePar: bulkValue.trim() }
      }
      return next
    })
    setIsDraft(true)
    setBulkValue('')
    setSelectedIds(new Set())
  }

  function handleDismissDrift(parId: string) {
    setDriftDismissed((prev) => new Set([...prev, parId]))
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const anyFilterActive =
    scopeFilters.size > 0 || productTypeFilters.size > 0 || categoryFilters.size > 0

  const allSelected =
    filteredLevels.length > 0 && selectedIds.size === filteredLevels.length

  // Representative PAR for a material row — first dept's entry for last-modified metadata
  function repPar(matId: string): ParLevel | undefined {
    const vals = parMatrix.get(matId)?.values()
    if (!vals) return undefined
    return vals.next().value as ParLevel | undefined
  }

  function deptName(deptId: string): string {
    return departments.find((d) => d.id === deptId)?.name ?? deptId
  }

  function matName(matId: string): string {
    return materials.find((m) => m.id === matId)?.name ?? matId
  }

  function matCategory(matId: string): string {
    return materials.find((m) => m.id === matId)?.category ?? ''
  }

  const ckLocation = locations.find((l) => l.id === 'loc-ck-bandra')

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · PAR configuration
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              PAR Level Configuration
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {ckLocation?.name ?? 'Central Kitchen'} · Set base PAR quantities and
              day-of-week overrides per item. Changes stage locally until you confirm (FR33/FR34).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DraftPill isDraft={isDraft} mobileEyebrow />
            {isDraft ? (
              <Button
                variant="tonal"
                size="sm"
                onClick={handleConfirm}
                className="h-11 tablet:h-9 gap-1.5"
                aria-label="Confirm staged PAR changes"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Confirm changes
              </Button>
            ) : null}
          </div>
        </header>

        {/* Filter strip */}
        {/* §11 — scope / product-type / category chips are visual chrome only;
            fixture is single-location CK Bandra so filtering cannot meaningfully
            narrow the set. The chips show selected counts but do not affect rows. */}
        <section
          aria-label="PAR filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              <FilterChipPicker<ScopeFilter>
                title="Scope"
                options={SCOPE_OPTIONS}
                selected={scopeFilters}
                onToggle={(v) => setScopeFilters(toggleSet(scopeFilters, v))}
                onClear={() => setScopeFilters(new Set())}
              />
              <FilterChipPicker<ProductType>
                title="Product type"
                options={PRODUCT_TYPE_OPTIONS}
                selected={productTypeFilters}
                onToggle={(v) => setProductTypeFilters(toggleSet(productTypeFilters, v))}
                onClear={() => setProductTypeFilters(new Set())}
              />
              <FilterChipPicker<string>
                title="Category"
                options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
                selected={categoryFilters}
                onToggle={(v) => setCategoryFilters(toggleSet(categoryFilters, v))}
                onClear={() => setCategoryFilters(new Set())}
              />
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 px-3 gap-1 tablet:h-9"
                  onClick={() => {
                    setScopeFilters(new Set())
                    setProductTypeFilters(new Set())
                    setCategoryFilters(new Set())
                  }}
                  aria-label="Reset all filters"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Bulk-set control */}
        {selectedIds.size > 0 ? (
          <div
            role="toolbar"
            aria-label="Bulk set controls"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-surface-container p-3"
          >
            <span className="text-sm font-medium text-on-surface">
              {selectedIds.size} row{selectedIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Bulk base PAR value"
                type="number"
                min="1"
                placeholder="New base PAR"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="h-9 w-36 text-sm"
              />
              <Button
                variant="tonal"
                size="sm"
                onClick={handleBulkSet}
                disabled={!bulkValue.trim()}
                aria-label={`Apply base PAR ${bulkValue} to ${selectedIds.size} selected rows`}
                className="h-9"
              >
                Apply to selected
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 gap-1"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear row selection"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="text-xs">Clear</span>
            </Button>
          </div>
        ) : null}

        {/* PAR matrix */}
        <section aria-label="PAR level matrix" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">
              PAR matrix — {filteredLevels.length}{' '}
              configuration{filteredLevels.length === 1 ? '' : 's'}
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {deptIds.length} department{deptIds.length === 1 ? '' : 's'} ·{' '}
              {materialIds.length} item{materialIds.length === 1 ? '' : 's'}
            </span>
          </header>

          {/* Desktop matrix table (hidden tablet:block pattern from SI-INV-001) */}
          <div className="hidden tablet:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Select-all checkbox */}
                  <TableHead className="w-10">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = filteredLevels.map((p) => p.id)
                        setSelectedIds((prev) =>
                          prev.size === allIds.length ? new Set() : new Set(allIds),
                        )
                      }}
                      aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                      className="flex items-center justify-center rounded-sm min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
                      ) : (
                        <Square className="h-4 w-4 text-on-surface-variant" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[180px]">Item</TableHead>
                  <TableHead>Category</TableHead>
                  {deptIds.map((deptId) => (
                    <TableHead key={deptId} className="min-w-[160px]">
                      <span className="block text-xs font-semibold text-on-surface">
                        {deptName(deptId)}
                      </span>
                      <span className="block text-[11px] text-on-surface-variant font-normal">
                        Base PAR · DoW
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[140px]">Last modified</TableHead>
                  <TableHead className="min-w-[120px]">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialIds.map((matId) => {
                  const rep = repPar(matId)
                  if (!rep) return null

                  // Collect all par ids for this material row
                  const matPars = Array.from(parMatrix.get(matId)?.values() ?? [])
                  const matParIds = matPars.map((p) => p.id)
                  const anySelected = matParIds.some((id) => selectedIds.has(id))
                  const allRowSelected = matParIds.every((id) => selectedIds.has(id))
                  const hasDrift = matParIds.some(
                    (id) => DRIFT_RECOMMENDATION_IDS.has(id) && !driftDismissed.has(id),
                  )

                  return (
                    <TableRow
                      key={matId}
                      className={[
                        'hover:bg-surface-container transition-colors',
                        anySelected ? 'bg-surface-container-low' : '',
                        hasDrift ? 'border-l-4 border-warning' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {/* Row select */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (allRowSelected) {
                                matParIds.forEach((id) => next.delete(id))
                              } else {
                                matParIds.forEach((id) => next.add(id))
                              }
                              return next
                            })
                          }}
                          aria-label={
                            allRowSelected
                              ? `Deselect ${matName(matId)}`
                              : `Select ${matName(matId)}`
                          }
                          className="flex items-center justify-center rounded-sm min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {allRowSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
                          ) : (
                            <Square className="h-4 w-4 text-on-surface-variant" aria-hidden />
                          )}
                        </button>
                      </TableCell>

                      {/* Item */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-on-surface text-sm">
                            {matName(matId)}
                          </span>
                          {hasDrift ? <DriftBadge /> : null}
                          {/* FR111 visual-only accept/ignore sub-affordance
                              §11 — buttons are chrome only; Epic-12 deferred. */}
                          {hasDrift ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => setIsDraft(true)}
                                aria-label="Accept drift recommendation (visual only — Epic 12)"
                                title="Accept — Epic 12 AI will provide suggested value"
                              >
                                <Check className="h-3 w-3 text-warning" aria-hidden />
                                Accept
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => matParIds.forEach((id) => handleDismissDrift(id))}
                                aria-label="Ignore drift recommendation"
                              >
                                <X className="h-3 w-3" aria-hidden />
                                Ignore
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell className="text-xs text-on-surface-variant">
                        {matCategory(matId)}
                      </TableCell>

                      {/* One cell per department */}
                      {deptIds.map((deptId) => {
                        const par = parMatrix.get(matId)?.get(deptId)
                        if (!par) {
                          return (
                            <TableCell
                              key={deptId}
                              className="text-on-surface-variant text-xs"
                            >
                              —
                            </TableCell>
                          )
                        }
                        const cell = editMap[par.id]
                        const dowActive = hasAnyDow(cell.dowOverrides)

                        return (
                          <TableCell key={deptId}>
                            <div className="flex items-center gap-2">
                              {/* Base PAR input */}
                              <Input
                                aria-label={`Base PAR for ${matName(matId)} in ${deptName(deptId)}`}
                                type="number"
                                min="1"
                                value={cell.basePar}
                                onChange={(e) =>
                                  handleBaseParChange(par.id, e.target.value)
                                }
                                className="h-9 w-20 text-sm tabular-nums"
                              />
                              {/* DoW override popover */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={dowActive ? 'tonal' : 'ghost'}
                                    size="sm"
                                    className="h-9 w-9 p-0"
                                    aria-label={`Day-of-week overrides for ${matName(matId)} in ${deptName(deptId)}${dowActive ? ' — has overrides' : ''}`}
                                    title="Day-of-week overrides"
                                  >
                                    <CalendarDays
                                      className={[
                                        'h-3.5 w-3.5',
                                        dowActive
                                          ? 'text-primary'
                                          : 'text-on-surface-variant',
                                      ].join(' ')}
                                      aria-hidden
                                    />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="p-0">
                                  <DowPopoverPanel
                                    parId={par.id}
                                    basePar={cell.basePar}
                                    dow={cell.dowOverrides}
                                    onDowChange={handleDowChange}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            {/* DoW summary */}
                            {dowActive ? (
                              <p className="mt-1 text-[11px] text-on-surface-variant">
                                {DOW_KEYS.filter((k) => cell.dowOverrides[k].trim() !== '')
                                  .map((k) => `${DOW_LABELS[k]} ${cell.dowOverrides[k]}`)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </TableCell>
                        )
                      })}

                      {/* Last modified */}
                      <TableCell className="text-xs text-on-surface-variant">
                        <span className="block">{rep.lastModifiedBy}</span>
                        <span className="block tabular-nums">{rep.lastModifiedAt}</span>
                      </TableCell>

                      {/* Audit link — entityRef = first par-level id for this material */}
                      <TableCell>
                        <AuditLink entityRef={rep.id} label="Audit" compact />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card stack (tablet:hidden) */}
          <div className="flex flex-col gap-3 tablet:hidden">
            {materialIds.map((matId) => {
              const rep = repPar(matId)
              if (!rep) return null
              const matParIds = Array.from(parMatrix.get(matId)?.values() ?? []).map(
                (p) => p.id,
              )
              const hasDrift = matParIds.some(
                (id) => DRIFT_RECOMMENDATION_IDS.has(id) && !driftDismissed.has(id),
              )
              return (
                <div
                  key={matId}
                  className={[
                    'rounded-md bg-surface-container-lowest p-4',
                    hasDrift ? 'border-l-4 border-warning' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {matName(matId)}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {matCategory(matId)}
                      </p>
                      {hasDrift ? (
                        <div className="mt-1.5">
                          <DriftBadge />
                        </div>
                      ) : null}
                    </div>
                    <AuditLink entityRef={rep.id} compact />
                  </div>

                  {/* Per-dept PAR cells on mobile */}
                  {Array.from(parMatrix.get(matId)?.entries() ?? []).map(
                    ([deptId, par]) => {
                      const cell = editMap[par.id]
                      return (
                        <div key={deptId} className="mb-3">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                            {deptName(deptId)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label={`Base PAR for ${matName(matId)} in ${deptName(deptId)}`}
                              type="number"
                              min="1"
                              value={cell.basePar}
                              onChange={(e) =>
                                handleBaseParChange(par.id, e.target.value)
                              }
                              className="h-10 w-24 text-sm tabular-nums"
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={hasAnyDow(cell.dowOverrides) ? 'tonal' : 'ghost'}
                                  size="sm"
                                  className="h-10 px-3 gap-1.5"
                                  aria-label="Day-of-week overrides"
                                >
                                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                                  <span className="text-xs">DoW</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-0">
                                <DowPopoverPanel
                                  parId={par.id}
                                  basePar={cell.basePar}
                                  dow={cell.dowOverrides}
                                  onDowChange={handleDowChange}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )
                    },
                  )}

                  <p className="text-[11px] text-on-surface-variant">
                    Last modified by {rep.lastModifiedBy} · {rep.lastModifiedAt}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Drift recommendation legend */}
          <div
            role="note"
            aria-label="Drift recommendation legend"
            className="mt-4 flex items-start gap-2 rounded-md bg-surface-container-low p-3"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
              aria-hidden
            />
            <p className="text-xs text-on-surface-variant">
              <span className="font-semibold text-on-surface">
                FR111 drift recommendations
              </span>{' '}
              are flagged in orange. The system suggests these PAR values may be
              under-set based on recent consumption patterns. Accept or ignore —
              final AI-powered values will be supplied in Epic 12.
            </p>
          </div>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Changes stage locally until &ldquo;Confirm changes&rdquo; is pressed &middot;
            DoW overrides override base PAR for that day only (FR34) &middot;
            drift recommendations are visual-only pending Epic 12.
          </span>
          <span className="ml-auto">
            SI-INV-004 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (b)
          </span>
        </footer>
      </div>
    </div>
  )
}
