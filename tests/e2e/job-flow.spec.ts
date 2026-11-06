import { expect, test } from '@playwright/test'
import { importThroughUi, installBrowserMocks } from './browser-mocks'

test.describe('Browser UI with mocked Tauri IPC (not native Tauri validation)', () => {
  test.beforeEach(async ({ page }) => {
    await installBrowserMocks(page)
    await page.goto('/')
  })

  test('import, edit, multipage preview, metrics, export, save and restore Job v1', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'DTFetris' })).toBeVisible()
    const exportButton = page.getByRole('button', { name: /Exportar PNG/ })
    await expect(exportButton).toBeDisabled()
    await importThroughUi(page)
    await page.getByRole('button', { name: 'Editar logo.svg', exact: true }).click()
    await page.getByLabel('Cantidad', { exact: true }).fill('2')
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(exportButton).toBeDisabled()
    await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
    const preview = page.getByRole('region', { name: 'Vista previa de las planchas' })
    await expect(preview.getByRole('figure')).toHaveCount(2)
    await expect(preview.locator('canvas')).toHaveCount(2)
    const metrics = page.getByRole('region', { name: 'Aprovechamiento' })
    await expect(metrics).toContainText('Arte visible: 3600.0 cm²')
    await expect(metrics).toContainText('Área libre: 8400.0 cm²')
    await expect(metrics).toContainText('Ocupación: 30.0%')
    await expect(page).toHaveScreenshot('composicion-multipagina.png', { fullPage: true })
    await exportButton.click()
    await expect(page.getByText(/Exportación completada: 2/)).toBeVisible()
    const exported = await page.evaluate(
      () => window.browserMocks.calls.find((c) => c.command === 'export_png')?.args,
    )
    expect(exported).toMatchObject({
      outputPath: 'C:/fixtures/plancha.png',
      designs: [{ id: 'logo', quantity: 2, imagePath: 'C:/app-data/logo.svg' }],
    })
    expect(exported?.sheets).toHaveLength(2)
    await page.getByRole('button', { name: 'Guardar trabajo', exact: true }).click()
    await expect(page.getByText(/Trabajo guardado\./)).toBeVisible()
    expect(await page.evaluate(() => window.browserMocks.savedJob)).toMatchObject({
      version: 1,
      sheetConfig: { widthCm: 60, heightCm: 100 },
      designs: [{ quantity: 2 }],
    })
    await page.getByRole('button', { name: 'Duplicar logo.svg', exact: true }).click()
    await expect(preview.getByRole('figure')).toHaveCount(0)
    await page.getByRole('button', { name: 'Abrir trabajo', exact: true }).click()
    await expect(page.getByText(/Trabajo recuperado\./)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(1)
    await expect(exportButton).toBeDisabled()
    await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
    await expect(preview.getByRole('figure')).toHaveCount(2)
    await expect(exportButton).toBeEnabled()
  })

  test('missing import does not add designs and image failures are visible', async ({ page }) => {
    await page.evaluate(() => {
      window.browserMocks.importError = 'file_not_found'
    })
    await importThroughUi(page)
    await expect(page.getByRole('alert')).toContainText(/archivo/i)
    await expect(page.getByText('Aún no hay diseños.')).toBeVisible()
    await page.evaluate(() => {
      window.browserMocks.importError = null
      window.browserMocks.brokenImage = true
    })
    await page.getByRole('button', { name: 'Importar diseño', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('No se pudieron cargar 1 imágenes')
  })
})
