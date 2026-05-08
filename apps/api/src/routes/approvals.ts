/**
 * approvalsRouter — Phase 4 Epic 3 INF Arc (a) Task A11.
 *
 * Mounted at /api/v1/approvals (apiRouter already carries authMiddleware).
 * Every endpoint adds `requirePermission(...)` on top.
 *
 * Endpoint surface:
 *   GET    /inbox                          inf.approval.read              — pending steps for the caller
 *   GET    /:requestId                     inf.approval.read              — request + all step rows
 *   POST   /:requestId/decide              inf.approval.write             — approve / reject
 *   POST   /:requestId/delegate            inf.approval.write             — delegate to another user
 *   GET    /chains                         inf.approval.configure_chains  — list chains, optional filters
 *   POST   /chains                         inf.approval.configure_chains  — create chain
 *   PATCH  /chains/:chainId                inf.approval.configure_chains  — update chain
 *   POST   /chains/:chainId/activate       inf.approval.configure_chains  — convenience: status='active'
 *   POST   /chains/:chainId/deactivate     inf.approval.configure_chains  — convenience: status='inactive'
 *
 * Reason-code discipline: `decide` (when rejected), `delegate` always require
 * a reasonCode. The Zod schema enforces a non-empty string at the route layer
 * and the service double-validates per its own contract.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac.js';
import {
  approvalEngine,
  type ConfigureChainInput,
} from '../services/approval-engine.service.js';
import type {
  ApprovalChainEntityType,
  ApprovalChainStatus,
} from '../db/schema/approval-chains.js';
import { toValidationError } from '../lib/zod-error.js';

export const approvalsRouter: ExpressRouter = Router();

/** See users.ts for rationale on the param() helper (Express 5 typing quirk). */
function param(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return p[0] ?? '';
  return p ?? '';
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const decideSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().nullish(),
    reasonCode: z.string().min(1).nullish(),
  })
  .refine((v) => v.decision !== 'rejected' || (v.reasonCode && v.reasonCode.trim().length > 0), {
    message: 'reasonCode is required when decision = "rejected"',
    path: ['reasonCode'],
  });

const delegateSchema = z.object({
  targetUserId: z.string().uuid(),
  reasonCode: z.string().min(1),
  comment: z.string().nullish(),
});

const chainEntityTypes = [
  'po_threshold',
  'gr_shelf_life_exception',
  'recipe_default_change',
  'bo_self_creation',
  'inventory_adjustment',
  'b2b_credit_limit_change',
] as const satisfies readonly ApprovalChainEntityType[];

const chainStatuses = ['draft', 'active', 'inactive'] as const satisfies readonly ApprovalChainStatus[];

const chainStepSchema = z.object({
  role: z.string().min(1),
  valueBandMin: z.number().optional(),
  valueBandMax: z.number().optional(),
  escalationTimeoutMinutes: z.number().int().positive(),
  fallbackDelegateUserId: z.string().uuid().optional(),
});

const chainCreateSchema = z.object({
  entityType: z.enum(chainEntityTypes),
  name: z.string().min(1),
  description: z.string().nullish(),
  steps: z.array(chainStepSchema).min(1),
  status: z.enum(chainStatuses).optional(),
  reasonCode: z.string().nullish(),
});

const chainUpdateSchema = z.object({
  entityType: z.enum(chainEntityTypes),
  name: z.string().min(1),
  description: z.string().nullish(),
  steps: z.array(chainStepSchema).min(1),
  status: z.enum(chainStatuses).optional(),
  reasonCode: z.string().nullish(),
});

const listChainsQuerySchema = z.object({
  entityType: z.enum(chainEntityTypes).optional(),
  status: z.enum(chainStatuses).optional(),
});

// ---------------------------------------------------------------------------
// GET /inbox — pending approvals assigned to the caller
// MUST come before GET /:requestId so the literal "inbox" doesn't match :requestId.
// ---------------------------------------------------------------------------

approvalsRouter.get(
  '/inbox',
  requirePermission('inf.approval.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const items = await approvalEngine.getPendingApprovals(req.db, req.user.id);
      res.json(items);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /chains — list chains
// ---------------------------------------------------------------------------

approvalsRouter.get(
  '/chains',
  requirePermission('inf.approval.configure_chains'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const filters = listChainsQuerySchema.parse(req.query);
      const chains = await approvalEngine.listChains(req.db, filters);
      res.json(chains);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /chains — create chain
// ---------------------------------------------------------------------------

approvalsRouter.post(
  '/chains',
  requirePermission('inf.approval.configure_chains'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = chainCreateSchema.parse(req.body);
      const chain = await approvalEngine.configureChain(
        req.db,
        input as ConfigureChainInput,
        { actorUserId: req.user.id },
      );
      res.status(201).json(chain);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /chains/:chainId — update chain
// ---------------------------------------------------------------------------

approvalsRouter.patch(
  '/chains/:chainId',
  requirePermission('inf.approval.configure_chains'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = chainUpdateSchema.parse(req.body);
      const chain = await approvalEngine.configureChain(
        req.db,
        { ...(input as ConfigureChainInput), id: param(req.params['chainId']) },
        { actorUserId: req.user.id },
      );
      res.json(chain);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /chains/:chainId/activate — convenience status='active'
// POST /chains/:chainId/deactivate — convenience status='inactive'
// Both require body { ...full chain payload } since configureChain() upserts.
// To keep these as ergonomic single-button ops the caller passes the same
// fields they posted on PATCH; we override `status` here.
// ---------------------------------------------------------------------------

approvalsRouter.post(
  '/chains/:chainId/activate',
  requirePermission('inf.approval.configure_chains'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = chainUpdateSchema.parse(req.body);
      const chain = await approvalEngine.configureChain(
        req.db,
        {
          ...(input as ConfigureChainInput),
          id: param(req.params['chainId']),
          status: 'active',
        },
        { actorUserId: req.user.id },
      );
      res.json(chain);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

approvalsRouter.post(
  '/chains/:chainId/deactivate',
  requirePermission('inf.approval.configure_chains'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = chainUpdateSchema.parse(req.body);
      const chain = await approvalEngine.configureChain(
        req.db,
        {
          ...(input as ConfigureChainInput),
          id: param(req.params['chainId']),
          status: 'inactive',
        },
        { actorUserId: req.user.id },
      );
      res.json(chain);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:requestId/decide — approve / reject
// ---------------------------------------------------------------------------

approvalsRouter.post(
  '/:requestId/decide',
  requirePermission('inf.approval.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = decideSchema.parse(req.body);
      const result = await approvalEngine.decide(
        req.db,
        {
          requestId: param(req.params['requestId']),
          approverUserId: req.user.id,
          decision: input.decision,
          comment: input.comment ?? null,
          reasonCode: input.reasonCode ?? null,
        },
        { actorUserId: req.user.id },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:requestId/delegate — delegate to another user
// ---------------------------------------------------------------------------

approvalsRouter.post(
  '/:requestId/delegate',
  requirePermission('inf.approval.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = delegateSchema.parse(req.body);
      const result = await approvalEngine.delegate(
        req.db,
        {
          requestId: param(req.params['requestId']),
          approverUserId: req.user.id,
          targetUserId: input.targetUserId,
          reasonCode: input.reasonCode,
          comment: input.comment ?? null,
        },
        { actorUserId: req.user.id },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:requestId — request status + step rows
// MUST be the LAST GET because it uses a catch-all :requestId param.
// ---------------------------------------------------------------------------

approvalsRouter.get(
  '/:requestId',
  requirePermission('inf.approval.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const result = await approvalEngine.getApprovalStatus(req.db, param(req.params['requestId']));
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
