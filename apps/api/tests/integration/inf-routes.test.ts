/**
 * inf-routes.test.ts — Integration smoke tests for Task A11 REST endpoints.
 *
 * Coverage (10 tests = 5 happy + 5 denial, one per router):
 *   1. GET  /api/v1/approvals/inbox            200 (BO) + 403 (POS)
 *   2. GET  /api/v1/notifications              200 (BO) + 403 (POS without inf.notification.read)
 *   3. GET  /api/v1/audit/events               200 (BO) + 403 (POS)
 *   4. GET  /api/v1/issues                     200 (BO) + 403 (POS without inf.issue.read)
 *   5. GET  /api/v1/broadcasts                 200 (BO) + 403 (POS without inf.broadcast.read)
 *
 * Wait — POS DOES have inf.notification.read / inf.issue.read / inf.broadcast.read
 * per migration 0010 baselines. So the "denial" case for those routes targets
 * a permission only BO has: inf.broadcast.compose / inf.audit.export /
 * inf.approval.configure_chains. We choose endpoints carefully to keep one
 * denial per router.
 *
 * Updated coverage:
 *   1. GET  /api/v1/approvals/inbox             200 (POS has inf.approval.read) + we use chains GET for 403
 *   2. GET  /api/v1/notifications               200 (POS) — denial via PATCH preferences-write, but POS
 *                                                also has preferences.write per baseline. Use a different
 *                                                approach: POS DOES have inf.notification.read +
 *                                                preferences.write. So instead test 403 via a different
 *                                                router (or with an unprivileged role). We use UNPRIVILEGED_ID
 *                                                with a role lacking that permission — but POS HAS read.
 *                                                So we test happy path on POS and denial of compose-only
 *                                                endpoints (inf.broadcast.compose, inf.audit.export,
 *                                                inf.approval.configure_chains, inf.issue.assign).
 *
 * Final test selection — happy path and denial picked to match the role baselines
 * in migration 0010:
 *   - POS staff has: inf.approval.{read,write}, inf.notification.{read,prefs.write},
 *     inf.issue.{read,write,close}, inf.broadcast.read.
 *   - BO has all inf.*.
 *
 * So for denial we pick endpoints requiring permissions POS does NOT have:
 *   approvals — GET /chains       requires inf.approval.configure_chains
 *   audit     — GET /events       requires inf.audit.read   (POS lacks)
 *   broadcasts— GET /sent         requires inf.broadcast.compose
 *   issues    — denial: there is no POS-blocked GET; PATCH with assigneeUserId blocks via inf.issue.assign
 *               but PATCH needs inf.issue.write first. Use a DIFFERENT 403 lever: a role 'pos_staff'
 *               can't list with the assignee filter. Simpler: test denial via an unprivileged route
 *               we know POS doesn't have — ANSWER: use POST /api/v1/issues/:id/attachments via UNPRIVILEGED_ID
 *               under a role that has no inf.issue.write. POS HAS inf.issue.write. So we craft a
 *               minimal-perms test user without inf.* → falls back to baseline-grant lookup.
 *
 * To keep this test sane, we use TWO tokens:
 *   actorToken  — brand_owner, full inf.* access
 *   posToken    — pos_staff, baseline inf.* access (limited, see above)
 *
 * Denials hit endpoints that pos_staff does NOT have permission for:
 *   - GET  /api/v1/approvals/chains            403 (pos lacks inf.approval.configure_chains)
 *   - GET  /api/v1/audit/events                403 (pos lacks inf.audit.read)
 *   - GET  /api/v1/broadcasts/sent             403 (pos lacks inf.broadcast.compose)
 *   - PATCH /api/v1/notifications/preferences/X with body 403 — pos HAS this; instead use a
 *     non-inf permission. Switch tactic: there is no notifications-only denial that POS fails;
 *     we use issues PATCH assignee change → POS lacks inf.issue.assign → 403.
 *   - For notifications denial, use the only inf.notification.* lever POS lacks — there isn't one.
 *     So we use the actor token for happy path + denial for notifications via:
 *     UNPRIVILEGED_ID could be a role without inf.notification.read, but EVERY MVP role has it
 *     per migration 0010. That's the seeded baseline. We accept that notifications has
 *     no clean denial test in MVP and instead replace it with a SECOND issues denial.
 *
 * Final 10:
 *   1. GET  /api/v1/approvals/inbox            200 actor
 *   2. GET  /api/v1/approvals/chains           403 pos     (lacks configure_chains)
 *   3. GET  /api/v1/notifications              200 actor
 *   4. GET  /api/v1/audit/events               200 actor
 *   5. GET  /api/v1/audit/events               403 pos     (lacks inf.audit.read)
 *   6. GET  /api/v1/issues                     200 actor
 *   7. PATCH /api/v1/issues/<uuid>             403 pos     (assignee change → lacks inf.issue.assign)
 *   8. GET  /api/v1/broadcasts                 200 actor
 *   9. GET  /api/v1/broadcasts/sent            403 pos     (lacks inf.broadcast.compose)
 *  10. GET  /api/v1/notifications/preferences  200 actor
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
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
import type { Application } from 'express';

const ACTOR_ID = '00000000-0000-0000-0000-00000000a001';
const POS_ID = '00000000-0000-0000-0000-00000000a002';
const FAKE_TICKET_ID = '00000000-0000-0000-0000-00000000ffff';

let app: Application;
let brandId: string;
let actorToken: string;
let posToken: string;

beforeAll(async () => {
  await setupIntegration();
  app = createApp();
  const ctx = getTestBrandedDb();
  brandId = ctx.testBrandId;

  await ctx.db.raw
    .insert(users)
    .values([
      {
        id: ACTOR_ID,
        brandId,
        email: 'inf-actor@fnberp.test',
        fullName: 'INF Actor BO',
        role: 'brand_owner',
        active: true,
      },
      {
        id: POS_ID,
        brandId,
        email: 'inf-pos@fnberp.test',
        fullName: 'INF POS Staff',
        role: 'pos_staff',
        active: true,
      },
    ])
    .onConflictDoNothing();

  actorToken = signTestJwt({ userId: ACTOR_ID, brandId, role: 'brand_owner' });
  posToken = signTestJwt({ userId: POS_ID, brandId, role: 'pos_staff' });
});

afterEach(async () => {
  await truncateTestTables();
  // Re-seed users so subsequent tests can run
  const ctx = getTestBrandedDb();
  await ctx.db.raw
    .insert(users)
    .values([
      {
        id: ACTOR_ID,
        brandId: ctx.testBrandId,
        email: 'inf-actor@fnberp.test',
        fullName: 'INF Actor BO',
        role: 'brand_owner',
        active: true,
      },
      {
        id: POS_ID,
        brandId: ctx.testBrandId,
        email: 'inf-pos@fnberp.test',
        fullName: 'INF POS Staff',
        role: 'pos_staff',
        active: true,
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await teardownIntegration();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// 1. approvals
// ---------------------------------------------------------------------------

describe('approvals routes', () => {
  it('GET /api/v1/approvals/inbox — 200 for brand_owner', async () => {
    const res = await request(app).get('/api/v1/approvals/inbox').set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/approvals/chains — 403 for pos_staff (lacks configure_chains)', async () => {
    const res = await request(app).get('/api/v1/approvals/chains').set(auth(posToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});

// ---------------------------------------------------------------------------
// 2. notifications
// ---------------------------------------------------------------------------

describe('notifications routes', () => {
  it('GET /api/v1/notifications — 200 for brand_owner', async () => {
    const res = await request(app).get('/api/v1/notifications').set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('GET /api/v1/notifications/preferences — 200 for brand_owner', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/preferences')
      .set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. audit
// ---------------------------------------------------------------------------

describe('audit routes', () => {
  it('GET /api/v1/audit/events — 200 for brand_owner', async () => {
    const res = await request(app).get('/api/v1/audit/events').set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('GET /api/v1/audit/events — 403 for pos_staff (lacks inf.audit.read)', async () => {
    const res = await request(app).get('/api/v1/audit/events').set(auth(posToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});

// ---------------------------------------------------------------------------
// 4. issues
// ---------------------------------------------------------------------------

describe('issues routes', () => {
  it('GET /api/v1/issues — 200 for brand_owner', async () => {
    const res = await request(app).get('/api/v1/issues').set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
  });

  it('PATCH /api/v1/issues/:id (with assigneeUserId) — 403 for pos_staff (lacks inf.issue.assign)', async () => {
    const res = await request(app)
      .patch(`/api/v1/issues/${FAKE_TICKET_ID}`)
      .set(auth(posToken))
      .send({ assigneeUserId: ACTOR_ID });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});

// ---------------------------------------------------------------------------
// 5. broadcasts
// ---------------------------------------------------------------------------

describe('broadcasts routes', () => {
  it('GET /api/v1/broadcasts — 200 for brand_owner', async () => {
    const res = await request(app).get('/api/v1/broadcasts').set(auth(actorToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/broadcasts/sent — 403 for pos_staff (lacks inf.broadcast.compose)', async () => {
    const res = await request(app).get('/api/v1/broadcasts/sent').set(auth(posToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('auth.permission_denied');
  });
});
