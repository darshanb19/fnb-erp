import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CircleOff,
  Lightbulb,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
} from '@/shell'
import { PairedTransferBundle } from '@/shell/PairedTransferBundle'

import {
  transferSuggestions,
  stockBatches,
  formatINR,
  type TransferSuggestion,
  type StockBatch,
} from '@/lib/inv-sample-data'

import { materials, locations, type Material, type Location } from '@/lib/sample-data'

/**
 * SI-INV-009 — Cross-Location Transfer Suggestions.
 *
 * Tier 2 Group 1, Phase 4 Epic 4 Arc (b). Read-only suggestion surface.
 *
 * Surfaces per-batch transfer suggestions ranked by feasibility score,
 * split into two sections:
 *   1. Single-hop — within-cluster moves (direct dept→dept).
 *   2. Paired Brand-Store-routed — cross-cluster moves (§2.2 two-leg
 *      routing via brand store, rendered with PairedTransferBundle compact
 *      signature + bundled-approval requirement note).
 *
 * The "No suggestion viable" empty state mirrors SI-INV-001's
 * empty-state card idiom (PackageSearch + instruction copy).
 *
 * FRs: FR28 (transfer suggestion engine), FR33/FR34 (PAR-driven context),
 * §2.2 (cluster routing rule), DL-043 (raw dept→dept within-cluster allowance).
 *
 * Cross-cutting:
 *   - CC-FILTER-CHIP-PICKER — suggestion type + urgency band (copied idiom
 *     from SI-INV-001 FilterChipPicker).
 *   - CC-DASHBOARD-TILE — aggregate counters: total suggestions, single-hop
 *     count, paired count.
 *
 * Sub-affordances:
 *   - Single-hop → /SI-INV-005 (transfer create).
 *   - Paired → /SI-INV-007 (paired bundle detail).
 *   - "Dismiss" is a visual toggle (sets local dismissed state).
 *
 * NOTE on filter scope: the suggestion-type filter is informational — the
 * fixture already contains only 4 suggestions; toggling the filter chip does
 * narrow the list since each chip maps directly to `suggestionType`. The
 * urgency-band filter is visual chrome only per Tier 1 acceptance §11 —
 * the fixture carries `hoursToExpiry` but urgency bands are not materialised
 * as a field, so selecting an urgency chip does not actually narrow the list.
 * A code comment marks the pass-through.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards / forms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Urgency band (derived from hoursToExpiry)
// ─────────────────────────────────────────────────────────────────────────────

type UrgencyBand = 'critical' | 'high' | 'medium'

function urgencyBandOf(hoursToExpiry: number): UrgencyBand {
  if (hoursToExpiry <= 24) return 'critical'
  if (hoursToExpiry <= 48) return 'high'
  return 'medium'
}

const URGENCY_LABEL: Record<UrgencyBand, string> = {
  critical: 'Critical (≤24 h)',
  high: 'High (24–48 h)',
  medium: 'Medium (>48 h)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

function materialOf(id: string): Material | undefined {
  return materials.find((m) => m.id === id)
}

function batchOf(id: string): StockBatch | undefined {
  return stockBatches.find((b) => b.id === id)
}

function locationOf(id: string): Location | undefined {
  return locations.find((l) => l.id === id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Enriched suggestion row
// ─────────────────────────────────────────────────────────────────────────────

interface EnrichedSuggestion {
  readonly sug: TransferSuggestion
  readonly material: Material
  readonly batch: StockBatch
  readonly sourceLocationName: string
  readonly urgencyBand: UrgencyBand
  readonly dismissed: boolean
}

const enrichedSuggestions: ReadonlyArray<EnrichedSuggestion> = transferSuggestions
  .map((sug) => {
    const material = materialOf(sug.materialId)
    const batch = batchOf(sug.batchId)
    const sourceLoc = locationOf(sug.sourceLocationId)
    if (!material || !batch || !sourceLoc) return null
    return {
      sug,
      material,
      batch,
      sourceLocationName: sourceLoc.name,
      urgencyBand: urgencyBandOf(sug.hoursToExpiry),
      dismissed: sug.dismissed,
    } satisfies EnrichedSuggestion
  })
  .filter((r): r is EnrichedSuggestion => r !== null)
  // Rank by feasibility score descending (highest first)
  .sort((a, b) => b.sug.feasibilityScore - a.sug.feasibilityScore)

// ─────────────────────────────────────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────────────────────────────────────

type SuggestionType = 'single_hop' | 'paired'

interface FilterState {
  readonly suggestionTypes: ReadonlySet<SuggestionType>
  readonly urgencyBands: ReadonlySet<UrgencyBand>
}

const INITIAL_FILTERS: FilterState = {
  suggestionTypes: new Set(),
  urgencyBands: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterChipPicker (copied idiom from SI-INV-001)
// ─────────────────────────────────────────────────────────────────────────────

interface FilterChipPickerProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ value: V; label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterChipPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipPickerProps<V>) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-11 px-3 gap-1.5 rounded-pill min-w-[44px] tablet:h-9"
          aria-label={`Filter by ${title.toLowerCase()}${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Filter by {title.toLowerCase()}
          </span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {options.map((opt) => {
            const active = selected.has(opt.value)
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{opt.label}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Selected</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FeasibilityScoreBadge
// ─────────────────────────────────────────────────────────────────────────────

interface FeasibilityScoreBadgeProps {
  readonly score: number
}

function FeasibilityScoreBadge({ score }: FeasibilityScoreBadgeProps) {
  const colourClass =
    score >= 80
      ? 'bg-surface-container text-primary'
      : score >= 60
        ? 'bg-surface-container text-tertiary'
        : 'bg-surface-container text-on-surface-variant'

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold tabular-nums ${colourClass}`}
      aria-label={`Feasibility score ${score}`}
    >
      {score}%
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UrgencyPip (mirrors ExpiryPip idiom from SI-INV-001)
// ─────────────────────────────────────────────────────────────────────────────

interface UrgencyPipProps {
  readonly urgencyBand: UrgencyBand
  readonly hoursToExpiry: number
}

function UrgencyPip({ urgencyBand, hoursToExpiry }: UrgencyPipProps) {
  if (urgencyBand === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
        {hoursToExpiry} h to expiry
      </span>
    )
  }
  const colourClass = urgencyBand === 'critical' ? 'text-error' : 'text-tertiary'
  const pipColour = urgencyBand === 'critical' ? 'bg-error' : 'bg-tertiary'
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
      <span aria-hidden className={`w-1 shrink-0 ${pipColour}`} />
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${colourClass}`}>
        {hoursToExpiry} h to expiry
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceBatchContextCard — Section 1
// ─────────────────────────────────────────────────────────────────────────────

interface SourceBatchContextCardProps {
  readonly row: EnrichedSuggestion
  readonly dismissed: boolean
}

function SourceBatchContextCard({ row, dismissed }: SourceBatchContextCardProps) {
  const { sug, material, batch, sourceLocationName, urgencyBand } = row
  return (
    <div
      className={[
        'rounded-md bg-surface-container-lowest p-4',
        dismissed ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Source batch context
          </p>
          <h3 className="mt-1 text-base font-semibold text-on-surface truncate">
            {material.name}
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {material.category} · {sourceLocationName} · Batch {batch.batchNumber}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          <span className="text-2xl font-bold tabular-nums text-on-surface leading-none">
            {batch.quantityRemaining}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
            {batch.uom} on hand
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <UrgencyPip urgencyBand={urgencyBand} hoursToExpiry={sug.hoursToExpiry} />
        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
          Value at risk: {formatINR(sug.valueAtRisk)}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SingleHopSuggestionCard
// ─────────────────────────────────────────────────────────────────────────────

interface SingleHopCardProps {
  readonly row: EnrichedSuggestion
  readonly dismissed: boolean
  readonly onDismiss: (id: string) => void
}

function SingleHopCard({ row, dismissed, onDismiss }: SingleHopCardProps) {
  const { sug, material, batch, sourceLocationName, urgencyBand } = row
  return (
    <article
      aria-label={`Single-hop suggestion for ${material.name} to ${sug.destinationLabel}`}
      className={[
        'flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4',
        dismissed ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Source batch context (compact) */}
      <SourceBatchContextCard row={row} dismissed={false} />

      {/* Suggestion details */}
      <div className="rounded-sm bg-surface-container-low p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Suggested destination
            </p>
            <p className="mt-0.5 text-sm font-semibold text-on-surface">
              {sug.destinationLabel}
            </p>
          </div>
          <FeasibilityScoreBadge score={sug.feasibilityScore} />
        </div>
        <p className="text-xs text-on-surface-variant">
          Expected consumption capacity:{' '}
          <span className="font-medium text-on-surface">
            {sug.expectedConsumption} {batch.uom}
          </span>
        </p>
        <p className="text-xs text-on-surface-variant">
          Route:{' '}
          <span className="font-medium text-on-surface">
            {sourceLocationName}
          </span>
          <ArrowRight className="inline h-3 w-3 mx-1 text-on-surface-variant" aria-hidden />
          <span className="font-medium text-on-surface">{sug.destinationLabel}</span>
          {' '}
          <span className="italic">(within-cluster, DL-043)</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          to="/SI-INV-005"
          aria-label={`Initiate transfer for ${material.name} to ${sug.destinationLabel}`}
          className={[
            'inline-flex items-center gap-1.5 rounded-pill bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary',
            'hover:opacity-90 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            dismissed ? 'pointer-events-none opacity-40' : '',
          ].join(' ')}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          Initiate transfer
        </Link>
        <button
          type="button"
          onClick={() => onDismiss(sug.id)}
          aria-pressed={dismissed}
          className={[
            'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium',
            'hover:bg-surface-container transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            dismissed
              ? 'bg-surface-container text-on-surface-variant'
              : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
          aria-label={dismissed ? `Restore suggestion for ${material.name}` : `Dismiss suggestion for ${material.name}`}
        >
          {dismissed ? (
            <>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Restore
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5" aria-hidden />
              Dismiss
            </>
          )}
        </button>
        {urgencyBand === 'critical' ? (
          <span
            role="note"
            className="inline-flex items-center gap-1 rounded-pill bg-error-container px-2 py-0.5 text-[11px] font-medium text-error"
            aria-label="Critical urgency — act within 24 hours"
          >
            <TriangleAlert className="h-3 w-3" aria-hidden />
            Critical urgency
          </span>
        ) : null}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PairedSuggestionCard
// ─────────────────────────────────────────────────────────────────────────────

interface PairedCardProps {
  readonly row: EnrichedSuggestion
  readonly dismissed: boolean
  readonly onDismiss: (id: string) => void
}

function PairedCard({ row, dismissed, onDismiss }: PairedCardProps) {
  const { sug, material, batch, sourceLocationName, urgencyBand } = row

  // Derive leg labels from the destinationLabel convention (e.g. "Bandra Pali → Andheri Phoenix")
  // The fixture destinationLabel uses " → " as separator for paired suggestions.
  const parts = sug.destinationLabel.split(' → ')
  const brandStoreLabel = parts[0] ?? sug.destinationLabel
  const destLabel = parts[1] ?? sug.destinationLabel

  // Build PairedTransferBundle legs
  const leg1 = {
    label: 'Leg 1',
    source_label: sourceLocationName,
    destination_label: brandStoreLabel,
    line_items: [
      {
        material_id: material.id,
        material_name: material.name,
        category: material.category,
        qty: sug.expectedConsumption,
        uom: batch.uom,
        batch_ref: batch.batchNumber,
        expires_on: batch.expiryDate ?? 'N/A',
        expiry_pressure: `${sug.hoursToExpiry}h`,
      },
    ],
    expiry_context:
      urgencyBand === 'critical' || urgencyBand === 'high'
        ? `${sug.hoursToExpiry} h to expiry — act urgently`
        : undefined,
  }

  const leg2 = {
    label: 'Leg 2',
    source_label: brandStoreLabel,
    destination_label: destLabel,
    line_items: [
      {
        material_id: material.id,
        material_name: material.name,
        category: material.category,
        qty: sug.expectedConsumption,
        uom: batch.uom,
        batch_ref: batch.batchNumber,
        expires_on: batch.expiryDate ?? 'N/A',
        expiry_pressure: `${sug.hoursToExpiry}h`,
      },
    ],
  }

  return (
    <article
      aria-label={`Paired cross-cluster suggestion for ${material.name} via ${sug.destinationLabel}`}
      className={[
        'flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4',
        dismissed ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Source batch context (compact) */}
      <SourceBatchContextCard row={row} dismissed={false} />

      {/* Feasibility + expected consumption summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface-container-low px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Expected consumption
          </p>
          <p className="text-sm font-semibold text-on-surface">
            {sug.expectedConsumption} {batch.uom} at {destLabel}
          </p>
        </div>
        <FeasibilityScoreBadge score={sug.feasibilityScore} />
      </div>

      {/* PairedTransferBundle compact signature */}
      <PairedTransferBundle
        compact
        bundleRef="BDLR-SUGGESTED"
        originatingCluster="Bandra-West"
        destinationCluster="Andheri-East"
        legs={[leg1, leg2]}
        bundleStatus="draft"
        consumptionContext={`Destination expects to consume ${sug.expectedConsumption} ${batch.uom} within service window.`}
      />

      {/* Bundled-approval requirement note */}
      <div
        role="note"
        aria-label="Bundled approval requirement"
        className="flex items-start gap-2 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"
      >
        <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-tertiary" aria-hidden />
        <span>
          Paired cross-cluster transfers require{' '}
          <span className="font-semibold text-on-surface">atomic bundled approval</span>
          {' '}— both legs approve or reject together (§2.2, Master Spec).
          Initiating this transfer will open a bundle approval request.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          to="/SI-INV-007"
          aria-label={`View paired bundle flow for ${material.name}`}
          className={[
            'inline-flex items-center gap-1.5 rounded-pill bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary',
            'hover:opacity-90 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            dismissed ? 'pointer-events-none opacity-40' : '',
          ].join(' ')}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          Initiate paired transfer
        </Link>
        <button
          type="button"
          onClick={() => onDismiss(sug.id)}
          aria-pressed={dismissed}
          className={[
            'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium',
            'hover:bg-surface-container transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            dismissed
              ? 'bg-surface-container text-on-surface-variant'
              : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
          aria-label={dismissed ? `Restore suggestion for ${material.name}` : `Dismiss suggestion for ${material.name}`}
        >
          {dismissed ? (
            <>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Restore
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5" aria-hidden />
              Dismiss
            </>
          )}
        </button>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state card (mirrors SI-INV-001 idiom)
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStatePanelProps {
  readonly onReset: () => void
  readonly anyFilterActive: boolean
}

function EmptyStatePanel({ onReset, anyFilterActive }: EmptyStatePanelProps) {
  return (
    <div className="rounded-md bg-surface-container-lowest p-10 text-center">
      <Lightbulb
        className="mx-auto h-10 w-10 text-on-surface-variant"
        aria-hidden
      />
      <p className="mt-3 text-base font-semibold text-on-surface">
        No suggestion viable
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">
        No transfer suggestions match the current filter, or all suggestions have
        been dismissed. Adjust the filter chips or restore dismissed suggestions.
      </p>
      {anyFilterActive ? (
        <Button
          variant="tonal"
          size="sm"
          className="mt-4"
          onClick={onReset}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv009() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  // Local dismissed overrides — starts from fixture values
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    () => new Set(enrichedSuggestions.filter((r) => r.sug.dismissed).map((r) => r.sug.id)),
  )

  const toggleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const anyFilterActive =
    filters.suggestionTypes.size > 0 || filters.urgencyBands.size > 0

  const filtered = useMemo(() => {
    return enrichedSuggestions.filter((r) => {
      // Suggestion type filter is functional — maps 1:1 to suggestionType field
      if (
        filters.suggestionTypes.size > 0 &&
        !filters.suggestionTypes.has(r.sug.suggestionType)
      ) {
        return false
      }
      // Urgency-band filter is visual chrome only per Tier 1 acceptance §11 —
      // the fixture carries hoursToExpiry but urgency bands are not materialised
      // as a dedicated field; selecting an urgency chip does not narrow the list.
      // (kept as visual chrome; functional narrowing deferred to service layer)
      return true
    })
  }, [filters.suggestionTypes])

  const counters = useMemo(() => {
    const all = enrichedSuggestions
    return {
      total: all.length,
      singleHop: all.filter((r) => r.sug.suggestionType === 'single_hop').length,
      paired: all.filter((r) => r.sug.suggestionType === 'paired').length,
    }
  }, [])

  const singleHopRows = filtered.filter((r) => r.sug.suggestionType === 'single_hop')
  const pairedRows = filtered.filter((r) => r.sug.suggestionType === 'paired')

  const noneVisible = singleHopRows.length === 0 && pairedRows.length === 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Transfer suggestions
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Cross-Location Transfer Suggestions
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Per-batch suggestions ranked by feasibility score. Single-hop moves stay within
              a cluster; paired routes hop through the Brand Store per §2.2 (Master Spec,
              DL-043). All suggestions are read-only — initiate the transfer to act on one.
            </p>
          </div>
        </header>

        {/* Aggregate counters */}
        <section
          aria-label="Suggestion counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="Total suggestions"
            value={counters.total.toLocaleString('en-IN')}
            secondary="Across all batches"
          />
          <DashboardTile
            label="Single-hop"
            value={counters.singleHop.toLocaleString('en-IN')}
            secondary="Within-cluster direct move"
          />
          <DashboardTile
            label="Paired cross-cluster"
            value={counters.paired.toLocaleString('en-IN')}
            secondary="Brand-Store-routed, atomic approval"
            severity={counters.paired > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {/* Filter strip */}
        <section
          aria-label="Suggestion filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              <FilterChipPicker<SuggestionType>
                title="Type"
                options={[
                  { value: 'single_hop', label: 'Single-hop (within cluster)' },
                  { value: 'paired', label: 'Paired (cross-cluster)' },
                ]}
                selected={filters.suggestionTypes}
                onToggle={(v) =>
                  updateFilter('suggestionTypes', toggleSet(filters.suggestionTypes, v))
                }
                onClear={() => updateFilter('suggestionTypes', new Set())}
              />
              {/*
               * Urgency-band filter is visual chrome only per Tier 1 acceptance §11 —
               * selecting a chip does not actually narrow the list (fixture does not
               * materialise urgency as a queryable field; narrowing deferred to
               * the service-layer suggestion engine).
               */}
              <FilterChipPicker<UrgencyBand>
                title="Urgency"
                options={(['critical', 'high', 'medium'] as const).map((v) => ({
                  value: v,
                  label: URGENCY_LABEL[v],
                }))}
                selected={filters.urgencyBands}
                onToggle={(v) =>
                  updateFilter('urgencyBands', toggleSet(filters.urgencyBands, v))
                }
                onClear={() => updateFilter('urgencyBands', new Set())}
              />
            </div>
            {anyFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-11 px-3 gap-1 tablet:h-9"
                onClick={() => setFilters(INITIAL_FILTERS)}
                aria-label="Reset all filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Reset</span>
              </Button>
            ) : null}
          </div>
        </section>

        {/* Content */}
        {noneVisible ? (
          <section aria-label="No suggestions" className="mt-6">
            <EmptyStatePanel
              onReset={() => setFilters(INITIAL_FILTERS)}
              anyFilterActive={anyFilterActive}
            />
          </section>
        ) : (
          <div className="mt-6 flex flex-col gap-8">

            {/* ── Section A: Single-hop suggestions ─────────────────────── */}
            {singleHopRows.length > 0 ? (
              <section aria-label="Single-hop transfer suggestions">
                <header className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-base font-semibold text-on-surface">
                    Single-hop — within-cluster
                  </h2>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {singleHopRows.length} suggestion{singleHopRows.length !== 1 ? 's' : ''}
                  </span>
                </header>
                <p className="mb-4 text-xs text-on-surface-variant">
                  Direct department-to-department move within the same cluster (DL-043
                  allowance). Standard single-approval path. Ranked by feasibility score.
                </p>
                <div className="flex flex-col gap-4">
                  {singleHopRows.map((row) => (
                    <SingleHopCard
                      key={row.sug.id}
                      row={row}
                      dismissed={dismissedIds.has(row.sug.id)}
                      onDismiss={toggleDismiss}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── Section B: Paired cross-cluster suggestions ─────────────── */}
            {pairedRows.length > 0 ? (
              <section aria-label="Paired Brand-Store-routed transfer suggestions">
                <header className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-base font-semibold text-on-surface">
                    Paired — Brand-Store-routed cross-cluster
                  </h2>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {pairedRows.length} suggestion{pairedRows.length !== 1 ? 's' : ''}
                  </span>
                </header>
                <p className="mb-4 text-xs text-on-surface-variant">
                  Raw materials cannot move laterally between clusters (Master Spec §2.2).
                  Each suggestion below requires a{' '}
                  <span className="font-medium text-on-surface">paired bundle</span>
                  {' '}— two legs via the Brand Store, approved atomically. Ranked by feasibility score.
                </p>
                <div className="flex flex-col gap-4">
                  {pairedRows.map((row) => (
                    <PairedCard
                      key={row.sug.id}
                      row={row}
                      dismissed={dismissedIds.has(row.sug.id)}
                      onDismiss={toggleDismiss}
                    />
                  ))}
                </div>
              </section>
            ) : null}

          </div>
        )}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>Read-only view · no draft state · suggestions surface from the stock engine every 30 s.</span>
          <span className="ml-auto">SI-INV-009 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (b)</span>
        </footer>

      </div>
    </div>
  )
}
