---
name: "gsd-join-discord"
description: "Join the GSD Discord community"
metadata:
  short-description: "Join the GSD Discord community"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-join-discord`.
- Treat all user text after `$gsd-join-discord` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Display the Discord invite link for the GSD community server.
</objective>

<output>
# Join the GSD Discord

Connect with other GSD users, get help, share what you're building, and stay updated.

**Invite link:** https://discord.gg/gsd

Click the link or paste it into your browser to join.
</output>
