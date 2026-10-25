# Flujos de Usuario y Datos

Estos flujos muestran cómo viajan los datos entre usuario, frontend y backend Rust.

## Importar diseño

```text
Usuario introduce ancho y alto solicitados en cm enteros en el panel lateral
  -> Usuario pulsa "Importar diseño"
   -> Se abre el selector de uno o varios archivos (filtro: PNG y SVG únicamente)
  -> Si el usuario cancela: flujo termina, no hay cambios
   -> Por cada archivo seleccionado, secuencialmente:
       -> Frontend llama a store.importDesign({ sourcePath, widthCm, heightCm })
       -> Rust valida extensión, lee el archivo y detecta los límites visibles
       -> Rust copia el archivo a app_data_dir/design-assets/{uuid}.{ext}
       -> Rust devuelve DesignInput con format, visibleBounds y cm confirmados
       -> Frontend añade el diseño a la lista (acumulativo, no reemplaza)
   -> Si hay error: se muestra mensaje en español; ese archivo queda pendiente y los éxitos anteriores se conservan

Errores posibles y mensajes en español:
  - invalid_format  → "Formato no soportado. Solo se aceptan archivos PNG y SVG."
  - empty_artwork   → "El diseño está vacío o es completamente transparente."
  - file_not_found  → "No se encontró el archivo seleccionado."
  - copy_failed     → "Error al guardar el diseño. Comprueba el espacio en disco."
```

## Configurar y generar planchas

```text
Usuario configura diseños y pulsa "Generar"
  -> invoke('run_packing', { request: { designs, sheet: sheetConfig } })
  -> Rust ajusta proporcionalmente el arte dentro de los máximos solicitados
  -> MaxRects reserva el bbox visible ajustado y la separación configurada (nuevos trabajos: 3 mm)
  -> Rust devuelve PackingResult { sheets, unplacedItems }
  -> Si hay copias que no caben, UI muestra nombres y bloquea exportación; no se omiten en silencio
```

## Editar, duplicar y eliminar diseños

```text
Usuario pulsa "Editar" en un diseño
  -> Frontend muestra campos en español para nombre, ancho solicitado, alto solicitado, cantidad y rotación
  -> Si nombre está vacío, dimensiones no son enteros positivos o cantidad es menor que 1:
       -> Se muestra validación en español y el diseño previo queda intacto
  -> Si la edición es válida:
       -> store.updateDesign actualiza el diseño
       -> Se limpian las planchas existentes y queda pendiente recalcular

Usuario pulsa "Duplicar"
  -> store.duplicateDesign crea un diseño con id nuevo
  -> La copia comparte imagePath y conserva dimensiones solicitadas, cantidad, rotación y metadatos
  -> Se limpian las planchas existentes y queda pendiente recalcular

Usuario pulsa "Eliminar"
  -> Frontend solicita confirmación
  -> Si cancela: no cambia la lista
  -> Si confirma: store.removeDesign quita el diseño
  -> Se limpian las planchas existentes y queda pendiente recalcular
```

## Previsualizar resultado

```text
Frontend recibe sheets
  -> Konva convierte cm a px solo para el preview
  -> Se muestran planchas generadas
  -> Se muestran métricas por plancha y globales
```

## Exportar planchas

```text
Usuario pulsa "Exportar"
   -> Selector nativo pide nombre PNG de destino
   -> invoke('export_png', { sheets, designs, outputPath })
  -> Rust lee archivos originales del disco
  -> Si PNG: image composita directamente
  -> Si SVG: resvg rasteriza a bitmap en memoria, image composita el resultado
  -> Rust escala el arte visible a las dimensiones configuradas y compone la plancha final a 300 DPI
   -> Rust escribe PNG con alpha y pHYs de 300 DPI, una plancha en memoria cada vez
   -> Una hoja: nombre solicitado. Varias: sufijos -001, -002, etc.
   -> Si un destino existe, exige otro nombre; nunca sobrescribe PNG existentes
   -> UI muestra rutas de los archivos terminados; un fallo no anuncia éxito
```

## Guardar trabajo

```text
Usuario guarda el trabajo
   -> Selector nativo pide ruta JSON
   -> invoke('save_job', { job: { version: 1, sheetConfig, designs }, path })
  -> Rust serializa a JSON con serde_json
   -> Rust valida diseños/archivos y reemplaza el JSON atómicamente en la ruta elegida
```

## Recuperar trabajo

```text
Usuario abre un trabajo guardado
  -> invoke('load_job', { path })
  -> Rust lee JSON desde disco
  -> Rust deserializa el estado
   -> Rust comprueba versión, entradas y assets locales (ausentes/corruptos se rechazan)
   -> Frontend recupera diseños/configuración solo después del éxito y marca layout pendiente
   -> Usuario pulsa Generar planchas; el resultado puede volver a exportarse
```

## Cambios que disparan repacking

El sistema limpia el layout y pide generar de nuevo cuando cambia cualquiera de estos valores:

- Ancho o alto de un diseño.
- Cantidad.
- Rotación permitida.
- Ancho o alto de la plancha.
- Lista de diseños por carga, duplicado o eliminación.
