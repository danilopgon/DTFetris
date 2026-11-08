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
      <h2 className="title mb-4">Diseños</h2>

      {isLayoutStale && (
        <p role="status" className="notice mb-3">
          El diseño cambió. Recalcula la plancha para actualizar el resultado.
        </p>
      )}

      <div className="mb-4 space-y-2">
        <button
          type="button"
          disabled={isImporting}
          onClick={handleSelectFile}
          aria-label="Seleccionar archivo PNG o SVG"
          className="btn btn-drop"
        >
          {selectedName ? (
            <span className="block truncate">{selectedName}</span>
          ) : (
            'Seleccionar PNG o SVG'
          )}
        </button>

        <div>
          <label htmlFor="design-width-cm" className="label">
            Ancho máximo (cm)
          </label>
          <input
            id="design-width-cm"
            type="number"
            min={1}
            step={1}
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
            placeholder="ej. 10"
            aria-label="Ancho máximo en centímetros"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="design-height-cm" className="label">
            Alto máximo (cm)
          </label>
          <input
            id="design-height-cm"
            type="number"
            min={1}
            step={1}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="ej. 8"
            aria-label="Alto máximo en centímetros"
            className="field"
          />
        </div>

        <button
          type="button"
          disabled={!canImport}
          onClick={handleImport}
          aria-label="Importar diseño"
          className={designs.length === 0 ? 'btn btn-primary w-full' : 'btn w-full'}
        >
          Importar diseño
        </button>
        <p className="help">
          Puedes seleccionar varios archivos. Las medidas máximas se aplican a todos; después puedes
          editar cada diseño.
        </p>
        <p className="help">
          Máximo 20 MiB y 32 millones de píxeles por diseño. En SVG, convierte texto a trazados; no
          se admiten imágenes enlazadas, scripts ni patrones.
        </p>

        {errorMessage && (
          <p role="alert" className="msg-error">
            {errorMessage}
          </p>
        )}
      </div>

      {designs.length === 0 ? (
        <p className="help">Aún no hay diseños.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {designs.map((d) => (
            <li key={d.id} className="py-3 text-sm">
              {editingId === d.id && editForm ? (
                <div className="space-y-2">
                  <div>
                    <label htmlFor={`design-name-${d.id}`} className="label">
                      Nombre
                    </label>
                    <input
                      id={`design-name-${d.id}`}
                      value={editForm.name}
                      onChange={(e) => updateEditForm({ name: e.target.value })}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-width-${d.id}`} className="label">
                      Ancho máximo (cm)
                    </label>
                    <input
                      id={`design-edit-width-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.widthCm}
                      onChange={(e) => updateEditForm({ widthCm: e.target.value })}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-height-${d.id}`} className="label">
                      Alto máximo (cm)
                    </label>
                    <input
                      id={`design-edit-height-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.heightCm}
                      onChange={(e) => updateEditForm({ heightCm: e.target.value })}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-quantity-${d.id}`} className="label">
                      Cantidad
                    </label>
                    <input
                      id={`design-edit-quantity-${d.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editForm.quantity}
                      onChange={(e) => updateEditForm({ quantity: e.target.value })}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`design-edit-color-${d.id}`} className="label">
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
                      className="field"
                    />
                    <p id={`design-color-help-${d.id}`} className="help mt-1">
                      Formato #RRGGBB. Sustituye todos los colores y conserva la transparencia; no
                      modifica el archivo original.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        updateEditForm({ colorOverride: '' })
                        setEditError(null)
                      }}
                      className="btn btn-small mt-2"
                    >
                      Usar colores originales
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      className="check"
                      type="checkbox"
                      checked={editForm.canRotate}
                      onChange={(e) => updateEditForm({ canRotate: e.target.checked })}
                    />
                    Permitir rotación
                  </label>
                  <p className="help">
                    Las medidas máximas limitan el tamaño del arte, que se ajusta proporcionalmente
                    sin deformarse. Solo su rectángulo visible ocupa espacio en la plancha.
                  </p>
                  {editError && (
                    <p role="alert" className="msg-error">
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(d.id)}
                      aria-label="Guardar cambios"
                      className="btn btn-small"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      aria-label="Cancelar edición"
                      className="btn btn-small"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words font-semibold">{d.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-2">×{d.quantity}</span>
                  </div>
                  <dl className="help tabular-nums">
                    <div>
                      <dt className="inline">Máximo </dt>
                      <dd className="inline">
                        {d.widthCm} × {d.heightCm} cm
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Arte visible: </dt>
                      <dd className="inline">
                        {getFittedVisibleSizeCm(d, d.originalAspectRatio).widthCm.toFixed(2)} ×{' '}
                        {getFittedVisibleSizeCm(d, d.originalAspectRatio).heightCm.toFixed(2)} cm
                      </dd>
                    </div>
                    <div>{d.canRotate ? 'Rotación permitida' : 'Sin rotación'}</div>
                    {d.colorOverride && (
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-sm border border-muted"
                          style={{ background: d.colorOverride }}
                        />
                        Color único: {d.colorOverride.toUpperCase()}
                      </div>
                    )}
                  </dl>
                  {pendingDeleteId === d.id ? (
                    <div className="space-y-2 border-l-2 border-error pl-3">
                      <p>¿Eliminar este diseño?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmDelete(d.id)}
                          aria-label="Confirmar eliminación"
                          className="btn btn-small btn-danger"
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          aria-label="Cancelar eliminación"
                          className="btn btn-small"
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
                        className="btn btn-small"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateDesign(d.id)}
                        aria-label={`Duplicar ${d.name}`}
                        className="btn btn-small"
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(d.id)}
                        aria-label={`Eliminar ${d.name}`}
                        className="btn btn-small btn-danger"
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
  if (error?.field === 'widthCm') return 'El ancho máximo debe ser un número entero mayor que 0.'
  if (error?.field === 'heightCm') return 'El alto máximo debe ser un número entero mayor que 0.'
  return 'No se pudieron guardar los cambios del diseño.'
}
