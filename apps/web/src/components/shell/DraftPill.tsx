import { cn } from '@/lib/utils'
import { StatusPill } from './StatusPill'

/**
 * DraftPill — CC-DRAFT-PILL canonical chip (P2B-001 + FR68 + FR117).
 *
 * DESIGN.md §6.2 status-durability rule: every form / data-entry surface
 * MUST visibly indicate whether the current entry is in `status_draft`
 * (not durable; will not survive a session interruption) or any
 * non-draft state (durable; persisted to the store and recoverable).
 *
 * Visual contract:
 *   - `isDraft={true}`  → renders <StatusPill status="status_draft" />.
 *     Optionally surfaces an eyebrow label "DRAFT — NOT YET SAVED" above
 *     the pill on mobile breakpoints when `mobileEyebrow` is set; the
 *     eyebrow is hidden at `tablet:` and up because the pill itself sits
 *     in the form header where its meaning is already obvious from
 *     proximity to the field group.
 *   - `isDraft={false}` → renders <StatusPill status="status_confirmed" />.
 *     This is the explicit "saved" affirmation §6.2 demands — silence is
 *     not an acceptable signal; durability must be VISIBLE.
 *
 * NOT a wrapper around the form element itself — DraftPill is the chip
 * placed in the form header (or inline beside the SaveCTA, depending on
 * the screen). It does not own the `isDirty` state; the consumer threads
 * that state in.
 *
 * Use:
 *   <DraftPill isDraft mobileEyebrow />   // unsaved entry
 *   <DraftPill isDraft={false} />         // durable entry
 */
export interface DraftPillProps {
  /** Whether the current form entry has unsaved changes / is in draft state. */
  isDraft: boolean
  /**
   * Render a "DRAFT — NOT YET SAVED" eyebrow above the pill on mobile only.
   * Defaults to `false`. Honoured only when `isDraft` is true.
   */
  mobileEyebrow?: boolean
  className?: string
}

export function DraftPill({
  isDraft,
  mobileEyebrow = false,
  className,
}: DraftPillProps) {
  if (isDraft) {
    return (
      <div
        data-slot="draft-pill"
        className={cn('inline-flex flex-col items-start gap-1', className)}
      >
        {mobileEyebrow ? (
          <span
            aria-hidden
            className="tablet:hidden text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            Draft — not yet saved
          </span>
        ) : null}
        <StatusPill
          status="status_draft"
          label="Draft — not yet saved"
          size="sm"
        />
      </div>
    )
  }
  return (
    <div
      data-slot="draft-pill"
      className={cn('inline-flex items-center', className)}
    >
      <StatusPill status="status_confirmed" label="Saved" size="sm" />
    </div>
  )
}
