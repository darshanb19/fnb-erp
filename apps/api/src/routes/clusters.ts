/**
 * clusters router — FR1 org-hierarchy cluster CRUD.
 * All mutations require a `reason` string (audit log obligation, DL-013).
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { orgService } from '../services/org.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const clustersRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});

const updateSchema = createSchema.partial();
const reasonSchema = z.object({ reason: z.string().min(3) });

clustersRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await orgService.listClusters(req.db));
  } catch (e) {
    next(e);
  }
});

clustersRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const cluster = await orgService.createCluster(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(cluster);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

clustersRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await orgService.getCluster(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

clustersRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const cluster = await orgService.updateCluster(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(cluster);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

clustersRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const cluster = await orgService.deactivateCluster(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(cluster);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
