/**
 * enablements router — FR5 / FR8 inventory enablement matrix.
 *
 * Routes:
 *   GET  /enablements/by-location/:locationId   list all (product × dept) cells at a location
 *   POST /enablements/check                     { productId, departmentId } → { enabled }
 *   POST /enablements/set                       { productId, departmentId, enabled, reason? }
 *   POST /enablements/bulk-set                  { pairs: [...], reason? }
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { inventoryService } from '../services/inventory.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const enablementsRouter: ExpressRouter = Router();

const checkSchema = z.object({
  productId: z.string().uuid(),
  departmentId: z.string().uuid(),
});

const setSchema = z.object({
  productId: z.string().uuid(),
  departmentId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().min(1).optional(),
});

const bulkSetSchema = z.object({
  pairs: z.array(
    z.object({
      productId: z.string().uuid(),
      departmentId: z.string().uuid(),
      enabled: z.boolean(),
    }),
  ).min(1),
  reason: z.string().min(1).optional(),
});

enablementsRouter.get('/by-location/:locationId', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const categoryId = req.query['categoryId'] as string | undefined;
    const cells = await inventoryService.listEnablementForLocation(
      req.db,
      req.params['locationId']!,
      categoryId ? { categoryId } : undefined,
    );
    res.json(cells);
  } catch (e) {
    next(e);
  }
});

enablementsRouter.post('/check', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const { productId, departmentId } = checkSchema.parse(req.body);
    const enabled = await inventoryService.checkEnablement(req.db, productId, departmentId);
    res.json({ enabled });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

enablementsRouter.post('/set', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { productId, departmentId, enabled, reason } = setSchema.parse(req.body);
    await inventoryService.setEnablement(req.db, productId, departmentId, enabled, {
      actorUserId: req.user.id,
      reason: reason ?? null,
    });
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

enablementsRouter.post('/bulk-set', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { pairs, reason } = bulkSetSchema.parse(req.body);
    await inventoryService.bulkSetEnablement(req.db, pairs, {
      actorUserId: req.user.id,
      reason: reason ?? null,
    });
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
