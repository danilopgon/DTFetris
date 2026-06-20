# Flujos de Usuario y Datos

Estos flujos muestran cómo viajan los datos entre usuario, frontend y backend Rust.

## Importar diseño

```text
Usuario introduce ancho y alto solicitados en cm enteros en el panel lateral
  -> Usuario pulsa "Importar diseño"
  -> Se abre el selector de archivo (filtro: PNG y SVG únicamente)
  -> Si el usuario cancela: flujo termina, no hay cambios
  -> Si el usuario selecciona un archivo:
       -> Frontend llama a store.importDesign({ sourcePath, widthCm, heightCm })
       -> Rust valida extensión, lee el archivo y detecta los límites visibles
       -> Rust copia el archivo a app_data_dir/design-assets/{uuid}.{ext}
       -> Rust devuelve DesignInput con format, visibleBounds y cm confirmados
       -> Frontend añade el diseño a la lista (acumulativo, no reemplaza)
  -> Si hay error: se muestra mensaje en español; la lista no cambia

Errores posibles y mensajes en español:
  - invalid_format  → "Formato no soportado. Solo se aceptan archivos PNG y SVG."
  - empty_artwork   → "El diseño está vacío o es completamente transparente."
  - file_not_found  → "No se encontró el archivo seleccionado."
  - copy_failed     → "Error al guardar el diseño. Comprueba el espacio en disco."
```

## Configurar y generar planchas

```text
Usuario configura diseños y pulsa "Generar"
  -> invoke('run_packing', { designs, sheetWidth, sheetHeight })
  -> Rust ejecuta MaxRects en centímetros sobre el área visible del diseño
  -> Rust devuelve Vec<Sheet> con placements
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
  -> invoke('export_png', { sheets, outputPath })
  -> Rust lee archivos originales del disco
  -> Si PNG: image composita directamente
  -> Si SVG: resvg rasteriza a bitmap en memoria, image composita el resultado
  -> Rust escala el arte visible a las dimensiones configuradas y compone la plancha final a 300 DPI
  -> Rust escribe PNG final en disco
```

## Guardar trabajo

```text
Usuario guarda el trabajo
  -> invoke('save_job', { job })
  -> Rust serializa a JSON con serde_json
  -> Rust escribe el JSON en app_data_dir
```

## Recuperar trabajo

```text
Usuario abre un trabajo guardado
  -> invoke('load_job', { path })
  -> Rust lee JSON desde disco
  -> Rust deserializa el estado
  -> Frontend recupera diseños, configuración y planchas
```

## Cambios que disparan repacking

Mientras `run_packing` siga siendo placeholder, el sistema no fabrica posiciones ni invoca packing desde las mutaciones. En su lugar marca el layout como pendiente de recálculo cuando cambia cualquiera de estos valores:

- Ancho o alto de un diseño.
- Cantidad.
- Rotación permitida.
- Ancho o alto de la plancha.
- Lista de diseños por carga, duplicado o eliminación.
