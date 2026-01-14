---

description: Initialize a new project with deep context gathering and PROJECT.md
---

<objective>

Initialize a new project through comprehensive context gathering.

This is the most leveraged moment in any project. Deep questioning here means better plans, better execution, better outcomes.

Creates `.planning/` with PROJECT.md and config.json.

</objective>

<execution_context>

@~/.config/opencode/gsd/references/principles.md
@~/.config/opencode/gsd/references/questioning.md
@~/.config/opencode/gsd/templates/project.md
@~/.config/opencode/gsd/templates/config.json

</execution_context>

<process>

<step name="setup">

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

1. **Abort if project exists:**
   ```bash
   [ -f .planning/PROJECT.md ] && echo "ERROR: Project already initialized. Use /gsd/progress" && exit 1
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
  - "Map codebase first" — Run /gsd/map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/gsd/map-codebase` first, then return to `/gsd/new-project`
```
Exit command.

**If "Skip mapping":** Continue to question step.

**If no existing code detected OR codebase already mapped:** Continue to question step.

</step>

<step name="question">

**1. Open (FREEFORM — do NOT use AskUserQuestion):**

Ask inline: "What do you want to build?"

Wait for their freeform response. This gives you the context needed to ask intelligent follow-up questions.

**2. Follow the thread (NOW use AskUserQuestion):**

Based on their response, use AskUserQuestion with options that probe what they mentioned:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — what would that look like?"
- options: 2-3 interpretations + "Something else"

**3. Sharpen the core:**

Use AskUserQuestion:
- header: "Core"
- question: "If you could only nail one thing, what would it be?"
- options: Key aspects they've mentioned + "All equally important" + "Something else"

**4. Find boundaries:**

Use AskUserQuestion:
- header: "Scope"
- question: "What's explicitly NOT in v1?"
- options: Things that might be tempting + "Nothing specific" + "Let me list them"

**5. Ground in reality:**

Use AskUserQuestion:
- header: "Constraints"
- question: "Any hard constraints?"
- options: Relevant constraint types + "None" + "Yes, let me explain"

**6. Decision gate:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Ready to create PROJECT.md, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create PROJECT.md" — Finalize and continue
  - "Ask more questions" — I'll dig deeper
  - "Let me add context" — You have more to share

If "Ask more questions" → check coverage gaps from `questioning.md` → return to step 2.
If "Let me add context" → receive input via their response → return to step 2.
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

<step name="mode">

Ask workflow mode preference:

Use AskUserQuestion:

- header: "Mode"
- question: "How do you want to work?"
- options:
  - "YOLO" — Auto-approve, just execute (Recommended)
  - "Interactive" — Confirm at each step

</step>

<step name="depth">

Ask planning depth preference:

Use AskUserQuestion:

- header: "Depth"
- question: "How thorough should planning be?"
- options:
  - "Quick" — Ship fast, minimal phases/plans (3-5 phases, 1-3 plans each)
  - "Standard" — Balanced scope and speed (5-8 phases, 3-5 plans each)
  - "Comprehensive" — Thorough coverage, more phases/plans (8-12 phases, 5-10 plans each)

**Depth controls compression tolerance, not artificial inflation.** All depths use 2-3 tasks per plan. Comprehensive means "don't compress complex work"—it doesn't mean "pad simple work to hit a number."

</step>

<step name="parallelization">

Ask parallel execution preference:

Use AskUserQuestion:

- header: "Parallelization"
- question: "Enable parallel phase execution?"
- options:
  - "Enabled" — Run independent plans in parallel (Recommended)
  - "Disabled" — Execute plans sequentially

**Parallelization** spawns multiple agents for independent plans within a phase. Wave-based execution handles dependencies automatically. Can be changed later in config.json.

</step>

<step name="config">

Create `.planning/config.json` with chosen mode, depth, and parallelization using `templates/config.json` structure.

</step>

<step name="commit">

```bash
git add .planning/PROJECT.md .planning/config.json
git commit -m "$(cat <<'EOF'
docs: initialize [project-name]

[One-liner from PROJECT.md]

Creates PROJECT.md with requirements and constraints.
EOF
)"
```

</step>

<step name="done">

Present completion with next steps (see ~/.config/opencode/gsd/references/continuation-format.md):

```
Project initialized:

- Project: .planning/PROJECT.md
- Config: .planning/config.json (mode: [chosen mode])
[If .planning/codebase/ exists:] - Codebase: .planning/codebase/ (7 documents)

---

## ▶ Next Up

**[Project Name]** — create roadmap

`/gsd/create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`

</output>

<success_criteria>

- [ ] Deep questioning completed (not rushed)
- [ ] PROJECT.md captures full context with evolutionary structure
- [ ] Requirements initialized as hypotheses (greenfield) or with inferred Validated (brownfield)
- [ ] Key Decisions table initialized
- [ ] config.json has workflow mode, depth, and parallelization
- [ ] All committed to git

</success_criteria>
