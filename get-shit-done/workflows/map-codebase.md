<purpose>
Orchestrate parallel codebase mapper agents to analyze codebase and produce structured documents in .planning/codebase/. Optionally ingest user-provided documentation first.

Each agent has fresh context, explores a specific focus area, and **writes documents directly**. The orchestrator only receives confirmation + line counts, then writes a summary.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state, plus optional USER-CONTEXT.md with user-provided documentation.
</purpose>

<philosophy>
**Why dedicated mapper agents:**
- Fresh context per domain (no token contamination)
- Agents write documents directly (no context transfer back to orchestrator)
- Orchestrator only summarizes what was created (minimal context usage)
- Faster execution (agents run simultaneously)

**Document quality over length:**
Include enough detail to be useful as reference. Prioritize practical examples (especially code patterns) over arbitrary brevity.

**Always include file paths:**
Documents are reference material for Claude when planning/executing. Always include actual file paths formatted with backticks: `src/services/user.ts`.
</philosophy>

<process>

<step name="resolve_model_profile" priority="first">
Read model profile for agent spawning:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-codebase-mapper | sonnet | haiku | haiku |

Store resolved model for use in Task calls below.
</step>

<step name="prompt_for_docs">
Prompt inline (freeform, NOT AskUserQuestion):

"Do you have any existing documentation I should know about?
(File paths, directories, or 'no' to skip)"

Wait for user response.

**If "no" / empty / skip:**
Brief acknowledgment: "Got it, continuing with codebase mapping..."
Set `HAS_USER_DOCS=false`
Continue to check_existing.

**If path(s) provided:**
Set `HAS_USER_DOCS=true`
Initialize `USER_DOC_PATHS` list with provided path(s)
Continue to collect_doc_paths.
</step>

<step name="collect_doc_paths">
Loop until done:

**Validate current path(s):**
```bash
for path in ${USER_DOC_PATHS}; do
  if [ -e "$path" ]; then
    if [ -d "$path" ]; then
      echo "DIR:$path"
    else
      echo "FILE:$path"
    fi
  else
    echo "INVALID:$path"
  fi
done
```

**For each path:**
- Valid file: Brief confirmation "Found: [filename]"
- Valid directory: "Found directory: [path] - will scan for docs"
- Invalid: Use AskUserQuestion:
  - header: "Path not found"
  - question: "Couldn't find [path]. Continue without it?"
  - options: ["Yes, continue", "Let me correct the path"]
  - If correct: Replace path and re-validate

**After all paths validated:**
Prompt inline: "Add another? (path or 'done')"

If "done" -> Continue to spawn_doc_ingestor
If path -> Add to USER_DOC_PATHS, loop again
</step>

<step name="spawn_doc_ingestor">
Skip this step if `HAS_USER_DOCS=false`.

Spawn gsd-doc-ingestor agent.

Task tool parameters:
```
subagent_type: "gsd-doc-ingestor"
description: "Ingest user documentation"
```

Prompt:
```
Ingest user-provided documentation.

**Paths to process:**
${USER_DOC_PATHS}

**Instructions:**
1. Check for existing USER-CONTEXT.md (ask replace/merge if exists)
2. Validate each path
3. For directories: scan and identify relevant documentation
4. Categorize documents (architecture, API, general, etc.)
5. Write to .planning/codebase/USER-CONTEXT.md
6. Return confirmation with counts
```

Wait for agent completion.

Display agent's confirmation to user:
"[Agent confirmation]"

Continue to ask_validation.
</step>

<step name="ask_validation">
Only execute if HAS_USER_DOCS is true and doc ingestion completed successfully.

Ask user if they want validation:

"Would you like me to validate your documentation against the codebase?
(This checks if file paths, function names, etc. still exist)

Yes / No"

**If "yes" / "y" / empty:**
Set `VALIDATE_DOCS=true`
Continue to spawn_doc_validator.

**If "no" / "n" / "skip":**
Set `VALIDATE_DOCS=false`
Set `DOCS_VALIDATED=false`
Brief acknowledgment: "Skipping validation, continuing with codebase mapping..."
Continue to check_existing.
</step>

<step name="spawn_doc_validator">
Only execute if VALIDATE_DOCS is true.

Spawn the gsd-doc-validator subagent to validate user documentation:

Use Task tool:
- subagent_type: gsd-doc-validator
- description: "Validate user documentation claims against codebase"
- prompt: "Validate the user-provided documentation in USER-CONTEXT.md against the actual codebase. Extract technical claims, verify each against real code, assign confidence levels, present any issues to the user for decision, and update USER-CONTEXT.md with validation status."

Wait for completion. The validator will:
1. Extract technical claims from USER-CONTEXT.md
2. Verify claims against actual codebase files
3. Present LOW confidence claims to user via AskUserQuestion
4. Collect user decisions (Include/Exclude/Mark stale)
5. Annotate USER-CONTEXT.md with validation results

Store validation result for offer_next step.
DOCS_VALIDATED = true after successful completion.

Continue to check_existing.
</step>

<step name="check_existing">
Check if .planning/codebase/ already exists:

```bash
ls -la .planning/codebase/ 2>/dev/null
```

**If exists:**

```
.planning/codebase/ already exists with these documents:
[List files found]

What's next?
1. Refresh - Delete existing and remap codebase
2. Update - Keep existing, only update specific documents
3. Skip - Use existing codebase map as-is
```

Wait for user response.

If "Refresh": Delete .planning/codebase/, continue to create_structure
If "Update": Ask which documents to update, continue to spawn_agents (filtered)
If "Skip": Exit workflow

**If doesn't exist:**
Continue to create_structure.
</step>

<step name="create_structure">
Create .planning/codebase/ directory:

```bash
mkdir -p .planning/codebase
```

**Expected output files:**
- STACK.md (from tech mapper)
- INTEGRATIONS.md (from tech mapper)
- ARCHITECTURE.md (from arch mapper)
- STRUCTURE.md (from arch mapper)
- CONVENTIONS.md (from quality mapper)
- TESTING.md (from quality mapper)
- CONCERNS.md (from concerns mapper)

Continue to spawn_agents.
</step>

<step name="spawn_agents">
Spawn 4 parallel gsd-codebase-mapper agents.

Use Task tool with `subagent_type="gsd-codebase-mapper"`, `model="{mapper_model}"`, and `run_in_background=true` for parallel execution.

**CRITICAL:** Use the dedicated `gsd-codebase-mapper` agent, NOT `Explore`. The mapper agent writes documents directly.

**Agent 1: Tech Focus**

Task tool parameters:
```
subagent_type: "gsd-codebase-mapper"
model: "{mapper_model}"
run_in_background: true
description: "Map codebase tech stack"
```

Prompt:
```
Focus: tech

Analyze this codebase for technology stack and external integrations.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks

Explore thoroughly. Write documents directly using templates. Return confirmation only.
```

**Agent 2: Architecture Focus**

Task tool parameters:
```
subagent_type: "gsd-codebase-mapper"
model: "{mapper_model}"
run_in_background: true
description: "Map codebase architecture"
```

Prompt:
```
Focus: arch

Analyze this codebase architecture and directory structure.

Write these documents to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

Explore thoroughly. Write documents directly using templates. Return confirmation only.
```

**Agent 3: Quality Focus**

Task tool parameters:
```
subagent_type: "gsd-codebase-mapper"
model: "{mapper_model}"
run_in_background: true
description: "Map codebase conventions"
```

Prompt:
```
Focus: quality

Analyze this codebase for coding conventions and testing patterns.

Write these documents to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage

Explore thoroughly. Write documents directly using templates. Return confirmation only.
```

**Agent 4: Concerns Focus**

Task tool parameters:
```
subagent_type: "gsd-codebase-mapper"
model: "{mapper_model}"
run_in_background: true
description: "Map codebase concerns"
```

Prompt:
```
Focus: concerns

Analyze this codebase for technical debt, known issues, and areas of concern.

Write this document to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas

Explore thoroughly. Write document directly using template. Return confirmation only.
```

Continue to collect_confirmations.
</step>

<step name="collect_confirmations">
Wait for all 4 agents to complete.

Read each agent's output file to collect confirmations.

**Expected confirmation format from each agent:**
```
## Mapping Complete

**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC1}.md` ({N} lines)
- `.planning/codebase/{DOC2}.md` ({N} lines)

Ready for orchestrator summary.
```

**What you receive:** Just file paths and line counts. NOT document contents.

If any agent failed, note the failure and continue with successful documents.

Continue to verify_output.
</step>

<step name="verify_output">
Verify all documents created successfully:

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Verification checklist:**
- All 7 documents exist
- No empty documents (each should have >20 lines)

If any documents missing or empty, note which agents may have failed.

Continue to commit_codebase_map.
</step>

<step name="commit_codebase_map">
Commit the codebase map:

**Check planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If `COMMIT_PLANNING_DOCS=false`:** Skip git operations

**If `COMMIT_PLANNING_DOCS=true` (default):**

```bash
git add .planning/codebase/*.md
git commit -m "$(cat <<'EOF'
docs: map existing codebase

- STACK.md - Technologies and dependencies
- ARCHITECTURE.md - System design and patterns
- STRUCTURE.md - Directory layout
- CONVENTIONS.md - Code style and patterns
- TESTING.md - Test structure
- INTEGRATIONS.md - External services
- CONCERNS.md - Technical debt and issues
EOF
)"
```

Continue to offer_next.
</step>

<step name="offer_next">
Present completion summary and next steps.

**Get line counts:**
```bash
wc -l .planning/codebase/*.md
```

**Output format:**

```
Codebase mapping complete.

Created .planning/codebase/:
- USER-CONTEXT.md ([N] lines) - User-provided documentation (if created)
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues

[If DOCS_VALIDATED is true, add validation summary:]
**Documentation validation:**
- [N] claims validated
- [N] HIGH confidence, [N] MEDIUM, [N] LOW
- [If LOW claims existed:] User resolved [N] LOW confidence claims
- USER-CONTEXT.md annotated with validation status

---

## ▶ Next Up

**Initialize project** — use codebase context for planning

`/gsd:new-project`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Re-run mapping: `/gsd:map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```

Note: Only include USER-CONTEXT.md in the list if it was created (user provided docs).
Note: Only include validation summary if DOCS_VALIDATED is true.

End workflow.
</step>

</process>

<success_criteria>
- User prompted for existing documentation
- User docs processed (if provided) or skipped gracefully
- .planning/codebase/ directory created
- USER-CONTEXT.md written (if docs provided)
- User documentation validated (if provided)
- USER-CONTEXT.md annotated with validation status (if docs provided)
- 4 parallel gsd-codebase-mapper agents spawned with run_in_background=true
- Agents write documents directly (orchestrator doesn't receive document contents)
- Read agent output files to collect confirmations
- All 7 codebase documents exist
- Clear completion summary with line counts
- User offered clear next steps in GSD style
</success_criteria>
