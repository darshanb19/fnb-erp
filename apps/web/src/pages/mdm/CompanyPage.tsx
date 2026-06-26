/**
 * CompanyPage — SI-MDM-007 Company Registration & Fiscal Year Setup.
 *
 * Production page consuming real apps/api endpoints via TanStack Query hooks.
 * Mirrors the Arc (b) mockup chrome (mockups/src/screens/mdm/SI-MDM-007.tsx)
 * with live data, loading skeletons, error surfaces, and a11y.
 *
 * Source FRs:
 *   FR9 — company registration: address, tax IDs, fiscal year, currency.
 *
 * DL-024 surface (edit-only, one-way status gate):
 *   - NO "Create new brand" affordance anywhere on the page or in nav.
 *   - A DL-022-pattern helper-text strip below the form heading surfaces the
 *     constraint: "This is the single brand row for this F&B ERP deployment."
 *   - "Mark setup complete" CTA is one-way: pending → complete. Once complete,
 *     the CTA is replaced by a status pill. No revert path exists.
 *
 * Auth gating per FR9: Brand Owner only. Non-brand_owner roles see a 403 panel.
 *
 * Token discipline:
 *   No hex literals. status_confirmed = Setup Complete; status_pending_approval
 *   = Setup Pending (canonical 20 tokens). No <Separator> — <SectionShift>.
 *   border-l-4 pip allowlisted per §5.2.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Building2,
  CalendarDays,
  CircleCheck,
  Globe2,
  Info,
  Landmark,
  MapPin,
  Phone,
  Receipt,
  ShieldOff,
} from 'lucide-react';

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
} from '@/components/shell';

import { ApiError } from '@/lib/api-client';
import RequirePermission from '@/lib/RequirePermission';
import { useCompanyRead, useUpdateCompany, useMarkSetupComplete } from '@/hooks/mdm/useCompany';
import type { CompanyRow, UpdateCompanyInput } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** 1-indexed month number → month abbreviation */
const MONTH_INDEX_TO_ABBR: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};
/** Month abbreviation → 1-indexed month number */
const MONTH_ABBR_TO_INDEX: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Day options 01–28 for fiscal year (avoids Feb 29 month-day pair). */
const DAY_OPTIONS: ReadonlyArray<string> = Array.from(
  { length: 28 },
  (_, i) => String(i + 1).padStart(2, '0'),
);

/** GSTIN regex: 15-char format per India GST rules. */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
/** PAN regex: 10-char format per India tax rules. */
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidGstin(s: string): boolean {
  return GSTIN_RE.test(s);
}

function isValidPan(s: string): boolean {
  return PAN_RE.test(s);
}

// ---------------------------------------------------------------------------
// Form state shape (stringified for select controls)
// ---------------------------------------------------------------------------

interface FormState {
  legalName: string;
  tradingName: string;
  registeredAddress: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
  gstin: string;
  pan: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankAccountHolder: string;
  /** Month abbreviation e.g. "Apr" */
  fyStartMonth: string;
  /** Zero-padded day string e.g. "01" */
  fyStartDay: string;
  timezone: string;
  logoUrl: string;
}

function companyToForm(row: CompanyRow): FormState {
  return {
    legalName: row.legalName,
    tradingName: row.tradingName ?? '',
    registeredAddress: row.registeredAddress ?? '',
    city: row.city ?? '',
    postalCode: row.postalCode ?? '',
    state: row.state ?? '',
    country: row.country ?? 'IN',
    gstin: row.gstin ?? '',
    pan: row.pan ?? '',
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    contactEmail: row.contactEmail ?? '',
    bankAccountNumber: row.bankAccountNumber ?? '',
    bankIfsc: row.bankIfsc ?? '',
    bankAccountHolder: row.bankAccountHolder ?? '',
    fyStartMonth: MONTH_INDEX_TO_ABBR[row.fiscalYearStartMonth] ?? 'Apr',
    fyStartDay: String(row.fiscalYearStartDay).padStart(2, '0'),
    timezone: row.timezone,
    logoUrl: row.logoUrl ?? '',
  };
}

function formToInput(form: FormState): UpdateCompanyInput {
  const startMonth = MONTH_ABBR_TO_INDEX[form.fyStartMonth] ?? 4;
  const startDay = parseInt(form.fyStartDay, 10) || 1;
  return {
    legalName: form.legalName || undefined,
    tradingName: form.tradingName || null,
    registeredAddress: form.registeredAddress || null,
    city: form.city || null,
    postalCode: form.postalCode || null,
    state: form.state || null,
    country: form.country || undefined,
    gstin: form.gstin || null,
    pan: form.pan || null,
    contactName: form.contactName || null,
    contactPhone: form.contactPhone || null,
    contactEmail: form.contactEmail || null,
    bankAccountNumber: form.bankAccountNumber || null,
    bankIfsc: form.bankIfsc || null,
    bankAccountHolder: form.bankAccountHolder || null,
    fiscalYearStartMonth: startMonth,
    fiscalYearStartDay: startDay,
    timezone: form.timezone || undefined,
    logoUrl: form.logoUrl || null,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldRowProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly children: React.ReactNode;
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
  );
}

interface SectionProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
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
  );
}

// ---------------------------------------------------------------------------
// MarkCompleteDialog — Popover-as-dialog for the one-way DL-024 transition
// ---------------------------------------------------------------------------

interface MarkCompleteDialogProps {
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
}

function MarkCompleteDialog({ onConfirm, onCancel, isPending }: MarkCompleteDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const valid = trimmed.length >= 10;

  return (
    <div className="flex flex-col gap-3 p-4 w-[22rem] max-w-[22rem]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Mark setup complete
      </p>
      <p className="text-xs text-on-surface-variant leading-snug">
        This is a one-way transition. Once marked complete, the brand row is
        permanently transitioned to setup_complete and cannot be reverted.
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
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(trimmed)}
          disabled={!valid || isPending}
          aria-label="Confirm mark setup complete"
        >
          <CircleCheck className="h-4 w-4" aria-hidden />
          {isPending ? 'Saving…' : 'Mark complete'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveDialog — reason textarea before save
// ---------------------------------------------------------------------------

interface SaveDialogProps {
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
}

function SaveDialog({ onConfirm, onCancel, isPending }: SaveDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const valid = trimmed.length >= 10;

  return (
    <div className="flex flex-col gap-3 p-4 w-[22rem] max-w-[22rem]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Save changes
      </p>
      <p className="text-xs text-on-surface-variant leading-snug">
        Provide a reason for this update. It will be stored in the audit log
        alongside the before/after snapshot.
      </p>
      <FieldRow
        id="save-reason"
        label="Reason for update"
        required
        hint="Min. 10 characters. Required for audit log."
      >
        <Input
          id="save-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Updating registered address after office move."
          aria-invalid={trimmed.length > 0 && !valid}
        />
      </FieldRow>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(trimmed)}
          disabled={!valid || isPending}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading company details"
      className="mx-auto max-w-[1100px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10"
    >
      <div className="h-8 w-64 rounded-sm bg-surface-container-low animate-pulse" />
      <div className="mt-4 h-4 w-96 rounded-sm bg-surface-container-low animate-pulse" />
      <div className="mt-8 rounded-sm bg-surface-container-low h-96 animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForbiddenPanel — 403 for non-brand_owner roles
// ---------------------------------------------------------------------------

function ForbiddenPanel() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <ShieldOff className="h-10 w-10 text-on-surface-variant" aria-hidden />
      <h2 className="text-lg font-semibold text-on-surface">Access restricted</h2>
      <p className="max-w-sm text-center text-sm text-on-surface-variant">
        Company Registration &amp; Fiscal Year setup is restricted to Brand
        Owners. Contact your system administrator if you believe this is an
        error.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CompanyPage component
// ---------------------------------------------------------------------------

export default function CompanyPage() {
  // C8 RBAC audit: replaced ad-hoc role === 'brand_owner' check with
  // <RequirePermission permission="mdm.company.read"> so that finance_manager
  // (who also has mdm.company.read per ROLE_BASELINE) can view this page.
  // Write affordances (save, mark-complete) are separately gated by mdm.company.write.
  return (
    <RequirePermission permission="mdm.company.read" fallback={<ForbiddenPanel />}>
      <CompanyPageInner />
    </RequirePermission>
  );
}

function CompanyPageInner() {
  const { data: company, isLoading, error } = useCompanyRead();
  const updateCompany = useUpdateCompany();
  const markSetupComplete = useMarkSetupComplete();

  // Form state — initialised from the server row once loaded
  const [form, setForm] = useState<FormState | null>(null);
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // When data first arrives (or on refetch), initialise / reset form to server state
  const serverForm = useMemo(
    () => (company ? companyToForm(company) : null),
    [company],
  );

  // Use serverForm as initial state if form is not yet set
  const effectiveForm = form ?? serverForm;

  const isDirty = useMemo(() => {
    if (!effectiveForm || !serverForm) return false;
    const keys = Object.keys(effectiveForm) as Array<keyof FormState>;
    return keys.some((k) => effectiveForm[k] !== serverForm[k]);
  }, [effectiveForm, serverForm]);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...(prev ?? serverForm ?? ({} as FormState)),
      [key]: value,
    }));
  }, [serverForm]);

  const handleDiscard = useCallback(() => {
    setForm(null); // resets to serverForm
    setMutationError(null);
  }, []);

  // Validations
  const gstinError =
    effectiveForm?.gstin && effectiveForm.gstin.length > 0 && !isValidGstin(effectiveForm.gstin)
      ? 'Expected 15-char alphanumeric GSTIN (e.g., 27ABCDE1234F1Z5).'
      : undefined;

  const panError =
    effectiveForm?.pan && effectiveForm.pan.length > 0 && !isValidPan(effectiveForm.pan)
      ? 'Expected 10-char PAN (5 letters + 4 digits + 1 letter).'
      : undefined;

  const handleSave = useCallback(
    (reason: string) => {
      if (!effectiveForm) return;
      setMutationError(null);
      const input = formToInput(effectiveForm);
      updateCompany.mutate(
        { ...input, reason },
        {
          onSuccess: () => {
            setForm(null); // reset dirty state
            setSaveOpen(false);
            setSuccessMessage('Changes saved successfully.');
            setTimeout(() => setSuccessMessage(null), 4000);
          },
          onError: (err) => {
            setSaveOpen(false);
            setMutationError(
              err instanceof ApiError
                ? `${err.code}: ${err.message}`
                : err.message,
            );
          },
        },
      );
    },
    [effectiveForm, updateCompany],
  );

  const handleMarkComplete = useCallback(
    (reason: string) => {
      setMutationError(null);
      markSetupComplete.mutate(
        { reason },
        {
          onSuccess: () => {
            setMarkCompleteOpen(false);
            setSuccessMessage('Setup marked complete.');
            setTimeout(() => setSuccessMessage(null), 4000);
          },
          onError: (err) => {
            setMarkCompleteOpen(false);
            setMutationError(
              err instanceof ApiError
                ? `${err.code}: ${err.message}`
                : err.message,
            );
          },
        },
      );
    },
    [markSetupComplete],
  );

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !company || !effectiveForm) {
    const msg =
      error instanceof ApiError
        ? `${error.code}: ${error.message}`
        : error?.message ?? 'Unexpected error loading company data.';
    return (
      <div
        role="alert"
        className="mx-auto max-w-[1100px] px-4 py-8 tablet:px-6 desktop:px-10"
      >
        <p className="text-sm text-error">{msg}</p>
      </div>
    );
  }

  const isSetupComplete = company.status === 'setup_complete';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1100px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header — NO "+ New brand" button (DL-024 negative space) ── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Company
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Company Registration &amp; Fiscal Year
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Single brand row · edit-only. Maintain the brand&apos;s
              legal entity details, tax IDs, banking, and fiscal year
              configuration. Changes are audit-logged with before/after
              snapshots.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityType="brands" entityRef={company.id} compact />
            {isSetupComplete ? (
              <StatusPill status="status_confirmed" size="sm" label="Setup Complete" />
            ) : (
              <StatusPill status="status_pending_approval" size="sm" label="Pending" />
            )}
          </div>
        </header>

        {/* ── DL-024 helper-text strip — mirrors DL-022 pattern from SI-MDM-001 ── */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
          <Info
            className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0"
            aria-hidden
          />
          <p className="text-xs text-on-surface-variant">
            This is the single brand row for this F&amp;B ERP deployment. New
            brands cannot be created here — multi-tenant deployment seeds one
            brand row at bootstrap.
          </p>
        </div>

        {/* ── Success banner ── */}
        {successMessage ? (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 px-3 py-2 rounded-sm bg-surface-container-low"
          >
            <CircleCheck className="h-4 w-4 text-status-confirmed-pip shrink-0" aria-hidden />
            <p className="text-sm text-on-surface">{successMessage}</p>
          </div>
        ) : null}

        {/* ── Mutation error banner ── */}
        {mutationError ? (
          <div
            role="alert"
            className="mt-4 px-3 py-2 rounded-sm bg-surface-container-low"
          >
            <p className="text-sm text-error">{mutationError}</p>
          </div>
        ) : null}

        {/* ── Form card ── */}
        <Card className="mt-6 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg tablet:text-xl text-on-surface">
                  {effectiveForm.tradingName || effectiveForm.legalName}
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {effectiveForm.legalName}
                  {effectiveForm.gstin ? ` · GSTIN ${effectiveForm.gstin}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DraftPill isDraft={isDirty} />
                <AuditLink entityType="brands" entityRef={company.id} compact />
              </div>
            </div>
          </CardHeader>

          <SectionShift tone="low" aria-hidden />

          <CardContent className="p-4 tablet:p-6 flex flex-col gap-8">

            {/* ── 1 · Legal Identity ── */}
            <FormSection
              title="Legal Identity"
              subtitle="Registered legal name, trading name as shown on B2B PDFs and dashboards."
              icon={<Building2 className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="legal_name" label="Legal name" required>
                <Input
                  id="legal_name"
                  value={effectiveForm.legalName}
                  onChange={(e) => update('legalName', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="trading_name"
                label="Trading name"
                hint="Defaults to legal name; override for retail-facing brand."
              >
                <Input
                  id="trading_name"
                  value={effectiveForm.tradingName}
                  onChange={(e) => update('tradingName', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="country"
                label="Country"
                hint="India (IN) — only country supported in MVP."
              >
                <select
                  id="country"
                  value={effectiveForm.country}
                  disabled
                  aria-readonly
                  className="h-10 rounded-sm bg-surface-container-low px-3 text-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="IN">IN — India</option>
                </select>
              </FieldRow>
              <FieldRow
                id="timezone"
                label="Timezone"
                hint="IST default; per-location override is Phase 5 scope."
              >
                <Input
                  id="timezone"
                  value={effectiveForm.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                />
              </FieldRow>
              <FieldRow
                id="accounting_currency"
                label="Accounting currency"
                hint="INR-only in MVP. Multi-currency deferred."
              >
                <select
                  id="accounting_currency"
                  value="INR"
                  disabled
                  aria-readonly
                  className="h-10 rounded-sm bg-surface-container-low px-3 text-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="INR">INR — Indian Rupee</option>
                </select>
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 2 · Tax ── */}
            <FormSection
              title="Tax IDs"
              subtitle="GSTIN + PAN validated per India tax ID rules."
              icon={<Receipt className="h-4 w-4" aria-hidden />}
            >
              <FieldRow
                id="gstin"
                label="GSTIN"
                required
                hint="15-char alphanumeric (e.g., 27ABCDE1234F1Z5)."
                error={gstinError}
              >
                <Input
                  id="gstin"
                  value={effectiveForm.gstin}
                  onChange={(e) => update('gstin', e.target.value.toUpperCase())}
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
                  value={effectiveForm.pan}
                  onChange={(e) => update('pan', e.target.value.toUpperCase())}
                  aria-invalid={Boolean(panError)}
                />
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 3 · Fiscal Year ── */}
            <FormSection
              title="Fiscal Year"
              subtitle="Stored as (start_month, start_day) on the brand row. Defaults to the Indian FY (Apr 01 – Mar 31)."
              icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="fy_start_month" label="FY start month" required>
                <select
                  id="fy_start_month"
                  value={effectiveForm.fyStartMonth}
                  onChange={(e) => update('fyStartMonth', e.target.value)}
                  className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow
                id="fy_start_day"
                label="FY start day"
                required
                hint="1–28 only (avoids Feb 29 boundary)."
              >
                <select
                  id="fy_start_day"
                  value={effectiveForm.fyStartDay}
                  onChange={(e) => update('fyStartDay', e.target.value)}
                  className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <div className="tablet:col-span-2 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
                <Info
                  className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0"
                  aria-hidden
                />
                <p className="text-[11px] text-on-surface-variant">
                  Changing fiscal year start triggers period recalculation in
                  Finance (Epic 10 logic — not visible here).
                </p>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 4 · Address ── */}
            <FormSection
              title="Registered Address"
              subtitle="Statutory address — used on B2B invoices and accountant exports."
              icon={<MapPin className="h-4 w-4" aria-hidden />}
            >
              <div className="tablet:col-span-2">
                <FieldRow id="registered_address" label="Address line" required>
                  <Input
                    id="registered_address"
                    value={effectiveForm.registeredAddress}
                    onChange={(e) => update('registeredAddress', e.target.value)}
                  />
                </FieldRow>
              </div>
              <FieldRow id="city" label="City" required>
                <Input
                  id="city"
                  value={effectiveForm.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="state" label="State" required>
                <Input
                  id="state"
                  value={effectiveForm.state}
                  onChange={(e) => update('state', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="postal_code" label="Postal code" required>
                <Input
                  id="postal_code"
                  value={effectiveForm.postalCode}
                  onChange={(e) => update('postalCode', e.target.value)}
                />
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 5 · Contact ── */}
            <FormSection
              title="Contact"
              subtitle="Primary contact for tax notices and B2B follow-ups."
              icon={<Phone className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="contact_name" label="Contact person">
                <Input
                  id="contact_name"
                  value={effectiveForm.contactName}
                  onChange={(e) => update('contactName', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="contact_phone" label="Phone">
                <Input
                  id="contact_phone"
                  value={effectiveForm.contactPhone}
                  onChange={(e) => update('contactPhone', e.target.value)}
                />
              </FieldRow>
              <div className="tablet:col-span-2">
                <FieldRow id="contact_email" label="Email">
                  <Input
                    id="contact_email"
                    type="email"
                    value={effectiveForm.contactEmail}
                    onChange={(e) => update('contactEmail', e.target.value)}
                  />
                </FieldRow>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 6 · Banking ── */}
            <FormSection
              title="Banking"
              subtitle="Used for B2B invoice imports + cash-flow reporting."
              icon={<Landmark className="h-4 w-4" aria-hidden />}
            >
              <FieldRow id="bank_account_number" label="Account number">
                <Input
                  id="bank_account_number"
                  value={effectiveForm.bankAccountNumber}
                  onChange={(e) => update('bankAccountNumber', e.target.value)}
                />
              </FieldRow>
              <FieldRow id="bank_ifsc" label="IFSC" hint="11-char IFSC.">
                <Input
                  id="bank_ifsc"
                  value={effectiveForm.bankIfsc}
                  onChange={(e) => update('bankIfsc', e.target.value.toUpperCase())}
                />
              </FieldRow>
              <div className="tablet:col-span-2">
                <FieldRow
                  id="bank_account_holder"
                  label="Account holder name"
                  hint="Must match the registered legal entity."
                >
                  <Input
                    id="bank_account_holder"
                    value={effectiveForm.bankAccountHolder}
                    onChange={(e) => update('bankAccountHolder', e.target.value)}
                  />
                </FieldRow>
              </div>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 7 · Display & Locale (read-only INR / globe) ── */}
            <FormSection
              title="Display &amp; Locale"
              subtitle="Multi-currency is deferred to post-MVP. Timezone editable above."
              icon={<Globe2 className="h-4 w-4" aria-hidden />}
            >
              <FieldRow
                id="display_currency"
                label="Accounting currency"
                hint="INR-only in MVP."
              >
                <select
                  id="display_currency"
                  value="INR"
                  disabled
                  aria-readonly
                  className="h-10 rounded-sm bg-surface-container-low px-3 text-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="INR">INR — Indian Rupee</option>
                </select>
              </FieldRow>
            </FormSection>

            <SectionShift tone="lowest" aria-hidden />

            {/* ── 8 · Status + one-way mark-complete (DL-024) ── */}
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
                    One-way transition. Once marked complete, the brand
                    row&apos;s status is permanently setup_complete.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-3 py-3 rounded-sm bg-surface-container-low">
                {isSetupComplete ? (
                  <>
                    <StatusPill
                      status="status_confirmed"
                      size="sm"
                      label="Setup Complete"
                    />
                    <span className="text-xs text-on-surface-variant">
                      Setup completed on{' '}
                      <span className="font-mono text-on-surface">
                        {company.updatedAt.slice(0, 10)}
                      </span>
                      .
                    </span>
                    <AuditLink
                      entityType="brands"
                      entityRef={`${company.id}:setup_complete`}
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
                      Once all sections above are filled and verified, mark
                      setup complete to unlock reporting dashboards.
                    </span>
                    <RequirePermission permission="mdm.company.write">
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
                            <MarkCompleteDialog
                              onConfirm={handleMarkComplete}
                              onCancel={() => setMarkCompleteOpen(false)}
                              isPending={markSetupComplete.isPending}
                            />
                          </PopoverContent>
                        </Popover>
                      </span>
                    </RequirePermission>
                  </>
                )}
              </div>
            </section>

            {/* ── Save row — gated by mdm.company.write (BO only; finance_manager is read-only) ── */}
            <RequirePermission permission="mdm.company.write">
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={!isDirty}
                >
                  Discard changes
                </Button>
                <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" disabled={!isDirty}>
                      Save changes
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="p-0">
                    <SaveDialog
                      onConfirm={handleSave}
                      onCancel={() => setSaveOpen(false)}
                      isPending={updateCompany.isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </RequirePermission>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
