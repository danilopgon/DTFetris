import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { DesignInput, DesignUpdatePatch, DomainValidationError, ImportDesignErrorCode } from '../../types/domain'
import { mapImportErrorToMessage } from '../../utils/importErrors'

type EditForm = {
  name: string
  widthCm: string
  heightCm: string
  quantity: string
  canRotate: boolean
}

export default function DesignList() {
  const designs = useAppStore((state) => state.designs)
  const isLayoutStale = useAppStore((state) => state.isLayoutStale)
  const importDesign = useAppStore((state) => state.importDesign)
  const updateDesign = useAppStore((state) => state.updateDesign)
  const duplicateDesign = useAppStore((state) => state.duplicateDesign)
  const removeDesign = useAppStore((state) => state.removeDesign)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [widthCm, setWidthCm] = useState<string>('')
  const [heightCm, setHeightCm] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const parsedWidth = parseFloat(widthCm)
  const parsedHeight = parseFloat(heightCm)
  const isValid =
    Number.isInteger(parsedWidth) &&
    parsedWidth > 0 &&
    Number.isInteger(parsedHeight) &&
    parsedHeight > 0
  const canImport = !!selectedPath && isValid && !isImporting

  async function handleSelectFile() {
    setErrorMessage(null)
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'Imágenes PNG y SVG', extensions: ['png', 'svg'] }],
      })
      if (path && !Array.isArray(path)) {
        setSelectedPath(path)
        setSelectedName(path.split(/[/\\]/).pop() ?? path)
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
      await importDesign({
        sourcePath: selectedPath,
        widthCm: parsedWidth,
        heightCm: parsedHeight,
      })
      setSelectedPath(null)
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

    const patch: DesignUpdatePatch = {
      name: editForm.name.trim(),
      widthCm: Number(editForm.widthCm),
      heightCm: Number(editForm.heightCm),
      quantity: Number(editForm.quantity),
      canRotate: editForm.canRotate,
    }
    const localError = validateEditPatch(patch)
    if (localError) {
      setEditError(localError)
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
        <p role="status" className="mb-3 rounded border border-amber-500/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
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
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.canRotate}
                      onChange={(e) => updateEditForm({ canRotate: e.target.checked })}
                    />
                    Permitir rotación
                  </label>
                  <p className="text-xs text-gray-400">
                    La celda solicitada define el espacio ocupado; el arte se ajusta proporcionalmente sin deformarse.
                  </p>
                  {editError && (
                    <p role="alert" className="text-sm text-red-400">
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(d.id)} aria-label="Guardar cambios" className="rounded bg-blue-600 px-2 py-1 text-white">
                      Guardar
                    </button>
                    <button type="button" onClick={cancelEdit} aria-label="Cancelar edición" className="rounded border border-gray-500 px-2 py-1">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    {d.name} ({d.widthCm} × {d.heightCm} cm) ×{d.quantity}
                  </div>
                  {pendingDeleteId === d.id ? (
                    <div className="space-y-2 rounded border border-red-500/50 p-2">
                      <p>¿Eliminar este diseño?</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => confirmDelete(d.id)} aria-label="Confirmar eliminación" className="rounded bg-red-600 px-2 py-1 text-white">
                          Eliminar
                        </button>
                        <button type="button" onClick={() => setPendingDeleteId(null)} aria-label="Cancelar eliminación" className="rounded border border-gray-500 px-2 py-1">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(d)} aria-label={`Editar ${d.name}`} className="rounded border border-gray-500 px-2 py-1">
                        Editar
                      </button>
                      <button type="button" onClick={() => duplicateDesign(d.id)} aria-label={`Duplicar ${d.name}`} className="rounded border border-gray-500 px-2 py-1">
                        Duplicar
                      </button>
                      <button type="button" onClick={() => setPendingDeleteId(d.id)} aria-label={`Eliminar ${d.name}`} className="rounded border border-red-500 px-2 py-1 text-red-300">
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

function validateEditPatch(patch: DesignUpdatePatch): string | null {
  if (typeof patch.name !== 'string' || patch.name.trim().length === 0) {
    return 'El nombre es obligatorio.'
  }
  if (!Number.isInteger(patch.widthCm) || Number(patch.widthCm) < 1) {
    return 'El ancho solicitado debe ser un número entero mayor que 0.'
  }
  if (!Number.isInteger(patch.heightCm) || Number(patch.heightCm) < 1) {
    return 'El alto solicitado debe ser un número entero mayor que 0.'
  }
  if (!Number.isInteger(patch.quantity) || Number(patch.quantity) < 1) {
    return 'La cantidad debe ser al menos 1.'
  }
  return null
}

function mapDomainErrorToSpanish(error: DomainValidationError | undefined): string {
  if (error?.field === 'quantity') return 'La cantidad debe ser al menos 1.'
  if (error?.field === 'name') return 'El nombre es obligatorio.'
  if (error?.field === 'widthCm') return 'El ancho solicitado debe ser un número entero mayor que 0.'
  if (error?.field === 'heightCm') return 'El alto solicitado debe ser un número entero mayor que 0.'
  return 'No se pudieron guardar los cambios del diseño.'
}
