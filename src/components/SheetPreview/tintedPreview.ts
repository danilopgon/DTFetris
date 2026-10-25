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
