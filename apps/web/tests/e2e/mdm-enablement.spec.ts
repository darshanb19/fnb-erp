/**
 * mdm-enablement.spec.ts — e2e tests for SI-MDM-004 Material Enablement Matrix.
 *
 * Task C6 acceptance criteria:
 *
 *   Happy path (Tier 1):
 *     1. Setup: create a cluster, location, department, UOM, and product via API.
 *     2. Navigate to /mdm/enablement.
 *     3. Select the location from the picker.
 *     4. Verify the matrix renders with the product as a row and the department as a column.
 *     5. Toggle the (product, department) cell → enter a reason → save.
 *     6. Reload → verify the toggle is still in the saved (enabled) state.
 *
 *   Edge case:
 *     Toggle without a reason → still succeeds (API allows null reason).
 *
 * JWT minting: identical HS256 pattern from C3/C4/C5 specs.
 * Secret: 'test-secret-do-not-use-in-prod'
 *
 * Prerequisites:
 *   - apps/api running on http://localhost:3001 (seeded DB)
 *   - apps/web on http://localhost:5174 (started by playwright webServer)
 *   - VITE_AUTO_DEV_SIGNIN=true in apps/web/.env.local
 */

import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';

const API = 'http://localhost:3001';
const JWT_SECRET = 'test-secret-do-not-use-in-prod';
const BRAND_ID = 'ef3a01ba-ac8e-4054-ae31-bdc84a778f21';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const DB_URL = 'postgresql://darshan@localhost:5432/fnberp_dev';

// ---------------------------------------------------------------------------
// JWT mint helper (no external dep — pure node:crypto)
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

async function apiGet(
  path: string,
  token: string,
): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Setup: ensure the seed user exists in the users table.
//
// The enablement_matrix.last_modified_by column has a FK → users.id.
// When the API processes the toggle, it sets last_modified_by = req.user.id
// (the JWT sub). If that UUID isn't in the users table, the DB throws 23503.
//
// We idempotently upsert the seed user via psql before any test runs.
// This only affects the test DB and is intentional for the dev environment.
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  try {
    execSync(
      `psql "${DB_URL}" -c "INSERT INTO users (id, brand_id, email, role, active) VALUES ('${USER_ID}', '${BRAND_ID}', 'e2e-seed@example.com', 'brand_owner', true) ON CONFLICT (id) DO NOTHING;" 2>&1`,
      { encoding: 'utf-8' },
    );
  } catch (err) {
    // If psql is unavailable, the test will fail with a 500 on the first toggle.
    // This is expected in CI where psql isn't installed; seed the user another way.
    console.warn('[e2e-setup] Could not seed user via psql:', err);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SI-MDM-004 Material Enablement Matrix', () => {
  test('happy path: select location → matrix renders → toggle cell → reason → save → reload persists', async ({ page }) => {
    // ── Step 0: create fixture data via API ────────────────────────────────
    const token = mintJwt();
    const stamp = Date.now();

    // Cluster
    const cluster = await apiPost(
      '/api/v1/clusters',
      { name: `E2E-C6 Cluster ${stamp}` },
      token,
    );
    const clusterId = cluster['id'] as string;

    // Location
    const location = await apiPost(
      '/api/v1/locations',
      { clusterId, name: `E2E-C6 Location ${stamp}`, type: 'central_kitchen' },
      token,
    );
    const locationId = location['id'] as string;
    const locationName = location['name'] as string;

    // Department at the location
    const dept = await apiPost(
      '/api/v1/departments',
      { locationId, name: `E2E-C6 Dept ${stamp}`, type: 'production' },
      token,
    );
    const deptId = dept['id'] as string;
    const deptName = dept['name'] as string;

    // UOM (required for product)
    const uomsList = await apiGet('/api/v1/uoms', token) as Array<Record<string, unknown>>;
    let uomId: string;
    if (uomsList.length > 0) {
      uomId = uomsList[0]!['id'] as string;
    } else {
      const uom = await apiPost(
        '/api/v1/uoms',
        { code: `E2EC6KG${stamp}`, displayName: `kg-${stamp}`, base: 'mass', conversionToBaseFactor: '1' },
        token,
      );
      uomId = uom['id'] as string;
    }

    // Product
    const product = await apiPost(
      '/api/v1/products',
      {
        sku: `E2EC6-${stamp}`,
        name: `E2E-C6 Product ${stamp}`,
        type: 'raw',
        defaultUomId: uomId,
        standardYieldFactor: '1',
      },
      token,
    );
    const productId = product['id'] as string;
    const productName = product['name'] as string;

    // Verify enablement is initially false
    const checkBefore = await apiPost(
      '/api/v1/enablements/check',
      { productId, departmentId: deptId },
      token,
    ) as { enabled: boolean };
    expect(checkBefore['enabled']).toBe(false);

    // ── Step 1: navigate to the enablement matrix ──────────────────────────
    await page.goto('/mdm/enablement');

    // VITE_AUTO_DEV_SIGNIN=true fires on mount — wait for auth + page load
    await expect(page.getByRole('heading', { name: /material enablement matrix/i })).toBeVisible({
      timeout: 15_000,
    });

    // ── Step 2: pick the location ──────────────────────────────────────────
    const locationPicker = page.getByRole('combobox', { name: /location/i });
    await expect(locationPicker).toBeVisible({ timeout: 5_000 });
    await locationPicker.selectOption({ label: locationName });

    // ── Step 3: verify matrix renders the product and department ──────────
    // The matrix table renders products as row headers (th[scope=row]) and
    // departments as column headers (th[scope=col]).
    // Use the toggle's aria-label as the most specific indicator that BOTH
    // the product and department are present in the matrix.
    const toggleLabel = `Enable ${productName} for ${deptName}`;
    const toggle = page.getByRole('switch', { name: toggleLabel });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Also check the department column header (visible text in the table head)
    await expect(page.locator('th[scope="col"]').filter({ hasText: deptName })).toBeVisible({
      timeout: 5_000,
    });

    // ── Step 4: find and toggle the cell ───────────────────────────────────
    // Toggle already located above; confirm initial state
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Click to open reason popover
    await toggle.click();

    // ── Step 5: enter a reason and save ────────────────────────────────────
    // The reason popover should appear
    const reasonTextarea = page.getByRole('textbox', { name: /reason for this enablement change/i });
    await expect(reasonTextarea).toBeVisible({ timeout: 3_000 });
    await reasonTextarea.fill('Approved for E2E test production run');

    const saveButton = page.getByRole('button', { name: /^save$/i });
    await expect(saveButton).toBeVisible({ timeout: 2_000 });
    await saveButton.click();

    // Wait for the toggle to reflect the new enabled state
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8_000 });

    // ── Step 6: reload and verify state persists ────────────────────────────
    await page.reload();

    // Re-auth after reload
    await expect(page.getByRole('heading', { name: /material enablement matrix/i })).toBeVisible({
      timeout: 15_000,
    });

    // Re-select the location
    const locationPickerAfter = page.getByRole('combobox', { name: /location/i });
    await expect(locationPickerAfter).toBeVisible({ timeout: 5_000 });
    await locationPickerAfter.selectOption({ label: locationName });

    // Toggle should now be enabled (aria-checked="true")
    const toggleAfterReload = page.getByRole('switch', { name: toggleLabel });
    await expect(toggleAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true', { timeout: 8_000 });

    // Also verify via API
    const checkAfter = await apiPost(
      '/api/v1/enablements/check',
      { productId, departmentId: deptId },
      token,
    ) as { enabled: boolean };
    expect(checkAfter['enabled']).toBe(true);
  });

  test('edge case: toggle without reason succeeds (API allows null reason)', async ({ page }) => {
    // ── Setup: create minimal fixture ──────────────────────────────────────
    const token = mintJwt();
    const stamp = Date.now() + 1; // offset to avoid collision

    const cluster = await apiPost(
      '/api/v1/clusters',
      { name: `E2E-C6b Cluster ${stamp}` },
      token,
    );
    const clusterId = cluster['id'] as string;

    const location = await apiPost(
      '/api/v1/locations',
      { clusterId, name: `E2E-C6b Location ${stamp}`, type: 'pos_outlet' },
      token,
    );
    const locationId = location['id'] as string;
    const locationName = location['name'] as string;

    await apiPost(
      '/api/v1/departments',
      { locationId, name: `E2E-C6b Dept ${stamp}`, type: 'store' },
      token,
    );

    const uomsList = await apiGet('/api/v1/uoms', token) as Array<Record<string, unknown>>;
    const uomId = uomsList[0]!['id'] as string;

    const product = await apiPost(
      '/api/v1/products',
      {
        sku: `E2EC6B-${stamp}`,
        name: `E2E-C6b Product ${stamp}`,
        type: 'raw',
        defaultUomId: uomId,
        standardYieldFactor: '1',
      },
      token,
    );
    const productName = product['name'] as string;
    const deptName = `E2E-C6b Dept ${stamp}`;

    // ── Navigate ───────────────────────────────────────────────────────────
    await page.goto('/mdm/enablement');
    await expect(page.getByRole('heading', { name: /material enablement matrix/i })).toBeVisible({
      timeout: 15_000,
    });

    const locationPicker = page.getByRole('combobox', { name: /location/i });
    await locationPicker.selectOption({ label: locationName });

    // Wait for matrix to render by waiting for the toggle to appear
    const toggle = page.getByRole('switch', { name: `Enable ${productName} for ${deptName}` });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();

    // Click Save WITHOUT entering a reason
    const saveButton = page.getByRole('button', { name: /^save$/i });
    await expect(saveButton).toBeVisible({ timeout: 3_000 });
    await saveButton.click();

    // Toggle should flip to enabled — null reason is valid per API spec
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 8_000 });
  });
});
