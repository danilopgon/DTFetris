import type { ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import type { DesignInput, Sheet } from '../../types/domain'
import SheetPreview from './SheetPreview'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `mock:${path}` }))
vi.mock('react-konva', () => ({
  Stage: ({ children, width, height }: { children: ReactNode; width: number; height: number }) => (
    <div data-testid="stage" data-width={width} data-height={height}>
      {children}
    </div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children, rotation }: { children: ReactNode; rotation?: number }) => (
    <div data-rotation={rotation}>{children}</div>
  ),
  Rect: () => null,
  Image: ({ width, height, crop }: { width: number; height: number; crop: object }) => (
    <div
      data-testid="artwork"
      data-width={width}
      data-height={height}
      data-crop={JSON.stringify(crop)}
    />
  ),
}))

const pendingImages: HTMLImageElement[] = []
const design: DesignInput = {
  id: 'logo',
  name: 'logo.svg',
  imagePath: '/logo.svg',
  widthCm: 10,
  heightCm: 10,
  originalAspectRatio: 2,
  quantity: 2,
  canRotate: true,
  format: 'svg',
  visibleBounds: {
    xPx: 20,
    yPx: 10,
    widthPx: 100,
    heightPx: 50,
    sourceWidthPx: 200,
    sourceHeightPx: 100,
  },
}
const sheet: Sheet = {
  id: 's1',
  widthCm: 20,
  heightCm: 10,
  placements: [{ designId: 'logo', xCm: 0, yCm: 0, widthCm: 10, heightCm: 10, rotated: false }],
}

beforeEach(() => {
  pendingImages.length = 0
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 400
      naturalHeight = 200
      src = ''
      constructor() {
        pendingImages.push(this as unknown as HTMLImageElement)
      }
    },
  )
  useAppStore.setState({
    designs: [],
    sheets: [],
    sheetConfig: { widthCm: 30, heightCm: 40 },
    isLayoutStale: false,
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SheetPreview (Konva rendering mocked)', () => {
  it.each(['png', 'svg'] as const)(
    'shares a tinted %s source across copies and normalizes crop to its thumbnail dimensions',
    async (format) => {
      const context = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        globalCompositeOperation: '',
      }
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
      )
      useAppStore.setState({
        designs: [
          { ...design, format, colorOverride: '#FF0000' },
          { ...design, id: 'copy', format, colorOverride: '#FF0000' },
        ],
        sheets: [
          {
            ...sheet,
            placements: [
              sheet.placements[0],
              { ...sheet.placements[0], designId: 'copy', rotated: true },
            ],
          },
        ],
      })
      render(<SheetPreview />)
      Object.defineProperties(pendingImages[0], {
        naturalWidth: { value: 2000 },
        naturalHeight: { value: 1000 },
      })
      act(() => pendingImages[0].onload?.(new Event('load')))
      const artworks = await screen.findAllByTestId('artwork')
      expect(context.drawImage).toHaveBeenCalledTimes(1)
      expect(artworks[1].parentElement).toHaveAttribute('data-rotation', '90')
      expect(artworks[1]).toHaveAttribute('data-width', '60')
      expect(artworks[1]).toHaveAttribute('data-height', '30')
      expect(JSON.parse(artworks[1].getAttribute('data-crop')!)).toEqual({
        x: 51.2,
        y: 25.6,
        width: 256,
        height: 128,
      })
      act(() => useAppStore.setState({ designs: [{ ...design, format, colorOverride: null }] }))
      expect(pendingImages).toHaveLength(1)
      expect(JSON.parse(screen.getByTestId('artwork').getAttribute('data-crop')!)).toEqual({
        x: 200,
        y: 100,
        width: 1000,
        height: 500,
      })
    },
  )

  it('shows configured empty dimensions and the pending composition message', () => {
    render(<SheetPreview />)
    expect(screen.getByTestId('empty-sheet')).toHaveStyle({
      width: '120px',
      aspectRatio: '30 / 40',
    })
    expect(screen.getByText(/Importa diseños y pulsa Generar/)).toBeVisible()
    act(() => useAppStore.setState({ isLayoutStale: true }))
    expect(screen.getByText('Composición pendiente. Pulsa Generar planchas.')).toBeVisible()
  })

  it('renders every sheet, deduplicates image requests, crops visible bounds and rotates proportionally', async () => {
    useAppStore.setState({
      designs: [design, { ...design, id: 'duplicate' }],
      sheets: [
        sheet,
        { ...sheet, id: 's2', placements: [{ ...sheet.placements[0], rotated: true }] },
      ],
    })
    render(<SheetPreview />)
    expect(screen.getAllByRole('figure')).toHaveLength(2)
    expect(screen.getByRole('figure', { name: 'Plancha 2' })).toHaveTextContent(
      '20 × 10 cm · 1 copia',
    )
    expect(pendingImages).toHaveLength(1)
    expect(pendingImages[0].src).toBe('mock:/logo.svg')
    act(() => pendingImages[0].onload?.(new Event('load')))
    await waitFor(() => expect(screen.getAllByTestId('artwork')).toHaveLength(2))
    const artwork = screen.getAllByTestId('artwork')[1]
    expect(artwork).toHaveAttribute('data-width', '60')
    expect(artwork).toHaveAttribute('data-height', '30')
    expect(artwork.parentElement).toHaveAttribute('data-rotation', '90')
    expect(JSON.parse(artwork.getAttribute('data-crop')!)).toEqual({
      x: 40,
      y: 20,
      width: 200,
      height: 100,
    })
  })

  it('reports failed assets and clears failure on a different job without applying obsolete image loads', async () => {
    useAppStore.setState({ designs: [design], sheets: [sheet] })
    render(<SheetPreview />)
    const obsoleteLoad = pendingImages[0].onload
    act(() => pendingImages[0].onerror?.(new Event('error')))
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar 1 imágenes')
    act(() => useAppStore.setState({ designs: [{ ...design, imagePath: '/restored.svg' }] }))
    expect(pendingImages[0].onload).toBeNull()
    act(() => obsoleteLoad?.call(pendingImages[0], new Event('load')))
    expect(screen.queryByTestId('artwork')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => pendingImages[1].onload?.(new Event('load')))
    expect(await screen.findByTestId('artwork')).toBeVisible()
  })
})
