/**
 * UserCreateEditPage — SI-USR-002 User Create / Edit (Tier 1 hero).
 *
 * Phase 4 Epic 2 USR Arc (c), Task C4. Mirrors the Arc (b) mockup at
 * mockups/src/screens/usr/SI-USR-002.tsx — same chrome, same section
 * ordering, same role → scope-shape conditional.
 *
 * TIER 1 ACCEPTANCE applies (FR14 happy path):
 *   1. BO can create a non-BO user → user lands `approval_status='approved'`
 *      (visible in DB / list immediately).
 *   2. BO can create a BO-role user → user lands `approval_status='pending_approval'`
 *      (cannot sign in until approved by Superadmin).
 *   3. Reason code captured on every mutation (FR15c).
 *   4. audit_log row written per FR15c (verified by querying audit_log).
 *
 * Schema field-name divergence (load-bearing):
 *   - Create body uses `reasonCode` (per packages/shared userCreateSchema).
 *   - Update body uses `reason`     (per packages/shared userUpdateSchema).
 *   The hooks normalise the names; the form internally tracks one `reason`
 *   field and the submit handler maps it into the right key per mode.
 *
 * Role immutability in edit mode:
 *   userUpdateSchema does NOT include `role` — it is immutable post-creation
 *   (a separate privileged operation handles role changes). The role <select>
 *   is disabled in edit mode and a hint explains why.
 *
 * Email immutability in edit mode:
 *   userUpdateSchema does NOT include `email` either (sign-in identity is
 *   immutable). The email <input> is disabled in edit mode with a hint.
 *
 * Sections (per the mockup):
 *   1. Identity            — email + fullName (email disabled in edit).
 *   2. Role                — select; description card; BO-warning banner (FR14).
 *   3. Scope (conditional) — none / cluster / location+department per
 *                            roleScopeShape from @/lib/user-roles.
 *   4. Reason              — mandatory textarea, min 10 chars (UI rule;
 *                            backend min is 3).
 *
 * Token discipline (DESIGN.md):
 *   - BO-warning banner: bg-tertiary-container + text-on-tertiary-container
 *     (matches §6.1 status_pending_approval family).
 *   - No tenant_brand_accent (admin form is not an allowed accent surface).
 *   - SectionShift for tonal section breaks (NOT <Separator>).
 *   - Lucide-only icons.
 */

import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Clock,
  Inbox,
  Key,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  User as UserIcon,
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
  SectionShift,
} from '@/components/shell';
import { CCActivityTimeline, type TimelineEvent, type TimelineActionType } from '@/components/shell/CCActivityTimeline';

import { ApiError } from '@/lib/api-client';
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  USER_ROLES,
  roleScopeShape,
} from '@/lib/user-roles';
import {
  useCreateUser,
  useUpdateUser,
  useUser,
  useUsers,
  type UserRow,
} from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import { useClustersList } from '@/hooks/mdm/useClusters';
import { useLocationsList } from '@/hooks/mdm/useLocations';
import { useDepartmentsList } from '@/hooks/mdm/useDepartments';
import { useEntityTimeline } from '@/hooks/useAudit';
import { useUserOverrides } from '@/hooks/usePermissionOverrides';
import { usePermissions } from '@/hooks/usePermissions';

// ---------------------------------------------------------------------------
// Form schema (UI validation — server enforces min(3) on reason fields)
// ---------------------------------------------------------------------------

const formSchema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .max(120, 'Full name must be 120 chars or fewer'),
    role: z.enum(
      [
        'brand_owner',
        'cluster_manager',
        'kitchen_manager',
        'store_manager',
        'procurement_manager',
        'finance_manager',
        'dispatch_staff',
        'pos_staff',
        'superadmin',
      ] as const,
      { required_error: 'Pick a role' },
    ),
    clusterId: z.string().optional(),
    locationId: z.string().optional(),
    departmentId: z.string().optional(),
    reason: z
      .string()
      .min(10, 'Reason must be at least 10 characters'),
  })
  .superRefine((values, ctx) => {
    const shape = roleScopeShape[values.role];
    if (shape === 'cluster') {
      if (!values.clusterId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clusterId'],
          message: 'Cluster is required for this role',
        });
      }
    }
    if (shape === 'location_department') {
      if (!values.clusterId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['clusterId'],
          message: 'Cluster is required for this role',
        });
      }
      if (!values.locationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locationId'],
          message: 'Location is required for this role',
        });
      }
      if (!values.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['departmentId'],
          message: 'Department is required for this role',
        });
      }
    }
  });

type UserFormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldError({ message }: { readonly message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-error" role="alert">
      {message}
    </p>
  );
}

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
        <CardTitle className="mt-1 text-base text-on-surface">
          {title}
        </CardTitle>
        {subtitle ? (
          <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="p-4 tablet:p-6 pt-2">{children}</CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading user…"
      className="flex flex-col gap-4 animate-pulse"
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-md bg-surface-container-low p-4 flex flex-col gap-3"
        >
          <div className="h-3 w-32 rounded bg-surface-container-high" />
          <div className="h-10 w-full rounded bg-surface-container-high" />
          <div className="h-10 w-full rounded bg-surface-container-high" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / fallback values
// ---------------------------------------------------------------------------

const EMPTY_FORM: UserFormValues = {
  email: '',
  fullName: '',
  role: 'pos_staff',
  clusterId: '',
  locationId: '',
  departmentId: '',
  reason: '',
};

function userToFormValues(u: UserRow): UserFormValues {
  return {
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    clusterId: u.clusterId ?? '',
    locationId: u.locationId ?? '',
    departmentId: u.departmentId ?? '',
    reason: '',
  };
}

// ---------------------------------------------------------------------------
// Audit-log → TimelineEvent adapter
// ---------------------------------------------------------------------------

/**
 * Maps backend audit-log action strings (snake_case) to the shell's kebab-case
 * TimelineActionType union. Policy:
 *   'create'          → 'create'
 *   'update'          → 'update'
 *   'business_action' → 'override'  (covers deactivate, approval ops written
 *                                    as business_action by the audit service)
 *   'delete'          → 'cancel'    (nearest semantic; full deletes are rare)
 *   anything else     → pass through as-is (shell renders unknown with default icon)
 */
function mapAuditAction(raw: string): TimelineActionType {
  switch (raw) {
    case 'create': return 'create';
    case 'update': return 'update';
    case 'business_action': return 'override';
    case 'delete': return 'cancel';
    default: return raw as TimelineActionType;
  }
}

function buildDescription(tableName: string, action: string, changedFields: unknown): string {
  const base = tableName === 'users' ? 'User' : tableName;
  if (action === 'create') return `${base} created`;
  if (action === 'delete') return `${base} deleted`;
  if (action === 'update') {
    const fields = Array.isArray(changedFields)
      ? (changedFields as string[]).join(', ')
      : '';
    return fields ? `${base} updated: ${fields}` : `${base} updated`;
  }
  if (action === 'business_action') return `${base} business action`;
  return `${base} — ${action}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UserCreateEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // ── Data fetching ────────────────────────────────────────────────────────
  const userQuery = useUser(id);
  const rolesQuery = useRoles();
  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();
  const departmentsQuery = useDepartmentsList();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  // Edit-mode-only: timeline, overrides, actor lookup, permissions catalog
  const timelineQuery = useEntityTimeline(isEditMode ? 'users' : undefined, id);
  const overridesQuery = useUserOverrides(isEditMode ? id : undefined);
  const usersQuery = useUsers();
  const permissionsQuery = usePermissions();

  // ── Form ─────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  // Pre-fill on edit ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !userQuery.data) return;
    reset(userToFormValues(userQuery.data));
  }, [isEditMode, userQuery.data, reset]);

  // Watch derived values for conditional rendering ─────────────────────────
  const role = watch('role');
  const clusterId = watch('clusterId') ?? '';
  const locationId = watch('locationId') ?? '';
  const reason = watch('reason') ?? '';
  const scopeShape = roleScopeShape[role];
  const isBrandOwnerPick = role === 'brand_owner';

  // Reset scope fields when role changes shape ─────────────────────────────
  useEffect(() => {
    if (scopeShape === 'none') {
      setValue('clusterId', '');
      setValue('locationId', '');
      setValue('departmentId', '');
    } else if (scopeShape === 'cluster') {
      setValue('locationId', '');
      setValue('departmentId', '');
    }
  }, [scopeShape, setValue]);

  // Reset location/department when cluster changes ─────────────────────────
  useEffect(() => {
    if (scopeShape !== 'location_department') return;
    setValue('locationId', '');
    setValue('departmentId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  // Reset department when location changes ─────────────────────────────────
  useEffect(() => {
    if (scopeShape !== 'location_department') return;
    setValue('departmentId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // Actor lookup map — id → fullName (for timeline actor labels) ───────────
  const actorNameMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const u of usersQuery.data ?? []) map[u.id] = u.fullName;
    return map;
  }, [usersQuery.data]);

  // Permission id → key map (for override summary) ─────────────────────────
  const permKeyMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of permissionsQuery.data ?? []) map[p.id] = p.key;
    return map;
  }, [permissionsQuery.data]);

  // Adapt audit rows → TimelineEvent[] ─────────────────────────────────────
  const timelineEvents = useMemo<ReadonlyArray<TimelineEvent>>(() => {
    return (timelineQuery.data ?? []).map((row): TimelineEvent => {
      const actorId = row.actorUserId ?? '';
      const actorLabel = actorId
        ? (actorNameMap[actorId] ?? `${actorId.slice(0, 8)}…`)
        : 'System';
      const action = mapAuditAction(row.action);
      return {
        id: row.id,
        timestamp: row.occurredAt,
        actorUserId: actorId,
        actorLabel,
        action,
        description: buildDescription(row.tableName, row.action, row.changedFields),
        diff: action === 'update' && row.before != null && row.after != null
          ? (() => {
              // Build a flat diff from before/after objects if they are plain objects.
              const before = row.before as Record<string, unknown>;
              const after = row.after as Record<string, unknown>;
              if (typeof before !== 'object' || typeof after !== 'object') return undefined;
              const fields = Array.isArray(row.changedFields)
                ? (row.changedFields as string[])
                : Object.keys(after);
              return fields.map((f) => ({
                field: f,
                fieldLabel: f.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
                before: before[f] as string | number | null ?? null,
                after: after[f] as string | number | null ?? null,
              }));
            })()
          : undefined,
        reasonCode: row.reason ?? undefined,
        trnReference: row.trnReference ?? undefined,
      };
    });
  }, [timelineQuery.data, actorNameMap]);

  // Active overrides — not revoked and not expired ──────────────────────────
  const now = useMemo(() => Date.now(), []);
  const activeOverrides = useMemo(() => {
    return (overridesQuery.data ?? []).filter((ov) => {
      if (ov.mode === 'revoke') return false;
      if (!ov.expiresAt) return true;
      return new Date(ov.expiresAt).getTime() > now;
    });
  }, [overridesQuery.data, now]);

  // Lookup-filtered options ────────────────────────────────────────────────
  const clusterOptions = useMemo(
    () =>
      (clustersQuery.data ?? [])
        .filter((c) => c.active)
        .map((c) => ({ value: c.id, label: c.name })),
    [clustersQuery.data],
  );
  const locationOptions = useMemo(
    () =>
      (locationsQuery.data ?? [])
        .filter((l) => l.active && (clusterId ? l.clusterId === clusterId : true))
        .map((l) => ({
          value: l.id,
          label: l.name,
          sub: l.type.replace('_', ' '),
        })),
    [locationsQuery.data, clusterId],
  );
  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? [])
        .filter(
          (d) => d.active && (locationId ? d.locationId === locationId : false),
        )
        .map((d) => ({ value: d.id, label: d.name, sub: d.type })),
    [departmentsQuery.data, locationId],
  );

  // Submit ─────────────────────────────────────────────────────────────────
  const submitting = createUser.isPending || updateUser.isPending;
  const submitError =
    createUser.error instanceof ApiError
      ? createUser.error
      : updateUser.error instanceof ApiError
      ? updateUser.error
      : null;

  const onSubmit: SubmitHandler<UserFormValues> = async (values) => {
    if (isEditMode && id) {
      await updateUser.mutateAsync({
        id,
        // role is intentionally excluded — immutable per shared schema.
        // email is immutable too — not included.
        fullName: values.fullName,
        clusterId: values.clusterId ? values.clusterId : null,
        locationId: values.locationId ? values.locationId : null,
        departmentId: values.departmentId ? values.departmentId : null,
        reason: values.reason.trim(),
      });
    } else {
      await createUser.mutateAsync({
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        role: values.role,
        clusterId: values.clusterId || undefined,
        locationId: values.locationId || undefined,
        departmentId: values.departmentId || undefined,
        // SHARED SCHEMA divergence: create uses `reasonCode`, update uses `reason`.
        reasonCode: values.reason.trim(),
      });
    }
    navigate('/users');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (isEditMode && userQuery.isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (isEditMode && userQuery.error) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <div
            role="alert"
            className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {userQuery.error instanceof ApiError
              ? `Error loading user: ${userQuery.error.message}`
              : 'Failed to load user. Please refresh the page.'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => navigate('/users')}
          >
            Back to users
          </Button>
        </div>
      </div>
    );
  }

  const headerTitle = isEditMode
    ? userQuery.data?.fullName ?? 'Edit user'
    : 'New user';

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[960px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              User management ·{' '}
              {isEditMode ? 'Edit user' : 'Create user'}
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {headerTitle}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Identity, role, scope, and audit reason. Brand Owner accounts
              additionally require Superadmin approval. Every
              create / edit captures a mandatory reason for the audit trail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditMode && id ? (
              <AuditLink entityType="users" entityRef={id} compact />
            ) : null}
            <DraftPill isDraft={isDirty} mobileEyebrow />
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => navigate('/users')}
            >
              Back to users
            </Button>
          </div>
        </header>

        {/* ── Submit error banner ───────────────────────────────────────── */}
        {submitError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {submitError.message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col"
          noValidate
        >
          {/* ── Section 1 — Identity ─────────────────────────────────── */}
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
                    className="pl-9"
                    {...register('fullName')}
                  />
                </div>
                <FieldError message={errors.fullName?.message} />
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
                    className="pl-9 disabled:opacity-60"
                    disabled={isEditMode}
                    {...register('email')}
                  />
                </div>
                {isEditMode ? (
                  <p className="text-[11px] text-on-surface-variant">
                    Email is the sign-in handle and cannot be changed after
                    creation.
                  </p>
                ) : null}
                <FieldError message={errors.email?.message} />
              </div>
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 2 — Role ────────────────────────────────────── */}
          <FormSection
            index={2}
            title="Role"
            subtitle="Pick from the 9 canonical roles. The role determines which scope fields appear next."
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
                  disabled={isEditMode}
                  className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  {...register('role')}
                >
                  {(rolesQuery.data ?? USER_ROLES.map((r) => ({
                    role: r,
                    label: ROLE_LABEL[r],
                    description: ROLE_DESCRIPTION[r],
                  }))).map((entry) => (
                    <option key={entry.role} value={entry.role}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                {isEditMode ? (
                  <p className="text-[11px] text-on-surface-variant">
                    Role is immutable after creation. Use a separate
                    privileged operation to change it.
                  </p>
                ) : null}
                <FieldError message={errors.role?.message} />
              </div>
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  About this role
                </p>
                <p className="mt-1 text-sm text-on-surface">
                  {ROLE_DESCRIPTION[role]}
                </p>
              </div>
            </div>

            {/* BO-approval warning banner (FR14). */}
            {isBrandOwnerPick && !isEditMode ? (
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
                  state and won't be able to sign in until approved.
                </p>
              </div>
            ) : null}
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 3 — Scope (conditional) ──────────────────────── */}
          <FormSection
            index={3}
            title="Scope"
            subtitle={
              scopeShape === 'none'
                ? 'No scope picker required for this role — the role is brand-wide or multi-tenant.'
                : scopeShape === 'cluster'
                ? 'Cluster Managers are bound to exactly one cluster.'
                : 'This role binds to one location and one department within that location.'
            }
          >
            {scopeShape === 'none' ? (
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">
                    {ROLE_LABEL[role]}
                  </span>{' '}
                  has{' '}
                  {role === 'superadmin'
                    ? 'multi-tenant scope (no brand binding)'
                    : 'brand-wide scope'}
                  . No further scope fields are required.
                </p>
              </div>
            ) : null}

            {scopeShape === 'cluster' ? (
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="user-cluster"
                    className="text-xs font-medium text-on-surface"
                  >
                    Cluster
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <Controller
                    name="clusterId"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="user-cluster"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="">Pick a cluster…</option>
                        {clusterOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  <FieldError message={errors.clusterId?.message} />
                </div>
                <div className="rounded-sm bg-surface-container-low p-3 self-end">
                  <p className="text-[11px] text-on-surface-variant">
                    The Cluster Manager will see only users, vendors, and
                    locations belonging to the chosen cluster.
                  </p>
                </div>
              </div>
            ) : null}

            {scopeShape === 'location_department' ? (
              <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="user-cluster"
                    className="text-xs font-medium text-on-surface"
                  >
                    Cluster
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <Controller
                    name="clusterId"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="user-cluster"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="">Pick a cluster…</option>
                        {clusterOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  <FieldError message={errors.clusterId?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="user-location"
                    className="text-xs font-medium text-on-surface"
                  >
                    Location
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <Controller
                    name="locationId"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="user-location"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={!clusterId}
                        className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        <option value="">
                          {clusterId
                            ? locationOptions.length === 0
                              ? 'No locations in cluster'
                              : 'Pick a location…'
                            : 'Pick a cluster first'}
                        </option>
                        {locationOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                            {opt.sub ? ` — ${opt.sub}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  <FieldError message={errors.locationId?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="user-department"
                    className="text-xs font-medium text-on-surface"
                  >
                    Department
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <Controller
                    name="departmentId"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="user-department"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={!locationId}
                        className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        <option value="">
                          {locationId
                            ? departmentOptions.length === 0
                              ? 'No departments at location'
                              : 'Pick a department…'
                            : 'Pick a location first'}
                        </option>
                        {departmentOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                            {opt.sub ? ` — ${opt.sub}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  <FieldError message={errors.departmentId?.message} />
                </div>
              </div>
            ) : null}
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 4 — Reason ──────────────────────────────────── */}
          <FormSection
            index={4}
            title="Reason for change"
            subtitle="Mandatory free-text — captured in the audit trail. At least 10 characters."
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
                placeholder={
                  isEditMode
                    ? 'e.g. Promoted from POS Staff after 2-year tenure; cluster head sign-off attached.'
                    : 'e.g. Adding new POS Manager for the Linking Road outlet — Q2 expansion plan.'
                }
                className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                {...register('reason')}
              />
              <span className="text-[11px] text-on-surface-variant">
                {reason.trim().length} / 10 chars minimum
              </span>
              <FieldError message={errors.reason?.message} />
            </div>
          </FormSection>

          {/* ── Submit row ─────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => navigate('/users')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={submitting}
              aria-label={isEditMode ? 'Save changes' : 'Create user'}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : isBrandOwnerPick && !isEditMode ? (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {isEditMode
                ? submitting
                  ? 'Saving…'
                  : 'Save changes'
                : submitting
                ? 'Creating…'
                : isBrandOwnerPick
                ? 'Submit for Superadmin approval'
                : 'Create user'}
            </Button>
          </div>
        </form>

        {/* ── Edit-mode-only: Mutation history + Active overrides ────── */}
        {isEditMode && id ? (
          <>
            <SectionShift tone="low" className="my-6" aria-hidden />

            {/* ── Mutation history ────────────────────────────────────── */}
            <section aria-labelledby="mutation-history-heading" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 text-on-surface-variant" aria-hidden />
                <h2
                  id="mutation-history-heading"
                  className="text-base font-semibold text-on-surface"
                >
                  Mutation history
                </h2>
              </div>
              {timelineQuery.isLoading ? (
                <div
                  role="status"
                  aria-label="Loading timeline…"
                  className="animate-pulse rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
                >
                  <div className="h-3 w-48 rounded bg-surface-container-high" />
                  <div className="h-3 w-full rounded bg-surface-container-high" />
                  <div className="h-3 w-3/4 rounded bg-surface-container-high" />
                </div>
              ) : timelineQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  Failed to load mutation history.
                </div>
              ) : (
                <CCActivityTimeline
                  entityType="users"
                  entityRef={id}
                  entityTypeLabel="User"
                  events={timelineEvents}
                  mode="embedded"
                  defaultCollapsed={false}
                  onViewFullHistory={() =>
                    navigate(`/audit?entityType=users&entityRef=${id}`)
                  }
                />
              )}
            </section>

            <SectionShift tone="low" className="my-6" aria-hidden />

            {/* ── Active permission overrides ─────────────────────────── */}
            <section aria-labelledby="active-overrides-heading" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Key className="h-4 w-4 text-on-surface-variant" aria-hidden />
                  <h2
                    id="active-overrides-heading"
                    className="text-base font-semibold text-on-surface"
                  >
                    Active permission overrides
                  </h2>
                </div>
                <Link
                  to={`/users/${id}/permissions`}
                  className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                >
                  Manage all overrides →
                </Link>
              </div>

              {overridesQuery.isLoading ? (
                <div
                  role="status"
                  aria-label="Loading overrides…"
                  className="animate-pulse rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
                >
                  <div className="h-3 w-40 rounded bg-surface-container-high" />
                  <div className="h-3 w-full rounded bg-surface-container-high" />
                </div>
              ) : overridesQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  Failed to load permission overrides.
                </div>
              ) : activeOverrides.length === 0 ? (
                <div className="rounded-md bg-surface-container-low p-6 flex flex-col items-center gap-2 text-center">
                  <Inbox className="h-6 w-6 text-on-surface-variant" aria-hidden />
                  <p className="text-sm text-on-surface-variant">
                    No active permission overrides for this user.
                  </p>
                  <Link
                    to={`/users/${id}/permissions`}
                    className="mt-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  >
                    Grant an override →
                  </Link>
                </div>
              ) : (
                <div className="rounded-md bg-surface-container-low p-3">
                  <div
                    className="grid text-[11px] font-medium uppercase tracking-wider text-on-surface-variant gap-x-3 gap-y-1 pb-2"
                    style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto' }}
                  >
                    <span>Permission</span>
                    <span>Reason / notes</span>
                    <span>Granted by</span>
                    <span>Expires</span>
                    <span />
                  </div>
                  <ul className="flex flex-col gap-1.5" role="list" aria-label="Active overrides">
                    {activeOverrides.map((ov) => {
                      const permKey = permKeyMap[ov.permissionId] ?? ov.permissionId.slice(0, 8) + '…';
                      const grantedByName = ov.createdBy
                        ? (actorNameMap[ov.createdBy] ?? ov.createdBy.slice(0, 8) + '…')
                        : 'System';
                      const expiryLabel = ov.expiresAt
                        ? new Date(ov.expiresAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'No expiry';
                      return (
                        <li
                          key={ov.id}
                          className="rounded-sm bg-surface-container-lowest pl-3 pr-3 py-2 border-l-4"
                          style={{ borderLeftColor: 'var(--status-overridden-pip, var(--outline-variant))' }}
                        >
                          <div
                            className="grid items-center gap-x-3 gap-y-1"
                            style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto' }}
                          >
                            <span className="font-mono text-xs text-on-surface truncate" title={permKey}>
                              {permKey}
                            </span>
                            <span className="text-xs text-on-surface-variant truncate" title={ov.reasonCode}>
                              {ov.reasonCode}
                            </span>
                            <span className="text-xs text-on-surface-variant truncate">
                              {grantedByName}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {expiryLabel}
                            </span>
                            <Link
                              to={`/users/${id}/overrides/edit/${ov.id}`}
                              className="text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm whitespace-nowrap"
                            >
                              Manage
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
