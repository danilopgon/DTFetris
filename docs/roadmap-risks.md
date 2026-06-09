# Roadmap, Riesgos y Restricciones

Este documento concentra la secuencia de entrega, restricciones y riesgos técnicos que deben revisarse antes de implementar.

## Roadmap

### v0.1

- Estructura del proyecto Tauri + Vite + React.
- Carga de diseños y copia a `app_data_dir`.
- Packing básico en Rust para single sheet.
- Preview básica con Konva.
- Unit tests de packing en Rust desde el inicio.
- Unit tests de conversión cm a px con Vitest.

### v0.2

- Multipágina automática.
- Rotación.
- Métricas por plancha y globales.
- Validación de aspect ratio.
- Tests de integración de Tauri commands.
- Component tests básicos con React Testing Library.

### v0.3

- Exportación PNG en Rust con crate `image`.
- E2E de exportación con Playwright + WebDriver.

### v0.4

- Persistencia local con save/load.
- E2E de guardado y recuperación.

### v1.0

- Cobertura completa en todas las capas.
- Visual regression estable.
- Aplicación lista para uso productivo.

## Riesgos técnicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| MaxRects propio puede crecer en complejidad | Packing incorrecto o difícil de mantener | Hacer spike de crates antes de implementar. |
| Exportación a 300 DPI consume mucha memoria | Fallos con planchas grandes | Mantener exportación en Rust y testear inputs grandes. |
| SVG sin dimensiones explícitas | Aspect ratio incorrecto | Extraer proporción desde `viewBox`. |
| Padding transparente en diseños importados | Tamaño impreso incorrecto o métricas de ocupación infladas | Detectar límites visibles y aplicar dimensiones físicas al arte visible. |
| Persistencia de objetos `File` del navegador | Estado imposible de serializar | Persistir rutas en `app_data_dir` desde backend Rust. |
| Cambios visuales en preview | Regresiones difíciles de detectar | Usar snapshots de Playwright y actualizarlos solo cuando el cambio sea deliberado. |

## Restricciones vigentes

- La aplicación es local y single-user.
- No hay backend remoto ni autenticación.
- Los formatos iniciales son PNG y SVG.
- El tamaño máximo recomendado por diseño es 20 MB.
- La exportación se realiza en Rust, no en Canvas.
- Las dimensiones físicas en cm son la fuente de verdad.
- Las dimensiones configuradas se aplican al arte visible; la transparencia no ocupa plancha.
