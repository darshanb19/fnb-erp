/**
 * authRouter — public password-reset endpoints.
 *
 * IMPORTANT: This router carries NO authMiddleware and NO requirePermission.
 * It MUST be mounted in apps/api/src/index.ts ABOVE the auth middleware chain
 * (i.e., before `app.use(authMiddleware)`), so it can serve unauthenticated requests.
 *
 * Endpoints:
 *   POST /auth/reset-password/request   — rate-limited (5 req/min per IP)
 *   POST /auth/reset-password/confirm   — token-gated (Supabase magic link token)
 *
 * Rate limiting defends against email-spam abuse of the reset flow.
 * No rate limit on /confirm — the one-time Supabase token is the gate.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit.js';
import { passwordResetService } from '../services/password-reset.service.js';
import { toValidationError } from '../lib/zod-error.js';
import {
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from '@fnberp/shared';

export const authRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// POST /auth/reset-password/request
// Rate limited: 5 requests per minute per IP.
// Returns 204 No Content regardless of whether the email exists (security best
// practice — don't reveal whether an email is registered).
// ---------------------------------------------------------------------------

authRouter.post(
  '/reset-password/request',
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);
      await passwordResetService.requestReset(email);
      res.status(204).send();
    } catch (e) {
      if (e instanceof z.ZodError) return next(toValidationError(e));
      next(e);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /auth/reset-password/confirm
// No rate limit — the Supabase access token is a one-time gate.
// Returns 204 No Content on success.
// ---------------------------------------------------------------------------

authRouter.post('/reset-password/confirm', async (req, res, next) => {
  try {
    const input = passwordResetConfirmSchema.parse(req.body);
    await passwordResetService.confirmReset(input);
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e));
    next(e);
  }
});
