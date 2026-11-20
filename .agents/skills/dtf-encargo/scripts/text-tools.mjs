// Artwork helpers for orders that ask for text the archive does not have, or for recolouring
// only part of a logo. They run in headless Chrome (canvas + a local font) and write
// transparent PNGs; nothing here touches the source files.
//
//   node text-tools.mjs text    --text "MANTENIMIENTO" --color "#ED1C24" --out word.png
//                               [--font <ttf>] [--weight 700] [--px 300]
//   node text-tools.mjs recolor --in logo.png --out logo-white.png --to "#FFFFFF"
//                               [--match red|"#RRGGBB"] [--tolerance 60] [--keep-largest]
//   node text-tools.mjs stack   --in logo.png --text "SAD" --color "#FFFFFF" --out logo-sad.png
//                               [--font <ttf>] [--weight 700] [--cap-px 90] [--gap-px 55]
//   node text-tools.mjs sample  --in logo.png [--match red]     (prints the most common matching colour)
//
// --keep-largest leaves the largest connected piece untouched (the coat of arms or icon) and
// recolours matching pixels everywhere else (the lettering around it). Alpha is preserved.
// Default font: Open Sans (local variable font), which matched archived lettering before.
// Needs Chrome and puppeteer-core (npm i -g puppeteer-core).
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const [cmd, ...rest] = process.argv.slice(2)
const opt = (k, d) => {
  const i = rest.indexOf(`--${k}`)
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : d
}
const has = (k) => rest.includes(`--${k}`)
const fail = (m) => {
  console.error(m)
  process.exit(2)
}
if (!['text', 'recolor', 'stack', 'sample'].includes(cmd)) fail('Uso: text | recolor | stack | sample (ver cabecera del script).')

const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => p && fs.existsSync(p))
if (!chrome) fail('No se encontró Chrome; define CHROME_PATH.')
const puppeteer = require(path.join(execSync('npm root -g').toString().trim(), 'puppeteer-core'))
const fontPath =
  opt('font') ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Windows', 'Fonts', 'OpenSans-VariableFont_wdth,wght.ttf')
const needsFont = cmd === 'text' || cmd === 'stack'
if (needsFont && !fs.existsSync(fontPath)) fail(`No existe la fuente ${fontPath}; pásala con --font.`)
const hexToRgb = (h) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(h ?? '')) fail(`Color no válido: ${h} (usa #RRGGBB).`)
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`

const browser = await puppeteer.launch({ executablePath: chrome, headless: true })
try {
  const page = await browser.newPage()
  // Fonts are embedded as data URLs: an about:blank page may not load file:// fonts.
  if (needsFont) {
    await page.setContent(
      `<style>@font-face{font-family:F;src:url("${dataUrl(fontPath, 'font/ttf')}");font-weight:100 900}</style><div style="font-family:F">x</div>`,
    )
    await page.evaluate((w) => document.fonts.load(`${w} 100px F`), opt('weight', '700'))
  }
  const args = {
    cmd,
    text: opt('text'),
    weight: opt('weight', '700'),
    px: Number(opt('px', '300')),
    capPx: opt('cap-px') ? Number(opt('cap-px')) : null,
    gapPx: opt('gap-px') ? Number(opt('gap-px')) : null,
    color: opt('color') ? hexToRgb(opt('color')) : null,
    to: opt('to') ? hexToRgb(opt('to')) : null,
    match: opt('match', 'red'),
    tolerance: Number(opt('tolerance', '60')),
    keepLargest: has('keep-largest'),
    image: opt('in') ? dataUrl(opt('in'), 'image/png') : null,
  }
  if ((cmd === 'text' || cmd === 'stack') && (!args.text || !args.color)) fail('Faltan --text y --color.')
  if (cmd !== 'text' && !args.image) fail('Falta --in <png>.')
  if (cmd === 'recolor' && !args.to) fail('Falta --to #RRGGBB.')

  const result = await page.evaluate(async (a) => {
    const load = async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c
    }
    const matcher = (m, tol) => {
      if (m === 'red') return (r, g, b) => r > 150 && g < 90 && b < 90
      const t = [1, 3, 5].map((i) => parseInt(m.slice(i, i + 2), 16))
      return (r, g, b) => Math.abs(r - t[0]) + Math.abs(g - t[1]) + Math.abs(b - t[2]) <= tol
    }
    const largestMask = (px, W, H) => {
      const label = new Int32Array(W * H)
      let best = 0
      let bestSize = 0
      let next = 0
      const vis = (i) => px[i * 4 + 3] >= 3
      for (let s = 0; s < W * H; s++) {
        if (label[s] || !vis(s)) continue
        next++
        let size = 0
        const stack = [s]
        label[s] = next
        while (stack.length) {
          const i = stack.pop()
          size++
          const x = i % W
          const y = (i - x) / W
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx
              const ny = y + dy
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              const n = ny * W + nx
              if (!label[n] && vis(n)) {
                label[n] = next
                stack.push(n)
              }
            }
        }
        if (size > bestSize) {
          bestSize = size
          best = next
        }
      }
      return (i) => label[i] === best
    }
    const textCanvas = (text, weight, px, rgb) => {
      const t = document.createElement('canvas')
      const ctx = t.getContext('2d')
      const font = `${weight} ${px}px F`
      ctx.font = font
      const m = ctx.measureText(text)
      t.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 8
      t.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 8
      ctx.font = font
      ctx.fillStyle = `rgb(${rgb})`
      ctx.fillText(text, 4 + m.actualBoundingBoxLeft, 4 + m.actualBoundingBoxAscent)
      return t
    }

    if (a.cmd === 'text') {
      const t = textCanvas(a.text, a.weight, a.px, a.color)
      return { png: t.toDataURL('image/png'), size: [t.width, t.height] }
    }
    const c = await load(a.image)
    const W = c.width
    const H = c.height
    const ctx = c.getContext('2d')
    const data = ctx.getImageData(0, 0, W, H)
    const px = data.data
    const isMatch = matcher(a.match, a.tolerance)
    const protectedPx = a.keepLargest ? largestMask(px, W, H) : () => false
    if (a.cmd === 'sample') {
      const counts = new Map()
      for (let i = 0; i < W * H; i++) {
        if (px[i * 4 + 3] !== 255 || protectedPx(i)) continue
        const [r, g, b] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]
        if (!isMatch(r, g, b)) continue
        const k = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      return { sample: [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5) }
    }
    if (a.cmd === 'recolor') {
      let changed = 0
      for (let i = 0; i < W * H; i++) {
        if (px[i * 4 + 3] === 0 || protectedPx(i)) continue
        if (!isMatch(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) continue
        px.set(a.to, i * 4)
        changed++
      }
      ctx.putImageData(data, 0, 0)
      return { png: c.toDataURL('image/png'), size: [W, H], changed }
    }
    // stack: text centred under the image.
    const cap = a.capPx ?? Math.round(H * 0.09)
    const t = textCanvas(a.text, a.weight, Math.round(cap / 0.714), a.color)
    const gap = a.gapPx ?? Math.round(cap * 0.6)
    const out = document.createElement('canvas')
    out.width = Math.max(W, t.width)
    out.height = H + gap + t.height
    const o = out.getContext('2d')
    o.drawImage(c, Math.round((out.width - W) / 2), 0)
    o.drawImage(t, Math.round((out.width - t.width) / 2), H + gap)
    return { png: out.toDataURL('image/png'), size: [out.width, out.height] }
  }, args)

  if (result.sample) console.log(JSON.stringify(result.sample))
  else {
    fs.writeFileSync(opt('out') ?? fail('Falta --out <png>.'), Buffer.from(result.png.split(',')[1], 'base64'))
    console.log(JSON.stringify({ out: opt('out'), size: result.size, changed: result.changed }))
  }
} finally {
  await browser.close()
}
