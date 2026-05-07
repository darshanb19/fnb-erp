/**
 * test-jwt — sign a JWT for integration tests.
 *
 * Uses SUPABASE_JWT_SECRET from env (defaults to 'test-secret-do-not-use-in-prod'
 * when NODE_ENV=test). Do NOT import this file in production code.
 */

import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export function signTestJwt(opts: { userId: string; brandId: string; role?: string }): string {
  return jwt.sign(
    {
      sub: opts.userId,
      user_metadata: {
        brand_id: opts.brandId,
        role: opts.role ?? 'brand_owner',
      },
    },
    env.SUPABASE_JWT_SECRET,
    { expiresIn: '1h' },
  );
}
