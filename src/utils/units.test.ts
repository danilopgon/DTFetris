import { describe, expect, it } from 'vitest'
import { EXPORT_DPI, cmToPx } from './units'

describe('cmToPx', () => {
  it('converts 55cm at 300dpi to ~6496px', () => {
    expect(cmToPx(55, 300)).toBeCloseTo(6496, 0)
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
