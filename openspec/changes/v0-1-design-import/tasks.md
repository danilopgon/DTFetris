# Tasks: v0.1 Design Import

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1,300 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 roadmap/docs cleanup → PR 2 Rust import core → PR 3 TS/store wiring → PR 4 UI/docs verification |
| Delivery strategy | chained PRs |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — maintainer/orchestrator resolved chained PRs with `stacked-to-main`.
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Normalize roadmap and stale SDD notes | PR 1 | No product code; safe prerequisite. |
| 2 | Backend import contract and image analysis | PR 2 | Rust tests with fixtures/temp dirs. |
| 3 | Frontend command/store contract | PR 3 | Vitest tests with mocked invoke/store reset. |
| 4 | Spanish import UI and docs | PR 4 | Component tests if budget allows; docs included. |

## Phase 1: Roadmap and Contract Cleanup

- [x] 1.1 RED: Add/update focused doc assertion notes for `docs/sdd-roadmap-tasks.md` status: `v0-1-domain-model` is verified-blocked/in-progress, not completed.
- [x] 1.2 GREEN: Update `docs/sdd-roadmap-tasks.md` and stale notes in `openspec/changes/v0-1-design-import/design.md`/`exploration.md`; do not claim current Vitest/E2E or ESLint blockers.
- [x] 1.3 REFACTOR: Keep cleanup wording concise and aligned with the user correction: broad E2E is deferred by roadmap scope only.

## Phase 2: Rust Import Core

- [ ] 2.1 RED: Add Rust tests for PNG transparent padding, empty artwork, unsupported/malformed files, duplicate copies, SVG visible bounds, and invalid cm dimensions.
- [ ] 2.2 GREEN: Extend `src-tauri/src/domain/design.rs` with `format`, `visibleBounds`, and `originalAspectRatio` using camelCase serde parity.
- [ ] 2.3 GREEN: Create `src-tauri/src/commands/import.rs` with `import_design({ sourcePath, widthCm, heightCm })`, app-data `design-assets/{uuid}.{ext}` copy, stable error codes, PNG/SVG analysis, and cleanup/ignore of partial copies.
- [ ] 2.4 REFACTOR: Register the command in `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs`; update `src-tauri/Cargo.toml` only if dependencies are actually missing.

## Phase 3: TypeScript Contract and State

- [ ] 3.1 RED: Add Vitest cases in `src/types/domain.test.ts`, `src/commands/index.test.ts`, and `src/store/useAppStore.test.ts` for metadata parity, payload shape, cumulative add, and no mutation on errors.
- [ ] 3.2 GREEN: Update `src/types/domain.ts` and `src/commands/index.ts` with import request/response/error types and wrapper.
- [ ] 3.3 GREEN: Wire `src/store/useAppStore.ts` so successful imports append exactly one design without replacing existing designs.
- [ ] 3.4 REFACTOR: Keep centimeters as domain truth; use pixels only for source quality and visible-bounds metadata.

## Phase 4: Spanish UI and Documentation

- [ ] 4.1 RED: Add focused RTL tests for one-file dialog flow, confirmed cm dimensions, Spanish errors, and prevented batch import if practical within the slice.
- [ ] 4.2 GREEN: Update `src/components/DesignList/DesignList.tsx`/`src/App.tsx` with a Spanish import entry point, positive cm inputs, loading state, and Spanish error mapping.
- [ ] 4.3 GREEN: Add `@tauri-apps/plugin-dialog` wiring in `package.json`/Tauri setup only if the repo does not already provide single-file selection.
- [ ] 4.4 REFACTOR: Update `docs/functional-requirements.md`, `docs/domain-and-data-model.md`, `docs/architecture-and-stack.md`, `docs/user-flows.md`, and `docs/testing-strategy.md` for one-at-a-time cumulative import, app-owned copies, visible bounds, confirmed cm dimensions, and deferred aspect validation.

## Phase 5: Verification Commands

- [ ] 5.1 Run focused frontend tests: `npm run test -- src/types/domain.test.ts src/commands/index.test.ts src/store/useAppStore.test.ts`.
- [ ] 5.2 Run focused backend tests: `cargo test` from `src-tauri`.
- [ ] 5.3 Run quality gates before verify: `npm run test`, `npm run lint`, `npm run build`; keep `npm run test:e2e` as roadmap-scope smoke/deferred evidence, not a current runner-blocker claim.
