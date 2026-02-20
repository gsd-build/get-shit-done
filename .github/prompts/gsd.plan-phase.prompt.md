---
name: gsd.plan-phase
description: "Create detailed phase plan (PLAN.md) with verification loop"
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify]"
tools: ['agent', 'edit', 'execute', 'mcp__context7__*', 'read', 'search', 'web']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/plan-phase.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Write","Bash","Glob","Grep","Task","WebFetch","mcp__context7__*"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.plan-phase`

---

<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gsd-planner, verify with gsd-plan-checker, iterate until pass or max iterations, present results.
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/plan-phase.md
- Read file at: ../.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop

Normalize phase input in step 2 before any directory lookups.
</context>

<process>
Execute the plan-phase workflow from @../.claude/get-shit-done/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
