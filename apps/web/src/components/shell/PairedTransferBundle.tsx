import { type ReactNode } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Layers,
  Store,
  TriangleAlert,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { StatusPill } from './StatusPill'
import type { StatusKey } from '@/lib/tokens'

/**
 * PairedTransferBundle — CC-PAIRED-TRANSFER-BUNDLE canonical visualisation
 * (P2B-002, anchored by SI-INV-007 and surfaced inside SI-INF-001 inbox cards).
 *
 * Master Spec §2.2 forbids lateral raw-material transfer between clusters;
 * cross-cluster moves must hop through the Brand Store. This component makes
 * that constraint VISIBLE per P2B-004 — both legs (Source → Brand Store and
 * Brand Store → Destination) render explicitly with their own line items,
 * batch references, and expiry-pressure context. The whole bundle carries a
 * single bundled-approval status pill — both legs approve or reject together.
 *
 * Two layout modes:
 *   - `compact={false}` (default) — full form / detail surface (SI-INV-007).
 *     Brand Store renders as a labelled hub between the two legs; each leg
 *     has its own card with line-item list, batch refs, expiry context.
 *   - `compact={true}` — dense inbox-card mode for SI-INF-001. The two legs
 *     collapse into stacked rows; expiry pressure surfaces as inline pill;
 *     suitable for ~320 px-wide cards in an approval inbox list.
 *
 * Status: the bundled-approval status pill is the P2B-002 contract —
 * `draft | pending_approval | approved | rejected` map to the canonical
 * §6.1 lifecycle tokens. After approval, the bundle decomposes into two legs
 * which each generate their own transfer TRN; the *approval action* is
 * atomic. The component does not own that decomposition — it is a read-mostly
 * visualisation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BundleStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'

export interface PairedTransferLineItem {
  readonly material_id: string
  readonly material_name: string
  /** Free-form category label (e.g. "Vegetables", "Dairy"). */
  readonly category?: string
  readonly qty: number
  readonly uom: string
  /** Source batch reference — e.g. "BAT-2026-04-29-T03". */
  readonly batch_ref: string
  /** ISO date (YYYY-MM-DD) of the batch's expiry. */
  readonly expires_on: string
  /** Hours-until-expiry pressure descriptor — e.g. "48h", "3d". */
  readonly expiry_pressure?: string
}

export interface PairedTransferLeg {
  /** "Leg 1" or "Leg 2". */
  readonly label: string
  readonly source_label: string
  readonly destination_label: string
  readonly line_items: ReadonlyArray<PairedTransferLineItem>
  /** Optional warning-toned context string surfaced inside this leg. */
  readonly expiry_context?: string
}

export interface PairedTransferBundleProps {
  /** Bundle reference, e.g. "XFR-2026-BUNDLE-00042". */
  readonly bundleRef: string
  /** Originating cluster name — e.g. "Andheri-East". */
  readonly originatingCluster: string
  /** Destination cluster name — e.g. "Bandra-West". */
  readonly destinationCluster: string
  /** The two legs. Tuple-shape: [leg1, leg2]. */
  readonly legs: readonly [PairedTransferLeg, PairedTransferLeg]
  /** Optional consumption-capacity context for the destination. */
  readonly consumptionContext?: string
  /** Bundled-approval state. Defaults to `'draft'`. */
  readonly bundleStatus?: BundleStatus
  /** Compact inbox-card variant. Defaults to `false`. */
  readonly compact?: boolean
  /**
   * Optional slot rendered at the bottom of the bundle (e.g. action buttons,
   * helper text). Honoured in both compact and full layouts.
   */
  readonly footerSlot?: ReactNode
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TOKEN_OF: Record<BundleStatus, StatusKey> = {
  draft: 'status_draft',
  pending_approval: 'status_pending_approval',
  approved: 'status_confirmed',
  rejected: 'status_rejected',
}

const STATUS_LABEL_OF: Record<BundleStatus, string> = {
  draft: 'Draft — bundle not yet submitted',
  pending_approval: 'Pending — atomic bundle approval',
  approved: 'Approved — both legs',
  rejected: 'Rejected — both legs',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface LocationChipProps {
  readonly label: string
  readonly icon?: ReactNode
  readonly accent?: 'neutral' | 'brand_hub'
}

function LocationChip({ label, icon, accent = 'neutral' }: LocationChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium',
        accent === 'brand_hub'
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container-high text-on-surface',
      )}
    >
      {icon}
      {label}
    </span>
  )
}

interface ExpiryContextStripProps {
  readonly text: string
  readonly compact?: boolean
}

function ExpiryContextStrip({ text, compact = false }: ExpiryContextStripProps) {
  return (
    <div
      role="note"
      aria-label="Expiry pressure context"
      className={cn(
        'flex items-start gap-2 rounded-sm bg-warning text-on-warning',
        compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs',
      )}
    >
      <TriangleAlert
        className={cn('shrink-0', compact ? 'h-3 w-3 mt-0.5' : 'h-3.5 w-3.5 mt-0.5')}
        aria-hidden
      />
      <span className="font-medium">{text}</span>
    </div>
  )
}

interface LineItemRowProps {
  readonly item: PairedTransferLineItem
  readonly compact?: boolean
}

function LineItemRow({ item, compact = false }: LineItemRowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-sm bg-surface-container-low',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate font-medium text-on-surface',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {item.material_name}
        </p>
        <p
          className={cn(
            'mt-0.5 flex flex-wrap items-center gap-1.5 text-on-surface-variant',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <span className="font-mono">{item.batch_ref}</span>
          <span aria-hidden>·</span>
          <CalendarClock className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
          <span>exp {item.expires_on}</span>
          {item.expiry_pressure ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium">{item.expiry_pressure}</span>
            </>
          ) : null}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 tabular-nums font-semibold text-on-surface',
          compact ? 'text-xs' : 'text-sm',
        )}
        aria-label={`Quantity ${item.qty} ${item.uom}`}
      >
        {item.qty} {item.uom}
      </span>
    </div>
  )
}

interface LegPanelProps {
  readonly leg: PairedTransferLeg
  readonly compact?: boolean
}

function LegPanel({ leg, compact = false }: LegPanelProps) {
  return (
    <section
      aria-label={`${leg.label}: ${leg.source_label} to ${leg.destination_label}`}
      className={cn(
        'rounded-md bg-surface-container-lowest',
        compact ? 'p-2.5' : 'p-4 tablet:p-5',
      )}
    >
      <header className="flex flex-col gap-2">
        <span
          className={cn(
            'font-medium uppercase tracking-wider text-on-surface-variant',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          {leg.label}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <LocationChip
            label={leg.source_label}
            icon={
              <Store
                className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                aria-hidden
              />
            }
          />
          <ArrowRight
            className={cn('shrink-0 text-on-surface-variant', compact ? 'h-3 w-3' : 'h-4 w-4')}
            aria-hidden
          />
          <LocationChip
            label={leg.destination_label}
            icon={
              <Store
                className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                aria-hidden
              />
            }
          />
        </div>
      </header>

      {leg.expiry_context ? (
        <div className={compact ? 'mt-2' : 'mt-3'}>
          <ExpiryContextStrip text={leg.expiry_context} compact={compact} />
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col',
          compact ? 'mt-2 gap-1' : 'mt-3 gap-1.5',
        )}
      >
        {leg.line_items.map((item, idx) => (
          <LineItemRow
            key={`${item.material_id}-${idx}`}
            item={item}
            compact={compact}
          />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Store hub — the visual anchor that communicates §2.2 routing
// ─────────────────────────────────────────────────────────────────────────────

interface BrandHubProps {
  readonly compact?: boolean
}

function BrandHub({ compact = false }: BrandHubProps) {
  return (
    <div
      role="img"
      aria-label="Brand Store routing hub — Master Spec §2.2 raw-material constraint"
      className={cn(
        'flex items-center justify-center gap-2 rounded-md bg-primary text-on-primary',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <Building2
        className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
        aria-hidden
      />
      <div className="flex flex-col">
        <span
          className={cn(
            'font-semibold uppercase tracking-wider',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          Brand Store hub
        </span>
        <span
          className={cn(
            compact ? 'text-[10px] opacity-90' : 'text-xs opacity-90',
          )}
        >
          Routes raw materials between clusters
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PairedTransferBundle({
  bundleRef,
  originatingCluster,
  destinationCluster,
  legs,
  consumptionContext,
  bundleStatus = 'draft',
  compact = false,
  footerSlot,
  className,
}: PairedTransferBundleProps) {
  const statusToken = STATUS_TOKEN_OF[bundleStatus]
  const statusLabel = STATUS_LABEL_OF[bundleStatus]

  if (compact) {
    return (
      <article
        data-slot="paired-transfer-bundle"
        aria-label={`Paired Brand-Store transfer bundle ${bundleRef}`}
        className={cn(
          'flex flex-col gap-2 rounded-md bg-surface-container-low p-3',
          className,
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex flex-col">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              <Layers className="h-3 w-3" aria-hidden />
              Paired bundle · P2B-002
            </span>
            <span className="font-mono text-xs text-on-surface mt-0.5">
              {bundleRef}
            </span>
          </div>
          <StatusPill status={statusToken} size="sm" label={statusLabel} />
        </header>

        <p className="text-[11px] text-on-surface-variant">
          {originatingCluster} → Brand Store → {destinationCluster} · atomic approval
        </p>

        <div className="flex flex-col gap-2">
          {legs.map((leg, idx) => (
            <LegPanel key={`${leg.label}-${idx}`} leg={leg} compact />
          ))}
        </div>

        {consumptionContext ? (
          <p className="text-[11px] text-on-surface-variant">
            <span className="font-medium">Consumption context:</span>{' '}
            {consumptionContext}
          </p>
        ) : null}

        {footerSlot}
      </article>
    )
  }

  // ── Full form / detail surface ────────────────────────────────────────────
  return (
    <article
      data-slot="paired-transfer-bundle"
      aria-label={`Paired Brand-Store transfer bundle ${bundleRef}`}
      className={cn(
        'flex flex-col gap-4 rounded-md bg-surface-container p-4 tablet:p-5',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Paired Brand-Store transfer bundle · P2B-002
          </span>
          <p className="mt-1 font-mono text-sm text-on-surface">{bundleRef}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Originating: <span className="text-on-surface">{originatingCluster}</span>
            {' · '}
            Destination: <span className="text-on-surface">{destinationCluster}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={statusToken} label={statusLabel} />
          <span className="text-[11px] text-on-surface-variant">
            Both legs approve or reject together
          </span>
        </div>
      </header>

      {/* Visual routing strip — Source → Brand Hub → Destination */}
      <div
        aria-hidden
        className="grid grid-cols-1 tablet:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3"
      >
        <div className="flex justify-center">
          <LocationChip
            label={legs[0].source_label}
            icon={<Store className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
        <ArrowRight
          className="hidden tablet:block h-5 w-5 text-on-surface-variant justify-self-center"
          aria-hidden
        />
        <div className="flex justify-center">
          <BrandHub />
        </div>
        <ArrowRight
          className="hidden tablet:block h-5 w-5 text-on-surface-variant justify-self-center"
          aria-hidden
        />
        <div className="flex justify-center">
          <LocationChip
            label={legs[1].destination_label}
            icon={<Store className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
      </div>

      {/* Two-leg side-by-side panels (stacks on mobile) */}
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <LegPanel leg={legs[0]} />
        <LegPanel leg={legs[1]} />
      </div>

      {consumptionContext ? (
        <div
          role="note"
          aria-label="Destination consumption capacity context"
          className="rounded-sm bg-surface-container-lowest p-3"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Destination consumption capacity
          </p>
          <p className="mt-1 text-sm text-on-surface">{consumptionContext}</p>
        </div>
      ) : null}

      {footerSlot}
    </article>
  )
}
