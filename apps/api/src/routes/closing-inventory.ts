/**
 * closing-inventory router — Epic 4 W4 (spec §4.3).
 *
 * Routes:
 *   POST /closing-inventory                        → recordClosingInventory → { data: { closingId, ciTrn }, meta: { warnings } }
 *   POST /closing-inventory/:id/confirm            → confirmClosing → { data: { status } }
 *   POST /closing-inventory/:id/mark-variance-ok   → markVarianceAcceptable → { data: { varianceAcceptable } }
 *   GET  /closing-inventory                        → list (brand-scoped, paged)
 *   GET  /closing-inventory/:id                    → get one with lines
 *   GET  /closing-inventory/summary                → getClosingInventorySummary
 *   GET  /closing-inventory/cut-off-compliance     → checkCutOffCompliance
 *
 * Auth contract: req.db required (returns 401 if absent).
 * FR114: implausibility warn in meta.warnings per spec §1.
 * FR36: cut-off compliance check via GET /closing-inventory/cut-off-compliance.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { inventoryService } from '../services/inventory.service.js';
import { closingInventory, closingInventoryLines } from '../db/schema/inventory.js';
import { toValidationError } from '../lib/zod-error.js';

export const closingInventoryRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const closingLineInputSchema = z.object({
  itemId: z.string().uuid(),
  countedQty: z.number().nonnegative(),
  reasonCode: z.string().min(1).optional(),
  notes: z.string().max(500).optional().nullable(),
});

const recordClosingSchema = z.object({
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'businessDate must be YYYY-MM-DD'),
  locationCode: z.string().min(1).max(20),
  actorUserId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(closingLineInputSchema).min(1),
});

const listClosingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'confirmed', 'variance_flagged']).optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const summarySchema = z.object({
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'businessDate must be YYYY-MM-DD'),
});

const complianceSchema = z.object({
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'businessDate must be YYYY-MM-DD'),
});

// ---------------------------------------------------------------------------
// GET /closing-inventory/summary — summary for a business date
// Must be registered BEFORE /:id to avoid route collision
// ---------------------------------------------------------------------------

closingInventoryRouter.get('/summary', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = summarySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const summary = await inventoryService.getClosingInventorySummary(
      req.db,
      { locationId: query.data.locationId, departmentId: query.data.departmentId },
      query.data.businessDate,
    );

    res.status(200).json({ data: summary });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /closing-inventory/cut-off-compliance — FR36 compliance check
// Must be registered BEFORE /:id to avoid route collision
// ---------------------------------------------------------------------------

closingInventoryRouter.get('/cut-off-compliance', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = complianceSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const result = await inventoryService.checkCutOffCompliance(
      req.db,
      { locationId: query.data.locationId, departmentId: query.data.departmentId },
      query.data.businessDate,
    );

    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /closing-inventory — record a new closing inventory document
// ---------------------------------------------------------------------------

closingInventoryRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const body = recordClosingSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(toValidationError(body.error));
      return;
    }

    const result = await inventoryService.recordClosingInventory(req.db, {
      locationId: body.data.locationId,
      departmentId: body.data.departmentId,
      businessDate: body.data.businessDate,
      locationCode: body.data.locationCode,
      actorUserId: body.data.actorUserId ?? null,
      notes: body.data.notes ?? undefined,
      lines: body.data.lines.map((l) => ({
        itemId: l.itemId,
        countedQty: l.countedQty,
        reasonCode: l.reasonCode,
        notes: l.notes ?? undefined,
      })),
    });

    const responseData: Record<string, unknown> = {
      closingId: result.closingId,
      ciTrn: result.ciTrn,
    };

    if (result.warnings.length > 0) {
      res.status(201).json({ data: responseData, meta: { warnings: result.warnings } });
    } else {
      res.status(201).json({ data: responseData });
    }
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /closing-inventory/:id/confirm — confirm, write variance movements
// ---------------------------------------------------------------------------

closingInventoryRouter.post('/:id/confirm', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const ciId = req.params['id'];
    if (!ciId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Closing inventory id is required' });
      return;
    }

    const actorUserId = req.user?.id ?? null;

    await inventoryService.confirmClosing(req.db, ciId, actorUserId);

    res.status(200).json({ data: { status: 'confirmed_or_variance_flagged' } });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /closing-inventory/:id/mark-variance-ok — accept the flagged variance
// ---------------------------------------------------------------------------

closingInventoryRouter.post('/:id/mark-variance-ok', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const ciId = req.params['id'];
    if (!ciId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Closing inventory id is required' });
      return;
    }

    const actorUserId = req.user?.id ?? null;

    await inventoryService.markVarianceAcceptable(req.db, ciId, actorUserId);

    res.status(200).json({ data: { varianceAcceptable: true } });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /closing-inventory — list (paged, brand-scoped)
// ---------------------------------------------------------------------------

closingInventoryRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = listClosingSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const { limit, offset, status } = query.data;

    let rows;
    if (status) {
      rows = await req.db.scopedFrom(
        closingInventory,
        eq(closingInventory.status, status),
      ) as unknown as typeof closingInventory.$inferSelect[];
    } else {
      rows = await req.db.scopedFrom(closingInventory) as unknown as typeof closingInventory.$inferSelect[];
    }

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
// GET /closing-inventory/:id — get one document with lines
// ---------------------------------------------------------------------------

closingInventoryRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const ciId = req.params['id'];
    if (!ciId) {
      res.status(400).json({ code: 'validation.id_required', message: 'Closing inventory id is required' });
      return;
    }

    const [ciRows, lineRows] = await Promise.all([
      req.db.scopedFrom(
        closingInventory,
        eq(closingInventory.id, ciId),
      ) as unknown as typeof closingInventory.$inferSelect[],
      req.db.scopedFrom(
        closingInventoryLines,
        eq(closingInventoryLines.closingInventoryId, ciId),
      ) as unknown as typeof closingInventoryLines.$inferSelect[],
    ]);

    const ci = ciRows[0];
    if (!ci) {
      res.status(404).json({ code: 'not_found.closing_inventory', message: `Closing inventory ${ciId} not found` });
      return;
    }

    res.status(200).json({ data: { ...ci, lines: lineRows } });
  } catch (e) {
    next(e);
  }
});
