import { expect, test } from '@playwright/test'

test.describe('Deck Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deck-builder')
  })

  test('should load the deck builder page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /deck builder/i })).toBeVisible()
  })

  test('should display card collection', async ({ page }) => {
    // Wait for cards to render
    await page.waitForTimeout(1000)
    // Should have card images in the collection grid
    const cards = page.locator('img[alt]')
    await expect(cards.first()).toBeVisible()
  })

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Fool')
    await page.waitForTimeout(500)
  })

  test('should show deck panel', async ({ page }) => {
    await expect(page.getByText(/your deck/i).or(page.getByText(/deck \(/i))).toBeVisible()
  })

  test('should navigate from nav to deck builder', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /decks/i }).click()
    await page.waitForURL('/deck-builder')
    expect(page.url()).toContain('/deck-builder')
  })
})
