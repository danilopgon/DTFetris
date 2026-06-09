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

La transparencia del archivo importado no cuenta como superficie ocupada de la plancha. Antes de generar preview, packing o exportación, el sistema debe considerar los límites del contenido visible del PNG/SVG como el área física del diseño.

Ejemplo crítico:

- Si el usuario configura un logo como 8 cm x 8 cm, el arte visible debe imprimirse a 8 cm x 8 cm.
- Si el archivo fuente tiene un canvas de 8 cm x 8 cm pero el contenido opaco ocupa visualmente 4 cm x 4 cm por padding transparente, ese padding no debe provocar que el logo visible se imprima a 4 cm x 4 cm dentro de un espacio de 8 cm x 8 cm.

Los márgenes, sangrados o separaciones deliberadas deben modelarse como parámetros explícitos del dominio cuando se necesiten. No deben esconderse dentro de píxeles transparentes del archivo fuente.

## Modelo TypeScript

```typescript
type Cm = number

type SheetConfig = {
  widthCm: Cm
  heightCm: Cm
}

type DesignInput = {
  id: string
  name: string
  imagePath: string
  widthCm: Cm
  heightCm: Cm
  originalAspectRatio: number
  quantity: number
  canRotate: boolean
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

Los códigos como `does_not_fit` son valores técnicos estables y neutrales. La UI debe mapearlos a textos en español cuando corresponda; no deben guardarse como copy de interfaz.

### Validación TypeScript

- `isPositiveIntegerCm` acepta solo centímetros enteros positivos.
- `validateEditableDesignInput` permite `quantity: 0` durante edición si el resto del diseño es válido.
- `validatePackingRequest` exige una plancha válida y al menos un diseño con `quantity > 0` antes de invocar packing.

## Modelo Rust

```rust
#[derive(Serialize, Deserialize)]
struct DesignInput {
    id: String,
    name: String,
    image_path: String,
    width_cm: f64,
    height_cm: f64,
    original_aspect_ratio: f64,
    quantity: u32,
    can_rotate: bool,
}

#[derive(Serialize, Deserialize)]
struct Placement {
    design_id: String,
    x_cm: f64,
    y_cm: f64,
    width_cm: f64,
    height_cm: f64,
    rotated: bool,
}

#[derive(Serialize, Deserialize)]
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
