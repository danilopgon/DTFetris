// Independent check of an exported DTF sheet against its packing layout (no DTFetris code):
// every visible pixel lies inside a placement, placements keep the gap, each placement's art
// reaches its box edges (right visible size), plus size/DPI and dominant opaque colors.
//
// Usage: node verify-layout.mjs <plancha.png> <layout.json>
//   layout.json: the array printed by mcp-client.mjs (uses the last run_packing and the
//   last result carrying `job`), or an object { "layout": ..., "job": ... } saved from
//   the run_packing / get_job tool results.
import fs from 'node:fs'
import zlib from 'node:zlib'

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

const [pngFile, layoutFile, sheetIndexArg] = process.argv.slice(2)
if (!pngFile || !layoutFile) {
  console.error('Uso: node verify-layout.mjs <plancha.png> <layout.json> [índice de plancha, por defecto 0]')
  process.exit(2)
}
const data = JSON.parse(fs.readFileSync(layoutFile, 'utf8'))
let layout, job
if (Array.isArray(data)) {
  layout = data.filter((x) => x.name === 'run_packing').at(-1)?.result.layout
  job = data.filter((x) => x.result?.job).at(-1)?.result.job
} else {
  ;({ layout, job } = data)
}
if (!layout || !job) throw new Error('No se encontró layout y job en el JSON.')
const sheet = layout.sheets[Number(sheetIndexArg ?? 0)]
// A missing gapCm is the legacy zero-gap contract (validate_gap_cm in the app).
const gapMm = (sheet.gapCm ?? 0) * 10
const names = Object.fromEntries(job.designs.map((d) => [d.id, d.name]))
const img = decodePng(pngFile)
const PX = 300 / 2.54
const rects = sheet.placements.map((p) => ({
  name: names[p.designId],
  x0: Math.floor(p.xCm * PX),
  y0: Math.floor(p.yCm * PX),
  x1: Math.ceil((p.xCm + p.widthCm) * PX),
  y1: Math.ceil((p.yCm + p.heightCm) * PX),
  wCm: p.widthCm,
  hCm: p.heightCm,
  rotated: p.rotated,
  ax0: Infinity,
  ay0: Infinity,
  ax1: -1,
  ay1: -1,
}))
let outside = 0
const colors = new Map()
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4
    const a = img.px[i + 3]
    if (a === 255) {
      const k = `${img.px[i]},${img.px[i + 1]},${img.px[i + 2]}`
      colors.set(k, (colors.get(k) ?? 0) + 1)
    }
    if (a < 3) continue
    const r = rects.find((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)
    if (!r) {
      outside++
      continue
    }
    if (x < r.ax0) r.ax0 = x
    if (y < r.ay0) r.ay0 = y
    if (x > r.ax1) r.ax1 = x
    if (y > r.ay1) r.ay1 = y
  }
}
let minArtGapPx = Infinity
for (let i = 0; i < rects.length; i++)
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i]
    const b = rects[j]
    const dx = Math.max(b.ax0 - a.ax1 - 1, a.ax0 - b.ax1 - 1)
    const dy = Math.max(b.ay0 - a.ay1 - 1, a.ay0 - b.ay1 - 1)
    minArtGapPx = Math.min(minArtGapPx, Math.max(dx, dy))
  }
const perDesign = {}
let worstEdgeSlackPx = 0
let artCm2 = 0
for (const r of rects) {
  worstEdgeSlackPx = Math.max(worstEdgeSlackPx, r.ax0 - r.x0, r.ay0 - r.y0, r.x1 - 1 - r.ax1, r.y1 - 1 - r.ay1)
  artCm2 += r.wCm * r.hCm
  perDesign[r.name] ??= { copies: 0, rotated: 0, sizeCm: `${Math.max(r.wCm, r.hCm).toFixed(2)} x ${Math.min(r.wCm, r.hCm).toFixed(2)}` }
  perDesign[r.name].copies++
  if (r.rotated) perDesign[r.name].rotated++
}
const expectedW = Math.round(sheet.widthCm * PX)
const expectedH = Math.round(sheet.heightCm * PX)
const report = {
  sheet: `${sheet.widthCm} x ${sheet.heightCm} cm, separación ${gapMm} mm`,
  png: `${img.width}x${img.height}`,
  sizeOk: img.width === expectedW && img.height === expectedH,
  dpiOk: img.phys?.unit === 1 && img.phys.x === 11811 && img.phys.y === 11811,
  placements: rects.length,
  visiblePixelsOutsidePlacements: outside,
  measuredMinGapMm: +((minArtGapPx * 25.4) / 300).toFixed(3),
  worstEdgeSlackPx,
  artOccupancyPct: +((artCm2 / (sheet.widthCm * sheet.heightCm)) * 100).toFixed(1),
  perDesign,
  topOpaqueColors: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
}
report.ok =
  report.sizeOk &&
  report.dpiOk &&
  outside === 0 &&
  worstEdgeSlackPx <= 2 &&
  report.measuredMinGapMm >= gapMm - 0.2
console.log(JSON.stringify(report, null, 1))
process.exitCode = report.ok ? 0 : 1
