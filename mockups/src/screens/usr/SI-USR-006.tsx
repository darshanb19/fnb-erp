import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ChevronDown,
  Minus,
  Pencil,
  Plus,
  Save,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DraftPill,
  Input,
  SectionShift,
  StatusPill,
} from '@/shell'

import { type UserRole } from './SI-USR-001'
import {
  REASON_CODE_LABEL,
  SAMPLE_EFFECTIVE,
  SAMPLE_PERMISSIONS,
  SAMPLE_TARGET_USER,
  type OverrideSource,
  type SamplePermission,
} from './SI-USR-005'

/**
 * SI-USR-006 — Grant / Revoke / Edit a permission override (Tier 1 hero).
 *
 * Tier 1 hero mockup, Phase 4 Epic 2 USR Arc (b), Task B3. The single mutate
 * surface for all three permission-override operations against one target
 * user. Tier 1 acceptance applies — every mode (grant, revoke, edit), every
 * form section, every reason code, the expiry date picker, and the live
 * preview must all be visibly rendered in the mockup.
 *
 * Mode toggle (header):
 *
 *   - `grant`  — pick from permissions NOT currently in the user's effective
 *                set. Submit creates a new `grant_override`.
 *   - `revoke` — pick from permissions IN the user's effective set. Submit
 *                creates a `revoke_override`.
 *   - `edit`   — load an existing override (selected via the mode-segmented
 *                drop-pill below the header in the mockup harness so
 *                reviewers can see the read-only permission surface). Submit
 *                updates reason / expiry only — the permission key itself
 *                is immutable in edit mode.
 *
 * CC-PERMISSION-OVERRIDE-MGMT — build-in-place per task B3 brief:
 *
 *   The OverrideSourceBadge + reason-code dropdown pattern duplicates the
 *   USR-005 inline copies. B5 extracts these into a shared shell. Keeping
 *   the duplicate intentional here so B5 has clear source material.
 *
 * Section ordering (per task spec):
 *
 *   1. Target user           — read-only display + role badge.
 *   2. Permission selector   — mode-aware list (filterable search input).
 *   3. Reason                — dropdown (7 canonical codes) + notes textarea.
 *   4. Expiry                — date input, optional ("blank = permanent").
 *   5. Preview               — live sentence "User will gain/lose ..." plus
 *                              tonal effect surface so reviewers see the
 *                              shape of the resolved override.
 *
 * Token notes:
 *   - Submit success uses `status_confirmed` (canonical 20 status palette);
 *     additive / approved tones not in the canonical 20 are NOT invented —
 *     `status_confirmed` covers the success row across the project.
 *   - Effect surface in section 5 uses `bg-secondary-container` for grants
 *     and `bg-error-container` for revokes — same family as the USR-005
 *     OverrideSourceBadge tone mapping.
 *
 * Source FRs:
 *   - FR15a — mandatory reason code on every permission override mutation.
 *   - FR15b — effective set updates immediately after the mutation.
 *   - FR15c — audit trail row written per mutation.
 *
 * Animation — NONE (admin form; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mode + reason codes
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'grant' | 'revoke' | 'edit'

interface ReasonCode {
  readonly value: string
  readonly label: string
}

const REASON_CODES: ReadonlyArray<ReasonCode> = (
  Object.keys(REASON_CODE_LABEL) as Array<keyof typeof REASON_CODE_LABEL>
).map((value) => ({ value, label: REASON_CODE_LABEL[value] }))

const MODE_TO_SOURCE: Record<Mode, OverrideSource> = {
  grant: 'grant_override',
  revoke: 'revoke_override',
  edit: 'grant_override', // inferred from the edited override's source at runtime
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline RoleBadge (B6 extraction candidate — same pattern as USR-001/002/005)
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
// Inline OverrideSourceBadge (build-in-place per B3 — duplicates USR-005)
// ─────────────────────────────────────────────────────────────────────────────

function OverrideSourceBadge({ source }: { readonly source: OverrideSource }) {
  if (source === 'role_baseline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
        <Shield className="h-3 w-3" aria-hidden />
        Role baseline
      </span>
    )
  }
  if (source === 'grant_override') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Grant override
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-on-error-container">
      <ShieldX className="h-3 w-3" aria-hidden />
      Revoke override
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FormSection wrapper (mirror of USR-002)
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
// Permission picker — searchable list, mode-aware filter
// ─────────────────────────────────────────────────────────────────────────────

interface PermissionPickerProps {
  readonly mode: Mode
  readonly value: string
  readonly onChange: (id: string) => void
  readonly availablePermissions: ReadonlyArray<SamplePermission>
}

function PermissionPicker({
  mode,
  value,
  onChange,
  availablePermissions,
}: PermissionPickerProps) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    if (query.trim().length === 0) return availablePermissions
    const q = query.trim().toLowerCase()
    return availablePermissions.filter((p) => {
      const hay = `${p.key} ${p.description} ${p.module}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, availablePermissions])

  if (mode === 'edit') {
    const selected = availablePermissions.find((p) => p.id === value)
    if (!selected) {
      return (
        <p className="text-xs text-on-surface-variant">
          No override selected for editing.
        </p>
      )
    }
    return (
      <div className="rounded-sm bg-surface-container-low p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Editing permission
        </p>
        <p className="mt-1 font-mono text-sm text-on-surface">{selected.key}</p>
        <p className="text-[11px] text-on-surface-variant">{selected.module}</p>
        <p className="mt-2 text-xs text-on-surface">{selected.description}</p>
        <p className="mt-2 text-[11px] text-on-surface-variant">
          The permission key is immutable in edit mode. To change which key is
          granted or revoked, cancel and create a new override on this screen.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          aria-label="Search permissions"
          placeholder="Search by permission key, module, or description"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="rounded-sm bg-surface-container-low max-h-72 overflow-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-on-surface-variant text-center">
            No permissions match{' '}
            <span className="font-mono">{query.trim()}</span>.
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((p) => {
              const active = p.id === value
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onChange(p.id)}
                    aria-pressed={active}
                    className={[
                      'w-full text-left px-3 py-2.5 rounded-sm flex items-start gap-3 min-h-[44px]',
                      'hover:bg-surface-container-high transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active ? 'bg-surface-container' : '',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden
                      className={[
                        'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-pill',
                        active
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-highest text-on-surface-variant',
                      ].join(' ')}
                    >
                      {active ? (
                        <span className="h-1.5 w-1.5 rounded-pill bg-on-primary" />
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-xs text-on-surface truncate">
                        {p.key}
                      </span>
                      <span className="text-[11px] text-on-surface-variant truncate">
                        {p.module}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {p.description}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-on-surface-variant">
        {mode === 'grant'
          ? `${availablePermissions.length} permission${availablePermissions.length === 1 ? '' : 's'} the user does not currently have access to.`
          : `${availablePermissions.length} permission${availablePermissions.length === 1 ? '' : 's'} currently in the user's effective set.`}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const EFFECTIVE_PERMISSION_IDS = new Set(
  SAMPLE_EFFECTIVE.map((r) => r.permissionId),
)

/** Sample existing override loaded for `edit` mode — first grant override. */
const SAMPLE_EDIT_OVERRIDE = SAMPLE_EFFECTIVE.find(
  (r) => r.source === 'grant_override',
)!

interface FormState {
  readonly permissionId: string
  readonly reasonCode: string
  readonly reasonNotes: string
  /** ISO YYYY-MM-DD. Empty string = permanent. */
  readonly expiresAt: string
}

const EMPTY_FORM: FormState = {
  permissionId: '',
  reasonCode: '',
  reasonNotes: '',
  expiresAt: '',
}

const EDIT_FORM: FormState = {
  permissionId: SAMPLE_EDIT_OVERRIDE.permissionId,
  reasonCode: SAMPLE_EDIT_OVERRIDE.reasonCode ?? '',
  reasonNotes: SAMPLE_EDIT_OVERRIDE.reasonNotes ?? '',
  expiresAt: SAMPLE_EDIT_OVERRIDE.expiresAt ?? '',
}

export default function SiUsr006() {
  const [mode, setMode] = useState<Mode>('grant')
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
    setForm(next === 'edit' ? EDIT_FORM : EMPTY_FORM)
    setIsDirty(false)
    setSubmitted(false)
  }

  const availablePermissions = useMemo(() => {
    if (mode === 'grant') {
      return SAMPLE_PERMISSIONS.filter(
        (p) => !EFFECTIVE_PERMISSION_IDS.has(p.id),
      )
    }
    if (mode === 'revoke') {
      return SAMPLE_PERMISSIONS.filter((p) =>
        EFFECTIVE_PERMISSION_IDS.has(p.id),
      )
    }
    // edit — single permission scope (the override being edited)
    return SAMPLE_PERMISSIONS.filter(
      (p) => p.id === SAMPLE_EDIT_OVERRIDE.permissionId,
    )
  }, [mode])

  const selectedPermission = useMemo(() => {
    return SAMPLE_PERMISSIONS.find((p) => p.id === form.permissionId) ?? null
  }, [form.permissionId])

  const effectiveSourceForPreview: OverrideSource =
    mode === 'edit' ? SAMPLE_EDIT_OVERRIDE.source : MODE_TO_SOURCE[mode]

  const reasonOk =
    form.reasonCode.length > 0 && form.reasonNotes.trim().length >= 10
  const permissionOk = form.permissionId.length > 0
  // Optional date — when present, must be a future ISO date. The browser
  // input enforces shape; we only check non-past here.
  const expiryOk =
    form.expiresAt.length === 0 || form.expiresAt >= new Date().toISOString().slice(0, 10)
  const canSubmit = permissionOk && reasonOk && expiryOk

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    // Mockup-only — Arc (c) wires permissionService.grant /
    // permissionService.revoke / permissionService.update.
    setSubmitted(true)
    setIsDirty(false)
  }

  const submitLabel =
    mode === 'grant'
      ? 'Grant permission'
      : mode === 'revoke'
        ? 'Revoke permission'
        : 'Save changes'

  const minDateISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management ·{' '}
              {mode === 'grant'
                ? 'Grant permission'
                : mode === 'revoke'
                  ? 'Revoke permission'
                  : 'Edit override'}
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {mode === 'grant'
                ? 'Grant a permission'
                : mode === 'revoke'
                  ? 'Revoke a permission'
                  : 'Edit override'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Reason-gated permission mutation. Every grant, revoke, and edit
              writes to the audit trail (FR15c) and updates the user's
              effective set immediately (FR15b).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {submitted ? (
              <StatusPill
                status="status_confirmed"
                size="sm"
                label="Saved"
              />
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link
                to={`/SI-USR-005?user=${encodeURIComponent(SAMPLE_TARGET_USER.id)}`}
              >
                Back to effective view
              </Link>
            </Button>
          </div>
        </header>

        {/* Mode toggle */}
        <div
          role="radiogroup"
          aria-label="Mutation mode"
          className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low p-1"
        >
          {(
            [
              { value: 'grant', label: 'Grant', icon: Plus },
              { value: 'revoke', label: 'Revoke', icon: Minus },
              { value: 'edit', label: 'Edit existing override', icon: Pencil },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value
            const Icon = opt.icon
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
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {opt.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col" noValidate>
          {/* ── Section 1 — Target user (read-only) ──────────────────── */}
          <FormSection
            index={1}
            title="Target user"
            subtitle="The user whose effective permission set is being mutated. Read-only — driven by the entry-point context."
          >
            <div className="rounded-sm bg-surface-container-low p-3 flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-on-surface">
                  {SAMPLE_TARGET_USER.fullName}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {SAMPLE_TARGET_USER.email}
                </span>
              </div>
              <RoleBadge role={SAMPLE_TARGET_USER.role} />
              {mode === 'edit' ? (
                <span className="ml-auto">
                  <OverrideSourceBadge source={effectiveSourceForPreview} />
                </span>
              ) : null}
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 2 — Permission selector ──────────────────────── */}
          <FormSection
            index={2}
            title="Permission"
            subtitle={
              mode === 'grant'
                ? 'Pick a permission the user does not currently have. Search by key, module, or description.'
                : mode === 'revoke'
                  ? 'Pick a permission currently in the user\'s effective set. Revoking it does NOT delete the role baseline — it adds a revoke override on top.'
                  : 'The permission key being edited. Reason and expiry can change; the key itself cannot.'
            }
          >
            <PermissionPicker
              mode={mode}
              value={form.permissionId}
              onChange={(id) => update('permissionId', id)}
              availablePermissions={availablePermissions}
            />
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 3 — Reason ───────────────────────────────────── */}
          <FormSection
            index={3}
            title="Reason for change"
            subtitle="Mandatory canonical reason code plus free-text notes — captured in the audit trail (FR15a, FR15c). At least 10 chars in the notes."
          >
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ovr-reason-code"
                  className="text-xs font-medium text-on-surface"
                >
                  Reason code
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <div className="relative">
                  <select
                    id="ovr-reason-code"
                    aria-required="true"
                    value={form.reasonCode}
                    onChange={(e) => update('reasonCode', e.target.value)}
                    className="h-11 w-full appearance-none rounded-sm bg-surface-container-highest pl-3 pr-9 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="" disabled>
                      Pick a reason code
                    </option>
                    {REASON_CODES.map((rc) => (
                      <option key={rc.value} value={rc.value}>
                        {rc.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant"
                    aria-hidden
                  />
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  Canonical FR15c reason code. The audit row pivots on this
                  value for compliance reports.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ovr-reason-notes"
                  className="text-xs font-medium text-on-surface"
                >
                  Notes
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <textarea
                  id="ovr-reason-notes"
                  aria-required="true"
                  rows={4}
                  value={form.reasonNotes}
                  onChange={(e) => update('reasonNotes', e.target.value)}
                  placeholder={
                    mode === 'grant'
                      ? 'e.g. Covering procurement tasks for Vihaan during parental leave through end of May.'
                      : mode === 'revoke'
                        ? 'e.g. Reduce cross-cluster data access pending Q3 security review.'
                        : 'e.g. Extending coverage another 14 days — Vihaan return date pushed.'
                  }
                  className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span className="text-[11px] text-on-surface-variant">
                  {form.reasonNotes.trim().length} / 10 chars minimum
                </span>
              </div>
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 4 — Expiry ───────────────────────────────────── */}
          <FormSection
            index={4}
            title="Expiry"
            subtitle="Optional. Pick a future date for time-limited overrides; leave blank for a permanent override."
          >
            <div className="grid grid-cols-1 tablet:grid-cols-[minmax(0,16rem)_1fr] gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ovr-expiry"
                  className="text-xs font-medium text-on-surface"
                >
                  Expires on
                </label>
                <div className="relative">
                  <CalendarClock
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant"
                    aria-hidden
                  />
                  <input
                    id="ovr-expiry"
                    type="date"
                    min={minDateISO}
                    value={form.expiresAt}
                    onChange={(e) => update('expiresAt', e.target.value)}
                    className="h-11 w-full rounded-sm bg-surface-container-highest pl-9 pr-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-describedby="ovr-expiry-hint"
                  />
                </div>
                {form.expiresAt.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => update('expiresAt', '')}
                    className="text-[11px] font-medium text-primary text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  >
                    Clear date (make permanent)
                  </button>
                ) : null}
              </div>
              <p
                id="ovr-expiry-hint"
                className="rounded-sm bg-surface-container-low p-3 text-xs text-on-surface-variant self-stretch flex items-center"
              >
                Leave blank for a permanent override. Time-limited overrides
                surface on{' '}
                <Link
                  to="/SI-USR-007"
                  className="ml-1 font-medium text-primary underline-offset-2 hover:underline"
                >
                  SI-USR-007 (Expiring soon)
                </Link>{' '}
                in the 0–7 day urgent band.
              </p>
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 5 — Preview ──────────────────────────────────── */}
          <FormSection
            index={5}
            title="Preview"
            subtitle="What this override will do once submitted. Updates live as you fill in the form."
          >
            {selectedPermission ? (
              <div
                className={[
                  'rounded-sm p-4 flex flex-col gap-2',
                  mode === 'revoke'
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-secondary-container text-on-secondary-container',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <OverrideSourceBadge source={effectiveSourceForPreview} />
                  <span className="font-mono text-xs">
                    {selectedPermission.key}
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {mode === 'revoke'
                    ? `${SAMPLE_TARGET_USER.fullName} will lose the ability to ${selectedPermission.description}.`
                    : `${SAMPLE_TARGET_USER.fullName} will gain the ability to ${selectedPermission.description}.`}
                </p>
                <p className="text-xs">
                  {form.reasonCode
                    ? `Reason: ${REASON_CODE_LABEL[form.reasonCode] ?? form.reasonCode}.`
                    : 'Pick a reason code to complete the audit row.'}{' '}
                  {form.expiresAt
                    ? `Expires on ${form.expiresAt}.`
                    : 'No expiry — the override is permanent until a future revoke / edit.'}
                </p>
              </div>
            ) : (
              <div className="rounded-sm bg-surface-container-low p-4 text-xs text-on-surface-variant">
                Pick a permission above to see the live effect preview.
              </div>
            )}
          </FormSection>

          {/* Submit row */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="ghost" size="default">
              <Link
                to={`/SI-USR-005?user=${encodeURIComponent(SAMPLE_TARGET_USER.id)}`}
              >
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={!canSubmit}
              aria-label={submitLabel}
            >
              {mode === 'revoke' ? (
                <ShieldX className="h-4 w-4" aria-hidden />
              ) : mode === 'grant' ? (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {submitLabel}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-006 · Tier 1 hero · Phase 4 Epic 2 Arc (b). All three modes
          (grant / revoke / edit), all 7 canonical reason codes, the optional
          expiry picker, and the live preview are visible here per Tier 1
          acceptance.
        </p>
      </div>
    </div>
  )
}
