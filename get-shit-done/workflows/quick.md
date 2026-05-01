<purpose>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Quick mode spawns gsd-planner (quick mode) + gsd-executor(s), tracks tasks in `.planning/quick/`, and updates STATE.md's "Quick Tasks Completed" table.

With `--full` flag: enables the complete quality pipeline — discussion + research + plan-checking + verification. One flag for everything.

With `--validate` flag: enables plan-checking (max 2 iterations) and post-execution verification only. Use when you want quality guarantees without discussion or research.

With `--discuss` flag: lightweight discussion phase before planning. Surfaces assumptions, clarifies gray areas, captures decisions in CONTEXT.md so the planner treats them as locked.

With `--research` flag: spawns a focused research agent before planning. Investigates implementation approaches, library options, and pitfalls. Use when you're unsure how to approach a task.

Granular flags are composable: `--discuss --research --validate` gives the same result as `--full`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-phase-researcher — Researches technical approaches for a phase
- gsd-planner — Creates detailed plans from phase scope
- gsd-plan-checker — Reviews plan quality before execution
- gsd-executor — Executes plan tasks, commits, creates SUMMARY.md
- gsd-verifier — Verifies phase completion, checks quality gates
- gsd-code-reviewer — Reviews source files for bugs, security issues, and code quality
</available_agent_types>

<process>
**Step 1: Parse arguments and get task description**

Parse `$ARGUMENTS` for:
- `--full` flag → store `$FULL_MODE=true`, `$DISCUSS_MODE=true`, `$RESEARCH_MODE=true`, `$VALIDATE_MODE=true`
- `--validate` flag → store `$VALIDATE_MODE=true`
- `--discuss` flag → store `$DISCUSS_MODE=true`
- `--research` flag → store `$RESEARCH_MODE=true`
- Remaining text → use as `$DESCRIPTION` if non-empty

After parsing, normalize: if `$DISCUSS_MODE` and `$RESEARCH_MODE` and `$VALIDATE_MODE` are all true, set `$FULL_MODE=true`. This ensures `--discuss --research --validate` is treated identically to `--full`.

If `$DESCRIPTION` is empty after parsing, prompt user interactively:


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

```
AskUserQuestion(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```

Store response as `$DESCRIPTION`.

If still empty, re-prompt: "Please provide a task description."

Display banner based on active flags:

If `$FULL_MODE` (all phases enabled — `--full` or all granular flags):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (FULL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + research + plan checking + verification enabled
```

If `$DISCUSS_MODE` and `$VALIDATE_MODE` (no research):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + plan checking + verification enabled
```

If `$DISCUSS_MODE` and `$RESEARCH_MODE` (no validate):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + RESEARCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + research enabled
```

If `$RESEARCH_MODE` and `$VALIDATE_MODE` (no discuss):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (RESEARCH + VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Research + plan checking + verification enabled
```

If `$DISCUSS_MODE` only:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion phase enabled — surfacing gray areas before planning
```

If `$RESEARCH_MODE` only:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (RESEARCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Research phase enabled — investigating approaches before planning
```

If `$VALIDATE_MODE` only:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Plan checking + verification enabled
```

---

**Step 2: Initialize**

```bash
if ! command -v gsd-sdk &>/dev/null; then
  echo "⚠ gsd-sdk not found in PATH — /gsd-quick requires it."
  echo ""
  echo "Install the GSD SDK:"
  echo "  npm install -g @gsd-build/sdk"
  echo ""
  echo "Or update GSD to get the latest packages:"
  echo "  /gsd-update"
  exit 1
fi
```

```bash
INIT=$(gsd-sdk query init.quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_PLANNER=$(gsd-sdk query agent-skills gsd-planner)
AGENT_SKILLS_EXECUTOR=$(gsd-sdk query agent-skills gsd-executor)
AGENT_SKILLS_CHECKER=$(gsd-sdk query agent-skills gsd-plan-checker)
AGENT_SKILLS_VERIFIER=$(gsd-sdk query agent-skills gsd-verifier)
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

```bash
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

If the project uses git submodules, worktree isolation is unsafe **only when the quick task touches a submodule path**. The previous behavior unconditionally disabled worktree isolation whenever `.gitmodules` existed, which penalised every quick task in a submodule project even when the task was nowhere near a submodule. Parse submodule paths from `.gitmodules` so the executor can act on actual submodule paths rather than the mere file's existence:

```bash
# Parse submodule paths from .gitmodules once (empty if no .gitmodules).
# SUBMODULE_PATHS is a newline-separated list of repo-relative paths used as
# a fail-loud commit-time guard inside the quick-task executor — if the
# executor stages any path that falls inside SUBMODULE_PATHS, it must abort
# the commit and surface the conflict rather than silently corrupting the
# submodule state.
if [ -f .gitmodules ]; then
  SUBMODULE_PATHS=$(git config --file .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}')
else
  SUBMODULE_PATHS=""
fi
```

Quick mode does not have a pre-declared `files_modified` list (the task is freeform), so use a fail-loud guard at commit time: when the executor stages files for the quick-task commit, if any staged path falls inside a `SUBMODULE_PATHS` entry, abort with a clear error explaining that worktree-isolated commits cannot safely span submodule boundaries — the user can re-run with `workflow.use_worktrees=false` to fall back to sequential execution on the main tree. If `SUBMODULE_PATHS` is empty (no `.gitmodules` in the repo), worktree isolation proceeds normally.

**If `roadmap_exists` is false:** Error — Quick mode requires an active project with ROADMAP.md. Run `/gsd-new-project` first.

Quick tasks can run mid-phase - validation only checks ROADMAP.md exists, not phase status.

---

**Step 2.5: Handle quick-task branching**

**If `branch_name` is empty/null:** Skip and continue on the current branch.

**If `branch_name` is set:** Check out the quick-task branch before any planning commits.

The new branch must fork off the project's default branch (`origin/HEAD`), not
off whatever HEAD happens to be checked out — otherwise consecutive quick tasks
compound on top of each other and stay unpushed (#2916). If `$branch_name`
already exists locally, reuse it as-is so resumed work is not rebased.

```bash
DEFAULT_BRANCH=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
DEFAULT_BRANCH=${DEFAULT_BRANCH:-main}

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  git switch "$branch_name" \
    || { echo "ERROR: Could not switch to existing quick-task branch '$branch_name'." >&2; exit 1; }
else
  # Fetch the default branch so origin/$DEFAULT_BRANCH is current. If the fetch
  # fails (offline, no remote, auth failure) AND we have no local copy of
  # origin/$DEFAULT_BRANCH to fall back on, abort — creating the branch off
  # arbitrary HEAD is exactly the bug #2916 fixed.
  if ! git fetch --quiet origin "$DEFAULT_BRANCH"; then
    if ! git show-ref --verify --quiet "refs/remotes/origin/$DEFAULT_BRANCH"; then
      echo "ERROR: Could not fetch origin/$DEFAULT_BRANCH and no local copy exists. Refusing to create '$branch_name' off the current HEAD (#2916). Resolve the remote/network issue and retry." >&2
      exit 1
    fi
    echo "WARNING: git fetch origin $DEFAULT_BRANCH failed; using the local copy of origin/$DEFAULT_BRANCH as base." >&2
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "WARNING: Uncommitted changes present. Carrying them onto the new quick-task branch — they will be branched off origin/$DEFAULT_BRANCH (not the previous-task HEAD)."
  else
    # Best-effort: fast-forward the local default branch so subsequent local
    # work sees the latest tip. Failure here is non-fatal because we always
    # create the new branch directly from origin/$DEFAULT_BRANCH below.
    git switch --quiet "$DEFAULT_BRANCH" 2>/dev/null \
      && git merge --ff-only --quiet "origin/$DEFAULT_BRANCH" 2>/dev/null \
      || true
  fi

  # Pin the new branch to origin/$DEFAULT_BRANCH so the start point is
  # deterministic regardless of which branch we are currently on (#2916).
  # On success HEAD is exactly at origin/$DEFAULT_BRANCH, so a post-creation
  # merge-base / "ahead-of" guard would be unreachable — the explicit base
  # argument here is the single source of correctness for #2916.
  git checkout -b "$branch_name" "origin/$DEFAULT_BRANCH" \
    || { echo "ERROR: Could not create '$branch_name' from origin/$DEFAULT_BRANCH (#2916)." >&2; exit 1; }
fi
```

All quick-task commits for this run stay on that branch. User handles merge/rebase afterward.

---

**Step 3: Create task directory**

```bash
mkdir -p "${task_dir}"
```

---

**Step 4: Create quick task directory**

Create the directory for this quick task:

```bash
QUICK_DIR=".planning/quick/${quick_id}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report to user:
```
Creating quick task ${quick_id}: ${DESCRIPTION}
Directory: ${QUICK_DIR}
```

Store `$QUICK_DIR` for use in orchestration.

---

**Step 4.5: Discussion phase (only when `$DISCUSS_MODE`)**

Skip this step entirely if NOT `$DISCUSS_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DISCUSSING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Surfacing gray areas for: ${DESCRIPTION}
```

**4.5a. Identify gray areas**

Analyze `$DESCRIPTION` to identify 2-4 gray areas — implementation decisions that would change the outcome and that the user should weigh in on.

Use the domain-aware heuristic to generate phase-specific (not generic) gray areas:
- Something users **SEE** → layout, density, interactions, states
- Something users **CALL** → responses, errors, auth, versioning
- Something users **RUN** → output format, flags, modes, error handling
- Something users **READ** → structure, tone, depth, flow
- Something being **ORGANIZED** → criteria, grouping, naming, exceptions

Each gray area should be a concrete decision point, not a vague category. Example: "Loading behavior" not "UX".

**4.5b. Present gray areas**

```
AskUserQuestion(
  header: "Gray Areas",
  question: "Which areas need clarification before planning?",
  options: [
    { label: "${area_1}", description: "${why_it_matters_1}" },
    { label: "${area_2}", description: "${why_it_matters_2}" },
    { label: "${area_3}", description: "${why_it_matters_3}" },
    { label: "All clear", description: "Skip discussion — I know what I want" }
  ],
  multiSelect: true
)
```

If user selects "All clear" → skip to Step 5 (no CONTEXT.md written).

**4.5c. Discuss selected areas**

For each selected area, ask 1-2 focused questions via AskUserQuestion:

```
AskUserQuestion(
  header: "${area_name}",
  question: "${specific_question_about_this_area}",
  options: [
    { label: "${concrete_choice_1}", description: "${what_this_means}" },
    { label: "${concrete_choice_2}", description: "${what_this_means}" },
    { label: "${concrete_choice_3}", description: "${what_this_means}" },
    { label: "You decide", description: "Claude's discretion" }
  ],
  multiSelect: false
)
```

Rules:
- Options must be concrete choices, not abstract categories
- Highlight recommended choice where you have a clear opinion
- If user selects "Other" with freeform text, switch to plain text follow-up (per questioning.md freeform rule)
- If user selects "You decide", capture as Claude's Discretion in CONTEXT.md
- Max 2 questions per area — this is lightweight, not a deep dive

Collect all decisions into `$DECISIONS`.

**4.5d. Write CONTEXT.md**

Write `${QUICK_DIR}/${quick_id}-CONTEXT.md` using the standard context template structure:

```markdown
# Quick Task ${quick_id}: ${DESCRIPTION} - Context

**Gathered:** ${date}
**Status:** Ready for planning

<domain>
## Task Boundary

${DESCRIPTION}

</domain>

<decisions>
## Implementation Decisions

### ${area_1_name}
- ${decision_from_discussion}

### ${area_2_name}
- ${decision_from_discussion}

### Claude's Discretion
${areas_where_user_said_you_decide_or_areas_not_discussed}

</decisions>

<specifics>
## Specific Ideas

${any_specific_references_or_examples_from_discussion}

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<canonical_refs>
## Canonical References

${any_specs_adrs_or_docs_referenced_during_discussion}

[If none: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>
```

Note: Quick task CONTEXT.md omits `<code_context>` and `<deferred>` sections (no codebase scouting, no phase scope to defer to). Keep it lean. The `<canonical_refs>` section is included when external docs were referenced — omit it only if no external docs apply.

Report: `Context captured: ${QUICK_DIR}/${quick_id}-CONTEXT.md`

---

**Step 4.75: Research phase (only when `$RESEARCH_MODE`)**

Skip this step entirely if NOT `$RESEARCH_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Investigating approaches for: ${DESCRIPTION}
```

Spawn a single focused researcher (not 4 parallel researchers like full phases — quick tasks need targeted research, not broad domain surveys):

```
Task(
  prompt="
<research_context>

**Mode:** quick-task
**Task:** ${DESCRIPTION}
**Output:** ${QUICK_DIR}/${quick_id}-RESEARCH.md

<files_to_read>
- .planning/STATE.md (Project state — what's already built)
- .planning/PROJECT.md (Project context)
- ./CLAUDE.md (if exists — project-specific guidelines)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (User decisions — research should align with these)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

</research_context>

<focus>
This is a quick task, not a full phase. Research should be concise and targeted:
1. Best libraries/patterns for this specific task
2. Common pitfalls and how to avoid them
3. Integration points with existing codebase
4. Any constraints or gotchas worth knowing before planning

Do NOT produce a full domain survey. Target 1-2 pages of actionable findings.
</focus>

<output>
Write research to: ${QUICK_DIR}/${quick_id}-RESEARCH.md
Use standard research format but keep it lean — skip sections that don't apply.
Return: ## RESEARCH COMPLETE with file path
</output>
",
  subagent_type="gsd-phase-researcher",
  model="{planner_model}",
  description="Research: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

After researcher returns:
1. Verify research exists at `${QUICK_DIR}/${quick_id}-RESEARCH.md`
2. Report: "Research complete: ${QUICK_DIR}/${quick_id}-RESEARCH.md"

If research file not found, warn but continue: "Research agent did not produce output — proceeding to planning without research."

---

**Step 5: Spawn planner (quick mode)**

**If `$VALIDATE_MODE`:** Use `quick-full` mode with stricter constraints.

**If NOT `$VALIDATE_MODE`:** Use standard `quick` mode.

```
Task(
  prompt="
<planning_context>

**Mode:** ${VALIDATE_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (User decisions — locked, do not revisit)' : ''}
${RESEARCH_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md (Research findings — use to inform implementation choices)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, plans should account for project skill rules

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
${RESEARCH_MODE ? '- Research findings are available — use them to inform library/pattern choices' : '- No research phase'}
${VALIDATE_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${VALIDATE_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${VALIDATE_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${quick_id}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${quick_id}-PLAN.md`
2. Extract plan count (typically 1 for quick tasks)
3. Report: "Plan created: ${QUICK_DIR}/${quick_id}-PLAN.md"

If plan not found, error: "Planner failed to create ${quick_id}-PLAN.md"

---

**Step 5.5: Plan-checker loop (only when `$VALIDATE_MODE`)**

Skip this step entirely if NOT `$VALIDATE_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Checker prompt:

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan to verify)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Scope:** This is a quick task, not a full phase. Skip checks that require a ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: Does the plan address the task description?
- Task completeness: Do tasks have files, action, verify, done fields?
- Key links: Are referenced files real?
- Scope sanity: Is this appropriately sized for a quick task (1-3 tasks)?
- must_haves derivation: Are must_haves traceable to the task description?

Skip: cross-plan deps (single plan), ROADMAP alignment
${DISCUSS_MODE ? '- Context compliance: Does the plan honor locked decisions from CONTEXT.md?' : '- Skip: context compliance (no CONTEXT.md)'}
</check_dimensions>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

**Handle checker return:**

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 6.
- **`## ISSUES FOUND`:** Display issues, check iteration count, enter revision loop.

**Revision loop (max 2 iterations):**

Track `iteration_count` (starts at 1 after initial plan + check).

**If iteration_count < 2:**

Display: `Sending back to planner for revision... (iteration ${N}/2)`

Revision prompt:

```markdown
<revision_context>
**Mode:** quick-full (revision)

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Existing plan)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** ${structured_issues_from_checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

After planner returns → spawn checker again, increment iteration_count.

**If iteration_count >= 2:**

Display: `Max iterations reached. ${N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Abort

---

**Step 5.6: Pre-dispatch plan commit (worktree mode only)**

When `USE_WORKTREES !== "false"`, commit PLAN.md to the current branch **before** spawning the executor. This ensures the worktree inherits PLAN.md at its branch HEAD so the executor can read it via a worktree-rooted path — avoiding the main-repo path priming that triggers CC #36182 path-resolution drift.

Skip this step entirely if `USE_WORKTREES === "false"` (non-worktree mode: PLAN.md is committed in Step 8 as usual).

```bash
if [ "${USE_WORKTREES}" != "false" ]; then
  COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
  if [ "$COMMIT_DOCS" != "false" ]; then
    git add "${QUICK_DIR}/${quick_id}-PLAN.md"
    # No-op skip if nothing actually staged (idempotent re-runs).
    if git diff --cached --quiet -- "${QUICK_DIR}/${quick_id}-PLAN.md"; then
      echo "ℹ Pre-dispatch PLAN.md commit skipped (no staged changes)"
    else
      # Run hooks normally (#2924). If a project opts out via
      # workflow.worktree_skip_hooks=true, honor that opt-in only.
      SKIP_HOOKS=$(gsd-sdk query config-get workflow.worktree_skip_hooks 2>/dev/null || echo "false")
      if [ "$SKIP_HOOKS" = "true" ]; then
        git commit --no-verify -m "docs(${quick_id}): pre-dispatch plan for ${DESCRIPTION}" -- "${QUICK_DIR}/${quick_id}-PLAN.md" \
          || { echo "ERROR: pre-dispatch PLAN.md commit failed (--no-verify path). Aborting before executor dispatch." >&2; exit 1; }
      else
        git commit -m "docs(${quick_id}): pre-dispatch plan for ${DESCRIPTION}" -- "${QUICK_DIR}/${quick_id}-PLAN.md" \
          || { echo "ERROR: pre-dispatch PLAN.md commit failed — likely a pre-commit hook failure. Fix the hook output above (or set workflow.worktree_skip_hooks=true to bypass) and re-run." >&2; exit 1; }
      fi
    fi
  fi
fi
```

---

**Step 6: Spawn executor**

Capture current HEAD before spawning (used for worktree branch check):
```bash
EXPECTED_BASE=$(git rev-parse HEAD)
```

Spawn gsd-executor with plan reference:

```
Task(
  prompt="
Execute quick task ${quick_id}.

${USE_WORKTREES !== "false" ? `
<worktree_branch_check>
FIRST ACTION before any other work: verify this worktree's HEAD is bound to a per-agent
branch and that the branch is based on the correct commit.

Step 1 — HEAD attachment assertion (MANDATORY, runs before any reset/commit):
  HEAD_REF=$(git symbolic-ref --quiet HEAD || echo "DETACHED")
  ACTUAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [ "$HEAD_REF" = "DETACHED" ] || echo "$ACTUAL_BRANCH" | grep -Eq '^(main|master|develop|trunk|release/.*)$'; then
    echo "FATAL: worktree HEAD is on '$ACTUAL_BRANCH' (expected per-agent branch like worktree-agent-*)." >&2
    echo "Refusing to commit/reset on a protected ref. DO NOT self-recover via 'git update-ref refs/heads/$ACTUAL_BRANCH' — that destroys concurrent work (#2924)." >&2
    echo "Aborting before any commits. Surface as a blocker for human review." >&2
    exit 1
  fi
  if ! echo "$ACTUAL_BRANCH" | grep -Eq '^worktree-agent-[A-Za-z0-9._/-]+$'; then
    echo "FATAL: worktree HEAD '$ACTUAL_BRANCH' is not in the worktree-agent-* namespace (Claude Code's per-agent worktree branch namespace)." >&2
    echo "Refusing to commit; surface as blocker (#2924)." >&2
    exit 1
  fi

Step 2 — Base correctness (only after Step 1 passes):
  Run: git merge-base HEAD ${EXPECTED_BASE}
  If the result differs from ${EXPECTED_BASE}, hard-reset to the correct base (safe — Step 1 confirmed HEAD is on a per-agent branch and the worktree is fresh):
    git reset --hard ${EXPECTED_BASE}
  Then verify: if [ "$(git rev-parse HEAD)" != "${EXPECTED_BASE}" ]; then echo "ERROR: Could not correct worktree base"; exit 1; fi

This corrects a known issue where EnterWorktree creates branches from main instead of the feature branch HEAD (#2015) and prevents the destructive HEAD-on-master self-recovery path (#2924).
</worktree_branch_check>
` : ''}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (Project instructions, if exists)
- .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
</files_to_read>

${AGENT_SKILLS_EXECUTOR}

<submodule_commit_guard>
SUBMODULE_PATHS for this project: ${SUBMODULE_PATHS}

If SUBMODULE_PATHS is non-empty, you MUST run this fail-loud guard immediately
before EVERY git commit you create during this quick task (after \`git add\`,
before \`git commit\`). Quick mode does not have a pre-declared files_modified
list, so the guard runs at commit time:

\`\`\`bash
SUBMODULE_PATHS=\"${SUBMODULE_PATHS}\"
if [ -n \"\$SUBMODULE_PATHS\" ]; then
  STAGED=\$(git diff --cached --name-only)
  for sm_raw in \$SUBMODULE_PATHS; do
    sm=\"\${sm_raw#./}\"
    sm=\"\${sm%/}\"
    [ -z \"\$sm\" ] && continue
    for f_raw in \$STAGED; do
      f=\"\${f_raw#./}\"
      f=\"\${f%/}\"
      case \"\$f\" in
        \"\$sm\"|\"\$sm\"/*)
          echo \"ABORT: staged path \$f_raw falls inside submodule \$sm — worktree-isolated commits cannot safely span submodule boundaries. Re-run with workflow.use_worktrees=false.\" >&2
          exit 1 ;;
      esac
    done
  done
fi
\`\`\`

If the guard aborts, do NOT attempt the commit, do NOT remove the staged files,
and do NOT continue subsequent tasks. Surface the abort message in your
SUMMARY.md and stop — the user must rerun with worktrees disabled.
</submodule_commit_guard>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically (code changes only)
- Run the <submodule_commit_guard> bash block before every \`git commit\` if SUBMODULE_PATHS is non-empty
- Create summary at: ${QUICK_DIR}/${quick_id}-SUMMARY.md
- Do NOT commit docs artifacts (SUMMARY.md, STATE.md, PLAN.md) — the orchestrator handles the docs commit in Step 8
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  ${USE_WORKTREES !== "false" ? 'isolation="worktree",' : ''}
  description="Execute: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

After executor returns:
1. **Worktree cleanup:** If the executor ran with `isolation="worktree"`, merge the worktree branch back and clean up:
   ```bash
   # Find worktrees created by the executor.
   # Inclusion-based filter (#2774): match ONLY agent-spawned worktrees under
   # `.claude/worktrees/agent-` (the namespace Claude Code's `isolation="worktree"`
   # uses). The previous exclusion filter (`grep -v "$(pwd)$"`) destroyed the parent
   # workspace's `.git` whenever the workspace itself was a worktree (multi-workspace
   # setups, and the cross-drive Windows case where `git worktree list` reports the
   # registry path on a different drive than `$(pwd)`).
   # Read line-by-line so worktree paths containing whitespace are preserved (#2774).
   while IFS= read -r WT; do
     [ -z "$WT" ] && continue
     WT_BRANCH=$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [ -n "$WT_BRANCH" ] && [ "$WT_BRANCH" != "HEAD" ]; then
       # --- Orchestrator file protection (#1756) ---
       # Backup STATE.md and ROADMAP.md before merge (main always wins)
       STATE_BACKUP=$(mktemp)
       ROADMAP_BACKUP=$(mktemp)
       [ -f .planning/STATE.md ] && cp .planning/STATE.md "$STATE_BACKUP" || true
       [ -f .planning/ROADMAP.md ] && cp .planning/ROADMAP.md "$ROADMAP_BACKUP" || true

       # Snapshot files on main to detect resurrections
       PRE_MERGE_FILES=$(git ls-files .planning/)

       # Pre-merge deletion guard: block merges that delete tracked .planning/ files
       DELETIONS=$(git diff --diff-filter=D --name-only HEAD..."$WT_BRANCH" 2>/dev/null || true)
       if [ -n "$DELETIONS" ]; then
         echo "BLOCKED: Worktree branch $WT_BRANCH contains file deletions: $DELETIONS"
         echo "Review these deletions before merging. If intentional, remove this guard and re-run."
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       git merge "$WT_BRANCH" --no-ff --no-edit -m "chore: merge quick task worktree ($WT_BRANCH)" 2>&1 || {
         echo "⚠ Merge conflict from worktree $WT_BRANCH — resolve manually"
         echo "  STATE.md backup:   $STATE_BACKUP"
         echo "  ROADMAP.md backup: $ROADMAP_BACKUP"
         echo "  Restore with: cp \$STATE_BACKUP .planning/STATE.md && cp \$ROADMAP_BACKUP .planning/ROADMAP.md"
         break
       }

       # Restore orchestrator-owned files
       if [ -s "$STATE_BACKUP" ]; then cp "$STATE_BACKUP" .planning/STATE.md; fi
       if [ -s "$ROADMAP_BACKUP" ]; then cp "$ROADMAP_BACKUP" .planning/ROADMAP.md; fi
       rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"

       # Remove files deleted on main but re-added by worktree (--no-ff guarantees a merge commit so HEAD~1 is reliable)
       DELETED_FILES=$(git diff --diff-filter=A --name-only HEAD~1 -- .planning/ 2>/dev/null || true)
       for RESURRECTED in $DELETED_FILES; do
         if ! echo "$PRE_MERGE_FILES" | grep -qxF "$RESURRECTED"; then
           git rm -f "$RESURRECTED" 2>/dev/null || true
         fi
       done

       if ! git diff --quiet .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || \
          [ -n "$DELETED_FILES" ]; then
         COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
         if [ "$COMMIT_DOCS" != "false" ]; then
           git add .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || true
           git commit --amend --no-edit 2>/dev/null || true
         fi
       fi

       # Safety net: rescue uncommitted SUMMARY.md before worktree removal (#2296, mirrors #2070, #2838).
       # Filesystem-level (find + cp) bypasses git's --exclude-standard filter, which silently
       # drops .planning/SUMMARY.md when projects gitignore .planning/ — the rescue's prior
       # `git ls-files --exclude-standard` form returned empty in that case and the SUMMARY
       # was lost on `git worktree remove --force`.
       while IFS= read -r SUMMARY; do
         [ -z "$SUMMARY" ] && continue
         REL_PATH="${SUMMARY#$WT/}"
         if [ ! -f "$REL_PATH" ] || ! cmp -s "$SUMMARY" "$REL_PATH"; then
           mkdir -p "$(dirname "$REL_PATH")"
           cp "$SUMMARY" "$REL_PATH"
           echo "⚠ Rescued $REL_PATH from worktree before removal"
         fi
       done < <(find "$WT/.planning" -name "*SUMMARY.md" 2>/dev/null)

       if ! git worktree remove "$WT" --force; then
         WT_NAME=$(basename "$WT")
         if [ -f ".git/worktrees/${WT_NAME}/locked" ]; then
           echo "⚠ Worktree $WT is locked — attempting to unlock and retry"
           git worktree unlock "$WT" 2>/dev/null || true
           if ! git worktree remove "$WT" --force; then
             echo "⚠ Residual worktree at $WT — manual cleanup required after session exits:"
             echo "    git worktree unlock \"$WT\" && git worktree remove \"$WT\" --force && git branch -D \"$WT_BRANCH\""
           fi
         else
           echo "⚠ Residual worktree at $WT (remove failed) — investigate manually"
         fi
       fi
       git branch -D "$WT_BRANCH" 2>/dev/null || true
     fi
   done < <(git worktree list --porcelain | grep "^worktree " | grep "\.claude/worktrees/agent-" | sed 's/^worktree //')
   ```
   If `workflow.use_worktrees` is `false`, skip this step.
2. Verify summary exists at `${QUICK_DIR}/${quick_id}-SUMMARY.md`
3. Extract commit hash from executor output
4. Report completion status

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: "Executor failed to create ${quick_id}-SUMMARY.md"

Note: For quick tasks producing multiple plans (rare), spawn executors in parallel waves per execute-phase patterns.

---

**Step 6.25: Code review (auto)**

Skip this step entirely if `$FULL_MODE` is false.

**Config gate:**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```
If `"false"`, skip with message "Code review skipped (workflow.code_review=false)".

**Scope files from executor's commits:**
```bash
# Find the diff base: last commit before quick task started
# Use git log to find commits referencing the quick task id, then take the parent of the oldest
QUICK_COMMITS=$(git log --oneline --format="%H" --grep="${quick_id}" 2>/dev/null)
if [ -n "$QUICK_COMMITS" ]; then
  DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)^
  # Verify parent exists (guard against first commit in repo)
  git rev-parse "${DIFF_BASE}" >/dev/null 2>&1 || DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)
else
  # No commits found for this quick task — skip review
  DIFF_BASE=""
fi

if [ -n "$DIFF_BASE" ]; then
  CHANGED_FILES=$(git diff --name-only "${DIFF_BASE}..HEAD" -- . ':!.planning' 2>/dev/null | tr '\n' ' ')
else
  CHANGED_FILES=""
fi
```

If `CHANGED_FILES` is empty, skip with "No source files changed — skipping code review."

**Invoke review:**
```
Task(
  prompt="Review these files for bugs, security issues, and code quality.
  Files: ${CHANGED_FILES}
  Output: ${QUICK_DIR}/${quick_id}-REVIEW.md
  Depth: quick",
  subagent_type="gsd-code-reviewer",
  model="{executor_model}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

If review produces findings, display advisory message. **Error handling:** Failures are non-blocking — catch and proceed.

---

**Step 6.5: Verification (only when `$VALIDATE_MODE`)**

Skip this step entirely if NOT `$VALIDATE_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning verifier...
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
</files_to_read>

${AGENT_SKILLS_VERIFIER}

Check must_haves against actual codebase. Create VERIFICATION.md at ${QUICK_DIR}/${quick_id}-VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

Read verification status:
```bash
grep "^status:" "${QUICK_DIR}/${quick_id}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

Store as `$VERIFICATION_STATUS`.

| Status | Action |
|--------|--------|
| `passed` | Store `$VERIFICATION_STATUS = "Verified"`, continue to step 7 |
| `human_needed` | Display items needing manual check, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
| `gaps_found` | Display gap summary, offer: 1) Re-run executor to fix gaps, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"` |

---

**Step 7: Update STATE.md**

Update STATE.md with quick task completion record.

**7a. Check if "Quick Tasks Completed" section exists:**

Read STATE.md and check for `### Quick Tasks Completed` section.

**7b. If section doesn't exist, create it:**

Insert after `### Blockers/Concerns` section:

**If `$VALIDATE_MODE`:**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
```

**If NOT `$VALIDATE_MODE`:**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
```

**Note:** If the table already exists, match its existing column format. If adding `--validate` (or `--full`) to a project that already has quick tasks without a Status column, add the Status column to the header and separator rows, and leave Status empty for the new row's predecessors.

**7c. Append new row to table:**

Use `date` from init:

**If `$VALIDATE_MODE` (or table has Status column):**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**If NOT `$VALIDATE_MODE` (and table has no Status column):**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**7d. Update "Last activity" line:**

Use `date` from init:
```
Last activity: ${date} - Completed quick task ${quick_id}: ${DESCRIPTION}
```

Use Edit tool to make these changes atomically

---

**Step 8: Final commit and completion**

Stage and commit quick task artifacts. This step MUST always run — even if the executor already committed some files (e.g. when running without worktree isolation). The `gsd-sdk query commit` command (or legacy `gsd-tools.cjs` commit) handles already-committed files gracefully.

Build file list:
- `${QUICK_DIR}/${quick_id}-PLAN.md`
- `${QUICK_DIR}/${quick_id}-SUMMARY.md`
- `.planning/STATE.md`
- If `$DISCUSS_MODE` and context file exists: `${QUICK_DIR}/${quick_id}-CONTEXT.md`
- If `$RESEARCH_MODE` and research file exists: `${QUICK_DIR}/${quick_id}-RESEARCH.md`
- If `$VALIDATE_MODE` and verification file exists: `${QUICK_DIR}/${quick_id}-VERIFICATION.md`
- If `${QUICK_DIR}/${quick_id}-deferred-items.md` exists: `${QUICK_DIR}/${quick_id}-deferred-items.md`

```bash
# Explicitly stage all artifacts before commit — PLAN.md may be untracked
# if the executor ran without worktree isolation and committed docs early
# Filter .planning/ files from staging if commit_docs is disabled (#1783)
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
if [ "$COMMIT_DOCS" = "false" ]; then
  file_list_filtered=$(echo "${file_list}" | tr ' ' '\n' | grep -v '^\.planning/' | tr '\n' ' ')
  git add ${file_list_filtered} 2>/dev/null
else
  git add ${file_list} 2>/dev/null
fi
gsd-sdk query commit "docs(quick-${quick_id}): ${DESCRIPTION}" --files ${file_list}
```

Get final commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion output:

**If `$VALIDATE_MODE`:**
```
---

GSD > QUICK TASK COMPLETE (VALIDATED)

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Verification: ${QUICK_DIR}/${quick_id}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}

---

Ready for next task: /gsd-quick ${GSD_WS}
```

**If NOT `$VALIDATE_MODE`:**
```
---

GSD > QUICK TASK COMPLETE

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Commit: ${commit_hash}

---

Ready for next task: /gsd-quick ${GSD_WS}
```

</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] User provides task description
- [ ] `--full`, `--validate`, `--discuss`, and `--research` flags parsed from arguments when present
- [ ] `--full` sets all booleans (`$FULL_MODE`, `$DISCUSS_MODE`, `$RESEARCH_MODE`, `$VALIDATE_MODE`)
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Quick ID generated (YYMMDD-xxx format, 2s Base36 precision)
- [ ] Directory created at `.planning/quick/YYMMDD-xxx-slug/`
- [ ] (--discuss) Gray areas identified and presented, decisions captured in `${quick_id}-CONTEXT.md`
- [ ] (--research) Research agent spawned, `${quick_id}-RESEARCH.md` created
- [ ] `${quick_id}-PLAN.md` created by planner (honors CONTEXT.md decisions when --discuss, uses RESEARCH.md findings when --research)
- [ ] (--validate) Plan checker validates plan, revision loop capped at 2
- [ ] `${quick_id}-SUMMARY.md` created by executor
- [ ] (--validate) `${quick_id}-VERIFICATION.md` created by verifier
- [ ] STATE.md updated with quick task row (Status column when --validate)
- [ ] Artifacts committed
</success_criteria>
