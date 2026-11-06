import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTintedPreviewCache, getPreviewCrop } from './tintedPreview'

afterEach(() => vi.restoreAllMocks())

function makeImage() {
  const image = new Image()
  Object.defineProperties(image, {
    naturalWidth: { value: 2000 },
    naturalHeight: { value: 1000 },
  })
  return image
}

function mockContext() {
  const operations: string[] = []
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    set globalCompositeOperation(value: string) {
      operations.push(value)
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
  return { context, operations }
}

describe('preview-only color cache', () => {
  it('keeps original colors without allocating a canvas', () => {
    const image = makeImage()
    const create = vi.spyOn(document, 'createElement')
    const getPreview = createTintedPreviewCache()
    expect(getPreview(image)).toBe(image)
    expect(getPreview(image, null)).toBe(image)
    expect(create).not.toHaveBeenCalled()
  })

  it('uses source-in to retain alpha and bounded source dimensions without mutating the image', () => {
    const { context, operations } = mockContext()
    const image = makeImage()
    const getPreview = createTintedPreviewCache()
    const canvas = getPreview(image, '#ABCDEF') as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([512, 256])
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 512, 256)
    expect(operations).toEqual(['source-in', 'source-over'])
    expect(context.fillStyle).toBe('#ABCDEF')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 512, 256)
    expect(getPreview(image, '#abcdef')).toBe(canvas)
    expect(image.naturalWidth).toBe(2000)
    expect(context.drawImage).toHaveBeenCalledTimes(1)
  })

  it('evicts least-recently used source/color pairs and separates sources and colors', () => {
    mockContext()
    const image = makeImage()
    const getPreview = createTintedPreviewCache(2)
    const red = getPreview(image, '#FF0000')
    const blue = getPreview(image, '#0000FF')
    expect(red).not.toBe(blue)
    expect(getPreview(image, '#FF0000')).toBe(red)
    expect(getPreview(makeImage(), '#FF0000')).not.toBe(red)
    expect(getPreview(image, '#0000FF')).not.toBe(blue)
  })
})

describe('getPreviewCrop', () => {
  const bounds = {
    xPx: 2,
    yPx: 0,
    widthPx: 10,
    heightPx: 10,
    sourceWidthPx: 11,
    sourceHeightPx: 10,
  }

  it('keeps PNG bounds when the source is the persisted raster', () => {
    expect(getPreviewCrop(bounds, { width: 11, height: 10 })).toEqual({
      x: 2,
      y: 0,
      width: 10,
      height: 10,
    })
  })

  it('uses one uniform factor for a fractional SVG viewport instead of stretching per axis', () => {
    // 10.1 × 10 SVG measured in an 11 × 10 raster at uniform scale 1: the square stays square.
    const crop = getPreviewCrop(bounds, { width: 10.1, height: 10 })
    expect(crop.width).toBe(crop.height)
    expect(crop).toEqual({ x: 2, y: 0, width: 10, height: 10 })
  })

  it('scales larger sources uniformly', () => {
    expect(getPreviewCrop(bounds, { width: 22, height: 20 })).toEqual({
      x: 4,
      y: 0,
      width: 20,
      height: 20,
    })
  })

  it('maps a tinted thumbnail per axis after its independent rounding', () => {
    // Regression (PR review): 1000 × 101 PNG with a 10 × 10 logo at (900, 40) tinted to 512 × 52.
    const logo = {
      xPx: 900,
      yPx: 40,
      widthPx: 10,
      heightPx: 10,
      sourceWidthPx: 1000,
      sourceHeightPx: 101,
    }
    const crop = getPreviewCrop(logo, { width: 1000, height: 101 }, { width: 512, height: 52 })
    expect(crop.x).toBeCloseTo(460.8)
    expect(crop.width).toBeCloseTo(5.12)
    expect(crop.y).toBeCloseTo((40 * 52) / 101)
    expect(crop.height).toBeCloseTo((10 * 52) / 101)
  })
})
