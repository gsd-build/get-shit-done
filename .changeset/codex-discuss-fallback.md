---
type: Fixed
pr: TBD
---
**Codex skill adapter no longer instructs the agent to silently default discuss-phase decisions.** When `request_user_input` was rejected (Default mode), the generated adapter said "pick a reasonable default" — so `$gsd-discuss-phase` proceeded toward writing CONTEXT.md / DISCUSSION-LOG.md / checkpoints without ever asking the user. Adapter prose now requires the agent to STOP, present plain-text questions, and wait, with explicit named exceptions (`--auto`/`--all`/explicit user approval). See #3018.
