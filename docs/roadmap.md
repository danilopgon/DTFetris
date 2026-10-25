# Roadmap del MVP

## Flujo de trabajo

Requisitos en `docs/` → incremento funcional → tests y revisión → commit → actualizar esta tabla. El código y los tests ejecutados son la evidencia, no una marca histórica. No hay artefactos de proceso adicionales obligatorios.

## Estado auditado (2026-10-25)

Base: `origin/main` (`37ef775`), árbol limpio; rama `feat/autonomous-mvp`.

| Incremento | Estado | Dependencias | Criterios de aceptación |
|---|---|---|---|
| A1. Simplificar proceso | Completado | Inspección inicial | Requisitos útiles conservados en docs; retirar herramientas/archivos exclusivos del proceso anterior; commit independiente. |
| A2. Base y tamaño inicial | Verificado | A1 | 60 × 100 cm configurable; redondeo a píxel más cercano probado; invalidación coherente. |
| B. Packing | Verificado | A2 | MaxRects Rust determinista, cantidades, multipágina, rotación opcional, imposibles explícitos, sin solapamiento ni desbordes. |
| C. Flujo UI | Verificado en componentes y Chromium con IPC simulado | B | Generar desde UI; todas las planchas con arte visible proporcional; métricas visibles/globales; carga, errores y layout pendiente. |
| D. Exportación | Verificado con archivos reales | B, C | PNG real Rust 300 DPI, transparencia y SVG; todas las planchas; dimensiones, posición y memoria verificadas. |
| E. Persistencia | Verificado con archivos e IPC reales | A2, C | JSON local versionado; guardar/abrir; archivos ausentes o corruptos sin pérdida del trabajo actual; reexportación verificada. |
| F. Estabilización | Automatización y build completos; comprobación nativa manual pendiente | B–E | Tests críticos, lint, builds y E2E disponibles; limitaciones y comprobación manual documentadas; PR final sin merge automático. |

### Evidencia inicial

- `npm run test`: 79 tests en 5 archivos, correctos.
- `cargo test`: 22 tests correctos (incluyen tests del placeholder, no acreditan packing real).
- `npm run lint` y `npm run build:frontend`: correctos.
- `npm run build`: superó frontend y comenzó compilación Rust; límite de 120 s, resultado completo no verificado.
- `npm run test:e2e`: falla por `Protocol "tauri:" not supported`. Playwright no controla WebView2 mediante esa URL; requiere runner web con mocks explícitos o pruebas de escritorio separadas.

### Hallazgos iniciales conservados (resueltos durante esta entrega)

- Importación PNG/SVG real con copia privada por UUID y límites alpha `>= 3/255`; errores recuperables. Edición, duplicado por ruta compartida y borrado confirmado cubiertos por tests.
- Los comandos de packing, exportación y persistencia eran placeholders que devolvían éxito sin producir resultados; el preview solo dibujaba rectángulos. Se han sustituido por implementaciones reales con tests.
- Celda solicitada en cm enteros = footprint de packing. Arte visible recortado y ajustado proporcionalmente dentro; no reducir footprint por padding ni estirar arte. Esta aclaración posterior prevalece sobre textos antiguos que equiparaban celda con tamaño visible.
- Se centralizó validación de edición/importación y recursos; se rechazaron decimales en Rust y se corrigió invalidación de plancha/importación. La revisión final descubrió también truncamiento por `parseFloat('1e2')`; ahora se convierte la entrada completa y hay test de regresión.
- El stack instalado ya es Vite 6 (los textos decían Vite 5). Mantener stack, sin migraciones innecesarias.
- Riesgos: memoria de RGBA a 300 DPI, rutas desaparecidas, límites de SVG, paridad JSON y resultados asíncronos obsoletos. Ver `roadmap-risks.md`.
- Las únicas skills locales son orientación React/composición; se conservan porque no pertenecen exclusivamente al proceso retirado. No se modifican skills globales del usuario.

## Evidencia final (2026-10-25)

- `pnpm install --frozen-lockfile`: correcto; Vite 6.4.3 según lockfile.
- `npm run test`: **103 tests, 8 archivos**, correctos.
- `cargo test`: **63 tests**, correctos; incluye 2 pruebas de handlers IPC Tauri reales con runtime simulado, PNG/SVG reales y guardar → recuperar → reexportar idéntico.
- `npm run lint`, `cargo fmt --check`, `git diff --check`: correctos.
- `npm run build:frontend`: correcto, también ejecutado por el build Tauri final.
- `npm run test:e2e`: **2 tests Chromium**, correctos, con IPC/diálogos simulados y snapshot Windows revisado; no acreditan escritorio nativo.
- `npm run build`: correcto. Generados EXE, MSI y NSIS en `src-tauri/target/release/`. Advertencia preexistente: identificador terminado en `.app`, relevante para macOS (no bloquea Windows).
- Exportación real 60 × 100: cabecera **7087 × 11811 px**, alpha y lectura de filas, densidad **11811 px/m**; test no simulado.
- Revisión técnica independiente de fuentes: sin defectos bloqueantes nuevos; el error de notación exponencial detectado quedó corregido y probado.
- Se lanzó el EXE de producción y se detectó una ventana DTFetris. El intento de inspección nativa no proporcionó una observación fiable: **no** se declara verificado el flujo con diálogos/WebView2 reales. No se requiere ni se incorpora ninguna herramienta externa de automatización al proyecto.

## Siguiente paso exacto

Comprobar el flujo nativo con un diseño real según [manual-dtf-check.md](./manual-dtf-check.md), especialmente selector, carga del arte local en WebView2, guardado y exportación desde los diálogos. Después validar impresión física/RIP al 100%. No hay un bloqueo conocido del motor de composición, pero no confundir pruebas de Chromium con esta comprobación.

Continuación breve: «Lee AGENTS.md y docs/roadmap.md. El backend/IPC, 103 tests frontend, 63 Rust, 2 E2E web y build Windows pasan. Valida el flujo nativo de docs/manual-dtf-check.md sin abrir herramientas externas ni tocar datos reales; corrige solo defectos reproducidos. No reintroduzcas un proceso pesado».
