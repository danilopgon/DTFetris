# Tasks: v0.1 Domain Model

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450-650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 TS contracts/state → PR 2 Rust contracts/command → PR 3 docs/parity cleanup |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — maintainer approved chained PRs with `stacked-to-main`.
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add TS domain contracts, validation tests, default sheet state | PR 1 | Tests stay with `src/types`/`src/store` changes. |
| 2 | Add Rust serde/validation contracts and command shape | PR 2 | Depends on PR 1 request/result shape. |
| 3 | Align command wrapper, units boundary tests, and Spanish docs | PR 3 | Depends on PR 1-2; no packing algorithm. |

## Phase 1: TypeScript Domain Contract (RED/GREEN)

- [x] 1.1 RED: Add Vitest coverage for `src/types/domain.ts` helpers: positive integer cm accepted, decimal/zero/negative rejected, quantity `0` allowed for editing.
- [x] 1.2 GREEN: Update `src/types/domain.ts` with `Cm`, `SheetConfig`, `PackingRequest`, `PackingResult`, and `UnplacedItem` using stable reason codes (`does_not_fit`, `invalid_dimensions`, `invalid_quantity`, `sheet_too_small`).
- [x] 1.3 RED/GREEN: Add generation validation tests and implementation requiring at least one design with `quantity > 0` before packing.

## Phase 2: Store and Frontend Command Boundary

- [x] 2.1 RED/GREEN: Test and update `src/store/useAppStore.ts` to initialize sheet config at 55 cm width x 100 cm height, not 60 x 100.
- [x] 2.2 RED/GREEN: Test and update `src/commands/index.ts` so `runPacking(request: PackingRequest): Promise<PackingResult>` invokes `run_packing` with `{ request }`.
- [x] 2.3 RED/GREEN: Extend `src/utils/units.test.ts` and `src/utils/units.ts` only for boundary conversion expectations, including export `300` DPI naming if useful.

## Phase 3: Rust Domain Contract (RED/GREEN)

- [x] 3.1 RED: Add serde JSON parity tests in `src-tauri/src/domain/design.rs` for camelCase keys over snake_case Rust fields.
- [x] 3.2 GREEN: Add `#[serde(rename_all = "camelCase")]` to Rust domain structs while preserving existing field semantics.
- [x] 3.3 RED/GREEN: Define and test `SheetConfig`, `PackingRequest`, `PackingResult`, `UnplacedItem`, validation helpers, and stable unplaced reason codes in `src-tauri/src/domain/packing.rs`.
- [x] 3.4 RED/GREEN: Update `src-tauri/src/commands/packing.rs` to accept `PackingRequest`, validate defensively, and return empty `PackingResult` placeholder without MaxRects logic.

## Phase 4: Documentation and Verification

- [x] 4.1 Update `docs/domain-and-data-model.md` in Spanish with integer-cm MVP rules, editable/generation quantity boundary, default sheet config, request/result shapes, and stable unplaced codes.
- [x] 4.2 Update `docs/architecture-and-stack.md` and `docs/testing-strategy.md` in Spanish for the new React/Rust command contract and serde/domain validation coverage.
- [x] 4.3 Run `npm run test` and `cargo test` from `src-tauri`; record any failures before apply completion.

### Final Verification Notes

- `npx vitest run src/utils/units.test.ts` → PASS, 4 tests.
- `npx tsc --noEmit` → PASS.
- `cargo test` from `src-tauri` → PASS, 9 tests.
- `npm run test` → FAIL, known out-of-scope test discovery issue: Vitest collects `tests/e2e/basic.spec.ts`, which is a Playwright spec and fails during collection with `Playwright Test did not expect test() to be called here`.
