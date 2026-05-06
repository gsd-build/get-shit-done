---
type: Fixed
---
**`/gsd-graphify build` now runs inline instead of spawning a sub-agent** — required by graphify v0.7+, which split the build into a fast AST-extraction phase followed by a separate clustering + report-write phase. The cached AST phase survived sub-agent isolation, but the post-extraction phase was being SIGTERM'd when the agent exited, leaving only the cache populated and no `graph.json` / `graph.html` / `GRAPH_REPORT.md` artifacts. The skill now runs `graphify update .`, the three artifact copies, the snapshot, and the status report as a single foreground Bash call, surviving to completion. The CLI's `graphify build` pre-flight still returns `action: "spawn_agent"` so external callers and existing tests keep working.
