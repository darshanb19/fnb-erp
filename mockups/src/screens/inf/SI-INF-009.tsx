import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  History,
  Info,
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
} from '@/shell'

import { clusters, locations, NOW } from '@/lib/sample-data'
import { ROLE_LABEL, USER_ROLES, type UserRole } from '@/lib/user-roles'

/**
 * SI-INF-009 — Broadcast Announcement Composer.
 *
 * Tier 2 mockup, BO-only desktop-primary admin form. Phase 4 Epic 3 INF
 * Arc (b) Task B4. Composes and dispatches brand-scoped broadcast
 * announcements that fan out via `notificationCenter.sendBulk()` (Arc (a)
 * Task A6) to a target user set chosen from a brand / cluster / location /
 * role shape.
 *
 * Layout (per plan §5 Task B4 Step 1):
 *
 *   1. Back-link header strip (mirrors SI-USR-002 / SI-INF-008 pattern).
 *   2. Page split: composer (~60%) on the left, preview pane (~40%) on
 *      the right rendering the announcement as recipients will see it
 *      (urgency-tinted banner with optional ack-required gate).
 *   3. History list of past broadcasts below the split — title, sent-at,
 *      target scope, urgency pill, status pill, ack count vs target.
 *      Each row expands inline to surface acknowledgement detail
 *      (handled inline per inventory line 1448; not a separate route).
 *
 * Action strip (varies with the editing mode):
 *   - new draft     → Save draft + Schedule + Send now.
 *   - editing draft → Save draft + Schedule + Send now + Discard draft.
 *   - editing scheduled → Cancel scheduled + Edit before scheduled time
 *                         (FR117 cleanly-cancellable pre-confirmed states).
 *   - sent (read-only) → Re-broadcast (CC-PREFILL — pre-fills new composer
 *                        with prior content per inventory user_actions).
 *
 * Backend canonical enum mirrors (verified against
 * `apps/api/src/db/schema/broadcasts.ts`):
 *   - urgency: 'info' | 'important' | 'critical'.
 *   - status:  'draft' | 'scheduled' | 'sent' | 'cancelled'.
 *   - target_scope shape (jsonb):
 *       { scope: 'brand' }
 *       { scope: 'cluster_ids',  values: string[] }
 *       { scope: 'location_ids', values: string[] }
 *       { scope: 'role_keys',    values: UserRole[] }
 *
 * DL-035 note: ack-required toggle drives the in-app banner. Cross-channel
 * ack-reminder emails are deferred per DL-035 — the in-app persistent
 * banner is the only reminder mechanism in MVP. Toggle still works as a
 * UI affordance and writes the flag onto the broadcast row.
 *
 * Cross-cutting:
 *   - CC-DRAFT-PILL — surfaced in the composer header when isDirty.
 *   - CC-AUDIT-LINK — footer drill-down to SI-INF-005 filtered to
 *     `entity=broadcast`.
 *   - CC-PREFILL    — Re-broadcast on sent rows.
 *
 * Tokens (DESIGN.md §6.1 + §6.4):
 *   - urgency Info       → `surface_tint` accent (recipient banner).
 *   - urgency Important  → `warning` family.
 *   - urgency Critical   → `error-container` / `on-error-container`.
 *   - history status pills:
 *       draft     → status_draft.
 *       scheduled → status_pending_approval.
 *       sent      → status_completed.
 *       cancelled → status_cancelled.
 *
 * RBAC (deferred to Arc (c)):
 *   Brand Owner only per FR12 / FR23. Mockup is open; the production page
 *   wraps in `<RequirePermission permission="inf.broadcast.compose">`.
 *
 * Animation: NONE per CLAUDE.md (admin form). Tailwind transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical enum mirrors (verified against apps/api/src/db/schema/broadcasts.ts)
// ─────────────────────────────────────────────────────────────────────────────

type BroadcastUrgency = 'info' | 'important' | 'critical'
type BroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'
type TargetScopeKind = 'brand' | 'cluster_ids' | 'location_ids' | 'role_keys'

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

const SCOPE_LABEL: Record<TargetScopeKind, string> = {
  brand: 'Entire brand',
  cluster_ids: 'Specific clusters',
  location_ids: 'Specific locations',
  role_keys: 'Specific roles',
}

// ─────────────────────────────────────────────────────────────────────────────
// Form-state shape — mirrors broadcast_announcements row
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeBrand {
  readonly scope: 'brand'
}
interface ScopeClusterIds {
  readonly scope: 'cluster_ids'
  readonly values: ReadonlyArray<string>
}
interface ScopeLocationIds {
  readonly scope: 'location_ids'
  readonly values: ReadonlyArray<string>
}
interface ScopeRoleKeys {
  readonly scope: 'role_keys'
  readonly values: ReadonlyArray<UserRole>
}

type TargetScope = ScopeBrand | ScopeClusterIds | ScopeLocationIds | ScopeRoleKeys

interface ComposerState {
  readonly title: string
  readonly body: string
  readonly urgency: BroadcastUrgency
  readonly target: TargetScope
  /** ISO-local datetime string ("YYYY-MM-DDTHH:mm"); empty = immediate. */
  readonly scheduledFor: string
  readonly ackRequired: boolean
}

const EMPTY_COMPOSER: ComposerState = {
  title: '',
  body: '',
  urgency: 'info',
  target: { scope: 'brand' },
  scheduledFor: '',
  ackRequired: false,
}

const SAMPLE_COMPOSER: ComposerState = {
  title: 'New menu launch — staff briefing',
  body:
    "**Spring menu launch goes live Monday 12 May.**\n\nKey changes:\n- New cocktail list (12 items) replaces the winter card.\n- Two new dessert SKUs at the bakery counter.\n- Tandoor section adds a smoked-paneer kebab as a daily special.\n\nAll outlets must complete the *staff briefing deck* before the morning shift opens. Briefing deck is on the Drive: see the [launch checklist](#).\n\nAcknowledge once you've completed the briefing.",
  urgency: 'important',
  target: { scope: 'brand' },
  scheduledFor: '',
  ackRequired: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// History fixtures — 6 broadcasts spanning all 4 statuses, all 3 urgencies,
// all 4 target_scope kinds.
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryRow {
  readonly id: string
  readonly title: string
  readonly bodyPreview: string
  readonly urgency: BroadcastUrgency
  readonly status: BroadcastStatus
  readonly target: TargetScope
  readonly scheduledFor: string | null
  readonly sentAt: string | null
  readonly ackRequired: boolean
  readonly ackCount: number
  readonly targetCount: number
  readonly authorLabel: string
}

const HISTORY: ReadonlyArray<HistoryRow> = [
  {
    id: 'br-001',
    title: 'Holiday closure: 26 Jan (Republic Day)',
    bodyPreview:
      'All outlets remain closed on 26 Jan. Central kitchen runs a half-day shift to clear perishables.',
    urgency: 'info',
    status: 'sent',
    target: { scope: 'brand' },
    scheduledFor: '2026-01-24T09:00:00+05:30',
    sentAt: '2026-01-24T09:00:00+05:30',
    ackRequired: false,
    ackCount: 38,
    targetCount: 42,
    authorLabel: 'Aanya Khanna',
  },
  {
    id: 'br-002',
    title: 'Tax-rate change effective 1 Apr',
    bodyPreview:
      'GST on packaged sweets revises to 12%. Update menu pricing and POS catalog before opening on 1 Apr.',
    urgency: 'important',
    status: 'sent',
    target: { scope: 'role_keys', values: ['accountant', 'pos_manager'] },
    scheduledFor: '2026-03-28T18:00:00+05:30',
    sentAt: '2026-03-28T18:00:00+05:30',
    ackRequired: true,
    ackCount: 6,
    targetCount: 8,
    authorLabel: 'Aanya Khanna',
  },
  {
    id: 'br-003',
    title: 'POS downtime tonight 22:00–01:00',
    bodyPreview:
      'POS upgrade window. Use the offline order pad. Sync resumes by 01:30. Rohan on-call for incident.',
    urgency: 'critical',
    status: 'sent',
    target: {
      scope: 'location_ids',
      values: ['loc-bandra-linking', 'loc-bandra-pali', 'loc-andheri-phoenix'],
    },
    scheduledFor: '2026-04-18T20:00:00+05:30',
    sentAt: '2026-04-18T20:00:00+05:30',
    ackRequired: true,
    ackCount: 14,
    targetCount: 17,
    authorLabel: 'Aanya Khanna',
  },
  {
    id: 'br-004',
    title: 'Bandra-West cluster: vendor onboarding refresh',
    bodyPreview:
      'New preferred-vendor list for the Bandra-West cluster. Pin the updated rate card on the receiving desk.',
    urgency: 'info',
    status: 'scheduled',
    target: { scope: 'cluster_ids', values: ['cl-bandra-west'] },
    scheduledFor: '2026-05-12T09:00:00+05:30',
    sentAt: null,
    ackRequired: false,
    ackCount: 0,
    targetCount: 13,
    authorLabel: 'Aanya Khanna',
  },
  {
    id: 'br-005',
    title: 'Quarterly leadership review — agenda',
    bodyPreview:
      'Draft agenda for the May leadership review. Cluster heads submit talking points by 10 May EOD.',
    urgency: 'info',
    status: 'draft',
    target: { scope: 'role_keys', values: ['cluster_manager', 'brand_owner'] },
    scheduledFor: null,
    sentAt: null,
    ackRequired: false,
    ackCount: 0,
    targetCount: 4,
    authorLabel: 'Aanya Khanna',
  },
  {
    id: 'br-006',
    title: 'Power outage drill — postponed',
    bodyPreview:
      'The power-outage drill scheduled for 03 May is postponed pending the BMC schedule. New date follows.',
    urgency: 'important',
    status: 'cancelled',
    target: { scope: 'brand' },
    scheduledFor: '2026-05-03T11:00:00+05:30',
    sentAt: null,
    ackRequired: false,
    ackCount: 0,
    targetCount: 42,
    authorLabel: 'Aanya Khanna',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Mock target-count resolver (mirrors a service-layer expansion of the scope)
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_COUNT_BY_CLUSTER: Record<string, number> = {
  'cl-bandra-west': 13,
  'cl-andheri-east': 9,
  'cl-powai': 4,
}
const TARGET_COUNT_BY_LOCATION: Record<string, number> = {
  'loc-ck-bandra': 8,
  'loc-bandra-linking': 5,
  'loc-bandra-pali': 5,
  'loc-dh-andheri': 4,
  'loc-andheri-phoenix': 5,
  'loc-powai-hiranandani': 4,
}
const TARGET_COUNT_BY_ROLE: Partial<Record<UserRole, number>> = {
  superadmin: 1,
  brand_owner: 1,
  cluster_manager: 3,
  procurement_manager: 1,
  production_manager: 1,
  pos_manager: 4,
  pos_staff: 18,
  accountant: 2,
  viewer: 2,
}
const BRAND_TARGET_COUNT = 42

function resolveTargetCount(scope: TargetScope): number {
  switch (scope.scope) {
    case 'brand':
      return BRAND_TARGET_COUNT
    case 'cluster_ids':
      return scope.values.reduce(
        (sum, id) => sum + (TARGET_COUNT_BY_CLUSTER[id] ?? 0),
        0,
      )
    case 'location_ids':
      return scope.values.reduce(
        (sum, id) => sum + (TARGET_COUNT_BY_LOCATION[id] ?? 0),
        0,
      )
    case 'role_keys':
      return scope.values.reduce(
        (sum, r) => sum + (TARGET_COUNT_BY_ROLE[r] ?? 0),
        0,
      )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight inline markdown renderer.
//
// Handles: **bold**, *italic*, [text](href) links, lines starting with "- "
// as bulleted lists, and blank-line paragraph breaks. Intentionally small —
// the production code in Arc (c) C8c can swap this for `marked` + DOMPurify
// once the schema-layer body sanitiser is in place.
// ─────────────────────────────────────────────────────────────────────────────

function renderInline(line: string, lineKey: string): React.ReactNode {
  const tokens: Array<React.ReactNode> = []
  let cursor = 0
  let segCounter = 0
  const re =
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    if (match.index > cursor) {
      tokens.push(line.slice(cursor, match.index))
    }
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
  if (cursor < line.length) {
    tokens.push(line.slice(cursor))
  }
  return tokens
}

interface MarkdownProps {
  readonly text: string
}

function Markdown({ text }: MarkdownProps) {
  const blocks = useMemo(() => {
    const lines = text.split('\n')
    const out: Array<{ kind: 'p' | 'ul' | 'blank'; lines: string[]; key: string }> =
      []
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
      // Paragraph — accumulate consecutive non-list, non-blank lines.
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

// ─────────────────────────────────────────────────────────────────────────────
// Urgency token → recipient-banner styling.
// ─────────────────────────────────────────────────────────────────────────────

interface UrgencyVisuals {
  readonly bannerClass: string
  readonly icon: typeof Info
  readonly label: string
}

const URGENCY_VISUALS: Record<BroadcastUrgency, UrgencyVisuals> = {
  info: {
    bannerClass: 'bg-surface-container-high text-on-surface',
    icon: Info,
    label: 'Info',
  },
  important: {
    bannerClass: 'bg-tertiary-container text-on-tertiary-container',
    icon: AlertTriangle,
    label: 'Important',
  },
  critical: {
    bannerClass: 'bg-error-container text-on-error-container',
    icon: AlertTriangle,
    label: 'Critical',
  },
}

function UrgencyChip({ urgency }: { readonly urgency: BroadcastUrgency }) {
  const v = URGENCY_VISUALS[urgency]
  const Icon = v.icon
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold',
        v.bannerClass,
      ].join(' ')}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {v.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope picker — one shape per `target.scope`.
// ─────────────────────────────────────────────────────────────────────────────

interface ScopePickerProps {
  readonly target: TargetScope
  readonly onChange: (next: TargetScope) => void
}

function ScopePicker({ target, onChange }: ScopePickerProps) {
  const [open, setOpen] = useState(false)

  const summary = useMemo(() => {
    switch (target.scope) {
      case 'brand':
        return SCOPE_LABEL.brand
      case 'cluster_ids':
        if (target.values.length === 0) return 'Pick clusters…'
        return target.values.length === 1
          ? clusters.find((c) => c.id === target.values[0])?.name ?? '1 cluster'
          : `${target.values.length} clusters`
      case 'location_ids':
        if (target.values.length === 0) return 'Pick locations…'
        return target.values.length === 1
          ? locations.find((l) => l.id === target.values[0])?.name ?? '1 location'
          : `${target.values.length} locations`
      case 'role_keys':
        if (target.values.length === 0) return 'Pick roles…'
        return target.values.length === 1
          ? ROLE_LABEL[target.values[0]]
          : `${target.values.length} roles`
    }
  }, [target])

  const handleKindChange = (kind: TargetScopeKind) => {
    if (kind === 'brand') {
      onChange({ scope: 'brand' })
    } else if (kind === 'cluster_ids') {
      onChange({ scope: 'cluster_ids', values: [] })
    } else if (kind === 'location_ids') {
      onChange({ scope: 'location_ids', values: [] })
    } else {
      onChange({ scope: 'role_keys', values: [] })
    }
  }

  const toggleClusterId = (id: string) => {
    if (target.scope !== 'cluster_ids') return
    const set = new Set(target.values)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange({ scope: 'cluster_ids', values: Array.from(set) })
  }
  const toggleLocationId = (id: string) => {
    if (target.scope !== 'location_ids') return
    const set = new Set(target.values)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange({ scope: 'location_ids', values: Array.from(set) })
  }
  const toggleRole = (r: UserRole) => {
    if (target.scope !== 'role_keys') return
    const set = new Set(target.values)
    if (set.has(r)) set.delete(r)
    else set.add(r)
    onChange({ scope: 'role_keys', values: Array.from(set) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Target scope kind"
        className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-container-low p-1 self-start"
      >
        {(['brand', 'cluster_ids', 'location_ids', 'role_keys'] as const).map(
          (kind) => {
            const active = target.scope === kind
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleKindChange(kind)}
                className={[
                  'inline-flex items-center gap-1 rounded-pill px-3 h-8 text-[11px] font-medium',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high',
                ].join(' ')}
              >
                {SCOPE_LABEL[kind]}
              </button>
            )
          },
        )}
      </div>

      {target.scope !== 'brand' ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={[
                'h-11 w-full rounded-sm bg-surface-container-highest px-3 text-sm text-left',
                'flex items-center justify-between gap-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'text-on-surface',
              ].join(' ')}
              aria-label="Open scope picker"
            >
              <span className="truncate">{summary}</span>
              <ChevronDown
                className="h-4 w-4 text-on-surface-variant shrink-0"
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[22rem] p-1 max-h-80 overflow-auto"
          >
            <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              {SCOPE_LABEL[target.scope]}
            </span>
            <ul className="flex flex-col">
              {target.scope === 'cluster_ids'
                ? clusters.map((c) => {
                    const active = target.values.includes(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleClusterId(c.id)}
                          aria-pressed={active}
                          className={[
                            'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                            'hover:bg-surface-container-high transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            active ? 'bg-surface-container' : '',
                          ].join(' ')}
                        >
                          <span className="text-sm text-on-surface">{c.name}</span>
                          {active ? (
                            <CheckCircle2
                              className="h-4 w-4 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })
                : null}
              {target.scope === 'location_ids'
                ? locations.map((l) => {
                    const active = target.values.includes(l.id)
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => toggleLocationId(l.id)}
                          aria-pressed={active}
                          className={[
                            'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                            'hover:bg-surface-container-high transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            active ? 'bg-surface-container' : '',
                          ].join(' ')}
                        >
                          <span className="flex flex-col">
                            <span className="text-sm text-on-surface">
                              {l.name}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {l.city}
                            </span>
                          </span>
                          {active ? (
                            <CheckCircle2
                              className="h-4 w-4 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })
                : null}
              {target.scope === 'role_keys'
                ? USER_ROLES.map((r) => {
                    const active = target.values.includes(r)
                    return (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => toggleRole(r)}
                          aria-pressed={active}
                          className={[
                            'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                            'hover:bg-surface-container-high transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            active ? 'bg-surface-container' : '',
                          ].join(' ')}
                        >
                          <span className="text-sm text-on-surface">
                            {ROLE_LABEL[r]}
                          </span>
                          {active ? (
                            <CheckCircle2
                              className="h-4 w-4 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })
                : null}
            </ul>
          </PopoverContent>
        </Popover>
      ) : (
        <p className="text-[11px] text-on-surface-variant">
          Fans out to every active user in the brand ({BRAND_TARGET_COUNT}{' '}
          recipients).
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope summariser — used in the history list.
// ─────────────────────────────────────────────────────────────────────────────

function summariseScope(scope: TargetScope): string {
  switch (scope.scope) {
    case 'brand':
      return 'Entire brand'
    case 'cluster_ids':
      if (scope.values.length === 1) {
        return clusters.find((c) => c.id === scope.values[0])?.name ?? '1 cluster'
      }
      return `${scope.values.length} clusters`
    case 'location_ids':
      if (scope.values.length === 1) {
        return (
          locations.find((l) => l.id === scope.values[0])?.name ?? '1 location'
        )
      }
      return `${scope.values.length} locations`
    case 'role_keys':
      if (scope.values.length === 1) {
        return ROLE_LABEL[scope.values[0]]
      }
      return `${scope.values.length} roles`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Editing-mode taxonomy — drives the action strip + composer state lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

type EditingMode =
  | { kind: 'new-draft' }
  | { kind: 'editing-draft'; rowId: string }
  | { kind: 'editing-scheduled'; rowId: string }
  | { kind: 'sent-readonly'; rowId: string }

const NOW_ISO = `${NOW}T11:14:00+05:30`

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf009() {
  const [composer, setComposer] = useState<ComposerState>(SAMPLE_COMPOSER)
  const [isDirty, setIsDirty] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState<EditingMode>({ kind: 'new-draft' })
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const update = <K extends keyof ComposerState>(
    key: K,
    value: ComposerState[K],
  ) => {
    setComposer((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
    setSubmitted(false)
  }

  const handleSelectHistoryRow = (row: HistoryRow) => {
    setComposer({
      title: row.title,
      body: row.bodyPreview,
      urgency: row.urgency,
      target: row.target,
      scheduledFor:
        row.status === 'scheduled' && row.scheduledFor
          ? row.scheduledFor.slice(0, 16)
          : '',
      ackRequired: row.ackRequired,
    })
    setIsDirty(false)
    setSubmitted(false)
    if (row.status === 'draft') setMode({ kind: 'editing-draft', rowId: row.id })
    else if (row.status === 'scheduled')
      setMode({ kind: 'editing-scheduled', rowId: row.id })
    else if (row.status === 'sent')
      setMode({ kind: 'sent-readonly', rowId: row.id })
    else setMode({ kind: 'new-draft' })
  }

  const handleNewDraft = () => {
    setComposer(EMPTY_COMPOSER)
    setIsDirty(false)
    setSubmitted(false)
    setMode({ kind: 'new-draft' })
  }

  const handleRebroadcast = (row: HistoryRow) => {
    // CC-PREFILL — pre-fills new composer with prior content per inventory
    // user_actions. Never mutates the sent row (sent broadcasts are
    // immutable per FR20 / FR117 / broadcasts.ts guardrail).
    setComposer({
      title: row.title,
      body: row.bodyPreview,
      urgency: row.urgency,
      target: row.target,
      scheduledFor: '',
      ackRequired: row.ackRequired,
    })
    setIsDirty(true)
    setSubmitted(false)
    setMode({ kind: 'new-draft' })
  }

  const titleOk = composer.title.trim().length > 0
  const bodyOk = composer.body.trim().length > 0
  const scopeOk =
    composer.target.scope === 'brand' || composer.target.values.length > 0
  const canSend = titleOk && bodyOk && scopeOk

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSend) return
    setSubmitted(true)
    setIsDirty(false)
  }

  const targetCount = useMemo(
    () => resolveTargetCount(composer.target),
    [composer.target],
  )

  const isReadOnly = mode.kind === 'sent-readonly'
  const isEditingScheduled = mode.kind === 'editing-scheduled'

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Back-link header */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/" aria-label="Back to screen index">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Broadcasts
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
              <Megaphone
                className="h-7 w-7 text-on-surface-variant"
                aria-hidden
              />
              <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                Broadcasts
              </h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Compose a brand-wide announcement or target a specific cluster,
              location set, or role set. Schedule the delivery or send
              immediately. Acknowledgement-required broadcasts surface a
              persistent in-app banner until each recipient acknowledges.
            </p>
            <p className="mt-3 text-xs text-on-surface-variant">
              FR23 (broadcast announcements). Mutations write to the audit
              trail per FR20. Sent broadcasts are immutable per FR117 —
              correction is a new announcement, not an edit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DraftPill isDraft={isDirty} mobileEyebrow />
            {submitted ? (
              <StatusPill status="status_confirmed" size="sm" label="Saved" />
            ) : null}
            {isReadOnly ? (
              <StatusPill
                status="status_completed"
                size="sm"
                label="Sent — read-only"
              />
            ) : null}
            {isEditingScheduled ? (
              <StatusPill
                status="status_pending_approval"
                size="sm"
                label="Scheduled"
              />
            ) : null}
          </div>
        </header>

        {/* DL-035 banner */}
        <div
          role="note"
          className="mt-4 flex items-start gap-2 rounded-sm bg-surface-container-low px-3 py-2"
        >
          <Info
            className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant"
            aria-hidden
          />
          <p className="text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">DL-035 note.</span>{' '}
            Cross-channel ack-reminder emails are deferred — the in-app banner
            is the only ack reminder mechanism in MVP. The
            "acknowledgement-required" toggle still works and persists onto the
            broadcast row.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6" noValidate>
          {/* ── Composer + Preview split ─────────────────────────────── */}
          <div className="grid grid-cols-1 desktop:grid-cols-[3fr_2fr] gap-6">
            {/* Composer (left, ~60%) */}
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
                  Title and body are mandatory. Body supports basic markdown —
                  bold, italics, bullets, and links.
                </p>
              </CardHeader>
              <CardContent className="p-4 tablet:p-6 pt-2">
                <fieldset
                  disabled={isReadOnly}
                  className="flex flex-col gap-4 disabled:opacity-60"
                >
                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="bc-title"
                      className="text-xs font-medium text-on-surface"
                    >
                      Title
                      <span className="text-error ml-0.5" aria-hidden>
                        *
                      </span>
                    </label>
                    <Input
                      id="bc-title"
                      placeholder="Concise headline — e.g. POS downtime tonight 22:00–01:00"
                      value={composer.title}
                      onChange={(e) => update('title', e.target.value)}
                    />
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="bc-body"
                      className="text-xs font-medium text-on-surface"
                    >
                      Body
                      <span className="text-error ml-0.5" aria-hidden>
                        *
                      </span>
                    </label>
                    <textarea
                      id="bc-body"
                      rows={8}
                      value={composer.body}
                      onChange={(e) => update('body', e.target.value)}
                      placeholder="Body text. **Bold**, *italics*, bulleted lists with leading '- ', and [links](url) render in the preview."
                      className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <span className="text-[11px] text-on-surface-variant">
                      Markdown: <span className="font-mono">**bold**</span>,{' '}
                      <span className="font-mono">*italics*</span>, leading{' '}
                      <span className="font-mono">- </span> for bullets,{' '}
                      <span className="font-mono">[label](url)</span> for links.
                    </span>
                  </div>

                  {/* Urgency */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-on-surface">
                      Urgency
                    </span>
                    <div
                      role="radiogroup"
                      aria-label="Urgency"
                      className="inline-flex flex-wrap items-center gap-2"
                    >
                      {(['info', 'important', 'critical'] as const).map((u) => {
                        const active = composer.urgency === u
                        const v = URGENCY_VISUALS[u]
                        const Icon = v.icon
                        return (
                          <button
                            key={u}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => update('urgency', u)}
                            className={[
                              'inline-flex items-center gap-1.5 rounded-pill px-3 h-9 text-xs font-medium',
                              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              active
                                ? v.bannerClass
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high',
                            ].join(' ')}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {URGENCY_LABEL[u]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Target scope */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-on-surface">
                      Target scope
                      <span className="text-error ml-0.5" aria-hidden>
                        *
                      </span>
                    </span>
                    <ScopePicker
                      target={composer.target}
                      onChange={(t) => update('target', t)}
                    />
                    <p className="text-[11px] text-on-surface-variant">
                      Estimated reach:{' '}
                      <span className="font-semibold text-on-surface tabular-nums">
                        {targetCount.toLocaleString('en-IN')}
                      </span>{' '}
                      recipients.
                    </p>
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
                        value={composer.scheduledFor}
                        onChange={(e) => update('scheduledFor', e.target.value)}
                        className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <span className="text-[11px] text-on-surface-variant">
                        Empty = send immediately on dispatch.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-on-surface">
                        Acknowledgement
                      </span>
                      <label
                        htmlFor="bc-ack-required"
                        className={[
                          'flex items-center gap-2 rounded-sm bg-surface-container-low px-3 h-11 cursor-pointer',
                          'focus-within:ring-2 focus-within:ring-primary',
                        ].join(' ')}
                      >
                        <input
                          id="bc-ack-required"
                          type="checkbox"
                          checked={composer.ackRequired}
                          onChange={(e) =>
                            update('ackRequired', e.target.checked)
                          }
                          className="h-4 w-4 rounded-sm accent-primary"
                        />
                        <span className="text-sm text-on-surface">
                          Require acknowledgement
                        </span>
                      </label>
                      <span className="text-[11px] text-on-surface-variant">
                        Recipients see a persistent banner that blocks dismissal
                        until acknowledged.
                      </span>
                    </div>
                  </div>
                </fieldset>
              </CardContent>
            </Card>

            {/* Preview pane (right, ~40%) */}
            <Card className="p-0">
              <CardHeader className="p-4 tablet:p-6 pb-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Preview
                </p>
                <CardTitle className="mt-1 text-base text-on-surface flex items-center gap-2">
                  <Eye className="h-4 w-4 text-on-surface-variant" aria-hidden />
                  As recipients will see it
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Renders the in-app banner exactly as the recipient receives
                  it on the home dashboard.
                </p>
              </CardHeader>
              <CardContent className="p-4 tablet:p-6 pt-2">
                <RecipientPreview composer={composer} targetCount={targetCount} />
              </CardContent>
            </Card>
          </div>

          {/* Action strip */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
              <Repeat className="h-3 w-3" aria-hidden />
              {mode.kind === 'new-draft'
                ? 'New broadcast — choose Save draft, Schedule, or Send now.'
                : mode.kind === 'editing-draft'
                  ? 'Editing draft — pick up where you left off.'
                  : mode.kind === 'editing-scheduled'
                    ? 'Editing scheduled — confirmation required to dispatch early or cancel.'
                    : 'Sent — read-only. Use Re-broadcast to copy into a new draft.'}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {mode.kind === 'new-draft' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    disabled={!isDirty || !titleOk}
                    aria-label="Save as draft"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    variant="tonal"
                    size="default"
                    disabled={!canSend || composer.scheduledFor === ''}
                    aria-label="Schedule broadcast"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Schedule
                  </Button>
                  <Button
                    type="submit"
                    size="default"
                    disabled={!canSend}
                    aria-label="Send now"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Send now
                  </Button>
                </>
              ) : null}
              {mode.kind === 'editing-draft' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    onClick={handleNewDraft}
                    aria-label="Discard draft"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Discard draft
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    disabled={!isDirty || !titleOk}
                    aria-label="Save draft changes"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    variant="tonal"
                    size="default"
                    disabled={!canSend || composer.scheduledFor === ''}
                    aria-label="Schedule broadcast"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Schedule
                  </Button>
                  <Button
                    type="submit"
                    size="default"
                    disabled={!canSend}
                    aria-label="Send now"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Send now
                  </Button>
                </>
              ) : null}
              {mode.kind === 'editing-scheduled' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    aria-label="Cancel scheduled broadcast — confirmation gate"
                  >
                    <Ban className="h-4 w-4" aria-hidden />
                    Cancel scheduled…
                  </Button>
                  <Button
                    type="button"
                    variant="tonal"
                    size="default"
                    aria-label="Edit before scheduled time — confirmation gate per FR117"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    Edit before send…
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
                  <Button
                    type="button"
                    variant="tonal"
                    size="default"
                    onClick={() => {
                      const row = HISTORY.find((r) => r.id === mode.rowId)
                      if (row) handleRebroadcast(row)
                    }}
                    aria-label="Re-broadcast — pre-fills new draft (CC-PREFILL)"
                  >
                    <Repeat className="h-4 w-4" aria-hidden />
                    Re-broadcast
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </form>

        <SectionShift tone="lowest" className="my-8" aria-hidden />

        {/* ── History list ───────────────────────────────────────────── */}
        <section aria-label="Past broadcasts" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                History
              </p>
              <h2 className="text-lg font-semibold text-on-surface">
                Past broadcasts
              </h2>
            </div>
            <span className="text-[11px] text-on-surface-variant">
              {HISTORY.length} broadcasts shown · click a row to load it into
              the composer
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {HISTORY.map((row) => {
              const expanded = expandedRowId === row.id
              return (
                <li key={row.id}>
                  <Card className="p-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRowId(expanded ? null : row.id)
                      }
                      className={[
                        'w-full text-left p-4 tablet:p-5',
                        'flex flex-col gap-2',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'hover:bg-surface-container-low transition-colors rounded-md',
                      ].join(' ')}
                      aria-expanded={expanded}
                      aria-controls={`history-detail-${row.id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <ChevronRight
                            className={[
                              'h-4 w-4 text-on-surface-variant transition-transform',
                              expanded ? 'rotate-90' : '',
                            ].join(' ')}
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
                          <span>{summariseScope(row.target)}</span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {row.ackRequired
                              ? `${row.ackCount}/${row.targetCount} acked`
                              : `${row.targetCount} reached`}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant pl-6">
                        {row.bodyPreview}
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
                          onLoadIntoComposer={() => handleSelectHistoryRow(row)}
                          onRebroadcast={() => handleRebroadcast(row)}
                        />
                      </div>
                    ) : null}
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/SI-INF-005?entity=broadcast"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Broadcast change history (SI-INF-005 — filtered to broadcasts)
          </Link>
          {' · '}
          SI-INF-009 · Tier 2 (BO-only desktop-primary) · Phase 4 Epic 3 INF
        </footer>

        <p className="mt-6 text-[11px] text-on-surface-variant">
          NOW = {NOW_ISO.slice(0, 16).replace('T', ' ')}. Six broadcasts span
          all four statuses + all three urgencies + all four target_scope kinds.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipientPreview — renders the announcement as recipients see it.
// ─────────────────────────────────────────────────────────────────────────────

interface RecipientPreviewProps {
  readonly composer: ComposerState
  readonly targetCount: number
}

function RecipientPreview({ composer, targetCount }: RecipientPreviewProps) {
  const v = URGENCY_VISUALS[composer.urgency]
  const Icon = v.icon
  const titleText = composer.title.trim() || 'Untitled broadcast'
  const bodyText = composer.body.trim()

  return (
    <div className="flex flex-col gap-3">
      <div className={['rounded-md p-4', v.bannerClass].join(' ')}>
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {v.label}
              </span>
              <span className="text-[10px] opacity-80">
                · from Brand Owner · {NOW.replace(/-/g, '/')}
              </span>
            </div>
            <h3 className="text-base font-semibold leading-tight">
              {titleText}
            </h3>
            {bodyText ? (
              <div
                className={[
                  'rounded-sm p-3 bg-surface-container-lowest text-on-surface',
                ].join(' ')}
              >
                <Markdown text={bodyText} />
              </div>
            ) : (
              <p className="text-xs italic opacity-80">
                Body preview will appear here.
              </p>
            )}
            {composer.ackRequired ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="tonal"
                  className="bg-surface-container-lowest text-on-surface"
                  aria-label="Mock acknowledge — preview only"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Acknowledge
                </Button>
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
          Estimated reach{' '}
          <span className="font-semibold text-on-surface tabular-nums">
            {targetCount.toLocaleString('en-IN')}
          </span>{' '}
          recipients.{' '}
          {composer.scheduledFor === ''
            ? 'Sends immediately on dispatch.'
            : `Scheduled for ${composer.scheduledFor.replace('T', ' ')}.`}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryDrillDown — expanded acknowledgement detail (handled inline per
// inventory line 1448, NOT a separate route).
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryDrillDownProps {
  readonly row: HistoryRow
  readonly onLoadIntoComposer: () => void
  readonly onRebroadcast: () => void
}

interface AckRow {
  readonly userLabel: string
  readonly roleLabel: string
  readonly ackedAt: string | null
}

const ACK_DETAIL: Record<string, ReadonlyArray<AckRow>> = {
  'br-001': [
    {
      userLabel: 'Rohan Mehta',
      roleLabel: 'Cluster Manager · Bandra',
      ackedAt: '2026-01-24T09:12:00+05:30',
    },
    {
      userLabel: 'Sneha Bose',
      roleLabel: 'Cluster Manager · Andheri',
      ackedAt: '2026-01-24T09:18:00+05:30',
    },
    {
      userLabel: 'Arjun Reddy',
      roleLabel: 'Store Manager · Linking Road',
      ackedAt: null,
    },
  ],
  'br-002': [
    {
      userLabel: 'Priya Iyer',
      roleLabel: 'Accountant',
      ackedAt: '2026-03-28T18:14:00+05:30',
    },
    {
      userLabel: 'Vivek Singh',
      roleLabel: 'POS Manager · Phoenix',
      ackedAt: '2026-03-28T18:42:00+05:30',
    },
    {
      userLabel: 'Anita Joshi',
      roleLabel: 'POS Manager · Pali Hill',
      ackedAt: null,
    },
  ],
  'br-003': [
    {
      userLabel: 'Arjun Reddy',
      roleLabel: 'Store Manager · Linking Road',
      ackedAt: '2026-04-18T20:08:00+05:30',
    },
    {
      userLabel: 'Vivek Singh',
      roleLabel: 'POS Manager · Phoenix',
      ackedAt: '2026-04-18T20:11:00+05:30',
    },
    {
      userLabel: 'Anita Joshi',
      roleLabel: 'POS Manager · Pali Hill',
      ackedAt: null,
    },
  ],
}

function HistoryDrillDown({
  row,
  onLoadIntoComposer,
  onRebroadcast,
}: HistoryDrillDownProps) {
  const ackDetail = ACK_DETAIL[row.id] ?? []
  const hasAckDetail = row.ackRequired && ackDetail.length > 0

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
          <dd className="mt-0.5 text-on-surface">{summariseScope(row.target)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Author
          </dt>
          <dd className="mt-0.5 text-on-surface">{row.authorLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scheduled
          </dt>
          <dd className="mt-0.5 text-on-surface tabular-nums">
            {row.scheduledFor
              ? row.scheduledFor.replace('T', ' ').slice(0, 16)
              : '—'}
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
      </dl>

      {hasAckDetail ? (
        <div className="rounded-sm bg-surface-container-low p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Acknowledgement detail · {row.ackCount}/{row.targetCount} acked
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {ackDetail.map((a) => (
              <li
                key={`${row.id}-${a.userLabel}`}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2">
                  {a.ackedAt ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden
                    />
                  ) : (
                    <Info
                      className="h-3.5 w-3.5 text-on-surface-variant"
                      aria-hidden
                    />
                  )}
                  <span className="text-on-surface">{a.userLabel}</span>
                  <span className="text-on-surface-variant">
                    · {a.roleLabel}
                  </span>
                </span>
                <span className="tabular-nums text-on-surface-variant">
                  {a.ackedAt
                    ? a.ackedAt.replace('T', ' ').slice(0, 16)
                    : 'Not yet acked'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : row.ackRequired ? (
        <p className="text-[11px] italic text-on-surface-variant">
          Acknowledgement detail loads on demand. Production wires the
          per-broadcast `getAckDetail` query in Arc (c).
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLoadIntoComposer}
          aria-label="Load this broadcast into the composer"
        >
          Load into composer
        </Button>
        {row.status === 'sent' ? (
          <Button
            type="button"
            variant="tonal"
            size="sm"
            onClick={onRebroadcast}
            aria-label="Re-broadcast — pre-fills new draft (CC-PREFILL)"
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden />
            Re-broadcast
          </Button>
        ) : null}
        <Link
          to={`/SI-INF-005?entity=broadcast&ref=${encodeURIComponent(row.id)}`}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <History className="h-3 w-3" aria-hidden />
          Audit history
        </Link>
      </div>
    </div>
  )
}
