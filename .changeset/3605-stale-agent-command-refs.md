---
type: Fixed
issue: 3605
---
**Agent contracts no longer reference retired `/gsd-research-phase` or `/gsd-insert-phase`** — six surviving references in `agents/gsd-executor.md`, `agents/gsd-phase-researcher.md`, `agents/gsd-planner.md`, `agents/gsd-research-synthesizer.md`, and `agents/gsd-roadmapper.md` are replaced with `/gsd:plan-phase --research-phase <N>` and `/gsd:phase insert`. Adds a regression guard (`tests/bug-3605-stale-research-insert-phase-agent-refs.test.cjs`) that fails when any retired command name reappears in `agents/*.md` — covers the gap that let #3029, #3044, and #3131 miss the `agents/` directory.
