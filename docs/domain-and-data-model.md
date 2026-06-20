# Dominio y Modelo de Datos

El dominio trabaja en centímetros. Las conversiones a píxeles son detalles de preview y exportación, no parte del packing.

## Reglas de dominio

| Regla | Decisión |
|---|---|
| Unidad fuente de verdad | Centímetros en todo el dominio. |
| Dimensiones de plancha | Configurables por usuario, sin valores hardcodeados. |
| Dimensiones físicas MVP | Plancha y celdas solicitadas de diseño usan centímetros enteros positivos; no se aceptan decimales, cero ni negativos. |
| Plancha inicial de la app | Trabajo nuevo inicia con 55 cm de ancho x 100 cm de alto; no es una invariante del dominio. |
| Cantidad editable | La cantidad de un diseño debe ser un entero `>= 1`; `0` no significa ocultar. |
| Cantidad para generar | Generación/packing requiere diseños válidos y al menos un diseño con `quantity > 0`. |
| Aspect ratio | Se calcula al cargar la imagen y queda como campo explícito e inmutable. |
| Transparencia en diseños | Los límites visibles definen la proporción del arte; la celda solicitada define el espacio ocupado. |
| Deformación | Nunca automática; requiere confirmación explícita. |
| Ajuste proporcional | Si la celda solicitada y el arte visible tienen distinta proporción, el tamaño visible se deriva proporcionalmente dentro de la celda y no reemplaza las dimensiones solicitadas. |
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

La transparencia del archivo importado no debe deformar el arte ni cambiar su proporción visible. El sistema considera los límites del contenido visible del PNG/SVG como metadatos para derivar proporción y recorte.

El área visible se define operativamente así:

- Un píxel es visible si su alpha normalizado es `>= 0.01`; en alpha de 8 bits equivale a `>= 3/255`.
- Para PNG y SVG se aplica el mismo umbral después de rasterizar. SVG se rasteriza con `resvg` antes de detectar límites visibles.
- El contorno visible es el bounding box alineado a ejes (AABB) de todos los píxeles que cumplen el umbral.
- Bordes semitransparentes, gradientes y sombras cuentan si su alpha cumple el umbral; por debajo del umbral se ignoran.
- Los límites se ajustan a píxeles enteros del raster. En el MVP, la expansión de margen visible o seguridad es `0 mm`; cualquier margen o sangrado futuro debe ser configuración explícita del dominio.

Ejemplo crítico:

- Si el usuario configura una celda de 8 cm x 8 cm, esa celda es el footprint solicitado.
- Si el arte visible no es cuadrado, se ajusta proporcionalmente dentro de esa celda sin estirarse; el tamaño visible derivado puede ocupar menos ancho o alto.
- Si el archivo fuente tiene padding transparente, ese padding no cambia la proporción del arte visible ni aumenta el tamaño visible derivado.

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
  widthCm: Cm            // celda solicitada por el usuario en cm enteros
  heightCm: Cm           // celda solicitada por el usuario en cm enteros
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

`DesignInput.widthCm` y `DesignInput.heightCm` son la celda solicitada por el usuario y el footprint ocupado en v0.1. No derivan del `viewBox` SVG ni de las dimensiones en píxeles del archivo fuente. `VisibleBounds` y `originalAspectRatio` permiten derivar el tamaño visible proporcional cuando preview, packing o exportación lo necesiten, pero ese valor derivado no se persiste sobre la intención del usuario.

### Validación TypeScript

- `isPositiveIntegerCm` acepta solo centímetros enteros positivos.
- `validateEditableDesignInput` exige nombre no vacío, dimensiones enteras positivas y `quantity >= 1`.
- `validatePackingRequest` exige una plancha válida y al menos un diseño con `quantity > 0` antes de invocar packing.
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
