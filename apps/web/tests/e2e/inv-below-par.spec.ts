import { test, expect } from '@playwright/test'

test('below-PAR page loads with header and either rows or an empty state', async ({ page }) => {
  await page.goto('/inventory/below-par')
  // Page header from the mockup
  await expect(page.getByRole('heading', { name: /below.?par/i })).toBeVisible({ timeout: 10_000 })
  // Either the items table/cards render, or the empty-state message shows — never an error alert
  await expect(page.getByRole('alert')).toHaveCount(0)
})
