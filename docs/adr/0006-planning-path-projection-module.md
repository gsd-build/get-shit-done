# Planning Path Projection Module for SDK query handlers

- **Status:** Accepted
- **Date:** 2026-05-09

We decided to centralize SDK planning-path projection behind one Module interface instead of reconstructing `.planning` paths in each handler with ad-hoc joins. This deepens the planning seam and prevents path-policy drift between helper and caller layers.

## Decision

- `helpers.planningPaths(projectDir, workstream?)` is the canonical SDK projection interface for planning paths.
- `helpers.planningPaths` delegates to `workspacePlanningPaths` + `resolveWorkspaceContext` for policy, not duplicate local path composition.
- Policy precedence is explicit and stable: `explicit workstream > env workstream > env project > root`.
- Query/init handlers (`initExecutePhase`, `initPlanPhase`, `initPhaseOp`, `initMilestoneOp`) must consume `planningPaths(...).planning` rather than direct `relPlanningPath` joins.
- SDK project scope for planning is `.planning/<project>` (never `.planning/projects/<project>`), aligned with CJS planning workspace behavior.

## Consequences

- One fix in planning path policy updates all handlers and reduces regression surface.
- Tests can target seam behavior (`workspace.test.ts`, `helpers.test.ts`, init handler tests) instead of source-grep heuristics.
- Cross-package parity bugs between SDK and CJS planning path resolution become easier to detect and correct.
