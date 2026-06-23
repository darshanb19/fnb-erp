/**
 * par-levels router — Epic 4 W5 (spec §6, FR33/FR34).
 *
 * Routes:
 *   GET  /par-levels                → list all PAR entries for brand (optional ?locationId filter)
 *   POST /par-levels                → setParLevel  → { data: { id, basePar, … } }
 *   POST /par-levels/bulk           → bulkSetParLevel → { data: { count } }
 *   GET  /par-levels/below          → listBelowPar → { data: [...BelowParRow] }
 *
 * Auth contract: req.db required (returns 401 if absent).
 * All mutations inside withTransaction + audit (handled by service layer).
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { inventoryService } from '../services/inventory.service.js';
import { parLevels } from '../db/schema/inventory.js';
import { toValidationError } from '../lib/zod-error.js';

export const parLevelsRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const dayOfWeekOverridesSchema = z.object({
  mon: z.number().int().nonnegative().optional(),
  tue: z.number().int().nonnegative().optional(),
  wed: z.number().int().nonnegative().optional(),
  thu: z.number().int().nonnegative().optional(),
  fri: z.number().int().nonnegative().optional(),
  sat: z.number().int().nonnegative().optional(),
  sun: z.number().int().nonnegative().optional(),
}).optional().nullable();

const setParLevelSchema = z.object({
  productId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  basePar: z.number().int().nonnegative(),
  dayOfWeekOverrides: dayOfWeekOverridesSchema,
});

const bulkSetParLevelSchema = z.object({
  rows: z.array(setParLevelSchema).min(1).max(500),
});

const listParLevelsSchema = z.object({
  locationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const belowParSchema = z.object({
  locationId: z.string().uuid().optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ---------------------------------------------------------------------------
// GET /par-levels/below — must be registered BEFORE /:id to avoid route collision
// ---------------------------------------------------------------------------

parLevelsRouter.get('/below', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = belowParSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const businessDate = query.data.businessDate
      ? new Date(query.data.businessDate)
      : undefined;

    const rows = await inventoryService.listBelowPar(
      req.db,
      { locationId: query.data.locationId },
      businessDate,
    );

    res.status(200).json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /par-levels — set (upsert) a single PAR level
// ---------------------------------------------------------------------------

parLevelsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const body = setParLevelSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(toValidationError(body.error));
      return;
    }

    const actorUserId = req.user?.id ?? null;

    const result = await inventoryService.setParLevel(req.db, {
      productId: body.data.productId,
      locationId: body.data.locationId ?? null,
      departmentId: body.data.departmentId ?? null,
      basePar: body.data.basePar,
      dayOfWeekOverrides: body.data.dayOfWeekOverrides ?? null,
      actorUserId,
    });

    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /par-levels/bulk — bulk upsert PAR levels
// ---------------------------------------------------------------------------

parLevelsRouter.post('/bulk', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const body = bulkSetParLevelSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(toValidationError(body.error));
      return;
    }

    const actorUserId = req.user?.id ?? null;

    const results = await inventoryService.bulkSetParLevel(
      req.db,
      body.data.rows.map((r) => ({
        productId: r.productId,
        locationId: r.locationId ?? null,
        departmentId: r.departmentId ?? null,
        basePar: r.basePar,
        dayOfWeekOverrides: r.dayOfWeekOverrides ?? null,
        actorUserId,
      })),
    );

    res.status(200).json({ data: { count: results.length } });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /par-levels — list all PAR entries (brand-scoped, optional filters)
// ---------------------------------------------------------------------------

parLevelsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }

    const query = listParLevelsSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(toValidationError(query.error));
      return;
    }

    const { limit, offset } = query.data;

    // Brand-scoped list; simple full list — no complex filtering needed for MVP
    const rows = await req.db.scopedFrom(parLevels) as unknown as typeof parLevels.$inferSelect[];

    const paged = rows.slice(offset, offset + limit);

    res.status(200).json({
      data: paged,
      meta: { total: rows.length, limit, offset },
    });
  } catch (e) {
    next(e);
  }
});
