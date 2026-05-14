<purpose>
Retroactive audit of an implemented AI phase's evaluation coverage. Standalone command that works on any GSD-managed AI phase. Produces a scored EVAL-REVIEW.md with gap analysis and remediation plan.

Use after /gsd:execute-phase to verify that the evaluation strategy from AI-SPEC.md was actually implemented. Mirrors the pattern of /gsd:ui-review and /gsd:validate-phase.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 0. Initialize

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`.

```bash
AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-eval-auditor 2>/dev/null | jq -r '.model' 2>/dev/null || true)
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EVAL AUDIT — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. Detect Input State

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
EVAL_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-EVAL-REVIEW.md 2>/dev/null | head -1)
```

**State A** — AI-SPEC.md + SUMMARY.md exist: Full audit against spec
**State B** — SUMMARY.md exists, no AI-SPEC.md: Audit against general best practices
**State C** — No SUMMARY.md: Exit — "Phase {N} not executed. Run /gsd:execute-phase {N} first."


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
**If `EVAL_REVIEW_FILE` non-empty:** Use AskUserQuestion:
- header: "Existing Eval Review"
- question: "EVAL-REVIEW.md already exists for Phase {N}."
- options:
  - "Re-audit — run fresh audit"
  - "View — display current review and exit"

If "View": display file, exit.
If "Re-audit": continue.

**If State B (no AI-SPEC.md):** Warn:
```
No AI-SPEC.md found for Phase {N}.
Audit will evaluate against general AI eval best practices rather than a phase-specific plan.
Consider running /gsd:ai-integration-phase {N} before implementation next time.
```
Continue (non-blocking).

## 2. Gather Context Paths

Build file list for auditor:
- AI-SPEC.md (if exists — the planned eval strategy)
- All SUMMARY.md files in phase dir
- All PLAN.md files in phase dir

## 3. Spawn gsd-eval-auditor

```
◆ Spawning eval auditor...
```

Build prompt:

```markdown
Read ~/.claude/agents/gsd-eval-auditor.md for instructions.

<objective>
Conduct evaluation coverage audit of Phase {phase_number}: {phase_name}
{If AI-SPEC exists: "Audit against AI-SPEC.md evaluation plan."}
{If no AI-SPEC: "Audit against general AI eval best practices."}
</objective>

<files_to_read>
- {summary_paths}
- {plan_paths}
- {ai_spec_path if exists}
</files_to_read>

<input>
ai_spec_path: {ai_spec_path or "none"}
phase_dir: {phase_dir}
phase_number: {phase_number}
phase_name: {phase_name}
padded_phase: {padded_phase}
state: {A or B}
</input>
```

Spawn as Task with model `AUDITOR_MODEL`.

## 4. Parse Auditor Result

Read the written EVAL-REVIEW.md. Extract:
- `overall_score`
- `verdict` (PRODUCTION READY | NEEDS WORK | SIGNIFICANT GAPS | NOT IMPLEMENTED)
- `critical_gap_count`

## 5. Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EVAL AUDIT COMPLETE — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Score: {overall_score}/100
◆ Verdict: {verdict}
◆ Critical Gaps: {critical_gap_count}
◆ Output: {eval_review_path}

{If PRODUCTION READY:}
  Next step: /gsd:plan-phase (next phase) or deploy

{If NEEDS WORK:}
  Address critical gaps in EVAL-REVIEW.md, then re-run /gsd:eval-review {N}

{If SIGNIFICANT GAPS or NOT IMPLEMENTED:}
  Review AI-SPEC.md evaluation plan. Critical eval dimensions are not implemented.
  Do not deploy until gaps are addressed.
```

## 6. Commit

**If `commit_docs` is true:**
```bash
git add "${EVAL_REVIEW_FILE}"
git commit -m "docs({phase_slug}): add EVAL-REVIEW.md — score {overall_score}/100 ({verdict})"
```

</process>

<success_criteria>
- [ ] Phase execution state detected correctly
- [ ] AI-SPEC.md presence handled (with or without)
- [ ] gsd-eval-auditor spawned with correct context
- [ ] EVAL-REVIEW.md written (by auditor)
- [ ] Score and verdict displayed to user
- [ ] Appropriate next steps surfaced based on verdict
- [ ] Committed if commit_docs enabled
</success_criteria>
