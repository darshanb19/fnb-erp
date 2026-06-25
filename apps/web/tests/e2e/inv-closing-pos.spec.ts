import { test, expect } from '@playwright/test'

/**
 * SI-INV-014 — Closing Inventory Entry — POS Daily (Tier 1 hero)
 *
 * Resilient Playwright spec: navigate, wait for h1, assert no initial alerts,
 * assert department picker is present.
 *
 * NOTE: e2e requires a live dev DB — do NOT run in CI without one.
 * Run with: npx playwright test inv-closing-pos.spec.ts
 */

test('closing inventory POS page loads with header, no initial alerts, and dept picker present', async ({ page }) => {
  await page.goto('/inventory/closing/pos')

  // Page header must be visible (Tier-1 acceptance)
  await expect(
    page.getByRole('heading', { name: /closing inventory entry.*pos daily/i }),
  ).toBeVisible({ timeout: 10_000 })

  // No role="alert" banners on initial load (no errors, no warnings yet)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Department picker must be present (native <select> with id "closing-dept")
  await expect(
    page.locator('#closing-dept'),
  ).toBeVisible()
})
