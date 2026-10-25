# Comprobación de un trabajo DTF real

## Arranque

En Windows, instalar el MSI/NSIS generado en `src-tauri/target/release/bundle/`, o abrir `src-tauri/target/release/dtf-sheet-optimizer.exe`. Para desarrollo: `pnpm install --frozen-lockfile` y `pnpm dev`. Se necesita WebView2 y las dependencias de compilación de Tauri si se compila desde código.

## Preparar y comprobar

1. Importar uno o varios PNG/SVG propios. El original no se modifica: DTFetris crea una copia privada. En SVG, convertir texto a trazados y usar vectores autocontenidos. Límite: 20 MiB y 32 millones de píxeles por diseño.
2. Introducir las **medidas máximas** en cm enteros. Revisar el **arte visible** indicado: máximos 8 × 8 con arte 2:1 imprimen y reservan 8 × 4 cm, no 8 × 8. El tamaño sobrante no se usa como una celda vacía.
3. Editar cantidad, dimensiones y rotación; duplicar si hacen falta variantes. Confirmar antes de eliminar.
   Si el logo debe ir en otro color, escribir `#RRGGBB` en **Color único** al editar. Sustituye todos los colores de PNG/SVG manteniendo transparencia. **Usar colores originales** quita la sobrescritura sin reimportar. Revisar que el color deseado aparezca tanto en preview como en el PNG; el hexadecimal no sustituye la calibración del RIP/perfil de tinta.
4. Mantener 60 × 100 cm o cambiar ancho/alto y separación y pulsar **Aplicar tamaño**. Los nuevos trabajos usan **3 mm entre diseños**, configurable. El MVP no añade margen exterior ni sangrado; no simular separación aumentando los máximos del diseño, porque eso alteraría su escala.
5. Pulsar **Generar planchas**. Revisar cada hoja, copias, orientación, tamaño visible y métricas. Si alguna copia no cabe, corregir antes de exportar.
6. **Guardar trabajo** como JSON. No mover ni borrar `design-assets` de los datos locales de DTFetris: el JSON guarda referencias, no incorpora las imágenes. Guardar el JSON por sí solo no sirve como backup portable.
7. **Exportar PNG · 300 DPI**. Elegir un nombre nuevo. Para varias hojas se crean `nombre-001.png`, `nombre-002.png`, etc. Una exportación fallida no debe mostrar confirmación de éxito.
8. Abrir los PNG con un visor/editor que permita inspeccionar píxeles y densidad. Para 60 × 100 cm verificar **7087 × 11811 px** y aproximadamente **300 DPI** (11811 px/m). Fondo transparente, sin rectángulos de la UI ni estiramiento.
9. En el RIP, importar al **100%**, sin «ajustar a página» ni reescalado automático. Comprobar dimensiones físicas del arte, número de copias y que el espejo se aplica **una sola vez**, según el flujo del taller. DTFetris no aplica espejo, perfil de tinta ni base blanca.
10. Cerrar/abrir la app, **Abrir trabajo**, generar y exportar con otro nombre. Comparar medidas, cantidades y orientación con el primer PNG.

La impresión física es la última validación manual: medir una pieza conocida y revisar transparencia, color y corte antes de usar material para un trabajo completo. Las pruebas automáticas no acreditan calibración del RIP, perfil de impresora o resultado físico.

## Límites conocidos

- Dimensiones solicitadas enteras; arte derivado puede tener fracciones de cm.
- MaxRects es heurístico, no garantiza el mínimo de hojas. Hasta 1000 copias y presupuesto de complejidad; dividir trabajos que excedan el límite.
- Un raster destino no supera 100 millones de píxeles/32768 por lado. La plancha inicial requiere unos 335 MB RGBA, más temporales; cerrar otras aplicaciones si falta memoria.
- SVG con texto, imágenes anidadas, recursos externos, scripts, HTML o patrones se rechaza. Convertir a trazados o exportar un PNG previamente.
- Assets modificados manteniendo exactamente la geometría visible no se detectan por hash. Las copias privadas no se deben editar fuera de DTFetris.
- No hay guardado automático, paquete portable, gestión de color, generación de base blanca ni control de impresora.
