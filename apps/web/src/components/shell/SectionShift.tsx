import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SectionShift — DESIGN.md §5.2 (no-line rule) + plan §10.7.
 *
 * Replacement for shadcn `<Separator>`, which is banned by the pre-commit
 * hook and §5.2's prohibition on 1-px dividers. Renders a 4-px tonal
 * background shift between sections — depth via colour shift, never a
 * 1-px stroke.
 *
 * Use horizontally (`orientation="horizontal"`, the default) between
 * stacked sections; use vertically (`orientation="vertical"`) inside a
 * flex row between adjacent panels.
 */
type Tone = 'lowest' | 'low' | 'high'

interface SectionShiftProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  /** Which surface_container_* tone to shift to. Default `high`. */
  tone?: Tone
}

const toneClass: Record<Tone, string> = {
  lowest: 'bg-surface-container-lowest',
  low: 'bg-surface-container-low',
  high: 'bg-surface-container-high',
}

export function SectionShift({
  className,
  orientation = 'horizontal',
  tone = 'high',
  ...props
}: SectionShiftProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      data-slot="section-shift"
      className={cn(
        toneClass[tone],
        orientation === 'horizontal' ? 'h-1 w-full' : 'h-full w-1',
        className,
      )}
      {...props}
    />
  )
}
