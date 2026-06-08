import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHEET_CONFIG,
  isPositiveIntegerCm,
  validateEditableDesignInput,
  validatePackingRequest,
  type DesignInput,
  type PackingRequest,
  type PackingResult,
  type UnplacedItem,
} from './domain'

const baseDesign: DesignInput = {
  id: 'design-1',
  name: 'Logo',
  imagePath: 'C:/images/logo.png',
  widthCm: 10,
  heightCm: 12,
  originalAspectRatio: 10 / 12,
  quantity: 1,
  canRotate: true,
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
  it('allows quantity 0 while editing when dimensions are valid', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, quantity: 0 })

    expect(errors).toEqual([])
  })

  it('reports invalid dimensions with stable technical codes', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, widthCm: 8.5, heightCm: 0 })

    expect(errors).toEqual([
      { code: 'invalid_dimensions', field: 'widthCm', designId: 'design-1' },
      { code: 'invalid_dimensions', field: 'heightCm', designId: 'design-1' },
    ])
  })

  it('reports invalid editable quantities below zero', () => {
    const errors = validateEditableDesignInput({ ...baseDesign, quantity: -1 })

    expect(errors).toEqual([{ code: 'invalid_quantity', field: 'quantity', designId: 'design-1' }])
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

    expect(validatePackingRequest(request)).toEqual([{ code: 'no_positive_quantity', field: 'designs' }])
  })

  it('rejects generation when there are no designs', () => {
    const request: PackingRequest = {
      sheet: DEFAULT_SHEET_CONFIG,
      designs: [],
    }

    expect(validatePackingRequest(request)).toEqual([{ code: 'no_positive_quantity', field: 'designs' }])
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
