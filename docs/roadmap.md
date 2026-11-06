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
| F. Estabilización | Automatización, build y prueba nativa del EXE (`npm run test:native`) completos | B–E | Tests críticos, lint, builds y E2E disponibles; limitaciones y comprobación manual documentadas; PR final sin merge automático. |
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

Actualización de relevo (2026-11-06): el usuario pidió más espacio para tijera y se generó el mismo encargo con **10 mm en 60 × 95 cm**, sin cambiar cantidades, tamaños ni colores. No se cambió el default global de 3 mm. Después autorizó automatizar el recorrido nativo; el intento de cargar la guía de Orca quedó interrumpido y **no produjo una validación nativa nueva**. Estado, artefactos locales y pasos de continuación en [handoff-mvp.md](handoff-mvp.md).

El flujo nativo ya está verificado (apartado siguiente). Siguientes pasos, por orden:

1. Aprobación visual del usuario del encargo de 10 mm (60 × 95 cm).
2. Prueba pequeña en RIP/impresora al 100% según [manual-dtf-check.md](./manual-dtf-check.md): tamaño medido, transparencia, color, espejo una sola vez y recorte. Revisar también si el RIP genera base blanca en el halo de alpha muy bajo (≤15/255) que deja el remuestreo junto a los bordes interiores.
3. Usar el incremento I (recorte por MCP) en el encargo del fin de semana y registrar lo observado.

### Prueba nativa del EXE (2026-11-06): superada

Se descartó Orca. `npm run test:native` (ver [testing-strategy.md](testing-strategy.md#prueba-nativa-del-exe)) maneja el EXE de producción por CDP sobre WebView2, habilitado solo en el proceso de la prueba, y los diálogos con Windows UI Automation. No cambia la build.

- EXE recompilado desde `dd123c4` con `npx tauri build --no-bundle` antes de probar (el anterior era 13 min más antiguo que ese commit).
- Observado: importación múltiple PNG+SVG desde el **selector real**; arte cargado en WebView2 (plata `#c0c0c0` y azul del SVG en la captura del canvas); 1 plancha de 20 × 20 cm con 5 copias y 10 mm; guardado y exportación desde los **diálogos reales**; cierre de la ventana y fin del proceso; reapertura, **Abrir trabajo** desde el diálogo, regeneración igual y segunda exportación.
- Verificación independiente: JSON correcto; PNG de 2362 × 2362 px con `pHYs` de 11811 px/m, transparencia y solo dos colores opacos exactos (el rojo original desaparece con el color); **las dos exportaciones son idénticas píxel a píxel**; sin errores de consola, página o red.
- En el PNG: 5 componentes con bbox de 945 × 472 px (logos 8 × 4 cm, 2 de ellos rotados) y 945 × 945 px (círculos 8 × 8 cm), sin contar el padding transparente. **Separación mínima medida: 118 px = 9,991 mm** con 10 mm configurados, por redondeo a píxeles (igual que en el encargo real).
- El remuestreo deja dentro del agujero del logo un halo de alpha ≤15/255, separado del aro. Es invisible a simple vista; se revisará en la prueba de RIP por si genera base blanca.
- Ejecutada en verde tres veces, la última con las comprobaciones de componentes y separación. `design-assets`: 26 archivos previos sin cambios de SHA-256; las 2 copias de cada ejecución se eliminaron.
- Hallazgo: las imágenes del protocolo de assets *taintean* el canvas. No afecta a la app, que colorea por composición sin leer píxeles, pero cualquier función futura que lea píxeles del preview fallaría en el EXE aunque pase en E2E.
- Primeros intentos fallidos documentados por honestidad: filtro UIA por `ControlType` (los controles del diálogo aparecen como `Pane`), nombres de diseño sin extensión y `getImageData` sobre el canvas tainted. Todos eran del driver, no de la app.
- Queda fuera: aprobación visual del encargo de 10 mm y prueba física en el RIP.

### Incremento I: recorte de logo desde PNG por MCP (implementado 2026-11-06; pendiente de uso real)

Decidido con el usuario el 2026-11-06. Sustituye la regla anterior de que separar diseños compuestos era solo preparación externa, **únicamente para PNG transparentes y únicamente en MCP**:

- Origen: PNG de la carpeta de ingesta con fondo transparente. Fondo opaco fuera de alcance.
- `detect_regions`: islas opacas separadas por alpha, fusionando las que estén a menos de una distancia configurable (por defecto ~2 mm a 300 DPI). Devuelve cajas en px y tamaño estimado en cm, y escribe en el workspace una miniatura NO-IMPRIMIR con las cajas numeradas.
- `import_design_region`: importa uno o varios índices combinados, o un rectángulo en px. El recorte se guarda como nueva copia privada; el original no se modifica.
- Escala: el recorte se importa como un PNG normal con medidas máximas en cm; no se deducen de los DPI del origen.
- Sin selector de regiones en la UI en este incremento. Implementar con TDD y actualizar `domain-and-data-model.md`, `agent-integration.md` y `testing-strategy.md`.

Evidencia:

- `domain::regions` (detección, agrupación, recorte, vista numerada con dígitos de mapa de bits, sin dependencias nuevas), `import_rgba_into` y herramientas MCP `detect_regions`/`import_design_region`. Validación de medidas y alta de diseños compartidas con `import_design`; umbral de visibilidad compartido (`VISIBLE_ALPHA`) y decodificación PNG con los mismos límites (`decode_png_rgba`).
- `cargo test`: **107 tests** (12 nuevos: 7 de regiones, 1 de importación en memoria, 4 de MCP, entre ellos una plancha real de 60 × 100 cm exportada y separada de nuevo). `cargo fmt` aplicado; clippy sin avisos nuevos salvo uno de estilo por indexado intencionado.
- Correcciones tras revisión: las fuentes de regiones usan los límites de exportación (antes una plancha completa se rechazaba) y el fondo opaco se detecta con el borde completo (antes bastaban las esquinas). Además, `detectionId` impide importar otro logo si cambian el archivo o `mergePx`.
- EXE de la app y servidor MCP recompilados desde este código. `npm run test:native` en verde (separación 9,991 mm), y `npm run test:mcp` con stdio real y **14 herramientas**.
- **Uso real validado (2026-11-06):** encargo de 4 diseños y 53 copias recortados de 3 planchas archivadas (55 × 100 cm, 300 DPI, ≈ 77 M px; detección en unos segundos) y de un SVG anterior. Plancha completa de 60 × 100 cm con la separación subida al máximo que cabe en una hoja (25 mm). Verificación independiente con el layout: 0 píxeles visibles fuera de las piezas, separación medida de 24,9 mm, tamaños con −0,6 %, +0,2 % y +1,7 % frente a lo impreso antes (la última se debe a los cm enteros). El usuario lo validó. Datos y artwork privados fuera del repositorio.
- Hallazgos del uso real (posibles mejoras, no bloquean):
  - con letras muy espaciadas hay que subir `mergePx` (60);
  - si los huecos internos de un logo superan la distancia al logo vecino, la agrupación por distancia no puede separarlos y hay que usar `rectPx` tras revisar un zoom;
  - los logos con contornos que se tocan forman una sola región gigante;
  - en la vista NO-IMPRIMIR los números tapan las regiones pequeñas.
- El flujo de encargo (interpretar pedido, recortar, tamaños con desviación, plancha completa, margen máximo, verificación y archivo) quedó como skill de usuario fuera del repo, con rutas privadas. El servidor está registrado en Claude Code con ingesta en el archivo de planchas del taller.

Prioridad inmediata: que el usuario compare y apruebe o corrija el encargo de 10 mm antes de darlo por bueno.

Continuación breve: «Lee AGENTS.md y docs/roadmap.md. Conserva la evidencia del MVP base y verifica los incrementos G/H (color y MCP/ingesta). No reintroduzcas un proceso pesado. Para pruebas nativas usa solo fixtures propios y herramientas autorizadas, sin tocar trabajos reales».
