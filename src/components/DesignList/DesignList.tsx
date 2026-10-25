import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type {
  DesignInput,
  DesignUpdatePatch,
  DomainValidationError,
  ImportDesignErrorCode,
} from '../../types/domain'
import {
  getFittedVisibleSizeCm,
  isPositiveIntegerCm,
  isValidColorOverride,
  validateEditableDesignInput,
} from '../../types/domain'
import { mapImportErrorToMessage } from '../../utils/importErrors'

type EditForm = {
  name: string
  widthCm: string
  heightCm: string
  quantity: string
  canRotate: boolean
  colorOverride: string
}

export default function DesignList() {
  const designs = useAppStore((state) => state.designs)
  const isLayoutStale = useAppStore((state) => state.isLayoutStale)
  const importDesign = useAppStore((state) => state.importDesign)
  const updateDesign = useAppStore((state) => state.updateDesign)
  const duplicateDesign = useAppStore((state) => state.duplicateDesign)
  const removeDesign = useAppStore((state) => state.removeDesign)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [widthCm, setWidthCm] = useState<string>('')
  const [heightCm, setHeightCm] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const parsedWidth = Number(widthCm)
  const parsedHeight = Number(heightCm)
  const isValid = isPositiveIntegerCm(parsedWidth) && isPositiveIntegerCm(parsedHeight)
  const canImport = !!selectedPath && isValid && !isImporting

  async function handleSelectFile() {
    setErrorMessage(null)
    try {
      const path = await open({
        multiple: true,
        filters: [{ name: 'Imágenes PNG y SVG', extensions: ['png', 'svg'] }],
      })
      if (path && (!Array.isArray(path) || path.length > 0)) {
        const paths = Array.isArray(path) ? path : [path]
        setSelectedPaths(paths)
        setSelectedPath(paths[0])
        setSelectedName(
          paths.length === 1
            ? (paths[0].split(/[/\\]/).pop() ?? paths[0])
            : `${paths.length} archivos seleccionados`,
        )
      }
    } catch {
      setErrorMessage('No se pudo abrir el selector de archivos.')
    }
  }

  async function handleImport() {
    if (!selectedPath) return
    setErrorMessage(null)
    setIsImporting(true)
    try {
      // Process sequentially: bounded memory and successful imports survive a later error.
      const paths = selectedPaths.length ? selectedPaths : [selectedPath]
      const failed: string[] = []
      const failures: string[] = []
      for (const sourcePath of paths) {
        try {
          await importDesign({ sourcePath, widthCm: parsedWidth, heightCm: parsedHeight })
        } catch (err) {
          failed.push(sourcePath)
          failures.push(mapImportErrorToMessage(String(err)))
        }
      }
      if (failed.length) {
        setSelectedPaths(failed)
        setSelectedPath(failed[0])
        setSelectedName(
          failed.length === 1
            ? (failed[0].split(/[/\\]/).pop() ?? failed[0])
            : `${failed.length} archivos pendientes`,
        )
        setErrorMessage([...new Set(failures)].join(' '))
        return
      }
      setSelectedPath(null)
      setSelectedPaths([])
      setSelectedName(null)
      setWidthCm('')
      setHeightCm('')
    } catch (err) {
      const code = typeof err === 'string' ? err : (err as ImportDesignErrorCode)
      setErrorMessage(mapImportErrorToMessage(code as string))
    } finally {
      setIsImporting(false)
    }
  }

  function startEdit(design: DesignInput) {
    setEditingId(design.id)
    setEditForm({
      name: design.name,
      widthCm: String(design.widthCm),
      heightCm: String(design.heightCm),
      quantity: String(design.quantity),
      canRotate: design.canRotate,
      colorOverride: design.colorOverride ?? '',
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setEditError(null)
  }

  function updateEditForm(patch: Partial<EditForm>) {
    setEditForm((current) => (current ? { ...current, ...patch } : current))
  }

  function saveEdit(id: string) {
    if (!editForm) return
    const design = designs.find((d) => d.id === id)
    if (!design) return

    const patch: DesignUpdatePatch = {
      name: editForm.name.trim(),
      widthCm: Number(editForm.widthCm),
      heightCm: Number(editForm.heightCm),
      quantity: Number(editForm.quantity),
      canRotate: editForm.canRotate,
      ...(editForm.colorOverride !== '' || design.colorOverride != null
        ? { colorOverride: editForm.colorOverride === '' ? null : editForm.colorOverride }
        : {}),
    }
    const errors = validateEditableDesignInput({ ...design, ...patch })
    if (errors.length) {
      setEditError(mapDomainErrorToSpanish(errors[0]))
      return
    }

    const result = updateDesign(id, patch)
    if (!result.ok) {
      setEditError(mapDomainErrorToSpanish(result.errors[0]))
      return
    }

    cancelEdit()
  }

  function confirmDelete(id: string) {
    removeDesign(id)
    setPendingDeleteId(null)
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Diseños</h2>

      {isLayoutStale && (
        <p
          role="status"
          className="mb-3 rounded border border-amber-500/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
        >
          El diseño cambió. Recalcula la plancha para actualizar el resultado.
        </p>
      )}

      <div className="mb-4 space-y-2">
        <button
          type="button"
          disabled={isImporting}
          onClick={handleSelectFile}
          aria-label="Seleccionar archivo PNG o SVG"
          className="w-full rounded border border-dashed border-gray-500 px-3 py-2 text-left text-sm text-gray-300 hover:border-blue-400 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectedName ? (
            <span className="block truncate">{selectedName}</span>
          ) : (
            'Seleccionar PNG o SVG'
          )}
        </button>

        <div>
          <label htmlFor="design-width-cm" className="mb-1 block text-sm">
            Ancho (cm)
          </label>
          <input
            id="design-width-cm"
            type="number"
            min={1}
            step={1}
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
            min={1}
            step={1}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="ej. 8"
            aria-label="Alto en centímetros"
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
          />
        </div>

        <button
          type="button"
          disabled={!canImport}
          onClick={handleImport}
          aria-label="Importar diseño"
          className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Importar diseño
        </button>
        <p className="text-xs text-gray-400">
          Puedes seleccionar varios archivos. La celda indicada se aplica a todos; después puedes
          editar cada diseño.
        </p>
        <p className="text-xs text-gray-400">
          Máximo 20 MiB y 32 millones de píxeles por diseño. En SVG, convierte texto a trazados; no
          se admiten imágenes enlazadas, scripts ni patrones.
        </p>

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
              {editingId === d.id && editForm ? (
                <div className="space-y-2">
                  <div>
                    <label htmlFor={`design-name-${d.id}`} className="mb-1 block text-sm">
                      Nombre
                    </label>
                    <input
                      id={`design-name-${d.id}`}
                      value={editForm.name}
                      onChange={(e) => updateEditForm({ name: e.target.value })}
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-width-${d.id}`} className="mb-1 block text-sm">
                      Ancho solicitado (cm)
                    </label>
                    <input
                      id={`design-edit-width-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.widthCm}
                      onChange={(e) => updateEditForm({ widthCm: e.target.value })}
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-height-${d.id}`} className="mb-1 block text-sm">
                      Alto solicitado (cm)
                    </label>
                    <input
                      id={`design-edit-height-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.heightCm}
                      onChange={(e) => updateEditForm({ heightCm: e.target.value })}
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-quantity-${d.id}`} className="mb-1 block text-sm">
                      Cantidad
                    </label>
                    <input
                      id={`design-edit-quantity-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.quantity}
                      onChange={(e) => updateEditForm({ quantity: e.target.value })}
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-color-${d.id}`} className="mb-1 block text-sm">
                      Color único (opcional)
                    </label>
                    <input
                      id={`design-edit-color-${d.id}`}
                      type="text"
                      value={editForm.colorOverride}
                      onChange={(e) => updateEditForm({ colorOverride: e.target.value })}
                      placeholder="#RRGGBB"
                      aria-describedby={`design-color-help-${d.id}`}
                      aria-invalid={
                        editError !== null && !isValidColorOverride(editForm.colorOverride || null)
                      }
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm"
                    />
                    <p id={`design-color-help-${d.id}`} className="mt-1 text-xs text-gray-400">
                      Formato #RRGGBB. Sustituye todos los colores y conserva la transparencia; no
                      modifica el archivo original.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        updateEditForm({ colorOverride: '' })
                        setEditError(null)
                      }}
                      className="mt-1 rounded border border-gray-500 px-2 py-1"
                    >
                      Usar colores originales
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.canRotate}
                      onChange={(e) => updateEditForm({ canRotate: e.target.checked })}
                    />
                    Permitir rotación
                  </label>
                  <p className="text-xs text-gray-400">
                    La celda solicitada define el espacio ocupado; el arte se ajusta
                    proporcionalmente sin deformarse.
                  </p>
                  {editError && (
                    <p role="alert" className="text-sm text-red-400">
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(d.id)}
                      aria-label="Guardar cambios"
                      className="rounded bg-blue-600 px-2 py-1 text-white"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      aria-label="Cancelar edición"
                      className="rounded border border-gray-500 px-2 py-1"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    {d.name} ({d.widthCm} × {d.heightCm} cm) ×{d.quantity}
                  </div>
                  <p className="text-xs text-gray-300">
                    Arte visible:{' '}
                    {getFittedVisibleSizeCm(d, d.originalAspectRatio).widthCm.toFixed(2)} ×{' '}
                    {getFittedVisibleSizeCm(d, d.originalAspectRatio).heightCm.toFixed(2)} cm ·{' '}
                    {d.canRotate ? 'rotación permitida' : 'sin rotación'}
                  </p>
                  {d.colorOverride && (
                    <p className="text-xs text-gray-300">
                      Color único: {d.colorOverride.toUpperCase()}
                    </p>
                  )}
                  {pendingDeleteId === d.id ? (
                    <div className="space-y-2 rounded border border-red-500/50 p-2">
                      <p>¿Eliminar este diseño?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmDelete(d.id)}
                          aria-label="Confirmar eliminación"
                          className="rounded bg-red-600 px-2 py-1 text-white"
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          aria-label="Cancelar eliminación"
                          className="rounded border border-gray-500 px-2 py-1"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        aria-label={`Editar ${d.name}`}
                        className="rounded border border-gray-500 px-2 py-1"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateDesign(d.id)}
                        aria-label={`Duplicar ${d.name}`}
                        className="rounded border border-gray-500 px-2 py-1"
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(d.id)}
                        aria-label={`Eliminar ${d.name}`}
                        className="rounded border border-red-500 px-2 py-1 text-red-300"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function mapDomainErrorToSpanish(error: DomainValidationError | undefined): string {
  if (error?.field === 'colorOverride')
    return 'El color debe tener el formato #RRGGBB (seis dígitos hexadecimales).'
  if (error?.field === 'quantity') return 'La cantidad debe ser al menos 1.'
  if (error?.field === 'name') return 'El nombre es obligatorio.'
  if (error?.field === 'widthCm')
    return 'El ancho solicitado debe ser un número entero mayor que 0.'
  if (error?.field === 'heightCm')
    return 'El alto solicitado debe ser un número entero mayor que 0.'
  return 'No se pudieron guardar los cambios del diseño.'
}
