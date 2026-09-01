import { expect, test } from '@playwright/test'

test.describe('Home Page', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Tarot TCG', exact: true })).toBeVisible()
  })

  test('should have navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^play$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /browse cards/i })).toBeVisible()
  })

  test('should navigate to play', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('link', { name: /^play$/i })
      .first()
      .click()
    await page.waitForURL('/play')
    expect(page.url()).toContain('/play')
  })

  test('should display dual-face section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Upright and reversed' })).toBeVisible()
  })

  test('should display match facts', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'A match' })).toBeVisible()
    await expect(page.getByText('Draw a face')).toBeVisible()
    await expect(page.getByText('Seven slots')).toBeVisible()
  })
})
