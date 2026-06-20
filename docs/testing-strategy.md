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
- Transparencia: el padding transparente no cuenta como área ocupada y las dimensiones configuradas aplican al arte visible.
- Repacking: el resultado es consistente ante modificaciones.
- Serialización: los structs se serializan y deserializan correctamente con `serde`.
- Paridad JSON Rust/TypeScript: los contratos Tauri usan claves `camelCase` mediante `#[serde(rename_all = "camelCase")]` y tests de round-trip con `serde_json`.
- Validación defensiva de packing: dimensiones en centímetros enteros positivos y al menos un diseño con `quantity > 0` antes de ejecutar packing.
- Validación de aspect ratio: detección de deformación usando los límites visibles detectados en PNG y SVG rasterizado.

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
- Validación editable vs generación: `quantity: 0` se rechaza en edición; ocultar/excluir deberá ser un control explícito futuro.
- Ajuste proporcional: `getFittedVisibleSizeCm` conserva la celda solicitada y deriva un tamaño visible interno sin deformar.
- Estado Zustand: plancha inicial de 55 cm x 100 cm y sincronización de configuración personalizada.
- Conversion cm a px para distintos DPI.
- Cálculo de aspect ratio original.
- Detección de límites visibles en diseños con transparencia.
- Detección de deformación por diferencia entre aspect ratio original y configurado.
- Lógica de estado Zustand: añadir, editar, eliminar y duplicar diseños; mutaciones válidas limpian planchas, marcan layout pendiente y no invocan `run_packing` placeholder.
- Generación de IDs únicos.

## Tests de integración Tauri commands

Verifican que los comandos expuestos al frontend funcionan correctamente end-to-end dentro del proceso Tauri, incluyendo serialización y manejo de errores.

Cobertura mínima:

- `run_packing`: recibe `PackingRequest`, valida el contrato de dominio y devuelve `PackingResult` con `sheets` y `unplacedItems`.
- `export_png`: genera el archivo en la ruta especificada.
- `export_png`: respeta que el arte visible, no el canvas transparente, ocupe las dimensiones físicas configuradas.
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

- Formulario de diseño: validaciones en español, edición de celda solicitada, cantidad mínima `1` y rotación.
- Lista de diseños: renderizado, duplicado, confirmación/cancelación de eliminación y estado de recálculo pendiente.
- Panel de métricas: valores por plancha y globales.
- Preview de planchas: renderizado correcto del número de hojas.
- Flujo de importación (`DesignList`): botón visible, inputs de cm positivos, estado de carga durante import, mapeo de códigos de error a mensajes en español, cancelación de diálogo sin efecto.

El archivo de test es `src/components/DesignList/DesignList.test.tsx`. Usa React Testing Library con `@testing-library/user-event`. Los mocks cubren `@tauri-apps/plugin-dialog` (función `open`) y `../../store/useAppStore` (selector-aware mock con `importDesign`, `updateDesign`, `duplicateDesign` y `removeDesign` como `vi.fn()`). La función `mapImportErrorToMessage` se extrae como función pura y se testea sin mocks.

## E2E + visual regression

Playwright se conecta a la ventana Tauri mediante WebDriver. Los escenarios cubren flujos completos de usuario.

Los tests E2E de importación (E2E-001, E2E-002) están diferidos al roadmap posterior a `v0-1-design-import`. El flujo de importación se valida con RTL a nivel de componente y con `cargo test` a nivel de Rust. No son un bloqueador del runner actual.

| ID | Escenario |
|---|---|
| E2E-001 | Importación de un diseño PNG. (diferido — roadmap posterior) |
| E2E-002 | Importación de un diseño SVG y verificación de aspect ratio desde límites visibles. (diferido) |
| E2E-003 | Packing básico con un único diseño. |
| E2E-004 | Packing multipágina. |
| E2E-005 | Modificación de cantidad y repacking automático. |
| E2E-006 | Rotación activada/desactivada y resultado en plancha. |
| E2E-007 | Exportación PNG con inputs mixtos PNG + SVG. |
| E2E-008 | Guardado y recuperación de trabajo. |
| E2E-009 | Advertencia de deformación de aspecto. |
| E2E-010 | Diseño con padding transparente se imprime con el arte visible al tamaño configurado. |

Visual regression es obligatoria mediante snapshots de Playwright.

Objetivos:

- Detectar desplazamientos en la preview de planchas.
- Detectar cambios inesperados en el layout.
- Validar que el repacking no produce renders rotos.

Cualquier cambio visual deliberado requerirá actualización explícita de snapshots.
