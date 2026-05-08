import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  Clock,
  Inbox,
  Mail,
  ShieldCheck,
  ShieldX,
  UserCheck,
  X,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
} from '@/shell'

/**
 * SI-USR-008 — Brand Owner Account Approval (Tier 2 mockup).
 *
 * Phase 4 Epic 2 USR Arc (b), Task B4. Surfaces the Superadmin-only queue
 * for approving Brand Owner self-creation requests, plus the Brand-Owner-
 * facing pending-status confirmation that the requester sees while their
 * own account is awaiting review.
 *
 * Routing decision (per DL-030 — "Superadmin queue is route-only, no menu link"):
 *
 *   In single-tenant MVP, no production user holds the `superadmin` role,
 *   so the actionable queue is always empty in production. The screen MUST
 *   exist and be functional (Superadmin can still be impersonated by the
 *   F&B ERP platform team), but the cockpit sidebar deliberately does NOT
 *   surface a link to it. Reachable only by direct route or by deep-link
 *   from SI-USR-002 when a Brand Owner submits a self-creation request.
 *
 * View-variant toggle (mockup-only — production reads role from session):
 *
 *   Mirrors SI-USR-001's segmented radiogroup pattern. Reviewers can flip
 *   between:
 *
 *     - "Superadmin view"           — pending-approval queue table with
 *                                      Approve / Reject row actions, plus an
 *                                      "empty queue" toggle button so the
 *                                      no-pending-approvals card is visible.
 *     - "Brand Owner self-status"   — single-card waiting-room surface that
 *                                      the requester sees on their own
 *                                      session until a Superadmin acts.
 *
 * Approve / Reject popovers (Popover-as-dialog — same pattern as the
 * "Mark setup complete" affordance in SI-MDM-007 and the §2.7 vendor scope
 * picker in SI-MDM-005):
 *
 *   - Approve  — optional reason note (free text, not required).
 *   - Reject   — REQUIRED reason textarea, ≥10 characters minimum to match
 *                the FR15a / B3 reason-code threshold used elsewhere in the
 *                USR module. Confirm button disables until the threshold is
 *                met. The mockup just removes the row from local state on
 *                confirm; Arc (c) wires `userService.approve` /
 *                `userService.reject` per FR14.
 *
 * Sample data:
 *
 *   `SAMPLE_PENDING` ships 5 fixtures with realistic Indian hospitality-
 *   founder names + emails. `requestedRole` is hardcoded to `brand_owner`
 *   (the only role that flows through this queue today). The
 *   `requestedBrand` field that would matter in a multi-tenant deployment
 *   is intentionally omitted — single-tenant MVP keeps the column off.
 *
 * Token notes:
 *   - Pending status uses the canonical `status_pending_approval` chip
 *     (same family used for the pending-approval row on SI-USR-001).
 *   - Empty-state card uses `bg-secondary-container` for the icon halo
 *     (informational success surface — no banned borders, no sectioning
 *     lines).
 *   - BO self-status surface uses `bg-tertiary-container` for the timeline
 *     hint card (matches the §6.4 informational caution tone used on the
 *     BO-approval banner in SI-USR-002).
 *
 * Source FRs:
 *   - FR14 — Brand Owner self-creation flow with Superadmin approval. New
 *            BO is created in `pending_approval` status; cannot sign in
 *            until a Superadmin approves. Approval / rejection writes an
 *            audit row + sends an email.
 *
 * Decision references:
 *   - DL-030 — SI-USR-008 is route-only; no menu link in the production
 *              cockpit sidebar (single-tenant MVP — actionable queue is
 *              always empty for non-platform users).
 *
 * Animation — NONE per CLAUDE.md (data table; entrance motion banned).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & sample data
// ─────────────────────────────────────────────────────────────────────────────

interface PendingBrandOwner {
  readonly id: string
  readonly fullName: string
  readonly email: string
  readonly requestedRole: 'brand_owner'
  readonly requestedAt: string
}

/**
 * 5 fixtures — realistic-looking founder names + business emails. The
 * `requestedBrand` field is intentionally omitted; single-tenant MVP does
 * not surface it. Multi-tenant promotion (Phase 5+) would add the column
 * here and to the table header.
 */
const SAMPLE_PENDING: ReadonlyArray<PendingBrandOwner> = [
  {
    id: 'pba-1',
    fullName: 'Aanya Krishnamurthy',
    email: 'aanya@theloafstudio.in',
    requestedRole: 'brand_owner',
    requestedAt: '2026-05-06T09:14:00Z',
  },
  {
    id: 'pba-2',
    fullName: 'Vikram Saluja',
    email: 'vikram.s@guftgukitchens.com',
    requestedRole: 'brand_owner',
    requestedAt: '2026-05-06T15:42:00Z',
  },
  {
    id: 'pba-3',
    fullName: 'Riya Bhandari',
    email: 'riya@bombayspicebox.in',
    requestedRole: 'brand_owner',
    requestedAt: '2026-05-07T07:08:00Z',
  },
  {
    id: 'pba-4',
    fullName: 'Karthik Subramanian',
    email: 'karthik@madrasfilterco.in',
    requestedRole: 'brand_owner',
    requestedAt: '2026-05-07T11:31:00Z',
  },
  {
    id: 'pba-5',
    fullName: 'Sana Qureshi',
    email: 'sana.q@nawabivirasat.com',
    requestedRole: 'brand_owner',
    requestedAt: '2026-05-08T03:55:00Z',
  },
]

/** The BO self-status view's reference request — first row of the queue. */
const SAMPLE_SELF_REQUEST: PendingBrandOwner = SAMPLE_PENDING[0]!

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatRequestedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRequestedDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve popover (optional reason note)
// ─────────────────────────────────────────────────────────────────────────────

interface RowActionProps {
  readonly entry: PendingBrandOwner
  readonly onApprove: (id: string, note: string) => void
  readonly onReject: (id: string, reason: string) => void
}

function ApprovePopover({
  entry,
  onApprove,
}: Pick<RowActionProps, 'entry' | 'onApprove'>) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const confirm = () => {
    onApprove(entry.id, note.trim())
    setOpen(false)
    setNote('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="tonal"
          size="sm"
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
              setOpen(false)
              setNote('')
            }}
          >
            Cancel
          </Button>
          <Button variant="tonal" size="sm" onClick={confirm}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Confirm approval
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject popover (REQUIRED reason ≥10 chars)
// ─────────────────────────────────────────────────────────────────────────────

function RejectPopover({
  entry,
  onReject,
}: Pick<RowActionProps, 'entry' | 'onReject'>) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const reasonOk = reason.trim().length >= 10

  const confirm = () => {
    if (!reasonOk) return
    onReject(entry.id, reason.trim())
    setOpen(false)
    setReason('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
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
            Rejection prevents sign-in and emails the requester with the
            reason below. The audit row records the rejection per FR14.
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
              setOpen(false)
              setReason('')
            }}
          >
            Cancel
          </Button>
          <Button
            variant="tonal"
            size="sm"
            disabled={!reasonOk}
            onClick={confirm}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Confirm rejection
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type View = 'superadmin' | 'self_status'

export default function SiUsr008() {
  const [view, setView] = useState<View>('superadmin')
  const [queue, setQueue] = useState<ReadonlyArray<PendingBrandOwner>>(SAMPLE_PENDING)
  const [emptyDemo, setEmptyDemo] = useState(false)

  const visibleQueue = useMemo(() => (emptyDemo ? [] : queue), [emptyDemo, queue])
  const pendingCount = visibleQueue.length

  const handleApprove = (id: string, _note: string) => {
    // Mockup-only — Arc (c) wires userService.approve(id, { note }).
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }

  const handleReject = (id: string, _reason: string) => {
    // Mockup-only — Arc (c) wires userService.reject(id, { reason }).
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }

  const resetQueue = () => {
    setQueue(SAMPLE_PENDING)
    setEmptyDemo(false)
  }

  return (
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
              Per <span className="font-medium text-on-surface">DL-030</span>,
              this queue surfaces only to the Superadmin role. In single-tenant
              MVP, no production user holds this role, so the actionable
              queue is always empty in production. The route exists for
              platform-team use and for the Brand-Owner-facing pending-status
              surface (FR14).
            </p>
          </div>
          {view === 'superadmin' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface tabular-nums">
                <Inbox className="h-3.5 w-3.5" aria-hidden />
                {pendingCount} pending
              </span>
            </div>
          ) : null}
        </header>

        {/* View-variant toggle (mockup-only — production reads role from session). */}
        <div
          role="radiogroup"
          aria-label="View variant (mockup-only)"
          className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low p-1"
        >
          {(
            [
              { value: 'superadmin', label: 'Superadmin view', icon: UserCheck },
              {
                value: 'self_status',
                label: 'Brand Owner self-status view',
                icon: Clock,
              },
            ] as const
          ).map((opt) => {
            const active = view === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setView(opt.value)}
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

        {view === 'superadmin' ? (
          <SuperadminView
            queue={visibleQueue}
            emptyDemo={emptyDemo}
            onToggleEmpty={() => setEmptyDemo((v) => !v)}
            onResetQueue={resetQueue}
            onApprove={handleApprove}
            onReject={handleReject}
            queueWasReset={queue.length === SAMPLE_PENDING.length}
          />
        ) : (
          <SelfStatusView entry={SAMPLE_SELF_REQUEST} />
        )}

        <p className="mt-6 text-[11px] text-on-surface-variant">
          SI-USR-008 · Tier 2 · Phase 4 Epic 2 Arc (b) · DL-030 route-only.
          Both views (Superadmin queue + Brand Owner self-status) and the
          empty-queue state are visible via the mockup-only toggle above.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Superadmin view — pending-queue table + empty-state card
// ─────────────────────────────────────────────────────────────────────────────

interface SuperadminViewProps {
  readonly queue: ReadonlyArray<PendingBrandOwner>
  readonly emptyDemo: boolean
  readonly onToggleEmpty: () => void
  readonly onResetQueue: () => void
  readonly onApprove: (id: string, note: string) => void
  readonly onReject: (id: string, reason: string) => void
  readonly queueWasReset: boolean
}

function SuperadminView({
  queue,
  emptyDemo,
  onToggleEmpty,
  onResetQueue,
  onApprove,
  onReject,
  queueWasReset,
}: SuperadminViewProps) {
  const showEmpty = queue.length === 0

  return (
    <>
      {/* Mockup-only controls — toggle empty state + reset acted-on rows. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
        <span className="font-medium uppercase tracking-wider">
          Mockup controls
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onToggleEmpty}
          aria-pressed={emptyDemo}
        >
          {emptyDemo ? 'Show sample queue' : 'Show empty state'}
        </Button>
        {!queueWasReset ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onResetQueue}
          >
            Restore acted-on rows
          </Button>
        ) : null}
      </div>

      {showEmpty ? (
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
              When a new Brand Owner submits a self-creation request from the
              login screen, it will appear here for Superadmin review (FR14).
              In single-tenant MVP, this queue stays empty for production
              users per DL-030.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">
              Pending Brand Owner requests
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {queue.length} awaiting review
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden tablet:table-cell">Email</TableHead>
                <TableHead className="hidden desktop:table-cell">
                  Requested role
                </TableHead>
                <TableHead>Requested at</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="hover:bg-surface-container-low transition-colors"
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {entry.fullName}
                      </span>
                      <span className="text-[11px] text-on-surface-variant tablet:hidden inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" aria-hidden />
                        {entry.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden tablet:table-cell">
                    <span className="text-xs text-on-surface inline-flex items-center gap-1.5">
                      <Mail
                        className="h-3 w-3 text-on-surface-variant"
                        aria-hidden
                      />
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
                      {formatRequestedAt(entry.requestedAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status="status_pending_approval" size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <ApprovePopover entry={entry} onApprove={onApprove} />
                      <RejectPopover entry={entry} onReject={onReject} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Owner self-status view
// ─────────────────────────────────────────────────────────────────────────────

function SelfStatusView({ entry }: { readonly entry: PendingBrandOwner }) {
  return (
    <div className="mt-4 mx-auto max-w-2xl">
      <Card className="p-0">
        <CardHeader className="p-6 pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-tertiary-container text-on-tertiary-container"
            >
              <Clock className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg text-on-surface">
                Account pending approval
              </CardTitle>
              <StatusPill status="status_pending_approval" size="sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2 flex flex-col gap-4">
          <p className="text-sm text-on-surface">
            Your Brand Owner account is pending Superadmin approval. You'll
            receive an email when it's reviewed.
          </p>
          <p className="text-xs text-on-surface-variant">
            Submitted on{' '}
            <span className="font-medium text-on-surface">
              {formatRequestedDate(entry.requestedAt)}
            </span>{' '}
            · You'll be redirected to sign in once approved.
          </p>

          <div className="rounded-sm bg-tertiary-container text-on-tertiary-container px-4 py-3 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-wider">
              What happens next
            </p>
            <p className="text-xs">
              A Superadmin reviews your request, then approves or rejects it.
              On approval, your account becomes active immediately. On
              rejection, you'll receive an email with the reason.
            </p>
          </div>

          <div className="rounded-sm bg-surface-container-low p-4 flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Submitted details
            </p>
            <p className="text-sm font-medium text-on-surface">
              {entry.fullName}
            </p>
            <p className="text-xs text-on-surface-variant inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" aria-hidden />
              {entry.email}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Requested role: Brand Owner
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/SI-USR-003" aria-label="Sign out and return to login">
                Sign out
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
