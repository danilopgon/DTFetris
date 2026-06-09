# Flujos de Usuario y Datos

Estos flujos muestran cómo viajan los datos entre usuario, frontend y backend Rust.

## Cargar diseños

```text
Usuario carga PNG o SVG
  -> Tauri copia el archivo a app_data_dir
  -> Frontend almacena la ruta en disco como string
  -> Sistema detecta los límites visibles e ignora padding transparente para medidas físicas
```

## Configurar y generar planchas

```text
Usuario configura diseños y pulsa "Generar"
  -> invoke('run_packing', { designs, sheetWidth, sheetHeight })
  -> Rust ejecuta MaxRects en centímetros sobre el área visible del diseño
  -> Rust devuelve Vec<Sheet> con placements
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

El sistema recalcula automáticamente todas las planchas cuando cambia cualquiera de estos valores:

- Ancho o alto de un diseño.
- Cantidad.
- Rotación permitida.
- Ancho o alto de la plancha.
- Lista de diseños por carga, duplicado o eliminación.
