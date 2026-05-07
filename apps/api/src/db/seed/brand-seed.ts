/**
 * brand-seed.ts — DL-024 idempotent single-brand bootstrap seed.
 *
 * Creates exactly ONE row in `brands` if none exists; no-ops if count >= 1.
 * This is the ONLY path that creates a brand row — companyService has no
 * createCompany method. Multi-brand creation UX is post-MVP per Master Spec §1.2.
 *
 * Run via:
 *   DATABASE_URL=postgresql://user@host:5432/db pnpm --filter @fnberp/api db:seed
 */

import { sql } from 'drizzle-orm';
import { unscopedDb, pgClient } from '../client.js';
import { brands } from '../schema/brand.js';

async function main(): Promise<void> {
  const db = unscopedDb();

  // Idempotency check — count existing brand rows.
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(brands);

  // row is always defined for a COUNT query but guard for strict null-checks
  const count = row?.count ?? 0;

  if (count >= 1) {
    console.log(`[brand-seed] Brand already seeded (count=${count}) — skipping.`);
    await pgClient.sql.end();
    return;
  }

  // Default brand from Master Spec §12 — "Demo F&B Pvt Ltd"
  const legalName = process.env['BRAND_LEGAL_NAME'] ?? 'Demo F&B Pvt Ltd';
  const tradingName = process.env['BRAND_TRADING_NAME'] ?? null;
  const country = process.env['BRAND_COUNTRY'] ?? 'IN';

  const [created] = await db
    .insert(brands)
    .values({
      legalName,
      tradingName,
      country,
      // status defaults to 'setup_pending'
      // fiscalYearStartMonth defaults to 4, fiscalYearStartDay defaults to 1
      // accountingCurrency defaults to 'INR'
      // timezone defaults to 'Asia/Kolkata'
    })
    .returning();

  if (!created) {
    throw new Error('[brand-seed] Insert returned no row — unexpected.');
  }

  console.log(
    `[brand-seed] Created brand id=${created.id} legalName="${created.legalName}" ` +
      `status=${created.status} fiscalYearStart=${created.fiscalYearStartMonth}/${created.fiscalYearStartDay} ` +
      `currency=${created.accountingCurrency} tz=${created.timezone}.`,
  );
  console.log('[brand-seed] DL-024: single-brand deployment. Multi-brand creation UX is post-MVP.');

  await pgClient.sql.end();
}

main().catch((err: unknown) => {
  console.error('[brand-seed] FAILED:', err);
  pgClient.sql.end().finally(() => process.exit(1));
});
