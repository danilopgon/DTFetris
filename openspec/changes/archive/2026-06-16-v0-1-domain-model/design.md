# Design: v0.1 Domain Model

## Technical Approach

Establish a lightweight, explicit domain vocabulary in TypeScript and Rust while keeping Tauri JSON payloads simple. The change hardens RF-002 and RF-013 contracts: centimeters remain the domain source of truth, dimensions are validated as positive integer centimeters for MVP, quantity `0` is allowed only in editable state, and packing output can preserve unplaced items for later multipage work. Real MaxRects packing is intentionally out of scope.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Unit modeling | Use primitive numeric fields with `Cm` alias / `*_cm` naming plus validation helpers. | Heavy Rust newtypes or generated schemas. | Keeps serde/Tauri payloads low-friction while making centimeter intent explicit. |
| Sheet defaults | Define `DEFAULT_SHEET_CONFIG = { widthCm: 55, heightCm: 100 }` at app/UI state initialization. | Hardcode in Rust/domain model. | Spec allows the app default but forbids a domain invariant. |
| Command shape | Move `runPacking` to a `PackingRequest` object and return `PackingResult`. | Keep `(designs, sheetWidth, sheetHeight) -> Sheet[]`. | One request/response contract is easier to serialize, validate, and extend with `unplacedItems`. |
| Validation boundary | Allow edit-state validation to accept quantity `0`; require generation validation before invoking Rust packing. Rust also validates command inputs defensively. | Validate only in UI or only in Rust. | Dual boundary prevents bad commands while preserving smooth editing. |
| Result model | `PackingResult { sheets, unplacedItems }`, with placements in `sheets[].placements`. | Encode unplaced as missing placements or separate errors. | Explicit unplaced data avoids dropping requested designs and supports future multipage. |

## Data Flow

```text
Zustand editable state
  ├─ sheetConfig: SheetConfig (default 55x100, user configurable)
  └─ designs: DesignInput[] (quantity may be 0)
        ↓ validateForPacking()
PackingRequest { sheet, designs with positive quantities }
        ↓ Tauri invoke('run_packing', { request })
Rust serde DTOs + validation
        ↓ placeholder/domain packing contract only
PackingResult { sheets, unplacedItems }
        ↓
Zustand stores result.sheets; UI may later surface unplacedItems
```

Preview/export pixel conversion stays outside this flow. `cmToPx` remains a boundary helper; later export should use 300 DPI.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/types/domain.ts` | Modify | Add `Cm`, `SheetConfig`, `PackingRequest`, `PackingResult`, `UnplacedItem`; preserve existing `DesignInput`, `Placement`, `Sheet` names where possible. |
| `src/commands/index.ts` | Modify | Change packing wrapper to send/receive explicit request/result contracts. |
| `src/store/useAppStore.ts` | Modify | Initialize 55x100 default config and add generation guard before calling packing. |
| `src/utils/units.ts` | Modify | Keep conversion boundary-only; optionally add named `EXPORT_DPI = 300` without coupling it to domain models. |
| `src-tauri/src/domain/design.rs` | Modify | Keep design/placement/sheet structs serde-compatible; add `rename_all = "camelCase"` for JSON parity. |
| `src-tauri/src/domain/packing.rs` | Modify | Define `SheetConfig`, `PackingRequest`, `PackingResult`, `UnplacedItem`, validation helpers, and tests; no MaxRects logic. |
| `src-tauri/src/commands/packing.rs` | Modify | Accept `PackingRequest`, validate it, return `PackingResult`. |
| `docs/domain-and-data-model.md` | Modify | Update Spanish domain docs with final contracts, integer-cm rule, quantity rule, and explicit unplaced result. |
| `docs/architecture-and-stack.md` | Modify | Update React/Rust command contract examples. |
| `docs/testing-strategy.md` | Modify | Document serde parity, domain validation, and boundary conversion tests. |

## Interfaces / Contracts

```ts
type Cm = number
type SheetConfig = { widthCm: Cm; heightCm: Cm }
type PackingRequest = { sheet: SheetConfig; designs: DesignInput[] }
type UnplacedItem = { designId: string; itemIndex: number; reason: string }
type PackingResult = { sheets: Sheet[]; unplacedItems: UnplacedItem[] }
```

Rust should mirror these structs with snake_case fields and `#[serde(rename_all = "camelCase")]` so frontend JSON remains camelCase. Validation rules: dimensions must be finite positive integers; packing requires at least one design with `quantity > 0`; editable state may retain zero-quantity designs.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| TS unit | Domain validation and default sheet config. | Vitest tests for integer dimensions, zero quantity edit allowance, and packing rejection with no positive quantity. |
| TS unit | Unit conversion remains boundary-only. | Extend `units.test.ts` for 300 DPI examples; avoid importing conversion in domain validation. |
| Rust unit | Serde parity and validation. | `serde_json` round-trip tests using camelCase JSON and invalid dimension/quantity cases. |
| Command | `run_packing` contract. | Rust tests or focused command-level tests for valid request and validation error strings. |
| E2E | Not required for this contract-only phase. | Defer user workflow coverage to packing/UI changes. |

## Migration / Rollout

No persisted-job migration required. Existing placeholder state can be updated in one small implementation slice because no production persistence format exists yet.

## Open Questions

- [ ] Should `UnplacedItem.reason` be a free Spanish UI-ready string later, or a stable enum/code mapped by the UI? Recommended for this phase: stable code/string identifier, not user-facing copy.
