---
type: Added
pr: TBD
---
**`dynamic_routing` block in `.planning/config.json` for failure-tier escalation (#3024).** Each agent declares a default tier (`light` / `standard` / `heavy`); when `dynamic_routing.enabled: true`, the resolver picks `tier_models[default_tier]` for the first spawn and escalates one tier up on orchestrator-detected soft failure (capped by `max_escalations`). Disabled by default — fully backward compatible. Composes with `model_overrides` (higher precedence) and `models.<phase_type>` (lower) for full cost-control flexibility. Adds new resolver `resolveModelForTier(cwd, agent, attempt)` to `core.cjs` for orchestrator integration.
