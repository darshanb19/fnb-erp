import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

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
        className={cn('flex items-center gap-2 bg-surface-container-low rounded-sm px-3 py-2', className)}
      >
        <AlertTriangle aria-hidden size={14} className="shrink-0 text-on-surface-variant" />
        <span className="text-xs text-on-surface-variant">Overridden · {selectedLabel}</span>
      </div>
    )
  }

  return (
    <div data-slot="cc-implausibility-warn" role="alert" className={cn('flex', className)}>
      <div className="border-l-4 border-warning shrink-0" />
      <div className="flex flex-col gap-3 bg-surface-container rounded-sm p-3 flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <AlertTriangle aria-hidden size={16} className="shrink-0 text-warning mt-0.5" />
          <span className="text-sm text-on-surface">{message}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cc-implausibility-reason" className="text-xs text-on-surface-variant font-medium">
            Reason · required
          </label>
          <select
            id="cc-implausibility-reason"
            aria-label="Implausibility override reason"
            value={selectedReason ?? ''}
            onChange={(e) => onSelectReason(e.target.value)}
            className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="" disabled>
              Select a reason…
            </option>
            {reasonCodes.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button variant="tonal" size="sm" disabled={!selectedReason} onClick={onOverride}>
            <Check size={14} aria-hidden />
            Override &amp; continue
          </Button>
        </div>
      </div>
    </div>
  )
}
