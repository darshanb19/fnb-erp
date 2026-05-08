/**
 * approval-chain-config.test.ts — Phase 4 Epic 3 INF Arc (a) Task A7.
 *
 * Integration tests for approvalEngine.configureChain + listChains.
 * DL-036: BO-driven chain editor; status transitions enforced.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { ValidationError } from '../../src/errors/index.js';

// Note: vi.mock is hoisted by Vitest to the top of the module regardless of
// where it's written, so the import-after-mock ordering below is purely
// cosmetic — the mock is registered before any import resolves.
vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

import { approvalEngine } from '../../src/services/approval-engine.service.js';

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

async function createBO(brandId: string): Promise<string> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: `bo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      fullName: 'Chain Editor BO',
      role: 'brand_owner',
      approvalStatus: 'approved',
    })
    .returning();
  if (!u) throw new Error('Failed to create BO');
  return u.id;
}

describe('approvalEngine.configureChain', () => {
  it('creates a draft chain → row inserted, audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const chain = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'Custom PO Chain',
        description: 'Initial draft',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 100000, escalationTimeoutMinutes: 1440 }],
        // status omitted → defaults to 'draft'
        reasonCode: 'initial_draft',
      },
      { actorUserId: bo },
    );

    expect(chain.status).toBe('draft');
    expect(chain.entityType).toBe('po_threshold');
    expect(chain.name).toBe('Custom PO Chain');

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, chain.id));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0]!.action).toBe('insert');
    expect(auditRows[0]!.tableName).toBe('approval_chains');
  });

  it('activate transition (draft → active) → status="active", audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const draft = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'Promotable Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );
    expect(draft.status).toBe('draft');

    const activated = await approvalEngine.configureChain(
      db,
      {
        id: draft.id,
        entityType: 'po_threshold',
        name: 'Promotable Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
        status: 'active',
        reasonCode: 'ready_for_use',
      },
      { actorUserId: bo },
    );

    expect(activated.status).toBe('active');

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, draft.id));
    expect(auditRows.length).toBeGreaterThanOrEqual(2); // insert + update
    const updateAudit = auditRows.find((r) => r.action === 'update');
    expect(updateAudit).toBeDefined();
    expect((updateAudit!.context as Record<string, unknown> | null)?.['toStatus']).toBe('active');
  });

  it('rejects activation when steps array is empty', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const draft = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'Empty Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );

    await expect(
      approvalEngine.configureChain(
        db,
        {
          id: draft.id,
          entityType: 'po_threshold',
          name: 'Empty Chain',
          steps: [], // empty
          status: 'active',
        },
        { actorUserId: bo },
      ),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'approval.chain_steps_required',
    });
  });

  it('discards a draft (draft → inactive) → status="inactive", audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const draft = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'Discardable Draft',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );
    expect(draft.status).toBe('draft');

    const discarded = await approvalEngine.configureChain(
      db,
      {
        id: draft.id,
        entityType: 'po_threshold',
        name: 'Discardable Draft',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
        status: 'inactive',
        reasonCode: 'abandoned_draft',
      },
      { actorUserId: bo },
    );
    expect(discarded.status).toBe('inactive');

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, draft.id));
    const updateAudit = auditRows.find((r) => r.action === 'update');
    expect(updateAudit).toBeDefined();
    expect((updateAudit!.context as Record<string, unknown> | null)?.['fromStatus']).toBe('draft');
    expect((updateAudit!.context as Record<string, unknown> | null)?.['toStatus']).toBe('inactive');
  });

  it('forbids reactivating an inactive chain (must clone to a new draft)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const draft = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'Lifecycle Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );
    const active = await approvalEngine.configureChain(
      db,
      {
        id: draft.id,
        entityType: 'po_threshold',
        name: 'Lifecycle Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
        status: 'active',
      },
      { actorUserId: bo },
    );
    const retired = await approvalEngine.configureChain(
      db,
      {
        id: active.id,
        entityType: 'po_threshold',
        name: 'Lifecycle Chain',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
        status: 'inactive',
      },
      { actorUserId: bo },
    );
    expect(retired.status).toBe('inactive');

    await expect(
      approvalEngine.configureChain(
        db,
        {
          id: retired.id,
          entityType: 'po_threshold',
          name: 'Lifecycle Chain',
          steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
          status: 'active',
        },
        { actorUserId: bo },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('approvalEngine.listChains', () => {
  it('returns brand-scoped chains', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createBO(testBrandId);

    const c1 = await approvalEngine.configureChain(
      db,
      {
        entityType: 'po_threshold',
        name: 'List Test 1',
        steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );
    const c2 = await approvalEngine.configureChain(
      db,
      {
        entityType: 'recipe_default_change',
        name: 'List Test 2',
        steps: [{ stepIndex: 0, role: 'brand_owner', escalationTimeoutMinutes: 1440 }],
      },
      { actorUserId: bo },
    );

    const all = await approvalEngine.listChains(db);
    const ids = all.map((c) => c.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);

    const filtered = await approvalEngine.listChains(db, { entityType: 'recipe_default_change' });
    expect(filtered.map((c) => c.id)).toEqual([c2.id]);

    const drafts = await approvalEngine.listChains(db, { status: 'draft' });
    expect(drafts.length).toBeGreaterThanOrEqual(2);
  });
});
