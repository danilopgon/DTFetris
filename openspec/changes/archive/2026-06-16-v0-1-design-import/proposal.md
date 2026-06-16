# Proposal: v0.1 Design Import

## Intent

Enable cumulative import of one PNG/SVG design at a time, copying each selected file into `app_data_dir` and persisting a disk path plus visible-artwork metadata. First slice also verifies/normalizes `v0-1-domain-model` roadmap status because native verification/archive state is ambiguous.

## Scope

### In Scope
- Roadmap housekeeping: verify `v0-1-domain-model` artifacts/status and update `docs/sdd-roadmap-tasks.md` without overclaiming completion.
- Import one design per operation; users may repeat the flow to add more.
- Copy every import to a distinct persisted path/name, including duplicate source files.
- Detect visible bounds for PNG/SVG and derive dimensions/aspect ratio from visible artwork, not transparent padding.
- Add Rust command, TS wrapper, Zustand integration, Spanish UI entry point/errors, tests, and aligned docs.

### Out of Scope
- Multi-file batch import.
- Deduplication or shared copy reuse on re-import.
- Full deformation warning/confirmation flow (`v0-2-aspect-ratio-validation`).
- Packing/export implementation changes beyond consuming persisted metadata later.

## Capabilities

### New Capabilities
- `design-import`: importing PNG/SVG assets into app-owned storage with visible-bounds metadata.

### Modified Capabilities
- None; no active `openspec/specs/` capabilities exist yet.

## Approach

Use a backend-owned `import_design` Tauri command with a thin React/Zustand flow. Frontend selects one source path, Rust validates format, copies to `app_data_dir` with collision-safe naming, computes visible bounds (`alpha >= 0.01` after rasterization), returns a complete design payload and stable technical error codes that UI maps to Spanish.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docs/sdd-roadmap-tasks.md` | Modified | Normalize `v0-1-domain-model` status. |
| `src/types/domain.ts`, `src-tauri/src/domain/design.rs` | Modified | Add import/visible-bounds metadata contract. |
| `src/commands/index.ts`, `src-tauri/src/commands/` | New/Modified | Add import command boundary. |
| `src/store/useAppStore.ts`, `src/App.tsx`, `src/components/DesignList/` | Modified | Add cumulative import UI/state. |
| `docs/functional-requirements.md`, `docs/domain-and-data-model.md`, `docs/architecture-and-stack.md`, `docs/user-flows.md`, `docs/testing-strategy.md` | Modified | Align behavior and verification. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SVG without explicit physical dimensions cannot be reliably inferred. | High | Require user-confirmed centimeter dimensions; do not derive physical size from `viewBox`. |
| Import implementation may exceed 400 changed lines. | Med | Ask before chained PRs; slice roadmap housekeeping/backend/UI-docs. |
| Broad E2E coverage can expand beyond this change's review budget. | Med | Keep this change to focused unit/command/UI smoke evidence; defer broad E2E flows to later roadmap tasks. |

## Rollback Plan

Revert the import command/UI/type/doc changes and restore roadmap wording. Copied assets can remain orphaned in `app_data_dir` because no persisted job depends on them after rollback.

## Dependencies

- `v0-1-domain-model` contracts exist but are not archive-ready; status must be verified/normalized first.
- Tauri file selection/storage path strategy must be selected during design.

## Product Decisions

- Users always confirm physical width and height in centimeters for imported designs.
- Pixel dimensions and SVG `viewBox` never determine final physical output size; they support source geometry and visible-bounds detection only.

## Success Criteria

- [ ] Roadmap status reflects verified evidence for `v0-1-domain-model` without false completion.
- [ ] Importing PNG/SVG creates a distinct app-data copy and design state entry.
- [ ] Transparent padding does not affect persisted visible bounds/aspect ratio.
