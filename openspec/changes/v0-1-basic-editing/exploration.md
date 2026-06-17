## Exploration: v0-1-basic-editing

### Current State

After archived `v0-1-design-import`, `DesignInput` is shared across TypeScript and Rust with `id`, `name`, `imagePath`, `widthCm`, `heightCm`, immutable `originalAspectRatio`, `quantity`, `canRotate`, `format`, and persisted `visibleBounds`. Imports are backend-owned: the UI selects one PNG/SVG path, Rust copies it into `app_data_dir/design-assets/{uuid}.{ext}`, detects visible bounds, returns a complete design, and Zustand appends it cumulatively.

The frontend store currently exposes `addDesign`, `removeDesign`, `importDesign`, `setSheets`, `setSheetSize`, and `setOptimizing`. `removeDesign` already mutates state but has no visible UI control or dedicated tests. There is no `updateDesign`/`editDesign` action, no automatic `runPacking` orchestration from state changes, and no dirty/pending repack state. `run_packing` is still a placeholder that validates the `PackingRequest` and returns empty sheets; therefore this slice can test that repacking is requested/triggered, but must not implement packing placement.

### Affected Areas

- `src/store/useAppStore.ts` — add design update/edit action and define whether edit/delete/sheet changes clear sheets, invoke packing, or mark layout stale.
- `src/store/useAppStore.test.ts` — cover name, dimensions, quantity, rotation flag, deletion, and repacking-trigger semantics.
- `src/components/DesignList/DesignList.tsx` — extend current import/list UI with Spanish controls for editing and deleting existing designs.
- `src/components/DesignList/DesignList.test.tsx` — cover edit form behavior, delete action, validation feedback, Spanish labels, and trigger calls.
- `src/commands/index.ts` / `src/commands/index.test.ts` — only affected if the selected trigger semantics directly call `runPacking` from store/UI.
- `src/types/domain.ts` / `src/types/domain.test.ts` — likely reuse existing validation; may need a typed patch/update shape, but should not change persisted design metadata unless necessary.
- `src/components/SheetPreview/SheetPreview.tsx` and `src/components/MetricsPanel/MetricsPanel.tsx` — likely not directly edited unless the stale/optimizing state must be surfaced.
- `src-tauri/src/commands/packing.rs` — should remain placeholder for this slice; no MaxRects or placement behavior belongs here.
- `docs/functional-requirements.md` — clarify RF-002/RF-004/RF-005/RF-012 behavior if product decisions are resolved.
- `docs/domain-and-data-model.md` — update if edit validation or design mutation invariants change.
- `docs/user-flows.md` — document edit/delete/repacking flow.
- `docs/testing-strategy.md` — align minimum store/component coverage for editing and repacking trigger.
- `docs/sdd-roadmap-tasks.md` — update status only when the later implementation/archive phase completes.

### Approaches

1. **Store-level mutation actions plus injected repack trigger** — Add `updateDesign(id, patch)` and strengthen `removeDesign`; when layout-affecting fields change, a store action triggers or marks repacking through a small injectable command boundary.
   - Pros: Centralizes domain mutation semantics, makes store tests direct, avoids duplicating trigger rules across components.
   - Cons: Async packing from Zustand needs careful error/loading handling and may grow scope if full `runPacking` orchestration is added now.
   - Effort: Medium

2. **Component-owned editing with explicit store setters** — Keep the store simple; `DesignList` validates fields, updates arrays through narrow actions, and calls a repack callback/command from the component after edits/deletes.
   - Pros: Fastest UI increment, fewer store architecture decisions.
   - Cons: Trigger rules become coupled to one component and harder to reuse for sheet editing, import, or future duplicate actions.
   - Effort: Low/Medium

3. **Dirty-state only, no command invocation** — Edits/deletes clear or mark `sheets` stale and set a `needsRepack` flag; actual packing remains a later action after `v0-1-single-sheet-packing`.
   - Pros: Strictly avoids packing implementation and stays small under review budget.
   - Cons: RF-012 says recalculation is automatic, so proposal/spec must define this as an interim trigger contract rather than final user-visible recalculation.
   - Effort: Low

### Recommendation

Use approach 1 with a deliberately narrow trigger contract, or approach 3 if product accepts an interim `needsRepack`/stale-layout semantic until real packing exists. The proposal should define `updateDesign` as partial updates for editable fields (`name`, `widthCm`, `heightCm`, `quantity`, `canRotate`) and deletion by stable `id`. Layout-affecting successful mutations should trigger repacking semantics, but this change must avoid MaxRects, placement generation, multipage, metrics, export, duplication, and aspect-ratio/deformation validation.

For the first slice, keep validation aligned with the existing domain model: positive integer centimeters for dimensions; quantity may be `0` while editing; packing/generation still requires at least one positive quantity. Name rules, deletion confirmation, and whether `canRotate` defaults can be changed after import need product confirmation before proposal.

### Risks

- RF-012 is ahead of implementation because `run_packing` returns an empty placeholder. Without a clear interim trigger definition, tests may accidentally specify real packing behavior too early.
- `DesignList.test.tsx` is already large; adding edit/delete flows in the same component can exceed the 400-line review budget unless sliced or refactored.
- Inline editing plus validation can expand UI scope quickly: per-field errors, save/cancel behavior, confirmation dialogs, keyboard accessibility, and disabled states all add lines.
- Editing dimensions can deform artwork relative to `originalAspectRatio`; deformation warnings are explicitly later scope, so this change must not auto-correct dimensions.
- Deleting a design may leave stale `sheets`/placements unless trigger or stale-clear semantics are explicit.

### Ready for Proposal

Yes, but proposal should ask product questions first. The key blocker is not code discovery; it is the product definition of automatic repacking while the packing algorithm is still a later roadmap item. The safest proposal should scope this change to mutation actions, Spanish editing/deletion UI, validation, and a testable repacking trigger/stale-layout contract that does not implement packing.

### Correction Note

Superseding clarification: editable design dimensions are user-facing whole-centimeter requested cells, not fractional recalculated visible artwork dimensions. Artwork must be proportionally fit inside the requested cell without distortion; any fractional fitted visible size is internal derived metadata and must not replace the user's requested cell. For v0.1 packing semantics, the requested cell remains the occupied footprint unless a later packing spec changes it.

### Product Questions for Proposal

1. Should editing existing design dimensions allow values that deform the artwork for now, with no warning until `v0-2-aspect-ratio-validation`, or should save be blocked when dimensions differ from `originalAspectRatio`?
2. Should deleting a design require a confirmation step, or is immediate deletion acceptable for v0.1?
3. When a design is edited/deleted before real packing exists, should the app call the placeholder `runPacking`, clear current sheets, or mark the layout as needing repack?
4. Should `quantity: 0` be visibly allowed in the edit UI as “temporarily exclude from packing”, or should the UI discourage it even though the domain permits it while editing?
5. Is duplicating a design intentionally excluded from `v0-1-basic-editing`, despite the roadmap detail saying it may be included if decided?
