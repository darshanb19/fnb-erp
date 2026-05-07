import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import { Button } from './Button'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'

/**
 * ExportTrigger — CC-EXPORT-TRIGGER canonical (FR107).
 *
 * Top-bar dropdown trigger surfacing PDF / CSV / Excel export options for
 * the surrounding screen's data. Per FR107, every analytical report screen
 * carries this affordance.
 *
 * The mockup wires the option click as a no-op (logs to console) — the real
 * export pipeline ships in Epic 12 (Phase 4). The visual contract — outline-
 * style download button + 3 format options — is what Tier 1 acceptance asks
 * for here.
 */
export type ExportFormat = 'csv' | 'excel' | 'pdf'

const FORMAT_META: Record<
  ExportFormat,
  { label: string; description: string; icon: typeof FileText }
> = {
  pdf: {
    label: 'PDF',
    description: 'For board reporting & printing',
    icon: FileText,
  },
  csv: {
    label: 'CSV',
    description: 'Spreadsheet-compatible plain text',
    icon: Sheet,
  },
  excel: {
    label: 'Excel (.xlsx)',
    description: 'Formatted workbook with sheets',
    icon: FileSpreadsheet,
  },
}

export interface ExportTriggerProps {
  /** Format options offered. Default `['pdf', 'csv', 'excel']`. */
  formats?: ReadonlyArray<ExportFormat>
  /** Entity label inserted into the dropdown header — e.g. "dashboard snapshot". */
  entityLabel: string
  /** Optional click handler — receives the chosen format. */
  onExport?: (format: ExportFormat) => void
  className?: string
}

export function ExportTrigger({
  formats = ['pdf', 'csv', 'excel'],
  entityLabel,
  onExport,
  className,
}: ExportTriggerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (format: ExportFormat) => {
    setOpen(false)
    if (onExport) {
      onExport(format)
    } else {
      // Mockup default: log; real pipeline lands in Epic 12.
      console.info(`[ExportTrigger] export ${entityLabel} as ${format}`)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="h-4 w-4" aria-hidden />
          <span>Export</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Export {entityLabel} as
        </p>
        <ul className="flex flex-col">
          {formats.map((f) => {
            const meta = FORMAT_META[f]
            const Icon = meta.icon
            return (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => handleSelect(f)}
                  className="flex w-full items-start gap-3 rounded-sm px-3 py-2 text-left hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
                >
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant"
                    aria-hidden
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-on-surface">
                      {meta.label}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {meta.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
