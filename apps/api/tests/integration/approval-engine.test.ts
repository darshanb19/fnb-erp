/**
 * approval-engine.test.ts — Phase 4 Epic 3 INF Arc (a) Task A7.
 *
 * Integration tests for approvalEngine.createApprovalRequest, decide, delegate,
 * getPendingApprovals, getApprovalStatus.
 *
 * Realtime publishers are mocked because the test env points at a non-running
 * Supabase URL. notificationCenter.send is allowed to run end-to-end (it
 * inserts notifications rows in the test DB) — that exercises the cross-service
 * wiring and is cheap.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { approvalChains } from '../../src/db/schema/approval-chains.js';
import { approvalRequests, approvalRequestSteps } from '../../src/db/schema/approval-requests.js';
import { ValidationError } from '../../src/errors/index.js';

// Mock Realtime publishers so tests don't try to broadcast to a non-existent
// Supabase instance. The functions become no-op `vi.fn()` stubs.
vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

import { approvalEngine } from '../../src/services/approval-engine.service.js';

beforeAll(async () => {
  await setupIntegration();
  // Clear any leftover rows from prior test files (e.g. routes.test.ts's
  // re-seeded TEST_USER_ID brand_owner) so resolveApproverByRole picks up
  // only the BOs this file creates.
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CreatedUser {
  id: string;
  brandId: string;
  email: string;
  role: string;
}

async function createUser(
  brandId: string,
  role:
    | 'brand_owner'
    | 'cluster_manager'
    | 'kitchen_manager'
    | 'store_manager'
    | 'procurement_manager'
    | 'finance_manager'
    | 'dispatch_staff'
    | 'pos_staff'
    | 'superadmin',
  email?: string,
): Promise<CreatedUser> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: email ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      fullName: `Test ${role}`,
      role,
      approvalStatus: 'approved',
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id, brandId: u.brandId, email: u.email, role: u.role };
}

interface SeedChainOpts {
  entityType?:
    | 'po_threshold'
    | 'gr_shelf_life_exception'
    | 'recipe_default_change'
    | 'bo_self_creation'
    | 'inventory_adjustment'
    | 'b2b_credit_limit_change';
  /** Steps array; stored as jsonb. */
  steps?: Array<{
    stepIndex: number;
    role: string;
    valueBandMin?: number;
    valueBandMax?: number;
    escalationTimeoutMinutes: number;
  }>;
  status?: 'draft' | 'active' | 'inactive';
}

/** Insert a chain row directly (bypasses status-transition validation). */
async function seedChain(
  brandId: string,
  createdBy: string,
  opts: SeedChainOpts = {},
): Promise<string> {
  const rawDb = unscopedDb();
  const entityType = opts.entityType ?? 'po_threshold';
  const steps = opts.steps ?? [
    { stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 },
  ];
  const status = opts.status ?? 'active';

  const [row] = await rawDb
    .insert(approvalChains)
    .values({
      brandId,
      entityType,
      name: `Chain ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: null,
      steps: steps as unknown as Record<string, unknown>,
      status,
      createdBy,
      lastModifiedBy: createdBy,
      lastModifiedAt: new Date(),
    })
    .returning({ id: approvalChains.id });
  if (!row) throw new Error('Failed to seed chain');
  return row.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approvalEngine.createApprovalRequest', () => {
  it('creates a request, inserts step 0 with the BO as approver, writes audit row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });

    const req = await approvalEngine.createApprovalRequest(
      db,
      {
        entityType: 'po_threshold',
        entityRef: 'PO-2026-0001',
        entityValue: 75000,
        requestingUserId: requester.id,
      },
      { actorUserId: requester.id },
    );

    expect(req.status).toBe('pending');
    expect(req.currentStep).toBe(0);
    expect(req.entityRef).toBe('PO-2026-0001');

    // Verify step 0 row
    const rawDb = unscopedDb();
    const stepRows = await rawDb
      .select()
      .from(approvalRequestSteps)
      .where(eq(approvalRequestSteps.requestId, req.id));
    expect(stepRows.length).toBe(1);
    expect(stepRows[0]!.stepIndex).toBe(0);
    expect(stepRows[0]!.approverUserId).toBe(bo.id);
    expect(stepRows[0]!.decision).toBe('pending');

    // Audit row for the request insert
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, req.id));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows.find((r) => r.action === 'insert')).toBeDefined();
  });

  it('throws below_threshold when entity_value falls outside step-0 value band', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });

    await expect(
      approvalEngine.createApprovalRequest(
        db,
        {
          entityType: 'po_threshold',
          entityRef: 'PO-2026-0002',
          entityValue: 1000, // below 50000
          requestingUserId: requester.id,
        },
        { actorUserId: requester.id },
      ),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'approval.below_threshold',
    });
  });

  it('throws no_active_chain when no active chain exists for entity_type', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'kitchen_manager');
    // No chain seeded.
    await expect(
      approvalEngine.createApprovalRequest(
        db,
        {
          entityType: 'recipe_default_change',
          entityRef: 'RECIPE-X',
          entityValue: null,
          requestingUserId: requester.id,
        },
        { actorUserId: requester.id },
      ),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'approval.no_active_chain',
    });
  });
});

describe('approvalEngine.decide', () => {
  it('approve on a single-step chain → request status="approved", decidedAt set, audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });

    const req = await approvalEngine.createApprovalRequest(
      db,
      {
        entityType: 'po_threshold',
        entityRef: 'PO-A',
        entityValue: 100000,
        requestingUserId: requester.id,
      },
      { actorUserId: requester.id },
    );

    const after = await approvalEngine.decide(
      db,
      { requestId: req.id, approverUserId: bo.id, decision: 'approved', comment: 'LGTM' },
      { actorUserId: bo.id },
    );

    expect(after.status).toBe('approved');
    expect(after.decidedAt).toBeTruthy();

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, req.id));
    const approveAudit = auditRows.find(
      (r) => r.action === 'update' && (r.context as Record<string, unknown> | null)?.['event'] === 'approve_request',
    );
    expect(approveAudit).toBeDefined();
  });

  it('approve on a multi-step chain → currentStep advances, new step row inserted, status remains pending', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'store_manager');
    const cm = await createUser(testBrandId, 'cluster_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'inventory_adjustment',
      steps: [
        { stepIndex: 0, role: 'cluster_manager', escalationTimeoutMinutes: 1440 },
        { stepIndex: 1, role: 'brand_owner', valueBandMin: 10000, escalationTimeoutMinutes: 1440 },
      ],
      status: 'active',
    });

    const req = await approvalEngine.createApprovalRequest(
      db,
      {
        entityType: 'inventory_adjustment',
        entityRef: 'ADJ-1',
        entityValue: 25000,
        requestingUserId: requester.id,
      },
      { actorUserId: requester.id },
    );
    expect(req.currentStep).toBe(0);

    const after = await approvalEngine.decide(
      db,
      { requestId: req.id, approverUserId: cm.id, decision: 'approved' },
      { actorUserId: cm.id },
    );

    expect(after.status).toBe('pending');
    expect(after.currentStep).toBe(1);

    const rawDb = unscopedDb();
    const stepRows = await rawDb
      .select()
      .from(approvalRequestSteps)
      .where(eq(approvalRequestSteps.requestId, req.id));
    expect(stepRows.length).toBe(2);
    const step1 = stepRows.find((s) => s.stepIndex === 1);
    expect(step1).toBeDefined();
    expect(step1!.approverUserId).toBe(bo.id);
    expect(step1!.decision).toBe('pending');

    // advance_step audit row written
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, req.id));
    const advanceAudit = auditRows.find(
      (r) => r.action === 'update' && (r.context as Record<string, unknown> | null)?.['event'] === 'advance_step',
    );
    expect(advanceAudit).toBeDefined();
  });

  it('reject without reasonCode throws ValidationError', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });
    const req = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-Z', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    await expect(
      approvalEngine.decide(
        db,
        { requestId: req.id, approverUserId: bo.id, decision: 'rejected' },
        { actorUserId: bo.id },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reject with reasonCode → status="rejected", audit row captures reason', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });
    const req = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-R', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    const after = await approvalEngine.decide(
      db,
      {
        requestId: req.id,
        approverUserId: bo.id,
        decision: 'rejected',
        reasonCode: 'budget_exceeded',
        comment: 'Q4 over budget',
      },
      { actorUserId: bo.id },
    );

    expect(after.status).toBe('rejected');
    expect(after.decidedAt).toBeTruthy();

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, req.id));
    const rejectAudit = auditRows.find(
      (r) => r.action === 'update' && (r.context as Record<string, unknown> | null)?.['event'] === 'reject_request',
    );
    expect(rejectAudit).toBeDefined();
    expect(rejectAudit!.reason).toBe('budget_exceeded');
  });

  it('rejects when the step is already decided (status guard fires)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });
    const req = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-G', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    // First decision succeeds.
    await approvalEngine.decide(
      db,
      { requestId: req.id, approverUserId: bo.id, decision: 'approved' },
      { actorUserId: bo.id },
    );

    // Second decision must throw — request is no longer pending.
    await expect(
      approvalEngine.decide(
        db,
        { requestId: req.id, approverUserId: bo.id, decision: 'approved' },
        { actorUserId: bo.id },
      ),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'approval.request_not_pending',
    });
  });
});

describe('approvalEngine.delegate', () => {
  it('flips current step to delegated + opens new step for delegate; audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    const delegate = await createUser(testBrandId, 'finance_manager');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });
    const req = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-D', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    const newStep = await approvalEngine.delegate(
      db,
      {
        requestId: req.id,
        approverUserId: bo.id,
        targetUserId: delegate.id,
        reasonCode: 'travelling_today',
        comment: 'Out of office',
      },
      { actorUserId: bo.id },
    );

    expect(newStep.approverUserId).toBe(delegate.id);
    expect(newStep.decision).toBe('pending');
    expect(newStep.stepIndex).toBe(0);

    const rawDb = unscopedDb();
    const stepRows = await rawDb
      .select()
      .from(approvalRequestSteps)
      .where(eq(approvalRequestSteps.requestId, req.id));
    expect(stepRows.length).toBe(2);

    const oldStep = stepRows.find((s) => s.approverUserId === bo.id);
    expect(oldStep).toBeDefined();
    expect(oldStep!.decision).toBe('delegated');
    expect(oldStep!.escalationTargetUserId).toBe(delegate.id);

    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, oldStep!.id));
    const delegateAudit = auditRows.find(
      (r) => (r.context as Record<string, unknown> | null)?.['event'] === 'delegate_step',
    );
    expect(delegateAudit).toBeDefined();
    expect(delegateAudit!.reason).toBe('travelling_today');
  });

  it('rejects without reasonCode', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    const delegate = await createUser(testBrandId, 'finance_manager');
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });
    const req = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-NR', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    await expect(
      approvalEngine.delegate(
        db,
        {
          requestId: req.id,
          approverUserId: bo.id,
          targetUserId: delegate.id,
          reasonCode: '',
        },
        { actorUserId: bo.id },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('approvalEngine.getPendingApprovals + getApprovalStatus', () => {
  it('getPendingApprovals returns only pending steps for the given approver', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'procurement_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    const otherBo = await createUser(testBrandId, 'brand_owner', `other-bo-${Date.now()}@example.com`);
    void otherBo;
    await seedChain(testBrandId, bo.id, {
      entityType: 'po_threshold',
      steps: [{ stepIndex: 0, role: 'brand_owner', valueBandMin: 50000, escalationTimeoutMinutes: 1440 }],
      status: 'active',
    });

    // Create two pending requests.
    const req1 = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-P1', entityValue: 60000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );
    const req2 = await approvalEngine.createApprovalRequest(
      db,
      { entityType: 'po_threshold', entityRef: 'PO-P2', entityValue: 70000, requestingUserId: requester.id },
      { actorUserId: requester.id },
    );

    // Decide req1 → its step transitions to 'approved' and falls out of pending list.
    await approvalEngine.decide(
      db,
      { requestId: req1.id, approverUserId: bo.id, decision: 'approved' },
      { actorUserId: bo.id },
    );

    const pending = await approvalEngine.getPendingApprovals(db, bo.id);
    expect(pending.length).toBe(1);
    expect(pending[0]!.request.id).toBe(req2.id);
    expect(pending[0]!.step.decision).toBe('pending');
  });

  it('getApprovalStatus returns request + all steps', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const requester = await createUser(testBrandId, 'store_manager');
    const cm = await createUser(testBrandId, 'cluster_manager');
    const bo = await createUser(testBrandId, 'brand_owner');
    await seedChain(testBrandId, bo.id, {
      entityType: 'inventory_adjustment',
      steps: [
        { stepIndex: 0, role: 'cluster_manager', escalationTimeoutMinutes: 1440 },
        { stepIndex: 1, role: 'brand_owner', valueBandMin: 10000, escalationTimeoutMinutes: 1440 },
      ],
      status: 'active',
    });

    const req = await approvalEngine.createApprovalRequest(
      db,
      {
        entityType: 'inventory_adjustment',
        entityRef: 'ADJ-S',
        entityValue: 25000,
        requestingUserId: requester.id,
      },
      { actorUserId: requester.id },
    );
    await approvalEngine.decide(
      db,
      { requestId: req.id, approverUserId: cm.id, decision: 'approved' },
      { actorUserId: cm.id },
    );

    const view = await approvalEngine.getApprovalStatus(db, req.id);
    expect(view.request.id).toBe(req.id);
    expect(view.steps.length).toBe(2);
    expect(view.steps[0]!.stepIndex).toBe(0);
    expect(view.steps[0]!.decision).toBe('approved');
    expect(view.steps[1]!.stepIndex).toBe(1);
    expect(view.steps[1]!.decision).toBe('pending');
  });
});

// Sanity: ensure the test DB has the new tables present.
describe('infrastructure', () => {
  it('approval tables are present in fnberp_test (migration applied)', async () => {
    const rawDb = unscopedDb();
    const result = await rawDb.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('approval_chains', 'approval_requests', 'approval_request_steps', 'notifications')
      ORDER BY table_name
    `);
    const names = (result as unknown as Array<{ table_name: string }>).map((r) => r.table_name);
    expect(names).toContain('approval_chains');
    expect(names).toContain('approval_requests');
    expect(names).toContain('approval_request_steps');
    expect(names).toContain('notifications');
  });
});
