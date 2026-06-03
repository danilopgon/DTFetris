import { expect, test } from '@playwright/test'

test('app launches and shows main layout', async ({ page }) => {
  await page.goto('tauri://localhost')
  // TODO: add proper assertions once UI is implemented
  await expect(page).toHaveTitle(/DTF Sheet Optimizer/)
})
