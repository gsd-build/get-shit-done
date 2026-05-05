<purpose>
Generate an AI design contract (AI-SPEC.md) for phases that involve building AI systems. Orchestrates gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner with a validation gate. Inserts between discuss-phase and plan-phase in the GSD lifecycle.

AI-SPEC.md locks four things before the planner creates tasks:
1. Framework selection (with rationale and alternatives)
2. Implementation guidance (correct syntax, patterns, pitfalls from official docs)
3. Domain context (practitioner rubric ingredients, failure modes, regulatory constraints)
4. Evaluation strategy (dimensions, rubrics, tooling, reference dataset, guardrails)

This prevents the two most common AI development failures: choosing the wrong framework for the use case, and treating evaluation as an afterthought.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-frameworks.md
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`.

**File paths:** `state_path`, `roadmap_path`, `requirements_path`, `context_path`.

Resolve agent models:
```bash
SELECTOR_MODEL=$(gsd-sdk query resolve-model gsd-framework-selector 2>/dev/null | jq -r '.model' 2>/dev/null || true)
RESEARCHER_MODEL=$(gsd-sdk query resolve-model gsd-ai-researcher 2>/dev/null | jq -r '.model' 2>/dev/null || true)
DOMAIN_MODEL=$(gsd-sdk query resolve-model gsd-domain-researcher 2>/dev/null | jq -r '.model' 2>/dev/null || true)
PLANNER_MODEL=$(gsd-sdk query resolve-model gsd-eval-planner 2>/dev/null | jq -r '.model' 2>/dev/null || true)
```

Check config:
```bash
AI_PHASE_ENABLED=$(gsd-sdk query config-get workflow.ai_integration_phase 2>/dev/null || echo "true")
```

**If `AI_PHASE_ENABLED` is `false`:**
```
AI phase is disabled in config. Enable via /gsd-settings.
```
Exit workflow.

**If `planning_exists` is false:** Error — run `/gsd-new-project` first.

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
Recommended: run /gsd-discuss-phase {N} first to capture framework preferences.
Continuing without user decisions — framework selector will ask all questions.
```
Continue (non-blocking).

## 4. Check Existing AI-SPEC

```bash
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
```


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
**If exists:** Use AskUserQuestion:
- header: "Existing AI-SPEC"
- question: "AI-SPEC.md already exists for Phase {N}. What would you like to do?"
- options:
  - "Update — re-run with existing as baseline"
  - "View — display current AI-SPEC and exit"
  - "Skip — keep current AI-SPEC and exit"

If "View": display file contents, exit.
If "Skip": exit.
If "Update": continue to step 5.

## 5. Spawn gsd-framework-selector

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI DESIGN CONTRACT — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Step 1/4 — Framework Selection...
```

Spawn `gsd-framework-selector` with:
```markdown
Read ~/.claude/agents/gsd-framework-selector.md for instructions.

<objective>
Select the right AI framework for Phase {phase_number}: {phase_name}
Goal: {phase_goal}
</objective>

<files_to_read>
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<phase_context>
Phase: {phase_number} — {phase_name}
Goal: {phase_goal}
</phase_context>
```

Parse selector output for: `primary_framework`, `system_type`, `model_provider`, `eval_concerns`, `alternative_framework`.

**If selector fails or returns empty:** Exit with error — "Framework selection failed. Re-run /gsd-ai-integration-phase {N} or answer the framework question in /gsd-discuss-phase {N} first."

## 6. Initialize AI-SPEC.md

Copy template:
```bash
cp "$HOME/.claude/get-shit-done/templates/AI-SPEC.md" "${PHASE_DIR}/${PADDED_PHASE}-AI-SPEC.md"
```

Fill in header fields:
- Phase number and name
- System classification (from selector)
- Selected framework (from selector)
- Alternative considered (from selector)

## 7. Spawn gsd-ai-researcher

> **Ordering note (prevents tool-level last-writer-wins race):** Steps 7 and 8 write disjoint sections of AI-SPEC.md but MUST run sequentially — wait for Step 7 to complete before spawning Step 8. Both agents use the `Edit` tool exclusively (never `Write`) when modifying AI-SPEC.md. A `Write` on a shared file replaces the entire file, silently overwriting the other agent's work; `Edit` targets only the relevant lines. See #3096 for a confirmed 40%-incidence race on parallel dispatch.

Display:
```
◆ Step 2/4 — Researching {primary_framework} docs + AI systems best practices...
```

Spawn `gsd-ai-researcher` with:
```markdown
Read ~/.claude/agents/gsd-ai-researcher.md for instructions.

**Tool discipline (mandatory):**
Use the Edit tool exclusively when modifying AI-SPEC.md — NEVER use Write on this file.
Write replaces the entire file and will overwrite work from parallel or sequential sibling agents.
Before editing, verify the section you are about to write is still a template placeholder.

<objective>
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
</files_to_read>

<input>
framework: {primary_framework}
system_type: {system_type}
model_provider: {model_provider}
ai_spec_path: {ai_spec_path}
phase_context: Phase {phase_number}: {phase_name} — {phase_goal}
</input>
```

## 8. Spawn gsd-domain-researcher

> **Wait for Step 7 to complete before spawning this step** (see ordering note in Step 7).

Display:
```
◆ Step 3/4 — Researching domain context and expert evaluation criteria...
```

Spawn `gsd-domain-researcher` with:
```markdown
Read ~/.claude/agents/gsd-domain-researcher.md for instructions.

**Tool discipline (mandatory):**
Use the Edit tool exclusively when modifying AI-SPEC.md — NEVER use Write on this file.
Write replaces the entire file and will overwrite work from parallel or sequential sibling agents.
Before editing, verify the section you are about to write is still a template placeholder.

<objective>
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<input>
system_type: {system_type}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 9. Spawn gsd-eval-planner

Display:
```
◆ Step 4/4 — Designing evaluation strategy from domain + technical context...
```

Spawn `gsd-eval-planner` with:
```markdown
Read ~/.claude/agents/gsd-eval-planner.md for instructions.

<objective>
Design evaluation strategy for Phase {phase_number}: {phase_name}
Write Sections 5, 6, and 7 of AI-SPEC.md
AI-SPEC.md now contains domain context (Section 1b) — use it as your rubric starting point.
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<input>
system_type: {system_type}
framework: {primary_framework}
model_provider: {model_provider}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 10. Validate AI-SPEC Completeness

Read the completed AI-SPEC.md. Check that:
- Section 2 has a framework name (not placeholder)
- Section 1b has at least one domain rubric ingredient (Good/Bad/Stakes)
- Section 3 has a non-empty code block (entry point pattern)
- Section 4b has a Pydantic example
- Section 5 has at least one row in the dimensions table
- Section 6 has at least one guardrail or explicit "N/A for internal tool" note
- Checklist section at end has 3+ items checked

**If validation fails:** Display specific missing sections. Ask user if they want to re-run the specific step or continue anyway.

## 11. Commit

**If `commit_docs` is true:**
```bash
git add "${AI_SPEC_FILE}"
git commit -m "docs({phase_slug}): generate AI-SPEC.md — {primary_framework} + domain context + eval strategy"
```

## 12. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI-SPEC COMPLETE — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Framework: {primary_framework}
◆ System Type: {system_type}
◆ Domain: {domain_vertical from Section 1b}
◆ Eval Dimensions: {eval_concerns}
◆ Tracing Default: Arize Phoenix (or detected existing tool)
◆ Output: {ai_spec_path}

Next step:
  /gsd-plan-phase {N}   — planner will consume AI-SPEC.md
```

</process>

<success_criteria>
- [ ] Framework selected with rationale (Section 2)
- [ ] AI-SPEC.md created from template
- [ ] Framework docs + AI best practices researched (Sections 3, 4, 4b populated)
- [ ] Domain context + expert rubric ingredients researched (Section 1b populated)
- [ ] Eval strategy grounded in domain context (Sections 5-7 populated)
- [ ] Arize Phoenix (or detected tool) set as tracing default in Section 7
- [ ] AI-SPEC.md validated (Sections 1b, 2, 3, 4b, 5, 6 all non-empty)
- [ ] Committed if commit_docs enabled
- [ ] Next step surfaced to user
</success_criteria>
