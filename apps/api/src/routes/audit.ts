/**
 * auditRouter — Phase 4 Epic 3 INF Arc (a) Task A11.
 *
 * Mounted at /api/v1/audit.
 *
 * Endpoint surface:
 *   GET    /events                                          inf.audit.read    — filtered event list (cursor)
 *   GET    /entities/:entityType/:entityRef/timeline        inf.audit.read    — full timeline ASC for one entity
 *   POST   /export                                          inf.audit.export  — CSV/Excel sync; PDF stub
 *   GET    /exports/:jobId                                  inf.audit.export  — STUB (DL-019: PDF deferred)
 *
 * Scope derivation per task A11 spec:
 *   - brand_owner / superadmin → 'unrestricted'
 *   - finance_manager          → 'brand'
 *   - cluster_manager          → 'cluster' (clusterId resolved from users table —
 *                                JWT does not currently carry clusterId; deferred
 *                                to a later JWT-claim expansion, same pattern as users.ts)
 *   - all others               → 'own' (currentUserId = req.user.id)
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac.js';
import { auditService, type AuditScope, type ExportFormat } from '../services/audit.service.js';
import type { BrandedDb } from '../db/branded-db.js';
import { toValidationError } from '../lib/zod-error.js';
import { param, resolveActorClusterId } from '../lib/route-helpers.js';

export const auditRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an audit scope from the caller's role.
 *
 * cluster_manager scope: same JWT-claim deferral as users.ts — we resolve the
 * acting user's clusterId via resolveActorClusterId() before calling
 * listEvents(). One extra query per request; keeps JWT shape unchanged for
 * Arc-a.
 */
async function deriveScope(
  db: BrandedDb,
  userId: string,
  role: string,
): Promise<AuditScope> {
  if (role === 'brand_owner' || role === 'superadmin') {
    return { kind: 'unrestricted' };
  }
  if (role === 'finance_manager') {
    return { kind: 'brand' };
  }
  if (role === 'cluster_manager') {
    const clusterId = await resolveActorClusterId(db, userId);
    return { kind: 'cluster', currentUserClusterId: clusterId };
  }
  return { kind: 'own', currentUserId: userId };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const eventsQuerySchema = z.object({
  entityType: z.string().optional(),
  entityRef: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  cursor: z.string().optional(),
});

const exportFormats = ['csv', 'excel', 'pdf'] as const satisfies readonly ExportFormat[];

const exportSchema = z.object({
  filters: z
    .object({
      entityType: z.string().optional(),
      entityRef: z.string().optional(),
      actorUserId: z.string().uuid().optional(),
      action: z.string().optional(),
      startDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      endDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
    })
    .optional(),
  format: z.enum(exportFormats),
});

// ---------------------------------------------------------------------------
// GET /events — list audit events
// ---------------------------------------------------------------------------

auditRouter.get(
  '/events',
  requirePermission('inf.audit.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const q = eventsQuerySchema.parse(req.query);
      const scope = await deriveScope(req.db, req.user.id, req.user.role);
      const result = await auditService.listEvents(req.db, {
        filters: {
          entityType: q.entityType,
          entityRef: q.entityRef,
          actorUserId: q.actorUserId,
          action: q.action,
          startDate: q.startDate,
          endDate: q.endDate,
          scope,
        },
        limit: q.limit,
        cursor: q.cursor ?? null,
      });
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /entities/:entityType/:entityRef/timeline — entity audit timeline
// ---------------------------------------------------------------------------

auditRouter.get(
  '/entities/:entityType/:entityRef/timeline',
  requirePermission('inf.audit.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const result = await auditService.getEntityTimeline(req.db, {
        entityType: param(req.params['entityType']),
        entityRef: param(req.params['entityRef']),
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /export — CSV/Excel sync; PDF returns a stub jobId
// ---------------------------------------------------------------------------

auditRouter.post(
  '/export',
  requirePermission('inf.audit.export'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = exportSchema.parse(req.body);
      const scope = await deriveScope(req.db, req.user.id, req.user.role);
      const result = await auditService.exportSlice(req.db, {
        filters: { ...(input.filters ?? {}), scope },
        format: input.format,
      });
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /exports/:jobId — STUB. Real PDF rendering deferred to Epic 4 INV (DL-019).
// Always returns { jobId, status: 'pending', message: ... } in MVP.
// ---------------------------------------------------------------------------

auditRouter.get(
  '/exports/:jobId',
  requirePermission('inf.audit.export'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      res.json({
        jobId: param(req.params['jobId']),
        status: 'pending',
        message: 'PDF export deferred to Epic 4 INV per DL-019',
      });
    } catch (e) {
      next(e);
    }
  },
);
