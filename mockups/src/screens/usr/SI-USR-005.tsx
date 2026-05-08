import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Minus,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  Card,
  Input,
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

/**
 * SI-USR-005 — Effective Permissions View.
 *
 * Tier 2 mockup, Phase 4 Epic 2 USR Arc (b), Task B3. Read-only grid of the
 * complete effective-permission set for a single target user. Three sources
 * are merged into one table: the role baseline (derived from the role/
 * permission matrix), grant overrides (added on top of the baseline), and
 * revoke overrides (subtracted from the baseline). FR15b — the resolved
 * effective set must be visible from a single screen so reviewers can see
 * exactly what the user can and cannot do.
 *
 * Routing decision:
 *
 *   Rendered INSIDE the AppShell — same as USR-001 / USR-002. Permission
 *   administration is an authenticated activity. The deep-link target from
 *   USR-001's row "Manage overrides" action lands here.
 *
 * Source rendering pattern (CC-PERMISSION-OVERRIDE-MGMT, build-in-place):
 *
 *   This screen is one of 3 consumers of the override-source pattern (the
 *   other two are SI-USR-006 and SI-USR-007). Per task B3 brief, the pattern
 *   is intentionally INLINED here so B5 has a clear duplicate to extract
 *   into `<CCPermissionOverrideMgmt>` with subcomponents
 *   `<OverrideSourceBadge>`, `<OverrideCard>`, `<OverrideExpiryBand>`,
 *   `<OverrideReasonInput>`. The shape of `OverrideSource` and the source-
 *   to-tone mapping below is the API surface those subcomponents will share.
 *
 * Tone mapping (DESIGN.md §6.4 tonal containers + canonical 20 status palette):
 *
 *   - `role_baseline`   → neutral `bg-surface-container-high text-on-surface`
 *                          (`Shield` glyph — calm, not an alert)
 *   - `grant_override`  → positive `bg-secondary-container text-on-secondary-container`
 *                          (`ShieldCheck` glyph — secondary container is the
 *                          closest existing tonal to "additive / approved",
 *                          since `success-container` is not in the project's
 *                          token set; same family used for
 *                          `status_template_active` / `status_version_published`)
 *   - `revoke_override` → caution `bg-error-container text-on-error-container`
 *                          (`ShieldX` glyph — same family as
 *                          `status_overridden` and the GR-rejected banner)
 *
 *   No `tenant_brand_accent` — DESIGN.md §3 lists the four allowed accent
 *   surfaces and admin permission grids are not among them.
 *
 * SAMPLE_PERMISSIONS export:
 *
 *   USR-006 and USR-007 import `SAMPLE_PERMISSIONS` from this file (same
 *   cross-screen import pattern USR-002 uses for `UserRole`). Code review
 *   already flagged this as a B6 extraction-pass concern — left as-is so
 *   B6 can consolidate into `mockups/src/lib/sample-data.ts` once the third
 *   reader's API needs are settled.
 *
 * Source FRs:
 *   - FR15b — effective-permissions resolver visible to admins.
 *
 * Animation — NONE (data table; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Permissions catalog — exported for USR-006 / USR-007 consumers
// ─────────────────────────────────────────────────────────────────────────────

export interface SamplePermission {
  readonly id: string
  readonly key: string
  readonly module: string
  readonly action: 'read' | 'write' | 'delete' | 'approve' | 'grant' | 'revoke' | 'audit'
  readonly description: string
}

/**
 * Hardcoded ~30-entry catalog covering MDM CRUD across the 10 resources
 * shipped in Epic 1 plus the user / permission management actions added by
 * Epic 2. The set mirrors the catalog spec in Arc (a) §5 — keep in sync if
 * Arc (a) shifts before B5 extracts.
 */
export const SAMPLE_PERMISSIONS: ReadonlyArray<SamplePermission> = [
  // mdm.products
  { id: 'p-mdm-products-read', key: 'mdm.products.read', module: 'MDM · Products', action: 'read', description: 'view the product master list' },
  { id: 'p-mdm-products-write', key: 'mdm.products.write', module: 'MDM · Products', action: 'write', description: 'create or edit products' },
  { id: 'p-mdm-products-delete', key: 'mdm.products.delete', module: 'MDM · Products', action: 'delete', description: 'soft-delete (deactivate) products' },
  // mdm.vendors
  { id: 'p-mdm-vendors-read', key: 'mdm.vendors.read', module: 'MDM · Vendors', action: 'read', description: 'view the vendor master list' },
  { id: 'p-mdm-vendors-write', key: 'mdm.vendors.write', module: 'MDM · Vendors', action: 'write', description: 'create or edit vendors' },
  { id: 'p-mdm-vendors-delete', key: 'mdm.vendors.delete', module: 'MDM · Vendors', action: 'delete', description: 'soft-delete vendors' },
  // mdm.categories
  { id: 'p-mdm-categories-read', key: 'mdm.categories.read', module: 'MDM · Categories', action: 'read', description: 'view the category tree' },
  { id: 'p-mdm-categories-write', key: 'mdm.categories.write', module: 'MDM · Categories', action: 'write', description: 'create or edit categories' },
  { id: 'p-mdm-categories-delete', key: 'mdm.categories.delete', module: 'MDM · Categories', action: 'delete', description: 'deactivate categories' },
  // mdm.departments
  { id: 'p-mdm-departments-read', key: 'mdm.departments.read', module: 'MDM · Departments', action: 'read', description: 'view department master' },
  { id: 'p-mdm-departments-write', key: 'mdm.departments.write', module: 'MDM · Departments', action: 'write', description: 'create or edit departments' },
  { id: 'p-mdm-departments-delete', key: 'mdm.departments.delete', module: 'MDM · Departments', action: 'delete', description: 'deactivate departments' },
  // mdm.locations
  { id: 'p-mdm-locations-read', key: 'mdm.locations.read', module: 'MDM · Locations', action: 'read', description: 'view location master' },
  { id: 'p-mdm-locations-write', key: 'mdm.locations.write', module: 'MDM · Locations', action: 'write', description: 'create or edit locations' },
  { id: 'p-mdm-locations-delete', key: 'mdm.locations.delete', module: 'MDM · Locations', action: 'delete', description: 'deactivate locations' },
  // mdm.clusters
  { id: 'p-mdm-clusters-read', key: 'mdm.clusters.read', module: 'MDM · Clusters', action: 'read', description: 'view cluster master' },
  { id: 'p-mdm-clusters-write', key: 'mdm.clusters.write', module: 'MDM · Clusters', action: 'write', description: 'create or edit clusters' },
  { id: 'p-mdm-clusters-delete', key: 'mdm.clusters.delete', module: 'MDM · Clusters', action: 'delete', description: 'deactivate clusters' },
  // mdm.hierarchy
  { id: 'p-mdm-hierarchy-read', key: 'mdm.hierarchy.read', module: 'MDM · Hierarchy', action: 'read', description: 'view brand → cluster → location tree' },
  { id: 'p-mdm-hierarchy-write', key: 'mdm.hierarchy.write', module: 'MDM · Hierarchy', action: 'write', description: 'edit hierarchy parent / child mapping' },
  // mdm.enablement
  { id: 'p-mdm-enablement-read', key: 'mdm.enablement.read', module: 'MDM · Enablement', action: 'read', description: 'view the per-location enablement matrix' },
  { id: 'p-mdm-enablement-write', key: 'mdm.enablement.write', module: 'MDM · Enablement', action: 'write', description: 'toggle enablement at a location' },
  // mdm.uoms
  { id: 'p-mdm-uoms-read', key: 'mdm.uoms.read', module: 'MDM · UOMs', action: 'read', description: 'view units of measure' },
  { id: 'p-mdm-uoms-write', key: 'mdm.uoms.write', module: 'MDM · UOMs', action: 'write', description: 'create or edit units of measure' },
  // mdm.company
  { id: 'p-mdm-company-read', key: 'mdm.company.read', module: 'MDM · Company', action: 'read', description: 'view brand company profile' },
  { id: 'p-mdm-company-write', key: 'mdm.company.write', module: 'MDM · Company', action: 'write', description: 'edit brand company profile' },
  // users
  { id: 'p-users-read', key: 'users.read', module: 'User Mgmt · Users', action: 'read', description: 'view the user list' },
  { id: 'p-users-write', key: 'users.write', module: 'User Mgmt · Users', action: 'write', description: 'create or edit user accounts' },
  { id: 'p-users-delete', key: 'users.delete', module: 'User Mgmt · Users', action: 'delete', description: 'deactivate user accounts' },
  { id: 'p-users-approve', key: 'users.approve', module: 'User Mgmt · Users', action: 'approve', description: 'approve pending user sign-up requests' },
  // permissions
  { id: 'p-permissions-grant', key: 'permissions.grant', module: 'User Mgmt · Permissions', action: 'grant', description: 'grant permission overrides to other users' },
  { id: 'p-permissions-revoke', key: 'permissions.revoke', module: 'User Mgmt · Permissions', action: 'revoke', description: 'revoke permissions from other users' },
  { id: 'p-permissions-audit', key: 'permissions.audit', module: 'User Mgmt · Permissions', action: 'audit', description: 'access the permissions audit trail' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Effective-permission row + sample data (Sneha Deshmukh, POS Manager)
// ─────────────────────────────────────────────────────────────────────────────

export type OverrideSource = 'role_baseline' | 'grant_override' | 'revoke_override'

export interface EffectivePermission {
  readonly id: string
  readonly permissionId: string
  readonly source: OverrideSource
  /** Reason code + free-text — present on overrides only. */
  readonly reasonCode: string | null
  readonly reasonNotes: string | null
  /** ISO date or null — null means permanent. */
  readonly expiresAt: string | null
  /** Human label for the actor that mutated the override (display-only). */
  readonly grantedBy: string | null
  readonly auditRef: string | null
}

/** Target user — Sneha Deshmukh; deep-linked from USR-001 row action. */
export const SAMPLE_TARGET_USER = {
  id: 'usr-sneha-deshmukh',
  fullName: 'Sneha Deshmukh',
  email: 'sneha.deshmukh@wildsugar.in',
  role: 'pos_manager' as UserRole,
}

/**
 * Helper — produce ISO dates relative to today so the expiry-band logic in
 * SI-USR-007 lands in all three colour bands without hard-coding a frozen
 * calendar reference. Dates render with the YYYY-MM-DD slice; reviewers see
 * a stable label even if today shifts.
 */
function isoIn(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

/**
 * Sneha's resolved effective permissions — 8 baseline + 2 grants + 2 revokes
 * = 12 total, spanning all 3 sources and 3 expiry bands per task spec.
 */
export const SAMPLE_EFFECTIVE: ReadonlyArray<EffectivePermission> = [
  // ── 8 role baseline (POS Manager defaults) ──────────────────────────────
  { id: 'ef-1', permissionId: 'p-mdm-products-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-2', permissionId: 'p-mdm-categories-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-3', permissionId: 'p-mdm-vendors-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-4', permissionId: 'p-mdm-locations-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-5', permissionId: 'p-mdm-departments-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-6', permissionId: 'p-mdm-uoms-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-7', permissionId: 'p-mdm-enablement-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  { id: 'ef-8', permissionId: 'p-mdm-hierarchy-read', source: 'role_baseline', reasonCode: null, reasonNotes: null, expiresAt: null, grantedBy: null, auditRef: null },
  // ── 2 grant overrides (one urgent expiry, one permanent) ────────────────
  {
    id: 'ef-9',
    permissionId: 'p-mdm-products-write',
    source: 'grant_override',
    reasonCode: 'temporary_coverage',
    reasonNotes: 'Covering for Vihaan Joshi (Procurement Asst.) on parental leave through end of May.',
    expiresAt: isoIn(3),
    grantedBy: 'Priya Iyer (Brand Owner)',
    auditRef: 'OVR-2026-00184',
  },
  {
    id: 'ef-10',
    permissionId: 'p-mdm-vendors-write',
    source: 'grant_override',
    reasonCode: 'role_transition',
    reasonNotes: 'Promoted track — Sneha will take over cluster vendor onboarding from Q3.',
    expiresAt: null,
    grantedBy: 'Priya Iyer (Brand Owner)',
    auditRef: 'OVR-2026-00141',
  },
  // ── 2 revoke overrides (one with expiry, one permanent) ─────────────────
  {
    id: 'ef-11',
    permissionId: 'p-mdm-locations-read',
    source: 'revoke_override',
    reasonCode: 'security_concern',
    reasonNotes: 'Pending review of cross-cluster data access — read access reduced to own cluster only.',
    expiresAt: isoIn(14),
    grantedBy: 'Rahul Mehta (Cluster Manager)',
    auditRef: 'OVR-2026-00203',
  },
  {
    id: 'ef-12',
    permissionId: 'p-mdm-uoms-read',
    source: 'revoke_override',
    reasonCode: 'compliance_review',
    reasonNotes: 'Cluster head decision — UOM editing permission held at brand-level only post-FY26 audit finding.',
    expiresAt: null,
    grantedBy: 'Priya Iyer (Brand Owner)',
    auditRef: 'OVR-2026-00098',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Inline RoleBadge (mirrors USR-001 / USR-002 — B6 extraction candidate)
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

function RoleBadge({ role }: { readonly role: UserRole }) {
  return (
    <span
      className="inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface"
      aria-label={`Role: ${ROLE_LABEL[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Source badge (CC-PERMISSION-OVERRIDE-MGMT — build-in-place per B3 spec)
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<OverrideSource, string> = {
  role_baseline: 'Role baseline',
  grant_override: 'Grant override',
  revoke_override: 'Revoke override',
}

function OverrideSourceBadge({ source }: { readonly source: OverrideSource }) {
  if (source === 'role_baseline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
        <Shield className="h-3 w-3" aria-hidden />
        {SOURCE_LABEL.role_baseline}
      </span>
    )
  }
  if (source === 'grant_override') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        {SOURCE_LABEL.grant_override}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-on-error-container">
      <ShieldX className="h-3 w-3" aria-hidden />
      {SOURCE_LABEL.revoke_override}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reason-code label registry (mirror of USR-006 canonical list)
// ─────────────────────────────────────────────────────────────────────────────

export const REASON_CODE_LABEL: Record<string, string> = {
  compliance_review: 'Compliance / audit review',
  temporary_coverage: 'Temporary coverage for absent colleague',
  role_transition: 'Role transition / handover',
  incident_response: 'Incident response (post-mortem)',
  security_concern: 'Security concern / access reduction',
  vendor_audit: 'Vendor / 3rd-party audit',
  other: 'Other (specify in notes)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip (multi-select source filter — same pattern as USR-001)
// ─────────────────────────────────────────────────────────────────────────────

interface SourceFilterChipProps {
  readonly selected: ReadonlySet<OverrideSource>
  readonly onToggle: (s: OverrideSource) => void
  readonly onClear: () => void
}

function SourceFilterChip({ selected, onToggle, onClear }: SourceFilterChipProps) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  const options: ReadonlyArray<{ value: OverrideSource; label: string }> = [
    { value: 'role_baseline', label: SOURCE_LABEL.role_baseline },
    { value: 'grant_override', label: SOURCE_LABEL.grant_override },
    { value: 'revoke_override', label: SOURCE_LABEL.revoke_override },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by source${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">Source</span>
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
            Filter by source
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

const SOURCE_SORT_RANK: Record<OverrideSource, number> = {
  grant_override: 0,
  revoke_override: 1,
  role_baseline: 2,
}

export default function SiUsr005() {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<ReadonlySet<OverrideSource>>(new Set())

  const permissionById = useMemo(() => {
    const m = new Map<string, SamplePermission>()
    for (const p of SAMPLE_PERMISSIONS) m.set(p.id, p)
    return m
  }, [])

  const sorted = useMemo(() => {
    const rows = SAMPLE_EFFECTIVE.filter((r) => {
      if (sourceFilter.size > 0 && !sourceFilter.has(r.source)) return false
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const p = permissionById.get(r.permissionId)
        const hay = `${p?.key ?? ''} ${p?.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    rows.sort((a, b) => {
      const sa = SOURCE_SORT_RANK[a.source]
      const sb = SOURCE_SORT_RANK[b.source]
      if (sa !== sb) return sa - sb
      const pa = permissionById.get(a.permissionId)?.key ?? ''
      const pb = permissionById.get(b.permissionId)?.key ?? ''
      return pa.localeCompare(pb)
    })
    return rows
  }, [search, sourceFilter, permissionById])

  const counts = useMemo(() => {
    let baseline = 0
    let grants = 0
    let revokes = 0
    for (const r of SAMPLE_EFFECTIVE) {
      if (r.source === 'role_baseline') baseline += 1
      else if (r.source === 'grant_override') grants += 1
      else revokes += 1
    }
    return {
      total: SAMPLE_EFFECTIVE.length,
      baseline,
      overrides: grants + revokes,
      grants,
      revokes,
    }
  }, [])

  const toggleSource = (s: OverrideSource) => {
    const next = new Set(sourceFilter)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    setSourceFilter(next)
  }

  const anyFilterActive = sourceFilter.size > 0 || search.trim().length > 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · Effective permissions
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {SAMPLE_TARGET_USER.fullName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-on-surface-variant">
                {SAMPLE_TARGET_USER.email}
              </span>
              <RoleBadge role={SAMPLE_TARGET_USER.role} />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Resolved effective permission set — role baseline plus any grant
              or revoke overrides. Read-only on this screen; mutate via the
              grant / revoke flow (FR15b).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="tonal" size="sm">
              <Link
                to={`/SI-USR-006?user=${encodeURIComponent(SAMPLE_TARGET_USER.id)}&mode=grant`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Grant new permission
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link
                to={`/SI-USR-006?user=${encodeURIComponent(SAMPLE_TARGET_USER.id)}&mode=revoke`}
              >
                <Minus className="h-4 w-4" aria-hidden />
                Revoke a permission
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/SI-USR-001">Back to users</Link>
            </Button>
          </div>
        </header>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-2 tablet:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Effective total
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {counts.total}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Role baseline
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {counts.baseline}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Overrides
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
              {counts.overrides}
            </p>
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {counts.grants} grant · {counts.revokes} revoke
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Audit trail
            </p>
            <div className="mt-1">
              <AuditLink entityRef={SAMPLE_TARGET_USER.id} compact />
            </div>
          </Card>
        </div>

        {/* Filter row */}
        <div className="mt-4 rounded-md bg-surface-container-low p-3">
          <div className="flex flex-wrap items-center gap-2">
            <SourceFilterChip
              selected={sourceFilter}
              onToggle={toggleSource}
              onClear={() => setSourceFilter(new Set())}
            />
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 ml-auto gap-1"
                onClick={() => {
                  setSourceFilter(new Set())
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
              aria-label="Search permissions by key or description"
              placeholder="Search by permission key or description"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Result table */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Effective permissions
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {sorted.length} of {SAMPLE_EFFECTIVE.length}
            </span>
          </div>
          {sorted.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Shield
                className="mx-auto h-8 w-8 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-on-surface">
                No permissions match the current filter.
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Adjust the source chip above or clear the search.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  <TableHead className="hidden tablet:table-cell">
                    Description
                  </TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden desktop:table-cell">
                    Reason
                  </TableHead>
                  <TableHead className="hidden desktop:table-cell">
                    Expires
                  </TableHead>
                  <TableHead className="hidden tablet:table-cell">
                    Audit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const perm = permissionById.get(row.permissionId)
                  if (!perm) return null
                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-on-surface">
                            {perm.key}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {perm.module}
                          </span>
                          <span className="tablet:hidden text-[11px] text-on-surface-variant">
                            {perm.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden tablet:table-cell text-xs text-on-surface-variant">
                        {perm.description}
                      </TableCell>
                      <TableCell>
                        <OverrideSourceBadge source={row.source} />
                      </TableCell>
                      <TableCell className="hidden desktop:table-cell">
                        {row.reasonCode ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-medium text-on-surface">
                              {REASON_CODE_LABEL[row.reasonCode] ?? row.reasonCode}
                            </span>
                            {row.reasonNotes ? (
                              <span className="text-[11px] text-on-surface-variant line-clamp-2">
                                {row.reasonNotes}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden desktop:table-cell text-xs tabular-nums">
                        {row.expiresAt === null ? (
                          <span className="text-on-surface-variant">
                            Permanent
                          </span>
                        ) : (
                          <span className="text-on-surface">
                            {row.expiresAt}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden tablet:table-cell">
                        {row.auditRef ? (
                          <AuditLink entityRef={row.auditRef} compact />
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">
                            —
                          </span>
                        )}
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
          SI-USR-005 · Tier 2 · Phase 4 Epic 2 Arc (b) · {SAMPLE_EFFECTIVE.length} effective
          permissions for {SAMPLE_TARGET_USER.fullName} ({counts.baseline} baseline ·{' '}
          {counts.grants} grant · {counts.revokes} revoke). Source-tone tokens
          inline here; CC-PERMISSION-OVERRIDE-MGMT extracts in Task B5.
        </p>
      </div>
    </div>
  )
}
