import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button as ShadcnButton } from '@/components/ui/button'

/**
 * Button — DESIGN.md §5.2 + plan §10.7 ghost-variant overlay.
 *
 * shadcn ships an `outline` variant with an opaque 1-px stroke; per §5.2
 * (no-line rule) outlined buttons are PROHIBITED. This wrapper:
 *
 *   - Rewrites `variant="outline"` to ghost behaviour (transparent
 *     background, tonal hover via `surface_container_high`). Screens that
 *     accidentally request `outline` get the project-correct rendering
 *     instead of a sectioning border. The pre-commit hook (Subagent E)
 *     additionally bans bare `border` classes outside `mockups/src/components/ui/`.
 *   - Adds a `tonal` variant — a filled-but-soft button on
 *     `surface_container` that hovers up to `surface_container_high`. Use
 *     when "ghost" needs to read as "weighted" (e.g. secondary form CTA).
 *   - Passes `default`, `ghost`, `secondary`, `destructive`, `link`
 *     straight through to the shadcn primitive unchanged.
 */
type ShadcnButtonProps = React.ComponentProps<typeof ShadcnButton>
type ShadcnVariant = ShadcnButtonProps['variant']

export interface ButtonProps extends Omit<ShadcnButtonProps, 'variant'> {
  variant?: ShadcnVariant | 'tonal'
}

export function Button({ variant, className, ...props }: ButtonProps) {
  if (variant === 'outline') {
    // §5.2 no-line: silently rewrite to the project's ghost-tonal pattern.
    return (
      <ShadcnButton
        variant="ghost"
        className={cn('hover:bg-surface-container-high', className)}
        {...props}
      />
    )
  }
  if (variant === 'tonal') {
    return (
      <ShadcnButton
        variant="ghost"
        className={cn(
          'bg-surface-container hover:bg-surface-container-high',
          className,
        )}
        {...props}
      />
    )
  }
  return <ShadcnButton variant={variant} className={className} {...props} />
}
