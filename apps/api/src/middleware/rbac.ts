/**
 * rbac middleware — Task A5
 *
 * `requirePermission(key)` returns an Express middleware that:
 *   1. Asserts authMiddleware ran (req.user populated).
 *   2. Asks permissionService.userHasPermission(userId, key) — true/false.
 *   3. Calls next() on true; calls next(AuthorizationError 403 auth.permission_denied) on false.
 *
 * Composable with route handlers:
 *   router.get('/users', authMiddleware, requirePermission('usr.users.read'), handler);
 *
 * Per-resource scope filtering (e.g. cluster-level views) is handled in service-layer code,
 * not here. This middleware only checks key existence in the user's effective set.
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../errors/index.js';
import { permissionService } from '../services/permission.service.js';

export function requirePermission(permissionKey: string) {
  return async function requirePermissionMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user) {
      return next(
        new AuthorizationError({
          code: 'auth.token_missing',
          message: 'authMiddleware must run before requirePermission',
          httpStatus: 401,
        }),
      );
    }
    try {
      const allowed = await permissionService.userHasPermission(req.user.id, permissionKey);
      if (!allowed) {
        return next(
          new AuthorizationError({
            code: 'auth.permission_denied',
            message: `Permission denied: ${permissionKey}`,
            httpStatus: 403,
          }),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
