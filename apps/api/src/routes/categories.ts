/**
 * categories router — FR7 category CRUD + M:N product–category assignment.
 *
 * Special endpoints:
 *   POST   /categories/:id/products/:productId   assignProductToCategory
 *   DELETE /categories/:id/products/:productId   removeProductFromCategory (body.reason)
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { categoryService } from '../services/category.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const categoriesRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  parentId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

categoriesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await categoryService.listCategories(req.db));
  } catch (e) {
    next(e);
  }
});

categoriesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const category = await categoryService.createCategory(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(category);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

categoriesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await categoryService.getCategory(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

categoriesRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const category = await categoryService.updateCategory(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(category);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

categoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const category = await categoryService.deactivateCategory(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(category);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// M:N: product–category assignment
// ---------------------------------------------------------------------------

categoriesRouter.post('/:id/products/:productId', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const link = await categoryService.assignProductToCategory(
      req.db,
      req.params['productId']!,
      req.params['id']!,
      { actorUserId: req.user.id },
    );
    res.status(201).json(link);
  } catch (e) {
    next(e);
  }
});

categoriesRouter.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    await categoryService.removeProductFromCategory(
      req.db,
      req.params['productId']!,
      req.params['id']!,
      { actorUserId: req.user.id, reason },
    );
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
