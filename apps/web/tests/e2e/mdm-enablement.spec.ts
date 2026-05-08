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
 *   - Playwright globalSetup signs in once via supabase-js (storage state pre-loaded)
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
// Note: enablement_matrix.last_modified_by has a FK → users.id. The bootstrap
// BO user is created in the local fnberp_dev users table by the
// `pnpm --filter @fnberp/api bootstrap:bo` script (with the same UUID that
// Mumbai Auth issues for `sub`), so the FK is always satisfied here without
// a separate seed step.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SI-MDM-004 Material Enablement Matrix', () => {
  test('happy path: select location → matrix renders → toggle cell → reason → save → reload persists', async ({ page }) => {
    // ── Step 0: create fixture data via API ────────────────────────────────
    const token = loadAuthState().accessToken;
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

    // globalSetup pre-loaded the Supabase session — wait for auth + page load
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
    const token = loadAuthState().accessToken;
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
