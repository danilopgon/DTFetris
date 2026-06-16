# Dominio y Modelo de Datos

El dominio trabaja en centímetros. Las conversiones a píxeles son detalles de preview y exportación, no parte del packing.

## Reglas de dominio

| Regla | Decisión |
|---|---|
| Unidad fuente de verdad | Centímetros en todo el dominio. |
| Dimensiones de plancha | Configurables por usuario, sin valores hardcodeados. |
| Dimensiones físicas MVP | Solo centímetros enteros positivos; no se aceptan decimales, cero ni negativos para generación/packing. |
| Plancha inicial de la app | Trabajo nuevo inicia con 55 cm de ancho x 100 cm de alto; no es una invariante del dominio. |
| Cantidad editable | Una cantidad de diseño puede ser `0` mientras se edita. |
| Cantidad para generar | Generación/packing requiere al menos un diseño con `quantity > 0`. |
| Aspect ratio | Se calcula al cargar la imagen y queda como campo explícito e inmutable. |
| Transparencia en diseños | Las dimensiones configuradas aplican al área visible del arte, no al canvas completo del archivo. |
| Deformación | Nunca automática; requiere confirmación explícita. |
| Rutas de imagen | Se almacenan como rutas en disco dentro de `app_data_dir`, no como objetos `File`. |
| Duplicado | Comparte la misma ruta de imagen que el original. |
| Ítems no ubicados | El resultado de packing conserva ítems no ubicados de forma explícita para multipágina futura. |

## Sistema de coordenadas

Todo el dominio trabaja exclusivamente en centímetros. Las dimensiones físicas son la fuente de verdad.

```text
Plancha:    { width_cm: 55, height_cm: 100 }
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
55 cm  -> 6,496 px
100 cm -> 11,811 px
```

## Transparencia y área visible

La transparencia del archivo importado no cuenta como superficie ocupada de la plancha. El sistema debe considerar los límites del contenido visible del PNG/SVG como el área física del diseño.

El área visible se define operativamente así:

- Un píxel es visible si su alpha normalizado es `>= 0.01`; en alpha de 8 bits equivale a `>= 3/255`.
- Para PNG y SVG se aplica el mismo umbral después de rasterizar. SVG se rasteriza con `resvg` antes de detectar límites visibles.
- El contorno visible es el bounding box alineado a ejes (AABB) de todos los píxeles que cumplen el umbral.
- Bordes semitransparentes, gradientes y sombras cuentan si su alpha cumple el umbral; por debajo del umbral se ignoran.
- Los límites se ajustan a píxeles enteros del raster. En el MVP, la expansión de margen visible o seguridad es `0 mm`; cualquier margen o sangrado futuro debe ser configuración explícita del dominio.

Ejemplo crítico:

- Si el usuario configura un logo como 8 cm x 8 cm, el arte visible debe imprimirse a 8 cm x 8 cm.
- Si el archivo fuente tiene un canvas de 8 cm x 8 cm pero el contenido opaco ocupa visualmente 4 cm x 4 cm por padding transparente, ese padding no debe provocar que el logo visible se imprima a 4 cm x 4 cm dentro de un espacio de 8 cm x 8 cm.

Los límites visibles se detectan durante `v0-1-design-import` y se persisten como metadatos del diseño. Preview, packing y exportación consumen esos metadatos; no deben depender de padding transparente oculto en el archivo fuente.

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
}

type DesignInput = {
  id: string
  name: string
  imagePath: string      // ruta en app_data_dir/design-assets/{uuid}.{ext}
  widthCm: Cm            // centímetros confirmados por el usuario
  heightCm: Cm           // centímetros confirmados por el usuario
  originalAspectRatio: number  // visibleWidthPx / visibleHeightPx del arte
  quantity: number
  canRotate: boolean
  format: ImageFormat           // 'png' | 'svg'
  visibleBounds: VisibleBounds  // límites del arte sin padding transparente
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

`DesignInput.widthCm` y `DesignInput.heightCm` son las dimensiones físicas confirmadas por el usuario. No derivan del `viewBox` SVG ni de las dimensiones en píxeles del archivo fuente. `VisibleBounds` se usa exclusivamente para metadatos de calidad de fuente, no como dimensiones físicas.

### Validación TypeScript

- `isPositiveIntegerCm` acepta solo centímetros enteros positivos.
- `validateEditableDesignInput` permite `quantity: 0` durante edición si el resto del diseño es válido.
- `validatePackingRequest` exige una plancha válida y al menos un diseño con `quantity > 0` antes de invocar packing.

## Modelo Rust

Los structs usan `#[serde(rename_all = "camelCase")]` para mantener paridad con el contrato JSON del frontend.

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ImageFormat { Png, Svg }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisibleBounds {
    x_px: u32,
    y_px: u32,
    width_px: u32,
    height_px: u32,
    source_width_px: u32,
    source_height_px: u32,
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
- `src-tauri/src/domain/packing.rs` reserva el espacio para la implementación de packing.
