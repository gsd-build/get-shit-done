<purpose>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification. Default flow: Research (if needed) -> Plan -> Verify -> Done. Orchestrates gsd-phase-researcher, gsd-planner, and gsd-plan-checker agents with a revision loop (max 3 iterations).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/revision-loop.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/agent-contracts.md
@~/.claude/get-shit-done/references/gates.md
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-phase-researcher — Researches technical approaches for a phase
- gsd-pattern-mapper — Analyzes codebase for existing patterns, produces PATTERNS.md
- gsd-planner — Creates detailed plans from phase scope
- gsd-plan-checker — Reviews plan quality before execution
</available_agent_types>

<process>

## 0. Git Branch Invariant

**Do not create, rename, or switch git branches during plan-phase.** Branch identity is established at discuss-phase and is owned by the user's git workflow. A phase rename in ROADMAP.md is a plan-level change only — it does not mutate git branch names. If `phase_slug` in the init JSON differs from the current branch name, that is expected and correct; leave the branch unchanged.

## 1. Initialize

Load all context in one call (paths only to minimize orchestrator context):

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-phase-researcher)
AGENT_SKILLS_PLANNER=$(gsd-sdk query agent-skills gsd-planner)
AGENT_SKILLS_CHECKER=$(gsd-sdk query agent-skills gsd-plan-checker)
CONTEXT_WINDOW=$(gsd-sdk query config-get context_window 2>/dev/null || echo "200000")
TDD_MODE=$(gsd-sdk query config-get workflow.tdd_mode 2>/dev/null || echo "false")
```

When `TDD_MODE` is `true`, the planner agent is instructed to apply `type: tdd` to eligible tasks using heuristics from `references/tdd.md`. The planner's `<required_reading>` is extended to include `@~/.claude/get-shit-done/references/tdd.md` so gate enforcement rules are available during planning.

When `CONTEXT_WINDOW >= 500000`, the planner prompt includes the 3 most recent prior phase CONTEXT.md and SUMMARY.md files PLUS any phases explicitly listed in the current phase's `Depends on:` field in ROADMAP.md. Explicit dependencies always load regardless of recency (e.g., Phase 7 declaring `Depends on: Phase 2` always sees Phase 2's context). Bounded recency keeps the planner's context budget focused on recent work.

Parse JSON for: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`, `commit_docs`, `text_mode`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_reviews`, `has_plans`, `plan_count`, `planning_exists`, `roadmap_exists`, `phase_req_ids`, `response_language`.

**If `response_language` is set:** Include `response_language: {value}` in all spawned subagent prompts so any user-facing output stays in the configured language.

**File paths (for <files_to_read> blocks):** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`, `reviews_path`. These are null if files don't exist.

**If `planning_exists` is false:** Error — run `/gsd-new-project` first.

## 2. Parse and Normalize Arguments

Extract from $ARGUMENTS: phase number (integer or decimal like `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--skip-ui`, `--prd <filepath>`, `--reviews`, `--text`, `--bounce`, `--skip-bounce`, `--chunked`).

Set `TEXT_MODE=true` if `--text` is present in $ARGUMENTS OR `text_mode` from init JSON is `true`. When `TEXT_MODE` is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for Claude Code remote sessions (`/rc` mode) where TUI menus don't work through the Claude App.

Extract `--prd <filepath>` from $ARGUMENTS. If present, set PRD_FILE to the filepath.

**If no phase number:** Detect next unplanned phase from roadmap.

**If `phase_found` is false:** Validate phase exists in ROADMAP.md. If valid, create the directory using `phase_slug` and `padded_phase` from init:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Existing artifacts from init:** `has_research`, `has_plans`, `plan_count`.

Set `CHUNKED_MODE` from flag or config:
```bash
CHUNKED_CFG=$(gsd-sdk query config-get workflow.plan_chunked 2>/dev/null || echo "false")
CHUNKED_MODE=false
if [[ "$ARGUMENTS" =~ --chunked ]] || [[ "$CHUNKED_CFG" == "true" ]]; then
  CHUNKED_MODE=true
fi
```

## 2.5. Validate `--reviews` Prerequisite

**Skip if:** No `--reviews` flag.

**If `--reviews` AND `--gaps`:** Error — cannot combine `--reviews` with `--gaps`. These are conflicting modes.

**If `--reviews` AND `has_reviews` is false (no REVIEWS.md in phase dir):**

Error:
```
No REVIEWS.md found for Phase {N}. Run reviews first:

/gsd-review --phase {N}

Then re-run /gsd-plan-phase {N} --reviews
```
Exit workflow.

## 3. Validate Phase

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases. **If `found` is true:** Extract `phase_number`, `phase_name`, `goal` from JSON.

## 3.5. Handle PRD Express Path

**Skip if:** No `--prd` flag in arguments.

**If `--prd <filepath>` provided:**

1. Read the PRD file:
```bash
PRD_CONTENT=$(cat "$PRD_FILE" 2>/dev/null)
if [ -z "$PRD_CONTENT" ]; then
  echo "Error: PRD file not found: $PRD_FILE"
  exit 1
fi
```

2. Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PRD EXPRESS PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using PRD: {PRD_FILE}
Generating CONTEXT.md from requirements...
```

3. Parse the PRD content and generate CONTEXT.md. The orchestrator should:
   - Extract all requirements, user stories, acceptance criteria, and constraints from the PRD
   - Map each to a locked decision (everything in the PRD is treated as a locked decision)
   - Identify any areas the PRD doesn't cover and mark as "Claude's Discretion"
   - **Extract canonical refs** from ROADMAP.md for this phase, plus any specs/ADRs referenced in the PRD — expand to full file paths (MANDATORY)
   - Create CONTEXT.md in the phase directory

4. Write CONTEXT.md:
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** PRD Express Path ({PRD_FILE})

<domain>
## Phase Boundary

[Extracted from PRD — what this phase delivers]

</domain>

<decisions>
## Implementation Decisions

{For each requirement/story/criterion in the PRD:}
### [Category derived from content]
- [Requirement as locked decision]

### Claude's Discretion
[Areas not covered by PRD — implementation details, technical choices]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY. Extract from ROADMAP.md and any docs referenced in the PRD.
Use full relative paths. Group by topic area.]

### [Topic area]
- `path/to/spec-or-adr.md` — [What it decides/defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<specifics>
## Specific Ideas

[Any specific references, examples, or concrete requirements from PRD]

</specifics>

<deferred>
## Deferred Ideas

[Items in PRD explicitly marked as future/v2/out-of-scope]
[If none: "None — PRD covers phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date] via PRD Express Path*
```

5. Commit:
```bash
gsd-sdk query commit "docs(${padded_phase}): generate context from PRD" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

6. Set `context_content` to the generated CONTEXT.md content and continue to step 5 (Handle Research).

**Effect:** This completely bypasses step 4 (Load CONTEXT.md) since we just created it. The rest of the workflow (research, planning, verification) proceeds normally with the PRD-derived context.

## 4. Load CONTEXT.md

**Skip if:** PRD express path was used (CONTEXT.md already created in step 3.5).

Check `context_path` from init JSON.

If `context_path` is not null, display: `Using phase context from: ${context_path}`

**If `context_path` is null (no CONTEXT.md exists):**

Read discuss mode for context gate label:
```bash
DISCUSS_MODE=$(gsd-sdk query config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

If `TEXT_MODE` is true, present as a plain-text numbered list:
```
No CONTEXT.md found for Phase {X}. Plans will use research and requirements only — your design preferences won't be included.

1. Continue without context — Plan using research + requirements only
[If DISCUSS_MODE is "assumptions":]
2. Gather context (assumptions mode) — Analyze codebase and surface assumptions before planning
[If DISCUSS_MODE is "discuss" or unset:]
2. Run discuss-phase first — Capture design decisions before planning

Enter number:
```

Otherwise use AskUserQuestion:
- header: "No context"
- question: "No CONTEXT.md found for Phase {X}. Plans will use research and requirements only — your design preferences won't be included. Continue or capture context first?"
- options:
  - "Continue without context" — Plan using research + requirements only
  If `DISCUSS_MODE` is `"assumptions"`:
  - "Gather context (assumptions mode)" — Analyze codebase and surface assumptions before planning
  If `DISCUSS_MODE` is `"discuss"` (or unset):
  - "Run discuss-phase first" — Capture design decisions before planning

If "Continue without context": Proceed to step 5.
If "Run discuss-phase first":
  **IMPORTANT:** Do NOT invoke discuss-phase as a nested Skill/Task call — AskUserQuestion
  does not work correctly in nested subcontexts (#1009). Instead, display the command
  and exit so the user runs it as a top-level command:
  ```
  Run this command first, then re-run /gsd-plan-phase {X} ${GSD_WS}:

  /gsd-discuss-phase {X} ${GSD_WS}
  ```
  **Exit the plan-phase workflow. Do not continue.**

## 4.5. Check AI-SPEC

**Skip if:** `ai_integration_phase_enabled` from config is false, or `--skip-ai-spec` flag provided.

```bash
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
AI_PHASE_CFG=$(gsd-sdk query config-get workflow.ai_integration_phase 2>/dev/null || echo "true")
```

**Skip if `AI_PHASE_CFG` is `false`.**

**If `AI_SPEC_FILE` is empty:** Check phase goal for AI keywords:
```bash
echo "${phase_goal}" | grep -qi "agent\|llm\|rag\|chatbot\|embedding\|langchain\|llamaindex\|crewai\|langgraph\|openai\|anthropic\|vector\|eval\|ai system"
```

**If AI keywords detected AND no AI-SPEC.md:**
```
◆ Note: This phase appears to involve AI system development.
  Consider running /gsd-ai-integration-phase {N} before planning to:
  - Select the right framework for your use case
  - Research its docs and best practices
  - Design an evaluation strategy

  Continue planning without AI-SPEC? (non-blocking — /gsd-ai-integration-phase can be run after)
```

Use AskUserQuestion with options:
- "Continue — plan without AI-SPEC"
- "Stop — I'll run /gsd-ai-integration-phase {N} first"

If "Stop": Exit with `/gsd-ai-integration-phase {N}` reminder.
If "Continue": Proceed. (Non-blocking — planner will note AI-SPEC is absent.)

**If `AI_SPEC_FILE` is non-empty:** Extract framework for planner context:
```bash
FRAMEWORK_LINE=$(grep "Selected Framework:" "${AI_SPEC_FILE}" | head -1)
```
Pass `ai_spec_path` and `framework_line` to planner in step 7 so it can reference the AI design contract.

## 5. Handle Research

**Skip if:** `--gaps` flag or `--skip-research` flag or `--reviews` flag.

**If `has_research` is true (from init) AND no `--research` flag:** Use existing, skip to step 6.

**If RESEARCH.md missing OR `--research` flag:**

**If no explicit flag (`--research` or `--skip-research`) and not `--auto`:**
Ask the user whether to research, with a contextual recommendation based on the phase:

If `TEXT_MODE` is true, present as a plain-text numbered list:
```
Research before planning Phase {X}: {phase_name}?

1. Research first (Recommended) — Investigate domain, patterns, and dependencies before planning. Best for new features, unfamiliar integrations, or architectural changes.
2. Skip research — Plan directly from context and requirements. Best for bug fixes, simple refactors, or well-understood tasks.

Enter number:
```

Otherwise use AskUserQuestion:
```
AskUserQuestion([
  {
    question: "Research before planning Phase {X}: {phase_name}?",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Research first (Recommended)", description: "Investigate domain, patterns, and dependencies before planning. Best for new features, unfamiliar integrations, or architectural changes." },
      { label: "Skip research", description: "Plan directly from context and requirements. Best for bug fixes, simple refactors, or well-understood tasks." }
    ]
  }
])
```

If user selects "Skip research": skip to step 6.

**If `--auto` and `research_enabled` is false:** Skip research silently (preserves automated behavior).

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning researcher...
```

### Spawn gsd-phase-researcher

```bash
PHASE_DESC=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick section)
```

Research prompt:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}
Answer: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
**Phase description:** {phase_description}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, research should account for project skill patterns
</additional_context>

<output>
Write to: {phase_dir}/{phase_num}-RESEARCH.md
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

### Handle Researcher Return

- **`## RESEARCH COMPLETE`:** Display confirmation, continue to step 6
- **`## RESEARCH BLOCKED`:** Display blocker, offer: 1) Provide context, 2) Skip research, 3) Abort

## 5.5. Create Validation Strategy

Skip if `nyquist_validation_enabled` is false OR `research_enabled` is false.

If `research_enabled` is false and `nyquist_validation_enabled` is true: warn "Nyquist validation enabled but research disabled — VALIDATION.md cannot be created without RESEARCH.md. Plans will lack validation requirements (Dimension 8)." Continue to step 6.

**But Nyquist is not applicable for this run** when all of the following are true:
- `research_enabled` is false
- `has_research` is false
- no `--research` flag was provided

In that case: **skip validation-strategy creation entirely**. Do **not** expect `RESEARCH.md` or `VALIDATION.md` for this run, and continue to Step 6.

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null || true
```

**If found:**
1. Read template: `~/.claude/get-shit-done/templates/VALIDATION.md`
2. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` (use Write tool)
3. Fill frontmatter: `{N}` → phase number, `{phase-slug}` → slug, `{date}` → current date
4. Verify:
```bash
test -f "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" && echo "VALIDATION_CREATED=true" || echo "VALIDATION_CREATED=false"
```
5. If `VALIDATION_CREATED=false`: STOP — do not proceed to Step 6
6. If `commit_docs`: `commit "docs(phase-${PHASE}): add validation strategy"`

**If not found:** Warn and continue — plans may fail Dimension 8.

## 5.55. Security Threat Model Gate

> Skip if `workflow.security_enforcement` is explicitly `false`. Absent = enabled.

```bash
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
SECURITY_ASVS=$(gsd-sdk query config-get workflow.security_asvs_level --raw 2>/dev/null || echo "1")
SECURITY_BLOCK=$(gsd-sdk query config-get workflow.security_block_on --raw 2>/dev/null || echo "high")
```

**If `SECURITY_CFG` is `false`:** Skip to step 5.6.

**If `SECURITY_CFG` is `true`:** Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SECURITY THREAT MODEL REQUIRED (ASVS L{SECURITY_ASVS})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each PLAN.md must include a <threat_model> block.
Block on: {SECURITY_BLOCK} severity threats.
Opt out: set security_enforcement: false in .planning/config.json
```

Continue to step 5.6. Security config is passed to the planner in step 8.

## 5.6. UI Design Contract Gate

> Skip if `workflow.ui_phase` is explicitly `false` AND `workflow.ui_safety_gate` is explicitly `false` in `.planning/config.json`. If keys are absent, treat as enabled.

```bash
UI_PHASE_CFG=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
UI_GATE_CFG=$(gsd-sdk query config-get workflow.ui_safety_gate 2>/dev/null || echo "true")
```

**If both are `false`:** Skip to step 6.

Check if phase has frontend indicators:

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${PHASE}" 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
```

**If `HAS_UI` is 0 (frontend indicators found):**

Check for existing UI-SPEC:
```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**If UI-SPEC.md found:** Set `UI_SPEC_PATH=$UI_SPEC_FILE`. Display: `Using UI design contract: ${UI_SPEC_PATH}`

**If UI-SPEC.md missing AND `--skip-ui` flag is present in $ARGUMENTS:** Skip silently to step 6.

**If UI-SPEC.md missing AND `UI_GATE_CFG` is `true`:**

Read ephemeral chain flag (same field as `check.auto-mode` → `auto_chain_active`):
```bash
AUTO_CHAIN=$(gsd-sdk query check auto-mode --pick auto_chain_active 2>/dev/null || echo "false")
```

**If `AUTO_CHAIN` is `true` (running inside a `--chain` or `--auto` pipeline):**

Auto-generate UI-SPEC without prompting:
```
Skill(skill="gsd-ui-phase", args="${PHASE} --auto ${GSD_WS}")
```
After `gsd-ui-phase` returns, re-read:
```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_SPEC_PATH="${UI_SPEC_FILE}"
```
Continue to step 6.

**If `AUTO_CHAIN` is `false` (manual invocation):**

Output this markdown directly (not as a code block):

```
## ⚠ UI-SPEC.md missing for Phase {N}
▶ Recommended next step:
`/gsd-ui-phase {N} ${GSD_WS}` — generate UI design contract before planning
───────────────────────────────────────────────
Also available:
- `/gsd-plan-phase {N} --skip-ui ${GSD_WS}` — plan without UI-SPEC (not recommended for frontend phases)
```

**Exit the plan-phase workflow. Do not continue.**

**If `HAS_UI` is 1 (no frontend indicators):** Skip silently to step 5.7.

## 5.7. Schema Push Detection Gate

> Detects schema-relevant files in the phase scope and injects a mandatory `[BLOCKING]` schema push task into the plan. Prevents false-positive verification where build/types pass because TypeScript types come from config, not the live database.

Check if any files in the phase scope match schema patterns:

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick section 2>/dev/null)
```

Scan `PHASE_SECTION`, `CONTEXT.md` (if loaded), and `RESEARCH.md` (if exists) for file paths matching these ORM patterns:

| ORM | File Patterns |
|-----|--------------|
| Payload CMS | `src/collections/**/*.ts`, `src/globals/**/*.ts` |
| Prisma | `prisma/schema.prisma`, `prisma/schema/*.prisma` |
| Drizzle | `drizzle/schema.ts`, `src/db/schema.ts`, `drizzle/*.ts` |
| Supabase | `supabase/migrations/*.sql` |
| TypeORM | `src/entities/**/*.ts`, `src/migrations/**/*.ts` |

Also check if any existing PLAN.md files for this phase already reference these file patterns in `files_modified`.

**If schema-relevant files detected:**

Set `SCHEMA_PUSH_REQUIRED=true` and `SCHEMA_ORM={detected_orm}`.

Determine the push command for the detected ORM:

| ORM | Push Command | Non-TTY Workaround |
|-----|-------------|-------------------|
| Payload CMS | `npx payload migrate` | `CI=true PAYLOAD_MIGRATING=true npx payload migrate` |
| Prisma | `npx prisma db push` | `npx prisma db push --accept-data-loss` (if destructive) |
| Drizzle | `npx drizzle-kit push` | `npx drizzle-kit push` |
| Supabase | `supabase db push` | Set `SUPABASE_ACCESS_TOKEN` env var |
| TypeORM | `npx typeorm migration:run` | `npx typeorm migration:run -d src/data-source.ts` |

Inject the following into the planner prompt (step 8) as an additional constraint:

```markdown
<schema_push_requirement>
**[BLOCKING] Schema Push Required**

This phase modifies schema-relevant files ({detected_files}). The planner MUST include
a `[BLOCKING]` task that runs the database schema push command AFTER all schema file
modifications are complete but BEFORE verification.

- ORM detected: {SCHEMA_ORM}
- Push command: {push_command}
- Non-TTY workaround: {env_hint}
- If push requires interactive prompts that cannot be suppressed, flag the task for
  manual intervention with `autonomous: false`

This task is mandatory — the phase CANNOT pass verification without it. Build and
type checks will pass without the push (types come from config, not the live database),
creating a false-positive verification state.
</schema_push_requirement>
```

Display: `Schema files detected ({SCHEMA_ORM}) — [BLOCKING] push task will be injected into plans`

**If no schema-relevant files detected:** Skip silently to step 6.

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null || true
```

**If exists AND `--reviews` flag:** Skip prompt — go straight to replanning (the purpose of `--reviews` is to replan with review feedback).

**If exists AND no `--reviews` flag:** Offer: 1) Add more plans, 2) View existing, 3) Replan from scratch.

## 7. Use Context Paths from INIT

Extract from INIT JSON:

```bash
_gsd_field() { node -e "const o=JSON.parse(process.argv[1]); const v=o[process.argv[2]]; process.stdout.write(v==null?'':String(v))" "$1" "$2"; }
STATE_PATH=$(_gsd_field "$INIT" state_path)
ROADMAP_PATH=$(_gsd_field "$INIT" roadmap_path)
REQUIREMENTS_PATH=$(_gsd_field "$INIT" requirements_path)
RESEARCH_PATH=$(_gsd_field "$INIT" research_path)
VERIFICATION_PATH=$(_gsd_field "$INIT" verification_path)
UAT_PATH=$(_gsd_field "$INIT" uat_path)
CONTEXT_PATH=$(_gsd_field "$INIT" context_path)
REVIEWS_PATH=$(_gsd_field "$INIT" reviews_path)
PATTERNS_PATH=$(_gsd_field "$INIT" patterns_path)

# Detect spike/sketch findings skills (project-local)
SPIKE_FINDINGS_PATH=$(ls ./.claude/skills/spike-findings-*/SKILL.md 2>/dev/null | head -1)
SKETCH_FINDINGS_PATH=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)
```

## 7.5. Verify Nyquist Artifacts

Skip if `nyquist_validation_enabled` is false OR `research_enabled` is false.

Also skip if all of the following are true:
- `research_enabled` is false
- `has_research` is false
- no `--research` flag was provided

In that no-research path, Nyquist artifacts are **not required** for this run.

```bash
VALIDATION_EXISTS=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
```

If missing and Nyquist is still enabled/applicable — ask user:
1. Re-run: `/gsd-plan-phase {PHASE} --research ${GSD_WS}`
2. Disable Nyquist with the exact command:
   `gsd-sdk query config-set workflow.nyquist_validation false`
3. Continue anyway (plans fail Dimension 8)

Proceed to Step 7.8 (or Step 8 if pattern mapper is disabled) only if user selects 2 or 3.

## 7.8. Spawn gsd-pattern-mapper Agent (Optional)

**Skip if** `workflow.pattern_mapper` is explicitly set to `false` in config.json (absent key = enabled). Also skip if no CONTEXT.md and no RESEARCH.md exist for this phase (nothing to extract file lists from).

Check config:
```bash
PATTERN_MAPPER_CFG=$(gsd-sdk query config-get workflow.pattern_mapper 2>/dev/null || echo "true")
```

**If `PATTERN_MAPPER_CFG` is `false`:** Skip to step 8.

**If PATTERNS.md already exists** (`PATTERNS_PATH` is non-empty from step 7): Skip to step 8 (use existing).

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PATTERN MAPPING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning pattern mapper...
```

Pattern mapper prompt:

```markdown
<pattern_mapping_context>
**Phase:** {phase_number} - {phase_name}
**Phase directory:** {phase_dir}
**Padded phase:** {padded_phase}

<files_to_read>
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
- {research_path} (Technical Research)
</files_to_read>

**Output file:** {phase_dir}/{padded_phase}-PATTERNS.md

Extract the list of files to be created/modified from CONTEXT.md and RESEARCH.md. For each file, classify by role and data flow, find the closest existing analog in the codebase, extract concrete code excerpts, and produce PATTERNS.md.
</pattern_mapping_context>
```

Spawn with:
```
Task(
  prompt="{above}",
  subagent_type="gsd-pattern-mapper",
  model="{researcher_model}",
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

**Handle return:**
- **`## PATTERN MAPPING COMPLETE`:** Update `PATTERNS_PATH` to the created file path, continue to step 8.
- **Any error or empty return:** Log warning, continue to step 8 without patterns (non-blocking).

After pattern mapper completes, update the path variable:
```bash
PATTERNS_PATH="${PHASE_DIR}/${PADDED_PHASE}-PATTERNS.md"
```

## 8. Spawn gsd-planner Agent

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner...
```

Planner prompt:

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** {standard | gap_closure | reviews}

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
- {research_path} (Technical Research)
- {PATTERNS_PATH} (Pattern Map — analog files and code excerpts, if exists)
- {verification_path} (Verification Gaps - if --gaps)
- {uat_path} (UAT Gaps - if --gaps)
- {reviews_path} (Cross-AI Review Feedback - if --reviews)
- {UI_SPEC_PATH} (UI Design Contract — visual/interaction specs, if exists)
- {SPIKE_FINDINGS_PATH} (Spike Findings — validated patterns, constraints, landmines from experiments, if exists)
- {SKETCH_FINDINGS_PATH} (Sketch Findings — validated design decisions, CSS patterns, visual direction, if exists)
${CONTEXT_WINDOW >= 500000 ? `
**Cross-phase context (1M model enrichment):**
- CONTEXT.md files from the 3 most recent completed phases (locked decisions — maintain consistency)
- SUMMARY.md files from the 3 most recent completed phases (what was built — reuse patterns, avoid duplication)
- LEARNINGS.md files from the 3 most recent completed phases (structured decisions, patterns, lessons, surprises — skip silently if a phase has no LEARNINGS.md; prefix each block with \`[from Phase N LEARNINGS]\` for source attribution; if total size exceeds 15% of context budget, drop oldest first)
- CONTEXT.md, SUMMARY.md, and LEARNINGS.md from any phases listed in the current phase's "Depends on:" field in ROADMAP.md (regardless of recency — explicit dependencies always load, deduplicated against the 3 most recent)
- Skip all other prior phases to stay within context budget
` : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — read SKILL.md files, plans should account for project skill rules

${TDD_MODE === 'true' ? `
<tdd_mode_active>
**TDD Mode is ENABLED.** Apply TDD heuristics from @~/.claude/get-shit-done/references/tdd.md to all eligible tasks:
- Business logic with defined I/O → type: tdd
- API endpoints with request/response contracts → type: tdd
- Data transformations, validation, algorithms → type: tdd
- UI, config, glue code, CRUD → standard plan (type: execute)
Each TDD plan gets one feature with RED/GREEN/REFACTOR gate sequence.
</tdd_mode_active>
` : ''}
</planning_context>

<downstream_consumer>
Output consumed by /gsd-execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format with read_first and acceptance_criteria fields (MANDATORY on every task)
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<deep_work_rules>
## Anti-Shallow Execution Rules (MANDATORY)

Every task MUST include these fields — they are NOT optional:

1. **`<read_first>`** — Files the executor MUST read before touching anything. Always include:
   - The file being modified (so executor sees current state, not assumptions)
   - Any "source of truth" file referenced in CONTEXT.md (reference implementations, existing patterns, config files, schemas)
   - Any file whose patterns, signatures, types, or conventions must be replicated or respected

2. **`<acceptance_criteria>`** — Verifiable conditions that prove the task was done correctly. Rules:
   - Every criterion must be checkable with grep, file read, test command, or CLI output
   - NEVER use subjective language ("looks correct", "properly configured", "consistent with")
   - ALWAYS include exact strings, patterns, values, or command outputs that must be present
   - Examples:
     - Code: `auth.py contains def verify_token(` / `test_auth.py exits 0`
     - Config: `.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - Docs: `README.md contains '## Installation'` / `API.md lists all endpoints`
     - Infra: `deploy.yml has rollback step` / `docker-compose.yml has healthcheck for db`

3. **`<action>`** — Must include CONCRETE values, not references. Rules:
   - NEVER say "align X with Y", "match X to Y", "update to be consistent" without specifying the exact target state
   - ALWAYS include the actual values: config keys, function signatures, SQL statements, class names, import paths, env vars, etc.
   - If CONTEXT.md has a comparison table or expected values, copy them into the action verbatim
   - The executor should be able to complete the task from the action text alone, without needing to read CONTEXT.md or reference files (read_first is for verification, not discovery)

**Why this matters:** Executor agents work from the plan text. Vague instructions like "update the config to match production" produce shallow one-line changes. Concrete instructions like "add DATABASE_URL=postgresql://... , set POOL_SIZE=20, add REDIS_URL=redis://..." produce complete work. The cost of verbose plans is far less than the cost of re-doing shallow execution.
</deep_work_rules>

<quality_gate>
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Every task has `<read_first>` with at least the file being modified
- [ ] Every task has `<acceptance_criteria>` with grep-verifiable conditions
- [ ] Every `<action>` contains concrete values (no "align X with Y" without specifying what)
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

**If `CHUNKED_MODE` is `false` (default):** Spawn the planner as a single long-lived Task:

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

**If `CHUNKED_MODE` is `true`:** Skip the Task() call above — proceed to step 8.5 instead.

## 8.5. Chunked Planning Mode

**Skip if `CHUNKED_MODE` is `false`.**

Chunked mode splits the single long-lived planner Task into a short outline Task followed by
N short per-plan Tasks. Each Task is bounded to ~3–5 min; each plan is committed individually
for crash resilience. If any Task hangs and the terminal is force-killed, rerunning
`/gsd-plan-phase {N} --chunked` resumes from the last successfully committed plan.

**Intended for new or in-progress chunked runs.** To recover plans already written by a prior
*non-chunked* run, use step 6's "Add more plans" or proceed directly to `/gsd-execute-phase`
— don't start a fresh chunked run over existing non-chunked plans.

### 8.5.1 Outline Phase (outline-only mode, ~2 min)

**Resume detection:** If `${PHASE_DIR}/${PADDED_PHASE}-PLAN-OUTLINE.md` already exists **and
is valid** (contains the `## OUTLINE COMPLETE` marker), skip this sub-step — the outline
already exists from a previous run. Proceed directly to 8.5.2.

```bash
OUTLINE_FILE="${PHASE_DIR}/${PADDED_PHASE}-PLAN-OUTLINE.md"
if [[ -f "$OUTLINE_FILE" ]] && grep -q "^## OUTLINE COMPLETE" "$OUTLINE_FILE"; then
  # reuse existing outline — skip to 8.5.2
fi
```

Display:
```text
◆ Chunked mode: spawning outline planner...
```

Spawn the planner in **outline-only** mode — it must write only the outline manifest, not any
PLAN.md files:

```javascript
Task(
  prompt="{same planning_context as step 8, plus:}

  **Chunked mode: outline-only.**
  Do NOT write any PLAN.md files in this Task.
  Write only: {PHASE_DIR}/{PADDED_PHASE}-PLAN-OUTLINE.md

  The outline must be a markdown table with columns:
  Plan ID | Objective | Wave | Depends On | Requirements

  Return: ## OUTLINE COMPLETE with plan count.",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Outline Phase {phase} (chunked)"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

Handle return:
- **`## OUTLINE COMPLETE`:** Read `PLAN-OUTLINE.md`, extract plan list. Continue to 8.5.2.
- **Any other return or empty:** Display error. Offer: 1) Retry outline, 2) Stop.

### 8.5.2 Per-Plan Tasks (single-plan mode, ~3-5 min each)

For each plan entry extracted from `PLAN-OUTLINE.md`:

1. **Resume check:** If `${PHASE_DIR}/{plan_id}-PLAN.md` already exists on disk **and has
   valid YAML frontmatter** (opening `---` delimiter present), skip this plan (do not
   overwrite completed work — resume safety).

   ```bash
   PLAN_FILE="${PHASE_DIR}/${plan_id}-PLAN.md"
   if [[ -f "$PLAN_FILE" ]] && head -1 "$PLAN_FILE" | grep -q '^---'; then
     continue  # plan already written, skip
   fi
   ```

2. Display:
   ```text
   ◆ Chunked mode: planning {plan_id} ({k}/{N})...
   ```

3. Spawn the planner in **single-plan** mode — it must write exactly one PLAN.md file:
   ```javascript
   Task(
     prompt="{same planning_context as step 8, plus:}

     **Chunked mode: single-plan.**
     Write exactly ONE plan file: {PHASE_DIR}/{plan_id}-PLAN.md
     Plan to write: {plan_id} — {objective}
     Wave: {wave} | Depends on: {depends_on}
     Phase requirement IDs to cover in this plan: {plan_requirements}

     Return: ## PLAN COMPLETE with the plan ID.",
     subagent_type="gsd-planner",
     model="{planner_model}",
     description="Plan {plan_id} (chunked {k}/{N})"
   )
   ```

   > **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

4. **Verify disk:** Check `${PHASE_DIR}/{plan_id}-PLAN.md` exists. If missing: offer 1) Retry, 2) Stop.

5. **Commit per-plan:**
   ```bash
   gsd-sdk query commit "docs(${PADDED_PHASE}): plan ${plan_id} (chunked)" --files "${PHASE_DIR}/${plan_id}-PLAN.md"
   ```

After all N plans are written and committed, treat this as `## PLANNING COMPLETE` and continue
to step 9.

## 9. Handle Planner Return

- **`## PLANNING COMPLETE`:** Display plan count. If `--skip-verify` or `plan_checker_enabled` is false (from init): skip to step 13. Otherwise: step 10.
- **`## PHASE SPLIT RECOMMENDED`:** The planner determined the phase exceeds the context budget for full-fidelity implementation of all source items. Handle in step 9b.
- **`## ⚠ Source Audit: Unplanned Items Found`:** The planner's multi-source coverage audit found items from REQUIREMENTS.md, RESEARCH.md, ROADMAP goal, or CONTEXT.md decisions that are not covered by any plan. Handle in step 9c.
- **`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation (step 12)
- **`## PLANNING INCONCLUSIVE`:** Show attempts, offer: Add context / Retry / Manual
- **Empty / truncated / no recognized marker:** → Filesystem fallback (step 9a).

## 9a. Filesystem Fallback (Planner)

**Triggered when:** Task() returns but the return contains no recognized marker (`## PLANNING COMPLETE`, `## PHASE SPLIT RECOMMENDED`, `## ⚠ Source Audit`, `## CHECKPOINT REACHED`, `## PLANNING INCONCLUSIVE`).

```bash
DISK_PLANS=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**If `DISK_PLANS` > 0:** The planner wrote plans to disk but the Task() return was empty or
truncated (the Windows stdio hang pattern — the subagent finished but the return never
arrived). Display:

```text
◆ Planner wrote {DISK_PLANS} plan(s) to disk but did not emit a PLANNING COMPLETE marker.
  This is a known Windows stdio hang pattern — work is likely recoverable.

  Plans found on disk:
  {ls output of *-PLAN.md}
```

Offer 3 options:
1. **Accept plans** — treat as `## PLANNING COMPLETE` and continue through step 9 `## PLANNING COMPLETE` handling (so `--skip-verify` / `plan_checker_enabled=false` are honored — may skip to step 13 rather than step 10)
2. **Retry planner** — re-spawn the planner with the same prompt (return to step 8)
3. **Stop** — exit; user can re-run `/gsd-plan-phase {N}` to resume

**If `DISK_PLANS` is 0 and no marker:** The planner produced no output. Treat as
`## PLANNING INCONCLUSIVE` and handle accordingly.

## 9b. Handle Phase Split Recommendation

When the planner returns `## PHASE SPLIT RECOMMENDED`, it means the phase's source items exceed the context budget for full-fidelity implementation. The planner proposes groupings.

**Extract from planner return:**
- Proposed sub-phases (e.g., "17a: processing core (D-01 to D-19)", "17b: billing + config UX (D-20 to D-27)")
- Which source items (REQ-IDs, D-XX decisions, RESEARCH items) go in each sub-phase
- Why the split is necessary (context cost estimate, file count)

**Present to user:**
```
## Phase {X} exceeds context budget for full-fidelity implementation

The planner found {N} source items that exceed the context budget when
planned at full fidelity. Instead of reducing scope, we recommend splitting:

**Option 1: Split into sub-phases**
- Phase {X}a: {name} — {items} ({N} source items, ~{P}% context)
- Phase {X}b: {name} — {items} ({M} source items, ~{Q}% context)

**Option 2: Proceed anyway** (planner will attempt all, quality may degrade past 50% context)

**Option 3: Prioritize** — you choose which items to implement now,
rest become a follow-up phase
```

Use AskUserQuestion with these 3 options.

**If "Split":** Use `/gsd-insert-phase` to create the sub-phases, then replan each.
**If "Proceed":** Return to planner with instruction to attempt all items at full fidelity, accepting more plans/tasks.
**If "Prioritize":** Use AskUserQuestion (multiSelect) to let user pick which items are "now" vs "later". Create CONTEXT.md for each sub-phase with the selected items.

## 9c. Handle Source Audit Gaps

When the planner returns `## ⚠ Source Audit: Unplanned Items Found`, it means items from REQUIREMENTS.md, RESEARCH.md, ROADMAP goal, or CONTEXT.md decisions have no corresponding plan.

**Extract from planner return:**
- Each unplanned item with its source artifact and section
- The planner's suggested options (A: add plan, B: split phase, C: defer with confirmation)

**Present each gap to user.** For each unplanned item:

```
## ⚠ Unplanned: {item description}

Source: {RESEARCH.md / REQUIREMENTS.md / ROADMAP goal / CONTEXT.md}
Details: {why the planner flagged this}

Options:
1. Add a plan to cover this item (recommended)
2. Split phase — move to a sub-phase with related items
3. Defer — add to backlog (developer confirms this is intentional)
```

Use AskUserQuestion for each gap (or batch if multiple gaps).

**If "Add plan":** Return to planner (step 8) with instruction to add plans covering the missing items, preserving existing plans.
**If "Split":** Use `/gsd-insert-phase` for overflow items, then replan.
**If "Defer":** Record in CONTEXT.md `## Deferred Ideas` with developer's confirmation. Proceed to step 10.

## 10. Spawn gsd-plan-checker Agent

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Checker prompt:

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Plans to verify)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
- {research_path} (Technical Research — includes Validation Architecture)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — verify plans honor project guidelines
**Project skills:** Check .claude/skills/ or .agents/skills/ directory (if either exists) — verify plans account for project skill rules
</verification_context>

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
  description="Verify Phase {phase} plans"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

## 11. Handle Checker Return

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 13.
- **`## ISSUES FOUND`:** Display issues, check iteration count, proceed to step 12.
- **Empty / truncated / no recognized marker:** → Filesystem fallback (step 11a).

**Thinking partner for architectural tradeoffs (conditional):**
If `features.thinking_partner` is enabled, scan the checker's issues for architectural tradeoff keywords
("architecture", "approach", "strategy", "pattern", "vs", "alternative"). If found:

```
The plan-checker flagged an architectural decision point:
{issue description}

Brief analysis:
- Option A: {approach_from_plan} — {pros/cons}
- Option B: {alternative_approach} — {pros/cons}
- Recommendation: {choice} aligned with {phase_goal}

Apply this to the revision? [Yes] / [No, I'll decide]
```

If yes: include the recommendation in the revision prompt. If no: proceed to revision loop as normal.
If thinking_partner disabled: skip this block entirely.

## 11a. Filesystem Fallback (Checker)

**Triggered when:** Checker Task() returns but the return contains neither `## VERIFICATION PASSED` nor `## ISSUES FOUND`.

```bash
DISK_PLANS=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**If `DISK_PLANS` > 0:** Plans exist on disk; the checker return was empty or truncated (the
Windows stdio hang pattern — the subagent finished but the return never arrived). Display:

```text
◆ Checker return was empty or truncated. {DISK_PLANS} plan(s) exist on disk.
  This is a known Windows stdio hang pattern — checker may have completed without returning.
```

Offer 3 options:
1. **Accept verification** — treat as `## VERIFICATION PASSED` and continue to step 13
2. **Retry checker** — re-spawn the checker with the same prompt (return to step 10)
3. **Stop** — exit; user can re-run `/gsd-plan-phase {N}` to resume

**If `DISK_PLANS` is 0:** No plans on disk — something is seriously wrong. Display error and stop.

## 12. Revision Loop (Max 3 Iterations)

Track `iteration_count` (starts at 1 after initial plan + check).
Track `prev_issue_count` (initialized to `Infinity` before the loop begins).
Track `stall_reentry_count` (starts at 0; incremented each time "Adjust approach" re-enters step 8).

**If iteration_count < 3:**

Parse issue count from checker return: count BLOCKER + WARNING entries in the YAML issues block (structured output from gsd-plan-checker). If the checker's return contains no YAML issues block (i.e., the plan was approved with no issues), treat `issue_count` as 0 and skip the stall check — the plan passed. Proceed to step 13.

Display: `Revision iteration {N}/3 -- {blocker_count} blockers, {warning_count} warnings`

**Stall detection:** If `issue_count >= prev_issue_count`:
  Display: `Revision loop stalled — issue count not decreasing ({issue_count} issues remain after {N} iterations)`

  **If `stall_reentry_count < 2`:**
    Ask user:
      Question: "Issues remain after {N} revision attempts with no progress. Proceed with current output?"
      Options: "Proceed anyway" | "Adjust approach"
    If "Proceed anyway": accept current plans and continue to step 13.
    If "Adjust approach": increment `stall_reentry_count`, open freeform discussion, then re-enter step 8 (full replanning). Note: re-entry resets `iteration_count` and `prev_issue_count` but `stall_reentry_count` persists across re-entries and is capped at 2.

  **If `stall_reentry_count >= 2`:**
    Display: `Stall persists after 2 re-planning attempts. The following issues could not be resolved automatically:`
    List the remaining issues from the checker.
    Suggest: "Consider resolving these issues manually or running `/gsd-debug` to investigate root causes."
    Options: "Proceed anyway" | "Abandon"
    If "Proceed anyway": accept current plans and continue to step 13.
    If "Abandon": stop workflow.

Set `prev_issue_count = issue_count`.

Revision prompt:

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Existing plans)
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** {structured_issues_from_checker}
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
  description="Revise Phase {phase} plans"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

After planner returns -> spawn checker again (step 10), increment iteration_count.

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Provide guidance and retry, 3) Abandon

## 12.5. Plan Bounce (Optional External Refinement)

**Skip if:** `--skip-bounce` flag, `--gaps` flag, or bounce is not activated.

**Activation:** Bounce runs when `--bounce` flag is present OR `workflow.plan_bounce` config is `true`. The `--skip-bounce` flag always wins (disables bounce even if config enables it). The `--gaps` flag also disables bounce (gap-closure mode should not modify plans externally).

**Prerequisites:** `workflow.plan_bounce_script` must be set to a valid script path. If bounce is activated but no script is configured, display warning and skip:
```
⚠ Plan bounce activated but no script configured.
Set workflow.plan_bounce_script to the path of your refinement script.
Skipping bounce step.
```

**Read pass count:**
```bash
BOUNCE_PASSES=$(gsd-sdk query config-get workflow.plan_bounce_passes 2>/dev/null || echo "2")
BOUNCE_SCRIPT=$(gsd-sdk query config-get workflow.plan_bounce_script 2>/dev/null | jq -r '.' 2>/dev/null || true)
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► BOUNCING PLANS (External Refinement)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Script: ${BOUNCE_SCRIPT}
Max passes: ${BOUNCE_PASSES}
```

**For each PLAN.md file in the phase directory:**

1. **Backup:** Copy `*-PLAN.md` to `*-PLAN.pre-bounce.md`
```bash
cp "${PLAN_FILE}" "${PLAN_FILE%.md}.pre-bounce.md"
```

2. **Invoke bounce script:**
```bash
"${BOUNCE_SCRIPT}" "${PLAN_FILE}" "${BOUNCE_PASSES}"
```

3. **Validate bounced plan — YAML frontmatter integrity:**
After the script returns, check that the bounced file still has valid YAML frontmatter (opening and closing `---` delimiters with parseable content between them). If the bounced plan breaks YAML frontmatter validation, restore the original from the pre-bounce.md backup and continue to the next plan:
```
⚠ Bounced plan ${PLAN_FILE} has broken YAML frontmatter — restoring original from pre-bounce backup.
```

4. **Handle script failure:** If the bounce script exits non-zero, restore the original plan from the pre-bounce.md backup and continue to the next plan:
```
⚠ Bounce script failed for ${PLAN_FILE} (exit code ${EXIT_CODE}) — restoring original from pre-bounce backup.
```

**After all plans are bounced:**

5. **Re-run plan checker on bounced plans:** Spawn gsd-plan-checker (same as step 10) on all modified plans. If a bounced plan fails the checker, restore original from its pre-bounce.md backup:
```
⚠ Bounced plan ${PLAN_FILE} failed checker validation — restoring original from pre-bounce backup.
```

6. **Commit surviving bounced plans:** If at least one plan survived both the frontmatter validation and the checker re-run, commit the changes:
```bash
gsd-sdk query commit "refactor(${padded_phase}): bounce plans through external refinement" --files "${PHASE_DIR}/*-PLAN.md"
```

Display summary:
```
Plan bounce complete: {survived}/{total} plans refined
```

**Clean up:** Remove all `*-PLAN.pre-bounce.md` backup files after the bounce step completes (whether plans survived or were restored).

## 13. Requirements Coverage Gate

After plans pass the checker (or checker is skipped), verify that all phase requirements are covered by at least one plan.

**Skip if:** `phase_req_ids` is null or TBD (no requirements mapped to this phase).

**Step 1: Extract requirement IDs claimed by plans**
```bash
# Collect all requirement IDs from plan frontmatter
PLAN_REQS=$(grep -h "requirements_addressed\|requirements:" ${PHASE_DIR}/*-PLAN.md 2>/dev/null | tr -d '[]' | tr ',' '\n' | sed 's/^[[:space:]]*//' | sort -u)
```

**Step 2: Compare against phase requirements from ROADMAP**

For each REQ-ID in `phase_req_ids`:
- If REQ-ID appears in `PLAN_REQS` → covered ✓
- If REQ-ID does NOT appear in any plan → uncovered ✗

**Step 3: Check CONTEXT.md features against plan objectives**

Read CONTEXT.md `<decisions>` section. Extract feature/capability names. Check each against plan `<objective>` blocks. Features not mentioned in any plan objective → potentially dropped.

**Step 4: Report**

If all requirements covered and no dropped features:
```
✓ Requirements coverage: {N}/{N} REQ-IDs covered by plans
```
→ Proceed to step 14.

If gaps found:
```
## ⚠ Requirements Coverage Gap

{M} of {N} phase requirements are not assigned to any plan:

| REQ-ID | Description | Plans |
|--------|-------------|-------|
| {id} | {from REQUIREMENTS.md} | None |

{K} CONTEXT.md features not found in plan objectives:
- {feature_name} — described in CONTEXT.md but no plan covers it

Options:
1. Re-plan to include missing requirements (recommended)
2. Move uncovered requirements to next phase
3. Proceed anyway — accept coverage gaps
```

If `TEXT_MODE` is true, present as a plain-text numbered list (options already shown in the block above). Otherwise use AskUserQuestion to present the options.

## 13a. Decision Coverage Gate

After the requirements coverage gate passes, verify that every trackable
decision captured by discuss-phase in CONTEXT.md `<decisions>` is referenced
by at least one plan. This is the **translation gate** from issue #2492 —
its job is to refuse to mark a phase planned when a discuss-phase decision
silently dropped on the way into the plans.

**Skip if** `workflow.context_coverage_gate` is explicitly set to `false`
(absent key = enabled). Also skip if no CONTEXT.md exists for this phase
(nothing to translate) or if its `<decisions>` block is empty.

```bash
GATE_CFG=$(gsd-sdk query config-get workflow.context_coverage_gate 2>/dev/null || echo "true")
if [ "$GATE_CFG" != "false" ]; then
  GATE_RESULT=$(gsd-sdk query check.decision-coverage-plan "${PHASE_DIR}" "${CONTEXT_PATH}")
  # BLOCKING: refuse to mark phase planned when a trackable decision is uncovered.
  # `passed: true` covers both real-pass and skipped cases (gate disabled / no CONTEXT.md /
  # no trackable decisions). Verify-phase counterpart deliberately omits this exit-1 — that
  # gate is non-blocking by design (review finding F15).
  echo "$GATE_RESULT" | jq -e '.data.passed == true' >/dev/null || {
    echo "$GATE_RESULT" | jq -r '.data.message'
    exit 1
  }
fi
```

The handler returns JSON:
```json
{
  "passed": true,
  "skipped": false,
  "total":  2,
  "covered": 2,
  "uncovered": [ { "id": "D-01", "text": "...", "category": "..." } ],
  "message": "..."
}
```

**If `passed` is true (or `skipped` is true):** Display
`✓ Decision coverage: {M}/{N} CONTEXT.md decisions covered by plans` (or
`(skipped — gate disabled)` / `(skipped — no decisions)`) and proceed to
step 13b.

**If `passed` is false:** Display the handler's `message` block. It already
names each uncovered decision (`D-NN | category | text`) and tells the user
what to do — cite the id in a relevant plan's `must_haves` / `truths`, or
move the decision under `### Claude's Discretion` / tag it `[informational]`
if it should not be tracked. Then offer:

```text
Options:
1. Re-plan to cover missing decisions (recommended)
2. Edit CONTEXT.md to mark dropped decisions as [informational] / Discretion
3. Proceed anyway — accept the coverage gap
```

If `TEXT_MODE` is true, present as a plain-text numbered list. Otherwise use
AskUserQuestion. Selecting "Proceed anyway" continues to step 13b but
records the override in STATE.md so verify-phase can re-surface it.

**Why this gate blocks:** failing here is cheap. The plans are the contract
between discuss-phase and execute-phase; if a decision isn't visible in any
plan, no executor will implement it. Catching that now beats discovering it
after thousands of dollars of execution.

## 13b. Record Planning Completion in STATE.md

After plans pass all gates, record that planning is complete so STATE.md reflects the new phase status:

```bash
gsd-sdk query state.planned-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```

This updates STATUS to "Ready to execute", sets the correct plan count, and timestamps Last Activity.

## 13c. Annotate ROADMAP with Wave Dependencies and Cross-cutting Constraints

After plans are finalized, annotate the ROADMAP.md plan list for this phase with:
- **Wave dependency notes** — a bold header before each wave group ("Wave 2 *(blocked on Wave 1 completion)*")
- **Cross-cutting constraints** — a "Cross-cutting constraints:" subsection listing `must_haves.truths` entries that appear in 2 or more plans

This step is derived entirely from existing PLAN frontmatter — no extra LLM pass is required.

```bash
gsd-sdk query roadmap.annotate-dependencies "${PHASE_NUMBER}"
```

This operation is idempotent: if wave headers or cross-cutting constraints already exist in the ROADMAP phase section, the command returns without modifying the file. Skip this step if `plan_count` is 0.

## 13d. Commit Plans if commit_docs is true

If `commit_docs` is true (from the init JSON parsed in step 1), commit the generated plan artifacts (including any ROADMAP.md annotations from step 13c):

```bash
gsd-sdk query commit "docs(${PADDED_PHASE}): create phase plan" --files "${PHASE_DIR}"/*-PLAN.md .planning/STATE.md .planning/ROADMAP.md
```

This commits all PLAN.md files for the phase plus the updated STATE.md and ROADMAP.md to version-control the planning artifacts. Skip this step if `commit_docs` is false.

## 13e. Post-Planning Gap Analysis

After all plans are generated, committed, and the Requirements Coverage Gate (§13)
has run, emit a single unified gap report covering both REQUIREMENTS.md and the
CONTEXT.md `<decisions>` section. This is a **proactive, post-hoc report** — it
does not block phase advancement and does not re-plan. It exists so that any
requirement or decision that slipped through the per-plan checks is surfaced in
one place before execution begins.

**Skip if:** `workflow.post_planning_gaps` is `false`. Default is `true`.

```bash
POST_PLANNING_GAPS=$(gsd-sdk query config-get workflow.post_planning_gaps --default true 2>/dev/null || echo true)
if [ "$POST_PLANNING_GAPS" = "true" ]; then
  gsd-tools gap-analysis --phase-dir "${PHASE_DIR}"
fi
```

(`gsd-tools gap-analysis` reads `.planning/REQUIREMENTS.md`, `${PHASE_DIR}/CONTEXT.md`,
and `${PHASE_DIR}/*-PLAN.md`, then prints a markdown table with one row per
REQ-ID and D-ID. Word-boundary matching prevents `REQ-1` from being mistaken for
`REQ-10`.)

**Output format (deterministic; sorted REQUIREMENTS.md → CONTEXT.md, then natural
sort within source):**

```
## Post-Planning Gap Analysis

| Source | Item | Status |
|--------|------|--------|
| REQUIREMENTS.md | REQ-01 | ✓ Covered |
| REQUIREMENTS.md | REQ-02 | ✗ Not covered |
| CONTEXT.md | D-01 | ✓ Covered |
| CONTEXT.md | D-02 | ✗ Not covered |

⚠ N items not covered by any plan
```

**Skip-gracefully behavior:**
- REQUIREMENTS.md missing → CONTEXT-only report.
- CONTEXT.md missing → REQUIREMENTS-only report.
- Both missing or `<decisions>` block missing → "No requirements or decisions to check" line, no error.

This step is non-blocking. If items are reported as not covered, the user may
re-run `/gsd-plan-phase --gaps` to add plans, or proceed to execute-phase as-is.

## 14. Present Final Status

Route to `<offer_next>` OR `auto_advance` depending on flags/config.

## 15. Auto-Advance Check

Check for auto-advance trigger using values already loaded in step 1:

1. Parse `--auto` and `--chain` flags from $ARGUMENTS
2. Use `auto_chain_active` and `auto_advance` from the INIT JSON parsed in step 1 — **do not issue additional `config-get` calls for these values** (they are already present in the init output). Issuing redundant `config-get` calls for values already in INIT can cause infinite read loops on some runtimes.
3. **Sync chain flag with intent** — if user invoked manually (no `--auto` and no `--chain`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false || true
   fi
   ```

Set local variables from INIT (parsed once in step 1):
- `AUTO_CHAIN` = `auto_chain_active` from INIT JSON (boolean, default false)
- `AUTO_CFG` = `auto_advance` from INIT JSON (boolean, default false)

**If `--auto` or `--chain` flag present AND `AUTO_CHAIN` is not true:** Persist chain flag to config (handles direct invocation without prior discuss-phase):
```bash
if ([[ "$ARGUMENTS" =~ --auto ]] || [[ "$ARGUMENTS" =~ --chain ]]) && [[ "$AUTO_CHAIN" != "true" ]]; then
  gsd-sdk query config-set workflow._auto_chain_active true
fi
```

**If `--auto` or `--chain` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans ready. Launching execute-phase...
```

Launch execute-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting):
```
Skill(skill="gsd-execute-phase", args="${PHASE} --auto --no-transition ${GSD_WS}")
```

The `--no-transition` flag tells execute-phase to return status after verification instead of chaining further. This keeps the auto-advance chain flat — each phase runs at the same nesting level rather than spawning deeper Task agents.

**Handle execute-phase return:**
- **PHASE COMPLETE** → Display final summary:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /gsd-discuss-phase ${NEXT_PHASE} --auto ${GSD_WS}
  ```
- **GAPS FOUND / VERIFICATION FAILED** → Display result, stop chain:
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /gsd-execute-phase ${PHASE} ${GSD_WS}
  ```

**If neither `--auto` nor config enabled:**
Route to `<offer_next>` (existing behavior).

</process>

<offer_next>
Output this markdown directly (not as a code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Execute Phase {X}** — run all {N} plans

/clear then:

/gsd-execute-phase {X} ${GSD_WS}

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /gsd-plan-phase {X} --research — re-research first
- /gsd-review --phase {X} --all — peer review plans with external AIs
- /gsd-plan-phase {X} --reviews — replan incorporating review feedback

───────────────────────────────────────────────────────────────
</offer_next>

<windows_troubleshooting>
**Windows users:** If plan-phase freezes during agent spawning (common on Windows due to
stdio deadlocks with MCP servers — see Claude Code issue anthropics/claude-code#28126):

1. **Force-kill:** Close the terminal (Ctrl+C may not work)
2. **Clean up orphaned processes:**
   ```powershell
   # Kill orphaned node processes from stale MCP servers
   Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.StartTime -lt (Get-Date).AddHours(-1)} | Stop-Process -Force
   ```
3. **Clean up stale task directories:**
   ```powershell
   # Remove stale subagent task dirs (Claude Code never cleans these on crash)
   Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\tasks\*" -ErrorAction SilentlyContinue
   ```
4. **Reduce MCP server count:** Temporarily disable non-essential MCP servers in settings.json
5. **Retry:** Restart Claude Code and run `/gsd-plan-phase` again

If freezes persist, try `--skip-research` to reduce the agent chain from 3 to 2 agents:
```
/gsd-plan-phase N --skip-research
```
</windows_troubleshooting>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Phase directory created if needed
- [ ] CONTEXT.md loaded early (step 4) and passed to ALL agents
- [ ] Research completed (unless --skip-research or --gaps or exists)
- [ ] gsd-phase-researcher spawned with CONTEXT.md
- [ ] Existing plans checked
- [ ] gsd-planner spawned with CONTEXT.md + RESEARCH.md
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] gsd-plan-checker spawned with CONTEXT.md
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] User sees status between agent spawns
- [ ] User knows next steps
</success_criteria>
