---
type: Fixed
pr: 3361
---
**SDK `resolve-model` and `init.progress` now report Codex runtime override models before applying `resolve_model_ids: "omit"`** — Codex projects using runtime-specific `model_profile_overrides` now see the resolved planner and executor model IDs in SDK query output instead of empty strings or the composed `sonnet` fallback. (#3358)
