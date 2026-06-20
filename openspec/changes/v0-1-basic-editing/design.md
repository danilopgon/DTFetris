# Design: v0.1 Basic Editing

## Technical Approach

Add editing as frontend-owned state mutations in the existing React/Zustand layer. Keep Rust import, packing, export, and persistence command contracts unchanged for this slice. `DesignInput.widthCm` and `heightCm` remain the user's requested whole-centimeter cell; proportional visible artwork size is derived when a consumer needs it and never written back over the requested cell.

Successful edit, duplicate, and delete mutations clear current `sheets` and set an explicit stale-layout flag. They must not call `runPacking`, because the Rust command is still a validator-backed placeholder and this change must not fabricate placements.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Mutation owner | Centralize `updateDesign`, `duplicateDesign`, `removeDesign` invalidation in `src/store/useAppStore.ts`. | Component-local array edits. | Store-level rules prevent `DesignList` from becoming the only place that knows when layout is stale. |
| Layout invalidation | Add `isLayoutStale`/`needsRecalculation` and clear `sheets` on successful layout-affecting design mutations. | Invoke `runPacking`; keep stale sheets visible. | Preserves RF-012 interim semantics without coupling to fake packing output. |
| Requested vs fitted size | Keep stored `widthCm`/`heightCm` as requested cell footprint; add a pure helper only if preview tests need fitted visible dimensions. | Replace dimensions with fitted visible size. | User intent and v0.1 packing footprint must stay integer cell dimensions. |
| Delete confirmation | Keep confirmation UI state in `DesignList`; store exposes only confirmed `removeDesign(id)`. | Store-managed modal state. | Confirmation is presentation flow; deletion semantics belong in store. |
| IDs for duplicates | Generate duplicate ids in frontend with `crypto.randomUUID()` fallback helper. | Copy original id; ask Rust. | Duplicates share `imagePath` but must be distinct without backend asset copying. |

## Data Flow

```text
DesignList form ──valid patch──> useAppStore.updateDesign(id, patch)
DesignList duplicate ──────────> useAppStore.duplicateDesign(id)
Confirm dialog accepted ───────> useAppStore.removeDesign(id)
        │                                  │
        └──── Spanish validation/errors    └─ clears sheets + marks layout stale
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/types/domain.ts` | Modify | Change editable quantity validation to minimum `1`; optionally export `DesignUpdatePatch` and `getFittedVisibleSizeCm`. |
| `src/store/useAppStore.ts` | Modify | Add update/duplicate/remove invalidation actions and stale-layout state. |
| `src/components/DesignList/DesignList.tsx` | Modify | Add Spanish edit, save/cancel, duplicate, and confirm-delete controls. |
| `src/**/*test*` | Modify | Add store/type/component tests for validation, mutations, Spanish copy, and no packing call. |
| `src-tauri/**` | No change | Rust command/type contracts stay aligned; no packing implementation. |

## Interfaces / Contracts

```ts
type DesignUpdatePatch = Partial<Pick<DesignInput,
  'name' | 'widthCm' | 'heightCm' | 'quantity' | 'canRotate'
>>

type AppState = {
  isLayoutStale: boolean
  updateDesign(id: string, patch: DesignUpdatePatch): { ok: true } | { ok: false; errors: DomainValidationError[] }
  duplicateDesign(id: string): DesignInput | null
  removeDesign(id: string): void
}
```

Validation rules: requested dimensions must be positive integers; quantity must be integer `>= 1`; name should remain non-empty after trimming. Duplicate copies editable values, `format`, `visibleBounds`, `originalAspectRatio`, and `imagePath`, but receives a new id and a distinguishable Spanish-friendly display name such as `"{name} copia"`.

## UI Component Design

`DesignList` should remain the editing surface for v0.1. Each item can expose an inline edit mode with labels such as `Nombre`, `Ancho solicitado (cm)`, `Alto solicitado (cm)`, `Cantidad`, `Permitir rotación`, `Guardar`, `Cancelar`, `Duplicar`, and `Eliminar`. Error, confirmation, button, placeholder, and `aria-label` copy must be Spanish only. The UI should explain by label or helper text that dimensions are the requested cell, not forced artwork stretching.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Domain validation rejects quantity `0`, fractional/zero dimensions; fitted helper preserves requested cell. | Vitest tests in `src/types/domain.test.ts`. |
| Store | Edit, duplicate, delete update state, share image path on duplicate, clear sheets, mark stale, and do not call commands. | Direct Zustand tests in `src/store/useAppStore.test.ts`. |
| Component | Spanish labels/errors, save/cancel edit, duplicate, confirm/cancel delete, stale message if displayed. | React Testing Library in `DesignList.test.tsx`. |
| Docs | Required docs checked with behavior changes. | Implementation tasks should update focused docs with code. |

## Migration / Rollout

No migration required. Existing imported designs already contain required fields. Any open in-memory work with `quantity: 0` will become invalid when edited or packed.

## Documentation Freshness Plan

Update during implementation: `docs/functional-requirements.md`, `docs/domain-and-data-model.md`, `docs/user-flows.md`, `docs/packing-and-export.md`, `docs/testing-strategy.md`, and `docs/sdd-roadmap-tasks.md` after verification/status changes.

## Review Size / PR Slicing

Medium 400-line risk. Prefer two slices if requested before apply: (1) types/store/tests, (2) `DesignList` UI/docs/tests. Keep Rust out of scope.

## Open Questions

- None blocking for design.
