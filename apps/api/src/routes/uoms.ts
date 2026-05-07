/**
 * uoms router — DL-023 layer 1: global UOM registry CRUD per brand.
 *
 * No dedicated uomService exists for the registry — operations use BrandedDb directly.
 * The two-layer UOM system (DL-023) is:
 *   Layer 1 (this router): global `uoms` registry — shared UOM definitions per brand.
 *   Layer 2 (product-uoms router): per-product alternates in `product_uoms`.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { uoms } from '../db/schema/inventory.js';
import { NotFoundError } from '../errors/index.js';
import { toValidationError } from '../lib/zod-error.js';

export const uomsRouter: ExpressRouter = Router();

const uomBaseEnum = z.enum(['mass', 'volume', 'count']);

const createSchema = z.object({
  code: z.string().min(1).max(20),
  displayName: z.string().min(1).max(80),
  base: uomBaseEnum,
  conversionToBaseFactor: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive numeric string'),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  displayName: z.string().min(1).max(80).optional(),
  base: uomBaseEnum.optional(),
  conversionToBaseFactor: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  active: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

uomsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const rows = await req.db.scopedFrom(uoms) as unknown as (typeof uoms.$inferSelect)[];
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

uomsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const rows = await req.db.scopedInsert(uoms, input).returning() as unknown as (typeof uoms.$inferSelect)[];
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

uomsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const rows = await req.db.scopedFrom(uoms, eq(uoms.id, req.params['id']!)) as unknown as (typeof uoms.$inferSelect)[];
    const row = rows[0];
    if (!row) {
      return next(new NotFoundError({ code: 'not_found.uom', message: `UOM ${req.params['id']} not found` }));
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

uomsRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason: _reason, ...rest } = req.body as Record<string, unknown>;
    void _reason; // reason captured but not required for UOM updates (no business audit policy)
    const input = updateSchema.parse(rest);
    const rows = await req.db
      .scopedUpdate(uoms)
      .set(input)
      .where(eq(uoms.id, req.params['id']!))
      .returning() as unknown as (typeof uoms.$inferSelect)[];
    const row = rows[0];
    if (!row) {
      return next(new NotFoundError({ code: 'not_found.uom', message: `UOM ${req.params['id']} not found` }));
    }
    res.json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

uomsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason: _reason } = reasonSchema.parse(req.body);
    void _reason;
    // Soft delete: set active = false (restrict FK prevents physical delete if referenced)
    const rows = await req.db
      .scopedUpdate(uoms)
      .set({ active: false })
      .where(eq(uoms.id, req.params['id']!))
      .returning() as unknown as (typeof uoms.$inferSelect)[];
    const row = rows[0];
    if (!row) {
      return next(new NotFoundError({ code: 'not_found.uom', message: `UOM ${req.params['id']} not found` }));
    }
    res.json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
