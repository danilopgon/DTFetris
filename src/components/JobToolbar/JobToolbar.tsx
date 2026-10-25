import { confirm, open, save } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { exportPng, loadJob, saveJob } from '../../commands'
import { useAppStore } from '../../store/useAppStore'
import { isPositiveIntegerCm, isValidGapCm } from '../../types/domain'

type Props = { onBusyChange: (busy: boolean) => void }

function gapInMm(gapCm = 0): string {
  return String(Number((gapCm * 10).toPrecision(15)))
}

export default function JobToolbar({ onBusyChange }: Props) {
  const config = useAppStore((s) => s.sheetConfig)
  const designs = useAppStore((s) => s.designs)
  const sheets = useAppStore((s) => s.sheets)
  const stale = useAppStore((s) => s.isLayoutStale)
  const optimizing = useAppStore((s) => s.isOptimizing)
  const importing = useAppStore((s) => s.isImporting)
  const unplaced = useAppStore((s) => s.unplacedItems)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [path, setPath] = useState('')
  const [sheetWidth, setSheetWidth] = useState(String(config.widthCm))
  const [sheetHeight, setSheetHeight] = useState(String(config.heightCm))
  const [sheetGapMm, setSheetGapMm] = useState(gapInMm(config.gapCm))
  const pendingSize =
    sheetWidth !== String(config.widthCm) ||
    sheetHeight !== String(config.heightCm) ||
    sheetGapMm !== gapInMm(config.gapCm)
  const validSize =
    isPositiveIntegerCm(Number(sheetWidth)) &&
    isPositiveIntegerCm(Number(sheetHeight)) &&
    sheetGapMm.trim() !== '' &&
    isValidGapCm(Number(sheetGapMm) / 10)
  useEffect(() => {
    setSheetWidth(String(config.widthCm))
    setSheetHeight(String(config.heightCm))
    setSheetGapMm(gapInMm(config.gapCm))
  }, [config.widthCm, config.heightCm, config.gapCm])

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    onBusyChange(true)
    setMessage('')
    setError('')
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  async function handleSave() {
    const destination = await save({
      title: 'Guardar trabajo DTF',
      defaultPath: path || 'trabajo-dtf.json',
      filters: [{ name: 'Trabajo DTF', extensions: ['json'] }],
    })
    if (!destination) return
    const state = useAppStore.getState()
    await saveJob(
      { version: 1, sheetConfig: state.sheetConfig, designs: state.designs },
      destination,
    )
    setPath(destination)
    setMessage('Trabajo guardado. Los diseños se conservan en los datos locales de DTFetris.')
  }

  async function handleLoad() {
    if (
      designs.length &&
      !(await confirm(
        'Abrir otro trabajo sustituirá el actual. Guarda primero si quieres conservar los cambios.',
        { title: 'Abrir trabajo', kind: 'warning' },
      ))
    )
      return
    const source = await open({
      title: 'Abrir trabajo DTF',
      multiple: false,
      filters: [{ name: 'Trabajo DTF', extensions: ['json'] }],
    })
    if (!source || Array.isArray(source)) return
    const job = await loadJob(source)
    useAppStore.getState().restoreJob(job)
    setPath(source)
    setMessage('Trabajo recuperado. Pulsa Generar planchas para recalcular y exportar.')
  }

  async function handleExport() {
    const destination = await save({
      title: 'Exportar todas las planchas a 300 DPI',
      defaultPath: 'plancha.png',
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }],
    })
    if (!destination) return
    const files = await exportPng(sheets, designs, destination)
    setMessage(`Exportación completada: ${files.length} archivo(s). ${files.join(' · ')}`)
  }

  return (
    <header className="border-b border-gray-700 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">DTFetris</h1>
        <fieldset disabled={busy || optimizing || importing} className="flex flex-wrap gap-2">
          <button className="action-secondary" onClick={() => perform(handleLoad)}>
            Abrir trabajo
          </button>
          <button
            className="action-secondary"
            disabled={pendingSize}
            onClick={() => perform(handleSave)}
          >
            Guardar trabajo
          </button>
          <button
            className="action-primary"
            disabled={pendingSize || !sheets.length || stale || unplaced.length > 0}
            onClick={() => perform(handleExport)}
          >
            Exportar PNG · 300 DPI
          </button>
        </fieldset>
      </div>
      <fieldset
        disabled={busy || optimizing || importing}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          Ancho de plancha (cm)
          <input
            className="number-input"
            type="number"
            min="1"
            step="1"
            value={sheetWidth}
            onChange={(e) => setSheetWidth(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Alto de plancha (cm)
          <input
            className="number-input"
            type="number"
            min="1"
            step="1"
            value={sheetHeight}
            onChange={(e) => setSheetHeight(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Separación entre diseños (mm)
          <input
            className="number-input"
            type="number"
            min="0"
            step="any"
            value={sheetGapMm}
            onChange={(e) => setSheetGapMm(e.target.value)}
          />
        </label>
        <button
          className="action-secondary"
          disabled={!pendingSize || !validSize}
          onClick={() => {
            useAppStore
              .getState()
              .setSheetSize(Number(sheetWidth), Number(sheetHeight), Number(sheetGapMm) / 10)
            setSheetWidth(String(Number(sheetWidth)))
            setSheetHeight(String(Number(sheetHeight)))
            setSheetGapMm(gapInMm(Number(sheetGapMm) / 10))
            setMessage('Configuración actualizada. Genera de nuevo las planchas.')
          }}
        >
          Aplicar configuración
        </button>
        <button
          className="action-primary"
          disabled={pendingSize || !designs.length}
          onClick={() =>
            perform(async () => {
              await useAppStore.getState().generateSheets()
              setMessage('Composición calculada. Revisa todas las planchas antes de exportar.')
            })
          }
        >
          {optimizing ? 'Distribuyendo…' : 'Generar planchas'}
        </button>
      </fieldset>
      {pendingSize && (
        <p role="status" className="mt-2 text-sm text-amber-200">
          {validSize
            ? 'Aplica la configuración antes de generar, guardar o exportar.'
            : 'La plancha requiere centímetros enteros mayores que cero y separación finita mayor o igual que cero.'}
        </p>
      )}
      {path && <p className="mt-2 break-all text-xs text-gray-400">Trabajo: {path}</p>}
      {busy && (
        <p role="status" className="mt-2 text-sm">
          Procesando…
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 break-words text-sm text-green-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 break-words text-sm text-red-300">
          {error}
        </p>
      )}
      {unplaced.length > 0 && (
        <div role="alert" className="mt-3 text-sm text-amber-200">
          <p>
            No se pueden exportar todas las copias: {unplaced.length} no caben. Amplía la plancha,
            reduce sus medidas máximas o la separación, o permite rotación y vuelve a generar.
          </p>
          <ul>
            {[...new Set(unplaced.map((item) => item.designId))].map((id) => (
              <li key={id}>{designs.find((d) => d.id === id)?.name ?? id}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  const code = String(error)
  const messages: Record<string, string> = {
    invalid_dimensions: 'Las dimensiones deben ser centímetros enteros mayores que cero.',
    invalid_quantity: 'Introduce cantidades enteras mayores que cero e importa al menos un diseño.',
    invalid_design: 'Revisa los datos de los diseños antes de generar.',
    too_many_items: 'El trabajo tiene demasiadas copias. Divídelo en trabajos más pequeños.',
    packing_limit_exceeded:
      'El trabajo supera el límite de 1000 copias o su composición es demasiado compleja. Divídelo en trabajos más pequeños.',
    invalid_design_id:
      'Hay diseños con identificadores repetidos o vacíos. Vuelve a importar los diseños afectados.',
  }
  return (
    messages[code] ??
    (/[áéíóúñ¿ ]/i.test(code) && code.includes(' ')
      ? code
      : `No se pudo completar la operación (${code}). Revisa el archivo y los permisos e inténtalo de nuevo.`)
  )
}
