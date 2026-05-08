/**
 * notificationsRouter — Phase 4 Epic 3 INF Arc (a) Task A11.
 *
 * Mounted at /api/v1/notifications.
 *
 * Endpoint surface:
 *   GET    /                          inf.notification.read              — caller's notifications (cursor-paginated)
 *   POST   /:notificationId/seen      inf.notification.read              — mark seen
 *   POST   /seen-all                  inf.notification.read              — mark all unseen as seen
 *   GET    /preferences               inf.notification.read              — caller's preference rows merged with type_config
 *   PATCH  /preferences/:type         inf.notification.preferences.write — UPSERT a single preference
 *   GET    /digest/preview            inf.notification.read              — caller's digest preview (DL-035: empty in MVP)
 *
 * Notes:
 *   - All endpoints scope to req.user.id at the route layer; no body field can
 *     spoof another user's id.
 *   - Cursor pagination passes ?cursor + ?limit through to the service which
 *     returns `{ items, nextCursor }`.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac.js';
import { notificationCenter } from '../services/notification-center.service.js';
import { toValidationError } from '../lib/zod-error.js';
import { param } from '../lib/route-helpers.js';

export const notificationsRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  unseenOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  limit: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  cursor: z.string().optional(),
});

const preferencesPatchSchema = z.object({
  inAppOverride: z.boolean().nullish(),
  emailOverride: z.boolean().nullish(),
  digestBatchOverride: z.boolean().nullish(),
  quietHoursStart: z.string().nullish(),
  quietHoursEnd: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// GET / — list caller notifications
// ---------------------------------------------------------------------------

notificationsRouter.get(
  '/',
  requirePermission('inf.notification.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const q = listQuerySchema.parse(req.query);
      const result = await notificationCenter.list(req.db, {
        userId: req.user.id,
        unseenOnly: q.unseenOnly,
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
// POST /seen-all — mark all unseen as seen
// MUST come before POST /:notificationId/seen so the literal "seen-all" doesn't
// match :notificationId (defense-in-depth — different methods + paths but the
// router is checked top-to-bottom and we want the precedence explicit).
// ---------------------------------------------------------------------------

notificationsRouter.post(
  '/seen-all',
  requirePermission('inf.notification.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const updated = await notificationCenter.markAllSeen(req.db, { userId: req.user.id });
      res.json({ updated });
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:notificationId/seen — mark single notification seen
// ---------------------------------------------------------------------------

notificationsRouter.post(
  '/:notificationId/seen',
  requirePermission('inf.notification.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      await notificationCenter.markSeen(req.db, {
        notificationId: param(req.params['notificationId']),
        userId: req.user.id,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /preferences — caller's per-type preference rows
// ---------------------------------------------------------------------------

notificationsRouter.get(
  '/preferences',
  requirePermission('inf.notification.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const prefs = await notificationCenter.getPreferences(req.db, { userId: req.user.id });
      res.json(prefs);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /preferences/:type — UPSERT a single preference row
// ---------------------------------------------------------------------------

notificationsRouter.patch(
  '/preferences/:type',
  requirePermission('inf.notification.preferences.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const prefs = preferencesPatchSchema.parse(req.body);
      const result = await notificationCenter.savePreferences(
        req.db,
        {
          userId: req.user.id,
          type: param(req.params['type']),
          prefs,
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
// GET /digest/preview — caller's digest preview
// DL-035 invariant: returns { startedAt: null, items: [] } in MVP because no
// type_config row has emailMode='digest'. Implementation is correct for the
// post-MVP code path.
// ---------------------------------------------------------------------------

notificationsRouter.get(
  '/digest/preview',
  requirePermission('inf.notification.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const result = await notificationCenter.getDigestPreview(req.db, { userId: req.user.id });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
