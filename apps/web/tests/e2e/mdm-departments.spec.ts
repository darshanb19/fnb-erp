/**
 * mdm-departments.spec.ts — e2e test for SI-MDM-002 Department Register.
 *
 * Task C4 acceptance criterion (plan §6):
 *   Filter by type "Production" → assert only Production-typed rows visible.
 *
 * Strategy:
 *   1. Reuse the bootstrap BO's Supabase access token (loaded from .auth-state.json).
 *   2. Use the JWT to call the API directly and create two departments:
 *      one type=production, one type=non_production.
 *   3. Navigate to /mdm/departments (Playwright globalSetup handles browser auth).
 *   4. Apply the "Type → Production" filter chip.
 *   5. Assert only the production department is visible; the non-production one is not.
 *   6. Clear filters and assert both rows return.
 *
 * Prerequisites:
 *   - apps/api running on http://localhost:3001 (seeded DB)
 *   - Playwright globalSetup signs in once via supabase-js (storage state pre-loaded)
 *   - apps/web on http://localhost:5174 (started by playwright webServer)
 *
 * JWT minting: uses the bootstrap BO's Supabase access token from globalSetup
 * (tests/e2e/.auth-state.json). The token is verified by apps/api against
 * the real Mumbai SUPABASE_JWT_SECRET.
 */

import { test, expect } from '@playwright/test';
import { loadAuthState } from './_auth-helper';

const API = 'http://localhost:3001';


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
  const token = loadAuthState().accessToken;
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

  // globalSetup pre-loaded the Supabase session — wait for both dept names to
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
