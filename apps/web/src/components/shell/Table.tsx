import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Table as ShadcnTable,
  TableHeader as ShadcnTableHeader,
  TableBody as ShadcnTableBody,
  TableFooter as ShadcnTableFooter,
  TableRow as ShadcnTableRow,
  TableHead as ShadcnTableHead,
  TableCell as ShadcnTableCell,
  TableCaption as ShadcnTableCaption,
} from '@/components/primitives/table'

/**
 * Table — DESIGN.md §5.2 + §9.2 + §7.3 chrome wrapper.
 *
 * Wraps the shadcn primitive with project-correct chrome:
 *   - Outer container = `surface_container_lowest` (`bg-card`) with
 *     `rounded-md` (8 px per §8.2). NO border (§5.2 no-line rule).
 *   - Row striping handled by the `[&_tbody_tr:nth-child(even)]` selector
 *     applying `surface_variant`; horizontal divider lines (`divide-y`,
 *     `border-b` on rows) are NOT used (§9.2).
 *   - Tabular numerals enforced via `tabular-nums` (§7.3).
 *
 * The shadcn primitive emits `border-b` on header / row rows by default;
 * we null that out at the row-class level so screens consuming this
 * wrapper get the no-line surface for free.
 *
 * Re-exports `TableHeader`, `TableBody`, `TableFooter`, `TableRow`,
 * `TableHead`, `TableCell`, `TableCaption` straight through from shadcn —
 * only the outer `<Table>` is wrapped.
 */
type TableProps = React.ComponentProps<typeof ShadcnTable>

export function Table({ className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-shell"
      className="bg-card text-card-foreground rounded-md overflow-hidden"
    >
      <ShadcnTable
        className={cn(
          'tabular-nums text-sm',
          // §9.2 — strip the row-divider lines that shadcn ships with;
          // striping replaces them.
          '[&_tbody_tr]:border-b-0 [&_thead_tr]:border-b-0',
          // §9.2 — row striping via surface_variant on every other row.
          '[&_tbody_tr:nth-child(even)]:bg-surface-variant',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export {
  ShadcnTableHeader as TableHeader,
  ShadcnTableBody as TableBody,
  ShadcnTableFooter as TableFooter,
  ShadcnTableRow as TableRow,
  ShadcnTableHead as TableHead,
  ShadcnTableCell as TableCell,
  ShadcnTableCaption as TableCaption,
}
