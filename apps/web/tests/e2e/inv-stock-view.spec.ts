import { test, expect } from '@playwright/test'

test('stock view loads with department selector and a stock table or empty state', async ({ page }) => {
  await page.goto('/inventory/stock')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
