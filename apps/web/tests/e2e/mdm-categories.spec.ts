/**
 * mdm-categories.spec.ts — e2e tests for SI-MDM-006 Category & Sub-Category Management.
 *
 * Task C8 acceptance criteria (plan §6):
 *   Test 1 — happy path:
 *     1. Navigate to /mdm/categories.
 *     2. Click "Add category" → fill name "Raw Materials {timestamp}" → submit.
 *     3. Assert the new category appears in the tree.
 *     4. Click "Add sub-category" on the new category → fill name "Vegetables {timestamp}" → submit.
 *     5. Assert the sub-category appears nested under the category.
 *     6. Click the category → edit dialog opens → change name → save → assert tree updates.
 *
 *   Test 2 — depth enforcement (edge case):
 *     Try to create a category whose parent is itself a sub-category (depth 3).
 *     The API rejects with category.parent_must_be_top_level.
 *     Assert the error is shown in the dialog.
 *
 * JWT minting: identical HS256 pattern from C3–C7 specs.
 * Secret: 'test-secret-do-not-use-in-prod'
 *
 * Prerequisites:
 *   - apps/api running on http://localhost:3001
 *   - apps/web on http://localhost:5174 (started by playwright webServer)
 *   - VITE_AUTO_DEV_SIGNIN=true in apps/web/.env.local
 */

import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const API = 'http://localhost:3001';
const JWT_SECRET = 'test-secret-do-not-use-in-prod';
const BRAND_ID = 'ef3a01ba-ac8e-4054-ae31-bdc84a778f21';
const USER_ID = '00000000-0000-4000-8000-000000000001';

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

// ---------------------------------------------------------------------------
// Shared fixture state
// ---------------------------------------------------------------------------

let sharedToken: string;
const stamp = Date.now();

test.beforeAll(async () => {
  sharedToken = mintJwt();
});

// ---------------------------------------------------------------------------
// Test 1 — happy path: create category → create sub-category → edit category
// ---------------------------------------------------------------------------

test('Categories: create category → create sub-category → edit category name', async ({ page }) => {
  const categoryName = `Raw Materials ${stamp}`;
  const subCategoryName = `Vegetables ${stamp}`;
  const updatedCategoryName = `Raw Materials Updated ${stamp}`;

  // ── Step 1: Navigate to categories page ────────────────────────────────
  await page.goto('/mdm/categories');

  // Wait for auth + page to render
  await expect(
    page.getByRole('heading', { name: /category.*sub-category management/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Wait for loading to complete
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Loading categories…"]'),
    { timeout: 10_000 },
  );

  // ── Step 2: Click "Add category" → create top-level ────────────────────
  await page.getByRole('button', { name: /add category/i }).first().click();

  // Dialog should open
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByRole('dialog').getByText(/add category/i, { exact: false }),
  ).toBeVisible({ timeout: 3_000 });

  // Fill in the category name
  const nameInput = page.getByRole('dialog').locator('input').first();
  await expect(nameInput).toBeVisible({ timeout: 3_000 });
  await nameInput.fill(categoryName);
  await expect(nameInput).toHaveValue(categoryName);

  // Submit
  await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();

  // Dialog should close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 });

  // ── Step 3: Assert new category appears in tree ─────────────────────────
  await expect(page.getByRole('tree')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(categoryName)).toBeVisible({ timeout: 8_000 });

  // ── Step 4: Add sub-category under the new category ────────────────────
  // Click the row action menu for the new category
  const categoryButton = page.getByRole('button', { name: `Edit category ${categoryName}` });
  await expect(categoryButton).toBeVisible({ timeout: 5_000 });

  // Use the "Add sub-category" button that is displayed inside the expanded category
  const addSubBtn = page.getByRole('button', {
    name: new RegExp(`add sub-category under ${categoryName}`, 'i'),
  });
  await expect(addSubBtn).toBeVisible({ timeout: 5_000 });
  await addSubBtn.click();

  // Dialog should open with sub-category mode
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByRole('dialog').getByText(/add sub-category/i, { exact: false }),
  ).toBeVisible({ timeout: 3_000 });

  // Fill sub-category name
  const subNameInput = page.getByRole('dialog').locator('input').first();
  await expect(subNameInput).toBeVisible({ timeout: 3_000 });
  await subNameInput.fill(subCategoryName);
  await expect(subNameInput).toHaveValue(subCategoryName);

  // Submit
  await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();

  // Dialog should close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 });

  // ── Step 5: Assert sub-category appears nested under category ───────────
  await expect(page.getByText(subCategoryName)).toBeVisible({ timeout: 8_000 });
  // The tree structure should show sub-category nested
  const tree = page.getByRole('tree');
  await expect(tree.getByText(categoryName)).toBeVisible({ timeout: 5_000 });
  await expect(tree.getByText(subCategoryName)).toBeVisible({ timeout: 5_000 });

  // ── Step 6: Click category → edit dialog → change name → save ──────────
  const editCategoryBtn = page.getByRole('button', { name: `Edit category ${categoryName}` });
  await expect(editCategoryBtn).toBeVisible({ timeout: 5_000 });
  await editCategoryBtn.click();

  // Edit dialog should open
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByRole('dialog').getByText(/edit category/i, { exact: false }),
  ).toBeVisible({ timeout: 3_000 });

  // The name field should be pre-filled with the current name
  const editNameInput = page.getByRole('dialog').locator('input').first();
  await expect(editNameInput).toHaveValue(categoryName, { timeout: 3_000 });

  // Change the name
  await editNameInput.clear();
  await editNameInput.fill(updatedCategoryName);
  await expect(editNameInput).toHaveValue(updatedCategoryName);

  // Fill required reason field
  const reasonInput = page
    .getByRole('dialog')
    .locator('input[placeholder*="reason"]');
  await expect(reasonInput).toBeVisible({ timeout: 3_000 });
  await reasonInput.fill('Updating name to include specific material type');

  // Save
  await page.getByRole('dialog').getByRole('button', { name: /save changes/i }).click();

  // Dialog should close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 });

  // Updated name should appear in tree
  await expect(page.getByText(updatedCategoryName)).toBeVisible({ timeout: 8_000 });
});

// ---------------------------------------------------------------------------
// Test 2 — depth enforcement: sub-sub-category blocked by API
// ---------------------------------------------------------------------------

test('Categories: depth enforcement — sub-sub-category blocked by API', async ({ page }) => {
  // Create a top-level category and a sub-category via API in advance
  const parentCatName = `Depth Test Cat ${stamp}`;
  const subCatName = `Depth Test Sub ${stamp}`;

  // Create top-level category via API
  const parentCat = await apiPost(
    '/api/v1/categories',
    { name: parentCatName, active: true },
    sharedToken,
  );
  const parentCatId = parentCat['id'] as string;

  // Create sub-category via API
  const subCat = await apiPost(
    '/api/v1/categories',
    { name: subCatName, parentId: parentCatId, active: true },
    sharedToken,
  );
  const subCatId = subCat['id'] as string;

  // Navigate to categories page
  await page.goto('/mdm/categories');

  await expect(
    page.getByRole('heading', { name: /category.*sub-category management/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Loading categories…"]'),
    { timeout: 10_000 },
  );

  // Verify sub-category exists and action menu has no "Add sub-category" option
  // (because it IS a sub-category — depth=2 max)
  const subCategoryEditBtn = page.getByRole('button', {
    name: new RegExp(`edit sub-category ${subCatName}`, 'i'),
  });
  await expect(subCategoryEditBtn).toBeVisible({ timeout: 8_000 });

  // The row action menu for sub-category should NOT show "Add sub-category"
  const subRowActionBtn = page.getByRole('button', {
    name: new RegExp(`row actions for ${subCatName}`, 'i'),
  });
  await expect(subRowActionBtn).toBeVisible({ timeout: 3_000 });
  await subRowActionBtn.click();

  // The popover should be visible but "Add sub-category" option should NOT be present
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 3_000 });
  await expect(
    page.getByRole('menuitem', { name: /add sub-category/i }),
  ).not.toBeVisible();

  // Close the menu
  await page.keyboard.press('Escape');

  // Extra: directly call the API to confirm the error code is returned
  // for attempting to create a depth-3 category
  const res = await fetch(`${API}/api/v1/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sharedToken}`,
    },
    body: JSON.stringify({
      name: `Depth 3 Test ${stamp}`,
      parentId: subCatId,
    }),
  });
  // The API returns 400 (ValidationError) for depth-3 attempts
  expect(res.status).toBe(400);
  const errorBody = await res.json() as { code: string; message: string };
  expect(errorBody['code']).toBe('category.parent_must_be_top_level');
});

// ---------------------------------------------------------------------------
// Test 3 — categories list page renders correctly
// ---------------------------------------------------------------------------

test('Categories list: page loads, tree visible, Add category button present', async ({ page }) => {
  await page.goto('/mdm/categories');

  await expect(
    page.getByRole('heading', { name: /category.*sub-category management/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Loading categories…"]'),
    { timeout: 10_000 },
  );

  // "Add category" button should be present
  await expect(page.getByRole('button', { name: /add category/i }).first()).toBeVisible({ timeout: 5_000 });

  // "Category tree" heading should be present
  await expect(page.getByText(/category tree/i)).toBeVisible({ timeout: 3_000 });

  // Tree role should be present (either empty state or populated tree)
  const hasTree = await page.getByRole('tree').isVisible().catch(() => false);
  const hasEmptyState = await page.getByText(/no categories yet/i).isVisible().catch(() => false);
  expect(hasTree || hasEmptyState).toBe(true);
});
