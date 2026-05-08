/**
 * Auth middleware — Task A2 (tightened in Task A5; dual-path verification added pre-C1)
 *
 * Verifies the Supabase JWT from the Authorization: Bearer <token> header.
 * Attaches `req.user = { id, brandId, role }` on success.
 *
 * Dual-path verification (pre-C1, 2026-05-08):
 *   - NODE_ENV=test     → HS256 + env.SUPABASE_JWT_SECRET (jsonwebtoken.verify).
 *                         The integration suite mints tokens via signTestJwt
 *                         (apps/api/src/lib/test-jwt.ts) which uses the same
 *                         shared secret + HS256.
 *   - NODE_ENV=dev|prod → ES256 + JWKS fetched from
 *                         `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
 *                         via jose.createRemoteJWKSet (caches keys internally).
 *                         Mumbai Supabase Auth (modern publishable-key flow)
 *                         issues asymmetric ES256-signed JWTs.
 *
 * JWT claim path (architecture §4.2):
 *   sub                            → user id
 *   user_metadata.brand_id         → brand id
 *   user_metadata.role             → role (REQUIRED — userRoleEnum value;
 *                                          missing → auth.role_missing 403)
 *
 * Error codes:
 *   auth.token_missing   → 401 (no Authorization header)
 *   auth.token_invalid   → 401 (malformed JWT)
 *   auth.token_expired   → 401 (JWT expired)
 *   auth.brand_id_missing→ 403 (JWT valid but brand_id claim absent)
 *   auth.role_missing    → 403 (JWT valid but role claim absent)
 *
 * Authorization layered on top: see `requirePermission` in `./rbac.ts`.
 *
 * Architecture §17.11 step 4.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  createRemoteJWKSet,
  jwtVerify,
  errors as joseErrors,
  type JWTPayload,
} from 'jose';
import { env } from '../env.js';
import { AuthorizationError } from '../errors/index.js';
import type { UserRole } from '../db/schema/auth.js';

interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  user_metadata?: {
    brand_id?: string;
    role?: string;
  };
}

function isSupabaseJwtPayload(payload: unknown): payload is SupabaseJwtPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>)['sub'] === 'string'
  );
}

// Lazy-init JWKS client — created once on first non-test verify and reused.
// jose's createRemoteJWKSet caches keys internally with sensible defaults.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

async function verifyToken(token: string): Promise<SupabaseJwtPayload> {
  if (env.NODE_ENV === 'test') {
    // HS256 path — test helper (signTestJwt) mints with SUPABASE_JWT_SECRET.
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET);
    if (!isSupabaseJwtPayload(payload)) {
      throw new Error('JWT payload is malformed');
    }
    return payload;
  }
  // ES256/JWKS path — Mumbai Supabase Auth (dev + prod).
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ['ES256'],
  });
  if (!isSupabaseJwtPayload(payload)) {
    throw new Error('JWT payload is malformed');
  }
  return payload;
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

  verifyToken(token)
    .then((payload) => {
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

      const role = payload.user_metadata?.role;
      if (!role) {
        return next(
          new AuthorizationError({
            code: 'auth.role_missing',
            message: 'JWT is valid but role claim is absent — contact support',
            httpStatus: 403,
          }),
        );
      }

      req.user = {
        id: payload.sub,
        brandId,
        role: role as UserRole,
      };

      next();
    })
    .catch((err: unknown) => {
      if (
        err instanceof joseErrors.JWTExpired ||
        (err instanceof Error && err.name === 'TokenExpiredError')
      ) {
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
    });
}
