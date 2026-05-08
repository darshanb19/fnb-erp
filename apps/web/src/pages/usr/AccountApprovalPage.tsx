/**
 * SI-USR-008 — Brand Owner Account Approval (DL-030)
 *
 * Build now, route only, NOT linked from sidebar nav. In MVP single-tenant,
 * no real user holds the `superadmin` role; this page returns a 403 panel
 * in normal navigation. Future-proofs Phase 2 multi-tenant migration.
 *
 * Route: /users/approvals
 * Guards: <RequireAuth> (outer) + <RequireRole role="superadmin"> (inner).
 *
 * BO self-status view (mockup shows two variants):
 *   The mockup's "Brand Owner self-status" variant is the waiting-room card
 *   a pending BO would see on their own session. In single-tenant MVP, BOs
 *   are bootstrapped as approved (the self-creation flow gated behind FR14
 *   is deferred to Epic 3's Approval Engine wiring). Only the Superadmin
 *   queue is wired here. This choice is documented per DL-030.
 *
 * Approve note: optional from the Superadmin's perspective, but the API's
 *   reasonSchema.min(3) requires at least 3 characters. When the Superadmin
 *   leaves the note blank, the UI sends a default placeholder that satisfies
 *   the API minimum ("—"). The reject reason is required (≥10 chars) per
 *   FR15a / B3 threshold — matching the same rule used throughout USR.
 *
 * Smoke-test recipe (dev only — manual, no CI coverage required for Tier 2):
 *   psql -d fnberp_dev -c "UPDATE users SET role='superadmin' WHERE email='bootstrap-bo@fnberp.local';"
 *   Sign out + sign back in (refreshes the JWT role claim).
 *   Navigate to /users/approvals — the pending BO queue should load.
 *   Approve a row; confirm it disappears and the DB reflects approval.
 *   Demote back:
 *     psql -d fnberp_dev -c "UPDATE users SET role='brand_owner' WHERE email='bootstrap-bo@fnberp.local';"
 *     pnpm --filter @fnberp/api bootstrap:bo   # re-syncs Supabase Auth user_metadata.role
 *
 * Source FRs:
 *   FR14 — Brand Owner self-creation flow with Superadmin approval.
 *
 * Decision references:
 *   DL-030 — SI-USR-008 is route-only; no menu link in the production cockpit
 *             sidebar (single-tenant MVP — actionable queue is always empty for
 *             non-platform users).
 *
 * Animation — NONE per CLAUDE.md (data table; entrance motion banned).
 * Token discipline — zero hex literals; Lucide-only; no banned borders.
 */

import { useState } from 'react';
import {
  Check,
  Inbox,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell';
import RequireRole from '@/lib/RequireRole';
import { ApiError } from '@/lib/api-client';
import {
  useUsersPendingApproval,
  useApproveUser,
  useRejectUser,
  type UserRow,
} from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// 403 fallback — shown to everyone who isn't superadmin
// ---------------------------------------------------------------------------

function Forbidden403Panel() {
  return (
    <div className="min-h-full bg-surface flex items-center justify-center p-8">
      <Card className="max-w-md w-full p-0">
        <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
          <span
            aria-hidden
            className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-surface-container-high text-on-surface-variant"
          >
            <Lock className="h-7 w-7" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-on-surface">403 — Forbidden</p>
            <p className="text-sm text-on-surface-variant">
              This route is reserved for Superadmin users.
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Per <span className="font-medium text-on-surface">DL-030</span>, the Brand Owner
              approval queue is intentionally not linked from sidebar nav. In
              MVP single-tenant, no production user holds the{' '}
              <span className="font-mono text-xs bg-surface-container-high px-1 rounded-sm">
                superadmin
              </span>{' '}
              role.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approve popover — optional note (API requires ≥3 chars; default placeholder)
// ---------------------------------------------------------------------------

interface ApprovePopoverProps {
  readonly entry: UserRow;
  readonly onApprove: (id: string, reason: string) => void;
  readonly isPending: boolean;
}

function ApprovePopover({ entry, onApprove, isPending }: ApprovePopoverProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const confirm = () => {
    // API reasonSchema.min(3) — send placeholder when note is blank.
    onApprove(entry.id, note.trim() || '—');
    setOpen(false);
    setNote('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="tonal"
          size="sm"
          disabled={isPending}
          aria-label={`Approve Brand Owner request from ${entry.fullName}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Approve
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm font-semibold text-on-surface">
            Approve {entry.fullName}?
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Once approved, the Brand Owner can sign in immediately. Approval
            writes an audit row and sends a confirmation email per FR14.
          </p>
        </div>
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <label
            htmlFor={`approve-note-${entry.id}`}
            className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            Note (optional)
          </label>
          <textarea
            id={`approve-note-${entry.id}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Visible in the audit trail and the welcome email."
            className="rounded-sm bg-surface-container-highest p-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="px-4 pb-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              setNote('');
            }}
          >
            Cancel
          </Button>
          <Button variant="tonal" size="sm" onClick={confirm} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden />
            )}
            Confirm approval
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Reject popover — REQUIRED reason ≥10 chars (FR15a / B3 threshold)
// ---------------------------------------------------------------------------

interface RejectPopoverProps {
  readonly entry: UserRow;
  readonly onReject: (id: string, reason: string) => void;
  readonly isPending: boolean;
}

function RejectPopover({ entry, onReject, isPending }: RejectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const reasonOk = reason.trim().length >= 10;

  const confirm = () => {
    if (!reasonOk) return;
    onReject(entry.id, reason.trim());
    setOpen(false);
    setReason('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Reject Brand Owner request from ${entry.fullName}`}
        >
          <ShieldX className="h-3.5 w-3.5" aria-hidden />
          Reject
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm font-semibold text-on-surface">
            Reject {entry.fullName}?
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Rejection prevents sign-in and emails the requester with the reason
            below. The audit row records the rejection per FR14.
          </p>
        </div>
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <label
            htmlFor={`reject-reason-${entry.id}`}
            className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            Reason
            <span className="text-error ml-0.5" aria-hidden>
              *
            </span>
          </label>
          <textarea
            id={`reject-reason-${entry.id}`}
            aria-required="true"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="At least 10 characters. Sent to the requester verbatim."
            className="rounded-sm bg-surface-container-highest p-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span className="text-[11px] text-on-surface-variant">
            {reason.trim().length} / 10 chars minimum
          </span>
        </div>
        <div className="px-4 pb-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              setReason('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="tonal"
            size="sm"
            disabled={!reasonOk || isPending}
            onClick={confirm}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" aria-hidden />
            )}
            Confirm rejection
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRequestedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Inner page — Superadmin queue (rendered only when role check passes)
// ---------------------------------------------------------------------------

function ApprovalQueue() {
  const { data: queue, isLoading, isError, error } = useUsersPendingApproval();
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();

  const handleApprove = (id: string, reason: string) => {
    approveUser.mutate({ id, reason });
  };

  const handleReject = (id: string, reason: string) => {
    rejectUser.mutate({ id, reason });
  };

  const isMutating = approveUser.isPending || rejectUser.isPending;

  // Loading state
  if (isLoading) {
    return (
      <Card className="mt-4 p-0">
        <div className="px-6 py-12 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" aria-hidden />
          <p className="text-sm text-on-surface-variant">Loading pending approvals…</p>
        </div>
      </Card>
    );
  }

  // Error state
  if (isError) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Failed to load pending approvals.';
    return (
      <Card className="mt-4 p-0">
        <div className="px-6 py-8 flex flex-col items-center text-center gap-2">
          <p className="text-sm font-semibold text-on-surface">Something went wrong</p>
          <p className="text-xs text-on-surface-variant">{message}</p>
        </div>
      </Card>
    );
  }

  const pendingQueue = queue ?? [];

  // Empty state
  if (pendingQueue.length === 0) {
    return (
      <Card className="mt-4 p-0">
        <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-secondary-container text-on-secondary-container"
          >
            <Inbox className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-on-surface">
            No pending Brand Owner accounts.
          </p>
          <p className="max-w-md text-xs text-on-surface-variant">
            When a new Brand Owner submits a self-creation request from the login
            screen, it will appear here for Superadmin review (FR14). In
            single-tenant MVP, this queue stays empty for production users per
            DL-030.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-0">
      <div className="px-4 py-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-on-surface">
          Pending Brand Owner requests
        </h2>
        <span className="text-xs text-on-surface-variant tabular-nums">
          {pendingQueue.length} awaiting review
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden tablet:table-cell">Email</TableHead>
            <TableHead className="hidden desktop:table-cell">Requested role</TableHead>
            <TableHead>Requested at</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingQueue.map((entry) => (
            <TableRow
              key={entry.id}
              className="hover:bg-surface-container-low transition-colors"
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">{entry.fullName}</span>
                  <span className="text-[11px] text-on-surface-variant tablet:hidden inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" aria-hidden />
                    {entry.email}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden tablet:table-cell">
                <span className="text-xs text-on-surface inline-flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-on-surface-variant" aria-hidden />
                  {entry.email}
                </span>
              </TableCell>
              <TableCell className="hidden desktop:table-cell">
                <span className="inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
                  Brand Owner
                </span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-on-surface tabular-nums">
                  {formatRequestedAt(entry.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <StatusPill status="status_pending_approval" size="sm" />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ApprovePopover
                    entry={entry}
                    onApprove={handleApprove}
                    isPending={isMutating}
                  />
                  <RejectPopover
                    entry={entry}
                    onReject={handleReject}
                    isPending={isMutating}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function AccountApprovalPage() {
  const pendingQuery = useUsersPendingApproval();
  const pendingCount = pendingQuery.data?.length ?? 0;

  return (
    <RequireRole role="superadmin" fallback={<Forbidden403Panel />}>
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1280px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          {/* Page header */}
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                User management · Brand Owner approvals
              </p>
              <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                Brand Owner approval queue
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
                Per <span className="font-medium text-on-surface">DL-030</span>, this queue
                surfaces only to the Superadmin role. In single-tenant MVP, no
                production user holds this role, so the actionable queue is always
                empty in production. The route exists for platform-team use (FR14).
              </p>
            </div>
            {!pendingQuery.isLoading && pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface tabular-nums">
                <Inbox className="h-3.5 w-3.5" aria-hidden />
                {pendingCount} pending
              </span>
            ) : null}
          </header>

          <ApprovalQueue />

          <p className="mt-6 text-[11px] text-on-surface-variant">
            SI-USR-008 · Tier 2 · Phase 4 Epic 2 Arc (c) · DL-030 route-only. Not
            linked from sidebar nav. BO self-status view deferred to Epic 3
            (FR14 wiring requires the Approval Engine cross-cutting infrastructure).
          </p>
        </div>
      </div>
    </RequireRole>
  );
}
