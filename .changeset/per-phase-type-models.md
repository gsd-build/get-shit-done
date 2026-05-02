---
type: Added
pr: 3030
---
**`models` block in `.planning/config.json` for per-phase-type model selection (#3023).** A new resolution layer between per-agent `model_overrides` and the `model_profile` tier table. Six named slots (`planning` / `discuss` / `research` / `execution` / `verification` / `completion`) accept tier aliases (`opus` / `sonnet` / `haiku` / `inherit`). Lets you express "Opus for planning, Sonnet for the rest" in two lines without learning the agent taxonomy. Fully backward compatible — configs without `models` behave exactly as today.
