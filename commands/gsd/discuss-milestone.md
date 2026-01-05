---
description: Gather context for next milestone through adaptive questioning
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  - SlashCommand
---

<objective>
Help you figure out what to build in the next milestone through collaborative thinking.

Purpose: After completing a milestone, explore what features you want to add, improve, or fix. Features first — scope and phases derive from what you want to build.
Output: Context gathered, then routes to /gsd:new-milestone
</objective>

<context>
**Load minimal state for context:**
@.planning/STATE.md
@.planning/config.json
</context>

<interactive_execution>
**NOTE: This command is interactive and runs in main context.**

**Step 1: Validate project exists**
```bash
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
```

**Step 2: Load workflow guidance (read on-demand, not preloaded)**
Read and follow: `~/.claude/get-shit-done/workflows/discuss-milestone.md`

**Step 3: Load project context**
- Read `.planning/ROADMAP.md` for previous milestone info
- Read `.planning/MILESTONES.md` if exists

**Step 4: Interactive milestone discussion using AskUserQuestion**
Follow the workflow to:
- Verify previous milestone complete (or acknowledge active milestone)
- Present context from previous milestone (accomplishments, phase count)
- Ask "What do you want to add, improve, or fix?" with feature categories
- Dig into features they mention
- Help them articulate what matters most
- Decision gate (ready / ask more / let me add context)

**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**

**Step 5: Hand off to new-milestone**
Route to `/gsd:new-milestone` with gathered context.

</interactive_execution>

<success_criteria>
- Project state loaded and presented
- Previous milestone context summarized
- Milestone scope gathered through adaptive questioning
- Context handed off to /gsd:new-milestone
</success_criteria>
