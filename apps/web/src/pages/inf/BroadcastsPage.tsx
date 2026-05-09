/**
 * BroadcastsPage — SI-INF-009 Broadcast Announcement Composer + History.
 *
 * Phase 4 Epic 3 INF Arc (c) Task C9.
 *
 * FR23 (broadcast announcements). Mutations write to the audit trail per FR20.
 * Sent broadcasts are immutable per FR117 — correction is a new announcement,
 * not an edit.
 *
 * Layout:
 *   - Composer (~60%) + Preview (~40%) side-by-side on desktop, stacked mobile.
 *   - History list below (useSentBroadcasts — BO sees all).
 *   - Inline ack-roster drill-down per expanded row (useBroadcastAcks).
 *
 * RBAC:
 *   - Page requires inf.broadcast.read (enforced by route wrapper in App.tsx).
 *   - Composer affordances wrapped in RequirePermission inf.broadcast.compose.
 *   - Send affordance inside composer also gated by inf.broadcast.compose.
 *
 * Token discipline: ZERO hex, Lucide-only, status palette closed, no banned
 * border classes, Inter only.
 *
 * DL-035 note: cross-channel ack-reminder emails deferred — in-app banner is
 * the only ack-reminder in MVP. Toggle still works and persists the flag.
 *
 * Tier 2 acceptance for this page (BO-only desktop-primary): target-scope value
 * pickers use a comma-separated input for MVP; elaborate multi-selects are
 * out of scope.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  History,
  Info,
  Loader2,
  Megaphone,
  Repeat,
  Save,
  Send,
  Trash2,
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
  type StatusToken,
} from '@/components/shell'
import RequirePermission from '@/lib/RequirePermission'
import {
  useSentBroadcasts,
  useBroadcast,
  useBroadcastAcks,
  useComposeBroadcast,
  useUpdateBroadcast,
  useSendBroadcast,
  useCancelBroadcast,
  type BroadcastAnnouncement,
  type BroadcastUrgency,
  type BroadcastStatus,
  type BroadcastTargetScope,
} from '@/hooks/useBroadcasts'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Enum labels + status token map
// ---------------------------------------------------------------------------

const URGENCY_LABEL: Record<BroadcastUrgency, string> = {
  info: 'Info',
  important: 'Important',
  critical: 'Critical',
}

const STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
  cancelled: 'Cancelled',
}

const STATUS_TOKEN: Record<BroadcastStatus, StatusToken> = {
  draft: 'status_draft',
  scheduled: 'status_pending_approval',
  sent: 'status_completed',
  cancelled: 'status_cancelled',
}

// ---------------------------------------------------------------------------
// Urgency visuals — DESIGN.md §5.1.x tokens (no `bg-info`/`bg-warning`/`bg-error`)
// ---------------------------------------------------------------------------

interface UrgencyVisuals {
  readonly bannerClass: string
  readonly icon: typeof Info
}

const URGENCY_VISUALS: Record<BroadcastUrgency, UrgencyVisuals> = {
  info: {
    bannerClass: 'bg-surface-container-high text-on-surface',
    icon: Info,
  },
  important: {
    bannerClass: 'bg-tertiary-container text-on-tertiary-container',
    icon: AlertTriangle,
  },
  critical: {
    bannerClass: 'bg-error-container text-on-error-container',
    icon: AlertTriangle,
  },
}

// ---------------------------------------------------------------------------
// Target-scope summariser (used in history rows)
// ---------------------------------------------------------------------------

function summariseScope(scope: BroadcastTargetScope): string {
  switch (scope.scope) {
    case 'brand':
      return 'Entire brand'
    case 'cluster_ids':
      return scope.values.length === 1
        ? `1 cluster`
        : `${scope.values.length} clusters`
    case 'location_ids':
      return scope.values.length === 1
        ? `1 location`
        : `${scope.values.length} locations`
    case 'role_keys':
      return scope.values.length === 1
        ? scope.values[0] ?? `1 role`
        : `${scope.values.length} roles`
  }
}

// ---------------------------------------------------------------------------
// UrgencyChip — inline chip for urgency in history rows
// ---------------------------------------------------------------------------

function UrgencyChip({ urgency }: { readonly urgency: BroadcastUrgency }) {
  const v = URGENCY_VISUALS[urgency]
  const Icon = v.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold',
        v.bannerClass,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {URGENCY_LABEL[urgency]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Zod form schema + inferred type
// ---------------------------------------------------------------------------

type TargetScopeKind = 'brand' | 'cluster_ids' | 'location_ids' | 'role_keys'

const SCOPE_KINDS: TargetScopeKind[] = ['brand', 'cluster_ids', 'location_ids', 'role_keys']
const SCOPE_LABEL: Record<TargetScopeKind, string> = {
  brand: 'Entire brand',
  cluster_ids: 'Specific clusters',
  location_ids: 'Specific locations',
  role_keys: 'Specific roles',
}

const composerSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  body: z.string().min(10, 'Body must be at least 10 characters'),
  urgency: z.enum(['info', 'important', 'critical'] as const),
  targetScopeKind: z.enum(['brand', 'cluster_ids', 'location_ids', 'role_keys'] as const),
  // Comma-separated values for non-brand scopes (MVP shortcut; Tier 2)
  targetScopeValues: z.string(),
  scheduledFor: z.string(),
  ackRequired: z.boolean(),
})

type ComposerFormValues = z.infer<typeof composerSchema>

const DEFAULT_VALUES: ComposerFormValues = {
  title: '',
  body: '',
  urgency: 'info',
  targetScopeKind: 'brand',
  targetScopeValues: '',
  scheduledFor: '',
  ackRequired: false,
}

// Build BroadcastTargetScope from form values
function buildTargetScope(
  kind: TargetScopeKind,
  rawValues: string,
): BroadcastTargetScope {
  if (kind === 'brand') return { scope: 'brand' }
  const values = rawValues
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (kind === 'cluster_ids') return { scope: 'cluster_ids', values }
  if (kind === 'location_ids') return { scope: 'location_ids', values }
  return { scope: 'role_keys', values }
}

// Pre-fill form from an existing broadcast (load-into-composer or re-broadcast)
function broadcastToFormValues(b: BroadcastAnnouncement): ComposerFormValues {
  const scope = b.targetScope
  const kind: TargetScopeKind = scope.scope
  const valuesStr =
    scope.scope !== 'brand' ? scope.values.join(', ') : ''
  return {
    title: b.title,
    body: b.body,
    urgency: b.urgency,
    targetScopeKind: kind,
    targetScopeValues: valuesStr,
    scheduledFor: b.scheduledFor ? b.scheduledFor.slice(0, 16) : '',
    ackRequired: b.ackRequired,
  }
}

// ---------------------------------------------------------------------------
// Editing-mode taxonomy
// ---------------------------------------------------------------------------

type EditingMode =
  | { kind: 'new-draft' }
  | { kind: 'editing-draft'; broadcastId: string }
  | { kind: 'editing-scheduled'; broadcastId: string }
  | { kind: 'sent-readonly'; broadcastId: string }

// ---------------------------------------------------------------------------
// Inline markdown renderer (lightweight — bold, italic, bullets, links)
// ---------------------------------------------------------------------------

function renderInline(line: string, lineKey: string): React.ReactNode {
  const tokens: Array<React.ReactNode> = []
  let cursor = 0
  let segCounter = 0
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    if (match.index > cursor) tokens.push(line.slice(cursor, match.index))
    if (match[2] !== undefined) {
      tokens.push(
        <strong key={`${lineKey}-s-${segCounter++}`} className="font-semibold">
          {match[2]}
        </strong>,
      )
    } else if (match[3] !== undefined) {
      tokens.push(
        <em key={`${lineKey}-i-${segCounter++}`} className="italic">
          {match[3]}
        </em>,
      )
    } else if (match[4] !== undefined && match[5] !== undefined) {
      tokens.push(
        <a
          key={`${lineKey}-l-${segCounter++}`}
          href={match[5]}
          className="text-primary underline"
        >
          {match[4]}
        </a>,
      )
    }
    cursor = re.lastIndex
  }
  if (cursor < line.length) tokens.push(line.slice(cursor))
  return tokens
}

function Markdown({ text }: { readonly text: string }) {
  const blocks = useMemo(() => {
    const lines = text.split('\n')
    const out: Array<{ kind: 'p' | 'ul' | 'blank'; lines: string[]; key: string }> = []
    let i = 0
    let blockId = 0
    while (i < lines.length) {
      const ln = lines[i] ?? ''
      if (ln.trim() === '') {
        out.push({ kind: 'blank', lines: [], key: `b-${blockId++}` })
        i += 1
        continue
      }
      if (ln.trimStart().startsWith('- ')) {
        const items: string[] = []
        while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('- ')) {
          items.push((lines[i] ?? '').trimStart().slice(2))
          i += 1
        }
        out.push({ kind: 'ul', lines: items, key: `b-${blockId++}` })
        continue
      }
      const paraLines: string[] = []
      while (
        i < lines.length &&
        (lines[i] ?? '').trim() !== '' &&
        !(lines[i] ?? '').trimStart().startsWith('- ')
      ) {
        paraLines.push(lines[i] ?? '')
        i += 1
      }
      out.push({ kind: 'p', lines: paraLines, key: `b-${blockId++}` })
    }
    return out
  }, [text])

  return (
    <div className="flex flex-col gap-3 text-sm text-on-surface">
      {blocks.map((b) => {
        if (b.kind === 'blank') return null
        if (b.kind === 'ul') {
          return (
            <ul key={b.key} className="list-disc pl-5 flex flex-col gap-1">
              {b.lines.map((item, idx) => (
                <li key={`${b.key}-li-${idx}`}>
                  {renderInline(item, `${b.key}-li-${idx}`)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={b.key} className="leading-relaxed">
            {b.lines.map((ln, idx) => (
              <span key={`${b.key}-ln-${idx}`}>
                {renderInline(ln, `${b.key}-ln-${idx}`)}
                {idx < b.lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecipientPreview — shows how the banner looks to recipients
// ---------------------------------------------------------------------------

interface RecipientPreviewProps {
  readonly values: ComposerFormValues
}

function RecipientPreview({ values }: RecipientPreviewProps) {
  const v = URGENCY_VISUALS[values.urgency]
  const Icon = v.icon
  const titleText = values.title.trim() || 'Untitled broadcast'
  const bodyText = values.body.trim()

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('rounded-md p-4', v.bannerClass)}>
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {URGENCY_LABEL[values.urgency]}
              </span>
              <span className="text-[10px] opacity-80">· from Brand Owner</span>
            </div>
            <h3 className="text-base font-semibold leading-tight">{titleText}</h3>
            {bodyText ? (
              <div className="rounded-sm p-3 bg-surface-container-lowest text-on-surface">
                <Markdown text={bodyText} />
              </div>
            ) : (
              <p className="text-xs italic opacity-80">Body preview will appear here.</p>
            )}
            {values.ackRequired ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-medium bg-surface-container-lowest text-on-surface"
                  aria-label="Preview only — recipients click to acknowledge"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Acknowledge
                </span>
                <span className="text-[10px] opacity-80">
                  Banner persists until acknowledged.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-sm bg-surface-container-low px-3 py-2">
        <p className="text-[11px] text-on-surface-variant">
          {values.scheduledFor === ''
            ? 'Sends immediately on dispatch.'
            : `Scheduled for ${values.scheduledFor.replace('T', ' ')}.`}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel popover — prompts for a reason code before cancelling a draft/scheduled
// ---------------------------------------------------------------------------

interface CancelPopoverProps {
  readonly broadcastId: string
  readonly onCancelled: () => void
}

function CancelPopover({ broadcastId, onCancelled }: CancelPopoverProps) {
  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState('')
  const cancel = useCancelBroadcast()

  const handleCancel = () => {
    if (reasonCode.trim().length < 10) return
    cancel.mutate(
      { broadcastId, reasonCode: reasonCode.trim() },
      {
        onSuccess: () => {
          setOpen(false)
          setReasonCode('')
          onCancelled()
        },
      },
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="default" aria-label="Cancel scheduled broadcast">
          <Ban className="h-4 w-4" aria-hidden />
          Cancel scheduled…
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 flex flex-col gap-3">
        <p className="text-sm font-semibold text-on-surface">Cancel broadcast</p>
        <p className="text-xs text-on-surface-variant">
          Provide a reason (≥ 10 chars). This is appended to the audit trail.
        </p>
        <textarea
          rows={3}
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          placeholder="Reason for cancellation…"
          className="rounded-sm bg-surface-container-highest p-2 text-sm text-on-surface resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <p
          className={cn(
            'text-[11px]',
            reasonCode.trim().length < 10 ? 'text-error' : 'text-on-surface-variant',
          )}
        >
          {reasonCode.trim().length}/10 min characters
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setOpen(false); setReasonCode('') }}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={reasonCode.trim().length < 10 || cancel.isPending}
            onClick={handleCancel}
          >
            {cancel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Cancel broadcast
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// AckRoster — drill-down for ack details on an expanded history row
// ---------------------------------------------------------------------------

interface AckRosterProps {
  readonly broadcastId: string
}

function AckRoster({ broadcastId }: AckRosterProps) {
  const { data, isLoading } = useBroadcastAcks(broadcastId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading acknowledgements…
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="rounded-sm bg-surface-container-low p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Acknowledgements · {data.ackCount}/{data.ackCount + data.pendingCount} acked
      </p>
      {data.acks.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {data.acks.map((a) => (
            <li
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-mono text-[11px] text-on-surface-variant">{a.userId.slice(0, 8)}…</span>
              </span>
              <span className="tabular-nums text-on-surface-variant">
                {a.acknowledgedAt.replace('T', ' ').slice(0, 16)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs italic text-on-surface-variant">
          No acknowledgements yet.
        </p>
      )}
      {data.pendingCount > 0 ? (
        <p className="mt-2 text-[11px] text-on-surface-variant">
          {data.pendingCount} recipient{data.pendingCount !== 1 ? 's' : ''} pending.
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HistoryDrillDown — expanded row detail panel
// ---------------------------------------------------------------------------

interface HistoryDrillDownProps {
  readonly row: BroadcastAnnouncement
  readonly onLoadIntoComposer: (row: BroadcastAnnouncement) => void
  readonly onRebroadcast: (row: BroadcastAnnouncement) => void
}

function HistoryDrillDown({ row, onLoadIntoComposer, onRebroadcast }: HistoryDrillDownProps) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 tablet:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Status
          </dt>
          <dd className="mt-0.5">
            <StatusPill
              status={STATUS_TOKEN[row.status]}
              size="sm"
              label={STATUS_LABEL[row.status]}
            />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Urgency
          </dt>
          <dd className="mt-0.5">
            <UrgencyChip urgency={row.urgency} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Target scope
          </dt>
          <dd className="mt-0.5 text-on-surface">{summariseScope(row.targetScope)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scheduled
          </dt>
          <dd className="mt-0.5 text-on-surface tabular-nums">
            {row.scheduledFor ? row.scheduledFor.replace('T', ' ').slice(0, 16) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Sent
          </dt>
          <dd className="mt-0.5 text-on-surface tabular-nums">
            {row.sentAt ? row.sentAt.replace('T', ' ').slice(0, 16) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Ack required
          </dt>
          <dd className="mt-0.5 text-on-surface">{row.ackRequired ? 'Yes' : 'No'}</dd>
        </div>
      </dl>

      {row.ackRequired ? (
        <AckRoster broadcastId={row.id} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onLoadIntoComposer(row)}
          aria-label="Load this broadcast into the composer"
        >
          Load into composer
        </Button>
        {row.status === 'sent' ? (
          <Button
            type="button"
            variant="tonal"
            size="sm"
            onClick={() => onRebroadcast(row)}
            aria-label="Re-broadcast — pre-fills new draft (CC-PREFILL)"
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden />
            Re-broadcast
          </Button>
        ) : null}
        <Link
          to={`/audit?entityType=broadcast_announcements&entityRef=${encodeURIComponent(row.id)}`}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <History className="h-3 w-3" aria-hidden />
          Audit history
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function BroadcastsPage() {
  // Form state
  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<ComposerFormValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const watchedValues = watch()

  // Editing mode
  const [mode, setMode] = useState<EditingMode>({ kind: 'new-draft' })
  const [savedBroadcastId, setSavedBroadcastId] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Mutations
  const compose = useComposeBroadcast()
  const update = useUpdateBroadcast()
  const send = useSendBroadcast()
  const cancel = useCancelBroadcast()

  // History query
  const { data: sentData, isLoading: historyLoading } = useSentBroadcasts()
  const historyItems = sentData?.items ?? []

  // Current broadcast detail (for editing a selected draft)
  const selectedId =
    mode.kind === 'editing-draft' || mode.kind === 'editing-scheduled' || mode.kind === 'sent-readonly'
      ? mode.broadcastId
      : undefined
  const { data: selectedBroadcast } = useBroadcast(selectedId)

  const isReadOnly = mode.kind === 'sent-readonly'

  const handleNewDraft = () => {
    reset(DEFAULT_VALUES)
    setMode({ kind: 'new-draft' })
    setSavedBroadcastId(null)
    setSubmitSuccess(false)
  }

  const handleLoadIntoComposer = (row: BroadcastAnnouncement) => {
    reset(broadcastToFormValues(row))
    setSubmitSuccess(false)
    if (row.status === 'draft') {
      setMode({ kind: 'editing-draft', broadcastId: row.id })
      setSavedBroadcastId(row.id)
    } else if (row.status === 'scheduled') {
      setMode({ kind: 'editing-scheduled', broadcastId: row.id })
      setSavedBroadcastId(row.id)
    } else if (row.status === 'sent') {
      setMode({ kind: 'sent-readonly', broadcastId: row.id })
      setSavedBroadcastId(row.id)
    } else {
      setMode({ kind: 'new-draft' })
    }
  }

  const handleRebroadcast = (row: BroadcastAnnouncement) => {
    const vals = broadcastToFormValues(row)
    reset({ ...vals, scheduledFor: '' }) // strip scheduled-for for new draft
    setMode({ kind: 'new-draft' })
    setSavedBroadcastId(null)
    setSubmitSuccess(false)
  }

  // Save draft (compose new OR update existing draft)
  const handleSaveDraft = handleSubmit(async (values) => {
    const targetScope = buildTargetScope(values.targetScopeKind, values.targetScopeValues)
    if (mode.kind === 'new-draft' || !savedBroadcastId) {
      compose.mutate(
        {
          title: values.title,
          body: values.body,
          urgency: values.urgency,
          targetScope,
          scheduledFor: values.scheduledFor || null,
          ackRequired: values.ackRequired,
        },
        {
          onSuccess: (data) => {
            setSavedBroadcastId(data.id)
            setMode({ kind: 'editing-draft', broadcastId: data.id })
            setSubmitSuccess(true)
            reset(broadcastToFormValues(data), { keepDirty: false })
          },
        },
      )
    } else {
      update.mutate(
        {
          broadcastId: savedBroadcastId,
          title: values.title,
          body: values.body,
          urgency: values.urgency,
          targetScope,
          scheduledFor: values.scheduledFor || null,
          ackRequired: values.ackRequired,
        },
        {
          onSuccess: (data) => {
            setSubmitSuccess(true)
            reset(broadcastToFormValues(data), { keepDirty: false })
          },
        },
      )
    }
  })

  // Send now — requires a saved draft ID
  const handleSendNow = () => {
    if (!savedBroadcastId) return
    send.mutate(
      { broadcastId: savedBroadcastId },
      {
        onSuccess: () => {
          setMode({ kind: 'sent-readonly', broadcastId: savedBroadcastId })
          setSubmitSuccess(true)
        },
      },
    )
  }

  const isMutating =
    compose.isPending || update.isPending || send.isPending || cancel.isPending

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Back-link */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/" aria-label="Back to home">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Home
            </Link>
          </Button>
        </div>

        {/* Title row */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Communications
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Megaphone className="h-7 w-7 text-on-surface-variant" aria-hidden />
              <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                Broadcasts
              </h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Compose a brand-wide announcement or target a specific cluster, location set, or role
              set. Schedule the delivery or send immediately. Acknowledgement-required broadcasts
              surface a persistent in-app banner until each recipient acknowledges.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/audit?entityType=broadcast_announcements"
              className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Audit history for broadcasts"
            >
              <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-medium uppercase tracking-wider text-[11px]">Audit history</span>
            </Link>
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {submitSuccess && mode.kind !== 'new-draft' ? (
              <StatusPill status="status_confirmed" size="sm" label="Saved" />
            ) : null}
            {mode.kind === 'sent-readonly' ? (
              <StatusPill status="status_completed" size="sm" label="Sent — read-only" />
            ) : null}
            {mode.kind === 'editing-scheduled' ? (
              <StatusPill status="status_pending_approval" size="sm" label="Scheduled" />
            ) : null}
          </div>
        </header>

        {/* DL-035 note */}
        <div
          role="note"
          className="mt-4 flex items-start gap-2 rounded-sm bg-surface-container-low px-3 py-2"
        >
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
          <p className="text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">DL-035 note.</span>{' '}
            Cross-channel ack-reminder emails are deferred — the in-app banner is the only ack
            reminder in MVP. The &ldquo;acknowledgement-required&rdquo; toggle still works.
          </p>
        </div>

        {/* Composer — BO-only (RequirePermission inf.broadcast.compose) */}
        <RequirePermission permission="inf.broadcast.compose">
          <form
            onSubmit={(e) => { e.preventDefault() }}
            className="mt-6"
            noValidate
          >
            <div className="grid grid-cols-1 desktop:grid-cols-[3fr_2fr] gap-6">
              {/* Composer (left) */}
              <Card className="p-0">
                <CardHeader className="p-4 tablet:p-6 pb-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Composer
                  </p>
                  <CardTitle className="mt-1 text-base text-on-surface">
                    {mode.kind === 'sent-readonly'
                      ? 'Sent broadcast — read-only'
                      : mode.kind === 'editing-scheduled'
                        ? 'Editing scheduled broadcast'
                        : mode.kind === 'editing-draft'
                          ? 'Editing draft'
                          : 'New broadcast'}
                  </CardTitle>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Title and body are mandatory. Body supports basic markdown — bold, italics,
                    bullets, and links.
                  </p>
                </CardHeader>

                <CardContent className="p-4 tablet:p-6 pt-2">
                  <fieldset
                    disabled={isReadOnly}
                    className="flex flex-col gap-4 disabled:opacity-60"
                  >
                    {/* Title */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="bc-title" className="text-xs font-medium text-on-surface">
                        Title
                        <span className="text-error ml-0.5" aria-hidden>*</span>
                      </label>
                      <Input
                        id="bc-title"
                        placeholder="Concise headline"
                        aria-invalid={!!errors.title}
                        {...register('title')}
                      />
                      {errors.title ? (
                        <p className="text-xs text-error">{errors.title.message}</p>
                      ) : null}
                    </div>

                    {/* Body */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="bc-body" className="text-xs font-medium text-on-surface">
                        Body
                        <span className="text-error ml-0.5" aria-hidden>*</span>
                      </label>
                      <textarea
                        id="bc-body"
                        rows={8}
                        placeholder="Body text. **Bold**, *italics*, leading '- ' for bullets, [label](url) for links."
                        aria-invalid={!!errors.body}
                        className={cn(
                          'rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface resize-y',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          errors.body ? 'aria-invalid:ring-2 aria-invalid:ring-error' : '',
                        )}
                        {...register('body')}
                      />
                      {errors.body ? (
                        <p className="text-xs text-error">{errors.body.message}</p>
                      ) : null}
                    </div>

                    {/* Urgency */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-on-surface">Urgency</span>
                      <Controller
                        name="urgency"
                        control={control}
                        render={({ field }) => (
                          <div
                            role="radiogroup"
                            aria-label="Urgency"
                            className="inline-flex flex-wrap items-center gap-2"
                          >
                            {(['info', 'important', 'critical'] as const).map((u) => {
                              const active = field.value === u
                              const v = URGENCY_VISUALS[u]
                              const Icon = v.icon
                              return (
                                <button
                                  key={u}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => field.onChange(u)}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-pill px-3 h-9 text-xs font-medium',
                                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    active
                                      ? v.bannerClass
                                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high',
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden />
                                  {URGENCY_LABEL[u]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      />
                    </div>

                    {/* Target scope */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-on-surface">
                        Target scope
                        <span className="text-error ml-0.5" aria-hidden>*</span>
                      </span>
                      <Controller
                        name="targetScopeKind"
                        control={control}
                        render={({ field }) => (
                          <div
                            role="radiogroup"
                            aria-label="Target scope kind"
                            className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-container-low p-1 self-start"
                          >
                            {SCOPE_KINDS.map((kind) => {
                              const active = field.value === kind
                              return (
                                <button
                                  key={kind}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => field.onChange(kind)}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-pill px-3 h-8 text-[11px] font-medium',
                                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    active
                                      ? 'bg-primary text-on-primary'
                                      : 'text-on-surface hover:bg-surface-container-high',
                                  )}
                                >
                                  {SCOPE_LABEL[kind]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      />
                      {watchedValues.targetScopeKind !== 'brand' ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            placeholder={
                              watchedValues.targetScopeKind === 'role_keys'
                                ? 'Comma-separated role keys, e.g. pos_manager, accountant'
                                : 'Comma-separated UUIDs'
                            }
                            aria-label="Target scope values (comma-separated)"
                            {...register('targetScopeValues')}
                          />
                          <p className="text-[11px] text-on-surface-variant">
                            MVP: comma-separated values. Multi-select picker in a future release.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-on-surface-variant">
                          Fans out to every active user in the brand.
                        </p>
                      )}
                    </div>

                    {/* Scheduled-for + Ack-required */}
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="bc-scheduled-for"
                          className="text-xs font-medium text-on-surface"
                        >
                          Scheduled for
                        </label>
                        <input
                          id="bc-scheduled-for"
                          type="datetime-local"
                          className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          {...register('scheduledFor')}
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Empty = send immediately on dispatch.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-on-surface">Acknowledgement</span>
                        <label
                          htmlFor="bc-ack-required"
                          className="flex items-center gap-2 rounded-sm bg-surface-container-low px-3 h-11 cursor-pointer focus-within:ring-2 focus-within:ring-primary"
                        >
                          <input
                            id="bc-ack-required"
                            type="checkbox"
                            className="h-4 w-4 rounded-sm accent-primary"
                            {...register('ackRequired')}
                          />
                          <span className="text-sm text-on-surface">Require acknowledgement</span>
                        </label>
                        <span className="text-[11px] text-on-surface-variant">
                          Recipients see a persistent banner that blocks dismissal until
                          acknowledged.
                        </span>
                      </div>
                    </div>
                  </fieldset>
                </CardContent>
              </Card>

              {/* Preview pane (right) */}
              <Card className="p-0">
                <CardHeader className="p-4 tablet:p-6 pb-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Preview
                  </p>
                  <CardTitle className="mt-1 text-base text-on-surface">
                    As recipients will see it
                  </CardTitle>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Renders the in-app banner exactly as recipients will see it.
                  </p>
                </CardHeader>
                <CardContent className="p-4 tablet:p-6 pt-2">
                  <RecipientPreview values={watchedValues} />
                </CardContent>
              </Card>
            </div>

            {/* Action strip */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
                <Repeat className="h-3 w-3" aria-hidden />
                {mode.kind === 'new-draft'
                  ? 'New broadcast — Save draft, Schedule, or Send now.'
                  : mode.kind === 'editing-draft'
                    ? 'Editing draft — pick up where you left off.'
                    : mode.kind === 'editing-scheduled'
                      ? 'Editing scheduled — cancel or edit before send time.'
                      : 'Sent — read-only. Use Re-broadcast to copy into a new draft.'}
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {(mode.kind === 'new-draft' || mode.kind === 'editing-draft') ? (
                  <>
                    {mode.kind === 'editing-draft' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="default"
                        onClick={handleNewDraft}
                        aria-label="Discard draft and start new"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Discard draft
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="default"
                      disabled={isMutating}
                      aria-label="Save as draft"
                      onClick={() => { void handleSaveDraft() }}
                    >
                      {compose.isPending || update.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Save className="h-4 w-4" aria-hidden />
                      )}
                      Save draft
                    </Button>
                    <Button
                      type="button"
                      variant="tonal"
                      size="default"
                      disabled={!savedBroadcastId || !watchedValues.scheduledFor || isMutating}
                      aria-label="Schedule broadcast"
                      onClick={() => { void handleSaveDraft() }}
                    >
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      Schedule
                    </Button>
                    <Button
                      type="button"
                      size="default"
                      disabled={!savedBroadcastId || isMutating}
                      aria-label="Send now"
                      onClick={handleSendNow}
                    >
                      {send.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden />
                      )}
                      Send now
                    </Button>
                  </>
                ) : null}

                {mode.kind === 'editing-scheduled' ? (
                  <>
                    <CancelPopover
                      broadcastId={mode.broadcastId}
                      onCancelled={handleNewDraft}
                    />
                    <Button
                      type="button"
                      variant="tonal"
                      size="default"
                      disabled={isMutating}
                      onClick={() => { void handleSaveDraft() }}
                      aria-label="Update before scheduled send"
                    >
                      <Save className="h-4 w-4" aria-hidden />
                      Update before send
                    </Button>
                  </>
                ) : null}

                {mode.kind === 'sent-readonly' ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="default"
                      onClick={handleNewDraft}
                      aria-label="Start new broadcast"
                    >
                      <Megaphone className="h-4 w-4" aria-hidden />
                      New broadcast
                    </Button>
                    {selectedBroadcast ? (
                      <Button
                        type="button"
                        variant="tonal"
                        size="default"
                        onClick={() => handleRebroadcast(selectedBroadcast)}
                        aria-label="Re-broadcast — pre-fills new draft (CC-PREFILL)"
                      >
                        <Repeat className="h-4 w-4" aria-hidden />
                        Re-broadcast
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </form>
        </RequirePermission>

        {/* When compose permission is missing, show read-only note */}
        <RequirePermission
          permission="inf.broadcast.compose"
          fallback={
            <div
              role="note"
              className="mt-6 flex items-start gap-2 rounded-sm bg-surface-container-low px-3 py-2"
            >
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
              <p className="text-xs text-on-surface-variant">
                You have read access to broadcasts. The composer is available to Brand Owners with{' '}
                <span className="font-mono">inf.broadcast.compose</span>.
              </p>
            </div>
          }
        >
          {null}
        </RequirePermission>

        <SectionShift tone="lowest" className="my-8" aria-hidden />

        {/* History list */}
        <section aria-label="Past broadcasts" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                History
              </p>
              <h2 className="text-lg font-semibold text-on-surface">Past broadcasts</h2>
            </div>
            <span className="text-[11px] text-on-surface-variant">
              {historyItems.length} broadcasts · click a row to expand
            </span>
          </div>

          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading broadcasts…
            </div>
          ) : historyItems.length === 0 ? (
            <div className="rounded-md bg-surface-container-low px-4 py-8 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-on-surface-variant opacity-40" aria-hidden />
              <p className="mt-2 text-sm text-on-surface-variant">No broadcasts yet.</p>
              <p className="text-xs text-on-surface-variant">
                Compose one above to reach your team.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {historyItems.map((row) => {
                const expanded = expandedRowId === row.id
                return (
                  <li key={row.id}>
                    <Card className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpandedRowId(expanded ? null : row.id)}
                        className={cn(
                          'w-full text-left p-4 tablet:p-5',
                          'flex flex-col gap-2',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          'hover:bg-surface-container-low transition-colors rounded-md',
                        )}
                        aria-expanded={expanded}
                        aria-controls={`history-detail-${row.id}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 text-on-surface-variant transition-transform',
                                expanded ? 'rotate-90' : '',
                              )}
                              aria-hidden
                            />
                            <h3 className="text-sm font-semibold text-on-surface truncate">
                              {row.title}
                            </h3>
                            <UrgencyChip urgency={row.urgency} />
                            <StatusPill
                              status={STATUS_TOKEN[row.status]}
                              size="sm"
                              label={STATUS_LABEL[row.status]}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant">
                            <span className="tabular-nums">
                              {row.sentAt
                                ? `Sent ${row.sentAt.replace('T', ' ').slice(0, 16)}`
                                : row.scheduledFor
                                  ? `Scheduled ${row.scheduledFor.replace('T', ' ').slice(0, 16)}`
                                  : 'Not scheduled'}
                            </span>
                            <span>·</span>
                            <span>{summariseScope(row.targetScope)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-on-surface-variant pl-6 line-clamp-2">
                          {row.body}
                        </p>
                      </button>

                      {expanded ? (
                        <div
                          id={`history-detail-${row.id}`}
                          className="px-4 tablet:px-5 pb-4 tablet:pb-5"
                        >
                          <SectionShift tone="lowest" className="mb-3" aria-hidden />
                          <HistoryDrillDown
                            row={row}
                            onLoadIntoComposer={handleLoadIntoComposer}
                            onRebroadcast={handleRebroadcast}
                          />
                        </div>
                      ) : null}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/audit?entityType=broadcast_announcements"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Broadcast change history (SI-INF-005 — filtered to broadcasts)
          </Link>
          {' · '}
          SI-INF-009 · Tier 2 (BO-only desktop-primary) · Phase 4 Epic 3 INF Arc (c)
        </footer>
      </div>
    </div>
  )
}
