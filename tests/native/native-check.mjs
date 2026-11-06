// Opt-in native check of the production EXE: real WebView2, real Tauri IPC and real
// Windows file dialogs. Playwright drives the WebView2 through a CDP port enabled only
// for this child process; tests/native/uia.ps1 drives the native dialogs.
// Usage: npm run test:native (after `npx tauri build --no-bundle`).
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const exe = path.join(repo, 'src-tauri/target/release/dtf-sheet-optimizer.exe')
const uia = path.join(repo, 'tests/native/uia.ps1')
const assetsDir = path.join(process.env.APPDATA, 'com.dtf-sheet-optimizer.app', 'design-assets')
const run = path.join(os.tmpdir(), `dtfetris-native-${Date.now()}`)
const fixtures = path.join(run, 'fixtures')
const out = path.join(run, 'out')
const shots = path.join(run, 'shots')
const log = []
const launched = []
const note = (msg) => {
  log.push(`${new Date().toISOString()} ${msg}`)
  console.log(msg)
}
const SILVER = [0xc0, 0xc0, 0xc0]
// Wry's default WebView2 arguments are kept so the runtime matches production.
const WRY_ARGS = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection'

// ─── PNG helpers (independent of the app's Rust code) ───────────────────────

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function decodePng(source) {
  const buf = Buffer.isBuffer(source) ? source : fs.readFileSync(source)
  let channels
  let pos = 8
  let width, height, phys
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0)
        throw new Error('PNG no soportado: se esperaba RGB/RGBA de 8 bits sin entrelazado.')
      channels = data[9] === 6 ? 4 : 3
    } else if (type === 'pHYs') {
      phys = { x: data.readUInt32BE(0), y: data.readUInt32BE(4), unit: data[8] }
    } else if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0
      const b = y > 0 ? px[(y - 1) * stride + i] : 0
      const c = i >= channels && y > 0 ? px[(y - 1) * stride + i - channels] : 0
      const p = a + b - c
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c
      const pred = [0, a, b, (a + b) >> 1, paeth][filter]
      px[y * stride + i] = (line[i] + pred) & 0xff
    }
  }
  if (channels === 4) return { width, height, phys, px }
  const rgba = Buffer.alloc(width * height * 4, 255)
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) rgba.set(px.subarray(i, i + 3), j)
  return { width, height, phys, px: rgba }
}

// ─── Process, CDP and dialog helpers ────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function launch(label) {
  const port = await freePort()
  const child = spawn(exe, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${WRY_ARGS} --remote-debugging-port=${port}`,
    },
    stdio: 'ignore',
  })
  let exited = false
  child.on('exit', () => (exited = true))
  launched.push({ child, isExited: () => exited })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (exited) throw new Error('El EXE terminó al arrancar.')
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) break
    } catch {
      /* not ready */
    }
    await sleep(300)
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  let page
  while (!page && Date.now() < deadline) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes('tauri.localhost'))
    if (!page) await sleep(200)
  }
  if (!page) throw new Error('No se encontró la página de la app en WebView2.')
  const problems = []
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) =>
    problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
  )
  await page.getByRole('heading', { name: 'DTFetris' }).waitFor()
  note(`[${label}] EXE pid ${child.pid}, CDP ${port}, ${page.url()}`)
  return { child, browser, page, problems, isExited: () => exited }
}

function uiaRun(pid, args) {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', uia, '-ProcessId', String(pid), ...args],
    { encoding: 'utf8' },
  ).trim()
}

async function viaDialog(app, trigger, args) {
  await trigger()
  // The plugin's open()/save() resolve asynchronously; the dialog is driven meanwhile.
  const result = uiaRun(app.child.pid, ['-Action', 'dialog', ...args])
  note(`  ${result}`)
}

async function close(app, label) {
  await app.browser.close().catch(() => {})
  note(`  ${uiaRun(app.child.pid, ['-Action', 'close'])}`)
  const deadline = Date.now() + 15_000
  while (!app.isExited() && Date.now() < deadline) await sleep(200)
  if (!app.isExited()) throw new Error(`[${label}] el EXE no terminó tras cerrar la ventana.`)
  note(`[${label}] cerrado por WindowPattern.Close`)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true })
}

async function expectText(page, re) {
  await page.getByText(re).first().waitFor({ timeout: 30_000 })
}

/**
 * Proves real artwork reached the Konva canvas: colours other than the grey transparency
 * board. Asset-protocol images taint the canvas, so pixels come from a CDP screenshot.
 */
async function canvasArtwork(page) {
  const png = await page
    .getByRole('region', { name: 'Vista previa de las planchas' })
    .locator('canvas')
    .first()
    .screenshot()
  const { px } = decodePng(png)
  const colors = new Map()
  for (let i = 0; i < px.length; i += 4) {
    const key = `${px[i]},${px[i + 1]},${px[i + 2]}`
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }
  return [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
}

function manifest() {
  if (!fs.existsSync(assetsDir)) return new Map()
  return new Map(
    fs.readdirSync(assetsDir).map((name) => {
      const file = path.join(assetsDir, name)
      return [name, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]
    }),
  )
}

// ─── Scenario ───────────────────────────────────────────────────────────────

async function main() {
  if (process.platform !== 'win32') throw new Error('La prueba nativa solo corre en Windows.')
  if (!fs.existsSync(exe))
    throw new Error(`Falta el EXE: ${exe}. Ejecuta npx tauri build --no-bundle.`)
  for (const dir of [fixtures, out, shots]) fs.mkdirSync(dir, { recursive: true })
  note(`Carpeta de la prueba: ${run}`)
  note(`EXE ${exe} (${fs.statSync(exe).mtime.toISOString()})`)

  // Synthetic fixtures: 2:1 PNG artwork with transparent padding and hole, and a vector SVG.
  fs.writeFileSync(
    path.join(fixtures, 'logo.png'),
    encodePng(240, 140, (x, y) => {
      const art = x >= 20 && x < 220 && y >= 20 && y < 120
      const hole = x >= 100 && x < 140 && y >= 50 && y < 90
      return art && !hole ? [220, 30, 30, 255] : [0, 0, 0, 0]
    }),
  )
  fs.writeFileSync(
    path.join(fixtures, 'vector.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#1d4ed8"/></svg>',
  )
  const before = manifest()
  note(`design-assets antes: ${before.size} archivos`)

  const results = { ok: false }
  let created = []
  try {
    // ── First session: import, edit, generate, save, export ──
    let app = await launch('sesión 1')
    let page = app.page
    await shot(page, '01-inicio')

    await viaDialog(
      app,
      () => page.getByRole('button', { name: 'Seleccionar archivo PNG o SVG' }).click(),
      ['-Folder', fixtures, '-FileName', '"logo.png" "vector.svg"'],
    )
    await expectText(page, '2 archivos seleccionados')
    await page.getByRole('spinbutton', { name: 'Ancho máximo en centímetros' }).fill('8')
    await page.getByRole('spinbutton', { name: 'Alto máximo en centímetros' }).fill('8')
    await page.getByRole('button', { name: 'Importar diseño', exact: true }).click()
    await page.getByRole('button', { name: 'Editar logo', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Editar vector', exact: true }).waitFor()
    note('Importados logo.png y vector.svg desde el selector real')

    await page.getByLabel('Ancho de plancha (cm)').fill('20')
    await page.getByLabel('Alto de plancha (cm)').fill('20')
    await page.getByLabel('Separación entre diseños (mm)').fill('10')
    await page.getByRole('button', { name: 'Aplicar configuración', exact: true }).click()

    await page.getByRole('button', { name: 'Editar logo', exact: true }).click()
    await page.getByLabel('Cantidad', { exact: true }).fill('3')
    await page.getByLabel('Color único (opcional)').fill('#c0c0c0')
    await page.getByLabel('Permitir rotación').check()
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await page.getByRole('button', { name: 'Editar vector', exact: true }).click()
    await page.getByLabel('Cantidad', { exact: true }).fill('2')
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()

    await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
    const preview = page.getByRole('region', { name: 'Vista previa de las planchas' })
    await preview.getByRole('figure').first().waitFor()
    await sleep(1000)
    const figures1 = await preview.getByRole('figure').allInnerTexts()
    const artwork1 = await canvasArtwork(page)
    const imageAlerts = await preview.getByRole('alert').count()
    note(`Planchas: ${figures1.length}; ${figures1.map((t) => t.replace(/\s+/g, ' ')).join(' | ')}`)
    note(`Colores dominantes del canvas: ${JSON.stringify(artwork1)}`)
    if (imageAlerts) throw new Error('La vista previa muestra un error de carga de imágenes.')
    if (!artwork1.some(([k]) => k === SILVER.join(',')))
      throw new Error('El canvas no contiene el plata del logo coloreado.')
    if (!artwork1.some(([k]) => k === '29,78,216'))
      throw new Error('El canvas no contiene el azul del SVG.')
    await shot(page, '02-generado')

    const jobPath = path.join(out, 'trabajo.json')
    await viaDialog(
      app,
      () => page.getByRole('button', { name: 'Guardar trabajo', exact: true }).click(),
      ['-FileName', jobPath],
    )
    await expectText(page, /Trabajo guardado/)
    await viaDialog(
      app,
      () => page.getByRole('button', { name: 'Exportar PNG · 300 DPI', exact: true }).click(),
      ['-FileName', path.join(out, 'plancha-a.png')],
    )
    await expectText(page, /Exportación completada/)
    await shot(page, '03-exportado')
    const problems1 = [...app.problems]
    await close(app, 'sesión 1')

    // ── Second session: reopen, recover, regenerate, export with a new name ──
    app = await launch('sesión 2')
    page = app.page
    await viaDialog(
      app,
      () => page.getByRole('button', { name: 'Abrir trabajo', exact: true }).click(),
      ['-FileName', jobPath],
    )
    await expectText(page, /Trabajo recuperado/)
    await page.getByRole('button', { name: 'Generar planchas', exact: true }).click()
    await page
      .getByRole('region', { name: 'Vista previa de las planchas' })
      .getByRole('figure')
      .first()
      .waitFor()
    await sleep(1000)
    const figures2 = await page
      .getByRole('region', { name: 'Vista previa de las planchas' })
      .getByRole('figure')
      .allInnerTexts()
    const artwork2 = await canvasArtwork(page)
    await shot(page, '04-recuperado')
    await viaDialog(
      app,
      () => page.getByRole('button', { name: 'Exportar PNG · 300 DPI', exact: true }).click(),
      ['-FileName', path.join(out, 'plancha-b.png')],
    )
    await expectText(page, /Exportación completada/)
    const problems2 = [...app.problems]
    await close(app, 'sesión 2')

    // ── Independent verification of the files ──
    const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'))
    const byName = Object.fromEntries(job.designs.map((d) => [d.name, d]))
    const checks = {
      jobSheet:
        job.sheetConfig.widthCm === 20 &&
        job.sheetConfig.heightCm === 20 &&
        job.sheetConfig.gapCm === 1,
      jobDesigns:
        job.designs.length === 2 &&
        byName['logo']?.quantity === 3 &&
        byName['logo']?.colorOverride?.toLowerCase() === '#c0c0c0' &&
        byName['logo']?.canRotate === true &&
        byName['vector']?.quantity === 2,
      assetsPrivate: job.designs.every((d) =>
        path.resolve(d.imagePath).startsWith(path.resolve(assetsDir)),
      ),
      samePreview:
        JSON.stringify(figures1) === JSON.stringify(figures2) &&
        artwork2.some(([k]) => k === SILVER.join(',')),
    }
    const pngsA = fs
      .readdirSync(out)
      .filter((f) => /^plancha-a.*\.png$/.test(f))
      .sort()
    const pngsB = fs
      .readdirSync(out)
      .filter((f) => /^plancha-b.*\.png$/.test(f))
      .sort()
    checks.pngCount = pngsA.length === figures1.length && pngsB.length === pngsA.length
    const expectedPx = Math.round((20 * 300) / 2.54)
    const pngReport = []
    let opaqueTotal = 0
    for (let i = 0; i < pngsA.length; i++) {
      const a = decodePng(path.join(out, pngsA[i]))
      const b = decodePng(path.join(out, pngsB[i]))
      const colors = new Map()
      let transparent = 0
      let partial = 0
      for (let p = 0; p < a.px.length; p += 4) {
        const alpha = a.px[p + 3]
        if (alpha === 0) transparent++
        else if (alpha === 255) {
          const key = `${a.px[p]},${a.px[p + 1]},${a.px[p + 2]}`
          colors.set(key, (colors.get(key) ?? 0) + 1)
          opaqueTotal++
        } else partial++
      }
      pngReport.push({
        file: pngsA[i],
        size: `${a.width}x${a.height}`,
        phys: a.phys,
        identicalToB: a.width === b.width && a.height === b.height && a.px.equals(b.px),
        transparent,
        partialAlpha: partial,
        opaqueColors: [...colors.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4),
      })
    }
    checks.pngSize = pngReport.every((r) => r.size === `${expectedPx}x${expectedPx}`)
    checks.pngDpi = pngReport.every(
      (r) => r.phys?.unit === 1 && r.phys.x === 11811 && r.phys.y === 11811,
    )
    checks.pngIdentical = pngReport.every((r) => r.identicalToB)
    checks.pngTransparent = pngReport.every((r) => r.transparent > 0)
    checks.pngSilverAndBlue =
      pngReport.some((r) => r.opaqueColors.some(([k]) => k === SILVER.join(','))) &&
      pngReport.some((r) => r.opaqueColors.some(([k]) => k === '29,78,216'))
    checks.noRuntimeErrors = problems1.length === 0 && problems2.length === 0

    Object.assign(results, { checks, pngReport, figures1, problems1, problems2, opaqueTotal })
    results.ok = Object.values(checks).every(Boolean)
  } finally {
    for (const app of launched) if (!app.isExited()) app.child.kill()
    await sleep(500)
    // design-assets cannot be redirected (Tauri resolves it through the Shell API), so only
    // the copies this run added are removed; pre-existing files must stay untouched.
    const after = manifest()
    created = [...after.keys()].filter((name) => !before.has(name))
    const changed = [...before.keys()].filter((name) => after.get(name) !== before.get(name))
    for (const name of created) fs.rmSync(path.join(assetsDir, name))
    results.assets = {
      before: before.size,
      createdAndRemoved: created,
      preexistingChanged: changed,
    }
    note(
      `design-assets: ${created.length} copias de la prueba eliminadas; preexistentes alterados: ${changed.length}`,
    )
    if (changed.length) results.ok = false
    fs.writeFileSync(path.join(run, 'resultado.json'), JSON.stringify(results, null, 2))
    fs.writeFileSync(path.join(run, 'registro.log'), log.join('\n'))
  }
  console.log(JSON.stringify(results, null, 2))
  if (!results.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  fs.mkdirSync(run, { recursive: true })
  fs.writeFileSync(
    path.join(run, 'registro.log'),
    [...log, String(error?.stack ?? error)].join('\n'),
  )
  process.exitCode = 1
})
