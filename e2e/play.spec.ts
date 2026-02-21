import { expect, test } from '@playwright/test'

test.describe('Play Page', () => {
  test('should load the setup screen', async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible()
  })

  test('should display difficulty options', async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByText('Training')).toBeVisible()
    await expect(page.getByText('Novice')).toBeVisible()
    await expect(page.getByText('Apprentice')).toBeVisible()
    await expect(page.getByText('Master')).toBeVisible()
    await expect(page.getByText('Oracle')).toBeVisible()
  })

  test('should display deck selection', async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByText('Random Deck')).toBeVisible()
  })

  test('should start a game', async ({ page }) => {
    await page.goto('/play')
    await page.getByRole('button', { name: /start game/i }).click()
    // After starting, the game board should appear with player panels
    await expect(page.getByRole('heading', { name: /you/i })).toBeVisible({ timeout: 10000 })
  })

  test('should navigate from nav to play page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /play/i }).first().click()
    await page.waitForURL('/play')
    expect(page.url()).toContain('/play')
  })
})
