# Dominio y Modelo de Datos

El dominio trabaja en centímetros. Las conversiones a píxeles son detalles de preview y exportación, no parte del packing.

## Reglas de dominio

| Regla | Decisión |
|---|---|
| Unidad fuente de verdad | Centímetros en todo el dominio. |
| Dimensiones de plancha | Configurables por usuario, sin valores hardcodeados. |
| Dimensiones físicas MVP | Plancha y celdas solicitadas de diseño usan centímetros enteros positivos; no se aceptan decimales, cero ni negativos. |
| Plancha inicial de la app | Trabajo nuevo inicia con 60 cm de ancho x 100 cm de alto; no es una invariante del dominio. |
| Cantidad editable | La cantidad de un diseño debe ser un entero `>= 1`; `0` no significa ocultar. |
| Cantidad para generar | Generación/packing requiere al menos un diseño y cantidad positiva en todos; máximo operativo 1000 copias totales. |
| Aspect ratio | Se calcula al cargar la imagen y queda como campo explícito e inmutable. |
| Transparencia en diseños | Los límites visibles definen la proporción; las medidas solicitadas son máximos y el footprint es el tamaño visible ajustado. |
| Deformación | Nunca automática; requiere confirmación explícita. |
| Ajuste proporcional | Si la celda solicitada y el arte visible tienen distinta proporción, el tamaño visible se deriva proporcionalmente dentro de la celda y no reemplaza las dimensiones solicitadas. |
| Rutas de imagen | Se almacenan como rutas en disco dentro de `app_data_dir`, no como objetos `File`. |
| Duplicado | Comparte la misma ruta de imagen que el original. |
| Ítems no ubicados | Las copias imposibles se conservan explícitamente; el overflow que sí cabe continúa en nuevas hojas. |

## Sistema de coordenadas

Todo el dominio trabaja exclusivamente en centímetros. Las dimensiones físicas son la fuente de verdad.

```text
Plancha:    { width_cm: 60, height_cm: 100 }
Diseno:     { width_cm: 27, height_cm: 30 }
Placement:  { x_cm: 0, y_cm: 30 }
```

### Motivación

- La impresión se define en medidas físicas.
- Evita errores de DPI durante el packing.
- Permite soportar cualquier resolución de salida sin modificar el dominio.

## Conversión a píxeles

La conversión a píxeles ocurre solo en:

- Renderizado de preview con React Konva en frontend.
- Exportación PNG con la crate `image` en Rust.

Nunca ocurre durante el packing.

```text
pixels = centimeters * (dpi / 2.54)
```

Para exportación, `dpi = 300`.

```text
60 cm  -> 7,087 px
100 cm -> 11,811 px
```

La exportación redondea al entero más cercano (`round`, mitades positivas hacia arriba). El preview conserva decimales para mantener la proporción exacta; no reutiliza los píxeles de exportación para hacer packing. La salida 60 × 100 cm requiere 7087 × 11811 × 4 = 334 818 228 bytes de RGBA (aprox. 335 MB / 319 MiB), antes de buffers temporales. El PNG declara 11811 píxeles/metro en `pHYs`, la representación entera más cercana a 300 DPI.

## Transparencia y área visible

La transparencia del archivo importado no debe deformar el arte ni cambiar su proporción visible. El sistema considera los límites del contenido visible del PNG/SVG como metadatos para derivar proporción y recorte.

El área visible se define operativamente así:

- Un píxel es visible si su alpha normalizado es `>= 0.01`; en alpha de 8 bits equivale a `>= 3/255`.
- Para PNG y SVG se aplica el mismo umbral después de rasterizar. SVG se rasteriza con `resvg` antes de detectar límites visibles.
- El contorno visible es el bounding box alineado a ejes (AABB) de todos los píxeles que cumplen el umbral.
- Bordes semitransparentes, gradientes y sombras cuentan si su alpha cumple el umbral; por debajo del umbral se ignoran.
- Los límites se ajustan a píxeles enteros del raster. No se expande el contorno visible (0 mm); esto es distinto de la separación entre piezas, configurable por `gapCm` y de 3 mm en nuevos trabajos. No hay sangrado automático.

Ejemplo crítico:

- Los 8 × 8 cm solicitados son **límites máximos**, no una celda que deba reservarse entera. Con arte 2:1 el footprint visible es 8 × 4 cm.
- Si el arte visible no es cuadrado, se ajusta proporcionalmente dentro de esa celda sin estirarse; el tamaño visible derivado puede ocupar menos ancho o alto.
- Si el archivo fuente tiene padding transparente, ese padding no cambia la proporción del arte visible ni aumenta el tamaño visible derivado.

Los límites visibles se detectan al importar y se persisten como metadatos. Preview, exportación y packing derivan el tamaño ajustado proporcional usando esos metadatos y los máximos solicitados. El packing no lee píxeles ni archivos.

## Modelo TypeScript

```typescript
type Cm = number

type ImageFormat = 'png' | 'svg'

type VisibleBounds = {
  xPx: number
  yPx: number
  widthPx: number
  heightPx: number
  sourceWidthPx: number
  sourceHeightPx: number
}

type ImportDesignRequest = {
  sourcePath: string
  widthCm: Cm
  heightCm: Cm
}

type ImportDesignErrorCode =
  | 'invalid_format'
  | 'invalid_dimensions'
  | 'file_not_found'
  | 'copy_failed'
  | 'empty_artwork'
  | 'metadata_failed'

type SheetConfig = {
  widthCm: Cm
  heightCm: Cm
  gapCm?: Cm
}

type DesignInput = {
  id: string
  name: string
  imagePath: string      // ruta en app_data_dir/design-assets/{uuid}.{ext}
  widthCm: Cm            // celda solicitada por el usuario en cm enteros
  heightCm: Cm           // celda solicitada por el usuario en cm enteros
  originalAspectRatio: number  // visibleWidthPx / visibleHeightPx del arte
  quantity: number
  canRotate: boolean
  format: ImageFormat           // 'png' | 'svg'
  visibleBounds: VisibleBounds  // límites del arte sin padding transparente
  colorOverride?: string | null
}

type Placement = {
  designId: string
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotated: boolean
}

type Sheet = {
  id: string
  widthCm: Cm
  heightCm: Cm
  placements: Placement[]
  gapCm?: Cm
}

type PackingRequest = {
  sheet: SheetConfig
  designs: DesignInput[]
}

type UnplacedReasonCode =
  | 'does_not_fit'
  | 'invalid_dimensions'
  | 'invalid_quantity'
  | 'sheet_too_small'

type UnplacedItem = {
  designId: string
  itemIndex: number
  reason: UnplacedReasonCode
}

type PackingResult = {
  sheets: Sheet[]
  unplacedItems: UnplacedItem[]
}
```

Los códigos técnicos como `does_not_fit` o `invalid_format` son valores estables y neutrales. La UI mapea estos códigos a mensajes en español; no se almacenan como copy de interfaz.

`DesignInput.imagePath` siempre apunta a una copia dentro de `app_data_dir/design-assets/`. La ruta original del usuario no se persiste. Importar el mismo archivo dos veces produce dos copias con UUIDs distintos.

`DesignInput.widthCm` y `DesignInput.heightCm` son los límites máximos solicitados, no el footprint ocupado. No derivan del `viewBox` SVG ni de los píxeles de la fuente. `VisibleBounds` y `originalAspectRatio` permiten derivar el tamaño visible proporcional, usado en placements/preview/exportación sin reemplazar los máximos guardados.

### Validación TypeScript

- `isPositiveIntegerCm` acepta solo centímetros enteros positivos.
- `validateEditableDesignInput` exige nombre no vacío, dimensiones enteras positivas y `quantity >= 1`.
- `validatePackingRequest` exige plancha válida, diseños válidos y al menos un diseño; todas las cantidades son positivas.
- `getFittedVisibleSizeCm` deriva el tamaño visible proporcional dentro de la celda solicitada sin modificar `DesignInput.widthCm` ni `DesignInput.heightCm`.

## Modelo Rust

Los structs usan `#[serde(rename_all = "camelCase")]` para mantener paridad con el contrato JSON del frontend.

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ImageFormat { Png, Svg }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisibleBounds {
    x_px: f64,
    y_px: f64,
    width_px: f64,
    height_px: f64,
    source_width_px: f64,
    source_height_px: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesignInput {
    id: String,
    name: String,
    image_path: String,      // app_data_dir/design-assets/{uuid}.{ext}
    width_cm: f64,           // centímetros confirmados por el usuario
    height_cm: f64,          // centímetros confirmados por el usuario
    original_aspect_ratio: f64,
    quantity: u32,
    can_rotate: bool,
    format: ImageFormat,
    visible_bounds: VisibleBounds,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Placement {
    design_id: String,
    x_cm: f64,
    y_cm: f64,
    width_cm: f64,
    height_cm: f64,
    rotated: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Sheet {
    id: String,
    width_cm: f64,
    height_cm: f64,
    placements: Vec<Placement>,
}
```

## Archivos actuales relacionados

- `src/types/domain.ts` define los tipos de dominio del frontend.
- `src-tauri/src/domain/design.rs` define los structs serializables del backend.
- `src-tauri/src/domain/packing.rs` implementa MaxRects determinista multipágina, cantidades y rotación por diseño.
- `src-tauri/src/domain/assets.rs` valida los recursos con una política compartida. Los números de `VisibleBounds` se serializan como números JSON y deben ser enteros dentro de los límites de la fuente. SVG de tamaño intrínseco fraccionario se normaliza a un raster de dimensiones `ceil` antes de medir bounds.

## Persistencia y límites operativos

- `Job { version: 1, sheetConfig, designs }`: se guardan entradas, no layouts derivados. Los nombres pueden repetirse; los IDs no. El duplicado comparte ruta.
- Assets: hasta 20 MiB, 32 millones de píxeles y 16384 píxeles por lado. PNG debe ser PNG real; SVG UTF-8 autocontenido, sin texto (convertir a trazados), imágenes anidadas/enlazadas, scripts, contenido HTML o patrones. Se limita también complejidad y memoria de capas/filtros SVG.
- Exportación: hasta 100 millones de píxeles y 32768 píxeles por lado de raster destino. Estos límites protegen recursos; no fijan medidas de plancha.
- Cambios de archivos se detectan por formato, geometría y límites visibles. No se mantiene hash: sustituir píxeles preservando exactamente los mismos bounds no se detecta como una edición.

## Separación y precisión física

- `SheetConfig.gapCm` y `Sheet.gapCm` son opcionales; ausentes significan 0 para trabajos anteriores. Los trabajos nuevos UI/MCP comienzan con **0.3 cm (3 mm)**, configurable. La interfaz muestra mm y persiste cm.
- La separación es finita, no negativa y hasta `u32::MAX` cm; admite fracciones.
- Packing usa punto fijo de **0.0001 cm (1 micrómetro)**, nunca píxeles. Redondea hacia fuera tamaño visible/separación para no recortarlos; los placements admiten cm fraccionarios. La holgura es inferior a 1 micrómetro por dimensión.
- Se infla por derecha/abajo el rectángulo de búsqueda y la hoja virtual. El arte queda dentro de la plancha física, sin exigir margen exterior.
- Exportación/preview colocan el arte dentro del bbox visible, con solo la holgura de redondeo; no lo centran en una celda vacía de los máximos originales.

## Color de impresión

`DesignInput.colorOverride` es opcional (`string | null` en TypeScript; `Option<String>` con default en Rust). Ausente/null significa colores originales. Un valor presente debe cumplir `^#[0-9a-fA-F]{6}$`. Se guarda como intención del usuario, sin mutar la imagen ni los límites visibles.

La sobrescritura sustituye R, G y B después del remuestreo y conserva todos los bytes alpha. Ni el packing ni las métricas cambian por el color. La eliminación de la sobrescritura no requiere reimportar el diseño. El modelo JSON sigue en versión 1: el campo opcional no rompe trabajos anteriores y Rust omite valores ausentes al serializar.
