import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Popover as ShadcnPopover,
  PopoverTrigger as ShadcnPopoverTrigger,
  PopoverAnchor as ShadcnPopoverAnchor,
  PopoverContent as ShadcnPopoverContent,
} from '@/components/ui/popover'

/**
 * Popover — DESIGN.md §5.3 / §5.3.1 + plan §10.7 row 6.
 *
 * Default `variant="solid"` renders `surface_container_lowest` via the
 * `--popover` alias declared in globals.css — solid is the operationally
 * correct default for floating elements (popovers, dropdowns, tooltips)
 * because `backdrop-blur` taxes slow store-floor Android devices.
 *
 * Opt-in `variant="glass"` applies the §5.3.1 backdrop-blur pattern
 * (`bg-surface/80 backdrop-blur-[20px]`). Reserved for high-signal
 * moments — hero dashboards, command palette, tenant onboarding overlays.
 *
 * Re-exports `Popover` (root) and `PopoverTrigger` / `PopoverAnchor`
 * straight through; only `PopoverContent` is wrapped.
 */
type PopoverVariant = 'solid' | 'glass'

type ShadcnPopoverContentProps = React.ComponentProps<typeof ShadcnPopoverContent>

interface PopoverContentProps extends ShadcnPopoverContentProps {
  variant?: PopoverVariant
}

export function PopoverContent({
  className,
  variant = 'solid',
  ...props
}: PopoverContentProps) {
  return (
    <ShadcnPopoverContent
      className={cn(
        variant === 'glass'
          ? 'bg-surface/80 backdrop-blur-[20px]'
          : 'bg-popover text-popover-foreground',
        'rounded-md',
        className,
      )}
      {...props}
    />
  )
}

export const Popover = ShadcnPopover
export const PopoverTrigger = ShadcnPopoverTrigger
export const PopoverAnchor = ShadcnPopoverAnchor
