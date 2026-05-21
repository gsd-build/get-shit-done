# v1.45.0 Release Notes

Minor release. Published to npm under the `latest` tag.

```bash
npx get-shit-done-cc@latest
# or pin exact:
npm install -g get-shit-done-cc@1.45.0
```

---

## Headline: Vertical MVP / TDD / UAT planning track

1.45.0 ships an end-to-end **MVP mode** for the GSD planning pipeline — from project kickoff, through phase planning, through execution, through verification. Issue [#2826](https://github.com/gsd-build/get-shit-done/issues/2826) is the umbrella PRD; the five implementation sub-phases are [#2885](https://github.com/gsd-build/get-shit-done/issues/2885), [#2875](https://github.com/gsd-build/get-shit-done/issues/2875), [#2877](https://github.com/gsd-build/get-shit-done/issues/2877), [#2879](https://github.com/gsd-build/get-shit-done/issues/2879), [#2882](https://github.com/gsd-build/get-shit-done/issues/2882).

### What's new

#### `/gsd-plan-phase --mvp` — vertical-slice planning ([#2885](https://github.com/gsd-build/get-shit-done/issues/2885), [PR #2867](https://github.com/gsd-build/get-shit-done/pull/2867))

`/gsd-plan-phase` learns a `--mvp` flag that flips the planner into vertical-slice mode. The planner reads `**Mode:** mvp` from a phase's ROADMAP entry, an explicit `--mvp` CLI override, or `workflow.mvp_mode` in `.planning/config.json` (precedence in that order, with the CLI flag winning). Under MVP mode the planner:

- Surfaces a **Walking Skeleton** template for the very first phase of a new project — a thin end-to-end vertical slice that proves the wiring before any horizontal layer is built
- Suppresses horizontal-layer language ("data layer first, then business logic, then UI") in favor of user-flow-driven decomposition
- Emits the user story as a header at the top of `PLAN.md`

New required-reading injection: `references/planner-mvp-mode.md`. New parser surface: `roadmap.cjs` extracts a `mode` field on every phase lookup.

#### `/gsd-mvp-phase <N>` — guided user-story phase framing ([#2875](https://github.com/gsd-build/get-shit-done/issues/2875), [PR #2874](https://github.com/gsd-build/get-shit-done/pull/2874))

A new top-level command that walks the user through framing a phase as a vertical MVP slice before planning. Three structured prompts capture an "As a / I want to / So that" user story. If the story is too large, an interactive **SPIDR** (Spike / Path / Interface / Data / Rule) splitting flow surfaces a list of `/gsd-phase` invocations to break the work apart. The command then:

- Mutates the ROADMAP entry to set `**Mode:** mvp` and replaces `**Goal:**` with the assembled user story
- Delegates to `/gsd-plan-phase <N>` — no flag needed; the planner auto-detects MVP via the `**Mode:** mvp` line just written to ROADMAP.md

Two new references: [`spidr-splitting.md`](../get-shit-done/references/spidr-splitting.md), [`user-story-template.md`](../get-shit-done/references/user-story-template.md).

#### Execute-phase MVP+TDD runtime gate ([#2877](https://github.com/gsd-build/get-shit-done/issues/2877), [PR #2878](https://github.com/gsd-build/get-shit-done/pull/2878))

When `MVP_MODE` and `TDD_MODE` are both true at execution time, `execute-phase` adds a per-task gate that requires a `test(<phase>-<plan>):` commit to exist before the corresponding `feat(...)` commit. The reference [`execute-mvp-tdd.md`](../get-shit-done/references/execute-mvp-tdd.md) documents the contract; the executor agent (`agents/gsd-executor.md`) gains an MVP+TDD Gate section that explains when the gate trips, what evidence it expects, and how to escalate via the documented escape hatch.

#### Verify-work MVP-mode UAT framing ([#2879](https://github.com/gsd-build/get-shit-done/issues/2879), [PR #2880](https://github.com/gsd-build/get-shit-done/pull/2880))

Under MVP mode, `verify-work` flips the UAT script's framing so user-flow steps come **before** technical correctness checks — the inverse of the default order. The verifier agent gains a `mvp_mode_verification` section. New reference: [`verify-mvp-mode.md`](../get-shit-done/references/verify-mvp-mode.md).

A user-story format guard at the top of `extract_tests` will halt verification if a phase claims `**Mode:** mvp` but its `**Goal:**` doesn't parse as `As a … I want to … so that …` — pointing the user at `/gsd-mvp-phase <N>` to repair.

#### Discovery & progress surfaces ([#2882](https://github.com/gsd-build/get-shit-done/issues/2882), [PR #2883](https://github.com/gsd-build/get-shit-done/pull/2883))

The MVP slice closes out with read-side surfaces:

- **`/gsd-new-project`** prompts up front for **Vertical MVP** vs **Horizontal Layers** mode and seeds the milestone accordingly
- **`/gsd-progress`** emits a "User-flow next up" panel for MVP-mode phases, surfacing user-visible task names ahead of internal scaffolding
- **`/gsd-stats`** adds a `Phases: N total | M MVP | K standard` summary line when the roadmap contains at least one MVP-mode phase
- **`/gsd-graphify`** visually differentiates MVP-mode phase nodes from horizontal-layer phases in the rendered graph

#### User-facing documentation

`USER-GUIDE.md` gains an MVP Mode section (when to pick MVP vs Horizontal Layers, a 5-row diff table, a worked webhook-validator example, configuration knob reference). `COMMANDS.md` gains the `/gsd-mvp-phase` entry, the `--mvp` flag on `/gsd-plan-phase`, and the Vertical MVP / Horizontal Layers prompt on `/gsd-new-project`. `CLI-TOOLS.md` gains an MVP Commands section documenting the three new SDK query verbs (`phase.mvp-mode`, `task.is-behavior-adding`, `user-story.validate`).

---

## How to test the headline feature

```bash
# 1) Pick a phase you want to drive as MVP
/gsd-mvp-phase 1

# 2) Answer the three "As a / I want to / So that" prompts
# 3) Plan runs automatically with --mvp
# 4) Execute under TDD to exercise the runtime gate
/gsd-execute-phase 1 --tdd

# 5) Verify; UAT will lead with user-flow steps
/gsd-verify-work 1

# 6) See how it surfaces in your project read-side
/gsd-progress
/gsd-stats
/gsd-graphify
```

---

## Install / upgrade

```bash
npx get-shit-done-cc@latest
# or pin exact
npm install -g get-shit-done-cc@1.45.0
```

---

## References

- Umbrella PRD — [#2826](https://github.com/gsd-build/get-shit-done/issues/2826)
- Sub-phase tracking issues — [#2885](https://github.com/gsd-build/get-shit-done/issues/2885), [#2875](https://github.com/gsd-build/get-shit-done/issues/2875), [#2877](https://github.com/gsd-build/get-shit-done/issues/2877), [#2879](https://github.com/gsd-build/get-shit-done/issues/2879), [#2882](https://github.com/gsd-build/get-shit-done/issues/2882)
- Implementation PRs — [#2867](https://github.com/gsd-build/get-shit-done/pull/2867), [#2874](https://github.com/gsd-build/get-shit-done/pull/2874), [#2878](https://github.com/gsd-build/get-shit-done/pull/2878), [#2880](https://github.com/gsd-build/get-shit-done/pull/2880), [#2883](https://github.com/gsd-build/get-shit-done/pull/2883)
- Concept reference — [`mvp-concepts.md`](../get-shit-done/references/mvp-concepts.md)
