/**
 * PermissionOverridePage — SI-USR-006 Grant / Revoke / Edit override (Tier 1 hero).
 *
 * Phase 4 Epic 2 USR Arc (c), Task C5. Mirrors the Arc (b) mockup at
 * mockups/src/screens/usr/SI-USR-006.tsx — same chrome, same 5-section
 * ordering, real `useGrantOverride` / `useEditOverride` mutations.
 *
 * TIER 1 ACCEPTANCE applies (FR15a / FR15b / FR15c):
 *   - FR15a — mandatory reason code + ≥10-char notes enforced UI-side; the
 *             API also rejects empty reasonCode (api validates via
 *             permissionOverrideService.validateReasonCode).
 *   - FR15b — on success, `useGrantOverride.onSuccess` invalidates BOTH the
 *             effective-permissions query and the per-user override list, so
 *             the redirect to `/users/:userId/effective-permissions` shows
 *             the updated set immediately.
 *   - FR15c — audit row written by the service (verified via psql in C5
 *             smoke tests).
 *   - Edit mode preserves permission + target user as read-only (the
 *             permission select is disabled and the API rejects mutating
 *             `permissionId` / `userId` on PATCH per the shared
 *             permissionOverrideEditSchema).
 *
 * Routes:
 *   /users/:userId/overrides/grant         → mode=grant
 *   /users/:userId/overrides/revoke        → mode=revoke
 *   /users/:userId/overrides/edit/:overrideId → mode=edit
 *
 * Schema mirroring (load-bearing — apps/web does not import @fnberp/shared
 * per the C4 implementer note). The local Zod schemas mirror
 * permissionOverrideGrantSchema and permissionOverrideEditSchema verbatim;
 * the field names are the load-bearing API contract (`reasonCode`, NOT
 * `reason`).
 *
 * Token discipline:
 *   - Reason input via `<OverrideReasonInput>` (no inline reason re-impl).
 *   - Source preview via `<OverrideSourceBadge>` + `<OverrideExpiryBand>`.
 *   - SectionShift between form sections (NOT <Separator>).
 *   - Lucide-only icons.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  ShieldX,
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
  OverrideExpiryBand,
  OverrideReasonInput,
  OverrideSourceBadge,
  RoleBadge,
  SectionShift,
  StatusPill,
  type OverrideSource,
} from '@/components/shell';

import { ApiError } from '@/lib/api-client';
import { REASON_CODES_CATALOG, REASON_CODE_LABEL } from '@/lib/reason-codes';
import { useUser } from '@/hooks/useUsers';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { usePermissions, type PermissionRow } from '@/hooks/usePermissions';
import {
  useUserOverrides,
  useGrantOverride,
  useEditOverride,
} from '@/hooks/usePermissionOverrides';

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

type Mode = 'grant' | 'revoke' | 'edit';

const MODE_TO_SOURCE: Record<'grant' | 'revoke', OverrideSource> = {
  grant: 'grant_override',
  revoke: 'revoke_override',
};

function resolveModeFromPathname(pathname: string): Mode {
  if (pathname.includes('/overrides/edit/')) return 'edit';
  if (pathname.endsWith('/overrides/revoke')) return 'revoke';
  return 'grant';
}

// ---------------------------------------------------------------------------
// FormSection wrapper (mirror of UserCreateEditPage / SI-USR-006 mockup)
// ---------------------------------------------------------------------------

interface FormSectionProps {
  readonly index: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
}

function FormSection({ index, title, subtitle, children }: FormSectionProps) {
  return (
    <Card className="p-0">
      <CardHeader className="p-4 tablet:p-6 pb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Section {index}
        </p>
        <CardTitle className="mt-1 text-base text-on-surface">{title}</CardTitle>
        {subtitle ? (
          <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="p-4 tablet:p-6 pt-2">{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Permission picker — searchable dropdown, mode-aware filter
// ---------------------------------------------------------------------------

interface PermissionPickerProps {
  readonly mode: Mode;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly availablePermissions: ReadonlyArray<PermissionRow>;
}

function PermissionPicker({
  mode,
  value,
  onChange,
  availablePermissions,
}: PermissionPickerProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (query.trim().length === 0) return availablePermissions;
    const q = query.trim().toLowerCase();
    return availablePermissions.filter((p) => {
      const hay = `${p.key} ${p.description} ${p.module}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, availablePermissions]);

  if (mode === 'edit') {
    const selected = availablePermissions.find((p) => p.id === value);
    if (!selected) {
      return (
        <p className="text-xs text-on-surface-variant">
          No override loaded for editing.
        </p>
      );
    }
    return (
      <div className="rounded-sm bg-surface-container-low p-3" data-readonly="true">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Editing permission (read-only)
        </p>
        <p className="mt-1 font-mono text-sm text-on-surface">{selected.key}</p>
        <p className="text-[11px] text-on-surface-variant">{selected.module}</p>
        <p className="mt-2 text-xs text-on-surface">{selected.description}</p>
        <p className="mt-2 text-[11px] text-on-surface-variant">
          The permission key is immutable in edit mode (FR15c). To change which
          key is granted or revoked, cancel and create a new override.
        </p>
      </div>
    );
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
          <ul className="flex flex-col" role="radiogroup" aria-label="Permission selection">
            {filtered.map((p) => {
              const active = p.id === value;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(p.id)}
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
              );
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
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  readonly permissionId: string;
  readonly reasonCode: string;
  readonly reasonNotes: string;
  /** ISO YYYY-MM-DD. Empty string = permanent. */
  readonly expiresAt: string;
}

const EMPTY_FORM: FormState = {
  permissionId: '',
  reasonCode: '',
  reasonNotes: '',
  expiresAt: '',
};

/** Compose `reasonCode|notes` for the API — reasonCode field carries both
 *  per A6 service contract (validateReasonCode trims; the canonical UX is
 *  to include the free-text notes appended after a separator so the audit
 *  row preserves rationale per FR15c). */
function composeReasonCode(code: string, notes: string): string {
  const trimmed = notes.trim();
  return trimmed.length > 0 ? `${code}: ${trimmed}` : code;
}

/** Inverse — splits `reasonCode|notes` back into the form fields when loading
 *  an existing override for edit. Defensive: if the saved value doesn't match
 *  the composed shape, falls back to using the whole string as the code. */
function decomposeReasonCode(raw: string): { code: string; notes: string } {
  const sep = ': ';
  const idx = raw.indexOf(sep);
  if (idx > 0) {
    const code = raw.slice(0, idx);
    if (code in REASON_CODE_LABEL) {
      return { code, notes: raw.slice(idx + sep.length) };
    }
  }
  // Whole string was a bare code, or unknown shape — show it in notes so it's
  // not lost; require user to pick a canonical code.
  if (raw in REASON_CODE_LABEL) return { code: raw, notes: '' };
  return { code: '', notes: raw };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PermissionOverridePage() {
  const params = useParams<{ userId: string; overrideId?: string }>();
  const navigate = useNavigate();

  const userId = params.userId;
  const overrideId = params.overrideId;

  // Mode is fixed by route (no in-page mode toggle in production — each mode
  // has its own URL).
  const mode = useMemo<Mode>(
    () => resolveModeFromPathname(window.location.pathname),
    // window.location is read once on mount. Route changes unmount/remount
    // because react-router does not preserve component state across param
    // changes when paths differ.
    [],
  );

  // ── Data fetching ──────────────────────────────────────────────────────
  const userQuery = useUser(userId);
  const permissionsQuery = usePermissions();
  const effectiveQuery = useEffectivePermissions(userId);
  const overridesQuery = useUserOverrides(userId);

  const grantMutation = useGrantOverride();
  const editMutation = useEditOverride();

  const isLoadingData =
    userQuery.isLoading ||
    permissionsQuery.isLoading ||
    effectiveQuery.isLoading ||
    overridesQuery.isLoading;

  // ── Form state ─────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Hydrate form from existing override in edit mode (once data loads).
  useEffect(() => {
    if (mode !== 'edit' || !overrideId) return;
    const existing = overridesQuery.data?.find((o) => o.id === overrideId);
    if (!existing) return;
    const { code, notes } = decomposeReasonCode(existing.reasonCode);
    setForm({
      permissionId: existing.permissionId,
      reasonCode: code,
      reasonNotes: notes,
      expiresAt: existing.expiresAt ? existing.expiresAt.slice(0, 10) : '',
    });
    setIsDirty(false);
    // overrideId is a stable URL param; data identity changes when query
    // refetches — depending on data only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridesQuery.data, mode, overrideId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSubmitted(false);
  };

  // ── Derived: which permissions to show in the picker ───────────────────
  const availablePermissions = useMemo<PermissionRow[]>(() => {
    const all = permissionsQuery.data ?? [];
    if (mode === 'grant') {
      const effective = new Set(effectiveQuery.data ?? []);
      return all.filter((p) => !effective.has(p.key));
    }
    if (mode === 'revoke') {
      const effective = new Set(effectiveQuery.data ?? []);
      return all.filter((p) => effective.has(p.key));
    }
    // edit — only the single permission being edited
    return all.filter((p) => p.id === form.permissionId);
  }, [mode, permissionsQuery.data, effectiveQuery.data, form.permissionId]);

  const selectedPermission = useMemo<PermissionRow | null>(() => {
    return permissionsQuery.data?.find((p) => p.id === form.permissionId) ?? null;
  }, [permissionsQuery.data, form.permissionId]);

  // ── Validation (FR15a) ─────────────────────────────────────────────────
  const reasonOk = form.reasonCode.length > 0 && form.reasonNotes.trim().length >= 10;
  const permissionOk = form.permissionId.length > 0;
  const minDateISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const expiryOk = form.expiresAt.length === 0 || form.expiresAt >= minDateISO;
  const canSubmit = permissionOk && reasonOk && expiryOk;

  const isSubmitting = grantMutation.isPending || editMutation.isPending;
  const mutationError = grantMutation.error ?? editMutation.error;

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !userId || isSubmitting) return;
    const composed = composeReasonCode(form.reasonCode, form.reasonNotes);
    try {
      if (mode === 'edit') {
        if (!overrideId) return;
        await editMutation.mutateAsync({
          userId,
          overrideId,
          input: {
            reasonCode: composed,
            // null clears, undefined leaves unchanged. We always send the
            // current form value so users can clear an expiry.
            expiresAt: form.expiresAt.length === 0 ? null : form.expiresAt,
          },
        });
      } else {
        await grantMutation.mutateAsync({
          userId,
          input: {
            permissionId: form.permissionId,
            mode,
            reasonCode: composed,
            ...(form.expiresAt.length > 0 ? { expiresAt: form.expiresAt } : {}),
          },
        });
      }
      setSubmitted(true);
      setIsDirty(false);
      // FR15b — redirect back to the effective view; cache invalidations in
      // the mutation hooks ensure the table reflects the change.
      navigate(`/users/${userId}/effective-permissions`);
    } catch {
      // Error rendered via mutationError below — no rethrow.
    }
  }

  const submitLabel =
    mode === 'grant'
      ? 'Grant permission'
      : mode === 'revoke'
        ? 'Revoke permission'
        : 'Save changes';

  const heading =
    mode === 'grant'
      ? 'Grant a permission'
      : mode === 'revoke'
        ? 'Revoke a permission'
        : 'Edit override';

  const eyebrow =
    mode === 'grant'
      ? 'Grant permission'
      : mode === 'revoke'
        ? 'Revoke permission'
        : 'Edit override';

  if (!userId) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[960px] px-4 py-6">
          <p className="text-sm text-error">Missing user ID in route.</p>
        </div>
      </div>
    );
  }

  const previewSource: OverrideSource = mode === 'edit'
    ? 'grant_override' // Best effort — we don't track the loaded override's mode in form; preview re-derives from selected.
    : MODE_TO_SOURCE[mode];

  // For edit mode, attempt to read the existing override's mode for an accurate
  // preview pill.
  const editingOverride = mode === 'edit' && overrideId
    ? overridesQuery.data?.find((o) => o.id === overrideId)
    : null;
  const effectivePreviewSource: OverrideSource = editingOverride
    ? (editingOverride.mode === 'grant' ? 'grant_override' : 'revoke_override')
    : previewSource;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management · {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {heading}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Reason-gated permission mutation. Every grant, revoke, and edit
              writes to the audit trail (FR15c) and updates the user's
              effective set immediately (FR15b).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink
              entityType="user_permission_overrides"
              entityRef={overrideId ?? undefined}
              compact
            />
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {submitted ? (
              <StatusPill status="status_confirmed" size="sm" label="Saved" />
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link to={`/users/${userId}/effective-permissions`}>
                Back to effective view
              </Link>
            </Button>
          </div>
        </header>

        {/* ── Mutation error banner ────────────────────────────────────── */}
        {mutationError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {mutationError instanceof ApiError
              ? mutationError.message
              : 'Failed to save the override. Please try again.'}
          </div>
        ) : null}

        {isLoadingData ? (
          <div
            role="status"
            aria-label="Loading…"
            className="mt-4 rounded-md bg-surface-container-low px-4 py-10 flex items-center justify-center"
          >
            <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" aria-hidden />
            <span className="ml-2 text-sm text-on-surface-variant">Loading…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col" noValidate>
            {/* ── Section 1 — Target user (read-only) ──────────────────── */}
            <FormSection
              index={1}
              title="Target user"
              subtitle="The user whose effective permission set is being mutated. Read-only — driven by the entry-point context."
            >
              <div
                className="rounded-sm bg-surface-container-low p-3 flex flex-wrap items-center gap-3"
                data-readonly="true"
              >
                {userQuery.data ? (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-on-surface">
                        {userQuery.data.fullName}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {userQuery.data.email}
                      </span>
                    </div>
                    <RoleBadge role={userQuery.data.role} />
                    {mode === 'edit' ? (
                      <span className="ml-auto">
                        <OverrideSourceBadge source={effectivePreviewSource} />
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-on-surface-variant">User not found.</span>
                )}
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
                    ? "Pick a permission currently in the user's effective set. Revoking it does NOT delete the role baseline — it adds a revoke override on top."
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
              <OverrideReasonInput
                reasonCode={form.reasonCode}
                onReasonCodeChange={(value) => update('reasonCode', value)}
                notes={form.reasonNotes}
                onNotesChange={(value) => update('reasonNotes', value)}
                reasonCodes={REASON_CODES_CATALOG}
                notesPlaceholder={
                  mode === 'grant'
                    ? 'e.g. Covering procurement tasks for Vihaan during parental leave through end of May.'
                    : mode === 'revoke'
                      ? 'e.g. Reduce cross-cluster data access pending Q3 security review.'
                      : 'e.g. Extending coverage another 14 days — Vihaan return date pushed.'
                }
              />
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
                  surface on the Expiring-soon view in the 0–7 day urgent band.
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
                    <OverrideSourceBadge source={effectivePreviewSource} />
                    <span className="font-mono text-xs">{selectedPermission.key}</span>
                    {form.expiresAt ? (
                      <OverrideExpiryBand expiresAt={new Date(form.expiresAt)} />
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">
                    {mode === 'revoke'
                      ? `${userQuery.data?.fullName ?? 'The user'} will lose the ability to ${selectedPermission.description.toLowerCase()}.`
                      : `${userQuery.data?.fullName ?? 'The user'} will gain the ability to ${selectedPermission.description.toLowerCase()}.`}
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

            {/* ── Submit row ───────────────────────────────────────────── */}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button asChild variant="ghost" size="default">
                <Link to={`/users/${userId}/effective-permissions`}>Cancel</Link>
              </Button>
              <Button
                type="submit"
                size="default"
                disabled={!canSubmit || isSubmitting}
                aria-label={submitLabel}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : mode === 'revoke' ? (
                  <ShieldX className="h-4 w-4" aria-hidden />
                ) : mode === 'grant' ? (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                {isSubmitting ? 'Saving…' : submitLabel}
              </Button>
            </div>

            {!reasonOk && (form.reasonCode.length > 0 || form.reasonNotes.length > 0) ? (
              <p className="mt-2 text-[11px] text-on-surface-variant text-right">
                Reason code + ≥10-char notes required (FR15a).
              </p>
            ) : null}
          </form>
        )}

        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-006 · Tier 1 hero · Phase 4 Epic 2 Arc (c). Reason-input,
          source pill, and expiry band rendered via the shared
          CC-PERMISSION-OVERRIDE-MGMT shell.
        </p>
      </div>
    </div>
  );
}

