import { Layer, Rect, Stage } from 'react-konva'
import { useAppStore } from '../../store/useAppStore'
import { cmToPx } from '../../utils/units'

const PREVIEW_DPI = 10

export default function SheetPreview() {
  const sheets = useAppStore((state) => state.sheets)
  const sheetWidthCm = useAppStore((state) => state.sheetWidthCm)
  const sheetHeightCm = useAppStore((state) => state.sheetHeightCm)

  const stageWidth = cmToPx(sheetWidthCm, PREVIEW_DPI)
  const stageHeight = cmToPx(sheetHeightCm, PREVIEW_DPI)

  return (
    <div className="overflow-auto">
      <h2 className="mb-4 text-lg font-semibold">Vista previa de plancha</h2>
      {sheets.length === 0 ? (
        <div
          style={{ width: stageWidth, height: stageHeight }}
          className="rounded border border-dashed border-gray-600 bg-gray-800"
        />
      ) : (
        sheets.map((sheet) => (
          <div key={sheet.id} className="mb-4">
            <Stage width={stageWidth} height={stageHeight}>
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={stageWidth}
                  height={stageHeight}
                  fill="#1f2937"
                  stroke="#4b5563"
                  strokeWidth={1}
                />
                {sheet.placements.map((p, i) => (
                  <Rect
                    key={i}
                    x={cmToPx(p.xCm, PREVIEW_DPI)}
                    y={cmToPx(p.yCm, PREVIEW_DPI)}
                    width={cmToPx(p.widthCm, PREVIEW_DPI)}
                    height={cmToPx(p.heightCm, PREVIEW_DPI)}
                    fill="#3b82f6"
                    stroke="#60a5fa"
                    strokeWidth={1}
                    opacity={0.8}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        ))
      )}
    </div>
  )
}
