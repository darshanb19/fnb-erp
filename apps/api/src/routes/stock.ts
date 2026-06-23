/**
 * stock router — Epic 4 W1 read endpoints (spec §6).
 *
 * Routes:
 *   GET /stock/available?itemId=&departmentId=     → { data: AvailableStockResult }
 *   GET /stock/expiring?departmentId=&now=         → { data: { bands, items } }
 *   GET /stock/movements?productId=&departmentId=&limit=&offset=  → { data: [...movements] }
 *
 * Auth contract: req.db required on every route (returns 401 if absent).
 * Validation: zod; toValidationError on ZodError.
 * Success envelope: { data }.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { inventoryService } from '../services/inventory.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const stockRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const availableSchema = z.object({
  itemId: z.string().uuid(),
  departmentId: z.string().uuid(),
});

const expiringSchema = z.object({
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  /** ISO 8601 timestamp string to override "now" — used in tests / replay scenarios */
  now: z.string().datetime({ offset: true }).optional(),
});

const movementsSchema = z.object({
  productId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// GET /stock/available
// ---------------------------------------------------------------------------

stockRouter.get('/available', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { itemId, departmentId } = availableSchema.parse(req.query);
    const result = await inventoryService.getAvailableStock(req.db, itemId, departmentId);
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /stock/department/:departmentId
// ---------------------------------------------------------------------------

const departmentStockParamsSchema = z.object({
  departmentId: z.string().uuid(),
});

stockRouter.get('/department/:departmentId', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { departmentId } = departmentStockParamsSchema.parse(req.params);
    const result = await inventoryService.listDepartmentStock(req.db, departmentId);
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /stock/expiring
// ---------------------------------------------------------------------------

stockRouter.get('/expiring', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { departmentId, locationId, clusterId, now: nowStr } = expiringSchema.parse(req.query);
    const now = nowStr ? new Date(nowStr) : undefined;
    const result = await inventoryService.getExpiringBatches(
      req.db,
      { departmentId, locationId, clusterId },
      now,
    );
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /stock/movements
// ---------------------------------------------------------------------------

stockRouter.get('/movements', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { productId, departmentId, limit, offset } = movementsSchema.parse(req.query);

    // Use db.raw + sql tag for movements: supports brand_id predicate + optional filters +
    // ORDER BY + LIMIT/OFFSET cleanly without fighting scopedFrom's type signature.
    // Explicit brand_id predicate satisfies DL-012 org-scope requirement.
    const movResult = await req.db.raw.execute(sql`
      SELECT *
      FROM stock_movements
      WHERE brand_id = ${req.db.brandId}
        ${productId !== undefined ? sql`AND product_id = ${productId}` : sql``}
        ${departmentId !== undefined ? sql`AND department_id = ${departmentId}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    res.json({ data: movResult });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
