import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignInput, ImportDesignRequest, VisibleBounds } from '../types/domain'
import { DEFAULT_SHEET_CONFIG, getFittedVisibleSizeCm, getRequestedCellPackingFootprintCm } from '../types/domain'
import { useAppStore } from './useAppStore'

vi.mock('../commands', () => ({
  importDesign: vi.fn(),
  runPacking: vi.fn(),
}))

import { importDesign as importDesignCommand, runPacking as runPackingCommand } from '../commands'

const importDesignMock = vi.mocked(importDesignCommand)
const runPackingMock = vi.mocked(runPackingCommand)

const baseVisibleBounds: VisibleBounds = {
  xPx: 0,
  yPx: 0,
  widthPx: 100,
  heightPx: 80,
  sourceWidthPx: 100,
  sourceHeightPx: 80,
}

function makeDesign(overrides: Partial<DesignInput> = {}): DesignInput {
  return {
    id: 'design-1',
    name: 'logo.png',
    imagePath: '/app-data/design-assets/logo.png',
    widthCm: 10,
    heightCm: 8,
    originalAspectRatio: 1.25,
    quantity: 1,
    canRotate: false,
    format: 'png',
    visibleBounds: baseVisibleBounds,
    ...overrides,
  }
}

describe('useAppStore sheet configuration', () => {
  it('initializes new work with the default 55 cm x 100 cm sheet configuration', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)

    const state = useAppStore.getState()

    expect(state.sheetConfig).toEqual(DEFAULT_SHEET_CONFIG)
    expect(state.sheetWidthCm).toBe(55)
    expect(state.sheetHeightCm).toBe(100)
  })

  it('keeps custom sheet configuration aligned with existing width and height selectors', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)

    useAppStore.getState().setSheetSize(40, 80)

    const state = useAppStore.getState()

    expect(state.sheetConfig).toEqual({ widthCm: 40, heightCm: 80 })
    expect(state.sheetWidthCm).toBe(40)
    expect(state.sheetHeightCm).toBe(80)
  })
})

describe('useAppStore importDesign action', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    importDesignMock.mockReset()
    runPackingMock.mockReset()
  })

  it('appends exactly one design to an empty list on successful import', async () => {
    const design = makeDesign()
    const request: ImportDesignRequest = { sourcePath: '/designs/logo.png', widthCm: 10, heightCm: 8 }
    importDesignMock.mockResolvedValueOnce(design)

    await useAppStore.getState().importDesign(request)

    expect(useAppStore.getState().designs).toHaveLength(1)
    expect(useAppStore.getState().designs[0]).toEqual(design)
  })

  it('appends a second design without replacing the first (cumulative)', async () => {
    const first = makeDesign({ id: 'design-first', name: 'first.png' })
    const second = makeDesign({ id: 'design-second', name: 'second.png' })
    const request: ImportDesignRequest = { sourcePath: '/designs/first.png', widthCm: 10, heightCm: 8 }
    importDesignMock.mockResolvedValueOnce(first)

    await useAppStore.getState().importDesign(request)

    const request2: ImportDesignRequest = { sourcePath: '/designs/second.png', widthCm: 10, heightCm: 8 }
    importDesignMock.mockResolvedValueOnce(second)

    await useAppStore.getState().importDesign(request2)

    expect(useAppStore.getState().designs).toHaveLength(2)
    expect(useAppStore.getState().designs[0]).toEqual(first)
    expect(useAppStore.getState().designs[1]).toEqual(second)
  })

  it('leaves the design list unchanged when import fails', async () => {
    const request: ImportDesignRequest = { sourcePath: '/designs/invalid.jpg', widthCm: 10, heightCm: 8 }
    importDesignMock.mockRejectedValueOnce('invalid_format')

    await expect(useAppStore.getState().importDesign(request)).rejects.toBe('invalid_format')

    expect(useAppStore.getState().designs).toHaveLength(0)
  })

  it('leaves existing designs unchanged when a second import fails', async () => {
    const first = makeDesign({ id: 'design-first' })
    const request1: ImportDesignRequest = { sourcePath: '/designs/first.png', widthCm: 10, heightCm: 8 }
    importDesignMock.mockResolvedValueOnce(first)

    await useAppStore.getState().importDesign(request1)

    const request2: ImportDesignRequest = { sourcePath: '/designs/blank.png', widthCm: 10, heightCm: 8 }
    importDesignMock.mockRejectedValueOnce('empty_artwork')

    await expect(useAppStore.getState().importDesign(request2)).rejects.toBe('empty_artwork')

    expect(useAppStore.getState().designs).toHaveLength(1)
    expect(useAppStore.getState().designs[0]).toEqual(first)
  })
})

describe('useAppStore design editing actions', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    importDesignMock.mockReset()
    runPackingMock.mockReset()
  })

  function seedDesignWithSheet(design = makeDesign()) {
    useAppStore.setState({
      designs: [design],
      sheets: [
        {
          id: 'sheet-1',
          widthCm: 55,
          heightCm: 100,
          placements: [{ designId: design.id, xCm: 0, yCm: 0, widthCm: 10, heightCm: 8, rotated: false }],
        },
      ],
      isLayoutStale: false,
    })
  }

  it('updates editable fields, clears sheets, marks layout stale, and does not run packing', () => {
    seedDesignWithSheet()

    const result = useAppStore.getState().updateDesign('design-1', {
      name: 'Logo principal',
      widthCm: 12,
      heightCm: 9,
      quantity: 3,
      canRotate: true,
    })

    expect(result).toEqual({ ok: true })
    expect(useAppStore.getState().designs[0]).toMatchObject({
      name: 'Logo principal',
      widthCm: 12,
      heightCm: 9,
      quantity: 3,
      canRotate: true,
      imagePath: '/app-data/design-assets/logo.png',
    })
    expect(useAppStore.getState().sheets).toEqual([])
    expect(useAppStore.getState().isLayoutStale).toBe(true)
    expect(runPackingMock).not.toHaveBeenCalled()
  })

  it('preserves edited requested cell dimensions as user intent while fitted size stays derived metadata', () => {
    seedDesignWithSheet(makeDesign({ originalAspectRatio: 25 / 19 }))

    const result = useAppStore.getState().updateDesign('design-1', {
      widthCm: 10,
      heightCm: 8,
    })

    const savedDesign = useAppStore.getState().designs[0]
    const visibleSize = getFittedVisibleSizeCm(savedDesign, savedDesign.originalAspectRatio)

    expect(result).toEqual({ ok: true })
    expect(visibleSize).toEqual({ widthCm: 10, heightCm: 7.6 })
    expect(getRequestedCellPackingFootprintCm(savedDesign)).toEqual({ widthCm: 10, heightCm: 8 })
    expect(savedDesign).toMatchObject({ widthCm: 10, heightCm: 8 })
    expect(runPackingMock).not.toHaveBeenCalled()
  })

  it('rejects invalid updates and leaves previous design and layout unchanged', () => {
    seedDesignWithSheet()

    const result = useAppStore.getState().updateDesign('design-1', { quantity: 0, widthCm: 10.5 })

    expect(result).toEqual({
      ok: false,
      errors: [
        { code: 'invalid_dimensions', field: 'widthCm', designId: 'design-1' },
        { code: 'invalid_quantity', field: 'quantity', designId: 'design-1' },
      ],
    })
    expect(useAppStore.getState().designs[0]).toEqual(makeDesign())
    expect(useAppStore.getState().sheets).toHaveLength(1)
    expect(useAppStore.getState().isLayoutStale).toBe(false)
    expect(runPackingMock).not.toHaveBeenCalled()
  })

  it('duplicates a design with a new id and shared image path, then invalidates layout without packing', () => {
    seedDesignWithSheet(makeDesign({ name: 'Logo principal', canRotate: true }))

    const duplicate = useAppStore.getState().duplicateDesign('design-1')

    expect(duplicate).toMatchObject({
      name: 'Logo principal copia',
      imagePath: '/app-data/design-assets/logo.png',
      widthCm: 10,
      heightCm: 8,
      quantity: 1,
      canRotate: true,
    })
    expect(duplicate?.id).not.toBe('design-1')
    expect(useAppStore.getState().designs).toHaveLength(2)
    expect(useAppStore.getState().sheets).toEqual([])
    expect(useAppStore.getState().isLayoutStale).toBe(true)
    expect(runPackingMock).not.toHaveBeenCalled()
  })

  it('removes a design and invalidates existing layout without packing', () => {
    seedDesignWithSheet()

    useAppStore.getState().removeDesign('design-1')

    expect(useAppStore.getState().designs).toEqual([])
    expect(useAppStore.getState().sheets).toEqual([])
    expect(useAppStore.getState().isLayoutStale).toBe(true)
    expect(runPackingMock).not.toHaveBeenCalled()
  })
})
