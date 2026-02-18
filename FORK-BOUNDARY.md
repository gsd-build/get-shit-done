# Fork Boundary: Declare from GSD

## Origin

Declare is forked from **GSD (Get Shit Done)** (`get-shit-done-cc`), a meta-prompting and context engineering system for Claude Code.

## Strategy: Fork and Diverge

Copy GSD patterns into Declare's codebase, then evolve independently. **No upstream dependency on GSD.** Declare does not import from, depend on, or track GSD's upstream changes.

## What's Carried Forward

These GSD components are copied and adapted to work with Declare's graph structure:

- **Full agent stack** -- planner, executor, researcher, verifier agents
- **Slash command patterns** -- `.claude/commands/` directory structure, markdown frontmatter, `$ARGUMENTS` passing
- **CLI tooling patterns** -- `gsd-tools.cjs` patterns become `declare-tools.cjs` (subcommand dispatch, config loading, git operations)
- **esbuild bundling** -- single-file CJS bundle for zero-install distribution
- **Markdown-based artifacts** -- `.planning/` directory, structured markdown files as source of truth
- **Atomic git commits** -- every state change produces a single git commit

## What's Replaced

These GSD components are replaced with fundamentally different approaches:

| GSD Component | Declare Replacement | Why |
|---------------|---------------------|-----|
| Linear phase planning (Phase 1, 2, 3...) | Three-layer DAG (declarations, milestones, actions) | Linear phases are past-derived sequencing; DAGs represent causal structure |
| Phase-based roadmap (ROADMAP.md) | Declaration-driven structure (FUTURE.md + MILESTONES.md) | The present is given by the future you're living into |
| `gsd-tools.cjs` | `declare-tools.cjs` | Own tooling, own namespace, own subcommands |
| Phase STATE.md tracking | Graph state with node statuses (PENDING, ACTIVE, DONE) | Status lives in the graph, not in a separate tracking file |
| Sequential plan execution | Topology-aware execution with wave scheduling | Actions execute in topological order, not linear sequence |

## What's Extended

These GSD components are kept but significantly extended:

| GSD Component | Extension | New Capability |
|---------------|-----------|----------------|
| Artifact formats | FUTURE.md, MILESTONES.md | New markdown formats for declarations, milestones, and actions |
| Plan verification | Graph validation | Structural validation: orphan detection, cycle detection, edge integrity |
| Config system | Graph-aware config | Configuration includes graph model settings |
| Status reporting | Rich graph status | Layer counts, health indicators, integrity/alignment metrics |

## Divergence Log

Track ongoing divergence from GSD as Declare evolves.

| Date | Component | Change | GSD Equivalent |
|------|-----------|--------|----------------|
| | | | |

---

*This is a living document. Updated as Declare evolves.*
