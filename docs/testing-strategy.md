# Estrategia de Testing

La estrategia cubre todas las capas de la pirámide. El testing de packing y dominio arranca en v0.1, no se pospone.

## Cobertura por capa

| Capa | Herramienta | Propósito |
|---|---|---|
| Unit Rust | `cargo test`, `#[cfg(test)]` | Dominio, packing, serialización y métricas. |
| Unit TypeScript | Vitest | Unidades, aspect ratio y lógica de estado. |
| Integración Tauri commands | `tauri::test` | Invocación end-to-end dentro del proceso Tauri. |
| Componentes React | React Testing Library | Formularios, listas, métricas y preview. |
| E2E + visual regression | Playwright + WebDriver | Flujos completos y estabilidad visual. |

## Unit tests Rust

Cobertura mínima:

- Algoritmo MaxRects: ausencia de solapamientos y respeto de límites.
- Rotación: los diseños rotan correctamente cuando `can_rotate = true`.
- Multipágina: se generan nuevas hojas cuando la plancha se llena.
- Cálculo de áreas: métricas por plancha y globales.
- Repacking: el resultado es consistente ante modificaciones.
- Serialización: los structs se serializan y deserializan correctamente con `serde`.
- Validación de aspect ratio: detección de deformación en PNG con `naturalWidth / naturalHeight` y SVG con `viewBox`.

Ejemplos de casos:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn no_overlaps_after_packing() { ... }

    #[test]
    fn no_design_exceeds_sheet_bounds() { ... }

    #[test]
    fn correct_quantity_placed() { ... }

    #[test]
    fn new_sheet_created_when_full() { ... }

    #[test]
    fn rotation_respects_can_rotate_flag() { ... }
}
```

## Unit tests TypeScript

Cobertura mínima:

- Contratos de dominio: centímetros enteros positivos, rechazo de decimales/cero/negativos y códigos técnicos estables.
- Validación editable vs generación: `quantity: 0` es válido en edición, pero packing requiere al menos un diseño con `quantity > 0`.
- Estado Zustand: plancha inicial de 55 cm x 100 cm y sincronización de configuración personalizada.
- Conversion cm a px para distintos DPI.
- Cálculo de aspect ratio original.
- Detección de deformación por diferencia entre aspect ratio original y configurado.
- Lógica de estado Zustand: añadir, editar, eliminar y duplicar diseños.
- Generación de IDs únicos.

## Tests de integración Tauri commands

Verifican que los comandos expuestos al frontend funcionan correctamente end-to-end dentro del proceso Tauri, incluyendo serialización y manejo de errores.

Cobertura mínima:

- `run_packing`: recibe diseños válidos y devuelve planchas correctas.
- `export_png`: genera el archivo en la ruta especificada.
- `save_job` y `load_job`: el estado guardado se recupera íntegro.
- Manejo de errores: rutas inválidas, diseños mal formados y permisos de escritura.

```rust
#[cfg(test)]
mod integration {
    use tauri::test::{mock_builder, MockRuntime};

    #[test]
    fn run_packing_returns_valid_sheets() {
        let app = mock_builder().build().unwrap();
        // invocar comando y verificar resultado
    }
}
```

## Component tests React

Cobertura mínima:

- Formulario de diseño: validaciones, edición y feedback de deformación.
- Lista de diseños: renderizado, duplicado y eliminación.
- Panel de métricas: valores por plancha y globales.
- Preview de planchas: renderizado correcto del número de hojas.

## E2E + visual regression

Playwright se conecta a la ventana Tauri mediante WebDriver. Los escenarios cubren flujos completos de usuario.

| ID | Escenario |
|---|---|
| E2E-001 | Carga de un diseño PNG. |
| E2E-002 | Carga de un diseño SVG y verificación de aspect ratio desde viewBox. |
| E2E-003 | Packing básico con un único diseño. |
| E2E-004 | Packing multipágina. |
| E2E-005 | Modificación de cantidad y repacking automático. |
| E2E-006 | Rotación activada/desactivada y resultado en plancha. |
| E2E-007 | Exportación PNG con inputs mixtos PNG + SVG. |
| E2E-008 | Guardado y recuperación de trabajo. |
| E2E-009 | Advertencia de deformación de aspecto. |

Visual regression es obligatoria mediante snapshots de Playwright.

Objetivos:

- Detectar desplazamientos en la preview de planchas.
- Detectar cambios inesperados en el layout.
- Validar que el repacking no produce renders rotos.

Cualquier cambio visual deliberado requerirá actualización explícita de snapshots.
