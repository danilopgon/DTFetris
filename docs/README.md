# Documentación de DTF Sheet Optimizer

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
| Roadmap dividido en cambios implementables con SDD | [sdd-roadmap-tasks.md](./sdd-roadmap-tasks.md) |

## Estado del producto

| Campo | Valor |
|---|---|
| Versión de requisitos | 0.3 |
| Estado | Draft |
| Uso previsto | Herramienta personal local, single-user, sin backend remoto |
| Producto | Aplicación de escritorio para automatizar la composición de planchas DTF |

## Cómo actualizar estos documentos

- Actualiza el documento específico del área afectada, no recrees un BRS único.
- Si cambian reglas físicas, coordenadas, tipos o persistencia, actualiza [domain-and-data-model.md](./domain-and-data-model.md) y [architecture-and-stack.md](./architecture-and-stack.md).
- Si cambia comportamiento visible para el usuario, actualiza [functional-requirements.md](./functional-requirements.md) y [user-flows.md](./user-flows.md).
- Si cambia la implementación de packing/exportación, actualiza [packing-and-export.md](./packing-and-export.md) y la cobertura esperada en [testing-strategy.md](./testing-strategy.md).
