import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  FileText,
  Layers,
  MapPin,
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
} from '@/components/shell'

import { useInventoryStores, useInventoryUoms } from '@/hooks/inv/useOrgLists'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { useCreateBundle, useApproveBundle, type CreateBundleInput } from '@/hooks/inv/useStockTransfers'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-007 — Paired Brand-Store Cross-Cluster Transfer (Tier 1 hero).
 *
 * Production port of the Arc-(b) mockup. Reduced to a SINGLE-ITEM bundle
 * (the backend bundle service accepts one product per bundle).
 *
 * Divergences from Arc-(b) mockup (intentional):
 *   1. CLUSTER_STORE_OPTIONS fixture → live data from useInventoryStores
 *      (stores filtered to level==='cluster' for source/dest; level==='brand'
 *      for the Brand Store intermediary).
 *   2. 3-line INITIAL_LINE_ITEMS → single product picker (native <select>
 *      from useInventoryProductNames().list) + single qty field + uom picker.
 *   3. SourceExpiryPanel / DestinationConsumptionPanel (fabricated metrics)
 *      → DROPPED; replaced by static §2.2 explanatory copy only.
 *   4. Fabricated BUNDLE_REF constant → AuditLink only rendered after
 *      createBundle returns a real bundleRef.
 *   5. Submit → SI-INF-001 inbox → DROPPED. The Arc-(a) bundle path does NOT
 *      create an approval_request; approval is the direct /bundles/:id/approve
 *      call. Bundle creation + decomposition is surfaced inline.
 *
 * FRs: FR29, FR16 (§2.2 routing), FR28. DL-049, DL-050, DL-051.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Reason options (carried from mockup)
// ─────────────────────────────────────────────────────────────────────────────

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
// StorePicker sub-component (Popover-based, from mockup)
// ─────────────────────────────────────────────────────────────────────────────

interface StoreOption {
  readonly id: string
  readonly name: string
  readonly clusterId?: string | null
}

interface StorePickerProps {
  readonly id: string
  readonly label: string
  readonly selectedId: string | undefined
  readonly onSelect: (id: string) => void
  readonly options: ReadonlyArray<StoreOption>
  readonly excludeId?: string
}

function StorePicker({
  id,
  label,
  selectedId,
  onSelect,
  options,
  excludeId,
}: StorePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((opt) => opt.id === selectedId)

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
              {selected ? (
                <>
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                    {selected.clusterId ? 'Cluster store' : 'Store'}
                  </span>
                  <span className="text-sm font-medium text-on-surface truncate">
                    {selected.name}
                  </span>
                </>
              ) : (
                <span className="text-sm text-on-surface-variant">
                  Select a cluster store…
                </span>
              )}
            </span>
            <MapPin className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] p-1">
          <ul className="flex flex-col">
            {options.map((opt) => {
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
                    <span className="text-sm font-medium text-on-surface">
                      {opt.name}
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

// ─────────────────────────────────────────────────────────────────────────────
// ReasonPicker sub-component (from mockup)
// ─────────────────────────────────────────────────────────────────────────────

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
// Empty state — requires brand store + ≥2 cluster stores
// ─────────────────────────────────────────────────────────────────────────────

function RequiresStoresPanel() {
  return (
    <div
      className="rounded-md bg-surface-container-lowest p-10 text-center"
      aria-label="Store configuration required"
    >
      <Layers className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
      <p className="mt-3 text-base font-semibold text-on-surface">
        Brand Store + ≥2 cluster stores required
      </p>
      <p className="mt-2 text-sm text-on-surface-variant max-w-md mx-auto">
        A paired cross-cluster transfer requires at least one Brand-level store
        (the routing hub, per Master Spec §2.2) and at least two cluster-level
        stores (one as source, one as destination). Configure your store
        hierarchy in MDM before using this page.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PairedTransferPage() {
  // ── ALL hook calls ABOVE any early-return guards (Rules of Hooks) ──

  // Data hooks
  const { data: stores, isLoading: storesLoading, error: storesError } = useInventoryStores()
  const { data: uoms } = useInventoryUoms()
  const { list: productList, isLoading: productsLoading } = useInventoryProductNames()

  // Mutation hooks
  const createBundle = useCreateBundle()
  const approveBundle = useApproveBundle()

  // Form state
  const [sourceStoreId, setSourceStoreId] = useState<string | undefined>(undefined)
  const [destStoreId, setDestStoreId] = useState<string | undefined>(undefined)
  const [productId, setProductId] = useState<string | undefined>(undefined)
  const [qty, setQty] = useState<string>('')
  const [reason, setReason] = useState<ReasonValue | ''>('')
  const [uomOverride, setUomOverride] = useState<string | undefined>(undefined)

  // Post-submit state
  const [createdBundle, setCreatedBundle] = useState<{ bundleId: string; bundleRef: string } | null>(null)
  const [decomposedIds, setDecomposedIds] = useState<string[] | null>(null)
  const [bundleStatus, setBundleStatus] = useState<BundleStatus>('draft')

  // Derived store partitions
  const clusterStores = useMemo(
    () => (stores ?? []).filter((s) => s.level === 'cluster'),
    [stores],
  )
  const brandStores = useMemo(
    () => (stores ?? []).filter((s) => s.level === 'brand'),
    [stores],
  )

  const sourceStore = clusterStores.find((s) => s.id === sourceStoreId)
  const destStore = clusterStores.find((s) => s.id === destStoreId)
  const brandStore = brandStores[0]

  // Active uom — prefer override, else first available
  const uomId = uomOverride ?? uoms?.[0]?.id
  const activeUom = uoms?.find((u) => u.id === uomId) ?? uoms?.[0]

  // Cansubmit gate
  const canSubmit =
    Boolean(sourceStore?.clusterId) &&
    Boolean(destStore?.clusterId) &&
    Boolean(brandStore) &&
    Boolean(productId) &&
    Boolean(uomId) &&
    parseFloat(qty) > 0 &&
    reason !== '' &&
    sourceStoreId !== destStoreId

  // Build legs for PairedTransferBundle visualisation
  const activeProduct = productList.find((p) => p.id === productId)

  // Stable placeholder line item for the visualisation (single-item bundle)
  const singleLineItem: PairedTransferLineItem = useMemo(
    () => ({
      material_id: productId ?? 'pending',
      material_name: activeProduct?.name ?? '(product not selected)',
      qty: parseFloat(qty) > 0 ? parseFloat(qty) : 0,
      uom: activeUom?.code ?? '—',
      batch_ref: 'pending',
      expires_on: '—',
    }),
    [productId, activeProduct, qty, activeUom],
  )

  const legs: readonly [PairedTransferLeg, PairedTransferLeg] = useMemo(() => {
    const leg1: PairedTransferLeg = {
      label: 'Leg 1 · Source → Brand Store',
      source_label: sourceStore?.name ?? '(source not selected)',
      destination_label: brandStore?.name ?? 'Brand Store',
      line_items: [singleLineItem],
    }
    const leg2: PairedTransferLeg = {
      label: 'Leg 2 · Brand Store → Destination',
      source_label: brandStore?.name ?? 'Brand Store',
      destination_label: destStore?.name ?? '(destination not selected)',
      line_items: [singleLineItem],
    }
    return [leg1, leg2] as const
  }, [sourceStore, destStore, brandStore, singleLineItem])

  // ── Handlers ──

  async function handleSubmitBundle() {
    if (!sourceStore?.clusterId || !destStore?.clusterId || !brandStore || !productId || !uomId) return
    const locationCode =
      ((sourceStore.name ?? 'BND').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()) || 'BND'
    const input: CreateBundleInput = {
      originatingClusterId: sourceStore.clusterId,
      destinationClusterId: destStore.clusterId,
      locationCode,
      productId,
      qty: parseFloat(qty),
      uomId,
      fromStoreId: sourceStore.id,
      toStoreId: destStore.id,
      brandStoreId: brandStore.id,
      reasonCode: reason !== '' ? reason : undefined,
    }
    const created = await createBundle.mutateAsync(input)
    setCreatedBundle(created)
    setBundleStatus('pending_approval')
  }

  async function handleApproveBundle() {
    if (!createdBundle) return
    const result = await approveBundle.mutateAsync(createdBundle.bundleId)
    setDecomposedIds(result.transferIds)
    setBundleStatus('approved')
  }

  // ── Loading state ──
  if (storesLoading || productsLoading) {
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

  // ── Error state (stores fetch error) ──
  if (storesError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {storesError instanceof ApiError ? storesError.message : 'Failed to load store data. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Empty state — requires brand store + ≥2 cluster stores ──
  if (clusterStores.length < 2 || brandStores.length === 0) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <header className="mb-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Cross-cluster transfer
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Paired Brand-Store Cross-Cluster Transfer
            </h1>
          </header>
          <RequiresStoresPanel />
        </div>
      </div>
    )
  }

  // ── Main form surface ──
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
                {createdBundle ? (
                  <>
                    <span className="font-mono text-sm text-on-surface">
                      {createdBundle.bundleRef}
                    </span>
                    <DraftPill isDraft={bundleStatus === 'draft'} />
                    <AuditLink
                      entityType="transfer_bundles"
                      entityRef={createdBundle.bundleRef}
                    />
                  </>
                ) : (
                  <DraftPill isDraft={true} />
                )}
              </div>
            </div>

            {/* Header actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/inventory/suggestions"
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

              {!createdBundle ? (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 min-h-[44px]"
                  disabled={!canSubmit || createBundle.isPending}
                  onClick={() => { void handleSubmitBundle() }}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {createBundle.isPending ? 'Submitting…' : 'Submit bundle'}
                </Button>
              ) : !decomposedIds ? (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 min-h-[44px]"
                  disabled={approveBundle.isPending}
                  onClick={() => { void handleApproveBundle() }}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {approveBundle.isPending ? 'Approving…' : 'Approve bundle (decompose into 2 transfers)'}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <SectionShift tone="low" className="my-6" aria-hidden />

        {/* Mutation error surface */}
        {(createBundle.error || approveBundle.error) ? (
          <div role="alert" className="mb-6 rounded-md bg-error-container p-4 text-on-error-container">
            <p className="text-sm font-medium">
              {(() => {
                const err = createBundle.error ?? approveBundle.error
                return err instanceof ApiError
                  ? err.message
                  : (err?.message ?? 'An error occurred. Please retry.')
              })()}
            </p>
          </div>
        ) : null}

        {/* Post-approval decomposed transfer links */}
        {decomposedIds && decomposedIds.length > 0 ? (
          <div className="mb-6 rounded-md bg-surface-container-lowest p-4 tablet:p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Bundle approved — decomposed into 2 transfers
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {decomposedIds.map((tid, idx) => (
                <Link
                  key={tid}
                  to={`/inventory/transfers/${tid}`}
                  className={[
                    'inline-flex items-center gap-2 rounded-sm px-3 py-2',
                    'bg-surface-container-low text-sm font-medium text-on-surface min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  ].join(' ')}
                >
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant shrink-0">
                    Leg {idx + 1}
                  </span>
                  <span className="font-mono text-xs">{tid}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Cluster store pickers */}
        <section
          aria-label="Cluster store selection"
          className="grid grid-cols-1 tablet:grid-cols-2 gap-4"
        >
          <StorePicker
            id="source-store"
            label="Source cluster store"
            selectedId={sourceStoreId}
            onSelect={setSourceStoreId}
            options={clusterStores}
            excludeId={destStoreId}
          />
          <StorePicker
            id="destination-store"
            label="Destination cluster store"
            selectedId={destStoreId}
            onSelect={setDestStoreId}
            options={clusterStores}
            excludeId={sourceStoreId}
          />
        </section>

        {/* Brand Store intermediary info */}
        <div className="mt-4 rounded-sm bg-surface-container-low px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
            Routing hub (§2.2)
          </p>
          <p className="text-sm font-medium text-on-surface">
            {brandStore?.name ?? 'Brand Store'}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Master Spec §2.2: all cross-cluster raw-material transfers must route
            through the Brand Store (Leg 1: source → Brand Store; Leg 2: Brand
            Store → destination). This hop is never hidden — it is deliberately
            visible per P2B-004.
          </p>
        </div>

        {/* Single product + quantity + uom picker */}
        <section
          aria-label="Product and quantity"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Transfer item
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            One product per bundle (backend single-item constraint). Both legs
            carry the same product and quantity.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 items-end">
            {/* Product picker */}
            <div className="flex flex-col gap-1 min-w-[240px]">
              <label
                htmlFor="product-select"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Product
                <span aria-hidden className="ml-1 text-error">*</span>
                <span className="sr-only"> (required)</span>
              </label>
              <select
                id="product-select"
                value={productId ?? ''}
                onChange={(e) => setProductId(e.target.value || undefined)}
                className={[
                  'h-11 rounded-sm px-3 text-sm text-on-surface',
                  'bg-surface-container-low',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'min-w-[240px]',
                ].join(' ')}
              >
                <option value="">— Select product —</option>
                {productList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity field */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="qty-input"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Quantity
                <span aria-hidden className="ml-1 text-error">*</span>
                <span className="sr-only"> (required)</span>
              </label>
              <input
                id="qty-input"
                type="number"
                min={0}
                step={0.5}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className={[
                  'w-28 h-11 rounded-sm bg-surface-container-low text-on-surface',
                  'px-3 text-sm font-medium tabular-nums text-right',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              />
            </div>

            {/* UOM picker */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="uom-select"
                className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
              >
                Unit of measure
              </label>
              <select
                id="uom-select"
                value={uomOverride ?? uoms?.[0]?.id ?? ''}
                onChange={(e) => setUomOverride(e.target.value || undefined)}
                className={[
                  'h-11 rounded-sm px-3 text-sm text-on-surface',
                  'bg-surface-container-low',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'min-w-[140px]',
                ].join(' ')}
              >
                {(uoms ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

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
              Both legs visible per P2B-004
            </p>
          </header>
          <PairedTransferBundle
            bundleRef={createdBundle?.bundleRef ?? 'PENDING'}
            originatingCluster={sourceStore?.clusterId ?? sourceStore?.name ?? '(source cluster)'}
            destinationCluster={destStore?.clusterId ?? destStore?.name ?? '(destination cluster)'}
            legs={legs}
            consumptionContext={
              destStore
                ? `Destination store: ${destStore.name}. Confirm destination can absorb the transferred quantity before submitting.`
                : undefined
            }
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

        {/* Reason code */}
        <div className="mt-6">
          <ReasonPicker value={reason} onChange={setReason} />
        </div>

        {/* Footer action repeat */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/inventory/suggestions"
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

          {!createdBundle ? (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 min-h-[44px]"
              disabled={!canSubmit || createBundle.isPending}
              onClick={() => { void handleSubmitBundle() }}
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {createBundle.isPending ? 'Submitting…' : 'Submit bundle'}
            </Button>
          ) : !decomposedIds ? (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 min-h-[44px]"
              disabled={approveBundle.isPending}
              onClick={() => { void handleApproveBundle() }}
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {approveBundle.isPending ? 'Approving…' : 'Approve bundle (decompose into 2 transfers)'}
            </Button>
          ) : null}
        </div>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <FileText className="h-3 w-3" aria-hidden />
          <span>
            SI-INV-007 · Tier 1 Group 4 · Phase 4 Epic 4 Arc (c) · §2.2 raw-material
            routing · Single-item bundle (backend constraint) · Inline approve
            (no approval_request — direct decompose call)
          </span>
        </footer>

      </div>
    </div>
  )
}
