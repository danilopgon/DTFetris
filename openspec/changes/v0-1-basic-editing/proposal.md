# Proposal: v0.1 Basic Editing

## Intent

Enable users to correct imported designs without re-importing files. The slice adds safe design mutations while preserving core print invariants: user-facing intended dimensions remain whole-centimeter bounding cells, artwork is proportionally fit inside those cells without distortion, deletion is confirmed, and changed layouts become pending recalculation rather than pretending packing exists.

## Scope

### In Scope
- Edit design name.
- Edit intended logo dimensions as whole centimeters for the requested bounding/grid cell.
- Fit visible artwork proportionally inside the requested cell when the cell ratio differs from the artwork visible-bounds ratio; the effective visible size may be smaller than the requested cell.
- Edit quantity with minimum `1`; hiding/exclusion remains a future explicit control.
- Edit rotation permission.
- Delete a design only after confirmation.
- Duplicate a design without copying the asset file; the duplicate gets a new id and shared `imagePath`.
- On edit/duplicate/delete, invalidate existing sheets or mark layout pending recalculation; do not call placeholder packing.

### Out of Scope
- Packing algorithm, MaxRects, multipage generation, metrics, export, or persistence beyond existing design state.
- Automatic deformation, stretching, or replacing the user's requested cell dimensions with derived fitted visible dimensions.
- Visibility/exclusion toggle.
- Calling a fake `runPacking` placeholder as repacking.

## Capabilities

### New Capabilities
- `basic-editing`: User-visible edit, duplicate, delete, validation, confirmation, and pending-recalculation behavior for imported designs.

### Modified Capabilities
- `domain-model`: Quantity editing changes from allowing `0` to requiring minimum `1`; user-facing design dimensions become integer requested cells; proportional fit preserves artwork ratio internally without replacing requested cell dimensions.

## Approach

Add store-level mutations for update, duplicate, delete, and layout invalidation. Extend `DesignList` with Spanish-only controls and validation. Keep Rust packing unchanged. Specs should define pending recalculation as this slice's interim RF-012 behavior until real packing exists. For v0.1 planning, packing semantics treat the requested integer cell as the occupied footprint; any fitted visible artwork size is derived only for preview/packing/export semantics and must not overwrite the user intent.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/store/useAppStore.ts` | Modified | Add edit/duplicate/delete semantics and stale layout state. |
| `src/types/domain.ts` | Modified | Add mutation/validation contracts if needed. |
| `src/components/DesignList/DesignList.tsx` | Modified | Spanish edit, duplicate, delete, confirmation UI. |
| `src/**/*test*` | Modified | Store and component coverage. |
| `docs/*` | Modified later | Freshness updates listed below. |

## Documentation Freshness

- `docs/functional-requirements.md`: RF-002/RF-004/RF-005/RF-012/RF-014 need alignment with integer requested cell dimensions, proportional visible-bounds fitting, confirmation, duplication, and pending recalculation.
- `docs/domain-and-data-model.md`: quantity minimum, integer user-facing design dimensions, no-deformation invariant, ideal cell/bounding cell semantics, and derived fitted visible size semantics are stale.
- `docs/user-flows.md`: edit/delete/duplicate and pending recalculation flow missing.
- `docs/packing-and-export.md`: likely stale about whether design dimensions describe visible artwork or the requested occupied packing footprint; v0.1 should use the requested cell footprint unless a later packing spec changes it.
- `docs/testing-strategy.md`: update expected coverage for basic editing, integer requested dimensions, proportional non-distorting fit semantics, and no fake packing call.
- `docs/sdd-roadmap-tasks.md`: status only after implementation/verification changes.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UI/tests exceed 400-line review budget | Med | Slice store/types separately from UI if user approves chained PRs. |
| Cell-vs-visible-size ambiguity | Med | Specs must distinguish user-requested integer cells from internally derived fitted visible artwork sizes. |
| Stale layout state conflicts with later packing | Low | Name it interim and keep packing untouched. |

## Rollback Plan

Revert this change's store actions, UI controls, tests, and delta specs. Existing import and placeholder packing behavior remain unaffected.

## Success Criteria

- [ ] Users can edit name, integer requested cell dimensions, quantity >= 1, and rotation permission.
- [ ] Artwork is never stretched; mismatched ratios are proportionally fit inside the requested cell and may leave practical trim/margin space.
- [ ] Users can duplicate and confirm deletion of a design.
- [ ] Mutations mark existing layout pending recalculation or clear stale sheets without invoking placeholder packing.
- [ ] Product UI strings remain Spanish only.
- [ ] Planned implementation can stay within 400 changed lines or explicitly ask for chained PR approval.
