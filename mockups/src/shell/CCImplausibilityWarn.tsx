import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * CCImplausibilityWarn — CC-IMPLAUSIBILITY-WARN canonical (DL-047).
 *
 * Inline warn-and-log panel surfaced on stock-movement forms (goods receipt,
 * transfer, adjustment) when an entered quantity falls outside the expected
 * plausibility envelope computed server-side (FR114: warn-and-log, never
 * hard-block). The user is prompted to select a structured reason code before
 * overriding; the reason code and the original quantity are captured in the
 * audit log so the overridden entry can be reviewed asynchronously (FR114
 * warn-and-log; FR115 is the separate duplicate-detection pattern).
 *
 * Warn-and-log philosophy: this component NEVER disables a downstream submit.
 * It is advisory only — the `overridden` state is the acknowledgement signal.
 * Callers gate the Button on `selectedReason`, not on the form's submit action.
 *
 * Sibling: {@link CCDuplicateWarn} (DL-026) — same warn-and-log idiom for
 * duplicate-detection on master-data create. Structural pattern mirrored here.
 *
 * Token / icon choice: uses `warning` token + `AlertTriangle` to distinguish
 * visually from CCDuplicateWarn's `status_overridden` pip + `AlertCircle`.
 * `warning` is the canonical DESIGN.md §6.1 token for "plausible but unusual"
 * states that warrant attention without implying an error. `AlertTriangle`
 * reinforces the "caution, not error" semantic at a glance.
 *
 * Cross-references: DL-047 (this component), FR114 (implausibility warn-and-log;
 * the override + reason are captured in the audit log), DL-026 (CCDuplicateWarn
 * sibling — note FR115 is the *duplicate*-detection pattern, not this one),
 * DESIGN.md §6.1 (canonical 20 status tokens).
 */

export interface ImplausibilityReasonCode {
  value: string
  label: string
}

export interface CCImplausibilityWarnProps {
  message: string
  reasonCodes: ReadonlyArray<ImplausibilityReasonCode>
  selectedReason: string | null
  onSelectReason: (value: string) => void
  onOverride: () => void
  overridden: boolean
  className?: string
}

export function CCImplausibilityWarn({
  message,
  reasonCodes,
  selectedReason,
  onSelectReason,
  onOverride,
  overridden,
  className,
}: CCImplausibilityWarnProps): JSX.Element | null {
  if (overridden) {
    const selectedLabel =
      reasonCodes.find((r) => r.value === selectedReason)?.label ?? selectedReason ?? ''

    return (
      <div
        data-slot="cc-implausibility-warn"
        data-overridden="true"
        className={cn(
          'flex items-center gap-2 bg-surface-container-low rounded-sm px-3 py-2',
          className,
        )}
      >
        <AlertTriangle
          aria-hidden
          size={14}
          className="shrink-0 text-on-surface-variant"
        />
        <span className="text-xs text-on-surface-variant">
          Overridden · {selectedLabel}
        </span>
      </div>
    )
  }

  return (
    <div
      data-slot="cc-implausibility-warn"
      role="alert"
      className={cn('flex', className)}
    >
      {/* Left status pip — allow-listed border pattern per DESIGN.md §5.2 */}
      <div className="border-l-4 border-warning shrink-0" />

      <div className="flex flex-col gap-3 bg-surface-container rounded-sm p-3 flex-1 min-w-0">
        {/* Top row: icon + message */}
        <div className="flex items-start gap-2">
          <AlertTriangle
            aria-hidden
            size={16}
            className="shrink-0 text-warning mt-0.5"
          />
          <span className="text-sm text-on-surface">{message}</span>
        </div>

        {/* Reason selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-on-surface-variant font-medium">
            Reason · required
          </label>
          <Select
            aria-label="Implausibility override reason"
            value={selectedReason ?? undefined}
            onValueChange={onSelectReason}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent>
              {reasonCodes.map((code) => (
                <SelectItem key={code.value} value={code.value}>
                  {code.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Override CTA */}
        <div className="flex justify-end">
          <Button
            variant="tonal"
            size="sm"
            disabled={!selectedReason}
            onClick={onOverride}
          >
            <Check size={14} aria-hidden />
            Override &amp; continue
          </Button>
        </div>
      </div>
    </div>
  )
}
