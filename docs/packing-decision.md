# Decisión de packing MVP

## Spike (2026-10-25)

Se evaluó `rectangle-pack` 0.4.2 mediante su documentación pública:

- [RectToInsert](https://docs.rs/rectangle-pack/0.4.2/rectangle_pack/struct.RectToInsert.html): dimensiones `u32`, compatibles con centímetros enteros sin convertir a píxeles; la API documentada no expone política de rotación por ítem.
- [pack_rects](https://docs.rs/rectangle-pack/0.4.2/rectangle_pack/fn.pack_rects.html): recibe bins precreados en `BTreeMap`, devuelve éxito/error global y documenta un algoritmo inspirado en rectpack2D, no MaxRects. Haría falta adaptación para rotación por diseño, creación incremental de hojas y no ubicados por copia.

Se elige una implementación propia pequeña y sin dependencias adicionales de **MaxRects / Best Short Side Fit**, con división de todos los espacios libres intersectados y eliminación de espacios contenidos. Facilita auditar las invariantes físicas y los desempates. Es una heurística, no una garantía de mínimo número de hojas.

## Comportamiento y límites

- Footprint = bbox visible ajustado dentro de los máximos solicitados, más la separación virtual. Se corrigió la reserva de celda completa tras validar un encargo real. No hay acceso a disco, rasterizado ni conversión a píxeles.
- Contratos JSON existentes sin cambios. `run_packing` llama al dominio puro.
- Máximos/plancha configurables, enteros positivos hasta `u32::MAX`; tamaños visibles derivados fraccionarios. Punto fijo en cm a 0.0001 cm con rectángulos `u64` y áreas `u128`, redondeando hacia fuera. La plancha inicial es **60 × 100 cm**, no una invariante. Separación configurable; nuevos trabajos 0.3 cm, antiguos sin campo 0.
- Cantidad positiva en **todos** los diseños; petición vacía o cantidades mixtas con cero fallan con `invalid_quantity`. Dimensiones inválidas fallan con `invalid_dimensions`.
- IDs vacíos/blancos o repetidos fallan con `invalid_design_id` (error del comando, no nuevo código de no ubicación).
- Máximo **1.000 diseños y 1.000 copias totales**, comprobado antes de expandir cantidades. Máximo **5.000.000 operaciones** contabilizadas de búsqueda, división y comparación de contención. Superar cualquier límite devuelve `packing_limit_exceeded`, sin resultado parcial; incluso un trabajo de menos de 1.000 copias puede superar el presupuesto por fragmentación. Estos límites son operativos, no límites físicos ni garantía de tiempo real.
- Orden canónico: área descendente, lado mayor descendente, ID ascendente; copias consecutivas por diseño. Mejor posición por lado sobrante menor, lado sobrante mayor, índice de hoja, Y, X y preferencia sin rotar. Se buscan todas las hojas anteriores antes de abrir una nueva.
- IDs de hoja estables `sheet-1`, `sheet-2`, etc. El mismo conjunto de diseños produce el mismo JSON, aunque cambie el orden de entrada.
- Rotación exclusivamente de 90°, habilitada por diseño. Una copia que no cabe ni en una hoja vacía en sus orientaciones permitidas se conserva como `does_not_fit`, con `itemIndex` base cero por diseño. No se generan hojas vacías.

## Verificación

Tests unitarios en `domain/packing.rs`: ajuste exacto, mosaico completo, imposibles, rotación permitida/bloqueada, multipágina, cantidades, límites, dimensiones no finitas/decimales/fuera de rango, petición vacía, cero mixto, IDs duplicados/blancos y serialización. Ochenta fixtures pseudoaleatorios reproducibles verifican límites, ausencia de solapamientos, orientación, conservación de copias y JSON idéntico al repetir/invertir/rotar la lista de diseños. El comando tiene tests de resultado real y rechazo de petición inválida.

Las reglas y cobertura están integradas en `domain-and-data-model.md`, `packing-and-export.md` y `testing-strategy.md`. Ver [roadmap.md](./roadmap.md) para la evidencia vigente, incluidas las regresiones de ajuste visible fraccionario y separación derivadas del caso real.
