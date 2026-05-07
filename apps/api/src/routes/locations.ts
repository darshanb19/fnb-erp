/**
 * locations router — FR1 org-hierarchy location CRUD.
 * DL-022: clusterId is immutable after creation — PATCH rejects clusterId.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { orgService } from '../services/org.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const locationsRouter: ExpressRouter = Router();

const locationTypeEnum = z.enum(['central_kitchen', 'pos_outlet', 'brand_store', 'cluster_store']);

const createSchema = z.object({
  clusterId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: locationTypeEnum,
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
});

// DL-022: clusterId excluded from update schema (enforced at service layer too)
const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: locationTypeEnum.optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  active: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

locationsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const clusterId = req.query['clusterId'] as string | undefined;
    res.json(await orgService.listLocations(req.db, clusterId ? { clusterId } : undefined));
  } catch (e) {
    next(e);
  }
});

locationsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const location = await orgService.createLocation(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(location);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

locationsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await orgService.getLocation(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

locationsRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    // DL-022: strip clusterId even if caller sneaks it in — service will throw ParentRelinkAttemptError
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const location = await orgService.updateLocation(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(location);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

locationsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const location = await orgService.deactivateLocation(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(location);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
