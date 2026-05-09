import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  History,
  Save,
  Send,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CCFileAttachUploader,
  CCIssueCommentThread,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  type IssueAttachment,
  type IssueComment,
  type StatusToken,
} from '@/shell'

import { NOW } from '@/lib/sample-data'
import { personas } from '@/lib/personas'

/**
 * SI-INF-008 — Issue Ticket Create / Edit (Tier 1 hero).
 *
 * Phase 4 Epic 3 INF Arc (b) Task B3, Tier 1 hero acceptance per Phase 4
 * invariants. The full FR22 form: title + description + priority + status +
 * assignee + linked-entity + originator (read-only) + comments thread +
 * attachments + audit metadata.
 *
 * Layout (mirrors SI-USR-002 form-page back-link header pattern, per plan
 * §5 Task B3 step 4):
 *
 *   1. Back-link header strip ("← Tickets" → /SI-INF-007); title row with
 *      reference (read-only on edit; "(unsaved)" placeholder on create) +
 *      status pill + priority pill.
 *   2. Mode toggle (mockup-only) — `view/edit` (default) ⇄ `create`. The
 *      production code at Arc (c) C8a uses `/SI-INF-008` (create) and
 *      `/SI-INF-008/:id` (edit) as distinct entries; the mockup carries the
 *      toggle so reviewers see both surfaces without state-juggling.
 *   3. Section 1 — Header / metadata: title (mandatory), description
 *      (multi-line; supports inline image attachments per inventory line
 *      1369), priority select, status select, assignee picker, linked-entity
 *      picker (auto-prefilled from `?linkedEntityType=...&linkedEntityRef=...`
 *      query params per CC-PREFILL).
 *   4. Section 2 — Audit metadata: read-only originator, created-at,
 *      last-modified-at, last-modified-by.
 *   5. Section 3 — Comments thread (`<CCIssueCommentThread>`).
 *   6. Section 4 — Attachments (`<CCFileAttachUploader>`).
 *   7. Footer/action strip:
 *        - create-mode: "Save draft" + "Open ticket".
 *        - edit-mode:   "Save changes" + "Reassign" (sub-affordance,
 *          mandatory comment) + "Change status".
 *
 *   Resolved → Closed transition is gated to originator + Brand Owner per
 *   inventory line 1404 + business logic at the schema layer; the mockup
 *   surfaces a tooltip on the Closed option when not authorised, doesn't
 *   enforce.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface, surface_container_lowest,
 * surface_container_low, surface_container, surface_container_high,
 * surface_container_highest, on_surface, on_surface_variant,
 * status_draft, status_pending_approval (Open), status_in_progress,
 * status_waiting_info (Pending Info), status_completed (Resolved),
 * status_closed, error (Critical priority), warning / tertiary-container
 * (High priority), primary, on_primary, outline_variant, error-container,
 * on-error-container, tertiary-container, on-tertiary-container.
 *
 * Borders: only `focus-visible:` rings / `aria-invalid:` on inputs +
 * `border-l-4` from `<StatusPill>` pip-pattern. No sectioning borders.
 *
 * Animation: NONE per CLAUDE.md (data form). Tailwind transitions only.
 *
 * RBAC (deferred to Arc (c)):
 *   - Create: any role except `pos_staff` (POS staff raise via the
 *     CC-ISSUE-TICKET-LINK chip on bills, which routes here pre-filled).
 *   - Edit: originator, assignee, Cluster Manager (cluster scope), Brand
 *     Owner. Closed→Reopened is blocked at the service layer.
 *   - Mockup is open; Arc (c) Task C8a wraps the page in
 *     `<RequirePermission permission="inf.issue.write">`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical enum values from `apps/api/src/db/schema/issue-tickets.ts`
// ─────────────────────────────────────────────────────────────────────────────

type IssueStatus = 'open' | 'in_progress' | 'pending_info' | 'resolved' | 'closed'
type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_TOKEN: Record<IssueStatus, StatusToken> = {
  open: 'status_pending_approval',
  in_progress: 'status_in_progress',
  pending_info: 'status_waiting_info',
  resolved: 'status_completed',
  closed: 'status_closed',
}

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const LINKED_ENTITY_TYPE_LABEL: Record<string, string> = {
  po: 'Purchase Order',
  gr: 'Goods Receipt',
  challan: 'Challan',
  production_order: 'Production Order',
  requisition: 'Requisition',
  vendor: 'Vendor',
  bill: 'POS Bill',
  adjustment: 'Adjustment',
  b2b_customer: 'B2B Customer',
  other: 'Other',
}

// ─────────────────────────────────────────────────────────────────────────────
// Form-state shape
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  readonly title: string
  readonly description: string
  readonly priority: IssuePriority
  readonly status: IssueStatus
  readonly assigneeId: string
  readonly linkedEntityType: string
  readonly linkedEntityRef: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'open',
  assigneeId: '',
  linkedEntityType: '',
  linkedEntityRef: '',
}

const SAMPLE_FORM: FormState = {
  title: 'Vendor short-delivery — 18 kg of mutton vs 22 kg ordered',
  description:
    'PO PUR-2026-CKA-000287 — vendor delivered 18 kg of mutton against the 22 kg ordered line.\n\nQC at receiving flagged the variance; raising for cluster-level investigation and credit-note follow-up. Photo of the dispatch note attached.',
  priority: 'high',
  status: 'in_progress',
  assigneeId: 'cluster-mgr',
  linkedEntityType: 'po',
  linkedEntityRef: 'PUR-2026-CKA-000287',
}

const NOW_ISO = `${NOW}T11:14:00+05:30`
const SAMPLE_REFERENCE = 'ISS-2026-002'
const SAMPLE_CREATED_AT = '2026-05-07T08:42:00+05:30'
const SAMPLE_LAST_MODIFIED_AT = '2026-05-08T10:48:00+05:30'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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

interface PriorityChipProps {
  readonly priority: IssuePriority
}

function PriorityChip({ priority }: PriorityChipProps) {
  if (priority === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-error-container text-on-error-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Critical
      </span>
    )
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-tertiary-container text-on-tertiary-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        High
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high text-on-surface px-2 py-0.5 text-[11px] font-medium">
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

interface AssigneePickerProps {
  readonly value: string
  readonly onChange: (id: string) => void
}

function AssigneePicker({ value, onChange }: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = personas.find((p) => p.id === value)
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
            {selected ? `${selected.name} · ${selected.role}` : 'Pick an assignee'}
          </span>
          <ChevronDown
            className="h-4 w-4 text-on-surface-variant shrink-0"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[20rem] p-1 max-h-80 overflow-auto">
        <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Assignee
        </span>
        <ul className="flex flex-col">
          {personas.map((p) => {
            const active = p.id === value
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id)
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
                  <span className="text-sm text-on-surface">{p.name}</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {p.role} · {p.scopeLabel}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample fixtures (edit-mode comments + attachments)
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_COMMENTS: ReadonlyArray<IssueComment> = [
  {
    id: 'cm-101',
    authorUserId: 'user-store-bandra',
    authorLabel: 'Arjun Reddy',
    authorRoleLabel: 'Store Manager',
    body: 'Vendor delivered 18 kg of mutton vs the 22 kg ordered. Filed as a quantity-mismatch GR rejection at receiving.',
    createdAt: '2026-05-07T14:10:00+05:30',
  },
  {
    id: 'cm-102',
    authorUserId: 'user-cm-bandra',
    authorLabel: 'Rohan Mehta',
    authorRoleLabel: 'Cluster Manager',
    body: 'Acknowledged. Reaching out to the vendor desk now — will post the credit note reference once issued.',
    createdAt: '2026-05-07T15:25:00+05:30',
  },
  {
    id: 'cm-103',
    authorUserId: 'user-bo',
    authorLabel: 'Aanya Khanna',
    authorRoleLabel: 'Brand Owner',
    body: 'Escalation note: this is the third short-delivery from this vendor in the last 60 days. Tag the vendor master with a watch flag please.',
    createdAt: '2026-05-08T09:02:00+05:30',
  },
  {
    id: 'cm-104',
    authorUserId: 'user-cm-bandra',
    authorLabel: 'Rohan Mehta',
    authorRoleLabel: 'Cluster Manager',
    body: 'Credit note CN-2026-WST-0118 issued. Vendor flagged for review at the next preferred-vendor cycle.',
    createdAt: '2026-05-08T10:48:00+05:30',
  },
]

const INITIAL_ATTACHMENTS: ReadonlyArray<IssueAttachment> = [
  {
    id: 'att-001',
    filename: 'gr-rejection-evidence.png',
    mimeType: 'image/png',
    sizeBytes: 820 * 1024,
    uploadedAt: '2026-05-07T14:18:00+05:30',
    uploadedByLabel: 'Arjun Reddy',
    state: 'uploaded',
    downloadUrl: '#',
  },
  {
    id: 'att-002',
    filename: 'CN-2026-WST-0118.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 230 * 1024,
    uploadedAt: '2026-05-08T10:51:00+05:30',
    uploadedByLabel: 'Rohan Mehta',
    state: 'uploaded',
    downloadUrl: '#',
  },
  {
    id: 'att-003',
    filename: 'vendor-followup-call.txt',
    mimeType: 'text/plain',
    sizeBytes: 4 * 1024,
    uploadedAt: '2026-05-08T11:02:00+05:30',
    uploadedByLabel: 'Rohan Mehta',
    state: 'uploading',
    uploadProgressPct: 64,
  },
  {
    id: 'att-004',
    filename: 'archive-snapshot.zip',
    mimeType: 'application/zip',
    sizeBytes: 18 * 1024 * 1024,
    uploadedAt: '2026-05-08T11:13:00+05:30',
    uploadedByLabel: 'Rohan Mehta',
    state: 'error',
    errorMessage:
      'File exceeds the 10 MB per-attachment ceiling. Trim or split before retrying.',
  },
]

const ACCEPTED_MIME_TYPES: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
]
const MAX_BYTES = 10 * 1024 * 1024

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'view-edit' | 'create'

export default function SiInf008() {
  const [searchParams] = useSearchParams()
  const prefilledType = searchParams.get('linkedEntityType') ?? ''
  const prefilledRef = searchParams.get('linkedEntityRef') ?? ''
  const ticketRef = searchParams.get('ticket') ?? SAMPLE_REFERENCE

  const initialForm: FormState = useMemo(() => {
    if (prefilledType || prefilledRef) {
      return {
        ...EMPTY_FORM,
        linkedEntityType: prefilledType,
        linkedEntityRef: prefilledRef,
      }
    }
    return SAMPLE_FORM
  }, [prefilledType, prefilledRef])

  const [mode, setMode] = useState<Mode>(
    prefilledType || prefilledRef ? 'create' : 'view-edit',
  )
  const [form, setForm] = useState<FormState>(initialForm)
  const [isDirty, setIsDirty] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [comments, setComments] =
    useState<ReadonlyArray<IssueComment>>(INITIAL_COMMENTS)
  const [composerValue, setComposerValue] = useState('')
  const [attachments, setAttachments] =
    useState<ReadonlyArray<IssueAttachment>>(INITIAL_ATTACHMENTS)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
    setSubmitted(false)
  }

  const handleModeSwitch = (next: Mode) => {
    setMode(next)
    setForm(next === 'create' ? EMPTY_FORM : SAMPLE_FORM)
    setComments(next === 'create' ? [] : INITIAL_COMMENTS)
    setAttachments(next === 'create' ? [] : INITIAL_ATTACHMENTS)
    setComposerValue('')
    setIsDirty(false)
    setSubmitted(false)
  }

  const titleOk = form.title.trim().length > 0
  const descOk = form.description.trim().length > 0
  const canSubmit = titleOk && descOk && form.assigneeId !== ''

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitted(true)
    setIsDirty(false)
  }

  const handleAddComment = () => {
    const trimmed = composerValue.trim()
    if (trimmed.length === 0) return
    const next: IssueComment = {
      id: `cm-${Date.now()}`,
      authorUserId: 'persona-current',
      authorLabel: 'Aanya Khanna',
      authorRoleLabel: 'Brand Owner',
      body: trimmed,
      createdAt: new Date().toISOString(),
    }
    setComments((prev) => [...prev, next])
    setComposerValue('')
    setIsDirty(true)
  }

  const handlePickFile = () => {
    /* mockup-only — Arc (c) wires Express signed-URL flow per DL-017. */
  }
  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    setIsDirty(true)
  }
  const handleRetryAttachment = (id: string) => {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, state: 'uploading', uploadProgressPct: 12, errorMessage: undefined }
          : a,
      ),
    )
  }

  const isClosedAuthorised = mode === 'view-edit' // Originator + BO check —
  // mockup permits when in edit mode for the sample ticket; production
  // checks `inf.issue.close` at the service layer.

  const headerStatus = form.status
  const reference = mode === 'create' ? null : ticketRef

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1080px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Back-link header */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/SI-INF-007" aria-label="Back to issue tickets">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tickets
            </Link>
          </Button>
        </div>

        {/* Title row */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Issue Tracker · {mode === 'create' ? 'New ticket' : 'Edit ticket'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                {mode === 'create'
                  ? 'New issue ticket'
                  : (form.title || 'Untitled')}
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
            <PriorityChip priority={form.priority} />
            <StatusPill
              status={STATUS_TOKEN[headerStatus]}
              label={STATUS_LABEL[headerStatus]}
              size="sm"
            />
            {submitted ? (
              <StatusPill
                status="status_confirmed"
                size="sm"
                label="Saved"
              />
            ) : null}
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
              { value: 'view-edit', label: 'View / edit (sample ticket)' },
              { value: 'create', label: 'Create mode' },
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
          {/* ── Section 1 — Header / metadata ─────────────────────────── */}
          <FormSection
            index={1}
            title="Ticket details"
            subtitle="Title and description are mandatory. Pick a priority + status; assign to a teammate. Linked entity is optional and pre-fills when the ticket is raised from an entity-detail screen via CC-ISSUE-TICKET-LINK."
          >
            <div className="flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ticket-title"
                  className="text-xs font-medium text-on-surface"
                >
                  Title
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <Input
                  id="ticket-title"
                  placeholder="A concise summary — e.g. Vendor short-delivery on PO PUR-2026-CKA-000287"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ticket-description"
                  className="text-xs font-medium text-on-surface"
                >
                  Description
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <textarea
                  id="ticket-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Describe what is wrong, what was expected, and any reproduction steps. Inline image attachments are supported via the Attachments section below."
                  className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span className="text-[11px] text-on-surface-variant">
                  Markdown is rendered as plain text in the mockup.
                </span>
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
                    value={form.priority}
                    onChange={(e) =>
                      update('priority', e.target.value as IssuePriority)
                    }
                    className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ticket-status"
                    className="text-xs font-medium text-on-surface"
                  >
                    Status
                  </label>
                  <select
                    id="ticket-status"
                    value={form.status}
                    onChange={(e) =>
                      update('status', e.target.value as IssueStatus)
                    }
                    className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {(
                      [
                        'open',
                        'in_progress',
                        'pending_info',
                        'resolved',
                        'closed',
                      ] as const
                    ).map((s) => {
                      const isClosed = s === 'closed'
                      const closedDisabled = isClosed && !isClosedAuthorised
                      return (
                        <option
                          key={s}
                          value={s}
                          disabled={closedDisabled}
                          title={
                            closedDisabled
                              ? 'Resolved → Closed is gated to the originator + Brand Owner.'
                              : undefined
                          }
                        >
                          {STATUS_LABEL[s]}
                          {closedDisabled ? ' — gated' : ''}
                        </option>
                      )
                    })}
                  </select>
                  <span className="text-[11px] text-on-surface-variant">
                    Resolved → Closed is gated to originator + Brand Owner per
                    inventory line 1404.
                  </span>
                </div>

                {/* Assignee */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-on-surface">
                    Assignee
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <AssigneePicker
                    value={form.assigneeId}
                    onChange={(id) => update('assigneeId', id)}
                  />
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
                  <select
                    id="ticket-linked-type"
                    value={form.linkedEntityType}
                    onChange={(e) =>
                      update('linkedEntityType', e.target.value)
                    }
                    className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">— None —</option>
                    {Object.entries(LINKED_ENTITY_TYPE_LABEL).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
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
                    value={form.linkedEntityRef}
                    onChange={(e) =>
                      update('linkedEntityRef', e.target.value)
                    }
                    disabled={form.linkedEntityType === ''}
                  />
                </div>
              </div>

              {/* CC-PREFILL banner — visible when entered via query params. */}
              {prefilledType || prefilledRef ? (
                <div
                  role="note"
                  className="flex items-start gap-2 rounded-sm bg-tertiary-container text-on-tertiary-container px-3 py-2"
                >
                  <AlertTriangle
                    className="h-4 w-4 mt-0.5 shrink-0"
                    aria-hidden
                  />
                  <p className="text-xs">
                    <span className="font-semibold">CC-PREFILL applied.</span>{' '}
                    Linked entity pre-populated from the
                    <span className="font-mono mx-1">CC-ISSUE-TICKET-LINK</span>
                    entry-point query parameters. You can clear or override
                    before saving.
                  </p>
                </div>
              ) : null}
            </div>
          </FormSection>

          <SectionShift tone="lowest" className="my-4" aria-hidden />

          {/* ── Section 2 — Audit metadata ─────────────────────────────── */}
          <FormSection
            index={2}
            title="Audit metadata"
            subtitle="Read-only. Mutations are written to the audit trail per FR20 — see SI-INF-005 for the full change history."
          >
            {mode === 'create' ? (
              <div className="rounded-sm bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">
                  Originator + created-at + last-modified-at will be set at save.
                  The reference number (
                  <span className="font-mono">ISS-YYYY-SEQ</span>) is generated
                  by a per-(brand, year) Postgres sequence — no user input.
                </p>
              </div>
            ) : (
              <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Originator
                  </dt>
                  <dd className="mt-0.5 text-on-surface">
                    Arjun Reddy
                    <span className="ml-2 text-[11px] text-on-surface-variant">
                      Store Manager · Wild Sugar Bandra
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Created at
                  </dt>
                  <dd className="mt-0.5 text-on-surface tabular-nums">
                    {SAMPLE_CREATED_AT.replace('T', ' ').slice(0, 16)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Last modified at
                  </dt>
                  <dd className="mt-0.5 text-on-surface tabular-nums">
                    {SAMPLE_LAST_MODIFIED_AT.replace('T', ' ').slice(0, 16)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Last modified by
                  </dt>
                  <dd className="mt-0.5 text-on-surface">
                    Rohan Mehta
                    <span className="ml-2 text-[11px] text-on-surface-variant">
                      Cluster Manager
                    </span>
                  </dd>
                </div>
                <div className="tablet:col-span-2">
                  <Link
                    to={`/SI-INF-005?entity=issue_ticket&ref=${encodeURIComponent(ticketRef)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <History className="h-3 w-3" aria-hidden />
                    View full change history on SI-INF-005
                  </Link>
                </div>
              </dl>
            )}
          </FormSection>

          {/* ── Section 3 — Comments thread ─────────────────────────────── */}
          {mode === 'view-edit' ? (
            <>
              <SectionShift tone="lowest" className="my-4" aria-hidden />
              <FormSection
                index={3}
                title="Comments"
                subtitle="Chronological thread (Realtime channel #5 — production wires the subscription in Arc (c) Task C8b). Comments are append-only per FR20."
              >
                <CCIssueCommentThread
                  comments={comments}
                  composerValue={composerValue}
                  onComposerChange={setComposerValue}
                  onSubmitComment={handleAddComment}
                  liveIndicator
                  scopeLabel={ticketRef}
                />
              </FormSection>

              <SectionShift tone="lowest" className="my-4" aria-hidden />

              {/* ── Section 4 — Attachments ───────────────────────────── */}
              <FormSection
                index={4}
                title="Attachments"
                subtitle="Photos, PDFs, and plain-text logs. Files land in the per-brand Storage bucket via signed PUT URLs (DL-017 + DL-041)."
              >
                <CCFileAttachUploader
                  attachments={attachments}
                  acceptedMimeTypes={ACCEPTED_MIME_TYPES}
                  maxSizeBytes={MAX_BYTES}
                  onPickFile={handlePickFile}
                  onRemove={handleRemoveAttachment}
                  onRetry={handleRetryAttachment}
                  liveIndicator
                />
              </FormSection>
            </>
          ) : null}

          {/* Submit row */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {mode === 'view-edit' ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  aria-label="Reassign ticket — opens a sub-affordance with mandatory comment"
                >
                  <UserCog className="h-4 w-4" aria-hidden />
                  Reassign…
                </Button>
                <Button
                  type="button"
                  variant="tonal"
                  size="default"
                  aria-label="Change status — opens the status-transition picker"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Change status…
                </Button>
                <Button
                  type="submit"
                  size="default"
                  disabled={!canSubmit || !isDirty}
                  aria-label="Save changes"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  disabled={!isDirty}
                  aria-label="Save as draft"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Save draft
                </Button>
                <Button
                  type="submit"
                  size="default"
                  disabled={!canSubmit}
                  aria-label="Open ticket"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Open ticket
                </Button>
              </>
            )}
          </div>
        </form>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to={`/SI-INF-005?entity=issue_ticket${reference ? `&ref=${encodeURIComponent(reference)}` : ''}`}
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Audit trail viewer (SI-INF-005)
          </Link>
          {' · '}
          SI-INF-008 · Tier 1 hero (Phase 4 deferred-hero) · Phase 4 Epic 3 INF
        </footer>

        <p className="mt-6 text-[11px] text-on-surface-variant">
          NOW = {NOW_ISO.slice(0, 16).replace('T', ' ')}. All four
          AttachmentState values + multi-author thread + CC-PREFILL banner +
          status-gating tooltip are visible in this mockup per Tier 1
          acceptance.
        </p>
      </div>
    </div>
  )
}
