/**
 * CCVoiceInput — CC-VOICE-INPUT pattern, FR112, DL-047.
 *
 * Scope: quantity-field input only. Not a general-purpose voice component.
 * Renders a numeric/decimal `<Input>` with an inline mic affordance for
 * hands-busy kitchen / store-room entry. When listening, shows an inline
 * strip (NOT a modal) with accept / cancel controls below the field.
 *
 * Motion note: the three pulsing dots use `animate-pulse motion-reduce:animate-none`.
 * This is the sole animation in the component and is a reduced-motion-guarded
 * interaction-feedback pattern on a control, NOT an entrance animation —
 * DESIGN.md §10.3 / §10.5.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from './Input'
import { Button } from './Button'
import { Mic, Check, X } from 'lucide-react'

export interface CCVoiceInputProps {
  value: string
  onChange: (next: string) => void
  unit?: string
  placeholder?: string
  'aria-label': string
  disabled?: boolean
  simulatedHeardValue?: string
  className?: string
}

export function CCVoiceInput({
  value,
  onChange,
  unit,
  placeholder,
  'aria-label': ariaLabel,
  disabled,
  simulatedHeardValue,
  className,
}: CCVoiceInputProps): JSX.Element {
  const [listening, setListening] = useState(false)

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Field row */}
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          className="pr-20"
        />

        {/* Unit label — absolute, clears the mic button */}
        {unit && (
          <span className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none select-none">
            {unit}
          </span>
        )}

        {/* Mic button — 44×44 minimum touch target */}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Enter quantity by voice"
          disabled={disabled}
          onClick={() => setListening(true)}
          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 p-0 flex items-center justify-center"
        >
          <Mic className="h-4 w-4" />
        </Button>
      </div>

      {/* Listening strip — inline, NOT a modal */}
      {listening && (
        <div
          role="status"
          aria-live="polite"
          className="bg-surface-container-low rounded-sm px-3 py-2 flex items-center gap-2 text-sm text-on-surface"
        >
          {/* Pulsing indicator dots — the ONLY animation in this component */}
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />

          <span className="text-on-surface-variant">Listening…</span>

          <span className="font-medium">{simulatedHeardValue ?? value}</span>

          <Button
            size="sm"
            variant="tonal"
            aria-label="Use heard value"
            onClick={() => {
              onChange(simulatedHeardValue ?? value)
              setListening(false)
            }}
          >
            <Check className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            aria-label="Cancel voice entry"
            onClick={() => setListening(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
