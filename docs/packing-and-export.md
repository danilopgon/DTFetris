# Packing y exportación

Ambos motores son Rust. Centímetros son la fuente de verdad; no se hace packing en píxeles ni se exporta desde Canvas.

## Tamaños máximos frente a arte visible

Los anchos/altos solicitados son **límites máximos**, conservados en el diseño. El arte se ajusta proporcionalmente dentro, sin deformarse. Packing y placements usan el bbox visible resultante, no el área sobrante del rectángulo pedido.

Ejemplo: máximos 10 × 8 cm y arte 2:1 → arte/footprint 10 × 5 cm. Un rótulo muy ancho pedido en 9 × 8 cm puede ocupar 9 × menos de 1 cm. Reservar 8 cm de alto desperdiciaría material y no corresponde al encargo real validado.

Los límites visibles persistidos se detectan al importar con alpha `>= 3/255`. Padding transparente no define proporción ni tamaño impreso. Packing usa los metadatos, nunca abre/rasteriza archivos.

## MaxRects

Implementación propia Best Short Side Fit; evaluación en [packing-decision.md](./packing-decision.md). Orden/desempates canónicos garantizan el mismo resultado para entradas equivalentes, incluso reordenadas. Es una heurística, no un óptimo global garantizado.

- Multipágina automática, cantidades positivas, IDs únicos y rotación opcional de 90° por diseño.
- Peticiones inválidas/vacías se rechazan; imposibles en hoja vacía se conservan como `does_not_fit`, sin páginas vacías ni descartes silenciosos.
- Hasta 1000 copias y 5 millones de operaciones contabilizadas; `packing_limit_exceeded` no devuelve una composición parcial.
- Precisión física de punto fijo: **0.0001 cm = 1 micrómetro**. Se redondea hacia fuera el tamaño visible para no introducir solapamientos ni recortes por coma flotante. Rectángulos/coordenadas `u64`, áreas de ordenación `u128`; no hay DPI en este cálculo.
- `gapCm` configurable, finito y no negativo. UI muestra mm; nuevos trabajos usan **3 mm**, antiguos sin campo usan 0. La separación se redondea hacia fuera a la misma precisión.
- Para dejar separación entre bboxes se infla por derecha/abajo el rectángulo virtual de cada pieza y se amplía el bin virtual por esa cantidad. El arte final sigue dentro de la hoja física: no se exige margen exterior.

## Invalidación

Importar/añadir/editar/duplicar/eliminar diseños o cambiar plancha/separación limpia el layout. **Generar planchas** recalcula explícitamente; una respuesta obsoleta no sustituye entradas nuevas. Exportar se bloquea mientras haya layout pendiente o copias sin ubicar.

## Exportación PNG

```text
px = round(cm * 300 / 2.54)
60 × 100 cm → 7087 × 11811 px
pHYs = 11811 píxeles/metro ≈ 300 DPI
```

Se redondea al entero más cercano, mitades positivas hacia arriba. El preview conserva decimales independientes. La plancha inicial requiere **334818228 bytes RGBA**, unos 335 MB / 319 MiB, más temporales.

1. Validar IDs, cantidades completas, placements, rotación, dimensiones visibles ajustadas, límites y separación declarada.
2. Reinspeccionar fuentes y comparar geometría/bounds persistidos. Recursos tienen una política acotada compartida.
3. PNG: recortar padding, remuestrear en alpha premultiplicado para evitar halos de RGB invisible y volver a RGBA recto.
4. SVG: rasterizar directamente a la resolución final usando bounds normalizados; comprobar memoria de capas a esa escala y convertir alpha premultiplicado de tiny-skia a recto.
5. Si existe `colorOverride`, sustituir RGB después de remuestrear sin cambiar alpha ni fuente.
6. Aplicar rotación de 90° si corresponde y componer dentro del bbox visible colocado. Solo se centra la holgura micrométrica de redondeo, no el rectángulo máximo original.
7. Escribir PNG RGBA con densidad `pHYs`, una plancha por iteración.

Una hoja usa exactamente el nombre elegido; varias reciben `-001`, `-002`, etc. Creación exclusiva: un destino existente exige otro nombre. Ante fallo solo se eliminan outputs creados por esa invocación. Guardar un trabajo no exporta automáticamente.

## Recursos y límites

Fuentes: hasta 20 MiB, 32 millones de píxeles y 16384 por lado. Destino: hasta 100 millones de píxeles/32768 por lado. Se reserva el canvas de forma comprobada; no se garantiza ejecución sin RAM suficiente. SVG debe ser autocontenido con texto convertido a trazados: imágenes anidadas, scripts, HTML y patrones se rechazan, no se omiten silenciosamente. No se permite leer recursos externos.

La sobrescritura hexadecimal es RGB, no una conversión ICC ni tinta metálica. DTFetris no aplica espejo, base blanca ni calibración del RIP. El agente puede preparar SVG independientes a partir de un archivo con varios diseños fuera de la app; no se incorpora un editor/separador de SVG a DTFetris.
