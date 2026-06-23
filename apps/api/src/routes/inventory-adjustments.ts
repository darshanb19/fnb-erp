/**
 * inventory-adjustments router — Epic 4 W4 (spec §4.3).
 *
 * Routes:
 *   POST /inventory-adjustments               → recordAdjustment → { data: { adjustmentId, adjTrn, status } }
 *   POST /inventory-adjustments/:id/confirm   → confirmAdjustment → { data: { status } }
 *   POST /inventory-adjustments/:id/cancel    → cancelAdjustment → { data: { status } }
 *   GET  /inventory-adjustments               → list (brand-scoped, paged)
 *   GET  /inventory-adjustments/:id           → get one with lines
 *
 * Auth contract: req.db required (returns 401 if absent).
 * Validation: zod; toValidationError on ZodError.
 * Success envelope: { data } or { data, meta: { approvalRequestId } }.
 *
 * Error routing:
 *   - AdjustmentLifecycleError → 422 (via AppError httpStatus)
 *   - Other AppErrors → their own httpStatus
 *   - ZodError → 400 via toValidationError
 *
 * FR37: reasonCode mandatory on every adjustment line (enforced in service).
 * FR114: implausibility warn if negative delta exceeds on-hand (enforced in service).
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { inventoryService } from '../services/inventory.service.js';
import { inventoryAdjustments, adjustmentLines } from '../db/schema/inventory.js';
import { toValidationError } from '../lib/zod-error.js';

export const inventoryAdjustmentsRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const adjLineInputSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().refine((v) => v !== 0, { message: 'delta must be non-zero' }),
  reasonCode: z.string().min(1),   // FR37: mandatory
  currentOnHand: z.number().nonnegative().optional(),
  costPerUnit: z.number().nonnegative().optional(),
});

const recordAdjSchema = z.object({
  departmentId: z.string().uuid(),
  locationCode: z.string().min(1).max(20),
  requestedByUserId: z.string().uuid().optional().nullable(),
  requestedAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(adjLineInputSchema).min(1),
});

const listAdjSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'pending_approval', 'confirmed', 'cancelled']).optional(),
});

// ---------------------------------------------------------------------------
// POST /inventory-adjustments — record a new draft adjustment
// ---------------------------------------------------------------------------

inventoryAdjustmentsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const body = recordAdjSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(toValidationError(body.error));
      return;
    }

    const result = await inventoryService.recordAdjustment(req.db, {
      departmentId: body.data.departmentId,
      locationCode: body.data.locationCode,
      requestedByUserId: body.data.requestedByUserId ?? null,
      requestedAt: body.data.requestedAt ? new Date(body.data.requestedAt) : undefined,
      notes: body.data.notes ?? undefined,
      lines: body.data.lines.map((l) => ({
        productId: l.productId,
        delta: l.delta,
        reasonCode: l.reasonCode,
        currentOnHand: l.currentOnHand,
        costPerUnit: l.costPerUnit,
      })),
    });

    const responseData: Record<string, unknown> = {
      adjustmentId: result.adjustmentId,
      adjTrn: result.adjTrn,
      status: result.status,
    };

    const meta: Record<string, unknown> = {};
    if (result.approvalRequestId) {
      meta.approvalRequestId = result.approvalRequestId;
    }

    if (Object.keys(meta).length > 0) {
      res.status(201).json({ data: responseData, meta });
    } else {
      res.status(201).json({ data: responseData });
    }
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /inventory-adjustments/:id/confirm — confirm an adjustment (apply stock)
// ---------------------------------------------------------------------------

inventoryAdjustmentsRouter.post('/:id/confirm', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const adjId = req.params['id'];
    if (!adjId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Adjustment id is required' });
      return;
    }

    const actorUserId = req.user?.id ?? null;

    await inventoryService.confirmAdjustment(req.db, adjId, {
      confirmedBy: actorUserId,
    });

    res.status(200).json({ data: { status: 'confirmed' } });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /inventory-adjustments/:id/cancel — cancel a draft/pending adjustment
// ---------------------------------------------------------------------------

inventoryAdjustmentsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const adjId = req.params['id'];
    if (!adjId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Adjustment id is required' });
      return;
    }

    const actorUserId = req.user?.id ?? null;

    await inventoryService.cancelAdjustment(req.db, adjId, {
      cancelledBy: actorUserId,
    });

    res.status(200).json({ data: { status: 'cancelled' } });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /inventory-adjustments — list adjustments (paged, brand-scoped)
// ---------------------------------------------------------------------------

inventoryAdjustmentsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = listAdjSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const { limit, offset, status } = query.data;

    let rows;
    if (status) {
      rows = await req.db.scopedFrom(
        inventoryAdjustments,
        eq(inventoryAdjustments.status, status),
      ) as unknown as typeof inventoryAdjustments.$inferSelect[];
    } else {
      rows = await req.db.scopedFrom(inventoryAdjustments) as unknown as typeof inventoryAdjustments.$inferSelect[];
    }

    // Manual pagination (scopedFrom doesn't support limit/offset directly)
    const paged = rows.slice(offset, offset + limit);

    res.status(200).json({
      data: paged,
      meta: { total: rows.length, limit, offset },
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /inventory-adjustments/:id — get one adjustment with lines
// ---------------------------------------------------------------------------

inventoryAdjustmentsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const adjId = req.params['id'];
    if (!adjId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Adjustment id is required' });
      return;
    }

    const [adjRows, lineRows] = await Promise.all([
      req.db.scopedFrom(
        inventoryAdjustments,
        eq(inventoryAdjustments.id, adjId),
      ) as unknown as typeof inventoryAdjustments.$inferSelect[],
      req.db.scopedFrom(
        adjustmentLines,
        eq(adjustmentLines.inventoryAdjustmentId, adjId),
      ) as unknown as typeof adjustmentLines.$inferSelect[],
    ]);

    const adj = adjRows[0];
    if (!adj) {
      res.status(404).json({ code: 'not_found.adjustment', message: `Adjustment ${adjId} not found` });
      return;
    }

    res.status(200).json({ data: { ...adj, lines: lineRows } });
  } catch (e) {
    next(e);
  }
});
