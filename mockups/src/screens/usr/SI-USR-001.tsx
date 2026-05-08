import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

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
} from '@/shell'

import { clusters, departments, locations } from '@/lib/sample-data'
import { ROLE_LABEL, type UserRole } from '@/lib/user-roles'

/**
 * SI-USR-001 — User List & Filter.
 *
 * Tier 2 mockup, Phase 4 Epic 2 USR Arc (b), Task B2. The administrative
 * register of every user in the brand. Two viewing modes coexist on the
 * same route: a Brand Owner / Superadmin view (full list, edit affordances)
 * and a Cluster Manager view (read-only, filtered to a single cluster).
 *
 * Routing decision (judgment call documented per task spec):
 *
 *   Unlike SI-USR-003 / SI-USR-004 (pre-auth), this screen is rendered
 *   INSIDE the AppShell. User administration is an authenticated activity —
 *   the cockpit sidebar + persona switcher belong here.
 *
 * View-variant toggle:
 *
 *   Production wires the variant off the session role (`useSession()` in
 *   Arc (c)). The mockup exposes a small button-pair at the top so reviewers
 *   can flip between BO and CM views without touching auth state. The CM
 *   view (a) filters the list to one cluster (Bandra-West fixture), (b)
 *   removes the Edit / Deactivate row actions, (c) renders a banner above
 *   the table noting the read-only filter. This mirrors FR12 — Cluster
 *   Managers can see only users scoped to their own cluster.
 *
 * RoleBadge — consumes the CC-ROLE-BADGE shell:
 *
 *   The 9-role badge is rendered via `<RoleBadge size="sm" />` from the
 *   shared `CCRoleBadge` shell (promoted in Task B6 once 5 USR surfaces
 *   confirmed the pattern). The `UserRole` type and `ROLE_LABEL` map both
 *   live in `@/lib/user-roles` — single source of truth, mirror of
 *   `apps/api/src/db/schema/auth.ts` `userRoleEnum`.
 *
 * StatusPill mapping for user status (canonical 20 only — DESIGN.md §6.1):
 *
 *   - `active`           → `status_confirmed`         (green check)
 *   - `inactive`         → `status_inactive`          (grey)
 *   - `pending_approval` → `status_pending_approval`  (amber clock pill)
 *
 * Source FRs:
 *   - FR11 — user list (multi-criteria filterable register).
 *   - FR12 — role-scope filtering (CM sees only their cluster's users).
 *
 * Token notes:
 *   - No `tenant_brand_accent` (DESIGN.md §3 — list screens are not one of
 *     the four allowed accent surfaces).
 *   - `bg-tertiary-container text-on-tertiary-container` for the CM banner
 *     (§6.4 informational caution tone — same family that drives
 *     `status_pending_approval`).
 *
 * Animation — NONE per CLAUDE.md (data table; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & sample data
// ─────────────────────────────────────────────────────────────────────────────

type UserStatus = 'active' | 'inactive' | 'pending_approval'

interface SampleUser {
  readonly id: string
  readonly fullName: string
  readonly email: string
  readonly role: UserRole
  readonly status: UserStatus
  /** Cluster id when role is cluster_manager / pos_manager / pos_staff. */
  readonly clusterId: string | null
  /** Location id when role is pos_manager / pos_staff. */
  readonly locationId: string | null
  /** Department id when role is pos_manager / pos_staff. */
  readonly departmentId: string | null
  readonly overrideCount: number
  /** ISO date or null when never logged in. */
  readonly lastLoginAt: string | null
}

const SAMPLE_USERS: ReadonlyArray<SampleUser> = [
  {
    id: 'usr-priya-iyer',
    fullName: 'Priya Iyer',
    email: 'priya.iyer@wildsugar.in',
    role: 'brand_owner',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 4,
    lastLoginAt: '2026-05-08T08:14:00+05:30',
  },
  {
    id: 'usr-rahul-mehta',
    fullName: 'Rahul Mehta',
    email: 'rahul.mehta@wildsugar.in',
    role: 'cluster_manager',
    status: 'active',
    clusterId: 'cl-bandra-west',
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: '2026-05-07T19:45:00+05:30',
  },
  {
    id: 'usr-ayesha-khan',
    fullName: 'Ayesha Khan',
    email: 'ayesha.khan@wildsugar.in',
    role: 'cluster_manager',
    status: 'active',
    clusterId: 'cl-andheri-east',
    locationId: null,
    departmentId: null,
    overrideCount: 1,
    lastLoginAt: '2026-05-08T07:20:00+05:30',
  },
  {
    id: 'usr-vikram-shetty',
    fullName: 'Vikram Shetty',
    email: 'vikram.shetty@wildsugar.in',
    role: 'cluster_manager',
    status: 'inactive',
    clusterId: 'cl-powai',
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: '2026-03-12T11:05:00+05:30',
  },
  {
    id: 'usr-deepa-pillai',
    fullName: 'Deepa Pillai',
    email: 'deepa.pillai@wildsugar.in',
    role: 'procurement_manager',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 3,
    lastLoginAt: '2026-05-08T06:55:00+05:30',
  },
  {
    id: 'usr-arjun-rao',
    fullName: 'Arjun Rao',
    email: 'arjun.rao@wildsugar.in',
    role: 'production_manager',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 2,
    lastLoginAt: '2026-05-07T22:10:00+05:30',
  },
  {
    id: 'usr-sneha-deshmukh',
    fullName: 'Sneha Deshmukh',
    email: 'sneha.deshmukh@wildsugar.in',
    role: 'pos_manager',
    status: 'active',
    clusterId: 'cl-bandra-west',
    locationId: 'loc-bandra-linking',
    departmentId: 'dept-bl-service',
    overrideCount: 5,
    lastLoginAt: '2026-05-08T08:02:00+05:30',
  },
  {
    id: 'usr-imran-sayed',
    fullName: 'Imran Sayed',
    email: 'imran.sayed@wildsugar.in',
    role: 'pos_staff',
    status: 'active',
    clusterId: 'cl-bandra-west',
    locationId: 'loc-bandra-linking',
    departmentId: 'dept-bl-kitchen',
    overrideCount: 0,
    lastLoginAt: '2026-05-08T07:30:00+05:30',
  },
  {
    id: 'usr-kavya-nair',
    fullName: 'Kavya Nair',
    email: 'kavya.nair@wildsugar.in',
    role: 'pos_staff',
    status: 'pending_approval',
    clusterId: 'cl-bandra-west',
    locationId: 'loc-bandra-pali',
    departmentId: 'dept-bp-service',
    overrideCount: 0,
    lastLoginAt: null,
  },
  {
    id: 'usr-rohan-patel',
    fullName: 'Rohan Patel',
    email: 'rohan.patel@wildsugar.in',
    role: 'pos_manager',
    status: 'active',
    clusterId: 'cl-andheri-east',
    locationId: 'loc-andheri-phoenix',
    departmentId: 'dept-ap-service',
    overrideCount: 1,
    lastLoginAt: '2026-05-07T23:18:00+05:30',
  },
  {
    id: 'usr-nidhi-kapoor',
    fullName: 'Nidhi Kapoor',
    email: 'nidhi.kapoor@wildsugar.in',
    role: 'accountant',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: '2026-05-07T18:00:00+05:30',
  },
  {
    id: 'usr-saurabh-jain',
    fullName: 'Saurabh Jain',
    email: 'saurabh.jain@wildsugar.in',
    role: 'viewer',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: '2026-05-06T10:42:00+05:30',
  },
  {
    id: 'usr-ravi-kumar',
    fullName: 'Ravi Kumar',
    email: 'ravi.kumar@wildsugar.in',
    role: 'pos_staff',
    status: 'inactive',
    clusterId: 'cl-powai',
    locationId: 'loc-powai-hiranandani',
    departmentId: 'dept-ph-kitchen',
    overrideCount: 0,
    lastLoginAt: '2026-02-22T09:15:00+05:30',
  },
  {
    id: 'usr-anita-gupta',
    fullName: 'Anita Gupta',
    email: 'anita.gupta@wildsugar.in',
    role: 'brand_owner',
    status: 'pending_approval',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: null,
  },
  {
    id: 'usr-platform-ops',
    fullName: 'Platform Ops',
    email: 'platform-ops@fnberp.example',
    role: 'superadmin',
    status: 'active',
    clusterId: null,
    locationId: null,
    departmentId: null,
    overrideCount: 0,
    lastLoginAt: '2026-05-08T05:50:00+05:30',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = (
  Object.keys(ROLE_LABEL) as UserRole[]
).map((value) => ({ value, label: ROLE_LABEL[value] }))

const STATUS_OPTIONS: ReadonlyArray<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending_approval', label: 'Pending approval' },
]

const SCOPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'brand', label: 'Brand-wide' },
  ...clusters.map((c) => ({ value: c.id, label: c.name })),
]

function statusToToken(s: UserStatus) {
  if (s === 'active') return 'status_confirmed' as const
  if (s === 'inactive') return 'status_inactive' as const
  return 'status_pending_approval' as const
}

function statusLabel(s: UserStatus): string {
  if (s === 'active') return 'Active'
  if (s === 'inactive') return 'Inactive'
  return 'Pending approval'
}

function scopeSummary(u: SampleUser): string {
  if (u.role === 'superadmin') return 'Multi-tenant'
  if (
    u.role === 'brand_owner' ||
    u.role === 'procurement_manager' ||
    u.role === 'production_manager' ||
    u.role === 'accountant' ||
    u.role === 'viewer'
  ) {
    return 'Brand-wide'
  }
  if (u.role === 'cluster_manager') {
    const cl = clusters.find((c) => c.id === u.clusterId)
    return cl ? cl.name : 'Cluster (unset)'
  }
  // pos_manager / pos_staff
  const loc = locations.find((l) => l.id === u.locationId)
  const dept = departments.find((d) => d.id === u.departmentId)
  if (loc && dept) return `${loc.name} · ${dept.name}`
  if (loc) return loc.name
  return 'Location (unset)'
}

function formatLastLogin(iso: string | null): string {
  if (iso === null) return 'Never'
  // Render as a short stable label — `2026-05-08 08:14`. Avoids any locale
  // dependency that would shift across reviewers' machines.
  return iso.slice(0, 16).replace('T', ' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip popover (multi-select)
// ─────────────────────────────────────────────────────────────────────────────

interface FilterChipProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ value: V; label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterChip<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipProps<V>) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by ${title.toLowerCase()}${
            count > 0 ? ` — ${count} selected` : ''
          }`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus
              className="h-3.5 w-3.5 text-on-surface-variant"
              aria-hidden
            />
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

// ─────────────────────────────────────────────────────────────────────────────
// Row action menu
// ─────────────────────────────────────────────────────────────────────────────

interface RowActionMenuProps {
  readonly user: SampleUser
  readonly onEdit: () => void
  readonly onDeactivate: () => void
}

function RowActionMenu({ user, onEdit, onDeactivate }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
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
      <PopoverContent align="end" className="w-56 p-1">
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
              Edit user
            </button>
          </li>
          <li>
            <Link
              to={`/SI-USR-005?user=${encodeURIComponent(user.id)}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Manage overrides
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onDeactivate()
                setOpen(false)
              }}
              disabled={user.status !== 'active'}
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

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'brand_owner' | 'cluster_manager'

/** When the mockup is in CM-view it pretends to be this cluster's CM. */
const CM_VIEW_CLUSTER_ID = 'cl-bandra-west'

export default function SiUsr001() {
  const [view, setView] = useState<ViewMode>('brand_owner')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<ReadonlySet<UserRole>>(new Set())
  const [statusFilter, setStatusFilter] = useState<ReadonlySet<UserStatus>>(
    new Set(),
  )
  const [scopeFilter, setScopeFilter] = useState<ReadonlySet<string>>(new Set())

  const cmClusterName = clusters.find((c) => c.id === CM_VIEW_CLUSTER_ID)?.name

  const filtered = useMemo(() => {
    return SAMPLE_USERS.filter((u) => {
      // CM view filter — restrict to users in CM_VIEW_CLUSTER_ID; CM never
      // sees superadmin / brand_owner / brand-wide-domain roles in their
      // cluster admin (FR12).
      if (view === 'cluster_manager') {
        if (u.role === 'superadmin') return false
        if (u.role === 'brand_owner') return false
        if (
          u.role === 'procurement_manager' ||
          u.role === 'production_manager' ||
          u.role === 'accountant' ||
          u.role === 'viewer'
        ) {
          return false
        }
        if (u.clusterId !== CM_VIEW_CLUSTER_ID) return false
      }

      if (roleFilter.size > 0 && !roleFilter.has(u.role)) return false
      if (statusFilter.size > 0 && !statusFilter.has(u.status)) return false
      if (scopeFilter.size > 0) {
        const isBrandWide =
          u.role === 'brand_owner' ||
          u.role === 'procurement_manager' ||
          u.role === 'production_manager' ||
          u.role === 'accountant' ||
          u.role === 'viewer' ||
          u.role === 'superadmin'
        const matchesBrand =
          scopeFilter.has('brand') && isBrandWide
        const matchesCluster =
          u.clusterId !== null && scopeFilter.has(u.clusterId)
        if (!matchesBrand && !matchesCluster) return false
      }

      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const hay = `${u.fullName} ${u.email}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [view, search, roleFilter, statusFilter, scopeFilter])

  const totalUsers = SAMPLE_USERS.length
  const anyFilterActive =
    roleFilter.size > 0 ||
    statusFilter.size > 0 ||
    scopeFilter.size > 0 ||
    search.trim().length > 0

  const toggleSet = <V extends string>(
    set: ReadonlySet<V>,
    v: V,
  ): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const isReadOnly = view === 'cluster_manager'

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Users
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Users
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {totalUsers} users across the brand. Brand Owners and
              Superadmins see the whole register; Cluster Managers see only
              users scoped to their own cluster (FR12).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="tonal" size="sm">
              <Link to="/SI-USR-002">
                <UserPlus className="h-4 w-4" aria-hidden />
                New user
              </Link>
            </Button>
          </div>
        </header>

        {/* View-variant toggle (mockup-only — production reads role from session). */}
        <div
          role="radiogroup"
          aria-label="View variant (mockup-only)"
          className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low p-1"
        >
          {(
            [
              { value: 'brand_owner', label: 'Brand Owner view (full brand)' },
              {
                value: 'cluster_manager',
                label: 'Cluster Manager view (read-only)',
              },
            ] as const
          ).map((opt) => {
            const active = view === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setView(opt.value)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-pill px-3 h-9 text-xs font-medium',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high',
                ].join(' ')}
              >
                {opt.value === 'cluster_manager' ? (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* CM read-only banner */}
        {isReadOnly ? (
          <div
            role="note"
            className="mt-3 flex items-start gap-2 rounded-sm bg-tertiary-container text-on-tertiary-container px-3 py-2"
          >
            <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <p className="text-xs">
              <span className="font-semibold">Cluster Manager view:</span>{' '}
              read-only. Filtered to{' '}
              <span className="font-semibold">{cmClusterName}</span>. Edit and
              deactivate actions are hidden — Cluster Managers cannot mutate
              user records (FR12).
            </p>
          </div>
        ) : null}

        {/* Filter row */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip<UserRole>
              title="Role"
              options={ROLE_OPTIONS}
              selected={roleFilter}
              onToggle={(v) => setRoleFilter(toggleSet(roleFilter, v))}
              onClear={() => setRoleFilter(new Set())}
            />
            <FilterChip<UserStatus>
              title="Status"
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onToggle={(v) => setStatusFilter(toggleSet(statusFilter, v))}
              onClear={() => setStatusFilter(new Set())}
            />
            <FilterChip<string>
              title="Scope"
              options={SCOPE_OPTIONS}
              selected={scopeFilter}
              onToggle={(v) => setScopeFilter(toggleSet(scopeFilter, v))}
              onClear={() => setScopeFilter(new Set())}
            />
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setRoleFilter(new Set())
                  setStatusFilter(new Set())
                  setScopeFilter(new Set())
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
              aria-label="Search users by name or email"
              placeholder="Search by name or email"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Result table */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Users</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {totalUsers}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Users
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                No users match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the chips above or clear them to see every user.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden tablet:table-cell">
                    Email
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden tablet:table-cell">
                    Scope
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden desktop:table-cell text-right">
                    Overrides
                  </TableHead>
                  <TableHead className="hidden desktop:table-cell">
                    Last login
                  </TableHead>
                  {isReadOnly ? null : (
                    <TableHead className="w-12" aria-label="Row actions" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
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
                        status={statusToToken(u.status)}
                        size="sm"
                        label={statusLabel(u.status)}
                      />
                    </TableCell>
                    <TableCell className="hidden desktop:table-cell text-right">
                      {u.overrideCount > 0 ? (
                        <Link
                          to={`/SI-USR-005?user=${encodeURIComponent(u.id)}`}
                          className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`${u.overrideCount} overrides — manage`}
                        >
                          <ShieldAlert
                            className="h-3 w-3"
                            aria-hidden
                          />
                          <span className="tabular-nums">
                            {u.overrideCount}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant tabular-nums">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden desktop:table-cell text-xs text-on-surface-variant tabular-nums">
                      {formatLastLogin(u.lastLoginAt)}
                    </TableCell>
                    {isReadOnly ? null : (
                      <TableCell>
                        <RowActionMenu
                          user={u}
                          onEdit={() => {
                            // Mockup-only — Arc (c) wires navigation to USR-002 in edit mode.
                          }}
                          onDeactivate={() => {
                            // Mockup-only — Arc (c) wires userService.deactivate.
                          }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Footer note for reviewers */}
        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-001 · Tier 2 · Phase 4 Epic 2 Arc (b) · {totalUsers} sample
          users covering all 9 roles, 3 statuses, and varied override / login
          history.
        </p>
      </div>
    </div>
  )
}
