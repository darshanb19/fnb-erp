/**
 * bootstrap-supabase-bo.ts — one-time bootstrap of the dev Brand Owner across
 * Mumbai Supabase Auth + local fnberp_dev `users` table.
 *
 * Idempotent: re-running is a no-op if the user already exists in both places.
 * Required once after Arc (a) provisioned the Mumbai Supabase project so Arc
 * (c) Task C1 (DL-029 → real Supabase Auth swap) has a real account to log
 * in with.
 *
 * Splits state intentionally:
 *   - Mumbai Supabase Auth → handles login + JWT minting.
 *   - Local fnberp_dev `users` table → handles app-data lookups (apps/api
 *     keeps DATABASE_URL pointed at fnberp_dev for fast Epic 1 e2e fixture
 *     resets; cloud DB integration is a separate, later concern).
 *
 * The Supabase Auth user UUID becomes the local users.id; user_metadata.brand_id
 * is the local fnberp_dev brand UUID (so the JWT-derived brand_id scopes to the
 * brand row apps/api actually queries).
 *
 * Run via:
 *   pnpm --filter @fnberp/api bootstrap:bo
 *
 * Env required (apps/api/.env):
 *   - SUPABASE_URL                  (Mumbai project URL)
 *   - SUPABASE_SERVICE_ROLE_KEY     (Mumbai service role JWT)
 *   - DATABASE_URL                  (local fnberp_dev)
 *
 * Env optional:
 *   - BOOTSTRAP_BO_EMAIL            (default: bootstrap-bo@fnberp.local)
 *   - BOOTSTRAP_BO_PASSWORD         (default: a stable dev password printed once)
 *   - BOOTSTRAP_BO_FULL_NAME        (default: "Bootstrap Brand Owner")
 */

import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';
import { unscopedDb, pgClient } from '../src/db/client.js';
import { users } from '../src/db/schema/auth.js';
import { brands } from '../src/db/schema/brand.js';
import { env } from '../src/env.js';

const DEFAULT_EMAIL = 'bootstrap-bo@fnberp.local';
const DEFAULT_PASSWORD = 'BootstrapBO!2026-Dev';
const DEFAULT_FULL_NAME = 'Bootstrap Brand Owner';

async function main(): Promise<void> {
  const email = process.env['BOOTSTRAP_BO_EMAIL'] ?? DEFAULT_EMAIL;
  const password = process.env['BOOTSTRAP_BO_PASSWORD'] ?? DEFAULT_PASSWORD;
  const fullName = process.env['BOOTSTRAP_BO_FULL_NAME'] ?? DEFAULT_FULL_NAME;

  if (env.SUPABASE_URL.startsWith('http://localhost')) {
    throw new Error(
      `[bootstrap-bo] SUPABASE_URL is local (${env.SUPABASE_URL}). Point it at the ` +
        `Mumbai project before running this script.`,
    );
  }

  const db = unscopedDb();

  // 1. Find the local fnberp_dev brand row (DL-024 single-brand bootstrap).
  const [brand] = await db.select({ id: brands.id, name: brands.legalName }).from(brands).limit(1);
  if (!brand) {
    throw new Error(
      `[bootstrap-bo] No brand row in local fnberp_dev. Run \`pnpm --filter @fnberp/api db:seed\` first.`,
    );
  }
  console.log(`[bootstrap-bo] Local brand: id=${brand.id} legal_name="${brand.name}".`);

  // 2. Mumbai Supabase Auth — admin.createUser is idempotent via listUsers + filter.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`[bootstrap-bo] listUsers failed: ${listErr.message}`);

  let supabaseUserId: string;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    supabaseUserId = existing.id;
    console.log(`[bootstrap-bo] Supabase Auth user already exists: id=${supabaseUserId}.`);

    // Sync user_metadata in case brand_id drifted (idempotent self-heal).
    const meta = existing.user_metadata as { brand_id?: string; role?: string } | null;
    if (meta?.brand_id !== brand.id || meta?.role !== 'brand_owner') {
      const { error: updErr } = await supabase.auth.admin.updateUserById(supabaseUserId, {
        user_metadata: { brand_id: brand.id, role: 'brand_owner' },
      });
      if (updErr) throw new Error(`[bootstrap-bo] updateUserById failed: ${updErr.message}`);
      console.log(`[bootstrap-bo] Synced user_metadata.brand_id=${brand.id} role=brand_owner.`);
    }
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { brand_id: brand.id, role: 'brand_owner' },
    });
    if (createErr) throw new Error(`[bootstrap-bo] createUser failed: ${createErr.message}`);
    if (!created.user) throw new Error('[bootstrap-bo] createUser returned no user.');
    supabaseUserId = created.user.id;
    console.log(`[bootstrap-bo] Created Supabase Auth user: id=${supabaseUserId}.`);
  }

  // 3. Local fnberp_dev users row — insert if missing (PK is the Supabase Auth UUID).
  const [existingRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`id = ${supabaseUserId}`)
    .limit(1);

  if (existingRow) {
    console.log(`[bootstrap-bo] Local users row already present: id=${existingRow.id}.`);
  } else {
    await db.insert(users).values({
      id: supabaseUserId,
      brandId: brand.id,
      email,
      fullName,
      role: 'brand_owner',
      approvalStatus: 'approved',
      active: true,
      createdBy: supabaseUserId,
      updatedBy: supabaseUserId,
    });
    console.log(`[bootstrap-bo] Inserted local users row: id=${supabaseUserId}.`);
  }

  console.log('');
  console.log('─────────────────────────────────────────────────────');
  console.log('  Bootstrap Brand Owner ready');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Brand:    ${brand.name} (${brand.id})`);
  console.log(`  Auth ID:  ${supabaseUserId}`);
  console.log('─────────────────────────────────────────────────────');
  console.log('  Save the password — it is printed only here.');
  console.log('  Re-running this script is idempotent.');
  console.log('─────────────────────────────────────────────────────');

  await pgClient.sql.end();
}

main().catch((err: unknown) => {
  console.error('[bootstrap-bo] FAILED:', err);
  pgClient.sql.end().finally(() => process.exit(1));
});
