# Phase 7: Configuration - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users control exactly which external agents (codex, gemini, opencode) participate at which workflow checkpoints via config.json. Builds on Phase 6's detection/invocation layer. The actual draft-review-synthesize workflow integration is Phase 8 — this phase handles configuration only.

</domain>

<decisions>
## Implementation Decisions

### Config schema structure
- Hybrid approach: global `agents` list + optional per-checkpoint overrides in `checkpoints` object
- 4 configurable checkpoints: `requirements`, `roadmap`, `plan`, `verification`
- Per-checkpoint config controls agents list only — timeout and other settings stay global
- Schema extends existing `co_planners` section (which already has `enabled` and `timeout_ms`)
- Example shape:
  ```json
  "co_planners": {
    "enabled": true,
    "timeout_ms": 120000,
    "agents": ["codex"],
    "checkpoints": {
      "plan": { "agents": ["codex", "gemini"] },
      "verification": { "agents": ["gemini"] }
    }
  }
  ```

### Default & fallback behavior
- Fallback chain: checkpoint-specific agents → global agents list → skip (no agents)
- Missing agent at runtime: skip with warning, continue workflow (consistent with Phase 6 graceful degradation)
- Enabled but empty config (no agents anywhere): warn once per session — "co_planners enabled but no agents configured"

### User interaction model
- Primary: JSON editing is source of truth + CLI convenience commands for validation
- Extend existing `/gsd:settings` command — no new commands
- UX: multi-choice questions with AskUserQuestion — consistent with existing settings flow, agent/checkpoint discovery built in

### Validation & error feedback
- Validate on config load (every command that reads config)
- Severity: warn and continue — invalid co-planner config doesn't block commands
- Validate both agent names (against known adapters: codex, gemini, opencode) and checkpoint names (against the 4 defined checkpoints)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-configuration*
*Context gathered: 2026-02-17*
