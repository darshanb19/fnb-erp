/**
 * stock-transfers router — Epic 4 W3 (spec §6).
 *
 * Routes:
 *   POST /stock-transfers                              → createDraft → { data: { transferId, stTrn } }
 *   POST /stock-transfers/:id/submit                   → submitTransfer → { data: { status } }
 *   POST /stock-transfers/:id/approve                  → approveTransfer → { data: { status } }
 *   POST /stock-transfers/:id/dispatch                 → dispatchTransfer → { data: { status } }
 *   POST /stock-transfers/:id/confirm-receipt          → confirmReceipt → { data: { status } }
 *   POST /stock-transfers/:id/cancel                   → cancelTransfer → { data: { status } }
 *   GET  /stock-transfers/:id                          → getTransferDetail → { data: { ...transfer, lines } }
 *   GET  /stock-transfers                              → list (paged, brand-scoped)
 *   POST /stock-transfers/bundles                      → createBundledTransfer → { data: { bundleId, bundleRef } }
 *   POST /stock-transfers/bundles/:bundleId/approve    → confirmBundleApproval → { data: { transferIds } }
 *   GET  /stock-transfers/suggestions                  → suggestTransfers → { data: { suggestions } }
 *   POST /stock-transfers/suggestions/:productId/dismiss → dismissSuggestion → { data: { dismissed } }
 *
 * Auth contract: req.db required (returns 401 if absent).
 * Validation: zod; toValidationError on ZodError.
 * Success envelope: { data }.
 * Error routing: AppErrors → their own httpStatus; ZodError → 400.
 *
 * IMPORTANT: Static sub-routes (/bundles, /suggestions) must be registered
 * BEFORE the /:id wildcard to avoid Express matching them as IDs.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { transferService } from '../services/transfer.service.js';
import { stockTransfers } from '../db/schema/inventory.js';
import { toValidationError } from '../lib/zod-error.js';

export const stockTransfersRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const transferLineSchema = z.object({
  productId: z.string().uuid(),
  requestedQty: z.number().positive(),
  reasonCode: z.string().min(1).optional(),
});

const createTransferSchema = z.object({
  sourceDepartmentId: z.string().uuid(),
  destinationDepartmentId: z.string().uuid(),
  locationCode: z.string().min(1).max(20),
  reasonCode: z.string().min(1).optional(),
  lines: z.array(transferLineSchema).min(1),
});

const confirmReceiptSchema = z.object({
  quantities: z.record(z.string().uuid(), z.number().positive()).optional(),
  varianceReasons: z.record(z.string().uuid(), z.string().min(1)).optional(),
});

const createBundleSchema = z.object({
  originatingClusterId: z.string().uuid(),
  destinationClusterId: z.string().uuid(),
  locationCode: z.string().min(1).max(20),
  productId: z.string().uuid(),
  qty: z.number().positive(),
  uomId: z.string().uuid(),
  fromStoreId: z.string().uuid().nullable().optional(),
  toStoreId: z.string().uuid().nullable().optional(),
  /** I2: brand-level Brand Store (cross-cluster intermediary). */
  brandStoreId: z.string().uuid().nullable().optional(),
  reasonCode: z.string().min(1).optional(),
});

const suggestionsSchema = z.object({
  sourceDepartmentId: z.string().uuid(),
  destinationDepartmentId: z.string().uuid(),
});

const dismissSchema = z.object({
  batchId: z.string().uuid().nullable().optional(),
  reasonCode: z.string().min(1).optional(),
});

const listTransfersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'pending_approval', 'approved', 'in_transit', 'received', 'cancelled']).optional(),
});

// ---------------------------------------------------------------------------
// STATIC ROUTES — must come before /:id wildcard
// ---------------------------------------------------------------------------

// POST /stock-transfers/bundles — create a bundled (cross-cluster) transfer
stockTransfersRouter.post('/bundles', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const input = createBundleSchema.parse(req.body);
    const result = await transferService.createBundledTransfer(req.db, {
      originatingClusterId: input.originatingClusterId,
      destinationClusterId: input.destinationClusterId,
      locationCode: input.locationCode,
      requestedByUserId: req.user?.id ?? null,
      productId: input.productId,
      qty: input.qty,
      uomId: input.uomId,
      fromStoreId: input.fromStoreId ?? null,
      toStoreId: input.toStoreId ?? null,
      brandStoreId: input.brandStoreId ?? null,
      reasonCode: input.reasonCode,
    });
    res.status(201).json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// POST /stock-transfers/bundles/:bundleId/approve — confirm bundle → decompose into 2 transfers
stockTransfersRouter.post('/bundles/:bundleId/approve', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const bundleId = req.params['bundleId'];
    if (!bundleId) {
      res.status(400).json({ error: 'Missing bundleId' });
      return;
    }
    const result = await transferService.confirmBundleApproval(req.db, bundleId);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// GET /stock-transfers/suggestions — compute live suggestions
stockTransfersRouter.get('/suggestions', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { sourceDepartmentId, destinationDepartmentId } = suggestionsSchema.parse(req.query);
    const result = await transferService.suggestTransfers(req.db, {
      sourceDepartmentId,
      destinationDepartmentId,
    });
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// POST /stock-transfers/suggestions/:productId/dismiss — I3: resource-scoped dismiss
stockTransfersRouter.post('/suggestions/:productId/dismiss', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const productId = req.params['productId'];
    if (!productId) {
      res.status(400).json({ error: 'Missing productId' });
      return;
    }
    // Validate productId as UUID
    const productIdParsed = z.string().uuid().safeParse(productId);
    if (!productIdParsed.success) {
      res.status(400).json({ error: 'productId must be a UUID' });
      return;
    }
    const input = dismissSchema.parse(req.body);
    const result = await transferService.dismissSuggestion(req.db, {
      productId: productIdParsed.data,
      batchId: input.batchId ?? null,
      dismissedByUserId: req.user?.id ?? null,
      reasonCode: input.reasonCode,
    });
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers — create a draft transfer
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const input = createTransferSchema.parse(req.body);
    const result = await transferService.createDraft(req.db, {
      sourceDepartmentId: input.sourceDepartmentId,
      destinationDepartmentId: input.destinationDepartmentId,
      locationCode: input.locationCode,
      requestedByUserId: req.user?.id ?? null,
      lines: input.lines,
      reasonCode: input.reasonCode,
    });
    res.status(201).json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /stock-transfers — list (brand-scoped, paged)
// ---------------------------------------------------------------------------

stockTransfersRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const { limit, offset, status } = listTransfersSchema.parse(req.query);
    const statusCondition = status !== undefined ? eq(stockTransfers.status, status) : undefined;
    const rows = await req.db
      .scopedFrom(stockTransfers, statusCondition)
      .orderBy(desc(stockTransfers.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ data: rows });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers/:id/submit — submit draft → approved or pending_approval
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/:id/submit', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const result = await transferService.submitTransfer(req.db, id, req.user?.id ?? null);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers/:id/approve — pending_approval → approved (C2)
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/:id/approve', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const result = await transferService.approveTransfer(req.db, id, req.user?.id ?? null);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers/:id/dispatch — approved → in_transit (deducts source)
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/:id/dispatch', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const result = await transferService.dispatchTransfer(req.db, id, req.user?.id ?? null);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers/:id/confirm-receipt — receive transfer at destination
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/:id/confirm-receipt', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const { quantities, varianceReasons } = confirmReceiptSchema.parse(req.body);
    const result = await transferService.confirmReceipt(
      req.db,
      id,
      quantities ?? {},
      req.user?.id ?? null,
      varianceReasons,
    );
    res.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});

// ---------------------------------------------------------------------------
// POST /stock-transfers/:id/cancel — cancel a transfer
// ---------------------------------------------------------------------------

stockTransfersRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const result = await transferService.cancelTransfer(req.db, id, req.user?.id ?? null);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /stock-transfers/:id — get transfer detail with lines
// ---------------------------------------------------------------------------

stockTransfersRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing transfer id' }); return; }
    const detail = await transferService.getTransferDetail(req.db, id);
    res.json({ data: detail });
  } catch (e) {
    next(e);
  }
});
