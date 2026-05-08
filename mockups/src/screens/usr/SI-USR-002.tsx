import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  Mail,
  Save,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'

import {
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

import { clusters, departments, locations } from '@/lib/sample-data'

import {
  type UserRole,
} from './SI-USR-001'

/**
 * SI-USR-002 — User Create / Edit (Tier 1 hero).
 *
 * Tier 1 hero mockup, Phase 4 Epic 2 USR Arc (b), Task B2. The full
 * create-or-edit form for a single user record. Tier 1 acceptance applies:
 * every role's scope shape, the BO-approval warning, and the edit-mode
 * override summary surface must all be visibly rendered in the mockup, not
 * stubbed (per CLAUDE.md "Tier 1 Acceptance Tag for deferred heroes").
 *
 * Section ordering (per task spec):
 *
 *   1. Identity              — full name, email.
 *   2. Role                  — dropdown over the 9 enum values, with the
 *                              role description rendered below the picker
 *                              so reviewers see the per-role narrative.
 *   3. Scope (conditional)   — shape varies by role (none / cluster /
 *                              location+department). Pickers are §2.7-style
 *                              Popover-as-dialog, mirroring SI-MDM-005's
 *                              vendor scope picker (the canonical pattern).
 *   4. Reason code           — mandatory free-text per FR15c (every user
 *                              mutation captures a human reason for audit).
 *   5. Override summary      — edit-only. Surfaces the per-user permission
 *                              overrides that exist for this account, with
 *                              an explicit deep-link to SI-USR-005.
 *
 * Mode toggle (create vs edit):
 *
 *   Production routes /SI-USR-002 (create) and /SI-USR-002/:id (edit) as
 *   distinct entries. The mockup carries a small mode-pair button at the
 *   top so reviewers see both surfaces without state-juggling. Edit mode
 *   loads a sample user; create mode starts empty. Section 5 (override
 *   summary) is hidden in create mode — there cannot be overrides on a
 *   record that does not yet exist.
 *
 * BO-approval warning banner (FR14 — depends on Epic 3 Approval Engine):
 *
 *   When the picked role is `brand_owner`, surface an inline warning card
 *   below the role section. Brand Owner self-creation routes through the
 *   Unified Approval Engine — the user is created in `pending_approval`
 *   status and is unable to sign in until a Superadmin approves the
 *   request. The actual approval routing wiring is deferred to Epic 3
 *   cross-cutting infrastructure; the visual signal must be present from
 *   day one (Tier 1 acceptance).
 *
 * Token notes (DESIGN.md §6.4 / §3):
 *
 *   - BO-approval banner: `bg-tertiary-container text-on-tertiary-container`
 *     (matches the §6.1 `status_pending_approval` family — same caution-
 *     informational tone as the chip itself).
 *   - No `tenant_brand_accent` (DESIGN.md §3 — admin form is not one of the
 *     four allowed accent surfaces).
 *   - Section breaks via `<SectionShift>` (NOT `<Separator>` — pre-commit
 *     hook bans the latter; §5.2 no-line rule).
 *
 * Source FRs:
 *   - FR12 — role-scope binding (each role has a fixed scope shape).
 *   - FR14 — Brand Owner self-creation flow with Superadmin approval.
 *   - FR15c — mandatory reason code on user mutations.
 *
 * Animation — NONE per CLAUDE.md (admin form; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Role metadata (label + description + scope shape)
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

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  superadmin:
    'Multi-tenant platform operator. No brand scope — sees all tenants. Reserved for the F&B ERP team itself.',
  brand_owner:
    'Owns the entire brand. Approves Brand Owner sign-up requests, manages global settings, and grants permission overrides. Self-creation routes through Superadmin approval (FR14).',
  cluster_manager:
    'Manages one cluster end-to-end — locations, staff, vendors, and approvals scoped to that cluster only.',
  procurement_manager:
    'Brand-wide procurement domain — vendors, POs, GR exceptions, payment terms across all clusters.',
  production_manager:
    'Brand-wide production domain — recipes, BOMs, central-kitchen yields, dispatch challans across all clusters.',
  pos_manager:
    'Single POS outlet manager (location + department). Closes shift, manages POS staff for the assigned outlet.',
  pos_staff:
    'Front-of-house / kitchen staff at a single POS outlet (location + department). Operates POS, scans inventory, raises closing.',
  accountant:
    'Brand-wide accounting domain. Read-write on ledgers, exports; read-only on operational data.',
  viewer:
    'Brand-wide read-only. Cannot mutate any record. Useful for auditors, advisors, board members.',
}

/**
 * Role → scope shape mapping. Inline per task spec — do NOT extract to lib
 * yet. Promotion to a shared lib helper is a follow-up if Arc (c) needs the
 * same logic at the API client layer.
 */
type RoleScope = 'none' | 'cluster' | 'location_department'
const roleScopeShape: Record<UserRole, RoleScope> = {
  superadmin: 'none',
  brand_owner: 'none',
  cluster_manager: 'cluster',
  procurement_manager: 'none',
  production_manager: 'none',
  pos_manager: 'location_department',
  pos_staff: 'location_department',
  accountant: 'none',
  viewer: 'none',
}

const ROLE_OPTIONS: ReadonlyArray<UserRole> = (
  Object.keys(ROLE_LABEL) as UserRole[]
)

// ─────────────────────────────────────────────────────────────────────────────
// Form-state shape
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  readonly fullName: string
  readonly email: string
  readonly role: UserRole
  readonly clusterId: string
  readonly locationId: string
  readonly departmentId: string
  readonly reason: string
}

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  role: 'pos_staff',
  clusterId: '',
  locationId: '',
  departmentId: '',
  reason: '',
}

/** Edit-mode sample user — Sneha Deshmukh (POS Manager at Linking Road). */
const SAMPLE_EDIT_FORM: FormState = {
  fullName: 'Sneha Deshmukh',
  email: 'sneha.deshmukh@wildsugar.in',
  role: 'pos_manager',
  clusterId: 'cl-bandra-west',
  locationId: 'loc-bandra-linking',
  departmentId: 'dept-bl-service',
  reason: '',
}

interface SampleOverride {
  readonly id: string
  readonly permission: string
  readonly grantedBy: string
  readonly grantedOn: string
  readonly reason: string
}

const SAMPLE_OVERRIDES: ReadonlyArray<SampleOverride> = [
  {
    id: 'ov-1',
    permission: 'inventory.adjust_negative',
    grantedBy: 'Priya Iyer (Brand Owner)',
    grantedOn: '2026-04-12',
    reason: 'Festive demand variance — manual adjustment authority for the season.',
  },
  {
    id: 'ov-2',
    permission: 'pos.void_completed_bill',
    grantedBy: 'Rahul Mehta (Cluster Manager)',
    grantedOn: '2026-03-28',
    reason: 'Senior POS Manager seniority — cluster-approved void authority.',
  },
  {
    id: 'ov-3',
    permission: 'pricing.discount_above_15pct',
    grantedBy: 'Priya Iyer (Brand Owner)',
    grantedOn: '2026-02-04',
    reason: 'Diplomatic / VIP host discounting at the Linking Road outlet.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Scope picker — Popover-as-dialog (matches §2.7 SI-MDM-005 vendor pattern)
// ─────────────────────────────────────────────────────────────────────────────

interface ScopePickerProps {
  readonly label: string
  readonly value: string
  readonly options: ReadonlyArray<{ value: string; label: string; sub?: string }>
  readonly placeholder: string
  readonly onChange: (v: string) => void
  readonly disabled?: boolean
  readonly emptyHint?: string
}

function ScopePicker({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
  emptyHint,
}: ScopePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-on-surface">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={[
              'h-11 w-full rounded-sm bg-surface-container-highest px-3 text-sm text-left',
              'flex items-center justify-between gap-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'disabled:opacity-50 disabled:pointer-events-none',
              selected ? 'text-on-surface' : 'text-on-surface-variant',
            ].join(' ')}
            aria-label={`${label} picker`}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown
              className="h-4 w-4 text-on-surface-variant shrink-0"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[20rem] p-1 max-h-80 overflow-auto">
          <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {label}
          </span>
          {options.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-on-surface-variant">
              {emptyHint ?? 'No options available.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {options.map((opt) => {
                const active = opt.value === value
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value)
                        setOpen(false)
                      }}
                      aria-pressed={active}
                      className={[
                        'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px]',
                        'hover:bg-surface-container-high transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active ? 'bg-surface-container' : '',
                      ].join(' ')}
                    >
                      <span className="text-sm text-on-surface">
                        {opt.label}
                      </span>
                      {opt.sub ? (
                        <span className="text-[11px] text-on-surface-variant">
                          {opt.sub}
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface FormSectionProps {
  readonly index: number
  readonly title: string
  readonly subtitle?: string
  readonly children: React.ReactNode
}

function FormSection({ index, title, subtitle, children }: FormSectionProps) {
  return (
    <Card className="p-0">
      <CardHeader className="p-4 tablet:p-6 pb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Section {index}
        </p>
        <CardTitle className="mt-1 text-base text-on-surface">
          {title}
        </CardTitle>
        {subtitle ? (
          <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="p-4 tablet:p-6 pt-2">{children}</CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'create' | 'edit'

const POS_LOCATIONS = locations.filter((l) => l.type === 'pos_outlet')

export default function SiUsr002() {
  const [mode, setMode] = useState<Mode>('create')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isDirty, setIsDirty] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
    setSubmitted(false)
  }

  const handleModeSwitch = (next: Mode) => {
    setMode(next)
    setForm(next === 'edit' ? SAMPLE_EDIT_FORM : EMPTY_FORM)
    setIsDirty(false)
    setSubmitted(false)
  }

  const handleRoleChange = (next: UserRole) => {
    setForm((prev) => {
      const shape = roleScopeShape[next]
      if (shape === 'none') {
        return {
          ...prev,
          role: next,
          clusterId: '',
          locationId: '',
          departmentId: '',
        }
      }
      if (shape === 'cluster') {
        return {
          ...prev,
          role: next,
          clusterId: prev.clusterId || clusters[0]!.id,
          locationId: '',
          departmentId: '',
        }
      }
      // location_department
      const cl = prev.clusterId || clusters[0]!.id
      const locInCluster = POS_LOCATIONS.find((l) => l.cluster_id === cl)
      const locId = locInCluster?.id ?? POS_LOCATIONS[0]!.id
      const deptInLoc = departments.find((d) => d.location_id === locId)
      return {
        ...prev,
        role: next,
        clusterId: cl,
        locationId: locId,
        departmentId: deptInLoc?.id ?? '',
      }
    })
    setIsDirty(true)
    setSubmitted(false)
  }

  const scopeShape = roleScopeShape[form.role]
  const isBrandOwnerPick = form.role === 'brand_owner'

  const reasonOk = form.reason.trim().length >= 10
  const identityOk =
    form.fullName.trim().length > 0 && form.email.trim().length > 0

  // Validate the conditional scope inputs against the picked role's shape.
  const scopeOk = useMemo(() => {
    if (scopeShape === 'none') return true
    if (scopeShape === 'cluster') return form.clusterId.length > 0
    return (
      form.clusterId.length > 0 &&
      form.locationId.length > 0 &&
      form.departmentId.length > 0
    )
  }, [scopeShape, form.clusterId, form.locationId, form.departmentId])

  const canSubmit = identityOk && scopeOk && reasonOk

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    // Mockup-only — Arc (c) wires userService.createUser /
    // userService.updateUser. BO role additionally routes through the
    // approval engine in Epic 3.
    setSubmitted(true)
    setIsDirty(false)
  }

  // Cluster picker options
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }))

  // Location picker options — filtered to the picked cluster
  const locationOptions = POS_LOCATIONS.filter(
    (l) => l.cluster_id === form.clusterId,
  ).map((l) => ({
    value: l.id,
    label: l.name,
    sub: `${l.type.replace('_', ' ')} · ${l.city}`,
  }))

  // Department picker options — filtered to the picked location
  const departmentOptions = departments
    .filter((d) => d.location_id === form.locationId)
    .map((d) => ({ value: d.id, label: d.name }))

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management ·{' '}
              {mode === 'create' ? 'Create user' : 'Edit user'}
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {mode === 'create'
                ? 'New user'
                : (form.fullName || 'Edit user')}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Identity, role, scope, and audit reason. Brand Owner accounts
              additionally require Superadmin approval (FR14). Every
              create / edit captures a mandatory reason for the audit trail
              (FR15c).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {submitted ? (
              <StatusPill
                status={
                  isBrandOwnerPick
                    ? 'status_pending_approval'
                    : 'status_confirmed'
                }
                size="sm"
                label={
                  isBrandOwnerPick
                    ? 'Saved · awaiting approval'
                    : 'Saved'
                }
              />
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link to="/SI-USR-001">Back to users</Link>
            </Button>
          </div>
        </header>

        {/* Mode toggle (mockup-only) */}
        <div
          role="radiogroup"
          aria-label="Mode (mockup-only)"
          className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low p-1"
        >
          {(
            [
              { value: 'create', label: 'Create mode' },
              { value: 'edit', label: 'Edit mode (sample user)' },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleModeSwitch(opt.value)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-pill px-3 h-9 text-xs font-medium',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col" noValidate>
          {/* ── Section 1 — Identity ──────────────────────────────────── */}
          <FormSection
            index={1}
            title="Identity"
            subtitle="Legal name and a working email. The email becomes the sign-in handle."
          >
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="user-name"
                  className="text-xs font-medium text-on-surface"
                >
                  Full name
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <div className="relative">
                  <UserIcon
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="user-name"
                    autoComplete="off"
                    placeholder="e.g. Sneha Deshmukh"
                    value={form.fullName}
                    onChange={(e) => update('fullName', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="user-email"
                  className="text-xs font-medium text-on-surface"
                >
                  Email
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="user-email"
                    type="email"
                    autoComplete="off"
                    placeholder="someone@wildsugar.in"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 2 — Role ─────────────────────────────────────── */}
          <FormSection
            index={2}
            title="Role"
            subtitle="Pick from the 9 canonical roles (FR12). The role determines which scope fields appear next."
          >
            <div className="grid grid-cols-1 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="user-role"
                  className="text-xs font-medium text-on-surface"
                >
                  Role
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  About this role
                </p>
                <p className="mt-1 text-sm text-on-surface">
                  {ROLE_DESCRIPTION[form.role]}
                </p>
              </div>
            </div>

            {/* BO-approval warning banner — FR14. */}
            {isBrandOwnerPick ? (
              <div
                role="note"
                className="mt-4 flex items-start gap-2 rounded-sm bg-tertiary-container text-on-tertiary-container px-3 py-2"
              >
                <AlertTriangle
                  className="h-4 w-4 mt-0.5 shrink-0"
                  aria-hidden
                />
                <p className="text-xs">
                  <span className="font-semibold">
                    Brand Owner accounts require Superadmin approval.
                  </span>{' '}
                  The user will be created in{' '}
                  <span className="font-semibold">pending_approval</span>{' '}
                  state and won't be able to sign in until approved (FR14 —
                  routes through the Unified Approval Engine in Epic 3).
                </p>
              </div>
            ) : null}
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 3 — Scope (conditional) ─────────────────────── */}
          <FormSection
            index={3}
            title="Scope"
            subtitle={
              scopeShape === 'none'
                ? 'No scope picker required for this role — the role is brand-wide or multi-tenant.'
                : scopeShape === 'cluster'
                  ? 'Cluster Managers are bound to exactly one cluster.'
                  : 'POS roles bind to one location and one department within that location.'
            }
          >
            {scopeShape === 'none' ? (
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">
                    {ROLE_LABEL[form.role]}
                  </span>{' '}
                  has{' '}
                  {form.role === 'superadmin'
                    ? 'multi-tenant scope (no brand binding)'
                    : 'brand-wide scope'}
                  . No further scope fields are required.
                </p>
              </div>
            ) : null}

            {scopeShape === 'cluster' ? (
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                <ScopePicker
                  label="Cluster"
                  value={form.clusterId}
                  options={clusterOptions}
                  placeholder="Pick a cluster"
                  onChange={(v) => update('clusterId', v)}
                />
                <div className="rounded-sm bg-surface-container-low p-3 self-end">
                  <p className="text-[11px] text-on-surface-variant">
                    The Cluster Manager will see only users, vendors, and
                    locations belonging to the chosen cluster (FR12).
                  </p>
                </div>
              </div>
            ) : null}

            {scopeShape === 'location_department' ? (
              <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
                <ScopePicker
                  label="Cluster"
                  value={form.clusterId}
                  options={clusterOptions}
                  placeholder="Pick a cluster"
                  onChange={(v) => {
                    setForm((prev) => ({
                      ...prev,
                      clusterId: v,
                      locationId: '',
                      departmentId: '',
                    }))
                    setIsDirty(true)
                  }}
                />
                <ScopePicker
                  label="Location"
                  value={form.locationId}
                  options={locationOptions}
                  placeholder={
                    form.clusterId === ''
                      ? 'Pick a cluster first'
                      : 'Pick a location'
                  }
                  disabled={form.clusterId === ''}
                  emptyHint="No POS outlets in the selected cluster."
                  onChange={(v) => {
                    setForm((prev) => ({
                      ...prev,
                      locationId: v,
                      departmentId: '',
                    }))
                    setIsDirty(true)
                  }}
                />
                <ScopePicker
                  label="Department"
                  value={form.departmentId}
                  options={departmentOptions}
                  placeholder={
                    form.locationId === ''
                      ? 'Pick a location first'
                      : 'Pick a department'
                  }
                  disabled={form.locationId === ''}
                  emptyHint="No departments configured at this location."
                  onChange={(v) => update('departmentId', v)}
                />
              </div>
            ) : null}
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 4 — Reason code ─────────────────────────────── */}
          <FormSection
            index={4}
            title="Reason for change"
            subtitle="Mandatory free-text — captured in the audit trail (FR15c). At least 10 characters."
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="user-reason"
                className="text-xs font-medium text-on-surface"
              >
                Reason
                <span className="text-error ml-0.5" aria-hidden>
                  *
                </span>
              </label>
              <textarea
                id="user-reason"
                aria-required="true"
                rows={3}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                placeholder={
                  mode === 'create'
                    ? 'e.g. Adding new POS Manager for the Linking Road outlet — Q2 expansion plan.'
                    : 'e.g. Promoted from POS Staff after 2-year tenure; cluster head sign-off attached.'
                }
                className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <span className="text-[11px] text-on-surface-variant">
                {form.reason.trim().length} / 10 chars minimum
              </span>
            </div>
          </FormSection>

          {/* ── Section 5 — Override summary (edit-only) ────────────── */}
          {mode === 'edit' ? (
            <>
              <SectionShift tone="lowest" className="my-4" aria-hidden />
              <FormSection
                index={5}
                title="Per-user permission overrides"
                subtitle="Permission grants beyond the role baseline. Manage on SI-USR-005 — every change is reason-gated and audit-logged."
              >
                <div className="flex flex-col gap-3">
                  {SAMPLE_OVERRIDES.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">
                      This user has no permission overrides beyond the{' '}
                      {ROLE_LABEL[form.role]} role baseline.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {SAMPLE_OVERRIDES.map((ov) => (
                        <li
                          key={ov.id}
                          className="rounded-sm bg-surface-container-low p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-mono text-on-surface">
                              <ShieldAlert
                                className="h-3 w-3"
                                aria-hidden
                              />
                              {ov.permission}
                            </span>
                            <span className="text-[11px] text-on-surface-variant tabular-nums">
                              {ov.grantedOn}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-on-surface">
                            {ov.reason}
                          </p>
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            Granted by {ov.grantedBy}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div>
                    <Button asChild variant="tonal" size="sm">
                      <Link
                        to={`/SI-USR-005?user=${encodeURIComponent('usr-sneha-deshmukh')}`}
                      >
                        <ShieldAlert className="h-4 w-4" aria-hidden />
                        Manage overrides on SI-USR-005
                      </Link>
                    </Button>
                  </div>
                </div>
              </FormSection>
            </>
          ) : null}

          {/* Submit row */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => handleModeSwitch(mode)}
              disabled={!isDirty}
            >
              Reset
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={!canSubmit}
              aria-label={
                mode === 'create' ? 'Create user' : 'Save changes'
              }
            >
              {isBrandOwnerPick ? (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {mode === 'create'
                ? isBrandOwnerPick
                  ? 'Submit for Superadmin approval'
                  : 'Create user'
                : 'Save changes'}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-002 · Tier 1 hero · Phase 4 Epic 2 Arc (b). All 9 role
          shapes, BO-approval gating (FR14), and the edit-mode override
          summary are visible in this mockup per Tier 1 acceptance.
        </p>
      </div>
    </div>
  )
}
