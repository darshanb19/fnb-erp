/**
 * issuesRouter — Phase 4 Epic 3 INF Arc (a) Task A11.
 *
 * Mounted at /api/v1/issues.
 *
 * Endpoint surface:
 *   GET    /                                          inf.issue.read    — RBAC scope (brand/cluster/own)
 *   POST   /                                          inf.issue.write   — create ticket
 *   GET    /:ticketId                                 inf.issue.read    — ticket + comments + attachments
 *   PATCH  /:ticketId                                 inf.issue.write   — update; assignee changes additionally require inf.issue.assign
 *   POST   /:ticketId/comments                        inf.issue.write   — fan-out comment
 *   POST   /:ticketId/attachments                     inf.issue.write   — request signed upload URL
 *   PATCH  /:ticketId/attachments/:attId/confirm      inf.issue.write   — confirm upload
 *   GET    /:ticketId/attachments/:attId/download     inf.issue.read    — signed download URL
 *   POST   /:ticketId/close                           inf.issue.close   — convenience PATCH status='closed'
 *   POST   /:ticketId/reopen                          inf.issue.close   — convenience PATCH status='open'
 *
 * Cross-permission write route (assignee change):
 *   The spec says assignee change requires `inf.issue.assign` while title /
 *   description / priority change requires `inf.issue.write`. We mount PATCH
 *   /:ticketId with `inf.issue.write` permission, and inside the handler when
 *   `body.assigneeUserId !== undefined` we additionally check `inf.issue.assign`
 *   via permissionService. Two routes is the alternative; one route + inline
 *   guard is cleaner here because the body shape is unified.
 *
 * Attachment delete: NOT mounted in MVP. The schema does not support soft-delete
 * and a hard-delete tool needs a separate signed Storage delete + audit story
 * that's out of scope for Arc (a). Tracked as a gap for a later epic.
 *
 * Scope derivation: same pattern as audit. cluster_manager scope resolves
 * clusterId via userService.get() (JWT-claim deferral noted in users.ts).
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac.js';
import {
  issueTrackerService,
  type TicketListScope,
} from '../services/issue-tracker.service.js';
import type { BrandedDb } from '../db/branded-db.js';
import { permissionService } from '../services/permission.service.js';
import { AuthorizationError } from '../errors/index.js';
import { toValidationError } from '../lib/zod-error.js';
import { param, resolveActorClusterId } from '../lib/route-helpers.js';

export const issuesRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const priorities = ['low', 'medium', 'high', 'critical'] as const;
const statuses = ['open', 'in_progress', 'pending_info', 'resolved', 'closed'] as const;

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(priorities).optional(),
  assigneeUserId: z.string().uuid().optional(),
  linkedEntityType: z.string().optional(),
  linkedEntityRef: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(priorities).optional(),
  status: z.enum(statuses).optional(),
  assigneeUserId: z.string().uuid().nullish(),
  linkedEntityType: z.string().nullish(),
  linkedEntityRef: z.string().nullish(),
  reasonCode: z.string().optional(),
});

const closeReopenSchema = z.object({
  reasonCode: z.string().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1),
});

const requestAttachmentSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const confirmAttachmentSchema = z.object({
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const listQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  assigneeUserId: z.string().uuid().optional(),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Scope derivation
// ---------------------------------------------------------------------------

async function deriveTicketScope(
  db: BrandedDb,
  userId: string,
  role: string,
): Promise<TicketListScope> {
  if (role === 'brand_owner' || role === 'superadmin' || role === 'finance_manager') {
    return { kind: 'brand' };
  }
  if (role === 'cluster_manager') {
    const clusterId = await resolveActorClusterId(db, userId);
    return { kind: 'cluster', clusterId };
  }
  return { kind: 'own', userId };
}

// ---------------------------------------------------------------------------
// GET / — list tickets (RBAC scope)
// ---------------------------------------------------------------------------

issuesRouter.get(
  '/',
  requirePermission('inf.issue.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const q = listQuerySchema.parse(req.query);
      const scope = await deriveTicketScope(req.db, req.user.id, req.user.role);
      const result = await issueTrackerService.list(req.db, {
        scope,
        filters: {
          status: q.status,
          priority: q.priority,
          assigneeUserId: q.assigneeUserId,
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
// POST / — create ticket
// ---------------------------------------------------------------------------

issuesRouter.post(
  '/',
  requirePermission('inf.issue.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = createSchema.parse(req.body);
      const ticket = await issueTrackerService.create(
        req.db,
        {
          originatorUserId: req.user.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeUserId: input.assigneeUserId,
          linkedEntityType: input.linkedEntityType,
          linkedEntityRef: input.linkedEntityRef,
        },
        { actorUserId: req.user.id },
      );
      res.status(201).json(ticket);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:ticketId — full ticket detail
// ---------------------------------------------------------------------------

issuesRouter.get(
  '/:ticketId',
  requirePermission('inf.issue.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const result = await issueTrackerService.get(req.db, param(req.params['ticketId']));
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:ticketId — update ticket (assignee changes need inf.issue.assign too)
// ---------------------------------------------------------------------------

issuesRouter.patch(
  '/:ticketId',
  requirePermission('inf.issue.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = updateSchema.parse(req.body);

      // Inline second-permission guard for assignee changes (route comment above).
      if (input.assigneeUserId !== undefined) {
        const allowed = await permissionService.userHasPermission(
          req.user.id,
          'inf.issue.assign',
        );
        if (!allowed) {
          return next(
            new AuthorizationError({
              code: 'auth.permission_denied',
              message: 'Permission denied: inf.issue.assign',
              httpStatus: 403,
            }),
          );
        }
      }

      const { reasonCode, ...changes } = input;
      const result = await issueTrackerService.update(
        req.db,
        param(req.params['ticketId']),
        changes,
        { actorUserId: req.user.id, reasonCode },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:ticketId/comments — append comment
// ---------------------------------------------------------------------------

issuesRouter.post(
  '/:ticketId/comments',
  requirePermission('inf.issue.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = commentSchema.parse(req.body);
      const result = await issueTrackerService.comment(
        req.db,
        {
          ticketId: param(req.params['ticketId']),
          authorUserId: req.user.id,
          body: input.body,
        },
        { actorUserId: req.user.id },
      );
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:ticketId/attachments — request signed upload URL
// ---------------------------------------------------------------------------

issuesRouter.post(
  '/:ticketId/attachments',
  requirePermission('inf.issue.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = requestAttachmentSchema.parse(req.body);
      const result = await issueTrackerService.requestAttachmentUpload(req.db, {
        ticketId: param(req.params['ticketId']),
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploaderUserId: req.user.id,
      });
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:ticketId/attachments/:attId/confirm — record uploaded attachment
// ---------------------------------------------------------------------------

issuesRouter.patch(
  '/:ticketId/attachments/:attId/confirm',
  requirePermission('inf.issue.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = confirmAttachmentSchema.parse(req.body);
      const result = await issueTrackerService.confirmAttachment(
        req.db,
        {
          ticketId: param(req.params['ticketId']),
          storagePath: input.storagePath,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploaderUserId: req.user.id,
        },
        { actorUserId: req.user.id },
      );
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:ticketId/attachments/:attId/download — signed download URL
// ---------------------------------------------------------------------------

issuesRouter.get(
  '/:ticketId/attachments/:attId/download',
  requirePermission('inf.issue.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const result = await issueTrackerService.getAttachmentDownloadUrl(req.db, {
        ticketId: param(req.params['ticketId']),
        attachmentId: param(req.params['attId']),
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:ticketId/close — convenience PATCH status='closed'
// ---------------------------------------------------------------------------

issuesRouter.post(
  '/:ticketId/close',
  requirePermission('inf.issue.close'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = closeReopenSchema.parse(req.body ?? {});
      const result = await issueTrackerService.update(
        req.db,
        param(req.params['ticketId']),
        { status: 'closed' },
        { actorUserId: req.user.id, reasonCode: input.reasonCode },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:ticketId/reopen — convenience PATCH status='open' (closed → open)
// ---------------------------------------------------------------------------

issuesRouter.post(
  '/:ticketId/reopen',
  requirePermission('inf.issue.close'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = closeReopenSchema.parse(req.body ?? {});
      const result = await issueTrackerService.update(
        req.db,
        param(req.params['ticketId']),
        { status: 'open' },
        { actorUserId: req.user.id, reasonCode: input.reasonCode },
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);
