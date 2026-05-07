/**
 * permissionOverridesRouter — global permission-override listing endpoints.
 *
 * Mounted at /permission-overrides (under apiRouter).
 * User-scoped override endpoints (grant, revoke, edit, expire) live in usersRouter
 * under /users/:id/permission-overrides/* to keep resource nesting clean.
 *
 * This router handles cross-user aggregate views:
 *   GET /permission-overrides/expiring?days=N
 */

import { Router, type Router as ExpressRouter } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { permissionOverrideService } from '../services/permission-override.service.js';
import { ValidationError } from '../errors/index.js';

export const permissionOverridesRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// GET /permission-overrides/expiring?days=N
// Lists overrides expiring within the next N days (default 30). ASC ordered.
// ---------------------------------------------------------------------------

permissionOverridesRouter.get(
  '/expiring',
  requirePermission('usr.permissions.read'),
  async (req, res, next) => {
    try {
      if (!req.db) return next(new Error('req.db missing'));
      const rawDays = req.query['days'];
      const days = rawDays !== undefined ? parseInt(String(rawDays), 10) : 30;
      if (isNaN(days) || days < 1) {
        return next(
          new ValidationError({
            code: 'validation.invalid_query_param',
            message: 'days must be a positive integer',
          }),
        );
      }
      const overrides = await permissionOverrideService.listExpiringSoon(req.db, days);
      res.json(overrides);
    } catch (e) {
      next(e);
    }
  },
);
