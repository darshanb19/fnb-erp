/**
 * vendors router — FR6 vendor CRUD + Master Spec §2.7 scope mutation + DL-026 find-similar.
 *
 * Special endpoints:
 *   GET  /vendors/find-similar?name=<q>&excludeId=<uuid>   DL-026
 *   POST /vendors/:id/scope                                 §2.7 scope mutation
 *   POST /vendors/import   → 501 Not Implemented (deferred to Epic 6)
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { vendorService } from '../services/vendor.service.js';
import { toValidationError } from '../lib/zod-error.js';
import { ValidationError } from '../errors/index.js';

export const vendorsRouter: ExpressRouter = Router();

const scopeEnum = z.enum(['brand', 'cluster', 'pos']);
const paymentModeEnum = z.enum(['cash', 'bank_transfer', 'cheque']);

const createSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  scope: scopeEnum,
  scopeClusterId: z.string().uuid().optional().nullable(),
  scopeLocationId: z.string().uuid().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  creditTermsDays: z.number().int().nonnegative().optional().nullable(),
  paymentMode: paymentModeEnum.optional().nullable(),
  preferred: z.boolean().optional(),
  qualityRating: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// VendorUpdate excludes scope fields per vendor.service.ts VendorUpdate type
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  creditTermsDays: z.number().int().nonnegative().optional().nullable(),
  paymentMode: paymentModeEnum.optional().nullable(),
  preferred: z.boolean().optional(),
  qualityRating: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

const scopeChangeSchema = z.object({
  scope: scopeEnum,
  clusterId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  reason: z.string().min(3),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

// ---------------------------------------------------------------------------
// Static routes BEFORE /:id
// ---------------------------------------------------------------------------

/**
 * DL-026: fuzzy vendor name search.
 * GET /vendors/find-similar?name=<q>&excludeId=<uuid>
 */
vendorsRouter.get('/find-similar', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const name = req.query['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      return next(new ValidationError({ code: 'validation.required', message: 'query param `name` is required' }));
    }
    const excludeId = typeof req.query['excludeId'] === 'string' ? req.query['excludeId'] : undefined;
    const results = await vendorService.findSimilarByName(req.db, name, { excludeId });
    res.json(results);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /vendors/import — CSV bulk import.
 * STUB: deferred to Epic 6 per implementation plan Task A11.
 */
vendorsRouter.post('/import', (_req, res) => {
  // Bulk CSV vendor import is deferred to Epic 6 per implementation plan Task A11.
  // This stub exists so the endpoint address is reserved and callers get a clear signal.
  res.status(501).json({
    code: 'not_implemented.bulk_import',
    message: 'Bulk vendor CSV import is not yet implemented (deferred to Epic 6)',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Collection + item routes
// ---------------------------------------------------------------------------

vendorsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    const scope = req.query['scope'] as 'brand' | 'cluster' | 'pos' | undefined;
    const clusterId = req.query['clusterId'] as string | undefined;
    const locationId = req.query['locationId'] as string | undefined;
    const preferredRaw = req.query['preferred'];
    const preferred = preferredRaw === 'true' ? true : preferredRaw === 'false' ? false : undefined;
    const activeRaw = req.query['active'];
    const active = activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined;
    res.json(await vendorService.listVendors(req.db, { scope, clusterId, locationId, preferred, active }));
  } catch (e) {
    next(e);
  }
});

vendorsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const input = createSchema.parse(req.body);
    const vendor = await vendorService.createVendor(req.db, input, { actorUserId: req.user.id });
    res.status(201).json(vendor);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await vendorService.getVendor(req.db, req.params['id']!));
  } catch (e) {
    next(e);
  }
});

/**
 * §2.7 scope mutation — POST /vendors/:id/scope
 * Widening: unconditional. Narrowing: blocked if open transactions at dropped locations.
 * Lateral: always rejected.
 */
vendorsRouter.post('/:id/scope', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...scopeInput } = scopeChangeSchema.parse(req.body);
    const vendor = await vendorService.changeVendorScope(
      req.db,
      req.params['id']!,
      scopeInput,
      { actorUserId: req.user.id, reason },
    );
    res.json(vendor);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

vendorsRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const vendor = await vendorService.updateVendor(req.db, req.params['id']!, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(vendor);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

vendorsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const vendor = await vendorService.deactivateVendor(req.db, req.params['id']!, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(vendor);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
