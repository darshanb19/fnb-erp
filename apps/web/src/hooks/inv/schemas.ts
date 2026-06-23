import { z } from 'zod'

/** Inventory Arc-(a) endpoints wrap results as `{ data: <result> }`; wrap the inner schema. */
export const envelope = <T extends z.ZodTypeAny>(inner: T) => z.object({ data: inner })

// GET /stock/department/:departmentId → { data: DepartmentStockResult }
export const departmentStockRowSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  lastUpdatedAt: z.string(), // ISO timestamp (JSON-serialised Date)
})
export const departmentStockResultSchema = z.object({
  departmentId: z.string().uuid(),
  items: z.array(departmentStockRowSchema),
})
export type DepartmentStockRow = z.infer<typeof departmentStockRowSchema>
export type DepartmentStockResult = z.infer<typeof departmentStockResultSchema>

// GET /stock/expiring → data: ExpiringBatchesResult
export const expiringItemSchema = z.object({
  batchId: z.string().uuid(),
  productId: z.string().uuid(),
  departmentId: z.string().uuid(),
  batchNumber: z.string(),
  quantityRemaining: z.number(),
  expiryDate: z.string(),
  hoursUntilExpiry: z.number(),
  valueAtRisk: z.number(),
})
export const expiringBatchesResultSchema = z.object({
  bands: z.object({
    h24: z.number(),
    h48: z.number(),
    h72: z.number(),
    over72: z.number(),
  }),
  items: z.array(expiringItemSchema),
})
export type ExpiringItem = z.infer<typeof expiringItemSchema>
export type ExpiringBatchesResult = z.infer<typeof expiringBatchesResultSchema>

// GET /par-levels/below → data: BelowParRow[]
export const belowParRowSchema = z.object({
  parLevelId: z.string().uuid(),
  productId: z.string().uuid(),
  locationId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  basePar: z.number(),
  adjustedPar: z.number(),
  onHand: z.number(),
  shortfall: z.number(),
  suggestedReorder: z.number(),
})
export const belowParListSchema = z.array(belowParRowSchema)
export type BelowParRow = z.infer<typeof belowParRowSchema>

// GET /stock-transfers/suggestions → data: { suggestions: TransferSuggestion[] }
export const transferSuggestionSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  sourceDepartmentId: z.string().uuid(),
  availableQty: z.number(),
  suggestedQty: z.number(),
  reason: z.string(),
})
export const transferSuggestionsResultSchema = z.object({
  suggestions: z.array(transferSuggestionSchema),
})
export type TransferSuggestion = z.infer<typeof transferSuggestionSchema>

// GET /closing-inventory/summary → data: ClosingInventorySummary
export const closingSummaryRecordSchema = z.object({
  id: z.string().uuid(),
  ciTrn: z.string(),
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  status: z.enum(['draft', 'confirmed', 'variance_flagged']),
  varianceItemsCount: z.number().nullable(),
  totalVarianceValue: z.number().nullable(),
})
export const closingInventorySummarySchema = z.object({
  businessDate: z.string(),
  totalRecords: z.number(),
  confirmedCount: z.number(),
  varianceFlaggedCount: z.number(),
  varianceAcceptedCount: z.number(),
  draftCount: z.number(),
  records: z.array(closingSummaryRecordSchema),
})
export type ClosingInventorySummary = z.infer<typeof closingInventorySummarySchema>

// GET /closing-inventory/cut-off-compliance → data: CutOffComplianceResult
export const cutOffComplianceResultSchema = z.object({
  businessDate: z.string(),
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  cutOffTime: z.string().nullable(),
  submissionTime: z.string().nullable(),
  status: z.enum(['on_time', 'late', 'not_submitted', 'no_cutoff_configured']),
})
export type CutOffComplianceResult = z.infer<typeof cutOffComplianceResultSchema>

// GET /api/v1/products → data: array (only id + name needed for name resolution)
export const productNameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})
export const productNameListSchema = z.array(productNameSchema)

// GET /stock/movements?productId=&departmentId= → { data: [...movements] }
// The route executes SELECT * FROM stock_movements — raw snake_case columns are returned.
// Fields confirmed from apps/api/src/db/schema/inventory.ts brandScopedTable + stockMovements columns.
export const stockMovementSchema = z.object({
  id: z.string().uuid(),
  brand_id: z.string().uuid(),
  created_at: z.string(),       // ISO timestamp from JSON serialisation of timestamptz
  updated_at: z.string(),
  product_id: z.string().uuid(),
  department_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable(),
  movement_type: z.enum([
    'receipt',
    'consumption',
    'transfer_in',
    'transfer_out',
    'adjustment',
    'closing_variance',
  ]),
  quantity_delta: z.string(),   // numeric from Postgres arrives as string
  uom_id: z.string().uuid(),
  source_type: z.string(),
  source_id: z.string().uuid(),
  dest_type: z.string().nullable(),
  dest_id: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  reason_code: z.string().nullable(),
  trn_reference: z.string().nullable(),
  journal_event_id: z.string().uuid().nullable(),
  actor_user_id: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  updated_by: z.string().uuid().nullable(),
})
export const stockMovementsListSchema = z.array(stockMovementSchema)
export type StockMovementRow = z.infer<typeof stockMovementSchema>

// ── Stock transfer detail / list (GET /stock-transfers/:id, GET /stock-transfers) ──
export const transferStatusEnum = z.enum([
  'draft', 'pending_approval', 'approved', 'in_transit', 'received', 'cancelled',
])
export type TransferStatus = z.infer<typeof transferStatusEnum>

export const transferLineSchema = z.object({
  id: z.string().uuid(),
  stockTransferId: z.string().uuid(),
  productId: z.string().uuid(),
  requestedQty: z.coerce.number(),
  fulfilledQty: z.coerce.number().nullable(),
  sourceBatchId: z.string().uuid().nullable(),
  reasonCode: z.string().nullable(),
})
export type TransferLine = z.infer<typeof transferLineSchema>

export const transferHeaderSchema = z.object({
  id: z.string().uuid(),
  stTrn: z.string(),
  sourceDepartmentId: z.string().uuid(),
  destinationDepartmentId: z.string().uuid(),
  status: transferStatusEnum,
  reasonCode: z.string().nullable(),
  bundleLegId: z.string().uuid().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  requestedAt: z.string().nullable(),
  approvalRequestId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TransferListItem = z.infer<typeof transferHeaderSchema>

export const transferDetailSchema = transferHeaderSchema.extend({
  lines: z.array(transferLineSchema),
})
export type TransferDetail = z.infer<typeof transferDetailSchema>

export const transferListSchema = z.array(transferHeaderSchema)

// ── Create / lifecycle / bundle result envelopes (POST endpoints, all `{ data }`) ──
export const createTransferResultSchema = z.object({
  transferId: z.string().uuid(),
  stTrn: z.string(),
  status: z.string(),
})
export type CreateTransferResult = z.infer<typeof createTransferResultSchema>

export const transferStatusResultSchema = z.object({ status: z.string() })

export const createBundleResultSchema = z.object({
  bundleId: z.string().uuid(),
  bundleRef: z.string(),
})
export type CreateBundleResult = z.infer<typeof createBundleResultSchema>

export const approveBundleResultSchema = z.object({
  transferIds: z.array(z.string().uuid()),
})

// ── PAR list / set (GET /par-levels, POST /par-levels, POST /par-levels/bulk) ──
export const dayOfWeekOverridesSchema = z.object({
  mon: z.number().int().optional(),
  tue: z.number().int().optional(),
  wed: z.number().int().optional(),
  thu: z.number().int().optional(),
  fri: z.number().int().optional(),
  sat: z.number().int().optional(),
  sun: z.number().int().optional(),
})
export const parLevelRowSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  locationId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  basePar: z.coerce.number(),
  dayOfWeekOverrides: dayOfWeekOverridesSchema.nullable(),
  lastModifiedByUserId: z.string().uuid().nullable(),
  lastModifiedAt: z.string(),
})
export type ParLevelRow = z.infer<typeof parLevelRowSchema>
export const parLevelListSchema = z.array(parLevelRowSchema)
export const bulkParResultSchema = z.object({ count: z.number() })

// ── Org lists (BARE — no envelope) ──
export const inventoryDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable().optional(),
  locationId: z.string().uuid(),
  type: z.string(),
})
export const inventoryDepartmentListSchema = z.array(inventoryDepartmentSchema)
export type InventoryDepartment = z.infer<typeof inventoryDepartmentSchema>

export const clusterMinimalSchema = z.object({ id: z.string().uuid(), name: z.string() })
export const clusterListSchema = z.array(clusterMinimalSchema)

export const uomMinimalSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  displayName: z.string(),
})
export const uomListSchema = z.array(uomMinimalSchema)

export const storeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: z.enum(['brand', 'cluster']),
  clusterId: z.string().uuid().nullable(),
})
export type Store = z.infer<typeof storeSchema>
export const storeListSchema = z.array(storeSchema)
