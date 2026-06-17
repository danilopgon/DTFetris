import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignInput, VisibleBounds } from '../../types/domain'
import DesignList from './DesignList'
import { mapImportErrorToMessage } from '../../utils/importErrors'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

import { open as dialogOpen } from '@tauri-apps/plugin-dialog'

const openMock = vi.mocked(dialogOpen)

const mockImportDesign = vi.fn()
const mockUpdateDesign = vi.fn()
const mockDuplicateDesign = vi.fn()
const mockRemoveDesign = vi.fn()
const mockDesigns: DesignInput[] = []
let mockIsLayoutStale = false

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: object) => unknown) =>
    selector({
      designs: mockDesigns,
      isLayoutStale: mockIsLayoutStale,
      importDesign: mockImportDesign,
      updateDesign: mockUpdateDesign,
      duplicateDesign: mockDuplicateDesign,
      removeDesign: mockRemoveDesign,
    })
  ),
}))

const baseVisibleBounds: VisibleBounds = {
  xPx: 0,
  yPx: 0,
  widthPx: 100,
  heightPx: 80,
  sourceWidthPx: 100,
  sourceHeightPx: 80,
}

const sampleDesign: DesignInput = {
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

// ─── pure function tests ──────────────────────────────────────────────────────

describe('mapImportErrorToMessage (pure function)', () => {
  it('maps invalid_format to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('invalid_format')).toBe(
      'Formato no soportado. Solo se aceptan archivos PNG y SVG.'
    )
  })

  it('maps empty_artwork to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('empty_artwork')).toBe(
      'El diseño está vacío o es completamente transparente.'
    )
  })

  it('maps file_not_found to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('file_not_found')).toBe(
      'No se encontró el archivo seleccionado.'
    )
  })

  it('maps copy_failed to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('copy_failed')).toBe(
      'Error al guardar el diseño. Comprueba el espacio en disco.'
    )
  })

  it('maps invalid_dimensions to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('invalid_dimensions')).toBe(
      'Las dimensiones deben ser valores positivos.'
    )
  })

  it('maps metadata_failed to the correct Spanish message', () => {
    expect(mapImportErrorToMessage('metadata_failed')).toBe(
      'Error al procesar el archivo de imagen.'
    )
  })

  it('maps unknown codes to a fallback Spanish message', () => {
    expect(mapImportErrorToMessage('something_else')).toBe(
      'Error desconocido al importar el diseño.'
    )
  })
})

// ─── component tests ──────────────────────────────────────────────────────────

describe('DesignList import UI', () => {
  beforeEach(() => {
    mockImportDesign.mockReset()
    mockUpdateDesign.mockReset()
    mockDuplicateDesign.mockReset()
    mockRemoveDesign.mockReset()
    openMock.mockReset()
    mockDesigns.length = 0
    mockIsLayoutStale = false
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  // helpers
  async function selectFile(path = '/path/to/logo.png') {
    openMock.mockResolvedValueOnce(path)
    await userEvent.click(screen.getByRole('button', { name: /seleccionar/i }))
    await waitFor(() => expect(openMock).toHaveBeenCalled())
  }

  async function fillDims(width = '10', height = '8') {
    await userEvent.type(screen.getByLabelText(/ancho/i), width)
    await userEvent.type(screen.getByLabelText(/alto/i), height)
  }

  // ── renders ──────────────────────────────────────────────────────────────────

  it('renders a file selector button', () => {
    render(<DesignList />)
    expect(
      screen.getByRole('button', { name: /seleccionar archivo png o svg/i })
    ).toBeInTheDocument()
  })

  it('renders an "Importar diseño" button', () => {
    render(<DesignList />)
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeInTheDocument()
  })

  it('renders widthCm and heightCm number inputs', () => {
    render(<DesignList />)
    expect(screen.getByLabelText(/ancho/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/alto/i)).toBeInTheDocument()
  })

  // ── file selection ────────────────────────────────────────────────────────────

  it('clicking the file selector button opens the file dialog', async () => {
    openMock.mockResolvedValueOnce(null)
    render(<DesignList />)
    await userEvent.click(screen.getByRole('button', { name: /seleccionar/i }))
    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'Imágenes PNG y SVG', extensions: ['png', 'svg'] }],
    })
  })

  it('shows the selected filename after a successful file selection', async () => {
    render(<DesignList />)
    await selectFile('/designs/logo.png')
    expect(screen.getByText('logo.png')).toBeInTheDocument()
  })

  it('does not change the displayed text when dialog is cancelled', async () => {
    openMock.mockResolvedValueOnce(null)
    render(<DesignList />)
    await userEvent.click(screen.getByRole('button', { name: /seleccionar/i }))
    await waitFor(() => expect(openMock).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /seleccionar/i })).toHaveTextContent(
      'Seleccionar PNG o SVG'
    )
  })

  it('shows an error when the file dialog throws', async () => {
    openMock.mockRejectedValueOnce(new Error('Permission denied'))
    render(<DesignList />)
    await userEvent.click(screen.getByRole('button', { name: /seleccionar/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo abrir el selector de archivos.'
      )
    })
  })

  // ── import button state ───────────────────────────────────────────────────────

  it('import button is disabled when no file is selected', () => {
    render(<DesignList />)
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('import button is disabled when file is selected but widthCm is empty', async () => {
    render(<DesignList />)
    await selectFile()
    await userEvent.type(screen.getByLabelText(/alto/i), '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('import button is disabled when file is selected but heightCm is empty', async () => {
    render(<DesignList />)
    await selectFile()
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('import button is disabled when file is selected but widthCm is zero', async () => {
    render(<DesignList />)
    await selectFile()
    await fillDims('0', '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('import button is disabled when file is selected but heightCm is zero', async () => {
    render(<DesignList />)
    await selectFile()
    await fillDims('10', '0')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('import button is enabled when file is selected and both dimensions are positive integers', async () => {
    render(<DesignList />)
    await selectFile()
    await fillDims('10', '8')
    expect(screen.getByRole('button', { name: /importar diseño/i })).not.toBeDisabled()
  })

  // ── import flow ───────────────────────────────────────────────────────────────

  it('calls importDesign with the selected path and confirmed dimensions', async () => {
    mockImportDesign.mockResolvedValueOnce(sampleDesign)
    render(<DesignList />)
    await selectFile('/path/to/logo.png')
    await fillDims('10', '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(mockImportDesign).toHaveBeenCalledWith({
        sourcePath: '/path/to/logo.png',
        widthCm: 10,
        heightCm: 8,
      })
    })
  })

  it('shows a loading indicator while the import is in progress', async () => {
    let resolveImport!: (value: DesignInput) => void
    const pendingImport = new Promise<DesignInput>((resolve) => {
      resolveImport = resolve
    })
    mockImportDesign.mockReturnValueOnce(pendingImport)

    render(<DesignList />)
    await selectFile()
    await fillDims()
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
    })

    resolveImport(sampleDesign)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
    })
  })

  it('clears the form and selected file after a successful import', async () => {
    mockImportDesign.mockResolvedValueOnce(sampleDesign)
    render(<DesignList />)
    await selectFile('/path/to/logo.png')
    await fillDims('10', '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /seleccionar/i })).toHaveTextContent(
        'Seleccionar PNG o SVG'
      )
    })
    expect(screen.getByLabelText(/ancho/i)).toHaveValue(null)
    expect(screen.getByLabelText(/alto/i)).toHaveValue(null)
  })

  it('shows no error message after a successful import', async () => {
    mockImportDesign.mockResolvedValueOnce(sampleDesign)
    render(<DesignList />)
    await selectFile()
    await fillDims()
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => expect(mockImportDesign).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a Spanish error message for invalid_format', async () => {
    mockImportDesign.mockRejectedValueOnce('invalid_format')
    render(<DesignList />)
    await selectFile('/path/to/image.jpg')
    await fillDims()
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Formato no soportado. Solo se aceptan archivos PNG y SVG.'
      )
    })
  })

  it('shows a Spanish error message for empty_artwork', async () => {
    mockImportDesign.mockRejectedValueOnce('empty_artwork')
    render(<DesignList />)
    await selectFile('/path/to/blank.png')
    await fillDims()
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El diseño está vacío o es completamente transparente.'
      )
    })
  })

  it('shows a Spanish error message for copy_failed', async () => {
    mockImportDesign.mockRejectedValueOnce('copy_failed')
    render(<DesignList />)
    await selectFile('/path/to/logo.png')
    await fillDims()
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Error al guardar el diseño. Comprueba el espacio en disco.'
      )
    })
  })
})

describe('DesignList editing UI', () => {
  beforeEach(() => {
    mockImportDesign.mockReset()
    mockUpdateDesign.mockReset()
    mockDuplicateDesign.mockReset()
    mockRemoveDesign.mockReset()
    openMock.mockReset()
    mockDesigns.length = 0
    mockIsLayoutStale = false
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  function renderWithDesign(overrides: Partial<DesignInput> = {}) {
    mockDesigns.push({ ...sampleDesign, ...overrides })
    render(<DesignList />)
  }

  it('edits name, requested cell dimensions, quantity, and rotation with Spanish controls', async () => {
    mockUpdateDesign.mockReturnValueOnce({ ok: true })
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /editar logo\.png/i }))
    await userEvent.clear(screen.getByLabelText('Nombre'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Logo principal')
    await userEvent.clear(screen.getByLabelText('Ancho solicitado (cm)'))
    await userEvent.type(screen.getByLabelText('Ancho solicitado (cm)'), '12')
    await userEvent.clear(screen.getByLabelText('Alto solicitado (cm)'))
    await userEvent.type(screen.getByLabelText('Alto solicitado (cm)'), '9')
    await userEvent.clear(screen.getByLabelText('Cantidad'))
    await userEvent.type(screen.getByLabelText('Cantidad'), '3')
    await userEvent.click(screen.getByLabelText('Permitir rotación'))
    expect(screen.getByText(/celda solicitada/i)).toHaveTextContent(
      'La celda solicitada define el espacio ocupado; el arte se ajusta proporcionalmente sin deformarse.'
    )
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(mockUpdateDesign).toHaveBeenCalledWith('imported-1', {
      name: 'Logo principal',
      widthCm: 12,
      heightCm: 9,
      quantity: 3,
      canRotate: true,
    })
  })

  it('shows Spanish validation feedback when quantity is less than one', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /editar logo\.png/i }))
    await userEvent.clear(screen.getByLabelText('Cantidad'))
    await userEvent.type(screen.getByLabelText('Cantidad'), '0')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser al menos 1.')
    expect(mockUpdateDesign).not.toHaveBeenCalled()
  })

  it('shows Spanish validation feedback when requested dimensions are fractional', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /editar logo\.png/i }))
    await userEvent.clear(screen.getByLabelText('Ancho solicitado (cm)'))
    await userEvent.type(screen.getByLabelText('Ancho solicitado (cm)'), '10.5')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El ancho solicitado debe ser un número entero mayor que 0.'
    )
    expect(mockUpdateDesign).not.toHaveBeenCalled()
  })

  it('cancels an edit without calling store mutations', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /editar logo\.png/i }))
    await userEvent.clear(screen.getByLabelText('Nombre'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Temporal')
    await userEvent.click(screen.getByRole('button', { name: /cancelar edición/i }))

    expect(mockUpdateDesign).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
  })

  it('duplicates a design through the store without fabricating packing', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /duplicar logo\.png/i }))

    expect(mockDuplicateDesign).toHaveBeenCalledWith('imported-1')
    expect(mockUpdateDesign).not.toHaveBeenCalled()
  })

  it('requires confirmation before deleting and allows cancellation', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /eliminar logo\.png/i }))
    expect(screen.getByText('¿Eliminar este diseño?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cancelar eliminación/i }))

    expect(mockRemoveDesign).not.toHaveBeenCalled()
  })

  it('deletes only after confirmation through the store', async () => {
    renderWithDesign()

    await userEvent.click(screen.getByRole('button', { name: /eliminar logo\.png/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmar eliminación/i }))

    expect(mockRemoveDesign).toHaveBeenCalledWith('imported-1')
  })

  it('shows pending recalculation copy when the layout is stale', () => {
    mockIsLayoutStale = true
    renderWithDesign()

    expect(screen.getByRole('status')).toHaveTextContent('El diseño cambió. Recalcula la plancha para actualizar el resultado.')
  })
})
