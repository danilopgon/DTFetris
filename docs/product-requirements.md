# Requisitos de Producto

DTF Sheet Optimizer es una aplicación de escritorio local para automatizar la composición de planchas DTF y reducir el trabajo manual de preparación para impresión.

## Visión

La aplicación automatiza la distribución de diseños en una o varias hojas de impresión. Está orientada al uso personal en local y busca eliminar la dependencia de software de diseño externo para preparar planchas.

El objetivo es eliminar la necesidad de:

- Calcular grids manualmente.
- Duplicar diseños.
- Posicionar elementos uno a uno.
- Gestionar múltiples planchas.
- Aprovechar huecos manualmente.

## Problema

Actualmente, la preparación de una plancha DTF requiere:

1. Calcular cuantas unidades caben.
2. Crear guias.
3. Duplicar elementos.
4. Posicionar diseños.
5. Crear nuevas planchas cuando no queda espacio.
6. Ajustar huecos manualmente.
7. Exportar el resultado final.

Este proceso consume tiempo, es repetitivo y propenso a errores.

## Objetivos

### Objetivo principal

Reducir drásticamente el tiempo necesario para preparar una plancha DTF lista para impresión.

### Objetivos secundarios

- Maximizar el aprovechamiento del material.
- Reducir errores humanos.
- Automatizar la generación multipágina.
- Facilitar modificaciones de última hora.
- Eliminar dependencia de herramientas externas.

## Alcance MVP

### El sistema permitirá

- Cargar diseños PNG y SVG.
- Configurar dimensiones físicas.
- Configurar cantidades.
- Permitir o bloquear rotación.
- Generar automáticamente una o varias planchas.
- Visualizar el resultado.
- Exportar archivos PNG listos para impresión.
- Guardar trabajos localmente.

### Fuera del alcance inicial

- Gestión de clientes.
- Facturación.
- Gestión de pedidos.
- Integración con impresoras.
- Multiusuario.
- Backend remoto.

## Restricciones de producto

- Formatos soportados inicialmente: PNG y SVG.
- Tamaño máximo recomendado por diseño: 20 MB.
- La aplicación funciona completamente en local, sin conexión a internet.
- No requiere backend remoto ni autenticación.
- La exportación se realiza en Rust para evitar limitaciones de Canvas del navegador con imágenes grandes.
