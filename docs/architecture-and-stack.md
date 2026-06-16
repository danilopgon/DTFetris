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
| Diálogo de archivo | `@tauri-apps/plugin-dialog` 2 (`open()` con filtros PNG/SVG) |
| Backend local | Rust 2021 via Tauri commands |
| Plugin diálogo Rust | `tauri-plugin-dialog` 2 |
| Serialización | `serde`, `serde_json` |
| Exportación PNG | `image` 0.25 |
| Rasterización SVG | `resvg` 0.43 con `tiny-skia` internamente |
| IDs | `uuid` con feature `v4` |
| Unit tests TS | Vitest, jsdom, React Testing Library, `@testing-library/user-event` |
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
fn run_packing(request: PackingRequest) -> Result<PackingResult, String> { ... }
```

```typescript
const result = await invoke<PackingResult>('run_packing', { request })
```

El contrato de packing usa un único payload `PackingRequest` con `sheet` y `designs`, y devuelve `PackingResult` con `sheets` y `unplacedItems`. Tauri serializa y deserializa mediante `serde`; los structs Rust usan `#[serde(rename_all = "camelCase")]` para mantener las claves JSON del frontend (`widthCm`, `imagePath`, `unplacedItems`) aunque los campos internos sigan en `snake_case`.

Los valores de dominio que viajan por el comando son códigos técnicos estables. Por ejemplo, `UnplacedItem.reason` usa valores como `does_not_fit`, no textos de interfaz en español. La UI es responsable de mapear esos códigos a mensajes visibles.

Los errores se modelan como `Result<T, String>` en Rust y se mapean a `Promise` rechazadas en TypeScript.

### Comando de importación

```rust
#[tauri::command]
async fn import_design(
    app: AppHandle,
    source_path: String,
    width_cm: f64,
    height_cm: f64,
) -> Result<DesignInput, String> { ... }
```

```typescript
// El componente abre el diálogo primero, luego llama al comando:
const path = await open({ multiple: false, filters: [{ name: 'Imágenes', extensions: ['png', 'svg'] }] })
if (path) {
  const design = await invoke<DesignInput>('import_design', { sourcePath: path, widthCm, heightCm })
}
```

El flujo de importación es: el componente `DesignList` abre el selector de archivo via `@tauri-apps/plugin-dialog`, obtiene la ruta seleccionada, y llama al store action `importDesign({ sourcePath, widthCm, heightCm })`. El store action delega en el command wrapper `src/commands/index.ts`, que invoca `import_design` en Rust. Rust valida el archivo, detecta los límites visibles y copia el archivo a `app_data_dir/design-assets/{uuid}.{ext}`, devolviendo un `DesignInput` completo.

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
