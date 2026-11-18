---
name: dtf-encargo
description: Prepara un encargo DTF real con el MCP de DTFetris, de principio a fin. Interpreta el pedido escueto de la clienta, localiza los logos en su archivo de planchas, recorta regiones, decide tamaños comparando con planchas anteriores y monta una plancha completa. Después sube el margen si sobra hueco, exporta, verifica de forma independiente, archiva y deja un LEEME. Úsala cuando el usuario pase un pedido DTF ("30 unidades del Ayuntamiento en blanco…"), pida preparar o montar una plancha, recortar un logo de una plancha anterior o repetir un encargo.
---

# Encargo DTF con DTFetris

Flujo validado con el primer encargo real (2026-11-06). Responde en español. El dominio trabaja en **cm**; los píxeles solo sirven para medir.

## Carpetas y herramientas

> Copia genérica versionada en el repo. La instalación real vive en `~/.claude/skills/dtf-encargo` con las rutas del taller. Para usarla, copia esta carpeta allí y sustituye `<ingesta>` y `<workspace>`, o define `DTFETRIS_INGEST`, `DTFETRIS_WORKSPACE` y, si hace falta, `DTFETRIS_MCP` para `scripts/mcp-client.mjs`.

| Qué | Dónde |
|---|---|
| Ingesta (solo lectura) | `<ingesta>`: archivo de planchas, un PNG por cliente a 300 DPI, y fuentes vectoriales en `Logos\<cliente>\` |
| Workspace | `<workspace>`: JSON, `exports\`, `previews\`, vistas y LEEME |
| Servidor MCP | `dtfetris` (user scope), binario en `%LOCALAPPDATA%\DTFetris\bin\dtfetris-mcp.exe` |
| Repo | este repositorio (`docs/agent-integration.md` describe cada herramienta) |

- Si las herramientas `mcp__dtfetris__*` no están cargadas, pide al usuario que haga `/mcp`. Mientras tanto usa `scripts/mcp-client.mjs`, que ejecuta una lista de llamadas en **una** sesión: `node scripts/mcp-client.mjs llamadas.json` con `[["tool",{args}],…]`. Cada proceso empieza con un trabajo vacío; para continuar, usa `load_job`.
- Los archivos nuevos del pedido (descargas, WhatsApp…) se **copian** a la ingesta, con nombre de cliente si son planchas o en `Logos\<cliente>\` si son fuentes. Nunca se mueven ni se modifican los originales.
- Si se recompila el MCP en el repo, vuelve a copiar `src-tauri/target/release/dtfetris-mcp.exe` al binario estable. Con el servidor en marcha, Windows bloquea el archivo.

## 1. Interpretar el pedido

La clienta escribe cosas como «AYUNTAMIENTO EJEMPLO BOLSILLO 30 UNIDADES COLOR BLANCO». Para cada línea:

1. Identifica el logo con `list_ingest`, buscando por nombre de cliente en las planchas y en `Logos\`. Si hay JSON de encargos anteriores en el workspace, revisa sus diseños, medidas y colores, porque los repite («el plata» fue `#C8C8C8`).
2. Fija variante, cantidad y color. Colores usados: blanco `#FFFFFF`, plata `#C8C8C8`. «Colores originales» significa sin `colorOverride`.
   - Si el archivo adjunto ya está en la ingesta, compáralo por hash y no lo copies otra vez.
   - Si hay archivos con nombres parecidos (`Cliente.png` y `Cliente grande.png`), di cuál usas y por qué. «La versión grande» puede ser una variante dentro de una plancha o el archivo así llamado.
3. Presenta una tabla con la interpretación de cada línea (origen, variante, cantidad, color y tamaño propuesto). **Pregunta solo lo ambiguo**, con `AskUserQuestion` interactivo: hasta 4 preguntas por llamada y la recomendación primero con «(Recomendado)». Ambiguo es, por ejemplo, «más grande o la letra más gordita»: recomienda agrandar sin tocar la tipografía.

## 2. Recortar logos de planchas anteriores

1. `detect_regions` sobre la plancha, con `mergePx` 24 por defecto. Devuelve regiones con medidas a 300 DPI y un `detectionId`.
2. **Mira siempre antes de importar.** Hay dos opciones: la vista `previewPath`, o un zoom con caja sobre el original (`scripts/preview.ps1 -Source … -X … -Y … -W … -H … -Box "x,y,w,h"`) leído con Read. Los números de la vista tapan las piezas pequeñas, así que para decidir usa el zoom.
3. Hay tres casos:
   - **Logo limpio:** una región con el tamaño esperado. Usa `import_design_region` con `regions:[n]` y su `detectionId`.
   - **Letras separadas** (por ejemplo, texto espaciado): repite la detección con un `mergePx` mayor (60 funcionó) y comprueba en el zoom que no se mezcla con el logo vecino.
   - **Huecos internos mayores que la distancia entre logos**, o **contornos que se tocan** (salen regiones gigantes): usa `rectPx`. Antes, comprueba el rectángulo con `-Box` en el zoom: tiene que contener el logo entero sin tocar el siguiente.
4. Los logos pueden estar girados 90° en su plancha; no importa, el packing rota.

## 3. Tamaños

- **Referencia:** el tamaño con que se imprimió. Las planchas archivadas están a 300 DPI, así que `referenceCmAt300Dpi` (o el bbox de `sourceBoxesPx`) es el tamaño real impreso. Comprueba el DPI con el chunk `pHYs` si hay dudas.
- Las medidas máximas son **cm enteros**; el arte se ajusta proporcionalmente dentro de ellas. Elige el par de enteros que más se acerque al original.
- Entrega siempre una **tabla de desviación** (original, ahora, %). Si la desviación es apreciable, ofrece alternativas. El usuario aceptó un +1,7 % antes que bajar al entero inferior (−8 %).

## 4. Montar la plancha

- Usa siempre la **plancha completa**: 60 × 100 cm salvo que el usuario diga otra cosa. No recortes la plancha al alto mínimo.
- Separación inicial: **10 mm** (recorte a tijera). `configure_sheet {widthCm:60, heightCm:100, gapCm:1}` y luego `run_packing`. Comprueba que hay una sola hoja y nada sin ubicar.
- Nombres de diseño: `Cliente (variante, color)`, por ejemplo `Ayuntamiento Ejemplo (bolsillo, blanco)`.

### Llenar la plancha con un solo diseño

Pedidos como «todo el metro con ese logo» o «una plancha llena» no traen cantidad: es el máximo de copias que caben en una plancha.

1. Importa el diseño con cantidad 1 y su tamaño de referencia.
2. Con la separación de 10 mm, sube la cantidad con `update_design` y `run_packing` hasta la última que da una sola hoja y nada sin ubicar. Empieza por una estimación: área de la plancha entre el área de una pieza con su separación.
3. Con esa cantidad, haz el barrido fino de `gapCm` (§ 5) y usa la separación máxima que aún cabe.
4. Calcula alternativas de más copias con menos margen (por ejemplo, «33 con hasta 6,5 mm, 34 con hasta 3,5 mm, 35 no caben») y ponlas en el informe y en el LEEME para que el usuario elija.
5. Guarda solo el trabajo final. Los tanteos intermedios no se guardan, o se guardan con un nombre que diga que son borradores.

## 5. Hueco sobrante

Calcula la ocupación (suma del área de los rectángulos colocados entre el área de la plancha) y haz un **barrido fino de `gapCm`** (pasos de 0,05 cm) para hallar la separación máxima que sigue cabiendo en una plancha. Luego pregunta:

> «Ha sobrado hueco (ocupación X %). ¿Metemos más margen de recorte (cabe hasta N mm) o esperamos a más diseños para cubrir la plancha?»

«Cubrir plancha con más margen» significa **subir la separación al máximo que cabe y exportar con ella**. No significa mantener la separación y dejar el hueco libre: se malinterpretó una vez.

## 6. Exportar, verificar y entregar

1. `save_job` (por ejemplo `encargo-<fecha>.json`, con `overwrite:true` si es el mismo encargo) y después `export_png {name, confirm:true}`. Los PNG nunca se sobrescriben: usa un nombre nuevo por versión.
2. Verifica de forma independiente: `node --max-old-space-size=4096 scripts/verify-layout.mjs <png> <layout.json>`, pasándole el array de `mcp-client.mjs` o `{layout, job}` guardado desde las respuestas de las herramientas. Debe dar `ok: true`: tamaño y DPI correctos, 0 píxeles visibles fuera de las piezas, la separación medida (con la tolerancia de redondeo a píxel) y cada pieza llenando su caja.
3. Haz la vista `VISTA-NO-IMPRIMIR.png` con `scripts/preview.ps1` (fondo oscuro) y **mírala**: cantidades por diseño, colores y nada cortado.
4. Mueve las versiones superadas a `exports\descartados\`.
5. Escribe `LEEME-<encargo>.txt` en el workspace con estos datos:
   - el PNG vigente;
   - la plancha y su separación;
   - cada diseño con cantidad, tamaño y color;
   - la tabla de desviaciones;
   - «imprimir al 100 %, sin espejo ni base blanca automáticos»;
   - el aviso de que las piezas pueden tocar el borde, porque no hay margen exterior;
   - las fuentes usadas.
6. Cuando el usuario valide, **archiva** una copia del PNG final en la ingesta `DTF\` con el nombre de los clientes (`Cliente A + Cliente B.png`), sin sobrescribir, y comprueba el hash. Si el nombre natural ya existe (`Cliente grande.png` es otra plancha), añade lo que distingue a esta (`Cliente logo grande x31.png`). Marca el LEEME como validado y anota la ruta de la copia.

Si el agente no puede hablar con el usuario (por ejemplo, un subagente), toma la opción que recomendaría donde la skill dice «pregunta», anótala como decisión pendiente de revisar y no archives hasta que el usuario valide.

## Límites que no se deben romper

- No modifiques originales ni datos de la app para probar. No uses la separación para simular escala.
- El MCP no deforma, no aplica espejo, no genera base blanca y no infiere medidas de los píxeles por sí solo: la decisión de tamaño es tuya y del usuario, a partir de la referencia.
- Antes de borrar cualquier cosa (encargos viejos, pruebas…), haz inventario, pregunta, archiva lo que haya que conservar verificando hashes y envía el resto a la **Papelera**, no lo borres definitivamente.
- Si aparece un problema del producto (detección, vistas, límites), anótalo en `docs/roadmap.md` del repo sin nombres de clientes.
