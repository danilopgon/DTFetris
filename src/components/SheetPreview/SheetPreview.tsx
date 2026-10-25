import { convertFileSrc } from '@tauri-apps/api/core'
import { useEffect, useMemo, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'
import { useAppStore } from '../../store/useAppStore'
import { getFittedVisibleSizeCm } from '../../types/domain'

export default function SheetPreview() {
  const sheets = useAppStore((s) => s.sheets)
  const designs = useAppStore((s) => s.designs)
  const config = useAppStore((s) => s.sheetConfig)
  const stale = useAppStore((s) => s.isLayoutStale)
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [failed, setFailed] = useState<string[]>([])
  const byId = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs])

  useEffect(() => {
    let cancelled = false
    setImages({})
    setFailed([])
    const paths = [...new Set(designs.map((d) => d.imagePath))]
    const pending = paths.map((path) => {
      const image = new window.Image()
      image.onload = () => {
        if (!cancelled) setImages((current) => ({ ...current, [path]: image }))
      }
      image.onerror = () => {
        if (!cancelled) setFailed((current) => [...current, path])
      }
      image.src = convertFileSrc(path)
      return image
    })
    return () => {
      cancelled = true
      pending.forEach((image) => {
        image.onload = null
        image.onerror = null
      })
    }
  }, [designs])

  return (
    <section aria-label="Vista previa de las planchas">
      <h2 className="mb-2 text-lg font-semibold">Vista previa</h2>
      <p className="mb-4 text-sm text-gray-400">
        El fondo gris representa transparencia; no se imprime. El borde delimita la celda
        solicitada.
      </p>
      {failed.length > 0 && (
        <p role="alert" className="mb-3 text-sm text-red-300">
          No se pudieron cargar {failed.length} imágenes del trabajo. Comprueba que los archivos
          locales siguen disponibles antes de exportar.
        </p>
      )}
      {sheets.length === 0 ? (
        <div>
          <p className="mb-3 text-sm text-gray-300">
            {stale
              ? 'Composición pendiente. Pulsa Generar planchas.'
              : 'Importa diseños y pulsa Generar planchas para ver el resultado.'}
          </p>
          <div
            data-testid="empty-sheet"
            style={{
              width: config.widthCm * 4,
              aspectRatio: `${config.widthCm} / ${config.heightCm}`,
              maxWidth: '100%',
            }}
            className="border border-dashed border-gray-500 bg-gray-800"
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {sheets.map((sheet, index) => {
            const scale = Math.min(6, 520 / sheet.widthCm, 720 / sheet.heightCm)
            return (
              <figure key={sheet.id} aria-label={`Plancha ${index + 1}`}>
                <figcaption className="mb-2 text-sm font-medium">
                  Plancha {index + 1} · {sheet.widthCm} × {sheet.heightCm} cm ·{' '}
                  {sheet.placements.length} {sheet.placements.length === 1 ? 'copia' : 'copias'}
                </figcaption>
                <Stage width={sheet.widthCm * scale} height={sheet.heightCm * scale}>
                  <Layer listening={false}>
                    <Rect
                      width={sheet.widthCm * scale}
                      height={sheet.heightCm * scale}
                      fill="#d1d5db"
                    />
                    {sheet.placements.map((placement, i) => {
                      const design = byId.get(placement.designId)
                      if (!design) return null
                      const image = images[design.imagePath]
                      const fitted = getFittedVisibleSizeCm(design, design.originalAspectRatio)
                      const bounds = design.visibleBounds
                      return (
                        <Group key={i} x={placement.xCm * scale} y={placement.yCm * scale}>
                          <Rect
                            width={placement.widthCm * scale}
                            height={placement.heightCm * scale}
                            stroke={image ? '#64748b' : '#b91c1c'}
                            strokeWidth={0.5}
                          />
                          {image && (
                            <Group
                              x={placement.rotated ? placement.widthCm * scale : 0}
                              rotation={placement.rotated ? 90 : 0}
                            >
                              <KonvaImage
                                image={image}
                                x={((design.widthCm - fitted.widthCm) / 2) * scale}
                                y={((design.heightCm - fitted.heightCm) / 2) * scale}
                                width={fitted.widthCm * scale}
                                height={fitted.heightCm * scale}
                                crop={{
                                  x: (bounds.xPx * image.naturalWidth) / bounds.sourceWidthPx,
                                  y: (bounds.yPx * image.naturalHeight) / bounds.sourceHeightPx,
                                  width:
                                    (bounds.widthPx * image.naturalWidth) / bounds.sourceWidthPx,
                                  height:
                                    (bounds.heightPx * image.naturalHeight) / bounds.sourceHeightPx,
                                }}
                              />
                            </Group>
                          )}
                        </Group>
                      )
                    })}
                  </Layer>
                </Stage>
              </figure>
            )
          })}
        </div>
      )}
    </section>
  )
}
