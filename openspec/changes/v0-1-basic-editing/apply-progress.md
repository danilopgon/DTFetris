# Apply Progress: v0.1 Basic Editing

## Summary

Implemented the full `v0-1-basic-editing` slice in Strict TDD mode. Users can edit design display name, requested whole-centimeter cell dimensions, quantity, and rotation permission; duplicate designs; and delete designs only after confirmation. Successful edit, duplicate, and delete mutations clear stale sheets and mark layout as pending recalculation without invoking placeholder packing.

Remediation after verification added runtime evidence for fractional derived visible artwork size, requested-cell packing footprint semantics, direct Spanish UI validation for fractional requested dimensions, and the combined store invariant that derived fitted size never overwrites saved requested-cell dimensions.

## Workload / PR Boundary

| Field | Value |
|---|---|
| Delivery mode | Single PR with maintainer-approved `size:exception` |
| Chain strategy | None |
| Boundary | Domain/types/store, DesignList UI, focused docs, and build-script recursion fix needed for verification |

## Tasks Completed

- [x] 1.1 RED: Domain tests for quantity `0`, fractional requested cells, and fitted visible size.
- [x] 1.2 RED: Store tests for update/duplicate/remove, shared image path, stale layout, cleared sheets, and no packing command.
- [x] 2.1 GREEN: Domain patch type, quantity `>= 1`, non-empty name validation, and fitted visible size helper.
- [x] 2.2 GREEN: Store `isLayoutStale`, validated mutations, duplicate id fallback, and stale invalidation.
- [x] 2.3 REFACTOR: Validation remains centralized; requested cells remain stored footprint; fitted size is derived only.
- [x] 3.1 RED: DesignList tests for Spanish edit/save/cancel, helper copy, validation, rotation, duplicate, and delete confirmation.
- [x] 3.2 RED: UI tests assert store actions only and no fabricated packing behavior.
- [x] 4.1 GREEN: Inline edit UI, Spanish-only controls, validation feedback, duplicate button, and confirmed delete.
- [x] 4.2 GREEN: Spanish stale-layout/pending-recalculation status copy.
- [x] 4.3 REFACTOR: UI stores only editable form primitives; no files, pixels, or derived fitted size in component state.
- [x] 5.1 Docs: domain and functional requirements refreshed.
- [x] 5.2 Docs: user flows, packing/export, and testing strategy refreshed.
- [x] 5.3 Roadmap status prepared as in progress, not complete before verification/archive.
- [x] 5.4 Verification evidence captured.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 / 2.1 / 2.3 | `src/types/domain.test.ts` | Unit | ✅ 49/49 relevant baseline suite | ✅ Tests failed for missing helper and changed quantity rule | ✅ Relevant suite passed | ✅ Quantity `0`, negative quantity, fractional dimensions, empty name, two fitted-ratio paths | ✅ Helper kept pure and stored cell semantics unchanged |
| 1.2 / 2.2 / 2.3 | `src/store/useAppStore.test.ts` | Unit | ✅ 49/49 relevant baseline suite | ✅ Tests failed before store actions existed | ✅ Relevant suite passed | ✅ Valid update, invalid update, duplicate, remove, and no `runPacking` cases | ✅ Centralized mutation invalidation in store |
| 3.1 / 3.2 / 4.1 / 4.2 / 4.3 | `src/components/DesignList/DesignList.test.tsx` | Component | ✅ 49/49 relevant baseline suite | ✅ Tests failed before edit/duplicate/delete controls existed | ✅ Relevant suite passed | ✅ Save, validation, cancel, duplicate, confirm delete, cancel delete, stale status | ✅ Form state remains local and stores no files/pixels/derived fitted size |
| 5.1 / 5.2 / 5.3 | Documentation files | Documentation | N/A (docs) | ✅ Behavior gaps identified from stale docs | ✅ Docs updated with implementation semantics | ➖ Not applicable to docs | ✅ Docs lead with current v0.1 behavior and avoid marking complete before verification |
| 5.4 | Verification commands | Build/test | N/A | ✅ Initial `npm run build` exposed recursive Tauri `beforeBuildCommand` configuration | ✅ Build passed after adding `build:frontend` and pointing Tauri to it | ➖ Structural config fix | ✅ Build command now runs frontend build once before Tauri packaging |
| Verification remediation | `src/types/domain.test.ts`, `src/store/useAppStore.test.ts`, `src/components/DesignList/DesignList.test.tsx` | Unit + Component | ✅ Existing focused suite executed during RED cycle | ✅ New requested-footprint tests failed before `getRequestedCellPackingFootprintCm` existed | ✅ Focused suite passed with 67 tests | ✅ Fractional visible size, occupied requested footprint, combined saved-cell/fitted-size invariant, and Spanish fractional-dimension UI validation | ✅ Added minimal pure helper for v0.1 footprint semantics |

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `npm run test -- src/types/domain.test.ts src/store/useAppStore.test.ts src/components/DesignList/DesignList.test.tsx` | PASS | Baseline before edits: 49 tests passing. |
| `npm run test -- src/types/domain.test.ts src/store/useAppStore.test.ts src/components/DesignList/DesignList.test.tsx` | FAIL as RED | New tests failed before implementation, as expected. |
| `npm run test -- src/types/domain.test.ts src/store/useAppStore.test.ts src/components/DesignList/DesignList.test.tsx` | PASS | Relevant suite: 63 tests passing. |
| `npm run test` | PASS | Full frontend suite: 75 tests passing. |
| `npm run lint` | PASS | ESLint completed without findings. |
| `npx tsc --noEmit` | PASS | Completed in chained verification command before build. |
| `npm run build` | PASS | Initially failed due recursive `beforeBuildCommand`; passed after config fix. |
| `cargo test` from `src-tauri` | NOT RUN | No Rust source changes were made; Tauri build compiled Rust successfully. |
| `npm run test -- src/types/domain.test.ts src/store/useAppStore.test.ts src/components/DesignList/DesignList.test.tsx` | FAIL as RED | Remediation tests failed before `getRequestedCellPackingFootprintCm` existed; component fractional validation test already passed against existing UI code. |
| `npm run test -- src/types/domain.test.ts src/store/useAppStore.test.ts src/components/DesignList/DesignList.test.tsx` | PASS | Remediation focused suite: 67 tests passing. |
| `npm run test` | PASS | Full frontend suite after remediation: 79 tests passing. |
| `npm run lint` | PASS | ESLint completed without findings after remediation. |
| `npx tsc --noEmit` | PASS | TypeScript completed without output after remediation. |

## Files Changed

| File | Action | What Changed |
|---|---|---|
| `src/types/domain.ts` | Modified | Added `DesignUpdatePatch`, `invalid_name`, quantity `>= 1`, non-empty name validation, `getFittedVisibleSizeCm`, and remediation helper `getRequestedCellPackingFootprintCm` so v0.1 packing semantics explicitly use requested-cell dimensions as occupied footprint. |
| `src/types/domain.test.ts` | Modified | Added domain RED coverage for invalid quantity, empty name, fractional cells, proportional fitted size, fractional derived visible size, and requested-cell packing footprint. |
| `src/store/useAppStore.ts` | Modified | Added `isLayoutStale`, `updateDesign`, `duplicateDesign`, strengthened `removeDesign`, UUID fallback, and stale-sheet invalidation. |
| `src/store/useAppStore.test.ts` | Modified | Added mutation coverage, assertions that placeholder packing is not called, and remediation coverage proving derived fitted size does not overwrite saved requested-cell dimensions. |
| `src/components/DesignList/DesignList.tsx` | Modified | Added Spanish inline edit UI, duplicate button, delete confirmation, validation feedback, and stale-layout status. |
| `src/components/DesignList/DesignList.test.tsx` | Modified | Added component coverage for Spanish editing, duplicate/delete flow, validation, stale status, and direct Spanish fractional-dimension rejection. |
| `package.json` | Modified | Added `build:frontend` to avoid recursive Tauri build invocation. |
| `src-tauri/tauri.conf.json` | Modified | Pointed `beforeBuildCommand` at `pnpm run build:frontend`. |
| `docs/*.md` | Modified | Refreshed functional, domain, user-flow, packing/export, testing, and roadmap docs. |
| `openspec/changes/v0-1-basic-editing/tasks.md` | Modified | Marked all apply tasks complete. |
| `.atl/skill-registry.md` | Modified | Intentional skill-install registry update confirmed by the user; included in final change. |
| `.atl/.skill-registry.cache.json` | Modified | Intentional skill-install cache update confirmed by the user; included in final change. |

## Deviations from Design

None — implementation matches the design. The only additional change is a build configuration fix required to make the mandated `npm run build` verification command complete instead of recursively invoking itself.

## Issues / Risks

- The build still warns that bundle identifier `com.dtf-sheet-optimizer.app` ends with `.app`; this is pre-existing and not addressed in this change.
- `src-tauri/Cargo.toml` appears modified in git status due line-ending normalization warnings, but `git diff` shows no content changes.
- The review budget exception remains relevant because this is intentionally a single PR-sized implementation.

## Remaining Work

- No unchecked apply tasks remain.
- Next phase should run SDD verification.
