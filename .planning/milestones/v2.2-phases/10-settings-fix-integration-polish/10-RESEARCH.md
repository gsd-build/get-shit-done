# Phase 10: Settings Fix & Integration Polish - Research

**Researched:** 2026-02-17
**Domain:** CLI tool integration, settings command frontmatter, config initialization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Inline badges on agent options: "codex (installed)" / "gemini (not installed)" / "opencode (status unknown)"
- Users can select agents marked as not-installed -- show warning note: "These will be skipped until installed"
- Detection runs once when user toggles co-planners to "Yes" (not on settings start)
- Show "Detecting installed CLIs..." message before results appear
- If detection fails or times out, proceed with "status unknown" badge -- never block the settings flow
- Partial results shown independently per CLI (mix of installed/unknown/not installed is fine)
- No retry logic -- single attempt, then proceed with whatever results are available
- cmdConfigEnsureSection always includes co_planners section on config creation
- Minimal defaults: just `enabled: false` and `timeout_ms: 120000` (no agents or checkpoints keys)
- Settings flow auto-adds co_planners section if missing when config is opened (upgrade path for existing configs)
- Expanded coplanner section listing all subcommands: detect, invoke, enabled, agents, invoke-all
- Each subcommand gets a one-line description
- Brief config key hints per subcommand (e.g., "invoke-all reads from co_planners.checkpoints")
- Document --raw flag support where applicable (detect, invoke, invoke-all)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

Phase 10 closes four specific gaps from the v2.2 milestone audit. The work is entirely within existing files -- no new files need to be created. There are three distinct change sites: (1) the settings command frontmatter needs `Bash` added to `allowed-tools` so it can execute `coplanner detect --raw`, (2) the `cmdConfigEnsureSection` function in `gsd-tools.cjs` needs a `co_planners` section added to its hardcoded defaults, and (3) the docstring at the top of `gsd-tools.cjs` needs the coplanner subcommand list expanded to include `agents` and `invoke-all`.

A secondary change site is the settings workflow file (`get-shit-done/workflows/settings.md`), which is completely out of sync with the settings command -- it lacks all co-planner, adversary, and detection UI. However, this workflow file is **unreferenced** (no command `@includes` it), so it may be considered dead code. The planner should decide whether to update or ignore it.

**Primary recommendation:** Make the three targeted fixes in `commands/gsd/settings.md` (frontmatter), `get-shit-done/bin/gsd-tools.cjs` (docstring + cmdConfigEnsureSection), then update the settings command's co-planner agent options to include inline detection badges per the locked decisions.

## Standard Stack

### Core
No new libraries needed. All changes are to existing files using existing Node.js stdlib (`child_process`, `fs`, `path`).

| Component | File | Purpose | Change Type |
|-----------|------|---------|-------------|
| settings.md | `commands/gsd/settings.md` | Settings slash command | Frontmatter + process update |
| gsd-tools.cjs | `get-shit-done/bin/gsd-tools.cjs` | CLI utility | Docstring + function fix |

### Supporting
No supporting libraries. The `coplanner detect` command already exists and works -- it just cannot be called from settings.md because the `Bash` tool is missing from `allowed-tools`.

### Alternatives Considered
None applicable -- this is a fix/polish phase, not a new feature.

**Installation:**
```bash
# No new dependencies
```

## Architecture Patterns

### Affected File Map
```
commands/gsd/
  settings.md              # Fix 1: add Bash to allowed-tools
                           # Fix 2: add detection badges to co-planner agent options

get-shit-done/bin/
  gsd-tools.cjs            # Fix 3: expand coplanner docstring (lines 121-125)
                           # Fix 4: add co_planners to cmdConfigEnsureSection defaults (lines 722-736)

get-shit-done/workflows/
  settings.md              # STALE: unreferenced workflow, out of sync (optional cleanup)
```

### Pattern 1: Frontmatter allowed-tools
**What:** Claude Code slash commands declare their permitted tools in YAML frontmatter under `allowed-tools:`
**When to use:** When a command needs access to a tool it currently lacks
**Current state of settings.md:**
```yaml
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
```
**Required state:**
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
```
**Source:** Verified from `commands/gsd/settings.md` lines 1-8. All other commands that run CLI tools include `Bash` in their frontmatter.

### Pattern 2: cmdConfigEnsureSection Default Structure
**What:** When creating a fresh `config.json`, the function uses hardcoded defaults merged with user-level defaults from `~/.gsd/defaults.json`.
**Current hardcoded defaults (lines 722-736):**
```javascript
const hardcoded = {
  model_profile: 'balanced',
  commit_docs: true,
  search_gitignored: false,
  branching_strategy: 'none',
  phase_branch_template: 'gsd/phase-{phase}-{slug}',
  milestone_branch_template: 'gsd/{milestone}-{slug}',
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
  },
  parallelization: true,
  brave_search: hasBraveSearch,
};
```
**Missing:** `co_planners` section (and `adversary` section, though that's not in scope).
**Template reference:** `get-shit-done/templates/config.json` already includes:
```json
"co_planners": {
  "enabled": false,
  "timeout_ms": 120000,
  "agents": [],
  "checkpoints": {}
}
```
**Locked decision:** Minimal defaults -- just `enabled: false` and `timeout_ms: 120000` (no agents or checkpoints keys).

### Pattern 3: coplanner detect Output Format
**What:** The `coplanner detect` command returns structured JSON (default) or table format (`--raw`).
**JSON output:**
```json
{
  "codex": { "available": true, "version": "0.1.2", "error": null },
  "gemini": { "available": false, "version": null, "error": "NOT_FOUND" },
  "opencode": { "available": false, "version": null, "error": "NOT_FOUND" }
}
```
**Mapping to badges:**
- `available: true` -> "(installed)"
- `available: false` + error `NOT_FOUND` -> "(not installed)"
- `available: false` + error `TIMEOUT` or `EXIT_ERROR` or `PERMISSION` -> "(status unknown)"
- adapter detection failure (`NO_ADAPTER`) -> "(status unknown)"

### Pattern 4: Settings Process - Detection Timing
**What:** Detection runs only when user toggles co-planners to "Yes", not at settings startup.
**Process flow:**
1. Present all settings questions (co-planner toggle is question ~9)
2. If user selects "Yes" for co-planners:
   a. Run `node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner detect --raw`
   b. Parse JSON output
   c. Map `available` field to badge text
   d. Present agent selection with badges
3. If user selects "No", skip detection entirely

**Source:** The current settings.md already documents this flow at lines 143-156 with the comment "First detect which CLIs are installed."

### Anti-Patterns to Avoid
- **Running detection at settings start:** Detection takes time (3x CLI exec). Only run when user says "Yes" to co-planners.
- **Blocking on detection failure:** Never fail the settings flow because detection timed out or errored. Use "status unknown" badge and continue.
- **Modifying the settings workflow file:** `get-shit-done/workflows/settings.md` is unreferenced dead code. Updating it adds risk with zero value unless explicitly cleaning up dead code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI detection | Custom which/where logic | `coplanner detect` subcommand | Already handles all 3 CLIs, error classification, timeouts |
| JSON parsing | String manipulation | `JSON.parse()` on detect output | Detect outputs clean JSON by default (non-raw mode) |
| Config defaults | Manual object construction | Merge pattern with `...hardcoded` | Matches existing `cmdConfigEnsureSection` pattern |

**Key insight:** All detection, invocation, and config logic already exists. This phase only wires existing infrastructure together and fixes documentation gaps.

## Common Pitfalls

### Pitfall 1: Settings Workflow vs Settings Command Confusion
**What goes wrong:** Updating the wrong settings file
**Why it happens:** There are TWO settings files -- `commands/gsd/settings.md` (the active command) and `get-shit-done/workflows/settings.md` (dead code)
**How to avoid:** Only modify `commands/gsd/settings.md`. The workflow file is unreferenced.
**Warning signs:** If you see `auto_advance` or "save as defaults" -- you're in the workflow file.

### Pitfall 2: Overloading cmdConfigEnsureSection Defaults
**What goes wrong:** Adding too many keys to the co_planners section defaults
**Why it happens:** Template has `agents: []` and `checkpoints: {}` -- tempting to match
**How to avoid:** Locked decision: minimal defaults -- only `enabled: false` and `timeout_ms: 120000`
**Warning signs:** If the diff adds `agents` or `checkpoints` to the hardcoded defaults

### Pitfall 3: Breaking the Merge Pattern
**What goes wrong:** The `cmdConfigEnsureSection` merge of hardcoded + userDefaults breaks when co_planners is added
**Why it happens:** The current merge is shallow: `{ ...hardcoded, ...userDefaults }` with only `workflow` getting a deep merge
**How to avoid:** Add `co_planners` to the deep merge list, same pattern as `workflow`
**Warning signs:** User defaults for co_planners overwrite all hardcoded co_planners keys

### Pitfall 4: Docstring Gets Out of Sync with Dispatch
**What goes wrong:** Docstring lists subcommands that don't match the actual switch/case
**Why it happens:** Adding to docstring without cross-referencing the dispatch at line 5559
**How to avoid:** Cross-reference the coplanner switch block (line 5559-5608) when writing docstring
**Warning signs:** The error message on line 5607 already lists all 5 subcommands correctly: `detect, invoke, invoke-all, enabled, agents`

### Pitfall 5: Badge Text Not Matching Context Decisions
**What goes wrong:** Using "unavailable" or "missing" instead of the locked badge text
**Why it happens:** Improvising instead of following locked decisions
**How to avoid:** Exact badge text from CONTEXT.md: "(installed)", "(not installed)", "(status unknown)"
**Warning signs:** Any badge text that doesn't match these three exact strings

## Code Examples

### Example 1: Adding Bash to settings.md frontmatter
```yaml
---
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
```
**Source:** Pattern verified from all other commands that run CLI tools (health.md, quick.md, etc.)

### Example 2: cmdConfigEnsureSection with co_planners
```javascript
const hardcoded = {
  model_profile: 'balanced',
  commit_docs: true,
  search_gitignored: false,
  branching_strategy: 'none',
  phase_branch_template: 'gsd/phase-{phase}-{slug}',
  milestone_branch_template: 'gsd/{milestone}-{slug}',
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
  },
  co_planners: {
    enabled: false,
    timeout_ms: 120000,
  },
  parallelization: true,
  brave_search: hasBraveSearch,
};
const defaults = {
  ...hardcoded,
  ...userDefaults,
  workflow: { ...hardcoded.workflow, ...(userDefaults.workflow || {}) },
  co_planners: { ...hardcoded.co_planners, ...(userDefaults.co_planners || {}) },
};
```
**Source:** Pattern from existing `cmdConfigEnsureSection` function, lines 722-741

### Example 3: Expanded coplanner docstring
```javascript
 * Co-Planner Operations:
 *   coplanner detect [--raw]           Detect installed CLIs (JSON default, table with --raw)
 *   coplanner invoke <cli> --prompt    Invoke a CLI adapter with prompt
 *     [--timeout N] [--model name]     Reads co_planners.timeout_ms from config
 *   coplanner invoke-all               Invoke all resolved agents in parallel
 *     --prompt-file <path>             Reads prompt from file (avoids shell quoting)
 *     [--checkpoint name]              Resolve agents from co_planners.checkpoints config
 *     [--agents a,b] [--timeout N]     Override agent list; supports --raw
 *     [--model name]
 *   coplanner enabled [--raw]          Check kill switch status and source
 *   coplanner agents [checkpoint]      List agents for checkpoint (from co_planners.agents/checkpoints)
 *     [--raw]                          Supports --raw for comma-separated output
```
**Source:** Cross-referenced with dispatch block at lines 5557-5610 and function signatures

### Example 4: Detection badge mapping in settings.md
```
// After running: node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner detect --raw
// Parse JSON result and annotate options:
// For each CLI in result:
//   available: true  -> "(installed)"
//   available: false, error NOT_FOUND -> "(not installed)"
//   available: false, other error -> "(status unknown)"
//
// Example annotated options:
{
  label: "codex (installed)", description: "OpenAI Codex CLI"
},
{
  label: "gemini (not installed)", description: "Google Gemini CLI"
},
{
  label: "opencode (status unknown)", description: "OpenCode CLI"
}
```

### Example 5: Warning note for not-installed selections
```
// If user selects an agent with "(not installed)" or "(status unknown)" badge:
// After showing results, display note:
// "Note: Agents marked as not-installed will be skipped until installed."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No co-planner support in settings | Full co-planner UI in settings.md | Phase 7 (v2.2) | Settings command has UI but cannot execute detection |
| Docstring lists 3 subcommands | 5 subcommands exist in code | Phase 9 added agents + invoke-all | Docstring stale |
| Config init has no co_planners | Template has co_planners, init does not | Phase 6-7 gap | Graceful fallback via defaults, but inconsistent |

**Deprecated/outdated:**
- `get-shit-done/workflows/settings.md` is unreferenced dead code. The active settings UI is in `commands/gsd/settings.md`.
- The old settings flow had no adversary or co-planner sections.

## Open Questions

1. **Should `get-shit-done/workflows/settings.md` be updated or removed?**
   - What we know: It's unreferenced (no `@` includes point to it). It's missing all v2.2 features (adversary, co-planners).
   - What's unclear: Whether it serves any purpose (documentation? backup?) or is truly dead code.
   - Recommendation: Leave it alone for this phase. It doesn't block any functionality. If cleanup is desired, note it as a separate follow-up.

2. **Should `adversary` section also be added to `cmdConfigEnsureSection` defaults?**
   - What we know: The template has it, the init code doesn't (same pattern as co_planners).
   - What's unclear: Whether this is a conscious omission or another gap.
   - Recommendation: Out of scope for this phase (not in audit gaps). But planner should note it as a potential follow-up.

3. **Does `--raw` work for `coplanner agents`?**
   - What we know: The `cmdCoplannerAgents` function at line 5012 does handle `raw` parameter. It outputs comma-separated agent names.
   - Recommendation: Document `--raw` support in docstring for `agents` subcommand too.

## Sources

### Primary (HIGH confidence)
- `commands/gsd/settings.md` (lines 1-8 for frontmatter, lines 131-208 for co-planner UI) - Verified current state
- `get-shit-done/bin/gsd-tools.cjs` (lines 121-126 for docstring, lines 685-750 for cmdConfigEnsureSection, lines 5557-5610 for coplanner dispatch)
- `get-shit-done/bin/adapters/codex.cjs` (lines 17-28 for detect() return format)
- `get-shit-done/templates/config.json` (lines 32-37 for co_planners template)
- `.planning/v2.2-MILESTONE-AUDIT.md` (all audit gap references)
- `get-shit-done/workflows/settings.md` (verified unreferenced via grep)

### Secondary (MEDIUM confidence)
- All `commands/gsd/*.md` files grepped for `Bash` in allowed-tools -- every command that runs CLI tools includes it

### Tertiary (LOW confidence)
None -- all findings verified from codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing code
- Architecture: HIGH - All change sites identified and verified with line numbers
- Pitfalls: HIGH - Each pitfall verified against actual code
- Detection badge mapping: HIGH - Verified from adapter detect() return format

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable -- internal project files, not external APIs)
