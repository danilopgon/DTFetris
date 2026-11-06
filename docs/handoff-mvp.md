# Relevo del MVP de DTFetris

Actualizado: **2026-11-06**. Contexto para continuar sin reconstruir la conversación.

## 1. Situación y objetivo inmediato

El MVP está implementado y ha generado un encargo real mediante MCP, con PNG imprimible y trabajo recuperable. El usuario lo ve bastante correcto. **No se ha declarado aprobado definitivamente**: quedan la comprobación integral de escritorio y la validación de taller.

El usuario pidió automatizar la prueba de la aplicación nativa y autorizó hacerlo. Antes de completar esa tarea pidió este volcado para continuar con otro agente.

**Actualización 2026-11-06:** la prueba nativa del EXE está **hecha y en verde** con `npm run test:native` (CDP sobre WebView2 + UI Automation, sin Orca); evidencia en [roadmap.md](roadmap.md). **Próximo incremento:** recorte de logo desde PNG por MCP (incremento I del roadmap, decisiones ya cerradas con el usuario).

## 2. Repositorio y flujo

- Proyecto local: `C:\Users\Usuario\Dev\dtfetris` (Windows).
- Rama: `feat/autonomous-mvp`.
- HEAD comprobado al preparar este relevo: `dd123c4`, sincronizado con `origin/feat/autonomous-mvp`.
- PR: <https://github.com/danilopgon/DTFetris/pull/17>. Se publicó código/documentación y se actualizó su descripción. No se ha hecho merge a `main` durante esta sesión.
- Antes de escribir este documento, `git status --short --branch` estaba limpio. Este relevo y su enlace en el índice son cambios nuevos; no se han vuelto a ejecutar los tests para redactarlos.
- Leer primero `AGENTS.md` y [README.md](README.md), router documental. Requisitos, reglas y evidencia están repartidos por área: este relevo no los sustituye.
- Se retiró SDD/OpenSpec. Mantener flujo ligero: requisitos → incremento → tests → revisión → evidencia en roadmap → commits coherentes. No reintroducir propuestas/aprobaciones pesadas.
- Conservar trabajo ajeno y originales privados. No publicar diseños, nombres del encargo ni datos identificables en Git. No modificar configuraciones persistentes del usuario para probar sin autorización específica.

### Commits relevantes

| Commit | Entrega |
|---|---|
| `f45699c` | Limpieza de proceso y roadmap ligero. |
| `5688451` | MaxRects multipágina determinista en cm. |
| `735538d` | PNG imprimible y persistencia local validada. |
| `bdbe072` | Flujo UI completo y plancha configurable. |
| `b87cb54` | Estabilización, tests y límites de la validación. |
| `eca34ca` | Color opcional por diseño con alpha conservado. |
| `dd123c4` | MCP, bbox visible, separación física y compatibilidad segura con SVG reales. |

## 3. Implementado

- Tauri 2, React 18/TypeScript, Vite 6, Zustand 5, Konva y Tailwind 3; backend Rust. No migrar el stack para cerrar el MVP.
- UI íntegramente española. Importación múltiple PNG/SVG, copia privada de assets, edición, cantidades, duplicado y eliminación confirmada.
- Preview del arte real, proporciones, rotación, varias planchas y métricas. Cambiar entradas invalida el layout; generar es explícito.
- Packing Rust MaxRects determinista, multipágina, rotación opcional, copias imposibles explícitas y límites de complejidad.
- Exportación Rust PNG RGBA transparente a 300 DPI, densidad `pHYs`, varias hojas, validación de placements y protección de archivos existentes. No exportar desde Canvas.
- Persistencia JSON local versionada, validación al abrir y guardado atómico. JSON guarda rutas a assets privados, no incorpora los diseños; **no es un paquete portable**.
- Color opcional `#RRGGBB` por diseño PNG/SVG: sustituye RGB y conserva alpha; preview/export coinciden; quitarlo restaura originales; duplicado y persistencia lo conservan.
- Servidor independiente `dtfetris-mcp` por stdio: listar ingesta, importar, editar, duplicar, eliminar, configurar hoja, packing, guardar/recuperar y exportar. Reutiliza los motores Rust.
- MCP sin HTTP, chat, SDK de modelo, credenciales ni LLM integrado. El agente externo interpreta lenguaje natural. Ingesta, workspace y almacenamiento de assets son raíces separadas/acotadas. Exportación requiere `confirm: true`; PNG no se sobrescribe y JSON exige sobrescritura explícita.
- Abrir el JSON preparado en la app requiere regenerar las planchas. No hay sincronización en vivo entre UI y sesión MCP.
- SVG con declaración externa SVG 1.1 inerte aceptado sin fetch; subconjuntos DTD internos y entidades siguen rechazados. No habilitar lecturas de recursos externos.

## 4. Reglas que no se deben deshacer

1. **Centímetros son dominio. Nunca packing en píxeles.** Conversión solo en preview/exportación.
2. Las dimensiones pedidas son **máximos**, no celdas que deban reservarse completas. Ajustar proporcionalmente el bbox visible; reservar solo ese tamaño. Ejemplo: máximo 8 × 8 con arte 2:1 → footprint de 8 × 4 cm.
3. El padding transparente no determina la escala. Metadatos de bounds visibles se detectan al importar y se usan sin leer imágenes durante packing.
4. Precisión física conservadora de `0.0001 cm` (1 micrómetro), redondeando hacia fuera. No reducir diseños para hacer que quepan.
5. `gapCm` opcional en configuración/hojas: trabajos nuevos comienzan en `0.3`; trabajos antiguos sin campo significan `0`. UI muestra mm y guarda cm.
6. **El usuario corrigió el encargo a 10 mm para cortar a tijera.** Se regeneró con `gapCm: 1`. Esto fue una configuración del pedido: **no se cambió el default global de 3 mm**. No asumir que ha solicitado cambiarlo para todos los trabajos.
7. Separación entre bboxes, sin imponer margen exterior. No hay espejo automático, base blanca, ICC ni tinta metálica. El plata solicitado es un color RGB.
8. No deformar automáticamente. No persistir trabajos en `localStorage`/IndexedDB ni guardar objetos `File`.
9. Separar un SVG compuesto fue preparación externa vectorial del agente; no se añadió ni se pide un editor/separador dentro de DTFetris.

## 5. Evidencia técnica disponible

Última batería completa conocida, ejecutada el **2026-10-25** sobre la entrega integrada:

| Verificación | Resultado |
|---|---|
| `npm run test` | 145 tests frontend correctos. |
| `cargo test` en `src-tauri` | 95 tests correctos. |
| `npm run test:e2e` | 5 tests Chromium correctos, **IPC y diálogos simulados**. |
| `npm run lint` | Correcto. |
| `cargo fmt --check` en `src-tauri` | Correcto. |
| `git diff --check` | Correcto. |
| `npm run build` | EXE, MSI y NSIS Windows generados. |
| `npm run build:mcp` | EXE release del servidor generado. |
| `npm run test:native` (2026-11-06) | EXE recompilado: selector y diálogos reales, WebView2, cierre/recuperación, PNG idénticos, separación medida 9,991 mm. |
| `npm run test:mcp` | Proceso stdio real: inicialización, 12 herramientas, estado/listado/ping y cierre por EOF. |

Los tests Rust incluyen archivos reales e IPC Tauri con runtime simulado, recuperación y reexportación. Esto aporta evidencia del backend, **no acredita por sí solo los diálogos y la carga de assets en WebView2 del escritorio**.

Binarios generados:

- `src-tauri/target/release/dtf-sheet-optimizer.exe`
- `src-tauri/target/release/dtfetris-mcp.exe`
- Instaladores en `src-tauri/target/release/bundle/{msi,nsis}/`.

Revalidar su existencia y correspondencia con el código antes de probar. No describir los resultados históricos como ejecuciones nuevas.

## 6. Encargo real y corrección para tijera

Se prepararon **8 diseños / 44 copias** mediante MCP release, dos colores, originales comprobados por SHA-256 sin cambios y separación de un SVG compuesto conservando todos sus trazados. Guardado/recuperación/repacking/exportación funcionaron.

- Control inicial: 60 × 100 cm, separación 3 mm.
- Primer compacto: 60 × 86 cm, separación 3 mm. El usuario lo consideró demasiado apretado para tijera.
- **Versión vigente, generada el 2026-11-02: 60 × 95 cm, separación 10 mm, mismas cantidades, colores y tamaños visibles.** No hubo cambios de código de la app para producirla.
- Se barrieron alturas enteras mediante MCP; 95 cm fue la primera que dio una sola hoja con esa heurística y separación. No se afirma optimalidad global.
- PNG vigente: **7087 × 11220 px**, RGBA, densidad **299.9994 DPI** por cuantización de `pHYs`, transparencia y colores opacos exactos comprobados.
- Se localizaron los 44 bboxes. Separación mínima planificada 10 mm; mínimo rasterizado observado aproximadamente **9.991 mm**, por redondeo a píxeles.
- SHA-256 del PNG vigente: `f9901b1519b05b423982392ab807eb2749d4c8b8b5de6aff0422463de0fafe15`.
- Las escalas del arte respetan los máximos pedidos, **no copian exactamente los ajustes manuales de Photopea**. Control y compactos DTFetris sí mantuvieron iguales tamaños. No vender las diferencias de superficie como mejora de packing frente a Photopea a idéntica escala.

### Artefactos privados locales

No incluir nombres privados ni diseños en el repositorio. Para localizar el resultado vigente, buscar en el Escritorio la carpeta cuyo nombre termina en **`20261102 - tijera 10mm`**. Contiene:

- `exports/`: PNG imprimible.
- `COMPARAR-3mm-vs-10mm-NO-IMPRIMIR.png`: comparación revisada visualmente por el agente.
- `VISTA-10mm-NO-IMPRIMIR.png`: preview, no imprimible.
- Trabajo JSON recuperable, `comprobacion.json`, `layout-comprobado.json`, `verificacion-png.json`, `transcripcion-mcp.json` y `LEEME.txt`.

La versión anterior está en la carpeta del Escritorio terminada en `20261025-03`; incluye `COMPARAR.html` y comparación con Photopea. No borrarla ni confundirla con el resultado vigente.

Scripts locales de preparación/verificación en `C:\Users\Usuario\AppData\Local\Temp\opencode`:

- `run-<encargo>-mcp.mjs`: cliente temporal MCP, admite `--optimize-height --gap-cm=1`; exige workspace nuevo para no sobrescribir.
- `verify-scissors.py`: comprobación y previews de la versión de 10 mm.
- `compare-<encargo>.py`: comparación histórica de 3 mm, con textos específicos de esa versión; **no reutilizar sin adaptar para 10 mm**.

Son herramientas locales con rutas/datos privados, no fixtures para Git. Los temporales podrían haber desaparecido: comprobarlos antes de depender de ellos.

## 7. Prueba nativa automatizada (completada el 2026-11-06)

> Resuelto: se descartó Orca y sus skills se desinstalaron. Implementado en `tests/native/` y documentado en [testing-strategy.md](testing-strategy.md#prueba-nativa-del-exe). Lo siguiente se conserva como historia del intento interrumpido.

### Qué ocurrió al intentarlo

Se propuso empezar con Orca Computer Use sobre el EXE existente, sin modificar la app. El usuario respondió **«Hazlo»**. Se consultaron variables `ORCA*` (no se devolvió ninguna) y se intentó:

```text
orca skills get computer-use
```

La herramienta devolvió **`aborted: Tool execution interrupted`**. **No se completó una prueba nativa, no se obtuvieron capturas/evidencias nuevas y no se instaló/configuró WebdriverIO ni tauri-driver.** Esto no demuestra un fallo de Orca ni un fallo de DTFetris; la ejecución quedó interrumpida.

### Plan para retomar

1. Leer la skill `computer-use` vigente y su guía del CLI. Resolver el ejecutable según el entorno; no adivinar comandos ni reutilizar sintaxis antigua. Si no hay variables especiales, en este Windows se había seleccionado `orca`.
2. Usar solo fixtures PNG/SVG sintéticos y salidas nuevas en una carpeta temporal dedicada. No abrir/modificar el pedido privado para probar. Evitar tocar datos persistentes reales; comprobar cómo aislar datos de app antes de lanzar la prueba.
3. Arrancar el EXE de producción y confirmar ventana, contenido visible y carga del arte en WebView2. Capturar estado inicial.
4. Importar PNG y SVG mediante el **selector real Windows**. Comprobar que aparecen sus imágenes, sin asumir que un mensaje de éxito basta.
5. Cambiar medidas máximas, cantidades, color, rotación y separación a 10 mm; generar. Verificar preview, cantidades, tamaños y ausencia de errores.
6. Guardar JSON y exportar PNG mediante los **diálogos reales**, con nombres nuevos.
7. Cerrar solo la instancia creada para el test. Abrir de nuevo, recuperar JSON, generar y exportar con otro nombre.
8. Verificar archivos independientemente: JSON, cantidades, cm/px/DPI, alpha, color, posiciones y equivalencia de las dos exportaciones. Conservar capturas/logs y pasos reproducibles.
9. Registrar en roadmap qué se observó realmente, los fallos y qué quedó fuera. No marcar completado solo por encontrar una ventana o por probar backend/MCP.

Si Orca no ofrece un control fiable, evaluar **WebdriverIO + tauri-driver** para WebView2/IPC y automatización Windows aparte para los diálogos nativos. WebDriver por sí solo no cubre esos selectores. Esta alternativa se explicó, pero **no está implementada**. No añadir servidor de test accesible en builds de producción ni mocks que hagan pasar una prueba supuestamente nativa.

Documentación oficial consultada: <https://v2.tauri.app/develop/tests/webdriver/>. Volver a comprobar compatibilidad/versiones antes de instalar dependencias.

## 8. Otros pendientes y aceptación

- **Aprobación visual explícita del usuario** de tamaños/nombres/cantidades y comodidad para tijera de la versión de 10 mm. «Lo veo bastante correcto» es una valoración positiva, no una prueba física.
- **Prueba pequeña en RIP/impresora al 100%**: tamaño medido, transparencia, color, espejo una sola vez y recorte. No hace falta gastar la plancha completa. Esto no se sustituye con tests de software.
- **Cliente MCP habitual**, si forma parte de su uso diario: configurar con permiso y probar un pedido corto desde él. El servidor se probó por stdio real, pero no se ha configurado persistentemente su cliente.
- Revisar rutas/backup: el JSON no incorpora assets. No prometer portabilidad, autosave ni detección por hash de cualquier cambio en assets.
- Al cerrar: actualizar evidencia y PR; no hacer merge automático a `main` sin autorización.

**Criterio propuesto:** MVP funcional aceptable al obtener aprobación visual (el recorrido nativo ya pasó el 2026-11-06); validado para taller al superar la prueba física. No ampliar alcance para perseguir optimalidad global, editor SVG, control de impresora o i18n.

## 9. Referencias para continuar

- [roadmap.md](roadmap.md): incrementos y evidencia histórica. Sus apartados de 3 mm describen la primera validación; el pedido posterior de 10 mm está registrado en este relevo.
- [manual-dtf-check.md](manual-dtf-check.md): recorrido y límites de impresión.
- [testing-strategy.md](testing-strategy.md): qué cubre cada capa.
- [agent-integration.md](agent-integration.md): MCP, configuración y seguridad.
- [domain-and-data-model.md](domain-and-data-model.md) y [packing-and-export.md](packing-and-export.md): reglas físicas vigentes.
- [final-review.md](final-review.md): descripción técnica usada en la PR.
