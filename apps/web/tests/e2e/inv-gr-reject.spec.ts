import { test, expect } from '@playwright/test'

test('GR rejection page loads with header, no initial alerts, and draft-GR picker present', async ({ page }) => {
  await page.goto('/inventory/goods-receipts/reject')

  // Page header must be visible
  await expect(
    page.getByRole('heading', { name: /goods receipt rejection at qc/i }),
  ).toBeVisible({ timeout: 10_000 })

  // No role="alert" banners on initial load (no errors, no success yet)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Draft-GR picker must be present
  await expect(
    page.getByRole('combobox', { name: /draft goods receipt/i }),
  ).toBeVisible()
})
