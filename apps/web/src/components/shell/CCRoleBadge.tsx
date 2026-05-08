import { cn } from '@/lib/utils'
import { ROLE_LABEL, type UserRole } from '@/lib/user-roles'

/**
 * CCRoleBadge — CC-ROLE-BADGE canonical (Task B6 promotion).
 *
 * Compact pill that renders one of the 9 canonical user roles. Promoted
 * from inline definitions previously duplicated across SI-USR-001 (list
 * rows), SI-USR-002 (form preview), SI-USR-005 (header), SI-USR-006
 * (target-user section), and SI-USR-007 (user column) — five surfaces,
 * comfortably above the ≥3 promotion threshold.
 *
 * Design (DESIGN.md §6.4 tonal containers):
 *
 *   - Pill chrome: `inline-flex items-center rounded-pill`
 *   - Tone: neutral `bg-surface-container-high text-on-surface` for every
 *     role. Role tone is intentionally NOT colour-coded — the role label is
 *     the signal. Reusing the canonical 20 status palette for role tones
 *     would over-load semantics (e.g. "is `brand_owner` warning-tone?").
 *   - Two sizes:
 *       - `'sm'` → table-cell density (`px-1.5 py-0.5 text-[10px]`)
 *       - `'md'` → default for headers / form previews (`px-2 py-0.5 text-[11px]`)
 *
 * Accessibility:
 *
 *   `aria-label="Role: <label>"` — visible label is the same string, but the
 *   prefix gives screen-reader users explicit context that the chip names a
 *   user role rather than a status / tag.
 *
 * Consumers:
 *   - SI-USR-001 — list rows (size `'sm'`).
 *   - SI-USR-002 — (no current consumer post-B6; the form preview footprint
 *     is captured by the role-section description card, not a badge).
 *   - SI-USR-005 — page header next to the target user's email (size `'md'`).
 *   - SI-USR-006 — target-user read-only display section (size `'md'`).
 *   - SI-USR-007 — user column (size `'sm'`).
 *
 * Source FRs:
 *   - FR12 — canonical 9-role registry.
 *
 * Token notes:
 *   - Zero hex literals.
 *   - No icons (keeping the badge neutral; role label is the signal).
 *   - No banned borders; no `<Separator>`; no companion font.
 *
 * Animation — NONE (static pill).
 */

export interface RoleBadgeProps {
  readonly role: UserRole
  /** `'sm'` for table cells; `'md'` (default) elsewhere. */
  readonly size?: 'sm' | 'md'
  /** Optional layout override — kept narrow on purpose (no theming hooks). */
  readonly className?: string
}

export function RoleBadge({
  role,
  size = 'md',
  className,
}: RoleBadgeProps) {
  const sizing =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      data-slot="cc-role-badge"
      data-role={role}
      data-size={size}
      aria-label={`Role: ${ROLE_LABEL[role]}`}
      className={cn(
        'inline-flex items-center rounded-pill font-medium',
        'bg-surface-container-high text-on-surface',
        sizing,
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}
