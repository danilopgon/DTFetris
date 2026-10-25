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

MaxRects propio pequeño frente a adaptar una crate que no satisface directamente algoritmo/rotación/no ubicados (ver [decisión](packing-decision.md)). La celda solicitada reserva espacio y el arte se ajusta sin deformarse. Se recalcula explícitamente para no generar por cada pulsación. Se persisten entradas, no layouts potencialmente obsoletos. La validación de assets es compartida y rechaza SVG que podrían renderizarse incompletos. Los límites de recursos son operativos, no dimensiones físicas fijas.

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
