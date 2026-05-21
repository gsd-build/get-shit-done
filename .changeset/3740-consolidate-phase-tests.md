---
type: Added
pr: 3740
---
<!-- docs-exempt: internal test refactor only — no user-facing surface changed -->

## Summary

Consolidates the Phase Lifecycle Module test cluster from 20 files to 4, satisfying the lint-test-file-count allowlist ceiling.

- Merged 10 small CJS bug-fix test files into `tests/phase.test.cjs`
- Merged `sdk/src/phase-runner-types.test.ts` and `sdk/src/phase-prompt.test.ts` into `sdk/src/phase-runner.test.ts`
- Renamed 4 mis-attributed test files whose production seam is not `phase.cjs`/`phase.ts`:
  - `phase-researcher-app-aware` → `gsd-researcher-app-aware`
  - `phase-researcher-flow-diagram` → `gsd-researcher-flow-diagram`
  - `feat-3023-phase-type-models` → `feat-3023-model-phase-types`
  - `phase-6-cjs-sdk-seam-contracts` → `cjs-sdk-bridge-seam-contracts`
- Fixed `phasePlanIndex` (#3430): non-canonical plan filename warning now flows through `warnings[]` array alongside other diagnostics instead of a separate singular `warning` field
- Updated `scripts/lint-test-file-count.allowlist.json`: `phase` ceiling 20 → 4
- Added Phase Lifecycle Module glossary entry to `CONTEXT.md`

Closes #3740
