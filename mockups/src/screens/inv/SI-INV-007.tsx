import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Layers,
  MapPin,
  Save,
  Send,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  DraftPill,
  PairedTransferBundle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  type BundleStatus,
  type PairedTransferLeg,
  type PairedTransferLineItem,
} from '@/shell'

import { BRAND, NOW, formatINR, locations } from '@/lib/sample-data'

/**
 * SI-INV-007 — Paired Brand-Store Cross-Cluster Transfer.
 *
 * Tier 1 Group 4, screen 3/3 of Phase 2c-S4. Anchors CC-PAIRED-TRANSFER-BUNDLE
 * (P2B-002) — a single bundled approval object covering two transfer legs that
 * route raw materials cross-cluster via the Brand Store.
 *
 * Master Spec §2.2 forbids lateral raw-material transfer between clusters; the
 * Brand Store is the mandatory hop. The pair structure (Leg 1: Source Cluster
 * Store → Brand Store; Leg 2: Brand Store → Destination Cluster Store) is
 * deliberately VISIBLE per P2B-004 — never hidden as an implementation detail.
 *
 * The screen is invokable directly or pre-filled from SI-INV-008 (expiry
 * countdown dashboard) / SI-INV-009 (cross-location transfer suggestions).
 * Submit routes the bundle to SI-INF-001 (Unified Approval Inbox) where the
 * Brand Owner sees a single bundled-approval card. Approval action is atomic
 * — both legs approve or reject together — but each leg gets its own transfer
 * TRN and lifecycle after decomposition.
 *
 * Cross-cutting:
 *   - CC-DRAFT-PILL (P2B-001) — header chrome shows draft state
 *   - CC-PAIRED-TRANSFER-BUNDLE (P2B-002) — body anchor
 *   - CC-APPROVAL-INBOX-CARD — bundle surfaces in SI-INF-001 as a single card
 *
 * No animation per CLAUDE.md animation policy + DESIGN.md §10.3.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

const BUNDLE_REF = 'XFR-2026-BUNDLE-00042' as const

interface ClusterStoreOption {
  readonly id: string
  readonly cluster: string
  readonly storeLabel: string
  readonly fullLabel: string
}

const CLUSTER_STORE_OPTIONS: ReadonlyArray<ClusterStoreOption> = [
  {
    id: 'loc-andheri-phoenix',
    cluster: 'Andheri-East',
    storeLabel: 'Phoenix Marketcity outlet',
    fullLabel: 'Andheri-East · Phoenix Marketcity outlet',
  },
  {
    id: 'loc-dh-andheri',
    cluster: 'Andheri-East',
    storeLabel: 'Dispatch Hub',
    fullLabel: 'Andheri-East · Dispatch Hub',
  },
  {
    id: 'loc-bandra-linking',
    cluster: 'Bandra-West',
    storeLabel: 'Linking Road outlet',
    fullLabel: 'Bandra-West · Linking Road outlet',
  },
  {
    id: 'loc-bandra-pali',
    cluster: 'Bandra-West',
    storeLabel: 'Pali Hill outlet',
    fullLabel: 'Bandra-West · Pali Hill outlet',
  },
  {
    id: 'loc-powai-hiranandani',
    cluster: 'Powai',
    storeLabel: 'Hiranandani outlet',
    fullLabel: 'Powai · Hiranandani outlet',
  },
] as const

const SOURCE_DEFAULT_ID = 'loc-andheri-phoenix' as const
const DEST_DEFAULT_ID = 'loc-bandra-linking' as const

const REASON_OPTIONS = [
  {
    value: 'expiry_pressure',
    label: 'Source expiry pressure with no within-cluster consumer',
  },
  {
    value: 'destination_demand',
    label: 'Destination demand surge',
  },
  {
    value: 'rebalance',
    label: 'Cluster rebalance',
  },
  {
    value: 'consolidation',
    label: 'Brand-store consolidation',
  },
] as const

type ReasonValue = (typeof REASON_OPTIONS)[number]['value']

// ─────────────────────────────────────────────────────────────────────────────
// Initial line items — drawn from realistic source-expiry batches.
//
// Wild Sugar Andheri-East · Phoenix Marketcity has fresh tomatoes + paneer
// nearing shelf-life; Bandra-West Linking Road can absorb both within the
// remaining shelf life based on average daily prep.
// ─────────────────────────────────────────────────────────────────────────────

interface LineItemDraft extends PairedTransferLineItem {
  readonly initial_qty: number
}

const INITIAL_LINE_ITEMS: ReadonlyArray<LineItemDraft> = [
  {
    material_id: 'mat-tomato',
    material_name: 'Tomato',
    category: 'Vegetables',
    initial_qty: 80,
    qty: 80,
    uom: 'kg',
    batch_ref: 'BAT-2026-04-29-T03',
    expires_on: '2026-05-08',
    expiry_pressure: 'expiring in 48 h',
  },
  {
    material_id: 'mat-paneer',
    material_name: 'Fresh Paneer',
    category: 'Dairy',
    initial_qty: 12,
    qty: 12,
    uom: 'kg',
    batch_ref: 'BAT-2026-05-01-P11',
    expires_on: '2026-05-07',
    expiry_pressure: 'expiring in 36 h',
  },
  {
    material_id: 'mat-curry-leaves',
    material_name: 'Fresh Curry Leaves',
    category: 'Herbs',
    initial_qty: 4,
    qty: 4,
    uom: 'kg',
    batch_ref: 'BAT-2026-05-02-CL07',
    expires_on: '2026-05-08',
    expiry_pressure: 'expiring in 48 h',
  },
] as const

// Risk values — used for the source expiry context panel (₹ at risk).
const RISK_BY_MATERIAL: Record<string, number> = {
  'mat-tomato': 3600, // 80 kg × ₹ 45
  'mat-paneer': 4560, // 12 kg × ₹ 380
  'mat-curry-leaves': 720, // 4 kg × ₹ 180
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface StorePickerProps {
  readonly id: string
  readonly label: string
  readonly selectedId: string
  readonly onSelect: (id: string) => void
  readonly excludeId?: string
}

function StorePicker({
  id,
  label,
  selectedId,
  onSelect,
  excludeId,
}: StorePickerProps) {
  const [open, setOpen] = useState(false)
  const selected =
    CLUSTER_STORE_OPTIONS.find((opt) => opt.id === selectedId) ??
    CLUSTER_STORE_OPTIONS[0]
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-labelledby={`${id}-label`}
            className={[
              'flex items-center justify-between gap-3 rounded-sm bg-surface-container-lowest',
              'px-3 py-3 text-left min-h-[44px]',
              'hover:bg-surface-container-low transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
          >
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                {selected.cluster} cluster
              </span>
              <span className="text-sm font-medium text-on-surface truncate">
                {selected.storeLabel}
              </span>
            </span>
            <MapPin
              className="h-4 w-4 shrink-0 text-on-surface-variant"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] p-1">
          <ul className="flex flex-col">
            {CLUSTER_STORE_OPTIONS.map((opt) => {
              const isSelected = opt.id === selectedId
              const isDisabled = opt.id === excludeId
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onSelect(opt.id)
                      setOpen(false)
                    }}
                    aria-pressed={isSelected}
                    className={[
                      'w-full flex flex-col gap-0.5 rounded-sm px-3 py-2.5 text-left',
                      'min-h-[44px]',
                      'hover:bg-surface-container-high transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected ? 'bg-surface-container' : '',
                      isDisabled ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                      {opt.cluster}
                    </span>
                    <span className="text-sm font-medium text-on-surface">
                      {opt.storeLabel}
                    </span>
                    {isDisabled ? (
                      <span className="text-[10px] text-on-surface-variant">
                        Already chosen on the other side
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface SourceExpiryPanelProps {
  readonly items: ReadonlyArray<LineItemDraft>
  readonly sourceLabel: string
}

function SourceExpiryPanel({ items, sourceLabel }: SourceExpiryPanelProps) {
  const totalRisk = items.reduce(
    (acc, it) => acc + (RISK_BY_MATERIAL[it.material_id] ?? 0),
    0,
  )
  return (
    <section
      aria-label="Source expiry pressure summary"
      className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-warning text-on-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-on-surface">
            Source expiry pressure — {sourceLabel}
          </h2>
        </div>
        <span className="text-xs tabular-nums text-on-surface">
          <span className="text-on-surface-variant">Value at risk</span>{' '}
          <span className="font-semibold">{formatINR(totalRisk)}</span>
        </span>
      </header>
      <p className="mt-2 text-xs text-on-surface-variant">
        Why is this happening? These batches will lose value if no within-cluster
        consumer absorbs them in time. Master Spec §2.2 requires the routing hop
        through the Brand Store before the destination cluster can draw stock.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const risk = RISK_BY_MATERIAL[item.material_id] ?? 0
          return (
            <li
              key={item.material_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface-container-low px-3 py-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-on-surface">
                  {item.qty} {item.uom} {item.material_name.toLowerCase()}
                  {' · '}
                  <span className="text-on-surface-variant">
                    {item.expiry_pressure}
                  </span>
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Batch <span className="font-mono">{item.batch_ref}</span>
                  {' · expires '}
                  {item.expires_on}
                </span>
              </div>
              <span className="text-xs tabular-nums">
                <span className="text-on-surface-variant">at risk</span>{' '}
                <span className="font-semibold text-on-surface">
                  {formatINR(risk)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface DestinationConsumptionPanelProps {
  readonly destinationLabel: string
}

function DestinationConsumptionPanel({
  destinationLabel,
}: DestinationConsumptionPanelProps) {
  return (
    <section
      aria-label="Destination consumption capacity"
      className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
    >
      <header className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-secondary-container text-on-secondary-container">
          <Layers className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h2 className="text-base font-semibold text-on-surface">
          Destination consumption — {destinationLabel}
        </h2>
      </header>
      <p className="mt-2 text-xs text-on-surface-variant">
        Average daily prep at the destination, drawn from FR32 cross-location
        transfer suggestions. Defaults below are based on 14-day rolling
        averages.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        <li className="rounded-sm bg-surface-container-low px-3 py-2">
          <p className="text-sm text-on-surface">
            Bandra Linking Road can consume{' '}
            <span className="font-semibold">60 kg tomatoes</span> over 36 hours
            (avg 40 kg/day prep · curries + chutneys).
          </p>
        </li>
        <li className="rounded-sm bg-surface-container-low px-3 py-2">
          <p className="text-sm text-on-surface">
            Bandra Linking Road consumed{' '}
            <span className="font-semibold">8 kg paneer/day</span> average over
            the past 14 days (paneer tikka + palak paneer rotation).
          </p>
        </li>
        <li className="rounded-sm bg-surface-container-low px-3 py-2">
          <p className="text-sm text-on-surface">
            Curry leaves run-rate{' '}
            <span className="font-semibold">2.5 kg/day</span> across South
            Indian thali + tempering needs.
          </p>
        </li>
      </ul>
    </section>
  )
}

interface LineItemEditorProps {
  readonly items: ReadonlyArray<LineItemDraft>
  readonly onChangeQty: (materialId: string, qty: number) => void
  readonly leg: 'leg1' | 'leg2'
}

function LineItemEditor({ items, onChangeQty, leg }: LineItemEditorProps) {
  return (
    <div className="rounded-md bg-surface-container-lowest p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {leg === 'leg1' ? 'Leg 1 quantities (Source → Brand Store)' : 'Leg 2 quantities (Brand Store → Destination)'}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">
        Defaults populate from{' '}
        {leg === 'leg1'
          ? 'source-expiry pressure batches.'
          : 'destination consumption capacity.'}{' '}
        Adjust below.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={`${leg}-${item.material_id}`}
            className="flex flex-wrap items-center gap-3 rounded-sm bg-surface-container-low px-3 py-2.5"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-on-surface">
                {item.material_name}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                <span className="font-mono">{item.batch_ref}</span> · expires{' '}
                {item.expires_on}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor={`${leg}-qty-${item.material_id}`}
                className="text-[11px] uppercase tracking-wider text-on-surface-variant"
              >
                Quantity
              </label>
              <input
                id={`${leg}-qty-${item.material_id}`}
                type="number"
                min={0}
                step={0.5}
                value={item.qty}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next)) onChangeQty(item.material_id, next)
                }}
                className={[
                  'w-20 rounded-sm bg-surface-container-highest text-on-surface',
                  'px-2 py-2 text-sm font-medium tabular-nums text-right min-h-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              />
              <span className="text-xs text-on-surface-variant w-6 shrink-0">
                {item.uom}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ReasonPickerProps {
  readonly value: ReasonValue | ''
  readonly onChange: (v: ReasonValue) => void
}

function ReasonPicker({ value, onChange }: ReasonPickerProps) {
  const isInvalid = value === ''
  return (
    <section
      aria-label="Bundle reason code"
      className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Why is this happening?
            <span aria-hidden className="ml-1 text-error">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </p>
          <h2 className="mt-1 text-base font-semibold text-on-surface">
            Reason code
          </h2>
        </div>
        {isInvalid ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-pill bg-error text-on-error px-2 py-0.5 text-[11px] font-medium"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Required
          </span>
        ) : null}
      </header>
      <p className="mt-2 text-xs text-on-surface-variant">
        Recorded with the bundle and threaded through the audit trail.
      </p>
      <div
        role="radiogroup"
        aria-required="true"
        aria-invalid={isInvalid}
        aria-label="Reason code (required)"
        className="mt-3 flex flex-col gap-2"
      >
        {REASON_OPTIONS.map((opt) => {
          const checked = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(opt.value)}
              className={[
                'flex items-center justify-between gap-3 rounded-sm px-3 py-3 text-left',
                'min-h-[44px]',
                'hover:bg-surface-container-high transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                checked ? 'bg-surface-container' : 'bg-surface-container-low',
              ].join(' ')}
            >
              <span className="text-sm text-on-surface">{opt.label}</span>
              {checked ? (
                <span className="text-[11px] font-medium text-primary">
                  Selected
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv007() {
  const [sourceId, setSourceId] = useState<string>(SOURCE_DEFAULT_ID)
  const [destId, setDestId] = useState<string>(DEST_DEFAULT_ID)
  const [reason, setReason] = useState<ReasonValue | ''>('')
  const [items, setItems] = useState<ReadonlyArray<LineItemDraft>>(
    INITIAL_LINE_ITEMS,
  )
  const [bundleStatus] = useState<BundleStatus>('draft')

  const sourceOption =
    CLUSTER_STORE_OPTIONS.find((o) => o.id === sourceId) ??
    CLUSTER_STORE_OPTIONS[0]
  const destOption =
    CLUSTER_STORE_OPTIONS.find((o) => o.id === destId) ??
    CLUSTER_STORE_OPTIONS[0]

  // Pre-fill affordance — fixture: source was pre-filled from SI-INV-008.
  const wasPrefilledFromExpiryDashboard = sourceId === SOURCE_DEFAULT_ID

  const onChangeQty = (materialId: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.material_id === materialId ? { ...it, qty } : it,
      ),
    )
  }

  // Compose two legs from the line items (same items per leg by design — Leg 1
  // is the return-to-brand pass; Leg 2 is the draw-from-brand pass).
  const legs: readonly [PairedTransferLeg, PairedTransferLeg] = useMemo(() => {
    const leg1: PairedTransferLeg = {
      label: 'Leg 1 · Return to Brand Store',
      source_label: sourceOption.fullLabel,
      destination_label: `${BRAND.name} · Brand Store`,
      line_items: items,
      expiry_context: `${sourceOption.cluster} cluster has ${items[0]?.qty ?? 0} kg ${items[0]?.material_name.toLowerCase() ?? ''} expiring in ${items[0]?.expiry_pressure ?? 'soon'}`,
    }
    const leg2: PairedTransferLeg = {
      label: 'Leg 2 · Draw from Brand Store',
      source_label: `${BRAND.name} · Brand Store`,
      destination_label: destOption.fullLabel,
      line_items: items,
    }
    return [leg1, leg2] as const
  }, [items, sourceOption, destOption])

  const totalUnits = items.reduce((acc, it) => acc + it.qty, 0)

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Inventory · Cross-cluster transfer
              </p>
              <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                Paired Brand-Store Cross-Cluster Transfer
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Master Spec §2.2 forbids lateral raw-material transfer between
                clusters. Cross-cluster moves must hop through the Brand Store —
                returned in Leg 1 and drawn into the destination in Leg 2. Both
                legs travel together as a single bundled-approval object (P2B-002).
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Bundle
                </span>
                <span className="font-mono text-sm text-on-surface">
                  {BUNDLE_REF}
                </span>
                <DraftPill isDraft={bundleStatus === 'draft'} />
                <AuditLink entityRef={BUNDLE_REF} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/SI-INV-008"
                className={[
                  'inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-3 py-2',
                  'text-xs font-medium text-on-surface min-h-[44px]',
                  'hover:bg-surface-container-high transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </Link>
              <Button variant="tonal" size="sm" className="gap-1.5 min-h-[44px]">
                <Save className="h-3.5 w-3.5" aria-hidden />
                Save draft
              </Button>
              <Link
                to={`/SI-INF-001?bundle=${encodeURIComponent(BUNDLE_REF)}`}
                aria-disabled={reason === ''}
                className={[
                  'inline-flex items-center gap-1.5 rounded-sm bg-primary text-on-primary px-4 py-2',
                  'text-sm font-medium min-h-[44px]',
                  'hover:opacity-90 transition-opacity',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  reason === '' ? 'pointer-events-none opacity-60' : '',
                ].join(' ')}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Submit bundle
              </Link>
            </div>
          </div>

          {wasPrefilledFromExpiryDashboard ? (
            <div
              role="note"
              className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-container-low px-3 py-2"
            >
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                Pre-filled from
              </span>
              <Link
                to="/SI-INV-008"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                SI-INV-008 · Expiry countdown dashboard
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
              <span className="text-[11px] text-on-surface-variant">
                Source store and line items defaulted from expiry batches.
              </span>
            </div>
          ) : null}
        </header>

        <SectionShift tone="low" className="my-6" aria-hidden />

        {/* Cluster store pickers */}
        <section
          aria-label="Cluster store selection"
          className="grid grid-cols-1 tablet:grid-cols-2 gap-4"
        >
          <StorePicker
            id="source-store"
            label="Source cluster store"
            selectedId={sourceId}
            onSelect={setSourceId}
            excludeId={destId}
          />
          <StorePicker
            id="destination-store"
            label="Destination cluster store"
            selectedId={destId}
            onSelect={setDestId}
            excludeId={sourceId}
          />
        </section>

        {/* Context panels */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-2 gap-4">
          <SourceExpiryPanel
            items={items}
            sourceLabel={sourceOption.storeLabel}
          />
          <DestinationConsumptionPanel
            destinationLabel={destOption.storeLabel}
          />
        </div>

        {/* Bundle visualisation — the P2B-002 anchor */}
        <section
          aria-label="Paired transfer bundle visualisation"
          className="mt-6"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-on-surface">
              Bundle structure
            </h2>
            <p className="text-[11px] text-on-surface-variant">
              Both legs visible per P2B-004 · {totalUnits.toFixed(1)} units total
            </p>
          </header>
          <PairedTransferBundle
            bundleRef={BUNDLE_REF}
            originatingCluster={sourceOption.cluster}
            destinationCluster={destOption.cluster}
            legs={legs}
            consumptionContext={`${destOption.storeLabel} can absorb the bundle within 36–48 hours based on average daily prep — see destination consumption panel above.`}
            bundleStatus={bundleStatus}
            footerSlot={
              <div className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-container-lowest px-3 py-2 text-[11px] text-on-surface-variant">
                <StatusPill
                  status="status_pending_approval"
                  size="sm"
                  label="Atomic approval"
                />
                <span>
                  Both legs approve or reject together as a single bundle
                  (P2B-002). Each leg gets its own transfer TRN after Brand
                  Owner approval.
                </span>
              </div>
            }
          />
        </section>

        {/* Per-leg quantity editor */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-2 gap-4">
          <LineItemEditor items={items} onChangeQty={onChangeQty} leg="leg1" />
          <LineItemEditor items={items} onChangeQty={onChangeQty} leg="leg2" />
        </div>

        {/* Reason code */}
        <div className="mt-6">
          <ReasonPicker value={reason} onChange={setReason} />
        </div>

        {/* Footer-level action repeat (in case the user has scrolled) */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/SI-INV-008"
            className={[
              'inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-3 py-2',
              'text-xs font-medium text-on-surface min-h-[44px]',
              'hover:bg-surface-container-high transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </Link>
          <Button variant="tonal" size="sm" className="gap-1.5 min-h-[44px]">
            <Save className="h-3.5 w-3.5" aria-hidden />
            Save draft
          </Button>
          <Link
            to={`/SI-INF-001?bundle=${encodeURIComponent(BUNDLE_REF)}`}
            aria-disabled={reason === ''}
            className={[
              'inline-flex items-center gap-1.5 rounded-sm bg-primary text-on-primary px-4 py-2',
              'text-sm font-medium min-h-[44px]',
              'hover:opacity-90 transition-opacity',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              reason === '' ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Submit bundle to Brand Owner
          </Link>
        </div>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <FileText className="h-3 w-3" aria-hidden />
          <span>
            SI-INV-007 · Tier 1 Group 4 · Phase 2c-S4 · Source: FR29, FR32, FR16
            · Master Spec §2.2 raw-material routing · → SI-INF-001 unified
            approval inbox
          </span>
          <span className="ml-auto">NOW {NOW}</span>
        </footer>

        {/* Suppress unused warnings — locations is conceptually backing the
            picker fixture even though the local CLUSTER_STORE_OPTIONS table
            is the rendered source. */}
        <span aria-hidden className="hidden">
          {locations.length} locations available
        </span>
      </div>
    </div>
  )
}
