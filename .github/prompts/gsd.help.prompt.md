---
name: gsd.help
description: "Show available GSD commands and usage guide"
agent: agent
---

<!-- upstream-tools: null (field absent in upstream command) -->

## Path Resolution 

  The GSD workflow files contain bash commands that reference `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`. 
  **In this workspace, the module lives at `.claude/get-shit-done/bin/gsd-tools.cjs` relative to the workspace root — `$HOME` does not apply.
  ** When executing or interpreting any bash snippet from a workflow file, mentally substitute `$HOME/.claude/` → `.claude/` (workspace-relative).
  ---

<objective>
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
- Read file at: ./.claude/get-shit-done/workflows/help.md
</execution_context>

<process>
Output the complete GSD command reference from @./.claude/get-shit-done/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
