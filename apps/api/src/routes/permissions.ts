/**
 * permissionsRouter — read-only permissions catalog.
 *
 * Mounted at /permissions under apiRouter. Exposes the
 * `permissionService.listPermissions()` catalog so the frontend
 * (SI-USR-006 grant/revoke form) can render a permission picker
 * without re-defining the seed.
 *
 * No mutating endpoints in MVP (DL-031 — custom role builder + per-permission
 * editing both post-MVP). Reads are gated by `usr.permissions.read` so the
 * catalog endpoint mirrors the gate on /users/:id/effective-permissions.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { permissionService } from '../services/permission.service.js';

export const permissionsRouter: ExpressRouter = Router();

permissionsRouter.get(
  '/',
  requirePermission('usr.permissions.read'),
  async (_req, res, next) => {
    try {
      res.json(await permissionService.listPermissions());
    } catch (e) {
      next(e);
    }
  },
);
