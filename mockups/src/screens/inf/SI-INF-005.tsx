import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  History,
  Minus,
  Plus,
  Search,
  ShieldOff,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  ExportTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type StatusToken,
} from '@/shell'

import {
  NOW,
  formatINR,
  purchaseOrders,
  goodsReceipts,
  recipes,
  vendors,
  materials,
  b2bCustomers,
} from '@/lib/sample-data'
import { personas } from '@/lib/personas'
import { tokens } from '@/tokens'

/**
 * SI-INF-005 — Audit Trail Viewer.
 *
 * Tier 1 Group 1, screen 2 of Phase 2c-S3. The destination screen for every
 * `CC-AUDIT-LINK` chip dropped on entity-detail surfaces across Epics 1–12.
 * Realises FR20 (append-only audit trail with before/after snapshots) and
 * FR24 (export audit-trail data).
 *
 * Anchors:
 *   - CC-AUDIT-LINK — new <AuditLink> chip (also rendered in the hint pane
 *     so the affordance is visible on the screen it points to).
 *   - CC-EXPORT-TRIGGER — top-right format-selector dropdown.
 *
 * Append-only contract: the underlying table is INSERT-only (DB blocks UPDATE
 * + DELETE per FR20). The UI reflects this — no mutation affordances exist;
 * even "delete-blocked" events are themselves audit-recorded entries.
 *
 * Animation: NO entrance animations on the table or filter strip per CLAUDE.md
 * policy. Tailwind hover transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AuditAction =
  | 'create'
  | 'update'
  | 'delete-blocked'
  | 'approve'
  | 'reject'
  | 'override'
  | 'reverse'
  | 'cancel'
  | 'prefill-applied'

type AuditEntityType =
  | 'po'
  | 'gr'
  | 'recipe'
  | 'vendor'
  | 'material'
  | 'b2b-customer'
  | 'closing-inventory'
  | 'journal'

interface AuditDiffField {
  readonly field: string
  readonly before: string | null
  readonly after: string | null
}

interface AuditEvent {
  readonly id: string
  /** ISO timestamp — full date-time, displayed in IST. */
  readonly at: string
  readonly actor_id: string
  readonly actor_name: string
  readonly actor_role: string
  readonly action: AuditAction
  readonly entity_type: AuditEntityType
  /** Display reference — e.g. PO-2026-…, GR-2026-…. */
  readonly entity_ref: string
  /** Drill-down route for the underlying current state. */
  readonly entity_route: string
  /** One-line plain-language change summary for the table row. */
  readonly summary: string
  /** Optional reason text (overrides + delete-blocked carry these). */
  readonly reason?: string
  /** IP address (operations-recorded, occasionally absent). */
  readonly ip_address?: string
  /** Originating screen ID — e.g. SI-PUR-003. */
  readonly originating_screen: string
  /** Field-by-field diff (zero-length for create / approve). */
  readonly diff: ReadonlyArray<AuditDiffField>
}

// ─────────────────────────────────────────────────────────────────────────────
// Action-type metadata
//
// Mapping rules (documented per Tier 1 acceptance schema bullet 1):
//   - override         → status_overridden (pip pattern; reason carried)
//   - cancel           → status_cancelled (strikethrough row)
//   - reverse          → status_returned (return / undo glyph)
//   - delete-blocked   → semantic `warning` chrome (DB blocked the delete;
//                        FR20 audit-only event, NOT a status_* token)
//   - approve          → status_completed (positive lifecycle event)
//   - reject           → status_rejected
//   - create           → status_draft (lifecycle entry point)
//   - update           → status_in_progress (entity actively edited)
//   - prefill-applied  → status_template_active (form value derived from a
//                        template / prior context, FR113)
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'Created',
  update: 'Updated',
  'delete-blocked': 'Delete blocked',
  approve: 'Approved',
  reject: 'Rejected',
  override: 'Override applied',
  reverse: 'Confirmation reversed',
  cancel: 'Cancelled',
  'prefill-applied': 'Prefill applied',
}

const ACTION_STATUS_TOKEN: Record<Exclude<AuditAction, 'delete-blocked'>, StatusToken> = {
  create: 'status_draft',
  update: 'status_in_progress',
  approve: 'status_completed',
  reject: 'status_rejected',
  override: 'status_overridden',
  reverse: 'status_returned',
  cancel: 'status_cancelled',
  'prefill-applied': 'status_template_active',
}

const ENTITY_TYPE_LABEL: Record<AuditEntityType, string> = {
  po: 'Purchase Order',
  gr: 'Goods Receipt',
  recipe: 'Recipe',
  vendor: 'Vendor',
  material: 'Material',
  'b2b-customer': 'B2B Customer',
  'closing-inventory': 'Closing Inventory',
  journal: 'Journal Voucher',
}

const ENTITY_ROUTE: Record<AuditEntityType, string> = {
  po: '/SI-PUR-003',
  gr: '/SI-PRO-009',
  recipe: '/SI-REC-003',
  vendor: '/SI-MDM-005',
  material: '/SI-MDM-003',
  'b2b-customer': '/SI-DSP-003',
  'closing-inventory': '/SI-INV-001',
  journal: '/SI-ACC-013',
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture aggregation — synthesise ~36 plausible audit events spanning 30 days.
// Deterministic; derived from sample-data.ts entries, no Math.random.
// ─────────────────────────────────────────────────────────────────────────────

/** Helper: produce an ISO timestamp `n` days before NOW with a fixed clock time. */
function eventTimestamp(daysAgo: number, hour: number, minute: number): string {
  const base = new Date(`${NOW}T00:00:00+05:30`)
  base.setDate(base.getDate() - daysAgo)
  base.setHours(hour, minute, 0, 0)
  return base.toISOString()
}

const owner = personas.find((p) => p.id === 'brand-owner')!
const cluster = personas.find((p) => p.id === 'cluster-mgr')!
const finance = personas.find((p) => p.id === 'finance-mgr')!
const procurement = personas.find((p) => p.id === 'procurement-mgr')!
const kitchen = personas.find((p) => p.id === 'kitchen-mgr')!
const store = personas.find((p) => p.id === 'store-mgr')!

/** Snapshot a few stable references from fixtures so events stay plausible. */
const samplePOs = purchaseOrders.slice(-12)
const sampleGRs = goodsReceipts.slice(-8)
const sampleRecipes = recipes.slice(0, 8)
const sampleVendors = vendors.slice(0, 6)
const sampleMaterials = materials.slice(0, 5)
const sampleB2B = b2bCustomers[0]!

const events: ReadonlyArray<AuditEvent> = [
  // ── Day -1: heavy procurement activity ──────────────────────────────────
  {
    id: 'evt-001',
    at: eventTimestamp(1, 9, 14),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'create',
    entity_type: 'po',
    entity_ref: samplePOs[0]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: `New PO drafted with ${samplePOs[0]!.lines.length} line items`,
    ip_address: '10.42.18.122',
    originating_screen: 'SI-PUR-002',
    diff: [
      { field: 'status', before: null, after: 'draft' },
      { field: 'vendor_id', before: null, after: samplePOs[0]!.vendor_id },
      { field: 'total_value', before: null, after: formatINR(samplePOs[0]!.total_value) },
      { field: 'expected_on', before: null, after: samplePOs[0]!.expected_on },
    ],
  },
  {
    id: 'evt-002',
    at: eventTimestamp(1, 10, 6),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'approve',
    entity_type: 'po',
    entity_ref: samplePOs[1]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: `PO approved at ${formatINR(samplePOs[1]!.total_value)}`,
    ip_address: '10.42.18.7',
    originating_screen: 'SI-INF-001',
    diff: [
      { field: 'status', before: 'pending_approval', after: 'confirmed' },
      { field: 'approved_by', before: null, after: cluster.name },
      { field: 'approved_at', before: null, after: eventTimestamp(1, 10, 6) },
    ],
  },
  {
    id: 'evt-003',
    at: eventTimestamp(1, 11, 38),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'override',
    entity_type: 'gr',
    entity_ref: sampleGRs[0]!.gr_number,
    entity_route: ENTITY_ROUTE.gr,
    summary: 'Pending GR override applied — production allowed against provisional cost',
    reason: 'Tandoor service must continue; PO arriving same evening per vendor SMS.',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'override_applied', before: 'false', after: 'true' },
      { field: 'cost_basis', before: 'pending', after: 'provisional' },
      { field: 'reason_code', before: null, after: 'service_continuity' },
    ],
  },
  {
    id: 'evt-004',
    at: eventTimestamp(1, 13, 22),
    actor_id: kitchen.id,
    actor_name: kitchen.name,
    actor_role: kitchen.role,
    action: 'override',
    entity_type: 'recipe',
    entity_ref: 'rec-mutton-galouti',
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Substitution override — Kashmir Saffron → blended saffron blend',
    reason: 'Primary stock zero across all locations; substitution approved for tonight’s service only.',
    ip_address: '10.44.2.91',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'ingredient.material_id', before: 'mat-saffron', after: 'mat-saffron-blend' },
      { field: 'ingredient.qty', before: '0.001 g', after: '0.0015 g' },
      { field: 'cost_per_yield', before: formatINR(185), after: formatINR(178) },
    ],
  },
  {
    id: 'evt-005',
    at: eventTimestamp(1, 15, 4),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'prefill-applied',
    entity_type: 'po',
    entity_ref: samplePOs[2]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'Prefill applied — last 30-day average qty + last vendor unit price',
    ip_address: '10.42.18.7',
    originating_screen: 'SI-PUR-002',
    diff: [
      { field: 'lines[0].qty', before: null, after: '12 kg' },
      { field: 'lines[0].unit_price', before: null, after: formatINR(320) },
      { field: 'prefill_source', before: null, after: 'PO history (FR113)' },
    ],
  },
  {
    id: 'evt-006',
    at: eventTimestamp(1, 16, 47),
    actor_id: finance.id,
    actor_name: finance.name,
    actor_role: finance.role,
    action: 'create',
    entity_type: 'journal',
    entity_ref: 'JV-2026-04-1142',
    entity_route: ENTITY_ROUTE.journal,
    summary: 'Manual JV — adjusting entry for April rent allocation',
    ip_address: '10.42.18.34',
    originating_screen: 'SI-ACC-013',
    diff: [
      { field: 'debit_account', before: null, after: '5210 · Rent Expense (Bandra)' },
      { field: 'credit_account', before: null, after: '2110 · Accrued Liabilities' },
      { field: 'amount', before: null, after: formatINR(48000) },
    ],
  },

  // ── Day -2: GR rejection thread + cancel ────────────────────────────────
  {
    id: 'evt-007',
    at: eventTimestamp(2, 8, 11),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'reject',
    entity_type: 'gr',
    entity_ref: sampleGRs[1]!.gr_number,
    entity_route: ENTITY_ROUTE.gr,
    summary: 'GR rejected — quantity mismatch on receipt',
    reason: 'Vendor delivered 18 kg vs PO 25 kg; rejected pending vendor CN.',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'status', before: 'pending', after: 'rejected' },
      { field: 'rejection_reason', before: null, after: 'quantity_mismatch' },
      { field: 'vendor_cn_ref', before: null, after: 'VCN-2026-WST-0231' },
    ],
  },
  {
    id: 'evt-008',
    at: eventTimestamp(2, 9, 33),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'cancel',
    entity_type: 'po',
    entity_ref: samplePOs[3]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'PO cancelled — vendor cannot fulfil within window',
    reason: 'Bharat Spice Traders unable to source Kashmir Saffron until June; PO closed without GR.',
    ip_address: '10.42.18.122',
    originating_screen: 'SI-PUR-003',
    diff: [
      { field: 'status', before: 'confirmed', after: 'cancelled' },
      { field: 'cancellation_reason', before: null, after: 'vendor_capacity' },
    ],
  },
  {
    id: 'evt-009',
    at: eventTimestamp(2, 10, 19),
    actor_id: owner.id,
    actor_name: owner.name,
    actor_role: owner.role,
    action: 'delete-blocked',
    entity_type: 'vendor',
    entity_ref: sampleVendors[2]!.id,
    entity_route: ENTITY_ROUTE.vendor,
    summary: 'Delete blocked — vendor referenced by 2 open POs',
    reason: 'FR20 append-only contract — vendor records can be deactivated, never deleted while referenced.',
    ip_address: '10.42.18.4',
    originating_screen: 'SI-MDM-005',
    diff: [
      { field: 'attempted_action', before: null, after: 'DELETE' },
      { field: 'block_reason', before: null, after: 'open_references' },
      { field: 'open_po_count', before: null, after: '2' },
    ],
  },
  {
    id: 'evt-010',
    at: eventTimestamp(2, 11, 56),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'reverse',
    entity_type: 'gr',
    entity_ref: sampleGRs[2]!.gr_number,
    entity_route: ENTITY_ROUTE.gr,
    summary: 'GR confirmation reversed — wrong batch confirmed in error',
    reason: 'Store-floor confusion between two pending GRs from same vendor; correct GR will be confirmed next.',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'status', before: 'confirmed', after: 'pending' },
      { field: 'reversal_reason', before: null, after: 'wrong_batch_match' },
    ],
  },
  {
    id: 'evt-011',
    at: eventTimestamp(2, 14, 8),
    actor_id: kitchen.id,
    actor_name: kitchen.name,
    actor_role: kitchen.role,
    action: 'update',
    entity_type: 'recipe',
    entity_ref: sampleRecipes[1]!.id,
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Recipe yield updated — paneer tikka 1 → 1.2 plates per batch',
    ip_address: '10.44.2.91',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'yield_qty', before: '1', after: '1.2' },
      { field: 'cost_per_yield_unit', before: formatINR(142), after: formatINR(118) },
      { field: 'version', before: 'v2.1', after: 'v2.2' },
    ],
  },

  // ── Day -3 to -5: closings + variance flags ─────────────────────────────
  {
    id: 'evt-012',
    at: eventTimestamp(3, 23, 14),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'create',
    entity_type: 'closing-inventory',
    entity_ref: 'CL-2026-05-03-WST',
    entity_route: ENTITY_ROUTE['closing-inventory'],
    summary: 'Daily closing recorded — Bandra store · 84 SKUs counted',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-INV-016',
    diff: [
      { field: 'status', before: null, after: 'draft' },
      { field: 'sku_count', before: null, after: '84' },
      { field: 'variance_pct', before: null, after: '1.4 %' },
    ],
  },
  {
    id: 'evt-013',
    at: eventTimestamp(3, 23, 28),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'override',
    entity_type: 'closing-inventory',
    entity_ref: 'CL-2026-05-03-PWI',
    entity_route: ENTITY_ROUTE['closing-inventory'],
    summary: 'Variance flag override — 4.2 % chicken variance acknowledged',
    reason: 'Bone-in batch substituted late afternoon; yield difference accepted by Cluster Manager via SMS.',
    ip_address: '10.44.3.18',
    originating_screen: 'SI-INV-016',
    diff: [
      { field: 'variance_pct', before: '4.2 %', after: '4.2 %' },
      { field: 'variance_status', before: 'flagged', after: 'acknowledged' },
      { field: 'acknowledged_by', before: null, after: cluster.name },
    ],
  },
  {
    id: 'evt-014',
    at: eventTimestamp(4, 10, 22),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'approve',
    entity_type: 'po',
    entity_ref: samplePOs[4]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: `PO approved at ${formatINR(samplePOs[4]!.total_value)}`,
    ip_address: '10.42.18.7',
    originating_screen: 'SI-INF-001',
    diff: [
      { field: 'status', before: 'pending_approval', after: 'confirmed' },
    ],
  },
  {
    id: 'evt-015',
    at: eventTimestamp(4, 12, 4),
    actor_id: finance.id,
    actor_name: finance.name,
    actor_role: finance.role,
    action: 'update',
    entity_type: 'b2b-customer',
    entity_ref: sampleB2B.id,
    entity_route: ENTITY_ROUTE['b2b-customer'],
    summary: 'B2B GST closure — month-end registration toggle for April',
    ip_address: '10.42.18.34',
    originating_screen: 'SI-DSP-003',
    diff: [
      { field: 'gst_period_status', before: 'open', after: 'closed' },
      { field: 'closing_period', before: null, after: '2026-04' },
      { field: 'gstr_filed', before: 'false', after: 'true' },
    ],
  },
  {
    id: 'evt-016',
    at: eventTimestamp(5, 8, 49),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'reject',
    entity_type: 'po',
    entity_ref: samplePOs[5]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'PO rejected at approval stage — vendor flagged for performance review',
    reason: 'Average shelf-life on last 4 batches below contract threshold (6 days vs 12).',
    originating_screen: 'SI-INF-001',
    diff: [
      { field: 'status', before: 'pending_approval', after: 'rejected' },
      { field: 'rejection_reason', before: null, after: 'vendor_performance' },
    ],
  },
  {
    id: 'evt-017',
    at: eventTimestamp(5, 11, 28),
    actor_id: kitchen.id,
    actor_name: kitchen.name,
    actor_role: kitchen.role,
    action: 'prefill-applied',
    entity_type: 'recipe',
    entity_ref: sampleRecipes[2]!.id,
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Prefill applied — ingredient costs from last published version',
    ip_address: '10.44.2.91',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'cost_per_yield_unit', before: null, after: formatINR(95) },
      { field: 'prefill_source', before: null, after: 'recipe v1.4 base (FR113)' },
    ],
  },

  // ── Day -6 to -10 ──────────────────────────────────────────────────────
  {
    id: 'evt-018',
    at: eventTimestamp(6, 9, 12),
    actor_id: owner.id,
    actor_name: owner.name,
    actor_role: owner.role,
    action: 'delete-blocked',
    entity_type: 'material',
    entity_ref: sampleMaterials[0]!.id,
    entity_route: ENTITY_ROUTE.material,
    summary: 'Delete blocked — material referenced by 12 published recipes',
    reason: 'FR20 append-only contract; deactivate the material instead.',
    ip_address: '10.42.18.4',
    originating_screen: 'SI-MDM-003',
    diff: [
      { field: 'attempted_action', before: null, after: 'DELETE' },
      { field: 'block_reason', before: null, after: 'recipe_references' },
      { field: 'recipe_reference_count', before: null, after: '12' },
    ],
  },
  {
    id: 'evt-019',
    at: eventTimestamp(6, 14, 3),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'override',
    entity_type: 'po',
    entity_ref: samplePOs[6]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'Pending GR override — provisional cost cleared after physical receipt',
    reason: 'GR matched within 2 % qty tolerance; override expires automatically once cleared.',
    ip_address: '10.42.18.7',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'is_provisional', before: 'true', after: 'false' },
      { field: 'cost_basis', before: 'provisional', after: 'final' },
    ],
  },
  {
    id: 'evt-020',
    at: eventTimestamp(7, 10, 35),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'create',
    entity_type: 'po',
    entity_ref: samplePOs[7]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: `New PO drafted — ${samplePOs[7]!.lines.length} line items`,
    ip_address: '10.42.18.122',
    originating_screen: 'SI-PUR-002',
    diff: [
      { field: 'status', before: null, after: 'draft' },
      { field: 'total_value', before: null, after: formatINR(samplePOs[7]!.total_value) },
    ],
  },
  {
    id: 'evt-021',
    at: eventTimestamp(7, 12, 19),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'update',
    entity_type: 'gr',
    entity_ref: sampleGRs[3]!.gr_number,
    entity_route: ENTITY_ROUTE.gr,
    summary: 'Wastage line corrected — 2.1 → 0.4 kg on prawns',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'lines[0].wastage_qty', before: '2.1 kg', after: '0.4 kg' },
      { field: 'lines[0].usable_qty', before: '12.9 kg', after: '14.6 kg' },
    ],
  },
  {
    id: 'evt-022',
    at: eventTimestamp(8, 9, 41),
    actor_id: kitchen.id,
    actor_name: kitchen.name,
    actor_role: kitchen.role,
    action: 'override',
    entity_type: 'recipe',
    entity_ref: sampleRecipes[3]!.id,
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Substitution override — chicken thigh → bone-in (FR61)',
    reason: 'Vendor short-shipped boneless thigh; bone-in approved for 1 service window.',
    ip_address: '10.44.2.91',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'ingredient.material_id', before: 'mat-chicken', after: 'mat-chicken-bone-in' },
      { field: 'expires_at', before: null, after: eventTimestamp(7, 22, 0) },
    ],
  },
  {
    id: 'evt-023',
    at: eventTimestamp(9, 11, 8),
    actor_id: finance.id,
    actor_name: finance.name,
    actor_role: finance.role,
    action: 'create',
    entity_type: 'journal',
    entity_ref: 'JV-2026-04-1108',
    entity_route: ENTITY_ROUTE.journal,
    summary: 'Manual JV — depreciation accrual for April',
    ip_address: '10.42.18.34',
    originating_screen: 'SI-ACC-013',
    diff: [
      { field: 'debit_account', before: null, after: '5410 · Depreciation Expense' },
      { field: 'credit_account', before: null, after: '1290 · Accumulated Depreciation' },
      { field: 'amount', before: null, after: formatINR(31200) },
    ],
  },
  {
    id: 'evt-024',
    at: eventTimestamp(10, 17, 22),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'reverse',
    entity_type: 'po',
    entity_ref: samplePOs[8]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'Approval reversed — pricing variance flagged post-approval',
    reason: 'Unit price 14 % above 30-day average; sent back for re-negotiation.',
    ip_address: '10.42.18.7',
    originating_screen: 'SI-INF-001',
    diff: [
      { field: 'status', before: 'confirmed', after: 'pending_approval' },
      { field: 'reversal_reason', before: null, after: 'pricing_variance' },
    ],
  },

  // ── Day -11 to -20 ─────────────────────────────────────────────────────
  {
    id: 'evt-025',
    at: eventTimestamp(12, 9, 4),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'update',
    entity_type: 'vendor',
    entity_ref: sampleVendors[1]!.id,
    entity_route: ENTITY_ROUTE.vendor,
    summary: 'Payment terms updated — net 30 → net 45 days',
    ip_address: '10.42.18.122',
    originating_screen: 'SI-MDM-005',
    diff: [
      { field: 'payment_terms_days', before: '30', after: '45' },
      { field: 'last_negotiated_at', before: '2025-11-04', after: '2026-04-24' },
    ],
  },
  {
    id: 'evt-026',
    at: eventTimestamp(13, 14, 47),
    actor_id: owner.id,
    actor_name: owner.name,
    actor_role: owner.role,
    action: 'approve',
    entity_type: 'recipe',
    entity_ref: sampleRecipes[4]!.id,
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Recipe v2.3 approved for publication',
    ip_address: '10.42.18.4',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'status', before: 'pending_approval', after: 'version_published' },
      { field: 'version', before: 'v2.2', after: 'v2.3' },
    ],
  },
  {
    id: 'evt-027',
    at: eventTimestamp(14, 8, 11),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'prefill-applied',
    entity_type: 'closing-inventory',
    entity_ref: 'CL-2026-04-22-WST',
    entity_route: ENTITY_ROUTE['closing-inventory'],
    summary: 'Prefill applied — par levels from previous closing',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-INV-016',
    diff: [
      { field: 'par_levels_seeded', before: null, after: '84 SKUs' },
      { field: 'prefill_source', before: null, after: 'CL-2026-04-21-WST (FR113)' },
    ],
  },
  {
    id: 'evt-028',
    at: eventTimestamp(15, 11, 32),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'cancel',
    entity_type: 'po',
    entity_ref: samplePOs[9]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'PO cancelled before approval',
    reason: 'Duplicate of PO-2026-AND-WST-0211; confirmed as data-entry error.',
    ip_address: '10.42.18.7',
    originating_screen: 'SI-PUR-003',
    diff: [
      { field: 'status', before: 'draft', after: 'cancelled' },
      { field: 'cancellation_reason', before: null, after: 'duplicate_entry' },
    ],
  },
  {
    id: 'evt-029',
    at: eventTimestamp(16, 16, 22),
    actor_id: finance.id,
    actor_name: finance.name,
    actor_role: finance.role,
    action: 'reverse',
    entity_type: 'journal',
    entity_ref: 'JV-2026-04-0987',
    entity_route: ENTITY_ROUTE.journal,
    summary: 'Journal reversed — wrong cost-centre on rent allocation',
    reason: 'Bandra rent posted to Andheri cost centre; reversal + corrective JV pair.',
    ip_address: '10.42.18.34',
    originating_screen: 'SI-ACC-013',
    diff: [
      { field: 'status', before: 'posted', after: 'reversed' },
      { field: 'reversal_pair_ref', before: null, after: 'JV-2026-04-0988' },
    ],
  },
  {
    id: 'evt-030',
    at: eventTimestamp(18, 9, 56),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'update',
    entity_type: 'material',
    entity_ref: sampleMaterials[1]!.id,
    entity_route: ENTITY_ROUTE.material,
    summary: 'HSN code corrected — 0910 → 0904 (turmeric)',
    ip_address: '10.42.18.122',
    originating_screen: 'SI-MDM-003',
    diff: [
      { field: 'hsn_code', before: '0910', after: '0904' },
      { field: 'lkp_per_uom', before: formatINR(320), after: formatINR(320) },
    ],
  },

  // ── Day -22 to -28 ─────────────────────────────────────────────────────
  {
    id: 'evt-031',
    at: eventTimestamp(22, 12, 38),
    actor_id: cluster.id,
    actor_name: cluster.name,
    actor_role: cluster.role,
    action: 'override',
    entity_type: 'gr',
    entity_ref: sampleGRs[4]!.gr_number,
    entity_route: ENTITY_ROUTE.gr,
    summary: 'GR override — accepted with quality remarks (no rejection)',
    reason: 'Visual quality 7/10 vs spec 8/10; vendor accepted minor price reduction.',
    ip_address: '10.42.18.7',
    originating_screen: 'SI-PRO-009',
    diff: [
      { field: 'override_applied', before: 'false', after: 'true' },
      { field: 'price_adjustment', before: null, after: '-3 %' },
    ],
  },
  {
    id: 'evt-032',
    at: eventTimestamp(24, 8, 14),
    actor_id: store.id,
    actor_name: store.name,
    actor_role: store.role,
    action: 'create',
    entity_type: 'closing-inventory',
    entity_ref: 'CL-2026-04-12-WST',
    entity_route: ENTITY_ROUTE['closing-inventory'],
    summary: 'Daily closing recorded — variance flag at 2.6 %',
    ip_address: '10.44.2.45',
    originating_screen: 'SI-INV-016',
    diff: [
      { field: 'status', before: null, after: 'draft' },
      { field: 'variance_pct', before: null, after: '2.6 %' },
    ],
  },
  {
    id: 'evt-033',
    at: eventTimestamp(25, 15, 49),
    actor_id: kitchen.id,
    actor_name: kitchen.name,
    actor_role: kitchen.role,
    action: 'update',
    entity_type: 'recipe',
    entity_ref: sampleRecipes[5]!.id,
    entity_route: ENTITY_ROUTE.recipe,
    summary: 'Cooking time updated — 18 → 22 min',
    ip_address: '10.44.2.91',
    originating_screen: 'SI-REC-003',
    diff: [
      { field: 'prep_time_min', before: '18', after: '22' },
    ],
  },
  {
    id: 'evt-034',
    at: eventTimestamp(26, 11, 2),
    actor_id: owner.id,
    actor_name: owner.name,
    actor_role: owner.role,
    action: 'approve',
    entity_type: 'po',
    entity_ref: samplePOs[10]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: `High-value PO approved — ${formatINR(samplePOs[10]!.total_value)}`,
    ip_address: '10.42.18.4',
    originating_screen: 'SI-INF-001',
    diff: [
      { field: 'status', before: 'pending_approval', after: 'confirmed' },
      { field: 'approver_role', before: null, after: 'Brand Owner' },
    ],
  },
  {
    id: 'evt-035',
    at: eventTimestamp(28, 9, 24),
    actor_id: procurement.id,
    actor_name: procurement.name,
    actor_role: procurement.role,
    action: 'cancel',
    entity_type: 'po',
    entity_ref: samplePOs[11]!.po_number,
    entity_route: ENTITY_ROUTE.po,
    summary: 'PO cancelled — vendor deactivated mid-cycle',
    reason: 'Bharat Spice Traders deactivated for performance; PO closed without GR.',
    ip_address: '10.42.18.122',
    originating_screen: 'SI-PUR-003',
    diff: [
      { field: 'status', before: 'confirmed', after: 'cancelled' },
      { field: 'cancellation_reason', before: null, after: 'vendor_deactivated' },
    ],
  },
  {
    id: 'evt-036',
    at: eventTimestamp(29, 14, 12),
    actor_id: finance.id,
    actor_name: finance.name,
    actor_role: finance.role,
    action: 'prefill-applied',
    entity_type: 'journal',
    entity_ref: 'JV-2026-04-0822',
    entity_route: ENTITY_ROUTE.journal,
    summary: 'Prefill applied — recurring entry template',
    ip_address: '10.42.18.34',
    originating_screen: 'SI-ACC-013',
    diff: [
      { field: 'lines[0].account', before: null, after: '5210 · Rent Expense (Andheri)' },
      { field: 'lines[1].account', before: null, after: '2110 · Accrued Liabilities' },
      { field: 'prefill_source', before: null, after: 'recurring_jv_template (FR113)' },
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Filter state machinery
// ─────────────────────────────────────────────────────────────────────────────

type DateRange = 'last7' | 'last30' | 'all'

const DATE_RANGE_LABEL: Record<DateRange, string> = {
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  all: 'All (this snapshot)',
}

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  last7: 7,
  last30: 30,
  all: Number.POSITIVE_INFINITY,
}

const ACTION_FILTER_OPTIONS: ReadonlyArray<{ value: AuditAction; label: string }> = [
  { value: 'create', label: ACTION_LABEL.create },
  { value: 'update', label: ACTION_LABEL.update },
  { value: 'approve', label: ACTION_LABEL.approve },
  { value: 'reject', label: ACTION_LABEL.reject },
  { value: 'override', label: ACTION_LABEL.override },
  { value: 'reverse', label: ACTION_LABEL.reverse },
  { value: 'cancel', label: ACTION_LABEL.cancel },
  { value: 'delete-blocked', label: ACTION_LABEL['delete-blocked'] },
  { value: 'prefill-applied', label: ACTION_LABEL['prefill-applied'] },
]

const ENTITY_FILTER_OPTIONS: ReadonlyArray<{ value: AuditEntityType; label: string }> = (
  Object.keys(ENTITY_TYPE_LABEL) as ReadonlyArray<AuditEntityType>
).map((v) => ({ value: v, label: ENTITY_TYPE_LABEL[v] }))

const ACTOR_FILTER_OPTIONS = [owner, cluster, finance, procurement, kitchen, store].map((p) => ({
  value: p.id,
  label: `${p.name} · ${p.role}`,
}))

interface FilterState {
  readonly entityTypes: ReadonlySet<AuditEntityType>
  readonly actions: ReadonlySet<AuditAction>
  readonly actorIds: ReadonlySet<string>
  readonly dateRange: DateRange
  readonly search: string
}

const INITIAL_FILTERS: FilterState = {
  entityTypes: new Set(),
  actions: new Set(),
  actorIds: new Set(),
  dateRange: 'last30',
  search: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${day} · ${time}`
}

function daysAgo(iso: string): number {
  const t = new Date(iso).getTime()
  const now = new Date(`${NOW}T23:59:59+05:30`).getTime()
  return Math.floor((now - t) / 86400000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: AuditAction }) {
  if (action === 'delete-blocked') {
    // §6.4 warning chrome — DB blocked the delete; not a status_* token (FR20).
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-pill bg-warning px-2 py-1 text-xs font-medium text-on-warning"
        role="status"
        aria-label="Delete blocked"
      >
        <ShieldOff className="h-3.5 w-3.5" aria-hidden />
        <span>Delete blocked</span>
      </span>
    )
  }
  return (
    <StatusPill
      status={ACTION_STATUS_TOKEN[action]}
      label={ACTION_LABEL[action]}
      size="sm"
    />
  )
}

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
          className="h-9 px-3 gap-1.5 rounded-pill"
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

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (v: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Window
          </span>
          <span className="text-xs font-medium text-on-surface">
            {DATE_RANGE_LABEL[value]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <ul className="flex flex-col">
          {(Object.keys(DATE_RANGE_LABEL) as ReadonlyArray<DateRange>).map((opt) => {
            const active = opt === value
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{DATE_RANGE_LABEL[opt]}</span>
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

interface CounterCellProps {
  readonly label: string
  readonly value: number
  readonly emphasis?: 'default' | 'warning'
}

function CounterCell({ label, value, emphasis = 'default' }: CounterCellProps) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <span
        className={[
          'text-2xl font-semibold tabular-nums',
          emphasis === 'warning' ? 'text-tertiary' : 'text-on-surface',
        ].join(' ')}
      >
        {value.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff rendering
// ─────────────────────────────────────────────────────────────────────────────

function DiffRow({ field }: { field: AuditDiffField }) {
  const isPureAdd = field.before === null && field.after !== null
  const isPureRemove = field.before !== null && field.after === null
  const isChange = !isPureAdd && !isPureRemove
  return (
    <li className="rounded-sm bg-surface-container-low px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {field.field}
      </p>
      <div className="mt-1 flex flex-col gap-1.5 text-sm">
        {field.before !== null ? (
          <div
            className="flex items-start gap-2 rounded-sm bg-error-container px-2 py-1 text-on-error-container"
            // §15 colour-not-only — icon + uppercase label always paired
          >
            <Minus className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              aria-label="Before value"
            >
              Before
            </span>
            <span
              className={[
                'flex-1 break-words font-mono text-xs',
                isChange ? 'line-through' : '',
              ].join(' ')}
            >
              {field.before}
            </span>
          </div>
        ) : null}
        {field.after !== null ? (
          <div
            className="flex items-start gap-2 rounded-sm px-2 py-1"
            // §6.4 success token (no Tailwind class for `on_success` — drive both inline)
            style={{ backgroundColor: tokens.success, color: tokens.on_success }}
          >
            <Plus className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              aria-label="After value"
            >
              After
            </span>
            <span className="flex-1 break-words font-mono text-xs">{field.after}</span>
          </div>
        ) : null}
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf005() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null)

  // Apply filters
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.entityTypes.size > 0 && !filters.entityTypes.has(e.entity_type)) return false
      if (filters.actions.size > 0 && !filters.actions.has(e.action)) return false
      if (filters.actorIds.size > 0 && !filters.actorIds.has(e.actor_id)) return false
      if (DATE_RANGE_DAYS[filters.dateRange] !== Number.POSITIVE_INFINITY) {
        if (daysAgo(e.at) > DATE_RANGE_DAYS[filters.dateRange]) return false
      }
      if (filters.search.trim().length > 0) {
        const q = filters.search.trim().toLowerCase()
        const hay =
          `${e.entity_ref} ${e.summary} ${e.actor_name} ${ENTITY_TYPE_LABEL[e.entity_type]}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [filters])

  // Counters reflect the filtered slice (FR20 + FR24 — counts must match the export)
  const counters = useMemo(() => {
    const total = filtered.length
    const overrideCount = filtered.filter((e) => e.action === 'override').length
    const reverseCancel = filtered.filter(
      (e) => e.action === 'reverse' || e.action === 'cancel',
    ).length
    const prefill = filtered.filter((e) => e.action === 'prefill-applied').length
    const deleteBlocked = filtered.filter((e) => e.action === 'delete-blocked').length
    return { total, overrideCount, reverseCancel, prefill, deleteBlocked }
  }, [filtered])

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [selectedId],
  )

  // Entity timeline — chronological list of all events for the SAME entity reference.
  const entityTimeline = useMemo(() => {
    if (!selected) return [] as ReadonlyArray<AuditEvent>
    return events
      .filter((e) => e.entity_ref === selected.entity_ref)
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [selected])

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const anyFilterActive =
    filters.entityTypes.size > 0 ||
    filters.actions.size > 0 ||
    filters.actorIds.size > 0 ||
    filters.search.trim().length > 0 ||
    filters.dateRange !== 'last30'

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Audit
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Audit trail viewer
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Append-only record of every operational change across the brand —
              create, approve, override, reverse, cancel, prefill applied, and
              attempted deletes that the database blocked. Drill into any row
              for a field-by-field diff and the entity timeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportTrigger entityLabel="audit slice" />
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR20 contract · UPDATE and DELETE blocked at the database layer · this
          view is read-only by design
        </p>

        {/* Counters strip — inline (not DashboardTiles) */}
        <section
          aria-label="Audit counters"
          className="mt-6 flex flex-wrap items-stretch overflow-hidden rounded-md bg-surface-container-low"
        >
          <CounterCell label="Total events" value={counters.total} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Overrides"
            value={counters.overrideCount}
            emphasis={counters.overrideCount > 0 ? 'warning' : 'default'}
          />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Reverse / cancel"
            value={counters.reverseCancel}
            emphasis={counters.reverseCancel > 0 ? 'warning' : 'default'}
          />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell label="Prefill applied" value={counters.prefill} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Delete blocked"
            value={counters.deleteBlocked}
            emphasis={counters.deleteBlocked > 0 ? 'warning' : 'default'}
          />
        </section>

        {/* Filter strip */}
        <section
          aria-label="Audit filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={filters.dateRange}
              onChange={(v) => updateFilter('dateRange', v)}
            />
            <FilterChipPicker
              title="Entity"
              options={ENTITY_FILTER_OPTIONS}
              selected={filters.entityTypes}
              onToggle={(v) =>
                updateFilter('entityTypes', toggleSet(filters.entityTypes, v))
              }
              onClear={() => updateFilter('entityTypes', new Set())}
            />
            <FilterChipPicker
              title="Action"
              options={ACTION_FILTER_OPTIONS}
              selected={filters.actions}
              onToggle={(v) => updateFilter('actions', toggleSet(filters.actions, v))}
              onClear={() => updateFilter('actions', new Set())}
            />
            <FilterChipPicker
              title="Actor"
              options={ACTOR_FILTER_OPTIONS}
              selected={filters.actorIds}
              onToggle={(v) => updateFilter('actorIds', toggleSet(filters.actorIds, v))}
              onClear={() => updateFilter('actorIds', new Set())}
            />

            <div className="ml-auto flex w-full items-center gap-2 tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search audit events by entity reference"
                  placeholder="Search PO-2026-…, GR-, recipe…"
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                />
              </div>
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 gap-1"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Two-pane: events list + selected detail */}
        <section className="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-12">
          {/* Events list */}
          <div className="desktop:col-span-7">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-on-surface">Events</h2>
              <span className="text-xs text-on-surface-variant tabular-nums">
                {filtered.length} of {events.length} in window
              </span>
            </header>
            {filtered.length === 0 ? (
              <div className="rounded-md bg-surface-container-low p-8 text-center">
                <p className="text-sm text-on-surface">
                  No audit events match the current filters.
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Reset filters or widen the time window.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Timestamp</TableHead>
                    <TableHead className="w-44">Actor</TableHead>
                    <TableHead className="w-44">Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const active = e.id === selectedId
                    return (
                      <TableRow
                        key={e.id}
                        data-state={active ? 'selected' : undefined}
                        onClick={() => setSelectedId(e.id)}
                        onKeyDown={(ke) => {
                          if (ke.key === 'Enter' || ke.key === ' ') {
                            ke.preventDefault()
                            setSelectedId(e.id)
                          }
                        }}
                        tabIndex={0}
                        aria-pressed={active}
                        role="button"
                        className={[
                          'cursor-pointer transition-colors',
                          'hover:bg-surface-container',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active ? 'bg-surface-container' : '',
                        ].join(' ')}
                      >
                        <TableCell className="align-top">
                          <div className="flex flex-col">
                            <span className="text-sm text-on-surface tabular-nums">
                              {formatTimestamp(e.at)}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {daysAgo(e.at) === 0 ? 'today' : `${daysAgo(e.at)}d ago`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col">
                            <span className="text-sm text-on-surface">{e.actor_name}</span>
                            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                              {e.actor_role}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <ActionBadge action={e.action} />
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                              {ENTITY_TYPE_LABEL[e.entity_type]}
                            </span>
                            <span className="font-mono text-xs text-on-surface">
                              {e.entity_ref}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-sm text-on-surface">{e.summary}</p>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Detail panel */}
          <aside
            className="desktop:col-span-5"
            aria-label="Selected event detail"
          >
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-on-surface">
                Event detail
              </h2>
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Clear event selection"
                >
                  <X className="h-3 w-3" aria-hidden />
                  Clear
                </button>
              ) : null}
            </header>

            {!selected ? (
              <div className="rounded-md bg-surface-container-lowest p-6">
                <div className="flex items-start gap-3">
                  <History className="mt-0.5 h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
                  <div>
                    <p className="text-sm text-on-surface">
                      Select an event from the list to inspect its before / after diff.
                    </p>
                    <p className="mt-2 text-xs text-on-surface-variant">
                      On every entity-detail screen across Epics 1–12 this affordance
                      drills users to this viewer pre-filtered to the current entity:
                    </p>
                    <div className="mt-3">
                      <AuditLink entityRef="PO-2026-AND-WST-0231" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Header card */}
                <div className="rounded-md bg-surface-container-lowest p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        {ENTITY_TYPE_LABEL[selected.entity_type]}
                      </p>
                      <p className="mt-1 font-mono text-sm text-on-surface">
                        {selected.entity_ref}
                      </p>
                    </div>
                    <ActionBadge action={selected.action} />
                  </div>
                  <p className="mt-3 text-sm text-on-surface">{selected.summary}</p>
                  {selected.reason ? (
                    <div className="mt-3 rounded-sm bg-surface-container-low px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Why is this happening?
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{selected.reason}</p>
                    </div>
                  ) : null}

                  <SectionShift tone="high" className="my-4" aria-hidden />

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Actor
                      </dt>
                      <dd className="mt-0.5 text-on-surface">{selected.actor_name}</dd>
                      <dd className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                        {selected.actor_role}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Timestamp
                      </dt>
                      <dd className="mt-0.5 text-on-surface tabular-nums">
                        {formatTimestamp(selected.at)} IST
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        IP address
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-on-surface">
                        {selected.ip_address ?? (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Originating screen
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-on-surface">
                        {selected.originating_screen}
                      </dd>
                    </div>
                  </dl>

                  <SectionShift tone="high" className="my-4" aria-hidden />

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={selected.entity_route}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] tablet:min-h-[36px]"
                    >
                      View {ENTITY_TYPE_LABEL[selected.entity_type]}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        // Filter the table to just this entity ref via search
                        updateFilter('search', selected.entity_ref)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] tablet:min-h-[36px]"
                    >
                      <History className="h-3.5 w-3.5" aria-hidden />
                      Filter to this entity
                    </button>
                  </div>
                </div>

                {/* Diff card */}
                <div className="rounded-md bg-surface-container-lowest p-5">
                  <h3 className="text-sm font-semibold text-on-surface">
                    Before / after diff
                  </h3>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {selected.diff.length === 0
                      ? 'No field-level diff captured for this action.'
                      : `${selected.diff.length} field${selected.diff.length === 1 ? '' : 's'} changed`}
                  </p>
                  {selected.diff.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {selected.diff.map((f) => (
                        <DiffRow key={f.field} field={f} />
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* Entity timeline (SI-INF-006 pattern preview) */}
                <div className="rounded-md bg-surface-container-lowest p-5">
                  <header className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Entity timeline
                    </h3>
                    <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                      SI-INF-006 pattern
                    </span>
                  </header>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    All audit events for {selected.entity_ref}, newest first.
                  </p>
                  <ol className="mt-3 flex flex-col gap-2">
                    {entityTimeline.map((te) => {
                      const active = te.id === selectedId
                      return (
                        <li key={te.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(te.id)}
                            className={[
                              'w-full text-left rounded-sm px-3 py-2 flex items-start gap-3 min-h-[44px]',
                              'hover:bg-surface-container-high transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              active ? 'bg-surface-container' : 'bg-surface-container-low',
                            ].join(' ')}
                          >
                            <div className="flex w-24 shrink-0 flex-col">
                              <span className="text-[11px] tabular-nums text-on-surface-variant">
                                {formatTimestamp(te.at)}
                              </span>
                            </div>
                            <ActionBadge action={te.action} />
                            <span className="flex-1 text-xs text-on-surface">
                              {te.summary}
                            </span>
                            <ArrowRight
                              className="mt-0.5 h-3 w-3 shrink-0 text-on-surface-variant"
                              aria-hidden
                            />
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </div>
            )}
          </aside>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          SI-INF-005 · Tier 1 Group 1 · Phase 2c-S3
        </footer>
      </div>
    </div>
  )
}
