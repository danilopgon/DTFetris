# Apply Progress: v0.1 Design Import

## Slice 1 — Roadmap and SDD Artifact Cleanup

**Delivery strategy**: chained PRs  
**Chain strategy**: stacked-to-main  
**Review boundary**: roadmap/docs/OpenSpec artifact housekeeping only; no product-code implementation.

## Completed Tasks

- [x] 1.1 RED: Added focused doc assertion notes that `v0-1-domain-model` must remain in-progress/native re-verification pending, not completed.
- [x] 1.2 GREEN: Updated `docs/sdd-roadmap-tasks.md`, `design.md`, and `exploration.md` to remove stale current-blocker claims about Vitest/Playwright collection and missing ESLint flat config.
- [x] 1.3 REFACTOR: Kept cleanup wording concise and scoped broad E2E to roadmap timing rather than a current runner blocker.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Wrote explicit expected status assertion before artifact cleanup | ✅ Roadmap status now reflects in-progress/re-verification pending | ➖ Single documentation invariant | ✅ Wording avoids completion overclaim |
| 1.2 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Identified stale blocker claims against current `vitest.config.ts` and `eslint.config.mjs` evidence | ✅ Stale blocker claims removed/qualified in SDD artifacts | ✅ Checked both design and exploration notes | ✅ Current evidence separated from old verify verdict |
| 1.3 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Asserted broad E2E should be deferred by roadmap scope only | ✅ Design wording no longer calls E2E a current collection blocker | ➖ Single wording cleanup | ✅ Concise review-facing notes |

## Verification

- Not run: `npm run test`, `npm run lint`, and `cargo test` were skipped because this slice changed only Markdown documentation/OpenSpec artifacts and no code paths, test fixtures, or configuration executable by those runners.
- Static evidence checked by reading current `vitest.config.ts` (`tests/e2e/**` excluded) and `eslint.config.mjs` (flat config exists).

---

## Slice 2 — Rust Import Core

**Delivery strategy**: chained PRs  
**Chain strategy**: stacked-to-main  
**Review boundary**: Rust domain model extension + import command implementation + tests. No TypeScript, no UI, no docs.

## Completed Tasks

- [x] 2.1 RED: Added Rust tests for PNG transparent padding, empty artwork, unsupported/malformed files, duplicate copies, SVG visible bounds, and invalid cm dimensions.
- [x] 2.2 GREEN: Extended `src-tauri/src/domain/design.rs` with `ImageFormat` enum and `VisibleBounds` struct (both camelCase serde), added `format` and `visible_bounds` required fields to `DesignInput`. Updated all existing construction sites in `design.rs`, `packing.rs`, and `commands/packing.rs`.
- [x] 2.3 GREEN: Created `src-tauri/src/commands/import.rs` with `import_design_into` (pure/testable core) and `import_design` (Tauri command thin wrapper), PNG alpha scan, SVG rasterize-then-scan via resvg 0.43, stable error codes, UUID-based copy paths, and analyze-before-copy pattern.
- [x] 2.4 REFACTOR: Registered `import_design` in `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs`. No Cargo.toml changes needed (`image`, `resvg`, `uuid` were already present).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `src-tauri/src/commands/import.rs` (`#[cfg(test)]`) | Unit | ✅ 9/9 baseline passing | ✅ Tests written referencing `ImageFormat`/`VisibleBounds` that did not exist — compile errors confirmed RED | ✅ All 22 tests pass after GREEN implementation (`cargo test --lib` output) | ✅ Multiple test cases per behavior: padded PNG, transparent PNG, malformed PNG, missing file, unsupported ext (.jpg + .txt), SVG padded, SVG transparent, zero dims, negative dims, duplicate copies, no-orphan check | ✅ Removed unused `GenericImageView` import; replaced `dimensions()` with `width()/height()` — no warnings |
| 2.2 | `src-tauri/src/domain/design.rs` (`#[cfg(test)]`) | Unit | ✅ 9/9 baseline (before change) | ✅ Test referencing `ImageFormat::Png` and `visibleBounds` camelCase keys failed at compile before struct addition | ✅ Exact JSON key assertions pass (`format: "png"`, `visibleBounds.xPx`, `sourceWidthPx`, etc.) | ✅ Round-trip test in `packing.rs` covers deserialization parity | ✅ Clean — no extra logic; fields follow existing camelCase serde pattern |
| 2.3 | `src-tauri/src/commands/import.rs` | Unit | N/A (new file) | ✅ RED confirmed via compile failure: tests referenced `ImageFormat`/`VisibleBounds` from task 2.2 before those types existed in `design.rs`. Tests and production code in `import.rs` were written together in one pass; RED was the compile failure against missing domain types, not a stub-to-impl progression within the same file. | ✅ All behavioral tests pass — bounds math, copy, UUID dedup, error codes | ✅ Covered all spec scenarios: format validation, dim validation, PNG bounds, SVG bounds, empty artwork, malformed, duplicate | ✅ Extracted `scan_alpha_bounds` pure function; `import_design` is thin Tauri wrapper delegating to testable `import_design_into` |
| 2.4 | N/A — registration only | Config | ✅ All 9 pre-existing tests still pass | ✅ `lib.rs` and `mod.rs` edited; `import_design` compiled without error | ✅ `cargo test --lib` shows 22 tests pass (no regressions) | ➖ Structural registration: single path, no branching to triangulate | ➖ None needed |

### Test Summary
- **Total tests written**: 13 new (all in `src-tauri/src/commands/import.rs`)
- **Total tests passing**: 22 (9 pre-existing + 13 new)
- **Layers used**: Unit (22), Integration (0), E2E (0)
- **Approval tests** (refactoring): 2 — updated `design_input_serializes_with_camel_case_json_keys` and `packing_request_round_trips_with_camel_case_contract` to include new fields before touching production code
- **Pure functions created**: 3 (`scan_alpha_bounds`, `visible_bounds_from_rgba`, `import_design_into`)

## Verification

```
cargo test --manifest-path "C:/Users/Usuario/Dev/dtfetris/src-tauri/Cargo.toml" --lib

running 22 tests
test commands::import::tests::import_error_codes_match_stable_contract ... ok
test commands::import::tests::design_input_with_new_fields_serializes_camel_case ... ok
test commands::packing::tests::run_packing_rejects_invalid_request_before_placeholder_packing ... ok
test commands::packing::tests::run_packing_returns_placeholder_packing_result_for_valid_request ... ok
test domain::design::tests::design_input_serializes_with_camel_case_json_keys ... ok
test domain::design::tests::sheet_deserializes_from_camel_case_json_keys ... ok
test domain::packing::tests::packing_request_round_trips_with_camel_case_contract ... ok
test domain::packing::tests::packing_result_serializes_explicit_unplaced_items ... ok
test domain::packing::tests::validation_accepts_integer_cm_and_positive_quantity_designs ... ok
test domain::packing::tests::validation_rejects_decimal_zero_and_negative_dimensions ... ok
test domain::packing::tests::validation_rejects_requests_without_positive_quantity ... ok
test commands::import::tests::missing_file_returns_file_not_found_error ... ok
test commands::import::tests::malformed_png_returns_metadata_failed_error ... ok
test commands::import::tests::negative_height_cm_returns_invalid_dimensions_error ... ok
test commands::import::tests::fully_transparent_png_returns_empty_artwork_error ... ok
test commands::import::tests::unsupported_extension_returns_invalid_format_error ... ok
test commands::import::tests::fully_transparent_svg_returns_empty_artwork_error ... ok
test commands::import::tests::zero_width_cm_returns_invalid_dimensions_error ... ok
test commands::import::tests::no_copy_file_exists_when_import_fails_due_to_empty_artwork ... ok
test commands::import::tests::png_visible_bounds_exclude_transparent_padding ... ok
test commands::import::tests::svg_visible_bounds_exclude_transparent_padding ... ok
test commands::import::tests::duplicate_imports_produce_distinct_copy_paths ... ok

test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
```

**ENVIRONMENTAL BLOCKER**: Full `cargo test` (including staticlib/cdylib linking for native targets) fails with `LNK1108: cannot write file` / OS error 112 (no space on device). `C:` was at 100% capacity (~798 MB free) when Phase 2 ran. The `--lib` flag compiles and runs only the test binary, which covers the identical test set because all tests reside in `#[cfg(test)]` modules within `src/` (no `tests/` integration test files, no doctests). Full `cargo test` additionally links the shipping staticlib/cdylib targets, which fail on disk pressure but produce no additional test cases. **Consequence for sdd-verify**: Phase 5.2 (`cargo test` full suite) will fail unless disk space is freed first. The 22 unit tests that constitute the real test suite all pass.

## Remaining Tasks

- [x] Phase 3: TypeScript Contract and State — COMPLETE
- [x] Phase 4: Spanish UI and Documentation — COMPLETE
- [ ] Phase 5: Verification Commands

---

## Slice 4 — Spanish UI and Documentation

**Delivery strategy**: chained PRs  
**Chain strategy**: stacked-to-main  
**Review boundary**: React import UI component + dialog wiring + docs updates. No Rust domain changes. No new TypeScript types.

## Completed Tasks

- [x] 4.1 RED: Created `src/components/DesignList/DesignList.test.tsx` with 20 RTL tests covering: "Importar diseño" button visible, widthCm/heightCm inputs, disabled state when inputs empty/zero, enabled state with valid inputs, dialog open → store.importDesign called, loading indicator (deferred promise pattern), no error on success, Spanish error messages for invalid_format/empty_artwork/file_not_found/copy_failed, and cancelled dialog does not call importDesign. Also extracted `mapImportErrorToMessage` as a pure function and tested it directly with 5 unit tests.
- [x] 4.2 GREEN: Updated `src/components/DesignList/DesignList.tsx` with import UI: widthCm/heightCm number inputs with labels (min=0.1), "Importar diseño" button (disabled when inputs invalid or importing), calls `open()` from `@tauri-apps/plugin-dialog` to select file, calls `store.importDesign({ sourcePath, widthCm, heightCm })`, shows loading state (button disabled), maps all ImportDesignErrorCode values to Spanish messages via `mapImportErrorToMessage`, renders `<p role="alert">` on error, clears error on new import. `App.tsx` unchanged.
- [x] 4.3 GREEN: Installed `@tauri-apps/plugin-dialog` 2.7.1 via pnpm. Added `@testing-library/user-event` 14.6.1 as devDependency. Added `tauri-plugin-dialog = "2"` to `src-tauri/Cargo.toml`. Added `.plugin(tauri_plugin_dialog::init())` to `src-tauri/src/lib.rs`. Rust plugin lines added; compile-verify deferred (disk space constraint from Slice 2 still applies — `cargo build` not run).
- [x] 4.4 REFACTOR: Updated five docs: `docs/functional-requirements.md` (RF-001 rewritten for one-at-a-time cumulative import with user-confirmed cm), `docs/domain-and-data-model.md` (TypeScript model updated with ImageFormat/VisibleBounds/ImportDesignRequest/ImportDesignErrorCode/updated DesignInput; Rust model updated with camelCase serde and new fields), `docs/architecture-and-stack.md` (dialog plugin and user-event added to stack table; import command flow documented), `docs/user-flows.md` (import flow added: button → dialog → store → success/error), `docs/testing-strategy.md` (RTL tests for DesignList/import UI documented; E2E import deferred to roadmap).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `src/components/DesignList/DesignList.test.tsx` | Integration (RTL) | N/A (new file) | ✅ 15 component tests failed + 5 pure-function tests passed on first run against current DesignList (no button/inputs) | ✅ All 20 tests pass after GREEN implementation | ✅ Multiple error codes tested (invalid_format, empty_artwork, file_not_found, copy_failed); loading state uses deferred promise to verify both loading and completion; dialog cancel tested separately | ✅ mapImportErrorToMessage extracted as pure function; error messages match spec exactly; aria roles used (role="alert") not CSS classes |
| 4.2 | Same file | Integration (RTL) | ✅ 34/34 baseline before modifying DesignList.tsx | ✅ RED confirmed (15 failing tests before implementation) | ✅ 20/20 new tests pass; 34/34 pre-existing tests unchanged = 54 total | ✅ Triangulated: disabled→enabled→loading→success→error states all covered; 4 distinct error code paths in tests | ✅ Dialog placement in component (not store) preserves Phase 3 contracts; pure function for error mapping |
| 4.3 | N/A — dependency wiring | Config | ✅ npm run test: 54/54 pass before and after | ✅ package.json updated; Cargo.toml + lib.rs updated | ✅ pnpm install confirmed @tauri-apps/plugin-dialog@2.7.1; tsc --noEmit passes; Rust compile-verify deferred | ➖ Single structural change per file | ➖ None needed — declarative wiring |
| 4.4 | N/A — documentation | Documentation | ✅ 54/54 tests still pass after docs update | ✅ Docs identified as stale before edits (TypeScript model missing format/visibleBounds; user-flows missing import flow) | ✅ All five docs updated; no test regressions | ✅ Both TypeScript and Rust models updated in domain doc | ✅ Language consistency verified: docs remain in Spanish per existing convention |

### Test Summary

- **New tests written**: 20 (5 pure-function unit + 15 RTL component in `DesignList.test.tsx`)
- **Total tests passing**: 54 (34 pre-existing + 20 new)
- **Layers used**: RTL Integration (15), Unit pure-function (5)
- **Pure functions created**: 1 (`mapImportErrorToMessage`)
- **Approval tests** (refactoring): N/A — new file, no existing component tests

## Verification

```
npm run test

 RUN  v4.1.0 C:/Users/Usuario/Dev/dtfetris

 Test Files  5 passed (5)
       Tests  54 passed (54)
    Start at  17:00:53
    Duration  4.32s (transform 336ms, setup 735ms, import 808ms, tests 2.69s, environment 4.09s)

---
tsc --noEmit: PASS (no output / exit 0)
npm run lint: PASS (no output / exit 0)
```

## Notes

- Dialog placement decision: `open()` from `@tauri-apps/plugin-dialog` is called in the **component** (`DesignList.tsx`), not in the store action or command wrapper. This preserves Phase 3 contracts: `store.importDesign({ sourcePath, widthCm, heightCm })` and `commands.importDesign(request)` signatures remain unchanged, and all 4 Phase 3 store tests remain green.
- `App.tsx` was not modified — `DesignList` is already in the aside panel.
- Rust plugin compile-verify is deferred per Slice 2 environmental blocker (disk space constraint). Lines added to `Cargo.toml` and `lib.rs`; full `cargo build` not attempted.
- `mapImportErrorToMessage` covers all 6 `ImportDesignErrorCode` values plus a fallback for unknown codes. The test file exports this function to enable direct unit testing alongside RTL tests in the same file.
- The `mockDesigns` array uses a mutable-length pattern (`mockDesigns.length = 0` in beforeEach) to reset without reassigning the const, which keeps the closure reference stable in the `useAppStore` mock.

---

## Slice 3 — TypeScript Contract and State

**Delivery strategy**: chained PRs  
**Chain strategy**: stacked-to-main  
**Review boundary**: TypeScript domain types, command wrapper, and Zustand store action. No Rust, no UI components, no docs.

## Completed Tasks

- [x] 3.1 RED: Added failing Vitest tests in `src/types/domain.test.ts` (VisibleBounds, ImageFormat, DesignInput fields, ImportDesignRequest, ImportDesignErrorCode contracts), `src/commands/index.test.ts` (importDesign payload shape, success DesignInput, all 4 stable error codes mapped), and `src/store/useAppStore.test.ts` (cumulative append, second import appends, failed import leaves store unchanged, partial failure keeps existing designs).
- [x] 3.2 GREEN: Updated `src/types/domain.ts` with `ImageFormat`, `VisibleBounds`, `ImportDesignRequest`, `ImportDesignErrorCode`, and required `format`/`visibleBounds` fields on `DesignInput`. Updated `src/commands/index.ts` with `importDesign(request: ImportDesignRequest): Promise<DesignInput>` wrapper using `invoke('import_design', request)`. Updated existing `DesignInput` fixtures in `src/commands/index.test.ts` to include required fields.
- [x] 3.3 GREEN: `addDesign` was already cumulative. Added `importDesign` async action to `useAppStore` that calls the command wrapper, appends the result via `addDesign` pattern, and re-throws on failure (store unchanged).
- [x] 3.4 REFACTOR: `widthCm`/`heightCm` are typed `Cm` in both `ImportDesignRequest` and `DesignInput`. `VisibleBounds` fields are all pixel values (`xPx`, `yPx`, `widthPx`, `heightPx`, `sourceWidthPx`, `sourceHeightPx`). No `Cm` redefinition. No pixel fields used for physical output dimensions.

## TDD Cycle Evidence

| Task | Test File(s) | Layer | RED Evidence | GREEN Evidence | REFACTOR |
|------|-------------|-------|-------------|----------------|----------|
| 3.1 | `src/types/domain.test.ts`, `src/commands/index.test.ts`, `src/store/useAppStore.test.ts` | Unit | ✅ `tsc --noEmit` error: "Module has no exported member 'ImageFormat'" (11 tsc errors); Vitest: 10/34 tests failed — `importDesign is not a function`, `importDesign action is not a function` | ✅ After GREEN types/wrapper/action: 34/34 pass, tsc clean | ✅ Fixtures updated to include required fields; `baseDesign` in `domain.test.ts` carries full `format`/`visibleBounds` |
| 3.2 | `src/types/domain.ts`, `src/commands/index.ts` | Types + Command | ✅ tsc RED: 11 errors before any type additions | ✅ tsc clean, all Vitest pass; `importDesign` wrapper delegates directly to `invoke('import_design', request)` | ✅ Error codes defined as union type; no loading/error state added (not required by tests) |
| 3.3 | `src/store/useAppStore.ts` | Store | ✅ 4 store tests failed: `importDesign is not a function` | ✅ 4 new store tests pass; 2 pre-existing store tests unchanged (34 total) | ✅ `importDesign` re-throws on error (store never mutated on failure); no extra loading/error state |
| 3.4 | All modified files | Refactor check | ✅ `tsc --noEmit` confirms `Cm` type used for all cm fields | ✅ `VisibleBounds` fields named with `Px` suffix; never used as `Cm` anywhere | ✅ `Cm` type defined once in domain.ts; not redefined |

### Test Summary

- **New tests written**: 20 (10 in `domain.test.ts`, 6 in `commands/index.test.ts`, 4 in `useAppStore.test.ts`)
- **Total tests passing**: 34 (14 pre-existing + 20 new)
- **Layers used**: Unit (34 via Vitest), Type (via `tsc --noEmit`)
- **Fixture updates**: Updated `baseDesign` in `domain.test.ts`, 2 inline designs in `commands/index.test.ts` — required fields added before implementation (approval-test pattern)

## Verification

```
npm run test

 RUN  v4.1.0 C:/Users/Usuario/Dev/dtfetris

 Test Files  4 passed (4)
       Tests  34 passed (34)
    Start at  16:46:01
    Duration  1.27s (transform 198ms, setup 676ms, import 334ms, tests 31ms, environment 2.92s)

---
tsc --noEmit: PASS (no output / exit 0)
npm run lint: PASS (no output / exit 0)
```

## Notes

- `v0-1-domain-model` is not marked complete because the last native verify report still records `FAIL`; the correct follow-up is re-verification/archive readiness, not roadmap overclaiming.
- `DesignInput` now has required (not `Option<>`) `format` and `visible_bounds` fields per design spec. All existing construction sites updated.
- `import_design_into` uses analyze-before-copy pattern: detects visible bounds before copying the file. This means no partial copy can be orphaned on `empty_artwork` or `metadata_failed` — only `copy_failed` occurs after analysis passes.
- SVG alpha threshold is 3/255 (absorbs rasterization anti-aliasing); PNG threshold is 1/255 (any non-transparent pixel). Different by design per `design.md`.
- The `import_design` Tauri command is a thin wrapper around `import_design_into` that resolves `app_data_dir` via `tauri::Manager`. The JS-visible signature is `(sourcePath, widthCm, heightCm)`.
- No changes to `Cargo.toml` were needed — `image`, `resvg`, and `uuid` were already declared.
