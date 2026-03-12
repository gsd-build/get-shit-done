---
name: gsd.join-discord
description: "Join the GSD Discord community"
agent: agent
---

<!-- upstream-tools: null (field absent in upstream command) -->

## Path Resolution 

  The GSD workflow files contain bash commands that reference `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`. 
  **In this workspace, the module lives at `.claude/get-shit-done/bin/gsd-tools.cjs` relative to the workspace root — `$HOME` does not apply.
  ** When executing or interpreting any bash snippet from a workflow file, mentally substitute `$HOME/.claude/` → `.claude/` (workspace-relative).
  ---

<objective>
Display the Discord invite link for the GSD community server.
</objective>

<output>
# Join the GSD Discord

Connect with other GSD users, get help, share what you're building, and stay updated.

**Invite link:** https://discord.gg/gsd

Click the link or paste it into your browser to join.
</output>
