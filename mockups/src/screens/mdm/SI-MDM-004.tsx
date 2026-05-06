import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleOff,
  LayoutGrid,
  List,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  Card,
  DashboardTile,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
} from '@/shell'

import {
  NOW,
  departments,
  locations,
  materials,
  type Department,
  type Location,
  type Material,
} from '@/lib/sample-data'

/**
 * SI-MDM-004 — Material Enablement Matrix.
 *
 * Tier 1 Group 1, screen 10 (final) of Phase 2c-S3. Anchors the
 * enablement-grid chrome that GATES every stock movement per FR8 (the
 * canonical service-layer guard `inventoryService.checkEnablement()` is
 * service-side; this screen defines the data the guard reads). FR5 — Store
 * Manager configures which raw materials a department can consume.
 *
 * Layout — responsive-equal per screen-inventory line 410:
 *   - Mobile (< tablet): per-department collapsible list. Each section
 *     surfaces an enable count + filterable material rows.
 *   - Tablet / desktop: 2-D matrix (materials rows × departments columns)
 *     with sticky row & column headers and horizontal scroll. Toggle to
 *     list view available on desktop.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — every toggle is auditable. Surfaced as <AuditLink />
 *     on each row label and reachable from cell tooltip text.
 *   - CC-DRAFT-PILL — active when "Select cells" multi-toggle mode has
 *     uncommitted pending changes. Single-cell toggles auto-commit; the
 *     pill stays in the saved state in normal mode.
 *
 * Animation — NONE. Matrix is a high-density data grid; entrance motion is
 * banned by CLAUDE.md and DESIGN.md §10.5.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

const NOW_DATE = new Date(`${NOW}T09:00:00+05:30`)

const CATEGORY_OPTIONS: ReadonlyArray<string> = [
  'Spices',
  'Dairy',
  'Grains',
  'Meat',
  'Vegetables',
  'Fruits',
  'Beverages',
  'Bakery',
  'Sweet',
  'Dry-goods',
]

type StatusFilter = 'all' | 'enabled' | 'disabled'
type ViewMode = 'matrix' | 'list'

interface EnablementCell {
  readonly enabled: boolean
  readonly lastModifiedAt: string
  readonly lastModifiedBy: string
  readonly reason?: string
}

type EnablementMap = ReadonlyMap<string, EnablementCell>

interface MaterialRow {
  readonly id: string
  readonly material: Material
  readonly sku: string
  /** Coalesced 10-category bucket label for the chip filter. */
  readonly categoryBucket: string
}

/** Stable sku derived from material id — mirrors SI-MDM-003. */
function skuOf(mat: Material): string {
  const tail = mat.id.replace(/^mat-/, '').toUpperCase().slice(0, 12)
  return `WS-${tail}`
}

/** Map raw fixture category onto the canonical 10-category chip filter. */
function categoryBucketOf(mat: Material): string {
  const c = mat.category
  if (CATEGORY_OPTIONS.includes(c)) return c
  if (['Whole Spices', 'Herbs'].includes(c)) return 'Spices'
  if (['Cheese'].includes(c)) return 'Dairy'
  if (['Pulses', 'Flour', 'Rice'].includes(c)) return 'Grains'
  if (['Poultry', 'Seafood'].includes(c)) return 'Meat'
  if (['Coffee', 'Tea', 'Spirits', 'Wine'].includes(c)) return 'Beverages'
  if (['Oils', 'Dry Fruits'].includes(c)) return 'Dry-goods'
  return 'Dry-goods'
}

/** Persona names used as audit actors — sourced from personas.ts to keep
 *  the names co-tenant. Kept inline because we only need the names, not
 *  the persona scope. */
const ACTORS: ReadonlyArray<string> = [
  'Arjun Reddy',
  'Nadia Khan',
  'Aanya Khanna',
  'Rohan Mehta',
]

const ACTOR_ROLES: Record<string, string> = {
  'Arjun Reddy': 'Store Manager',
  'Nadia Khan': 'Kitchen Manager',
  'Aanya Khanna': 'Brand Owner',
  'Rohan Mehta': 'Cluster Manager',
}

const SAMPLE_REASONS: ReadonlyArray<string> = [
  'Chef requested due to menu change',
  'Initial setup — onboarding default',
  'Discontinued from menu — Q2 review',
  'Compliance: HALAL-only kitchen',
  'Seasonal addition for monsoon menu',
]

/** Build a deterministic ISO timestamp within the last 30 days using a seed. */
function seededTimestamp(seed: number): string {
  const offsetDays = (seed * 7 + 3) % 28
  const offsetHours = (seed * 11) % 9
  const offsetMins = (seed * 13) % 60
  const d = new Date(NOW_DATE)
  d.setUTCDate(d.getUTCDate() - offsetDays)
  d.setUTCHours(d.getUTCHours() - offsetHours)
  d.setUTCMinutes(d.getUTCMinutes() - offsetMins)
  return d.toISOString()
}

function pickActor(seed: number): string {
  const idx = ACTORS[seed % ACTORS.length]
  if (idx === undefined) return ACTORS[0]!
  return idx
}

/** Plausible per-(material, department) enablement default. Mirrors the
 *  task brief's department-by-department logic. */
function isEnabledByDefault(matBucket: string, deptName: string): boolean {
  const d = deptName.toLowerCase()
  const c = matBucket
  if (d.includes('hot') || d.includes('tandoor')) {
    return !['Sweet'].includes(c)
  }
  if (d.includes('cold')) {
    return ['Vegetables', 'Fruits', 'Dairy', 'Dry-goods', 'Spices'].includes(c)
  }
  if (d.includes('bakery') || d.includes('pastry')) {
    return [
      'Dairy',
      'Bakery',
      'Sweet',
      'Grains',
      'Dry-goods',
      'Fruits',
    ].includes(c)
  }
  if (d.includes('service') || d.includes('bar')) {
    return ['Beverages', 'Fruits', 'Sweet', 'Dairy'].includes(c)
  }
  if (d.includes('receiving') || d.includes('dispatch')) {
    return true
  }
  // POS-outlet kitchens: broad but no Sweet
  return c !== 'Sweet'
}

/** Synthesize the initial enablement map for (material × department) at a
 *  given location. */
function buildInitialEnablement(
  rows: ReadonlyArray<MaterialRow>,
  depts: ReadonlyArray<Department>,
): EnablementMap {
  const out = new Map<string, EnablementCell>()
  rows.forEach((r, ri) => {
    depts.forEach((d, di) => {
      const enabled = isEnabledByDefault(r.categoryBucket, d.name)
      const seed = ri * 17 + di * 5 + 11
      const reason = enabled
        ? SAMPLE_REASONS[seed % SAMPLE_REASONS.length]
        : SAMPLE_REASONS[(seed * 3) % SAMPLE_REASONS.length]
      out.set(`${r.id}::${d.id}`, {
        enabled,
        lastModifiedAt: seededTimestamp(seed),
        lastModifiedBy: pickActor(seed),
        reason,
      })
    })
  })
  return out
}

/** Formats an ISO timestamp as e.g. "6 May 2026". */
function fmtDate(iso: string): string {
  const d = new Date(iso)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const monthName = months[d.getUTCMonth()]
  if (monthName === undefined) return iso.slice(0, 10)
  return `${d.getUTCDate()} ${monthName} ${d.getUTCFullYear()}`
}

/** ID helper. */
const cellKey = (mid: string, did: string): string => `${mid}::${did}`

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface LocationPickerProps {
  readonly value: Location
  readonly options: ReadonlyArray<Location>
  readonly onChange: (next: Location) => void
}

function LocationPicker({ value, options, onChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="tonal"
          size="default"
          className="gap-2"
          aria-label={`Location — currently ${value.name}`}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          <span className="text-sm font-medium">{value.name}</span>
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Pick location
        </span>
        <ul className="flex flex-col">
          {options.map((loc) => {
            const active = loc.id === value.id
            return (
              <li key={loc.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(loc)
                    setOpen(false)
                  }}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-on-surface">{loc.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      {loc.type.replace(/_/g, ' ')} · {loc.city}
                    </span>
                  </span>
                  {active ? (
                    <Check
                      className="h-4 w-4 text-primary shrink-0"
                      aria-hidden
                    />
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
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by ${title.toLowerCase()}${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
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
                    <span className="text-xs font-medium text-primary">
                      Selected
                    </span>
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

interface ToggleConfirmProps {
  readonly material: Material
  readonly department: Department
  readonly nextEnabled: boolean
  readonly onCancel: () => void
  readonly onConfirm: (reason: string) => void
}

function ToggleConfirm({
  material,
  department,
  nextEnabled,
  onCancel,
  onConfirm,
}: ToggleConfirmProps) {
  const [reason, setReason] = useState('')
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-on-surface">
        {nextEnabled ? 'Enable' : 'Disable'} {material.name} for{' '}
        {department.name}?
      </h3>
      <p className="text-xs text-on-surface-variant">
        {nextEnabled
          ? 'Enabling allows this department to requisition and consume the material per FR5/FR8.'
          : 'Disabling blocks new requisitions; existing in-flight workflows are unaffected.'}
      </p>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reason-textarea"
          className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
        >
          Reason code (optional)
        </label>
        <textarea
          id="reason-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this happening? (optional)"
          className="min-h-[64px] rounded-sm bg-surface-container-highest p-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={nextEnabled ? 'default' : 'destructive'}
          size="sm"
          onClick={() => onConfirm(reason.trim())}
        >
          {nextEnabled ? 'Enable' : 'Disable'}
        </Button>
      </div>
    </div>
  )
}

interface BulkConfirmProps {
  readonly count: number
  readonly action: 'enable' | 'disable'
  readonly onCancel: () => void
  readonly onConfirm: (reason: string) => void
}

function BulkConfirm({ count, action, onCancel, onConfirm }: BulkConfirmProps) {
  const [reason, setReason] = useState('')
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-on-surface">
        Apply enablement change to {count}{' '}
        {count === 1 ? 'cell' : 'cells'}?
      </h3>
      <p className="text-xs text-on-surface-variant">
        {action === 'enable'
          ? `${count} material-department pairs will be enabled.`
          : `${count} material-department pairs will be disabled.`}{' '}
        Each toggle is recorded individually in the audit trail.
      </p>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="bulk-reason-textarea"
          className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
        >
          Reason code (optional)
        </label>
        <textarea
          id="bulk-reason-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this happening? (optional)"
          className="min-h-[64px] rounded-sm bg-surface-container-highest p-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={action === 'enable' ? 'default' : 'destructive'}
          size="sm"
          onClick={() => onConfirm(reason.trim())}
        >
          {action === 'enable' ? 'Enable' : 'Disable'} {count}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell — the matrix toggle button
// ─────────────────────────────────────────────────────────────────────────────

interface MatrixCellProps {
  readonly material: Material
  readonly department: Department
  readonly cell: EnablementCell
  readonly selectMode: boolean
  readonly inSelection: boolean
  readonly onPlainToggle: () => void
  readonly onSelectToggle: () => void
}

function MatrixCell({
  material,
  department,
  cell,
  selectMode,
  inSelection,
  onPlainToggle,
  onSelectToggle,
}: MatrixCellProps) {
  const tooltipId = `tt-${material.id}-${department.id}`
  const tooltip = `Last ${cell.enabled ? 'enabled' : 'disabled'} by ${cell.lastModifiedBy} on ${fmtDate(
    cell.lastModifiedAt,
  )} — Reason: ${cell.reason ?? '—'}`

  const handleClick = () => {
    if (selectMode) onSelectToggle()
    else onPlainToggle()
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={cell.enabled}
      aria-label={`${cell.enabled ? 'Enabled' : 'Disabled'} — ${material.name} for ${department.name}. ${tooltip}`}
      aria-describedby={tooltipId}
      onClick={handleClick}
      className={[
        'group relative flex h-12 min-h-[44px] w-full items-center justify-center rounded-sm',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        cell.enabled
          ? 'bg-tertiary-container text-on-tertiary-container hover:brightness-95'
          : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
        selectMode && inSelection
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface'
          : '',
      ].join(' ')}
      title={tooltip}
    >
      {cell.enabled ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <CircleOff className="h-3.5 w-3.5 opacity-60" aria-hidden />
      )}
      <span id={tooltipId} className="sr-only">
        {tooltip}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiMdm004() {
  // ── Material rows: pick raw materials ≈12-18 for visual clarity. We keep
  //   diverse buckets to exercise the category filter.
  const materialRows: ReadonlyArray<MaterialRow> = useMemo(() => {
    const picked: ReadonlyArray<string> = [
      'mat-garam-masala',
      'mat-turmeric',
      'mat-saffron',
      'mat-paneer',
      'mat-butter',
      'mat-cream',
      'mat-cheese-mozz',
      'mat-mutton',
      'mat-chicken',
      'mat-prawns',
      'mat-onion',
      'mat-tomato',
      'mat-coriander-fresh',
      'mat-atta',
      'mat-basmati-rice',
      'mat-sugar',
      'mat-tea-leaf',
    ]
    return materials
      .filter((m) => picked.includes(m.id))
      .map((m) => ({
        id: m.id,
        material: m,
        sku: skuOf(m),
        categoryBucket: categoryBucketOf(m),
      }))
  }, [])

  // ── Location selection. Default to first cluster's central kitchen — the
  //   richest department surface (4 departments). Brand Owner can swap.
  const locationOptions = locations
  const initialLocation =
    locationOptions.find((l) => l.id === 'loc-ck-bandra') ??
    locationOptions[0]!
  const [selectedLocation, setSelectedLocation] =
    useState<Location>(initialLocation)

  const locationDepartments: ReadonlyArray<Department> = useMemo(
    () => departments.filter((d) => d.location_id === selectedLocation.id),
    [selectedLocation],
  )

  // ── Enablement state. Rebuilt when the location changes.
  const [enablement, setEnablement] = useState<EnablementMap>(() =>
    buildInitialEnablement(materialRows, locationDepartments),
  )

  // Reset enablement on location change.
  useEffect(() => {
    setEnablement(buildInitialEnablement(materialRows, locationDepartments))
    setSelectedCells(new Set())
    setSelectMode(false)
    setPendingChanges(new Map())
  }, [materialRows, locationDepartments])

  // ── Filters & search
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // ── View mode (desktop only; mobile is forced to list via responsive class)
  const [viewMode, setViewMode] = useState<ViewMode>('matrix')

  // ── Bulk selection
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCells, setSelectedCells] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [pendingChanges, setPendingChanges] = useState<
    ReadonlyMap<string, EnablementCell>
  >(new Map())
  const [bulkConfirm, setBulkConfirm] = useState<null | 'enable' | 'disable'>(
    null,
  )

  // ── Single-cell confirm
  const [singleConfirm, setSingleConfirm] = useState<null | {
    materialId: string
    departmentId: string
    nextEnabled: boolean
  }>(null)

  // List view collapsed state per department
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  // ── Filtering
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materialRows.filter((r) => {
      if (categoryFilter.size > 0 && !categoryFilter.has(r.categoryBucket))
        return false
      if (q.length > 0) {
        const hay = `${r.material.name} ${r.sku} ${r.categoryBucket}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (statusFilter !== 'all') {
        // A material qualifies for status filter if AT LEAST one cell at
        // this location matches the filter.
        const hits = locationDepartments.some((d) => {
          const c = enablement.get(cellKey(r.id, d.id))
          if (!c) return false
          return statusFilter === 'enabled' ? c.enabled : !c.enabled
        })
        if (!hits) return false
      }
      return true
    })
  }, [
    materialRows,
    categoryFilter,
    statusFilter,
    search,
    locationDepartments,
    enablement,
  ])

  // Departments may also be filtered by search on the department axis.
  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length === 0) return locationDepartments
    return locationDepartments.filter((d) =>
      d.name.toLowerCase().includes(q),
    )
  }, [locationDepartments, search])

  // ── Counts
  const totalCells = materialRows.length * locationDepartments.length
  const enabledCount = useMemo(() => {
    let n = 0
    for (const c of enablement.values()) if (c.enabled) n++
    return n
  }, [enablement])
  const disabledCount = totalCells - enabledCount

  const anyFilterActive =
    categoryFilter.size > 0 ||
    statusFilter !== 'all' ||
    search.trim().length > 0

  // ── Handlers
  const toggleSet = <V extends string>(
    set: ReadonlySet<V>,
    v: V,
  ): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const toggleSelectedCell = (key: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedCells(new Set())
    setPendingChanges(new Map())
  }

  const requestSingleToggle = (materialId: string, departmentId: string) => {
    const current = enablement.get(cellKey(materialId, departmentId))
    if (!current) return
    setSingleConfirm({
      materialId,
      departmentId,
      nextEnabled: !current.enabled,
    })
  }

  const commitSingleToggle = (reason: string) => {
    if (!singleConfirm) return
    const key = cellKey(
      singleConfirm.materialId,
      singleConfirm.departmentId,
    )
    setEnablement((prev) => {
      const next = new Map(prev)
      next.set(key, {
        enabled: singleConfirm.nextEnabled,
        lastModifiedAt: NOW_DATE.toISOString(),
        lastModifiedBy: 'Arjun Reddy',
        reason: reason.length > 0 ? reason : undefined,
      })
      return next
    })
    setSingleConfirm(null)
  }

  const requestBulk = (action: 'enable' | 'disable') => {
    if (selectedCells.size === 0) return
    setBulkConfirm(action)
  }

  const commitBulk = (reason: string) => {
    if (!bulkConfirm) return
    const action = bulkConfirm
    setEnablement((prev) => {
      const next = new Map(prev)
      for (const key of selectedCells) {
        next.set(key, {
          enabled: action === 'enable',
          lastModifiedAt: NOW_DATE.toISOString(),
          lastModifiedBy: 'Arjun Reddy',
          reason: reason.length > 0 ? reason : undefined,
        })
      }
      return next
    })
    setBulkConfirm(null)
    setSelectedCells(new Set())
    setPendingChanges(new Map())
    setSelectMode(false)
  }

  const toggleDeptCollapsed = (deptId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const enabledForDept = (deptId: string): number =>
    materialRows.reduce((acc, r) => {
      const c = enablement.get(cellKey(r.id, deptId))
      return c?.enabled ? acc + 1 : acc
    }, 0)

  const isDirty = pendingChanges.size > 0

  // ── Department list view filters
  const visibleMaterialRowsForList = filteredRows
  const visibleDepartmentsForList = filteredDepartments

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Enablement
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Material enablement matrix
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Define which raw materials each department can consume at this
              location. Enablement is the gate every requisition and stock
              movement passes through (FR5 + FR8). Toggles are auditable; the
              service-layer guard reads this map.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LocationPicker
              value={selectedLocation}
              options={locationOptions}
              onChange={setSelectedLocation}
            />
          </div>
        </header>

        {/* Dashboard tiles — quick state of enablement at this location */}
        <div className="mt-6 grid grid-cols-2 desktop:grid-cols-3 gap-3">
          <DashboardTile
            label="Enabled pairs"
            value={enabledCount.toString()}
            secondary={`of ${totalCells} cells`}
            severity="success"
          />
          <DashboardTile
            label="Disabled pairs"
            value={disabledCount.toString()}
            secondary={`of ${totalCells} cells`}
            severity="neutral"
          />
          <DashboardTile
            label="Departments"
            value={locationDepartments.length.toString()}
            secondary={`${materialRows.length} materials in scope`}
          />
        </div>

        {/* Toolbar */}
        <div className="mt-6 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipPicker<string>
              title="Category"
              options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
              selected={categoryFilter}
              onToggle={(v) => setCategoryFilter(toggleSet(categoryFilter, v))}
              onClear={() => setCategoryFilter(new Set())}
            />
            {/* Status segmented control */}
            <div
              role="radiogroup"
              aria-label="Filter by enablement status"
              className="inline-flex items-center gap-1 rounded-pill bg-surface-container p-1"
            >
              {(['all', 'enabled', 'disabled'] as const).map((s) => {
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setStatusFilter(s)}
                    className={[
                      'h-8 px-3 rounded-pill text-xs font-medium min-w-[44px]',
                      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:text-on-surface',
                    ].join(' ')}
                  >
                    {s === 'all'
                      ? 'All'
                      : s === 'enabled'
                        ? 'Enabled'
                        : 'Disabled'}
                  </button>
                )
              })}
            </div>

            {/* View toggle — desktop only */}
            <div
              role="radiogroup"
              aria-label="View mode"
              className="hidden tablet:inline-flex items-center gap-1 rounded-pill bg-surface-container p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'matrix'}
                onClick={() => setViewMode('matrix')}
                className={[
                  'h-8 px-3 rounded-pill text-xs font-medium inline-flex items-center gap-1.5 min-w-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  viewMode === 'matrix'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Matrix
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={[
                  'h-8 px-3 rounded-pill text-xs font-medium inline-flex items-center gap-1.5 min-w-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  viewMode === 'list'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')}
              >
                <List className="h-3.5 w-3.5" aria-hidden />
                List
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!selectMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Select cells
                </Button>
              ) : (
                <>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {selectedCells.size} cell
                    {selectedCells.size === 1 ? '' : 's'} selected
                  </span>
                  <Popover
                    open={bulkConfirm !== null}
                    onOpenChange={(o) => {
                      if (!o) setBulkConfirm(null)
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        disabled={selectedCells.size === 0}
                        onClick={() => requestBulk('enable')}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Enable selected
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      {bulkConfirm === 'enable' ? (
                        <BulkConfirm
                          count={selectedCells.size}
                          action="enable"
                          onCancel={() => setBulkConfirm(null)}
                          onConfirm={commitBulk}
                        />
                      ) : null}
                    </PopoverContent>
                  </Popover>
                  <Popover
                    open={bulkConfirm === 'disable'}
                    onOpenChange={(o) => {
                      if (!o) setBulkConfirm(null)
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={selectedCells.size === 0}
                        onClick={() => requestBulk('disable')}
                      >
                        <CircleOff className="h-3.5 w-3.5" aria-hidden />
                        Disable selected
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      {bulkConfirm === 'disable' ? (
                        <BulkConfirm
                          count={selectedCells.size}
                          action="disable"
                          onCancel={() => setBulkConfirm(null)}
                          onConfirm={commitBulk}
                        />
                      ) : null}
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectMode}
                    aria-label="Exit select-cells mode"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Done
                  </Button>
                </>
              )}
            </div>

            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 gap-1"
                onClick={() => {
                  setCategoryFilter(new Set())
                  setStatusFilter('all')
                  setSearch('')
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
              aria-label="Search materials or departments"
              placeholder="Search materials or departments by name"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* CC-DRAFT-PILL — surfaces during multi-toggle pending commits */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DraftPill isDraft={isDirty} mobileEyebrow />
            <span className="text-[11px] text-on-surface-variant">
              {isDirty
                ? 'Bulk pending — confirm to apply.'
                : 'Single-cell toggles auto-commit.'}
            </span>
          </div>
        </div>

        {/* ── Body — matrix on tablet/desktop OR list on mobile / explicit ─ */}
        <div className="mt-6">
          {/* MOBILE LIST (always rendered on < tablet) + DESKTOP LIST when toggled */}
          <div
            className={
              viewMode === 'list'
                ? 'block'
                : 'block tablet:hidden'
            }
          >
            <ListView
              departments={visibleDepartmentsForList}
              materialRows={visibleMaterialRowsForList}
              enablement={enablement}
              collapsed={collapsed}
              onToggleCollapsed={toggleDeptCollapsed}
              enabledForDept={enabledForDept}
              onRequestToggle={requestSingleToggle}
            />
          </div>

          {/* DESKTOP MATRIX */}
          {viewMode === 'matrix' ? (
            <div className="hidden tablet:block">
              <MatrixView
                departments={visibleDepartmentsForList}
                materialRows={visibleMaterialRowsForList}
                enablement={enablement}
                selectMode={selectMode}
                selectedCells={selectedCells}
                onPlainToggle={requestSingleToggle}
                onSelectToggle={(mid, did) =>
                  toggleSelectedCell(cellKey(mid, did))
                }
              />
            </div>
          ) : null}
        </div>

        {/* Single-cell confirm — modal-positioned overlay */}
        {singleConfirm
          ? (() => {
              const mat = materialRows.find(
                (r) => r.id === singleConfirm.materialId,
              )?.material
              const dept = locationDepartments.find(
                (d) => d.id === singleConfirm.departmentId,
              )
              if (!mat || !dept) return null
              return (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Confirm enablement change"
                  className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4"
                  onClick={() => setSingleConfirm(null)}
                >
                  <div
                    className="w-full max-w-md rounded-md bg-surface-container-lowest"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ToggleConfirm
                      material={mat}
                      department={dept}
                      nextEnabled={singleConfirm.nextEnabled}
                      onCancel={() => setSingleConfirm(null)}
                      onConfirm={commitSingleToggle}
                    />
                  </div>
                </div>
              )
            })()
          : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Sparkles className="h-3 w-3" aria-hidden />
          <span>
            Enablement matrix · gates every stock movement per FR8 service
            guard. CC-AUDIT-LINK on each row · CC-DRAFT-PILL during bulk
            pending commits.
          </span>
          <span className="ml-auto">
            SI-MDM-004 · Tier 1 Group 1 · Phase 2c-S3
          </span>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MatrixView — sticky-header desktop grid
// ─────────────────────────────────────────────────────────────────────────────

interface MatrixViewProps {
  readonly departments: ReadonlyArray<Department>
  readonly materialRows: ReadonlyArray<MaterialRow>
  readonly enablement: EnablementMap
  readonly selectMode: boolean
  readonly selectedCells: ReadonlySet<string>
  readonly onPlainToggle: (materialId: string, departmentId: string) => void
  readonly onSelectToggle: (materialId: string, departmentId: string) => void
}

function MatrixView({
  departments,
  materialRows,
  enablement,
  selectMode,
  selectedCells,
  onPlainToggle,
  onSelectToggle,
}: MatrixViewProps) {
  if (materialRows.length === 0 || departments.length === 0) {
    return <EmptyState />
  }

  // Use CSS Grid: first column sticky-left, header row sticky-top.
  // Column template: a fixed 280px label column then `auto`-sized dept cols.
  const cols = `minmax(240px, 280px) repeat(${departments.length}, minmax(120px, 1fr))`

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="Material enablement matrix"
          className="relative bg-surface-container-lowest"
          style={{ minWidth: `${240 + departments.length * 120}px` }}
        >
          {/* Header row */}
          <div
            role="row"
            className="grid sticky top-0 z-20 bg-surface-container-low"
            style={{ gridTemplateColumns: cols }}
          >
            <div
              role="columnheader"
              className="sticky left-0 z-30 bg-surface-container-low px-4 py-3"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Material ↓ / Department →
              </span>
            </div>
            {departments.map((d) => (
              <div
                key={d.id}
                role="columnheader"
                className="px-3 py-3 flex flex-col gap-0.5"
              >
                <span className="text-sm font-semibold text-on-surface">
                  {d.name}
                </span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  {d.id}
                </span>
              </div>
            ))}
          </div>

          {/* Body rows */}
          {materialRows.map((r) => (
            <div
              role="row"
              key={r.id}
              className="grid bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
              style={{ gridTemplateColumns: cols }}
            >
              {/* Row header — sticky-left */}
              <div
                role="rowheader"
                className="sticky left-0 z-10 bg-surface-container-lowest px-4 py-3 flex flex-col gap-1"
              >
                <span className="text-sm font-semibold text-on-surface">
                  {r.material.name}
                </span>
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                  <span className="font-mono">{r.sku}</span>
                  <span>·</span>
                  <span>{r.categoryBucket}</span>
                  <span>·</span>
                  <span>{r.material.uom}</span>
                </span>
                <div className="mt-1">
                  <AuditLink entityRef={r.sku} compact />
                </div>
              </div>

              {/* Cells */}
              {departments.map((d) => {
                const key = cellKey(r.id, d.id)
                const cell = enablement.get(key)
                if (!cell) return <div key={d.id} />
                return (
                  <div
                    key={d.id}
                    role="gridcell"
                    aria-selected={selectedCells.has(key)}
                    className="px-2 py-3"
                  >
                    <MatrixCell
                      material={r.material}
                      department={d}
                      cell={cell}
                      selectMode={selectMode}
                      inSelection={selectedCells.has(key)}
                      onPlainToggle={() => onPlainToggle(r.id, d.id)}
                      onSelectToggle={() => onSelectToggle(r.id, d.id)}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ListView — per-department collapsible sections (mobile default)
// ─────────────────────────────────────────────────────────────────────────────

interface ListViewProps {
  readonly departments: ReadonlyArray<Department>
  readonly materialRows: ReadonlyArray<MaterialRow>
  readonly enablement: EnablementMap
  readonly collapsed: ReadonlySet<string>
  readonly onToggleCollapsed: (deptId: string) => void
  readonly enabledForDept: (deptId: string) => number
  readonly onRequestToggle: (materialId: string, departmentId: string) => void
}

function ListView({
  departments,
  materialRows,
  enablement,
  collapsed,
  onToggleCollapsed,
  enabledForDept,
  onRequestToggle,
}: ListViewProps) {
  if (materialRows.length === 0 || departments.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-3">
      {departments.map((d) => {
        const isCollapsed = collapsed.has(d.id)
        const enabled = enabledForDept(d.id)
        return (
          <Card key={d.id} className="p-0 overflow-hidden">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-controls={`dept-panel-${d.id}`}
              onClick={() => onToggleCollapsed(d.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-semibold text-on-surface">
                  {d.name}
                </span>
                <span className="text-[11px] text-on-surface-variant tabular-nums">
                  {enabled} of {materialRows.length} enabled
                </span>
              </span>
              {isCollapsed ? (
                <ChevronRight
                  className="h-4 w-4 text-on-surface-variant"
                  aria-hidden
                />
              ) : (
                <ChevronDown
                  className="h-4 w-4 text-on-surface-variant"
                  aria-hidden
                />
              )}
            </button>
            {!isCollapsed ? (
              <>
                <SectionShift tone="low" aria-hidden />
                <ul
                  id={`dept-panel-${d.id}`}
                  className="flex flex-col bg-surface-container-lowest"
                >
                  {materialRows.map((r) => {
                    const cell = enablement.get(cellKey(r.id, d.id))
                    if (!cell) return null
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm font-medium text-on-surface truncate">
                              {r.material.name}
                            </span>
                            {cell.enabled ? (
                              <StatusPill
                                status="status_confirmed"
                                size="sm"
                                label="Enabled"
                              />
                            ) : (
                              <StatusPill
                                status="status_inactive"
                                size="sm"
                                label="Disabled"
                              />
                            )}
                          </div>
                          <span className="text-[11px] text-on-surface-variant flex flex-wrap items-center gap-1.5">
                            <span className="font-mono">{r.sku}</span>
                            <span>·</span>
                            <span>{r.categoryBucket}</span>
                            <span>·</span>
                            <span>{r.material.uom}</span>
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            Last {cell.enabled ? 'enabled' : 'disabled'} by{' '}
                            <span className="font-medium text-on-surface">
                              {cell.lastModifiedBy}
                            </span>{' '}
                            ({ACTOR_ROLES[cell.lastModifiedBy] ?? 'Staff'}) on{' '}
                            <span className="tabular-nums">
                              {fmtDate(cell.lastModifiedAt)}
                            </span>
                            {cell.reason ? (
                              <>
                                {' — Reason: '}
                                <span className="italic">{cell.reason}</span>
                              </>
                            ) : null}
                          </span>
                          <div className="mt-1">
                            <AuditLink entityRef={`${r.sku}-${d.id}`} compact />
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cell.enabled}
                          aria-label={`${cell.enabled ? 'Disable' : 'Enable'} ${r.material.name} for ${d.name}`}
                          onClick={() => onRequestToggle(r.id, d.id)}
                          className={[
                            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            'min-h-[44px] min-w-[44px] tablet:min-h-[28px] tablet:min-w-[48px]',
                            cell.enabled
                              ? 'bg-primary'
                              : 'bg-surface-container-high',
                          ].join(' ')}
                        >
                          <span
                            aria-hidden
                            className={[
                              'inline-block h-5 w-5 rounded-full bg-surface-container-lowest transition-transform',
                              cell.enabled ? 'translate-x-6' : 'translate-x-1',
                            ].join(' ')}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card>
      <div className="px-6 py-12 text-center">
        <p className="text-sm font-semibold text-on-surface">
          No materials match the current filter.
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Adjust the chips above or clear them to see every material.
        </p>
      </div>
    </Card>
  )
}
