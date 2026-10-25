# Decisión de packing MVP

## Spike (2026-10-25)

Se evaluó `rectangle-pack` 0.4.2 mediante su documentación pública:

- [RectToInsert](https://docs.rs/rectangle-pack/0.4.2/rectangle_pack/struct.RectToInsert.html): dimensiones `u32`, compatibles con centímetros enteros sin convertir a píxeles; la API documentada no expone política de rotación por ítem.
- [pack_rects](https://docs.rs/rectangle-pack/0.4.2/rectangle_pack/fn.pack_rects.html): recibe bins precreados en `BTreeMap`, devuelve éxito/error global y documenta un algoritmo inspirado en rectpack2D, no MaxRects. Haría falta adaptación para rotación por diseño, creación incremental de hojas y no ubicados por copia.

Se elige una implementación propia pequeña y sin dependencias adicionales de **MaxRects / Best Short Side Fit**, con división de todos los espacios libres intersectados y eliminación de espacios contenidos. Facilita auditar las invariantes físicas y los desempates. Es una heurística, no una garantía de mínimo número de hojas.

## Comportamiento y límites

- Footprint = celda solicitada, no tamaño del bitmap ni contenido visible. No hay acceso a disco, rasterizado ni conversión a píxeles.
- Contratos JSON existentes sin cambios. `run_packing` llama al dominio puro.
- Dimensiones configurables, enteros positivos representables como `u32`; cálculos de área con `u64`, coordenadas siempre dentro de la hoja. El ejemplo inicial de esta implementación es **60 × 100 cm**, no un valor fijo del algoritmo.
- Cantidad positiva en **todos** los diseños; petición vacía o cantidades mixtas con cero fallan con `invalid_quantity`. Dimensiones inválidas fallan con `invalid_dimensions`.
- IDs vacíos/blancos o repetidos fallan con `invalid_design_id` (error del comando, no nuevo código de no ubicación).
- Máximo **1.000 diseños y 1.000 copias totales**, comprobado antes de expandir cantidades. Máximo **5.000.000 operaciones** contabilizadas de búsqueda, división y comparación de contención. Superar cualquier límite devuelve `packing_limit_exceeded`, sin resultado parcial; incluso un trabajo de menos de 1.000 copias puede superar el presupuesto por fragmentación. Estos límites son operativos, no límites físicos ni garantía de tiempo real.
- Orden canónico: área descendente, lado mayor descendente, ID ascendente; copias consecutivas por diseño. Mejor posición por lado sobrante menor, lado sobrante mayor, índice de hoja, Y, X y preferencia sin rotar. Se buscan todas las hojas anteriores antes de abrir una nueva.
- IDs de hoja estables `sheet-1`, `sheet-2`, etc. El mismo conjunto de diseños produce el mismo JSON, aunque cambie el orden de entrada.
- Rotación exclusivamente de 90°, habilitada por diseño. Una copia que no cabe ni en una hoja vacía en sus orientaciones permitidas se conserva como `does_not_fit`, con `itemIndex` base cero por diseño. No se generan hojas vacías.

## Verificación

Tests unitarios en `domain/packing.rs`: ajuste exacto, mosaico completo, imposibles, rotación permitida/bloqueada, multipágina, cantidades, límites, dimensiones no finitas/decimales/fuera de rango, petición vacía, cero mixto, IDs duplicados/blancos y serialización. Ochenta fixtures pseudoaleatorios reproducibles verifican límites, ausencia de solapamientos, orientación, conservación de copias y JSON idéntico al repetir/invertir/rotar la lista de diseños. El comando tiene tests de resultado real y rechazo de petición inválida.

Las reglas y cobertura están integradas en `domain-and-data-model.md`, `packing-and-export.md` y `testing-strategy.md`. Evidencia final: `cargo test` pasa 63 tests del producto, incluidos los 15 tests de packing. Ver [roadmap.md](./roadmap.md) para la verificación completa.
