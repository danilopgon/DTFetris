## Exploration: v0-1-design-import

### Current State

DTFetris already has the v0.1 domain contract mostly implemented in TypeScript and Rust: centimeter-based `DesignInput`, `SheetConfig`, `PackingRequest`, `PackingResult`, explicit unplaced items, and frontend/Rust camelCase command parity. Zustand stores `designs`, `sheets`, and configurable sheet size, but it only supports adding/removing designs and has no import flow, file picker, image metadata, visible-bounds metadata, or persistent asset-copy behavior yet.

Backend Tauri commands currently expose `run_packing`, `export_png`, `save_job`, and `load_job`; packing/export/persistence are placeholders except for packing request validation. There is no `import_design` command/module, no Tauri dialog/filesystem plugin configured in `package.json`/`Cargo.toml`, and no visible-bounds detection implementation for PNG or SVG.

Docs define `v0-1-design-import` as RF-001: load PNG/SVG, copy files to `app_data_dir`, store disk paths instead of browser `File` objects, detect visible bounds, and ignore transparent padding for physical size/sheet occupancy. `domain-and-data-model.md` further defines the alpha threshold (`>= 0.01`, equivalent to `>= 3/255`) and says visible bounds are detected during import and persisted as design metadata. `packing-and-export.md` expects later packing/export to consume those persisted visible bounds rather than re-detecting from source files.

Roadmap/domain-model housekeeping finding: `docs/sdd-roadmap-tasks.md` still marks `v0-1-domain-model` as `⏳ Pendiente`, but `openspec/changes/v0-1-domain-model/` contains proposal/spec/design/tasks/verify artifacts and tasks are complete. Its verify report verdict is `FAIL`; however, the specific tool blockers named there are stale against current repo evidence because `vitest.config.ts` excludes `tests/e2e/**` and `eslint.config.mjs` exists. Therefore the roadmap is stale, but the correct status is not safely `✅ Completada`; it should be updated to reflect in-progress/native re-verification pending until archive readiness is proven. Because `v0-1-design-import` depends on `v0-1-domain-model`, design-import implementation should keep this as an explicit preflight note before product-code work.

### Affected Areas

- `src/types/domain.ts` — likely needs visible-bounds/import metadata in the design contract, while preserving centimeters as the domain source of truth.
- `src/store/useAppStore.ts` — needs import/add-design state integration for designs returned by the backend; later editing remains out of scope.
- `src/commands/index.ts` — needs a TypeScript wrapper for the import command and aligned request/response types.
- `src/components/DesignList/DesignList.tsx` / `src/App.tsx` — likely needs a Spanish UI entry point to choose/import PNG/SVG and render imported results/errors.
- `src-tauri/src/commands/` — needs a new import command registered in `lib.rs`; current commands do not copy files or inspect images.
- `src-tauri/src/domain/design.rs` — likely needs serializable metadata for source format and visible bounds/aspect-ratio produced at import.
- `src-tauri/Cargo.toml` and `package.json` — may need Tauri dialog/filesystem/plugin dependencies if the selected boundary uses Tauri plugins rather than a Rust command receiving a path.
- `docs/functional-requirements.md`, `docs/domain-and-data-model.md`, `docs/architecture-and-stack.md`, `docs/user-flows.md`, `docs/testing-strategy.md`, `docs/sdd-roadmap-tasks.md` — documentation should stay aligned with import behavior and roadmap status.
- `openspec/changes/v0-1-domain-model/verify-report.md` — records the dependency caveat: focused domain evidence passed, but archive readiness failed due suite/tooling issues.

### Approaches

1. **Backend-owned import command** — Frontend selects a file path, Rust command copies to `app_data_dir`, validates PNG/SVG, detects visible bounds, calculates original aspect ratio, and returns a complete `DesignInput`/metadata payload.
   - Pros: Keeps persistence and image processing in Rust, matches docs, makes tests possible around filesystem/image behavior, centralizes `app_data_dir` handling.
   - Cons: Requires deciding frontend file selection mechanics and adding/importing Tauri plugins or path-passing conventions; SVG visible bounds need careful rasterization sizing.
   - Effort: Medium

2. **Frontend-assisted import with backend copy/analysis** — Frontend uses Tauri dialog/API to choose files and maybe do basic extension validation, then calls Rust for copy and metadata extraction.
   - Pros: Natural UI flow, keeps backend authoritative for filesystem/image metadata, smaller command API.
   - Cons: Adds frontend dependency on Tauri plugin APIs; still needs Rust implementation for real correctness.
   - Effort: Medium

3. **Frontend-only import stub** — Use browser file input and store temporary object/file-derived values in Zustand for early UI progress.
   - Pros: Fastest UI prototype.
   - Cons: Violates core contract: no persistent `File` objects, backend owns persistence, copy to `app_data_dir`, and visible-bounds detection. Not recommended.
   - Effort: Low initially, high cleanup cost

### Recommendation

Use a backend-owned import command with a thin Spanish UI trigger and TypeScript wrapper. The proposal should define a minimal import contract, e.g. request `{ sourcePath }` or `{ sourcePaths }` and response containing persistent `imagePath`, detected visible bounds in source pixels, `originalAspectRatio`, inferred/default physical dimensions, and stable technical error codes that the UI maps to Spanish. Keep aspect-ratio deformation warnings out of scope except for storing immutable original ratio, because full validation belongs to `v0-2-aspect-ratio-validation`.

Before implementation, address the dependency status explicitly: update roadmap housekeeping for `v0-1-domain-model` to show blocked/in-progress verification, or run a small prerequisite/tooling proposal if the team wants clean archive readiness before design import. Do not mark `v0-1-domain-model` completed unless the failing required checks are fixed or an approved exception is documented.

### Risks

- `v0-1-domain-model` is not archive-ready despite implemented contracts; proceeding without acknowledging it can hide a dependency/tooling problem.
- Current `DesignInput` lacks visible-bounds metadata even though docs say import persists it; design-import will likely modify the domain model after the prior domain-model change.
- SVG visible-bounds detection depends on rasterization choices; proposal/spec must define the raster size/viewBox behavior enough to test consistently.
- Tauri plugin/API choice for selecting files and resolving `app_data_dir` is not yet present in dependencies/config.
- Storing absolute paths inside `app_data_dir` needs collision-safe naming and clear behavior for duplicate imports, missing source paths, invalid formats, and empty/fully transparent images.
- Review budget risk is medium: Rust image analysis + Tauri command + TS wrapper + UI + docs/tests could exceed 400 lines unless sliced.

### Ready for Proposal

Yes, with a preflight condition. The orchestrator should tell the user that `v0-1-design-import` can proceed to proposal, but the proposal should first record roadmap/domain-model housekeeping: `v0-1-domain-model` is stale in the roadmap and should be marked blocked/in progress rather than pending/completed until verification/tooling blockers are resolved or formally excepted.
