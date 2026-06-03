# Dominio y Modelo de Datos

El dominio trabaja en centímetros. Las conversiones a píxeles son detalles de preview y exportación, no parte del packing.

## Reglas de dominio

| Regla | Decisión |
|---|---|
| Unidad fuente de verdad | Centímetros en todo el dominio. |
| Dimensiones de plancha | Configurables por usuario, sin valores hardcodeados. |
| Aspect ratio | Se calcula al cargar la imagen y queda como campo explícito e inmutable. |
| Deformación | Nunca automática; requiere confirmación explícita. |
| Rutas de imagen | Se almacenan como rutas en disco dentro de `app_data_dir`, no como objetos `File`. |
| Duplicado | Comparte la misma ruta de imagen que el original. |

## Sistema de coordenadas

Todo el dominio trabaja exclusivamente en centímetros. Las dimensiones físicas son la fuente de verdad.

```text
Plancha:    { width_cm: 55.0, height_cm: 100.0 }
Diseno:     { width_cm: 27.0, height_cm: 30.0 }
Placement:  { x_cm: 0.0, y_cm: 30.0 }
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

## Modelo TypeScript

```typescript
type DesignInput = {
  id: string
  name: string
  imagePath: string
  widthCm: number
  heightCm: number
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
  widthCm: number
  heightCm: number
  placements: Placement[]
}
```

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
