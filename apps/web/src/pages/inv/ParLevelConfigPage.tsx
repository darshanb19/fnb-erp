import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckSquare,
  CircleOff,
  PackageSearch,
  Square,
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
} from '@/components/shell'

import {
  useParLevelsList,
  useBulkSetParLevel,
  type SetParLevelInput,
} from '@/hooks/inv/useParLevels'
import { useInventoryProductNames, useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
import type { ParLevelRow } from '@/hooks/inv/schemas'

/**
 * SI-INV-004 — PAR Level Configuration (production port of Arc-b mockup).
 *
 * Tier 2 Group 1, Epic 4 Arc (c). Desktop-primary configuration surface for
 * setting base PAR levels and day-of-week overrides per item × department.
 * Changes stage in local React state (CC-DRAFT-PILL) and are committed via
 * "Confirm changes" → bulkSetParLevel.
 *
 * FRs: FR33 (PAR level per item × scope), FR34 (DoW overrides for weekend spikes).
 *
 * Divergences from Arc-(b) mockup (per task-5-brief.md):
 *   - Dropped: scope/product-type/category FilterChipPicker strip (unbacked).
 *   - Dropped: FR111 DriftBadge, accept/ignore buttons, drift legend,
 *     DRIFT_RECOMMENDATION_IDS, driftDismissed (Epic-12 seam, no backend).
 *   - handleConfirm persists: diffs editMap vs original rows → bulkSetParLevel.
 *   - Matrix built from department-scoped PAR rows; non-dept rows shown as
 *     read-only secondary list below.
 *
 * Route: /inventory/par-levels (auth-only, DL-049 — no RequirePermission).
 *
 * Animation: NONE. CLAUDE.md bans entrance animations on inventory tables.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

const DOW_KEYS: ReadonlyArray<keyof DowOverrides> = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]
const DOW_LABELS: Record<keyof DowOverrides, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initialDow(par: ParLevelRow): DowOverrides {
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

function initialCellState(par: ParLevelRow): CellState {
  return {
    basePar: String(par.basePar),
    dowOverrides: initialDow(par),
  }
}

/** True if any DoW override has a value. */
function hasAnyDow(dow: DowOverrides): boolean {
  return DOW_KEYS.some((k) => dow[k].trim() !== '')
}

function toOverrides(dow: DowOverrides): Record<string, number> | null {
  const entries = (Object.entries(dow) as Array<[string, string]>)
    .filter(([, v]) => v.trim() !== '')
    .map(([k, v]) => [k, Number(v)] as const)
  return entries.length ? Object.fromEntries(entries) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ParLevelConfigPage() {
  // ── Data hooks — ALL above early returns (Rules of Hooks) ─────────────────
  const { data: parRows, isLoading, error } = useParLevelsList({})
  const { nameOf, isLoading: namesLoading } = useInventoryProductNames()
  const { data: depts } = useInventoryDepartments()
  const bulkSetPar = useBulkSetParLevel()

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkValue, setBulkValue] = useState<string>('')
  const [editMap, setEditMap] = useState<EditMap>({})
  const [isDraft, setIsDraft] = useState(false)

  // ── Derived: split rows into dept-scoped (matrix) vs non-dept (secondary) ─
  const deptParRows = useMemo(
    () => (parRows ?? []).filter((p) => p.departmentId !== null),
    [parRows],
  )
  const nonDeptParRows = useMemo(
    () => (parRows ?? []).filter((p) => p.departmentId === null),
    [parRows],
  )

  // ── Seed editMap when data first arrives ─────────────────────────────────
  // (Only seed entries that are not already in the map — avoids stomping local edits on refetch)
  const seededEditMap = useMemo<EditMap>(() => {
    const init: EditMap = {}
    for (const par of deptParRows) {
      init[par.id] = editMap[par.id] ?? initialCellState(par)
    }
    return init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptParRows])

  // Use seededEditMap for reading (merges server data with local edits)
  const effectiveMap: EditMap = { ...seededEditMap, ...editMap }

  // ── Derived matrix data ───────────────────────────────────────────────────
  const deptIds = useMemo(
    () => Array.from(new Set(deptParRows.map((p) => p.departmentId!))),
    [deptParRows],
  )

  const productIds = useMemo(
    () => Array.from(new Set(deptParRows.map((p) => p.productId))),
    [deptParRows],
  )

  const parMatrix = useMemo(() => {
    const map = new Map<string, Map<string, ParLevelRow>>()
    for (const par of deptParRows) {
      if (!map.has(par.productId)) map.set(par.productId, new Map())
      map.get(par.productId)!.set(par.departmentId!, par)
    }
    return map
  }, [deptParRows])

  // ── Name/dept helpers ─────────────────────────────────────────────────────
  const deptName = (id: string) => depts?.find((d) => d.id === id)?.name ?? id

  // ── Derived: allSelected ──────────────────────────────────────────────────
  const allParIds = useMemo(() => deptParRows.map((p) => p.id), [deptParRows])
  const allSelected = allParIds.length > 0 && selectedIds.size === allParIds.length

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (isLoading || namesLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="status" aria-label="Loading" className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-md bg-surface-container-low animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error guard ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {error instanceof ApiError ? error.message : 'Failed to load PAR levels. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (deptParRows.length === 0 && nonDeptParRows.length === 0) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div className="rounded-md bg-surface-container-lowest p-10 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
            <p className="mt-3 text-base font-semibold text-on-surface">
              No PAR levels configured yet.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              PAR levels can be set here once products and departments have been configured.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleBaseParChange(parId: string, value: string) {
    setEditMap((prev) => ({
      ...prev,
      [parId]: { ...(prev[parId] ?? seededEditMap[parId] ?? { basePar: '', dowOverrides: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' } }), basePar: value },
    }))
    setIsDraft(true)
  }

  function handleDowChange(parId: string, key: keyof DowOverrides, value: string) {
    setEditMap((prev) => {
      const current = prev[parId] ?? seededEditMap[parId] ?? { basePar: '', dowOverrides: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' } }
      return {
        ...prev,
        [parId]: {
          ...current,
          dowOverrides: { ...current.dowOverrides, [key]: value },
        },
      }
    })
    setIsDraft(true)
  }

  function handleConfirm() {
    const changed: SetParLevelInput[] = []
    for (const par of deptParRows) {
      const cell = effectiveMap[par.id]
      if (!cell) continue
      const nextBase = Number(cell.basePar)
      const nextOverrides = toOverrides(cell.dowOverrides)
      const baseChanged = Number.isFinite(nextBase) && nextBase !== par.basePar
      const overridesChanged =
        JSON.stringify(nextOverrides ?? null) !== JSON.stringify(par.dayOfWeekOverrides ?? null)
      if (baseChanged || overridesChanged) {
        changed.push({
          productId: par.productId,
          locationId: par.locationId,
          departmentId: par.departmentId,
          basePar: Number.isFinite(nextBase) ? nextBase : par.basePar,
          dayOfWeekOverrides: nextOverrides,
        })
      }
    }
    if (changed.length === 0) { setIsDraft(false); return }
    bulkSetPar.mutate(changed, {
      onSuccess: () => { setIsDraft(false); setSelectedIds(new Set()); setBulkValue('') },
    })
  }

  function handleBulkSet() {
    if (!bulkValue.trim() || selectedIds.size === 0) return
    setEditMap((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) {
        const current = prev[id] ?? seededEditMap[id] ?? { basePar: '', dowOverrides: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' } }
        next[id] = { ...current, basePar: bulkValue.trim() }
      }
      return next
    })
    setIsDraft(true)
    setBulkValue('')
    setSelectedIds(new Set())
  }

  // ── Representative PAR for a product row ──────────────────────────────────
  function repPar(productId: string): ParLevelRow | undefined {
    const vals = parMatrix.get(productId)?.values()
    if (!vals) return undefined
    return vals.next().value as ParLevelRow | undefined
  }

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
              Set base PAR quantities and day-of-week overrides per item × department. Changes
              stage locally until you confirm (FR33/FR34).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DraftPill isDraft={isDraft} mobileEyebrow />
            {isDraft ? (
              <Button
                variant="tonal"
                size="sm"
                onClick={handleConfirm}
                disabled={bulkSetPar.isPending}
                className="h-11 tablet:h-9 gap-1.5"
                aria-label="Confirm staged PAR changes"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {bulkSetPar.isPending ? 'Saving…' : 'Confirm changes'}
              </Button>
            ) : null}
          </div>
        </header>

        {/* Save error alert */}
        {bulkSetPar.error ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container p-4 text-on-error-container"
          >
            <p className="text-sm font-medium">
              {bulkSetPar.error instanceof ApiError
                ? bulkSetPar.error.message
                : 'Failed to save PAR levels. Please retry.'}
            </p>
          </div>
        ) : null}

        {/* Bulk-set toolbar */}
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

        {/* PAR matrix — department-scoped rows */}
        <section aria-label="PAR level matrix" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">
              PAR matrix — {deptParRows.length}{' '}
              configuration{deptParRows.length === 1 ? '' : 's'}
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {deptIds.length} department{deptIds.length === 1 ? '' : 's'} ·{' '}
              {productIds.length} item{productIds.length === 1 ? '' : 's'}
            </span>
          </header>

          {/* Desktop matrix table */}
          <div className="hidden tablet:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Select-all */}
                  <TableHead className="w-10">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds((prev) =>
                          prev.size === allParIds.length ? new Set() : new Set(allParIds),
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
                {productIds.map((productId) => {
                  const rep = repPar(productId)
                  if (!rep) return null

                  const matPars = Array.from(parMatrix.get(productId)?.values() ?? [])
                  const matParIds = matPars.map((p) => p.id)
                  const anySelected = matParIds.some((id) => selectedIds.has(id))
                  const allRowSelected = matParIds.every((id) => selectedIds.has(id))

                  return (
                    <TableRow
                      key={productId}
                      className={[
                        'hover:bg-surface-container transition-colors',
                        anySelected ? 'bg-surface-container-low' : '',
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
                              ? `Deselect ${nameOf(productId)}`
                              : `Select ${nameOf(productId)}`
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

                      {/* Item name */}
                      <TableCell>
                        <span className="font-medium text-on-surface text-sm">
                          {nameOf(productId)}
                        </span>
                      </TableCell>

                      {/* One cell per department */}
                      {deptIds.map((deptId) => {
                        const par = parMatrix.get(productId)?.get(deptId)
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
                        const cell = effectiveMap[par.id] ?? initialCellState(par)
                        const dowActive = hasAnyDow(cell.dowOverrides)

                        return (
                          <TableCell key={deptId}>
                            <div className="flex items-center gap-2">
                              {/* Base PAR input */}
                              <Input
                                aria-label={`Base PAR for ${nameOf(productId)} in ${deptName(deptId)}`}
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
                                    aria-label={`Day-of-week overrides for ${nameOf(productId)} in ${deptName(deptId)}${dowActive ? ' — has overrides' : ''}`}
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
                        <span className="block">{rep.lastModifiedByUserId ?? '—'}</span>
                        <span className="block tabular-nums">{rep.lastModifiedAt}</span>
                      </TableCell>

                      {/* Audit link */}
                      <TableCell>
                        <AuditLink entityType="par_levels" entityRef={rep.id} label="Audit" compact />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card stack */}
          <div className="flex flex-col gap-3 tablet:hidden">
            {productIds.map((productId) => {
              const rep = repPar(productId)
              if (!rep) return null
              return (
                <div
                  key={productId}
                  className="rounded-md bg-surface-container-lowest p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {nameOf(productId)}
                      </p>
                    </div>
                    <AuditLink entityType="par_levels" entityRef={rep.id} compact />
                  </div>

                  {/* Per-dept PAR cells on mobile */}
                  {Array.from(parMatrix.get(productId)?.entries() ?? []).map(
                    ([deptId, par]) => {
                      const cell = effectiveMap[par.id] ?? initialCellState(par)
                      return (
                        <div key={deptId} className="mb-3">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                            {deptName(deptId)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label={`Base PAR for ${nameOf(productId)} in ${deptName(deptId)}`}
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
                    Last modified · {rep.lastModifiedAt}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Secondary list — location-scoped / brand-wide PAR rows (read-only) */}
        {nonDeptParRows.length > 0 ? (
          <section aria-label="Location-scoped and brand-wide PAR levels" className="mt-10">
            <SectionShift tone="low" aria-hidden />
            <header className="mt-6 mb-3 flex items-baseline gap-3">
              <h2 className="text-base font-semibold text-on-surface">
                Location-scoped / brand-wide PAR levels
              </h2>
              <span className="text-xs text-on-surface-variant tabular-nums">
                {nonDeptParRows.length} row{nonDeptParRows.length === 1 ? '' : 's'} · read-only
              </span>
            </header>
            <p className="mb-4 text-sm text-on-surface-variant">
              These PAR levels apply at the location or brand level (no department assigned). Editing
              them is out of scope for this surface — use the API or a future dedicated form.
            </p>

            <div className="hidden tablet:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Base PAR</TableHead>
                    <TableHead>Last modified</TableHead>
                    <TableHead>Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonDeptParRows.map((par) => (
                    <TableRow key={par.id} className="hover:bg-surface-container transition-colors">
                      <TableCell>
                        <span className="font-medium text-on-surface text-sm">
                          {nameOf(par.productId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        {par.locationId === null ? 'Brand-wide' : 'Location-scoped'}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-on-surface">
                        {par.basePar}
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        {par.lastModifiedAt}
                      </TableCell>
                      <TableCell>
                        <AuditLink entityType="par_levels" entityRef={par.id} label="Audit" compact />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards for secondary list */}
            <div className="flex flex-col gap-3 tablet:hidden">
              {nonDeptParRows.map((par) => (
                <div key={par.id} className="rounded-md bg-surface-container-lowest p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {nameOf(par.productId)}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {par.locationId === null ? 'Brand-wide' : 'Location-scoped'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-lg font-bold tabular-nums text-on-surface">
                        {par.basePar}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
                        base PAR
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-on-surface-variant">
                      {par.lastModifiedAt}
                    </p>
                    <AuditLink entityType="par_levels" entityRef={par.id} compact />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Changes stage locally until &ldquo;Confirm changes&rdquo; is pressed &middot;
            DoW overrides override base PAR for that day only (FR34) &middot;
            location/brand-wide rows are read-only here.
          </span>
          <span className="ml-auto">
            SI-INV-004 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (c)
          </span>
        </footer>
      </div>
    </div>
  )
}
