import { expect, test } from '@playwright/test'

test.describe('Home Page', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /TAROT TRADING CARD GAME/i })).toBeVisible()
  })

  test('should have navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /begin your journey/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /explore the cards/i })).toBeVisible()
  })

  test('should navigate to tutorial', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('link', { name: /begin your journey/i })
      .first()
      .click()
    await page.waitForURL('/tutorial')
    expect(page.url()).toContain('/tutorial')
  })

  test('should display featured cards section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('The Duality of Fate')).toBeVisible()
  })

  test('should display features section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Mysticism Meets Mastery')).toBeVisible()
    await expect(page.getByText('Zodiac Seasons')).toBeVisible()
    await expect(page.getByText('Elemental Harmony')).toBeVisible()
  })
})
