/**
 * issue-tracker-attachments.test.ts — Phase 4 Epic 3 INF Arc (a) Task A9.
 *
 * Storage helpers (`getSignedUploadUrl`, `getSignedDownloadUrl`) are mocked so
 * the test does not require a real Supabase Storage backend. The mocks return
 * canned URLs + storagePaths and assert the service calls them with the right
 * args.
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
import { issueTicketAttachments } from '../../src/db/schema/issue-tickets.js';
import { brands } from '../../src/db/schema/brand.js';
import { brandedDb } from '../../src/db/branded-db.js';
import { ValidationError, NotFoundError } from '../../src/errors/index.js';

vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

// Mock storage helpers — we don't have a Supabase Storage backend in the
// integration test environment.
vi.mock('../../src/storage/signed-url.js', () => ({
  getSignedUploadUrl: vi.fn(async (args: { brandId: string; entityType: string; entityId: string; filename: string }) => ({
    url: `https://mock.signed/upload/${args.entityType}/${args.entityId}/${args.filename}`,
    storagePath: `${args.entityType}/${args.entityId}/${args.filename}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })),
  getSignedDownloadUrl: vi.fn(async (args: { brandId: string; storagePath: string }) => ({
    url: `https://mock.signed/download/${args.storagePath}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })),
}));

import { issueTrackerService } from '../../src/services/issue-tracker.service.js';
import { publishIssueTicketUpdate } from '../../src/realtime/publishers.js';
import { getSignedUploadUrl, getSignedDownloadUrl } from '../../src/storage/signed-url.js';

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
  vi.mocked(publishIssueTicketUpdate).mockClear();
  vi.mocked(getSignedUploadUrl).mockClear();
  vi.mocked(getSignedDownloadUrl).mockClear();
});

async function createUser(brandId: string): Promise<{ id: string }> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      fullName: 'Attachment User',
      role: 'pos_staff',
      approvalStatus: 'approved',
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id };
}

// ---------------------------------------------------------------------------
// requestAttachmentUpload
// ---------------------------------------------------------------------------

describe('issueTrackerService.requestAttachmentUpload', () => {
  it('returns signed URL + storagePath for an allowed MIME', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );

    const result = await issueTrackerService.requestAttachmentUpload(db, {
      ticketId: ticket.id,
      filename: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      uploaderUserId: u.id,
    });

    expect(result.uploadUrl).toContain('mock.signed/upload');
    expect(result.storagePath).toBe(`issue-tickets/${ticket.id}/photo.png`);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(getSignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: testBrandId,
        entityType: 'issue-tickets',
        entityId: ticket.id,
        filename: 'photo.png',
      }),
    );
  });

  it('rejects disallowed MIME type', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );

    await expect(
      issueTrackerService.requestAttachmentUpload(db, {
        ticketId: ticket.id,
        filename: 'evil.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
        uploaderUserId: u.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects size > 10 MB', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );

    await expect(
      issueTrackerService.requestAttachmentUpload(db, {
        ticketId: ticket.id,
        filename: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 11 * 1024 * 1024,
        uploaderUserId: u.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when ticket does not exist in this brand', async () => {
    const { db } = getTestBrandedDb();
    const ghostTicketId = '00000000-0000-0000-0000-000000000999';
    const userId = '00000000-0000-0000-0000-0000000000aa';
    await expect(
      issueTrackerService.requestAttachmentUpload(db, {
        ticketId: ghostTicketId,
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploaderUserId: userId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// confirmAttachment
// ---------------------------------------------------------------------------

describe('issueTrackerService.confirmAttachment', () => {
  it('writes row + audit + Realtime publish', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );

    vi.mocked(publishIssueTicketUpdate).mockClear();

    const att = await issueTrackerService.confirmAttachment(
      db,
      {
        ticketId: ticket.id,
        storagePath: `issue-tickets/${ticket.id}/photo.png`,
        filename: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 4096,
        uploaderUserId: u.id,
      },
      { actorUserId: u.id },
    );

    expect(att.filename).toBe('photo.png');
    expect(att.mimeType).toBe('image/png');
    expect(att.sizeBytes).toBe(4096);
    expect(att.storagePath).toBe(`issue-tickets/${ticket.id}/photo.png`);

    const rawDb = unscopedDb();
    const auditRows = await rawDb.select().from(auditLog).where(eq(auditLog.rowId, att.id));
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]!.action).toBe('insert');

    expect(publishIssueTicketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: ticket.id, eventType: 'attachment' }),
    );
  });

  it('preserves storagePath / filename / mimeType / sizeBytes verbatim', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );

    const att = await issueTrackerService.confirmAttachment(
      db,
      {
        ticketId: ticket.id,
        storagePath: `issue-tickets/${ticket.id}/spec.pdf`,
        filename: 'spec.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12345,
        uploaderUserId: u.id,
      },
      { actorUserId: u.id },
    );

    const rawDb = unscopedDb();
    const [row] = await rawDb
      .select()
      .from(issueTicketAttachments)
      .where(eq(issueTicketAttachments.id, att.id));
    expect(row!.storagePath).toBe(`issue-tickets/${ticket.id}/spec.pdf`);
    expect(row!.filename).toBe('spec.pdf');
    expect(row!.mimeType).toBe('application/pdf');
    expect(row!.sizeBytes).toBe(12345);
  });
});

// ---------------------------------------------------------------------------
// getAttachmentDownloadUrl
// ---------------------------------------------------------------------------

describe('issueTrackerService.getAttachmentDownloadUrl', () => {
  it('returns signed URL when attachment lives in this brand on this ticket', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );
    const att = await issueTrackerService.confirmAttachment(
      db,
      {
        ticketId: ticket.id,
        storagePath: `issue-tickets/${ticket.id}/spec.pdf`,
        filename: 'spec.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        uploaderUserId: u.id,
      },
      { actorUserId: u.id },
    );

    const result = await issueTrackerService.getAttachmentDownloadUrl(db, {
      ticketId: ticket.id,
      attachmentId: att.id,
    });
    expect(result.url).toContain('mock.signed/download');
    expect(result.filename).toBe('spec.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: testBrandId,
        storagePath: `issue-tickets/${ticket.id}/spec.pdf`,
      }),
    );
  });

  it('cross-brand isolation — other brand cannot fetch the attachment', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 't', description: 'd' },
      { actorUserId: u.id },
    );
    const att = await issueTrackerService.confirmAttachment(
      db,
      {
        ticketId: ticket.id,
        storagePath: `issue-tickets/${ticket.id}/x.pdf`,
        filename: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        uploaderUserId: u.id,
      },
      { actorUserId: u.id },
    );

    const rawDb = unscopedDb();
    const [otherBrand] = await rawDb
      .insert(brands)
      .values({ legalName: 'Other Brand', country: 'IN' })
      .returning();
    const otherDb = brandedDb(otherBrand!.id);

    await expect(
      issueTrackerService.getAttachmentDownloadUrl(otherDb, {
        ticketId: ticket.id,
        attachmentId: att.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
