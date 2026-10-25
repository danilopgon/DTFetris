# Documentación de DTFetris

Esta carpeta reemplaza el BRS monolítico por documentos enfocados. Úsala como punto de entrada para encontrar rápido requisitos, reglas de dominio, arquitectura, flujos y verificación.

## Ruta rápida

| Necesitas entender | Lee |
|---|---|
| Qué producto se está construyendo y por qué | [product-requirements.md](./product-requirements.md) |
| Qué debe hacer el MVP | [functional-requirements.md](./functional-requirements.md) |
| Reglas del dominio y modelo de datos | [domain-and-data-model.md](./domain-and-data-model.md) |
| Stack, arquitectura y comunicación React/Rust | [architecture-and-stack.md](./architecture-and-stack.md) |
| Flujos de usuario y datos end-to-end | [user-flows.md](./user-flows.md) |
| Packing, multipágina y exportación | [packing-and-export.md](./packing-and-export.md) |
| Estrategia de testing | [testing-strategy.md](./testing-strategy.md) |
| Roadmap, riesgos y restricciones | [roadmap-risks.md](./roadmap-risks.md) |
| Incrementos, dependencias, aceptación y evidencia real | [roadmap.md](./roadmap.md) |
| Preparar, exportar y comprobar un trabajo real | [manual-dtf-check.md](./manual-dtf-check.md) |
| Decisión MaxRects y límites operativos | [packing-decision.md](./packing-decision.md) |
| Evidencia de entrega, decisiones y límites verificados | [final-review.md](./final-review.md) |
| Preparar trabajos con un agente MCP y carpeta de ingesta | [agent-integration.md](./agent-integration.md) |

## Estado del producto

| Campo | Valor |
|---|---|
| Versión de requisitos | MVP 0.1 |
| Estado | Implementación y verificación en [roadmap.md](./roadmap.md) |
| Uso previsto | Herramienta personal local, single-user, sin backend remoto |
| Producto | Aplicación de escritorio para automatizar la composición de planchas DTF |

## Cómo actualizar estos documentos

- Actualiza el documento específico del área afectada, no recrees un BRS único.
- Si cambian reglas físicas, coordenadas, tipos o persistencia, actualiza [domain-and-data-model.md](./domain-and-data-model.md) y [architecture-and-stack.md](./architecture-and-stack.md).
- Si cambia comportamiento visible para el usuario, actualiza [functional-requirements.md](./functional-requirements.md) y [user-flows.md](./user-flows.md).
- Si cambia la implementación de packing/exportación, actualiza [packing-and-export.md](./packing-and-export.md) y la cobertura esperada en [testing-strategy.md](./testing-strategy.md).
