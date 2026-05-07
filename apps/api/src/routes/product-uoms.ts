/**
 * product-uoms router — DL-023 layer 2: per-product alternate UOM management.
 *
 * Routes:
 *   GET    /product-uoms?productId=<uuid>         list alternate UOMs for a product
 *   POST   /product-uoms                          add an alternate UOM to a product
 *   DELETE /product-uoms/:id                      remove a product UOM row
 *   POST   /product-uoms/:id/set-default          make a product UOM the default
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { productUoms } from '../db/schema/inventory.js';
import { productService } from '../services/product.service.js';
import { ValidationError } from '../errors/index.js';
import { toValidationError } from '../lib/zod-error.js';
import type { ProductUom } from '../db/schema/inventory.js';

export const productUomsRouter: ExpressRouter = Router();

const addSchema = z.object({
  productId: z.string().uuid(),
  uomId: z.string().uuid(),
  factorToDefaultUom: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive numeric string'),
  isDefault: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

productUomsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const productId = req.query['productId'];
    if (typeof productId !== 'string' || productId.trim() === '') {
      return next(new ValidationError({ code: 'validation.required', message: 'Query param `productId` is required' }));
    }
    const rows = await req.db.scopedFrom(productUoms, eq(productUoms.productId, productId)) as unknown as ProductUom[];
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

productUomsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { productId, ...rest } = addSchema.parse(req.body);
    const row = await productService.addProductUom(req.db, productId, rest, { actorUserId: req.user.id });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

productUomsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    await productService.removeProductUom(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

productUomsRouter.post('/:id/set-default', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    // productId is required to identify which product's defaults to clear
    const { productId } = z.object({ productId: z.string().uuid() }).parse(req.body);
    await productService.setDefaultProductUom(req.db, productId, req.params['id']!, {
      actorUserId: req.user.id,
    });
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
