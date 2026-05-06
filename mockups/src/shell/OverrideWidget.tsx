import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/tokens'

/**
 * OverrideWidget — CC-OVERRIDE-WIDGET / P2B-005 (DESIGN.md §6.6).
 *
 * The single aggregating widget for all warn-and-log override types. Lives
 * on the Brand Owner dashboard (SI-RPT-002) per the Phase-2b parking-lot
 * P2B-005 decision: each override-firing screen feeds data into this widget,
 * not a per-screen widget.
 *
 * Hero number is **rate per 100 production orders** (not raw count) so
 * spikes are visible at scales of 5 vs 50 daily orders. Sparkline draws
 * `error` when the latest day exceeds the rolling-7-day average,
 * `surface_tint` otherwise (per §6.6 visual signature).
 *
 * Per-type filter chips (FR67 Pending GR · FR61 substitution · FR62
 * enablement) toggle which override types contribute to the headline rate.
 * The chips are decorative-state in the mockup (no recompute) — the schema
 * inventory only requires the affordance be visible and persisted.
 */
export type OverrideType = 'pending_gr' | 'substitution' | 'enablement'

export interface OverrideBreakdownEntry {
  type: OverrideType
  /** Count over the 30-day window. */
  count: number
}

export interface OverrideWidgetProps {
  /** Headline rate per 100 production orders. */
  rate: number
  /** 30-day sparkline series — most-recent value last. */
  series: ReadonlyArray<number>
  /** Rolling 7-day average — sparkline draws `error` when latest > this. */
  rollingAvg: number
  /** Per-type counts for the filter row + breakdown line. */
  breakdown: ReadonlyArray<OverrideBreakdownEntry>
  /** Optional className passthrough. */
  className?: string
}

const TYPE_LABEL: Record<OverrideType, string> = {
  pending_gr: 'Pending GR (FR67)',
  substitution: 'Substitution (FR61)',
  enablement: 'Enablement (FR62)',
}

export function OverrideWidget({
  rate,
  series,
  rollingAvg,
  breakdown,
  className,
}: OverrideWidgetProps) {
  // All types active by default — mockup chip state, no recompute.
  const [activeTypes, setActiveTypes] = useState<ReadonlySet<OverrideType>>(
    () => new Set(breakdown.map((b) => b.type)),
  )

  const toggleType = (t: OverrideType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) {
        next.delete(t)
      } else {
        next.add(t)
      }
      return next
    })
  }

  const latest = series[series.length - 1] ?? 0
  const isAboveAvg = latest > rollingAvg
  const stroke = isAboveAvg ? tokens.error : tokens.surface_tint

  const total = breakdown.reduce((acc, e) => acc + e.count, 0)

  return (
    <section
      className={cn(
        'rounded-md bg-surface-container-lowest p-5 text-on-surface',
        className,
      )}
      aria-label="Override-frequency widget"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-on-surface">
            Override frequency
          </h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            All warn-and-log overrides aggregated · last 30 days
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-1 text-[11px] font-medium tracking-wider text-on-surface-variant uppercase">
          P2B-005
        </div>
      </header>

      <div className="mt-4 flex items-end gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Per 100 production orders
          </p>
          <p className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span
              className={cn(
                'text-[2.75rem] leading-none font-bold tracking-tight',
                isAboveAvg ? 'text-error' : 'text-on-surface',
              )}
            >
              {rate.toFixed(1)}
            </span>
            <span className="text-sm text-on-surface-variant">
              / 100 POs
            </span>
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            {isAboveAvg ? (
              <span className="inline-flex items-center gap-1 text-error">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                Above 7-day average ({rollingAvg.toFixed(1)})
              </span>
            ) : (
              <>Within 7-day average ({rollingAvg.toFixed(1)})</>
            )}
          </p>
        </div>

        <Sparkline values={series} stroke={stroke} className="ml-auto" />
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
          Filter by type
        </p>
        <div className="flex flex-wrap gap-2">
          {breakdown.map((entry) => {
            const active = activeTypes.has(entry.type)
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => toggleType(entry.type)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                <span>{TYPE_LABEL[entry.type]}</span>
                <span className="tabular-nums opacity-80">{entry.count}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          {total} overrides recorded across the 30-day window.
        </p>
      </div>
    </section>
  )
}

/** Internal sparkline — SVG, no animation. */
function Sparkline({
  values,
  stroke,
  className,
}: {
  values: ReadonlyArray<number>
  stroke: string
  className?: string
}) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 220
  const height = 60
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 6) - 3
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('w-[220px]', className)}
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
