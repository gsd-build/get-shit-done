---
name: gsdf:quick
description: Token-optimized quick task execution
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Token-optimized version of `/gsd:quick`. Executes small ad-hoc tasks with GSD guarantees using core agents.

Quick tasks:
- Live in `.planning/quick/`
- Update STATE.md (not ROADMAP.md)
- Skip researcher, checker, verifier
</objective>

<context>
Task: $ARGUMENTS

@.planning/STATE.md
</context>

<process>

## Step 0: Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner-core | opus | sonnet | sonnet |
| gsd-executor-core | sonnet | sonnet | haiku |

## Step 1: Pre-flight

```bash
[ -f .planning/ROADMAP.md ] || { echo "Run /gsd:new-project first"; exit 1; }
```

## Step 2: Get Task Description

```
AskUserQuestion(header: "Quick Task", question: "What do you want to do?")
```

Generate slug:
```bash
slug=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
```

## Step 3: Calculate Task Number

```bash
mkdir -p .planning/quick
last=$(ls -1d .planning/quick/[0-9][0-9][0-9]-* 2>/dev/null | sort -r | head -1 | xargs basename 2>/dev/null | grep -oE '^[0-9]+')
next_num=$(printf "%03d" $((10#${last:-0} + 1)))
QUICK_DIR=".planning/quick/${next_num}-${slug}"
mkdir -p "$QUICK_DIR"
```

## Step 4: Spawn Planner (Core Agent)

Pre-read agent cores (inline into prompt, no wasted turn):
```bash
PLANNER_CORE=$(cat ~/.claude/agents/gsd-planner-core.md)
EXECUTOR_CORE=$(cat ~/.claude/agents/gsd-executor-core.md)
```

```
Task(prompt="${PLANNER_CORE}

Create a SINGLE plan with 1-3 focused tasks.

Task: ${DESCRIPTION}
Directory: ${QUICK_DIR}

State context:
${STATE_CONTENT}

Constraints:
- Quick task, atomic, self-contained
- No research, no checker
- Target simple focused plan

Write to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE
", subagent_type="general-purpose", model="{planner_model}", description="Quick plan")
```

## Step 5: Verify Plan Created

```bash
ls ${QUICK_DIR}/*-PLAN.md 2>/dev/null || echo "ERROR: Plan not created"
```

**If plan file missing:** Error — show what planner returned, ask to retry or abort.

## Step 6: Spawn Executor (Core Agent)

Read plan content first (@ doesn't work across Task boundaries):
```bash
PLAN_CONTENT=$(cat ${QUICK_DIR}/${next_num}-PLAN.md)
```

```
Task(prompt="${EXECUTOR_CORE}

Execute quick task ${next_num}.

Plan:
${PLAN_CONTENT}

State context:
${STATE_CONTENT}

Constraints:
- Execute all tasks
- Atomic commits
- Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
- Do NOT update ROADMAP.md
", subagent_type="general-purpose", model="{executor_model}", description="Execute quick")
```

For quick tasks producing multiple plans (rare), spawn executors in parallel waves.

## Step 7: Verify Summary Created

```bash
ls ${QUICK_DIR}/*-SUMMARY.md 2>/dev/null || echo "ERROR: Summary not created"
```

**If summary file missing:** Error — show what executor returned.

## Step 8: Update STATE.md

```bash
# Check if "Quick Tasks Completed" section exists
grep -q "Quick Tasks Completed" .planning/STATE.md
```

**If section missing:** Create it:
```markdown
### Quick Tasks Completed

| # | Task | Date | Commit | Link |
|---|------|------|--------|------|
```

**Add row:** `| ${next_num} | ${DESCRIPTION} | $(date +%Y-%m-%d) | ${commit_hash} | [link](./quick/${next_num}-${slug}/) |`

**Update "Last activity" line:** `Last activity: [today] — Quick task: ${DESCRIPTION}`

## Step 9: Final Commit

Check `COMMIT_PLANNING_DOCS` from config.json (default: true):
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true`:
```bash
git add ${QUICK_DIR}/*.md .planning/STATE.md
git commit -m "docs(quick-${next_num}): ${DESCRIPTION}"
```

## Step 10: Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► QUICK TASK COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Task:** ${DESCRIPTION}
**Summary:** ${QUICK_DIR}/${next_num}-SUMMARY.md

## ▶ Next Up

/gsdf:progress — see overall project status
```

</process>

<success_criteria>
- [ ] PLAN.md created by planner — verified on disk
- [ ] SUMMARY.md created by executor — verified on disk
- [ ] STATE.md updated (section exists check + row + last activity)
- [ ] Slug trimmed (no leading/trailing hyphens)
- [ ] Artifacts committed (if config allows)
</success_criteria>
