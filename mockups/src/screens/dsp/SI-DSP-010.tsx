import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Lock,
  MapPin,
  Receipt,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  GSTFieldValidation,
  Input,
  ProvisionalFlag,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
  UnregisteredCustomerWarn,
  useGSTValidation,
  useUnregisteredWarn,
  type GSTCustomerType,
} from '@/shell'

import {
  BRAND,
  b2bCustomers,
  formatINR,
  type B2BCustomer,
} from '@/lib/sample-data'

/**
 * SI-DSP-010 — B2B GST Closure (FR78 hero).
 *
 * Tier 1 Group 2 hybrid-widening, screen 1 of Phase 2c-S4. Anchors two new
 * cross-cutting patterns:
 *
 *   - CC-GST-FIELD-VALIDATION (FR118) — live intra-state vs inter-state
 *     CGST+SGST / IGST consistency check.
 *   - CC-UNREGISTERED-CUSTOMER-WARN (FR119) — warning + mandatory
 *     reason-code dropdown when customer is unregistered or consumer.
 *
 * Also exercises the existing CC-PROVISIONAL-FLAG inside the Stage 2
 * journal preview when the underlying challan carries provisional cost
 * lines (per FR67a).
 *
 * Atomic-save contract per `_planning/04-b2b-challan-spec.md` §3 + E-3:
 * `irn` and `gst_invoice_raised = true` MUST persist together — neither
 * without the other. The save button gates on:
 *
 *   1. CC-GST-FIELD-VALIDATION status === 'valid'
 *   2. IRN is exactly 64 chars
 *   3. gst_invoice_raised toggle is on
 *   4. Reason code picked, if customer is unregistered / consumer
 *
 * The disabled state is explained in a tooltip + an inline strip just
 * above the action row so reviewers understand why save is blocked.
 *
 * No animation per CLAUDE.md animation policy + DESIGN.md §10.3.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Static fixtures
// ─────────────────────────────────────────────────────────────────────────────

const STATE_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: '27', label: 'Maharashtra (27)' },
  { code: '29', label: 'Karnataka (29)' },
  { code: '07', label: 'Delhi (07)' },
  { code: '24', label: 'Gujarat (24)' },
  { code: '33', label: 'Tamil Nadu (33)' },
]

const STATE_LABEL_BY_CODE: Record<string, string> = {
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '07': 'Delhi',
  '24': 'Gujarat',
  '33': 'Tamil Nadu',
}

const TAX_RATE_OPTIONS: ReadonlyArray<number> = [0, 5, 12, 18, 28]

// 15-character GSTIN format per Indian GST law: 2 state + 10 PAN + 1 entity + Z + 1 check.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/

// One sample IRN per the spec (64 chars, A-Z + 0-9 hash from IRP portal).
const SAMPLE_IRN_64 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

const DC_TRN = 'DC-2026-WS-001142'
const DISPATCHED_AT = '2026-05-04T16:24:00+05:30'
const DISPATCH_LOCATION = 'Wild Sugar Central Kitchen — Bandra'
const BASE_VALUE = 428500 // pre-tax base from Delivered challan

// Three line items — at least one is provisional per fixture spec to
// exercise CC-PROVISIONAL-FLAG in the Stage 2 journal preview.
interface LineItem {
  readonly id: string
  readonly description: string
  readonly hsn: string
  readonly base_value: number
  readonly provisional: boolean
}

const LINE_ITEMS: ReadonlyArray<LineItem> = [
  {
    id: 'L1',
    description: 'Wild Sugar Brownie Box · 24 pcs',
    hsn: '1905',
    base_value: 168000,
    provisional: false,
  },
  {
    id: 'L2',
    description: 'Wild Sugar Macaron Tower · 60 pcs',
    hsn: '1704',
    base_value: 192500,
    provisional: true, // costed against a Pending-GR cocoa lot
  },
  {
    id: 'L3',
    description: 'Wild Sugar Signature Cake · large',
    hsn: '1905',
    base_value: 68000,
    provisional: false,
  },
]

const LINE_ITEMS_TOTAL = LINE_ITEMS.reduce((acc, l) => acc + l.base_value, 0)

// Default fixture customer per task — Taj Hotels (regular). Toggle in dev
// via the small fixture-toggle button to verify Unregistered + Consumer
// chrome (per SI-ACC-003 BALANCED_FIXTURE precedent).
type FixtureKey = 'regular' | 'unregistered' | 'consumer'

const FIXTURE_CUSTOMER: Record<FixtureKey, B2BCustomer> = {
  regular: b2bCustomers.find((c) => c.id === 'b2b-taj-banquets')!,
  unregistered: b2bCustomers.find((c) => c.id === 'b2b-event-mgr')!,
  consumer: b2bCustomers.find((c) => c.id === 'b2b-consumer-corp-gift')!,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderMetaProps {
  readonly label: string
  readonly value: React.ReactNode
  readonly icon?: React.ReactNode
}

function HeaderMeta({ label, value, icon }: HeaderMetaProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm text-on-surface truncate">{value}</span>
    </div>
  )
}

const GST_TYPE_LABEL: Record<GSTCustomerType, string> = {
  regular: 'Regular',
  composition: 'Composition',
  unregistered: 'Unregistered',
  consumer: 'Consumer (B2C)',
}

// Customer GST registration type chip — colour + icon + label so colour
// is never the only signal.
function GstTypeChip({ gstType }: { gstType: GSTCustomerType }) {
  const isWarn = gstType === 'unregistered' || gstType === 'consumer'
  return (
    <span
      role="status"
      aria-label={`Customer GST registration type — ${GST_TYPE_LABEL[gstType]}`}
      className={[
        'inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-[11px] font-medium uppercase tracking-wider',
        isWarn
          ? 'bg-warning text-on-warning'
          : 'bg-surface-container-high text-on-surface',
      ].join(' ')}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {GST_TYPE_LABEL[gstType]}
    </span>
  )
}

interface FixtureToggleProps {
  readonly value: FixtureKey
  readonly onChange: (next: FixtureKey) => void
}

function FixtureToggle({ value, onChange }: FixtureToggleProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Fixture · customer type
      </span>
      <Button
        variant={value === 'regular' ? 'tonal' : 'ghost'}
        size="sm"
        onClick={() => onChange('regular')}
        aria-pressed={value === 'regular'}
      >
        Regular
      </Button>
      <Button
        variant={value === 'unregistered' ? 'tonal' : 'ghost'}
        size="sm"
        onClick={() => onChange('unregistered')}
        aria-pressed={value === 'unregistered'}
      >
        Unregistered
      </Button>
      <Button
        variant={value === 'consumer' ? 'tonal' : 'ghost'}
        size="sm"
        onClick={() => onChange('consumer')}
        aria-pressed={value === 'consumer'}
      >
        Consumer
      </Button>
      <span className="ml-auto text-[11px] text-on-surface-variant">
        Visual permutation only — flips fixture customer to exercise CC-UNREGISTERED-CUSTOMER-WARN.
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiDsp010() {
  const [fixture, setFixture] = useState<FixtureKey>('regular')
  const customer = FIXTURE_CUSTOMER[fixture]

  // Form state
  const [buyerGstin, setBuyerGstin] = useState<string>(customer.gstin ?? '')
  const [placeOfSupply, setPlaceOfSupply] = useState<string | null>(null)
  const [taxRate, setTaxRate] = useState<number | null>(null)
  const [cgstAmount, setCgstAmount] = useState<number | null>(null)
  const [sgstAmount, setSgstAmount] = useState<number | null>(null)
  const [igstAmount, setIgstAmount] = useState<number | null>(null)
  const [hsnByLine, setHsnByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(LINE_ITEMS.map((l) => [l.id, l.hsn])),
  )
  const [irn, setIrn] = useState<string>('')
  const [gstInvoiceRaised, setGstInvoiceRaised] = useState<boolean>(false)
  const [reasonCode, setReasonCode] = useState<string | null>(null)

  // Reset GSTIN + reason code when fixture flips so each customer's chrome
  // renders fresh. Keep the IRN / amounts so reviewers can stress-test.
  const onFixtureChange = (next: FixtureKey) => {
    setFixture(next)
    const nextCustomer = FIXTURE_CUSTOMER[next]
    setBuyerGstin(nextCustomer.gstin ?? '')
    setReasonCode(null)
  }

  // Derived: GST validation
  const gstValidation = useGSTValidation({
    placeOfSupplyStateCode: placeOfSupply,
    dispatchingStateCode: BRAND.state_code,
    cgstAmount,
    sgstAmount,
    igstAmount,
  })

  // Derived: unregistered warning gating
  const unregWarn = useUnregisteredWarn(customer.gst_type, reasonCode)

  // Derived: GSTIN format check (only enforced when value is non-empty —
  // unregistered + consumer customers have no GSTIN so we skip the check
  // for them).
  const gstinFormatValid =
    buyerGstin === '' ||
    customer.gst_type === 'unregistered' ||
    customer.gst_type === 'consumer' ||
    GSTIN_REGEX.test(buyerGstin)

  // Derived: IRN length check (64 chars exact).
  const irnValid = irn.length === 64

  // Derived: aggregate save-gating
  const blockedReasons = useMemo<string[]>(() => {
    const reasons: string[] = []
    if (gstValidation.status !== 'valid') {
      reasons.push(
        gstValidation.blockedReason ?? 'GST tax-field combination invalid.',
      )
    }
    if (!irnValid) {
      reasons.push(`IRN must be exactly 64 characters (currently ${irn.length}).`)
    }
    if (!gstInvoiceRaised) {
      reasons.push('gst_invoice_raised toggle must be ON (atomic with IRN per E-3).')
    }
    if (unregWarn.gating) {
      reasons.push(
        unregWarn.blockedReason ??
          'Reason code required for unregistered customer.',
      )
    }
    if (!gstinFormatValid) {
      reasons.push('Buyer GSTIN format invalid (15 chars per Indian GST format).')
    }
    return reasons
  }, [gstValidation, irnValid, irn.length, gstInvoiceRaised, unregWarn, gstinFormatValid])

  const saveBlocked = blockedReasons.length > 0

  // Derived tax amount for the journal preview — sum of whatever amounts
  // are filled (intra-state CGST+SGST or inter-state IGST).
  const taxAmount =
    (cgstAmount ?? 0) + (sgstAmount ?? 0) + (igstAmount ?? 0)

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Fixture toggle — visual permutation control only */}
        <FixtureToggle value={fixture} onChange={onFixtureChange} />

        {/* Page header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Dispatch · B2B GST closure
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                  Close challan with GST invoice
                </h1>
                <StatusPill status="status_completed" label="Delivered" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <TrnDisplay trn={DC_TRN} />
                <AuditLink entityRef={DC_TRN} />
              </div>
              <p className="mt-3 text-sm text-on-surface-variant max-w-[68ch]">
                Paste the IRN from the IRP portal, fill the GST fields, and
                save atomically. IRN and{' '}
                <code className="font-mono text-xs">gst_invoice_raised</code>{' '}
                persist together (E-3); on save the challan moves to{' '}
                <span className="font-medium text-on-surface">
                  Closed — GST Invoiced
                </span>{' '}
                and Stage 2 journal entry fires.
              </p>
            </div>
          </div>

          {/* Header meta strip — challan summary */}
          <div className="grid grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-6 gap-4 rounded-md bg-surface-container-lowest p-4">
            <HeaderMeta
              label="Customer"
              icon={<User className="h-3 w-3" aria-hidden />}
              value={
                <span title={customer.name}>
                  {customer.name}
                </span>
              }
            />
            <HeaderMeta
              label="Customer code"
              icon={<Receipt className="h-3 w-3" aria-hidden />}
              value={
                <span className="font-mono text-xs">{customer.id}</span>
              }
            />
            <HeaderMeta
              label="GST type"
              icon={<ShieldCheck className="h-3 w-3" aria-hidden />}
              value={<GstTypeChip gstType={customer.gst_type} />}
            />
            <HeaderMeta
              label="Origin"
              icon={<MapPin className="h-3 w-3" aria-hidden />}
              value={DISPATCH_LOCATION}
            />
            <HeaderMeta
              label="Dispatched at"
              icon={<CalendarDays className="h-3 w-3" aria-hidden />}
              value={
                <span className="tabular-nums">
                  {DISPATCHED_AT.replace('T', ' · ').slice(0, 19)} IST
                </span>
              }
            />
            <HeaderMeta
              label="Base value"
              icon={<FileText className="h-3 w-3" aria-hidden />}
              value={
                <span className="font-semibold tabular-nums">
                  {formatINR(BASE_VALUE)}
                </span>
              }
            />
          </div>
        </header>

        {/* Unregistered / consumer warning panel */}
        {unregWarn.shown ? (
          <section
            aria-label="Unregistered customer warning"
            className="mt-6"
          >
            <UnregisteredCustomerWarn
              gstType={customer.gst_type}
              reasonCode={reasonCode}
              onReasonCodeChange={setReasonCode}
            />
          </section>
        ) : null}

        {/* Two-column layout: GST fields form (col 1-2) + side rail */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-3 gap-6">
          {/* GST fields form */}
          <section
            aria-label="GST fields"
            className="desktop:col-span-2 flex flex-col gap-4"
          >
            <div className="rounded-md bg-surface-container-lowest p-4 tablet:p-5 flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  GST fields
                </h2>
                <p className="text-[11px] text-on-surface-variant">
                  Editable until atomic save · E-2 locks GST after Closed
                </p>
              </div>

              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="buyer-gstin"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    Buyer GSTIN
                    {customer.gst_type === 'regular' ||
                    customer.gst_type === 'composition' ? (
                      <span aria-hidden className="ml-1 text-error">
                        *
                      </span>
                    ) : null}
                  </label>
                  <Input
                    id="buyer-gstin"
                    value={buyerGstin}
                    onChange={(ev) =>
                      setBuyerGstin(ev.target.value.toUpperCase())
                    }
                    placeholder="27AABCT1234N1Z9"
                    maxLength={15}
                    className="font-mono"
                    aria-required={
                      customer.gst_type === 'regular' ||
                      customer.gst_type === 'composition'
                    }
                    aria-invalid={!gstinFormatValid || undefined}
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    {customer.gstin
                      ? `Defaulted from customer master · ${customer.gstin}`
                      : 'No GSTIN on customer master · leave blank for unregistered / consumer'}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="place-of-supply"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    Place of supply
                    <span aria-hidden className="ml-1 text-error">
                      *
                    </span>
                  </label>
                  <select
                    id="place-of-supply"
                    aria-required="true"
                    value={placeOfSupply ?? ''}
                    onChange={(ev) =>
                      setPlaceOfSupply(ev.target.value || null)
                    }
                    className="h-11 rounded-sm bg-surface-container-highest text-on-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">Select state…</option>
                    {STATE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-on-surface-variant">
                    {placeOfSupply == null
                      ? 'Drives intra-state vs inter-state per E-4'
                      : placeOfSupply === BRAND.state_code
                        ? `Intra-state from ${BRAND.state} · CGST + SGST`
                        : `Inter-state from ${BRAND.state} to ${STATE_LABEL_BY_CODE[placeOfSupply] ?? '—'} · IGST`}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="tax-rate"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    Tax rate (%)
                  </label>
                  <select
                    id="tax-rate"
                    value={taxRate ?? ''}
                    onChange={(ev) =>
                      setTaxRate(ev.target.value === '' ? null : Number(ev.target.value))
                    }
                    className="h-11 rounded-sm bg-surface-container-highest text-on-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">Select rate…</option>
                    {TAX_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate} %
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-on-surface-variant">
                    Closed enum per GST law · {taxRate != null ? `${formatINR(Math.round((BASE_VALUE * taxRate) / 100))} on ${formatINR(BASE_VALUE)} base` : '—'}
                  </p>
                </div>

                <div className="hidden tablet:block" aria-hidden />

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="cgst-amount"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    CGST amount (₹)
                  </label>
                  <Input
                    id="cgst-amount"
                    type="number"
                    inputMode="decimal"
                    value={cgstAmount ?? ''}
                    onChange={(ev) =>
                      setCgstAmount(
                        ev.target.value === '' ? null : Number(ev.target.value),
                      )
                    }
                    placeholder="0"
                    className="tabular-nums"
                    disabled={
                      placeOfSupply != null &&
                      placeOfSupply !== BRAND.state_code
                    }
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    Intra-state only · disabled when place of supply ≠ {BRAND.state}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="sgst-amount"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    SGST amount (₹)
                  </label>
                  <Input
                    id="sgst-amount"
                    type="number"
                    inputMode="decimal"
                    value={sgstAmount ?? ''}
                    onChange={(ev) =>
                      setSgstAmount(
                        ev.target.value === '' ? null : Number(ev.target.value),
                      )
                    }
                    placeholder="0"
                    className="tabular-nums"
                    disabled={
                      placeOfSupply != null &&
                      placeOfSupply !== BRAND.state_code
                    }
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    Intra-state only · disabled when place of supply ≠ {BRAND.state}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 tablet:col-span-2">
                  <label
                    htmlFor="igst-amount"
                    className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    IGST amount (₹)
                  </label>
                  <Input
                    id="igst-amount"
                    type="number"
                    inputMode="decimal"
                    value={igstAmount ?? ''}
                    onChange={(ev) =>
                      setIgstAmount(
                        ev.target.value === '' ? null : Number(ev.target.value),
                      )
                    }
                    placeholder="0"
                    className="tabular-nums"
                    disabled={
                      placeOfSupply == null ||
                      placeOfSupply === BRAND.state_code
                    }
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    Inter-state only · disabled when place of supply = dispatch state
                  </p>
                </div>
              </div>

              {/* HSN per line */}
              <div className="mt-1 flex flex-col gap-2">
                <h3 className="text-sm font-medium text-on-surface">
                  HSN per line ({LINE_ITEMS.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line item</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">Base value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {LINE_ITEMS.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-on-surface">
                              {line.description}
                            </span>
                            {line.provisional ? (
                              <ProvisionalFlag size="sm" />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`HSN for ${line.description}`}
                            value={hsnByLine[line.id] ?? ''}
                            onChange={(ev) =>
                              setHsnByLine((prev) => ({
                                ...prev,
                                [line.id]: ev.target.value,
                              }))
                            }
                            className="h-9 max-w-[120px] font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-on-surface">
                          {formatINR(line.base_value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-[11px] text-on-surface-variant tabular-nums text-right">
                  Sum of line bases · {formatINR(LINE_ITEMS_TOTAL)}
                </p>
              </div>
            </div>

            {/* CC-GST-FIELD-VALIDATION panel */}
            <GSTFieldValidation
              placeOfSupplyStateCode={placeOfSupply}
              dispatchingStateCode={BRAND.state_code}
              cgstAmount={cgstAmount}
              sgstAmount={sgstAmount}
              igstAmount={igstAmount}
              dispatchingStateLabel={BRAND.state}
              placeOfSupplyStateLabel={
                placeOfSupply ? STATE_LABEL_BY_CODE[placeOfSupply] : undefined
              }
            />

            {/* IRN paste + atomic toggle */}
            <div className="rounded-md bg-surface-container-lowest p-4 tablet:p-5 flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  IRN + atomic save
                </h2>
                <p className="text-[11px] text-on-surface-variant">
                  Atomic per E-3 · IRN + flag persist together
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="irn-paste"
                  className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant inline-flex items-center gap-1.5"
                >
                  <ClipboardPaste className="h-3 w-3" aria-hidden />
                  IRN (Invoice Reference Number)
                  <span aria-hidden className="ml-1 text-error">
                    *
                  </span>
                </label>
                <Input
                  id="irn-paste"
                  value={irn}
                  onChange={(ev) => setIrn(ev.target.value)}
                  placeholder={SAMPLE_IRN_64}
                  maxLength={64}
                  className="font-mono text-xs"
                  aria-required="true"
                  aria-invalid={irn.length > 0 && !irnValid ? 'true' : undefined}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-on-surface-variant">
                    Paste IRN from IRP portal — receive from accountant
                  </p>
                  <p
                    className={[
                      'text-[11px] font-mono tabular-nums',
                      irnValid
                        ? 'text-success'
                        : irn.length > 0
                          ? 'text-error'
                          : 'text-on-surface-variant',
                    ].join(' ')}
                    aria-live="polite"
                  >
                    {irn.length} / 64 chars
                    {irnValid ? ' · valid' : irn.length > 0 ? ' · invalid' : ''}
                  </p>
                </div>
              </div>

              {/* gst_invoice_raised toggle */}
              <div className="flex flex-wrap items-start gap-3 rounded-sm bg-surface-container-low px-3 py-3">
                <input
                  id="gst-invoice-raised"
                  type="checkbox"
                  checked={gstInvoiceRaised}
                  onChange={(ev) => setGstInvoiceRaised(ev.target.checked)}
                  aria-describedby="gst-invoice-raised-hint"
                  className="mt-1 h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <label
                    htmlFor="gst-invoice-raised"
                    className="text-sm font-medium text-on-surface cursor-pointer"
                  >
                    gst_invoice_raised = true
                  </label>
                  <p
                    id="gst-invoice-raised-hint"
                    className="text-[11px] text-on-surface-variant"
                  >
                    Atomic with IRN — both persist together (E-3). Save
                    blocked when one is set without the other.
                  </p>
                </div>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider',
                    gstInvoiceRaised
                      ? 'bg-success text-on-success'
                      : 'bg-surface-container-high text-on-surface-variant',
                  ].join(' ')}
                >
                  {gstInvoiceRaised ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                  ) : null}
                  {gstInvoiceRaised ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          </section>

          {/* Side rail */}
          <aside className="flex flex-col gap-6">
            {/* Confirmation block */}
            <section
              aria-label="Atomic-save consequences"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
                <div className="flex flex-col gap-2 min-w-0">
                  <h2 className="text-base font-semibold text-on-surface">
                    On atomic save
                  </h2>
                  <ul className="flex flex-col gap-2 text-sm text-on-surface">
                    <li className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-pill bg-primary shrink-0" />
                      <span>
                        <code className="font-mono text-xs">
                          gst_invoice_raised = true
                        </code>
                        , IRN persisted
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-pill bg-primary shrink-0" />
                      <span>
                        Status moves to{' '}
                        <StatusPill
                          status="status_closed"
                          size="sm"
                          label="Closed — GST Invoiced"
                          className="ml-0.5"
                        />
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-pill bg-primary shrink-0" />
                      <span>
                        Stage 2 journal fires:{' '}
                        <span className="font-medium">
                          DR Accounts Receivable [tax amount only], CR GST
                          Liability
                        </span>{' '}
                        per FR89 / FR92
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-pill bg-primary shrink-0" />
                      <span>
                        Challan locked from further GST edits per E-2 ·
                        correction = credit note + fresh challan
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Stage 2 journal preview */}
            <section
              aria-label="Stage 2 journal preview"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  Stage 2 journal preview
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  FR89 · FR92
                </span>
              </header>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3 w-3" aria-hidden />
                  TRN
                </span>
                <TrnDisplay trn={DC_TRN} copyable={false} />
                <span className="text-[11px] text-on-surface-variant">
                  (Stage 2 reuses DC TRN per FR75)
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">DR</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-on-surface">
                          Accounts Receivable
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Tax amount only · base already booked at Stage 1
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-on-surface">
                      {formatINR(taxAmount)}
                    </TableCell>
                    <TableCell className="text-right text-on-surface-variant">
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-on-surface">GST Liability</span>
                        {LINE_ITEMS.some((l) => l.provisional) ? (
                          <ProvisionalFlag size="sm" />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-on-surface-variant">
                      —
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-on-surface">
                      {formatINR(taxAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {LINE_ITEMS.some((l) => l.provisional) ? (
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  Provisional flag carried from Pending-GR cocoa lot on line 2
                  · resolves on GR confirmation per FR67a.
                </p>
              ) : null}
            </section>
          </aside>
        </div>

        {/* Save-gating strip + actions */}
        <section
          aria-label="Save actions"
          className="mt-8 flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          {saveBlocked ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-sm bg-surface-container-low px-3 py-2"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Save blocked · {blockedReasons.length} reason
                {blockedReasons.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-on-surface">
                {blockedReasons.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 rounded-pill bg-error shrink-0"
                    />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="rounded-sm bg-surface-container-low px-3 py-2"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-success inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Ready to close · all gates passed
              </p>
              <p className="mt-0.5 text-sm text-on-surface">
                On Save & Close, IRN + flag persist together, status moves to
                Closed — GST Invoiced, journal fires for{' '}
                <span className="font-medium tabular-nums">
                  {formatINR(taxAmount)}
                </span>
                .
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to="/SI-DSP-007">
              <Button variant="ghost" size="default">
                Cancel
              </Button>
            </Link>
            <Button
              variant="default"
              size="default"
              disabled={saveBlocked}
              title={
                saveBlocked
                  ? `Save blocked: ${blockedReasons.join(' · ')}`
                  : 'Atomic save — IRN + gst_invoice_raised persist together'
              }
              className="gap-1.5"
              aria-disabled={saveBlocked}
            >
              <Truck className="h-4 w-4" aria-hidden />
              Save & Close (atomic)
            </Button>
          </div>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <FileText className="h-3 w-3" aria-hidden />
          <span>
            Atomic save per E-3 · status moves to Closed — GST Invoiced ·
            challan locks per E-2 · correction path = credit note + fresh
            challan.
          </span>
          <span className="ml-auto">
            SI-DSP-010 · Tier 1 Group 4 · Phase 2c-S4 · Source: FR78, FR89,
            FR92, FR97, FR118, FR119 · 04-b2b-challan-spec.md §3 / §6 / §7 /
            E-2 / E-3 / E-4 ·{' '}
            <Link to="/SI-DSP-007" className="text-primary hover:underline">
              → SI-DSP-007 challan detail
            </Link>{' '}
            ·{' '}
            <Link to="/SI-INF-005" className="text-primary hover:underline">
              → SI-INF-005 audit
            </Link>
          </span>
        </footer>
      </div>
    </div>
  )
}
