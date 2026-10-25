# Estrategia de testing

Prioridad: evitar medidas físicas incorrectas, copias perdidas, solapamientos, deformación, datos perdidos y exportaciones que anuncien un éxito falso.

## Capas y evidencia

| Capa | Runner | Qué acredita |
|---|---|---|
| Dominio/archivos Rust | `cargo test` desde `src-tauri` | Packing real, importación, rasterización, composición PNG y persistencia con fixtures propios. |
| IPC Rust | `tauri::test`, dentro de `cargo test` | Payloads camelCase y serialización de commands en mock runtime Tauri; no diálogos ni WebView2 real. |
| Unidades/estado/componentes | `npm run test` | Reglas TS, redondeo, invalidación, formularios, toolbar, preview y métricas. Los comandos se simulan en estas pruebas. |
| Flujo web | `npm run test:e2e` | UI real en Chromium/Vite, **IPC y diálogos simulados** explícitamente en `tests/e2e/browser-mocks.ts`. No acredita escritura de archivos ni escritorio nativo. |
| Build | `npm run build:frontend`, `npm run build` | Compilación TypeScript/Vite y producción Tauri/MSI/NSIS respectivamente. |

Playwright no puede conectarse mediante `tauri://localhost` ni sustituye a WebDriver para una aplicación nativa. La configuración sirve Vite en HTTP. El test web incluye una referencia visual Windows deliberadamente revisada; en otros sistemas habrá que generar y revisar su snapshot de plataforma, no aceptarlo automáticamente. El backend de impresión se verifica con PNG reales en Rust, separado de los mocks web.

## Casos críticos

### Packing

- Ajuste exacto, mosaico, cantidades, overflow y multipágina sin hojas vacías.
- Rotación opcional y bloqueada; copia imposible explícita.
- Límites físicos y no solapamiento; conservación del total de copias.
- Petición vacía, cantidades cero mixtas, dimensiones inválidas, IDs duplicados y límites operativos.
- Misma composición ante reordenamiento del mismo conjunto; 80 fixtures pseudoaleatorios reproducibles.
- Bbox visible ajustado en cm fraccionarios (no celda sobrante), punto fijo a 1 micrómetro, separación de 3 mm y ajuste exacto al borde sin margen exterior forzado.

### Exportación

- Archivo predeterminado real **60 × 100 cm → 7087 × 11811 px**; lectura posterior de cabecera y filas.
- Política `round(cm * 300 / 2.54)` y `pHYs` 11811 píxeles/metro, equivalentes aproximadamente a 300 DPI.
- PNG con alpha, padding, recorte, centrado proporcional, posición y rotación, incluyendo celda no cuadrada.
- Remuestreo de transparencia sin contaminación RGB invisible y SVG sin oscurecer colores por alpha premultiplicado.
- PNG/SVG mixtos y multipágina; nombres de archivo, creación exclusiva y rollback solo de archivos propios.
- Falta de copias, metadatos/layout inválidos, archivos ausentes/corruptos y guardas de asignación.

### Persistencia

- JSON versionado conserva solo entradas; layout se regenera al abrir.
- PNG/SVG importados, rutas compartidas y nombres repetidos permitidos; IDs únicos.
- JSON inválido, versión desconocida, límites de recursos y assets desaparecidos/corruptos.
- Fallos de escritura/reemplazo conservan trabajo previo; no sobrescribir assets.
- Flujo integrado guardar → recuperar → packing → exportar, comparando archivos reales.

### Frontend

- Selección múltiple secuencial, errores parciales/reintento y cancelación de diálogo.
- Edición entera positiva, cantidad mínima 1, duplicado y eliminación confirmada.
- Cambio de plancha aplica explícitamente dimensiones válidas; campos pendientes bloquean generar/guardar/exportar.
- Generación rechaza petición vacía y libera loading ante fallos; descarta respuestas antiguas.
- Importación pendiente no contamina un trabajo restaurado.
- Preview por plancha, recorte normalizado, rotación, imagen ausente y callback obsoleto.
- Área visible y reservada diferenciadas; métricas por hoja/globales.

### Color único

- Validación estricta `#RRGGBB` en TS/Rust; ausente/null mantiene originales. Se rechazan abreviaturas, nombres y hex con alpha.
- Composición PNG/SVG con un solo color y transparencia idéntica; prueba de los 256 valores alpha posibles, fuentes intactas y retirada de sobrescritura.
- Guardar/cargar mantiene color; JSON v1 anterior sin campo sigue siendo válido.
- Canvas real de Chromium: PNG y SVG coloreados, alpha parcial, borrado del color y payload de exportación. Las miniaturas solo se usan para preview; no sustituyen los tests de archivos Rust.

### Agente externo

- Handshake y framing MCP stdio, schemas de herramientas, errores y línea acotada; nada ajeno al protocolo en stdout.
- Ingesta determinista, rutas canónicas restringidas, rechazo de escapes y nombres de destino fuera del workspace.
- Mutaciones/errores atómicos, layout invalidado, exportación con confirmación explícita y no sobreescritura de PNG.
- Flujo de trabajo real desde herramientas: importar → editar color/cantidad → packing → guardar/recuperar → exportar con fixtures privados. No configura ni llama a un LLM externo para los tests.
- SVG 1.1 con `DOCTYPE` externo inerte aceptado sin fetch; rechazo de subconjuntos internos/entidades/DOCTYPE duplicado y errores de importación con detalle útil en MCP.

## Validación de negocio local

Una prueba real adicional preparó 8 diseños y 44 copias, con dos colores y 3 mm entre piezas. El agente separó vectorialmente un SVG compuesto fuera de DTFetris, verificando sus trazados. Se generaron por MCP un control de 60 × 100 y un candidato de 60 × 86 cm sin reducir las medidas visibles, comparados localmente con una referencia aceptada por el usuario. Se comprobaron cantidades, límites, separación, hashes de originales, recuperación del trabajo, PNG/DPI/alpha/colores y bboxes de las 44 piezas. No se incluyen los originales privados en los tests ni en Git. Esto **no equivale a aprobación visual del usuario ni a impresión física**.

## Verificación de una entrega

```text
pnpm install --frozen-lockfile
npm run test
npm run lint
npm run build:frontend
npm run test:e2e
cargo test                 (en src-tauri)
cargo fmt --check          (en src-tauri)
npm run build
```

Registrar comandos/resultados reales en el roadmap y la revisión final. Un timeout o un comando no ejecutado nunca cuenta como aprobado. La impresión física y el flujo nativo con diálogos reales se validan por separado con la guía manual; no se infieren de Chromium ni de la compilación.
