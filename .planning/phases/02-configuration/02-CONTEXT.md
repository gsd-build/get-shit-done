# Phase 2: Configuration - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can control adversary behavior through config.json settings. This phase adds adversary configuration to the existing config schema — enable/disable globally, toggle individual checkpoints, and configure max debate rounds. Does NOT include CLI flag overrides, runtime profile switching, or adversary behavior changes.

</domain>

<decisions>
## Implementation Decisions

### Toggle Design
- Global toggle uses object-with-enabled pattern: `adversary: { enabled: true, ... }`
- `enabled: false` is a **hard kill switch** — no adversary runs anywhere, regardless of checkpoint flags
- `enabled: true` defers to individual checkpoint flags
- Checkpoint preferences are preserved when globally disabled (not deleted)

### Checkpoint Granularity
- All 4 checkpoints independently toggleable: requirements, roadmap, plan, verification
- Checkpoints live in a nested object: `adversary.checkpoints.{name}`
- Checkpoint values support **boolean shorthand**: `plan: true` uses global defaults
- Checkpoint values support **object form** for overrides: `plan: { enabled: true, max_rounds: 4 }`

### Rounds Configuration
- Global `max_rounds` at `adversary.max_rounds` serves as fallback default for all checkpoints
- Per-checkpoint override via object form: `checkpoints.plan.max_rounds` overrides global
- Precedence: checkpoint-level max_rounds > adversary-level max_rounds > system hardcoded default

### Default Behavior
- Adversary is **on by default** for new projects (`enabled: true`)
- All 4 checkpoints **enabled by default**
- Default `max_rounds`: **3** (challenge → defense → final assessment)
- Missing config section: **use system defaults** — adversary runs even without explicit config in config.json
- Existing projects without adversary config automatically get adversary behavior (backwards-compatible addition, not breaking)

### Claude's Discretion
- Where in config.json the adversary section lives (top-level vs inside workflow)
- Schema validation approach for adversary config
- How boolean-to-object coercion is implemented in config parsing
- Error messages for invalid config values

</decisions>

<specifics>
## Specific Ideas

- Config shape should look like:
  ```json
  {
    "adversary": {
      "enabled": true,
      "max_rounds": 3,
      "checkpoints": {
        "requirements": true,
        "roadmap": true,
        "plan": { "enabled": true, "max_rounds": 4 },
        "verification": true
      }
    }
  }
  ```
- Boolean shorthand (`plan: true`) and object form (`plan: { enabled: true, max_rounds: 4 }`) must both be valid
- Global kill switch (`enabled: false`) should feel instant — no adversary prompts when off

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-configuration*
*Context gathered: 2026-02-12*
