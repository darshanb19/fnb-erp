import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Search,
  Workflow,
  X,
} from 'lucide-react'

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
} from '@/shell'

import {
  clusters,
  locations,
  departments,
  type Department,
  type Location,
  type LocationType,
} from '@/lib/sample-data'

/**
 * SI-MDM-002 — Department Register.
 *
 * Tier 2 mockup, Phase 4 Epic 1 Arc (b). Searchable register of every
 * department across the brand, filterable by cluster / location / type.
 * Brand Owner / Cluster Manager / Store Manager scope. The register is the
 * tabular complement to SI-MDM-001's tree view — same fixture, different
 * affordance — and keeps the mobile experience as a card list with
 * collapsible metadata so the 12 schema fields are reachable on every
 * device.
 *
 * Source FRs:
 *   - FR1 — department is part of the organisation hierarchy.
 *   - FR2 — department type classification (Production / Dispatch /
 *     Non-Production) visible on every row.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — <AuditLink /> in the header strip.
 *   - CC-DRAFT-PILL — <DraftPill /> at the top of any open create / edit
 *     Popover content, driven by a per-form `isDirty` flag.
 *
 * Tier 2 acceptance per DL-025: lighter critique than Tier 1 G1 hero
 * screens, but all 12 inventory schema fields surface visibly. Footer
 * "Inventory schema" panel renders each schema field as a <dt>/<dd> pair
 * mirroring SI-MDM-001.
 *
 * Code derivation: department code is synthesised in-file (the fixture
 * does not carry one). The chosen rule maps the alpha tail of the dept id
 * — "dept-ck-bakery" -> "CK-BAKERY" — uppercased. Stable, deterministic,
 * and matches what a system-generated schema field would look like once
 * the production code lands.
 *
 * Active state: the canonical 20 has `status_inactive` but no counterpart
 * for the active state, so the active row reuses `status_confirmed`
 * (mirroring SI-MDM-001 / SI-MDM-003). Pre-commit rule 5 rejects any
 * invented status_* token outside the canonical 20.
 *
 * Animation — NONE per CLAUDE.md (admin / register surface; entrance
 * motion banned on data tables).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type DepartmentDerivedType = 'production' | 'non_production' | 'dispatch'

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  central_kitchen: 'Central Kitchen',
  pos_outlet: 'POS Outlet',
  dispatch_hub: 'Dispatch Hub',
}

const DEPT_TYPE_LABEL: Record<DepartmentDerivedType, string> = {
  production: 'Production',
  non_production: 'Non-Production',
  dispatch: 'Dispatch',
}

const DEPT_TYPE_OPTIONS: ReadonlyArray<{
  readonly value: DepartmentDerivedType
  readonly label: string
}> = [
  { value: 'production', label: 'Production' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'non_production', label: 'Non-Production' },
]

/**
 * Derive a department type from its name + parent location's type. Mirrors
 * SI-MDM-001's helper verbatim so the same fixture row gets the same type
 * across both screens (Tier 2 acceptance — fixture coherence).
 */
function deriveDepartmentType(
  dept: Department,
  parent: Location,
): DepartmentDerivedType {
  const name = dept.name.toLowerCase()
  if (parent.type === 'central_kitchen') {
    if (
      name.includes('kitchen') ||
      name.includes('bakery') ||
      name.includes('tandoor')
    ) {
      return 'production'
    }
    return 'non_production'
  }
  if (parent.type === 'dispatch_hub') {
    if (name.includes('dispatch') || name.includes('receiving')) {
      return 'dispatch'
    }
    return 'non_production'
  }
  if (parent.type === 'pos_outlet') {
    if (name.includes('kitchen')) return 'production'
    if (name.includes('service') || name.includes('bar')) return 'non_production'
    return 'non_production'
  }
  return 'non_production'
}

/**
 * Synthesised inactive set — same row as SI-MDM-001 picks (`dept-bp-service`)
 * so the deactivation story is coherent across the two MDM register
 * surfaces during review.
 */
const INACTIVE_DEPT_IDS: ReadonlySet<string> = new Set(['dept-bp-service'])

/** Derive a deterministic department code from the fixture id. */
function deriveCode(dept: Department): string {
  return dept.id.replace(/^dept-/, '').toUpperCase()
}

/** Per-row deterministic creation date — `2024-04-01` + index days. */
function deriveCreatedAt(index: number): string {
  const base = new Date('2024-04-01T09:00:00+05:30')
  base.setUTCDate(base.getUTCDate() + index * 3)
  return base.toISOString().slice(0, 10)
}

/** Per-row deterministic last-modified date — recent April 2026. */
function deriveModifiedAt(index: number): string {
  const day = ((index * 5) % 28) + 1
  return `2026-04-${day.toString().padStart(2, '0')}`
}

interface DepartmentRow {
  readonly id: string
  readonly name: string
  readonly code: string
  readonly type: DepartmentDerivedType
  readonly location: Location
  readonly clusterId: string
  readonly clusterName: string
  readonly active: boolean
  readonly createdAt: string
  readonly modifiedAt: string
}

const ROWS: ReadonlyArray<DepartmentRow> = departments.map((dept, idx) => {
  const location = locations.find((l) => l.id === dept.location_id)!
  const cluster = clusters.find((c) => c.id === location.cluster_id)!
  return {
    id: dept.id,
    name: dept.name,
    code: deriveCode(dept),
    type: deriveDepartmentType(dept, location),
    location,
    clusterId: cluster.id,
    clusterName: cluster.name,
    active: !INACTIVE_DEPT_IDS.has(dept.id),
    createdAt: deriveCreatedAt(idx),
    modifiedAt: deriveModifiedAt(idx),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveStatusPillProps {
  readonly active: boolean
}

/** Active state reuses `status_confirmed`; deactivated uses `status_inactive`. */
function ActiveStatusPill({ active }: ActiveStatusPillProps) {
  return active ? (
    <StatusPill status="status_confirmed" size="sm" label="Active" />
  ) : (
    <StatusPill status="status_inactive" size="sm" label="Deactivated" />
  )
}

interface TypePillProps {
  readonly type: DepartmentDerivedType
}

function TypePill({ type }: TypePillProps) {
  const cls =
    type === 'production' || type === 'dispatch'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-surface-variant'
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {DEPT_TYPE_LABEL[type]}
    </span>
  )
}

interface FilterPickerProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ readonly value: V; readonly label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterPickerProps<V>) {
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
                onClear()
                setOpen(false)
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
        )}
      </PopoverContent>
    </Popover>
  )
}

interface RowActionMenuProps {
  readonly row: DepartmentRow
  readonly onEdit: () => void
  readonly onDeactivate: () => void
}

function RowActionMenu({ row, onEdit, onDeactivate }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
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
      <PopoverContent align="end" className="w-60 p-1">
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                onEdit()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit
            </button>
          </li>
          <li>
            <Link
              to="/SI-MDM-004"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View material enablement
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onDeactivate()
                setOpen(false)
              }}
              disabled={!row.active}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-error min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
            >
              Deactivate
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}

interface CreateDepartmentFormProps {
  readonly onClose: () => void
}

/** Popover-anchored mini-form. DraftPill surfaces durability per CC-DRAFT-PILL. */
function CreateDepartmentForm({ onClose }: CreateDepartmentFormProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<DepartmentDerivedType>('non_production')
  const [parentId, setParentId] = useState<string>(locations[0]?.id ?? '')

  const isDirty =
    name.trim().length > 0 || code.trim().length > 0 || type !== 'non_production'

  // Auto-suggest code when name changes and the user has not edited the code
  // field directly. Visual hint only.
  const suggestedCode = useMemo(() => {
    const trimmed = name.trim()
    if (trimmed.length === 0) return ''
    return trimmed
      .toUpperCase()
      .split(/\s+/u)
      .map((w) => w.slice(0, 4))
      .join('-')
  }, [name])

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          New department
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dept-name"
          className="text-xs font-medium text-on-surface"
        >
          Department name
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        </label>
        <Input
          id="dept-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pastry Section"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dept-code"
          className="text-xs font-medium text-on-surface"
        >
          Code
        </label>
        <Input
          id="dept-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={suggestedCode || 'Auto-generated from name'}
          className="font-mono"
        />
        {suggestedCode && code.trim().length === 0 ? (
          <span className="text-[11px] text-on-surface-variant">
            Suggested: {suggestedCode}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dept-type"
          className="text-xs font-medium text-on-surface"
        >
          Type
        </label>
        <select
          id="dept-type"
          value={type}
          onChange={(e) => setType(e.target.value as DepartmentDerivedType)}
          className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {DEPT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dept-parent"
          className="text-xs font-medium text-on-surface"
        >
          Parent location
        </label>
        <select
          id="dept-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} · {LOCATION_TYPE_LABEL[loc.type]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onClose} disabled={!isDirty}>
          Create department
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type SortColumn =
  | 'name'
  | 'code'
  | 'type'
  | 'location'
  | 'cluster'
  | 'status'
  | 'created'
  | 'modified'
type SortDirection = 'asc' | 'desc'

export default function SiMdm002() {
  const [search, setSearch] = useState('')
  const [clusterFilter, setClusterFilter] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [locationFilter, setLocationFilter] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [typeFilter, setTypeFilter] = useState<ReadonlySet<DepartmentDerivedType>>(
    new Set(),
  )

  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const [createOpen, setCreateOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // Cluster filter narrows the location filter — when a cluster is picked
  // the location dropdown only lists that cluster's locations.
  const locationOptions = useMemo(() => {
    const filtered =
      clusterFilter.size === 0
        ? locations
        : locations.filter((l) => clusterFilter.has(l.cluster_id))
    return filtered.map((l) => ({ value: l.id, label: l.name }))
  }, [clusterFilter])

  const filtered = useMemo(() => {
    return ROWS.filter((r) => {
      if (clusterFilter.size > 0 && !clusterFilter.has(r.clusterId)) return false
      if (locationFilter.size > 0 && !locationFilter.has(r.location.id))
        return false
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const hay = `${r.name} ${r.code}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [search, clusterFilter, locationFilter, typeFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'code':
          cmp = a.code.localeCompare(b.code)
          break
        case 'type':
          cmp = DEPT_TYPE_LABEL[a.type].localeCompare(DEPT_TYPE_LABEL[b.type])
          break
        case 'location':
          cmp = a.location.name.localeCompare(b.location.name)
          break
        case 'cluster':
          cmp = a.clusterName.localeCompare(b.clusterName)
          break
        case 'status':
          cmp = Number(b.active) - Number(a.active)
          break
        case 'created':
          cmp = a.createdAt.localeCompare(b.createdAt)
          break
        case 'modified':
          cmp = a.modifiedAt.localeCompare(b.modifiedAt)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortColumn, sortDirection])

  const toggleSort = (col: SortColumn) => {
    if (col === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  const toggleSet = <V extends string>(
    set: ReadonlySet<V>,
    v: V,
  ): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const anyFilterActive =
    clusterFilter.size > 0 ||
    locationFilter.size > 0 ||
    typeFilter.size > 0 ||
    search.trim().length > 0

  const totalDepts = ROWS.length
  const inactiveCount = ROWS.filter((r) => !r.active).length

  const SortIcon = ({ col }: { readonly col: SortColumn }) => {
    if (col !== sortColumn) {
      return (
        <ChevronDown
          className="h-3 w-3 text-on-surface-variant opacity-30"
          aria-hidden
        />
      )
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-on-surface" aria-hidden />
    ) : (
      <ChevronDown className="h-3 w-3 text-on-surface" aria-hidden />
    )
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Departments
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Department register
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {totalDepts} departments across {locations.length} locations ·{' '}
              {inactiveCount > 0
                ? `${inactiveCount} deactivated`
                : 'All active'}
              . Filter by cluster, location, or type. Tap a row to edit, or
              jump to{' '}
              <Link
                to="/SI-MDM-001"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                hierarchy view
              </Link>{' '}
              for a tree-shaped affordance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef="departments" compact />
            <Popover open={createOpen} onOpenChange={setCreateOpen}>
              <PopoverTrigger asChild>
                <Button aria-label="Create new department">
                  <Plus className="h-4 w-4" aria-hidden />
                  New department
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <CreateDepartmentForm onClose={() => setCreateOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Filter strip */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPicker<string>
              title="Cluster"
              options={clusters.map((c) => ({ value: c.id, label: c.name }))}
              selected={clusterFilter}
              onToggle={(v) => setClusterFilter(toggleSet(clusterFilter, v))}
              onClear={() => {
                setClusterFilter(new Set())
                // Drop location selections that fall outside the new scope.
                setLocationFilter(new Set())
              }}
            />
            <FilterPicker<string>
              title="Location"
              options={locationOptions}
              selected={locationFilter}
              onToggle={(v) => setLocationFilter(toggleSet(locationFilter, v))}
              onClear={() => setLocationFilter(new Set())}
            />
            <FilterPicker<DepartmentDerivedType>
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
                  setClusterFilter(new Set())
                  setLocationFilter(new Set())
                  setTypeFilter(new Set())
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
              aria-label="Search departments by name or code"
              placeholder="Search by name or code"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Result list — desktop table */}
        <Card className="mt-4 p-0 hidden tablet:block">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Departments
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {sorted.length} of {totalDepts}
            </span>
          </div>
          <SectionShift tone="low" aria-hidden />

          {sorted.length === 0 ? (
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
                    {(
                      [
                        { col: 'name', label: 'Department' },
                        { col: 'code', label: 'Code' },
                        { col: 'type', label: 'Type' },
                        { col: 'location', label: 'Parent location' },
                        { col: 'cluster', label: 'Cluster' },
                        { col: 'status', label: 'Status' },
                        { col: 'created', label: 'Created' },
                        { col: 'modified', label: 'Last modified' },
                      ] as ReadonlyArray<{
                        readonly col: SortColumn
                        readonly label: string
                      }>
                    ).map(({ col, label }) => (
                      <TableHead key={col}>
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
                          <SortIcon col={col} />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="w-12" aria-label="Row actions" />
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
                        {row.code}
                      </TableCell>
                      <TableCell>
                        <TypePill type={row.type} />
                      </TableCell>
                      <TableCell className="text-on-surface-variant text-xs">
                        <div className="flex flex-col">
                          <span className="text-on-surface text-sm">
                            {row.location.name}
                          </span>
                          <span className="text-[11px]">
                            {LOCATION_TYPE_LABEL[row.location.type]}
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
                        {row.modifiedAt}
                      </TableCell>
                      <TableCell>
                        <RowActionMenu
                          row={row}
                          onEdit={() => undefined}
                          onDeactivate={() => undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Result list — mobile card list (chevron-toggle pattern) */}
        <div className="mt-4 flex flex-col gap-2 tablet:hidden">
          <div className="px-1 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Departments
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {sorted.length} of {totalDepts}
            </span>
          </div>
          {sorted.length === 0 ? (
            <Card>
              <CardContent className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-on-surface">
                  No departments match the current filter.
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Adjust the filters above or clear them to see every
                  department.
                </p>
              </CardContent>
            </Card>
          ) : (
            sorted.map((row) => {
              const expanded = expandedCardId === row.id
              return (
                <Card key={row.id} className="p-0">
                  <div className="p-3 flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCardId(expanded ? null : row.id)
                      }
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
                          <ChevronDown
                            className="h-4 w-4 text-on-surface-variant"
                            aria-hidden
                          />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4 text-on-surface-variant"
                            aria-hidden
                          />
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
                          {row.location.name}
                        </span>
                      </div>
                    </button>
                    <RowActionMenu
                      row={row}
                      onEdit={() => undefined}
                      onDeactivate={() => undefined}
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
                              {row.code}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Cluster
                            </dt>
                            <dd className="mt-0.5 text-on-surface">
                              {row.clusterName}
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
                              Location type
                            </dt>
                            <dd className="mt-0.5 text-on-surface">
                              {LOCATION_TYPE_LABEL[row.location.type]}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Created
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-on-surface">
                              {row.createdAt}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                              Last modified
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-on-surface">
                              {row.modifiedAt}
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </>
                  ) : null}
                </Card>
              )
            })
          )}
        </div>

        {/* Bulk-enablement quick link mirrors SI-MDM-001 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/SI-MDM-004"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View material enablement matrix
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* Inventory schema footer panel — surfaces all 12 schema fields */}
        <Card className="mt-8 p-0">
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            aria-expanded={schemaOpen}
            aria-controls="inventory-schema-panel"
            className="flex w-full items-center justify-between gap-2 p-4 tablet:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <div>
              <CardTitle className="text-base text-on-surface">
                Inventory schema
              </CardTitle>
              <p className="mt-1 text-xs text-on-surface-variant">
                The 12 canonical schema fields surfaced for SI-MDM-002 per
                _planning/05-screen-inventory.md lines 308–353 (Tier 2
                acceptance, DL-025).
              </p>
            </div>
            {schemaOpen ? (
              <ChevronDown
                className="h-5 w-5 text-on-surface-variant shrink-0"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="h-5 w-5 text-on-surface-variant shrink-0"
                aria-hidden
              />
            )}
          </button>
          {schemaOpen ? (
            <>
              <SectionShift tone="low" aria-hidden />
              <CardContent
                id="inventory-schema-panel"
                className="p-4 tablet:p-6"
              >
                <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      1 · Primary epic
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Epic 1 — Master Data Management
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      2 · Primary device
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      responsive-equal — desktop = sortable table; mobile =
                      card list with collapsible metadata
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      3 · Roles &amp; scope
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner (brand) / Cluster Manager (cluster) / Store
                      Manager (location/department)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      4 · Purpose
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Provide a searchable register of all departments across
                      the brand, filterable to cluster or location scope, with
                      type classification and bulk action support.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      5 · Data displayed
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Department name; code (system-generated or user-assigned);
                      type (Production / Dispatch / Non-Production); parent
                      location name and cluster; active status; creation date;
                      last-modified date; row action menu (edit, deactivate,
                      view material enablement).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      6 · User actions
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Filter by cluster, location, type; search by name or
                      code; create new department (inline dialog Popover);
                      edit department name/type/address; deactivate
                      department; view material enablement → drill-down to
                      SI-MDM-004.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      7 · Cross-cutting
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      CC-AUDIT-LINK, CC-DRAFT-PILL (for inline editing).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      8 · Tokens (DESIGN.md)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface,
                      on_surface_variant, status_confirmed (active pill),
                      surface_container_high (inactive pill), outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      9 · Source FRs
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR1 (department part of hierarchy); FR2 (department type
                      classification visible on row).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      10 · Source journey(s)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner / Cluster Manager — department onboarding
                      &amp; type classification (admin/setup surface; no
                      operational journey moment).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      11 · Related screens
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      parent: SI-MDM-001 (hierarchy view); sibling: SI-MDM-004
                      (material enablement); drill-down: SI-MDM-004.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      12 · Notes
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Desktop = multi-column sortable table with type
                      filtering. Mobile = card list with type badge +
                      collapsible metadata. Department type values
                      (Production / Dispatch / Non-Production) come from FR2
                      enumeration; Non-Production includes Store, Canteen,
                      etc. per location configuration.
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
          <span>
            Tier 2 admin / setup surface · register-and-filter pattern paired
            with SI-MDM-001 hierarchy.
          </span>
          <span className="ml-auto">
            SI-MDM-002 · Tier 2 · Phase 4 Epic 1 Arc (b)
          </span>
        </footer>
      </div>
    </div>
  )
}
