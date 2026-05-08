import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react'

import {
  Button,
  Card,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'

import { type UserRole } from './SI-USR-001'
import {
  REASON_CODE_LABEL,
  SAMPLE_PERMISSIONS,
  type OverrideSource,
} from './SI-USR-005'

/**
 * SI-USR-007 — Permission Overrides Expiring Soon.
 *
 * Tier 2 mockup, Phase 4 Epic 2 USR Arc (b), Task B3. Brand-wide table of
 * every time-limited permission override sorted by `expires_at` ascending,
 * with three urgency bands rendered as expiry-pill colour:
 *
 *   - 0-7 days  → urgent  → `bg-error-container text-on-error-container`
 *   - 8-30 days → soon    → `bg-tertiary-container text-on-tertiary-container`
 *                            (same warning tone as the BO-approval banner in
 *                            USR-002 — informational caution, not destructive)
 *   - >30 days  → routine → `bg-surface-container-high text-on-surface`
 *
 * FR15d — proactive renewal. Brand Owners and Cluster Managers should see
 * upcoming expiries from a single screen so accesses don't lapse without
 * a deliberate decision (e.g. parental-leave coverage rolling off mid-shift).
 *
 * CC-PERMISSION-OVERRIDE-MGMT — build-in-place per task B3 brief:
 *
 *   The OverrideSourceBadge + expiry-band helper are duplicated from USR-005
 *   and USR-006 inline copies. Task B5 extracts these into the shared shell
 *   along with `<OverrideExpiryBand>`. Keeping the duplicate intentional
 *   here so B5 has clear source material for the consolidation pass.
 *
 * Sample data:
 *
 *   ~8 expiring overrides spanning 4-5 different users and all 3 bands. The
 *   rows are produced relative to today via `isoIn(...)` so the band mapping
 *   stays correct across reviewer machines.
 *
 * Animation — NONE (data table; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & sample data
// ─────────────────────────────────────────────────────────────────────────────

interface ExpiringOverride {
  readonly id: string
  readonly userId: string
  readonly userFullName: string
  readonly userRole: UserRole
  readonly permissionId: string
  readonly source: OverrideSource
  readonly reasonCode: string
  readonly expiresAt: string
  readonly auditRef: string
}

function isoIn(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

/** ~8 entries · 3 bands · 5 users · mix of grant + revoke. */
const EXPIRING_OVERRIDES: ReadonlyArray<ExpiringOverride> = [
  {
    id: 'exp-1',
    userId: 'usr-sneha-deshmukh',
    userFullName: 'Sneha Deshmukh',
    userRole: 'pos_manager',
    permissionId: 'p-mdm-products-write',
    source: 'grant_override',
    reasonCode: 'temporary_coverage',
    expiresAt: isoIn(3),
    auditRef: 'OVR-2026-00184',
  },
  {
    id: 'exp-2',
    userId: 'usr-rohan-patel',
    userFullName: 'Rohan Patel',
    userRole: 'pos_manager',
    permissionId: 'p-mdm-vendors-read',
    source: 'grant_override',
    reasonCode: 'incident_response',
    expiresAt: isoIn(5),
    auditRef: 'OVR-2026-00191',
  },
  {
    id: 'exp-3',
    userId: 'usr-imran-sayed',
    userFullName: 'Imran Sayed',
    userRole: 'pos_staff',
    permissionId: 'p-mdm-products-read',
    source: 'grant_override',
    reasonCode: 'temporary_coverage',
    expiresAt: isoIn(7),
    auditRef: 'OVR-2026-00193',
  },
  {
    id: 'exp-4',
    userId: 'usr-sneha-deshmukh',
    userFullName: 'Sneha Deshmukh',
    userRole: 'pos_manager',
    permissionId: 'p-mdm-locations-read',
    source: 'revoke_override',
    reasonCode: 'security_concern',
    expiresAt: isoIn(14),
    auditRef: 'OVR-2026-00203',
  },
  {
    id: 'exp-5',
    userId: 'usr-deepa-pillai',
    userFullName: 'Deepa Pillai',
    userRole: 'procurement_manager',
    permissionId: 'p-mdm-vendors-delete',
    source: 'grant_override',
    reasonCode: 'vendor_audit',
    expiresAt: isoIn(21),
    auditRef: 'OVR-2026-00211',
  },
  {
    id: 'exp-6',
    userId: 'usr-arjun-rao',
    userFullName: 'Arjun Rao',
    userRole: 'production_manager',
    permissionId: 'p-mdm-categories-write',
    source: 'grant_override',
    reasonCode: 'role_transition',
    expiresAt: isoIn(28),
    auditRef: 'OVR-2026-00220',
  },
  {
    id: 'exp-7',
    userId: 'usr-rohan-patel',
    userFullName: 'Rohan Patel',
    userRole: 'pos_manager',
    permissionId: 'p-mdm-uoms-read',
    source: 'revoke_override',
    reasonCode: 'compliance_review',
    expiresAt: isoIn(60),
    auditRef: 'OVR-2026-00231',
  },
  {
    id: 'exp-8',
    userId: 'usr-arjun-rao',
    userFullName: 'Arjun Rao',
    userRole: 'production_manager',
    permissionId: 'p-mdm-products-delete',
    source: 'grant_override',
    reasonCode: 'incident_response',
    expiresAt: isoIn(90),
    auditRef: 'OVR-2026-00248',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Inline RoleBadge + OverrideSourceBadge (build-in-place per B3)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  brand_owner: 'Brand Owner',
  cluster_manager: 'Cluster Manager',
  procurement_manager: 'Procurement Manager',
  production_manager: 'Production Manager',
  pos_manager: 'POS Manager',
  pos_staff: 'POS Staff',
  accountant: 'Accountant',
  viewer: 'Viewer',
}

// Note: USR-007 uses COMPACT source labels ("Grant", "Revoke", "Baseline")
// for table-cell density, diverging from USR-005/006's long labels
// ("Role baseline", "Grant override", "Revoke override"). B5's extracted
// <CCPermissionOverrideMgmt> needs a `variant: 'long' | 'compact'` prop.
function OverrideSourceBadge({ source }: { readonly source: OverrideSource }) {
  if (source === 'grant_override') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Grant
      </span>
    )
  }
  if (source === 'revoke_override') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-on-error-container">
        <ShieldX className="h-3 w-3" aria-hidden />
        Revoke
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
      Baseline
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry-band helpers (build-in-place per B3)
// ─────────────────────────────────────────────────────────────────────────────

type ExpiryBand = 'urgent' | 'soon' | 'routine'

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function bandFor(days: number): ExpiryBand {
  if (days <= 7) return 'urgent'
  if (days <= 30) return 'soon'
  return 'routine'
}

function ExpiryPill({ iso }: { readonly iso: string }) {
  const days = daysUntil(iso)
  const band = bandFor(days)
  const klass =
    band === 'urgent'
      ? 'bg-error-container text-on-error-container'
      : band === 'soon'
        ? 'bg-tertiary-container text-on-tertiary-container'
        : 'bg-surface-container-high text-on-surface'
  const dayLabel =
    days === 0
      ? 'today'
      : days === 1
        ? 'in 1 day'
        : days < 0
          ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
          : `in ${days} days`
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums',
        klass,
      ].join(' ')}
      aria-label={`Expires ${iso} (${dayLabel})`}
    >
      <CalendarClock className="h-3 w-3" aria-hidden />
      <span>{iso}</span>
      <span className="opacity-70">·</span>
      <span>{dayLabel}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip (mode + band) — same shape as USR-001 FilterChip
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
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const MODE_OPTIONS: ReadonlyArray<{ value: OverrideSource; label: string }> = [
  { value: 'grant_override', label: 'Grant override' },
  { value: 'revoke_override', label: 'Revoke override' },
]

const BAND_OPTIONS: ReadonlyArray<{ value: ExpiryBand; label: string }> = [
  { value: 'urgent', label: 'Urgent (0-7 days)' },
  { value: 'soon', label: 'Soon (8-30 days)' },
  { value: 'routine', label: 'Routine (> 30 days)' },
]

export default function SiUsr007() {
  const [bandFilter, setBandFilter] = useState<ReadonlySet<ExpiryBand>>(new Set())
  const [modeFilter, setModeFilter] = useState<ReadonlySet<OverrideSource>>(new Set())
  const [userFilter, setUserFilter] = useState<ReadonlySet<string>>(new Set())

  const permissionById = useMemo(() => {
    const m = new Map<string, (typeof SAMPLE_PERMISSIONS)[number]>()
    for (const p of SAMPLE_PERMISSIONS) m.set(p.id, p)
    return m
  }, [])

  const userOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of EXPIRING_OVERRIDES) {
      if (!seen.has(r.userId)) seen.set(r.userId, r.userFullName)
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
  }, [])

  const filtered = useMemo(() => {
    const rows = EXPIRING_OVERRIDES.filter((r) => {
      const days = daysUntil(r.expiresAt)
      const band = bandFor(days)
      if (bandFilter.size > 0 && !bandFilter.has(band)) return false
      if (modeFilter.size > 0 && !modeFilter.has(r.source)) return false
      if (userFilter.size > 0 && !userFilter.has(r.userId)) return false
      return true
    })
    rows.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    return rows
  }, [bandFilter, modeFilter, userFilter])

  const counts = useMemo(() => {
    let urgent = 0
    let soon = 0
    let routine = 0
    for (const r of EXPIRING_OVERRIDES) {
      const b = bandFor(daysUntil(r.expiresAt))
      if (b === 'urgent') urgent += 1
      else if (b === 'soon') soon += 1
      else routine += 1
    }
    return { total: EXPIRING_OVERRIDES.length, urgent, soon, routine }
  }, [])

  const toggle = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const anyFilterActive =
    bandFilter.size > 0 || modeFilter.size > 0 || userFilter.size > 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Expiring overrides
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Permission overrides expiring soon
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Time-limited grants and revokes sorted by upcoming expiry.
              Renew, revoke now, or open the user's effective view to act
              before access lapses (FR15d).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/SI-USR-001">Back to users</Link>
            </Button>
          </div>
        </header>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-2 tablet:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Expiring total
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {counts.total}
            </p>
          </Card>
          <Card className="p-3 bg-error-container">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-error-container">
              Urgent · 0–7 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-error-container tabular-nums">
              {counts.urgent}
            </p>
            {counts.urgent > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-on-error-container">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Action recommended this week
              </p>
            ) : null}
          </Card>
          <Card className="p-3 bg-tertiary-container">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-tertiary-container">
              Soon · 8–30 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-tertiary-container tabular-nums">
              {counts.soon}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Routine · &gt;30 days
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {counts.routine}
            </p>
          </Card>
        </div>

        {/* Filter row */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip<ExpiryBand>
              title="Time band"
              options={BAND_OPTIONS}
              selected={bandFilter}
              onToggle={(v) => setBandFilter(toggle(bandFilter, v))}
              onClear={() => setBandFilter(new Set())}
            />
            <FilterChip<OverrideSource>
              title="Mode"
              options={MODE_OPTIONS}
              selected={modeFilter}
              onToggle={(v) => setModeFilter(toggle(modeFilter, v))}
              onClear={() => setModeFilter(new Set())}
            />
            <FilterChip<string>
              title="User"
              options={userOptions}
              selected={userFilter}
              onToggle={(v) => setUserFilter(toggle(userFilter, v))}
              onClear={() => setUserFilter(new Set())}
            />
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setBandFilter(new Set())
                  setModeFilter(new Set())
                  setUserFilter(new Set())
                }}
                aria-label="Reset filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Reset</span>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Result table */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Expiring overrides
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {EXPIRING_OVERRIDES.length}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CalendarClock
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                No expiring overrides match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the chips above or clear them to see every expiry.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead className="hidden tablet:table-cell">Mode</TableHead>
                  <TableHead className="hidden desktop:table-cell">
                    Reason
                  </TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const perm = permissionById.get(row.permissionId)
                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <Link
                            to={`/SI-USR-005?user=${encodeURIComponent(row.userId)}`}
                            className="font-medium text-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                          >
                            {row.userFullName}
                          </Link>
                          <span className="text-[11px] text-on-surface-variant">
                            {ROLE_LABEL[row.userRole]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-on-surface">
                            {perm?.key ?? row.permissionId}
                          </span>
                          {perm ? (
                            <span className="text-[11px] text-on-surface-variant">
                              {perm.module}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden tablet:table-cell">
                        <OverrideSourceBadge source={row.source} />
                      </TableCell>
                      <TableCell className="hidden desktop:table-cell">
                        <span className="text-[11px] font-medium text-on-surface">
                          {REASON_CODE_LABEL[row.reasonCode] ?? row.reasonCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ExpiryPill iso={row.expiresAt} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button asChild variant="tonal" size="sm">
                            <Link
                              to={`/SI-USR-006?user=${encodeURIComponent(row.userId)}&mode=edit&override=${encodeURIComponent(row.id)}`}
                              aria-label={`Renew override for ${row.userFullName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Renew
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              to={`/SI-USR-006?user=${encodeURIComponent(row.userId)}&mode=revoke&permission=${encodeURIComponent(row.permissionId)}`}
                              aria-label={`Revoke override now for ${row.userFullName}`}
                            >
                              <ShieldX className="h-3.5 w-3.5" aria-hidden />
                              Revoke now
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              to={`/SI-USR-005?user=${encodeURIComponent(row.userId)}`}
                              aria-label={`Open effective permissions for ${row.userFullName}`}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Footer note */}
        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-007 · Tier 2 · Phase 4 Epic 2 Arc (b) · {EXPIRING_OVERRIDES.length} expiring
          overrides across all 3 bands ({counts.urgent} urgent · {counts.soon} soon ·{' '}
          {counts.routine} routine). Expiry-band tokens inline; CC-PERMISSION-OVERRIDE-MGMT
          extracts in Task B5.
        </p>
      </div>
    </div>
  )
}
