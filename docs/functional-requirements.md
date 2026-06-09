# Requisitos Funcionales

Estos requisitos describen el comportamiento visible del MVP. Las reglas técnicas relacionadas viven en [domain-and-data-model.md](./domain-and-data-model.md), [architecture-and-stack.md](./architecture-and-stack.md) y [packing-and-export.md](./packing-and-export.md).

## RF-001 - Carga de diseños

El usuario podrá cargar uno o varios archivos PNG o SVG.

El archivo se copiará al directorio de datos de la aplicación (`app_data_dir`) mediante la API de filesystem de Tauri. La referencia almacenada en el estado será la ruta en disco, no el objeto `File` del navegador.

Al cargar un diseño, el sistema deberá identificar sus límites visibles. La transparencia alrededor del arte no formará parte del tamaño físico impreso ni de la superficie ocupada en la plancha.

## RF-002 - Configuración de diseño

Cada diseño permitirá configurar:

- Nombre.
- Ancho en cm.
- Alto en cm.
- Cantidad.
- Rotación permitida.

Las dimensiones configuradas representan el tamaño físico del arte visible. Si el archivo contiene padding transparente, ese padding no reduce el tamaño final del arte ni reserva superficie adicional.

## RF-003 - Duplicado de diseño

El usuario podrá duplicar un diseño existente sin volver a cargar el archivo.

La copia heredara:

- Ruta de imagen en disco, como referencia compartida y sin copiar el archivo.
- Dimensiones.
- Configuración.

Al compartir la referencia de ruta, la persistencia del diseño duplicado es coherente con la del original. No existe el problema de referencias a `File` volátiles.

## RF-004 - Edición

El usuario podrá modificar en cualquier momento:

- Ancho.
- Alto.
- Cantidad.
- Rotación permitida.

## RF-005 - Eliminación

El usuario podrá eliminar diseños de la lista.

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

La composición se realizará en Rust con la crate `image`, sin pasar por Canvas del navegador. Esto evita las limitaciones de memoria del entorno web para imágenes de gran tamaño. Una plancha de 55 x 100 cm a 300 DPI produce aproximadamente 220 MB sin comprimir.

## RF-011 - Persistencia local

Los trabajos podrán guardarse y recuperarse localmente.

El estado se serializa como JSON mediante `serde_json` y se escribe en disco con `std::fs`. Las referencias a imágenes se almacenan como rutas absolutas al `app_data_dir`.

No se utiliza `localStorage` ni `IndexedDB`. La persistencia es responsabilidad del backend Rust, lo que elimina el problema de serialización de objetos `File`.

## RF-012 - Repacking automático

Cualquier modificación en diseños o configuración de plancha recalculará automáticamente todas las planchas.

## RF-013 - Configuración de plancha

El usuario podrá configurar:

- Ancho de plancha en cm.
- Alto de plancha en cm.

No existirán dimensiones hardcodeadas en el dominio.

## RF-014 - Validación de proporciones

El sistema detectará automáticamente la relación de aspecto original de la imagen en el momento de la carga.

Si las dimensiones configuradas deforman el diseño:

- Se mostrara una advertencia.
- Se ofrecerá ajustar automáticamente para mantener la proporción.

La deformación deliberada requerirá confirmación explícita del usuario.

El aspect ratio original se almacena en el modelo como campo explícito e inmutable y se calcula en el momento de la carga a partir del ancho y alto de los límites visibles detectados. Para SVG, el `viewBox` puede definir el espacio inicial de rasterización, pero la proporción final sale de los límites visibles después de rasterizar y aplicar el umbral alpha.
