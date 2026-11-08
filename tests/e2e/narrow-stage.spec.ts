import { expect, test } from '@playwright/test'
import { importThroughUi, installBrowserMocks } from './browser-mocks'

test('a sheet wider than the stage stays reachable from its left edge', async ({ page }) => {
  // Regression (PR review): centred overflow pushed the left of a 432 px sheet before the
  // scroll origin of a ~344 px stage at a 1000 px window, where it could not be scrolled to.
  await page.setViewportSize({ width: 1000, height: 800 })
  await installBrowserMocks(page)
  await page.goto('/')
  await importThroughUi(page)
  await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Vista previa de las planchas' })
  const canvas = preview.locator('canvas').first()
  await expect(canvas).toBeVisible()
  const stage = page.locator('main')
  await stage.evaluate((el) => el.scrollTo({ left: 0 }))
  const stageBox = (await stage.boundingBox())!
  const canvasBox = (await canvas.boundingBox())!
  expect(canvasBox.width).toBeGreaterThan(stageBox.width - 48)
  expect(canvasBox.x).toBeGreaterThanOrEqual(stageBox.x)
})
