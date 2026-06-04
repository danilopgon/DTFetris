# AGENTS.md

Este archivo es el router operativo para futuros agentes que trabajen en DTFetris. Antes de cambiar código, localiza el documento correcto y verifica si la regla ya existe.

## Producto y stack

DTFetris es una aplicación de escritorio local, single-user, para automatizar la composición de planchas DTF.

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

## Documentación

Usa [docs/README.md](docs/README.md) como índice y router documental único. No dupliques aquí listas de documentos ni rutas por tipo de tarea.

## Idioma de la interfaz

- Toda la UI debe estar en español: labels, botones, mensajes de error, confirmaciones, estados vacíos, tooltips, placeholders y strings de accesibilidad (`aria-label`, `alt`, etc.).
- No implementar i18n ni inglés como fallback. El español es el único idioma de la app.

## Convenciones de dominio

- El dominio usa centímetros como fuente de verdad.
- Nunca hagas packing en píxeles.
- Convierte cm a px solo para preview o exportación.
- No uses `localStorage` ni `IndexedDB` para trabajos persistidos.
- Persiste rutas de imagen en disco, no objetos `File`.
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
- Si cambias comportamiento, actualiza docs junto al código.
- Si cambias tipos compartidos, mantén alineados TypeScript y Rust.
- Si agregas reglas de dominio, agrégalas a `docs/domain-and-data-model.md`.
- Si cambias packing/exportación, actualiza `docs/packing-and-export.md` y `docs/testing-strategy.md`.
