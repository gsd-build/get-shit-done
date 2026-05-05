---
type: Fixed
pr: 3135
---
**`/gsd-capture --backlog` now has a workflow to load** — PR #2824 consolidated `add-backlog` into the `--backlog` flag on `/gsd-capture` and wired `commands/gsd/capture.md` to delegate to `workflows/add-backlog.md` via `execution_context`. The workflow file was never created, leaving the routing with no implementation to load. Restores `get-shit-done/workflows/add-backlog.md` with the full process from the deleted `commands/gsd/add-backlog.md`: find next 999.x slot via `phase.next-decimal`, write ROADMAP entry before creating the phase directory (preserving the #2280 ordering invariant), create `.planning/phases/{N}-{slug}/`, and commit. Also fixes `docs/INVENTORY.md` which incorrectly attributed `--backlog` routing to `add-todo.md`. Adds a broad regression test that every `execution_context` `@`-reference in any `commands/gsd/*.md` resolves to an existing workflow file, preventing this class of gap from silently re-appearing. Closes #3135.
