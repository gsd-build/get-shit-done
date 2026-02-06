---
name: gsdf:map-codebase
description: Token-optimized codebase mapping
argument-hint: "[optional: area to map]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

<objective>
Token-optimized version of `/gsd:map-codebase`. Analyzes existing codebase using parallel mapper agents.

Output: .planning/codebase/ with 7 structured documents.
</objective>

<context>
Focus area: $ARGUMENTS (optional - tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized
</context>

<when_to_use>
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When STATE.md references outdated codebase info

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
</when_to_use>

<process>

## Step 0: Resolve GSDF Model Profile

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-codebase-mapper | sonnet | sonnet | haiku |

## Step 1: Check Existing Map

```bash
[ -d .planning/codebase ] && ls .planning/codebase/*.md 2>/dev/null | wc -l
```

If exists, offer: Refresh | Skip | View

## Step 2: Create Directory

```bash
mkdir -p .planning/codebase
```

## Step 3: Spawn 4 Parallel Mappers

**This command can run:**
- Before /gsd:new-project (brownfield codebases) - creates codebase map first
- After /gsd:new-project - updates codebase map as code evolves
- Anytime to refresh codebase understanding

**Agent 1: Tech Focus**
```
Task(prompt="Explore codebase for technology stack.

Write directly to:
- .planning/codebase/STACK.md (languages, frameworks, dependencies)
- .planning/codebase/INTEGRATIONS.md (external services, APIs)

Return: MAPPING COMPLETE with file list
", subagent_type="gsd-codebase-mapper", model="{mapper_model}", description="Map tech")
```

**Agent 2: Architecture Focus**
```
Task(prompt="Explore codebase for architecture patterns.

Write directly to:
- .planning/codebase/ARCHITECTURE.md (patterns, layers, data flow)
- .planning/codebase/STRUCTURE.md (directory layout, key files)

Return: MAPPING COMPLETE with file list
", subagent_type="gsd-codebase-mapper", model="{mapper_model}", description="Map arch")
```

**Agent 3: Quality Focus**
```
Task(prompt="Explore codebase for quality patterns.

Write directly to:
- .planning/codebase/CONVENTIONS.md (coding standards, naming)
- .planning/codebase/TESTING.md (test setup, patterns, coverage)

Return: MAPPING COMPLETE with file list
", subagent_type="gsd-codebase-mapper", model="{mapper_model}", description="Map quality")
```

**Agent 4: Concerns Focus**
```
Task(prompt="Explore codebase for issues and concerns.

Write directly to:
- .planning/codebase/CONCERNS.md (tech debt, known issues, risks)

Return: MAPPING COMPLETE with file list
", subagent_type="gsd-codebase-mapper", model="{mapper_model}", description="Map concerns")
```

## Step 4: Verify All Documents

```bash
for doc in STACK INTEGRATIONS ARCHITECTURE STRUCTURE CONVENTIONS TESTING CONCERNS; do
  [ -f ".planning/codebase/${doc}.md" ] && wc -l ".planning/codebase/${doc}.md"
done
```

## Step 5: Commit

Check `COMMIT_PLANNING_DOCS` from config.json (default: true):
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true`:
```bash
git add .planning/codebase/*.md
git commit -m "docs: map codebase (7 documents)"
```

## Step 6: Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► CODEBASE MAPPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7 documents in .planning/codebase/

───────────────────────────────────────────────────────────────

## ▶ Next Up

/gsdf:new-project — start project with codebase context

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/codebase/ARCHITECTURE.md — view architecture
- cat .planning/codebase/STACK.md — view tech stack

───────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] .planning/codebase/ created
- [ ] All 7 documents written
- [ ] Parallel agents completed (using profile model)
- [ ] Committed (if config allows)
</success_criteria>
