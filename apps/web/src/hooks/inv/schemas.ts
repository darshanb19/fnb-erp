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
