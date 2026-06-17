# Packing y Exportación

El packing se ejecuta en Rust usando centímetros como unidad de dominio. La exportación también se ejecuta en Rust para evitar los límites de memoria de Canvas en imágenes grandes.

## Packing automático

### Estrategia

MaxRects, implementado en Rust.

### Requisitos

- Evitar solapamientos.
- Respetar límites de la plancha.
- Usar la celda solicitada del diseño como rectángulo ocupado en v0.1; el tamaño visible proporcional es derivado y no reemplaza ese footprint salvo que una especificación futura lo cambie.
- Soportar rotación opcional por diseño.
- Crear nuevas planchas automáticamente cuando se agota el espacio.
- Priorizar el aprovechamiento de superficie.

### Transparencia

En v0.1, el rectángulo que entra a MaxRects representa la celda solicitada por el usuario en centímetros enteros. La caja completa del archivo PNG/SVG no debe usarse como fuente de proporción si incluye transparencia alrededor del arte.

Los límites visibles se detectan al importar el diseño en `v0-1-design-import` y se persisten como metadatos. MaxRects consume esos límites persistidos; no vuelve a detectar el área visible desde los archivos durante el packing.

Esto protege dos invariantes de negocio:

- La plancha final no deforma el arte por píxeles transparentes que no se imprimen.
- Las dimensiones pedidas por el cliente se conservan como celda ocupada; el arte visible se ajusta proporcionalmente dentro de esa celda.

Si una celda solicitada de 10 cm x 8 cm contiene arte visible con proporción 2:1, el footprint de packing sigue siendo 10 cm x 8 cm y el tamaño visible derivado es 10 cm x 5 cm.

## Estado temporal de recálculo

Hasta que el packing real reemplace el placeholder, editar, duplicar o eliminar diseños limpia las planchas existentes o marca el layout como pendiente. Estas mutaciones no deben llamar a `run_packing` ni crear placements falsos.

## Spike obligatorio antes de implementar MaxRects

Antes de la implementación, evaluar si existe alguna crate Rust de MaxRects adecuada o si la implementación propia es preferible dado el control que ofrece sobre el dominio en cm.

Criterios de evaluación:

- API compatible con el modelo de dominio.
- Soporte de rotación por ítem.
- Comportamiento en overflow con generación de nueva hoja.

## Multipágina

Cuando una plancha se completa, el algoritmo debe crear una nueva plancha automáticamente y continuar el packing con los diseños restantes.

## Rotación

La rotación se respeta por diseño mediante `canRotate` en TypeScript y `can_rotate` en Rust.

- Si `canRotate = true`, el algoritmo puede rotar para mejorar ocupación.
- Si `canRotate = false`, el algoritmo debe preservar orientación.

## Exportación PNG

La composición final se realiza en Rust con `image` y salida PNG a 300 DPI.

```text
pixels = centimeters * (dpi / 2.54)
```

### Pipeline de exportación

1. Rust recibe las planchas, los metadatos de límites visibles persistidos y `outputPath` desde Tauri command.
2. Rust lee los archivos originales desde disco.
3. Rust aplica el recorte o transformación de píxeles fuente indicada por los límites visibles guardados, ignorando padding transparente y ajustando el arte visible proporcionalmente dentro de la celda solicitada.
4. Inputs PNG se compositan con `image` usando el área visible guardada como base de escala.
5. Inputs SVG se rasterizan con `resvg`; la exportación usa la misma regla de umbral alpha y los límites visibles guardados desde importación.
6. `image` composita todos los bitmaps en la plancha final.
7. Rust escribe el PNG en disco.

## Razón de no usar Canvas

Canvas del navegador puede quedar limitado por memoria con planchas grandes. Una plancha de 55 x 100 cm a 300 DPI produce aproximadamente 220 MB sin comprimir.

Exportar en Rust da control directo sobre memoria, resolución y pipeline de composición.
