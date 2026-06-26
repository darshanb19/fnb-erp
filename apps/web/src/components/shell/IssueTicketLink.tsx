import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Flag, Send } from 'lucide-react'

import { Button } from './Button'
import { Input } from './Input'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { cn } from '@/lib/utils'

/**
 * IssueTicketLink — CC-ISSUE-TICKET-LINK canonical chip (FR22).
 *
 * Per-screen affordance to either raise a NEW issue ticket against the
 * current entity, or jump to existing ticket(s). Renders as a small ghost
 * chip with the `flag` Lucide glyph and one of two labels:
 *
 *   - `existingTicketCount === 0` (default) — "Raise issue"
 *   - `existingTicketCount > 0`             — "View N tickets"
 *
 * On click, opens a `<Popover>` with two visual sections:
 *   - "Raise new ticket" form skeleton (subject, severity, description,
 *     submit). All inputs visual-only — no actual ticket service is wired.
 *   - When existing tickets are present, a list of those tickets each
 *     linking to `/SI-INF-008?ticket={id}`.
 *
 * Visual contract follows DESIGN.md §5.2 (no resting border) + §12.6
 * (chip/affordance pattern). Hit target ≥44 px on mobile per §15.4.
 *
 * No animation per CLAUDE.md animation policy + DESIGN.md §10.3.
 */

export interface IssueTicketLinkExistingTicket {
  readonly id: string
  readonly subject: string
  readonly severity: 'low' | 'medium' | 'high'
}

export interface IssueTicketLinkProps {
  /** Entity reference (TRN or stable ID) the new ticket would attach to. */
  entityRef: string
  /** Number of existing tickets against this entity. Default `0`. */
  existingTicketCount?: number
  /** Optional list of existing tickets — drives the "View N tickets" list. */
  existingTickets?: ReadonlyArray<IssueTicketLinkExistingTicket>
  className?: string
}

const SEVERITY_OPTIONS: ReadonlyArray<{ value: 'low' | 'medium' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function IssueTicketLink({
  entityRef,
  existingTicketCount = 0,
  existingTickets = [],
  className,
}: IssueTicketLinkProps) {
  const [open, setOpen] = useState(false)
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')

  const hasExisting = existingTicketCount > 0
  const triggerLabel = hasExisting
    ? `View ${existingTicketCount} ticket${existingTicketCount > 1 ? 's' : ''}`
    : 'Raise issue'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasExisting ? 'tonal' : 'ghost'}
          size="sm"
          className={cn(
            'h-11 px-3 gap-1.5 rounded-pill min-h-[44px] tablet:h-9',
            className,
          )}
          aria-label={`${triggerLabel} for ${entityRef}`}
        >
          <Flag className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs font-medium">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Raise new ticket
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Attaches to{' '}
              <span className="font-mono text-on-surface">{entityRef}</span>.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`itl-subject-${entityRef}`}
              className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
            >
              Subject
            </label>
            <Input
              id={`itl-subject-${entityRef}`}
              placeholder="Short summary"
              aria-label="Ticket subject"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Severity
            </span>
            <div className="flex gap-1" role="radiogroup" aria-label="Ticket severity">
              {SEVERITY_OPTIONS.map((opt) => {
                const active = severity === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSeverity(opt.value)}
                    className={cn(
                      'flex-1 rounded-pill px-3 py-1.5 text-xs font-medium min-h-[36px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`itl-desc-${entityRef}`}
              className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
            >
              Description
            </label>
            <textarea
              id={`itl-desc-${entityRef}`}
              rows={3}
              placeholder="What is going wrong?"
              aria-label="Ticket description"
              className={cn(
                'rounded-sm bg-surface-container-low px-3 py-2 text-sm text-on-surface',
                'placeholder:text-on-surface-variant',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'resize-none',
              )}
            />
          </div>

          <Button
            variant="default"
            size="sm"
            className="self-end"
            onClick={() => setOpen(false)}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Submit ticket
          </Button>

          {hasExisting ? (
            <div className="mt-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                Existing tickets ({existingTicketCount})
              </p>
              <ul className="flex flex-col gap-1">
                {existingTickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/issues/${encodeURIComponent(t.id)}`}
                      className={cn(
                        'group flex items-center justify-between gap-2 rounded-sm px-2 py-2',
                        'bg-surface-container-low hover:bg-surface-container-high',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'min-h-[44px]',
                      )}
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          {t.id}
                        </span>
                        <span className="text-xs text-on-surface truncate">
                          {t.subject}
                        </span>
                      </span>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-on-surface-variant opacity-60 group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
