/**
 * goods-receipts router — Epic 4 W2 (spec §6).
 *
 * Routes:
 *   POST /goods-receipts               → recordGoodsReceipt → { data: { goodsReceiptId, grTrn }, meta: { warnings } }
 *   POST /goods-receipts/:id/confirm   → confirmGoodsReceipt → { data: { status } }
 *   POST /goods-receipts/:id/reject    → rejectGoodsReceipt → { data: { status } }
 *   GET  /goods-receipts               → list (brand-scoped, paged)
 *   GET  /goods-receipts/:id           → get one with lines
 *
 * Auth contract: req.db required (returns 401 if absent).
 * Validation: zod; toValidationError on ZodError.
 * Success envelope: { data } or { data, meta: { warnings } }.
 * Warn-and-log pattern: warnings[] ride in meta.warnings per spec §1.
 *
 * Error routing:
 *   - GoodsReceiptLifecycleError → 422 (via AppError httpStatus; not 409 by design — see errors/business-rule-error.ts)
 *   - Other AppErrors → their own httpStatus
 *   - ZodError → 400 via toValidationError
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { inventoryService } from '../services/inventory.service.js';
import { goodsReceipts, grLines } from '../db/schema/inventory.js';
import { toValidationError } from '../lib/zod-error.js';

export const goodsReceiptsRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const grLineInputSchema = z.object({
  productId: z.string().uuid(),
  receivedQty: z.number().positive(),
  yieldFactor: z.number().positive().optional(),
  unitCost: z.number().nonnegative().optional(),
  uomId: z.string().uuid(),
  batchNumber: z.string().min(1).optional(),
  expiryDate: z.string().datetime({ offset: true }).optional().nullable(),
  /**
   * FR114 seam — orderedQty from the PO line that prompted this receipt.
   * When provided: warns if receivedQty > 1.5 × orderedQty (Epic 4 W2 C2 fix).
   * Absent: no FR114 check (PO integration is Epic 5).
   */
  orderedQty: z.number().positive().optional(),
});

const recordGrSchema = z.object({
  destinationDepartmentId: z.string().uuid(),
  locationCode: z.string().min(1).max(20),
  poId: z.string().uuid().optional().nullable(),
  transferId: z.string().uuid().optional().nullable(),
  receivedAt: z.string().datetime({ offset: true }).optional().nullable(),
  lines: z.array(grLineInputSchema).min(1),
});

const confirmGrSchema = z.object({
  reasonCode: z.string().min(1).optional(),
});

const rejectGrSchema = z.object({
  reasons: z.array(z.string().min(1)).min(1),
  evidence: z.string().min(1).optional().nullable(),
});

const listGrSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'confirmed', 'pending_approval', 'rejected']).optional(),
});

// ---------------------------------------------------------------------------
// POST /goods-receipts — record a new draft GR
// ---------------------------------------------------------------------------

goodsReceiptsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const input = recordGrSchema.parse(req.body);

    const result = await inventoryService.recordGoodsReceipt(req.db, {
      destinationDepartmentId: input.destinationDepartmentId,
      locationCode: input.locationCode,
      poId: input.poId ?? null,
      transferId: input.transferId ?? null,
      receivedByUserId: req.user?.id ?? null,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
      lines: input.lines.map((l) => ({
        productId: l.productId,
        receivedQty: l.receivedQty,
        yieldFactor: l.yieldFactor,
        unitCost: l.unitCost,
        uomId: l.uomId,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
        orderedQty: l.orderedQty,  // FR114 seam: passes through when caller provides it
      })),
    });

    const responseBody: { data: { goodsReceiptId: string; grTrn: string }; meta?: { warnings: string[] } } = {
      data: {
        goodsReceiptId: result.goodsReceiptId,
        grTrn: result.grTrn,
      },
    };

    if (result.warnings.length > 0) {
      responseBody.meta = { warnings: result.warnings };
    }

    res.status(201).json(responseBody);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /goods-receipts/:id/confirm — confirm a draft GR
// ---------------------------------------------------------------------------

goodsReceiptsRouter.post('/:id/confirm', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const grId = req.params['id'];
    if (!grId) {
      res.status(400).json({ error: 'Missing GR id' });
      return;
    }

    const { reasonCode } = confirmGrSchema.parse(req.body);

    // requiresReasonCode is now enforced server-side via warningCount on the GR row (I1).
    // The route passes through the reasonCode if provided; the service decides whether it is required.
    const result = await inventoryService.confirmGoodsReceipt(req.db, grId, {
      confirmedBy: req.user?.id ?? null,
      reasonCode,
    });

    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /goods-receipts/:id/reject — reject a draft GR
// ---------------------------------------------------------------------------

goodsReceiptsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const grId = req.params['id'];
    if (!grId) {
      res.status(400).json({ error: 'Missing GR id' });
      return;
    }

    const { reasons, evidence } = rejectGrSchema.parse(req.body);

    const result = await inventoryService.rejectGoodsReceipt(
      req.db,
      grId,
      reasons,
      evidence ?? null,
      req.user?.id ?? null,
    );

    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /goods-receipts — list (brand-scoped, paged)
// ---------------------------------------------------------------------------

goodsReceiptsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const { limit, offset, status } = listGrSchema.parse(req.query);

    // I3: use ORM (scopedFrom) so brand-scoping + camelCase mapping come from Drizzle.
    const statusCondition = status !== undefined ? eq(goodsReceipts.status, status) : undefined;
    const rows = await req.db
      .scopedFrom(goodsReceipts, statusCondition)
      .orderBy(desc(goodsReceipts.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /goods-receipts/:id — get one GR with its lines
// ---------------------------------------------------------------------------

goodsReceiptsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const grId = req.params['id'];
    if (!grId) {
      res.status(400).json({ error: 'Missing GR id' });
      return;
    }

    const grRows = await req.db.scopedFrom(
      goodsReceipts,
      eq(goodsReceipts.id, grId),
    );

    if (!grRows[0]) {
      res.status(404).json({ error: 'Goods receipt not found' });
      return;
    }

    const lineRows = await req.db.scopedFrom(
      grLines,
      eq(grLines.goodsReceiptId, grId),
    );

    res.json({ data: { ...grRows[0], lines: lineRows } });
  } catch (e) {
    next(e);
  }
});
