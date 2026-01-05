---
description: Gather phase context through adaptive questioning before planning
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Help the user articulate their vision for a phase through collaborative thinking.

Purpose: Understand HOW the user imagines this phase working. You're a thinking partner helping them crystallize their vision.

Output: {phase}-CONTEXT.md capturing the user's vision for the phase
</objective>

<context>
Phase number: $ARGUMENTS (required)

**Load minimal state for context:**
@.planning/STATE.md
@.planning/config.json
</context>

<interactive_execution>
**NOTE: This command is interactive and runs in main context.**

**Step 1: Validate phase argument**
```bash
[ -z "$ARGUMENTS" ] && { echo "ERROR: Phase number required. Usage: /gsd:discuss-phase [phase]"; exit 1; }
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
```

**Step 2: Load workflow guidance (read on-demand, not preloaded)**
Read and follow: `~/.claude/get-shit-done/workflows/discuss-phase.md`

**Step 3: Load phase context**
- Read `.planning/ROADMAP.md` to find phase description
- Check if `.planning/phases/XX-name/{phase}-CONTEXT.md` exists

**Step 4: Collaborative discussion using AskUserQuestion**
Follow the workflow to:
- Present phase from roadmap
- Ask "How do you imagine this working?" with interpretation options
- Follow their thread — probe what excites them
- Sharpen the core — what's essential for THIS phase
- Find boundaries — what's explicitly out of scope
- Decision gate (ready / ask more / let me add context)

**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**

**Step 5: Create CONTEXT.md**
Use template at `~/.claude/get-shit-done/templates/context.md`
Write to `.planning/phases/XX-name/{phase}-CONTEXT.md`

</interactive_execution>

<guidance>
User is the visionary, you are the builder:
- Ask about vision, feel, essential outcomes
- DON'T ask about technical risks (you figure those out)
- DON'T ask about codebase patterns (you read the code)
- DON'T ask about success metrics (too corporate)
</guidance>

<success_criteria>
- Phase validated against roadmap
- Vision gathered through collaborative thinking
- CONTEXT.md captures: how it works, what's essential, what's out of scope
- User knows next steps (research or plan the phase)
</success_criteria>
