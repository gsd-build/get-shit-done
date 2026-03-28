<purpose>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Quick mode spawns gsd-planner (quick mode) + gsd-executor(s), tracks tasks in `.planning/quick/`, and updates STATE.md's "Quick Tasks Completed" table.

With `--discuss` flag: lightweight discussion phase before planning. Surfaces assumptions, clarifies gray areas, captures decisions in CONTEXT.md so the planner treats them as locked.

With `--full` flag: enables plan-checking (max 2 iterations) and post-execution verification for quality guarantees without full milestone ceremony.

With `--research` flag: spawns a focused research agent before planning. Investigates implementation approaches, library options, and pitfalls. Use when you're unsure how to approach a task.

Flags are composable: `--discuss --research --full` gives discussion + research + plan-checking + verification.
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
</available_agent_types>

<process>
**Step 1: Parse arguments and get task description**

Parse `$ARGUMENTS` for:
- `--full` flag → store as `$FULL_MODE` (true/false)
- `--discuss` flag → store as `$DISCUSS_MODE` (true/false)
- `--research` flag → store as `$RESEARCH_MODE` (true/false)
- Remaining text → use as `$DESCRIPTION` if non-empty

If `$DESCRIPTION` is empty after parsing, prompt user interactively:

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

If `$DISCUSS_MODE` and `$RESEARCH_MODE` and `$FULL_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + RESEARCH + FULL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + research + plan checking + verification enabled
```

If `$DISCUSS_MODE` and `$FULL_MODE` (no research):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + FULL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + plan checking + verification enabled
```

If `$DISCUSS_MODE` and `$RESEARCH_MODE` (no full):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + RESEARCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Discussion + research enabled
```

If `$RESEARCH_MODE` and `$FULL_MODE` (no discuss):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (RESEARCH + FULL)
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

If `$FULL_MODE` only:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (FULL MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Plan checking + verification enabled
```

---

**Step 2: Initialize**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_PLANNER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-planner 2>/dev/null)
AGENT_SKILLS_EXECUTOR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-executor 2>/dev/null)
AGENT_SKILLS_CHECKER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-checker 2>/dev/null)
AGENT_SKILLS_VERIFIER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-verifier 2>/dev/null)
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` is false:** Error — Quick mode requires an active project with ROADMAP.md. Run `/gsd:new-project` first.

Quick tasks can run mid-phase - validation only checks ROADMAP.md exists, not phase status.

---

**Step 2.5: Handle quick-task branching**

**If `branch_name` is empty/null:** Skip and continue on the current branch.

**If `branch_name` is set:** Check out the quick-task branch before any planning commits:

```bash
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
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

After researcher returns:
1. Verify research exists at `${QUICK_DIR}/${quick_id}-RESEARCH.md`
2. Report: "Research complete: ${QUICK_DIR}/${quick_id}-RESEARCH.md"

If research file not found, warn but continue: "Research agent did not produce output — proceeding to planning without research."

---

**Step 5: Spawn planner (quick mode)**

**If `$FULL_MODE`:** Use `quick-full` mode with stricter constraints.

**If NOT `$FULL_MODE`:** Use standard `quick` mode.

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
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
${FULL_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
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

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${quick_id}-PLAN.md`
2. Extract plan count (typically 1 for quick tasks)
3. Report: "Plan created: ${QUICK_DIR}/${quick_id}-PLAN.md"

If plan not found, error: "Planner failed to create ${quick_id}-PLAN.md"

---

**Step 5.5: Plan-checker loop (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

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

After planner returns → spawn checker again, increment iteration_count.

**If iteration_count >= 2:**

Display: `Max iterations reached. ${N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Abort

---

**Step 6: Spawn executor**

Spawn gsd-executor with plan reference:

```
Task(
  prompt="
Execute quick task ${quick_id}.

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (Project instructions, if exists)
- .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
</files_to_read>

${AGENT_SKILLS_EXECUTOR}

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${QUICK_DIR}/${quick_id}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  isolation="worktree",
  description="Execute: ${DESCRIPTION}"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${quick_id}-SUMMARY.md`
2. Extract commit hash from executor output
3. Report completion status

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: "Executor failed to create ${quick_id}-SUMMARY.md"

Note: For quick tasks producing multiple plans (rare), spawn executors in parallel waves per execute-phase patterns.

---

**Step 6.5: Verification (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

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

**If `$FULL_MODE`:**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
```

**If NOT `$FULL_MODE`:**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
```

**Note:** If the table already exists, match its existing column format. If adding `--full` to a project that already has quick tasks without a Status column, add the Status column to the header and separator rows, and leave Status empty for the new row's predecessors.

**7c. Append new row to table:**

Use `date` from init:

**If `$FULL_MODE` (or table has Status column):**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**If NOT `$FULL_MODE` (and table has no Status column):**
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

Stage and commit quick task artifacts:

Build file list:
- `${QUICK_DIR}/${quick_id}-PLAN.md`
- `${QUICK_DIR}/${quick_id}-SUMMARY.md`
- `.planning/STATE.md`
- If `$DISCUSS_MODE` and context file exists: `${QUICK_DIR}/${quick_id}-CONTEXT.md`
- If `$RESEARCH_MODE` and research file exists: `${QUICK_DIR}/${quick_id}-RESEARCH.md`
- If `$FULL_MODE` and verification file exists: `${QUICK_DIR}/${quick_id}-VERIFICATION.md`

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${quick_id}): ${DESCRIPTION}" --files ${file_list}
```

Get final commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion output:

**If `$FULL_MODE`:**
```
---

GSD > QUICK TASK COMPLETE (FULL MODE)

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Verification: ${QUICK_DIR}/${quick_id}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}

---

Ready for next task: /gsd:quick ${GSD_WS}
```

**If NOT `$FULL_MODE`:**
```
---

GSD > QUICK TASK COMPLETE

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Commit: ${commit_hash}

---

Ready for next task: /gsd:quick ${GSD_WS}
```

</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] User provides task description
- [ ] `--full`, `--discuss`, and `--research` flags parsed from arguments when present
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Quick ID generated (YYMMDD-xxx format, 2s Base36 precision)
- [ ] Directory created at `.planning/quick/YYMMDD-xxx-slug/`
- [ ] (--discuss) Gray areas identified and presented, decisions captured in `${quick_id}-CONTEXT.md`
- [ ] (--research) Research agent spawned, `${quick_id}-RESEARCH.md` created
- [ ] `${quick_id}-PLAN.md` created by planner (honors CONTEXT.md decisions when --discuss, uses RESEARCH.md findings when --research)
- [ ] (--full) Plan checker validates plan, revision loop capped at 2
- [ ] `${quick_id}-SUMMARY.md` created by executor
- [ ] (--full) `${quick_id}-VERIFICATION.md` created by verifier
- [ ] STATE.md updated with quick task row (Status column when --full)
- [ ] Artifacts committed
</success_criteria>
