import { test, expect } from '@playwright/test'

test('paired cross-cluster transfer page loads with header and no error alert', async ({ page }) => {
  await page.goto('/inventory/transfers/paired')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
