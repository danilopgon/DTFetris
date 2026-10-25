import { useAppStore } from '../../store/useAppStore'
import { getFittedVisibleSizeCm, type DesignInput, type Sheet } from '../../types/domain'

export function sheetMetrics(sheet: Sheet, designs: DesignInput[]) {
  const byId = new Map(designs.map((d) => [d.id, d]))
  const total = sheet.widthCm * sheet.heightCm
  const reserved = sheet.placements.reduce((sum, p) => sum + p.widthCm * p.heightCm, 0)
  const used = sheet.placements.reduce((sum, p) => {
    const design = byId.get(p.designId)
    if (!design) return sum
    const fitted = getFittedVisibleSizeCm(design, design.originalAspectRatio)
    return sum + fitted.widthCm * fitted.heightCm
  }, 0)
  return { total, used, free: total - used, reserved, occupancy: total ? (used / total) * 100 : 0 }
}

export default function MetricsPanel() {
  const sheets = useAppStore((s) => s.sheets)
  const designs = useAppStore((s) => s.designs)
  const metrics = sheets.map((sheet) => sheetMetrics(sheet, designs))
  const total = metrics.reduce((sum, m) => sum + m.total, 0)
  const used = metrics.reduce((sum, m) => sum + m.used, 0)
  return (
    <section aria-label="Aprovechamiento">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          Planchas: <strong>{sheets.length}</strong>
        </span>
        <span>
          Arte visible: <strong>{used.toFixed(1)} cm²</strong>
        </span>
        <span>
          Área libre: <strong>{(total - used).toFixed(1)} cm²</strong>
        </span>
        <span>
          Ocupación: <strong>{(total ? (used / total) * 100 : 0).toFixed(1)}%</strong>
        </span>
      </div>
      {metrics.map((m, i) => (
        <p key={sheets[i].id} className="mt-2 text-xs text-gray-300">
          Plancha {i + 1}: {m.used.toFixed(1)} cm² de arte · {m.free.toFixed(1)} cm² libres ·{' '}
          {m.occupancy.toFixed(1)}% ocupación · {m.reserved.toFixed(1)} cm² reservados en celdas
        </p>
      ))}
      <p className="mt-2 text-xs text-gray-400">
        El área del arte es su rectángulo visible, no la suma de píxeles opacos. Las celdas pueden
        reservar más espacio para conservar proporciones.
      </p>
    </section>
  )
}
