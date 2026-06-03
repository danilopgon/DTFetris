# AGENTS.md

Este archivo es el router para futuros agentes que trabajen en DTF Sheet Optimizer. Antes de cambiar código, ubicá el documento correcto y verificá si la regla ya existe.

## Producto y stack

DTF Sheet Optimizer es una aplicación de escritorio local, single-user, para automatizar la composición de planchas DTF.

| Área | Stack actual |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend | Vite 5 + React 18 + TypeScript 5 |
| Estado | Zustand 5 |
| Preview | React Konva + Konva |
| Estilos | Tailwind CSS 3 |
| Backend local | Rust 2021, Tauri commands |
| Persistencia | `std::fs` + `serde_json` en backend Rust |
| Exportación | `image` 0.25, `resvg` 0.43 |
| Tests | Vitest, React Testing Library, Playwright, `cargo test` |

## Índice de documentos

| Tema | Documento |
|---|---|
| Mapa general de docs | [docs/README.md](docs/README.md) |
| Visión, problema, objetivos y alcance | [docs/product-requirements.md](docs/product-requirements.md) |
| Requisitos funcionales RF-001 a RF-014 | [docs/functional-requirements.md](docs/functional-requirements.md) |
| Reglas de dominio, coordenadas y modelos TS/Rust | [docs/domain-and-data-model.md](docs/domain-and-data-model.md) |
| Stack, arquitectura, Tauri commands y persistencia | [docs/architecture-and-stack.md](docs/architecture-and-stack.md) |
| Flujos de usuario y datos | [docs/user-flows.md](docs/user-flows.md) |
| MaxRects, multipágina, rotación y exportación PNG | [docs/packing-and-export.md](docs/packing-and-export.md) |
| Testing esperado por capa | [docs/testing-strategy.md](docs/testing-strategy.md) |
| Roadmap, riesgos y restricciones | [docs/roadmap-risks.md](docs/roadmap-risks.md) |

## Router por tipo de tarea

| Si vas a trabajar en | Lee primero | Archivos probables |
|---|---|---|
| Requisitos o alcance de producto | `docs/product-requirements.md`, `docs/functional-requirements.md` | `docs/*.md` |
| Modelo de dominio o unidades | `docs/domain-and-data-model.md` | `src/types/domain.ts`, `src-tauri/src/domain/` |
| Packing | `docs/packing-and-export.md`, `docs/testing-strategy.md` | `src-tauri/src/domain/packing.rs` |
| Tauri commands | `docs/architecture-and-stack.md`, `docs/user-flows.md` | `src/commands/index.ts`, `src-tauri/src/commands/` |
| Persistencia local | `docs/architecture-and-stack.md`, `docs/user-flows.md` | `src-tauri/src/commands/persistence.rs` |
| Exportación PNG/SVG | `docs/packing-and-export.md` | `src-tauri/src/commands/export.rs` |
| UI React | `docs/functional-requirements.md`, `docs/user-flows.md` | `src/App.tsx`, `src/components/`, `src/store/useAppStore.ts` |
| Tests | `docs/testing-strategy.md` | `src/**/*.test.ts`, `tests/e2e/`, Rust `#[cfg(test)]` |
| Roadmap o priorización | `docs/roadmap-risks.md` | `docs/roadmap-risks.md` |

## Convenciones de dominio

- El dominio usa centímetros como fuente de verdad.
- Nunca hagas packing en píxeles.
- Convertí cm a px solo para preview o exportación.
- No uses `localStorage` ni `IndexedDB` para trabajos persistidos.
- Persistí rutas de imagen en disco, no objetos `File`.
- La deformación de imagen nunca debe ser automática; requiere confirmación explícita.
- Las dimensiones de plancha son configurables y no deben estar hardcodeadas en dominio.

## Comandos útiles

| Comando | Uso |
|---|---|
| `npm run dev` | Desarrollo Tauri. |
| `npm run build` | Build de la app. |
| `npm run test` | Tests unitarios TypeScript. |
| `npm run test:e2e` | Tests E2E Playwright. |
| `npm run lint` | Lint frontend. |
| `npm run format` | Formato frontend. |
| `cargo test` desde `src-tauri` | Tests Rust. |

## Antes de editar

- Verifica el documento de requisitos correspondiente.
- Si cambiás comportamiento, actualizá docs junto al código.
- Si cambiás tipos compartidos, mantené alineados TypeScript y Rust.
- Si agregás reglas de dominio, agregalas a `docs/domain-and-data-model.md`.
- Si cambiás packing/exportación, actualizá `docs/packing-and-export.md` y `docs/testing-strategy.md`.
