/**
 * products router — FR3 product CRUD + DL-026 find-similar + DL-023 UOM conversion.
 *
 * Special endpoints:
 *   GET  /products/find-similar?name=<q>&excludeId=<id>&threshold=<f>   DL-026
 *   GET  /products/:id/convert?fromUomId=&toUomId=&qty=                 DL-023 helper
 *   POST /products/import   → 501 Not Implemented (CSV bulk import deferred to Epic 6)
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { productService } from '../services/product.service.js';
import { toValidationError } from '../lib/zod-error.js';
import { ValidationError } from '../errors/index.js';

export const productsRouter: ExpressRouter = Router();

const productTypeEnum = z.enum(['raw', 'semi_product', 'final']);

const createSchema = z.object({
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  type: productTypeEnum,
  defaultUomId: z.string().uuid(),
  standardYieldFactor: z.string().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  sku: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  type: productTypeEnum.optional(),
  defaultUomId: z.string().uuid().optional(),
  standardYieldFactor: z.string().optional(),
  shelfLifeDays: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

// ---------------------------------------------------------------------------
// Static routes BEFORE /:id to avoid Express treating 'find-similar' and 'import' as ids
// ---------------------------------------------------------------------------

/**
 * DL-026: fuzzy product name search.
 * GET /products/find-similar?name=<q>&excludeId=<uuid>&threshold=<0–1>
 */
productsRouter.get('/find-similar', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const name = req.query['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      return next(new ValidationError({ code: 'validation.required', message: 'query param `name` is required' }));
    }
    const excludeId = typeof req.query['excludeId'] === 'string' ? req.query['excludeId'] : undefined;
    const thresholdRaw = typeof req.query['threshold'] === 'string' ? parseFloat(req.query['threshold']) : undefined;
    const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : undefined;
    const results = await productService.findSimilarByName(req.db, name, { excludeId, threshold });
    res.json(results);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /products/import — CSV bulk import.
 * STUB: deferred to Epic 6. Returns 501 Not Implemented.
 */
productsRouter.post('/import', (_req, res) => {
  // Bulk CSV product import is deferred to Epic 6 per implementation plan Task A11.
  // This stub exists so the endpoint address is reserved and callers get a clear signal.
  res.status(501).json({
    code: 'not_implemented.bulk_import',
    message: 'Bulk product CSV import is not yet implemented (deferred to Epic 6)',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Collection + item routes
// ---------------------------------------------------------------------------

productsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const type = req.query['type'] as 'raw' | 'semi_product' | 'final' | undefined;
    const activeRaw = req.query['active'];
    const active = activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined;
    res.json(await productService.listProducts(req.db, { type, active }));
  } catch (e) {
    next(e);
  }
});

productsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const product = await productService.createProduct(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(product);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

productsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await productService.getProduct(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

/**
 * DL-023 helper: convert a quantity from one UOM to another for a product.
 * GET /products/:id/convert?fromUomId=<uuid>&toUomId=<uuid>&qty=<number>
 */
productsRouter.get('/:id/convert', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const fromUomId = req.query['fromUomId'];
    const toUomId = req.query['toUomId'];
    const qtyRaw = req.query['qty'];
    if (typeof fromUomId !== 'string' || typeof toUomId !== 'string') {
      return next(new ValidationError({
        code: 'validation.required',
        message: 'Query params fromUomId and toUomId are required',
      }));
    }
    const qty = typeof qtyRaw === 'string' ? parseFloat(qtyRaw) : NaN;
    if (!Number.isFinite(qty)) {
      return next(new ValidationError({ code: 'validation.invalid_type', message: 'Query param qty must be a number' }));
    }
    const result = await productService.convertQuantity(req.db, req.params['id']!, fromUomId, toUomId, qty);
    res.json({ result, fromUomId, toUomId, qty });
  } catch (e) {
    next(e);
  }
});

productsRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const product = await productService.updateProduct(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(product);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

productsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const product = await productService.deactivateProduct(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(product);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
