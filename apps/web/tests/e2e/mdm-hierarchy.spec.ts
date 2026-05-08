/**
 * mdm-hierarchy.spec.ts — Happy-path e2e test for SI-MDM-001 Org Hierarchy.
 *
 * Prerequisites:
 *   - apps/api running on http://localhost:3001 (seeded DB)
 *   - apps/web started by Playwright webServer on http://localhost:5174
 *   - Playwright globalSetup signs in the bootstrap BO via supabase-js once;
 *     the storage state is pre-loaded so `page.goto('/')` lands signed-in.
 *
 * Test strategy:
 *   Full happy path: create cluster → expand cluster → create location →
 *   expand location → create department → assert all three nodes visible in tree.
 *   Timestamps in names ensure uniqueness across test runs.
 */

import { test, expect } from '@playwright/test';

test('create cluster → location → department, all visible in tree', async ({ page }) => {
  // Navigate to the hierarchy page
  await page.goto('/mdm/hierarchy');

  // globalSetup pre-populated the Supabase session in storageState; wait for
  // the tree to appear. If auth is in flight, RequireAuth renders a spinner.
  const tree = page.getByRole('tree');
  await expect(tree).toBeVisible({ timeout: 10_000 });

  // Unique names for this test run
  const stamp = Date.now();
  const clusterName = `E2E Cluster ${stamp}`;
  const locationName = `E2E Location ${stamp}`;
  const deptName = `E2E Department ${stamp}`;

  // ── Step 1: Create cluster ──────────────────────────────────────────────

  // Click the "New cluster" button to open the create-cluster popover
  await page.getByRole('button', { name: /new cluster/i }).click();

  // Fill the cluster name field (label: "Cluster name")
  await page.getByLabel(/cluster name/i).fill(clusterName);

  // Submit — "Create cluster" button
  // Wait for it to be stable before clicking
  const createClusterBtn = page.getByRole('button', { name: /create cluster/i });
  await expect(createClusterBtn).toBeEnabled();
  await createClusterBtn.click();

  // The popover should close and the new cluster should appear in the tree
  await expect(page.getByText(clusterName)).toBeVisible({ timeout: 8_000 });

  // ── Step 2: Expand the cluster ──────────────────────────────────────────

  // The expand button for the new cluster has aria-label "Expand <name>"
  await page.getByRole('button', { name: `Expand ${clusterName}` }).click();

  // ── Step 3: Add a location under the cluster ────────────────────────────

  // Open the action menu for the cluster
  await page.getByRole('button', { name: `Actions for ${clusterName}` }).click();

  // Click "Add location" in the action menu
  await page.getByRole('menuitem', { name: /add location/i }).click();

  // Wait for the create-location form to appear and be stable
  const locationNameLabel = page.getByLabel(/location name/i);
  await expect(locationNameLabel).toBeVisible({ timeout: 5_000 });
  await locationNameLabel.fill(locationName);

  // Click "Create location" — use .first() in case multiple buttons match
  const createLocationBtn = page.getByRole('button', { name: /create location/i }).first();
  await expect(createLocationBtn).toBeEnabled({ timeout: 3_000 });
  await createLocationBtn.click();

  // Assert location is visible
  await expect(page.getByText(locationName)).toBeVisible({ timeout: 8_000 });

  // ── Step 4: Expand the location ─────────────────────────────────────────

  await page.getByRole('button', { name: `Expand ${locationName}` }).click();

  // ── Step 5: Add a department under the location ─────────────────────────

  // Open the action menu for the location
  await page.getByRole('button', { name: `Actions for ${locationName}` }).click();

  // Click "Add department"
  await page.getByRole('menuitem', { name: /add department/i }).click();

  // Wait for the create-department form to appear
  const deptNameLabel = page.getByLabel(/department name/i);
  await expect(deptNameLabel).toBeVisible({ timeout: 5_000 });
  await deptNameLabel.fill(deptName);

  // Click "Create department"
  const createDeptBtn = page.getByRole('button', { name: /create department/i }).first();
  await expect(createDeptBtn).toBeEnabled({ timeout: 3_000 });
  await createDeptBtn.click();

  // ── Assert: all three nodes are visible in the tree ──────────────────────

  await expect(page.getByText(clusterName)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(locationName)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(deptName)).toBeVisible({ timeout: 8_000 });
});
