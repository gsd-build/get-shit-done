# Vertical MVP Slice planning mode — single mode-switched agent across the planning pipeline (#2826)

- **Status:** Accepted
- **Date:** 2026-05-17
- **Decision date:** 2026-04-29 (PRD Phase 1 ship)
- **Implementation:** PRs #2867, #2874, #2878, #2880, #2883 (all squash-merged via #3206); v1.45.0 release cut via PR #3676

The default GSD planning pipeline (`discuss → research → plan → execute → verify`) produces **horizontal layer plans** — phases that build the system one technical layer at a time (schema → API → auth → UI → wiring). For solo developers shipping a new product with AI assistance, this delays the first end-to-end exercise of the system until the final wiring phase. Motivation drops, layer-spanning architecture mistakes surface late, and the AI has no end-to-end ground truth to validate against until very late.

Issue [#2826](https://github.com/gsd-build/get-shit-done/issues/2826) (the umbrella PRD) proposed an opt-in **vertical-slice** planning mode: each phase delivers one end-to-end user capability (UI → API → DB for one user story), so by the end of every phase there is something a real user can touch. Phase 1 of a new project under this mode emits a **Walking Skeleton** plan — the thinnest end-to-end stack that exercises every layer with one trivial feature, proving the wiring before any layer is fleshed out.

The architectural question was not *whether* to add MVP mode — the PRD approved that. The architectural question was *where the seam lives*: one mode-switched agent across the existing planning pipeline, or a parallel `gsd-vertical-planner` agent (plus parallel executor/verifier) that runs alongside the current pipeline.

## Decision

- Add **MVP mode as a single boolean (`MVP_MODE`) that mode-switches the existing planning-pipeline agents** (`gsd-planner`, `gsd-executor`, `gsd-verifier`) rather than introducing parallel agents.
- Define one **resolution chain** for `MVP_MODE`, consulted by every workflow that needs it:
  `CLI flag (--mvp) → ROADMAP **Mode:** field → workflow.mvp_mode config → false`
  CLI flag wins; lowest-precedence default is off. The chain is implemented once in `get-shit-done/bin/lib/roadmap.cjs` (which parses `**Mode:**` from phase sections) and consumed verbatim by every workflow.
- Persist mode per-phase in ROADMAP.md as `**Mode:** mvp` so the choice survives across sessions and downstream commands (`/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-verify-work`, `/gsd-progress`, `/gsd-stats`, `/gsd-graphify`) auto-detect without re-passing flags.
- Introduce **`/gsd-mvp-phase <N>`** as the guided entry point that mutates ROADMAP for phase N (writes `**Mode:** mvp` and a user-story `**Goal:**`), then delegates to `/gsd-plan-phase <N>` — no `--mvp` flag at delegation time, because the planner detects MVP from ROADMAP.
- The MVP+TDD runtime gate (in `execute-phase`) is **blocking by default** when both `MVP_MODE` and `TDD_MODE` are active. The end-of-phase TDD review escalates from advisory to blocking under the same condition; phases with missing RED→GREEN commits cannot be marked complete without `--force-mvp-gate`. Pure doc-only / config-only / test-only tasks are exempt.
- Verify-work flips the UAT script's framing under `MVP_MODE`: user-flow steps (open, fill, click, observe) run **before** technical correctness checks (endpoint schemas, error states). A user-story-format guard halts verification if a `mode: mvp` phase's `**Goal:**` doesn't parse as `As a … I want to … so that …`.
- Discovery surfaces (`new-project`, `progress`, `stats`, `graphify`) detect `**Mode:** mvp` and adapt their output so users can see at a glance which phases are MVP-mode.

## Why this seam

**Deletion test (single mode-switched agent vs parallel agents):** if the MVP-mode branch in `gsd-planner` were deleted, the same branching would have to reappear in `gsd-executor`, `gsd-verifier`, `gsd-progress`, `gsd-stats`, `gsd-graphify` — five places — because the resolution chain still needs a single answer per phase. The branching concentrates in one resolver (`roadmap.cjs` plus the `MVP_MODE` env contract) and one section per agent prompt. Splitting to parallel agents would *spread* the branching across two pipelines that drift independently.

**One adapter, one seam.** Today there is exactly one adapter at the MVP-mode seam: `roadmap.cjs::getPhase()` returns `{ mode }`, and every workflow file uses the same resolution chain. The PRD's "future split into a dedicated `gsd-vertical-planner` agent" remains valid — but per the *one adapter = hypothetical seam, two adapters = real seam* principle, splitting now would manufacture a second adapter to justify the seam rather than respond to actual divergence pressure.

**Locality.** Bugs in MVP planning concentrate in three places: `roadmap.cjs` (mode parsing), `gsd-planner.md` (MVP Mode Detection section), `mvp-phase.md` (user-story capture + ROADMAP mutation). A maintainer chasing "why did MVP mode not fire" reads those three files; they do not bounce across two parallel agent trees.

**Walking Skeleton trigger lives in plan-phase, not new-project.** New-project sets the *default* mode for the milestone, but the Walking Skeleton output (`SKELETON.md`) is emitted by `gsd-planner` when `MVP_MODE=true && PHASE_NUMBER=1 && no-existing-code`. Putting the trigger in the planner — not in new-project — means existing projects that opt into MVP mode for a *future* phase 1 (e.g., greenfield rewrite inside an existing repo) still get the Skeleton.

**MVP+TDD gate blocks rather than warns.** The PRD's rationale is that an MVP-mode phase that ships RED→GREEN-violating commits has *no executable proof* that the user-flow works end-to-end, which is the whole point of MVP mode. Advisory-only would silently let phases ship without the proof. `--force-mvp-gate` exists for genuine emergencies; the default is blocking.

## Consequences

- **Single agent surface, not two.** `gsd-planner`, `gsd-executor`, `gsd-verifier` each gain one MVP Mode section (loaded into the prompt only when `MVP_MODE=true`). No parallel `gsd-vertical-planner` agent file.
- **One `roadmap.cjs` ownership of mode parsing.** All callers — workflows, SDK queries, agents — go through `getPhase()` for the `mode` field. No alternate parser is permitted; lint via the SDK seam coverage gate.
- **ROADMAP.md schema is additively extended.** `**Mode:**` is a new optional bold-prefix field on phase sections. Absent = standard. Unrecognized values are preserved verbatim, lowercased + trimmed; forward-compat for future modes (e.g. `bdd`, `event-storming`) without re-litigating this ADR.
- **Three new references live under `get-shit-done/references/`:** `planner-mvp-mode.md`, `execute-mvp-tdd.md`, `verify-mvp-mode.md` — each loaded by its respective agent only when MVP mode is active.
- **SDK gains three MVP query verbs:** `phase.mvp-mode`, `task.is-behavior-adding`, `user-story.validate`. Authoritative answers come from the SDK; workflows shell out via `gsd-sdk query` rather than re-implementing the logic.
- **Back-compat is total.** Projects that never opt into MVP mode see no behavior change. The CHANGELOG entry, RELEASE-v1.45.0.md, and docs/USER-GUIDE.md all frame MVP mode as opt-in.

## Rejected alternatives

1. **Separate `gsd-vertical-planner` / `gsd-vertical-executor` / `gsd-vertical-verifier` agents.** Rejected because it doubles the agent surface for what is, at decision time, a single boolean branching point. Two agents become defensible the moment the MVP and horizontal pipelines need fundamentally different prompts or different tools — neither is true today. If divergence pressure appears later, the split becomes the natural ADR-N follow-up; the current ADR explicitly does *not* foreclose it.

2. **Automatic detection of MVP-vs-horizontal from the phase goal.** Rejected for v1.45.0: heuristics that read the goal string and guess the mode are unreliable, and a wrong guess silently routes the entire phase through the wrong pipeline. The explicit `--mvp` flag or `**Mode:** mvp` field gives the developer unambiguous control. Detection can be added later as a default with manual override; it is not the right starting point.

3. **A new project type (`/gsd new-project --mvp` as a first-class fork).** Rejected because mode is a *planning strategy*, not a *project structure*. Forking project types fragments the user base and complicates `new-project` for no architectural gain. A boolean on existing phases gives the same outcome with less surface.

4. **MVP+TDD gate as advisory rather than blocking.** Rejected because the gate's purpose is to enforce that the user-flow proof exists *before* the phase completes; advisory mode means a phase can ship without the proof, which collapses MVP mode back to a documentation convention. `--force-mvp-gate` is the escape hatch for emergencies.

5. **Walking Skeleton lives in `/gsd-new-project`.** Rejected because greenfield rewrites inside an existing repo (a real use case for solo developers) still want Walking Skeleton on their *next* Phase 1, even though `new-project` already ran. Putting the trigger in `gsd-planner` keyed on `(MVP_MODE && PHASE_NUMBER==1 && no-existing-code)` handles both cold-start and rewrite cases with one rule.
