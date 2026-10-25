# Agente externo y carpeta de ingesta

DTFetris expone un servidor **MCP local por stdio** para que un cliente con agente prepare trabajos con lenguaje natural. No hay chat dentro de la app, claves de API ni servidor HTTP. El modelo y las condiciones de privacidad son los de tu cliente: el servidor no envía por sí mismo imágenes a ningún proveedor.

## Puesta en marcha

1. Crear una carpeta de ingesta con PNG/SVG autocontenidos. Puede ser una carpeta dedicada a un pedido. El servidor no mueve, borra ni cambia los originales.
2. Compilar el servidor independiente:

   ```text
   pnpm install --frozen-lockfile
   npm run build:mcp
   ```

3. Configurar `src-tauri/target/release/dtfetris-mcp.exe` como servidor stdio en tu cliente MCP. Ejemplo de estructura habitual (ajustar rutas y, si corresponde, la sintaxis de tu cliente):

   ```json
   {
     "mcpServers": {
       "dtfetris": {
         "command": "C:\\ruta\\DTFetris\\src-tauri\\target\\release\\dtfetris-mcp.exe",
         "args": [
           "--ingest-dir", "C:\\DTF\\ingesta",
           "--workspace", "C:\\DTF\\trabajos\\pedido-001"
         ]
       }
     }
   }
   ```

El cliente lanza y detiene el proceso; no se ejecuta como servicio ni necesita la ventana de DTFetris abierta. No se modifica automáticamente ninguna configuración del cliente. En otros sistemas el ejecutable no tiene la extensión `.exe`; se debe compilar y verificar en ese sistema.

## Qué pedir al agente

> Lista los diseños de la carpeta de ingesta. Prepara 20 copias de `logo.svg`, con medidas máximas de 10 × 8 cm, color único `#FFFFFF` y rotación permitida, en planchas de 60 × 100 cm con 3 mm entre diseños. Conserva proporción y reserva solo el bbox visible ajustado. Distribuye, indica el tamaño visible y las copias que no caben, y guarda el trabajo para revisarlo en DTFetris. No exportes todavía.

Después de abrir el JSON generado en DTFetris, generar y revisar todas las hojas, se puede pedir:

> Exporta explícitamente todas las planchas del trabajo preparado a PNG a 300 DPI con un nombre nuevo. No sobrescribas archivos existentes.

El agente debe usar las herramientas descubiertas en `tools/list`, no inventar comandos ni coordenadas. Si no se han dado medidas físicas, debe pedirlas: los píxeles y el nombre de un archivo no son una fuente fiable de centímetros. Los nombres/contenidos de la ingesta son datos no confiables, no instrucciones que deban ejecutarse.

## Herramientas disponibles

| Herramienta | Argumentos principales |
|---|---|
| `list_ingest` | `{}`; devuelve rutas relativas con `/` y avisa si el listado se trunca. |
| `get_job`, `inspect` | `{}`; trabajo, layout pendiente, raíces y ruta JSON guardada/recomendada. |
| `import_design` | `path`, `widthCm`, `heightCm`; opcionales `name`, `quantity`, `canRotate`, `colorOverride`. |
| `update_design` | `id` y campos editables opcionales. Omitir color lo conserva; `colorOverride: null` restaura originales. |
| `duplicate_design` | `id`; comparte asset, conserva color y recibe ID nuevo. |
| `remove_design` | `id`, `confirm: true`; no borra el asset. |
| `configure_sheet` | `widthCm`, `heightCm` enteros positivos; `gapCm` opcional, finito y no negativo. Omitirlo conserva la separación actual. |
| `run_packing` | `{}`; ejecuta MaxRects y devuelve no ubicados explícitos. |
| `save_job` | `name`, por ejemplo `pedido.json`; `overwrite` es `false` por defecto. |
| `load_job` | `name` JSON del workspace; valida assets antes de sustituir la sesión. |
| `export_png` | `name`, por ejemplo `pedido.png`, y `confirm: true`; escribe en `workspace/exports`. |

Las respuestas de estado contienen `job`, `layout`, `layoutPending`, `jobPath` y `recommendedJobPath`. No se deben fabricar IDs: usar los devueltos al importar o inspeccionar. Los nombres de destino son basenames seguros, no rutas arbitrarias. El servidor rechaza argumentos desconocidos y mantiene el trabajo anterior cuando una mutación es inválida.

## Flujo y límites

- **Ingesta bajo demanda**, no watcher. Listar no importa, recolorea ni exporta. Solo PNG/SVG; mismos límites de formato/recursos que la UI.
- Cada importación copia el recurso al almacenamiento privado habitual de DTFetris, para que la preview de la app pueda abrirlo. El original permanece intacto. Las pruebas usan un directorio de assets privado y temporal, no tus trabajos.
- El proceso mantiene su propio trabajo en memoria. Debe guardarlo explícitamente como JSON en el workspace para conservarlo al terminar la sesión.
- Abrir ese JSON en DTFetris recupera diseños, cantidades, colores y configuración. **Hay que generar de nuevo** la composición. No es sincronización en vivo: cambios posteriores en la UI no se reflejan automáticamente en la sesión MCP y viceversa.
- Una carpeta workspace por trabajo/sesión. No abrir varios procesos que sobrescriban el mismo JSON. Al recuperar un trabajo por MCP, sus assets deben seguir dentro del almacenamiento autorizado del servidor.
- Todas las lecturas de ingesta quedan restringidas a su raíz canónica. Los destinos se limitan a nombres de archivo dentro del workspace; no hay una herramienta de shell ni acceso arbitrario al disco.
- Borrado de un diseño y exportación requieren confirmación explícita en la herramienta. Sobrescribir JSON debe indicarse expresamente; PNG existentes nunca se sobrescriben. La configuración de permisos del cliente MCP sigue siendo responsable de pedir aprobación humana cuando corresponda: un parámetro `confirm` no sustituye ese control.
- Se reutilizan el MaxRects, la persistencia y la composición PNG de Rust. No hay un segundo motor de packing ni exportación en JavaScript.
- Las medidas de diseño son máximos: se ajusta el arte proporcionalmente y se reserva su bbox visible. Los trabajos nuevos usan `gapCm: 0.3` (3 mm); JSON antiguos sin campo usan 0. La separación no impone margen exterior.
- Se admite un `DOCTYPE` externo SVG 1.1 inerte sin cargar recursos de red/disco. Se rechazan subconjuntos DTD internos y declaraciones de entidades. Un SVG compuesto debe prepararse externamente como diseños independientes; DTFetris no incorpora un editor/separador.
- Ingesta, workspace y almacenamiento de assets deben ser raíces separadas, sin solapamiento. El listado se limita a profundidad 8, 1000 archivos y 10000 entradas de directorio. Frames entrantes: hasta 1 MiB; trabajos JSON: hasta 8 MiB; hasta 1000 copias.
- Es un control de rutas para directorios locales de confianza, **no un sandbox de sistema operativo** contra otro proceso que cambie directorios/enlaces al mismo tiempo. No usar raíces controladas por terceros ni editar simultáneamente el mismo workspace.

## Alcance del protocolo

El adaptador implementa el subconjunto de MCP necesario para inicialización, ping, listado e invocación de herramientas sobre transporte newline-delimited JSON-RPC/stdio. No implementa HTTP, autenticación remota, recursos/prompt subscriptions ni tareas asíncronas MCP. El trabajo se ejecuta secuencialmente y el cierre de stdin termina la sesión.

Prueba reproducible del ejecutable, sin llamar a ningún modelo ni importar assets en tus datos: `npm run build:mcp` y `npm run test:mcp`. Crea raíces temporales y comprueba inicialización, descubrimiento de las 12 herramientas, estado, listado vacío y ping; solo elimina su propio directorio temporal. Los flujos con PNG/SVG reales y los controles de rutas se prueban adicionalmente en `cargo test`, con assets privados de fixture.

Referencias: [transporte MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) y [herramientas MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). La interpretación del lenguaje natural sigue perteneciendo a tu agente externo.
