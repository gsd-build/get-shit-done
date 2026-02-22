<planning_config>

Configuration options for `.planning/` directory behavior.

<config_schema>
```json
"planning": {
  "commit_docs": true,
  "search_gitignored": false
},
"git": {
  "branching_strategy": "none",
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `commit_docs` | `true` | Whether to commit planning artifacts to git |
| `search_gitignored` | `false` | Add `--no-ignore` to broad rg searches |
| `git.branching_strategy` | `"none"` | Git branching approach: `"none"`, `"phase"`, or `"milestone"` |
| `git.phase_branch_template` | `"gsd/phase-{phase}-{slug}"` | Branch template for phase strategy |
| `git.milestone_branch_template` | `"gsd/{milestone}-{slug}"` | Branch template for milestone strategy |
</config_schema>

<commit_docs_behavior>

**When `commit_docs: true` (default):**
- Planning files committed normally
- SUMMARY.md, STATE.md, ROADMAP.md tracked in git
- Full history of planning decisions preserved

**When `commit_docs: false`:**
- Skip all `git add`/`git commit` for `.planning/` files
- User must add `.planning/` to `.gitignore`
- Useful for: OSS contributions, client projects, keeping planning private

**Using gsd-tools.cjs (preferred):**

```bash
# Commit with automatic commit_docs + gitignore checks:
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs: update state" --files .planning/STATE.md

# Load config via state load (returns JSON):
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs state load)
# commit_docs is available in the JSON output

# Or use init commands which include commit_docs:
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init execute-phase "1")
# commit_docs is included in all init command outputs
```

**Auto-detection:** If `.planning/` is gitignored, `commit_docs` is automatically `false` regardless of config.json. This prevents git errors when users have `.planning/` in `.gitignore`.

**Commit via CLI (handles checks automatically):**

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs: update state" --files .planning/STATE.md
```

The CLI checks `commit_docs` config and gitignore status internally — no manual conditionals needed.

</commit_docs_behavior>

<search_behavior>

**When `search_gitignored: false` (default):**
- Standard rg behavior (respects .gitignore)
- Direct path searches work: `rg "pattern" .planning/` finds files
- Broad searches skip gitignored: `rg "pattern"` skips `.planning/`

**When `search_gitignored: true`:**
- Add `--no-ignore` to broad rg searches that should include `.planning/`
- Only needed when searching entire repo and expecting `.planning/` matches

**Note:** Most GSD operations use direct file reads or explicit paths, which work regardless of gitignore status.

</search_behavior>

<setup_uncommitted_mode>

To use uncommitted mode:

1. **Set config:**
   ```json
   "planning": {
     "commit_docs": false,
     "search_gitignored": true
   }
   ```

2. **Add to .gitignore:**
   ```
   .planning/
   ```

3. **Existing tracked files:** If `.planning/` was previously tracked:
   ```bash
   git rm -r --cached .planning/
   git commit -m "chore: stop tracking planning docs"
   ```

4. **Branch merges:** When using `branching_strategy: phase` or `milestone`, the `complete-milestone` workflow automatically strips `.planning/` files from staging before merge commits when `commit_docs: false`.

</setup_uncommitted_mode>

<branching_strategy_behavior>

**Branching Strategies:**

| Strategy | When branch created | Branch scope | Merge point |
|----------|---------------------|--------------|-------------|
| `none` | Never | N/A | N/A |
| `phase` | At `execute-phase` start | Single phase | User merges after phase |
| `milestone` | At first `execute-phase` of milestone | Entire milestone | At `complete-milestone` |

**When `git.branching_strategy: "none"` (default):**
- All work commits to current branch
- Standard GSD behavior

**When `git.branching_strategy: "phase"`:**
- `execute-phase` creates/switches to a branch before execution
- Branch name from `phase_branch_template` (e.g., `gsd/phase-03-authentication`)
- All plan commits go to that branch
- User merges branches manually after phase completion
- `complete-milestone` offers to merge all phase branches

**When `git.branching_strategy: "milestone"`:**
- First `execute-phase` of milestone creates the milestone branch
- Branch name from `milestone_branch_template` (e.g., `gsd/v1.0-mvp`)
- All phases in milestone commit to same branch
- `complete-milestone` offers to merge milestone branch to main

**Template variables:**

| Variable | Available in | Description |
|----------|--------------|-------------|
| `{phase}` | phase_branch_template | Zero-padded phase number (e.g., "03") |
| `{slug}` | Both | Lowercase, hyphenated name |
| `{milestone}` | milestone_branch_template | Milestone version (e.g., "v1.0") |

**Checking the config:**

Use `init execute-phase` which returns all config as JSON:
```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init execute-phase "1")
# JSON output includes: branching_strategy, phase_branch_template, milestone_branch_template
```

Or use `state load` for the config values:
```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs state load)
# Parse branching_strategy, phase_branch_template, milestone_branch_template from JSON
```

**Branch creation:**

```bash
# For phase strategy
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g" | sed "s/{slug}/$PHASE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# For milestone strategy
if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  MILESTONE_SLUG=$(echo "$MILESTONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed "s/{milestone}/$MILESTONE_VERSION/g" | sed "s/{slug}/$MILESTONE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

**Merge options at complete-milestone:**

| Option | Git command | Result |
|--------|-------------|--------|
| Squash merge (recommended) | `git merge --squash` | Single clean commit per branch |
| Merge with history | `git merge --no-ff` | Preserves all individual commits |
| Delete without merging | `git branch -D` | Discard branch work |
| Keep branches | (none) | Manual handling later |

Squash merge is recommended — keeps main branch history clean while preserving the full development history in the branch (until deleted).

**Use cases:**

| Strategy | Best for |
|----------|----------|
| `none` | Solo development, simple projects |
| `phase` | Code review per phase, granular rollback, team collaboration |
| `milestone` | Release branches, staging environments, PR per version |

</branching_strategy_behavior>

<post_wave_reviews_behavior>

**Post-wave domain reviews** allow projects to define domain-specific review agents that run automatically after each execution wave.

<config_schema>
```json
"post_wave_reviews": {
  "review_name": {
    "enabled": true,
    "trigger_glob": "path/to/files/*.ext",
    "agent": "agent-name",
    "blocking": true,
    "model": "sonnet"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Whether this review is active |
| `trigger_glob` | (required) | File pattern to match against SUMMARY.md `key-files` (created + modified) |
| `agent` | (required) | Agent name to spawn — must exist in `.claude/agents/` |
| `blocking` | `true` | If true, NEEDS_REVISION results pause execution and trigger fix cycle |
| `model` | `"sonnet"` | Model to use for the review agent |
</config_schema>

**Behavior:**

- If `post_wave_reviews` is absent or empty in config.json, the feature is skipped entirely (backward compatible)
- After each wave's spot-checks pass, file paths from completed SUMMARY.md entries are matched against each review's `trigger_glob`
- Reviews only run when at least one file matches the configured glob pattern
- Review agents return one of: `APPROVED`, `APPROVED_WITH_CONDITIONS`, `NEEDS_REVISION`

**Blocking vs non-blocking:**

| Result | `blocking: true` | `blocking: false` |
|--------|-------------------|-------------------|
| APPROVED | Log, continue | Log, continue |
| APPROVED_WITH_CONDITIONS | Log findings, continue | Log findings, continue |
| NEEDS_REVISION | Trigger fix cycle | Log findings, continue |

**Fix cycle (NEEDS_REVISION + blocking):**

- With `workflow.auto_advance: true` — auto-spawn fix agent (1 cycle), re-run reviewer, present to user if still failing after 2 cycles
- With `workflow.auto_advance: false` — present findings to user, ask "Fix issues?" or "Continue anyway?"

**Example configuration:**

```json
{
  "post_wave_reviews": {
    "migration_review": {
      "enabled": true,
      "trigger_glob": "supabase/migrations/*.sql",
      "agent": "sql-migration-reviewer",
      "blocking": true,
      "model": "sonnet"
    },
    "schema_validation": {
      "enabled": true,
      "trigger_glob": "api/schemas/**/*.json",
      "agent": "schema-validator",
      "blocking": false
    }
  }
}
```

**Agent setup:** Review agents are defined in `.claude/agents/` as standard agent markdown files. They receive a list of matched file paths and must return a structured review result (APPROVED / APPROVED_WITH_CONDITIONS / NEEDS_REVISION) with findings.

</post_wave_reviews_behavior>

</planning_config>
