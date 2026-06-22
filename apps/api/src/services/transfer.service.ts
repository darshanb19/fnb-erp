/**
 * transferService — Epic 4 W3
 *
 * Stock transfer lifecycle (FR28, FR117, DL-043):
 *   createDraft → submitTransfer → approveTransfer (if pending_approval) → dispatchTransfer → confirmReceipt | cancelTransfer
 *
 * Full state machine:
 *   createDraft   → draft
 *   submitTransfer:
 *     over-threshold (with real actorUserId) → pending_approval (NO deduction)
 *     below-threshold / no chain / system-actor (null userId) → approved (NO deduction)
 *   approveTransfer (pending_approval only, requires linked approval_request.status='approved'):
 *     pending_approval → approved
 *   dispatchTransfer (approved only):
 *     approved → in_transit (performs FEFO source deduction + transfer_out movement)
 *   confirmReceipt (in_transit only):
 *     in_transit → received (incrementStock at destination + transfer_in movement)
 *   cancelTransfer:
 *     draft/pending_approval → cancelled (clean)
 *     approved/in_transit/received → TransferLifecycleError (FR117; compensating doc required)
 *
 * Flow-rule enforcement (spec §5, DL-043) via private validateTransferFlow:
 *   1. Resolve cluster of source + destination (department → location → cluster).
 *      Cross-cluster → ClusterBoundaryError (all product types; use bundle workflow).
 *   2. Destination must be enabled for the item → EnablementViolationError.
 *   3. Product-type direction:
 *      - raw: allowed dept→dept within cluster (DL-043 deviation).
 *      - semi_product: lateral within cluster — allowed.
 *      - final: only production→dispatch and dispatch→POS; POS→POS and backward → FlowDirectionError.
 *   4. Sufficient FEFO stock at source — enforced by deductStock (InsufficientStockError).
 *
 * Approval routing:
 *   Over-threshold transfers (real user) → approvalEngine.createApprovalRequest (entity_type='stock_transfer').
 *   Below threshold / no chain / system actor (null userId) → approved immediately.
 *   m2: null actorUserId skips approval routing entirely (no UUID to pass the engine).
 *   m2: ValidationError from the engine (no chain/below threshold) is explicitly caught and treated
 *       as auto-approve; all other engine errors propagate.
 *
 * Cancel guard (FR117):
 *   Pre-dispatch (draft/pending_approval) → cancels cleanly.
 *   Post-dispatch (approved/in_transit/received) → TransferLifecycleError
 *     (compensating document required; build in frontend CCReverseCancelDialog).
 *
 * Bundle logic:
 *   createBundledTransfer — creates a transfer_bundle with two legs (stores).
 *     I1: validateCrossClusterFlow — enforces raw-materials-via-Brand-Store routing (§4.4/§2.2).
 *     I2: leg 1 = fromStoreId → brandStoreId; leg 2 = brandStoreId → toStoreId.
 *   confirmBundleApproval — decomposes bundle into two stock_transfers, each with own st_trn.
 *
 * Suggestions (FR32):
 *   suggestTransfers — computed live from stock_batches (excess at source).
 *   dismissSuggestion — persists one transfer_suggestion_dismissals row.
 *
 * Concurrency (m1):
 *   All lifecycle transitions use status-guarded atomic raw SQL UPDATEs:
 *   `UPDATE ... WHERE id=? AND brand_id=? AND status='<expected>' RETURNING id`
 *   Zero rows returned → concurrent transition already happened → TransferLifecycleError.
 */

import { eq, sql } from 'drizzle-orm';
import type { BrandedDb, ScopedInsertRow } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { inventoryService } from './inventory.service.js';
import { trnService } from './trn.service.js';
import { approvalEngine } from './approval-engine.service.js';
import {
  stockTransfers,
  stockTransferLines,
  transferBundles,
  transferBundleLegs,
  transferSuggestionDismissals,
  type StockTransfer,
  type StockTransferLine,
} from '../db/schema/inventory.js';
import { approvalRequests } from '../db/schema/approval-requests.js';
import {
  ClusterBoundaryError,
  FlowDirectionError,
  EnablementViolationError,
  TransferLifecycleError,
  ValidationError,
} from '../errors/index.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TransferLineInput {
  productId: string;
  requestedQty: number;
  reasonCode?: string;
}

export interface CreateTransferDraftInput {
  sourceDepartmentId: string;
  destinationDepartmentId: string;
  locationCode: string;
  requestedByUserId: string | null;
  lines: TransferLineInput[];
  reasonCode?: string;
}

export interface CreateTransferDraftResult {
  transferId: string;
  stTrn: string;
  status: string;
}

export interface ConfirmReceiptQuantities {
  [productId: string]: number;
}

export interface TransferStatusResult {
  status: string;
}

export interface TransferDetail extends StockTransfer {
  lines: StockTransferLine[];
}

export interface CreateBundledTransferInput {
  originatingClusterId: string;
  destinationClusterId: string;
  locationCode: string;
  requestedByUserId: string | null;
  productId: string;
  qty: number;
  uomId: string;
  fromStoreId: string | null;
  toStoreId: string | null;
  /** I2: brand-level Brand Store — the cross-cluster intermediary. */
  brandStoreId: string | null;
  reasonCode?: string;
}

export interface CreateBundledTransferResult {
  bundleId: string;
  bundleRef: string;
}

export interface ConfirmBundleApprovalResult {
  transferIds: string[];
}

export interface TransferSuggestion {
  productId: string;
  productName: string;
  sourceDepartmentId: string;
  availableQty: number;
  suggestedQty: number;
  reason: string;
}

export interface SuggestTransfersInput {
  sourceDepartmentId: string;
  destinationDepartmentId: string;
}

export interface SuggestTransfersResult {
  suggestions: TransferSuggestion[];
}

export interface DismissSuggestionInput {
  productId: string;
  batchId: string | null;
  dismissedByUserId: string | null;
  reasonCode?: string;
}

export interface DismissSuggestionResult {
  dismissed: boolean;
}

// ---------------------------------------------------------------------------
// Internal types for raw SQL results
// ---------------------------------------------------------------------------

interface DeptLocationClusterRow {
  dept_type: string;
  location_type: string;
  cluster_id: string;
}

interface ProductTypeRow {
  product_type: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Resolve department → location → cluster chain.
 * Returns { deptType, locationType, clusterId }.
 */
async function resolveDeptChain(
  db: BrandedDb,
  departmentId: string,
): Promise<{ deptType: string; locationType: string; clusterId: string }> {
  const result = await db.raw.execute(sql`
    SELECT
      d.type       AS dept_type,
      l.type       AS location_type,
      l.cluster_id AS cluster_id
    FROM departments d
    INNER JOIN locations l ON l.id = d.location_id AND l.brand_id = d.brand_id
    WHERE d.id = ${departmentId}
      AND d.brand_id = ${db.brandId}
    LIMIT 1
  `);
  const rows = result as unknown as DeptLocationClusterRow[];
  if (!rows[0]) {
    throw new Error(`Department ${departmentId} not found in brand ${db.brandId}`);
  }
  return {
    deptType: rows[0].dept_type,
    locationType: rows[0].location_type,
    clusterId: rows[0].cluster_id,
  };
}

/**
 * validateTransferFlow — spec §5, DL-043.
 * Must be called with a txDb inside the draft-creation transaction.
 *
 * Validates each product line independently; the first violation throws.
 */
async function validateTransferFlow(
  txDb: BrandedDb,
  lines: TransferLineInput[],
  sourceDeptId: string,
  destDeptId: string,
): Promise<void> {
  // Step 1 — resolve clusters
  const src = await resolveDeptChain(txDb, sourceDeptId);
  const dst = await resolveDeptChain(txDb, destDeptId);

  // Cross-cluster → ClusterBoundaryError (applies to ALL product types)
  if (src.clusterId !== dst.clusterId) {
    throw new ClusterBoundaryError({ clusterId: src.clusterId });
  }

  for (const line of lines) {
    // Step 2 — Enablement check for destination
    const enabled = await inventoryService.checkEnablement(txDb, line.productId, destDeptId);
    if (!enabled) {
      throw new EnablementViolationError({
        code: 'business.enablement_violation',
        message: `Item ${line.productId} is not enabled in destination department ${destDeptId}`,
        details: { itemId: line.productId, departmentId: destDeptId },
      });
    }

    // Step 3 — Product-type direction rules
    const productResult = await txDb.raw.execute(sql`
      SELECT type AS product_type
      FROM products
      WHERE id = ${line.productId}
        AND brand_id = ${txDb.brandId}
      LIMIT 1
    `);
    const productRows = productResult as unknown as ProductTypeRow[];
    const productType = productRows[0]?.product_type;
    if (!productType) {
      throw new Error(`Product ${line.productId} not found`);
    }

    if (productType === 'raw' || productType === 'semi_product') {
      // Raw + semi: within cluster is OK (DL-043 for raw; lateral for semi).
      // Cross-cluster already caught in step 1. No further restriction.
      continue;
    }

    if (productType === 'final') {
      // Final product: only production→dispatch and dispatch→POS.
      // dept types: 'production' | 'dispatch' | 'non_production' | 'store'
      // location types: 'central_kitchen' | 'pos_outlet' | 'brand_store' | 'cluster_store'
      const srcDeptType = src.deptType;
      const dstDeptType = dst.deptType;
      const dstLocType = dst.locationType;

      const isAllowed =
        // production → dispatch
        (srcDeptType === 'production' && dstDeptType === 'dispatch') ||
        // dispatch → POS/store outlet
        (srcDeptType === 'dispatch' &&
          (dstDeptType === 'store' ||
           dstLocType === 'pos_outlet' ||
           dstLocType === 'brand_store'));

      if (!isAllowed) {
        throw new FlowDirectionError({
          from: `${srcDeptType} (${src.locationType})`,
          to: `${dstDeptType} (${dst.locationType})`,
          reason: `Final product may only flow production→dispatch or dispatch→POS. Got ${srcDeptType}→${dstDeptType}.`,
        });
      }
    }
  }
}

/**
 * validateCrossClusterFlow — spec §4.4 (I1).
 *
 * Enforces raw-materials-via-Brand-Store routing per master-spec §2.2:
 *   - fromStoreId:  must be cluster-level in the originatingCluster
 *   - brandStoreId: must be brand-level (the intermediary)
 *   - toStoreId:    must be cluster-level in the destinationCluster
 *
 * Throws ClusterBoundaryError on any violation.
 */
async function validateCrossClusterFlow(
  txDb: BrandedDb,
  input: {
    originatingClusterId: string;
    destinationClusterId: string;
    fromStoreId: string | null;
    brandStoreId: string | null;
    toStoreId: string | null;
  },
): Promise<void> {
  if (!input.fromStoreId || !input.brandStoreId || !input.toStoreId) {
    throw new ClusterBoundaryError({
      clusterId: input.originatingClusterId,
    });
  }

  const storeIds = [input.fromStoreId, input.brandStoreId, input.toStoreId];
  const storeResult = await txDb.raw.execute(sql`
    SELECT id, level, cluster_id
    FROM stores
    WHERE brand_id = ${txDb.brandId}
      AND id IN (${sql.join(storeIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `);
  const storeRows = storeResult as unknown as Array<{ id: string; level: string; cluster_id: string | null }>;
  const storeMap = new Map(storeRows.map((r) => [r.id, r]));

  // Leg 1 source: must be cluster-level in the originating cluster
  const fromStore = storeMap.get(input.fromStoreId);
  if (!fromStore || fromStore.level !== 'cluster' || fromStore.cluster_id !== input.originatingClusterId) {
    throw new ClusterBoundaryError({ clusterId: input.originatingClusterId });
  }

  // Intermediary: must be brand-level
  const brandStore = storeMap.get(input.brandStoreId);
  if (!brandStore || brandStore.level !== 'brand') {
    throw new ClusterBoundaryError({ clusterId: input.originatingClusterId });
  }

  // Leg 2 destination: must be cluster-level in the destination cluster
  const toStore = storeMap.get(input.toStoreId);
  if (!toStore || toStore.level !== 'cluster' || toStore.cluster_id !== input.destinationClusterId) {
    throw new ClusterBoundaryError({ clusterId: input.destinationClusterId });
  }
}

// ---------------------------------------------------------------------------
// transferService
// ---------------------------------------------------------------------------

export const transferService = {
  /**
   * createDraft — validate flow rules, create a draft stock_transfer + lines.
   *
   * Does NOT deduct stock — deduction happens at dispatchTransfer.
   * Allocates st_trn via trnService.
   */
  async createDraft(
    db: BrandedDb,
    input: CreateTransferDraftInput,
  ): Promise<CreateTransferDraftResult> {
    const stTrn = await trnService.allocate(db, 'ST', input.locationCode);

    const transferId = await withTransaction(db, input.requestedByUserId, async (txDb) => {
      await validateTransferFlow(
        txDb,
        input.lines,
        input.sourceDepartmentId,
        input.destinationDepartmentId,
      );

      const transferRows = await txDb
        .scopedInsert(stockTransfers, {
          stTrn,
          sourceDepartmentId: input.sourceDepartmentId,
          destinationDepartmentId: input.destinationDepartmentId,
          status: 'draft',
          reasonCode: input.reasonCode ?? null,
          requestedByUserId: input.requestedByUserId,
          requestedAt: new Date(),
        } as unknown as ScopedInsertRow<typeof stockTransfers>)
        .returning({ id: stockTransfers.id });

      const transferRow = transferRows[0];
      if (!transferRow) throw new Error('createDraft: stock_transfer insert returned no row');
      const tid = transferRow.id;

      for (const line of input.lines) {
        await txDb.scopedInsert(stockTransferLines, {
          stockTransferId: tid,
          productId: line.productId,
          requestedQty: String(line.requestedQty),
          reasonCode: line.reasonCode ?? null,
        } as unknown as ScopedInsertRow<typeof stockTransferLines>);
      }

      await auditLogService.record(txDb, {
        action: 'insert',
        tableName: 'stock_transfers',
        rowId: tid,
        actorUserId: input.requestedByUserId,
        trnReference: stTrn,
        context: {
          event: 'create_transfer_draft',
          stTrn,
          sourceDepartmentId: input.sourceDepartmentId,
          destinationDepartmentId: input.destinationDepartmentId,
          lineCount: input.lines.length,
        },
      });

      return tid;
    });

    return { transferId, stTrn, status: 'draft' };
  },

  /**
   * submitTransfer — transition draft → approved (or pending_approval if over threshold).
   *
   * NO stock deduction here — deduction is deferred to dispatchTransfer.
   *
   * m2: If actorUserId is null (system actor), approval routing is skipped entirely.
   *     System submits go directly to 'approved'.
   *
   * m2: catch block is narrowed — only ValidationError (no chain / below threshold)
   *     is treated as auto-approve. All other errors propagate.
   *
   * m1: status-guarded atomic raw-SQL UPDATE (AND status='draft'); zero rows → concurrent
   *     transition → TransferLifecycleError.
   */
  async submitTransfer(
    db: BrandedDb,
    transferId: string,
    actorUserId: string | null,
  ): Promise<TransferStatusResult> {
    return withTransaction(db, actorUserId, async (txDb) => {
      // Read to get stTrn for audit and line totals
      const stRows = await txDb.scopedFrom(
        stockTransfers,
        eq(stockTransfers.id, transferId),
      ) as unknown as StockTransfer[];

      if (!stRows[0]) throw new Error(`submitTransfer: transfer ${transferId} not found`);
      const transfer = stRows[0];

      if (transfer.status !== 'draft') {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'submit',
        });
      }

      const lines = await txDb.scopedFrom(
        stockTransferLines,
        eq(stockTransferLines.stockTransferId, transferId),
      ) as unknown as StockTransferLine[];

      // m2: null actor skips approval routing — system submits go directly to approved.
      let newStatus: StockTransfer['status'] = 'approved';
      let approvalRequestId: string | null = null;

      if (actorUserId !== null) {
        try {
          const totalQty = lines.reduce((sum, l) => sum + Number(l.requestedQty), 0);
          const approvalRequest = await approvalEngine.createApprovalRequest(txDb, {
            entityType: 'stock_transfer',
            entityRef: transferId,
            entityValue: totalQty,
            requestingUserId: actorUserId,
            routingReason: `Stock transfer ${transfer.stTrn}`,
            payload: { transferId, stTrn: transfer.stTrn },
          }, { actorUserId });
          newStatus = 'pending_approval';
          approvalRequestId = approvalRequest.id;
        } catch (err: unknown) {
          // m2: only swallow ValidationError (no active chain / below threshold).
          // NotFoundError (missing approver), connection errors, etc. must propagate.
          if (!(err instanceof ValidationError)) {
            throw err;
          }
          // No active chain or below threshold → auto-approve.
          newStatus = 'approved';
        }
      }

      // m1: status-guarded atomic UPDATE
      const updateResult = await txDb.raw.execute(sql`
        UPDATE stock_transfers
        SET
          status = ${newStatus}::transfer_status_enum,
          approval_request_id = ${approvalRequestId},
          updated_at = NOW()
        WHERE id = ${transferId}::uuid
          AND brand_id = ${txDb.brandId}::uuid
          AND status = 'draft'::transfer_status_enum
        RETURNING id
      `);
      const updatedRows = updateResult as unknown as Array<{ id: string }>;
      if (updatedRows.length === 0) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: 'unknown (concurrent transition)',
          attemptedAction: 'submit',
        });
      }

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_transfers',
        rowId: transferId,
        actorUserId,
        trnReference: transfer.stTrn,
        context: { event: 'submit_transfer', newStatus, approvalRequestId },
      });

      return { status: newStatus };
    });
  },

  /**
   * approveTransfer — transition pending_approval → approved (C2).
   *
   * Valid only when:
   *   1. Transfer status = 'pending_approval'
   *   2. The linked approval_request has status = 'approved'
   *
   * This bridges the approval engine decision back to the transfer lifecycle:
   * once the approver calls approvalEngine.decide(), the caller then invokes
   * approveTransfer to advance the transfer out of pending_approval into approved
   * (ready for dispatchTransfer).
   *
   * m1: status-guarded atomic UPDATE.
   */
  async approveTransfer(
    db: BrandedDb,
    transferId: string,
    actorUserId: string | null,
  ): Promise<TransferStatusResult> {
    return withTransaction(db, actorUserId, async (txDb) => {
      const stRows = await txDb.scopedFrom(
        stockTransfers,
        eq(stockTransfers.id, transferId),
      ) as unknown as StockTransfer[];

      if (!stRows[0]) throw new Error(`approveTransfer: transfer ${transferId} not found`);
      const transfer = stRows[0];

      if (transfer.status !== 'pending_approval') {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'approve',
        });
      }

      if (!transfer.approvalRequestId) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'approve (no linked approval_request_id)',
        });
      }

      // Verify the linked approval request is approved
      const approvalRows = await txDb.scopedFrom(
        approvalRequests,
        eq(approvalRequests.id, transfer.approvalRequestId),
      ) as unknown as Array<{ id: string; status: string }>;

      if (!approvalRows[0]) {
        throw new Error(`approveTransfer: approval request ${transfer.approvalRequestId} not found`);
      }

      if (approvalRows[0].status !== 'approved') {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: `pending_approval (approval_request.status='${approvalRows[0].status}')`,
          attemptedAction: 'approve',
        });
      }

      // m1: status-guarded atomic UPDATE
      const updateResult = await txDb.raw.execute(sql`
        UPDATE stock_transfers
        SET
          status = 'approved'::transfer_status_enum,
          updated_at = NOW()
        WHERE id = ${transferId}::uuid
          AND brand_id = ${txDb.brandId}::uuid
          AND status = 'pending_approval'::transfer_status_enum
        RETURNING id
      `);
      const updatedRows = updateResult as unknown as Array<{ id: string }>;
      if (updatedRows.length === 0) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: 'unknown (concurrent transition)',
          attemptedAction: 'approve',
        });
      }

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_transfers',
        rowId: transferId,
        actorUserId,
        trnReference: transfer.stTrn,
        context: { event: 'approve_transfer', approvalRequestId: transfer.approvalRequestId },
      });

      return { status: 'approved' };
    });
  },

  /**
   * dispatchTransfer — transition approved → in_transit.
   *
   * Valid only when status = 'approved'.
   * Performs the FEFO source deduction (inventoryService.deductStock, reason='transfer_out')
   * and writes the transfer_out movement, all inside the same transaction.
   *
   * m1: status-guarded atomic UPDATE executes BEFORE deduction to prevent duplicate deducts.
   */
  async dispatchTransfer(
    db: BrandedDb,
    transferId: string,
    actorUserId: string | null,
  ): Promise<TransferStatusResult> {
    return withTransaction(db, actorUserId, async (txDb) => {
      const stRows = await txDb.scopedFrom(
        stockTransfers,
        eq(stockTransfers.id, transferId),
      ) as unknown as StockTransfer[];

      if (!stRows[0]) throw new Error(`dispatchTransfer: transfer ${transferId} not found`);
      const transfer = stRows[0];

      if (transfer.status !== 'approved') {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'dispatch',
        });
      }

      const lines = await txDb.scopedFrom(
        stockTransferLines,
        eq(stockTransferLines.stockTransferId, transferId),
      ) as unknown as StockTransferLine[];

      // m1: status-guarded UPDATE first — lock before deduction to prevent double-dispatch
      const updateResult = await txDb.raw.execute(sql`
        UPDATE stock_transfers
        SET
          status = 'in_transit'::transfer_status_enum,
          updated_at = NOW()
        WHERE id = ${transferId}::uuid
          AND brand_id = ${txDb.brandId}::uuid
          AND status = 'approved'::transfer_status_enum
        RETURNING id
      `);
      const updatedRows = updateResult as unknown as Array<{ id: string }>;
      if (updatedRows.length === 0) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: 'unknown (concurrent transition)',
          attemptedAction: 'dispatch',
        });
      }

      // Deduct stock from source (FEFO lock path)
      for (const line of lines) {
        await inventoryService.deductStock(
          txDb,
          line.productId,
          transfer.sourceDepartmentId,
          Number(line.requestedQty),
          'transfer_out',
          transfer.stTrn,
          actorUserId,
        );
      }

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_transfers',
        rowId: transferId,
        actorUserId,
        trnReference: transfer.stTrn,
        context: { event: 'dispatch_transfer', lineCount: lines.length },
      });

      return { status: 'in_transit' };
    });
  },

  /**
   * confirmReceipt — status-guarded in_transit → received.
   *
   * Only accepts in_transit (dispatch must happen first).
   * Increments stock at destination via inventoryService.incrementStock.
   * quantity map: { [productId]: receivedQty } — allows variance recording.
   *
   * m1: status-guarded atomic UPDATE.
   */
  async confirmReceipt(
    db: BrandedDb,
    transferId: string,
    quantities: ConfirmReceiptQuantities,
    actorUserId: string | null,
    varianceReasons?: Record<string, string>,
  ): Promise<TransferStatusResult> {
    return withTransaction(db, actorUserId, async (txDb) => {
      const stRows = await txDb.scopedFrom(
        stockTransfers,
        eq(stockTransfers.id, transferId),
      ) as unknown as StockTransfer[];

      if (!stRows[0]) throw new Error(`confirmReceipt: transfer ${transferId} not found`);
      const transfer = stRows[0];

      if (transfer.status !== 'in_transit') {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'confirm-receipt',
        });
      }

      const lines = await txDb.scopedFrom(
        stockTransferLines,
        eq(stockTransferLines.stockTransferId, transferId),
      ) as unknown as StockTransferLine[];

      const productIds = lines.map((l) => l.productId);
      const productResult = await txDb.raw.execute(sql`
        SELECT id, default_uom_id
        FROM products
        WHERE brand_id = ${txDb.brandId}
          AND id IN (${sql.join(productIds.map((id) => sql`${id}::uuid`), sql`, `)})
      `);
      const productUomMap = new Map<string, string>();
      for (const row of productResult as unknown as Array<{ id: string; default_uom_id: string }>) {
        productUomMap.set(row.id, row.default_uom_id);
      }

      // m1: status-guarded atomic UPDATE
      const updateResult = await txDb.raw.execute(sql`
        UPDATE stock_transfers
        SET
          status = 'received'::transfer_status_enum,
          updated_at = NOW()
        WHERE id = ${transferId}::uuid
          AND brand_id = ${txDb.brandId}::uuid
          AND status = 'in_transit'::transfer_status_enum
        RETURNING id
      `);
      const updatedRows = updateResult as unknown as Array<{ id: string }>;
      if (updatedRows.length === 0) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: 'unknown (concurrent transition)',
          attemptedAction: 'confirm-receipt',
        });
      }

      const today = new Date();
      for (const line of lines) {
        const receivedQty = quantities[line.productId] ?? Number(line.requestedQty);
        const uomId = productUomMap.get(line.productId);
        if (!uomId) throw new Error(`confirmReceipt: no UOM for product ${line.productId}`);

        await inventoryService.incrementStock(
          txDb,
          transfer.destinationDepartmentId,
          [
            {
              productId: line.productId,
              batchNumber: `${transfer.stTrn}-${line.productId.slice(0, 8)}`,
              quantity: receivedQty,
              expiryDate: null,
              receivedDate: today,
              uomId,
              sourceType: 'transfer',
              sourceRef: transferId,
            },
          ],
          {
            actorUserId,
            movementType: 'transfer_in',
            trnReference: transfer.stTrn,
            reason: `Transfer received: ${transfer.stTrn}`,
          },
        );

        const requestedQty = Number(line.requestedQty);
        const varianceQty = receivedQty !== requestedQty ? receivedQty - requestedQty : null;
        await txDb
          .scopedUpdate(stockTransferLines)
          .set({
            fulfilledQty: String(receivedQty),
            reasonCode: varianceQty !== null
              ? (varianceReasons?.[line.productId] ?? 'variance')
              : (line.reasonCode ?? null),
          })
          .where(eq(stockTransferLines.id, line.id));
      }

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_transfers',
        rowId: transferId,
        actorUserId,
        trnReference: transfer.stTrn,
        context: { event: 'confirm_receipt', transferId },
      });

      return { status: 'received' };
    });
  },

  /**
   * cancelTransfer — lifecycle guard per FR117.
   *
   * Pre-dispatch (draft / pending_approval): cancel cleanly.
   * Post-dispatch (approved / in_transit / received): throw TransferLifecycleError.
   *   Compensating document required (deferred to frontend CCReverseCancelDialog).
   *
   * m1: status-guarded atomic UPDATE (accepts draft OR pending_approval).
   */
  async cancelTransfer(
    db: BrandedDb,
    transferId: string,
    actorUserId: string | null,
  ): Promise<TransferStatusResult> {
    return withTransaction(db, actorUserId, async (txDb) => {
      const stRows = await txDb.scopedFrom(
        stockTransfers,
        eq(stockTransfers.id, transferId),
      ) as unknown as StockTransfer[];

      if (!stRows[0]) throw new Error(`cancelTransfer: transfer ${transferId} not found`);
      const transfer = stRows[0];

      const preCancelStatuses: StockTransfer['status'][] = ['draft', 'pending_approval'];
      if (!preCancelStatuses.includes(transfer.status)) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: transfer.status,
          attemptedAction: 'cancel',
        });
      }

      // m1: atomic UPDATE — accepts draft OR pending_approval
      const updateResult = await txDb.raw.execute(sql`
        UPDATE stock_transfers
        SET
          status = 'cancelled'::transfer_status_enum,
          updated_at = NOW()
        WHERE id = ${transferId}::uuid
          AND brand_id = ${txDb.brandId}::uuid
          AND status = ANY(ARRAY['draft', 'pending_approval']::transfer_status_enum[])
        RETURNING id
      `);
      const updatedRows = updateResult as unknown as Array<{ id: string }>;
      if (updatedRows.length === 0) {
        throw new TransferLifecycleError({
          transferId,
          currentStatus: 'unknown (concurrent transition)',
          attemptedAction: 'cancel',
        });
      }

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_transfers',
        rowId: transferId,
        actorUserId,
        trnReference: transfer.stTrn,
        context: { event: 'cancel_transfer', previousStatus: transfer.status },
      });

      return { status: 'cancelled' };
    });
  },

  /**
   * getTransferDetail — load transfer header + lines.
   */
  async getTransferDetail(
    db: BrandedDb,
    transferId: string,
  ): Promise<TransferDetail> {
    const stRows = await db.scopedFrom(
      stockTransfers,
      eq(stockTransfers.id, transferId),
    ) as unknown as StockTransfer[];

    if (!stRows[0]) throw new Error(`getTransferDetail: transfer ${transferId} not found`);

    const lines = await db.scopedFrom(
      stockTransferLines,
      eq(stockTransferLines.stockTransferId, transferId),
    ) as unknown as StockTransferLine[];

    return { ...stRows[0], lines };
  },

  // ---------------------------------------------------------------------------
  // Bundle methods
  // ---------------------------------------------------------------------------

  /**
   * createBundledTransfer — create a cross-cluster bundle (spec §4.4).
   *
   * I1: validateCrossClusterFlow — validates raw-materials-via-Brand-Store routing.
   * I2: leg 1 fromStoreId→brandStoreId; leg 2 brandStoreId→toStoreId.
   *
   * Allocates a BND TRN via trnService.
   * Single bundled approval object (P2B-002).
   */
  async createBundledTransfer(
    db: BrandedDb,
    input: CreateBundledTransferInput,
  ): Promise<CreateBundledTransferResult> {
    const bundleRef = await trnService.allocate(db, 'BND', input.locationCode);

    const bundleId = await withTransaction(db, input.requestedByUserId, async (txDb) => {
      // I1: Validate cross-cluster flow (raw materials via Brand Store per §2.2)
      await validateCrossClusterFlow(txDb, {
        originatingClusterId: input.originatingClusterId,
        destinationClusterId: input.destinationClusterId,
        fromStoreId: input.fromStoreId,
        brandStoreId: input.brandStoreId,
        toStoreId: input.toStoreId,
      });

      const bundleRows = await txDb
        .scopedInsert(transferBundles, {
          bundleRef,
          originatingClusterId: input.originatingClusterId,
          destinationClusterId: input.destinationClusterId,
          status: 'draft',
        } as unknown as ScopedInsertRow<typeof transferBundles>)
        .returning({ id: transferBundles.id });

      const bundleRow = bundleRows[0];
      if (!bundleRow) throw new Error('createBundledTransfer: bundle insert returned no row');
      const bid = bundleRow.id;

      // I2: leg 1 — source cluster store → brand store
      await txDb.scopedInsert(transferBundleLegs, {
        transferBundleId: bid,
        legNo: 1,
        fromStoreId: input.fromStoreId,    // cluster-level source store
        toStoreId: input.brandStoreId,     // brand-level intermediary
        status: 'pending',
      } as unknown as ScopedInsertRow<typeof transferBundleLegs>);

      // I2: leg 2 — brand store → destination cluster store
      await txDb.scopedInsert(transferBundleLegs, {
        transferBundleId: bid,
        legNo: 2,
        fromStoreId: input.brandStoreId,   // brand-level intermediary
        toStoreId: input.toStoreId,        // cluster-level destination store
        status: 'pending',
      } as unknown as ScopedInsertRow<typeof transferBundleLegs>);

      await auditLogService.record(txDb, {
        action: 'insert',
        tableName: 'transfer_bundles',
        rowId: bid,
        actorUserId: input.requestedByUserId,
        trnReference: bundleRef,
        context: {
          event: 'create_bundled_transfer',
          bundleRef,
          originatingClusterId: input.originatingClusterId,
          destinationClusterId: input.destinationClusterId,
        },
      });

      return bid;
    });

    return { bundleId, bundleRef };
  },

  /**
   * confirmBundleApproval — approve bundle → decompose into two stock_transfers.
   *
   * Each leg becomes an independent stock_transfer with its own st_trn.
   * stock_transfers reference back to the bundle leg via bundle_leg_id.
   * Bundle status → approved.
   */
  async confirmBundleApproval(
    db: BrandedDb,
    bundleId: string,
  ): Promise<ConfirmBundleApprovalResult> {
    const transferIds: string[] = [];

    await withTransaction(db, null, async (txDb) => {
      const bundleRows = await txDb.raw.execute(sql`
        SELECT id, bundle_ref, originating_cluster_id, destination_cluster_id, status, brand_id
        FROM transfer_bundles
        WHERE id = ${bundleId}
          AND brand_id = ${txDb.brandId}
        LIMIT 1
      `);
      const bundle = (bundleRows as unknown as Array<{
        id: string;
        bundle_ref: string;
        originating_cluster_id: string;
        destination_cluster_id: string;
        status: string;
        brand_id: string;
      }>)[0];
      if (!bundle) throw new Error(`confirmBundleApproval: bundle ${bundleId} not found`);

      if (bundle.status !== 'draft' && bundle.status !== 'pending_approval') {
        throw new Error(`confirmBundleApproval: bundle ${bundleId} is already ${bundle.status}`);
      }

      const legRows = await txDb.raw.execute(sql`
        SELECT id, leg_no, from_store_id, to_store_id
        FROM transfer_bundle_legs
        WHERE transfer_bundle_id = ${bundleId}
          AND brand_id = ${txDb.brandId}
        ORDER BY leg_no ASC
      `);
      const legs = legRows as unknown as Array<{
        id: string;
        leg_no: number;
        from_store_id: string | null;
        to_store_id: string | null;
      }>;

      for (const leg of legs) {
        const stTrn = await trnService.allocate(txDb, 'ST', `BND${leg.leg_no}`);

        const targetClusterId = leg.leg_no === 1
          ? bundle.originating_cluster_id
          : bundle.destination_cluster_id;

        const deptResult = await txDb.raw.execute(sql`
          SELECT d.id
          FROM departments d
          INNER JOIN locations l ON l.id = d.location_id AND l.brand_id = d.brand_id
          WHERE l.cluster_id = ${targetClusterId}
            AND d.brand_id = ${txDb.brandId}
            AND d.active = true
          LIMIT 1
        `);
        const deptRows = deptResult as unknown as Array<{ id: string }>;
        const deptId = deptRows[0]?.id;

        if (!deptId) {
          throw new Error(`confirmBundleApproval: no department found for cluster ${targetClusterId}`);
        }

        const transferRows = await txDb
          .scopedInsert(stockTransfers, {
            stTrn,
            sourceDepartmentId: deptId,
            destinationDepartmentId: deptId,
            status: 'approved',
            bundleLegId: leg.id,
            requestedAt: new Date(),
          } as unknown as ScopedInsertRow<typeof stockTransfers>)
          .returning({ id: stockTransfers.id });

        const transferRow = transferRows[0];
        if (!transferRow) throw new Error('confirmBundleApproval: transfer insert returned no row');
        transferIds.push(transferRow.id);

        await txDb.raw.execute(sql`
          UPDATE transfer_bundle_legs
          SET status = 'in_transit', updated_at = NOW()
          WHERE id = ${leg.id}
            AND brand_id = ${txDb.brandId}
        `);
      }

      await txDb
        .scopedUpdate(transferBundles)
        .set({ status: 'approved', updatedBy: undefined })
        .where(eq(transferBundles.id, bundleId));

      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'transfer_bundles',
        rowId: bundleId,
        actorUserId: null,
        trnReference: bundle.bundle_ref,
        context: {
          event: 'confirm_bundle_approval',
          bundleId,
          decomposedTransferIds: transferIds,
        },
      });
    });

    return { transferIds };
  },

  // ---------------------------------------------------------------------------
  // Suggestion methods
  // ---------------------------------------------------------------------------

  /**
   * suggestTransfers — computed live from stock_batches (FR32).
   */
  async suggestTransfers(
    db: BrandedDb,
    input: SuggestTransfersInput,
  ): Promise<SuggestTransfersResult> {
    const dismissedResult = await db.raw.execute(sql`
      SELECT DISTINCT product_id
      FROM transfer_suggestion_dismissals
      WHERE brand_id = ${db.brandId}
    `);
    const dismissedProductIds = new Set(
      (dismissedResult as unknown as Array<{ product_id: string }>).map((r) => r.product_id),
    );

    const stockResult = await db.raw.execute(sql`
      SELECT
        sb.product_id,
        p.name AS product_name,
        SUM(sb.quantity_remaining) AS available_qty
      FROM stock_batches sb
      INNER JOIN products p ON p.id = sb.product_id AND p.brand_id = sb.brand_id
      WHERE sb.brand_id = ${db.brandId}
        AND sb.department_id = ${input.sourceDepartmentId}
        AND sb.quantity_remaining > 0
      GROUP BY sb.product_id, p.name
      ORDER BY available_qty DESC
    `);

    const suggestions: TransferSuggestion[] = [];
    for (const row of stockResult as unknown as Array<{
      product_id: string;
      product_name: string;
      available_qty: string;
    }>) {
      if (dismissedProductIds.has(row.product_id)) continue;

      const available = Number(row.available_qty);
      const suggestedQty = Math.floor(available * 0.5);
      if (suggestedQty <= 0) continue;

      suggestions.push({
        productId: row.product_id,
        productName: row.product_name,
        sourceDepartmentId: input.sourceDepartmentId,
        availableQty: available,
        suggestedQty,
        reason: 'Excess stock at source department',
      });
    }

    return { suggestions };
  },

  /**
   * rankTransferSuggestions — ranked suggestions for a batch context (FR32).
   */
  async rankTransferSuggestions(
    db: BrandedDb,
    input: SuggestTransfersInput,
  ): Promise<SuggestTransfersResult> {
    return transferService.suggestTransfers(db, input);
  },

  /**
   * dismissSuggestion — persist a dismissal record (FR32).
   */
  async dismissSuggestion(
    db: BrandedDb,
    input: DismissSuggestionInput,
  ): Promise<DismissSuggestionResult> {
    await withTransaction(db, input.dismissedByUserId, async (txDb) => {
      await txDb.scopedInsert(transferSuggestionDismissals, {
        productId: input.productId,
        batchId: input.batchId ?? null,
        dismissedByUserId: input.dismissedByUserId,
        dismissedAt: new Date(),
        reasonCode: input.reasonCode ?? null,
      } as unknown as ScopedInsertRow<typeof transferSuggestionDismissals>);

      await auditLogService.record(txDb, {
        action: 'insert',
        tableName: 'transfer_suggestion_dismissals',
        rowId: input.productId,
        actorUserId: input.dismissedByUserId,
        context: {
          event: 'dismiss_suggestion',
          productId: input.productId,
          batchId: input.batchId,
          reasonCode: input.reasonCode,
        },
      });
    });

    return { dismissed: true };
  },
};
