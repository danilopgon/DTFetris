# Tasks: v0.1 Basic Editing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550-750 additions/deletions |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: domain/types/store/actions/tests/docs model updates -> PR 2: DesignList UI interactions/component tests/user-flow docs |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain validation, fitted-size helper, store mutations, stale-layout state | PR 1 | Include `src/types/domain*`, `src/store/useAppStore*`, and domain/model docs. |
| 2 | Spanish editing UI, duplicate/delete confirmation, component tests, flow docs | PR 2 | Base on PR 1; include `DesignList*` and user-facing docs. |

## Phase 1: Domain and Store RED

- [x] 1.1 RED: Update `src/types/domain.test.ts` for quantity `0` rejection, fractional requested-cell rejection, and proportional fitted visible size preserving requested dimensions.
- [x] 1.2 RED: Update `src/store/useAppStore.test.ts` for `updateDesign`, `duplicateDesign`, `removeDesign`, shared `imagePath`, new ids, stale layout, cleared `sheets`, and no command call.

## Phase 2: Domain and Store GREEN/REFACTOR

- [x] 2.1 GREEN: Modify `src/types/domain.ts` with `DesignUpdatePatch`, quantity `>= 1`, non-empty name validation, and `getFittedVisibleSizeCm` if needed by tests.
- [x] 2.2 GREEN: Modify `src/store/useAppStore.ts` with `isLayoutStale`, validated update/duplicate/delete actions, UUID fallback, stale invalidation, and no `runPacking`/Rust changes.
- [x] 2.3 REFACTOR: Keep mutation validation centralized; keep requested cell dimensions as stored integer footprint and fitted visible size as derived-only.

## Phase 3: UI RED

- [x] 3.1 RED: Update `src/components/DesignList/DesignList.test.tsx` for Spanish labels/errors: edit/save/cancel, requested-cell helper copy, quantity min `1`, rotation checkbox, duplicate, confirm/cancel delete.
- [x] 3.2 RED: Assert UI mutations call store actions only and never fabricate packing or placements.

## Phase 4: UI GREEN/REFACTOR

- [x] 4.1 GREEN: Modify `src/components/DesignList/DesignList.tsx` with inline edit state, Spanish-only controls, validation feedback, duplicate button, and confirmation before delete.
- [x] 4.2 GREEN: Surface pending recalculation/stale-layout state if shown, using Spanish copy only.
- [x] 4.3 REFACTOR: Keep edit form small and accessible; avoid storing files, pixels, or derived fitted sizes in UI state.

## Phase 5: Documentation and Verification

- [x] 5.1 Update `docs/domain-and-data-model.md` and `docs/functional-requirements.md` for integer requested cells, quantity min `1`, no deformation, duplicate/delete, and stale layout.
- [x] 5.2 Update `docs/user-flows.md`, `docs/packing-and-export.md`, and `docs/testing-strategy.md` for editing flow, requested-cell packing footprint, proportional visible fit, and no fake packing call.
- [x] 5.3 Update `docs/sdd-roadmap-tasks.md` only when implementation/verification status changes.
- [x] 5.4 Verification evidence: run `npm run test`, `npm run lint`, `tsc --noEmit`, and `npm run build`; report failing command output if blocked.
