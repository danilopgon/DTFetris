# Requisitos Funcionales

Estos requisitos describen el comportamiento visible del MVP. Las reglas técnicas relacionadas viven en [domain-and-data-model.md](./domain-and-data-model.md), [architecture-and-stack.md](./architecture-and-stack.md) y [packing-and-export.md](./packing-and-export.md).

## RF-001 - Importación de diseños

El usuario puede seleccionar uno o varios archivos PNG/SVG por operación. La celda confirmada se aplica inicialmente a todos y después puede editarse por diseño. El frontend importa secuencialmente para limitar memoria; cada éxito se añade acumulativamente. Si alguno falla, conserva los éxitos y mantiene solo los fallidos seleccionados para reintentar.

Antes de confirmar la importación, el usuario debe introducir el ancho y alto solicitados en centímetros enteros para la celda del diseño. El sistema no infiere dimensiones físicas a partir del `viewBox` ni de los metadatos del archivo.

El archivo se copia al directorio de datos de la aplicación (`app_data_dir/design-assets/{uuid}.{ext}`) mediante el comando `import_design` en Rust. La referencia almacenada en el estado será la ruta copiada en disco, no el objeto `File` del navegador ni la ruta original del usuario.

Al importar un diseño, el sistema detecta los límites visibles (bounding box sin padding transparente) usando la crate `image` para PNG y `resvg` para SVG. La transparencia alrededor del arte no forma parte del tamaño físico impreso ni de la superficie ocupada en la plancha.

Si el archivo está ausente, tiene formato no soportado, es malformado, o el área visible es completamente transparente, el sistema rechaza la importación con un mensaje de error en español y no añade ningún diseño a la lista.

Límites del MVP: 20 MiB, 32 millones de píxeles y 16384 píxeles por lado por archivo. Los SVG deben ser autocontenidos y convertir texto a trazados; no se admiten imágenes anidadas, contenido HTML, scripts ni patrones. Se rechazan estas funciones, no se eliminan silenciosamente del resultado. Las mismas reglas se aplican al guardar, abrir y exportar.

## RF-002 - Configuración de diseño

Cada diseño permitirá configurar:

- Nombre.
- Ancho solicitado en cm enteros.
- Alto solicitado en cm enteros.
- Cantidad mínima `1`.
- Rotación permitida.

Las dimensiones configuradas representan la celda solicitada por el usuario. Si la relación de esa celda no coincide con la relación del arte visible, el arte se ajusta proporcionalmente dentro de la celda sin deformarse; las dimensiones solicitadas no se reemplazan por el tamaño visible derivado.

## RF-003 - Duplicado de diseño

El usuario podrá duplicar un diseño existente sin volver a cargar el archivo.

La copia hereda:

- Ruta de imagen en disco, como referencia compartida y sin copiar el archivo.
- Dimensiones solicitadas.
- Cantidad, rotación permitida y metadatos del arte.

La copia recibe un identificador nuevo y un nombre distinguible.

Al compartir la referencia de ruta, la persistencia del diseño duplicado es coherente con la del original. No existe el problema de referencias a `File` volátiles.

## RF-004 - Edición

El usuario podrá modificar en cualquier momento:

- Ancho.
- Alto.
- Cantidad.
- Rotación permitida.

La edición rechaza dimensiones fraccionarias, cero o negativas. La cantidad `0` no se usa para ocultar diseños; una futura exclusión deberá ser un control explícito.

## RF-005 - Eliminación

El usuario podrá eliminar diseños de la lista solo después de confirmar la acción. Cancelar la confirmación no modifica la lista.

## RF-006 - Packing automático

El sistema distribuirá automáticamente los diseños en las planchas necesarias utilizando MaxRects implementado en Rust.

## RF-007 - Multipágina

Cuando una plancha se complete, se generará una nueva automáticamente y el packing continuará en la siguiente hoja.

## RF-008 - Vista previa

El usuario podrá visualizar todas las planchas generadas. El renderizado se realizará con React Konva, convirtiendo las coordenadas en cm a píxeles solo para visualización.

## RF-009 - Métricas

El sistema mostrará métricas por plancha y globales:

- Número de planchas generadas.
- Área utilizada en cm2.
- Área libre en cm2.
- Porcentaje de ocupación.

El área utilizada se calculará sobre el rectángulo físico del arte visible colocado en la plancha, no sobre el canvas transparente del archivo fuente.

## RF-010 - Exportación

El sistema permitirá exportar planchas como PNG a 300 DPI.

La composición se realizará en Rust con la crate `image`, sin pasar por Canvas del navegador. Una plancha predeterminada de 60 × 100 cm a 300 DPI produce 7087 × 11811 píxeles y aproximadamente 335 MB RGBA sin comprimir. Las dimensiones siguen siendo configurables.

## RF-011 - Persistencia local

Los trabajos podrán guardarse y recuperarse localmente.

El estado se serializa como JSON mediante `serde_json` y se escribe en disco con `std::fs`. Las referencias a imágenes se almacenan como rutas absolutas al `app_data_dir`.

No se utiliza `localStorage` ni `IndexedDB`. La persistencia es responsabilidad del backend Rust, lo que elimina el problema de serialización de objetos `File`.

## RF-012 - Invalidación y recálculo seguro

Importar, añadir, editar, duplicar, eliminar o cambiar la plancha invalida y limpia la composición. El botón **Generar planchas** ejecuta el packing real. Se elige recálculo explícito para no lanzar trabajos pesados por cada cambio de formulario. Una respuesta obsoleta no sustituye al estado actualizado. Exportar está bloqueado hasta generar un layout vigente y ubicar todas las copias.

## RF-013 - Configuración de plancha

El usuario podrá configurar:

- Ancho de plancha en cm.
- Alto de plancha en cm.

No existirán dimensiones hardcodeadas en el dominio.

## RF-014 - Validación de proporciones

El sistema detectará automáticamente la relación de aspecto original de la imagen en el momento de la carga.

La UI indica la celda solicitada y el tamaño visible derivado. Si las proporciones difieren, el arte se centra y ajusta proporcionalmente dentro de la celda; nunca se estira. El MVP no ofrece deformación deliberada (por tanto no requiere confirmación de una operación que no existe).

El aspect ratio original se almacena en el modelo como campo explícito e inmutable y se calcula en el momento de la carga a partir del ancho y alto de los límites visibles detectados. Para SVG, el `viewBox` puede definir el espacio inicial de rasterización, pero la proporción final sale de los límites visibles después de rasterizar y aplicar el umbral alpha.
