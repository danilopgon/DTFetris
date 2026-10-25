import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTintedPreviewCache } from './tintedPreview'

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
