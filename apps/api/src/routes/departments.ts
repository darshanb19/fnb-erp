/**
 * departments router — FR2 department classification CRUD.
 * DL-022: locationId is immutable after creation — PATCH rejects locationId.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { orgService } from '../services/org.service.js';
import { toValidationError } from '../lib/zod-error.js';
import type { Department } from '../db/schema/org.js';

export const departmentsRouter: ExpressRouter = Router();

const deptTypeEnum = z.enum(['production', 'dispatch', 'non_production', 'store']);

const createSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: deptTypeEnum,
});

// DL-022: locationId excluded from update schema
const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: deptTypeEnum.optional(),
  active: z.boolean().optional(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

departmentsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const locationId = req.query['locationId'] as string | undefined;
    const type = req.query['type'] as Department['type'] | undefined;
    res.json(await orgService.listDepartments(req.db, { locationId, type }));
  } catch (e) {
    next(e);
  }
});

departmentsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const dept = await orgService.createDepartment(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(dept);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

departmentsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await orgService.getDepartment(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

departmentsRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const dept = await orgService.updateDepartment(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(dept);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

departmentsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const dept = await orgService.deactivateDepartment(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(dept);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
