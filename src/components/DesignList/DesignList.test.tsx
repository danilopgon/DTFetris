import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignInput, VisibleBounds } from '../../types/domain'
import DesignList from './DesignList'
import { mapImportErrorToMessage } from '../../utils/importErrors'

// Mock the dialog plugin — the component calls open() from here
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

import { open as dialogOpen } from '@tauri-apps/plugin-dialog'

const openMock = vi.mocked(dialogOpen)

// Mock the Zustand store with a selector-aware implementation
const mockImportDesign = vi.fn()
const mockDesigns: DesignInput[] = []

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: object) => unknown) =>
    selector({
      designs: mockDesigns,
      importDesign: mockImportDesign,
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

describe('DesignList import UI', () => {
  beforeEach(() => {
    mockImportDesign.mockReset()
    openMock.mockReset()
    mockDesigns.length = 0
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a "Importar diseño" button', () => {
    render(<DesignList />)
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeInTheDocument()
  })

  it('renders widthCm and heightCm number inputs', () => {
    render(<DesignList />)
    expect(screen.getByLabelText(/ancho/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/alto/i)).toBeInTheDocument()
  })

  it('disables the submit button when widthCm input is empty', async () => {
    render(<DesignList />)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(heightInput, '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('disables the submit button when heightCm input is empty', async () => {
    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    await userEvent.type(widthInput, '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('disables the submit button when widthCm is zero', async () => {
    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '0')
    await userEvent.type(heightInput, '10')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('disables the submit button when heightCm is zero', async () => {
    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '10')
    await userEvent.type(heightInput, '0')
    expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
  })

  it('enables the submit button when both widthCm and heightCm are positive', async () => {
    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '10')
    await userEvent.type(heightInput, '8')
    expect(screen.getByRole('button', { name: /importar diseño/i })).not.toBeDisabled()
  })

  it('opens the file dialog and calls importDesign when the button is clicked with valid inputs', async () => {
    openMock.mockResolvedValueOnce('/path/to/logo.png')
    mockImportDesign.mockResolvedValueOnce(sampleDesign)

    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '10')
    await userEvent.type(heightInput, '8')

    const button = screen.getByRole('button', { name: /importar diseño/i })
    await userEvent.click(button)

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
    openMock.mockResolvedValueOnce('/path/to/logo.png')
    mockImportDesign.mockReturnValueOnce(pendingImport)

    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '10')
    await userEvent.type(heightInput, '8')

    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar diseño/i })).toBeDisabled()
    })

    resolveImport(sampleDesign)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar diseño/i })).not.toBeDisabled()
    })
  })

  it('shows no error message after a successful import', async () => {
    openMock.mockResolvedValueOnce('/path/to/logo.png')
    mockImportDesign.mockResolvedValueOnce(sampleDesign)

    render(<DesignList />)
    const widthInput = screen.getByLabelText(/ancho/i)
    const heightInput = screen.getByLabelText(/alto/i)
    await userEvent.type(widthInput, '10')
    await userEvent.type(heightInput, '8')

    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(mockImportDesign).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a Spanish error message for invalid_format', async () => {
    openMock.mockResolvedValueOnce('/path/to/image.jpg')
    mockImportDesign.mockRejectedValueOnce('invalid_format')

    render(<DesignList />)
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    await userEvent.type(screen.getByLabelText(/alto/i), '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Formato no soportado. Solo se aceptan archivos PNG y SVG.'
      )
    })
  })

  it('shows a Spanish error message for empty_artwork', async () => {
    openMock.mockResolvedValueOnce('/path/to/blank.png')
    mockImportDesign.mockRejectedValueOnce('empty_artwork')

    render(<DesignList />)
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    await userEvent.type(screen.getByLabelText(/alto/i), '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El diseño está vacío o es completamente transparente.'
      )
    })
  })

  it('shows a Spanish error message for file_not_found', async () => {
    openMock.mockResolvedValueOnce('/nonexistent/path.png')
    mockImportDesign.mockRejectedValueOnce('file_not_found')

    render(<DesignList />)
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    await userEvent.type(screen.getByLabelText(/alto/i), '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se encontró el archivo seleccionado.'
      )
    })
  })

  it('shows a Spanish error message for copy_failed', async () => {
    openMock.mockResolvedValueOnce('/path/to/logo.png')
    mockImportDesign.mockRejectedValueOnce('copy_failed')

    render(<DesignList />)
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    await userEvent.type(screen.getByLabelText(/alto/i), '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Error al guardar el diseño. Comprueba el espacio en disco.'
      )
    })
  })

  it('does not call importDesign when dialog is cancelled (returns null)', async () => {
    openMock.mockResolvedValueOnce(null)

    render(<DesignList />)
    await userEvent.type(screen.getByLabelText(/ancho/i), '10')
    await userEvent.type(screen.getByLabelText(/alto/i), '8')
    await userEvent.click(screen.getByRole('button', { name: /importar diseño/i }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled()
    })
    expect(mockImportDesign).not.toHaveBeenCalled()
  })
})
