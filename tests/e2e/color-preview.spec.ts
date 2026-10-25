import { expect, test } from '@playwright/test'
import { importThroughUi, installBrowserMocks } from './browser-mocks'

for (const format of ['png', 'svg'] as const) {
  test(`${format}: actual preview pixels preserve alpha, clear restores originals, IPC preserves color`, async ({
    page,
  }) => {
    await installBrowserMocks(page)
    await page.goto('/')
    await page.evaluate((format) => {
      window.browserMocks.imageFormat = format
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="25" height="50" fill="#2563eb"/><rect x="50" width="25" height="50" fill="#ef4444" opacity="0.5"/><rect x="75" width="25" height="50" fill="#22c55e"/></svg>'
      if (format === 'svg') {
        window.browserMocks.imageDataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`
      } else {
        // A real PNG fixture with two colors, a transparent hole and half-alpha artwork.
        const canvas = document.createElement('canvas')
        canvas.width = 100
        canvas.height = 50
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#2563eb'
        ctx.fillRect(0, 0, 25, 50)
        ctx.fillStyle = '#ef4444'
        ctx.globalAlpha = 0.5
        ctx.fillRect(50, 0, 25, 50)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(75, 0, 25, 50)
        window.browserMocks.imageDataUrl = canvas.toDataURL('image/png')
      }
    }, format)
    await importThroughUi(page)
    const edit = page.getByRole('button', { name: `Editar logo.${format}`, exact: true })
    const generate = page.getByRole('button', { name: 'Generar planchas', exact: true })
    const preview = page.getByRole('region', { name: 'Vista previa de las planchas' })
    const pixels = () =>
      preview
        .locator('canvas')
        .first()
        .evaluate((canvas: HTMLCanvasElement) => {
          const ctx = canvas.getContext('2d')!
          // Cell 60x100 cm at 6 px/cm: fitted artwork 360x180, centered vertically.
          const ratio = canvas.width / 360
          return [45, 135, 225, 315].map((x) =>
            Array.from(ctx.getImageData(Math.round(x * ratio), Math.round(300 * ratio), 1, 1).data),
          )
        })
    await edit.click()
    await page.getByLabel('Color único (opcional)').fill('#ff0000')
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await generate.click()
    await expect.poll(pixels).toEqual([
      [255, 0, 0, 255],
      [209, 213, 219, 255],
      [232, 106, 109, 255],
      [255, 0, 0, 255],
    ])
    await page.getByRole('button', { name: /Exportar PNG/ }).click()
    expect(
      await page.evaluate(
        () => window.browserMocks.calls.find((call) => call.command === 'export_png')?.args,
      ),
    ).toMatchObject({ designs: [{ colorOverride: '#ff0000', format }] })
    await page.getByRole('button', { name: 'Guardar trabajo', exact: true }).click()
    expect(await page.evaluate(() => window.browserMocks.savedJob?.designs[0].colorOverride)).toBe(
      '#ff0000',
    )
    await edit.click()
    await page.getByRole('button', { name: 'Usar colores originales', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await generate.click()
    await expect.poll(async () => (await pixels())[0]).toEqual([37, 99, 235, 255])
    await page.getByRole('button', { name: 'Abrir trabajo', exact: true }).click()
    await generate.click()
    await expect.poll(async () => (await pixels())[0]).toEqual([255, 0, 0, 255])
  })
}
