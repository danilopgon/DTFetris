import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHEET_CONFIG,
  getFittedVisibleSizeCm,
  getRequestedCellPackingFootprintCm,
  isPositiveIntegerCm,
  validateEditableDesignInput,
  validatePackingRequest,
  type DesignInput,
  type ImageFormat,
  type ImportDesignErrorCode,
  type ImportDesignRequest,
  type PackingRequest,
  type PackingResult,
  type UnplacedItem,
  type VisibleBounds,
} from './domain'

const baseVisibleBounds: VisibleBounds = {
  xPx: 0,
  yPx: 0,
  widthPx: 100,
  heightPx: 120,
  sourceWidthPx: 100,
  sourceHeightPx: 120,
}

const baseDesign: DesignInput = {
  id: 'design-1',
  name: 'Logo',
  imagePath: 'C:/images/logo.png',
  widthCm: 10,
  heightCm: 12,
  originalAspectRatio: 10 / 12,
  quantity: 1,
  canRotate: true,
  format: 'png',
  visibleBounds: baseVisibleBounds,
}

describe('centimeter domain validation', () => {
  it('accepts positive integer centimeter values', () => {
    expect(isPositiveIntegerCm(1)).toBe(true)
    expect(isPositiveIntegerCm(55)).toBe(true)
    expect(isPositiveIntegerCm(DEFAULT_SHEET_CONFIG.heightCm)).toBe(true)
  })

  it('rejects decimal, zero, negative, and non-finite centimeter values', () => {
    expect(isPositiveIntegerCm(10.5)).toBe(false)
    expect(isPositiveIntegerCm(0)).toBe(false)
    expect(isPositiveIntegerCm(-1)).toBe(false)
    expect(isPositiveIntegerCm(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('editable design validation', () => {
  it('rejects quantity 0 while editing because hiding must be explicit later', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, quantity: 0 })

    expect(errors).toEqual([{ code: 'invalid_quantity', field: 'quantity', designId: 'design-1' }])
  })

  it('reports invalid dimensions with stable technical codes', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, widthCm: 8.5, heightCm: 0 })

    expect(errors).toEqual([
      { code: 'invalid_dimensions', field: 'widthCm', designId: 'design-1' },
      { code: 'invalid_dimensions', field: 'heightCm', designId: 'design-1' },
    ])
  })

  it('reports invalid editable quantities below one', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, quantity: -1 })

    expect(errors).toEqual([{ code: 'invalid_quantity', field: 'quantity', designId: 'design-1' }])
  })

  it('reports an empty edited name without changing dimension validation', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, name: '   ' })

    expect(errors).toEqual([{ code: 'invalid_name', field: 'name', designId: 'design-1' }])
  })
})

describe('fitted visible artwork size', () => {
  it('derives visible size proportionally inside a wider requested cell', () => {
    const fitted = getFittedVisibleSizeCm({ widthCm: 10, heightCm: 8 }, 1)

    expect(fitted).toEqual({ widthCm: 8, heightCm: 8 })
  })

  it('derives visible size proportionally inside a taller requested cell without replacing the cell', () => {
    const fitted = getFittedVisibleSizeCm({ widthCm: 10, heightCm: 8 }, 2)

    expect(fitted).toEqual({ widthCm: 10, heightCm: 5 })
  })

  it('allows the derived visible size to be fractional while the requested cell stays integer', () => {
    const requestedCell = { widthCm: 10, heightCm: 8 }

    const fitted = getFittedVisibleSizeCm(requestedCell, 25 / 19)

    expect(fitted).toEqual({ widthCm: 10, heightCm: 7.6 })
    expect(requestedCell).toEqual({ widthCm: 10, heightCm: 8 })
  })
})

describe('requested cell packing footprint', () => {
  it('uses requested cell dimensions as the occupied footprint even when visible artwork is smaller', () => {
    const design = { ...baseDesign, widthCm: 10, heightCm: 8, originalAspectRatio: 25 / 19 }
    const visibleSize = getFittedVisibleSizeCm(design, design.originalAspectRatio)

    expect(visibleSize).toEqual({ widthCm: 10, heightCm: 7.6 })
    expect(getRequestedCellPackingFootprintCm(design)).toEqual({ widthCm: 10, heightCm: 8 })
  })
})

describe('packing request validation', () => {
  it('accepts a request with custom sheet dimensions and one positive quantity design', () => {
    const request: PackingRequest = {
      sheet: { widthCm: 40, heightCm: 80 },
      designs: [{ ...baseDesign, quantity: 2 }],
    }

    expect(validatePackingRequest(request)).toEqual([])
  })

  it('rejects generation when every design has quantity 0', () => {
    const request: PackingRequest = {
      sheet: DEFAULT_SHEET_CONFIG,
      designs: [{ ...baseDesign, quantity: 0 }],
    }

    expect(validatePackingRequest(request)).toEqual([
      { code: 'invalid_quantity', field: 'quantity', designId: 'design-1' },
      { code: 'invalid_quantity', field: 'designs' },
    ])
  })

  it('rejects generation when there are no designs', () => {
    const request: PackingRequest = {
      sheet: DEFAULT_SHEET_CONFIG,
      designs: [],
    }

    expect(validatePackingRequest(request)).toEqual([{ code: 'invalid_quantity', field: 'designs' }])
  })
})

describe('packing result contract', () => {
  it('preserves stable unplaced reason codes separately from sheets', () => {
    const unplacedItem: UnplacedItem = {
      designId: 'design-1',
      itemIndex: 0,
      reason: 'does_not_fit',
    }
    const result: PackingResult = {
      sheets: [],
      unplacedItems: [unplacedItem],
    }

    expect(result.unplacedItems).toEqual([unplacedItem])
  })
})

describe('VisibleBounds contract', () => {
  it('stores pixel geometry as non-negative numbers', () => {
    const bounds: VisibleBounds = {
      xPx: 5,
      yPx: 10,
      widthPx: 90,
      heightPx: 100,
      sourceWidthPx: 100,
      sourceHeightPx: 120,
    }

    expect(bounds.xPx).toBe(5)
    expect(bounds.yPx).toBe(10)
    expect(bounds.widthPx).toBe(90)
    expect(bounds.heightPx).toBe(100)
    expect(bounds.sourceWidthPx).toBe(100)
    expect(bounds.sourceHeightPx).toBe(120)
  })

  it('uses camelCase field names matching Rust serde serialization', () => {
    const bounds: VisibleBounds = {
      xPx: 0,
      yPx: 0,
      widthPx: 200,
      heightPx: 150,
      sourceWidthPx: 200,
      sourceHeightPx: 150,
    }

    // Verify field names are camelCase (as Rust uses #[serde(rename_all = "camelCase")])
    expect(Object.keys(bounds)).toEqual(['xPx', 'yPx', 'widthPx', 'heightPx', 'sourceWidthPx', 'sourceHeightPx'])
  })
})

describe('ImageFormat contract', () => {
  it('accepts png and svg as valid image formats', () => {
    const pngFormat: ImageFormat = 'png'
    const svgFormat: ImageFormat = 'svg'

    expect(pngFormat).toBe('png')
    expect(svgFormat).toBe('svg')
  })
})

describe('DesignInput with import metadata fields', () => {
  it('stores format and visibleBounds as required fields alongside cm dimensions', () => {
    const design: DesignInput = {
      id: 'design-import-1',
      name: 'Artwork',
      imagePath: 'C:/app-data/design-assets/abc.png',
      widthCm: 15,
      heightCm: 10,
      originalAspectRatio: 1.5,
      quantity: 1,
      canRotate: false,
      format: 'png',
      visibleBounds: baseVisibleBounds,
    }

    expect(design.format).toBe('png')
    expect(design.visibleBounds).toEqual(baseVisibleBounds)
    // cm dimensions remain domain truth — pixels are only for source geometry
    expect(design.widthCm).toBe(15)
    expect(design.heightCm).toBe(10)
  })

  it('accepts svg format with matching visibleBounds metadata', () => {
    const svgBounds: VisibleBounds = {
      xPx: 2,
      yPx: 3,
      widthPx: 50,
      heightPx: 75,
      sourceWidthPx: 54,
      sourceHeightPx: 81,
    }
    const design: DesignInput = {
      id: 'design-svg-1',
      name: 'Vector',
      imagePath: 'C:/app-data/design-assets/def.svg',
      widthCm: 8,
      heightCm: 12,
      originalAspectRatio: 50 / 75,
      quantity: 2,
      canRotate: true,
      format: 'svg',
      visibleBounds: svgBounds,
    }

    expect(design.format).toBe('svg')
    expect(design.visibleBounds.widthPx).toBe(50)
  })
})

describe('ImportDesignRequest contract', () => {
  it('requires sourcePath, widthCm, and heightCm using Cm type', () => {
    const request: ImportDesignRequest = {
      sourcePath: '/home/user/designs/logo.png',
      widthCm: 10,
      heightCm: 8,
    }

    expect(request.sourcePath).toBe('/home/user/designs/logo.png')
    expect(request.widthCm).toBe(10)
    expect(request.heightCm).toBe(8)
  })
})

describe('ImportDesignErrorCode contract', () => {
  it('covers all stable error codes returned by the Rust import command', () => {
    const codes: ImportDesignErrorCode[] = [
      'invalid_format',
      'invalid_dimensions',
      'file_not_found',
      'copy_failed',
      'empty_artwork',
      'metadata_failed',
    ]

    expect(codes).toHaveLength(6)
    expect(codes).toContain('invalid_format')
    expect(codes).toContain('empty_artwork')
  })
})
