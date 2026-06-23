/**
 * CCVoiceInput — CC-VOICE-INPUT pattern, FR112, DL-047.
 *
 * Quantity-field input with an optional mic affordance, progressively enhanced
 * with the browser-native Web Speech API. The mic shows only where recognition
 * is supported; typing (inputMode="decimal") is always available. The three
 * pulsing dots use `animate-pulse motion-reduce:animate-none` — the sole
 * animation in this Arc, a reduced-motion-guarded interaction-feedback pattern
 * on a control, NOT an entrance animation (DESIGN.md §10.3 / §10.5).
 */
import { useRef, useState } from 'react'
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
  className?: string
}

// Minimal structural typing for the Web Speech API (not in the default DOM lib).
interface SpeechRecognitionResultLike {
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Parse a spoken transcript to a decimal string, e.g. "five point five kg" → "5.5". */
function parseTranscriptToDecimal(transcript: string): string | null {
  const cleaned = transcript.toLowerCase().replace(/\bpoint\b/g, '.').replace(/[^0-9.]/g, ' ').trim()
  const match = cleaned.match(/\d+(\.\d+)?/)
  return match ? match[0] : null
}

export function CCVoiceInput({
  value,
  onChange,
  unit,
  placeholder,
  'aria-label': ariaLabel,
  disabled,
  className,
}: CCVoiceInputProps): JSX.Element {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const ctor = getRecognitionCtor()
  const supported = ctor !== null

  function stop() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    if (!ctor) return
    const recognition = new ctor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      const parsed = parseTranscriptToDecimal(transcript)
      if (parsed !== null) setHeard(parsed)
    }
    recognition.onerror = () => stop()
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognitionRef.current = recognition
    setHeard(null)
    setListening(true)
    recognition.start()
  }

  function accept() {
    if (heard !== null) onChange(heard)
    stop()
    setHeard(null)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          className={supported ? 'pr-20' : 'pr-12'}
        />
        {unit && (
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none select-none',
              supported ? 'right-12' : 'right-3',
            )}
          >
            {unit}
          </span>
        )}
        {supported && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Enter quantity by voice"
            disabled={disabled}
            onClick={startListening}
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 p-0 flex items-center justify-center"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
      </div>

      {listening && (
        <div
          role="status"
          aria-live="polite"
          className="bg-surface-container-low rounded-sm px-3 py-2 flex items-center gap-2 text-sm text-on-surface"
        >
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="text-on-surface-variant">Listening…</span>
          <span className="font-medium">{heard ?? '—'}</span>
          <Button
            size="sm"
            variant="tonal"
            aria-label="Use heard value"
            disabled={heard === null}
            onClick={accept}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Cancel voice entry" onClick={stop}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
