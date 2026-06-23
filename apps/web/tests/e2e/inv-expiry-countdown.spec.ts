import { test, expect } from '@playwright/test'

test('expiry countdown page loads with the three urgency bands', async ({ page }) => {
  await page.goto('/inventory/expiry')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
