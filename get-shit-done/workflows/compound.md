<purpose>
Extract learnings from a completed phase and optionally capture them to a knowledge base. Produces a COMPOUND.md artifact summarizing decisions, lessons, patterns, and surprises. If an ExoCortex-compatible capture_thought tool is available, each learning is routed there with provenance metadata.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="initialize">
Parse arguments and load project state:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse from init JSON: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`.

Derive: `PROJECT_NAME` from the current directory name or PROJECT.md title.
</step>

<step name="gather_artifacts">
Read all available phase artifacts. Not all will exist — gather what's available:

1. `${PHASE_DIR}/*-PLAN.md` — all plan files (may be multiple)
2. `${PHASE_DIR}/*-SUMMARY.md` — execution summaries
3. `${PHASE_DIR}/*-VERIFICATION.md` — verification report
4. `${PHASE_DIR}/*-UAT.md` — user acceptance testing results
5. `STATE.md` — project state including decisions

If no SUMMARY.md exists, warn that the phase may not be complete yet and ask the user whether to continue.
</step>

<step name="extract_decisions">
Scan artifacts for decisions made during execution:

**Sources:**
- STATE.md "Decisions" section — explicit decisions logged during execution
- SUMMARY.md deviation notes — where the executor deviated from the plan and why
- PLAN.md vs SUMMARY.md delta — tasks that changed approach during execution

**For each decision, capture:**
- What was decided
- Why (rationale from the artifact)
- What alternatives were considered (if mentioned)
- Outcome (did it work?)

Tag each as `category: decision`.
</step>

<step name="extract_lessons">
Scan artifacts for lessons learned:

**Sources:**
- VERIFICATION.md `gaps_found` items — things the verifier caught that execution missed
- PLAN.md task estimates vs SUMMARY.md actuals — what took longer/shorter than expected
- UAT.md failed tests — what broke during user acceptance testing

**For each lesson, capture:**
- What happened
- Why it matters for future work
- What to do differently next time

Tag each as `category: lesson`.
</step>

<step name="extract_patterns">
Scan artifacts for reusable patterns:

**Sources:**
- SUMMARY.md key-files — implementation approaches that worked well
- PLAN.md task structures — planning patterns that led to clean execution
- Recurring approaches across multiple plans in the same phase

**For each pattern, capture:**
- Pattern name (concise, descriptive)
- When to use it
- Brief example from this phase

Tag each as `category: pattern`.
</step>

<step name="extract_surprises">
Scan artifacts for unexpected findings:

**Sources:**
- UAT.md failures that weren't predicted by the plan
- VERIFICATION.md items marked as unexpected
- SUMMARY.md blockers or issues that weren't in the original plan
- Checkpoint interactions where user input changed direction

**For each surprise, capture:**
- What was unexpected
- Impact on the phase
- What to watch for in future phases

Tag each as `category: surprise`.
</step>

<step name="capture_to_knowledge_base">
For each extracted item, attempt to capture to an external knowledge base if available.

**Check tool availability first:** Try calling `capture_thought` — if the tool exists in the current session (e.g., ExoCortex MCP is connected), use it:

```
capture_thought({
  content: "<category>: <title>\n\n<detail>\n\nSource: phase <N> of <project>",
  metadata: {
    source: "gsd-compound",
    phase: "<phase_number>",
    project: "<PROJECT_NAME>",
    category: "<decision|lesson|pattern|surprise>"
  }
})
```

**Graceful degradation:** If `capture_thought` is not available (tool not found, MCP not connected), collect all items but skip capture calls. Note in the output that external capture was unavailable and items were written to the COMPOUND.md artifact only.

Track: total items extracted, items successfully captured, items that failed.
</step>

<step name="suggest_claude_md_updates">
Review extracted patterns and lessons. If any clearly affect future coding conventions or project-specific rules:

- Present the suggested CLAUDE.md additions to the user
- Do NOT auto-edit CLAUDE.md — always ask first
- Format as a diff showing what would be added and where

If no CLAUDE.md updates are warranted, skip this step silently.
</step>

<step name="produce_artifact">
Write `${PHASE_DIR}/${PADDED_PHASE}-COMPOUND.md`:

```markdown
---
phase: <phase_number>
phase_name: "<phase_name>"
project: "<PROJECT_NAME>"
generated: "<ISO timestamp>"
items_extracted: <total count>
items_captured: <count captured to knowledge base>
knowledge_base_available: <true|false>
---

# Compound: Phase <N> — <Phase Name>

## Decisions
<list of decisions with rationale and outcome>

## Lessons
<list of lessons with context and recommendation>

## Patterns
<list of reusable patterns with when-to-use guidance>

## Surprises
<list of unexpected findings with future guidance>

## Capture Summary
- Items extracted: <N>
- Items captured: <N>
- Capture failures: <N>
```

If `commit_docs` is true, commit:
```bash
git add "${PHASE_DIR}/${PADDED_PHASE}-COMPOUND.md"
git commit -m "docs(phase-${PHASE_NUMBER}): compound learnings from ${PHASE_NAME}"
```
</step>

<step name="present_summary">
Show the user a concise summary:

- Count of items by category (decisions, lessons, patterns, surprises)
- Whether knowledge base capture succeeded
- Whether CLAUDE.md updates were suggested
- Suggest next steps: `/gsd:progress` or start next phase
</step>

</process>
