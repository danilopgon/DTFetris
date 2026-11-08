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
    <section aria-label="Aprovechamiento" className="space-y-5">
      <h2 className="title">Aprovechamiento</h2>
      <dl className="stats">
        <div>
          <dt>Planchas: </dt>
          <dd>{sheets.length}</dd>
        </div>
        <div>
          <dt>Arte visible: </dt>
          <dd>{used.toFixed(1)} cm²</dd>
        </div>
        <div>
          <dt>Área libre: </dt>
          <dd>{(total - used).toFixed(1)} cm²</dd>
        </div>
        <div>
          <dt>Ocupación: </dt>
          <dd>{(total ? (used / total) * 100 : 0).toFixed(1)}%</dd>
        </div>
      </dl>
      {metrics.map((m, i) => (
        <div key={sheets[i].id}>
          <h3 className="mb-1 text-sm font-semibold">Plancha {i + 1}</h3>
          <dl className="sheet-figures">
            <div>
              <dt>Arte</dt>
              <dd>{m.used.toFixed(1)} cm²</dd>
            </div>
            <div>
              <dt>Libre</dt>
              <dd>{m.free.toFixed(1)} cm²</dd>
            </div>
            <div>
              <dt>Ocupación</dt>
              <dd>{m.occupancy.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Footprint físico</dt>
              <dd>{m.reserved.toFixed(1)} cm²</dd>
            </div>
          </dl>
        </div>
      ))}
      <p className="help">
        El área del arte es su rectángulo visible, no la suma de píxeles opacos. El footprint solo
        añade la holgura mínima de cálculo; la separación entre diseños queda en el área libre.
      </p>
    </section>
  )
}
