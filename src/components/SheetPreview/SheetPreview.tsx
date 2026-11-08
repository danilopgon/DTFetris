import { convertFileSrc } from '@tauri-apps/api/core'
import { useEffect, useMemo, useState } from 'react'
import { Group, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'
import { useAppStore } from '../../store/useAppStore'
import { getFittedVisibleSizeCm } from '../../types/domain'
import {
  createTintedPreviewCache,
  getPreviewCrop,
  getPreviewSourceSize,
  type PreviewSource,
} from './tintedPreview'

/** Pixels per cm: every sheet fills a 520 × 720 px box, so small sheets are not drawn tiny. */
export function sheetPreviewScale(widthCm: number, heightCm: number) {
  return Math.min(520 / widthCm, 720 / heightCm)
}

// Konva paints on canvas, outside CSS: read the design tokens from the root at render time.
function tokenColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function SheetPreview() {
  const sheets = useAppStore((s) => s.sheets)
  const designs = useAppStore((s) => s.designs)
  const config = useAppStore((s) => s.sheetConfig)
  const stale = useAppStore((s) => s.isLayoutStale)
  const jobRevision = useAppStore((s) => s.jobRevision)
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const [failed, setFailed] = useState<string[]>([])
  const byId = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs])
  const pathsKey = JSON.stringify([...new Set(designs.map((d) => d.imagePath))])
  const [getTintedPreview] = useState(() => createTintedPreviewCache())
  const previews = useMemo(() => {
    const byDesign = new Map<string, PreviewSource>()
    const bySourceColor = new Map<string, PreviewSource>()
    let failed = false
    for (const design of designs) {
      const image = images[design.imagePath]
      if (!image) continue
      try {
        // Deduplicate the entire active job too, even when it exceeds the LRU capacity.
        const key = JSON.stringify([design.imagePath, design.colorOverride?.toUpperCase()])
        let source = bySourceColor.get(key)
        if (!source) {
          source = getTintedPreview(image, design.colorOverride)
          bySourceColor.set(key, source)
        }
        byDesign.set(design.id, source)
      } catch {
        failed = true
      }
    }
    return { byDesign, failed }
  }, [designs, images, getTintedPreview])

  useEffect(() => {
    let cancelled = false
    setImages({})
    setFailed([])
    const paths = JSON.parse(pathsKey) as string[]
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
  }, [pathsKey, jobRevision])

  return (
    <section aria-label="Vista previa de las planchas">
      <h2 className="title mb-1">Vista previa</h2>
      <p className="help mb-6 max-w-[75ch]">
        El fondo gris representa transparencia; no se imprime. El borde delimita el tamaño visible
        colocado. La separación entre diseños no es padding transparente del archivo.
      </p>
      {failed.length > 0 && (
        <p role="alert" className="msg-error mb-3">
          No se pudieron cargar {failed.length} imágenes del trabajo. Comprueba que los archivos
          locales siguen disponibles antes de exportar.
        </p>
      )}
      {previews.failed && (
        <p role="alert" className="msg-error mb-3">
          No se pudo mostrar el color del diseño. Vuelve a abrir el trabajo para reintentar.
        </p>
      )}
      {sheets.length === 0 ? (
        <div className="stage-empty flex flex-col">
          <p className="help mb-3">
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
            className="border border-dashed border-muted bg-paper-3"
          />
        </div>
      ) : (
        <div className="stage-sheets flex flex-wrap items-start gap-10">
          {sheets.map((sheet, index) => {
            const scale = sheetPreviewScale(sheet.widthCm, sheet.heightCm)
            return (
              <figure key={sheet.id} aria-label={`Plancha ${index + 1}`}>
                <figcaption className="mb-2 flex flex-wrap items-baseline gap-x-4 text-sm tabular-nums">
                  <span className="font-semibold">Plancha {index + 1}</span>
                  <span className="text-ink-2">
                    {sheet.widthCm} × {sheet.heightCm} cm
                  </span>{' '}
                  <span className="text-ink-2">
                    {sheet.placements.length} {sheet.placements.length === 1 ? 'copia' : 'copias'}
                  </span>
                </figcaption>
                <Stage width={sheet.widthCm * scale} height={sheet.heightCm * scale}>
                  <Layer listening={false}>
                    <Rect
                      width={sheet.widthCm * scale}
                      height={sheet.heightCm * scale}
                      fill={tokenColor('--color-board')}
                    />
                    {sheet.placements.map((placement, i) => {
                      const design = byId.get(placement.designId)
                      if (!design) return null
                      const image = previews.byDesign.get(design.id)
                      const sourceSize = image ? getPreviewSourceSize(image) : null
                      const fitted = getFittedVisibleSizeCm(
                        {
                          widthCm: placement.rotated ? placement.heightCm : placement.widthCm,
                          heightCm: placement.rotated ? placement.widthCm : placement.heightCm,
                        },
                        design.originalAspectRatio,
                      )
                      const bounds = design.visibleBounds
                      return (
                        <Group key={i} x={placement.xCm * scale} y={placement.yCm * scale}>
                          <Rect
                            width={placement.widthCm * scale}
                            height={placement.heightCm * scale}
                            stroke={tokenColor(image ? '--color-board-edge' : '--color-error')}
                            strokeWidth={0.5}
                          />
                          {image && sourceSize && (
                            <Group
                              x={placement.rotated ? placement.widthCm * scale : 0}
                              rotation={placement.rotated ? 90 : 0}
                            >
                              <KonvaImage
                                image={image}
                                x={0}
                                y={0}
                                width={fitted.widthCm * scale}
                                height={fitted.heightCm * scale}
                                crop={getPreviewCrop(
                                  bounds,
                                  getPreviewSourceSize(images[design.imagePath] ?? image),
                                  sourceSize,
                                )}
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
