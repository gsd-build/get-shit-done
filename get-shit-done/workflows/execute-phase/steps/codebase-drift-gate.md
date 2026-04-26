# Step: codebase_drift_gate

Post-execution structural drift detection (#2003). Runs after the last wave
commits, before verification. **Non-blocking by contract:** any internal
error here MUST fall through and continue to `verify_phase_goal`. The phase
is never failed by this gate.

```bash
DRIFT=$(gsd-sdk query verify.codebase-drift 2>/dev/null || echo '{"skipped":true,"reason":"sdk-failed"}')
```

Parse JSON for: `skipped`, `reason`, `action_required`, `directive`,
`spawn_mapper`, `affected_paths`, `elements`, `threshold`, `action`,
`last_mapped_commit`, `message`.

**If `skipped` is true (no STRUCTURE.md, missing git, or any internal error):**
Log one line — `Codebase drift check skipped: {reason}` — and continue to
`verify_phase_goal`. Do NOT prompt the user. Do NOT block.

**If `action_required` is false:** Continue silently to `verify_phase_goal`.

**If `action_required` is true AND `directive` is `warn`:**
Print the `message` field verbatim. The format is:

```text
Codebase drift detected: {N} structural element(s) since last mapping.

New directories:
  - {path}
New barrel exports:
  - {path}
New migrations:
  - {path}
New route modules:
  - {path}

Run /gsd-map-codebase --paths {affected_paths} to refresh planning context.
```

Then continue to `verify_phase_goal`. Do NOT block. Do NOT spawn anything.

**If `action_required` is true AND `directive` is `auto-remap`:**

First load the mapper agent's skill bundle (the executor's `AGENT_SKILLS`
from step `init_context` is for `gsd-executor`, not the mapper):

```bash
AGENT_SKILLS_MAPPER=$(gsd-sdk query agent-skills gsd-codebase-mapper)
```

Then spawn `gsd-codebase-mapper` agents with the `--paths` hint:

```text
Task(
  subagent_type="gsd-codebase-mapper",
  description="Incremental codebase remap (drift)",
  prompt="Focus: arch
Today's date: {date}
--paths {affected_paths joined by comma}

Refresh STRUCTURE.md and ARCHITECTURE.md scoped to the listed paths only.
Stamp last_mapped_commit in each document's frontmatter.
${AGENT_SKILLS_MAPPER}"
)
```

If the spawn fails or the agent reports an error: log `Codebase drift
auto-remap failed: {reason}` and continue to `verify_phase_goal`. The phase
is NOT failed by a remap failure.

If the remap succeeds: log `Codebase drift auto-remap completed for paths:
{affected_paths}` and continue to `verify_phase_goal`.

The two relevant config keys (continue on error / failure if either is invalid):
- `workflow.drift_threshold` (integer, default 3) — minimum drift elements before action
- `workflow.drift_action` — `warn` (default) or `auto-remap`

This step is fully non-blocking — it never fails the phase, and any
exception path returns control to `verify_phase_goal`.
