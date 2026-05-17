# Graphify Auto-Update — Status Surfacing

> Documents how `gsd-planner` and `gsd-phase-researcher` surface the opt-in graphify auto-update state (issue #3347). The status surface lives inside `graphifyStatus()` in `get-shit-done/bin/lib/graphify.cjs`; no planner-side prompt changes are required.

## Why this exists

The graph at `.planning/graphs/graph.json` is consumed automatically (every `gsd-planner` and `gsd-phase-researcher` step) but produced manually (`/gsd:graphify build` per session at best). Without auto-update, the producer-consumer gap silently widens with every commit. The existing `stale: true` annotation tells the consumer the mtime is old; it cannot tell the consumer whether the auto-build hook has been running, just failed, or is in flight.

When `graphify.auto_update: true`, the bundled `hooks/gsd-graphify-update.sh` PostToolUse hook fires after HEAD-advancing git operations on the default branch and dispatches `graphify update .` in a detached subprocess. The hook writes a status file synchronously before detach; the detached process rewrites it on completion.

## The status file

`.planning/graphs/.last-build-status.json`:

```json
{
  "ts": "2026-05-15T14:02:23Z",
  "status": "running" | "ok" | "failed",
  "exit_code": null | <int>,
  "duration_ms": null | <int>,
  "head_at_build": "<commit-sha>",
  "graphify_version": null | "<version>"
}
```

The hook writes `status: "running"` synchronously **before** detach, so the next planner invocation can see the in-flight signal even if `graphify update .` has not finished. The detached `hooks/lib/gsd-graphify-rebuild.sh` rewrites the file to `ok` or `failed` on completion (with `exit_code` and `duration_ms`).

## How the planner surfaces it (zero new prompt content)

`graphifyStatus()` in `get-shit-done/bin/lib/graphify.cjs` reads `.last-build-status.json` and folds the `running` / `failed` states into the existing `stale: true` signal:

```javascript
const autoUpdateStale =
  lastBuildAutoUpdate &&
  (lastBuildAutoUpdate.status === 'failed' || lastBuildAutoUpdate.status === 'running');

return {
  ...
  stale: age > STALE_MS || Boolean(autoUpdateStale),
  ...
  last_build_auto_update: lastBuildAutoUpdate || null,
};
```

The planner and researcher already run `node ... graphify status` inside their `<step name="load_graph_context">` blocks and already have the rule:

> If the status response has `stale: true`, note for later: "Graph is `{age_hours}h` old — treat semantic relationships as approximate."

That rule now fires correctly in three additional cases:

| Trigger | What user sees |
|---------|----------------|
| Auto-build status = `failed` | Existing "treat as approximate" note fires (because `stale: true`). The full `last_build_auto_update` object is in the JSON for callers that want exit-code / duration / commit-sha context. |
| Auto-build status = `running` | Same — the next planner invocation knows the graph is mid-rebuild and treats it as approximate until the detached process completes. |
| Auto-build status = `ok` AND mtime < 24h | Annotation is silent — the graph is fresh and the most recent auto-build succeeded. |

The file-missing case is silent (the operator either has not opted in or has not yet triggered a HEAD-advancing git op since enabling).

## Why this design

- **No planner-side prompt changes.** Folding into `stale: true` reuses the existing rule, which means no new content in `agents/gsd-planner.md` (which is already at the `< 48K` decomposition limit per `DEFECT.AGENT-FILE-SIZE-CAP-BREACH`).
- **Tests catch regressions on the seam.** `tests/feat-3347-graphify-auto-update-config.test.cjs` pins `graphifyStatus` behavior for status=`failed` / `running` / `ok` / file-missing.
- **Backwards compatible.** Callers that don't read `last_build_auto_update` see the same shape as before, with `stale` reflecting both mtime AND auto-build state. No consumer breakage.

## Opt-in reminder

The auto-update mechanism is opt-in (`graphify.auto_update: false` by default per issue #3347). Users who haven't opted in will never produce this file. `graphifyStatus()` returns `last_build_auto_update: null` and falls back to the mtime-only `stale` rule.
