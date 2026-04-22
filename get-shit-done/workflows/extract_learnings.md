<purpose>
Extract decisions, lessons learned, patterns discovered, and surprises encountered from completed phase artifacts into a structured LEARNINGS.md file. Captures institutional knowledge that would otherwise be lost between phases.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<objective>
Analyze completed phase artifacts (PLAN.md, SUMMARY.md, VERIFICATION.md, UAT.md, STATE.md) and extract structured learnings into 4 categories: decisions, lessons, patterns, and surprises. Each extracted item includes source attribution. The output is a LEARNINGS.md file with YAML frontmatter containing metadata about the extraction.
</objective>

<process>

<step name="initialize">
Parse arguments and load project state:

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse from init JSON: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`.

If phase not found, exit with error: "Phase {PHASE_ARG} not found."
</step>

<step name="collect_artifacts">
Read the phase artifacts. PLAN.md and SUMMARY.md are required; VERIFICATION.md, UAT.md, and STATE.md are optional.

**Required artifacts:**
- `${PHASE_DIR}/*-PLAN.md` — all plan files for the phase
- `${PHASE_DIR}/*-SUMMARY.md` — all summary files for the phase

If PLAN.md or SUMMARY.md files are not found or missing, exit with error: "Required artifacts missing. PLAN.md and SUMMARY.md are required for learning extraction."

**Optional artifacts (read if available, skip if not found):**
- `${PHASE_DIR}/*-VERIFICATION.md` — verification results
- `${PHASE_DIR}/*-UAT.md` — user acceptance test results
- `.planning/STATE.md` — project state with decisions and blockers

Track which optional artifacts are missing for the `missing_artifacts` frontmatter field.
</step>

<step name="extract_learnings">
Analyze all collected artifacts and extract learnings into 4 categories:

### 1. Decisions
Technical and architectural decisions made during the phase. Look for:
- Explicit decisions documented in PLAN.md or SUMMARY.md
- Technology choices and their rationale
- Trade-offs that were evaluated
- Design decisions recorded in STATE.md

Each decision entry must include:
- **What** was decided
- **Why** it was decided (rationale)
- **Source:** attribution to the artifact where the decision was found (e.g., "Source: 03-01-PLAN.md")

### 2. Lessons
Things learned during execution that were not known beforehand. Look for:
- Unexpected complexity in SUMMARY.md
- Issues discovered during verification in VERIFICATION.md
- Failed approaches documented in SUMMARY.md
- UAT feedback that revealed gaps

Each lesson entry must include:
- **What** was learned
- **Context** for the lesson
- **Source:** attribution to the originating artifact

### 3. Patterns
Reusable patterns, approaches, or techniques discovered. Look for:
- Successful implementation patterns in SUMMARY.md
- Testing patterns from VERIFICATION.md or UAT.md
- Workflow patterns that worked well
- Code organization patterns from PLAN.md

Each pattern entry must include:
- **Pattern** name/description
- **When to use** it
- **Source:** attribution to the originating artifact

### 4. Surprises
Unexpected findings, behaviors, or outcomes. Look for:
- Things that took longer or shorter than estimated
- Unexpected dependencies or interactions
- Edge cases not anticipated in planning
- Performance or behavior that differed from expectations

Each surprise entry must include:
- **What** was surprising
- **Impact** of the surprise
- **Source:** attribution to the originating artifact
</step>

<step name="capture_thought_integration">
**What this step is:** `capture_thought` is an **optional convention**, not a bundled GSD tool. GSD does not ship one and does not require one. The step is a hook for users who run a memory / knowledge-base MCP server (for example ExoCortex-style servers, `claude-mem`, or `mem0`-style servers) that exposes a tool with this exact name. If any MCP server in the current session provides a `capture_thought` tool with the signature below, each extracted learning is routed through it with metadata. If no such tool is present, the step is a silent no-op — `LEARNINGS.md` is always the primary output.

**Detection:** Check whether a tool named `capture_thought` is available in the current session. Do not assume any specific MCP server is connected.

**If available**, call once per extracted learning:

```
capture_thought({
  category: "decision" | "lesson" | "pattern" | "surprise",
  phase: PHASE_NUMBER,
  content: LEARNING_TEXT,
  source: ARTIFACT_NAME
})
```

**If not available** (no MCP server in the session exposes this tool, or the runtime does not support it), skip the step silently and continue. The workflow must not fail or warn — this is expected behavior for users who do not run a knowledge-base MCP.
</step>

<step name="write_learnings">
Write the LEARNINGS.md file to the phase directory. If a previous LEARNINGS.md exists, overwrite it (replace the file entirely).

Output path: `${PHASE_DIR}/${PADDED_PHASE}-LEARNINGS.md`

The file must have YAML frontmatter with these fields:
```yaml
---
phase: {PHASE_NUMBER}
phase_name: "{PHASE_NAME}"
project: "{PROJECT_NAME}"
generated: "{ISO_DATE}"
counts:
  decisions: {N}
  lessons: {N}
  patterns: {N}
  surprises: {N}
missing_artifacts:
  - "{ARTIFACT_NAME}"
---
```

Individual items may carry an optional `graduated:` annotation (added by `graduation.md` when a cluster is promoted):
```markdown
**Graduated:** {target-file}:{ISO_DATE}
```
This annotation is appended after the item's existing fields and prevents the item from being re-surfaced in future graduation scans. Do not add this field during extraction — it is written only by the graduation workflow.

The body follows this structure:
```markdown
# Phase {PHASE_NUMBER} Learnings: {PHASE_NAME}

## Decisions

### {Decision Title}
{What was decided}

**Rationale:** {Why}
**Source:** {artifact file}

---

## Lessons

### {Lesson Title}
{What was learned}

**Context:** {context}
**Source:** {artifact file}

---

## Patterns

### {Pattern Name}
{Description}

**When to use:** {applicability}
**Source:** {artifact file}

---

## Surprises

### {Surprise Title}
{What was surprising}

**Impact:** {impact description}
**Source:** {artifact file}
```
</step>

<step name="update_state">
Update STATE.md to reflect the learning extraction:

```bash
gsd-sdk query state.update "Last Activity" "$(date +%Y-%m-%d)"
```
</step>

<step name="report">
```
---------------------------------------------------------------

## Learnings Extracted: Phase {X} — {Name}

Decisions:  {N}
Lessons:    {N}
Patterns:   {N}
Surprises:  {N}
Total:      {N}

Output: {PHASE_DIR}/{PADDED_PHASE}-LEARNINGS.md

Missing artifacts: {list or "none"}

Next steps:
- Review extracted learnings for accuracy
- /gsd:progress — see overall project state
- /gsd:execute-phase {next} — continue to next phase

---------------------------------------------------------------
```
</step>

</process>

<success_criteria>
- [ ] Phase artifacts located and read successfully
- [ ] All 4 categories extracted: decisions, lessons, patterns, surprises
- [ ] Each extracted item has source attribution
- [ ] LEARNINGS.md written with correct YAML frontmatter
- [ ] Missing optional artifacts tracked in frontmatter
- [ ] capture_thought integration attempted if tool available
- [ ] STATE.md updated with extraction activity
- [ ] User receives summary report
</success_criteria>

<critical_rules>
- PLAN.md and SUMMARY.md are required — exit with clear error if missing
- VERIFICATION.md, UAT.md, and STATE.md are optional — extract from them if present, skip gracefully if not found
- Every extracted learning must have source attribution back to the originating artifact
- Running extract-learnings twice on the same phase must overwrite (replace) the previous LEARNINGS.md, not append
- Do not fabricate learnings — only extract what is explicitly documented in artifacts
- If capture_thought is unavailable, the workflow must not fail — graceful degradation to file-only output
- LEARNINGS.md frontmatter must include counts for all 4 categories and list any missing_artifacts
</critical_rules>
