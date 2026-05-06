import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Filter,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import {
  Button,
  Card,
  DashboardTile,
  ExportTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
} from '@/shell'

import {
  formatINR,
  goodsReceipts,
  purchaseOrders,
} from '@/lib/sample-data'

/**
 * SI-ACC-013 — Integration Status Dashboard.
 *
 * Tier 1 Group 1, screen 6 of Phase 2c-S3. Anchors the integration-
 * monitoring dashboard chrome reused by SI-ACC-011 (Accountant Handoff
 * Exports) and SI-POS-003 (POS Sales Integration Status). The visual
 * idiom is "per-report-type status tile + pending-transactions table +
 * alerts pane".
 *
 * Source FR: FR98 — Integration Status Dashboard showing export status,
 * pending transactions, last export date per type. Cross-listed with
 * Epic 9 SI-POS-003 for POS import health (bidirectional cross-reference
 * per inventory line 5238–5241).
 *
 * NO CC-AUDIT-LINK — read-only operational monitoring surface, not a
 * per-record editable screen (inventory line 5240).
 *
 * Animation policy — NO entrance animations on this dashboard
 * (CLAUDE.md). Hover transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Report-type definitions — six per FR98 / inventory line 5213
// ─────────────────────────────────────────────────────────────────────────────

type ReportTypeKey =
  | 'transaction_journal'
  | 'purchase_register'
  | 'sales_register'
  | 'vendor_ap_aging'
  | 'customer_ar_aging'
  | 'food_cost_report'

type ExportFormatKey = 'csv' | 'excel' | 'pdf' | 'tally' | 'zoho'

const FORMAT_LABEL: Record<ExportFormatKey, string> = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
  tally: 'Tally',
  zoho: 'Zoho',
}

type Severity = 'success' | 'warning' | 'error'

interface ReportStatus {
  readonly key: ReportTypeKey
  readonly label: string
  readonly lastExportAt: string // human-readable IST string
  readonly lastExportFormats: ReadonlyArray<ExportFormatKey>
  readonly pendingCount: number
  readonly daysSinceLastExport: number
  readonly severity: Severity
  /** Optional inline note shown in the tile's secondary line. */
  readonly note?: string
}

const REPORT_STATUS: ReadonlyArray<ReportStatus> = [
  {
    key: 'transaction_journal',
    label: 'Transaction Journal',
    lastExportAt: '6 May 2026, 09:30',
    lastExportFormats: ['csv', 'tally'],
    pendingCount: 0,
    daysSinceLastExport: 0,
    severity: 'success',
  },
  {
    key: 'purchase_register',
    label: 'Purchase Register',
    lastExportAt: '5 May 2026, 18:00',
    lastExportFormats: ['excel', 'csv'],
    pendingCount: 12,
    daysSinceLastExport: 0.6,
    severity: 'success',
  },
  {
    key: 'sales_register',
    label: 'Sales Register',
    lastExportAt: '3 May 2026, 22:30',
    lastExportFormats: ['csv', 'tally'],
    pendingCount: 47,
    daysSinceLastExport: 2.4,
    severity: 'warning',
    note: 'Above pending threshold',
  },
  {
    key: 'vendor_ap_aging',
    label: 'Vendor AP Aging',
    lastExportAt: '28 Apr 2026, 18:00',
    lastExportFormats: ['excel', 'pdf'],
    pendingCount: 0,
    daysSinceLastExport: 7.5,
    severity: 'warning',
    note: 'Export overdue',
  },
  {
    key: 'customer_ar_aging',
    label: 'Customer AR Aging',
    lastExportAt: '5 May 2026, 17:00',
    lastExportFormats: ['excel'],
    pendingCount: 3,
    daysSinceLastExport: 1,
    severity: 'success',
  },
  {
    key: 'food_cost_report',
    label: 'Food Cost Report',
    lastExportAt: '1 May 2026, 10:00',
    lastExportFormats: ['pdf', 'tally'],
    pendingCount: 8,
    daysSinceLastExport: 5,
    severity: 'error',
    note: 'Last export failed',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Pending transactions — derived from PO + GR fixtures, supplemented by
// plausible B2B challan + manual JV TRNs invented inline (no fixture exists).
// ─────────────────────────────────────────────────────────────────────────────

type PendingTrnType =
  | 'Purchase Order'
  | 'Goods Receipt'
  | 'B2B Challan'
  | 'Manual Journal Voucher'

type ExportRollup =
  | { readonly kind: 'never' }
  | { readonly kind: 'partial'; readonly formats: ReadonlyArray<ExportFormatKey> }
  | { readonly kind: 'all' }

interface PendingTransaction {
  readonly trn: string
  readonly type: PendingTrnType
  readonly amount: number
  readonly confirmedDate: string // ISO yyyy-mm-dd
  readonly export: ExportRollup
  /** Which report-type tile this transaction rolls up to. Drives drill-filter. */
  readonly reportTypes: ReadonlyArray<ReportTypeKey>
}

const PENDING_TRANSACTIONS: ReadonlyArray<PendingTransaction> = (() => {
  const rows: PendingTransaction[] = []

  // 6 GR-derived rows — confirmed Goods Receipts, mostly never-exported.
  const grPool = goodsReceipts
    .filter((gr) => gr.status === 'confirmed')
    .slice(-6)
  grPool.forEach((gr, i) => {
    const po = purchaseOrders.find((p) => p.id === gr.po_id)
    const amount = po?.total_value ?? 184_000
    rows.push({
      trn: gr.trn,
      type: 'Goods Receipt',
      amount,
      confirmedDate: gr.received_on,
      export:
        i === 0
          ? { kind: 'partial', formats: ['csv'] }
          : i === 1
            ? { kind: 'partial', formats: ['excel'] }
            : { kind: 'never' },
      reportTypes: ['purchase_register', 'transaction_journal', 'food_cost_report'],
    })
  })

  // 5 PO-derived rows — confirmed POs awaiting first export.
  const poPool = purchaseOrders
    .filter((p) => p.status === 'confirmed')
    .slice(-5)
  poPool.forEach((po, i) => {
    rows.push({
      trn: po.trn,
      type: 'Purchase Order',
      amount: po.total_value,
      confirmedDate: po.raised_on,
      export:
        i === 0
          ? { kind: 'all' }
          : i === 2
            ? { kind: 'partial', formats: ['csv', 'tally'] }
            : { kind: 'never' },
      reportTypes: ['purchase_register', 'transaction_journal'],
    })
  })

  // 4 B2B challan rows — invented (no fixture).
  const b2bRows: ReadonlyArray<{
    trn: string
    amount: number
    date: string
    rollup: ExportRollup
  }> = [
    { trn: 'BTC-2026-MUM-118', amount: 184_500, date: '2026-05-05', rollup: { kind: 'never' } },
    { trn: 'BTC-2026-MUM-119', amount: 92_400, date: '2026-05-05', rollup: { kind: 'partial', formats: ['csv'] } },
    { trn: 'BTC-2026-BLR-042', amount: 248_000, date: '2026-05-04', rollup: { kind: 'never' } },
    { trn: 'BTC-2026-MUM-120', amount: 76_800, date: '2026-05-03', rollup: { kind: 'partial', formats: ['excel', 'tally'] } },
  ]
  b2bRows.forEach((b) => {
    rows.push({
      trn: b.trn,
      type: 'B2B Challan',
      amount: b.amount,
      confirmedDate: b.date,
      export: b.rollup,
      reportTypes: ['sales_register', 'transaction_journal'],
    })
  })

  // 3 manual JV rows — invented (no fixture).
  const jvRows: ReadonlyArray<{
    trn: string
    amount: number
    date: string
    rollup: ExportRollup
  }> = [
    { trn: 'JV-2026-MUM-014', amount: 62_000, date: '2026-05-04', rollup: { kind: 'never' } },
    { trn: 'JV-2026-MUM-015', amount: 148_500, date: '2026-05-02', rollup: { kind: 'partial', formats: ['csv'] } },
    { trn: 'JV-2026-MUM-016', amount: 41_200, date: '2026-04-30', rollup: { kind: 'never' } },
  ]
  jvRows.forEach((j) => {
    rows.push({
      trn: j.trn,
      type: 'Manual Journal Voucher',
      amount: j.amount,
      confirmedDate: j.date,
      export: j.rollup,
      reportTypes: ['transaction_journal'],
    })
  })

  // Sort newest-first by confirmedDate for table readability.
  rows.sort((a, b) => (a.confirmedDate < b.confirmedDate ? 1 : -1))
  return rows
})()

// ─────────────────────────────────────────────────────────────────────────────
// Integration alerts (FR98 — last 24h) + POS import retry queue
// ─────────────────────────────────────────────────────────────────────────────

type AlertSeverity = 'error' | 'warning'

interface IntegrationAlert {
  readonly id: string
  readonly severity: AlertSeverity
  readonly title: string
  readonly detail: string
  readonly when: string // human IST string
  readonly link: string
  readonly linkLabel: string
}

const INTEGRATION_ALERTS: ReadonlyArray<IntegrationAlert> = [
  {
    id: 'alrt-001',
    severity: 'error',
    title: 'Food Cost Report export failed',
    detail: 'Tally connector timed out at 09:42 IST while streaming the May Food Cost Report. Retry once Tally service is reachable.',
    when: '6 May 2026, 09:42',
    link: '/SI-ACC-011',
    linkLabel: 'Open Accountant Handoff',
  },
  {
    id: 'alrt-002',
    severity: 'warning',
    title: 'Sales Register export overdue',
    detail: 'Last successful export was 3 May 22:30 IST — 2.4 days ago. Threshold is 24 h.',
    when: '6 May 2026, 09:00',
    link: '/SI-ACC-011',
    linkLabel: 'Run new export',
  },
  {
    id: 'alrt-003',
    severity: 'warning',
    title: 'POS import retry needed — Bandra outlet',
    detail: 'POS day-part 21:00–22:00 on 5 May failed parsing (line 124 corrupt). Retry via SI-POS-003.',
    when: '5 May 2026, 22:08',
    link: '/SI-POS-003',
    linkLabel: 'Open POS Import Status',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// POS import health summary — cross-listed from Epic 9 SI-POS-003
// (inventory line 5215). Numbers per task brief.
// ─────────────────────────────────────────────────────────────────────────────

const POS_IMPORT_HEALTH = {
  lastImportAt: '6 May 2026, 04:00',
  pendingCount: 0,
  failedCount: 1,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function INRValue({ value }: { value: number }) {
  // §7.4 ₹ rule — symbol on_surface_variant, digits ambient.
  const formatted = formatINR(value)
  const isNeg = formatted.startsWith('-')
  const body = isNeg ? formatted.slice(1) : formatted
  const symbolPart = body.slice(0, 2)
  const digitsPart = body.slice(2)
  return (
    <>
      <span className="text-on-surface-variant">
        {isNeg ? '-' : ''}
        {symbolPart}
      </span>
      <span>{digitsPart}</span>
    </>
  )
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDaysAgo(days: number): string {
  if (days < 1) return `${days.toFixed(1)} days`
  if (days === Math.floor(days)) return `${days} day${days === 1 ? '' : 's'}`
  return `${days.toFixed(1)} days`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FormatChips({ formats }: { formats: ReadonlyArray<ExportFormatKey> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {formats.map((f) => (
        <span
          key={f}
          className="inline-flex items-center rounded-pill bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface"
        >
          {FORMAT_LABEL[f]}
        </span>
      ))}
    </span>
  )
}

function ReportTile({
  status,
  active,
  onSelect,
}: {
  status: ReportStatus
  active: boolean
  onSelect: () => void
}) {
  // Tile severity drives the §12.5 left pip; secondary line bundles all
  // four schema bullets (last export date · format chips · pending · days).
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${status.label}: ${status.pendingCount} pending, last export ${status.lastExportAt}, ${formatDaysAgo(status.daysSinceLastExport)} ago. Click to filter pending transactions.`}
      className={[
        'block w-full text-left rounded-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active ? 'ring-2 ring-primary' : '',
      ].join(' ')}
    >
      <DashboardTile
        label={status.label}
        value={
          <span className="inline-flex items-baseline gap-2">
            <span>{status.pendingCount}</span>
            <span className="text-base font-medium text-on-surface-variant">
              pending
            </span>
          </span>
        }
        secondary={
          <span className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2">
              <FormatChips formats={status.lastExportFormats} />
              <span className="text-on-surface-variant">·</span>
              <span className="tabular-nums">
                {formatDaysAgo(status.daysSinceLastExport)} ago
              </span>
            </span>
            <span className="text-on-surface-variant">
              Last: {status.lastExportAt}
              {status.note ? ` · ${status.note}` : ''}
            </span>
          </span>
        }
        severity={status.severity}
      />
    </button>
  )
}

function ExportStatusCell({ rollup }: { rollup: ExportRollup }) {
  if (rollup.kind === 'all') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-on-surface">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
        <span>All formats exported</span>
      </span>
    )
  }
  if (rollup.kind === 'never') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-on-surface">
        <XCircle className="h-3.5 w-3.5 text-error" aria-hidden />
        <span>Never exported</span>
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-on-surface">
      <AlertTriangle className="h-3.5 w-3.5 text-tertiary" aria-hidden />
      <span>Partially exported</span>
      <FormatChips formats={rollup.formats} />
    </span>
  )
}

function ReportFilterPicker({
  value,
  onChange,
}: {
  value: ReportTypeKey | 'all'
  onChange: (v: ReportTypeKey | 'all') => void
}) {
  const [open, setOpen] = useState(false)
  const activeLabel =
    value === 'all'
      ? 'All report types'
      : (REPORT_STATUS.find((r) => r.key === value)?.label ?? 'All report types')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <Filter className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Report
          </span>
          <span className="text-xs font-medium text-on-surface">{activeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Filter pending transactions
        </p>
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange('all')
                setOpen(false)
              }}
              className={[
                'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                'hover:bg-surface-container-high transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                value === 'all' ? 'bg-surface-container' : '',
              ].join(' ')}
            >
              <span className="text-sm text-on-surface">All report types</span>
              {value === 'all' ? (
                <span className="text-xs font-medium text-primary">Active</span>
              ) : null}
            </button>
          </li>
          {REPORT_STATUS.map((r) => {
            const active = r.key === value
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r.key)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{r.label}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
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

interface AlertRowProps {
  readonly alert: IntegrationAlert
}

function AlertRow({ alert }: AlertRowProps) {
  // §6.4 + §12.5 — severity-coded margin-accent on the leading edge.
  const accent = alert.severity === 'error' ? 'bg-error' : 'bg-tertiary'
  const Icon = alert.severity === 'error' ? XCircle : AlertTriangle
  const iconClass = alert.severity === 'error' ? 'text-error' : 'text-tertiary'
  return (
    <li className="flex items-stretch overflow-hidden rounded-md bg-surface-container-lowest">
      <span aria-hidden className={['w-1 shrink-0', accent].join(' ')} />
      <div className="flex flex-1 flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Icon className={['mt-0.5 h-4 w-4 shrink-0', iconClass].join(' ')} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-on-surface">{alert.title}</p>
            <p className="mt-1 max-w-2xl text-xs text-on-surface-variant">
              {alert.detail}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-on-surface-variant">
              {alert.when}
            </p>
          </div>
        </div>
        <Link
          to={alert.link}
          className="inline-flex h-9 items-center gap-1 rounded-sm px-3 text-xs font-medium text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {alert.linkLabel}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiAcc013() {
  const [reportFilter, setReportFilter] = useState<ReportTypeKey | 'all'>('all')

  const filteredPending = useMemo(() => {
    if (reportFilter === 'all') return PENDING_TRANSACTIONS
    return PENDING_TRANSACTIONS.filter((t) => t.reportTypes.includes(reportFilter))
  }, [reportFilter])

  const totalPending = PENDING_TRANSACTIONS.length

  const filterLabel =
    reportFilter === 'all'
      ? 'All report types'
      : (REPORT_STATUS.find((r) => r.key === reportFilter)?.label ?? 'All report types')

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Accounting &amp; Financial · Operational monitoring
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Integration Status
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Daily operational view of the accountant handoff pipeline —
              export status per report type, pending transactions awaiting
              the next run, POS import health, and any failures from the
              last 24 hours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="h-11 gap-2 px-4">
              <Link to="/SI-ACC-011" aria-label="Run new export — opens Accountant Handoff Exports">
                <Play className="h-4 w-4" aria-hidden />
                <span>Run new export</span>
              </Link>
            </Button>
            <ExportTrigger entityLabel="integration status" formats={['csv']} />
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span>Last refreshed: 6 May 2026, 09:42 IST</span>
          <span aria-hidden>·</span>
          <span>FR98 Integration Status Dashboard</span>
          <span aria-hidden>·</span>
          <span>Brand-wide</span>
        </div>

        {/* Per-report-type status tiles — six per inventory line 5213 */}
        <section
          aria-label="Per-report-type integration status"
          className="mt-8 rounded-md bg-surface-container-low p-5"
        >
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                Export status by report type
              </h2>
              <p className="text-xs text-on-surface-variant">
                Click a tile to filter the pending-transactions table to that
                report type.
              </p>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              FR98
            </span>
          </header>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            {REPORT_STATUS.map((r) => (
              <ReportTile
                key={r.key}
                status={r}
                active={reportFilter === r.key}
                onSelect={() =>
                  setReportFilter((current) => (current === r.key ? 'all' : r.key))
                }
              />
            ))}
          </div>
        </section>

        {/* Pending transactions table */}
        <section
          aria-label="Pending transactions"
          className="mt-6"
          id="pending-transactions"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Pending transactions
              </h2>
              <p className="text-xs text-on-surface-variant">
                Confirmed but not yet exported to all configured formats.{' '}
                {filteredPending.length} of {totalPending} shown · {filterLabel}
              </p>
            </div>
            <ReportFilterPicker value={reportFilter} onChange={setReportFilter} />
          </header>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  TRN
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Transaction type
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Amount ₹
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Confirmed
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Export status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="px-4 py-10 text-center">
                      <p className="text-sm text-on-surface-variant">
                        No pending transactions for {filterLabel.toLowerCase()}.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPending.map((t) => (
                  <TableRow key={t.trn}>
                    <TableCell>
                      <TrnDisplay trn={t.trn} />
                    </TableCell>
                    <TableCell className="text-sm text-on-surface">
                      {t.type}
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      <INRValue value={t.amount} />
                    </TableCell>
                    <TableCell className="text-xs text-on-surface-variant tabular-nums">
                      {formatDateShort(t.confirmedDate)}
                    </TableCell>
                    <TableCell>
                      <ExportStatusCell rollup={t.export} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* POS import health + Integration alerts — two-column on desktop */}
        <section
          aria-label="POS import health and integration alerts"
          className="mt-8 grid grid-cols-1 gap-6 desktop:grid-cols-12"
        >
          {/* POS import health summary — cross-listed from Epic 9 SI-POS-003
              per inventory line 5215. Bidirectional cross-reference. */}
          <Card className="desktop:col-span-5 p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  POS import health
                </p>
                <h2 className="mt-1 text-base font-semibold text-on-surface">
                  Inbound POS pipeline
                </h2>
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Cross-listed · SI-POS-003
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-stretch overflow-hidden bg-surface-container-low">
              <div className="flex flex-1 items-baseline gap-3 px-4 py-4">
                <span className="text-2xl font-semibold tabular-nums text-on-surface">
                  {POS_IMPORT_HEALTH.pendingCount}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Pending
                </span>
              </div>
              <SectionShift orientation="vertical" tone="high" />
              <div className="flex flex-1 items-baseline gap-3 px-4 py-4">
                <span
                  className={[
                    'text-2xl font-semibold tabular-nums',
                    POS_IMPORT_HEALTH.failedCount > 0 ? 'text-error' : 'text-on-surface',
                  ].join(' ')}
                >
                  {POS_IMPORT_HEALTH.failedCount}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Failed
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="text-xs text-on-surface-variant">
                Last import:{' '}
                <span className="text-on-surface tabular-nums">
                  {POS_IMPORT_HEALTH.lastImportAt} IST
                </span>
              </div>
              <Button asChild variant="tonal" size="sm" className="h-9 gap-2 px-3">
                <Link
                  to="/SI-POS-003"
                  aria-label="Retry POS import — opens POS Sales Integration Status"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  <span>Retry import</span>
                </Link>
              </Button>
            </div>
          </Card>

          {/* Integration alerts pane */}
          <Card className="desktop:col-span-7 p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Integration health alerts
                </p>
                <h2 className="mt-1 text-base font-semibold text-on-surface">
                  Last 24 hours
                </h2>
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                {INTEGRATION_ALERTS.length} active
              </span>
            </div>

            <div className="px-6 pb-6 pt-4">
              {INTEGRATION_ALERTS.length === 0 ? (
                <p className="rounded-md bg-surface-container-lowest px-4 py-6 text-center text-sm text-on-surface-variant">
                  No integration alerts in the last 24h.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {INTEGRATION_ALERTS.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          SI-ACC-013 · Tier 1 Group 1 · Phase 2c-S3 · Source: FR98 ·{' '}
          <Link to="/SI-ACC-011" className="text-primary hover:underline">
            Accountant Handoff Exports
          </Link>{' '}
          ·{' '}
          <Link to="/SI-POS-003" className="text-primary hover:underline">
            POS Import Status
          </Link>
        </footer>
      </div>
    </div>
  )
}
