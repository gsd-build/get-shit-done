---
name: gsd:preflight
description: Pre-workflow validation — checks phase readiness before discuss/plan/execute
allowed-tools:
  - Bash
  - Read
---
<objective>
Run preflight checks for a phase and display a GO/NO-GO report.
Validates: phase exists, dependencies complete, required artifacts present, canonical refs valid, plan paths valid.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>

## 1. Parse Arguments

Extract phase number from $ARGUMENTS. If empty, show usage:
```
Usage: /gsd:preflight <phase-number> [--workflow discuss|plan|execute|verify]
```

## 2. Run Engine

```bash
RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" preflight ${PHASE} ${WORKFLOW_FLAG} 2>/dev/null)
if [[ "$RESULT" == @file:* ]]; then RESULT=$(cat "${RESULT#@file:}"); fi
```

Parse JSON fields: `ready`, `phase`, `phase_name`, `detected_workflow`, `next_command`, `blockers`, `warnings`, `canonical_refs_checked`, `canonical_refs_valid`, `plan_paths_checked`, `plan_paths_valid`.

## 3. Format Report

**If `ready` is true (GO):**

Output this directly (not as code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PREFLIGHT PHASE {N} — GO ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {N}: {phase_name}
Dependencies: ✓ All complete
Artifacts: ✓ Ready for {detected_workflow}
Canonical refs: ✓ {canonical_refs_valid}/{canonical_refs_checked} valid
Plan paths: ✓ {plan_paths_valid}/{plan_paths_checked} valid

If there are warnings, append after the summary:

⚠ {warning.message}
  → {warning.command}

Then show Next Up block:

───────────────────────────────────────────────────────────────

## ▶ Next Up

**{detected_workflow} Phase {N}** — {phase_name}

`{next_command}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**If `ready` is false (NO-GO):**

Output this directly (not as code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PREFLIGHT PHASE {N} — NO-GO ✗
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {N}: {phase_name}

{For each blocker:}
✗ {blocker.message}
  → {blocker.command}

{For each warning:}
⚠ {warning.message}
  → {warning.command}

No Next Up block on NO-GO — the remediation commands ARE the next steps.

**Display rules:**
- If `canonical_refs_checked` is 0: show "Canonical refs: — (none to check)"
- If `plan_paths_checked` is 0: show "Plan paths: — (none to check)"
- If a blocker/warning has no `command`: omit the → line

</process>

<success_criteria>
- [ ] Engine called and JSON parsed
- [ ] GO/NO-GO report displayed with ui-brand formatting
- [ ] All blockers shown with remediation commands
- [ ] All warnings shown
- [ ] Next Up block shown on GO only
</success_criteria>
