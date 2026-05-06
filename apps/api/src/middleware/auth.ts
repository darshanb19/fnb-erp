/**
 * Auth middleware — Task A2
 *
 * Verifies the Supabase JWT from the Authorization: Bearer <token> header.
 * Attaches `req.user = { id, brandId, role }` on success.
 *
 * JWT claim path (architecture §4.2):
 *   sub                            → user id
 *   user_metadata.brand_id         → brand id
 *   user_metadata.role             → role (optional; defaults to 'viewer')
 *
 * Error codes:
 *   auth.token_missing   → 401 (no Authorization header)
 *   auth.token_invalid   → 401 (malformed JWT)
 *   auth.token_expired   → 401 (JWT expired)
 *   auth.brand_id_missing→ 403 (JWT valid but brand_id claim absent)
 *
 * Epic 2 will introduce full RBAC. For Epic 1, any authenticated user is
 * treated as having permission to all endpoints.
 *
 * Architecture §17.11 step 4.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { AuthorizationError } from '../errors/index.js';

interface SupabaseJwtPayload {
  sub: string;
  user_metadata?: {
    brand_id?: string;
    role?: string;
  };
  exp?: number;
  iat?: number;
}

function isSupabaseJwtPayload(payload: unknown): payload is SupabaseJwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>)['sub'] === 'string'
  );
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AuthorizationError({
        code: 'auth.token_missing',
        message: 'Authorization header with Bearer token is required',
        httpStatus: 401,
      }),
    );
  }

  const token = authHeader.slice(7); // strip 'Bearer '

  let payload: unknown;
  try {
    payload = jwt.verify(token, env.SUPABASE_JWT_SECRET);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(
        new AuthorizationError({
          code: 'auth.token_expired',
          message: 'JWT token has expired',
          httpStatus: 401,
        }),
      );
    }
    return next(
      new AuthorizationError({
        code: 'auth.token_invalid',
        message: 'JWT token is invalid or malformed',
        httpStatus: 401,
      }),
    );
  }

  if (!isSupabaseJwtPayload(payload)) {
    return next(
      new AuthorizationError({
        code: 'auth.token_invalid',
        message: 'JWT payload is malformed',
        httpStatus: 401,
      }),
    );
  }

  const brandId = payload.user_metadata?.brand_id;
  if (!brandId) {
    return next(
      new AuthorizationError({
        code: 'auth.brand_id_missing',
        message: 'JWT is valid but brand_id claim is absent — contact support',
        httpStatus: 403,
      }),
    );
  }

  req.user = {
    id: payload.sub,
    brandId,
    role: payload.user_metadata?.role ?? 'viewer',
  };

  next();
}
