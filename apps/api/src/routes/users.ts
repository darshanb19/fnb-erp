/**
 * usersRouter — Epic 2 USR CRUD + approval + permission-override endpoints.
 *
 * Mounted at /users (under apiRouter which already carries authMiddleware).
 * Every endpoint adds requirePermission(...) on top.
 *
 * IMPORTANT route ordering:
 *   GET /users/pending-approval  MUST be defined BEFORE GET /users/:id
 *   so Express doesn't match the literal "pending-approval" as an :id param.
 *
 * Self-access exception on GET /users/:id:
 *   If req.params.id === req.user.id we allow without requirePermission to let
 *   any authenticated user read their own profile. Implemented inline with an
 *   early-return guard rather than a custom middleware to keep the pattern
 *   light and localised (DL-030 decision reference).
 *
 * cluster_manager scope on GET /users:
 *   The JWT user_metadata does not currently carry clusterId (deferred to a
 *   later JWT-claim expansion). We resolve the acting user's clusterId via
 *   userService.get() before calling list(). One extra query per request but
 *   keeps the JWT shape unchanged for A7 (noted as a flag for Arc-c cleanup).
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/rbac.js';
import { userService } from '../services/user.service.js';
import { permissionService } from '../services/permission.service.js';
import { permissionOverrideService } from '../services/permission-override.service.js';
import { AuthorizationError } from '../errors/index.js';
import { toValidationError } from '../lib/zod-error.js';
import {
  userCreateSchema,
  userUpdateSchema,
  permissionOverrideGrantSchema,
  permissionOverrideEditSchema,
} from '@fnberp/shared';

export const usersRouter: ExpressRouter = Router();

const reasonSchema = z.object({ reason: z.string().min(3) });

/**
 * Safely coerce an Express route param (typed as `string | string[]` by the
 * Express 5 ParamsDictionary) to a plain string. With multi-handler routes
 * (requirePermission + handler), TypeScript loses the narrow `{ id: string }`
 * inference that single-handler routes get from ParseRouteParameters<>. The
 * cast is safe: named `:params` in route strings always resolve to a single
 * string at runtime; only unnamed `*` patterns can produce `string[]`.
 */
function param(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return p[0] ?? '';
  return p ?? '';
}

// ---------------------------------------------------------------------------
// GET /users — list users (brand or cluster scope)
// ---------------------------------------------------------------------------

usersRouter.get(
  '/',
  requirePermission('usr.users.read'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));

      const { db, user } = req;
      let users;

      if (user.role === 'cluster_manager') {
        // Resolve the acting user's clusterId from the DB (JWT doesn't carry it yet).
        const actor = await userService.get(db, user.id);
        if (!actor.clusterId) {
          // cluster_manager without a clusterId is a data-integrity issue — fail safe.
          return next(new Error('cluster_manager user has no clusterId assigned'));
        }
        users = await userService.list(db, {
          scope: { kind: 'cluster', clusterId: actor.clusterId },
        });
      } else {
        users = await userService.list(db, { scope: { kind: 'brand' } });
      }

      res.json(users);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users — create user
// ---------------------------------------------------------------------------

usersRouter.post(
  '/',
  requirePermission('usr.users.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = userCreateSchema.parse(req.body);
      const user = await userService.create(req.db, input, { actorUserId: req.user.id });
      res.status(201).json(user);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/pending-approval — list pending-approval queue
// MUST come before GET /users/:id to avoid route collision.
// ---------------------------------------------------------------------------

usersRouter.get(
  '/pending-approval',
  requirePermission('usr.accounts.approve'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      res.json(await userService.listPendingApproval(req.db));
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:id — get single user (self-access exception)
// ---------------------------------------------------------------------------

usersRouter.get('/:id', async (req, res, next) => {
  try {
    if (!req.db || !req.user) return next(new Error('auth context missing'));

    const isSelf = param(req.params['id']) === req.user.id;

    if (!isSelf) {
      // Enforce permission check inline — equivalent to requirePermission but
      // allows the self-access short-circuit without middleware composition complexity.
      const allowed = await permissionService.userHasPermission(req.user.id, 'usr.users.read');
      if (!allowed) {
        return next(
          new AuthorizationError({
            code: 'auth.permission_denied',
            message: 'Permission denied: usr.users.read',
            httpStatus: 403,
          }),
        );
      }
    }

    res.json(await userService.get(req.db, param(req.params['id'])));
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// PATCH /users/:id — update user
// ---------------------------------------------------------------------------

usersRouter.patch(
  '/:id',
  requirePermission('usr.users.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const parsed = userUpdateSchema.parse(req.body);
      const { reason, ...rest } = parsed;
      const user = await userService.update(req.db, param(req.params['id']), rest, {
        reasonCode: reason,
        actorUserId: req.user.id,
      });
      res.json(user);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users/:id/approve — approve a pending-approval user
// ---------------------------------------------------------------------------

usersRouter.post(
  '/:id/approve',
  requirePermission('usr.accounts.approve'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const { reason } = reasonSchema.parse(req.body);
      const user = await userService.approve(req.db, param(req.params['id']), {
        reasonCode: reason,
        actorUserId: req.user.id,
      });
      res.json(user);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users/:id/reject — reject a pending-approval user
// ---------------------------------------------------------------------------

usersRouter.post(
  '/:id/reject',
  requirePermission('usr.accounts.approve'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const { reason } = reasonSchema.parse(req.body);
      const user = await userService.reject(req.db, param(req.params['id']), {
        reasonCode: reason,
        actorUserId: req.user.id,
      });
      res.json(user);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /users/:id — deactivate user (soft delete)
// ---------------------------------------------------------------------------

usersRouter.delete(
  '/:id',
  requirePermission('usr.users.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const { reason } = reasonSchema.parse(req.body);
      await userService.deactivate(req.db, param(req.params['id']), {
        reasonCode: reason,
        actorUserId: req.user.id,
      });
      res.status(204).send();
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:id/effective-permissions — effective permission key set
// ---------------------------------------------------------------------------

usersRouter.get(
  '/:id/effective-permissions',
  requirePermission('usr.permissions.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const permissions = await permissionService.getEffectivePermissions(
        req.db,
        param(req.params['id']),
      );
      res.json(permissions);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:id/permission-overrides — list overrides for a single user
// ---------------------------------------------------------------------------

usersRouter.get(
  '/:id/permission-overrides',
  requirePermission('usr.permissions.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const overrides = await permissionOverrideService.listForUser(
        req.db,
        param(req.params['id']),
      );
      res.json(overrides);
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users/:id/permission-overrides — grant or revoke a permission
// ---------------------------------------------------------------------------

usersRouter.post(
  '/:id/permission-overrides',
  requirePermission('usr.permissions.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const input = permissionOverrideGrantSchema.parse(req.body);
      const userId = param(req.params['id']);
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      const overrideInput = {
        userId,
        permissionId: input.permissionId,
        reasonCode: input.reasonCode,
        expiresAt,
      };
      const override =
        input.mode === 'grant'
          ? await permissionOverrideService.grant(req.db, overrideInput, { actorUserId: req.user.id })
          : await permissionOverrideService.revoke(req.db, overrideInput, { actorUserId: req.user.id });
      res.status(201).json(override);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /users/:userId/permission-overrides/:id — edit override
// ---------------------------------------------------------------------------

usersRouter.patch(
  '/:userId/permission-overrides/:id',
  requirePermission('usr.permissions.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      const patch = permissionOverrideEditSchema.parse(req.body);
      const normalisedPatch = {
        reasonCode: patch.reasonCode,
        expiresAt:
          patch.expiresAt !== undefined
            ? patch.expiresAt === null
              ? null
              : new Date(patch.expiresAt)
            : undefined,
      };
      const override = await permissionOverrideService.editOverride(
        req.db,
        param(req.params['id']),
        normalisedPatch,
        { actorUserId: req.user.id },
      );
      res.json(override);
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /users/:userId/permission-overrides/:id — expire override immediately
// ---------------------------------------------------------------------------

usersRouter.delete(
  '/:userId/permission-overrides/:id',
  requirePermission('usr.permissions.write'),
  async (req, res, next) => {
    try {
      if (!req.db || !req.user) return next(new Error('auth context missing'));
      await permissionOverrideService.expireOverride(req.db, param(req.params['id']), {
        actorUserId: req.user.id,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

