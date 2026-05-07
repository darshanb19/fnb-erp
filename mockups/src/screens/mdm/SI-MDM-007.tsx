import { useMemo, useState } from 'react'
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Globe2,
  Info,
  Landmark,
  MapPin,
  Phone,
  Receipt,
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

import { BRAND } from '@/lib/sample-data'

/**
 * SI-MDM-007 — Company Registration & Fiscal Year Setup.
 *
 * Tier 2 mockup, Phase 4 Epic 1 Arc (b), Task B5. One-record setup +
 * occasional-edit screen for the brand's legal entity, tax IDs, banking,
 * and fiscal year configuration. Brand Owner-scoped admin / setup
 * surface; rendered ONCE per F&B ERP deployment because the brand row is
 * seeded at deployment time (DL-024).
 *
 * DL-024 surface (decision-log lines 647–660 — the single Tier-2-specific
 * obligation for this screen):
 *
 *   In MVP this screen is **edit-only**. There is NO "Create new brand"
 *   affordance anywhere on the route. A multi-tenant deployment seeds a
 *   single brand row at bootstrap; new brand creation is post-MVP and
 *   keeps the schema unchanged. Reviewers and future engineers must see
 *   that the absence of "+ New brand" is deliberate, not an oversight —
 *   so DL-024 is surfaced two ways:
 *     1. The page header carries no create button (design negative).
 *     2. A helper-text strip below the form heading (mirrors the DL-022
 *        pattern from SI-MDM-001) reads:
 *          "This is the single brand row for this F&B ERP deployment. New
 *           brands cannot be created here — multi-tenant deployment seeds
 *           one brand row at bootstrap (DL-024 — edit-only)."
 *
 *   The "Mark setup complete" button at the bottom of the form is
 *   **one-way**. While `setup_status === 'Pending'` it is enabled and
 *   gated through a Popover-as-dialog requiring a free-text reason; once
 *   clicked the button is replaced by a status pill stating completion +
 *   the timestamp + an AuditLink to the audit row. The transition cannot
 *   be undone (in production it sets the brand row's `setup_complete_at`
 *   field permanently — `companyService.markSetupComplete` per Arc (a)).
 *
 * Source FRs:
 *   - FR9 — company registration: address, tax IDs, fiscal year, currency.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — header strip + form header (entity = brand id).
 *   - CC-DRAFT-PILL — top of the form when isDirty.
 *
 * Token notes:
 *   - "Setup Complete" status uses `status_confirmed` (canonical 20).
 *   - "Pending" status uses `status_pending_approval`. Canonical 20 has no
 *     bare pending token; `status_pending_approval` is the pending-
 *     flavoured chip closest in semantics for "this entity is awaiting a
 *     human action to graduate to a durable state". The other pending-
 *     flavoured candidate (`status_waiting_info`) reads as "blocked on
 *     external input" which doesn't fit a self-completion toggle.
 *     Pre-commit rule 5 rejects any invented status_* token.
 *
 * Tier 2 acceptance per DL-025: lighter critique than Tier 1 G1 hero
 * screens, but all 12 inventory schema fields (lines 555–602 of
 * _planning/05-screen-inventory.md) MUST surface visibly. The footer
 * "Inventory schema" panel renders each schema field as a <dt>/<dd>
 * pair, mirroring SI-MDM-001 / SI-MDM-002 / SI-MDM-005.
 *
 * Animation — NONE per CLAUDE.md (admin / setup screen; entrance motion
 * banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Synthesised company-record fixture
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyRecord {
  readonly legal_name: string
  readonly trading_name: string
  readonly logo_url_pointer: string
  readonly address: {
    readonly street: string
    readonly city: string
    readonly postal_code: string
    readonly state: string
    readonly state_code: string
    readonly country: string
  }
  readonly gstin: string
  readonly pan: string
  readonly statutory_other: string
  readonly contact: {
    readonly person: string
    readonly phone: string
    readonly email: string
  }
  readonly bank: {
    readonly account_number: string
    readonly ifsc: string
    readonly holder_name: string
  }
  readonly fiscal_year: {
    readonly start_month_day: string
    readonly end_month_day: string
  }
  readonly accounting_currency: string
  readonly timezone: string
}

const COMPANY: CompanyRecord = {
  legal_name: BRAND.legal_name,
  trading_name: BRAND.name,
  logo_url_pointer: 'tenant-config:tenant_logo_full_url',
  address: {
    street: '5th Floor, Linking Plaza, Linking Road, Bandra West',
    city: 'Mumbai',
    postal_code: '400050',
    state: BRAND.state,
    state_code: BRAND.state_code,
    country: 'India',
  },
  gstin: BRAND.gstin,
  pan: 'ABCDE1234F',
  statutory_other: '',
  contact: {
    person: 'Priya Iyer',
    phone: '+91 98201 12345',
    email: 'priya.iyer@wildsugar.in',
  },
  bank: {
    account_number: '5012 3456 7890',
    ifsc: 'HDFC0001234',
    holder_name: BRAND.legal_name,
  },
  fiscal_year: {
    start_month_day: 'Apr-01',
    end_month_day: 'Mar-31',
  },
  accounting_currency: 'INR',
  timezone: 'IST (UTC+5:30)',
}

const MONTHS: ReadonlyArray<string> = [
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

/** Render an option list `01..maxDay` for the day select. */
const DAY_OPTIONS: ReadonlyArray<string> = Array.from(
  { length: 31 },
  (_, i) => String(i + 1).padStart(2, '0'),
)

/** GSTIN validator — 15 chars, 2 digit state code + 10 char PAN + 1 + Z + 1. */
function isValidGstin(s: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(s)
}

/** PAN validator — 5 letters + 4 digits + 1 letter. */
function isValidPan(s: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface FieldRowProps {
  readonly id: string
  readonly label: string
  readonly required?: boolean
  readonly hint?: string
  readonly error?: string
  readonly children: React.ReactNode
}

function FieldRow({ id, label, required, hint, error, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-on-surface">
        {label}
        {required ? (
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  )
}

interface SectionProps {
  readonly title: string
  readonly subtitle?: string
  readonly icon: React.ReactNode
  readonly children: React.ReactNode
}

function FormSection({ title, subtitle, icon, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-low text-on-surface-variant shrink-0"
        >
          {icon}
        </span>
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
          {subtitle ? (
            <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </div>
    </section>
  )
}

interface MarkCompleteFormProps {
  readonly onConfirm: (reason: string) => void
  readonly onCancel: () => void
}

/**
 * Popover-as-dialog confirmation for the one-way DL-024 mark-setup-complete
 * action. Free-text reason is required (>=10 chars) so the audit row carries
 * a human-readable rationale.
 */
function MarkCompleteForm({ onConfirm, onCancel }: MarkCompleteFormProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const valid = trimmed.length >= 10
  return (
    <div className="flex flex-col gap-3 p-4 w-[22rem] max-w-[22rem]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Mark setup complete
        </p>
        <DraftPill isDraft={trimmed.length > 0} />
      </div>
      <p className="text-xs text-on-surface-variant leading-snug">
        This is a one-way transition. Once marked complete, the brand row's
        <span className="font-mono text-on-surface"> setup_complete_at </span>
        field is set permanently and cannot be undone. Reporting dashboards
        will flip to the "Setup Complete" view (DL-024).
      </p>
      <FieldRow
        id="mark-complete-reason"
        label="Reason for marking complete"
        required
        hint="Min. 10 characters. Logged with the audit row."
      >
        <Input
          id="mark-complete-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Onboarding finished — ready to record FY26 transactions."
          aria-invalid={trimmed.length > 0 && !valid}
        />
      </FieldRow>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(trimmed)}
          disabled={!valid}
          aria-label="Confirm mark setup complete"
        >
          <CircleCheck className="h-4 w-4" aria-hidden />
          Mark complete
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type SetupStatus = 'Pending' | 'Setup Complete'

interface FormState {
  readonly legal_name: string
  readonly trading_name: string
  readonly logo_url_pointer: string
  readonly street: string
  readonly city: string
  readonly postal_code: string
  readonly state: string
  readonly country: string
  readonly gstin: string
  readonly pan: string
  readonly statutory_other: string
  readonly contact_person: string
  readonly phone: string
  readonly email: string
  readonly bank_account_number: string
  readonly ifsc: string
  readonly bank_holder_name: string
  readonly fy_start_month: string
  readonly fy_start_day: string
  readonly fy_end_month: string
  readonly fy_end_day: string
}

const INITIAL_FORM: FormState = {
  legal_name: COMPANY.legal_name,
  trading_name: COMPANY.trading_name,
  logo_url_pointer: COMPANY.logo_url_pointer,
  street: COMPANY.address.street,
  city: COMPANY.address.city,
  postal_code: COMPANY.address.postal_code,
  state: COMPANY.address.state,
  country: COMPANY.address.country,
  gstin: COMPANY.gstin,
  pan: COMPANY.pan,
  statutory_other: COMPANY.statutory_other,
  contact_person: COMPANY.contact.person,
  phone: COMPANY.contact.phone,
  email: COMPANY.contact.email,
  bank_account_number: COMPANY.bank.account_number,
  ifsc: COMPANY.bank.ifsc,
  bank_holder_name: COMPANY.bank.holder_name,
  fy_start_month: COMPANY.fiscal_year.start_month_day.split('-')[0] ?? 'Apr',
  fy_start_day: COMPANY.fiscal_year.start_month_day.split('-')[1] ?? '01',
  fy_end_month: COMPANY.fiscal_year.end_month_day.split('-')[0] ?? 'Mar',
  fy_end_day: COMPANY.fiscal_year.end_month_day.split('-')[1] ?? '31',
}

export default function SiMdm007() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('Pending')
  const [setupCompletedAt, setSetupCompletedAt] = useState<string | null>(null)
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false)
  const [showInvalidExample, setShowInvalidExample] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)

  const isDirty = useMemo(() => {
    const keys = Object.keys(form) as ReadonlyArray<keyof FormState>
    return keys.some((k) => form[k] !== INITIAL_FORM[k])
  }, [form])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Effective GSTIN / PAN values used for validation. When the demo toggle
  // is on we render an obviously-invalid sample so reviewers can see the
  // error chrome without breaking the saved fixture state.
  const effectiveGstin = showInvalidExample ? '27ABCDEINVALID' : form.gstin
  const effectivePan = showInvalidExample ? 'invalid_pan' : form.pan
  const gstinError =
    !isValidGstin(effectiveGstin) && effectiveGstin.length > 0
      ? 'Expected 15-char alphanumeric (e.g., 27ABCDE1234F1Z5).'
      : undefined
  const panError =
    !isValidPan(effectivePan) && effectivePan.length > 0
      ? 'Expected 10-char (5 letters + 4 digits + 1 letter).'
      : undefined

  const handleMarkComplete = (_reason: string) => {
    // Mockup-only state change — production wires companyService.markSetupComplete.
    setSetupStatus('Setup Complete')
    setSetupCompletedAt(new Date().toISOString().slice(0, 10))
    setMarkCompleteOpen(false)
  }

  const handleSave = () => {
    // Mockup-only — Arc (c) wires the real PATCH /api/v1/company.
    setForm((prev) => ({ ...prev }))
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1100px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header — NO "+ New brand" button anywhere (DL-024 negative space). */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Company
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Company Registration &amp; Fiscal Year
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Single brand row · edit-only (DL-024). Maintain {BRAND.name}'s
              legal entity details, tax IDs, banking, and fiscal year
              configuration. Changes are audit-logged with before/after
              snapshots.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef={BRAND.id} compact />
            {setupStatus === 'Setup Complete' ? (
              <StatusPill
                status="status_confirmed"
                size="sm"
                label="Setup Complete"
              />
            ) : (
              <StatusPill
                status="status_pending_approval"
                size="sm"
                label="Pending"
              />
            )}
          </div>
        </header>

        {/* DL-024 helper-text strip — mirrors DL-022 pattern from SI-MDM-001. */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
          <Info
            className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0"
            aria-hidden
          />
          <p className="text-xs text-on-surface-variant">
            This is the single brand row for this F&amp;B ERP deployment. New
            brands cannot be created here — multi-tenant deployment seeds one
            brand row at bootstrap (DL-024 — edit-only).
          </p>
        </div>

        {/* Form card */}
        <Card className="mt-6 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg tablet:text-xl text-on-surface">
                  {COMPANY.trading_name}
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {COMPANY.legal_name} · GSTIN {COMPANY.gstin}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DraftPill isDraft={isDirty} />
                <AuditLink entityRef={BRAND.id} compact />
              </div>
            </div>
          </CardHeader>

          <SectionShift tone="low" aria-hidden />

          <CardContent className="p-4 tablet:p-6 flex flex-col gap-8">
            {/* 1 · Legal Identity */}
            <FormSection
              title="Legal Identity"
              subtitle="Registered legal name, trading name as shown on B2B PDFs and dashboards."
              icon={<Building2 className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="legal_name" label="Legal name" required>
                <Input
                  id="legal_name"
                  value={form.legal_name}
                  onChange={(e) => update('legal_name', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="trading_name"
                label="Trading name"
                hint="Defaults to legal name; override for retail-facing brand."
              >
                <Input
                  id="trading_name"
                  value={form.trading_name}
                  onChange={(e) => update('trading_name', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="logo_url_pointer"
                label="Logo URL pointer"
                hint="Points to tenant-config asset (DESIGN.md §3.2 tenant_logo_full_url / tenant_logo_nibble_url)."
              >
                <Input
                  id="logo_url_pointer"
                  value={form.logo_url_pointer}
                  onChange={(e) => update('logo_url_pointer', e.target.value)}
                  placeholder="tenant-config:tenant_logo_full_url"
                />
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 2 · Address */}
            <FormSection
              title="Registered Address"
              subtitle="Statutory address — used on B2B invoices and accountant exports."
              icon={<MapPin className="h-4 w-4" aria-hidden />}
            >
              <div className="tablet:col-span-2">
                <FieldRow id="street" label="Street" required>
                  <Input
                    id="street"
                    value={form.street}
                    onChange={(e) => update('street', e.target.value)}
                  />
                </FieldRow>
              </div>
              <FieldRow id="city" label="City" required>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="postal_code" label="Postal code" required>
                <Input
                  id="postal_code"
                  value={form.postal_code}
                  onChange={(e) => update('postal_code', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="state"
                label="State"
                required
                hint={`State code: ${COMPANY.address.state_code}`}
              >
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="country" label="Country" required>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                />
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 3 · Tax IDs */}
            <FormSection
              title="Tax IDs"
              subtitle="GSTIN + PAN validated per India tax ID rules. Other statutory ID is optional."
              icon={<Receipt className="h-4 w-4" aria-hidden />}
            >
              <FieldRow
                id="gstin"
                label="GSTIN"
                required
                hint="15-char alphanumeric (validated server-side)."
                error={gstinError}
              >
                <Input
                  id="gstin"
                  value={effectiveGstin}
                  onChange={(e) =>
                    update('gstin', e.target.value.toUpperCase())
                  }
                  disabled={showInvalidExample}
                  aria-invalid={Boolean(gstinError)}
                />
              </FieldRow>
              <FieldRow
                id="pan"
                label="PAN"
                required
                hint="10-char (5 letters + 4 digits + 1 letter)."
                error={panError}
              >
                <Input
                  id="pan"
                  value={effectivePan}
                  onChange={(e) =>
                    update('pan', e.target.value.toUpperCase())
                  }
                  disabled={showInvalidExample}
                  aria-invalid={Boolean(panError)}
                />
              </FieldRow>
              <div className="tablet:col-span-2">
                <FieldRow
                  id="statutory_other"
                  label="Other statutory ID"
                  hint="Optional — TAN, FSSAI, Shops & Establishment, etc."
                >
                  <Input
                    id="statutory_other"
                    value={form.statutory_other}
                    onChange={(e) =>
                      update('statutory_other', e.target.value)
                    }
                    placeholder="e.g. FSSAI 11521004001234"
                  />
                </FieldRow>
              </div>
              <div className="tablet:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={showInvalidExample}
                    onChange={(e) => setShowInvalidExample(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Show invalid example (demonstrates aria-invalid chrome)
                </label>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 4 · Contact */}
            <FormSection
              title="Contact"
              subtitle="Primary contact for tax notices and B2B follow-ups."
              icon={<Phone className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="contact_person" label="Contact person" required>
                <Input
                  id="contact_person"
                  value={form.contact_person}
                  onChange={(e) => update('contact_person', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="phone" label="Phone" required>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </FieldRow>
              <div className="tablet:col-span-2">
                <FieldRow id="email" label="Email" required>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                  />
                </FieldRow>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 5 · Banking */}
            <FormSection
              title="Banking"
              subtitle="Used for B2B invoice imports + cash-flow reporting."
              icon={<Landmark className="h-4 w-4" aria-hidden />}
            >
              <FieldRow
                id="bank_account_number"
                label="Account number"
                required
              >
                <Input
                  id="bank_account_number"
                  value={form.bank_account_number}
                  onChange={(e) =>
                    update('bank_account_number', e.target.value)
                  }
                />
              </FieldRow>
              <FieldRow id="ifsc" label="IFSC" required hint="11-char IFSC.">
                <Input
                  id="ifsc"
                  value={form.ifsc}
                  onChange={(e) =>
                    update('ifsc', e.target.value.toUpperCase())
                  }
                />
              </FieldRow>
              <div className="tablet:col-span-2">
                <FieldRow
                  id="bank_holder_name"
                  label="Account holder name"
                  required
                  hint="Must match the registered legal entity."
                >
                  <Input
                    id="bank_holder_name"
                    value={form.bank_holder_name}
                    onChange={(e) =>
                      update('bank_holder_name', e.target.value)
                    }
                  />
                </FieldRow>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 6 · Fiscal Year */}
            <FormSection
              title="Fiscal Year"
              subtitle="Stored as (start_month, start_day) on the brand row. Defaults to the Indian financial year (Apr 01 – Mar 31)."
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="fy_start_month" label="FY start" required>
                <div className="flex gap-2">
                  <select
                    id="fy_start_month"
                    value={form.fy_start_month}
                    onChange={(e) =>
                      update('fy_start_month', e.target.value)
                    }
                    className="flex-1 h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="FY start day"
                    value={form.fy_start_day}
                    onChange={(e) => update('fy_start_day', e.target.value)}
                    className="w-24 h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </FieldRow>
              <FieldRow id="fy_end_month" label="FY end" required>
                <div className="flex gap-2">
                  <select
                    id="fy_end_month"
                    value={form.fy_end_month}
                    onChange={(e) =>
                      update('fy_end_month', e.target.value)
                    }
                    className="flex-1 h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="FY end day"
                    value={form.fy_end_day}
                    onChange={(e) => update('fy_end_day', e.target.value)}
                    className="w-24 h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </FieldRow>
              <div className="tablet:col-span-2 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
                <Info
                  className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0"
                  aria-hidden
                />
                <p className="text-[11px] text-on-surface-variant">
                  Changing fiscal year start/end triggers period
                  recalculation in Finance (Epic 10 logic — not visible here).
                </p>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 7 · Display & Locale */}
            <FormSection
              title="Display &amp; Locale"
              subtitle="Multi-currency is deferred to Phase 3c. Timezone is fixed to IST in MVP."
              icon={<Globe2 className="h-4 w-4" aria-hidden />}
            >
              <FieldRow
                id="accounting_currency"
                label="Accounting currency"
                hint="INR-only in MVP. Multi-currency deferred (Phase 3c)."
              >
                <select
                  id="accounting_currency"
                  value={COMPANY.accounting_currency}
                  disabled
                  aria-readonly
                  className="h-10 rounded-sm bg-surface-container-low px-3 text-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="INR">INR — Indian Rupee</option>
                </select>
              </FieldRow>
              <FieldRow
                id="timezone"
                label="Timezone"
                hint="IST default; per-location override is Phase 5 scope."
              >
                <Input
                  id="timezone"
                  value={COMPANY.timezone}
                  disabled
                  aria-readonly
                />
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* 8 · Status + one-way mark-complete */}
            <section className="flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-low text-on-surface-variant shrink-0"
                >
                  <CircleCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-on-surface">
                    Setup status
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    DL-024 one-way transition. Once marked complete, the
                    brand row's setup_complete_at field is permanent.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-3 py-3 rounded-sm bg-surface-container-low">
                {setupStatus === 'Setup Complete' ? (
                  <>
                    <StatusPill
                      status="status_confirmed"
                      size="sm"
                      label="Setup Complete"
                    />
                    <span className="text-xs text-on-surface-variant">
                      Setup completed on{' '}
                      <span className="font-mono text-on-surface">
                        {setupCompletedAt}
                      </span>
                      .
                    </span>
                    <AuditLink
                      entityRef={`${BRAND.id}:setup_complete`}
                      compact
                    />
                  </>
                ) : (
                  <>
                    <StatusPill
                      status="status_pending_approval"
                      size="sm"
                      label="Pending"
                    />
                    <span className="text-xs text-on-surface-variant">
                      Once all sections above are filled and verified,
                      mark setup complete to unlock reporting dashboards.
                    </span>
                    <span className="ml-auto">
                      <Popover
                        open={markCompleteOpen}
                        onOpenChange={setMarkCompleteOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            aria-label="Mark setup complete (one-way)"
                          >
                            <CircleCheck className="h-4 w-4" aria-hidden />
                            Mark setup complete
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="p-0">
                          <MarkCompleteForm
                            onConfirm={handleMarkComplete}
                            onCancel={() => setMarkCompleteOpen(false)}
                          />
                        </PopoverContent>
                      </Popover>
                    </span>
                  </>
                )}
              </div>
            </section>

            {/* Save row */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm(INITIAL_FORM)}
                disabled={!isDirty}
              >
                Discard changes
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* Inventory schema footer panel — surfaces all 12 schema fields. */}
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
                The 12 canonical schema fields surfaced for SI-MDM-007 per
                _planning/05-screen-inventory.md lines 555–602 (Tier 2
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
                      Brand Owner (scope: brand) — one-time setup +
                      occasional edit.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      4 · Purpose
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Register company legal entity details (name, address,
                      tax IDs, contact, bank account) and define fiscal year
                      configuration; one-time setup at brand onboarding.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      5 · Data displayed
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Company legal name, trading name, logo URL pointer to
                      tenant config; registered address (street/city/postal/
                      state/country); tax IDs — GSTIN, PAN, other statutory
                      ID; contact person, phone, email; bank account
                      (account number, IFSC, holder name); fiscal year
                      start/end (Month-Day); accounting currency (INR
                      preset); operating timezone (IST preset); status
                      (Setup Complete / Pending).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      6 · User actions
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      View current details (read-only for most roles; Brand
                      Owner only edits); edit company details; set fiscal
                      year start/end → triggers period-boundary creation in
                      Finance (Epic 10); upload or update company logo
                      (pointer); mark company registration complete
                      (one-time, one-way action).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      7 · Cross-cutting
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      CC-AUDIT-LINK (header strip + form header);
                      CC-DRAFT-PILL (top of the form when isDirty — changes
                      staged before confirm).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      8 · Tokens (DESIGN.md)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface,
                      on_surface_variant, status_confirmed, outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      9 · Source FRs
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR9 (company registration: address, tax IDs, fiscal
                      year, currency).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      10 · Source journey(s)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner — "Company registration details" (FR9);
                      one-time at brand onboarding or occasional edits when
                      legal details change (rebranding, tax ID update,
                      address relocation, fiscal year change).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      11 · Related screens
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Standalone; no direct related screens in Epic 1; links
                      to SI-ACC-### (TBD) in Epic 10 for period-boundary
                      management.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      12 · Notes
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      One-time setup screen; accessed later only for edits.
                      Fiscal year start/end change triggers period
                      recalculation in Finance (Epic 10 logic). Tax ID
                      formatting validated per India rules (GSTIN 15-char
                      alphanumeric, PAN 10-char). Logo URL points to static
                      asset in tenant config (DESIGN.md §3.2). Timezone
                      default IST. Currency INR (multi-currency deferred
                      Phase 3c). All edits audit-logged with before/after
                      snapshots (FR20). Edit-only per DL-024 — no "Create
                      new brand" affordance anywhere in MVP.
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </>
          ) : null}
        </Card>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Building2 className="h-3 w-3" aria-hidden />
          <span>
            Tier 2 admin / setup surface · DL-024 surfaced (edit-only; no "+
            New brand").
          </span>
          <span className="ml-auto">
            SI-MDM-007 · Tier 2 · Phase 4 Epic 1 Arc (b)
          </span>
        </footer>
      </div>
    </div>
  )
}
