import { useMemo } from 'react'
import { MessageCircle, MessagesSquare, Send } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'

/**
 * CCIssueCommentThread — chronological comment thread for SI-INF-008.
 *
 * Phase 4 Epic 3 INF Arc (b) Task B3 — first appearance of the issue-tracker
 * comments surface (DL-039 full scope). Renders a vertical list of comment
 * cards (author label + optional role chip + relative timestamp on the top
 * row, body below) with a composer at the bottom (textarea + "Comment"
 * submit). A small "Live" indicator at the top-right reflects the production
 * Realtime channel #5 (`issue_tracker_threads` per DL-010) — visual only in
 * the mockup; Arc (c) Task C8b wires the actual subscription via
 * `apps/web/src/realtime/`.
 *
 * Comments are inherently append-only (the underlying
 * `issue_ticket_comments` table is brand-scoped INSERT-only — see
 * `apps/api/src/db/schema/issue-tickets.ts`); the shell does not surface
 * an edit affordance for that reason.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface_container_lowest,
 * surface_container_low, surface_container, surface_container_high,
 * on_surface, on_surface_variant, primary, status_confirmed (Live dot),
 * outline_variant.
 *
 * Borders: only `focus-visible:` rings on the textarea / send button. No
 * sectioning borders. Tonal break between thread and composer comes from
 * the surface-tone shift, not a divider line.
 *
 * Animation: NONE per CLAUDE.md (entrance animations on data forms banned).
 * Tailwind hover/focus transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueComment {
  readonly id: string
  readonly authorUserId: string
  /** Resolved display name (e.g. "Rohan Mehta"). */
  readonly authorLabel: string
  /** Optional role chip (e.g. "Cluster Manager"). */
  readonly authorRoleLabel?: string
  readonly body: string
  /** ISO-8601 timestamp. */
  readonly createdAt: string
}

export interface CCIssueCommentThreadProps {
  readonly comments: ReadonlyArray<IssueComment>
  readonly composerValue: string
  readonly onComposerChange: (value: string) => void
  readonly onSubmitComment: () => void
  /**
   * Visual-only Realtime indicator. Production wires Realtime channel #5
   * subscription state into this prop.
   */
  readonly liveIndicator: boolean
  /** Scope label for empty state — e.g. "ISS-2026-001". */
  readonly scopeLabel?: string
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RELATIVE_FALLBACK = '2026-05-08T11:14:00+05:30'

/** Lightweight relative-time formatter — mockup-side only. */
function relativeTime(iso: string, nowIso = RELATIVE_FALLBACK): string {
  const diffMs = new Date(nowIso).getTime() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return iso
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} d ago`
  return new Date(iso).toISOString().slice(0, 10)
}

/** Author initials for the avatar bubble — at most 2 letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CCIssueCommentThread({
  comments,
  composerValue,
  onComposerChange,
  onSubmitComment,
  liveIndicator,
  scopeLabel,
  className,
}: CCIssueCommentThreadProps) {
  const trimmed = composerValue.trim()
  const canSubmit = trimmed.length > 0

  const ordered = useMemo(
    () =>
      [...comments].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [comments],
  )

  return (
    <div
      className={cn(
        'flex flex-col rounded-md bg-surface-container-lowest',
        className,
      )}
    >
      {/* Header strip — title + Live indicator. */}
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <MessagesSquare
            className="h-4 w-4 text-on-surface-variant"
            aria-hidden
          />
          <h3 className="text-sm font-semibold text-on-surface">
            Comments
            <span className="ml-2 text-xs font-normal text-on-surface-variant tabular-nums">
              {ordered.length}
            </span>
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium',
            liveIndicator
              ? 'bg-surface-container text-on-surface'
              : 'bg-surface-container-low text-on-surface-variant',
          )}
          aria-live="polite"
          aria-label={liveIndicator ? 'Realtime live' : 'Realtime not connected'}
        >
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-pill',
              liveIndicator ? 'bg-tertiary' : 'bg-outline-variant',
            )}
          />
          {liveIndicator ? 'Live' : 'Offline'}
        </span>
      </header>

      {/* Thread body. */}
      <div className="flex flex-col gap-2 px-4 pb-3">
        {ordered.length === 0 ? (
          <div className="rounded-sm bg-surface-container-low p-6 text-center">
            <MessageCircle
              className="mx-auto h-6 w-6 text-on-surface-variant"
              aria-hidden
            />
            <p className="mt-2 text-sm font-medium text-on-surface">
              No comments yet
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {scopeLabel
                ? `Be the first to comment on ${scopeLabel}.`
                : 'Be the first to add a comment to this ticket.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordered.map((c) => (
              <li
                key={c.id}
                className="rounded-sm bg-surface-container-low p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-surface-container-high text-[11px] font-semibold text-on-surface"
                    >
                      {initialsOf(c.authorLabel)}
                    </span>
                    <span className="text-sm font-semibold text-on-surface truncate">
                      {c.authorLabel}
                    </span>
                    {c.authorRoleLabel ? (
                      <span className="inline-flex items-center rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                        {c.authorRoleLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer — tonal section against the thread surface above. */}
      <div className="flex flex-col gap-2 rounded-b-md bg-surface-container-low px-4 py-3">
        <label htmlFor="cc-issue-comment-composer" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="cc-issue-comment-composer"
          value={composerValue}
          onChange={(e) => onComposerChange(e.target.value)}
          rows={3}
          placeholder="Add a comment — Cmd/Ctrl + Enter to send."
          className={cn(
            'rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface',
            'placeholder:text-on-surface-variant resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
              e.preventDefault()
              onSubmitComment()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-on-surface-variant">
            Markdown is rendered as plain text in the mockup. Comments are
            append-only — see SI-INF-005 for the audit history.
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={onSubmitComment}
            aria-label="Submit comment"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}
