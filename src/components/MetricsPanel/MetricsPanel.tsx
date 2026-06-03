import { useAppStore } from '../../store/useAppStore'

export default function MetricsPanel() {
  const sheets = useAppStore((state) => state.sheets)
  const sheetWidthCm = useAppStore((state) => state.sheetWidthCm)
  const sheetHeightCm = useAppStore((state) => state.sheetHeightCm)

  const totalSheetArea = sheetWidthCm * sheetHeightCm * sheets.length
  const usedArea = sheets.reduce(
    (acc, sheet) =>
      acc + sheet.placements.reduce((a, p) => a + p.widthCm * p.heightCm, 0),
    0,
  )
  const efficiency = totalSheetArea > 0 ? ((usedArea / totalSheetArea) * 100).toFixed(1) : '0'

  return (
    <div className="flex gap-8 text-sm">
      <div>
        <span className="text-gray-400">Sheets:</span>{' '}
        <span className="font-semibold">{sheets.length}</span>
      </div>
      <div>
        <span className="text-gray-400">Used area:</span>{' '}
        <span className="font-semibold">{usedArea.toFixed(1)} cm²</span>
      </div>
      <div>
        <span className="text-gray-400">Efficiency:</span>{' '}
        <span className="font-semibold">{efficiency}%</span>
      </div>
    </div>
  )
}
