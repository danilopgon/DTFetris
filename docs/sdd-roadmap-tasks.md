# Roadmap implementable con SDD

Este documento divide el roadmap del MVP en cambios pequeños, ordenados y verificables para ejecutarlos uno a uno mediante SDD. Cada tarea debe tratarse como un cambio independiente: primero propuesta, luego specs, diseño, tareas, implementación, verificación y archivo.

## Cómo usar este roadmap

1. Elige la primera tarea pendiente de la tabla.
2. Inicia un cambio SDD con el identificador sugerido, por ejemplo `v0-1-project-shell`.
3. Durante la propuesta, confirma si el alcance sigue siendo correcto.
4. No se deben mezclar tareas salvo que SDD lo justifique explícitamente por dependencia técnica.
5. Al cerrar una tarea, actualiza el documento de requisitos afectado si cambió el comportamiento previsto.
6. Marca el estado en la tabla para que el agente o una persona pueda continuar desde el siguiente pendiente.

## Estados de seguimiento

| Estado | Significado |
|---|---|
| ✅ Completada | El cambio ya está implementado y verificado para el alcance definido. |
| 🚧 En curso | El cambio tiene trabajo iniciado, pero no está cerrado. |
| ⏳ Pendiente | El cambio todavía no se ha empezado. |
| ⛔ Bloqueada | El cambio necesita una decisión, dependencia o corrección previa. |

## Criterios para cortar tareas

- Una tarea debe entregar un incremento usable o verificable.
- Una tarea debe tener criterios de aceptación claros antes de implementarse.
- El dominio mantiene centímetros como fuente de verdad; píxeles solo para preview/exportación.
- Las dimensiones configuradas aplican al arte visible del diseño; el padding transparente no cuenta como superficie ocupada.
- El packing y la exportación pertenecen al backend Rust.
- La persistencia local usa archivos y rutas en `app_data_dir`, nunca `localStorage` ni `IndexedDB`.
- Los tests deben acompañar el cambio desde la primera versión implementable.

## Secuencia recomendada

| Orden | Estado | Cambio SDD sugerido | Versión | Objetivo | Requisitos principales | Verificación mínima |
|---:|---|---|---|---|---|---|
| 1 | ✅ Completada | `v0-1-project-shell` | v0.1 | Crear la base Tauri + Vite + React + TypeScript con estructura inicial. | Base técnica del roadmap. | `npm run build`, `cargo test` en `src-tauri` si aplica. |
| 2 | ✅ Completada | `v0-1-domain-model` | v0.1 | Definir modelos TS/Rust para plancha, diseño, unidades cm, cantidades y resultados de packing. | RF-002, RF-013. | Archivada en `openspec/changes/archive/2026-06-16-v0-1-domain-model/`. |
| 3 | ✅ Completada | `v0-1-design-import` | v0.1 | Cargar PNG/SVG, copiar archivos a `app_data_dir`, detectar límites visibles y guardar rutas en estado. | RF-001. | Archivada en `openspec/changes/archive/2026-06-16-v0-1-design-import/`. |
| 4 | ✅ Completada | `v0-1-basic-editing` | v0.1 | Permitir editar nombre, dimensiones solicitadas, cantidad, rotación permitida, duplicar y eliminar diseños. | RF-002, RF-003, RF-004, RF-005, RF-012. | Tests de store/componentes para mutaciones y layout pendiente sin packing placeholder. |
| 5 | ⏳ Pendiente | `v0-1-domain-composition-debt` | v0.1 | Atajar deuda técnica detectada en revisión de `v0-1-basic-editing`: bug de estado, duplicación de validación y deficiencias de arquitectura en dominio y componente. | Deuda interna, sin RF directo. | Tests existentes siguen pasando; `validateEditPatch` eliminado de vista; `isLayoutStale` se limpia al recibir sheets nuevos; `domain.ts` separado en módulos; `DesignList` descompuesto. |
| 6 | ⏳ Pendiente | `v0-1-single-sheet-packing` | v0.1 | Implementar packing básico MaxRects en Rust para una sola plancha usando el área visible como rectángulo ocupado. | RF-006, RF-013. | Unit tests Rust con casos simples, límites, piezas que no caben y transparencia. |
| 7 | ⏳ Pendiente | `v0-1-basic-preview` | v0.1 | Mostrar una plancha con React Konva convirtiendo cm a px solo para visualización. | RF-008. | Tests de conversión y smoke test de renderizado. |
| 8 | ⏳ Pendiente | `v0-2-multipage-packing` | v0.2 | Generar automáticamente múltiples planchas cuando la primera se llena. | RF-007, RF-006. | Unit tests Rust con overflow controlado y conteo esperado de planchas. |
| 9 | ⏳ Pendiente | `v0-2-rotation-support` | v0.2 | Soportar rotación opcional en packing respetando la configuración por diseño. | RF-002, RF-004, RF-006. | Tests con diseños que solo caben rotados y diseños con rotación bloqueada. |
| 10 | ⏳ Pendiente | `v0-2-sheet-metrics` | v0.2 | Calcular y mostrar métricas por plancha y globales. | RF-009. | Tests de área usada/libre y porcentaje de ocupación. |
| 11 | ⏳ Pendiente | `v0-2-aspect-ratio-validation` | v0.2 | Detectar proporción original PNG/SVG desde límites visibles y advertir deformaciones. | RF-014. | Tests para PNG, SVG rasterizado con límites visibles y confirmación explícita de deformación. |
| 12 | ⏳ Pendiente | `v0-2-tauri-integration-tests` | v0.2 | Cubrir comandos Tauri principales con tests de integración. | RF-001, RF-006, RF-012. | Tests de carga, packing y errores de commands. |
| 13 | ⏳ Pendiente | `v0-2-react-component-tests` | v0.2 | Agregar cobertura básica de componentes críticos con React Testing Library. | RF-002, RF-004, RF-008, RF-009. | Tests de edición, listado, métricas y estados vacíos. |
| 14 | ⏳ Pendiente | `v0-3-png-export` | v0.3 | Exportar planchas PNG a 300 DPI desde Rust con `image`, escalando el arte visible a las dimensiones configuradas. | RF-010. | Tests Rust de dimensiones exportadas, DPI esperado, composición básica y padding transparente. |
| 15 | ⏳ Pendiente | `v0-3-export-e2e` | v0.3 | Validar el flujo completo de exportación con Playwright + WebDriver. | RF-010. | E2E que carga diseño, genera plancha y verifica archivo exportado. |
| 16 | ⏳ Pendiente | `v0-4-local-persistence` | v0.4 | Guardar y cargar trabajos localmente como JSON con rutas a imágenes. | RF-011. | Tests de serialización, lectura/escritura y rutas inexistentes. |
| 17 | ⏳ Pendiente | `v0-4-save-load-e2e` | v0.4 | Validar guardado y recuperación desde la UI. | RF-011. | E2E que guarda, reinicia/recarga y recupera el trabajo. |
| 18 | ⏳ Pendiente | `v1-0-visual-regression` | v1.0 | Estabilizar snapshots visuales de preview y exportación. | RF-008, RF-010. | Snapshots Playwright deliberados y documentados. |
| 19 | ⏳ Pendiente | `v1-0-production-hardening` | v1.0 | Completar cobertura, errores, límites y preparación para uso productivo local. | Todo el MVP. | `npm run test`, `npm run test:e2e`, `npm run build`, `cargo test`. |

## Detalle por tarea

### 1. `v0-1-project-shell`

**Resultado esperado:** repositorio ejecutable con Tauri 2, Vite, React, TypeScript, Tailwind y comandos base.

**Incluye:** estructura inicial de frontend/backend, scripts mínimos y punto de entrada de la app.

**No incluye:** dominio final, packing, persistencia ni UI completa.

**Docs a revisar:** `architecture-and-stack.md`, `testing-strategy.md`.

### 2. `v0-1-domain-model`

**Resultado esperado:** contratos claros para dimensiones físicas, diseños, planchas y resultados de layout.

**Estado SDD:** completada y archivada en `openspec/changes/archive/2026-06-16-v0-1-domain-model/`.

**Incluye:** tipos compartidos equivalentes en TypeScript/Rust cuando aplique y helpers de conversión para preview/exportación.

**No incluye:** algoritmo de packing.

**Docs a revisar:** `domain-and-data-model.md`, `architecture-and-stack.md`.

### 3. `v0-1-design-import`

**Resultado esperado:** el usuario puede seleccionar PNG/SVG y la app conserva referencias persistibles por ruta.

**Estado SDD:** completada y archivada en `openspec/changes/archive/2026-06-16-v0-1-design-import/`.

**Incluye:** copia a `app_data_dir`, validación básica de formato/tamaño, detección de límites visibles y estado con rutas.

**No incluye:** validación completa de aspect ratio; queda para `v0-2-aspect-ratio-validation`.

**Docs a revisar:** `functional-requirements.md`, `architecture-and-stack.md`, `user-flows.md`.

### 4. `v0-1-basic-editing`

**Resultado esperado:** el usuario puede mantener una lista básica de diseños y cambiar sus parámetros.

**Incluye:** edición, eliminación confirmada, duplicado, cantidad mínima `1` y layout pendiente de recálculo sin llamar al placeholder de packing.

**Correcciones incluidas en esta PR (detectadas en revisión):**
- `setSheets` ahora limpia `isLayoutStale` al recibir sheets frescos, evitando que el banner de aviso persista con datos ya actualizados.
- `importDesign` setea `isLayoutStale: true` para ser consistente con el resto de mutaciones que modifican los diseños.

**No incluye:** métricas avanzadas, validación de deformación, ni refactors de arquitectura o composición (esos van en `v0-1-domain-composition-debt`).

**Docs a revisar:** `functional-requirements.md`, `user-flows.md`.

### 5. `v0-1-domain-composition-debt`

**Resultado esperado:** la base de código queda saneada antes de construir sobre ella el packing y el preview, sin que ningún test existente se rompa.

**Origen:** revisión de PR `v0-1-basic-editing` (#14). Los bugs de estado ya se corrigieron en esa PR; aquí quedan los problemas de arquitectura y composición.

1. **Validación duplicada en vista.** `validateEditPatch` en `DesignList.tsx` replica reglas que ya existen en `validateEditableDesignInput` del dominio. El store ya devuelve `{ ok: false, errors }` — la vista debe confiar en ese contrato y eliminar la validación local.

2. **`domain.ts` es un barrel, no un modelo.** El archivo mezcla primitivos/VOs, entidad `DesignInput`, tipos de import, tipos de packing y funciones de validación. Debe desglosarse en módulos alineados con Clean Architecture (p. ej. `domain/design.ts`, `domain/packing.ts`, `domain/sheet.ts`, `domain/validation.ts` o similar). Los tests de `domain.test.ts` se deben reorganizar en specs separados.

3. **`DesignList` tiene demasiadas responsabilidades.** Un solo componente gestiona 9 variables de estado y tres flujos distintos (importación, edición por ítem, confirmación de borrado). Aplicar container-presentational: extraer `DesignImportForm`, `DesignItem` (con sus submodos) y un `DesignList` contenedor fino.

**Incluye:** eliminación de `validateEditPatch` de la vista, separación de `domain.ts` en módulos, reorganización de tests de dominio, descomposición de `DesignList` en componentes cohesivos.

**No incluye:** correcciones de bugs (ya cerradas en `v0-1-basic-editing`), nuevas funcionalidades, cambios en la UI visible, ni cambios en la lógica de negocio.

**Docs a revisar:** `domain-and-data-model.md`, `architecture-and-stack.md`, `testing-strategy.md`.

### 6. `v0-1-single-sheet-packing`

**Resultado esperado:** el backend produce posiciones válidas en cm para una plancha.

**Incluye:** MaxRects básico, cantidades, uso del área visible como rectángulo ocupado y rechazo controlado de diseños imposibles.

**No incluye:** multipágina ni rotación.

**Docs a revisar:** `packing-and-export.md`, `domain-and-data-model.md`, `testing-strategy.md`.

### 7. `v0-1-basic-preview`

**Resultado esperado:** la UI muestra la plancha generada con proporciones correctas.

**Incluye:** conversión cm a px para Konva, escala visual y render de diseños posicionados.

**No incluye:** exportación, snapshots visuales estables ni multipágina completa.

**Docs a revisar:** `functional-requirements.md`, `user-flows.md`.

### 8. `v0-2-multipage-packing`

**Resultado esperado:** el packing continúa en nuevas planchas automáticamente.

**Incluye:** resultado multipágina, orden estable de planchas y manejo de overflow.

**No incluye:** exportación multipágina.

**Docs a revisar:** `packing-and-export.md`, `functional-requirements.md`.

### 9. `v0-2-rotation-support`

**Resultado esperado:** el algoritmo puede rotar piezas solo cuando el diseño lo permite.

**Incluye:** evaluación de orientación normal/rotada y preservación de dimensiones físicas.

**No incluye:** rotación manual en preview.

**Docs a revisar:** `packing-and-export.md`, `domain-and-data-model.md`.

### 10. `v0-2-sheet-metrics`

**Resultado esperado:** la UI informa aprovechamiento por plancha y global.

**Incluye:** área usada, área libre, porcentaje de ocupación y número de planchas.

**No incluye:** costos, precios ni métricas de negocio.

**Docs a revisar:** `functional-requirements.md`, `user-flows.md`.

### 11. `v0-2-aspect-ratio-validation`

**Resultado esperado:** la app evita deformaciones accidentales.

**Incluye:** extracción de proporción original desde límites visibles, advertencia, ajuste sugerido y confirmación explícita para deformar.

**No incluye:** edición avanzada de imagen.

**Docs a revisar:** `functional-requirements.md`, `domain-and-data-model.md`.

### 12. `v0-2-tauri-integration-tests`

**Resultado esperado:** los comandos críticos tienen cobertura de integración.

**Incluye:** carga, packing, errores esperados y contratos de respuesta.

**No incluye:** E2E de UI completa.

**Docs a revisar:** `architecture-and-stack.md`, `testing-strategy.md`.

### 13. `v0-2-react-component-tests`

**Resultado esperado:** los componentes principales tienen cobertura de comportamiento visible.

**Incluye:** edición, preview smoke test, métricas, estados vacíos y errores básicos.

**No incluye:** visual regression completa.

**Docs a revisar:** `testing-strategy.md`, `user-flows.md`.

### 14. `v0-3-png-export`

**Resultado esperado:** el backend genera PNG de impresión a 300 DPI.

**Incluye:** composición en Rust con `image`, conversión cm a px para exportación, escala del arte visible a las dimensiones configuradas y escritura de archivos.

**No incluye:** exportación desde Canvas ni formatos distintos a PNG.

**Docs a revisar:** `packing-and-export.md`, `architecture-and-stack.md`.

### 15. `v0-3-export-e2e`

**Resultado esperado:** hay una prueba end-to-end que demuestra el flujo de exportación.

**Incluye:** cargar diseño, generar plancha, exportar y verificar archivo resultante.

**No incluye:** validación visual exhaustiva de cada píxel.

**Docs a revisar:** `testing-strategy.md`, `user-flows.md`.

### 16. `v0-4-local-persistence`

**Resultado esperado:** los trabajos se guardan y recuperan desde disco.

**Incluye:** JSON con `serde_json`, `std::fs`, rutas absolutas a imágenes y errores recuperables.

**No incluye:** sincronización remota ni múltiples usuarios.

**Docs a revisar:** `architecture-and-stack.md`, `domain-and-data-model.md`, `functional-requirements.md`.

### 17. `v0-4-save-load-e2e`

**Resultado esperado:** el usuario puede cerrar/reabrir o recargar la app y recuperar su trabajo.

**Incluye:** flujo E2E de guardado, carga y consistencia visual básica.

**No incluye:** backups, versiones de archivo ni migraciones complejas.

**Docs a revisar:** `testing-strategy.md`, `user-flows.md`.

### 18. `v1-0-visual-regression`

**Resultado esperado:** los cambios visuales importantes quedan protegidos por snapshots estables.

**Incluye:** escenarios representativos de preview y exportación.

**No incluye:** aprobación automática de snapshots sin revisión humana.

**Docs a revisar:** `testing-strategy.md`, `roadmap-risks.md`.

### 19. `v1-0-production-hardening`

**Resultado esperado:** el MVP queda preparado para uso productivo local.

**Incluye:** cobertura final, mensajes de error, límites de tamaño, inputs grandes y limpieza de deuda crítica.

**No incluye:** funcionalidades fuera del alcance inicial como clientes, facturación, pedidos, impresoras o backend remoto.

**Docs a revisar:** todos los documentos de `docs/`.

## Plantilla para iniciar cada cambio SDD

```text
Cambio: <id-del-cambio>

Objetivo:
<copiar el objetivo de este documento>

Alcance incluido:
- <punto 1>
- <punto 2>

Fuera de alcance:
- <punto 1>

Criterios de aceptación:
- <criterio verificable 1>
- <criterio verificable 2>

Docs base:
- <doc 1>
- <doc 2>
```

## Dependencias principales

| Tarea | Depende de |
|---|---|
| `v0-1-domain-model` | `v0-1-project-shell` |
| `v0-1-design-import` | `v0-1-project-shell`, `v0-1-domain-model` |
| `v0-1-basic-editing` | `v0-1-domain-model`, `v0-1-design-import` |
| `v0-1-domain-composition-debt` | `v0-1-basic-editing` |
| `v0-1-single-sheet-packing` | `v0-1-domain-composition-debt` |
| `v0-1-basic-preview` | `v0-1-single-sheet-packing` |
| `v0-2-multipage-packing` | `v0-1-single-sheet-packing` |
| `v0-2-rotation-support` | `v0-1-single-sheet-packing` |
| `v0-2-sheet-metrics` | `v0-2-multipage-packing` |
| `v0-2-aspect-ratio-validation` | `v0-1-design-import`, `v0-1-basic-editing` |
| `v0-2-tauri-integration-tests` | Comandos base implementados |
| `v0-2-react-component-tests` | Componentes base implementados |
| `v0-3-png-export` | `v0-2-multipage-packing`, `v0-2-rotation-support` |
| `v0-3-export-e2e` | `v0-3-png-export` |
| `v0-4-local-persistence` | `v0-1-design-import`, `v0-1-domain-model` |
| `v0-4-save-load-e2e` | `v0-4-local-persistence` |
| `v1-0-visual-regression` | Preview y exportación estables |
| `v1-0-production-hardening` | Todas las tareas MVP anteriores |
