import { useState } from 'react'
import { Info, Mail, MessageCircle, RotateCcw, BellOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Input } from './Input'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { SectionShift } from './SectionShift'

/**
 * CCNotificationPreferenceMatrix — CC-NOTIFICATION-PREFERENCE-MATRIX canonical.
 *
 * Per-category × per-channel toggle grid + quiet-hours window. Rows are the
 * canonical 13 notification types seeded by migration 0011; columns are the
 * three delivery channels (in-app / email / digest-batching).
 *
 * DL-035: every email-channel toggle renders disabled with a tooltip
 * "Email channel coming when sending domain registered". Toggle state is
 * still preserved internally so post-MVP flipping is a one-line removal of
 * the disabled affordance + sending-domain provisioning. The header's email
 * column also carries a small info chip pointing back to the same DL-035
 * note.
 *
 * UX shape:
 *   - Header strip: "Preferences" title + "Reset to role defaults" button.
 *   - Matrix grid: rows = categories, columns = channels (In-app | Email
 *     [greyed] | Digest [if eligible]). A small inline `<Switch>` primitive
 *     drives each cell — built locally because no other shell consumer
 *     needs it yet.
 *   - Quiet-hours strip: start + end time inputs, Apply button. Empty state
 *     ("no quiet hours set") when both null.
 *
 * Tokens: surface, surface_container_lowest, surface_container_low,
 * surface_container, surface_container_high, on_surface, on_surface_variant,
 * primary, status_confirmed (enabled toggles), outline_variant.
 *
 * Borders: only `focus-visible:` rings on inputs / switches per the
 * §5.2 / §9.3 allow-list. Tonal section breaks via `<SectionShift>` between
 * the matrix grid and the quiet-hours strip.
 *
 * Animation: NONE per CLAUDE.md — admin form. Tailwind hover transitions
 * only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationEmailMode = 'none' | 'immediate' | 'digest'

export interface NotificationCategory {
  /** Canonical type key from migration 0011 (e.g. 'approval.requested'). */
  readonly type: string
  /** Human label (e.g. "Approval requests"). */
  readonly label: string
  /** Short helper text rendered under the label. */
  readonly description?: string
  /** Whether the digest-batching toggle is available for this row. */
  readonly digestEligible: boolean
  /** Role-default values; rendered when no override exists. */
  readonly defaults: {
    readonly inApp: boolean
    /** Always 'none' in MVP per DL-035 — preserved for post-MVP. */
    readonly emailMode: NotificationEmailMode
    readonly digestWindow: 'daily' | null
  }
}

export interface NotificationPreferenceOverride {
  readonly type: string
  /** null → use defaults.inApp. */
  readonly inAppOverride: boolean | null
  /** null → use defaults (effectively false in MVP). */
  readonly emailOverride: boolean | null
  /** null → use defaults.digestWindow != null. */
  readonly digestBatchOverride: boolean | null
}

export interface QuietHoursWindow {
  /** "HH:MM" 24-hour. null when not set. */
  readonly startTime: string | null
  readonly endTime: string | null
}

export type PreferenceChannel = 'inApp' | 'email' | 'digestBatch'

export interface CCNotificationPreferenceMatrixProps {
  readonly categories: ReadonlyArray<NotificationCategory>
  readonly overrides: ReadonlyArray<NotificationPreferenceOverride>
  readonly quietHours: QuietHoursWindow
  readonly onTogglePreference: (
    type: string,
    channel: PreferenceChannel,
    value: boolean,
  ) => void
  readonly onSetQuietHours: (window: QuietHoursWindow) => void
  readonly onResetToDefaults: () => void
  /**
   * MVP literal `true` — per DL-035 the email column is always rendered
   * disabled regardless of consumer state. Typing as the literal forces
   * every consumer to acknowledge the constraint at the call site so that
   * post-MVP migration is one explicit type change, not a silent default.
   */
  readonly emailDisabled: true
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Switch primitive (local — no other shell consumer yet)
// ─────────────────────────────────────────────────────────────────────────────

interface SwitchProps {
  readonly checked: boolean
  readonly onCheckedChange: (next: boolean) => void
  readonly disabled?: boolean
  readonly ariaLabel: string
}

function Switch({ checked, onCheckedChange, disabled, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        checked ? 'bg-primary' : 'bg-surface-container-high',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-on-primary shadow-sm transition-transform',
          checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_DISABLED_TOOLTIP =
  'Email channel coming when sending domain registered.'

function effectiveValue(
  category: NotificationCategory,
  override: NotificationPreferenceOverride | undefined,
  channel: PreferenceChannel,
): boolean {
  switch (channel) {
    case 'inApp':
      return override?.inAppOverride ?? category.defaults.inApp
    case 'email':
      // MVP: emailMode is always 'none' per DL-035. Return any preserved
      // override state so consumers can read what the user toggled.
      return override?.emailOverride ?? category.defaults.emailMode !== 'none'
    case 'digestBatch':
      return (
        override?.digestBatchOverride ??
        category.defaults.digestWindow !== null
      )
  }
}

function findOverride(
  overrides: ReadonlyArray<NotificationPreferenceOverride>,
  type: string,
): NotificationPreferenceOverride | undefined {
  return overrides.find((o) => o.type === type)
}

function isOverridden(
  override: NotificationPreferenceOverride | undefined,
): boolean {
  if (!override) return false
  if (override.inAppOverride !== null) return true
  if (override.emailOverride !== null) return true
  if (override.digestBatchOverride !== null) return true
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CCNotificationPreferenceMatrix({
  categories,
  overrides,
  quietHours,
  onTogglePreference,
  onSetQuietHours,
  onResetToDefaults,
}: CCNotificationPreferenceMatrixProps) {
  // Local draft of quiet-hours inputs so users can type without echoing
  // every keystroke through the consumer's state. Apply commits.
  const [draftStart, setDraftStart] = useState<string>(quietHours.startTime ?? '')
  const [draftEnd, setDraftEnd] = useState<string>(quietHours.endTime ?? '')
  const draftDirty =
    draftStart !== (quietHours.startTime ?? '') ||
    draftEnd !== (quietHours.endTime ?? '')

  const overrideCount = overrides.filter((o) => isOverridden(o)).length

  const canApplyQuietHours =
    draftDirty &&
    // Either both empty (clearing) or both filled (setting).
    ((draftStart === '' && draftEnd === '') ||
      (draftStart !== '' && draftEnd !== ''))

  const handleApplyQuietHours = () => {
    onSetQuietHours({
      startTime: draftStart === '' ? null : draftStart,
      endTime: draftEnd === '' ? null : draftEnd,
    })
  }

  const handleClearQuietHours = () => {
    setDraftStart('')
    setDraftEnd('')
    onSetQuietHours({ startTime: null, endTime: null })
  }

  return (
    <div className="rounded-md bg-surface-container-low p-1">
      {/* Header strip ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">
            Preferences
          </h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {overrideCount === 0
              ? 'All categories using role defaults.'
              : `${overrideCount} ${overrideCount === 1 ? 'category' : 'categories'} customised away from role defaults.`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetToDefaults}
          disabled={overrideCount === 0}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset to role defaults
        </Button>
      </div>

      <SectionShift tone="high" />

      {/* Matrix grid ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-md bg-surface-container-lowest">
        <div role="table" aria-label="Notification preferences" className="min-w-[640px]">
          {/* Column header row */}
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1fr)_7rem_8.5rem_8.5rem] items-center gap-2 px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            <div role="columnheader">Category</div>
            <div role="columnheader" className="flex items-center justify-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              In-app
            </div>
            <div
              role="columnheader"
              className="flex items-center justify-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email
              <EmailDisabledInfo />
            </div>
            <div role="columnheader" className="flex items-center justify-center gap-1.5">
              <BellOff className="h-3.5 w-3.5" aria-hidden />
              Digest batch
            </div>
          </div>

          <SectionShift tone="high" />

          {/* Body rows ─ stable React keys: category.type is the canonical
              migration-0011 type identifier, never reorders. */}
          {categories.map((category) => {
            const override = findOverride(overrides, category.type)
            const inAppOn = effectiveValue(category, override, 'inApp')
            const emailOn = effectiveValue(category, override, 'email')
            const digestOn = effectiveValue(category, override, 'digestBatch')
            const isCustom = isOverridden(override)
            return (
              <div
                key={category.type}
                role="row"
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_7rem_8.5rem_8.5rem] items-start gap-2 px-4 py-3',
                  'hover:bg-surface-container-low transition-colors',
                )}
              >
                <div role="cell" className="flex flex-col gap-0.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      {category.label}
                    </span>
                    {isCustom ? (
                      <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Custom
                      </span>
                    ) : null}
                  </div>
                  {category.description ? (
                    <p className="text-xs text-on-surface-variant">
                      {category.description}
                    </p>
                  ) : null}
                  <p className="font-mono text-[10px] text-on-surface-variant">
                    {category.type}
                  </p>
                </div>
                <div role="cell" className="flex items-center justify-center pt-1">
                  <Switch
                    checked={inAppOn}
                    onCheckedChange={(v) =>
                      onTogglePreference(category.type, 'inApp', v)
                    }
                    ariaLabel={`In-app ${inAppOn ? 'on' : 'off'} for ${category.label}`}
                  />
                </div>
                <div role="cell" className="flex items-center justify-center pt-1">
                  <DisabledEmailToggle
                    checked={emailOn}
                    onCheckedChange={(v) =>
                      onTogglePreference(category.type, 'email', v)
                    }
                    label={category.label}
                  />
                </div>
                <div role="cell" className="flex items-center justify-center pt-1">
                  {category.digestEligible ? (
                    <Switch
                      checked={digestOn}
                      onCheckedChange={(v) =>
                        onTogglePreference(category.type, 'digestBatch', v)
                      }
                      ariaLabel={`Digest batching ${digestOn ? 'on' : 'off'} for ${category.label}`}
                    />
                  ) : (
                    <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                      n/a
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <SectionShift tone="high" className="mt-1" />

      {/* Quiet-hours strip ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 py-4">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Quiet hours</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Suppress in-app banners during this window. Notifications still
            land in the inbox for retrieval.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Start time
            </span>
            <Input
              type="time"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="w-36"
              aria-label="Quiet hours start time"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              End time
            </span>
            <Input
              type="time"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="w-36"
              aria-label="Quiet hours end time"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApplyQuietHours}
              disabled={!canApplyQuietHours}
            >
              Apply
            </Button>
            {quietHours.startTime || quietHours.endTime ? (
              <Button variant="ghost" size="sm" onClick={handleClearQuietHours}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {!quietHours.startTime && !quietHours.endTime ? (
          <p className="text-xs text-on-surface-variant">
            No quiet hours set — in-app banners deliver immediately around the clock.
          </p>
        ) : (
          <p className="text-xs text-on-surface">
            Active window:{' '}
            <span className="font-medium tabular-nums">
              {quietHours.startTime} – {quietHours.endTime}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — email-disabled affordances
// ─────────────────────────────────────────────────────────────────────────────

function EmailDisabledInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Why is email greyed out?"
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full',
            'text-on-surface-variant hover:bg-surface-container-high transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-xs text-on-surface">{EMAIL_DISABLED_TOOLTIP}</p>
        <p className="mt-2 text-[11px] text-on-surface-variant">
          Every notification type seeds with
          email_mode=&apos;none&apos;. Re-enabling is a one-row UPDATE per type
          plus sending-domain provisioning.
        </p>
      </PopoverContent>
    </Popover>
  )
}

interface DisabledEmailToggleProps {
  readonly checked: boolean
  readonly onCheckedChange: (next: boolean) => void
  readonly label: string
}

function DisabledEmailToggle({
  checked,
  onCheckedChange,
  label,
}: DisabledEmailToggleProps) {
  // Wrap the disabled switch in a popover trigger so hover / focus reveals
  // the DL-035 explanation. Click on the wrapper opens the popover; the
  // underlying switch never fires (disabled). We expose `onCheckedChange`
  // anyway so consumers can preserve "what the user would have toggled" for
  // post-MVP migration — invoked only via developer tooling, never via the UI.
  void onCheckedChange
  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Email channel disabled for ${label}`}
          className={cn(
            'inline-flex items-center rounded-pill',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          <Switch
            checked={checked}
            onCheckedChange={() => {
              /* visually disabled — see Popover content for explanation */
            }}
            disabled
            ariaLabel={`Email channel disabled for ${label}`}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-56 p-3">
        <p className="text-xs text-on-surface">{EMAIL_DISABLED_TOOLTIP}</p>
      </PopoverContent>
    </Popover>
  )
}
