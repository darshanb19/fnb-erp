/**
 * IssueTicketFormPage — SI-INF-008 Issue Ticket Create / Edit (Tier 1 hero).
 *
 * Phase 4 Epic 3 INF Arc (c) Task C8a — basics only: title, description,
 * priority, status, assignee, linked entity. Status transitions wired via
 * PATCH + convenience close/reopen endpoints.
 *
 * Task C8b — comments thread + Realtime channel #5. Replaces the C8a
 * placeholder with <CCIssueCommentThread> wired to useAddIssueTicketComment.
 * Realtime subscription is already inside useIssueTicket (channel
 * `issue_tracker_threads`); adding a comment in one tab fans out to all
 * open consumers automatically via TanStack Query cache invalidation.
 *
 * Tier 1 hero acceptance applies per Phase 4 invariants.
 *
 * Token discipline: ZERO hex, Lucide-only, status palette closed, no banned
 * border classes, Inter only, SectionShift for tonal breaks.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  History,
  Loader2,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from 'lucide-react';

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
  type StatusToken,
} from '@/components/shell';

import RequirePermission from '@/lib/RequirePermission';
import { ApiError } from '@/lib/api-client';
import {
  useIssueTicket,
  useCreateIssueTicket,
  useUpdateIssueTicket,
  useCloseIssueTicket,
  useReopenIssueTicket,
  useAddIssueTicketComment,
  type IssueStatus,
  type IssuePriority,
  type IssueTicketComment,
} from '@/hooks/useIssueTickets';
import { useUsers } from '@/hooks/useUsers';
import { ROLE_LABEL, type UserRole } from '@/lib/user-roles';
import {
  CCIssueCommentThread,
  type IssueComment,
} from '@/components/shell/CCIssueCommentThread';

// ---------------------------------------------------------------------------
// Label / token maps
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
};

// Status → canonical 20-token palette (same mapping as list page + mockup).
// open → status_pending_approval (closest: raised but not yet actioned).
// pending_info → status_waiting_info (closest: waiting for more information).
// NOTE: No perfect match for "open" — status_pending_approval is semantically
// closest. Flag: status_waiting_info used for pending_info (closest; no exact).
const STATUS_TOKEN: Record<IssueStatus, StatusToken> = {
  open: 'status_pending_approval',
  in_progress: 'status_in_progress',
  pending_info: 'status_waiting_info',
  resolved: 'status_completed',
  closed: 'status_closed',
};

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Valid next statuses per current status (for the status-change dropdown).
const VALID_TRANSITIONS: Record<IssueStatus, ReadonlyArray<IssueStatus>> = {
  open: ['in_progress', 'pending_info', 'resolved'],
  in_progress: ['pending_info', 'resolved'],
  pending_info: ['in_progress', 'resolved'],
  resolved: ['closed'],  // closed via useCloseIssueTicket; reopen → in_progress via useReopenIssueTicket
  closed: [],            // only reopen via useReopenIssueTicket
};

// ---------------------------------------------------------------------------
// Comments adapter helpers
// ---------------------------------------------------------------------------

/** Humanize a role string to its display label (falls back gracefully). */
function humanizeRole(role: string): string {
  return (ROLE_LABEL as Record<string, string>)[role] ?? role.replace(/_/g, ' ');
}

/**
 * Adapt API IssueTicketComment[] → shell IssueComment[].
 * Falls back author label to first-8-chars of UUID if the user isn't in the
 * userMap (e.g. deactivated or not yet loaded).
 */
function toShellComments(
  comments: ReadonlyArray<IssueTicketComment>,
  userMap: Map<string, { fullName: string; role: string }>,
): IssueComment[] {
  return comments.map((c) => {
    const u = userMap.get(c.authorUserId);
    return {
      id: c.id,
      authorUserId: c.authorUserId,
      authorLabel: u?.fullName ?? `${c.authorUserId.slice(0, 8)}…`,
      authorRoleLabel: u ? humanizeRole(u.role) : undefined,
      body: c.body,
      createdAt: c.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Form schema (Task spec validation)
// ---------------------------------------------------------------------------

const formSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'pending_info', 'resolved', 'closed']).optional(),
  assigneeUserId: z.string().uuid('Select a valid assignee').optional().or(z.literal('')),
  linkedEntityType: z.string().optional(),
  linkedEntityRef: z.string().optional(),
  reasonCode: z.string().optional(),
}).superRefine((values, ctx) => {
  // reasonCode required on update — enforced at submit time via isEditMode check
  // (passed as a prop; superRefine here doesn't have that context)
  void values;
  void ctx;
});

type IssueFormValues = z.infer<typeof formSchema>;

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
      aria-label="Loading ticket…"
      className="flex flex-col gap-4 animate-pulse"
    >
      {[1, 2, 3].map((i) => (
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

interface PriorityChipProps {
  readonly priority: IssuePriority;
}

function PriorityChip({ priority }: PriorityChipProps) {
  if (priority === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-error-container text-on-error-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Critical
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-tertiary-container text-on-tertiary-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high text-on-surface px-2 py-0.5 text-[11px] font-medium">
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Assignee picker (same pattern as mockup SI-INF-008)
// ---------------------------------------------------------------------------

interface AssigneePickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly options: ReadonlyArray<{ id: string; fullName: string; role: string }>;
}

function AssigneePicker({ value, onChange, options }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((u) => u.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            'h-11 w-full rounded-sm bg-surface-container-highest px-3 text-sm text-left',
            'flex items-center justify-between gap-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selected ? 'text-on-surface' : 'text-on-surface-variant',
          ].join(' ')}
          aria-label="Assignee picker"
        >
          <span className="truncate">
            {selected
              ? `${selected.fullName} · ${selected.role.replace(/_/g, ' ')}`
              : 'Pick an assignee'}
          </span>
          <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[20rem] p-1 max-h-80 overflow-auto">
        <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Assignee
        </span>
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              aria-pressed={value === ''}
              className={[
                'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px]',
                'hover:bg-surface-container-high transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                value === '' ? 'bg-surface-container' : '',
              ].join(' ')}
            >
              <span className="text-sm text-on-surface">Unassigned</span>
            </button>
          </li>
          {options.map((u) => {
            const active = u.id === value;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => { onChange(u.id); setOpen(false); }}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{u.fullName}</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {u.role.replace(/_/g, ' ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

const EMPTY_FORM: IssueFormValues = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'open',
  assigneeUserId: '',
  linkedEntityType: '',
  linkedEntityRef: '',
  reasonCode: '',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IssueTicketFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);

  // Query-param prefill (CC-PREFILL contract)
  const prefilledType = searchParams.get('linkedEntityType') ?? '';
  const prefilledRef = searchParams.get('linkedEntityRef') ?? '';

  // Data fetching
  const ticketQuery = useIssueTicket(id);
  const usersQuery = useUsers();
  const createTicket = useCreateIssueTicket();
  const updateTicket = useUpdateIssueTicket();
  const closeTicket = useCloseIssueTicket();
  const reopenTicket = useReopenIssueTicket();
  const addComment = useAddIssueTicketComment();

  // Comment composer state
  const [composerValue, setComposerValue] = useState('');
  const [commentError, setCommentError] = useState('');

  // Status transition local state (edit mode only — for the change-status popover)
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [reasonCodeError, setReasonCodeError] = useState('');

  // Assignee options
  const assigneeOptions = useMemo(() => {
    return (usersQuery.data ?? [])
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));
  }, [usersQuery.data]);

  // User map for comment author resolution
  const userMap = useMemo(() => {
    const map = new Map<string, { fullName: string; role: string }>();
    for (const u of usersQuery.data ?? []) {
      map.set(u.id, { fullName: u.fullName, role: u.role as UserRole });
    }
    return map;
  }, [usersQuery.data]);

  // Adapted comments for the shell component
  const shellComments = useMemo(
    () => toShellComments(ticketQuery.data?.comments ?? [], userMap),
    [ticketQuery.data?.comments, userMap],
  );

  // Comment submit handler
  const handleSubmitComment = () => {
    if (!id || !composerValue.trim()) return;
    setCommentError('');
    addComment.mutate(
      { ticketId: id, body: composerValue.trim() },
      {
        onSuccess: () => setComposerValue(''),
        onError: (err) => setCommentError(err.message),
      },
    );
  };

  // Form setup
  const defaultValues: IssueFormValues = useMemo(() => {
    if (!isEditMode) {
      return {
        ...EMPTY_FORM,
        linkedEntityType: prefilledType,
        linkedEntityRef: prefilledRef,
      };
    }
    return EMPTY_FORM;
  }, [isEditMode, prefilledType, prefilledRef]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onBlur',
  });

  // Pre-fill on edit
  useEffect(() => {
    if (!isEditMode || !ticketQuery.data) return;
    const t = ticketQuery.data.ticket;
    reset({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assigneeUserId: t.assigneeUserId ?? '',
      linkedEntityType: t.linkedEntityType ?? '',
      linkedEntityRef: t.linkedEntityRef ?? '',
      reasonCode: '',
    });
  }, [isEditMode, ticketQuery.data, reset]);

  const watchedPriority = watch('priority') as IssuePriority;
  const watchedReasonCode = watch('reasonCode') ?? '';
  const watchedLinkedType = watch('linkedEntityType') ?? '';

  const currentStatus: IssueStatus = isEditMode
    ? (ticketQuery.data?.ticket.status ?? 'open')
    : 'open';

  const submitting =
    createTicket.isPending ||
    updateTicket.isPending ||
    closeTicket.isPending ||
    reopenTicket.isPending;

  const submitError =
    createTicket.error instanceof ApiError
      ? createTicket.error
      : updateTicket.error instanceof ApiError
      ? updateTicket.error
      : closeTicket.error instanceof ApiError
      ? closeTicket.error
      : reopenTicket.error instanceof ApiError
      ? reopenTicket.error
      : null;

  // Form submission
  const onSubmit: SubmitHandler<IssueFormValues> = async (values) => {
    // Reason code required on update
    if (isEditMode && id) {
      if (!values.reasonCode || values.reasonCode.trim().length < 10) {
        setReasonCodeError('Reason code must be at least 10 characters on update.');
        return;
      }
      setReasonCodeError('');
      await updateTicket.mutateAsync({
        ticketId: id,
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigneeUserId: values.assigneeUserId || null,
        linkedEntityType: values.linkedEntityType || null,
        linkedEntityRef: values.linkedEntityRef || null,
        reasonCode: values.reasonCode.trim(),
      });
      // Stay on the page after successful edit (ticket detail view)
    } else {
      const created = await createTicket.mutateAsync({
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigneeUserId: values.assigneeUserId || undefined,
        linkedEntityType: values.linkedEntityType || undefined,
        linkedEntityRef: values.linkedEntityRef || undefined,
      });
      navigate(`/issues/${created.id}`);
    }
  };

  // Status transition (PATCH to new status, not close/reopen)
  const handleStatusTransition = async (nextStatus: IssueStatus) => {
    if (!id) return;
    if (!watchedReasonCode || watchedReasonCode.trim().length < 10) {
      setReasonCodeError('Reason code must be at least 10 characters for status changes.');
      setStatusPopoverOpen(false);
      return;
    }
    setReasonCodeError('');
    await updateTicket.mutateAsync({
      ticketId: id,
      status: nextStatus,
      reasonCode: watchedReasonCode.trim(),
    });
    setStatusPopoverOpen(false);
  };

  const handleClose = async () => {
    if (!id) return;
    if (!watchedReasonCode || watchedReasonCode.trim().length < 10) {
      setReasonCodeError('Reason code must be at least 10 characters to close a ticket.');
      return;
    }
    setReasonCodeError('');
    await closeTicket.mutateAsync({ ticketId: id, reasonCode: watchedReasonCode.trim() });
  };

  const handleReopen = async () => {
    if (!id) return;
    if (!watchedReasonCode || watchedReasonCode.trim().length < 10) {
      setReasonCodeError('Reason code must be at least 10 characters to reopen a ticket.');
      return;
    }
    setReasonCodeError('');
    await reopenTicket.mutateAsync({ ticketId: id, reasonCode: watchedReasonCode.trim() });
  };

  // Render loading / error states
  if (isEditMode && ticketQuery.isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1080px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (isEditMode && ticketQuery.isError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1080px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <div
            role="alert"
            className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {ticketQuery.error instanceof ApiError
              ? `Error loading ticket: ${ticketQuery.error.message}`
              : 'Failed to load ticket. Please refresh the page.'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => navigate('/issues')}
          >
            Back to tickets
          </Button>
        </div>
      </div>
    );
  }

  const ticket = ticketQuery.data?.ticket;
  const reference = isEditMode ? (ticket?.reference ?? null) : null;
  const headerStatus: IssueStatus = isEditMode ? (ticket?.status ?? 'open') : 'open';

  const validNextStatuses = VALID_TRANSITIONS[currentStatus].filter(
    (s) => s !== 'closed', // closed handled by close button
  );

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1080px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Back-link header */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/issues" aria-label="Back to issue tickets">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tickets
            </Link>
          </Button>
        </div>

        {/* Title row */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Issue Tracker ·{' '}
              {isEditMode ? 'Edit ticket' : 'New ticket'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                {isEditMode
                  ? (ticket?.title || 'Untitled')
                  : 'New issue ticket'}
              </h1>
            </div>
            {reference ? (
              <p className="mt-1 font-mono text-xs text-on-surface-variant">
                {reference}
              </p>
            ) : (
              <p className="mt-1 font-mono text-xs text-on-surface-variant">
                Reference assigned on save (
                <span className="font-semibold">ISS-YYYY-SEQ</span>)
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {watchedPriority ? <PriorityChip priority={watchedPriority} /> : null}
            <StatusPill
              status={STATUS_TOKEN[headerStatus]}
              label={STATUS_LABEL[headerStatus]}
              size="sm"
            />
            {/* Close / Reopen buttons — gated on inf.issue.close */}
            {isEditMode && id ? (
              <RequirePermission permission="inf.issue.close">
                {currentStatus === 'resolved' ? (
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    onClick={() => { void handleClose(); }}
                    disabled={submitting}
                    aria-label="Close this ticket"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    Close
                  </Button>
                ) : null}
                {(currentStatus === 'resolved' || currentStatus === 'closed') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { void handleReopen(); }}
                    disabled={submitting}
                    aria-label="Reopen this ticket"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Reopen
                  </Button>
                ) : null}
              </RequirePermission>
            ) : null}
          </div>
        </header>

        {/* Submit error banner */}
        {submitError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {submitError.message}
          </div>
        ) : null}

        {/* CC-PREFILL banner — visible when entered via query params on create */}
        {!isEditMode && (prefilledType || prefilledRef) ? (
          <div
            role="note"
            className="mt-4 flex items-start gap-2 rounded-sm bg-tertiary-container text-on-tertiary-container px-3 py-2"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <p className="text-xs">
              <span className="font-semibold">CC-PREFILL applied.</span>{' '}
              Linked entity pre-populated from the{' '}
              <span className="font-mono">CC-ISSUE-TICKET-LINK</span>{' '}
              entry-point query parameters. You can clear or override before saving.
            </p>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col"
          noValidate
        >
          {/* ── Section 1 — Identity ──────────────────────────────────────── */}
          <FormSection
            index={1}
            title="Ticket details"
            subtitle="Title and description are mandatory. Pick a priority; assign to a teammate. Linked entity is optional and pre-fills when raised from an entity-detail screen via CC-ISSUE-TICKET-LINK."
          >
            <div className="flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ticket-title"
                  className="text-xs font-medium text-on-surface"
                >
                  Title
                  <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <Input
                  id="ticket-title"
                  placeholder="A concise summary of the issue…"
                  {...register('title')}
                />
                <FieldError message={errors.title?.message} />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ticket-description"
                  className="text-xs font-medium text-on-surface"
                >
                  Description
                  <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <textarea
                  id="ticket-description"
                  rows={5}
                  placeholder="Describe what is wrong, what was expected, and any reproduction steps."
                  className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  {...register('description')}
                />
                <FieldError message={errors.description?.message} />
              </div>

              <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
                {/* Priority */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ticket-priority"
                    className="text-xs font-medium text-on-surface"
                  >
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    {...register('priority')}
                  >
                    {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.priority?.message} />
                </div>

                {/* Status (edit mode only — read-only display in create; transitions via button) */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ticket-status"
                    className="text-xs font-medium text-on-surface"
                  >
                    Status
                  </label>
                  {isEditMode ? (
                    <>
                      <div className="h-11 flex items-center gap-2">
                        <StatusPill
                          status={STATUS_TOKEN[currentStatus]}
                          label={STATUS_LABEL[currentStatus]}
                          size="sm"
                        />
                        {validNextStatuses.length > 0 ? (
                          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={submitting}
                              >
                                Change…
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-56 p-1">
                              <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                                Transition to
                              </span>
                              <ul className="flex flex-col">
                                {validNextStatuses.map((s) => (
                                  <li key={s}>
                                    <button
                                      type="button"
                                      onClick={() => { void handleStatusTransition(s); }}
                                      className="w-full text-left px-3 py-2 rounded-sm min-h-[44px] hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                      <StatusPill
                                        status={STATUS_TOKEN[s]}
                                        label={STATUS_LABEL[s]}
                                        size="sm"
                                      />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Resolved → Closed via the Close button above. Closed → Reopen via Reopen.
                      </span>
                    </>
                  ) : (
                    <>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <select
                            id="ticket-status"
                            value={field.value ?? 'open'}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {(['open', 'in_progress', 'pending_info'] as const).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                      <span className="text-[11px] text-on-surface-variant">
                        Initial status for new tickets.
                      </span>
                    </>
                  )}
                </div>

                {/* Assignee */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-on-surface">
                    Assignee
                  </label>
                  <Controller
                    name="assigneeUserId"
                    control={control}
                    render={({ field }) => (
                      <AssigneePicker
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={assigneeOptions}
                      />
                    )}
                  />
                  <FieldError message={errors.assigneeUserId?.message} />
                </div>
              </div>

              {/* Linked entity */}
              <div className="grid grid-cols-1 tablet:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ticket-linked-type"
                    className="text-xs font-medium text-on-surface"
                  >
                    Linked entity type
                  </label>
                  <Input
                    id="ticket-linked-type"
                    placeholder="e.g. PO, GR, Challan, Vendor…"
                    {...register('linkedEntityType')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ticket-linked-ref"
                    className="text-xs font-medium text-on-surface"
                  >
                    Linked entity reference
                  </label>
                  <Input
                    id="ticket-linked-ref"
                    placeholder="e.g. PUR-2026-CKA-000287"
                    disabled={!watchedLinkedType}
                    className="disabled:opacity-60"
                    {...register('linkedEntityRef')}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 2 — Audit metadata (edit mode) ───────────────────── */}
          <FormSection
            index={2}
            title="Audit metadata"
            subtitle="Read-only. Mutations are written to the audit trail per FR20."
          >
            {isEditMode && ticket ? (
              <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Ticket reference
                  </dt>
                  <dd className="mt-0.5 font-mono text-on-surface">{ticket.reference}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Created at
                  </dt>
                  <dd className="mt-0.5 text-on-surface tabular-nums">
                    {new Date(ticket.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Last updated
                  </dt>
                  <dd className="mt-0.5 text-on-surface tabular-nums">
                    {new Date(ticket.updatedAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                <div className="tablet:col-span-2">
                  <Link
                    to={`/audit?entityType=issue_tickets&entityRef=${encodeURIComponent(ticket.id)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  >
                    <History className="h-3 w-3" aria-hidden />
                    View full change history on SI-INF-005
                  </Link>
                </div>
              </dl>
            ) : (
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">
                  Originator + created-at + last-modified-at will be set at save.
                  The reference number (
                  <span className="font-mono">ISS-YYYY-SEQ</span>) is generated
                  by a per-(brand, year) Postgres sequence — no user input.
                </p>
              </div>
            )}
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 3 — Comments thread (C8b) ────────────────────────── */}
          {isEditMode && id ? (
            <>
              <section aria-labelledby="comments-heading">
                <h2
                  id="comments-heading"
                  className="mb-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant"
                >
                  Comments
                </h2>

                {/* Inline error banner for comment mutation failures */}
                {commentError ? (
                  <div
                    role="alert"
                    className="mb-3 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
                  >
                    {commentError}
                  </div>
                ) : null}

                {/* Loading skeleton — 3 placeholder rows while comments hydrate */}
                {ticketQuery.isLoading ? (
                  <div
                    role="status"
                    aria-label="Loading comments…"
                    className="flex flex-col gap-2 animate-pulse"
                  >
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-sm bg-surface-container-low p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-pill bg-surface-container-high" />
                          <div className="h-3 w-28 rounded bg-surface-container-high" />
                        </div>
                        <div className="h-3 w-full rounded bg-surface-container-high" />
                        <div className="h-3 w-3/4 rounded bg-surface-container-high" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <CCIssueCommentThread
                    comments={shellComments}
                    composerValue={composerValue}
                    onComposerChange={(v) => {
                      setComposerValue(v);
                      // Clear the error as user types (UX: reset on keystroke)
                      if (commentError) setCommentError('');
                    }}
                    onSubmitComment={handleSubmitComment}
                    liveIndicator={ticketQuery.isSuccess}
                    scopeLabel={ticketQuery.data?.ticket.reference}
                  />
                )}
              </section>

              <SectionShift tone="lowest" className="my-4" aria-hidden />
            </>
          ) : null}

          {/* ── Section 4 — Reason code (edit mode) ──────────────────────── */}
          <FormSection
            index={isEditMode ? 4 : 3}
            title="Reason for change"
            subtitle={
              isEditMode
                ? 'Mandatory on every update for audit hygiene (FR15c pattern). At least 10 characters. Also required for status transitions and close/reopen.'
                : 'Optional on create. Mandatory on all subsequent edits.'
            }
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ticket-reason"
                className="text-xs font-medium text-on-surface"
              >
                Reason
                {isEditMode ? (
                  <span className="text-error ml-0.5" aria-hidden>*</span>
                ) : null}
              </label>
              <textarea
                id="ticket-reason"
                aria-required={isEditMode}
                rows={3}
                placeholder={
                  isEditMode
                    ? 'e.g. Updating priority after escalation from cluster manager — credit note received.'
                    : 'Optional: context for this new ticket.'
                }
                className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                {...register('reasonCode')}
              />
              <span className="text-[11px] text-on-surface-variant">
                {watchedReasonCode.trim().length} / 10 chars minimum
                {isEditMode ? ' (required)' : ' (optional on create)'}
              </span>
              {reasonCodeError ? (
                <p className="mt-1 text-xs text-error" role="alert">
                  {reasonCodeError}
                </p>
              ) : null}
              <FieldError message={errors.reasonCode?.message} />
            </div>
          </FormSection>

          {/* ── Submit row ────────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => navigate('/issues')}
              disabled={submitting}
            >
              {isEditMode ? 'Back to tickets' : 'Cancel'}
            </Button>
            {isEditMode ? (
              <Button
                type="submit"
                size="default"
                disabled={submitting || !isDirty}
                aria-label="Save changes"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            ) : (
              <Button
                type="submit"
                size="default"
                disabled={submitting}
                aria-label="Open ticket"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                {submitting ? 'Opening…' : 'Open ticket'}
              </Button>
            )}
          </div>
        </form>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          {reference ? (
            <Link
              to={`/audit?entityType=issue_tickets&entityRef=${encodeURIComponent(id ?? '')}`}
              className="text-primary hover:underline"
            >
              <History className="inline h-3 w-3 mr-1" aria-hidden />
              Audit trail viewer (SI-INF-005)
            </Link>
          ) : (
            <Link
              to="/audit?entityType=issue_tickets"
              className="text-primary hover:underline"
            >
              <History className="inline h-3 w-3 mr-1" aria-hidden />
              Audit trail viewer (SI-INF-005)
            </Link>
          )}
          {' · '}
          SI-INF-008 · Tier 1 hero (Phase 4 deferred) · Phase 4 Epic 3 INF Arc (c) C8b
          {' · '}Attachments: C8c
        </footer>
      </div>
    </div>
  );
}
