/**
 * storage/signed-url.ts — Phase 4 Epic 3 INF Arc (a) Task A6.
 *
 * Per-brand Supabase Storage signed-URL provisioning per DL-017. Issue Ticket
 * attachments (Arc (c) Task C8c) are the first production exerciser; Epic 4 INV
 * inherits the tested flow for GR document attachments + production-order
 * source PDFs.
 *
 * Bucket naming: `brand-<brandId>`. The plan called for `brand-<slug>` but the
 * brands table does not currently expose a `slug` column. Until a slug is
 * introduced (post-MVP — multi-tenant readiness work), the brand UUID is the
 * stable bucket discriminator. Buckets are private; nav-readability is
 * secondary because Studio access is admin-only.
 *
 * Signed URL TTL: 5 minutes per DL-017. Browser must complete the PUT (or GET)
 * within the window or request a fresh URL. The application layer controls
 * exposure of signed URLs; only authenticated users with `inf.issue.write`
 * (for upload) or `inf.issue.read` (for download) are issued URLs by the
 * issues route in Task A11.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let _client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes per DL-017

function bucketName(brandId: string): string {
  return `brand-${brandId}`;
}

export interface SignedUploadResult {
  url: string;
  storagePath: string;
  expiresAt: Date;
}

export async function getSignedUploadUrl(args: {
  brandId: string;
  entityType: string; // e.g. 'issue-tickets'
  entityId: string; // e.g. the ticket UUID
  filename: string;
}): Promise<SignedUploadResult> {
  const storagePath = `${args.entityType}/${args.entityId}/${args.filename}`;
  const { data, error } = await getClient()
    .storage.from(bucketName(args.brandId))
    .createSignedUploadUrl(storagePath);
  if (error) throw new Error(`Signed upload URL error: ${error.message}`);
  return {
    url: data.signedUrl,
    storagePath,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
  };
}

export interface SignedDownloadResult {
  url: string;
  expiresAt: Date;
}

export async function getSignedDownloadUrl(args: {
  brandId: string;
  storagePath: string;
}): Promise<SignedDownloadResult> {
  const { data, error } = await getClient()
    .storage.from(bucketName(args.brandId))
    .createSignedUrl(args.storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`Signed download URL error: ${error.message}`);
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
  };
}
