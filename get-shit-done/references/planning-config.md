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
  "base_branch": null,
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "quick_branch_template": null
},
"manager": {
  "flags": {
    "discuss": "",
    "plan": "",
    "execute": ""
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `commit_docs` | `true` | Whether to commit planning artifacts to git |
| `search_gitignored` | `false` | Add `--no-ignore` to broad rg searches |
| `git.branching_strategy` | `"none"` | Git branching approach: `"none"`, `"phase"`, or `"milestone"` |
| `git.base_branch` | `null` (auto-detect) | Target branch for PRs and merges (e.g. `"master"`, `"develop"`). When `null`, auto-detects from `git symbolic-ref refs/remotes/origin/HEAD`, falling back to `"main"`. |
| `git.phase_branch_template` | `"gsd/phase-{phase}-{slug}"` | Branch template for phase strategy |
| `git.milestone_branch_template` | `"gsd/{milestone}-{slug}"` | Branch template for milestone strategy |
| `git.quick_branch_template` | `null` | Optional branch template for quick-task runs |
| `workflow.use_worktrees` | `true` | Whether executor agents run in isolated git worktrees. Set to `false` to disable worktrees — agents execute sequentially on the main working tree instead. Recommended for solo developers or when worktree merges cause issues. |
| `workflow.subagent_timeout` | `300000` | Timeout in milliseconds for parallel subagent tasks (e.g. codebase mapping). Increase for large codebases or slower models. Default: 300000 (5 minutes). |
| `manager.flags.discuss` | `""` | Flags passed to `/gsd-discuss-phase` when dispatched from manager (e.g. `"--auto --analyze"`) |
| `manager.flags.plan` | `""` | Flags passed to plan workflow when dispatched from manager |
| `manager.flags.execute` | `""` | Flags passed to execute workflow when dispatched from manager |
| `response_language` | `null` | Language for user-facing questions and prompts across all phases/subagents (e.g. `"Portuguese"`, `"Japanese"`, `"Spanish"`). When set, all spawned agents include a directive to respond in this language. |
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
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md

# Load config via state load (returns JSON):
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs is available in the JSON output

# Or use init commands which include commit_docs:
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs is included in all init command outputs
```

**Auto-detection:** If `.planning/` is gitignored, `commit_docs` is automatically `false` regardless of config.json. This prevents git errors when users have `.planning/` in `.gitignore`.

**Commit via CLI (handles checks automatically):**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md
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
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# JSON output includes: branching_strategy, phase_branch_template, milestone_branch_template
```

Or use `state load` for the config values:
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
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

<complete_field_reference>

## Complete Field Reference

Generated from `CONFIG_DEFAULTS` (core.cjs) and `VALID_CONFIG_KEYS` (config.cjs).

### Core Fields

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `model_profile` | string | `"balanced"` | `"quality"`, `"balanced"`, `"budget"`, `"inherit"` | Model selection preset for subagents |
| `mode` | string | `"interactive"` | `"interactive"`, `"yolo"` | Operation mode: `"interactive"` shows gates and confirmations; `"yolo"` runs autonomously without prompts |
| `granularity` | string | (none) | `"coarse"`, `"standard"`, `"fine"` | Planning depth for phase plans (migrated from deprecated `depth`) |
| `commit_docs` | boolean | `true` | `true`, `false` | Commit .planning/ artifacts to git (auto-false if .planning/ is gitignored) |
| `search_gitignored` | boolean | `false` | `true`, `false` | Include gitignored paths in broad rg searches via `--no-ignore` |
| `phase_naming` | string | `"sequential"` | `"sequential"`, `"custom"` | Phase numbering: auto-increment or arbitrary string IDs |
| `project_code` | string\|null | `null` | Any short string | Prefix for phase dirs (e.g., `"CK"` produces `CK-01-foundation`) |
| `response_language` | string\|null | `null` | Any language name | Language for user-facing prompts (e.g., `"Portuguese"`, `"Japanese"`) |
| `context_window` | number | `200000` | `200000`, `1000000` | Context window size; set `1000000` for 1M-context models |
| `resolve_model_ids` | boolean\|string | `false` | `false`, `true`, `"omit"` | Map model aliases to full Claude IDs; `"omit"` returns empty string |
| `context` | string\|null | `null` | `"dev"`, `"research"`, `"review"` | Execution context profile that adjusts agent behavior: `"dev"` for development tasks, `"research"` for investigation/exploration, `"review"` for code review workflows |

### Workflow Fields

Set via `workflow.*` namespace in config.json (e.g., `"workflow": { "research": true }`).

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `workflow.research` | boolean | `true` | `true`, `false` | Run research agent before planning |
| `workflow.plan_check` | boolean | `true` | `true`, `false` | Run plan-checker agent to validate plans. _Alias:_ `plan_checker` is the flat-key form used in `CONFIG_DEFAULTS`; `workflow.plan_check` is the canonical namespaced form. |
| `workflow.verifier` | boolean | `true` | `true`, `false` | Run verifier agent after execution |
| `workflow.nyquist_validation` | boolean | `true` | `true`, `false` | Enable Nyquist-inspired validation gates |
| `workflow.auto_advance` | boolean | `false` | `true`, `false` | Auto-advance to next phase after completion |
| `workflow.node_repair` | boolean | `true` | `true`, `false` | Attempt automatic repair of failed plan nodes |
| `workflow.node_repair_budget` | number | `2` | Any positive integer | Max repair retries per failed node |
| `workflow.ui_phase` | boolean | `true` | `true`, `false` | Generate UI-SPEC.md for frontend phases |
| `workflow.ui_safety_gate` | boolean | `true` | `true`, `false` | Require safety gate approval for UI changes |
| `workflow.text_mode` | boolean | `false` | `true`, `false` | Use plain-text numbered lists instead of AskUserQuestion menus |
| `workflow.research_before_questions` | boolean | `false` | `true`, `false` | Run research before interactive questions in discuss phase |
| `workflow.discuss_mode` | string | `"discuss"` | `"discuss"`, `"assumptions"` | Default mode for discuss-phase: `"discuss"` runs interactive questioning; `"assumptions"` analyzes codebase and surfaces assumptions instead |
| `workflow.skip_discuss` | boolean | `false` | `true`, `false` | Skip discuss phase entirely |
| `workflow.use_worktrees` | boolean | `true` | `true`, `false` | Run executor agents in isolated git worktrees |
| `workflow.subagent_timeout` | number | `300000` | Any positive integer (ms) | Timeout for parallel subagent tasks (default: 5 minutes) |
| `workflow.code_review` | boolean | `true` | `true`, `false` | Enable built-in code review step in the ship workflow |
| `workflow.code_review_depth` | string | `"standard"` | `"light"`, `"standard"`, `"deep"` | Depth level for code review analysis in the ship workflow |
| `workflow._auto_chain_active` | boolean | `false` | `true`, `false` | Internal: tracks whether autonomous chaining is active |

### Git Fields

Set via `git.*` namespace (e.g., `"git": { "branching_strategy": "phase" }`).

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `git.branching_strategy` | string | `"none"` | `"none"`, `"phase"`, `"milestone"` | Git branching approach for phase/milestone isolation |
| `git.base_branch` | string\|null | `null` (auto-detect) | Any branch name | Target branch for PRs and merges; auto-detects from `origin/HEAD` when `null` |
| `git.phase_branch_template` | string | `"gsd/phase-{phase}-{slug}"` | Template with `{phase}`, `{slug}` | Branch naming template for `phase` strategy |
| `git.milestone_branch_template` | string | `"gsd/{milestone}-{slug}"` | Template with `{milestone}`, `{slug}` | Branch naming template for `milestone` strategy |
| `git.quick_branch_template` | string\|null | `null` | Template with `{slug}` | Optional branch template for quick-task runs |

### Search & API Fields

These toggle external search integrations. Auto-detected at project creation when API keys are present.

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `brave_search` | boolean | `false` | `true`, `false` | Enable Brave web search for research agent (requires `BRAVE_API_KEY`) |
| `firecrawl` | boolean | `false` | `true`, `false` | Enable Firecrawl page scraping (requires `FIRECRAWL_API_KEY`) |
| `exa_search` | boolean | `false` | `true`, `false` | Enable Exa semantic search (requires `EXA_API_KEY`) |

### Features Fields

Set via `features.*` namespace (e.g., `"features": { "thinking_partner": true }`).

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `features.thinking_partner` | boolean | `false` | `true`, `false` | Enable conditional extended thinking at workflow decision points (used by discuss-phase and plan-phase for architectural tradeoff analysis) |
| `features.global_learnings` | boolean | `false` | `true`, `false` | Enable injection of global learnings from `~/.gsd/learnings/` into agent prompts |

### Hook Fields

Set via `hooks.*` namespace (e.g., `"hooks": { "context_warnings": true }`).

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `hooks.context_warnings` | boolean | `true` | `true`, `false` | Show warnings when context budget is exceeded |

### Learnings Fields

Set via `learnings.*` namespace (e.g., `"learnings": { "max_inject": 5 }`). Used together with `features.global_learnings`.

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `learnings.max_inject` | number | `10` | Any positive integer | Maximum number of global learning entries to inject into agent prompts per session |

### Manager Fields

Set via `manager.*` namespace (e.g., `"manager": { "flags": { "discuss": "--auto" } }`).

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `manager.flags.discuss` | string | `""` | Any CLI flags string | Flags passed to `/gsd-discuss-phase` from manager (e.g., `"--auto --analyze"`) |
| `manager.flags.plan` | string | `""` | Any CLI flags string | Flags passed to plan workflow from manager |
| `manager.flags.execute` | string | `""` | Any CLI flags string | Flags passed to execute workflow from manager |

### Advanced Fields

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `parallelization` | boolean\|object | `true` | `true`, `false`, `{ "enabled": true }` | Enable parallel wave execution; object form allows additional sub-keys |
| `model_overrides` | object\|null | `null` | `{ "<agent-type>": "<model-id>" }` | Override model selection per agent type |
| `agent_skills` | object | `{}` | `{ "<agent-type>": "<skill-set>" }` | Assign skill sets to specific agent types |
| `sub_repos` | array | `[]` | Array of relative path strings | Child directories with independent `.git` repos (auto-detected) |

### Planning Fields

These can be set at top level or nested under `planning.*` (e.g., `"planning": { "commit_docs": false }`). Both forms are equivalent; top-level takes precedence if both exist.

| Key | Type | Default | Allowed Values | Description |
|-----|------|---------|----------------|-------------|
| `planning.commit_docs` | boolean | `true` | `true`, `false` | Alias for top-level `commit_docs` |
| `planning.search_gitignored` | boolean | `false` | `true`, `false` | Alias for top-level `search_gitignored` |

---

## Field Interactions

Several config fields affect each other or trigger special behavior:

1. **`commit_docs` auto-detection** -- When no explicit value is set in config.json and `.planning/` is in `.gitignore`, `commit_docs` automatically resolves to `false`. An explicit `true` or `false` in config always overrides auto-detection.

2. **`branching_strategy` controls branch templates** -- The `phase_branch_template` and `milestone_branch_template` fields are only used when `branching_strategy` is set to `"phase"` or `"milestone"` respectively. When `branching_strategy` is `"none"`, all template fields are ignored.

3. **`context_window` threshold triggers** -- When `context_window >= 500000`, workflows enable adaptive context enrichment: full-body reads of prior phase SUMMARYs, cross-phase context injection in plan-phase, and deeper read depth for anti-pattern references. Below 500000, only frontmatter and summaries are read.

4. **`parallelization` polymorphism** -- Accepts both a simple boolean and an object with an `enabled` field. `loadConfig()` normalizes either form to a boolean. `{ "enabled": true }` is equivalent to `true`.

5. **Search API keys and flags** -- `brave_search`, `firecrawl`, and `exa_search` are auto-set to `true` during project creation if the corresponding API key is detected (environment variable or `~/.gsd/<name>_api_key` file). Setting them to `true` without the API key has no effect.

6. **`planning.*` and top-level equivalence** -- `planning.commit_docs` and `commit_docs` are equivalent; `planning.search_gitignored` and `search_gitignored` are equivalent. If both are set, the top-level value takes precedence.

7. **`depth` to `granularity` migration** -- The deprecated `depth` key (`quick`/`standard`/`comprehensive`) is automatically migrated to `granularity` (`coarse`/`standard`/`fine`) on config load and persisted back to disk.

8. **`sub_repos` auto-sync** -- On every config load, GSD scans for child directories with `.git` and updates the `sub_repos` array if the filesystem has changed. Legacy `multiRepo: true` is automatically migrated to a detected `sub_repos` array.

---

## Example Configurations

### Minimal -- Solo Developer

```json
{
  "model_profile": "balanced",
  "commit_docs": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "use_worktrees": false
  }
}
```

### Team Project with Branching

```json
{
  "model_profile": "quality",
  "commit_docs": true,
  "project_code": "APP",
  "git": {
    "branching_strategy": "phase",
    "base_branch": "develop",
    "phase_branch_template": "gsd/phase-{phase}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "use_worktrees": true,
    "discuss_mode": "discuss"
  },
  "manager": {
    "flags": {
      "discuss": "",
      "plan": "",
      "execute": ""
    }
  },
  "response_language": "English"
}
```

### Large Codebase -- 1M Context with Extended Timeouts

```json
{
  "model_profile": "quality",
  "context_window": 1000000,
  "commit_docs": true,
  "project_code": "MEGA",
  "phase_naming": "sequential",
  "git": {
    "branching_strategy": "milestone",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "subagent_timeout": 600000,
    "use_worktrees": true,
    "node_repair": true,
    "node_repair_budget": 3,
    "auto_advance": true
  },
  "brave_search": true,
  "hooks": {
    "context_warnings": true
  }
}
```

</complete_field_reference>

</planning_config>
