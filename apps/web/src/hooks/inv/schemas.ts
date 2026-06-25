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

// ── meta-aware envelope (for endpoints that return { data, meta } and we need meta) ──
export function metaEnvelope<TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny>(
  data: TData,
  meta: TMeta,
) {
  return z.object({ data, meta: meta.optional() })
}

// ── Product catalog (BARE GET /products — full Product rows) ──
export const productCatalogItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  type: z.enum(['raw', 'semi_product', 'final']),
  defaultUomId: z.string().uuid(),
  standardYieldFactor: z.coerce.number(),
})
export type ProductCatalogItem = z.infer<typeof productCatalogItemSchema>
export const productCatalogListSchema = z.array(productCatalogItemSchema)

// ── Goods receipts (GET /goods-receipts, /:id; POST record/confirm/reject) ──
export const grStatusEnum = z.enum(['draft', 'confirmed', 'pending_approval', 'rejected'])
export type GrStatus = z.infer<typeof grStatusEnum>

export const goodsReceiptHeaderSchema = z.object({
  id: z.string().uuid(),
  grTrn: z.string(),
  poId: z.string().uuid().nullable(),
  transferId: z.string().uuid().nullable(),
  destinationDepartmentId: z.string().uuid(),
  status: grStatusEnum,
  receivedByUserId: z.string().uuid().nullable(),
  receivedAt: z.string().nullable(),
  warningCount: z.coerce.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type GoodsReceiptListItem = z.infer<typeof goodsReceiptHeaderSchema>
export const goodsReceiptListSchema = z.array(goodsReceiptHeaderSchema)

export const grLineSchema = z.object({
  id: z.string().uuid(),
  goodsReceiptId: z.string().uuid(),
  productId: z.string().uuid(),
  receivedQty: z.coerce.number(),
  yieldFactor: z.coerce.number(),
  usableQty: z.coerce.number(),
  wastageQty: z.coerce.number(),
  unitCost: z.coerce.number().nullable(),
  adjustedCostPerUnit: z.coerce.number().nullable(),
  expiryDate: z.string().nullable(),
  batchNumber: z.string().nullable(),
  varianceQty: z.coerce.number().nullable(),
  reasonCode: z.string().nullable(),
})
export type GrLine = z.infer<typeof grLineSchema>
export const goodsReceiptDetailSchema = goodsReceiptHeaderSchema.extend({
  lines: z.array(grLineSchema),
})
export type GoodsReceiptDetail = z.infer<typeof goodsReceiptDetailSchema>

export const recordGrResultSchema = z.object({ goodsReceiptId: z.string().uuid(), grTrn: z.string() })
export const grWarningsMetaSchema = z.object({ warnings: z.array(z.string()) })
export const grStatusResultSchema = z.object({ status: z.string() })

// ── Inventory adjustments (GET /inventory-adjustments, /:id; POST record/confirm/cancel) ──
export const adjStatusEnum = z.enum(['draft', 'pending_approval', 'confirmed', 'cancelled'])
export type AdjStatus = z.infer<typeof adjStatusEnum>

export const adjustmentHeaderSchema = z.object({
  id: z.string().uuid(),
  adjTrn: z.string(),
  departmentId: z.string().uuid(),
  status: adjStatusEnum,
  aggregateValueImpact: z.coerce.number().nullable(),
  approvalRequestId: z.string().uuid().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  requestedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AdjustmentListItem = z.infer<typeof adjustmentHeaderSchema>
export const adjustmentListSchema = z.array(adjustmentHeaderSchema)

export const adjustmentLineSchema = z.object({
  id: z.string().uuid(),
  inventoryAdjustmentId: z.string().uuid(),
  productId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  currentOnHand: z.coerce.number().nullable(),
  delta: z.coerce.number(),
  reasonCode: z.string(),
})
export type AdjustmentLine = z.infer<typeof adjustmentLineSchema>
export const adjustmentDetailSchema = adjustmentHeaderSchema.extend({
  lines: z.array(adjustmentLineSchema),
})
export type AdjustmentDetail = z.infer<typeof adjustmentDetailSchema>

export const recordAdjResultSchema = z.object({
  adjustmentId: z.string().uuid(),
  adjTrn: z.string(),
  status: z.string(),
})
export const adjApprovalMetaSchema = z.object({ approvalRequestId: z.string().uuid() })
export const adjStatusResultSchema = z.object({ status: z.string() })

// ── Closing inventory write/detail/list (existing file already has summary + cutOff READ schemas) ──
export const closingStatusEnum = z.enum(['draft', 'confirmed', 'variance_flagged'])
export type ClosingStatus = z.infer<typeof closingStatusEnum>

export const closingHeaderSchema = z.object({
  id: z.string().uuid(),
  ciTrn: z.string(),
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  businessDate: z.string(),
  status: closingStatusEnum,
  submissionTimestamp: z.string().nullable(),
  cutOffStatus: z.string().nullable(),
  totalVarianceValue: z.coerce.number().nullable(),
  varianceItemsCount: z.coerce.number().nullable(),
  varianceAcceptable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ClosingListItem = z.infer<typeof closingHeaderSchema>
export const closingListSchema = z.array(closingHeaderSchema)

export const closingLineSchema = z.object({
  id: z.string().uuid(),
  closingInventoryId: z.string().uuid(),
  productId: z.string().uuid(),
  expectedQty: z.coerce.number(),
  countedQty: z.coerce.number(),
  variance: z.coerce.number(),
  reasonCode: z.string().nullable(),
})
export type ClosingLine = z.infer<typeof closingLineSchema>
export const closingDetailSchema = closingHeaderSchema.extend({
  lines: z.array(closingLineSchema),
})
export type ClosingDetail = z.infer<typeof closingDetailSchema>

export const recordClosingResultSchema = z.object({ closingId: z.string().uuid(), ciTrn: z.string() })
export const closingWarningsMetaSchema = z.object({ warnings: z.array(z.string()) })
export const closingStatusResultSchema = z.object({ status: z.string() })
export const markVarianceOkResultSchema = z.object({ varianceAcceptable: z.boolean() })

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
