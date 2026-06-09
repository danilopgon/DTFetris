# Packing y Exportación

El packing se ejecuta en Rust usando centímetros como unidad de dominio. La exportación también se ejecuta en Rust para evitar los límites de memoria de Canvas en imágenes grandes.

## Packing automático

### Estrategia

MaxRects, implementado en Rust.

### Requisitos

- Evitar solapamientos.
- Respetar límites de la plancha.
- Usar las dimensiones del arte visible como rectángulo ocupado; el padding transparente del archivo no ocupa superficie de plancha.
- Soportar rotación opcional por diseño.
- Crear nuevas planchas automáticamente cuando se agota el espacio.
- Priorizar el aprovechamiento de superficie.

### Transparencia

El rectángulo que entra a MaxRects representa el área visible del diseño en centímetros. La caja completa del archivo PNG/SVG no debe usarse como superficie ocupada si incluye transparencia alrededor del arte.

Esto protege dos invariantes de negocio:

- La plancha final no reserva material por píxeles transparentes que no se imprimen.
- Las dimensiones pedidas por el cliente se aplican al arte visible, no al canvas del archivo.

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

1. Rust recibe las planchas y `outputPath` desde Tauri command.
2. Rust lee los archivos originales desde disco.
3. Rust recorta o normaliza el área visible, ignorando padding transparente.
4. Inputs PNG se compositan con `image` usando el área visible como base de escala.
5. Inputs SVG se rasterizan primero con `resvg` y se ajustan a sus límites visibles.
6. `image` composita todos los bitmaps en la plancha final.
7. Rust escribe el PNG en disco.

## Razón de no usar Canvas

Canvas del navegador puede quedar limitado por memoria con planchas grandes. Una plancha de 55 x 100 cm a 300 DPI produce aproximadamente 220 MB sin comprimir.

Exportar en Rust da control directo sobre memoria, resolución y pipeline de composición.
