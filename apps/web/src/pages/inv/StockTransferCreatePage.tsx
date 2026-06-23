import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CirclePlus,
  Info,
  Lightbulb,
  Trash2,
} from 'lucide-react'

import {
  Button,
  CCDuplicateWarn,
  CCImplausibilityWarn,
  CCVoiceInput,
  DraftPill,
  SectionShift,
} from '@/components/shell'

import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useDepartmentStock } from '@/hooks/inv/useStock'
import {
  useCreateTransfer,
  useSubmitTransfer,
  useTransferList,
  type CreateTransferInput,
} from '@/hooks/inv/useStockTransfers'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-005 — Stock Transfer Create (production port of Arc-b mockup).
 *
 * Tier 2, Epic 4 Arc (c) Wave 2. Multi-line form for creating an internal
 * stock transfer between departments. Implements FR28 (enforced server-side;
 * invalid routes rejected with ClusterBoundaryError/FlowDirectionError/
 * EnablementViolationError), FR114/FR115 (CCImplausibilityWarn, client-advisory
 * warn-and-log per line when requested qty > available), DL-043.
 *
 * Divergences from mockup (Wave-2 spec):
 *  1. Available qty comes from useDepartmentStock(sourceDept).items — no batch
 *     or expiry data on this endpoint; batch-ref + expiry-band sub-row dropped.
 *  2. Destination select lists ALL depts except source — no client-side FR28
 *     cross-cluster disabling (frontend has no dept→cluster map). Backend
 *     enforces FR28; rejections surface inline in a role="alert" block.
 *  3. CCVoiceInput: simulatedHeardValue prop removed in the ported shell.
 *  4. CCImplausibilityWarn is client-advisory only; override reason is NOT
 *     sent to the server (create endpoint has no implausibility field).
 *  5. CCDuplicateWarn: matches from useTransferList — same sourceDepartmentId
 *     + createdAt date === today.
 *  6. Suggestion banner: query params source/dest/product/qty pre-fill form;
 *     generic "Pre-filled from a suggestion" copy.
 *
 * Submit flow: createDraft → submit. pending_approval → /approvals/inbox;
 * otherwise → /inventory/transfers/:id.
 *
 * Animation: NONE. CLAUDE.md bans entrance animations on inventory/transaction
 * screens. The sole animation is CCVoiceInput's internal pulse (reduced-motion-
 * guarded).
 *
 * Route: /inventory/transfers/new (RequireAuth only, DL-049).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants (copied from mockups/src/lib/inv-sample-data.ts — static)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFER_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'urgent_restocking', label: 'Urgent restocking' },
  { value: 'par_replenishment', label: 'PAR replenishment' },
  { value: 'expiry_redistribution', label: 'Expiry-based redistribution' },
  { value: 'event_prep', label: 'Event preparation' },
  { value: 'surplus_return', label: 'Surplus return' },
]

const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed', label: 'Recount confirmed — count is correct' },
  { value: 'recording_error', label: 'Recording error — correcting now' },
  { value: 'genuine_spoilage', label: 'Genuine spoilage event' },
  { value: 'transfer_missing', label: 'Transfer not yet recorded' },
  { value: 'other', label: 'Other (add note)' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TransferLineState {
  id: string
  productId: string
  requestedQty: string
  reason: string
  /** Per-line implausibility override state */
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let lineIdCounter = 0
function nextLineId(): string {
  lineIdCounter += 1
  return `line-${lineIdCounter}`
}

function makeDefaultLine(productId = ''): TransferLineState {
  return {
    id: nextLineId(),
    productId,
    requestedQty: '',
    reason: '',
    implausibilitySelectedReason: null,
    implausibilityOverridden: false,
  }
}

/** Format today's ISO date (YYYY-MM-DD) for duplicate detection. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function StockTransferCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Query-param pre-fill (from a suggestion banner) ───────────────────────
  const paramSource = searchParams.get('source') ?? undefined
  const paramDest = searchParams.get('dest') ?? undefined
  const paramProduct = searchParams.get('product') ?? undefined
  const paramQty = searchParams.get('qty') ?? undefined
  const showSuggestionBanner =
    Boolean(paramSource) || Boolean(paramDest) || Boolean(paramProduct)

  // ── ALL hooks ABOVE the early returns ─────────────────────────────────────

  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()
  const [sourceDeptId, setSourceDeptId] = useState<string | undefined>(paramSource)
  const [destDeptId, setDestDeptId] = useState<string | undefined>(paramDest)

  const effectiveSource = sourceDeptId ?? depts?.[0]?.id

  const {
    data: sourceStock,
    isLoading: stockLoading,
    error: stockError,
  } = useDepartmentStock(effectiveSource)

  const createTransfer = useCreateTransfer()
  const submitTransfer = useSubmitTransfer()
  const { data: recentTransfers } = useTransferList({})

  // Available materials at source dept (from real stock endpoint)
  const availableMaterials = useMemo(
    () =>
      (sourceStock?.items ?? []).map((it) => ({
        productId: it.productId,
        name: it.productName,
        available: it.quantity,
        unit: it.unit,
      })),
    [sourceStock?.items],
  )

  const availableOf = (productId: string): number =>
    availableMaterials.find((m) => m.productId === productId)?.available ?? 0

  const unitOf = (productId: string): string =>
    availableMaterials.find((m) => m.productId === productId)?.unit ?? ''

  // Line state — seed from query params if present
  const [lines, setLines] = useState<TransferLineState[]>(() => [
    makeDefaultLine(paramProduct ?? ''),
  ])

  // One-time prefill from query params — runs once on mount (empty deps []).
  // Waits until availableMaterials resolves so the product select has options;
  // if params are absent this effect is a no-op.
  useEffect(() => {
    if (paramSource) setSourceDeptId(paramSource)
    if (paramDest) setDestDeptId(paramDest)
    if (paramProduct) {
      setLines([
        {
          id: nextLineId(),
          productId: paramProduct,
          requestedQty: paramQty ?? '',
          reason: '',
          implausibilitySelectedReason: null,
          implausibilityOverridden: false,
        },
      ])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draft state — always draft until submitted
  const [isDraft, setIsDraft] = useState(true)
  const [duplicateProceed, setDuplicateProceed] = useState(false)

  // Inline submit error
  const submitError = createTransfer.error ?? submitTransfer.error

  // ── Derived values (still above early returns) ─────────────────────────────

  const isLoading = deptsLoading || stockLoading

  // Duplicate detection: same source dept + createdAt date === today
  const todayStr = todayIso()
  const duplicateMatches = useMemo(() => {
    if (!effectiveSource || !recentTransfers) return []
    return recentTransfers
      .filter(
        (t) =>
          t.sourceDepartmentId === effectiveSource &&
          (t.createdAt ?? '').slice(0, 10) === todayStr,
      )
      .map((t) => ({
        id: t.id,
        name: `${t.stTrn} — status: ${t.status}`,
        status: 'active' as const,
      }))
  }, [recentTransfers, effectiveSource, todayStr])

  // Any unoverridden implausibility blocks submit (non-destructive advisory gate)
  const hasUnoverriddenImplausibility = lines.some((line) => {
    const avail = availableOf(line.productId)
    const req = parseFloat(line.requestedQty) || 0
    return req > 0 && req > avail && !line.implausibilityOverridden
  })

  // Dest options = all depts except source (NO client-side FR28 filtering)
  const destOptions = useMemo(
    () => (depts ?? []).filter((d) => d.id !== effectiveSource),
    [depts, effectiveSource],
  )

  const sourceDept = depts?.find((d) => d.id === effectiveSource)

  // ── Loading state ──────────────────────────────────────────────────────────
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

  // ── Error state ────────────────────────────────────────────────────────────
  if (stockError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {stockError instanceof ApiError
                ? stockError.message
                : 'Failed to load stock data. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddLine() {
    setLines((prev) => [...prev, makeDefaultLine()])
  }

  function handleRemoveLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function handleLineChange<K extends keyof TransferLineState>(
    id: string,
    field: K,
    value: TransferLineState[K],
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const updated: TransferLineState = { ...l, [field]: value }
        // Reset implausibility when product or qty changes
        if (field === 'productId') {
          return { ...updated, implausibilitySelectedReason: null, implausibilityOverridden: false }
        }
        if (field === 'requestedQty') {
          return { ...updated, implausibilitySelectedReason: null, implausibilityOverridden: false }
        }
        return updated
      }),
    )
  }

  function handleOverride(id: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, implausibilityOverridden: true } : l)),
    )
  }

  function handleSelectImplausibilityReason(id: string, reason: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, implausibilitySelectedReason: reason } : l,
      ),
    )
  }

  async function handleSubmit() {
    if (!effectiveSource || !destDeptId) return
    const locationCode =
      (
        (sourceDept?.code ?? sourceDept?.name ?? 'INV')
          .replace(/[^A-Za-z0-9]/g, '')
          .slice(0, 20)
          .toUpperCase()
      ) || 'INV'

    const input: CreateTransferInput = {
      sourceDepartmentId: effectiveSource,
      destinationDepartmentId: destDeptId,
      locationCode,
      lines: lines
        .filter((l) => parseFloat(l.requestedQty) > 0)
        .map((l) => ({
          productId: l.productId,
          requestedQty: parseFloat(l.requestedQty),
          reasonCode: l.reason || undefined,
        })),
    }

    try {
      const created = await createTransfer.mutateAsync(input)
      const submitted = await submitTransfer.mutateAsync(created.transferId)
      setIsDraft(false)
      if (submitted.status === 'pending_approval') {
        // Routed to the Epic-3 approval engine — send the user to the existing inbox
        navigate('/approvals/inbox')
      } else {
        // Approved immediately — go to the new transfer's detail
        navigate(`/inventory/transfers/${created.transferId}`)
      }
    } catch {
      // createTransfer.error / submitTransfer.error rendered inline
      // FR28 backend rejections (ClusterBoundaryError, FlowDirectionError,
      // EnablementViolationError) surface here.
    }
  }

  // Submit gate: destination chosen + every line has product + positive qty + reason
  const submitGated =
    !destDeptId ||
    hasUnoverriddenImplausibility ||
    lines.some((l) => !l.productId) ||
    lines.some((l) => !l.reason) ||
    lines.some((l) => !l.requestedQty || parseFloat(l.requestedQty) <= 0)

  const isPending = createTransfer.isPending || submitTransfer.isPending

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Stock transfers
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              New Stock Transfer
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Request a stock movement between departments. Transfers requiring
              approval will route to the Unified Approval Inbox (FR28 / §2.2).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DraftPill isDraft={isDraft} mobileEyebrow />
          </div>
        </header>

        {/* ── Same-day duplicate warn ───────────────────────────────────── */}
        {duplicateMatches.length > 0 && !duplicateProceed && (
          <section aria-label="Possible duplicate transfers" className="mt-6">
            <CCDuplicateWarn
              matches={duplicateMatches}
              onEditExisting={(id) => navigate(`/inventory/transfers/${id}`)}
              onProceedAnyway={() => setDuplicateProceed(true)}
            />
          </section>
        )}

        {/* ── Within-cluster suggestion banner ─────────────────────────── */}
        {showSuggestionBanner && (
          <section
            aria-label="Transfer suggestion pre-fill"
            className="mt-6 rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
          >
            <div className="flex items-start gap-3">
              <Lightbulb
                aria-hidden
                className="h-5 w-5 shrink-0 text-tertiary mt-0.5"
              />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Pre-filled from a suggestion
                </span>
                <p className="text-sm text-on-surface">
                  Pre-filled from a suggestion — adjust quantities as needed.
                </p>
                <p className="text-xs text-on-surface-variant">
                  Review the source, destination, and quantity before submitting.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Source + destination selectors ───────────────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section
          aria-label="Transfer route"
          className="mt-6 rounded-md bg-surface-container-low p-4 tablet:p-5 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-on-surface">Transfer route</h2>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-[1fr_auto_1fr]">
            {/* Source */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="source-dept"
                className="text-xs font-medium text-on-surface-variant"
              >
                Source department
              </label>
              <select
                id="source-dept"
                aria-label="Source department"
                value={effectiveSource ?? ''}
                onChange={(e) => {
                  setSourceDeptId(e.target.value || undefined)
                  // Reset lines when source changes — available stock will differ
                  setLines([makeDefaultLine()])
                }}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'min-w-[200px]',
                ].join(' ')}
              >
                {(depts ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                {(!depts || depts.length === 0) ? (
                  <option value="">No departments available</option>
                ) : null}
              </select>
              {sourceDept ? (
                <p className="text-xs text-on-surface-variant">
                  {sourceDept.name}
                  {sourceDept.code ? ` · ${sourceDept.code}` : ''}
                </p>
              ) : null}
            </div>

            {/* Arrow */}
            <div className="hidden tablet:flex items-end justify-center pb-2">
              <ArrowRight aria-hidden className="h-5 w-5 text-on-surface-variant" />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="dest-dept"
                className="text-xs font-medium text-on-surface-variant"
              >
                Destination department
              </label>
              <select
                id="dest-dept"
                aria-label="Destination department"
                value={destDeptId ?? ''}
                onChange={(e) => setDestDeptId(e.target.value || undefined)}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'min-w-[200px]',
                ].join(' ')}
              >
                <option value="">Select destination…</option>
                {destOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* FR28 info note (honest — backend enforces) */}
          <div className="flex items-start gap-2 bg-surface-container rounded-sm p-3">
            <Info aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
            <p className="text-xs text-on-surface-variant">
              <strong className="font-medium text-on-surface">FR28 flow rules:</strong>{' '}
              Invalid routes are rejected on submit with the reason (DL-043
              dept-to-dept within-cluster allowance). The backend enforces
              cluster boundary and flow direction rules.
            </p>
          </div>
        </section>

        {/* ── Line items ───────────────────────────────────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section aria-label="Transfer lines" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-on-surface">Items to transfer</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddLine}
              className="h-11 tablet:h-9 gap-1.5"
              aria-label="Add another transfer line"
            >
              <CirclePlus className="h-4 w-4" aria-hidden />
              Add item
            </Button>
          </div>

          {availableMaterials.length === 0 ? (
            <div className="rounded-md bg-surface-container-low p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle aria-hidden className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                No stock found at the selected source department. Try a different
                source.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {lines.map((line, idx) => {
                const avail = availableOf(line.productId)
                const unit = unitOf(line.productId)
                const reqNum = parseFloat(line.requestedQty) || 0
                const isImplausible =
                  reqNum > 0 && line.productId !== '' && reqNum > avail

                return (
                  <div
                    key={line.id}
                    className="rounded-md bg-surface-container-low p-4 flex flex-col gap-4"
                  >
                    {/* Line header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Line {idx + 1}
                      </span>
                      {lines.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(line.id)}
                          className="h-9 w-9 p-0"
                          aria-label={`Remove line ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-on-surface-variant" aria-hidden />
                        </Button>
                      ) : null}
                    </div>

                    {/* Item selector */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`line-item-${line.id}`}
                        className="text-xs font-medium text-on-surface-variant"
                      >
                        Item
                      </label>
                      <select
                        id={`line-item-${line.id}`}
                        aria-label={`Line ${idx + 1} item`}
                        value={line.productId}
                        onChange={(e) =>
                          handleLineChange(line.id, 'productId', e.target.value)
                        }
                        className={[
                          'h-11 rounded-md px-3 text-sm text-on-surface',
                          'bg-surface-container-lowest',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        ].join(' ')}
                      >
                        <option value="">Select item…</option>
                        {availableMaterials.map((m) => (
                          <option key={m.productId} value={m.productId}>
                            {m.name} — {m.available} {m.unit} on hand
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Available qty display (no batch/expiry data on this endpoint) */}
                    {line.productId ? (
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-on-surface-variant">Available</span>
                          <span className="text-sm font-medium text-on-surface">
                            {avail} {unit}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Requested qty — CCVoiceInput (no simulatedHeardValue prop) */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`line-qty-${line.id}`}
                        className="text-xs font-medium text-on-surface-variant"
                      >
                        Requested qty
                        {isImplausible ? (
                          <span className="ml-1.5 text-warning font-medium">
                            (exceeds available)
                          </span>
                        ) : null}
                      </label>
                      <CCVoiceInput
                        value={line.requestedQty}
                        onChange={(v) => handleLineChange(line.id, 'requestedQty', v)}
                        unit={unit || undefined}
                        placeholder="e.g. 3"
                        aria-label={`Requested quantity for line ${idx + 1}`}
                      />
                    </div>

                    {/* Transfer reason */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`line-reason-${line.id}`}
                        className="text-xs font-medium text-on-surface-variant"
                      >
                        Reason <span aria-hidden className="text-error">*</span>
                      </label>
                      <select
                        id={`line-reason-${line.id}`}
                        aria-label={`Transfer reason for line ${idx + 1}`}
                        value={line.reason}
                        onChange={(e) => handleLineChange(line.id, 'reason', e.target.value)}
                        className={[
                          'h-11 rounded-md px-3 text-sm text-on-surface',
                          'bg-surface-container-lowest',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        ].join(' ')}
                      >
                        <option value="">Select reason…</option>
                        {TRANSFER_REASON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Implausibility warn — client-advisory (warn-and-log, not hard-block) */}
                    {isImplausible && (
                      <CCImplausibilityWarn
                        message={`Requested ${reqNum} ${unit} exceeds available ${avail} ${unit}. Confirm reason before overriding.`}
                        reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                        selectedReason={line.implausibilitySelectedReason}
                        onSelectReason={(r) =>
                          handleSelectImplausibilityReason(line.id, r)
                        }
                        onOverride={() => handleOverride(line.id)}
                        overridden={line.implausibilityOverridden}
                      />
                    )}

                    {/* View item detail link */}
                    {line.productId ? (
                      <div className="flex justify-end">
                        <Link
                          to={`/inventory/stock/detail?item=${line.productId}&dept=${effectiveSource ?? ''}`}
                          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1"
                        >
                          View stock detail for this item →
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Submit / backend error / approval notice ──────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section aria-label="Submit transfer" className="mt-6 flex flex-col gap-4">

          {/* Inline backend error (FR28 rejections surface here) */}
          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
            >
              <AlertCircle aria-hidden className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm">
                {submitError instanceof ApiError
                  ? submitError.message
                  : 'Submit failed — please check the route and try again.'}
              </p>
            </div>
          ) : null}

          {/* Unoverridden implausibility advisory */}
          {hasUnoverriddenImplausibility ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-md bg-surface-container p-4"
            >
              <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <p className="text-sm text-on-surface-variant">
                One or more lines have quantities that exceed available stock.
                Override each flagged line before submitting.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 tablet:h-9"
              onClick={() => navigate(-1)}
              aria-label="Cancel and go back"
            >
              Cancel
            </Button>
            <Button
              variant="tonal"
              size="sm"
              className="h-11 tablet:h-9"
              disabled={submitGated || isPending}
              onClick={() => { void handleSubmit() }}
              aria-label="Submit transfer"
            >
              {isPending ? 'Submitting…' : 'Submit transfer'}
              {!isPending && <ArrowRight className="h-4 w-4 ml-1" aria-hidden />}
            </Button>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-on-surface-variant">
            SI-INV-005 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (c)
          </p>
          <p className="text-xs text-on-surface-variant">
            FR28 · FR114 · FR115 · DL-043 · DL-047 · DL-049
          </p>
        </footer>
      </div>
    </div>
  )
}
