# Phase 10: Settings Fix & Integration Polish - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire CLI detection into the settings flow so users see which co-planner CLIs are installed before selecting them. Fix accumulated integration debt: stale docstring in gsd-tools.cjs and missing co_planners initialization in cmdConfigEnsureSection. This is gap closure from the v2.2 milestone audit.

</domain>

<decisions>
## Implementation Decisions

### CLI Detection Display
- Inline badges on agent options: "codex (installed)" / "gemini (not installed)" / "opencode (status unknown)"
- Users can select agents marked as not-installed — show warning note: "These will be skipped until installed"
- Detection runs once when user toggles co-planners to "Yes" (not on settings start)
- Show "Detecting installed CLIs..." message before results appear

### Detection Error Handling
- If detection fails or times out, proceed with "status unknown" badge — never block the settings flow
- Partial results shown independently per CLI (mix of installed/unknown/not installed is fine)
- No retry logic — single attempt, then proceed with whatever results are available

### Config Initialization
- cmdConfigEnsureSection always includes co_planners section on config creation
- Minimal defaults: just `enabled: false` and `timeout_ms: 120000` (no agents or checkpoints keys)
- Settings flow auto-adds co_planners section if missing when config is opened (upgrade path for existing configs)

### Docstring Coverage
- Expanded coplanner section listing all subcommands: detect, invoke, enabled, agents, invoke-all
- Each subcommand gets a one-line description
- Brief config key hints per subcommand (e.g., "invoke-all reads from co_planners.checkpoints")
- Document --raw flag support where applicable (detect, invoke, invoke-all)

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

*Phase: 10-settings-fix-integration-polish*
*Context gathered: 2026-02-17*
