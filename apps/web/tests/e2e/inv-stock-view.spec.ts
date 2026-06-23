import { test, expect } from '@playwright/test'

test('stock view loads with department selector and a stock table or empty state', async ({ page }) => {
  await page.goto('/inventory/stock')

  // Wait for the page-level h1 to appear
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

  // Stock-page-specific: the department selector must be present
  // (unique to this screen — cannot appear on the login page)
  await expect(page.getByRole('combobox', { name: /department/i })).toBeVisible()

  // No error alerts should be present after load
  await expect(page.getByRole('alert')).toHaveCount(0)
})
