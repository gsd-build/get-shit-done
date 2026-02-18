---
description: Show graph state, layer counts, health indicators, and last activity
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

Show the current state of the Declare project graph.

**Step 1: Run the status tool.**

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs status
```

Parse the JSON output.

**Step 2: Handle errors.**

If the output contains an `error` field (e.g., "No Declare project found"), display the error and suggest running `/declare:init`.

**Step 3: Format the status display.**

Render a rich visual summary with these sections:

**Project header:** Display the project name prominently.

**Graph Stats:** Show counts in a compact format:
- Declarations: N
- Milestones: N
- Actions: N
- Edges: N

**Status Distribution:** Show the breakdown by status (PENDING/ACTIVE/DONE) as a visual bar or counts.

**Validation Health:**
- If `health` is "healthy": show a pass indicator
- If `health` is "warnings": show warnings with the validation error list
- If `health` is "errors": show errors with the validation error list and actionable suggestions for each

For each validation error, provide a brief suggestion:
- `orphan`: "Connect this node to a parent with an edge"
- `cycle`: "Check for circular dependencies in your graph"
- `broken_edge`: "The target node may have been removed -- update or remove the edge"

**Coverage:** Show milestone plan coverage from the `coverage` field:
- "Plan coverage: X of Y milestones have plans (Z%)"
- If coverage is less than 100%, list milestones without plans and suggest: "Run `/declare:actions` to derive plans for uncovered milestones."

**Health Indicators:** If `staleness` indicators exist, render them:
- NO_PLAN: "[M-XX] has no action plan"
- STALE: "[M-XX] plan not updated in N days"
- COMPLETABLE: "[M-XX] all actions done -- consider marking milestone as DONE"
- INCONSISTENT: "[M-XX] marked DONE but has incomplete actions"

If no staleness indicators: "All milestones healthy."

**Last Activity:** Show the timestamp and commit message from the last git activity.

The overall feel should be like a dashboard -- compact, scannable, with clear health indicators.
