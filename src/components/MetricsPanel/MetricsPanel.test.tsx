import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import type { DesignInput, Sheet } from '../../types/domain'
import MetricsPanel, { sheetMetrics } from './MetricsPanel'

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
  id: 'one',
  widthCm: 20,
  heightCm: 10,
  placements: [{ designId: 'logo', xCm: 0, yCm: 0, widthCm: 10, heightCm: 10, rotated: false }],
}
beforeEach(() => useAppStore.setState({ designs: [design], sheets: [] }))
afterEach(cleanup)

describe('MetricsPanel', () => {
  it('uses proportional visible bounds instead of reserved cell area, including rotated copies', () => {
    expect(sheetMetrics(sheet, [design])).toEqual({
      total: 200,
      used: 50,
      free: 150,
      reserved: 100,
      occupancy: 25,
    })
    expect(
      sheetMetrics({ ...sheet, placements: [{ ...sheet.placements[0], rotated: true }] }, [design])
        .used,
    ).toBe(50)
  })
  it('shows finite empty totals and reacts to multipage results and invalidation', () => {
    render(<MetricsPanel />)
    const panel = screen.getByRole('region', { name: 'Aprovechamiento' })
    expect(panel).toHaveTextContent('Planchas: 0')
    expect(panel).toHaveTextContent('Ocupación: 0.0%')
    act(() => useAppStore.setState({ sheets: [sheet, { ...sheet, id: 'two' }] }))
    expect(panel).toHaveTextContent('Planchas: 2')
    expect(panel).toHaveTextContent('Arte visible: 100.0 cm²')
    expect(panel).toHaveTextContent('Área libre: 300.0 cm²')
    expect(panel).toHaveTextContent(
      'Plancha 2: 50.0 cm² de arte · 150.0 cm² libres · 25.0% ocupación · 100.0 cm² reservados',
    )
    act(() => {
      useAppStore.getState().updateDesign('logo', { quantity: 3 })
    })
    expect(panel).toHaveTextContent('Planchas: 0')
    expect(panel).not.toHaveTextContent('NaN')
  })
})
