import { describe, expect, it } from 'vitest'
import { DEFAULT_SHEET_CONFIG } from '../types/domain'
import { useAppStore } from './useAppStore'

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
