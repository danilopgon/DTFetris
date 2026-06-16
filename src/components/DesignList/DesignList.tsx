import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { ImportDesignErrorCode } from '../../types/domain'

export function mapImportErrorToMessage(code: string): string {
  switch (code) {
    case 'invalid_format':
      return 'Formato no soportado. Solo se aceptan archivos PNG y SVG.'
    case 'empty_artwork':
      return 'El diseño está vacío o es completamente transparente.'
    case 'file_not_found':
      return 'No se encontró el archivo seleccionado.'
    case 'copy_failed':
      return 'Error al guardar el diseño. Comprueba el espacio en disco.'
    case 'invalid_dimensions':
      return 'Las dimensiones deben ser valores positivos.'
    case 'metadata_failed':
      return 'Error al procesar el archivo de imagen.'
    default:
      return 'Error desconocido al importar el diseño.'
  }
}

export default function DesignList() {
  const designs = useAppStore((state) => state.designs)
  const importDesign = useAppStore((state) => state.importDesign)

  const [widthCm, setWidthCm] = useState<string>('')
  const [heightCm, setHeightCm] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const parsedWidth = parseFloat(widthCm)
  const parsedHeight = parseFloat(heightCm)
  const isValid = !isNaN(parsedWidth) && parsedWidth > 0 && !isNaN(parsedHeight) && parsedHeight > 0
  const isDisabled = !isValid || isImporting

  async function handleImport() {
    setErrorMessage(null)

    const selectedPath = await open({
      multiple: false,
      filters: [{ name: 'Imágenes PNG y SVG', extensions: ['png', 'svg'] }],
    })

    if (!selectedPath || Array.isArray(selectedPath)) {
      return
    }

    setIsImporting(true)
    try {
      await importDesign({
        sourcePath: selectedPath,
        widthCm: parsedWidth,
        heightCm: parsedHeight,
      })
    } catch (err) {
      const code = typeof err === 'string' ? err : (err as ImportDesignErrorCode)
      setErrorMessage(mapImportErrorToMessage(code as string))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Diseños</h2>

      <div className="mb-4 space-y-2">
        <div>
          <label htmlFor="design-width-cm" className="mb-1 block text-sm">
            Ancho (cm)
          </label>
          <input
            id="design-width-cm"
            type="number"
            min={0.1}
            step={0.1}
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
            placeholder="ej. 10"
            aria-label="Ancho en centímetros"
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label htmlFor="design-height-cm" className="mb-1 block text-sm">
            Alto (cm)
          </label>
          <input
            id="design-height-cm"
            type="number"
            min={0.1}
            step={0.1}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="ej. 8"
            aria-label="Alto en centímetros"
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleImport}
          aria-label="Importar diseño"
          className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Importar diseño
        </button>

        {errorMessage && (
          <p role="alert" className="text-sm text-red-400">
            {errorMessage}
          </p>
        )}
      </div>

      {designs.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay diseños.</p>
      ) : (
        <ul className="space-y-2">
          {designs.map((d) => (
            <li key={d.id} className="rounded bg-gray-800 p-2 text-sm">
              {d.name} ({d.widthCm} × {d.heightCm} cm) ×{d.quantity}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
