import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Card as ShadcnCard,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
  CardDescription as ShadcnCardDescription,
  CardContent as ShadcnCardContent,
  CardFooter as ShadcnCardFooter,
  CardAction as ShadcnCardAction,
} from '@/components/primitives/card'

/**
 * Card — DESIGN.md §5.4 "soft lift".
 *
 * Background = surface_container_lowest via the `--card` alias
 * declared in globals.css. The visual depth comes from the tonal step
 * against the surrounding section / page background, NOT a shadow and
 * NOT a border (§5.2 no-line rule).
 *
 * The shadcn primitive ships with `ring-1 ring-foreground/10` and
 * `rounded-xl`; we override to no ring (§5.2) and `rounded-md` (8 px
 * canonical card radius per §8.2).
 */
type CardProps = React.ComponentProps<typeof ShadcnCard>

export function Card({ className, ...props }: CardProps) {
  return (
    <ShadcnCard
      className={cn(
        'bg-card text-card-foreground rounded-md p-6 shadow-none ring-0 border-0',
        className,
      )}
      {...props}
    />
  )
}

export {
  ShadcnCardHeader as CardHeader,
  ShadcnCardTitle as CardTitle,
  ShadcnCardDescription as CardDescription,
  ShadcnCardContent as CardContent,
  ShadcnCardFooter as CardFooter,
  ShadcnCardAction as CardAction,
}
