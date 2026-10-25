import { expect, test } from '@playwright/test'
import { importThroughUi, installBrowserMocks } from './browser-mocks'

test('separation draft blocks output; mm/cm conversion, fitted footprint, counts and legacy gaps survive IPC', async ({
  page,
}) => {
  await installBrowserMocks(page)
  await page.goto('/')
  const gap = page.getByLabel('Separación entre diseños (mm)', { exact: true })
  await expect(gap).toHaveValue('3')
  await importThroughUi(page)
  await page.getByRole('button', { name: 'Editar logo.svg', exact: true }).click()
  await page.getByLabel('Cantidad', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await gap.fill('1.25')
  for (const name of ['Generar planchas', 'Guardar trabajo', 'Exportar PNG · 300 DPI']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Aplicar configuración', exact: true }).click()
  await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Vista previa de las planchas' })
  await expect(preview.getByRole('figure')).toHaveCount(2)
  await expect(preview.getByRole('figure').first()).toContainText('1 copia')
  await page.getByRole('button', { name: /Exportar PNG/ }).click()
  expect(
    await page.evaluate(
      () => window.browserMocks.calls.find((call) => call.command === 'export_png')?.args,
    ),
  ).toMatchObject({
    designs: [{ widthCm: 60, heightCm: 100, quantity: 2 }],
    sheets: [
      { gapCm: 0.125, placements: [{ widthCm: 60, heightCm: 30, xCm: 0, yCm: 0 }] },
      { gapCm: 0.125, placements: [{ widthCm: 60, heightCm: 30, xCm: 0, yCm: 0 }] },
    ],
  })
  await page.getByRole('button', { name: 'Guardar trabajo', exact: true }).click()
  expect(await page.evaluate(() => window.browserMocks.savedJob?.sheetConfig.gapCm)).toBe(0.125)
  // Legacy Job v1: missing gap stays zero, rather than inheriting the new-job default.
  await page.evaluate(() => {
    delete window.browserMocks.savedJob!.sheetConfig.gapCm
  })
  await page.getByRole('button', { name: 'Abrir trabajo', exact: true }).click()
  await expect(gap).toHaveValue('0')
  await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
  await expect(preview.getByRole('figure')).toHaveCount(2)
  expect(
    await page.evaluate(() => {
      const calls = window.browserMocks.calls.filter((call) => call.command === 'run_packing')
      return (
        (calls[calls.length - 1].args.request as { sheet: { gapCm?: number } }).sheet.gapCm ?? 0
      )
    }),
  ).toBe(0)
})
