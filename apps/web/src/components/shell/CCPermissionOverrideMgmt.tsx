import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ChevronDown,
  History,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * CCPermissionOverrideMgmt — CC-PERMISSION-OVERRIDE-MGMT canonical.
 *
 * Shared shell for the permission-override surfaces shipped in Phase 4
 * Epic 2 USR. Three Tier 1 / Tier 2 mockups all render the same handful
 * of override-shaped pieces — source badge, expiry-band pill, reason-code
 * + notes input, and (for the production frontend) a stand-alone card
 * that wraps a permission row with all of the above plus the audit link.
 * Building these in one place means the tonal mappings, day-band
 * thresholds, and reason-code minimum-character validation all share a
 * single definition.
 *
 * Consumers in Epic 2 (USR):
 *   - SI-USR-005 Effective Permissions View — `<OverrideSourceBadge>` in
 *     the source column of the effective-permission table (long variant).
 *   - SI-USR-006 Grant / Revoke / Edit override (Tier 1 hero) —
 *     `<OverrideSourceBadge>` for the live preview surface plus
 *     `<OverrideReasonInput>` for section 3 (reason code + notes).
 *   - SI-USR-007 Permission Overrides Expiring Soon — `<OverrideSourceBadge>`
 *     in the mode column (compact variant) and `<OverrideExpiryBand>` for
 *     the day-band pill.
 *
 * `<OverrideCard>` is exported for Arc (c) production frontend use; the
 * mockup screens render override information in tables, so the card-shaped
 * variant is documented here but not yet consumed.
 *
 * Tone mapping (DESIGN.md §6.4 tonal containers + canonical 20 status
 * palette — `bg-success-container` is NOT in the project's tokens, so the
 * additive / approved tone reuses `secondary-container`, the same family
 * used by `status_template_active` / `status_version_published`):
 *
 *   - `role_baseline`   → neutral `bg-surface-container-high text-on-surface`
 *                          (`Shield` glyph — calm, not an alert)
 *   - `grant_override`  → positive `bg-secondary-container text-on-secondary-container`
 *                          (`ShieldCheck` glyph — additive / approved)
 *   - `revoke_override` → caution `bg-error-container text-on-error-container`
 *                          (`ShieldX` glyph — same family as
 *                          `status_overridden`)
 *
 *   Day-bands (matched to USR-007's task spec):
 *     - 0–7 days   → urgent  → `bg-error-container text-on-error-container`
 *     - 8–30 days  → soon    → `bg-tertiary-container text-on-tertiary-container`
 *     - >30 days   → routine → `bg-surface-container-high text-on-surface`
 *
 *   No `tenant_brand_accent` — DESIGN.md §3 lists the four allowed accent
 *   surfaces and admin permission grids are not among them.
 *
 * Source FRs:
 *   - FR15a — mandatory reason code on every permission override mutation.
 *   - FR15b — effective set updates immediately after the mutation.
 *   - FR15c — audit trail row written per mutation.
 *   - FR15d — proactive renewal of expiring overrides.
 *
 * Cross-references: DESIGN.md §6.1 (canonical 20 status tokens), §6.4
 * (tonal container palette), §3 (tenant_brand_accent allow-list).
 */

// ─────────────────────────────────────────────────────────────────────────────
// OverrideSource type + label tables
// ─────────────────────────────────────────────────────────────────────────────

export type OverrideSource =
  | 'role_baseline'
  | 'grant_override'
  | 'revoke_override'

export type OverrideSourceBadgeVariant = 'long' | 'compact'

const SOURCE_LABEL_LONG: Record<OverrideSource, string> = {
  role_baseline: 'Role baseline',
  grant_override: 'Grant override',
  revoke_override: 'Revoke override',
}

const SOURCE_LABEL_COMPACT: Record<OverrideSource, string> = {
  role_baseline: 'Baseline',
  grant_override: 'Grant',
  revoke_override: 'Revoke',
}

// ─────────────────────────────────────────────────────────────────────────────
// <OverrideSourceBadge>
// ─────────────────────────────────────────────────────────────────────────────

export interface OverrideSourceBadgeProps {
  source: OverrideSource
  /** `'long'` (default) renders "Role baseline" / "Grant override" /
   *  "Revoke override". `'compact'` renders "Baseline" / "Grant" / "Revoke"
   *  for table-cell density (used by SI-USR-007). */
  variant?: OverrideSourceBadgeVariant
  className?: string
}

/**
 * Pill rendering the source of a permission row — role baseline, grant
 * override, or revoke override. Glyph + tonal container mapping is shared
 * across consumers; the only knob is `variant` for label length.
 *
 * Note: the compact baseline pill drops the icon (matches USR-007's
 * inline pre-extraction shape) so a 5-character label doesn't get
 * dwarfed by a 12-px shield glyph.
 */
export function OverrideSourceBadge({
  source,
  variant = 'long',
  className,
}: OverrideSourceBadgeProps) {
  const labels =
    variant === 'long' ? SOURCE_LABEL_LONG : SOURCE_LABEL_COMPACT

  if (source === 'role_baseline') {
    if (variant === 'compact') {
      return (
        <span
          data-slot="override-source-badge"
          data-source="role_baseline"
          data-variant="compact"
          className={cn(
            'inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface',
            className,
          )}
        >
          {labels.role_baseline}
        </span>
      )
    }
    return (
      <span
        data-slot="override-source-badge"
        data-source="role_baseline"
        data-variant="long"
        className={cn(
          'inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface',
          className,
        )}
      >
        <Shield className="h-3 w-3" aria-hidden />
        {labels.role_baseline}
      </span>
    )
  }
  if (source === 'grant_override') {
    return (
      <span
        data-slot="override-source-badge"
        data-source="grant_override"
        data-variant={variant}
        className={cn(
          'inline-flex items-center gap-1 rounded-pill bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container',
          className,
        )}
      >
        <ShieldCheck className="h-3 w-3" aria-hidden />
        {labels.grant_override}
      </span>
    )
  }
  return (
    <span
      data-slot="override-source-badge"
      data-source="revoke_override"
      data-variant={variant}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-on-error-container',
        className,
      )}
    >
      <ShieldX className="h-3 w-3" aria-hidden />
      {labels.revoke_override}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// <OverrideExpiryBand>
// ─────────────────────────────────────────────────────────────────────────────

export type ExpiryBand = 'urgent' | 'soon' | 'routine'

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function bandFor(
  days: number,
  urgentThresholdDays: number,
  soonThresholdDays: number,
): ExpiryBand {
  if (days <= urgentThresholdDays) return 'urgent'
  if (days <= soonThresholdDays) return 'soon'
  return 'routine'
}

function formatDayLabel(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'in 1 day'
  if (days < 0) {
    const ago = Math.abs(days)
    return `${ago} day${ago === 1 ? '' : 's'} ago`
  }
  return `in ${days} days`
}

function isoSlice(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export interface OverrideExpiryBandProps {
  /** `undefined` returns null so consumers can pass through optional
   *  fields without an `if (expiresAt)` wrapper. */
  expiresAt: Date | undefined
  /** Days from today (inclusive) at which a row is considered urgent.
   *  Default 7 — matches USR-007's "0–7 days" urgent band. */
  urgentThresholdDays?: number
  /** Days from today (inclusive) at which a row is considered soon.
   *  Default 30 — matches USR-007's "8–30 days" soon band. */
  soonThresholdDays?: number
  className?: string
}

/**
 * Tonal pill that renders an expiry date plus a relative-day label
 * ("in 3 days", "today", "5 days ago"), tinted by the day-band the date
 * falls into. Returns `null` when `expiresAt` is undefined so consumers
 * can pass through optional values directly.
 */
export function OverrideExpiryBand({
  expiresAt,
  urgentThresholdDays = 7,
  soonThresholdDays = 30,
  className,
}: OverrideExpiryBandProps) {
  if (expiresAt === undefined) return null

  const days = daysUntil(expiresAt)
  const band = bandFor(days, urgentThresholdDays, soonThresholdDays)
  const tone =
    band === 'urgent'
      ? 'bg-error-container text-on-error-container'
      : band === 'soon'
        ? 'bg-tertiary-container text-on-tertiary-container'
        : 'bg-surface-container-high text-on-surface'
  const iso = isoSlice(expiresAt)
  const dayLabel = formatDayLabel(days)

  return (
    <span
      data-slot="override-expiry-band"
      data-band={band}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums',
        tone,
        className,
      )}
      aria-label={`Expires ${iso} (${dayLabel})`}
    >
      <CalendarClock className="h-3 w-3" aria-hidden />
      <span>{iso}</span>
      <span className="opacity-70">·</span>
      <span>{dayLabel}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// <OverrideReasonInput>
// ─────────────────────────────────────────────────────────────────────────────

export interface OverrideReasonCode {
  readonly value: string
  readonly label: string
}

export interface OverrideReasonInputProps {
  reasonCode: string
  onReasonCodeChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  /** Catalog of canonical reason codes — owned by the consumer (FR15a /
   *  FR15c). The shell renders them verbatim; never invents codes. */
  reasonCodes: ReadonlyArray<OverrideReasonCode>
  /** Minimum characters required in the notes textarea. Default 10. */
  minChars?: number
  /** Placeholder for the textarea — varies by mode in USR-006. */
  notesPlaceholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Combined reason-code dropdown + free-text notes textarea with character
 * counter and minimum-char hint. Shared between SI-USR-006 (the Tier 1
 * grant / revoke / edit form) and any future override-mutation surface
 * that needs an FR15a-compliant reason capture.
 *
 * The reason-code catalog is consumer-owned — the canonical 7-code list
 * lives in SI-USR-005 as `REASON_CODE_LABEL` and is passed in here as the
 * `reasonCodes` prop. Keeping the catalog out of the shell prevents this
 * file from carrying business-logic constants that may evolve per epic.
 */
export function OverrideReasonInput({
  reasonCode,
  onReasonCodeChange,
  notes,
  onNotesChange,
  reasonCodes,
  minChars = 10,
  notesPlaceholder,
  disabled = false,
  className,
}: OverrideReasonInputProps) {
  const reactId = useId()
  const codeId = `${reactId}-reason-code`
  const notesId = `${reactId}-reason-notes`
  const trimmedLength = notes.trim().length

  return (
    <div
      data-slot="override-reason-input"
      className={cn('grid grid-cols-1 tablet:grid-cols-2 gap-4', className)}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={codeId}
          className="text-xs font-medium text-on-surface"
        >
          Reason code
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        </label>
        <div className="relative">
          <select
            id={codeId}
            aria-required="true"
            disabled={disabled}
            value={reasonCode}
            onChange={(e) => onReasonCodeChange(e.target.value)}
            className="h-11 w-full appearance-none rounded-sm bg-surface-container-highest pl-3 pr-9 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            <option value="" disabled>
              Pick a reason code
            </option>
            {reasonCodes.map((rc) => (
              <option key={rc.value} value={rc.value}>
                {rc.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant"
            aria-hidden
          />
        </div>
        <span className="text-[11px] text-on-surface-variant">
          Reason code. The audit row pivots on this value
          for compliance reports.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={notesId}
          className="text-xs font-medium text-on-surface"
        >
          Notes
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        </label>
        <textarea
          id={notesId}
          aria-required="true"
          rows={4}
          disabled={disabled}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={notesPlaceholder}
          className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        />
        <span className="text-[11px] text-on-surface-variant">
          {trimmedLength} / {minChars} chars minimum
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// <OverrideCard>
// ─────────────────────────────────────────────────────────────────────────────

export interface OverrideCardProps {
  permissionKey: string
  permissionDescription: string
  source: OverrideSource
  /** Human-readable label for the reason code — the consumer resolves the
   *  raw code via its own `REASON_CODE_LABEL` map before passing in. */
  reasonCode?: string
  reasonNotes?: string
  expiresAt?: Date
  /** Audit reference (e.g. `OVR-2026-00184`) — when present, renders an
   *  inline link to SI-INF-005 filtered by this entity. */
  auditLinkId?: string
  /** Slot for renewal / revoke-now / open-effective-view buttons. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Card-shaped variant of the override row, intended for Arc (c) production
 * frontend use — the Epic 2 mockups render override info in tables. Combines
 * permission key + description (header), source badge, expiry band, reason
 * code + free-text notes, audit link, and a flexible actions slot.
 *
 * The card uses `bg-surface-container-low` as its base and never inherits
 * the source-tone colour for the whole card — keeping the source signal
 * localised to the badge avoids a noisy permissions inbox where every
 * row screams red or green.
 */
export function OverrideCard({
  permissionKey,
  permissionDescription,
  source,
  reasonCode,
  reasonNotes,
  expiresAt,
  auditLinkId,
  actions,
  className,
}: OverrideCardProps) {
  return (
    <div
      data-slot="override-card"
      data-source={source}
      className={cn(
        'rounded-md bg-surface-container-low p-4 flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-xs text-on-surface truncate">
            {permissionKey}
          </span>
          <span className="text-[11px] text-on-surface-variant">
            {permissionDescription}
          </span>
        </div>
        <OverrideSourceBadge source={source} variant="long" />
      </div>

      {(reasonCode || reasonNotes || expiresAt) ? (
        <div className="flex flex-col gap-2">
          {reasonCode ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Reason
              </span>
              <span className="text-xs font-medium text-on-surface">
                {reasonCode}
              </span>
              {reasonNotes ? (
                <span className="text-[11px] text-on-surface-variant">
                  {reasonNotes}
                </span>
              ) : null}
            </div>
          ) : null}
          {expiresAt ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Expires
              </span>
              <OverrideExpiryBand expiresAt={expiresAt} />
            </div>
          ) : null}
        </div>
      ) : null}

      {(auditLinkId || actions) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {auditLinkId ? (
            <Link
              to={`/audit?entityRef=${encodeURIComponent(auditLinkId)}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm bg-surface-container-lowest px-2.5 py-1.5',
                'text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                'transition-colors min-h-[44px] tablet:min-h-[32px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              aria-label={`Audit history for ${auditLinkId}`}
            >
              <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-mono text-[11px] text-on-surface">
                {auditLinkId}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
