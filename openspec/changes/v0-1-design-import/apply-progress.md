# Apply Progress: v0.1 Design Import

## Slice 1 — Roadmap and SDD Artifact Cleanup

**Delivery strategy**: chained PRs  
**Chain strategy**: stacked-to-main  
**Review boundary**: roadmap/docs/OpenSpec artifact housekeeping only; no product-code implementation.

## Completed Tasks

- [x] 1.1 RED: Added focused doc assertion notes that `v0-1-domain-model` must remain in-progress/native re-verification pending, not completed.
- [x] 1.2 GREEN: Updated `docs/sdd-roadmap-tasks.md`, `design.md`, and `exploration.md` to remove stale current-blocker claims about Vitest/Playwright collection and missing ESLint flat config.
- [x] 1.3 REFACTOR: Kept cleanup wording concise and scoped broad E2E to roadmap timing rather than a current runner blocker.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Wrote explicit expected status assertion before artifact cleanup | ✅ Roadmap status now reflects in-progress/re-verification pending | ➖ Single documentation invariant | ✅ Wording avoids completion overclaim |
| 1.2 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Identified stale blocker claims against current `vitest.config.ts` and `eslint.config.mjs` evidence | ✅ Stale blocker claims removed/qualified in SDD artifacts | ✅ Checked both design and exploration notes | ✅ Current evidence separated from old verify verdict |
| 1.3 | N/A — documentation assertion | Documentation | N/A (docs only) | ✅ Asserted broad E2E should be deferred by roadmap scope only | ✅ Design wording no longer calls E2E a current collection blocker | ➖ Single wording cleanup | ✅ Concise review-facing notes |

## Verification

- Not run: `npm run test`, `npm run lint`, and `cargo test` were skipped because this slice changed only Markdown documentation/OpenSpec artifacts and no code paths, test fixtures, or configuration executable by those runners.
- Static evidence checked by reading current `vitest.config.ts` (`tests/e2e/**` excluded) and `eslint.config.mjs` (flat config exists).

## Remaining Tasks

- [ ] Phase 2: Rust Import Core
- [ ] Phase 3: TypeScript Contract and State
- [ ] Phase 4: Spanish UI and Documentation
- [ ] Phase 5: Verification Commands

## Notes

- `v0-1-domain-model` is not marked complete because the last native verify report still records `FAIL`; the correct follow-up is re-verification/archive readiness, not roadmap overclaiming.
- No Rust import command, visible-bounds algorithm, TypeScript/store wiring, or UI import flow was implemented in this slice.
