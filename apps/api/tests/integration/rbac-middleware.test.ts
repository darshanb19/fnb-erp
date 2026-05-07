/**
 * rbac-middleware.test.ts — Task A5
 *
 * Pure middleware tests for `requirePermission` and the auth.ts role-claim
 * tightening. No DB involved — bootstraps a minimal express() app per test.
 *
 * A6 will add comprehensive tests once `permissionService.userHasPermission`
 * has a real implementation. For A5, the stub returns false so we verify:
 *  1. requirePermission denies when authMiddleware did NOT run.
 *  2. requirePermission denies (403 + auth.permission_denied) when stub returns false.
 *  3. requirePermission passes through when stub is mocked to return true.
 *  4. authMiddleware rejects (403 + auth.role_missing) when JWT lacks role claim.
 */

import { describe, it, expect, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../src/middleware/auth.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { requirePermission } from '../../src/middleware/rbac.js';
import { permissionService } from '../../src/services/permission.service.js';
import { signTestJwt } from '../../src/lib/test-jwt.js';
import { env } from '../../src/env.js';

function buildApp(opts: { withAuth: boolean; permissionKey: string }): Application {
  const app = express();
  app.use(express.json());
  const handlers: express.RequestHandler[] = [];
  if (opts.withAuth) handlers.push(authMiddleware);
  handlers.push(requirePermission(opts.permissionKey));
  app.get('/test', ...handlers, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('requirePermission middleware', () => {
  it('denies with 401 + auth.token_missing when authMiddleware did NOT run', async () => {
    const app = buildApp({ withAuth: false, permissionKey: 'mdm.products.read' });
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth.token_missing');
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('denies with 403 + auth.permission_denied when stub returns false', async () => {
    const app = buildApp({ withAuth: true, permissionKey: 'mdm.products.read' });
    const token = signTestJwt({
      userId: '00000000-0000-0000-0000-000000000001',
      brandId: '00000000-0000-0000-0000-000000000aaa',
      role: 'brand_owner',
    });
    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
    expect(res.body.message).toContain('mdm.products.read');
  });

  it('passes through (200) when stub is mocked to return true', async () => {
    const spy = vi
      .spyOn(permissionService, 'userHasPermission')
      .mockResolvedValueOnce(true);
    try {
      const app = buildApp({ withAuth: true, permissionKey: 'mdm.products.read' });
      const token = signTestJwt({
        userId: '00000000-0000-0000-0000-000000000001',
        brandId: '00000000-0000-0000-0000-000000000aaa',
        role: 'brand_owner',
      });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        'mdm.products.read',
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('authMiddleware role-claim tightening (Task A5)', () => {
  it('rejects with 403 + auth.role_missing when JWT lacks role claim', async () => {
    // Sign a JWT manually (signTestJwt always sets a role) WITHOUT user_metadata.role.
    const tokenWithoutRole = jwt.sign(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        user_metadata: {
          brand_id: '00000000-0000-0000-0000-000000000aaa',
          // role intentionally omitted
        },
      },
      env.SUPABASE_JWT_SECRET,
      { expiresIn: '1h' },
    );

    const app = buildApp({ withAuth: true, permissionKey: 'mdm.products.read' });
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${tokenWithoutRole}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.role_missing');
    expect(typeof res.body.message).toBe('string');
  });
});
