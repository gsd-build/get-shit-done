<purpose>
Generate a UI design contract (UI-SPEC.md) for frontend phases. Orchestrates gsd-ui-researcher and gsd-ui-checker with a revision loop. Inserts between discuss-phase and plan-phase in the lifecycle.

UI-SPEC.md locks spacing, typography, color, copywriting, and design system decisions before the planner creates tasks. This prevents design debt caused by ad-hoc styling decisions during execution.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-ui-researcher — Researches UI/UX approaches
- gsd-ui-checker — Reviews UI implementation quality
</available_agent_types>

<process>

## 1. Initialize

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI=$(gsd-sdk query agent-skills gsd-ui-researcher)
AGENT_SKILLS_UI_CHECKER=$(gsd-sdk query agent-skills gsd-ui-checker)
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`.

**File paths:** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`.

Detect sketch findings:
```bash
SKETCH_FINDINGS_PATH=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)
```

Resolve UI agent models:

```bash
UI_RESEARCHER_MODEL=$(gsd-sdk query resolve-model gsd-ui-researcher --raw)
UI_CHECKER_MODEL=$(gsd-sdk query resolve-model gsd-ui-checker --raw)
```

Check config:

```bash
UI_ENABLED=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**If `UI_ENABLED` is `false`:**
```
UI phase is disabled in config. Enable via /gsd:settings.
```
Exit workflow.

**If `planning_exists` is false:** Error — run `/gsd:new-project` first.

## 2. Parse and Validate Phase

Extract phase number from $ARGUMENTS. If not provided, detect next unplanned phase.

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases.

## 3. Check Prerequisites

**If `has_context` is false:**
```
No CONTEXT.md found for Phase {N}.
Recommended: run /gsd:discuss-phase {N} first to capture design preferences.
Continuing without user decisions — UI researcher will ask all questions.
```
Continue (non-blocking).

**If `has_research` is false:**
```
No RESEARCH.md found for Phase {N}.
Note: stack decisions (component library, styling approach) will be asked during UI research.
```
Continue (non-blocking).

**If `SKETCH_FINDINGS_PATH` is not empty:**
```
⚡ Sketch findings detected: {SKETCH_FINDINGS_PATH}
   Validated design decisions from /gsd:sketch will be loaded into the UI researcher.
   Pre-validated decisions (layout, palette, typography, spacing) should be treated as locked — not re-asked.
```

## 4. Check Existing UI-SPEC

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
**If exists:** Use AskUserQuestion:
- header: "Existing UI-SPEC"
- question: "UI-SPEC.md already exists for Phase {N}. What would you like to do?"
- options:
  - "Update — re-run researcher with existing as baseline"
  - "View — display current UI-SPEC and exit"
  - "Skip — keep current UI-SPEC, proceed to verification"

If "View": display file contents, exit.
If "Skip": proceed to step 7 (checker).
If "Update": continue to step 5.

## 5. Spawn gsd-ui-researcher

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI DESIGN CONTRACT — PHASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI researcher...
```

Build prompt:

```markdown
Read ~/.claude/agents/gsd-ui-researcher.md for instructions.

<objective>
Create UI design contract for Phase {phase_number}: {phase_name}
Answer: "What visual and interaction contracts does this phase need?"
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /gsd:discuss-phase)
- {research_path} (Technical Research — stack decisions)
- {SKETCH_FINDINGS_PATH} (Sketch Findings — validated design decisions, CSS patterns, visual direction from /gsd:sketch, if exists)
</files_to_read>

${AGENT_SKILLS_UI}

<output>
Write to: {phase_dir}/{padded_phase}-UI-SPEC.md
Template: ~/.claude/get-shit-done/templates/UI-SPEC.md
</output>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

Omit null file paths from `<files_to_read>`.

```
Task(
  prompt=ui_research_prompt,
  subagent_type="gsd-ui-researcher",
  model="{UI_RESEARCHER_MODEL}",
  description="UI Design Contract Phase {N}"
)
```

## 6. Handle Researcher Return

**If `## UI-SPEC COMPLETE`:**
Display confirmation. Continue to step 7.

**If `## UI-SPEC BLOCKED`:**
Display blocker details and options. Exit workflow.

## 7. Spawn gsd-ui-checker

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING UI-SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI checker...
```

Build prompt:

```markdown
Read ~/.claude/agents/gsd-ui-checker.md for instructions.

<objective>
Validate UI design contract for Phase {phase_number}: {phase_name}
Check all 6 dimensions. Return APPROVED or BLOCKED.
</objective>

<files_to_read>
- {phase_dir}/{padded_phase}-UI-SPEC.md (UI Design Contract — PRIMARY INPUT)
- {context_path} (USER DECISIONS — check compliance)
- {research_path} (Technical Research — check stack alignment)
</files_to_read>

${AGENT_SKILLS_UI_CHECKER}

<config>
ui_safety_gate: {ui_safety_gate config value}
</config>
```

```
Task(
  prompt=ui_checker_prompt,
  subagent_type="gsd-ui-checker",
  model="{UI_CHECKER_MODEL}",
  description="Verify UI-SPEC Phase {N}"
)
```

## 8. Handle Checker Return

**If `## UI-SPEC VERIFIED`:**
Display dimension results. Proceed to step 10.

**If `## ISSUES FOUND`:**
Display blocking issues. Proceed to step 9.

## 9. Revision Loop (Max 2 Iterations)

Track `revision_count` (starts at 0).

**If `revision_count` < 2:**
- Increment `revision_count`
- Re-spawn gsd-ui-researcher with revision context:

```markdown
<revision>
The UI checker found issues with the current UI-SPEC.md.

### Issues to Fix
{paste blocking issues from checker return}

Read the existing UI-SPEC.md, fix ONLY the listed issues, re-write the file.
Do NOT re-ask the user questions that are already answered.
</revision>
```

- After researcher returns → re-spawn checker (step 7)

**If `revision_count` >= 2:**
```
Max revision iterations reached. Remaining issues:

{list remaining issues}

Options:
1. Force approve — proceed with current UI-SPEC (FLAGs become accepted)
2. Edit manually — open UI-SPEC.md in editor, re-run /gsd:ui-phase
3. Abandon — exit without approving
```

Use AskUserQuestion for the choice.

## 10. Present Final Status

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI-SPEC READY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — UI design contract approved

Dimensions: 6/6 passed
{If any FLAGs: "Recommendations: {N} (non-blocking)"}

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

{If CONTEXT.md exists for this phase:}
**Plan Phase {N}** — planner will use UI-SPEC.md as design context

`/clear` then: `/gsd:plan-phase {N}`

{If CONTEXT.md does NOT exist:}
**Discuss Phase {N}** — gather implementation context before planning

`/clear` then: `/gsd:discuss-phase {N}`

(or `/gsd:plan-phase {N}` to skip discussion)

───────────────────────────────────────────────────────────────
```

## 11. Commit (if configured)

```bash
gsd-sdk query commit "docs(${padded_phase}): UI design contract" "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

## 12. Update State

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} UI-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

</process>

<success_criteria>
- [ ] Config checked (exit if ui_phase disabled)
- [ ] Phase validated against roadmap
- [ ] Prerequisites checked (CONTEXT.md, RESEARCH.md — non-blocking warnings)
- [ ] Existing UI-SPEC handled (update/view/skip)
- [ ] gsd-ui-researcher spawned with correct context and file paths
- [ ] UI-SPEC.md created in correct location
- [ ] gsd-ui-checker spawned with UI-SPEC.md
- [ ] All 6 dimensions evaluated
- [ ] Revision loop if BLOCKED (max 2 iterations)
- [ ] Final status displayed with next steps
- [ ] UI-SPEC.md committed (if commit_docs enabled)
- [ ] State updated
</success_criteria>
