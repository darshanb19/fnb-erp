import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input as ShadcnInput } from '@/components/ui/input'

/**
 * Input — DESIGN.md §5.1.3 + §9.3 + §15.4.
 *
 * - Fill = `surface_container_highest` (§5.1.3 form-fill semantic).
 * - Default border transparent — globals.css sets `--border: transparent`
 *   per §5.2 no-line rule, so the shadcn `border border-input` resolves
 *   to invisible at rest.
 * - Focus state = 2-px ring in `--ring` (= `primary`) per §9.3.
 * - Error state (`aria-invalid`) = 2-px ring in `error` per §9.3.
 *   Both `focus-visible:` and `aria-invalid:` border / ring classes are
 *   allow-listed by the pre-commit hook (plan §10.8).
 * - Height = `h-11` (44 px) — matches §8.4 / §15.4 mobile tap target.
 */
type InputProps = React.ComponentProps<typeof ShadcnInput>

export function Input({ className, ...props }: InputProps) {
  return (
    <ShadcnInput
      className={cn(
        'bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant',
        'h-11 rounded-sm',
        'focus-visible:ring-2 focus-visible:ring-primary',
        'aria-invalid:ring-2 aria-invalid:ring-error',
        className,
      )}
      {...props}
    />
  )
}
