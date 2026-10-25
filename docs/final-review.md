# Revisión final del MVP

## Resumen

- Proceso ligero basado en requisitos, roadmap, tests y commits; limpieza histórica separada.
- Plancha inicial configurable de 60 × 100 cm.
- Importación múltiple secuencial PNG/SVG, edición, cantidades, duplicado por ruta y eliminación confirmada.
- MaxRects Rust en cm, multipágina, rotación por diseño, límites y copias imposibles explícitas.
- Preview Konva con arte recortado/proporcional, todas las hojas y métricas de arte/celdas.
- Exportación real Rust PNG RGBA a 300 DPI con densidad `pHYs`, sin Canvas; salida multipágina y protección frente a sobrescritura.
- JSON versionado y reemplazo atómico, assets privados persistentes y validación de archivos al recuperar; reexportación idéntica probada.

## Decisiones

MaxRects propio pequeño frente a adaptar una crate que no satisface directamente algoritmo/rotación/no ubicados (ver [decisión](packing-decision.md)). Tras validar el caso real, las medidas son máximos y se reserva el bbox visible ajustado, con separación configurable, no la celda sobrante. Se recalcula explícitamente para no generar por cada pulsación. Se persisten entradas, no layouts potencialmente obsoletos. La validación de assets es compartida y rechaza SVG que podrían renderizarse incompletos. Los límites de recursos son operativos, no dimensiones físicas fijas.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | Correcto |
| `npm run test` | 103 tests / 8 archivos correctos |
| `cargo test` | 63 tests correctos; incluye IPC y reexportación de archivos reales |
| `npm run lint` | Correcto |
| `cargo fmt --check` | Correcto |
| `npm run build:frontend` | Correcto; también dentro del build de producción |
| `npm run test:e2e` | 2 tests correctos, IPC simulado; snapshot Windows revisado |
| `npm run build` | EXE, MSI y NSIS Windows generados |

Se corrigieron dos incidencias del runner Windows: manifiesto common-controls ausente en unit tests con Tauri y manifiesto duplicado en binarios. El build final y `cargo test` completo ya pasan. No hay métricas de cobertura porcentual configuradas.

El test de impresión escribe una hoja completa de **7087 × 11811 px**, verifica PNG RGBA, transparencia, posición y densidad **11811 px/m**. Otros tests cubren rotación, SVG, padding, alpha, faltantes, entradas inválidas, multipágina, límites de memoria y no sobrescritura. La prueba IPC importa copias privadas, elimina solo sus originales de fixture y acredita guardar/abrir/reexportar con PNG idéntico.

## Límites de esta validación

- Chromium usa IPC/diálogos simulados: no equivale a prueba integral nativa. EXE lanzado y ventana detectada, pero diálogos y preview WebView2 reales quedan pendientes de comprobación manual fiable.
- Impresión física, RIP, espejo, perfiles de tinta y base blanca no verificados. No hay espejo ni márgenes automáticos.
- SVG debe ser autocontenido con texto convertido a trazados; imágenes anidadas, scripts, HTML y patrones no admitidos.
- Máximo 1000 copias/presupuesto de packing, fuente 20 MiB/32 millones de píxeles, destino 100 millones de píxeles/32768 por lado. El tamaño inicial necesita unos 335 MB más buffers temporales.
- JSON no portable por sí solo, sin autosave ni hash de assets. No borrar ni editar las copias privadas de los diseños.
- Aviso preexistente de Tauri: bundle ID termina en `.app`; no afecta al instalador Windows, revisar antes de empaquetar para macOS.

## Instalación y comprobación manual

Desde código: `pnpm install --frozen-lockfile`, `pnpm dev`. Producción: `pnpm build`; instaladores en `src-tauri/target/release/bundle/{msi,nsis}/`. La app compilada necesita WebView2, no Node/Rust.

Seguir [manual-dtf-check.md](manual-dtf-check.md): importar diseños propios, confirmar arte visible y cantidades, generar todas las hojas, exportar con nombre nuevo, verificar tamaño/densidad, guardar/abrir/regenerar/reexportar y comprobar en el RIP al 100% antes de imprimir. No se hace merge automático a `main`.

## Ampliación del MVP: color y agente externo

El usuario incorporó dos requisitos necesarios al alcance: un color hexadecimal por diseño y preparación con agente externo mediante MCP/carpeta de ingesta. La tabla de verificación anterior corresponde al MVP base; el estado actualizado está en G/H del roadmap.

### Color

Implementado y verificado: `colorOverride` opcional, estricto `#RRGGBB`, preserva alpha/originales, aplica igual a PNG/SVG y puede retirarse. Se conserva al duplicar y guardar/abrir; JSON v1 antiguo sigue siendo válido. Preview con miniaturas coloreadas acotadas, nunca usadas para exportar. Evidencia: **129 tests frontend**, **72 Rust** en la revisión de color, **4 E2E Chromium** incluyendo píxeles reales de PNG/SVG con alpha parcial y retirada del color, lint y build frontend correctos.

### Agente externo

Se añade un adaptador MCP local por stdio que reutiliza Rust, sin chat, claves, HTTP ni proveedor de modelo en DTFetris. Dos raíces explícitas: ingesta de solo lectura y workspace para trabajos/exportaciones. Las medidas se confirman, no se infieren de píxeles ni nombres. Exportación y sobrescritura requieren acciones explícitas; los JSON preparados se revisan abriéndolos en la app, sin sincronización en vivo del store. Configuración y límites en [agent-integration.md](agent-integration.md).

Evidencia adicional: **12 tests MCP** (84 Rust en total), con PNG/SVG de fixture, controles de rutas incluyendo enlaces, retirada explícita de color, guardado y exportación. `npm run build:mcp` correcto; `npm run test:mcp` correcto contra el EXE release real mediante pipes (inicialización, 12 herramientas, estado/listado/ping y cierre por EOF). El adaptador no necesita SDK ni una dependencia de orquestación; `dirs` ya era transitiva de Tauri y ahora se declara directamente para resolver el mismo almacenamiento.

En esa fase inicial solo se usaron fixtures, sin importar diseños del usuario. La validación privada posterior se describe abajo. No se ha modificado la configuración persistente de un cliente MCP del usuario. El control de rutas presupone directorios locales de confianza; no se presenta como un sandbox frente a sustituciones concurrentes del filesystem.

## Validación de negocio posterior

El usuario autorizó después un encargo privado real. Se corrigieron dos limitaciones descubiertas con él: el packing reservaba los máximos completos en vez del arte visible, y el parser rechazaba un `DOCTYPE` SVG 1.1 inerte. Ahora el footprint es el bbox ajustado, la separación es configurable (3 mm elegidos) y se acepta el doctype externo sin cargarlo, manteniendo bloqueadas las entidades y subconjuntos internos.

Evidencia vigente: **145 tests frontend / 95 Rust / 5 E2E web**, smoke del MCP release y builds EXE/MSI/NSIS/servidor correctos. El encargo real de 44 piezas se generó efectivamente mediante MCP, incluidos guardado/recuperación y verificación independiente del PNG. El agente separó tres diseños de un SVG compuesto conservando trazados, fuera de la aplicación.

Se generaron un control 60 × 100 y un candidato **60 × 86 cm**, de **7087 × 10157 px a 300 DPI**, preservando tamaños visibles y 3 mm entre bboxes: 14% menos superficie de plancha. El barrido encontró esa menor altura entera para esta heurística, no demuestra optimalidad global. Se verificaron los 44 bboxes impresos, colores/alpha y originales sin cambios; desvío de rasterización de bbox frente al plan inferior a 0.272 mm. Arte, nombres y resultados privados se mantienen fuera del repositorio. La comparación HTML/PNG local está preparada para el usuario.

**No aprobado todavía**: queda la comparación visual del usuario y la validación física/RIP. No se sustituye esa aprobación por los tests técnicos ni se declara verificado un diálogo nativo que no se probó.

Se respetaron los máximos físicos del pedido, no las escalas manuales exactas de la referencia. La reducción del 14% compara superficies de hoja; no demuestra una mejora de packing a idénticas escalas frente a Photopea. Entre control y candidato DTFetris sí se mantuvieron idénticos tamaños visibles.
