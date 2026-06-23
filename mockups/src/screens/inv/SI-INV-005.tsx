import { useState } from 'react'
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
  StatusPill,
} from '@/shell'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { materials, departments, locations, clusters } from '@/lib/sample-data'

import {
  stockBatches,
  TRANSFER_REASON_OPTIONS,
  IMPLAUSIBILITY_REASON_OPTIONS,
} from '@/lib/inv-sample-data'

/**
 * SI-INV-005 — Stock Transfer Create.
 *
 * Tier 2, Epic 4 Arc (b) W2. Mobile-first multi-line form for creating an
 * internal stock transfer between departments. Implements FR28 (flow rules —
 * raw materials may only transfer within the same cluster; cross-cluster is
 * blocked), FR114/FR115 (implausibility warn-and-log per line when requested
 * qty > available), DL-043 (raw dept→dept within-cluster allowance).
 *
 * Cross-cutting patterns consumed:
 *   - CC-DRAFT-PILL — DraftPill isDraft mobileEyebrow (form in unsaved state).
 *   - CC-VOICE-INPUT — CCVoiceInput on every per-line requested-qty field.
 *   - CC-IMPLAUSIBILITY-WARN — CCImplausibilityWarn beneath any line where
 *     requested > available; per-line local override state.
 *   - CC-DUPLICATE-WARN — CCDuplicateWarn when a same-day duplicate condition
 *     is detected (demo: fixed duplicate fixture from `transfers`).
 *
 * Submit flow: form CTA routes to /SI-INF-001 (approval inbox) when aggregate
 * transfer value exceeds the brand approval threshold (demo: always triggers
 * when at least 2 lines are present). Single-line transfers go "Submitted"
 * directly (status_pending_approval badge shown inline).
 *
 * From-query: ?from=008 or ?from=009 injects a single-hop within-cluster
 * suggestion banner pre-filled from the transferSuggestions fixture.
 *
 * FR28 destination filter logic (DL-043):
 *   - Raw material: source dept is in cluster X → dest dept must be in cluster X
 *     (dept-to-dept within-cluster is allowed per DL-043; cross-cluster blocked).
 *   - Non-raw material: any enabled destination dept is allowed.
 *   - Destination = source department itself is always blocked.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory / transaction screens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TransferLine {
  id: string
  materialId: string
  batchId: string
  requestedQty: string
  reason: string
  /** Per-line implausibility override state */
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Approval threshold: aggregate transfer value > ₹5,000 triggers approval routing
const APPROVAL_VALUE_THRESHOLD = 5000

// Demo same-day duplicate candidates (from existing transfers fixture — same
// source dept, same-day requestedAt = st-001 which is a draft from today)
const DUPLICATE_MATCHES = [
  {
    id: 'st-001',
    name: 'ST-2026-00001 — Hot Kitchen → Bandra Linking Kitchen',
    subtitle: 'Draft · 5.0 kg Chicken · par_replenishment',
    status: 'active' as const,
  },
  {
    id: 'st-002',
    name: 'ST-2026-00002 — Cold Kitchen → Bandra Linking Kitchen',
    subtitle: 'Pending approval · 8.0 kg Paneer + 2.0 l Cream · urgent_restocking',
    status: 'active' as const,
  },
]

// Suggested voice values per material (deterministic — no Math.random)
const SIMULATED_HEARD_VALUES: Record<string, string> = {
  'mat-chicken': '5',
  'mat-mutton': '3',
  'mat-paneer': '4',
  'mat-cream': '2',
  'mat-basmati-rice': '8',
  'mat-onion': '6',
  'mat-ghee': '1',
  'mat-atta': '10',
  'mat-sugar': '5',
  'mat-coffee-bean': '2',
  'mat-turmeric': '0.5',
  'mat-garam-masala': '1',
  'mat-prawns': '2',
  'mat-milk': '5',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Return all departments belonging to the same cluster as a given department. */
function clusterDeptIds(deptId: string): ReadonlySet<string> {
  const loc = departments.find((d) => d.id === deptId)
  if (!loc) return new Set()
  const location = locations.find((l) => l.id === loc.location_id)
  if (!location) return new Set()
  const clusterLocs = locations.filter((l) => l.cluster_id === location.cluster_id)
  const clusterLocIds = new Set(clusterLocs.map((l) => l.id))
  return new Set(departments.filter((d) => clusterLocIds.has(d.location_id)).map((d) => d.id))
}

/** True if a material is "raw" category — used to enforce cross-cluster block. */
function isRawMaterial(materialId: string): boolean {
  const mat = materials.find((m) => m.id === materialId)
  if (!mat) return false
  // Raw materials have category "Protein", "Dairy", "Produce", "Dry Goods", "Spices", "Beverages"
  // (everything except finished/semi-finished). In our fixture, all materials are raw-input.
  // We treat materials with no 'semi' or 'finished' in category as raw.
  const lc = mat.category?.toLowerCase() ?? ''
  return !lc.includes('semi') && !lc.includes('finished') && !lc.includes('beverage packed')
}

/** Get the available quantity from the most-FEFO batch for a material at a source dept. */
function getAvailableQtyForBatch(batchId: string): number {
  return stockBatches.find((b) => b.id === batchId)?.quantityRemaining ?? 0
}

/** Build destination options for a given source department and material.
 *  Returns departments with an optional `blockedReason` string. */
function getDestinationOptions(
  sourceDeptId: string,
  materialId: string,
): ReadonlyArray<{ deptId: string; label: string; blockedReason: string | null }> {
  const raw = isRawMaterial(materialId)
  const sameClusters = clusterDeptIds(sourceDeptId)

  return departments
    .filter((d) => d.id !== sourceDeptId) // exclude source itself
    .map((d) => {
      const loc = locations.find((l) => l.id === d.location_id)
      const label = `${loc?.name ?? d.location_id} — ${d.name}`

      if (raw && !sameClusters.has(d.id)) {
        // FR28 / DL-043: raw material cross-cluster transfer blocked
        return { deptId: d.id, label, blockedReason: 'Raw material — cross-cluster not allowed' }
      }
      return { deptId: d.id, label, blockedReason: null }
    })
}

/** Compute aggregate transfer value for approval threshold check. */
function computeAggregateValue(lines: ReadonlyArray<TransferLine>): number {
  return lines.reduce((sum, line) => {
    const mat = materials.find((m) => m.id === line.materialId)
    const qty = parseFloat(line.requestedQty) || 0
    return sum + qty * (mat?.lkp_per_uom ?? 0)
  }, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Default line factory (deterministic ids)
// ─────────────────────────────────────────────────────────────────────────────

let lineIdCounter = 0
function nextLineId(): string {
  lineIdCounter += 1
  return `line-${lineIdCounter}`
}

function makeDefaultLine(): TransferLine {
  const firstBatch = stockBatches[0]
  return {
    id: nextLineId(),
    materialId: firstBatch.materialId,
    batchId: firstBatch.id,
    requestedQty: '',
    reason: '',
    implausibilitySelectedReason: null,
    implausibilityOverridden: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv005() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ?from=008 or ?from=009 injects a suggestion banner
  const fromSuggestion = searchParams.get('from')
  const showSuggestionBanner = fromSuggestion === '008' || fromSuggestion === '009'

  // Source / destination selector state — default to Hot Kitchen → Bandra Linking Kitchen
  const [sourceDeptId, setSourceDeptId] = useState<string>('dept-ck-hot')
  const [destDeptId, setDestDeptId] = useState<string>('dept-bl-kitchen')

  // Line items
  const [lines, setLines] = useState<TransferLine[]>(() => [makeDefaultLine()])

  // Draft pill state — always draft until submitted
  const [isDraft, setIsDraft] = useState(true)

  // Same-day duplicate detection (demo: always show on initial load)
  // showDuplicateWarn defaults to true; dismissed by "Proceed anyway"
  const [showDuplicateWarn] = useState(true)
  const [duplicateProceed, setDuplicateProceed] = useState(false)

  // Submission state for routing feedback
  const [submitted, setSubmitted] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────

  const sourceDept = departments.find((d) => d.id === sourceDeptId)
  const destDept = departments.find((d) => d.id === destDeptId)
  const sourceLocation = locations.find((l) => l.id === sourceDept?.location_id)
  const destLocation = locations.find((l) => l.id === destDept?.location_id)

  // Batches at the source department, keyed by materialId (FEFO order — earliest expiry first)
  const sourceBatches = [...stockBatches]
    .filter((b) => b.departmentId === sourceDeptId)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0
      if (!a.expiryDate) return 1
      if (!b.expiryDate) return -1
      return a.expiryDate.localeCompare(b.expiryDate)
    })

  // Materials available at source (one per materialId — pick first FEFO batch)
  const availableMaterials = sourceBatches.reduce<
    Array<{ materialId: string; batchId: string; quantityRemaining: number }>
  >((acc, b) => {
    if (!acc.find((x) => x.materialId === b.materialId)) {
      acc.push({
        materialId: b.materialId,
        batchId: b.id,
        quantityRemaining: b.quantityRemaining,
      })
    }
    return acc
  }, [])

  // Destination options (with FR28 block reasons) for the first material of the first line
  const destOptions = getDestinationOptions(
    sourceDeptId,
    lines[0]?.materialId ?? 'mat-chicken',
  )

  // Any implausibility line not yet overridden blocks submit (visually)
  const hasUnoverriddenImplausibility = lines.some((line) => {
    const avail = getAvailableQtyForBatch(line.batchId)
    const req = parseFloat(line.requestedQty) || 0
    return req > avail && !line.implausibilityOverridden
  })

  const aggregateValue = computeAggregateValue(lines)
  const needsApproval = aggregateValue > APPROVAL_VALUE_THRESHOLD || lines.length >= 2

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddLine() {
    setLines((prev) => [...prev, makeDefaultLine()])
  }

  function handleRemoveLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function handleLineChange<K extends keyof TransferLine>(
    id: string,
    field: K,
    value: TransferLine[K],
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const updated: TransferLine = { ...l, [field]: value }
        // Reset implausibility state when material or qty changes
        if (field === 'materialId') {
          // Also update batchId to FEFO first batch for this material at source
          const fefo = sourceBatches.find((b) => b.materialId === (value as string))
          return {
            ...updated,
            batchId: fefo?.id ?? '',
            implausibilitySelectedReason: null,
            implausibilityOverridden: false,
          }
        }
        if (field === 'requestedQty') {
          return {
            ...updated,
            implausibilitySelectedReason: null,
            implausibilityOverridden: false,
          }
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

  function handleSubmit() {
    setIsDraft(false)
    setSubmitted(true)
    if (needsApproval) {
      navigate('/SI-INF-001')
    }
  }

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
            {submitted && !needsApproval ? (
              <StatusPill status="status_pending_approval" label="Submitted for approval" size="sm" />
            ) : null}
          </div>
        </header>

        {/* ── Same-day duplicate warn ───────────────────────────────────── */}
        {showDuplicateWarn && !duplicateProceed && (
          <section aria-label="Possible duplicate transfers" className="mt-6">
            <CCDuplicateWarn
              matches={DUPLICATE_MATCHES}
              onEditExisting={(id) => navigate(`/SI-INV-006?id=${id}`)}
              onProceedAnyway={() => setDuplicateProceed(true)}
            />
          </section>
        )}

        {/* ── Within-cluster suggestion banner ─────────────────────────── */}
        {showSuggestionBanner && (
          <section
            aria-label="Expiry-based transfer suggestion"
            className="mt-6 rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
          >
            <div className="flex items-start gap-3">
              <Lightbulb
                aria-hidden
                className="h-5 w-5 shrink-0 text-tertiary mt-0.5"
              />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Single-hop suggestion — within cluster
                </span>
                <p className="text-sm text-on-surface">
                  {fromSuggestion === '008'
                    ? 'Prawns (sb-012) expire in 18 h — suggested move to Wild Sugar Linking Road Kitchen before close.'
                    : 'Chicken (sb-001) expiry approaching — single-hop to Wild Sugar Linking Road Kitchen recommended.'}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Pre-filled source batch below. Adjust quantity if needed.
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
              <label htmlFor="source-dept" className="text-xs font-medium text-on-surface-variant">
                Source department
              </label>
              <Select
                value={sourceDeptId}
                onValueChange={(v) => {
                  setSourceDeptId(v)
                  // Reset lines when source changes — batches will differ
                  setLines([makeDefaultLine()])
                }}
              >
                <SelectTrigger id="source-dept" aria-label="Source department">
                  <SelectValue placeholder="Select source…" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => {
                    const loc = locations.find((l) => l.id === d.location_id)
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        {loc?.name ?? d.location_id} — {d.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {sourceLocation ? (
                <p className="text-xs text-on-surface-variant">
                  {sourceLocation.name} · {clusters.find((c) => c.id === sourceLocation.cluster_id)?.name}
                </p>
              ) : null}
            </div>

            {/* Arrow */}
            <div className="hidden tablet:flex items-end justify-center pb-2">
              <ArrowRight aria-hidden className="h-5 w-5 text-on-surface-variant" />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dest-dept" className="text-xs font-medium text-on-surface-variant">
                Destination department
              </label>
              <Select value={destDeptId} onValueChange={setDestDeptId}>
                <SelectTrigger id="dest-dept" aria-label="Destination department">
                  <SelectValue placeholder="Select destination…" />
                </SelectTrigger>
                <SelectContent>
                  {destOptions.map((opt) => (
                    <SelectItem
                      key={opt.deptId}
                      value={opt.deptId}
                      disabled={opt.blockedReason !== null}
                      aria-disabled={opt.blockedReason !== null}
                    >
                      {opt.label}
                      {opt.blockedReason ? ` — ${opt.blockedReason}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {destLocation ? (
                <p className="text-xs text-on-surface-variant">
                  {destLocation.name} · {clusters.find((c) => c.id === destLocation.cluster_id)?.name}
                </p>
              ) : null}
            </div>
          </div>

          {/* FR28 info note */}
          <div className="flex items-start gap-2 bg-surface-container rounded-sm p-3">
            <Info aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
            <p className="text-xs text-on-surface-variant">
              <strong className="font-medium text-on-surface">FR28 flow rules:</strong>{' '}
              Raw materials may only transfer within the same cluster
              (DL-043 dept-to-dept within-cluster allowance). Cross-cluster destinations
              are shown as disabled with a reason.
            </p>
          </div>
        </section>

        {/* ── Line items ───────────────────────────────────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section aria-label="Transfer lines" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-on-surface">
              Items to transfer
            </h2>
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
                No stock batches found at the selected source department.
                Try a different source.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {lines.map((line, idx) => {
                const batch = stockBatches.find((b) => b.id === line.batchId)
                const availableQty = getAvailableQtyForBatch(line.batchId)
                const reqNum = parseFloat(line.requestedQty) || 0
                const isImplausible = reqNum > 0 && reqNum > availableQty
                const mat = materials.find((m) => m.id === line.materialId)
                const uom = batch?.uom ?? mat?.uom ?? 'kg'
                const simulatedHearVal = SIMULATED_HEARD_VALUES[line.materialId] ?? '2'

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

                    {/* Material selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-on-surface-variant">
                        Item
                      </label>
                      <Select
                        value={line.materialId}
                        onValueChange={(v) => handleLineChange(line.id, 'materialId', v)}
                      >
                        <SelectTrigger aria-label={`Line ${idx + 1} material`}>
                          <SelectValue placeholder="Select material…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMaterials.map(({ materialId, quantityRemaining }) => {
                            const m = materials.find((x) => x.id === materialId)
                            if (!m) return null
                            return (
                              <SelectItem key={materialId} value={materialId}>
                                {m.name} — {quantityRemaining} {m.uom} on hand
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Batch ref + available qty row */}
                    {batch ? (
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-on-surface-variant">Source batch</span>
                          <span className="text-sm font-medium text-on-surface">
                            {batch.batchNumber}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-on-surface-variant">Available</span>
                          <span className="text-sm font-medium text-on-surface">
                            {availableQty} {uom}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-on-surface-variant">Expiry band</span>
                          <span
                            className={[
                              'text-sm font-medium',
                              batch.expiryBand === '24h' ? 'text-error' : '',
                              batch.expiryBand === '48h' || batch.expiryBand === '72h' ? 'text-tertiary' : '',
                              batch.expiryBand === 'fresh' ? 'text-on-surface' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {batch.expiryBand === 'fresh' ? 'Fresh' : batch.expiryBand}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Requested qty — CCVoiceInput */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-on-surface-variant">
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
                        unit={uom}
                        placeholder={`e.g. 3`}
                        aria-label={`Requested quantity for line ${idx + 1} — ${mat?.name ?? 'item'}`}
                        simulatedHeardValue={simulatedHearVal}
                      />
                    </div>

                    {/* Transfer reason */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-on-surface-variant">
                        Reason <span aria-hidden className="text-error">*</span>
                      </label>
                      <Select
                        value={line.reason}
                        onValueChange={(v) => handleLineChange(line.id, 'reason', v)}
                      >
                        <SelectTrigger aria-label={`Transfer reason for line ${idx + 1}`}>
                          <SelectValue placeholder="Select reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFER_REASON_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Implausibility warn — only when requested > available */}
                    {isImplausible && (
                      <CCImplausibilityWarn
                        message={`Requested ${reqNum} ${uom} exceeds available ${availableQty} ${uom} in batch ${batch?.batchNumber ?? ''}. Confirm reason before overriding.`}
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
                    <div className="flex justify-end">
                      <Link
                        to={`/SI-INV-002?item=${line.materialId}`}
                        className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1"
                      >
                        View stock detail for {mat?.name ?? 'item'} →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Submit / approval threshold notice ───────────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section aria-label="Submit transfer" className="mt-6 flex flex-col gap-4">
          {needsApproval && lines.some((l) => parseFloat(l.requestedQty) > 0) ? (
            <div className="flex items-start gap-3 rounded-md bg-surface-container-low p-4">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-on-surface">
                  Approval required
                </span>
                <p className="text-xs text-on-surface-variant">
                  This transfer will be routed to the Unified Approval Inbox
                  (aggregate value exceeds threshold / multiple lines).
                  You&apos;ll be redirected to track approval progress.
                </p>
              </div>
            </div>
          ) : null}

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
              disabled={
                hasUnoverriddenImplausibility ||
                lines.some((l) => !l.reason) ||
                lines.some((l) => !l.requestedQty || parseFloat(l.requestedQty) <= 0) ||
                !destDeptId
              }
              onClick={handleSubmit}
              aria-label={
                needsApproval
                  ? 'Submit transfer for approval'
                  : 'Submit transfer'
              }
            >
              {needsApproval ? 'Submit for approval' : 'Submit transfer'}
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
            </Button>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-on-surface-variant">
            SI-INV-005 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (b)
          </p>
          <p className="text-xs text-on-surface-variant">
            FR28 · FR114 · FR115 · DL-043 · DL-047
          </p>
        </footer>
      </div>
    </div>
  )
}
