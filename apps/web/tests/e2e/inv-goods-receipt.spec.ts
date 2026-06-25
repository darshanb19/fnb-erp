import { test, expect } from '@playwright/test'

test('goods-receipt entry page loads with header, no initial alerts, and dept picker present', async ({ page }) => {
  await page.goto('/inventory/goods-receipts/new')

  // Page header must be visible
  await expect(
    page.getByRole('heading', { name: /goods receipt entry/i }),
  ).toBeVisible({ timeout: 10_000 })

  // No role="alert" banners on initial load (no errors, no warnings yet)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Destination department picker must be present
  await expect(
    page.getByRole('combobox', { name: /destination department/i }),
  ).toBeVisible()
})
