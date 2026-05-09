---
type: Added
pr: 3319
---
**`workflow.human_verify_mode = end-of-phase` config flag** — opt out of the per-checkpoint executor cold-start cost (CLAUDE.md, MEMORY.md, STATE.md, plan re-read on every `checkpoint:human-verify` round-trip). When set, the planner suppresses `checkpoint:human-verify` task emission and embeds verification details into `<verify><human-check>` blocks on `auto` tasks; the verifier consolidates them at end-of-phase into the existing HUMAN-UAT.md flow. Default `mid-flight` preserves current behavior. `checkpoint:decision` and `checkpoint:human-action` are unaffected. (#3309)
