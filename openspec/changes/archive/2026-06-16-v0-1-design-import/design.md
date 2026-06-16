# Design: v0.1 Design Import

## Technical Approach

Add a backend-owned import pipeline: React chooses one PNG/SVG, collects user-confirmed physical `widthCm` and `heightCm`, then calls Rust to copy the asset into `app_data_dir`, detect visible artwork bounds, and return a complete `DesignInput`. Pixels are used only for source quality and visible-bounds detection; centimeters remain the domain truth. Also update roadmap status for `v0-1-domain-model` as verified-but-blocked, not completed.

## Architecture Decisions

| Area | Options considered | Decision and rationale |
|------|--------------------|------------------------|
| File selection | Browser `File`, Tauri dialog, Rust receives arbitrary path | Use `@tauri-apps/plugin-dialog` for one path, then Rust command owns validation/copy/analysis. Avoids volatile `File` objects while keeping UI simple. |
| Import command | Infer dimensions, prompt after import, require dimensions in request | `import_design({ sourcePath, widthCm, heightCm })`. The user always confirms centimeters; SVG `viewBox` never becomes physical size. |
| Duplicate source imports | Deduplicate by source/hash, overwrite, always copy | Always copy with `uuid`-based filename under `app_data_dir/design-assets/`; re-importing the same source creates a distinct persisted path. |
| Visible bounds | Frontend canvas, Rust PNG only, Rust PNG+SVG | Rust detects both. PNG decodes via `image`; SVG rasterizes via `resvg` then scans alpha `>= 3/255`. This keeps later packing/export independent from source padding. |
| Aspect validation | Full warning flow now, store original ratio only | Store `originalAspectRatio = visibleWidthPx / visibleHeightPx`; deformation warnings remain for `v0-2-aspect-ratio-validation`. |

## Data Flow

```text
DesignList UI ──open single file──→ dialog plugin
     │
     ├─ collect confirmed cm dimensions
     ↓
src/commands.importDesign ──→ import_design Rust command
     ↓                         ├─ validate extension/content
Zustand addDesign              ├─ copy to app_data_dir/design-assets/{uuid}.{ext}
                               └─ detect visible bounds and return DesignInput
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `docs/sdd-roadmap-tasks.md` | Modify | Mark `v0-1-domain-model` as blocked/in progress with verification caveat before import. |
| `src/types/domain.ts` | Modify | Add `VisibleBounds`, `ImageFormat`, and optional/required `visibleBounds` metadata to `DesignInput`. |
| `src/commands/index.ts` | Modify | Add `importDesign(request): Promise<DesignInput>` wrapper and stable error-code typing. |
| `src/store/useAppStore.ts` | Modify | Keep cumulative `addDesign`; optionally expose `importedDesigns` helper only if UI needs loading/error state. |
| `src/components/DesignList/DesignList.tsx` | Modify | Add Spanish import entry point, dimension fields/confirmation, loading and mapped error messages. |
| `src-tauri/src/domain/design.rs` | Modify | Mirror TS metadata using `#[serde(rename_all = "camelCase")]`. |
| `src-tauri/src/commands/import.rs` | Create | Implement validation, app-data copy, visible-bounds detection, and error codes. |
| `src-tauri/src/lib.rs`, `commands/mod.rs` | Modify | Register `import_design` and dialog plugin if needed. |
| `package.json`, `src-tauri/Cargo.toml` | Modify | Add Tauri dialog package/plugin; Rust already has `image`, `resvg`, `uuid`. |
| Docs: requirements/domain/architecture/user-flows/testing | Modify | Align one-at-a-time cumulative import, confirmed cm dimensions, app-data copies, and test expectations. |

## Interfaces / Contracts

```ts
type ImageFormat = 'png' | 'svg'
type VisibleBounds = { xPx: number; yPx: number; widthPx: number; heightPx: number; sourceWidthPx: number; sourceHeightPx: number }
type ImportDesignRequest = { sourcePath: string; widthCm: Cm; heightCm: Cm }
type ImportDesignErrorCode = 'invalid_format' | 'invalid_dimensions' | 'file_not_found' | 'copy_failed' | 'empty_artwork' | 'metadata_failed'
```

`DesignInput` gains `format: ImageFormat` and `visibleBounds: VisibleBounds`. Rust returns technical codes only; UI maps them to Spanish. Empty/fully transparent artwork is rejected as `empty_artwork`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Rust unit | PNG transparent padding, SVG raster bounds, empty artwork, duplicate copy names | Fixture images/SVG strings plus temp directories around import helpers. |
| Rust command | Contract serialization, app-data copy path, stable errors | Focused `cargo test`; keep Tauri app-handle tests minimal if setup grows. |
| TS unit | Wrapper payload, store cumulative imports, error-code mapping | Vitest with mocked `invoke` and store reset. |
| Component | Single-file import flow and Spanish states | RTL with mocked dialog/wrapper if line budget allows. |
| E2E | Smoke import PNG/SVG | Defer broad E2E to later roadmap scope; do not treat it as a current Vitest collection blocker. |

## Migration / Rollout

No persisted-job migration required; local persistence is still placeholder. Existing sample designs without `visibleBounds` may need test fixture updates only.

## Slicing Under 400 Lines

1. Roadmap/status housekeeping only. 2. Rust domain/import helpers and tests. 3. Command registration + TS wrapper/store tests. 4. Minimal UI + docs. Because delivery strategy is `ask-always`, confirm chained PRs before apply if task planning forecasts over 400 changed lines.

## Risks / Tradeoffs

- SVG rasterization size must be deterministic; use intrinsic SVG size when present, otherwise viewBox dimensions as pixel geometry only, never as centimeters.
- Large images/SVGs can be expensive to scan; add conservative error handling before optimization work.
- The last native `v0-1-domain-model` verify report still has a `FAIL` verdict, but its Vitest/ESLint blocker notes are stale against current repo config; re-verification/archive should resolve the dependency status before claiming completion.

## Open Questions

- None blocking; product decisions supplied by the orchestrator resolve prior SVG and physical-size gaps.
