## Exploration: v0-1-domain-model

### Current State
The project already has a runnable Tauri/React shell with placeholder domain contracts in both TypeScript and Rust. `src/types/domain.ts` defines `DesignInput`, `Placement`, and `Sheet`; `src-tauri/src/domain/design.rs` mirrors those structs with serde-compatible snake_case fields. The `run_packing` Tauri command exists but returns an empty vector, and `src-tauri/src/domain/packing.rs` is only a placeholder.

Domain documentation is ahead of implementation: `docs/domain-and-data-model.md` already defines centimeters as the domain source of truth, configurable sheet dimensions, immutable `originalAspectRatio`, disk-backed image paths, duplicated designs sharing the same image path, and TS/Rust model sketches. `docs/functional-requirements.md` ties this change to RF-002 (design configuration) and RF-013 (sheet configuration). `openspec/config.yaml` requires strict TDD and reinforces that Rust owns domain, packing, persistence, and PNG export.

Key gap: the current types are structurally present but not yet hardened into explicit domain contracts. There are no Rust serialization tests, no validation boundaries for dimensions/quantity/sheet size, no explicit packing result type beyond `Sheet[]`, and no shared job/layout aggregate for future persistence/export flows.

### Affected Areas
- `src/types/domain.ts` — frontend domain contracts already exist but may need explicit aliases/types for cm units, sheet configuration, packing result, and future job persistence.
- `src/utils/units.ts` — contains `cmToPx`; likely needs rounding/validation expectations documented and tested for preview/export boundaries.
- `src/utils/units.test.ts` — already covers basic cm-to-px conversion; should be extended for boundary/precision expectations.
- `src/store/useAppStore.ts` — stores designs, sheets, and sheet dimensions; currently uses hardcoded initial sheet size (`60 x 100`) in UI state, not domain logic.
- `src/commands/index.ts` — command wrapper already passes `designs`, `sheetWidth`, and `sheetHeight`; should align with any new `SheetConfig` or `PackingRequest` contract.
- `src/components/SheetPreview/SheetPreview.tsx` — converts cm to preview pixels correctly at the UI boundary; depends on `Sheet`/`Placement` shape.
- `src/components/MetricsPanel/MetricsPanel.tsx` — derives area metrics from `Sheet`/`Placement`; future result model should not break this assumption.
- `src-tauri/src/domain/design.rs` — Rust structs mirror TS types; needs serde tests and possibly domain-level aliases/newtypes or request/result structs.
- `src-tauri/src/domain/packing.rs` — empty placeholder; for this change it should define packing-domain contracts but not the algorithm.
- `src-tauri/src/commands/packing.rs` — command signature may evolve from scalar sheet dimensions to an explicit request/config shape.
- `docs/domain-and-data-model.md` — already documents the intended model; should be updated only if the implemented contract changes or becomes more explicit.
- `docs/architecture-and-stack.md` — should reflect React/Rust boundary changes if command payloads change.
- `docs/testing-strategy.md` — already calls out serialization and unit conversion tests; this change should satisfy the v0.1 minimum for those areas.

### Approaches
1. **Minimal mirror contracts** — Keep the existing `DesignInput`, `Placement`, and `Sheet` names, add missing request/result/config types only where needed, and cover TS/Rust serialization/conversion with tests.
   - Pros: Smallest change, low review burden, aligns with existing docs and code, good fit for v0.1 foundation.
   - Cons: Does not fully prevent invalid units/quantities at the type level; validation may remain procedural.
   - Effort: Low/Medium

2. **Explicit domain vocabulary layer** — Introduce `Cm`, `SheetConfig`, `DesignQuantity`, `PackingRequest`, `PackingResult`, and validation helpers while preserving JSON-friendly primitives at the Tauri boundary.
   - Pros: Clearer capability mapping, stronger domain language, easier future persistence/export evolution.
   - Cons: More code and tests now; if overdone with Rust newtypes, serde/Tauri payload friction increases.
   - Effort: Medium

3. **Generated shared schema** — Define a schema source and generate TypeScript/Rust contracts.
   - Pros: Strongest cross-language drift protection.
   - Cons: Tooling overhead is unjustified for this early local MVP; adds complexity before the domain stabilizes.
   - Effort: High

### Recommendation
Use Approach 2 in a deliberately lightweight form: establish explicit domain vocabulary without introducing heavy schema generation or opaque Rust newtypes at the Tauri boundary. Keep JSON payloads simple and serde-friendly, but name the capabilities clearly in both languages.

Recommended capability mapping for the next phase:

| Capability | TypeScript contract | Rust contract | Notes |
|---|---|---|---|
| Physical centimeters | `type Cm = number` or documented numeric fields ending in `Cm` | `type Cm = f64` or documented `*_cm: f64` fields | Domain source of truth; no packing in pixels. |
| Sheet configuration | `SheetConfig { widthCm, heightCm }` | `SheetConfig { width_cm, height_cm }` | Satisfies RF-013; no hardcoded domain dimensions. |
| Design configuration | Existing `DesignInput` | Existing `DesignInput` | Satisfies RF-002; keep `quantity` and `canRotate`. |
| Placement/layout item | Existing `Placement` | Existing `Placement` | Coordinates and dimensions stay in cm. |
| Packing output | `PackingResult { sheets }` or documented `Sheet[]` | `PackingResult { sheets }` or `Vec<Sheet>` | Prefer explicit result if future warnings/unplaced items are expected. |
| Boundary conversion | `cmToPx(cm, dpi)` | future export helper | Conversion only for preview/export; tests define precision. |
| Serialization parity | Vitest type fixtures where useful | `serde_json` round-trip tests | Critical for React/Rust alignment. |

For proposal/spec, frame the change as a contract-hardening task, not packing implementation. Acceptance should require unit tests for `cmToPx` and Rust serde round-trips, plus documented command payload alignment if `run_packing` changes.

### Risks
- Type drift between TypeScript camelCase and Rust snake_case if contracts evolve without serde tests.
- Scope creep into MaxRects implementation; the roadmap explicitly says this change does not include the packing algorithm.
- Introducing heavy unit newtypes may complicate Tauri serialization before the MVP needs that strictness.
- Current UI state has default sheet dimensions; proposal should distinguish allowed UI defaults from forbidden domain hardcoding.
- `originalAspectRatio` is documented as immutable, but import/aspect-ratio validation is scheduled later, so this change should define the field without implementing extraction or deformation confirmation.

### Ready for Proposal
Yes. The orchestrator should start `sdd-propose` for canonical change id `v0-1-domain-model`, with scope limited to TS/Rust domain contracts, cm-to-px helpers/tests, serde serialization tests, and documentation alignment for RF-002/RF-013. Do not include file import, editing UI, MaxRects, persistence, export, or aspect-ratio extraction beyond preserving the model field.
