---
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<objective>

Initialize a new project through comprehensive context gathering.

This is the most leveraged moment in any project. Deep questioning here means better plans, better execution, better outcomes. The quality of PROJECT.md determines the quality of everything downstream.

Creates `.planning/` with PROJECT.md and config.json.

</objective>

<execution_context>

@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/templates/project.md
@~/.claude/get-shit-done/templates/config.json

</execution_context>

<process>

<step name="setup">

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

1. **Abort if project exists:**
   ```bash
   [ -f .planning/PROJECT.md ] && echo "ERROR: Project already initialized. Use /gsd:progress" && exit 1
   ```

2. **Initialize git repo in THIS directory** (required even if inside a parent repo):
   ```bash
   # Check if THIS directory is already a git repo root (handles .git file for worktrees too)
   if [ -d .git ] || [ -f .git ]; then
       echo "Git repo exists in current directory"
   else
       git init
       echo "Initialized new git repo"
   fi
   ```

3. **Detect existing code (brownfield detection):**
   ```bash
   # Check for existing code files
   CODE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" 2>/dev/null | grep -v node_modules | grep -v .git | head -20)
   HAS_PACKAGE=$([ -f package.json ] || [ -f requirements.txt ] || [ -f Cargo.toml ] || [ -f go.mod ] || [ -f Package.swift ] && echo "yes")
   HAS_CODEBASE_MAP=$([ -d .planning/codebase ] && echo "yes")
   ```

   **You MUST run all bash commands above using the Bash tool before proceeding.**

</step>

<step name="brownfield_offer">

**If existing code detected and .planning/codebase/ doesn't exist:**

Check the results from setup step:
- If `CODE_FILES` is non-empty OR `HAS_PACKAGE` is "yes"
- AND `HAS_CODEBASE_MAP` is NOT "yes"

Use AskUserQuestion:
- header: "Existing Code"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first" — Run /gsd:map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/gsd:map-codebase` first, then return to `/gsd:new-project`
```
Exit command.

**If "Skip mapping":** Continue to question step.

**If no existing code detected OR codebase already mapped:** Continue to question step.

</step>

<step name="question">

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions.

**Follow the thread:**

Based on what they said, ask follow-up questions that dig into their response. Use AskUserQuestion with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What excited them
- What problem sparked this
- What they mean by vague terms
- What it would actually look like
- What's already decided

Consult `questioning.md` for techniques:
- Challenge vagueness
- Make abstract concrete
- Surface assumptions
- Find edges
- Reveal motivation

**Check context (background, not out loud):**

As you go, mentally check the context checklist from `questioning.md`. If gaps remain, weave questions naturally. Don't suddenly switch to checklist mode.

**Decision gate:**

When you could write a clear PROJECT.md, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

</step>

<step name="project">

Synthesize all context into `.planning/PROJECT.md` using the template from `templates/project.md`.

**For greenfield projects:**

Initialize requirements as hypotheses:

```markdown
## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]
```

All Active requirements are hypotheses until shipped and validated.

**For brownfield projects (codebase map exists):**

Infer Validated requirements from existing code:

1. Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md`
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing
- ✓ [Existing capability 3] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

**Key Decisions:**

Initialize with any decisions made during questioning:

```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |
```

**Last updated footer:**

```markdown
---
*Last updated: [date] after initialization*
```

Do not compress. Capture everything gathered.

</step>

<step name="workflow_preferences">

Ask all workflow preferences in a single AskUserQuestion call (3 questions):

Use AskUserQuestion with questions array:

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Depth",
    question: "How thorough should planning be?",
    multiSelect: false,
    options: [
      { label: "Quick", description: "Ship fast (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 phases, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  }
]
```

**Notes:**
- Depth controls compression tolerance, not artificial inflation
- Parallelization spawns multiple agents for independent plans
- All settings can be changed later in config.json

</step>

<step name="create_metrics">

**Create .planning/metrics.json:**

```bash
# Copy template
cp ~/.claude/get-shit-done/templates/metrics.json .planning/metrics.json

# Fill in project name
PROJECT_NAME=$(head -1 .planning/PROJECT.md | sed 's/^# //')
jq --arg name "$PROJECT_NAME" '.project_name = $name | .last_updated = now | todate' \
   .planning/metrics.json > .planning/metrics.tmp && \
   mv .planning/metrics.tmp .planning/metrics.json
```

</step>

<step name="config">

Create `.planning/config.json` with chosen mode, depth, and parallelization using `templates/config.json` structure.

</step>

<step name="commit">

```bash
git add .planning/PROJECT.md .planning/config.json .planning/metrics.json
git commit -m "$(cat <<'EOF'
docs: initialize [project-name]

[One-liner from PROJECT.md]

Creates PROJECT.md with requirements and constraints.
EOF
)"
```

</step>

<step name="done">

Present completion with next steps (see ~/.claude/get-shit-done/references/continuation-format.md):

```
Project initialized:

- Project: .planning/PROJECT.md
- Config: .planning/config.json (mode: [chosen mode])
- Metrics: .planning/metrics.json
[If .planning/codebase/ exists:] - Codebase: .planning/codebase/ (7 documents)

---

## ▶ Next Up

Choose your path:

**Option A: Research first** (recommended)
Research ecosystem → define requirements → create roadmap. Discovers standard stacks, expected features, architecture patterns.

`/gsd:research-project`

**Option B: Define requirements directly** (familiar domains)
Skip research, define requirements from what you know, then create roadmap.

`/gsd:define-requirements`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/metrics.json`

</output>

<success_criteria>

- [ ] Deep questioning completed (not rushed, threads followed)
- [ ] PROJECT.md captures full context with evolutionary structure
- [ ] Requirements initialized as hypotheses (greenfield) or with inferred Validated (brownfield)
- [ ] Key Decisions table initialized
- [ ] config.json has workflow mode, depth, and parallelization
- [ ] metrics.json created with project name
- [ ] All committed to git

</success_criteria>
