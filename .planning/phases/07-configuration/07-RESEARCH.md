# Phase 7: Configuration - Research

**Researched:** 2026-02-17
**Domain:** Per-checkpoint agent assignment in config.json for co-planner configuration
**Confidence:** HIGH

## Summary

Phase 7 extends the existing `co_planners` config section (built in Phase 6 with `enabled` and `timeout_ms`) to support per-checkpoint agent assignment. The work has three distinct concerns: (1) a config resolution function (`getAgentsForCheckpoint`) that implements the fallback chain (checkpoint-specific agents -> global agents list -> empty), (2) schema extension of config.json and the config template, and (3) extending the `/gsd:settings` command to let users configure co-planner agents and checkpoints via AskUserQuestion.

The implementation is straightforward because the codebase already has an exact precedent: the `adversary.checkpoints` config structure and the inline `node -e` config reading pattern used at all four checkpoint locations. Phase 7 follows the same structural pattern but for a different purpose (which agents to invoke rather than whether to challenge). Zero new dependencies are needed. All changes are within existing files: `gsd-tools.cjs`, `get-shit-done/templates/config.json`, and `commands/gsd/settings.md`.

**Primary recommendation:** Add a `getAgentsForCheckpoint(cwd, checkpointName)` function to gsd-tools.cjs next to the existing `checkKillSwitch()`, expose it as a `coplanner agents <checkpoint>` subcommand, and extend the settings command with co-planner questions. The function returns an array of agent names (validated against `SUPPORTED_CLIS`) that Phase 8 workflows will iterate over for invocation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hybrid approach: global `agents` list + optional per-checkpoint overrides in `checkpoints` object
- 4 configurable checkpoints: `requirements`, `roadmap`, `plan`, `verification`
- Per-checkpoint config controls agents list only -- timeout and other settings stay global
- Schema extends existing `co_planners` section (which already has `enabled` and `timeout_ms`)
- Fallback chain: checkpoint-specific agents -> global agents list -> skip (no agents)
- Missing agent at runtime: skip with warning, continue workflow (consistent with Phase 6 graceful degradation)
- Enabled but empty config (no agents anywhere): warn once per session -- "co_planners enabled but no agents configured"
- Primary: JSON editing is source of truth + CLI convenience commands for validation
- Extend existing `/gsd:settings` command -- no new commands
- UX: multi-choice questions with AskUserQuestion -- consistent with existing settings flow, agent/checkpoint discovery built in
- Validate on config load (every command that reads config)
- Severity: warn and continue -- invalid co-planner config doesn't block commands
- Validate both agent names (against known adapters: codex, gemini, opencode) and checkpoint names (against the 4 defined checkpoints)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gsd-tools.cjs` | Existing | Config resolution function + new `coplanner agents` subcommand | Central tool binary. All co-planner operations already live here (detect, invoke, enabled). Adding `agents` subcommand follows established `coplanner` command group pattern. |
| `.planning/config.json` | Existing | Store per-checkpoint agent assignments | Established pattern. `co_planners` section already exists with `enabled` and `timeout_ms`. Schema extends in place. |
| `get-shit-done/templates/config.json` | Existing | Default config template for new projects | Template must match the full schema so new projects get sensible defaults. |
| `commands/gsd/settings.md` | Existing | Interactive settings UI | Already handles adversary checkpoints with AskUserQuestion multi-select. Co-planner settings follow the same interaction pattern. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SUPPORTED_CLIS` constant | Existing (line 254) | Validate agent names | Reuse the existing `['codex', 'gemini', 'opencode']` array as the single source of truth for valid agent names. |
| `loadAdapter()` function | Existing (line 256) | Verify adapter exists at resolution time | Optional: can verify agent has a matching adapter file, but Phase 6 already handles missing adapters gracefully. |
| `cmdConfigGet`/`cmdConfigSet` | Existing (line 692/737) | Dot-notation config read/write | Users can set `co_planners.agents` or `co_planners.checkpoints.plan.agents` via CLI. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getAgentsForCheckpoint()` in gsd-tools.cjs | Inline `node -e` in workflows (like adversary) | A dedicated function is reusable. The adversary uses inline `node -e` because it reads `enabled + max_rounds` (two values). Agent resolution is simpler (just an array) but will be called at 4 checkpoints across 3 workflow files. Centralizing prevents copy-paste drift. |
| New `coplanner agents <checkpoint>` subcommand | Extend `coplanner enabled` to also return agents | Clean separation of concerns. `enabled` returns kill switch status. `agents` returns resolved agent list for a specific checkpoint. Phase 8 needs both: check enabled first, then get agents. |
| Inline validation in `getAgentsForCheckpoint` | Separate validation-only command | Validation is lightweight (array filter + warning). No need for a standalone validation command. Validate during resolution. |

**Installation:**
```bash
# No installation needed -- zero new dependencies
# All changes are within existing files
```

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
  bin/
    gsd-tools.cjs              # MODIFY: add getAgentsForCheckpoint(), cmdCoplannerAgents(), validation
    adapters/                   # UNCHANGED: codex.cjs, gemini.cjs, opencode.cjs
  templates/
    config.json                 # MODIFY: add agents + checkpoints to co_planners section
commands/gsd/
  settings.md                   # MODIFY: add co-planner settings questions
```

### Pattern 1: Config Resolution with Fallback Chain
**What:** A function that resolves which agents to invoke for a given checkpoint, implementing the three-level fallback: checkpoint-specific -> global -> empty.
**When to use:** Every time a workflow checkpoint needs to know which co-planner agents to call.
**Example:**
```javascript
// Source: Follows checkKillSwitch() pattern at line 266 of gsd-tools.cjs

const VALID_CHECKPOINTS = ['requirements', 'roadmap', 'plan', 'verification'];

function getAgentsForCheckpoint(cwd, checkpointName) {
  // Validate checkpoint name
  if (!VALID_CHECKPOINTS.includes(checkpointName)) {
    return { agents: [], warnings: ['Unknown checkpoint: ' + checkpointName] };
  }

  const warnings = [];

  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const cp = config.co_planners || {};

    // Kill switch check (reuse checkKillSwitch logic inline)
    if (!cp.enabled) {
      return { agents: [], warnings: [] };
    }

    // Level 1: checkpoint-specific agents
    if (cp.checkpoints && cp.checkpoints[checkpointName] &&
        Array.isArray(cp.checkpoints[checkpointName].agents) &&
        cp.checkpoints[checkpointName].agents.length > 0) {
      const validated = validateAgentNames(cp.checkpoints[checkpointName].agents, warnings);
      return { agents: validated, warnings };
    }

    // Level 2: global agents list
    if (Array.isArray(cp.agents) && cp.agents.length > 0) {
      const validated = validateAgentNames(cp.agents, warnings);
      return { agents: validated, warnings };
    }

    // Level 3: no agents configured
    warnings.push('co_planners enabled but no agents configured');
    return { agents: [], warnings };
  } catch {
    return { agents: [], warnings: [] };
  }
}

function validateAgentNames(agents, warnings) {
  const valid = [];
  for (const agent of agents) {
    if (SUPPORTED_CLIS.includes(agent)) {
      valid.push(agent);
    } else {
      warnings.push('Unknown agent "' + agent + '" -- skipped. Valid: ' + SUPPORTED_CLIS.join(', '));
    }
  }
  return valid;
}
```

### Pattern 2: Config Schema Extension (Additive, Non-Breaking)
**What:** Extend the existing `co_planners` object with `agents` (array) and `checkpoints` (object with per-checkpoint agent overrides).
**When to use:** In both the config template and any existing config.json files.
**Example:**
```json
{
  "co_planners": {
    "enabled": false,
    "timeout_ms": 120000,
    "agents": ["codex"],
    "checkpoints": {
      "requirements": { "agents": ["codex"] },
      "roadmap": { "agents": ["codex"] },
      "plan": { "agents": ["codex", "gemini"] },
      "verification": { "agents": ["gemini"] }
    }
  }
}
```

**Key design properties:**
- `agents` and `checkpoints` are optional. Missing = empty = skip.
- `checkpoints` object keys must be from `VALID_CHECKPOINTS`. Unknown keys generate warnings.
- Each checkpoint value is an object with an `agents` array (not a bare array), matching the adversary pattern where checkpoints can hold multiple settings.
- Existing configs without `agents`/`checkpoints` continue working (backward compatible).

### Pattern 3: Adversary Config Reading Precedent
**What:** The adversary already uses per-checkpoint config with an identical structural pattern. The co-planner config mirrors it.
**When to use:** As a reference for how the config is consumed in workflow files.
**Existing adversary pattern (from new-project.md line 875):**
```bash
CHECKPOINT_NAME="requirements"
CHECKPOINT_CONFIG=$(node -e "
  try {
    const c = JSON.parse(require('fs').readFileSync('.planning/config.json', 'utf8'));
    const adv = c.adversary || {};
    if (adv.enabled === false) { console.log('false|3'); process.exit(0); }
    const cp = adv.checkpoints?.[process.argv[1]];
    // ... resolve enabled + rounds
  } catch(e) { console.log('true|3'); }
" "$CHECKPOINT_NAME" 2>/dev/null || echo "true|3")
```

**Equivalent co-planner pattern for Phase 8 (designed now, implemented in Phase 8):**
```bash
CHECKPOINT_NAME="plan"
CO_PLANNER_AGENTS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner agents "$CHECKPOINT_NAME")
# Returns JSON: { "agents": ["codex", "gemini"], "warnings": [] }
```

**Why centralize instead of inline:** The adversary inline pattern works but creates copy-paste across 4 checkpoint locations in 3 files. A gsd-tools.cjs command is called once per checkpoint, returns JSON, and is testable. Phase 8 needs agent lists (not just boolean+number), making the return value more complex.

### Pattern 4: Settings Command Extension
**What:** Add co-planner configuration questions to `/gsd:settings` following the existing adversary settings pattern.
**When to use:** When user runs `/gsd:settings`.
**Example flow:**
```
AskUserQuestion([
  {
    question: "Enable external co-planners?",
    header: "Co-Planners",
    multiSelect: false,
    options: [
      { label: "Yes", description: "External CLIs review artifacts at checkpoints" },
      { label: "No (Default)", description: "Workflow runs with Claude only" }
    ]
  },
  // ONLY show if co-planners = "Yes":
  {
    question: "Which external agents to use globally?",
    header: "Co-Planner Agents",
    multiSelect: true,
    options: [
      { label: "codex", description: "OpenAI Codex CLI" },
      { label: "gemini", description: "Google Gemini CLI" },
      { label: "opencode", description: "OpenCode CLI" }
    ]
  },
  // ONLY show if co-planners = "Yes":
  {
    question: "Configure per-checkpoint agent overrides?",
    header: "Checkpoint Overrides",
    multiSelect: false,
    options: [
      { label: "No", description: "Use global agents at all checkpoints" },
      { label: "Yes", description: "Choose different agents for different checkpoints" }
    ]
  },
  // ONLY show if overrides = "Yes", repeat for each checkpoint:
  {
    question: "Agents for 'plan' checkpoint?",
    header: "Plan Checkpoint",
    multiSelect: true,
    options: [
      { label: "codex", ... },
      { label: "gemini", ... },
      { label: "opencode", ... }
    ]
  }
])
```

### Anti-Patterns to Avoid
- **Validating agents against installed CLIs (detection) during config load:** Validation should check agent names against `SUPPORTED_CLIS` (known adapter names), NOT against detected/installed CLIs. Detection is expensive (spawns processes) and belongs at invocation time (Phase 8). Config validation is about schema correctness, not runtime availability.
- **Storing timeout per checkpoint:** The decision locks timeout as global-only. Do not add `timeout_ms` to per-checkpoint config. One timeout for all CLIs at all checkpoints keeps the config simple.
- **Breaking backward compatibility:** Existing configs have only `enabled` and `timeout_ms`. The new `agents` and `checkpoints` fields must be optional. A config with just `enabled: true` should work (but warn about no agents).
- **Creating a new command for settings:** The decision locks extending `/gsd:settings`. Do not create a `/gsd:co-planner-settings` command.
- **Config template with all checkpoints populated:** The template should show the schema structure but default to a minimal state (global agents only, no per-checkpoint overrides). Users add overrides as needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dot-notation config access | Custom traversal for `co_planners.checkpoints.plan.agents` | Existing `cmdConfigGet`/`cmdConfigSet` (line 692) | Already supports nested dot-notation paths. Users can `config-set co_planners.checkpoints.plan.agents '["codex","gemini"]'` |
| Agent name validation | Custom regex or string matching | Filter against `SUPPORTED_CLIS` array (line 254) | Single source of truth. When a new CLI adapter is added, updating `SUPPORTED_CLIS` propagates to validation automatically. |
| Config file reading | New config loader | Existing `loadConfig()` pattern (line 166) + direct `fs.readFileSync` as used in `checkKillSwitch()` | `loadConfig()` returns flattened values for common settings. For co-planners, use direct JSON parsing like `checkKillSwitch()` does (reads the nested `co_planners` object in full). |
| Settings UI interaction | Custom prompt/input handling | AskUserQuestion tool (already used in settings.md) | Claude Code built-in tool. Handles multi-select, descriptions, headers. Already proven in adversary checkpoint settings. |

**Key insight:** Phase 7 is a configuration-only phase. It does not invoke any CLIs. It adds the ability to specify WHICH agents should be invoked WHERE. The actual invocation happens in Phase 8. This means Phase 7 has no runtime dependencies -- it is pure config schema, resolution logic, and settings UI.

## Common Pitfalls

### Pitfall 1: Config Template vs Live Config Drift
**What goes wrong:** The config template (`get-shit-done/templates/config.json`) and the existing live config (`.planning/config.json`) have different schemas after adding `agents` and `checkpoints`. New projects get the new schema; existing projects do not.
**Why it happens:** `config.json` is only created once (during `/gsd:new-project`). There is no migration mechanism.
**How to avoid:** The `getAgentsForCheckpoint()` function must handle missing `agents` and `checkpoints` fields gracefully (already part of the fallback chain design). The settings command should be able to CREATE these fields if they do not exist. Existing configs work without migration -- the fallback chain naturally handles missing fields.
**Warning signs:** `co_planners.enabled: true` but no agents configured and no warning shown.

### Pitfall 2: Array vs String Type Confusion in config-set
**What goes wrong:** `cmdConfigSet` (line 692) parses values as boolean, number, or string. Setting `co_planners.agents` to `["codex","gemini"]` via CLI would be stored as a string, not an array.
**Why it happens:** `cmdConfigSet` does not parse JSON arrays/objects -- it handles primitives only.
**How to avoid:** For array values, users should edit config.json directly (which is the "source of truth" per the locked decision). The `/gsd:settings` command writes arrays correctly via `JSON.stringify`. Document that `config-set` works for primitive values only; use settings command or direct editing for arrays. Alternatively, detect JSON array syntax in `cmdConfigSet` and `JSON.parse` it.
**Warning signs:** `co_planners.agents` is `"[\"codex\"]"` (string) instead of `["codex"]` (array).

### Pitfall 3: Empty Checkpoints Object Misinterpreted
**What goes wrong:** User creates `"checkpoints": {}` in config. The resolution function sees `checkpoints` exists but has no entries, falls through to global agents. This is correct behavior but may confuse users who think an empty checkpoints block means "no agents at any checkpoint."
**Why it happens:** Ambiguity between "no overrides specified" (use global) and "explicitly no agents at any checkpoint" (use empty arrays).
**How to avoid:** The fallback chain is explicit: checkpoint-specific agents -> global agents -> empty. An empty `checkpoints` object means "no overrides" (falls through to global). To disable agents at a specific checkpoint, set `"agents": []` for that checkpoint. Document this distinction in the settings command output.
**Warning signs:** User sets `"checkpoints": {}` expecting it to disable all agents, but global agents still run.

### Pitfall 4: Validation Blocking Config Load
**What goes wrong:** Strict validation of co-planner config causes `loadConfig()` or commands to fail/error instead of warn-and-continue.
**Why it happens:** The locked decision says "warn and continue" but developer instinct is to throw on invalid config.
**How to avoid:** Every validation issue produces a warning (added to the `warnings` array in the return value), never an error that stops execution. Unknown agent names are filtered out with a warning. Unknown checkpoint names generate a warning. Malformed `agents` (not an array) is treated as empty with a warning. The command still succeeds.
**Warning signs:** Commands fail with "Invalid config" errors when co_planners section has typos.

### Pitfall 5: Settings Command Conditional Question Ordering
**What goes wrong:** The co-planner settings questions should only appear when co-planners are enabled, and per-checkpoint questions should only appear when the user opts into overrides. But AskUserQuestion presents all questions at once.
**Why it happens:** The adversary settings in the current `settings.md` use comments like "ONLY show if adversary = 'Yes'" but the command presents all questions in one block. The orchestrator (Claude) is expected to conditionally include questions based on prior answers.
**How to avoid:** Follow the exact same pattern as the adversary settings: present the enable toggle first, then conditionally present agent/checkpoint questions only if enabled. The settings command is executed by Claude as an orchestrator, so conditional logic works naturally in the prompt instructions. No programmatic branching needed.
**Warning signs:** User sees co-planner checkpoint questions even when co-planners are disabled.

## Code Examples

Verified patterns from codebase investigation:

### getAgentsForCheckpoint() Function
```javascript
// Source: Follows checkKillSwitch() at gsd-tools.cjs line 266

const VALID_CHECKPOINTS = ['requirements', 'roadmap', 'plan', 'verification'];

function getAgentsForCheckpoint(cwd, checkpointName) {
  const warnings = [];

  // Validate checkpoint name
  if (checkpointName && !VALID_CHECKPOINTS.includes(checkpointName)) {
    warnings.push('Unknown checkpoint "' + checkpointName + '". Valid: ' + VALID_CHECKPOINTS.join(', '));
    return { agents: [], warnings };
  }

  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const cp = config.co_planners || {};

    // Check kill switch (consistent with checkKillSwitch but without env var --
    // env var is checked separately at invocation time in Phase 8)
    if (!cp.enabled) {
      return { agents: [], warnings: [] };
    }

    // Level 1: checkpoint-specific agents
    if (checkpointName && cp.checkpoints && cp.checkpoints[checkpointName]) {
      const cpConfig = cp.checkpoints[checkpointName];
      if (Array.isArray(cpConfig.agents) && cpConfig.agents.length > 0) {
        const validated = filterValidAgents(cpConfig.agents, warnings);
        return { agents: validated, warnings };
      }
    }

    // Level 2: global agents list
    if (Array.isArray(cp.agents) && cp.agents.length > 0) {
      const validated = filterValidAgents(cp.agents, warnings);
      return { agents: validated, warnings };
    }

    // Level 3: no agents configured
    warnings.push('co_planners enabled but no agents configured');
    return { agents: [], warnings };
  } catch {
    return { agents: [], warnings: [] };
  }
}

function filterValidAgents(agents, warnings) {
  const valid = [];
  for (const agent of agents) {
    if (typeof agent === 'string' && SUPPORTED_CLIS.includes(agent)) {
      valid.push(agent);
    } else {
      warnings.push('Unknown agent "' + agent + '" skipped. Valid: ' + SUPPORTED_CLIS.join(', '));
    }
  }
  return valid;
}
```

### coplanner agents Subcommand
```javascript
// Source: Follows cmdCoplannerDetect/cmdCoplannerEnabled pattern at line 4881

function cmdCoplannerAgents(cwd, checkpointName, raw) {
  const result = getAgentsForCheckpoint(cwd, checkpointName);
  if (raw) {
    if (result.agents.length > 0) {
      output(result, true, result.agents.join(', ') + '\n');
    } else {
      const msg = result.warnings.length > 0
        ? 'none (' + result.warnings[0] + ')\n'
        : 'none\n';
      output(result, true, msg);
    }
  } else {
    output(result, false);
  }
}
```

### CLI Router Extension
```javascript
// Source: Extends coplanner case at gsd-tools.cjs line 5353

case 'coplanner': {
  const subCmd = args[1];
  switch (subCmd) {
    case 'detect': { /* existing */ break; }
    case 'invoke': { /* existing */ break; }
    case 'enabled': { /* existing */ break; }
    case 'agents': {
      const checkpoint = args[2] || null;
      cmdCoplannerAgents(cwd, checkpoint, raw);
      break;
    }
    default:
      error('Unknown coplanner subcommand: ' + subCmd + '. Use: detect, invoke, enabled, agents');
  }
  break;
}
```

### Config Template Update
```json
{
  "co_planners": {
    "enabled": false,
    "timeout_ms": 120000,
    "agents": [],
    "checkpoints": {}
  }
}
```

The template uses `"agents": []` (empty array) rather than a populated list. This means:
- New projects start with co-planners disabled AND no agents configured
- User must both enable AND add agents -- double opt-in prevents accidental CLI invocation
- Settings command populates the arrays

### Settings Command Extension (Additions to settings.md)
```markdown
## Co-Planner Settings (after adversary settings)

**Read co-planner state:**
- Check `co_planners.enabled` -- currently enabled or not
- Check `co_planners.agents` -- currently configured global agents
- Check `co_planners.checkpoints` -- any per-checkpoint overrides
- Run `gsd-tools.cjs coplanner detect --raw` to discover which CLIs are installed

**Present co-planner toggle:**
{
  question: "Enable external co-planners? (external CLIs review artifacts)",
  header: "Co-Planners",
  multiSelect: false,
  options: [
    { label: "No (Default)", description: "Workflow runs with Claude only" },
    { label: "Yes", description: "External CLIs review artifacts at checkpoints" }
  ]
}

// ONLY if co-planners = "Yes":
// Filter options to only show INSTALLED agents (from detect)

{
  question: "Which external agents to use as default?",
  header: "Global Agents",
  multiSelect: true,
  options: [
    // Only include agents where detect shows available: true
    { label: "codex", description: "OpenAI Codex CLI (installed)" },
    { label: "gemini", description: "Google Gemini CLI (not installed)" },
    // ...
  ]
}

// ONLY if co-planners = "Yes":
{
  question: "Use different agents at specific checkpoints?",
  header: "Per-Checkpoint Overrides",
  multiSelect: false,
  options: [
    { label: "No", description: "Same agents everywhere" },
    { label: "Yes", description: "Configure each checkpoint separately" }
  ]
}

// ONLY if overrides = "Yes": one question per checkpoint
```

### Validation on Config Load Pattern
```javascript
// Source: Conceptual -- validation integrated into getAgentsForCheckpoint

// Validation happens naturally:
// 1. Agent names checked against SUPPORTED_CLIS -> unknown names produce warnings
// 2. Checkpoint names checked against VALID_CHECKPOINTS -> unknown keys produce warnings
// 3. Type checks: agents must be array, checkpoints must be object
// 4. All validation is non-blocking: invalid entries filtered out, warnings collected

// Additional validation for settings.md (on write):
// - Ensure checkpoints object only contains valid checkpoint names
// - Ensure agents arrays only contain valid agent names
// - Warn about agents that are configured but not installed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `co_planners.enabled` only (Phase 6) | Per-checkpoint agent assignment (Phase 7) | Phase 7 | Users can route specific agents to specific checkpoints (e.g., codex for planning, gemini for verification) |
| Adversary uses inline `node -e` for config reading | Co-planners use `gsd-tools.cjs coplanner agents` command | Phase 7 | Centralized, testable config resolution. Avoids copy-paste across 4 checkpoints in 3 workflow files. |
| No agent configuration in settings UI | Settings command includes co-planner toggle, agent selection, and checkpoint overrides | Phase 7 | Users configure co-planners alongside other workflow settings in one command |

**Deprecated/outdated:**
- The Phase 6 `co_planners` section with only `enabled` and `timeout_ms` is not deprecated -- it is extended. The new `agents` and `checkpoints` fields are additive. Configs without them continue to work.

## Open Questions

1. **Should `coplanner agents` include the kill switch check?**
   - What we know: The function currently returns empty agents when `enabled: false`. This means Phase 8 workflows only need to call `coplanner agents <checkpoint>` -- they do not need a separate `coplanner enabled` check first.
   - What's unclear: Whether `GSD_CO_PLANNERS` env var should also be checked in `getAgentsForCheckpoint()` or only at invocation time. Currently `checkKillSwitch()` handles the env var, and `getAgentsForCheckpoint()` only reads `config.co_planners.enabled`.
   - Recommendation: Include env var check in `getAgentsForCheckpoint()` by calling `checkKillSwitch()` internally. This gives Phase 8 a single call: `coplanner agents <checkpoint>` returns the resolved list considering both env var and config. If disabled by either, returns empty.

2. **Should config-set handle array values?**
   - What we know: `cmdConfigSet` (line 692) parses `true`, `false`, and numbers. Setting an array value like `co_planners.agents` requires either direct JSON editing or the settings command.
   - What's unclear: Whether adding JSON array parsing to `cmdConfigSet` is in scope for Phase 7 or should be deferred.
   - Recommendation: OUT OF SCOPE for Phase 7. The locked decision says "JSON editing is source of truth." Users edit arrays in config.json directly or use `/gsd:settings`. Adding array parsing to `cmdConfigSet` is a general improvement, not specific to co-planners.

3. **Config template: empty agents or example agents?**
   - What we know: The template sets `enabled: false`. If it also sets `agents: ["codex"]`, users might not realize they need to configure agents when they flip `enabled: true`.
   - What's unclear: Whether showing `agents: []` or `agents: ["codex"]` gives better UX for new users.
   - Recommendation: Use `"agents": []` in the template. This makes the double opt-in explicit: users must both enable AND configure agents. The settings command handles both. An empty array with enabled:false is the safest default.

## Sources

### Primary (HIGH confidence)
- `gsd-tools.cjs` source (lines 166-286, 4879-4950, 5353-5381) -- existing loadConfig, checkKillSwitch, SUPPORTED_CLIS, loadAdapter, coplanner command group, CLI router
- `get-shit-done/templates/config.json` -- current config template with co_planners section
- `commands/gsd/settings.md` -- existing settings command with adversary checkpoint pattern
- `commands/gsd/new-project.md` (line 875) -- adversary checkpoint config reading pattern
- `commands/gsd/plan-phase.md` (line 477) -- adversary checkpoint config reading pattern
- `commands/gsd/execute-phase.md` (line 118) -- adversary checkpoint config reading pattern
- `get-shit-done/bin/adapters/*.cjs` -- three adapter modules with detect/invoke/CLI_NAME exports
- `.planning/config.json` -- live project config showing current co_planners section
- `.planning/phases/06-foundation/06-01-SUMMARY.md` and `06-02-SUMMARY.md` -- Phase 6 implementation details
- `.planning/ROADMAP.md` -- Phase 7 success criteria and Phase 8 dependency on Phase 7
- `.planning/REQUIREMENTS.md` -- CFG-01 requirement definition

### Secondary (MEDIUM confidence)
- `.planning/phases/06-foundation/06-RESEARCH.md` -- Phase 6 research with adapter architecture and config patterns
- `agents/gsd-adversary.md` -- adversary agent showing checkpoint-specific challenge categories

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase artifacts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all changes to existing files, patterns verified in codebase
- Architecture: HIGH -- direct precedent in adversary checkpoint config, adapter loading pattern established in Phase 6
- Pitfalls: HIGH -- identified from actual codebase patterns (config-set limitation, fallback chain edge cases, settings command flow)
- Config schema: HIGH -- matches the locked decision from CONTEXT.md, verified compatible with existing config structures

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- config schema is internal to GSD, not dependent on external libraries)

---
*Phase: 07-configuration*
*Research for: Per-checkpoint agent assignment in config.json*
