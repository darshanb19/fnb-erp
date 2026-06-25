import { test, expect } from '@playwright/test'

/**
 * SI-INV-014 — Closing Inventory Entry — POS Daily (Tier 1 hero)
 *
 * Resilient Playwright spec: navigate, wait for h1, assert department picker
 * is present. ARIA queries only (no CSS selectors).
 *
 * The zero-alert assertion is intentionally omitted: a selected department
 * whose cut-off is already past renders a legitimate role="alert" cut-off
 * advisory, which would flake an unconditional zero-alert check.
 *
 * NOTE: e2e requires a live dev DB — do NOT run in CI without one.
 * Run with: npx playwright test inv-closing-pos.spec.ts
 */

test('closing inventory POS page loads with header and dept picker present', async ({ page }) => {
  await page.goto('/inventory/closing/pos')

  // Page header must be visible (Tier-1 acceptance)
  await expect(
    page.getByRole('heading', { name: /closing inventory entry.*pos daily/i }),
  ).toBeVisible({ timeout: 10_000 })

  // Department picker must be present. A native <select> maps to the combobox
  // role; the element carries aria-label="Department".
  await expect(
    page.getByRole('combobox', { name: /department/i }),
  ).toBeVisible()
})
