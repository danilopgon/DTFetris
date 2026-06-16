import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignInput, ImportDesignRequest, PackingRequest, PackingResult, VisibleBounds } from '../types/domain'
import { importDesign, runPacking } from './index'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const invokeMock = vi.mocked(invoke)

const baseVisibleBounds: VisibleBounds = {
  xPx: 0,
  yPx: 0,
  widthPx: 100,
  heightPx: 80,
  sourceWidthPx: 100,
  sourceHeightPx: 80,
}

const baseDesignResult: DesignInput = {
  id: 'imported-1',
  name: 'logo.png',
  imagePath: '/app-data/design-assets/imported-1.png',
  widthCm: 10,
  heightCm: 8,
  originalAspectRatio: 1.25,
  quantity: 1,
  canRotate: false,
  format: 'png',
  visibleBounds: baseVisibleBounds,
}

describe('runPacking command wrapper', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('invokes run_packing with the explicit packing request payload', async () => {
    const request: PackingRequest = {
      sheet: { widthCm: 55, heightCm: 100 },
      designs: [
        {
          id: 'design-1',
          name: 'Logo',
          imagePath: 'C:/assets/logo.png',
          widthCm: 12,
          heightCm: 8,
          originalAspectRatio: 1.5,
          quantity: 2,
          canRotate: true,
          format: 'png',
          visibleBounds: baseVisibleBounds,
        },
      ],
    }
    const result: PackingResult = {
      sheets: [
        {
          id: 'sheet-1',
          widthCm: 55,
          heightCm: 100,
          placements: [],
        },
      ],
      unplacedItems: [],
    }
    invokeMock.mockResolvedValueOnce(result)

    await expect(runPacking(request)).resolves.toEqual(result)

    expect(invokeMock).toHaveBeenCalledWith('run_packing', { request })
  })

  it('returns unplaced items from the Rust packing result contract', async () => {
    const request: PackingRequest = {
      sheet: { widthCm: 20, heightCm: 20 },
      designs: [
        {
          id: 'oversized',
          name: 'Oversized',
          imagePath: 'C:/assets/oversized.png',
          widthCm: 30,
          heightCm: 30,
          originalAspectRatio: 1,
          quantity: 1,
          canRotate: false,
          format: 'png',
          visibleBounds: baseVisibleBounds,
        },
      ],
    }
    const result: PackingResult = {
      sheets: [],
      unplacedItems: [{ designId: 'oversized', itemIndex: 0, reason: 'does_not_fit' }],
    }
    invokeMock.mockResolvedValueOnce(result)

    await expect(runPacking(request)).resolves.toEqual(result)

    expect(invokeMock).toHaveBeenCalledWith('run_packing', { request })
  })
})

describe('importDesign command wrapper', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('invokes import_design with sourcePath, widthCm, and heightCm payload', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/home/user/designs/logo.png',
      widthCm: 10,
      heightCm: 8,
    }
    invokeMock.mockResolvedValueOnce(baseDesignResult)

    await expect(importDesign(request)).resolves.toEqual(baseDesignResult)

    expect(invokeMock).toHaveBeenCalledWith('import_design', request)
  })

  it('returns a DesignInput with format and visibleBounds fields on success', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/designs/vector.svg',
      widthCm: 15,
      heightCm: 20,
    }
    const svgResult: DesignInput = {
      ...baseDesignResult,
      id: 'imported-svg-1',
      name: 'vector.svg',
      format: 'svg',
      widthCm: 15,
      heightCm: 20,
    }
    invokeMock.mockResolvedValueOnce(svgResult)

    const result = await importDesign(request)

    expect(result.format).toBe('svg')
    expect(result.visibleBounds).toEqual(baseVisibleBounds)
    expect(result.widthCm).toBe(15)
    expect(result.heightCm).toBe(20)
  })

  it('maps invalid_format error code when Rust rejects the file type', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/designs/image.jpg',
      widthCm: 10,
      heightCm: 8,
    }
    invokeMock.mockRejectedValueOnce('invalid_format')

    await expect(importDesign(request)).rejects.toBe('invalid_format')
  })

  it('maps empty_artwork error code when visible bounds are empty', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/designs/blank.png',
      widthCm: 10,
      heightCm: 8,
    }
    invokeMock.mockRejectedValueOnce('empty_artwork')

    await expect(importDesign(request)).rejects.toBe('empty_artwork')
  })

  it('maps file_not_found error code when source path does not exist', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/nonexistent/path.png',
      widthCm: 10,
      heightCm: 8,
    }
    invokeMock.mockRejectedValueOnce('file_not_found')

    await expect(importDesign(request)).rejects.toBe('file_not_found')
  })

  it('maps invalid_dimensions error code for zero or negative cm values', async () => {
    const request: ImportDesignRequest = {
      sourcePath: '/designs/logo.png',
      widthCm: 0,
      heightCm: 8,
    }
    invokeMock.mockRejectedValueOnce('invalid_dimensions')

    await expect(importDesign(request)).rejects.toBe('invalid_dimensions')
  })
})
