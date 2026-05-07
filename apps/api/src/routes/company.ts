/**
 * company router — FR9 brand identity + DL-024 one-way setup gate.
 *
 * Routes:
 *   GET  /company                    return the single brand row for caller's brand
 *   PATCH /company                   update FR9 fields (reason required; status excluded)
 *   POST /company/mark-setup-complete  DL-024 one-way setup_pending → setup_complete
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { companyService } from '../services/company.service.js';
import { toValidationError } from '../lib/zod-error.js';

export const companyRouter: ExpressRouter = Router();

const updateSchema = z.object({
  legalName: z.string().min(1).max(200).optional(),
  tradingName: z.string().min(1).max(200).optional().nullable(),
  registeredAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().min(2).max(2).optional(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankAccountHolder: z.string().optional().nullable(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  fiscalYearStartDay: z.number().int().min(1).max(31).optional(),
  // accountingCurrency must be 'INR' — validated by companyService (multi-currency deferred DL-024)
  accountingCurrency: z.string().optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
});

const reasonSchema = z.object({ reason: z.string().min(3) });

companyRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) return next(new Error('req.db missing'));
    res.json(await companyService.getCompany(req.db));
  } catch (e) {
    next(e);
  }
});

companyRouter.patch('/', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason, ...rest } = req.body as Record<string, unknown>;
    const input = updateSchema.parse(rest);
    const { reason: reasonStr } = reasonSchema.parse({ reason });
    const company = await companyService.updateCompany(req.db, input, {
      actorUserId: req.user.id,
      reason: reasonStr,
    });
    res.json(company);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

/**
 * DL-024: one-way setup gate. Idempotent — second call is a no-op but still audited.
 */
companyRouter.post('/mark-setup-complete', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));
    const { reason } = reasonSchema.parse(req.body);
    const company = await companyService.markSetupComplete(req.db, {
      actorUserId: req.user.id,
      reason,
    });
    res.json(company);
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
