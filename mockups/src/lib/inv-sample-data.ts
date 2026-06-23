/**
 * mockups/src/lib/inv-sample-data.ts
 *
 * Epic 4 Arc (a) inventory fixtures for mockup screens SI-INV-001 through
 * SI-INV-016. Field shapes mirror the real Arc (a) backend schema and service
 * layer — see Epic 4 Arc (a) design §3 for the authoritative field definitions.
 *
 * ALL dates derived from `NOW` via local helpers (deterministic; no RNG,
 * no `Date.now()`, no zero-arg `new Date()`).
 *
 * DO NOT modify `mockups/src/lib/sample-data.ts` — import from it.
 */

import {
  NOW,
  materials,
  departments,
  clusters,
  inventoryPositions,
  purchaseOrders,
  formatINR as _formatINR,
} from '@/lib/sample-data'
import type { Uom } from '@/lib/sample-data'

// Re-export formatINR so callers can grab it from a single inv-specific import
export { _formatINR as formatINR }
export type { Uom }

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (derived from NOW — no RNG)
// ─────────────────────────────────────────────────────────────────────────────

/** Return an ISO date string (YYYY-MM-DD) `n` days after NOW (negative = before). */
function daysFromNow(n: number): string {
  const base = new Date(`${NOW}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + n)
  return base.toISOString().slice(0, 10)
}

/** Return an ISO datetime string `h` hours after NOW. */
function hoursFromNow(h: number): string {
  const base = new Date(`${NOW}T06:00:00Z`) // anchor to 06:00 UTC
  base.setUTCHours(base.getUTCHours() + h)
  return base.toISOString()
}

// Convenient shorthands
const daysBefore = (n: number) => daysFromNow(-n)
const hoursAhead = (h: number) => hoursFromNow(h)

// ─────────────────────────────────────────────────────────────────────────────
// Location / department shortcuts (scoped to CK Bandra per SI-INV-001 scope)
// ─────────────────────────────────────────────────────────────────────────────

const CK_LOC_ID = 'loc-ck-bandra' // central kitchen — primary scope
const POS_LOC_ID = 'loc-bandra-linking' // POS outlet — closing POS fixture
const DISPATCH_LOC_ID = 'loc-dh-andheri' // dispatch hub — closing Dispatch fixture

// Clusters used for paired-bundle fixture (two distinct clusters)
// cl-bandra-west = source cluster (CK Bandra), cl-andheri-east = dest cluster
const CLUSTER_A_ID = clusters[0].id // 'cl-bandra-west'
const CLUSTER_B_ID = clusters[1].id // 'cl-andheri-east'

// Store ids for the bundle legs (using location ids as "store" references in the mockup)
const BUNDLE_FROM_STORE_ID = CK_LOC_ID // source: CK Bandra
const BUNDLE_BRAND_STORE_ID = 'loc-bandra-pali' // intermediate: brand store (Bandra Pali)
const BUNDLE_TO_STORE_ID = 'loc-andheri-phoenix' // dest: Andheri Phoenix (cl-andheri-east)

// CK Bandra departments
const ckDepts = departments.filter((d) => d.location_id === CK_LOC_ID)
const DEPT_HOT = ckDepts.find((d) => d.id === 'dept-ck-hot')!.id
const DEPT_COLD = ckDepts.find((d) => d.id === 'dept-ck-cold')!.id
const DEPT_BAKERY = ckDepts.find((d) => d.id === 'dept-ck-bakery')!.id
const DEPT_TANDOOR = ckDepts.find((d) => d.id === 'dept-ck-tandoor')!.id

// Destination POS departments for transfers
const DEST_DEPT_BL_KITCHEN = 'dept-bl-kitchen'
const DEST_DEPT_AP_KITCHEN = 'dept-ap-kitchen'

// Commonly used material ids
const MAT_CHICKEN = 'mat-chicken'
const MAT_PANEER = 'mat-paneer'
const MAT_BASMATI = 'mat-basmati-rice'
const MAT_ONION = 'mat-onion'
const MAT_CREAM = 'mat-cream'
const MAT_GHEE = 'mat-ghee'
const MAT_MUTTON = 'mat-mutton'
const MAT_TURMERIC = 'mat-turmeric'
const MAT_GARAM_MASALA = 'mat-garam-masala'
const MAT_ATTA = 'mat-atta'
const MAT_COFFEE = 'mat-coffee-bean'
const MAT_PRAWNS = 'mat-prawns'
const MAT_SUGAR = 'mat-sugar'
const MAT_MILK = 'mat-milk'

// ─────────────────────────────────────────────────────────────────────────────
// Option lists for pickers
// ─────────────────────────────────────────────────────────────────────────────

export const ADJUSTMENT_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'physical_recount', label: 'Physical recount' },
  { value: 'damage', label: 'Damage' },
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'theft', label: 'Theft' },
  { value: 'system_correction', label: 'System correction' },
  { value: 'wastage', label: 'Wastage' },
]

export const CLOSING_VARIANCE_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'portioning_variance', label: 'Portioning variance' },
  { value: 'evaporation', label: 'Evaporation / cooking loss' },
  { value: 'theft', label: 'Theft' },
  { value: 'data_entry_error', label: 'Data entry error' },
  { value: 'transfer_not_recorded', label: 'Transfer not recorded' },
]

export const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed', label: 'Recount confirmed — count is correct' },
  { value: 'recording_error', label: 'Recording error — correcting now' },
  { value: 'genuine_spoilage', label: 'Genuine spoilage event' },
  { value: 'transfer_missing', label: 'Transfer not yet recorded' },
  { value: 'other', label: 'Other (add note)' },
]

export const TRANSFER_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'urgent_restocking', label: 'Urgent restocking' },
  { value: 'par_replenishment', label: 'PAR replenishment' },
  { value: 'expiry_redistribution', label: 'Expiry-based redistribution' },
  { value: 'event_prep', label: 'Event preparation' },
  { value: 'surplus_return', label: 'Surplus return' },
]

// ─────────────────────────────────────────────────────────────────────────────
// StockBatch
// ─────────────────────────────────────────────────────────────────────────────

export type StockBatch = {
  readonly id: string
  readonly materialId: string
  readonly departmentId: string
  readonly batchNumber: string
  readonly quantityRemaining: number
  readonly expiryDate: string | null
  readonly receivedDate: string
  readonly yieldFactor: number
  readonly costPerUnit: number
  readonly uom: Uom
  readonly sourceType: 'goods_receipt' | 'transfer' | 'adjustment' | 'opening'
  readonly sourceRef: string | null
  readonly provisional: boolean
  readonly expiryBand: '24h' | '48h' | '72h' | 'fresh'
}

const EXPIRY_BAND_DAYS: Record<'24h' | '48h' | '72h' | 'fresh', number> = {
  '24h': 1,
  '48h': 2,
  '72h': 3,
  fresh: 6,
}

function expiryDateForBand(band: '24h' | '48h' | '72h' | 'fresh'): string {
  return daysFromNow(EXPIRY_BAND_DAYS[band])
}

const matOf = (id: string) => materials.find((m) => m.id === id)!

export const stockBatches: ReadonlyArray<StockBatch> = [
  // Batch 1 — Hot Kitchen, Chicken, 24h band, from GR
  {
    id: 'sb-001',
    materialId: MAT_CHICKEN,
    departmentId: DEPT_HOT,
    batchNumber: 'BCH-2026-0001',
    quantityRemaining: 12.5,
    expiryDate: expiryDateForBand('24h'),
    receivedDate: daysBefore(3),
    yieldFactor: 0.92,
    costPerUnit: matOf(MAT_CHICKEN).lkp_per_uom,
    uom: matOf(MAT_CHICKEN).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00042',
    provisional: false,
    expiryBand: '24h',
  },
  // Batch 2 — Hot Kitchen, Mutton, 48h band, from GR
  {
    id: 'sb-002',
    materialId: MAT_MUTTON,
    departmentId: DEPT_HOT,
    batchNumber: 'BCH-2026-0002',
    quantityRemaining: 8.0,
    expiryDate: expiryDateForBand('48h'),
    receivedDate: daysBefore(2),
    yieldFactor: 0.88,
    costPerUnit: matOf(MAT_MUTTON).lkp_per_uom,
    uom: matOf(MAT_MUTTON).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00043',
    provisional: false,
    expiryBand: '48h',
  },
  // Batch 3 — Cold Kitchen, Paneer, 72h band, from GR
  {
    id: 'sb-003',
    materialId: MAT_PANEER,
    departmentId: DEPT_COLD,
    batchNumber: 'BCH-2026-0003',
    quantityRemaining: 15.0,
    expiryDate: expiryDateForBand('72h'),
    receivedDate: daysBefore(1),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_PANEER).lkp_per_uom,
    uom: matOf(MAT_PANEER).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00044',
    provisional: true, // provisional flag demo
    expiryBand: '72h',
  },
  // Batch 4 — Cold Kitchen, Cream, fresh band, from GR
  {
    id: 'sb-004',
    materialId: MAT_CREAM,
    departmentId: DEPT_COLD,
    batchNumber: 'BCH-2026-0004',
    quantityRemaining: 6.0,
    expiryDate: expiryDateForBand('fresh'),
    receivedDate: daysBefore(0),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_CREAM).lkp_per_uom,
    uom: matOf(MAT_CREAM).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00045',
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 5 — Bakery, Atta, fresh band, from opening
  {
    id: 'sb-005',
    materialId: MAT_ATTA,
    departmentId: DEPT_BAKERY,
    batchNumber: 'BCH-2026-0005',
    quantityRemaining: 50.0,
    expiryDate: daysFromNow(30),
    receivedDate: daysBefore(5),
    yieldFactor: 0.98,
    costPerUnit: matOf(MAT_ATTA).lkp_per_uom,
    uom: matOf(MAT_ATTA).uom,
    sourceType: 'opening',
    sourceRef: null,
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 6 — Tandoor, Ghee, fresh, from transfer
  {
    id: 'sb-006',
    materialId: MAT_GHEE,
    departmentId: DEPT_TANDOOR,
    batchNumber: 'BCH-2026-0006',
    quantityRemaining: 4.0,
    expiryDate: daysFromNow(60),
    receivedDate: daysBefore(2),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_GHEE).lkp_per_uom,
    uom: matOf(MAT_GHEE).uom,
    sourceType: 'transfer',
    sourceRef: 'ST-2026-00005', // points to st-005 (status: received) — consistent with past receivedDate; st-008 remains in_transit
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 7 — Hot Kitchen, Basmati Rice, 72h band, provisional
  {
    id: 'sb-007',
    materialId: MAT_BASMATI,
    departmentId: DEPT_HOT,
    batchNumber: 'BCH-2026-0007',
    quantityRemaining: 22.0,
    expiryDate: expiryDateForBand('72h'),
    receivedDate: daysBefore(1),
    yieldFactor: 0.95,
    costPerUnit: matOf(MAT_BASMATI).lkp_per_uom,
    uom: matOf(MAT_BASMATI).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00046',
    provisional: true, // second provisional demo
    expiryBand: '72h',
  },
  // Batch 8 — Cold Kitchen, Milk, 24h band, from GR
  {
    id: 'sb-008',
    materialId: MAT_MILK,
    departmentId: DEPT_COLD,
    batchNumber: 'BCH-2026-0008',
    quantityRemaining: 30.0,
    expiryDate: expiryDateForBand('24h'),
    receivedDate: daysBefore(0),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_MILK).lkp_per_uom,
    uom: matOf(MAT_MILK).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00047',
    provisional: false,
    expiryBand: '24h',
  },
  // Batch 9 — Bakery, Sugar, fresh, from adjustment (for adjustment fixtures)
  {
    id: 'sb-009',
    materialId: MAT_SUGAR,
    departmentId: DEPT_BAKERY,
    batchNumber: 'BCH-2026-0009',
    quantityRemaining: 40.0,
    expiryDate: daysFromNow(180),
    receivedDate: daysBefore(10),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_SUGAR).lkp_per_uom,
    uom: matOf(MAT_SUGAR).uom,
    sourceType: 'opening',
    sourceRef: null,
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 10 — Hot Kitchen, Onion, 48h band, from GR
  {
    id: 'sb-010',
    materialId: MAT_ONION,
    departmentId: DEPT_HOT,
    batchNumber: 'BCH-2026-0010',
    quantityRemaining: 18.0,
    expiryDate: expiryDateForBand('48h'),
    receivedDate: daysBefore(2),
    yieldFactor: 0.9,
    costPerUnit: matOf(MAT_ONION).lkp_per_uom,
    uom: matOf(MAT_ONION).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00048',
    provisional: false,
    expiryBand: '48h',
  },
  // Batch 11 — Tandoor, Garam Masala, fresh, long shelf life
  {
    id: 'sb-011',
    materialId: MAT_GARAM_MASALA,
    departmentId: DEPT_TANDOOR,
    batchNumber: 'BCH-2026-0011',
    quantityRemaining: 3.5,
    expiryDate: daysFromNow(120),
    receivedDate: daysBefore(7),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_GARAM_MASALA).lkp_per_uom,
    uom: matOf(MAT_GARAM_MASALA).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00032',
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 12 — Hot Kitchen, Prawns, 24h band (high value near expiry — suggestion trigger)
  {
    id: 'sb-012',
    materialId: MAT_PRAWNS,
    departmentId: DEPT_HOT,
    batchNumber: 'BCH-2026-0012',
    quantityRemaining: 5.0,
    expiryDate: expiryDateForBand('24h'),
    receivedDate: daysBefore(4),
    yieldFactor: 0.85,
    costPerUnit: matOf(MAT_PRAWNS).lkp_per_uom,
    uom: matOf(MAT_PRAWNS).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00049',
    provisional: false,
    expiryBand: '24h',
  },
  // Batch 13 — Bakery, Coffee Bean, fresh (for paired-bundle suggestion)
  {
    id: 'sb-013',
    materialId: MAT_COFFEE,
    departmentId: DEPT_BAKERY,
    batchNumber: 'BCH-2026-0013',
    quantityRemaining: 8.0,
    expiryDate: daysFromNow(45),
    receivedDate: daysBefore(3),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_COFFEE).lkp_per_uom,
    uom: matOf(MAT_COFFEE).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00050',
    provisional: false,
    expiryBand: 'fresh',
  },
  // Batch 14 — Cold Kitchen, Turmeric, fresh (for closing fixture)
  {
    id: 'sb-014',
    materialId: MAT_TURMERIC,
    departmentId: DEPT_COLD,
    batchNumber: 'BCH-2026-0014',
    quantityRemaining: 2.0,
    expiryDate: daysFromNow(90),
    receivedDate: daysBefore(6),
    yieldFactor: 1.0,
    costPerUnit: matOf(MAT_TURMERIC).lkp_per_uom,
    uom: matOf(MAT_TURMERIC).uom,
    sourceType: 'goods_receipt',
    sourceRef: 'GR-2026-00033',
    provisional: false,
    expiryBand: 'fresh',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// StockMovement
// ─────────────────────────────────────────────────────────────────────────────

export type StockMovement = {
  readonly id: string
  readonly materialId: string
  readonly departmentId: string
  readonly batchId: string | null
  readonly movementType:
    | 'receipt'
    | 'consumption'
    | 'transfer_in'
    | 'transfer_out'
    | 'adjustment'
    | 'closing_variance'
  readonly quantityDelta: number
  readonly uom: Uom
  readonly sourceRef: string
  readonly trn: string
  readonly occurredOn: string
  readonly varianceFlagged: boolean
}

export const stockMovements: ReadonlyArray<StockMovement> = [
  {
    id: 'sm-001',
    materialId: MAT_CHICKEN,
    departmentId: DEPT_HOT,
    batchId: 'sb-001',
    movementType: 'receipt',
    quantityDelta: 20.0,
    uom: 'kg',
    sourceRef: 'GR-2026-00042',
    trn: 'TRN-GR-2026-00042',
    occurredOn: daysBefore(3),
    varianceFlagged: false,
  },
  {
    id: 'sm-002',
    materialId: MAT_CHICKEN,
    departmentId: DEPT_HOT,
    batchId: 'sb-001',
    movementType: 'consumption',
    quantityDelta: -7.5,
    uom: 'kg',
    sourceRef: 'PROD-2026-00188',
    trn: 'TRN-CONS-2026-00188',
    occurredOn: daysBefore(1),
    varianceFlagged: false,
  },
  {
    id: 'sm-003',
    materialId: MAT_MUTTON,
    departmentId: DEPT_HOT,
    batchId: 'sb-002',
    movementType: 'receipt',
    quantityDelta: 10.0,
    uom: 'kg',
    sourceRef: 'GR-2026-00043',
    trn: 'TRN-GR-2026-00043',
    occurredOn: daysBefore(2),
    varianceFlagged: false,
  },
  {
    id: 'sm-004',
    materialId: MAT_PANEER,
    departmentId: DEPT_COLD,
    batchId: 'sb-003',
    movementType: 'receipt',
    quantityDelta: 15.0,
    uom: 'kg',
    sourceRef: 'GR-2026-00044',
    trn: 'TRN-GR-2026-00044',
    occurredOn: daysBefore(1),
    varianceFlagged: false,
  },
  {
    id: 'sm-005',
    materialId: MAT_GHEE,
    departmentId: DEPT_TANDOOR,
    batchId: 'sb-006',
    movementType: 'transfer_in',
    quantityDelta: 4.0,
    uom: 'l',
    sourceRef: 'ST-2026-00008',
    trn: 'TRN-ST-2026-00008',
    occurredOn: daysBefore(2),
    varianceFlagged: false,
  },
  {
    id: 'sm-006',
    materialId: MAT_GHEE,
    departmentId: DEPT_COLD,
    batchId: null,
    movementType: 'transfer_out',
    quantityDelta: -4.0,
    uom: 'l',
    sourceRef: 'ST-2026-00008',
    trn: 'TRN-ST-2026-00008',
    occurredOn: daysBefore(2),
    varianceFlagged: false,
  },
  {
    id: 'sm-007',
    materialId: MAT_ONION,
    departmentId: DEPT_HOT,
    batchId: 'sb-010',
    movementType: 'adjustment',
    quantityDelta: -3.0,
    uom: 'kg',
    sourceRef: 'ADJ-2026-00011',
    trn: 'TRN-ADJ-2026-00011',
    occurredOn: daysBefore(1),
    varianceFlagged: false,
  },
  {
    id: 'sm-008',
    materialId: MAT_SUGAR,
    departmentId: DEPT_BAKERY,
    batchId: 'sb-009',
    movementType: 'adjustment',
    quantityDelta: -25.0, // FR114-tripping large delta
    uom: 'kg',
    sourceRef: 'ADJ-2026-00012',
    trn: 'TRN-ADJ-2026-00012',
    occurredOn: daysBefore(0),
    varianceFlagged: true, // flagged implausible
  },
  {
    id: 'sm-009',
    materialId: MAT_BASMATI,
    departmentId: DEPT_HOT,
    batchId: 'sb-007',
    movementType: 'closing_variance',
    quantityDelta: -2.5,
    uom: 'kg',
    sourceRef: 'CI-2026-00009',
    trn: 'TRN-CI-2026-00009',
    occurredOn: daysBefore(1),
    varianceFlagged: true,
  },
  {
    id: 'sm-010',
    materialId: MAT_MILK,
    departmentId: DEPT_COLD,
    batchId: 'sb-008',
    movementType: 'receipt',
    quantityDelta: 30.0,
    uom: 'l',
    sourceRef: 'GR-2026-00047',
    trn: 'TRN-GR-2026-00047',
    occurredOn: daysBefore(0),
    varianceFlagged: false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────────────────────────────────────

export type TransferStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_transit'
  | 'received'
  | 'cancelled'

export type TransferLine = {
  readonly materialId: string
  readonly requestedQty: number
  readonly fulfilledQty: number | null
  readonly sourceBatchId: string
  readonly uom: Uom
  readonly reasonCode: string | null
}

export type Transfer = {
  readonly id: string
  readonly stTrn: string
  readonly sourceDepartmentId: string
  readonly destinationDepartmentId: string
  readonly status: TransferStatus
  readonly reasonCode: string | null
  readonly bundleLegId: string | null
  readonly requestedBy: string
  readonly requestedAt: string
  readonly approvalRequestId: string | null
  readonly lines: ReadonlyArray<TransferLine>
}

// One transfer per lifecycle status (for SI-INV-006 status filter demo)
export const transfers: ReadonlyArray<Transfer> = [
  // 1. draft
  {
    id: 'st-001',
    stTrn: 'ST-2026-00001',
    sourceDepartmentId: DEPT_HOT,
    destinationDepartmentId: DEST_DEPT_BL_KITCHEN,
    status: 'draft',
    reasonCode: 'par_replenishment',
    bundleLegId: null,
    requestedBy: 'Rajan Nair',
    requestedAt: hoursAhead(-18),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_CHICKEN,
        requestedQty: 5.0,
        fulfilledQty: null,
        sourceBatchId: 'sb-001',
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // 2. pending_approval
  {
    id: 'st-002',
    stTrn: 'ST-2026-00002',
    sourceDepartmentId: DEPT_COLD,
    destinationDepartmentId: DEST_DEPT_BL_KITCHEN,
    status: 'pending_approval',
    reasonCode: 'urgent_restocking',
    bundleLegId: null,
    requestedBy: 'Priya Menon',
    requestedAt: hoursAhead(-12),
    approvalRequestId: 'apr-req-0031',
    lines: [
      {
        materialId: MAT_PANEER,
        requestedQty: 8.0,
        fulfilledQty: null,
        sourceBatchId: 'sb-003',
        uom: 'kg',
        reasonCode: null,
      },
      {
        materialId: MAT_CREAM,
        requestedQty: 2.0,
        fulfilledQty: null,
        sourceBatchId: 'sb-004',
        uom: 'l',
        reasonCode: null,
      },
    ],
  },
  // 3. approved
  {
    id: 'st-003',
    stTrn: 'ST-2026-00003',
    sourceDepartmentId: DEPT_BAKERY,
    destinationDepartmentId: DEST_DEPT_BL_KITCHEN,
    status: 'approved',
    reasonCode: 'par_replenishment',
    bundleLegId: null,
    requestedBy: 'Sanjay Sharma',
    requestedAt: hoursAhead(-8),
    approvalRequestId: 'apr-req-0032',
    lines: [
      {
        materialId: MAT_ATTA,
        requestedQty: 10.0,
        fulfilledQty: null,
        sourceBatchId: 'sb-005',
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // 4. in_transit
  {
    id: 'st-004',
    stTrn: 'ST-2026-00004',
    sourceDepartmentId: DEPT_TANDOOR,
    destinationDepartmentId: DEST_DEPT_AP_KITCHEN,
    status: 'in_transit',
    reasonCode: 'expiry_redistribution',
    bundleLegId: 'bl-001',
    requestedBy: 'Kiran Reddy',
    requestedAt: hoursAhead(-6),
    approvalRequestId: 'apr-req-0033',
    lines: [
      {
        materialId: MAT_GHEE,
        requestedQty: 3.0,
        fulfilledQty: 3.0,
        sourceBatchId: 'sb-006',
        uom: 'l',
        reasonCode: null,
      },
    ],
  },
  // 5. received
  {
    id: 'st-005',
    stTrn: 'ST-2026-00005',
    sourceDepartmentId: DEPT_HOT,
    destinationDepartmentId: DEST_DEPT_BL_KITCHEN,
    status: 'received',
    reasonCode: 'par_replenishment',
    bundleLegId: null,
    requestedBy: 'Amita Joshi',
    requestedAt: daysBefore(2),
    approvalRequestId: 'apr-req-0028',
    lines: [
      {
        materialId: MAT_ONION,
        requestedQty: 10.0,
        fulfilledQty: 10.0,
        sourceBatchId: 'sb-010',
        uom: 'kg',
        reasonCode: null,
      },
      {
        materialId: MAT_BASMATI,
        requestedQty: 5.0,
        fulfilledQty: 5.0,
        sourceBatchId: 'sb-007',
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // 6. cancelled
  {
    id: 'st-006',
    stTrn: 'ST-2026-00006',
    sourceDepartmentId: DEPT_COLD,
    destinationDepartmentId: DEST_DEPT_AP_KITCHEN,
    status: 'cancelled',
    reasonCode: 'urgent_restocking',
    bundleLegId: null,
    requestedBy: 'Vikram Patel',
    requestedAt: daysBefore(3),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_MUTTON,
        requestedQty: 4.0,
        fulfilledQty: null,
        sourceBatchId: 'sb-002',
        uom: 'kg',
        reasonCode: 'surplus_return',
      },
    ],
  },
  // 7. received (bundle leg 2 — paired cross-cluster)
  {
    id: 'st-007',
    stTrn: 'ST-2026-00007',
    sourceDepartmentId: DEPT_COLD,
    destinationDepartmentId: DEST_DEPT_AP_KITCHEN,
    status: 'received',
    reasonCode: 'expiry_redistribution',
    bundleLegId: 'bl-002',
    requestedBy: 'Ananya Das',
    requestedAt: daysBefore(1),
    approvalRequestId: 'apr-req-0030',
    lines: [
      {
        materialId: MAT_PANEER,
        requestedQty: 5.0,
        fulfilledQty: 5.0,
        sourceBatchId: 'sb-003',
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // 8. in_transit (ST-2026-00008 — event_prep ghee transfer, still en route)
  {
    id: 'st-008',
    stTrn: 'ST-2026-00008',
    sourceDepartmentId: DEPT_COLD,
    destinationDepartmentId: DEPT_TANDOOR,
    status: 'in_transit',
    reasonCode: 'event_prep',
    bundleLegId: null,
    requestedBy: 'Rajan Nair',
    requestedAt: daysBefore(2),
    approvalRequestId: 'apr-req-0029',
    lines: [
      {
        materialId: MAT_GHEE,
        requestedQty: 4.0,
        fulfilledQty: 4.0,
        sourceBatchId: 'sb-006',
        uom: 'l',
        reasonCode: null,
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TransferBundle + BundleLeg (paired cross-cluster transfers)
// ─────────────────────────────────────────────────────────────────────────────

export type BundleLeg = {
  readonly id: string
  readonly legNo: 1 | 2
  readonly fromStoreId: string
  readonly toStoreId: string
  readonly status: 'pending' | 'in_transit' | 'received' | 'cancelled'
}

export type TransferBundle = {
  readonly id: string
  readonly bundleRef: string
  readonly originatingClusterId: string
  readonly destinationClusterId: string
  readonly status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  readonly legs: ReadonlyArray<BundleLeg>
}

export const bundleLegs: ReadonlyArray<BundleLeg> = [
  // Bundle A — single-hop (same cluster, one leg)
  {
    id: 'bl-001',
    legNo: 1,
    fromStoreId: BUNDLE_FROM_STORE_ID,
    toStoreId: BUNDLE_BRAND_STORE_ID,
    status: 'in_transit',
  },
  // Bundle B — paired cross-cluster (two legs)
  {
    id: 'bl-002',
    legNo: 1,
    fromStoreId: BUNDLE_FROM_STORE_ID,
    toStoreId: BUNDLE_BRAND_STORE_ID,
    status: 'received',
  },
  {
    id: 'bl-003',
    legNo: 2,
    fromStoreId: BUNDLE_BRAND_STORE_ID,
    toStoreId: BUNDLE_TO_STORE_ID,
    status: 'received',
  },
]

export const transferBundles: ReadonlyArray<TransferBundle> = [
  // Single-hop bundle (same cluster — CK Bandra → Bandra Pali)
  {
    id: 'bundle-001',
    bundleRef: 'BDLR-2026-00001',
    originatingClusterId: CLUSTER_A_ID,
    destinationClusterId: CLUSTER_A_ID, // same cluster = single hop
    status: 'approved',
    legs: [bundleLegs[0]],
  },
  // Paired cross-cluster bundle (Bandra-West → Andheri-East)
  {
    id: 'bundle-002',
    bundleRef: 'BDLR-2026-00002',
    originatingClusterId: CLUSTER_A_ID,
    destinationClusterId: CLUSTER_B_ID,
    status: 'approved',
    legs: [bundleLegs[1], bundleLegs[2]],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TransferSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export type TransferSuggestion = {
  readonly id: string
  readonly batchId: string
  readonly materialId: string
  readonly sourceLocationId: string
  readonly hoursToExpiry: number
  readonly valueAtRisk: number
  readonly suggestionType: 'single_hop' | 'paired'
  readonly destinationLabel: string
  readonly expectedConsumption: number
  readonly feasibilityScore: number
  readonly dismissed: boolean
}

export const transferSuggestions: ReadonlyArray<TransferSuggestion> = [
  // Single-hop: Prawns expiring in 18h — move to Bandra Linking
  {
    id: 'sug-001',
    batchId: 'sb-012',
    materialId: MAT_PRAWNS,
    sourceLocationId: CK_LOC_ID,
    hoursToExpiry: 18,
    valueAtRisk: matOf(MAT_PRAWNS).lkp_per_uom * 5,
    suggestionType: 'single_hop',
    destinationLabel: 'Wild Sugar Linking Road',
    expectedConsumption: 4.0,
    feasibilityScore: 88,
    dismissed: false,
  },
  // Paired: Chicken expiring in 22h — CK Bandra → Pali Hill → Andheri Phoenix
  {
    id: 'sug-002',
    batchId: 'sb-001',
    materialId: MAT_CHICKEN,
    sourceLocationId: CK_LOC_ID,
    hoursToExpiry: 22,
    valueAtRisk: matOf(MAT_CHICKEN).lkp_per_uom * 12.5,
    suggestionType: 'paired',
    destinationLabel: 'Bandra Pali → Andheri Phoenix',
    expectedConsumption: 10.0,
    feasibilityScore: 74,
    dismissed: false,
  },
  // Single-hop: Milk expiring in 20h — move to Bandra Linking
  {
    id: 'sug-003',
    batchId: 'sb-008',
    materialId: MAT_MILK,
    sourceLocationId: CK_LOC_ID,
    hoursToExpiry: 20,
    valueAtRisk: matOf(MAT_MILK).lkp_per_uom * 30,
    suggestionType: 'single_hop',
    destinationLabel: 'Wild Sugar Linking Road',
    expectedConsumption: 25.0,
    feasibilityScore: 91,
    dismissed: false,
  },
  // Dismissed suggestion (for dismissed-filter UI demo)
  {
    id: 'sug-004',
    batchId: 'sb-010',
    materialId: MAT_ONION,
    sourceLocationId: CK_LOC_ID,
    hoursToExpiry: 42,
    valueAtRisk: matOf(MAT_ONION).lkp_per_uom * 18,
    suggestionType: 'single_hop',
    destinationLabel: 'Wild Sugar Pali Hill',
    expectedConsumption: 15.0,
    feasibilityScore: 60,
    dismissed: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Adjustment
// ─────────────────────────────────────────────────────────────────────────────

export type AdjustmentStatus = 'draft' | 'pending_approval' | 'confirmed' | 'cancelled'

export type AdjustmentReasonCode =
  | 'physical_recount'
  | 'damage'
  | 'spoilage'
  | 'theft'
  | 'system_correction'
  | 'wastage'

export type AdjustmentLine = {
  readonly materialId: string
  readonly batchId: string
  readonly currentOnHand: number
  readonly delta: number
  readonly uom: Uom
  readonly reasonCode: AdjustmentReasonCode
}

export type Adjustment = {
  readonly id: string
  readonly adjTrn: string
  readonly departmentId: string
  readonly status: AdjustmentStatus
  readonly aggregateValueImpact: number
  readonly requestedBy: string
  readonly requestedAt: string
  readonly approvalRequestId: string | null
  readonly lines: ReadonlyArray<AdjustmentLine>
}

export const inventoryAdjustments: ReadonlyArray<Adjustment> = [
  // 1. Confirmed small adjustment (physical recount, within threshold)
  {
    id: 'adj-001',
    adjTrn: 'ADJ-2026-00009',
    departmentId: DEPT_HOT,
    status: 'confirmed',
    aggregateValueImpact: -(matOf(MAT_ONION).lkp_per_uom * 3),
    requestedBy: 'Amita Joshi',
    requestedAt: daysBefore(3),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_ONION,
        batchId: 'sb-010',
        currentOnHand: 21.0,
        delta: -3.0,
        uom: 'kg',
        reasonCode: 'physical_recount',
      },
    ],
  },
  // 2. Pending approval — over-threshold value (approval-routed, FR37)
  {
    id: 'adj-002',
    adjTrn: 'ADJ-2026-00010',
    departmentId: DEPT_COLD,
    status: 'pending_approval',
    // Over-threshold: mutton at ₹780/kg × 12 kg = ₹9,360 — triggers approval (value, not quantity)
    aggregateValueImpact: -(matOf(MAT_MUTTON).lkp_per_uom * 12),
    requestedBy: 'Priya Menon',
    requestedAt: daysBefore(1),
    approvalRequestId: 'apr-req-0035',
    lines: [
      {
        materialId: MAT_MUTTON,
        batchId: 'sb-002',
        currentOnHand: 20.0, // comfortably above abs(delta) so delta is physically plausible
        delta: -12.0,        // ₹780/kg × 12 kg = ₹9,360 > ₹5,000 threshold → approval-routed
        uom: 'kg',
        reasonCode: 'spoilage',
      },
    ],
  },
  // 3. Draft adjustment (wastage, bakery)
  {
    id: 'adj-003',
    adjTrn: 'ADJ-2026-00011',
    departmentId: DEPT_BAKERY,
    status: 'draft',
    aggregateValueImpact: -(matOf(MAT_ATTA).lkp_per_uom * 5),
    requestedBy: 'Sanjay Sharma',
    requestedAt: hoursAhead(-4),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_ATTA,
        batchId: 'sb-005',
        currentOnHand: 50.0,
        delta: -5.0,
        uom: 'kg',
        reasonCode: 'wastage',
      },
    ],
  },
  // 4. FR114-tripping adjustment (delta implausibly large relative to on-hand)
  {
    id: 'adj-004',
    adjTrn: 'ADJ-2026-00012',
    departmentId: DEPT_BAKERY,
    status: 'draft',
    // Sugar: 40 kg on hand but delta = -35 kg (87.5% of stock — implausible)
    aggregateValueImpact: -(matOf(MAT_SUGAR).lkp_per_uom * 35),
    requestedBy: 'Sanjay Sharma',
    requestedAt: hoursAhead(-1),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_SUGAR,
        batchId: 'sb-009',
        currentOnHand: 40.0,
        delta: -35.0, // FR114: >80% of on-hand in a single adjustment = implausibility warning
        uom: 'kg',
        reasonCode: 'damage',
      },
    ],
  },
  // 5. Cancelled adjustment
  {
    id: 'adj-005',
    adjTrn: 'ADJ-2026-00008',
    departmentId: DEPT_TANDOOR,
    status: 'cancelled',
    aggregateValueImpact: 0,
    requestedBy: 'Kiran Reddy',
    requestedAt: daysBefore(5),
    approvalRequestId: null,
    lines: [
      {
        materialId: MAT_GARAM_MASALA,
        batchId: 'sb-011',
        currentOnHand: 3.5,
        delta: -1.0,
        uom: 'kg',
        reasonCode: 'system_correction',
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// ClosingInventory
// ─────────────────────────────────────────────────────────────────────────────

export type CutOffStatus = 'on_time' | 'late' | 'not_submitted'
export type ClosingStatus = 'draft' | 'confirmed' | 'variance_flagged'

export type ClosingLine = {
  readonly materialId: string
  readonly expectedQty: number
  readonly countedQty: number
  readonly variance: number
  readonly uom: Uom
  readonly reasonCode: string | null
}

export type ClosingInventory = {
  readonly id: string
  readonly ciTrn: string
  readonly locationId: string
  readonly departmentId: string
  readonly businessDate: string
  readonly status: ClosingStatus
  readonly submissionTimestamp: string | null
  readonly cutOffStatus: CutOffStatus
  readonly totalVarianceValue: number
  readonly varianceItemsCount: number
  readonly varianceAcceptable: boolean
  readonly deptType: 'pos' | 'dispatch'
  readonly lines: ReadonlyArray<ClosingLine>
}

export const closingInventory: ReadonlyArray<ClosingInventory> = [
  // CI-1: POS outlet context (for SI-INV-014) — confirmed, on time
  {
    id: 'ci-001',
    ciTrn: 'CI-2026-00009',
    locationId: POS_LOC_ID,
    departmentId: 'dept-bl-kitchen',
    businessDate: daysBefore(1),
    status: 'confirmed',
    submissionTimestamp: `${daysBefore(1)}T23:45:00Z`,
    cutOffStatus: 'on_time',
    totalVarianceValue: matOf(MAT_BASMATI).lkp_per_uom * 2.5,
    varianceItemsCount: 1,
    varianceAcceptable: true,
    deptType: 'pos',
    lines: [
      {
        materialId: MAT_CHICKEN,
        expectedQty: 8.0,
        countedQty: 8.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
      {
        materialId: MAT_BASMATI,
        expectedQty: 10.0,
        countedQty: 7.5,
        variance: -2.5,
        uom: 'kg',
        reasonCode: 'portioning_variance',
      },
      {
        materialId: MAT_ONION,
        expectedQty: 5.0,
        countedQty: 5.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // CI-2: Dispatch hub context (for SI-INV-015) — variance_flagged, late
  {
    id: 'ci-002',
    ciTrn: 'CI-2026-00010',
    locationId: DISPATCH_LOC_ID,
    departmentId: 'dept-dh-dispatch',
    businessDate: daysBefore(1),
    status: 'variance_flagged',
    submissionTimestamp: `${daysBefore(0)}T01:30:00Z`, // submitted past cut-off → late
    cutOffStatus: 'late',
    totalVarianceValue:
      matOf(MAT_MUTTON).lkp_per_uom * 3 + matOf(MAT_GHEE).lkp_per_uom * 1,
    varianceItemsCount: 2,
    varianceAcceptable: false,
    deptType: 'dispatch',
    lines: [
      {
        materialId: MAT_MUTTON,
        expectedQty: 15.0,
        countedQty: 12.0,
        variance: -3.0,
        uom: 'kg',
        reasonCode: 'spoilage',
      },
      {
        materialId: MAT_GHEE,
        expectedQty: 5.0,
        countedQty: 4.0,
        variance: -1.0,
        uom: 'l',
        reasonCode: 'evaporation',
      },
      {
        materialId: MAT_BASMATI,
        expectedQty: 20.0,
        countedQty: 20.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // CI-3: Cluster spread entry 1 — Bandra Linking, on_time (for SI-INV-016)
  {
    id: 'ci-003',
    ciTrn: 'CI-2026-00011',
    locationId: POS_LOC_ID,
    departmentId: 'dept-bl-service',
    businessDate: daysBefore(1),
    status: 'confirmed',
    submissionTimestamp: `${daysBefore(1)}T23:30:00Z`,
    cutOffStatus: 'on_time',
    totalVarianceValue: 0,
    varianceItemsCount: 0,
    varianceAcceptable: true,
    deptType: 'pos',
    lines: [
      {
        materialId: MAT_MILK,
        expectedQty: 10.0,
        countedQty: 10.0,
        variance: 0,
        uom: 'l',
        reasonCode: null,
      },
      {
        materialId: MAT_SUGAR,
        expectedQty: 5.0,
        countedQty: 5.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // CI-4: Cluster spread entry 2 — Bandra Pali, not_submitted (for SI-INV-016)
  {
    id: 'ci-004',
    ciTrn: 'CI-2026-00012',
    locationId: 'loc-bandra-pali',
    departmentId: 'dept-bp-kitchen',
    businessDate: daysBefore(1),
    status: 'draft',
    submissionTimestamp: null,
    cutOffStatus: 'not_submitted', // required by brief
    totalVarianceValue: 0,
    varianceItemsCount: 0,
    varianceAcceptable: true,
    deptType: 'pos',
    lines: [
      {
        materialId: MAT_CHICKEN,
        expectedQty: 6.0,
        countedQty: 6.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
  // CI-5: Cluster spread entry 3 — Andheri Phoenix, FR114-tripping count (SI-INV-016)
  {
    id: 'ci-005',
    ciTrn: 'CI-2026-00013',
    locationId: 'loc-andheri-phoenix',
    departmentId: 'dept-ap-kitchen',
    businessDate: daysBefore(1),
    status: 'variance_flagged',
    submissionTimestamp: `${daysBefore(1)}T23:50:00Z`,
    cutOffStatus: 'on_time',
    // Sugar: expected 20 kg but counted 2 kg — FR114 implausibility (>80% loss)
    totalVarianceValue: matOf(MAT_SUGAR).lkp_per_uom * 18,
    varianceItemsCount: 1,
    varianceAcceptable: false,
    deptType: 'pos',
    lines: [
      {
        materialId: MAT_SUGAR,
        expectedQty: 20.0,
        countedQty: 2.0, // FR114-tripping — implausible count
        variance: -18.0,
        uom: 'kg',
        reasonCode: null, // no reason code yet — implausibility pending resolution
      },
      {
        materialId: MAT_PANEER,
        expectedQty: 4.0,
        countedQty: 3.5,
        variance: -0.5,
        uom: 'kg',
        reasonCode: 'portioning_variance',
      },
    ],
  },
  // CI-6: Today draft (for draft state demo)
  {
    id: 'ci-006',
    ciTrn: 'CI-2026-00014',
    locationId: POS_LOC_ID,
    departmentId: 'dept-bl-kitchen',
    businessDate: daysBefore(0),
    status: 'draft',
    submissionTimestamp: null,
    cutOffStatus: 'on_time',
    totalVarianceValue: 0,
    varianceItemsCount: 0,
    varianceAcceptable: true,
    deptType: 'pos',
    lines: [
      {
        materialId: MAT_ONION,
        expectedQty: 4.0,
        countedQty: 4.0,
        variance: 0,
        uom: 'kg',
        reasonCode: null,
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CutOffRegistry
// ─────────────────────────────────────────────────────────────────────────────

export type CutOffRegistryEntry = {
  readonly locationId: string
  readonly departmentId: string | null
  readonly cutOffTime: string // HH:MM
}

export const cutOffRegistry: ReadonlyArray<CutOffRegistryEntry> = [
  { locationId: POS_LOC_ID, departmentId: null, cutOffTime: '23:59' },
  { locationId: 'loc-bandra-pali', departmentId: null, cutOffTime: '23:59' },
  { locationId: 'loc-andheri-phoenix', departmentId: null, cutOffTime: '23:59' },
  { locationId: DISPATCH_LOC_ID, departmentId: null, cutOffTime: '00:30' },
  { locationId: CK_LOC_ID, departmentId: null, cutOffTime: '01:00' },
  { locationId: 'loc-powai-hiranandani', departmentId: null, cutOffTime: '23:59' },
]

// ─────────────────────────────────────────────────────────────────────────────
// PAR Levels
// ─────────────────────────────────────────────────────────────────────────────

export type ParLevel = {
  readonly id: string
  readonly materialId: string
  readonly locationId: string | null
  readonly departmentId: string | null
  readonly basePar: number
  readonly dayOfWeekOverrides: {
    mon?: number
    tue?: number
    wed?: number
    thu?: number
    fri?: number
    sat?: number
    sun?: number
  } | null
  readonly lastModifiedBy: string
  readonly lastModifiedAt: string
}

export const parLevels: ReadonlyArray<ParLevel> = [
  // CK Bandra Hot Kitchen
  {
    id: 'par-001',
    materialId: MAT_CHICKEN,
    locationId: CK_LOC_ID,
    departmentId: DEPT_HOT,
    basePar: 30,
    dayOfWeekOverrides: { fri: 40, sat: 45, sun: 42 },
    lastModifiedBy: 'Rajan Nair',
    lastModifiedAt: daysBefore(7),
  },
  {
    id: 'par-002',
    materialId: MAT_MUTTON,
    locationId: CK_LOC_ID,
    departmentId: DEPT_HOT,
    basePar: 20,
    dayOfWeekOverrides: { fri: 28, sat: 30, sun: 25 },
    lastModifiedBy: 'Rajan Nair',
    lastModifiedAt: daysBefore(7),
  },
  {
    id: 'par-003',
    materialId: MAT_ONION,
    locationId: CK_LOC_ID,
    departmentId: DEPT_HOT,
    basePar: 25,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Amita Joshi',
    lastModifiedAt: daysBefore(14),
  },
  {
    id: 'par-004',
    materialId: MAT_BASMATI,
    locationId: CK_LOC_ID,
    departmentId: DEPT_HOT,
    basePar: 40,
    dayOfWeekOverrides: { fri: 55, sat: 60, sun: 50 },
    lastModifiedBy: 'Amita Joshi',
    lastModifiedAt: daysBefore(14),
  },
  // CK Bandra Cold Kitchen
  {
    id: 'par-005',
    materialId: MAT_PANEER,
    locationId: CK_LOC_ID,
    departmentId: DEPT_COLD,
    basePar: 20,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Priya Menon',
    lastModifiedAt: daysBefore(5),
  },
  {
    id: 'par-006',
    materialId: MAT_CREAM,
    locationId: CK_LOC_ID,
    departmentId: DEPT_COLD,
    basePar: 10,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Priya Menon',
    lastModifiedAt: daysBefore(5),
  },
  {
    id: 'par-007',
    materialId: MAT_MILK,
    locationId: CK_LOC_ID,
    departmentId: DEPT_COLD,
    basePar: 50,
    dayOfWeekOverrides: { sat: 70, sun: 65 },
    lastModifiedBy: 'Priya Menon',
    lastModifiedAt: daysBefore(3),
  },
  // CK Bandra Bakery
  {
    id: 'par-008',
    materialId: MAT_ATTA,
    locationId: CK_LOC_ID,
    departmentId: DEPT_BAKERY,
    basePar: 60,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Sanjay Sharma',
    lastModifiedAt: daysBefore(10),
  },
  {
    id: 'par-009',
    materialId: MAT_SUGAR,
    locationId: CK_LOC_ID,
    departmentId: DEPT_BAKERY,
    basePar: 50,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Sanjay Sharma',
    lastModifiedAt: daysBefore(10),
  },
  {
    id: 'par-010',
    materialId: MAT_COFFEE,
    locationId: CK_LOC_ID,
    departmentId: DEPT_BAKERY,
    basePar: 15,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Sanjay Sharma',
    lastModifiedAt: daysBefore(10),
  },
  // CK Bandra Tandoor
  {
    id: 'par-011',
    materialId: MAT_GHEE,
    locationId: CK_LOC_ID,
    departmentId: DEPT_TANDOOR,
    basePar: 8,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Kiran Reddy',
    lastModifiedAt: daysBefore(6),
  },
  {
    id: 'par-012',
    materialId: MAT_GARAM_MASALA,
    locationId: CK_LOC_ID,
    departmentId: DEPT_TANDOOR,
    basePar: 6,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'Kiran Reddy',
    lastModifiedAt: daysBefore(6),
  },
  // Brand-wide PAR (locationId + departmentId null = brand fallback)
  {
    id: 'par-013',
    materialId: MAT_TURMERIC,
    locationId: null,
    departmentId: null,
    basePar: 5,
    dayOfWeekOverrides: null,
    lastModifiedBy: 'System',
    lastModifiedAt: daysBefore(30),
  },
  {
    id: 'par-014',
    materialId: MAT_PRAWNS,
    locationId: CK_LOC_ID,
    departmentId: DEPT_HOT,
    basePar: 10,
    dayOfWeekOverrides: { fri: 15, sat: 18, sun: 14 },
    lastModifiedBy: 'Rajan Nair',
    lastModifiedAt: daysBefore(4),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// belowParRows — derived helper
// ─────────────────────────────────────────────────────────────────────────────

type BelowParRow = {
  readonly materialId: string
  readonly departmentId: string
  readonly onHand: number
  readonly basePar: number
  readonly adjustedPar: number
  readonly shortfall: number
  readonly suggestedReorder: number
  readonly urgency: 'approaching' | 'below' | 'critical'
  readonly onOpenPo: boolean
}

// Day-of-week index for NOW (2026-05-06 = Wednesday = 3)
const NOW_DOW: keyof NonNullable<ParLevel['dayOfWeekOverrides']> = 'wed'

// Determine which material ids have open POs (status: 'pending_gr' | 'pending_approval' | 'confirmed')
const openPoMaterialIds = new Set<string>(
  purchaseOrders
    .filter(
      (po) =>
        po.status === 'pending_gr' ||
        po.status === 'pending_approval' ||
        po.status === 'confirmed',
    )
    .flatMap((po) => po.lines.map((l) => l.material_id)),
)

/** Derive urgency from on-hand vs PAR.
 * All three bands require onHand < adjustedPar so every row has a real shortfall:
 *   approaching — 80–100 % of PAR (close but not yet critical)
 *   below       — 50–80 % of PAR
 *   critical    — ≤ 50 % of PAR (or zero / negative)
 */
function deriveUrgency(onHand: number, adjustedPar: number): 'approaching' | 'below' | 'critical' {
  if (onHand <= 0 || onHand / adjustedPar <= 0.5) return 'critical'
  if (onHand / adjustedPar <= 0.8) return 'below'
  return 'approaching' // 80–100 % of PAR — below PAR, small positive shortfall
}

export const belowParRows: ReadonlyArray<BelowParRow> = (() => {
  const rows: BelowParRow[] = []

  for (const par of parLevels) {
    // Only compute rows for department-scoped PARs (locationId + departmentId set)
    if (!par.locationId || !par.departmentId) continue

    // Find the matching inventory position for this material at this location
    const pos = inventoryPositions.find(
      (p) => p.location_id === par.locationId && p.material_id === par.materialId,
    )
    if (!pos) continue

    const adjustedPar =
      par.dayOfWeekOverrides?.[NOW_DOW] ?? par.basePar

    const onHand = pos.on_hand_qty
    const shortfall = Math.max(0, adjustedPar - onHand)

    // Only include rows genuinely below PAR (shortfall > 0 guaranteed)
    if (onHand >= adjustedPar) continue

    const urgency = deriveUrgency(onHand, adjustedPar)
    // Suggested reorder = shortfall + 20% buffer, rounded to nearest whole unit
    const suggestedReorder = Math.round(shortfall * 1.2)

    rows.push({
      materialId: par.materialId,
      departmentId: par.departmentId,
      onHand,
      basePar: par.basePar,
      adjustedPar,
      shortfall,
      suggestedReorder,
      urgency,
      onOpenPo: openPoMaterialIds.has(par.materialId),
    })
  }

  // ── Band-coverage guarantee for SI-INV-003 urgency filter demo ──────────────
  // The IIFE above only produces 'critical' rows with the current fixture data
  // (mat-milk: onHand=25, par=50, ratio=0.50).  We append two explicit rows so
  // all three urgency bands — approaching (80–100%), below (50–80%), critical
  // (≤50%) — are always present, along with both onOpenPo: true and false.
  // These use real CK-Bandra (material, department) pairs NOT already produced
  // above; numbers are hand-set and internally consistent.

  // approaching — mat-basmati-rice / Hot Kitchen
  //   onHand 35, par 40 → ratio 0.875 → approaching; no open PO
  rows.push({
    materialId: MAT_BASMATI,
    departmentId: DEPT_HOT,
    onHand: 35,
    basePar: 40,
    adjustedPar: 40,
    shortfall: 5,
    suggestedReorder: 6,
    urgency: 'approaching',
    onOpenPo: false,
  })

  // below — mat-cream / Cold Kitchen
  //   onHand 6, par 10 → ratio 0.60 → below; open PO (vnd-mumbai-dairy active)
  rows.push({
    materialId: MAT_CREAM,
    departmentId: DEPT_COLD,
    onHand: 6,
    basePar: 10,
    adjustedPar: 10,
    shortfall: 4,
    suggestedReorder: 5,
    urgency: 'below',
    onOpenPo: true,
  })

  return rows
})()
