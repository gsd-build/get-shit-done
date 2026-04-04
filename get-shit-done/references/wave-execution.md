# Wave Execution Patterns

Reference for dependency-driven wave assignment, parallel execution, git lock retry, and phase manifest schema. Consumed by `execute-phase.md` and `gsd-planner.md` via `@-reference`.

---

## Concept: Dependency-Driven Wave Assignment

Waves are derived from `depends_on` frontmatter in PLAN.md files. The planner writes them during planning; executors read them at runtime.

### Algorithm (from `gsd-planner.md` assign_waves step)

1. Root plans (empty `depends_on`) get wave 1
2. For each plan with dependencies: `plan.wave = max(dep.wave for dep in depends_on) + 1`
3. Same-wave plans must have zero `files_modified` overlap -- if overlap exists, bump to the next wave
4. Wave numbers are pre-computed during planning; executors do not derive them at runtime

### Example

```
Plan 01 (depends_on: [])           -> wave 1
Plan 02 (depends_on: [])           -> wave 1
Plan 03 (depends_on: [01])         -> wave 2
Plan 04 (depends_on: [01, 02])     -> wave 2  (if no file overlap with 03)
Plan 05 (depends_on: [03, 04])     -> wave 3
```

Plans within the same wave can execute in parallel. Plans in wave N+1 wait for all wave N plans to complete.

---

## Feature Flag

Wave execution only activates when explicitly enabled in config.json.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `workflow.wave_execution` | boolean | `false` | Enable wave-ordered parallel execution |

**When false (default):** All plans execute sequentially regardless of their wave field. This is the safe default for single-machine setups.

**When true:** Plans are grouped by wave number. Each wave's plans execute in parallel (via worktree agents). The next wave starts only after all plans in the current wave complete.

**Set with:**
```bash
gsd-tools config-set workflow.wave_execution true
```

**Known open item:** Windows git lock behavior under wave parallelization requires CI validation before production use. NTFS file locking is slower to release than POSIX, which may increase lock contention beyond what the retry pattern handles.

---

## Git Lock Retry (Parallel Executors)

When running as a parallel executor agent in a worktree, git commits can fail with "lock file exists" due to concurrent access to the shared `.git` directory.

### Retry Pattern

3 attempts with 2-second backoff:

```bash
git commit --no-verify -m "..." \
  || (sleep 2 && git commit --no-verify -m "...") \
  || (sleep 2 && git commit --no-verify -m "...")
```

### Rules

- Apply this pattern to ALL git commits inside parallel executor worktrees
- Use `--no-verify` to avoid pre-commit hook contention (the orchestrator validates hooks once after all agents complete)
- If all 3 attempts fail, report the error -- do not silently skip the commit
- The 2-second backoff is a minimum; agents may increase it if contention persists

---

## Phase Manifest Schema

A manifest file written to `.planning/.phase-manifest.json` at phase completion by `execute-phase.md`. Enables `/gsd-undo --phase` for safe rollback.

### Schema

```json
{
  "phase": "<phase-number>",
  "completed_at": "<ISO-8601-timestamp>",
  "plans": ["<plan-id-1>", "<plan-id-2>"],
  "last_good_commit": "<git-sha>",
  "commit_log": ["<hash> <subject>", "..."]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Phase identifier (e.g., "03") |
| `completed_at` | string | ISO 8601 timestamp of phase completion |
| `plans` | string[] | List of plan IDs executed in this phase |
| `last_good_commit` | string | Git SHA of HEAD at phase completion |
| `commit_log` | string[] | 20 most recent commits (`git log --oneline -20`) |

### Construction

Use inline Node.js for robust JSON construction (avoids shell escaping issues with commit messages):

```bash
node -e "
const { execSync } = require('child_process');
const fs = require('fs');
const phase = process.argv[1];
const commit = execSync('git rev-parse HEAD').toString().trim();
const log = execSync('git log --oneline -20').toString().trim().split('\n');
const manifest = {
  phase,
  completed_at: new Date().toISOString(),
  plans: JSON.parse(process.argv[2]),
  last_good_commit: commit,
  commit_log: log
};
fs.writeFileSync('.planning/.phase-manifest.json', JSON.stringify(manifest, null, 2));
" "${PHASE_NUMBER}" "${PLAN_IDS_JSON}"
```

### Lifecycle

1. Written once per phase, after all plans complete and verification passes
2. Committed to git immediately after creation
3. Read by `/gsd-undo --phase` to determine rollback target
4. Overwritten if phase is re-executed
