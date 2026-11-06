# Riesgos y restricciones

La secuencia de entrega y el estado verificable viven únicamente en [roadmap.md](./roadmap.md).

| Riesgo | Mitigación |
|---|---|
| Packing incorrecto | MaxRects puro en cm; tests de límites, no solapamiento, conteo y determinismo con fixtures reproducibles. |
| Memoria a 300 DPI | Una plancha a la vez; límites de raster y recursos antes de decodificar; salida predeterminada real probada. No equivale a garantizar ejecución en equipos sin memoria disponible. |
| PNG con padding o canales RGB invisibles | Recorte persistido; escalado proporcional y remuestreo con alpha premultiplicado. |
| SVG incompleto o con recursos complejos | Validación compartida entre importación/guardado/exportación. Rechazar funciones no soportadas en vez de omitirlas silenciosamente. |
| Diseños desaparecidos/corruptos | Copia privada en datos de la app; inspección al guardar/abrir/exportar; un error no reemplaza el trabajo actual. |
| Resultado asíncrono antiguo | Guardas de diseños/configuración y revisión de trabajo; acciones excluyentes en UI durante operaciones. |
| Imprimir trabajo incompleto | Aviso de copias imposibles; exportación exige todas las cantidades pedidas y layout vigente. |
| Sobrescribir datos | PNG con creación exclusiva; JSON con temporal privado y reemplazo atómico, preservando el anterior si falla. |

## Restricciones

- Local, single-user, sin autenticación ni servidor remoto.
- PNG/SVG de entrada; exportación PNG RGBA a 300 DPI en Rust, no Canvas.
- Centímetros como fuente de verdad. Plancha y celdas solicitadas: enteros positivos configurables; medidas visibles derivadas pueden ser fraccionarias.
- Las medidas solicitadas son máximos. El footprint es el bbox visible ajustado proporcionalmente; el padding no determina escala.
- Separación configurable entre piezas (nuevos trabajos: 3 mm). No hay margen exterior automático ni sangrado. El MVP no controla impresoras/RIP, perfiles de tinta o base blanca; configurar material y RIP según el trabajo real.
- No se aplica espejo automáticamente. La política de espejo debe decidirse en el RIP para evitar duplicarlo.
