import { expect, test } from '@playwright/test'

test.describe('Rules', () => {
  test('shows how to play and reversed card text', async ({ page }) => {
    await page.goto('/rules')
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upright and reversed' })).toBeVisible()
    await expect(page.getByText('Reckless Abandon')).toBeVisible()
  })

  test('rules is linked from the header', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: 'Rules' }).click()
    await expect(page).toHaveURL(/\/rules/)
  })
})
