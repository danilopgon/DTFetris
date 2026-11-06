import { describe, expect, it } from 'vitest'
import { EXPORT_DPI, cmToPx, cmToExportPx } from './units'

describe('cmToPx', () => {
  it('rounds the configurable default sheet to 7087 x 11811 pixels at 300 DPI', () => {
    expect([cmToExportPx(60), cmToExportPx(100)]).toEqual([7087, 11811])
    expect(cmToExportPx(2.54)).toBe(300)
  })

  it('converts 2.54cm at 96dpi to exactly 96px', () => {
    expect(cmToPx(2.54, 96)).toBe(96)
  })

  it('names the export boundary DPI as 300dpi', () => {
    expect(EXPORT_DPI).toBe(300)
  })

  it('converts the default sheet height at export DPI without domain coupling', () => {
    expect(cmToPx(100, EXPORT_DPI)).toBeCloseTo(11811, 0)
  })
})
