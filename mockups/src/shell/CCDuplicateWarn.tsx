import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

/**
 * CCDuplicateWarn — CC-DUPLICATE-WARN canonical (DL-026).
 *
 * Inline warn-and-log panel surfaced underneath a create-form name input
 * when the server-side fuzzy-match (DL-018 `pg_trgm` trigram similarity)
 * returns one or more existing rows at ≥85% similarity. The panel lists
 * the candidate matches; the user may either edit an existing row or
 * proceed to create anyway. Per FR62 warn-and-log philosophy the action
 * is never destructive, never disabled — the override (and which match
 * was offered) is captured in the audit log instead.
 *
 * Consumers in Epic 1 (MDM):
 *   - SI-MDM-003 Product Master (fix-back at Task B7).
 *   - SI-MDM-005 Vendor Master (Task B4).
 *   - SI-MDM-006 Category Master (via SI-MDM-003 inline-assignment in
 *     practice; same shell, same threshold).
 *
 * Token-substitution note: DL-026 named a "pending"-flavoured pip token
 * for the left pip, but no such token exists in the canonical 20
 * (DESIGN.md §6.1). Substituted with `status_overridden` — a pip-pattern,
 * tertiary brown token whose canonical glyph is `triangle-alert`.
 * Semantic fit: the user is about to override duplicate-detection.
 * Reviewers should see this call here rather than in commit history.
 *
 * Cross-references: DL-026 (this component), DL-018 (`pg_trgm` server
 * threshold), PRD FR62 (warn-and-log over hard-block), DESIGN.md §6.1
 * (canonical 20 status tokens).
 */

export interface CCDuplicateWarnMatch {
  id: string
  name: string
  subtitle?: string
  status?: 'active' | 'inactive'
}

export interface CCDuplicateWarnProps {
  matches: ReadonlyArray<CCDuplicateWarnMatch>
  onEditExisting: (id: string) => void
  onProceedAnyway: () => void
  /** When `matches.length` exceeds this, the panel shows the first
   *  `threshold` matches plus an "and N more — review existing list"
   *  footer note. Default 5. */
  threshold?: number
  className?: string
}

export function CCDuplicateWarn({
  matches,
  onEditExisting,
  onProceedAnyway,
  threshold = 5,
  className,
}: CCDuplicateWarnProps) {
  if (matches.length === 0) return null

  const visible = matches.slice(0, threshold)
  const overflow = Math.max(0, matches.length - threshold)

  return (
    <div
      data-slot="cc-duplicate-warn"
      data-match-count={matches.length}
      role="alert"
      className={cn(
        'rounded-md bg-surface-container-low border-l-4 border-status-overridden-pip p-4',
        'flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden
          className="h-[18px] w-[18px] shrink-0 text-on-surface-variant"
        />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Possible duplicates · review before creating
          </span>
          <p className="text-sm text-on-surface-variant">
            {matches.length === 1
              ? '1 existing record looks similar.'
              : `${matches.length} existing records look similar.`}{' '}
            Edit one of them, or proceed to create anyway (override is
            logged).
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((match) => (
          <li
            key={match.id}
            className="flex items-center gap-3 rounded-sm bg-surface-container-lowest px-3 py-2"
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-on-surface truncate">
                  {match.name}
                </span>
                {match.status ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider shrink-0',
                      match.status === 'active'
                        ? 'bg-surface-container-high text-on-surface'
                        : 'bg-surface-container text-on-surface-variant',
                    )}
                  >
                    {match.status}
                  </span>
                ) : null}
              </div>
              {match.subtitle ? (
                <span className="text-[11px] text-on-surface-variant truncate">
                  {match.subtitle}
                </span>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditExisting(match.id)}
              aria-label={`Edit existing match ${match.name}`}
            >
              Edit existing
            </Button>
          </li>
        ))}
      </ul>

      {overflow > 0 ? (
        <p className="text-[11px] text-on-surface-variant">
          and {overflow} more — review existing list
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onProceedAnyway}>
          Proceed and create anyway
        </Button>
      </div>
    </div>
  )
}
