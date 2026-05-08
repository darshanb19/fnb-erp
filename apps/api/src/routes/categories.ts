/**
 * categories router — FR7 category CRUD + M:N product–category assignment.
 *
 * Special endpoints:
 *   GET    /categories/find-similar?name=<q>&excludeId=<uuid>   DL-026 / DL-034
 *   POST   /categories/:id/products/:productId                   assignProductToCategory
 *   DELETE /categories/:id/products/:productId                   removeProductFromCategory (body.reason)
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { categoryService } from '../services/category.service.js';
import { toValidationError } from '../lib/zod-error.js';
import { ValidationError } from '../errors/index.js';

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

// ---------------------------------------------------------------------------
// Static routes BEFORE /:id to avoid Express treating 'find-similar' as an id
// ---------------------------------------------------------------------------

/**
 * DL-026 / DL-034: fuzzy category name search.
 * GET /categories/find-similar?name=<q>&excludeId=<uuid>
 *
 * categoryService.findSimilarByName shipped in Arc (a) per DL-034 but was
 * unrouted. This endpoint closes the gap flagged in the Epic 1 chrome-freeze
 * review (2026-05-07). Third consumer of CC-DUPLICATE-WARN (Task C9).
 */
categoriesRouter.get('/find-similar', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const name = req.query['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      return next(new ValidationError({ code: 'validation.required', message: 'query param `name` is required' }));
    }
    const excludeId = typeof req.query['excludeId'] === 'string' ? req.query['excludeId'] : undefined;
    const results = await categoryService.findSimilarByName(req.db, name, { excludeId });
    res.json(results);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Collection + item routes
// ---------------------------------------------------------------------------

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
