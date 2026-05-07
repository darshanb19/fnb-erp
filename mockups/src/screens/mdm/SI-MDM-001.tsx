import { useMemo, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  MoreHorizontal,
  Plus,
  Workflow,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
} from '@/shell'

import {
  BRAND,
  clusters,
  locations,
  departments,
  type Department,
  type Location,
  type LocationType,
} from '@/lib/sample-data'

/**
 * SI-MDM-001 — Organisational Hierarchy View & Edit.
 *
 * Tier 2 mockup, Phase 4 Epic 1 Arc (b). Brand Owner-scoped admin/setup
 * surface for maintaining the brand's organisational hierarchy from brand
 * down to department. Tree view with collapsible cluster + location nodes,
 * each node carrying a status pill (active/inactive). Edit affordances are
 * realised as Popover-anchored mini-forms (Arc (c) production code will
 * graduate these to real modals; this mockup shows the form chrome, not
 * the dialog primitive).
 *
 * Source FRs:
 *   - FR1 — organisation hierarchy CRUD (brand → cluster → location → department).
 *   - FR2 — department type classification visible in the tree.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — <AuditLink /> in the screen header strip.
 *   - CC-DRAFT-PILL — <DraftPill /> at the top of any open create / edit
 *     Popover content, driven by a per-form `isDirty` flag.
 *
 * DL-022 surface (decision-log):
 *   Once a Cluster, Location, or Department is created, its parent is
 *   IMMUTABLE in MVP. The action menu lists rename, edit address & contact,
 *   deactivate, and add child — never "move to other cluster" or
 *   "change parent". Restructuring = deactivate + recreate. The choice is
 *   surfaced both as the absent affordance AND as an explicit helper-text
 *   strip below the tree so reviewers and future engineers see the
 *   constraint was deliberate.
 *
 * Tier 2 acceptance per DL-025: lighter critique than Tier 1 G1 hero
 * screens, but all 12 inventory schema fields surface visibly. The footer
 * "Inventory schema" panel renders each schema field as a <dt>/<dd> pair.
 *
 * Animation — NONE per CLAUDE.md (admin / data screen; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type DepartmentDerivedType = 'production' | 'non_production' | 'dispatch' | 'store'

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  central_kitchen: 'Central Kitchen',
  pos_outlet: 'POS Outlet',
  dispatch_hub: 'Dispatch Hub',
}

const DEPT_TYPE_LABEL: Record<DepartmentDerivedType, string> = {
  production: 'Production',
  non_production: 'Non-Production',
  dispatch: 'Dispatch',
  store: 'Store',
}

/**
 * Derive a department type from its name + parent location's type. The
 * fixture rows do not carry a `type` field; this hides the inference so
 * the rest of the file consumes a stable derived field.
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
 * Synthesised inactive set — the fixture rows don't carry `is_active`. We
 * default everything to active, then mark one department inactive so the
 * deactivated visual treatment renders somewhere on screen for review.
 */
const INACTIVE_DEPT_IDS: ReadonlySet<string> = new Set(['dept-bp-service'])

interface DepartmentRow {
  readonly dept: Department
  readonly derivedType: DepartmentDerivedType
  readonly active: boolean
}

interface LocationRow {
  readonly location: Location
  readonly active: boolean
  readonly departments: ReadonlyArray<DepartmentRow>
}

interface ClusterRow {
  readonly id: string
  readonly name: string
  readonly active: boolean
  readonly locations: ReadonlyArray<LocationRow>
  readonly departmentCount: number
}

const TREE: ReadonlyArray<ClusterRow> = clusters.map((cluster) => {
  const clusterLocations: ReadonlyArray<LocationRow> = locations
    .filter((l) => l.cluster_id === cluster.id)
    .map((location) => {
      const deptRows: ReadonlyArray<DepartmentRow> = departments
        .filter((d) => d.location_id === location.id)
        .map((dept) => ({
          dept,
          derivedType: deriveDepartmentType(dept, location),
          active: !INACTIVE_DEPT_IDS.has(dept.id),
        }))
      return { location, active: true, departments: deptRows }
    })
  const departmentCount = clusterLocations.reduce(
    (acc, l) => acc + l.departments.length,
    0,
  )
  return {
    id: cluster.id,
    name: cluster.name,
    active: true,
    locations: clusterLocations,
    departmentCount,
  }
})

const TOTAL_LOCATIONS = locations.length
const TOTAL_DEPARTMENTS = departments.length

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active-state pill. The canonical 20 has `status_inactive` but no
 * counterpart for "active", so the active state reuses `status_confirmed`
 * (mirroring SI-MDM-003's product list). Pre-commit rule 5 rejects any
 * invented status_* token outside the canonical 20.
 */
function ActiveStatusPill({ active }: { readonly active: boolean }) {
  return active ? (
    <StatusPill status="status_confirmed" size="sm" label="Active" />
  ) : (
    <StatusPill status="status_inactive" size="sm" label="Deactivated" />
  )
}

interface TypePillProps {
  readonly label: string
  readonly tone?: 'plain' | 'tonal'
}

function TypePill({ label, tone = 'plain' }: TypePillProps) {
  const cls =
    tone === 'tonal'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-surface-variant'
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  )
}

interface NodeActionMenuProps {
  readonly nodeKind: 'brand' | 'cluster' | 'location' | 'department'
  readonly nodeName: string
  readonly active: boolean
  readonly onRename: () => void
  readonly onEditContact?: () => void
  readonly onAddChild?: () => void
  readonly addChildLabel?: string
  readonly onDeactivate?: () => void
}

/**
 * Per-row action menu. DL-022 surface: this list NEVER includes
 * "Move to other cluster" / "Change parent" / "Re-parent". Restructuring
 * is deactivate + recreate.
 */
function NodeActionMenu({
  nodeKind,
  nodeName,
  active,
  onRename,
  onEditContact,
  onAddChild,
  addChildLabel,
  onDeactivate,
}: NodeActionMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Actions for ${nodeName}`}
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
                onRename()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Rename
            </button>
          </li>
          {onEditContact ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  onEditContact()
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Edit address &amp; contact
              </button>
            </li>
          ) : null}
          {onAddChild && addChildLabel ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  onAddChild()
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {addChildLabel}
              </button>
            </li>
          ) : null}
          {onDeactivate ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  onDeactivate()
                  setOpen(false)
                }}
                disabled={!active}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-error min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
              >
                Deactivate {nodeKind}
              </button>
            </li>
          ) : null}
        </ul>
        <div className="px-3 py-2 bg-surface-container-low rounded-sm mt-1">
          <p className="text-[10px] text-on-surface-variant leading-snug">
            Per DL-022, parent reassignment is not available. Restructure by
            deactivating then recreating under the new parent.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface CreateClusterFormProps {
  readonly onClose: () => void
}

/**
 * Popover-anchored mini-form (dialog stand-in for the mockup). DraftPill
 * surfaces durability per CC-DRAFT-PILL; AuditLink references the
 * draft-cluster placeholder so the chrome is visible.
 */
function CreateClusterForm({ onClose }: CreateClusterFormProps) {
  const [name, setName] = useState('')
  const [contactLocation, setContactLocation] = useState('')
  const [active, setActive] = useState(true)
  const isDirty =
    name.trim().length > 0 || contactLocation.trim().length > 0 || !active

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          New cluster
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cluster-name"
          className="text-xs font-medium text-on-surface"
        >
          Cluster name
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        </label>
        <Input
          id="cluster-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lower Parel Cluster"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cluster-contact"
          className="text-xs font-medium text-on-surface"
        >
          Contact location
        </label>
        <Input
          id="cluster-contact"
          value={contactLocation}
          onChange={(e) => setContactLocation(e.target.value)}
          placeholder="Operational hub for this cluster"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-on-surface">Active</span>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Active status"
          onClick={() => setActive(!active)}
          className={[
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            active ? 'bg-primary' : 'bg-surface-container-high',
          ].join(' ')}
        >
          <span
            aria-hidden
            className={[
              'inline-block h-5 w-5 rounded-full bg-surface-container-lowest transition-transform',
              active ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onClose} disabled={!isDirty}>
          Create cluster
        </Button>
      </div>
    </div>
  )
}

interface RenameNodeFormProps {
  readonly currentName: string
  readonly nodeKind: string
  readonly onClose: () => void
}

function RenameNodeForm({ currentName, nodeKind, onClose }: RenameNodeFormProps) {
  const [name, setName] = useState(currentName)
  const isDirty = name.trim() !== currentName.trim() && name.trim().length > 0

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Rename {nodeKind}
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="rename-input"
          className="text-xs font-medium text-on-surface"
        >
          Name
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        </label>
        <Input
          id="rename-input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onClose} disabled={!isDirty}>
          Save
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type SelectedNode =
  | { readonly kind: 'brand' }
  | { readonly kind: 'cluster'; readonly clusterId: string }
  | { readonly kind: 'location'; readonly locationId: string }
  | { readonly kind: 'department'; readonly departmentId: string }

export default function SiMdm001() {
  // Expansion state — clusters + locations expanded by default so all 14
  // departments render on first load and reviewers can confirm every node.
  const [expandedClusters, setExpandedClusters] = useState<ReadonlySet<string>>(
    () => new Set(clusters.map((c) => c.id)),
  )
  const [expandedLocations, setExpandedLocations] = useState<ReadonlySet<string>>(
    () => new Set(locations.map((l) => l.id)),
  )

  const [selected, setSelected] = useState<SelectedNode>({ kind: 'brand' })
  const [createClusterOpen, setCreateClusterOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [schemaOpen, setSchemaOpen] = useState(false)

  const toggleCluster = (id: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleLocation = (id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Breadcrumb derivation. Falls back to the brand summary when nothing
  // deeper than the brand row is selected.
  const breadcrumb = useMemo(() => {
    if (selected.kind === 'brand') {
      return {
        path: [BRAND.name],
        suffix: `${clusters.length} clusters · ${TOTAL_LOCATIONS} locations · ${TOTAL_DEPARTMENTS} departments`,
      }
    }
    if (selected.kind === 'cluster') {
      const c = TREE.find((cl) => cl.id === selected.clusterId)
      if (!c) return { path: [BRAND.name], suffix: '' }
      return {
        path: [BRAND.name, c.name],
        suffix: `${c.locations.length} locations · ${c.departmentCount} departments`,
      }
    }
    if (selected.kind === 'location') {
      const loc = locations.find((l) => l.id === selected.locationId)
      if (!loc) return { path: [BRAND.name], suffix: '' }
      const cluster = clusters.find((c) => c.id === loc.cluster_id)
      const deptCount = departments.filter(
        (d) => d.location_id === loc.id,
      ).length
      return {
        path: [BRAND.name, cluster?.name ?? '', loc.name],
        suffix: `${LOCATION_TYPE_LABEL[loc.type]} · ${deptCount} departments`,
      }
    }
    // department
    const dept = departments.find((d) => d.id === selected.departmentId)
    if (!dept) return { path: [BRAND.name], suffix: '' }
    const loc = locations.find((l) => l.id === dept.location_id)
    const cluster = clusters.find((c) => c.id === loc?.cluster_id)
    return {
      path: [BRAND.name, cluster?.name ?? '', loc?.name ?? '', dept.name],
      suffix: '',
    }
  }, [selected])

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Organisation
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Organisational hierarchy
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Maintain {BRAND.name}'s structure from brand down to department.
              Expand a cluster or location to view its children. Edit
              affordances are scoped to the focused node — parent
              reassignment is not supported in MVP per DL-022.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef={BRAND.id} compact />
            <Popover
              open={createClusterOpen}
              onOpenChange={setCreateClusterOpen}
            >
              <PopoverTrigger asChild>
                <Button aria-label="Create new cluster">
                  <Plus className="h-4 w-4" aria-hidden />
                  New cluster
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <CreateClusterForm
                  onClose={() => setCreateClusterOpen(false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Sticky breadcrumb */}
        <div className="sticky top-0 z-10 mt-4 rounded-sm bg-surface-container-low px-3 py-2 backdrop-blur">
          <nav
            aria-label="Selected node breadcrumb"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
          >
            {breadcrumb.path.map((seg, i) => (
              <span key={`${seg}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 ? (
                  <ChevronRight
                    className="h-3 w-3 text-on-surface-variant"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={
                    i === breadcrumb.path.length - 1
                      ? 'font-semibold text-on-surface'
                      : 'text-on-surface-variant'
                  }
                >
                  {seg}
                </span>
              </span>
            ))}
            {breadcrumb.suffix ? (
              <span className="ml-2 text-[11px] text-on-surface-variant">
                · {breadcrumb.suffix}
              </span>
            ) : null}
          </nav>
        </div>

        {/* Tree card */}
        <Card className="mt-6 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg tablet:text-xl text-on-surface">
                  Hierarchy tree
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Brand → Cluster → Location → Department. One brand row, three
                  clusters, six locations, fourteen departments at fixture
                  scope.
                </p>
              </div>
              <ActiveStatusPill active />
            </div>
          </CardHeader>

          <SectionShift tone="low" aria-hidden />

          <div className="overflow-x-auto">
            <ul
              role="tree"
              aria-label={`${BRAND.name} organisational hierarchy`}
              className="flex flex-col py-2 min-w-[640px]"
            >
              {/* Brand row */}
              <li role="treeitem" aria-level={1} aria-expanded="true">
                <button
                  type="button"
                  onClick={() => setSelected({ kind: 'brand' })}
                  className={[
                    'group flex w-full items-center gap-2 px-4 py-2 min-h-[44px] text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected.kind === 'brand'
                      ? 'bg-surface-container'
                      : 'hover:bg-surface-container-low',
                  ].join(' ')}
                >
                  <Building2
                    className="h-4 w-4 text-primary shrink-0"
                    aria-hidden
                  />
                  <span className="font-semibold text-on-surface">
                    {BRAND.name}
                  </span>
                  <TypePill label="Brand" tone="tonal" />
                  <ActiveStatusPill active />
                  <span className="ml-auto hidden tablet:inline text-[11px] text-on-surface-variant">
                    GSTIN {BRAND.gstin}
                  </span>
                </button>
              </li>

              {/* Cluster / location / department rows */}
              {TREE.map((cluster) => {
                const clusterExpanded = expandedClusters.has(cluster.id)
                return (
                  <li
                    key={cluster.id}
                    role="treeitem"
                    aria-level={2}
                    aria-expanded={clusterExpanded}
                  >
                    <div
                      className={[
                        'flex items-center gap-2 px-4 pl-4 py-2 min-h-[44px] tablet:pl-8',
                        selected.kind === 'cluster' &&
                        selected.clusterId === cluster.id
                          ? 'bg-surface-container'
                          : 'hover:bg-surface-container-low',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCluster(cluster.id)}
                        aria-label={
                          clusterExpanded
                            ? `Collapse ${cluster.name}`
                            : `Expand ${cluster.name}`
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {clusterExpanded ? (
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
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({
                            kind: 'cluster',
                            clusterId: cluster.id,
                          })
                        }
                        className="flex flex-1 items-center gap-2 text-left min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                      >
                        <Layers
                          className="h-4 w-4 text-on-surface-variant shrink-0"
                          aria-hidden
                        />
                        <span className="font-medium text-on-surface">
                          {cluster.name}
                        </span>
                        <TypePill label="Cluster" />
                        <ActiveStatusPill active={cluster.active} />
                        <span className="text-[11px] text-on-surface-variant tabular-nums">
                          ({cluster.locations.length}{' '}
                          {cluster.locations.length === 1
                            ? 'location'
                            : 'locations'}{' '}
                          · {cluster.departmentCount}{' '}
                          {cluster.departmentCount === 1
                            ? 'department'
                            : 'departments'}
                          )
                        </span>
                      </button>
                      <Popover
                        open={renameTargetId === cluster.id}
                        onOpenChange={(o) =>
                          setRenameTargetId(o ? cluster.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <span className="hidden" aria-hidden />
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 p-0">
                          <RenameNodeForm
                            currentName={cluster.name}
                            nodeKind="cluster"
                            onClose={() => setRenameTargetId(null)}
                          />
                        </PopoverContent>
                      </Popover>
                      <NodeActionMenu
                        nodeKind="cluster"
                        nodeName={cluster.name}
                        active={cluster.active}
                        onRename={() => setRenameTargetId(cluster.id)}
                        onEditContact={() => setRenameTargetId(cluster.id)}
                        onAddChild={() => setRenameTargetId(cluster.id)}
                        addChildLabel="Add location"
                        onDeactivate={() => setRenameTargetId(cluster.id)}
                      />
                    </div>

                    {clusterExpanded ? (
                      <ul role="group" className="flex flex-col">
                        {cluster.locations.map((locRow) => {
                          const locExpanded = expandedLocations.has(
                            locRow.location.id,
                          )
                          return (
                            <li
                              key={locRow.location.id}
                              role="treeitem"
                              aria-level={3}
                              aria-expanded={locExpanded}
                            >
                              <div
                                className={[
                                  'flex items-center gap-2 px-4 pl-8 py-2 min-h-[44px] tablet:pl-16',
                                  selected.kind === 'location' &&
                                  selected.locationId === locRow.location.id
                                    ? 'bg-surface-container'
                                    : 'hover:bg-surface-container-low',
                                ].join(' ')}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleLocation(locRow.location.id)
                                  }
                                  aria-label={
                                    locExpanded
                                      ? `Collapse ${locRow.location.name}`
                                      : `Expand ${locRow.location.name}`
                                  }
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  {locExpanded ? (
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
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelected({
                                      kind: 'location',
                                      locationId: locRow.location.id,
                                    })
                                  }
                                  className="flex flex-1 items-center gap-2 text-left min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                                >
                                  <MapPin
                                    className="h-4 w-4 text-on-surface-variant shrink-0"
                                    aria-hidden
                                  />
                                  <span className="font-medium text-on-surface">
                                    {locRow.location.name}
                                  </span>
                                  <TypePill
                                    label={
                                      LOCATION_TYPE_LABEL[locRow.location.type]
                                    }
                                  />
                                  <ActiveStatusPill active={locRow.active} />
                                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                                    ({locRow.departments.length}{' '}
                                    {locRow.departments.length === 1
                                      ? 'department'
                                      : 'departments'}
                                    )
                                  </span>
                                </button>
                                <NodeActionMenu
                                  nodeKind="location"
                                  nodeName={locRow.location.name}
                                  active={locRow.active}
                                  onRename={() =>
                                    setRenameTargetId(locRow.location.id)
                                  }
                                  onEditContact={() =>
                                    setRenameTargetId(locRow.location.id)
                                  }
                                  onAddChild={() =>
                                    setRenameTargetId(locRow.location.id)
                                  }
                                  addChildLabel="Add department"
                                  onDeactivate={() =>
                                    setRenameTargetId(locRow.location.id)
                                  }
                                />
                              </div>

                              {locExpanded ? (
                                <ul role="group" className="flex flex-col">
                                  {locRow.departments.length === 0 ? (
                                    <li className="pl-12 tablet:pl-24 py-2 text-xs text-on-surface-variant">
                                      No departments at this location.
                                    </li>
                                  ) : (
                                    locRow.departments.map((deptRow) => (
                                      <li
                                        key={deptRow.dept.id}
                                        role="treeitem"
                                        aria-level={4}
                                      >
                                        <div
                                          className={[
                                            'flex items-center gap-2 px-4 pl-12 py-2 min-h-[44px] tablet:pl-24',
                                            selected.kind === 'department' &&
                                            selected.departmentId ===
                                              deptRow.dept.id
                                              ? 'bg-surface-container'
                                              : 'hover:bg-surface-container-low',
                                          ].join(' ')}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setSelected({
                                                kind: 'department',
                                                departmentId: deptRow.dept.id,
                                              })
                                            }
                                            className="flex flex-1 items-center gap-2 text-left min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                                          >
                                            <Workflow
                                              className="h-4 w-4 text-on-surface-variant shrink-0"
                                              aria-hidden
                                            />
                                            <span
                                              className={
                                                deptRow.active
                                                  ? 'font-medium text-on-surface'
                                                  : 'font-medium text-on-surface-variant line-through'
                                              }
                                            >
                                              {deptRow.dept.name}
                                            </span>
                                            <TypePill
                                              label={
                                                DEPT_TYPE_LABEL[
                                                  deptRow.derivedType
                                                ]
                                              }
                                              tone={
                                                deptRow.derivedType ===
                                                  'production' ||
                                                deptRow.derivedType ===
                                                  'dispatch'
                                                  ? 'tonal'
                                                  : 'plain'
                                              }
                                            />
                                            <ActiveStatusPill
                                              active={deptRow.active}
                                            />
                                          </button>
                                          <NodeActionMenu
                                            nodeKind="department"
                                            nodeName={deptRow.dept.name}
                                            active={deptRow.active}
                                            onRename={() =>
                                              setRenameTargetId(deptRow.dept.id)
                                            }
                                            onDeactivate={() =>
                                              setRenameTargetId(deptRow.dept.id)
                                            }
                                          />
                                        </div>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>

        {/* DL-022 helper-text strip */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
          <Info
            className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0"
            aria-hidden
          />
          <p className="text-xs text-on-surface-variant">
            Restructuring requires deactivate + recreate. Locations and
            departments cannot be moved between parents in MVP (DL-022 — no
            re-parenting).
          </p>
        </div>

        {/* Bulk-enablement quick link */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href="/SI-MDM-004"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Bulk-enable / disable departments per material
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </a>
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
                The 12 canonical schema fields surfaced for SI-MDM-001 per
                _planning/05-screen-inventory.md lines 257–305 (Tier 2
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
                      desktop-primary
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      3 · Roles &amp; scope
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner (scope: brand)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      4 · Purpose
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Maintain the brand's organisational hierarchy from brand
                      down to department using a visual tree or nested-list
                      editor.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      5 · Data displayed
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand name + ID; clusters (name, location count, active
                      status); locations per cluster (name, type — Central
                      Kitchen / POS Outlet / Brand Store / Dispatch Hub, active
                      status, department count); departments per location
                      (name, type — Production / Non-Production / Dispatch /
                      Store, active status).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      6 · User actions
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Expand / collapse; create cluster (dialog: name, contact
                      location, active flag); edit cluster (name, address,
                      contact, phone); deactivate cluster; create location
                      under cluster (name, type, address); edit / deactivate
                      location; create department under location (name, type
                      — Production / Dispatch / Non-Production, active flag);
                      edit / deactivate department; bulk-enable / disable
                      departments for material enablement.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      7 · Cross-cutting
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      CC-AUDIT-LINK (header strip); CC-DRAFT-PILL (on each
                      create / edit dialog before dialog-level confirm).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      8 · Tokens (DESIGN.md)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface,
                      on_surface_variant, primary, outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      9 · Source FRs
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR1 (organisation hierarchy CRUD); FR2 (department type
                      classification visible in tree).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      10 · Source journey(s)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner — initial brand &amp; cluster setup
                      (one-time + occasional restructuring; admin / setup
                      surface).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      11 · Related screens
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      drill-down: SI-MDM-004 (material enablement matrix per
                      location); sibling: SI-MDM-002 (department register
                      detail view).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      12 · Notes
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Tree view (desktop) with collapsible nodes; each node
                      carries status pill (active / inactive). Edit
                      affordances are in-place or modal pop-ups per affordance
                      size. Deep nesting may require horizontal scroll on
                      smaller desktop; sticky breadcrumb shows current branch.
                      Soft-delete (deactivation) prevents deletion of
                      locations / departments with active stock or linked
                      operational records.
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
            Tier 2 admin / setup surface · DL-022 surfaced (no re-parenting).
          </span>
          <span className="ml-auto">
            SI-MDM-001 · Tier 2 · Phase 4 Epic 1 Arc (b)
          </span>
        </footer>
      </div>
    </div>
  )
}
