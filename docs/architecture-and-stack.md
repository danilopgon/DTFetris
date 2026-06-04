# Arquitectura y Stack

DTFetris es una aplicación de escritorio Tauri 2 con frontend React/TypeScript y backend Rust para dominio, packing, persistencia y exportación.

## Stack detectado

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Tauri 2 |
| Frontend | Vite 5, React 18, TypeScript 5 |
| Estado | Zustand 5 |
| Preview | React Konva + Konva |
| Estilos | Tailwind CSS 3 |
| Backend local | Rust 2021 via Tauri commands |
| Serialización | `serde`, `serde_json` |
| Exportación PNG | `image` 0.25 |
| Rasterización SVG | `resvg` 0.43 con `tiny-skia` internamente |
| IDs | `uuid` con feature `v4` |
| Unit tests TS | Vitest, jsdom, React Testing Library |
| E2E | Playwright |

## Comandos principales

| Comando | Uso |
|---|---|
| `npm run dev` | Ejecuta `tauri dev`. |
| `npm run build` | Ejecuta `tauri build`. |
| `npm run test` | Ejecuta Vitest. |
| `npm run test:e2e` | Ejecuta Playwright. |
| `npm run lint` | Ejecuta ESLint sobre `src`. |
| `npm run format` | Formatea `src` con Prettier. |
| `cargo test` en `src-tauri` | Ejecuta tests Rust. |

## Comunicación Frontend-Rust

La comunicación entre React y Rust se realiza mediante Tauri commands.

```rust
#[tauri::command]
fn run_packing(
    designs: Vec<DesignInput>,
    sheet_width: f64,
    sheet_height: f64,
) -> Result<Vec<Sheet>, String> { ... }
```

```typescript
const sheets = await invoke<Sheet[]>('run_packing', {
  designs,
  sheetWidth: 55.0,
  sheetHeight: 100.0,
})
```

Tauri serializa y deserializa automáticamente entre JSON y structs Rust mediante `serde`. La conversión `camelCase` en TypeScript a `snake_case` en Rust es automática.

Los errores se modelan como `Result<T, String>` en Rust y se mapean a `Promise` rechazadas en TypeScript.

## Persistencia

La persistencia es responsabilidad exclusiva del backend Rust.

- Estado serializado como JSON con `serde_json`.
- Archivos de imagen almacenados en `app_data_dir`.
- Referencias almacenadas como rutas absolutas en disco.

Esto elimina la necesidad de `IndexedDB` y resuelve el problema de serialización de objetos `File` del navegador.

## Exportación PNG

La composición de la imagen final se realiza en Rust con la crate `image`, operando directamente sobre píxeles en memoria.

Para inputs SVG, la crate `image` no puede rasterizar directamente. El pipeline es:

1. `resvg` rasteriza el SVG a bitmap en memoria a la resolución de exportación.
2. `image` composita el bitmap resultante en la plancha junto al resto de diseños.

El output siempre es PNG, independientemente del formato de entrada.

## Estructura de código relevante

| Ruta | Responsabilidad |
|---|---|
| `src/App.tsx` | Shell principal de UI. |
| `src/components/` | Componentes React: lista, preview y métricas. |
| `src/store/useAppStore.ts` | Estado global Zustand. |
| `src/types/domain.ts` | Tipos compartidos del frontend. |
| `src/commands/index.ts` | Wrappers TypeScript para Tauri commands. |
| `src/utils/units.ts` | Conversiones de unidades. |
| `src-tauri/src/domain/` | Dominio Rust. |
| `src-tauri/src/commands/` | Tauri commands Rust. |
| `src-tauri/tauri.conf.json` | Configuración de la app Tauri. |
