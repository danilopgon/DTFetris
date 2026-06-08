# Proposal: v0-1-domain-model

## Intent

Define the v0.1 domain contract for DTFetris so RF-002 design configuration and RF-013 sheet configuration have aligned TypeScript/Rust models before packing, persistence, and export build on them.

## Scope

### In Scope
- Define explicit TS/Rust domain contracts for centimeter units, sheet configuration, design inputs, quantities, placements, sheets, packing requests, and packing results.
- Use default sheet size `55 cm x 100 cm` only as application/UI initial configuration, not as a hardcoded domain invariant.
- Allow a design quantity of `0` while editing, but reject generation/packing unless at least one design has a positive quantity.
- Restrict MVP physical dimensions to integer centimeters.
- Model unplaced designs/items explicitly in packing results for future multipage behavior.
- Keep cm/px conversion separate from pure domain models; preview/export boundaries may convert, and export will later target 300 DPI.
- Add/align focused docs and serialization/unit tests needed to prevent TS/Rust drift.

### Out of Scope
- MaxRects or any real packing algorithm.
- File import, image metadata extraction, persistence, PNG export, and multipage implementation.
- Automatic deformation/aspect-ratio correction beyond preserving existing model intent.
- Generated schema tooling or heavy opaque unit newtypes at the Tauri JSON boundary.

## Capabilities

### New Capabilities
- `domain-model`: Defines the canonical DTFetris domain contracts for sheet/design configuration, centimeter-based layout data, packing request/result shapes, and validation boundaries.

### Modified Capabilities
- None. `openspec/specs/` currently has no existing capabilities to modify.

## Approach

Use the exploration recommendation: a lightweight explicit domain vocabulary. Keep JSON payloads serde-friendly while naming concepts clearly in both languages (`SheetConfig`, `PackingRequest`, `PackingResult`, `UnplacedItem`). Use integer centimeter validation for physical dimensions, procedural validation for editable quantity rules, and Rust serde round-trip tests to lock camelCase/snake_case parity.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types/domain.ts` | Modified | Frontend domain contracts and result shapes. |
| `src/commands/index.ts` | Modified | Packing command payload alignment. |
| `src/store/useAppStore.ts` | Modified | Initial 55 x 100 sheet config and generation guard. |
| `src/utils/units.ts` | Modified | Boundary-only cm/px expectations. |
| `src-tauri/src/domain/design.rs` | Modified | Serde-compatible Rust contracts. |
| `src-tauri/src/domain/packing.rs` | Modified | Request/result/unplaced models. |
| `src-tauri/src/commands/packing.rs` | Modified | Command contract alignment. |
| `docs/domain-and-data-model.md` | Modified | Document finalized domain rules. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep into packing/export | Medium | Specs must state contract-only scope. |
| TS/Rust type drift | Medium | Add Rust serde tests and TS fixtures where useful. |
| Integer cm conflicts with existing decimals | Low | Treat decimals as invalid MVP input. |

## Rollback Plan

Revert the domain contract changes and docs/tests together; restore prior `Sheet[]` command/result shape and previous application default dimensions.

## Dependencies

- RF-002 and RF-013 in `docs/functional-requirements.md`.
- Domain rules in `docs/domain-and-data-model.md`.

## Success Criteria

- [ ] TS and Rust expose aligned domain contracts for RF-002/RF-013.
- [ ] Packing result can represent placed sheets and unplaced items.
- [ ] Generation is blocked unless at least one design has quantity > 0.
- [ ] MVP dimensions validate as integer centimeters.
- [ ] cm/px conversion remains outside pure domain modeling.
