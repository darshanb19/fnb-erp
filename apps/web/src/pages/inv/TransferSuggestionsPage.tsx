import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CircleOff,
  Lightbulb,
  X,
} from 'lucide-react'

import {
  DashboardTile,
  SectionShift,
} from '@/components/shell'

import { useTransferSuggestions } from '@/hooks/inv/useStockTransfers'
import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
import type { TransferSuggestion } from '@/hooks/inv/schemas'

/**
 * SI-INV-009 — Cross-Location Transfer Suggestions (production port of Arc-b mockup).
 *
 * Tier 2 Group 1, Epic 4 Arc (c). Read-only suggestion surface.
 *
 * The /stock-transfers/suggestions endpoint requires BOTH a source AND destination
 * department, so this page is a "pick source + dest dept → see ranked suggestions"
 * flow. Until both are chosen, a prompt is shown (the query is disabled).
 *
 * Divergences from Arc-(b) mockup (intentional, per Wave-1 spec):
 *   1. Single-hop vs paired split REMOVED — the live endpoint returns a flat
 *      list of TransferSuggestion (no suggestionType / feasibilityScore field);
 *      all suggestions are rendered uniformly with the server reason string.
 *   2. PairedTransferBundle component REMOVED — it used paired-only chrome
 *      not backed by the Wave-1 endpoint.
 *   3. FeasibilityScoreBadge REMOVED — feasibilityScore not in endpoint.
 *   4. UrgencyPip / hoursToExpiry REMOVED — not in TransferSuggestion.
 *   5. Suggestion-type filter chip REMOVED — not backed (would silently hide rows).
 *   6. Urgency-band filter chip REMOVED — not backed.
 *   7. Dismiss control is rendered DISABLED with title="Available in Wave 2"
 *      (Wave-2 mutation not yet wired).
 *   8. "Initiate transfer" links to Wave-2 screens disabled with same title.
 *   9. DashboardTile counters reduced to "total suggestions" only (no single-hop /
 *      paired counts since type is not in the endpoint).
 *
 * FRs: FR28 (transfer suggestion engine), §2.2 (cluster routing rule), DL-043.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SuggestionRow — maps TransferSuggestion to display shape
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestionRowProps {
  readonly suggestion: TransferSuggestion
}

function SuggestionRow({ suggestion }: SuggestionRowProps) {
  return (
    <article
      aria-label={`Transfer suggestion for ${suggestion.productName}`}
      className="flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Suggested transfer
          </p>
          <h3 className="mt-1 text-base font-semibold text-on-surface truncate">
            {suggestion.productName}
          </h3>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-on-surface leading-none">
            {suggestion.suggestedQty}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
            suggested qty
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-sm bg-surface-container-low p-3 flex flex-col gap-2">
        <p className="text-xs text-on-surface-variant">
          Available at source:{' '}
          <span className="font-medium text-on-surface tabular-nums">
            {suggestion.availableQty}
          </span>
        </p>
        <p className="text-xs text-on-surface-variant">
          Route:{' '}
          <span className="font-medium text-on-surface">Source dept</span>
          <ArrowRight className="inline h-3 w-3 mx-1 text-on-surface-variant" aria-hidden />
          <span className="font-medium text-on-surface">Destination dept</span>
        </p>
        {suggestion.reason ? (
          <p className="text-xs text-on-surface-variant">
            Reason:{' '}
            <span className="font-medium text-on-surface">{suggestion.reason}</span>
          </p>
        ) : null}
      </div>

      {/* Actions — initiate transfer deferred to Wave 2; dismiss deferred to Wave 2 */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled
          title="Not yet available"
          aria-disabled="true"
          className={[
            'inline-flex items-center gap-1.5 rounded-pill bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary',
            'opacity-40 cursor-not-allowed',
          ].join(' ')}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          Initiate transfer
        </button>
        <button
          type="button"
          disabled
          title="Not yet available"
          aria-disabled="true"
          className={[
            'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium',
            'bg-surface-container-low text-on-surface-variant',
            'opacity-40 cursor-not-allowed',
          ].join(' ')}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Dismiss
        </button>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-selection prompt (shown when either dept is not yet chosen)
// ─────────────────────────────────────────────────────────────────────────────

function PreSelectionPrompt() {
  return (
    <div className="rounded-md bg-surface-container-lowest p-10 text-center">
      <Lightbulb
        className="mx-auto h-10 w-10 text-on-surface-variant"
        aria-hidden
      />
      <p className="mt-3 text-base font-semibold text-on-surface">
        Pick a source and destination department to see suggestions
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">
        The suggestion engine requires both a source and a destination department to
        surface ranked transfer recommendations.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state (query returned [])
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStatePanel() {
  return (
    <div className="rounded-md bg-surface-container-lowest p-10 text-center">
      <Lightbulb
        className="mx-auto h-10 w-10 text-on-surface-variant"
        aria-hidden
      />
      <p className="mt-3 text-base font-semibold text-on-surface">
        No suggestions for this department pair
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">
        The suggestion engine found no transfer candidates for the selected
        source and destination departments. Try a different pair.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TransferSuggestionsPage() {
  // ── Hooks — ALL hook calls ABOVE any early-return guards (Rules of Hooks) ──
  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()

  const [source, setSource] = useState<string | undefined>(undefined)
  const [dest, setDest] = useState<string | undefined>(undefined)

  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    error,
  } = useTransferSuggestions(source, dest)

  // Total suggestions counter (memoised so the value is stable)
  const totalSuggestions = useMemo(() => suggestions?.length ?? 0, [suggestions])

  // Combined loading guard — wait for dept list AND (when both chosen) suggestions
  const bothChosen = Boolean(source) && Boolean(dest)
  const isLoading = deptsLoading || (bothChosen && suggestionsLoading)

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="status" aria-label="Loading" className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-md bg-surface-container-low animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {error instanceof ApiError ? error.message : 'Failed to load. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

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
              Select a source and destination department to surface ranked transfer
              recommendations. All suggestions are read-only.
            </p>
          </div>
        </header>

        {/* Department selectors */}
        <section aria-label="Department selectors" className="mt-6 flex flex-wrap gap-6">
          <div>
            <label
              htmlFor="source-dept-select"
              className="block text-xs font-medium text-on-surface-variant mb-1"
            >
              Source department
            </label>
            <select
              id="source-dept-select"
              value={source ?? ''}
              onChange={(e) => setSource(e.target.value || undefined)}
              className={[
                'h-11 rounded-md px-3 text-sm text-on-surface',
                'bg-surface-container-low',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[240px] max-w-xs',
              ].join(' ')}
            >
              <option value="">— Select source —</option>
              {(depts ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="dest-dept-select"
              className="block text-xs font-medium text-on-surface-variant mb-1"
            >
              Destination department
            </label>
            <select
              id="dest-dept-select"
              value={dest ?? ''}
              onChange={(e) => setDest(e.target.value || undefined)}
              className={[
                'h-11 rounded-md px-3 text-sm text-on-surface',
                'bg-surface-container-low',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[240px] max-w-xs',
              ].join(' ')}
            >
              <option value="">— Select destination —</option>
              {(depts ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Aggregate counter — only shown when both depts are chosen */}
        {bothChosen ? (
          <section
            aria-label="Suggestion counters"
            className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
          >
            <DashboardTile
              label="Total suggestions"
              value={totalSuggestions.toLocaleString('en-IN')}
              secondary="For selected department pair"
            />
          </section>
        ) : null}

        {/* Content area */}
        <section aria-label="Transfer suggestions" className="mt-6">
          {!bothChosen ? (
            <PreSelectionPrompt />
          ) : !suggestions || suggestions.length === 0 ? (
            <EmptyStatePanel />
          ) : (
            <div className="flex flex-col gap-4">
              <header className="flex items-baseline gap-3">
                <h2 className="text-base font-semibold text-on-surface">
                  Suggestions
                </h2>
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                </span>
              </header>
              <p className="text-xs text-on-surface-variant -mt-2">
                Ranked by the server suggestion engine.
              </p>
              {suggestions.map((sug) => (
                <SuggestionRow key={sug.productId} suggestion={sug} />
              ))}
            </div>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only view.
          </span>
        </footer>

      </div>
    </div>
  )
}
