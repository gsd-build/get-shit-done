# Planner — MVP Mode (Vertical Slice Strategy)

> Loaded by `gsd-planner` only when `MVP_MODE=true`. Standard horizontal-layer planning rules continue to apply for all other phases.

## Core Rule

**Decompose by feature slice, not by technical layer.** Every task must move the user-facing capability forward. After each task, a real user can click through more of the feature than they could before.

**Forbidden** in MVP mode:
- "Create the database schema" as a standalone task
- "Build the API layer" as a standalone task
- "Wire up the UI" as a final integration task

**Required** in MVP mode:
- The first non-test task produces a working end-to-end path. Stubs are allowed for non-critical branches; the happy path must be real.
- Each subsequent task either adds a new slice OR refines an existing slice (validation, error states, edge cases).
- The phase goal is framed as a user story: "**As a** [user], **I want to** [do X], **so that** [Y]."

## Task Order Pattern

For a feature `F`:

1. **Failing end-to-end test** for the happy path of `F`.
2. **Thinnest viable slice** — UI form → API endpoint → DB read/write — that makes the test pass. Hard-coded values, missing validation, no error states are fine here.
3. **Real data layer** — replace any stubs from Task 2 with real queries.
4. **Validation + error states** — invalid input, network failure, empty states.
5. **Production polish** — loading indicators, edge cases, accessibility checks.

Tasks 3-5 are not always all needed; gate by the phase's acceptance criteria.

## Walking Skeleton Mode (`WALKING_SKELETON=true`)

When the orchestrator sets `WALKING_SKELETON=true` (Phase 1 of a new project under `--mvp`), the plan changes shape:

- The "feature" is the application itself. Pick the smallest meaningful capability that proves the full stack works (e.g., "user can sign up and see their name on a dashboard").
- The plan **must include**:
  - Project scaffold (framework init, routing, build, lint)
  - One real DB read/write
  - One real UI interaction wired to the API
  - Deployment to a dev environment (or a documented local-run command that exercises the full stack)
- The plan **must produce** `SKELETON.md` in the phase directory alongside `PLAN.md`. Use the template at `@~/.claude/get-shit-done/references/skeleton-template.md`. `SKELETON.md` records the architectural decisions that subsequent phases will build on (chosen framework, DB, deployment target, auth approach, directory layout).

`SKELETON.md` is the architectural backbone for every later vertical slice; treat it as a contract, not a scratchpad.

## Anti-Patterns to Reject

- **Layer cake disguised as slices.** Three "vertical" tasks where Task 1 is "all the schemas", Task 2 is "all the endpoints", Task 3 is "all the UI" — that is horizontal planning with new labels. Reject.
- **Skeleton bloat.** Walking Skeleton is the *thinnest* working stack, not "Phase 1 of a normal app." If Skeleton has more than ~5 tasks, you are not skeletonizing.
- **Premature SPIDR splitting.** SPIDR splitting is the `mvp-phase` command's job (Phase 2 of the PRD), not the planner's. If the phase scope feels too large, surface it via the verification loop, do not split silently.

## Acceptance Test for Your Plan

Before emitting the plan, ask: **after Task N completes, can a real user *do* something they could not do after Task N-1?** If the answer is "no, but the foundation is laid", you have a horizontal task disguised as a slice. Restructure.
