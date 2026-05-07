# v1.50.0-canary.1 Release Notes

First canary cut for the **1.50.0** train. Published to npm under the `canary` dist-tag.

```bash
npx get-shit-done-cc@canary
# or pin exact:
npm install -g get-shit-done-cc@1.50.0-canary.1
```

> **Canary stream caveat.** Canary builds come from the long-lived `dev` integration branch and may carry rough edges that the `next` (RC) and `latest` (stable) channels never see. Use canary when you want to exercise in-flight features early and report findings; do NOT pin production projects to it. See [CANARY.md](CANARY.md) for the stream policy and rollback path.

---

## Headline: Vertical MVP / TDD / UAT planning track

The 1.50.0 train opens with a four-phase vertical slice that adds an end-to-end "MVP mode" to the GSD planning pipeline — from project kickoff, through phase planning, through execution, through verification. Issue [#2826](https://github.com/gsd-build/get-shit-done/issues/2826) is the umbrella PRD.

### What's new

#### `/gsd plan-phase --mvp` — vertical-slice planning ([#2867](https://github.com/gsd-build/get-shit-done/pull/2867))

`/gsd plan-phase` learns a `--mvp` flag that flips the planner into vertical-slice mode. The planner reads `**Mode:** mvp` from a phase's ROADMAP entry, an explicit `--mvp` CLI override, or `workflow.mvp_mode` in `.planning/config.json` (precedence in that order, with the CLI flag winning). Under MVP mode the planner:

- Surfaces a "Walking Skeleton" template for the very first phase of a new project — a thin end-to-end vertical slice that proves the wiring before any horizontal layer is built
- Suppresses horizontal-layer language ("data layer first, then business logic, then UI") in favor of user-flow-driven decomposition
- Emits the user story as a header at the top of `PLAN.md`

New required-reading injection: `references/planner-mvp-mode.md`. New parser surface: `roadmap.cjs` extracts a `mode` field on every phase lookup.

#### `/gsd mvp-phase <N>` — guided user-story phase framing ([#2874](https://github.com/gsd-build/get-shit-done/pull/2874))

A new top-level command that walks the user through framing a phase as a vertical MVP slice before planning. Three structured prompts capture an "As a / I want to / So that" user story. If the story is too large, an interactive SPIDR (Spike / Path / Interface / Data / Rule) splitting flow surfaces a list of `/gsd add-phase` invocations to break the work apart. The command then:

- Mutates the ROADMAP entry to set `**Mode:** mvp` and replaces `**Goal:**` with the assembled user story
- Delegates to `/gsd plan-phase --mvp <N>` to produce the plan

Two new references: [`spidr-splitting.md`](../get-shit-done/references/spidr-splitting.md), [`user-story-template.md`](../get-shit-done/references/user-story-template.md).

#### Execute-phase MVP+TDD runtime gate ([#2878](https://github.com/gsd-build/get-shit-done/pull/2878))

When `MVP_MODE` and `TDD_MODE` are both true at execution time, `execute-phase` adds a per-task gate that requires a `test(<phase>-<plan>):` commit to exist before the corresponding `feat(...)` commit. The reference [`execute-mvp-tdd.md`](../get-shit-done/references/execute-mvp-tdd.md) documents the contract; the executor agent (`agents/gsd-executor.md`) gains an MVP+TDD Gate section that explains when the gate trips, what evidence it expects, and how to escalate via the documented escape hatch.

> **Known canary-bake item.** The current bash gate snippet uses some workflow variables that aren't fully wired (`${PLAN_ID}`, `${TASK_TDD}`) and the documented `--force-mvp-gate` escape hatch is referenced in the user-facing error message but not yet implemented in the argument parser. These are tracked as canary-bake follow-ups; the gate itself is functional for the dominant code path.

#### Verify-work MVP-mode UAT framing ([#2880](https://github.com/gsd-build/get-shit-done/pull/2880))

Under MVP mode, `verify-work` flips the UAT script's framing so user-flow steps come **before** technical correctness checks — the inverse of the default order. The verifier agent gains a `mvp_mode_verification` section. New reference: [`verify-mvp-mode.md`](../get-shit-done/references/verify-mvp-mode.md).

A user-story format guard at the top of `extract_tests` will halt verification if a phase claims `**Mode:** mvp` but its `**Goal:**` doesn't parse as `As a … I want to … so that …` — pointing the user at `/gsd mvp-phase <N>` to repair.

#### Discovery & progress surfaces ([#2883](https://github.com/gsd-build/get-shit-done/pull/2883))

The MVP slice closes out with read-side surfaces:

- **`/gsd new-project`** prompts up front for **Vertical MVP** vs **Horizontal Layers** mode and seeds the milestone accordingly
- **`/gsd-progress`** emits a "User-flow next up" panel for MVP-mode phases, surfacing user-visible task names ahead of internal scaffolding
- **`/gsd-stats`** adds an "MVP phases: N" summary line when the roadmap contains any
- **`/gsd-graphify`** visually differentiates MVP-mode phase nodes from horizontal-layer phases in the rendered graph

---

## Bonus fixes also in this canary

- **`/gsd-progress` no longer cites stale CLAUDE.md project blocks** as the source for the "Next Up" section ([#2912](https://github.com/gsd-build/get-shit-done/issues/2912)) — explicit context-authority directive added to the report step.

(Other recent main-stream fixes — agent-skills CLI JSON wrap, audit-open ReferenceError, execute-phase branching, Hermes runtime — target the `next` stream and will arrive in the canary when they land in `dev`.)

---

## Install / upgrade

```bash
# Try the canary
npx get-shit-done-cc@canary

# Or pin exact
npm install -g get-shit-done-cc@1.50.0-canary.1
```

The installer's defensive purge will rewrite stale config blocks left by older GSD versions on first run. No manual cleanup needed.

## Reporting issues

If something breaks on canary, file against [the issue tracker](https://github.com/gsd-build/get-shit-done/issues) with the `bug` template and mention `1.50.0-canary.1` so it gets routed back into the dev stream rather than the stable stream.

## What ships next in this train

Pending dev-stream merges that should land before promotion to `next`:
- Resolve canary-bake items in the MVP+TDD gate (variable wiring + `--force-mvp-gate` parser)
- Sync recent main-stream fixes (`#2918`, `#2919`, `#2921`, `#2917`, `#2920`) into dev
- Ride a few canary cycles for real-user MVP/TDD/UAT feedback

When the dev stream stabilizes, the train promotes to `main` as `v1.50.0-rc.1` (the `next` channel).
