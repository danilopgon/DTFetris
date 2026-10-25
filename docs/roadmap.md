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
| G. Color hexadecimal | Verificado, incluidos builds Windows actualizados | C, D, E | Un color `#RRGGBB` por diseño PNG/SVG; alpha/original intactos; preview/export iguales; quitar, duplicar y persistir; compatibilidad con JSON anteriores. |
| H. Agente externo e ingesta | Verificado con Rust y proceso stdio real; pendiente activación en el cliente elegido | B, D, E, G | Servidor MCP stdio local, ingesta acotada, herramientas sobre el motor real, medidas explícitas, guardado revisable y exportación solo explícita; pruebas de protocolo/rutas/archivos. |
| I. Validación de encargo real | Candidatos generados; pendiente comparación/aprobación del usuario | G, H | Reservar bbox visible ajustado, separación configurable (3 mm elegidos), SVG con declaración estándar segura, preprocesamiento externo de SVG compuesto, 44 piezas verificadas y comparación local con referencia. |

### Evidencia inicial

- `npm run test`: 79 tests en 5 archivos, correctos.
- `cargo test`: 22 tests correctos (incluyen tests del placeholder, no acreditan packing real).
- `npm run lint` y `npm run build:frontend`: correctos.
- `npm run build`: superó frontend y comenzó compilación Rust; límite de 120 s, resultado completo no verificado.
- `npm run test:e2e`: falla por `Protocol "tauri:" not supported`. Playwright no controla WebView2 mediante esa URL; requiere runner web con mocks explícitos o pruebas de escritorio separadas.

### Hallazgos iniciales conservados (resueltos durante esta entrega)

- Importación PNG/SVG real con copia privada por UUID y límites alpha `>= 3/255`; errores recuperables. Edición, duplicado por ruta compartida y borrado confirmado cubiertos por tests.
- Los comandos de packing, exportación y persistencia eran placeholders que devolvían éxito sin producir resultados; el preview solo dibujaba rectángulos. Se han sustituido por implementaciones reales con tests.
- La primera entrega reservaba toda la celda solicitada. Un encargo real posterior corrigió esta interpretación: las medidas son máximos; el footprint debe ser el tamaño visible ajustado más la separación, sin estirar ni reservar el sobrante. Esta regla actual prevalece.
- Se centralizó validación de edición/importación y recursos; se rechazaron decimales en Rust y se corrigió invalidación de plancha/importación. La revisión final descubrió también truncamiento por `parseFloat('1e2')`; ahora se convierte la entrada completa y hay test de regresión.
- El stack instalado ya es Vite 6 (los textos decían Vite 5). Mantener stack, sin migraciones innecesarias.
- Riesgos: memoria de RGBA a 300 DPI, rutas desaparecidas, límites de SVG, paridad JSON y resultados asíncronos obsoletos. Ver `roadmap-risks.md`.
- Las únicas skills locales son orientación React/composición; se conservan porque no pertenecen exclusivamente al proceso retirado. No se modifican skills globales del usuario.

## Evidencia del MVP base (2026-10-25)

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

## Ampliación del alcance (G/H)

- Color: 129 tests frontend, 72 Rust de biblioteca y 4 E2E web correctos; incluye PNG/SVG coloreados con alpha intacto y compatibilidad JSON anterior. Lint/build frontend correctos.
- MCP: 12 tests adicionales (84 Rust en total) cubren protocolo, límites, rutas y archivos PNG/SVG reales. `npm run build:mcp` genera el servidor release; `npm run test:mcp` pasa contra ese EXE mediante pipes reales: inicialización, descubrimiento de 12 herramientas, estado, listado y ping, sin logs en stdout ni ventanas.
- El servidor está listo, pero no se declara conectado a un cliente/modelo externo todavía. No se modifica automáticamente la configuración del usuario. Guía de activación en [agent-integration.md](./agent-integration.md).

### Resultado integrado del encargo real

- La prueba descubrió dos defectos que los fixtures iniciales no detectaban: reservar la celda completa y rechazar declaraciones externas SVG 1.1 inertes. Ambos corregidos con regresiones; las entidades/subconjuntos DTD y lecturas externas siguen bloqueados.
- Packing físico de bbox visible fraccionario y separación de 3 mm, con precisión conservadora de 1 micrómetro. UI y MCP comparten la regla; máximos solicitados se conservan.
- **145 tests frontend, 95 Rust y 5 E2E Chromium**, más smoke del EXE MCP release, lint y builds Windows actualizados.
- Se ejecutó un encargo privado de 8 diseños/44 copias mediante MCP release, con separación de 3 mm, dos colores pedidos, save/load/repacking y PNG real. Originales verificados por SHA-256 sin cambios. Los SVG compuestos se dividieron vectorialmente fuera de la app.
- Se entregó control 60 × 100 y candidato **60 × 86 cm**, manteniendo el mismo tamaño visible de cada pieza: **14% menos superficie de plancha** frente a la referencia. Es la menor altura entera encontrada entre 80 y 100 por el barrido de esta heurística, no un óptimo global demostrado.
- Lectura independiente del candidato: **7087 × 10157 px**, 299.9994 DPI por cuantización de `pHYs`, alpha/transparencia y colores opacos RGB exactos; 44 bboxes localizados. Desvío máximo de bbox rasterizado respecto al plan: 0.272 mm (umbral alpha 3/255 y redondeo/rasterización de fuente).
- Los resultados, comparativa visual/HTML, JSON y trazas se guardan solo localmente fuera del repositorio. No se publica artwork ni información identificable del encargo privado en Git.
- **Pendiente**: aprobación visual del usuario e impresión física/RIP. No se etiqueta el candidato como aprobado.

## Siguiente paso exacto

Comprobar el flujo nativo con un diseño real según [manual-dtf-check.md](./manual-dtf-check.md), especialmente selector, carga del arte local en WebView2, guardado y exportación desde los diálogos. Después validar impresión física/RIP al 100%. No hay un bloqueo conocido del motor de composición, pero no confundir pruebas de Chromium con esta comprobación.

Prioridad inmediata: que el usuario compare y apruebe o corrija el candidato local del encargo real antes de darlo por bueno.

Continuación breve: «Lee AGENTS.md y docs/roadmap.md. Conserva la evidencia del MVP base y verifica los incrementos G/H (color y MCP/ingesta). No reintroduzcas un proceso pesado. Para pruebas nativas usa solo fixtures propios y herramientas autorizadas, sin tocar trabajos reales».
