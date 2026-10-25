# Packing y Exportación

El packing se ejecuta en Rust usando centímetros como unidad de dominio. La exportación también se ejecuta en Rust para evitar los límites de memoria de Canvas en imágenes grandes.

## Packing automático

### Estrategia

MaxRects / Best Short Side Fit, implementado en Rust. La evaluación de crate y sus motivos están en [packing-decision.md](./packing-decision.md). La implementación propia evita adaptar un algoritmo distinto y mantiene centímetros, rotación por ítem y no ubicados explícitos.

### Requisitos

- Evitar solapamientos.
- Respetar límites de la plancha.
- Usar la celda solicitada del diseño como rectángulo ocupado en v0.1; el tamaño visible proporcional es derivado y no reemplaza ese footprint salvo que una especificación futura lo cambie.
- Soportar rotación opcional por diseño.
- Crear nuevas planchas automáticamente cuando se agota el espacio.
- Priorizar el aprovechamiento de superficie.

### Transparencia

En v0.1, el rectángulo que entra a MaxRects representa la celda solicitada por el usuario en centímetros enteros. La caja completa del archivo PNG/SVG no debe usarse como fuente de proporción si incluye transparencia alrededor del arte.

Los límites visibles se detectan al importar y se persisten como metadatos. MaxRects solo reserva la celda solicitada; no vuelve a detectar el área visible ni abre archivos durante el packing.

Esto protege dos invariantes de negocio:

- La plancha final no deforma el arte por píxeles transparentes que no se imprimen.
- Las dimensiones pedidas por el cliente se conservan como celda ocupada; el arte visible se ajusta proporcionalmente dentro de esa celda.

Si una celda solicitada de 10 cm x 8 cm contiene arte visible con proporción 2:1, el footprint de packing sigue siendo 10 cm x 8 cm y el tamaño visible derivado es 10 cm x 5 cm.

## Recálculo e invalidación

Importar, añadir, editar, duplicar, eliminar diseños o modificar la plancha limpia el layout y los no ubicados. El usuario pulsa **Generar planchas** para recalcular: se evitan resultados obsoletos y recálculos costosos por cada pulsación. Solo se aplica una respuesta si diseños/configuración siguen siendo los mismos. No se permite exportar un layout pendiente o con copias sin ubicar.

## Determinismo y límites operativos

- Orden: área y lado mayor descendentes, ID ascendente; desempates por hueco sobrante, hoja, Y, X y preferencia sin rotación. IDs de hoja estables.
- Hasta 1000 copias totales y 5 millones de operaciones contabilizadas; superar el presupuesto devuelve `packing_limit_exceeded`, sin composición parcial. No es garantía de óptimo global.
- Cantidad positiva en todos los diseños, IDs únicos/no vacíos y dimensiones enteras positivas hasta `u32::MAX`. Peticiones vacías o inválidas se rechazan antes de expandir cantidades.
- Una copia imposible en una hoja vacía se devuelve como `does_not_fit`; nunca se descarta silenciosamente ni genera páginas vacías.

## Multipágina

Cuando una plancha se completa, el algoritmo debe crear una nueva plancha automáticamente y continuar el packing con los diseños restantes.

## Rotación

La rotación se respeta por diseño mediante `canRotate` en TypeScript y `can_rotate` en Rust.

- Si `canRotate = true`, el algoritmo puede rotar para mejorar ocupación.
- Si `canRotate = false`, el algoritmo debe preservar orientación.

## Exportación PNG

La composición final se realiza en Rust con `image` y salida PNG a 300 DPI.

```text
pixels = centimeters * (dpi / 2.54)
```

### Pipeline de exportación

1. Rust recibe las planchas, los metadatos de límites visibles persistidos y `outputPath` desde Tauri command.
2. Rust lee los archivos originales desde disco.
3. Rust aplica el recorte o transformación de píxeles fuente indicada por los límites visibles guardados, ignorando padding transparente y ajustando el arte visible proporcionalmente dentro de la celda solicitada.
4. Inputs PNG se recortan y remuestrean con alpha premultiplicado (evita halos de RGB invisible), luego se convierten a RGBA recto para composición con `image`.
5. Inputs SVG se rasterizan con `resvg`; la exportación usa la misma regla de umbral alpha y los límites visibles guardados desde importación.
6. `image` composita todos los bitmaps en la plancha final.
7. Rust escribe el PNG en disco.

La composición centra el arte dentro de la celda, conserva su proporción y aplica la rotación de 90° en sentido horario si corresponde. SVG usa los bounds normalizados persistidos para rasterizar directamente a la resolución final; se comprueban capas temporales a esa escala antes de renderizar. La política común rechaza SVG no autocontenidos o funciones que podrían omitirse silenciosamente (texto sin convertir a trazados, imágenes anidadas, scripts, HTML, patrones).

Una plancha usa exactamente el nombre elegido; varias añaden `-001.png`, `-002.png`, etc. Los destinos existentes provocan un error recuperable: no se sobrescriben. Un fallo elimina únicamente outputs creados por esa operación. El backend también rechaza composiciones incompletas aunque se invoque sin la UI.

Memoria: una plancha y un arte por iteración; límite de 100 millones de píxeles/32768 por lado para destino y política acotada compartida para fuentes. Se comprueba disponibilidad al reservar el canvas. Esto no es una garantía ante falta de RAM del sistema: el raster predeterminado requiere unos 335 MB y hay buffers temporales adicionales.

## Razón de no usar Canvas

Canvas del navegador puede quedar limitado por memoria con planchas grandes. Una plancha de 60 × 100 cm a 300 DPI produce 7087 × 11811 píxeles, aproximadamente 335 MB RGBA sin comprimir. Se redondea al píxel entero más cercano; `pHYs` declara 11811 píxeles por metro (300 DPI aproximados por cuantización).

Exportar en Rust da control directo sobre memoria, resolución y pipeline de composición.
