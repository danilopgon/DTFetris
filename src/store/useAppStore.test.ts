import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignInput, ImportDesignRequest, VisibleBounds } from '../types/domain'
import {
  DEFAULT_SHEET_CONFIG,
  getFittedVisibleSizeCm,
  getVisiblePackingFootprintCm,
} from '../types/domain'
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
  it('preserves the current separation on a size-only change and invalidates on a gap-only change', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore.getState().setSheetSize(40, 80)
    expect(useAppStore.getState().sheetConfig).toEqual({ widthCm: 40, heightCm: 80, gapCm: 0.3 })
    useAppStore
      .getState()
      .setSheets([{ id: 'ready', widthCm: 40, heightCm: 80, gapCm: 0.3, placements: [] }])
    useAppStore.getState().setSheetSize(40, 80, 0.125)
    expect(useAppStore.getState()).toMatchObject({
      sheetConfig: { gapCm: 0.125 },
      sheets: [],
      isLayoutStale: true,
    })
    const current = useAppStore.getState()
    for (const invalid of [-1, NaN, Infinity]) useAppStore.getState().setSheetSize(40, 80, invalid)
    expect(useAppStore.getState()).toBe(current)
  })

  it('restores old jobs without inventing a gap and restores explicit gaps unchanged', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore
      .getState()
      .restoreJob({ version: 1, sheetConfig: { widthCm: 30, heightCm: 40 }, designs: [] })
    expect(useAppStore.getState().sheetConfig.gapCm ?? 0).toBe(0)
    useAppStore.getState().setSheetSize(35, 40)
    expect(useAppStore.getState().sheetConfig.gapCm).toBeUndefined()
    useAppStore
      .getState()
      .restoreJob({
        version: 1,
        sheetConfig: { widthCm: 30, heightCm: 40, gapCm: 0.3 },
        designs: [],
      })
    expect(useAppStore.getState().sheetConfig.gapCm).toBe(0.3)
  })

  it('preserves color on duplication/restoration and clears independently without changing source metadata', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    const original = makeDesign()
    useAppStore.getState().addDesign(original)
    expect(useAppStore.getState().updateDesign(original.id, { colorOverride: '#A1B2C3' })).toEqual({
      ok: true,
    })
    const duplicate = useAppStore.getState().duplicateDesign(original.id)!
    expect(duplicate).toMatchObject({
      imagePath: original.imagePath,
      colorOverride: '#A1B2C3',
      visibleBounds: original.visibleBounds,
    })
    expect(duplicate.id).not.toBe(original.id)
    expect(useAppStore.getState().updateDesign(duplicate.id, { colorOverride: null })).toEqual({
      ok: true,
    })
    expect(useAppStore.getState().designs[0].colorOverride).toBe('#A1B2C3')
    expect(original.colorOverride).toBeUndefined()
    const designs = useAppStore.getState().designs
    useAppStore.getState().restoreJob({ version: 1, sheetConfig: DEFAULT_SHEET_CONFIG, designs })
    expect(useAppStore.getState().designs).toEqual(designs)
    expect(useAppStore.getState().isLayoutStale).toBe(true)
  })

  it('rejects invalid color mutations without discarding the current layout', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore.getState().addDesign(makeDesign())
    useAppStore.getState().setSheets([{ id: 'ready', widthCm: 60, heightCm: 100, placements: [] }])
    expect(useAppStore.getState().updateDesign('design-1', { colorOverride: '#fff' }).ok).toBe(
      false,
    )
    expect(useAppStore.getState().sheets).toHaveLength(1)
    expect(useAppStore.getState().designs[0].colorOverride).toBeUndefined()
  })
  it('invalidates sheets when size changes and ignores invalid dimensions', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore.getState().setSheets([{ id: 'old', widthCm: 60, heightCm: 100, placements: [] }])
    useAppStore.getState().setSheetSize(40, 80)
    expect(useAppStore.getState().sheets).toEqual([])
    expect(useAppStore.getState().isLayoutStale).toBe(true)
    useAppStore.getState().setSheetSize(0, 10)
    expect(useAppStore.getState().sheetConfig).toEqual({ widthCm: 40, heightCm: 80, gapCm: 0.3 })
  })
  it('initializes new work with the default 60 cm x 100 cm sheet configuration', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)

    const state = useAppStore.getState()

    expect(state.sheetConfig).toEqual(DEFAULT_SHEET_CONFIG)
    expect(state.sheetWidthCm).toBe(60)
    expect(state.sheetHeightCm).toBe(100)
  })

  it('keeps custom sheet configuration aligned with existing width and height selectors', () => {
    useAppStore.setState(useAppStore.getInitialState(), true)

    useAppStore.getState().setSheetSize(40, 80)

    const state = useAppStore.getState()

    expect(state.sheetConfig).toEqual({ widthCm: 40, heightCm: 80, gapCm: 0.3 })
    expect(state.sheetWidthCm).toBe(40)
    expect(state.sheetHeightCm).toBe(80)
  })
})

describe('useAppStore importDesign action', () => {
  it('never appends an old import into a newly restored job', async () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    let resolve!: (design: DesignInput) => void
    importDesignMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = useAppStore
      .getState()
      .importDesign({ sourcePath: '/design.png', widthCm: 10, heightCm: 8 })
    expect(useAppStore.getState().isImporting).toBe(true)
    useAppStore
      .getState()
      .restoreJob({ version: 1, sheetConfig: { widthCm: 30, heightCm: 40 }, designs: [] })
    resolve(makeDesign())
    await expect(pending).rejects.toThrow('El trabajo cambió')
    expect(useAppStore.getState()).toMatchObject({ designs: [], isImporting: false })
  })
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    importDesignMock.mockReset()
    runPackingMock.mockReset()
  })

  it('appends exactly one design to an empty list on successful import', async () => {
    const design = makeDesign()
    const request: ImportDesignRequest = {
      sourcePath: '/designs/logo.png',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockResolvedValueOnce(design)

    await useAppStore.getState().importDesign(request)

    expect(useAppStore.getState().designs).toHaveLength(1)
    expect(useAppStore.getState().designs[0]).toEqual(design)
    expect(useAppStore.getState().sheets).toEqual([])
    expect(useAppStore.getState().isLayoutStale).toBe(true)
  })

  it('appends a second design without replacing the first (cumulative)', async () => {
    const first = makeDesign({ id: 'design-first', name: 'first.png' })
    const second = makeDesign({ id: 'design-second', name: 'second.png' })
    const request: ImportDesignRequest = {
      sourcePath: '/designs/first.png',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockResolvedValueOnce(first)

    await useAppStore.getState().importDesign(request)

    const request2: ImportDesignRequest = {
      sourcePath: '/designs/second.png',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockResolvedValueOnce(second)

    await useAppStore.getState().importDesign(request2)

    expect(useAppStore.getState().designs).toHaveLength(2)
    expect(useAppStore.getState().designs[0]).toEqual(first)
    expect(useAppStore.getState().designs[1]).toEqual(second)
  })

  it('leaves the design list unchanged when import fails', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/designs/invalid.jpg',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockRejectedValueOnce('invalid_format')

    await expect(useAppStore.getState().importDesign(request)).rejects.toBe('invalid_format')

    expect(useAppStore.getState().designs).toHaveLength(0)
  })

  it('leaves existing designs unchanged when a second import fails', async () => {
    const first = makeDesign({ id: 'design-first' })
    const request1: ImportDesignRequest = {
      sourcePath: '/designs/first.png',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockResolvedValueOnce(first)

    await useAppStore.getState().importDesign(request1)

    const request2: ImportDesignRequest = {
      sourcePath: '/designs/blank.png',
      widthCm: 10,
      heightCm: 8,
    }
    importDesignMock.mockRejectedValueOnce('empty_artwork')

    await expect(useAppStore.getState().importDesign(request2)).rejects.toBe('empty_artwork')

    expect(useAppStore.getState().designs).toHaveLength(1)
    expect(useAppStore.getState().designs[0]).toEqual(first)
  })
})

describe('packing orchestration', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    runPackingMock.mockReset()
  })

  it('generates sheets and preserves explicit unplaced copies', async () => {
    useAppStore.getState().addDesign(makeDesign())
    const result = {
      sheets: [{ id: 'sheet-1', widthCm: 60, heightCm: 100, placements: [] }],
      unplacedItems: [{ designId: 'design-1', itemIndex: 0, reason: 'does_not_fit' as const }],
    }
    runPackingMock.mockResolvedValue(result)
    await useAppStore.getState().generateSheets()
    expect(runPackingMock).toHaveBeenCalledWith({
      sheet: { widthCm: 60, heightCm: 100, gapCm: 0.3 },
      designs: [makeDesign()],
    })
    expect(useAppStore.getState()).toMatchObject({
      ...result,
      isLayoutStale: false,
      isOptimizing: false,
    })
  })

  it('does not apply an asynchronous result after designs change', async () => {
    useAppStore.getState().addDesign(makeDesign())
    let resolve!: (value: { sheets: []; unplacedItems: [] }) => void
    runPackingMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = useAppStore.getState().generateSheets()
    useAppStore.getState().updateDesign('design-1', { quantity: 2 })
    resolve({ sheets: [], unplacedItems: [] })
    await pending
    expect(useAppStore.getState()).toMatchObject({
      sheets: [],
      isLayoutStale: true,
      isOptimizing: false,
    })
  })

  it('clears loading on failure and rejects empty requests without invoking Rust', async () => {
    await expect(useAppStore.getState().generateSheets()).rejects.toThrow()
    expect(runPackingMock).not.toHaveBeenCalled()
    useAppStore.getState().addDesign(makeDesign())
    runPackingMock.mockRejectedValueOnce('invalid_dimensions')
    await expect(useAppStore.getState().generateSheets()).rejects.toBe('invalid_dimensions')
    expect(useAppStore.getState().isOptimizing).toBe(false)
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
          placements: [
            { designId: design.id, xCm: 0, yCm: 0, widthCm: 10, heightCm: 8, rotated: false },
          ],
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
    expect(getVisiblePackingFootprintCm(savedDesign)).toEqual({ widthCm: 10, heightCm: 7.6 })
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
