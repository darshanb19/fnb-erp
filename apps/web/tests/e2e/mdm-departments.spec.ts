/**
 * mdm-departments.spec.ts — e2e test for SI-MDM-002 Department Register.
 *
 * Task C4 acceptance criterion (plan §6):
 *   Filter by type "Production" → assert only Production-typed rows visible.
 *
 * Strategy:
 *   1. Mint a dev JWT using the same HS256 secret used by apps/api auth middleware.
 *   2. Use the JWT to call the API directly and create two departments:
 *      one type=production, one type=non_production.
 *   3. Navigate to /mdm/departments (VITE_AUTO_DEV_SIGNIN=true handles browser auth).
 *   4. Apply the "Type → Production" filter chip.
 *   5. Assert only the production department is visible; the non-production one is not.
 *   6. Clear filters and assert both rows return.
 *
 * Prerequisites:
 *   - apps/api running on http://localhost:3001 (seeded DB)
 *   - VITE_AUTO_DEV_SIGNIN=true in apps/web/.env.local (auto-signin in browser)
 *   - apps/web on http://localhost:5174 (started by playwright webServer)
 *
 * JWT minting: uses the jsonwebtoken package (already a dep of apps/api) via
 * Playwright's Node.js context. Secret matches SUPABASE_JWT_SECRET and
 * VITE_DEV_JWT_SECRET ('test-secret-do-not-use-in-prod').
 */

import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const API = 'http://localhost:3001';
const JWT_SECRET = 'test-secret-do-not-use-in-prod';
const BRAND_ID = 'ef3a01ba-ac8e-4054-ae31-bdc84a778f21';
const USER_ID = '00000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Minimal HS256 JWT mint (no external dep — pure node:crypto)
// ---------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function mintJwt(): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        sub: USER_ID,
        user_metadata: { brand_id: BRAND_ID, role: 'brand_owner' },
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const sig = base64url(
    createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest(),
  );
  return `${header}.${payload}.${sig}`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiPost(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('filter by type Production → only Production rows visible', async ({ page }) => {
  // ── Step 0: create fixture departments via API ────────────────────────────
  const token = mintJwt();
  const stamp = Date.now();

  // Create a cluster
  const cluster = await apiPost(
    '/api/v1/clusters',
    { name: `E2E-C4 Cluster ${stamp}` },
    token,
  );
  const clusterId = cluster['id'] as string;

  // Create a location under the cluster
  const location = await apiPost(
    '/api/v1/locations',
    { clusterId, name: `E2E-C4 Location ${stamp}`, type: 'central_kitchen' },
    token,
  );
  const locationId = location['id'] as string;

  // Create a production-typed department
  const prodDept = await apiPost(
    '/api/v1/departments',
    { locationId, name: `E2E-C4 Prod ${stamp}`, type: 'production' },
    token,
  );
  const prodName = prodDept['name'] as string;

  // Create a non-production-typed department
  const nonProdDept = await apiPost(
    '/api/v1/departments',
    { locationId, name: `E2E-C4 NonProd ${stamp}`, type: 'non_production' },
    token,
  );
  const nonProdName = nonProdDept['name'] as string;

  // ── Step 1: navigate to the department register ──────────────────────────
  await page.goto('/mdm/departments');

  // The page renders both a desktop table (data-view="desktop") and a mobile
  // card list (data-view="mobile"). Playwright runs at a desktop viewport so
  // CSS hides the mobile view, but both DOM nodes exist. Scope all row-text
  // assertions to the desktop table to avoid strict-mode dup-row violations.
  const desktopView = page.locator('[data-view="desktop"]');

  // VITE_AUTO_DEV_SIGNIN=true fires on mount — wait for both dept names to
  // appear in the unfiltered view (proves auth + data fetch both succeeded).
  await expect(desktopView.getByText(prodName)).toBeVisible({ timeout: 15_000 });
  await expect(desktopView.getByText(nonProdName)).toBeVisible({ timeout: 5_000 });

  // ── Step 2: open the Type filter picker ─────────────────────────────────
  // The chip button has aria-label "Filter by type"
  const typeChip = page.getByRole('button', { name: /filter by type/i });
  await expect(typeChip).toBeVisible({ timeout: 3_000 });
  await typeChip.click();

  // ── Step 3: select Production ────────────────────────────────────────────
  // The popover lists options as buttons with aria-pressed
  const productionBtn = page.getByRole('button', { name: /^production$/i });
  await expect(productionBtn).toBeVisible({ timeout: 3_000 });
  await productionBtn.click();

  // Close the popover
  await page.keyboard.press('Escape');

  // ── Step 4: assert filtered state ───────────────────────────────────────
  // Production department must be visible in the desktop table
  await expect(desktopView.getByText(prodName)).toBeVisible({ timeout: 5_000 });

  // Non-production department must NOT be visible in the desktop table
  await expect(desktopView.getByText(nonProdName)).not.toBeVisible({ timeout: 3_000 });

  // ── Step 5: clear filters and assert both rows return ────────────────────
  const resetBtn = page.getByRole('button', { name: /reset all filters/i });
  await expect(resetBtn).toBeVisible({ timeout: 3_000 });
  await resetBtn.click();

  await expect(desktopView.getByText(prodName)).toBeVisible({ timeout: 5_000 });
  await expect(desktopView.getByText(nonProdName)).toBeVisible({ timeout: 5_000 });
});
