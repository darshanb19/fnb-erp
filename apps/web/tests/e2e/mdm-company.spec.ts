/**
 * mdm-company.spec.ts — e2e tests for SI-MDM-007 Company Registration & Fiscal Year.
 *
 * Task C9 acceptance criteria (plan §6):
 *
 *   Test 1 — happy path:
 *     1. Navigate to /mdm/company.
 *     2. Verify the form is prefilled with the seed brand legal name "Demo F&B Pvt Ltd".
 *     3. Edit the trading name to "Demo F&B Updated {timestamp}".
 *     4. Open Save → enter reason "Updating trading name for branding consistency".
 *     5. Click Save changes → verify success.
 *     6. Reload the page → verify the new trading name persists.
 *
 *   Test 2 — DL-024 surface (edit-only, no create):
 *     1. Verify the page does NOT have any "Create new brand" / "New brand" /
 *        "Add brand" button.
 *     2. Verify country select is read-only (disabled).
 *     3. Verify accounting currency is read-only.
 *     4. Count buttons matching /create.*brand/i → expected 0.
 *
 *   Test 3 — Mark setup complete one-way (optional, if status is setup_pending):
 *     1. Read status pill — if "Pending", click "Mark setup complete".
 *     2. Enter reason ≥ 10 chars → confirm.
 *     3. Verify status pill becomes "Setup Complete".
 *     4. Verify the "Mark setup complete" button is gone.
 *
 * JWT minting: identical HS256 pattern from C3–C8 specs.
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
// JWT mint helper (pure node:crypto — no external dep)
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

async function apiPatch(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let sharedToken: string;

test.beforeAll(async () => {
  sharedToken = mintJwt();

  // Reset trading name before tests so state is predictable
  try {
    await apiPatch(
      '/api/v1/company',
      { tradingName: null, reason: 'e2e test reset before C9 suite' },
      sharedToken,
    );
  } catch {
    // If the reset fails (e.g., reason too short) — tolerate; tests will still work
  }
});

// ---------------------------------------------------------------------------
// Test 1 — Happy path: view prefilled + edit trading name + verify persistence
// ---------------------------------------------------------------------------

test('Company page: prefilled with seed brand + editing trading name persists on reload', async ({
  page,
}) => {
  const stamp = Date.now();
  const newTradingName = `Demo F&B Updated ${stamp}`;

  // Navigate to the company page
  await page.goto('/mdm/company');

  // Wait for the page heading to be visible
  await expect(
    page.getByRole('heading', { name: /company registration/i }),
  ).toBeVisible({ timeout: 15_000 });

  // 1. Verify the legal name input is prefilled with seed value
  const legalNameInput = page.locator('#legal_name');
  await expect(legalNameInput).toBeVisible({ timeout: 10_000 });
  await expect(legalNameInput).toHaveValue('Demo F&B Pvt Ltd');

  // 2. Edit the trading name
  const tradingNameInput = page.locator('#trading_name');
  await expect(tradingNameInput).toBeVisible();
  await tradingNameInput.fill(newTradingName);
  await expect(tradingNameInput).toHaveValue(newTradingName);

  // 3. Open the Save changes popover
  const saveButton = page.getByRole('button', { name: /save changes/i });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // 4. Enter reason in the Save dialog
  const reasonInput = page.locator('#save-reason');
  await expect(reasonInput).toBeVisible({ timeout: 5_000 });
  await reasonInput.fill('Updating trading name for branding consistency');

  // 5. Submit save
  const confirmSaveButton = page.getByRole('button', { name: /save changes/i }).last();
  await expect(confirmSaveButton).toBeEnabled();
  await confirmSaveButton.click();

  // 6. Wait for success feedback (success message or trading name in card header)
  await expect(
    page.getByRole('status').filter({ hasText: /changes saved/i }),
  ).toBeVisible({ timeout: 10_000 });

  // 7. Reload and verify persistence
  await page.reload();

  await expect(
    page.getByRole('heading', { name: /company registration/i }),
  ).toBeVisible({ timeout: 15_000 });

  const tradingNameAfterReload = page.locator('#trading_name');
  await expect(tradingNameAfterReload).toBeVisible({ timeout: 10_000 });
  await expect(tradingNameAfterReload).toHaveValue(newTradingName);
});

// ---------------------------------------------------------------------------
// Test 2 — DL-024 surface: no create affordance; read-only country + currency
// ---------------------------------------------------------------------------

test('Company page: DL-024 — no create-brand affordance; country and currency are read-only', async ({
  page,
}) => {
  await page.goto('/mdm/company');

  await expect(
    page.getByRole('heading', { name: /company registration/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Wait for form to be hydrated from API
  await expect(page.locator('#legal_name')).toBeVisible({ timeout: 10_000 });

  // 1. Verify no "Create" / "New brand" / "Add brand" button exists
  const createBrandButtons = page.getByRole('button', { name: /create.*brand|new brand|add brand/i });
  await expect(createBrandButtons).toHaveCount(0);

  // 2. Verify country select is disabled (read-only in MVP)
  const countrySelect = page.locator('#country');
  await expect(countrySelect).toBeVisible();
  await expect(countrySelect).toBeDisabled();

  // 3. Verify accounting currency is disabled
  const currencySelects = page.locator('select[id="accounting_currency"], select[id="display_currency"]');
  const currencyCount = await currencySelects.count();
  expect(currencyCount).toBeGreaterThan(0);
  // Check all currency selects are disabled
  for (let i = 0; i < currencyCount; i++) {
    await expect(currencySelects.nth(i)).toBeDisabled();
  }

  // 4. Verify DL-024 helper text is visible
  await expect(
    page.getByText(/single brand row for this F&B ERP deployment/i),
  ).toBeVisible();

  // 5. Confirm zero buttons matching /create.*brand/i
  const allButtons = page.getByRole('button');
  const buttonCount = await allButtons.count();
  let createBrandCount = 0;
  for (let i = 0; i < buttonCount; i++) {
    const text = await allButtons.nth(i).textContent();
    if (text && /create.*brand/i.test(text)) {
      createBrandCount++;
    }
  }
  expect(createBrandCount).toBe(0);
});

// ---------------------------------------------------------------------------
// Test 3 — Mark setup complete one-way (optional; runs if status is setup_pending)
// ---------------------------------------------------------------------------

test('Company page: Mark setup complete — one-way DL-024 transition', async ({ page }) => {
  await page.goto('/mdm/company');

  await expect(
    page.getByRole('heading', { name: /company registration/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Wait for the form and status section to load
  await expect(page.locator('#legal_name')).toBeVisible({ timeout: 10_000 });

  // Check if the "Mark setup complete" button exists (present only when setup_pending)
  const markButtonCount = await page
    .getByRole('button', { name: /mark setup complete/i })
    .count();

  if (markButtonCount === 0) {
    // Already setup_complete — verify status pill is correct and CTA is gone
    await expect(page.getByText('Setup Complete').first()).toBeVisible();
    return;
  }

  // Status is setup_pending — proceed with the one-way transition
  const markCompleteButton = page.getByRole('button', {
    name: /mark setup complete/i,
  });
  await expect(markCompleteButton).toBeVisible();
  await markCompleteButton.click();

  // Enter reason in the popover dialog
  const reasonInput = page.locator('#mark-complete-reason');
  await expect(reasonInput).toBeVisible({ timeout: 5_000 });
  await reasonInput.fill('Onboarding finished — ready to record FY transactions.');

  // Submit the one-way transition (the confirm button inside the popover dialog)
  // aria-label="Confirm mark setup complete" on the inner confirm button
  const confirmButton = page.getByRole('button', { name: /confirm mark setup complete/i });
  await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
  await confirmButton.click();

  // Wait for the popover to close (mutation completes and state updates)
  await expect(
    page.getByRole('button', { name: /mark setup complete/i }),
  ).toHaveCount(0, { timeout: 10_000 });

  // Verify status pill transitions to "Setup Complete"
  // Use the header status pill (the first one in the page header area)
  const setupCompleteLabel = page.getByText('Setup Complete', { exact: true });
  await expect(setupCompleteLabel.first()).toBeVisible({ timeout: 10_000 });
});
