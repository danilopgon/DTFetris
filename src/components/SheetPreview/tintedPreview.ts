import { isValidColorOverride } from '../../types/domain'

export type PreviewSource = HTMLImageElement | HTMLCanvasElement

// Preview only: never used by export. The LRU retains at most 32 small RGBA canvases,
// not full-resolution originals or one buffer per placement. Weak keys don't retain images.
export function createTintedPreviewCache(maxEntries = 32, maxSide = 512) {
  const sourceIds = new WeakMap<HTMLImageElement, number>()
  const cache = new Map<string, HTMLCanvasElement>()
  let nextId = 0

  return (image: HTMLImageElement, color?: string | null): PreviewSource => {
    if (color == null) return image
    if (!isValidColorOverride(color)) throw new Error('Color de vista previa no válido.')
    let id = sourceIds.get(image)
    if (id === undefined) {
      id = nextId++
      sourceIds.set(image, id)
    }
    const key = `${id}:${color.toUpperCase()}`
    const cached = cache.get(key)
    if (cached) {
      cache.delete(key)
      cache.set(key, cached)
      return cached
    }

    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo crear la vista previa del color.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    // source-in replaces RGB uniformly, multiplying only by the existing source alpha.
    context.globalCompositeOperation = 'source-in'
    context.fillStyle = color
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'source-over'
    cache.set(key, canvas)
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
    return canvas
  }
}

export function getPreviewSourceSize(source: PreviewSource) {
  return source instanceof HTMLCanvasElement
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight }
}

type CropBounds = {
  xPx: number
  yPx: number
  widthPx: number
  heightPx: number
  sourceWidthPx: number
  sourceHeightPx: number
}

/**
 * Maps persisted visible bounds to the drawn preview source in two steps:
 * 1. metadata raster → original image units with ONE uniform factor (bounds are measured
 *    in an integer raster scaled uniformly, e.g. a 10.1 × 10 SVG in an 11 × 10 raster);
 * 2. original units → the drawn source per axis, because tinted thumbnails round width
 *    and height independently (1000 × 101 → 512 × 52).
 */
export function getPreviewCrop(
  bounds: CropBounds,
  natural: { width: number; height: number },
  drawn: { width: number; height: number } = natural,
) {
  const toUnits = Math.max(
    natural.width / bounds.sourceWidthPx,
    natural.height / bounds.sourceHeightPx,
  )
  const sx = (toUnits * drawn.width) / natural.width
  const sy = (toUnits * drawn.height) / natural.height
  return {
    x: bounds.xPx * sx,
    y: bounds.yPx * sy,
    width: bounds.widthPx * sx,
    height: bounds.heightPx * sy,
  }
}
