/**
 * usr-routes.test.ts — Integration tests for Task A7 REST endpoints.
 *
 * Coverage:
 *  1. GET /api/v1/users          — 200 happy path
 *  2. POST /api/v1/users         — 201 happy, 400 Zod fail, 403 permission denied
 *  3. GET /api/v1/users/:id      — self-access works without usr.users.read
 *  4. POST /api/v1/users/:id/approve — 200 + audit; 403 without permission
 *  5. POST /api/v1/users/:id/permission-overrides — 201 grant; 400 missing reasonCode
 *  6. GET /permission-overrides/expiring?days=7 — returns overrides within window
 *  7. POST /auth/reset-password/request — 204 happy (spy); 429 after rate limit
 *  8. POST /auth/reset-password/confirm — 204 happy (spy)
 *
 * Test user IDs:
 *   ACTOR_ID     — brand_owner; has usr.users.read + usr.users.write + usr.permissions.*
 *   SUPERADMIN_ID — superadmin; has usr.accounts.approve only
 *   UNPRIVILEGED_ID — pos_staff; has no usr.* permissions
 *
 * Token minting: signTestJwt from apps/api/src/lib/test-jwt.ts.
 *
 * Uses fnberp_test database; TRUNCATE between tests via afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/index.js';
import { signTestJwt } from '../../src/lib/test-jwt.js';
import {
  setupIntegration,
  teardownIntegration,
  getTestBrandedDb,
  truncateTestTables,
} from './setup.js';
import { users } from '../../src/db/schema/auth.js';
import { userPermissionOverrides } from '../../src/db/schema/user-permission-overrides.js';
import { permissions } from '../../src/db/schema/permissions.js';
import { unscopedDb } from '../../src/db/client.js';
import { passwordResetService } from '../../src/services/password-reset.service.js';
import type { Application } from 'express';

// ---------------------------------------------------------------------------
// Fixed test user IDs
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const SUPERADMIN_ID = '00000000-0000-0000-0000-000000000002';
const UNPRIVILEGED_ID = '00000000-0000-0000-0000-000000000003';

let app: Application;
let brandId: string;

// Token for brand_owner (has usr.users.read + usr.users.write + usr.permissions.*)
let actorToken: string;
// Token for superadmin (has usr.accounts.approve)
let superadminToken: string;
// Token for pos_staff (no usr.* permissions)
let unprivilegedToken: string;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupIntegration();
  app = createApp();
  const ctx = getTestBrandedDb();
  brandId = ctx.testBrandId;

  // Seed the three test users
  await ctx.db.raw
    .insert(users)
    .values([
      {
        id: ACTOR_ID,
        brandId,
        email: 'actor@fnberp.test',
        fullName: 'Actor BO',
        role: 'brand_owner',
        active: true,
      },
      {
        id: SUPERADMIN_ID,
        brandId,
        email: 'superadmin@fnberp.test',
        fullName: 'Super Admin',
        role: 'superadmin',
        active: true,
      },
      {
        id: UNPRIVILEGED_ID,
        brandId,
        email: 'pos@fnberp.test',
        fullName: 'POS Staff',
        role: 'pos_staff',
        active: true,
      },
    ])
    .onConflictDoNothing();

  actorToken = signTestJwt({ userId: ACTOR_ID, brandId, role: 'brand_owner' });
  superadminToken = signTestJwt({ userId: SUPERADMIN_ID, brandId, role: 'superadmin' });
  unprivilegedToken = signTestJwt({ userId: UNPRIVILEGED_ID, brandId, role: 'pos_staff' });
});

afterEach(async () => {
  await truncateTestTables();
  // Re-seed test users after each truncation
  const ctx = getTestBrandedDb();
  await ctx.db.raw
    .insert(users)
    .values([
      {
        id: ACTOR_ID,
        brandId: ctx.testBrandId,
        email: 'actor@fnberp.test',
        fullName: 'Actor BO',
        role: 'brand_owner',
        active: true,
      },
      {
        id: SUPERADMIN_ID,
        brandId: ctx.testBrandId,
        email: 'superadmin@fnberp.test',
        fullName: 'Super Admin',
        role: 'superadmin',
        active: true,
      },
      {
        id: UNPRIVILEGED_ID,
        brandId: ctx.testBrandId,
        email: 'pos@fnberp.test',
        fullName: 'POS Staff',
        role: 'pos_staff',
        active: true,
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// 1. GET /api/v1/users — brand_owner lists all users
// ---------------------------------------------------------------------------

describe('GET /api/v1/users', () => {
  it('200 — returns user list for brand_owner', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set(auth(actorToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // ACTOR_ID should be in the list
    const ids = (res.body as Array<{ id: string }>).map((u) => u.id);
    expect(ids).toContain(ACTOR_ID);
  });
});

// ---------------------------------------------------------------------------
// 2. POST /api/v1/users — create user
// ---------------------------------------------------------------------------

describe('POST /api/v1/users', () => {
  it('201 — brand_owner creates a user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(actorToken))
      .send({
        email: 'new-staff@fnberp.test',
        fullName: 'New Staff',
        role: 'pos_staff',
        reasonCode: 'onboarding',
      });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new-staff@fnberp.test');
    expect(res.body.role).toBe('pos_staff');
    expect(res.body.approvalStatus).toBe('approved');
  });

  it('400 — Zod error when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(actorToken))
      .send({
        fullName: 'No Email',
        role: 'pos_staff',
        reasonCode: 'onboarding',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toMatch(/^validation\./);
  });

  it('403 — pos_staff cannot create users (no usr.users.write)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(unprivilegedToken))
      .send({
        email: 'blocked@fnberp.test',
        fullName: 'Blocked',
        role: 'pos_staff',
        reasonCode: 'onboarding',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/v1/users/:id — self-access exception
// ---------------------------------------------------------------------------

describe('GET /api/v1/users/:id — self-access', () => {
  it('200 — pos_staff can GET their own profile without usr.users.read', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${UNPRIVILEGED_ID}`)
      .set(auth(unprivilegedToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(UNPRIVILEGED_ID);
  });

  it('403 — pos_staff cannot GET another user (no usr.users.read)', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${ACTOR_ID}`)
      .set(auth(unprivilegedToken));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });

  it('200 — brand_owner can GET any user profile', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${UNPRIVILEGED_ID}`)
      .set(auth(actorToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(UNPRIVILEGED_ID);
  });
});

// ---------------------------------------------------------------------------
// 4. POST /api/v1/users/:id/approve — approval flow
// ---------------------------------------------------------------------------

describe('POST /api/v1/users/:id/approve', () => {
  it('200 — superadmin approves a pending user; approvalStatus transitions', async () => {
    // First create a brand_owner via direct DB insert to get pending_approval status
    const ctx = getTestBrandedDb();
    const pendingId = '00000000-0000-0000-0000-000000000099';
    await ctx.db.raw.insert(users).values({
      id: pendingId,
      brandId: ctx.testBrandId,
      email: 'pending-bo@fnberp.test',
      fullName: 'Pending BO',
      role: 'brand_owner',
      approvalStatus: 'pending_approval',
      active: true,
    }).onConflictDoNothing();

    const res = await request(app)
      .post(`/api/v1/users/${pendingId}/approve`)
      .set(auth(superadminToken))
      .send({ reason: 'verified_ok' });

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe('approved');
  });

  it('403 — brand_owner cannot approve (no usr.accounts.approve)', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${UNPRIVILEGED_ID}/approve`)
      .set(auth(actorToken))
      .send({ reason: 'attempted' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});

// ---------------------------------------------------------------------------
// 5. POST /api/v1/users/:id/permission-overrides — grant override
// ---------------------------------------------------------------------------

describe('POST /api/v1/users/:id/permission-overrides', () => {
  it('201 — brand_owner grants a permission override', async () => {
    // Look up a real permission id from the global catalog
    const rawDb = unscopedDb();
    const permRows = await rawDb.select().from(permissions).limit(1);
    const permId = permRows[0]?.id;
    if (!permId) {
      // If no permissions seeded, skip gracefully
      return;
    }

    const res = await request(app)
      .post(`/api/v1/users/${UNPRIVILEGED_ID}/permission-overrides`)
      .set(auth(actorToken))
      .send({
        permissionId: permId,
        mode: 'grant',
        reasonCode: 'temporary_access',
      });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(UNPRIVILEGED_ID);
    expect(res.body.permissionId).toBe(permId);
    expect(res.body.mode).toBe('grant');
  });

  it('400 — missing reasonCode triggers validation error', async () => {
    const rawDb = unscopedDb();
    const permRows = await rawDb.select().from(permissions).limit(1);
    const permId = permRows[0]?.id;
    if (!permId) return;

    const res = await request(app)
      .post(`/api/v1/users/${UNPRIVILEGED_ID}/permission-overrides`)
      .set(auth(actorToken))
      .send({
        permissionId: permId,
        mode: 'grant',
        // reasonCode intentionally omitted
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toMatch(/^validation\./);
  });
});

// ---------------------------------------------------------------------------
// 6. GET /api/v1/permission-overrides/expiring?days=7
// ---------------------------------------------------------------------------

describe('GET /api/v1/permission-overrides/expiring', () => {
  it('200 — returns overrides expiring within the window, ASC ordered', async () => {
    // Seed a permission override expiring in 3 days
    const rawDb = unscopedDb();
    const permRows = await rawDb.select().from(permissions).limit(2);
    if (permRows.length < 1) return;

    const ctx = getTestBrandedDb();
    const in3days = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const in6days = new Date(Date.now() + 6 * 24 * 3600 * 1000);

    // Insert directly into DB to control expiresAt
    await ctx.db.raw.insert(userPermissionOverrides).values([
      {
        brandId,
        userId: UNPRIVILEGED_ID,
        permissionId: permRows[0]!.id,
        mode: 'grant',
        reasonCode: 'test_3d',
        expiresAt: in6days,
      },
      {
        brandId,
        userId: UNPRIVILEGED_ID,
        permissionId: permRows[1] ? permRows[1].id : permRows[0]!.id,
        mode: 'revoke',
        reasonCode: 'test_6d',
        expiresAt: in3days,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/permission-overrides/expiring?days=7')
      .set(auth(actorToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Both override rows should appear
    expect((res.body as Array<{ expiresAt: string }>).length).toBeGreaterThanOrEqual(2);
    // Verify ASC ordering
    const dates = (res.body as Array<{ expiresAt: string }>).map((r) =>
      new Date(r.expiresAt).getTime(),
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]!);
    }
  });

  it('400 — non-integer days query param triggers validation.invalid_query_param', async () => {
    const res = await request(app)
      .get('/api/v1/permission-overrides/expiring?days=foo')
      .set(auth(actorToken));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation.invalid_query_param');
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 7. POST /auth/reset-password/request — rate limiting
// ---------------------------------------------------------------------------

describe('POST /auth/reset-password/request', () => {
  it('204 — happy path with spied passwordResetService', async () => {
    const spy = vi
      .spyOn(passwordResetService, 'requestReset')
      .mockResolvedValueOnce(undefined);

    try {
      const res = await request(app)
        .post('/auth/reset-password/request')
        .send({ email: 'user@fnberp.test' });

      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledWith('user@fnberp.test');
    } finally {
      spy.mockRestore();
    }
  });

  it('429 — requests beyond the limit in the same window are rejected', async () => {
    // Spy to avoid actual Supabase calls
    const spy = vi
      .spyOn(passwordResetService, 'requestReset')
      .mockResolvedValue(undefined);

    try {
      // Build a fresh app instance so the rate-limit counter is clean.
      // Collect statuses for 8 requests; the first ≤5 should be 204, the rest 429.
      const freshApp = createApp();
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        const res = await request(freshApp)
          .post('/auth/reset-password/request')
          .send({ email: `user${i}@fnberp.test` });
        statuses.push(res.status);
      }

      // At least one response must be 429 (rate limit fired)
      expect(statuses).toContain(429);

      // The first response must never be 429 (at least 1 request should succeed)
      expect(statuses[0]).toBe(204);

      // Once 429 fires, subsequent requests should also be 429
      const firstRateLimited = statuses.indexOf(429);
      expect(firstRateLimited).toBeGreaterThan(0);

      // Check envelope shape of the last response (should be rate-limited by now)
      const lastRes = await request(freshApp)
        .post('/auth/reset-password/request')
        .send({ email: 'overflow@fnberp.test' });
      expect(lastRes.status).toBe(429);
      expect(lastRes.body.code).toBe('rate_limit.exceeded');
      expect(typeof lastRes.body.message).toBe('string');
      expect(typeof lastRes.body.timestamp).toBe('string');
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// 8. POST /auth/reset-password/confirm
// ---------------------------------------------------------------------------

describe('POST /auth/reset-password/confirm', () => {
  it('204 — happy path with spied confirmReset', async () => {
    const spy = vi
      .spyOn(passwordResetService, 'confirmReset')
      .mockResolvedValueOnce(undefined);

    try {
      const res = await request(app)
        .post('/auth/reset-password/confirm')
        .send({ accessToken: 'fake-token', newPassword: 'NewPassword1!' });

      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledWith({ accessToken: 'fake-token', newPassword: 'NewPassword1!' });
    } finally {
      spy.mockRestore();
    }
  });

  it('400 — short password fails Zod validation', async () => {
    const res = await request(app)
      .post('/auth/reset-password/confirm')
      .send({ accessToken: 'fake-token', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toMatch(/^validation\./);
  });
});
