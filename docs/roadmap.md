# Roadmap del MVP

## Flujo de trabajo

Requisitos en `docs/` → incremento funcional → tests y revisión → commit → actualizar esta tabla. El código y los tests ejecutados son la evidencia, no una marca histórica. No hay artefactos de proceso adicionales obligatorios.

## Estado auditado (2026-10-25)

Base: `origin/main` (`37ef775`), árbol limpio; rama `feat/autonomous-mvp`.

| Incremento | Estado | Dependencias | Criterios de aceptación |
|---|---|---|---|
| A1. Simplificar proceso | Completado | Inspección inicial | Requisitos útiles conservados en docs; retirar herramientas/archivos exclusivos del proceso anterior; commit independiente. |
| A2. Base y tamaño inicial | Pendiente | A1 | 60 × 100 cm configurable; redondeo a píxel más cercano probado; invalidación coherente. |
| B. Packing | Pendiente | A2 | MaxRects Rust determinista, cantidades, multipágina, rotación opcional, imposibles explícitos, sin solapamiento ni desbordes. |
| C. Flujo UI | Pendiente | B | Generar desde UI; todas las planchas con arte visible proporcional; métricas visibles/globales; carga, errores y layout pendiente. |
| D. Exportación | Pendiente | B, C | PNG real Rust 300 DPI, transparencia y SVG; todas las planchas; dimensiones, posición y memoria verificadas. |
| E. Persistencia | Pendiente | A2, C | JSON local versionado; guardar/abrir; archivos ausentes o corruptos sin pérdida del trabajo actual; reexportación verificada. |
| F. Estabilización | Pendiente | B–E | Tests críticos, lint, builds y E2E disponibles; limitaciones y comprobación manual documentadas; preparar PR final. |

### Evidencia inicial

- `npm run test`: 79 tests en 5 archivos, correctos.
- `cargo test`: 22 tests correctos (incluyen tests del placeholder, no acreditan packing real).
- `npm run lint` y `npm run build:frontend`: correctos.
- `npm run build`: superó frontend y comenzó compilación Rust; límite de 120 s, resultado completo no verificado.
- `npm run test:e2e`: falla por `Protocol "tauri:" not supported`. Playwright no controla WebView2 mediante esa URL; requiere runner web con mocks explícitos o pruebas de escritorio separadas.

### Hallazgos conservados y decisiones vigentes

- Importación PNG/SVG real con copia privada por UUID y límites alpha `>= 3/255`; errores recuperables. Edición, duplicado por ruta compartida y borrado confirmado cubiertos por tests.
- Los comandos de packing, exportación y persistencia son placeholders que devolvían éxito sin producir resultados; preview actual dibuja rectángulos, no arte. No son funciones terminadas.
- Celda solicitada en cm enteros = footprint de packing. Arte visible recortado y ajustado proporcionalmente dentro; no reducir footprint por padding ni estirar arte. Esta aclaración posterior prevalece sobre textos antiguos que equiparaban celda con tamaño visible.
- Validaciones duplicadas en `DesignList`; importación Rust aún acepta decimales; cambios de plancha/importación pueden dejar sheets anteriores. Priorizar estos defectos antes que separar módulos solo por estética.
- El stack instalado ya es Vite 6 (los textos decían Vite 5). Mantener stack, sin migraciones innecesarias.
- Riesgos: memoria de RGBA a 300 DPI, rutas desaparecidas, límites de SVG, paridad JSON y resultados asíncronos obsoletos. Ver `roadmap-risks.md`.
- Las únicas skills locales son orientación React/composición; se conservan porque no pertenecen exclusivamente al proceso retirado. No se modifican skills globales del usuario.

## Siguiente paso

Implementar A2 y B; conectar el flujo completo sin volver a introducir comandos que simulen éxito.
