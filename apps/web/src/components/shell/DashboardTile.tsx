import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, GripVertical, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/lib/tokens'

/**
 * DashboardTile — CC-DASHBOARD-TILE canonical (DESIGN.md §5.4 + §12.4).
 *
 * KPI tile chrome reused across every Brand-Owner / Cluster-Manager /
 * Finance dashboard. Surfaces:
 *   - Eyebrow label (Label M, on_surface_variant)
 *   - Hero value (Display S / Display M)
 *   - Optional secondary text (Body S, on_surface_variant)
 *   - Optional 30-day sparkline (SVG; never animated per CLAUDE.md policy)
 *   - Optional drill-down link (entire tile clickable; satisfies FR109 ≤2-click rule)
 *   - Optional severity wash via 4-px left pip (DESIGN.md §12.5 margin-accent)
 *   - "Customize layout" grip handle for FR-105 pin/rearrange affordance
 *
 * Surface hierarchy — tile = `surface_container_lowest` (white) per §5.4
 * "soft lift" so the page section beneath (`surface_container_low`) reads
 * as the next tonal step down.
 *
 * No entrance animation — dashboards are static per CLAUDE.md "Animation
 * policy". Hover state is a 1-tone tonal lift only.
 */
type Severity = 'neutral' | 'warning' | 'error' | 'success'
type Trend = 'up' | 'down' | 'flat'

const severityPip: Record<Severity, string | null> = {
  neutral: null,
  warning: tokens.tertiary,
  error: tokens.error,
  success: tokens.success,
}

const trendIcon: Record<Trend, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

export interface DashboardTileProps {
  /** Eyebrow label e.g. "Food cost %", "Variance flags". */
  label: string
  /** Hero value — wrap ₹ amounts in <span className="text-on-surface-variant"> for the §7.4 ₹ rule. */
  value: React.ReactNode
  /** Optional secondary line — e.g. "Target 32% · 9 stores tracked". */
  secondary?: React.ReactNode
  /** Semantic trend direction; renders an arrow + colour cue. */
  trend?: Trend
  /** Optional 30-day sparkline values; auto-scaled. Renders below the hero. */
  sparkline?: ReadonlyArray<number>
  /** Drill-down route. Click anywhere on the tile to navigate (one click = drill). */
  to?: string
  /** Severity wash via 4-px left pip per §12.5 margin-accent pattern. */
  severity?: Severity
  /** Optional accent on the trend / sparkline — e.g. mark a tile as "above average". */
  emphasis?: 'above_average' | null
  className?: string
}

export function DashboardTile({
  label,
  value,
  secondary,
  trend,
  sparkline,
  to,
  severity = 'neutral',
  emphasis = null,
  className,
}: DashboardTileProps) {
  const pip = severityPip[severity]
  const TrendIcon = trend ? trendIcon[trend] : null
  // §6.6 — sparkline error when above rolling average, surface_tint otherwise.
  const sparkColour = emphasis === 'above_average' ? tokens.error : tokens.surface_tint

  const inner = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {to ? (
            <ArrowUpRight
              className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            aria-label="Customize layout"
            title="Customize layout"
            className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[2.25rem] leading-none font-bold tracking-tight text-on-surface tabular-nums">
          {value}
        </span>
        {TrendIcon ? (
          <TrendIcon
            className={cn(
              'h-4 w-4 shrink-0',
              trend === 'up' && severity === 'error' ? 'text-error' : '',
              trend === 'down' && severity === 'error' ? 'text-success' : '',
              trend === 'flat' ? 'text-on-surface-variant' : '',
              severity === 'neutral' && trend !== 'flat' ? 'text-on-surface-variant' : '',
              severity === 'warning' ? 'text-tertiary' : '',
              severity === 'success' ? 'text-success' : '',
            )}
            aria-hidden
          />
        ) : null}
      </div>

      {secondary ? (
        <p className="mt-2 text-xs text-on-surface-variant">{secondary}</p>
      ) : null}

      {sparkline && sparkline.length > 0 ? (
        <Sparkline values={sparkline} stroke={sparkColour} />
      ) : null}
    </div>
  )

  // Tap target ≥44 px — min-h-[112px] keeps the tile well above the 44 px floor.
  const tileClasses = cn(
    'group relative flex min-h-[120px] flex-col overflow-hidden rounded-md bg-surface-container-lowest p-4 text-on-surface',
    'transition-colors hover:bg-surface-container',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    className,
  )

  const pipEl = pip ? (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 w-1"
      style={{ backgroundColor: pip }}
    />
  ) : null

  if (to) {
    return (
      <Link to={to} className={tileClasses}>
        {pipEl}
        <div className={cn('flex h-full flex-col', pip ? 'pl-2' : '')}>{inner}</div>
      </Link>
    )
  }

  return (
    <div className={tileClasses}>
      {pipEl}
      <div className={cn('flex h-full flex-col', pip ? 'pl-2' : '')}>{inner}</div>
    </div>
  )
}

/** Internal sparkline — SVG, no animation. */
function Sparkline({
  values,
  stroke,
  height = 28,
}: {
  values: ReadonlyArray<number>
  stroke: string
  height?: number
}) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 100
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 w-full"
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
