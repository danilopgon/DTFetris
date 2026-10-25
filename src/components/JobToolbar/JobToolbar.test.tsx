import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirm, open, save } from '@tauri-apps/plugin-dialog'
import { exportPng, loadJob, saveJob } from '../../commands'
import { useAppStore } from '../../store/useAppStore'
import type { DesignInput, Job, Sheet } from '../../types/domain'
import JobToolbar from './JobToolbar'

vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: vi.fn(), open: vi.fn(), save: vi.fn() }))
vi.mock('../../commands', () => ({
  exportPng: vi.fn(),
  loadJob: vi.fn(),
  saveJob: vi.fn(),
  runPacking: vi.fn(),
  importDesign: vi.fn(),
}))

const design: DesignInput = {
  id: 'logo',
  name: 'logo.svg',
  imagePath: 'C:/assets/logo.svg',
  widthCm: 10,
  heightCm: 10,
  originalAspectRatio: 2,
  quantity: 1,
  canRotate: false,
  format: 'svg',
  visibleBounds: {
    xPx: 0,
    yPx: 0,
    widthPx: 100,
    heightPx: 50,
    sourceWidthPx: 100,
    sourceHeightPx: 50,
  },
}
const sheet: Sheet = {
  id: 's1',
  widthCm: 60,
  heightCm: 100,
  placements: [{ designId: 'logo', xCm: 0, yCm: 0, widthCm: 10, heightCm: 10, rotated: false }],
}
const job: Job = {
  version: 1,
  sheetConfig: { widthCm: 30, heightCm: 40 },
  designs: [{ ...design, quantity: 3 }],
}

beforeEach(() => {
  vi.resetAllMocks()
  useAppStore.setState({
    designs: [design],
    sheets: [sheet],
    sheetConfig: { widthCm: 60, heightCm: 100 },
    sheetWidthCm: 60,
    sheetHeightCm: 100,
    isLayoutStale: false,
    isOptimizing: false,
    unplacedItems: [],
  })
  vi.mocked(confirm).mockResolvedValue(true)
})
afterEach(cleanup)

describe('JobToolbar with real Zustand state and mocked commands/dialogs', () => {
  it('allows clearing sheet inputs but blocks output until a valid size is applied', async () => {
    render(<JobToolbar onBusyChange={vi.fn()} />)
    const width = screen.getByLabelText('Ancho de plancha (cm)')
    await userEvent.clear(width)
    expect(width).toHaveValue(null)
    expect(screen.getByRole('button', { name: /Exportar PNG/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aplicar tamaño' })).toBeDisabled()
    await userEvent.type(width, '40')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar tamaño' }))
    expect(useAppStore.getState()).toMatchObject({
      sheetConfig: { widthCm: 40, heightCm: 100 },
      isLayoutStale: true,
      sheets: [],
    })
  })
  it('disables export without sheets, with stale layout, unplaced copies or pending generation', () => {
    render(<JobToolbar onBusyChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: /Exportar PNG/ })
    expect(button).toBeEnabled()
    act(() => useAppStore.setState({ isLayoutStale: true }))
    expect(button).toBeDisabled()
    act(() =>
      useAppStore.setState({
        isLayoutStale: false,
        unplacedItems: [{ designId: 'logo', itemIndex: 0, reason: 'does_not_fit' }],
      }),
    )
    expect(button).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('logo.svg')
    act(() => useAppStore.setState({ unplacedItems: [], isOptimizing: true }))
    expect(button).toBeDisabled()
    act(() => useAppStore.setState({ isOptimizing: false, sheets: [] }))
    expect(button).toBeDisabled()
  })

  it('exports all sheets with their design sources and selected destination', async () => {
    vi.mocked(save).mockResolvedValue('C:/out.png')
    vi.mocked(exportPng).mockResolvedValue(['C:/out.png'])
    const busy = vi.fn()
    render(<JobToolbar onBusyChange={busy} />)
    await userEvent.click(screen.getByRole('button', { name: /Exportar PNG/ }))
    await waitFor(() => expect(exportPng).toHaveBeenCalledWith([sheet], [design], 'C:/out.png'))
    expect(await screen.findByText(/Exportación completada: 1/)).toBeVisible()
    expect(busy.mock.calls).toEqual([[true], [false]])
  })

  it('saves only Job v1 editable data, not generated sheets', async () => {
    vi.mocked(save).mockResolvedValue('C:/job.json')
    render(<JobToolbar onBusyChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar trabajo' }))
    await waitFor(() =>
      expect(saveJob).toHaveBeenCalledWith(
        { version: 1, sheetConfig: { widthCm: 60, heightCm: 100 }, designs: [design] },
        'C:/job.json',
      ),
    )
    expect(useAppStore.getState().sheets).toEqual([sheet])
  })

  it('restores the job and invalidates preview/export until regeneration', async () => {
    vi.mocked(open).mockResolvedValue('C:/job.json')
    vi.mocked(loadJob).mockResolvedValue(job)
    render(<JobToolbar onBusyChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir trabajo' }))
    expect(await screen.findByText(/Trabajo recuperado\./)).toBeVisible()
    expect(useAppStore.getState()).toMatchObject({
      designs: job.designs,
      sheetConfig: job.sheetConfig,
      sheets: [],
      isLayoutStale: true,
      sheetWidthCm: 30,
      sheetHeightCm: 40,
    })
    expect(screen.getByRole('button', { name: /Exportar PNG/ })).toBeDisabled()
  })

  it.each([
    'save cancel',
    'save error',
    'load confirmation cancel',
    'load dialog cancel',
    'load error',
  ])('preserves current job on %s', async (scenario) => {
    const before = useAppStore.getState()
    vi.mocked(save).mockResolvedValue(scenario === 'save cancel' ? null : 'C:/job.json')
    vi.mocked(open).mockResolvedValue(scenario === 'load dialog cancel' ? null : 'C:/job.json')
    vi.mocked(confirm).mockResolvedValue(scenario !== 'load confirmation cancel')
    vi.mocked(saveJob).mockRejectedValue(new Error('No se pudo guardar el archivo.'))
    vi.mocked(loadJob).mockRejectedValue(new Error('No se pudo abrir el archivo.'))
    const busy = vi.fn()
    render(<JobToolbar onBusyChange={busy} />)
    await userEvent.click(
      screen.getByRole('button', {
        name: scenario.startsWith('save') ? 'Guardar trabajo' : 'Abrir trabajo',
      }),
    )
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
    expect(useAppStore.getState()).toBe(before)
    if (scenario.endsWith('error'))
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo')
    else expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    if (scenario === 'load confirmation cancel') expect(open).not.toHaveBeenCalled()
    if (scenario.includes('cancel')) {
      expect(saveJob).not.toHaveBeenCalled()
      expect(loadJob).not.toHaveBeenCalled()
    }
  })
})
