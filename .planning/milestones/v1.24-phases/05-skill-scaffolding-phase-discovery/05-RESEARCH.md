# Phase 5: Skill Scaffolding & Phase Discovery - Research

**Researched:** 2026-03-10
**Domain:** GSD command/workflow authoring + ROADMAP.md parsing
**Confidence:** HIGH

## Summary

Phase 5 creates two markdown files (`commands/gsd/autonomous.md` and `get-shit-done/workflows/autonomous.md`) following the exact conventions used by all 31 existing commands and 25 existing workflows. No new libraries or tools are needed — this is purely convention-following content authoring plus leveraging the existing `gsd-tools.cjs roadmap analyze` and `roadmap get-phase` commands for phase discovery.

The critical discovery is a regex mismatch in `roadmap.cjs`: both `goal` and `depends_on` extraction regexes expect `**Goal:**` (colon inside bold) but the ROADMAP.md uses `**Goal**:` (colon outside bold). This means `roadmap analyze` returns `null` for both fields. The workflow must work around this by either: (a) parsing the `section` text field from `roadmap get-phase`, or (b) fixing the regex in `roadmap.cjs` as a prerequisite task.

The installer automatically converts any file in `commands/gsd/` to a Copilot skill at `.github/skills/gsd-{name}/SKILL.md`. A file named `autonomous.md` with `name: gsd:autonomous` will produce `gsd-autonomous/SKILL.md` with zero installer changes required — this is confirmed by reading the installer source code.

**Primary recommendation:** Create command + workflow files by closely mirroring `new-milestone.md` (orchestrator pattern) and fix the `roadmap.cjs` regex mismatch so phase discovery returns complete data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Command name: `gsd:autonomous` (installer generates `gsd-autonomous` skill automatically)
- Single optional flag: `[--from N]` to resume from a specific phase number
- No `--dry-run` flag — ROADMAP.md and `/gsd-progress` already serve this purpose
- No skip flags (`--skip-discuss`, `--skip-validation`) — autonomous means autonomous; use individual commands for granular control
- Minimal argument-hint: `"[--from N]"`
- Initial discovery: Use `gsd-tools.cjs roadmap analyze` for full ROADMAP parse (returns all phases + status as JSON)
- Per-phase details: Use `gsd-tools.cjs roadmap get-phase N` to get goal, requirements, success criteria
- Re-read ROADMAP.md after each phase completes to catch decimal phases (2.1) inserted mid-execution
- Skip completed phases automatically — only iterate phases with incomplete status
- On phase blocker: Pause and ask user — offer "Fix and retry" / "Skip this phase" / "Stop autonomous mode"
- Use `Skill()` flat calls (not `Task()`) for invoking discuss/plan/execute — avoids nesting issue #686
- Build own orchestration loop — do NOT reuse existing `--auto` chain mechanism (would lose control)
- Single monolithic workflow file — matches existing patterns (new-milestone.md, execute-phase.md)
- Read STATE.md fresh before each phase — don't cache state in-workflow
- GSD branded banner with milestone progress between phases: `GSD ► AUTONOMOUS ▸ Phase 6/8: [Name] [████░░░░] 75%`
- Show milestone-level progress bar (completed/total phases + percentage)
- Brief transition summaries: "Phase 5 ✅ → Phase 6: Smart Discuss" with 1-line outcome
- No elapsed time tracking

### Claude's Discretion
- Exact YAML frontmatter fields for `commands/gsd/autonomous.md` (follow existing patterns)
- Workflow internal section names and XML structure
- ROADMAP parsing implementation details (how to extract phase lists from JSON)
- Error message wording for edge cases

### Deferred Ideas (OUT OF SCOPE)
- Integration with `gsd-verify-work` for user acceptance testing (Phase 7-8)
- Smart discuss grey area proposal logic (Phase 6)
- Multi-phase orchestration loop with audit/complete/cleanup (Phase 8)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ART-01 | New command file at `commands/gsd/autonomous.md` following existing frontmatter and section patterns | Exact command file structure documented below with all 31 existing commands analyzed for pattern |
| ART-02 | New workflow file at `get-shit-done/workflows/autonomous.md` with full orchestration logic | Workflow structure documented with init bootstrap pattern, step naming, and XML structure |
| ART-03 | Command follows existing `name: gsd:autonomous` naming convention so the installer generates the Copilot skill automatically | Installer source confirmed: `commands/gsd/autonomous.md` → `.github/skills/gsd-autonomous/SKILL.md` automatically |
| ORCH-03 | System reads ROADMAP.md to discover all phases and their order, starting from the first incomplete phase | `roadmap analyze` returns phase list with disk status; regex bug found for goal/depends_on; workaround documented |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `gsd-tools.cjs` | Current | CLI tool for roadmap parsing, init bootstrap, config, state | Already used by every GSD workflow; provides structured JSON output |
| Markdown | — | Command and workflow authoring format | All 31 commands and 25 workflows use markdown with YAML frontmatter |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `gsd-tools.cjs roadmap analyze` | Full ROADMAP parse → JSON with all phases, statuses, plan counts | Initial phase discovery at workflow start |
| `gsd-tools.cjs roadmap get-phase N` | Single phase extraction → goal, success criteria, section text | Per-phase detail lookup during iteration |
| `gsd-tools.cjs init milestone-op` | Milestone-level bootstrap → version, phase counts, file existence | Workflow initialization |
| `gsd-tools.cjs config-get/config-set` | Read/write workflow configuration flags | Persisting autonomous state if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `roadmap analyze` | Manual ROADMAP.md parsing in workflow | `roadmap analyze` already does this correctly; manual parsing is error-prone and duplicative |
| `init milestone-op` | Custom init command | `milestone-op` already provides exactly what's needed; no custom init type required |

## Architecture Patterns

### Recommended File Structure
```
commands/gsd/
└── autonomous.md           # Command definition (ART-01, ART-03)

get-shit-done/workflows/
└── autonomous.md           # Workflow logic (ART-02, ORCH-03)
```

### Pattern 1: Command File Structure
**What:** YAML frontmatter + XML sections following exact existing conventions
**When to use:** Every GSD command file

**Canonical structure (from 31 existing commands):**
```markdown
---
name: gsd:autonomous
description: Run all remaining phases autonomously — discuss→plan→execute per phase
argument-hint: "[--from N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---
<objective>
[What the command does, 2-4 lines]

**Creates/Updates:**
- [artifacts list]

**After:** [what comes next]
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autonomous.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
[What $ARGUMENTS means]
[Flag descriptions]
</context>

<process>
Execute the autonomous workflow from @~/.claude/get-shit-done/workflows/autonomous.md end-to-end.
Preserve all workflow gates.
</process>
```

**Key observations from existing commands:**
- `name` field uses `gsd:` prefix (installer converts to `gsd-` for Copilot)
- `description` is a concise single line (used in skill listing)
- `argument-hint` shows user what args are expected
- `allowed-tools` is a YAML list (installer converts to comma-separated for Copilot)
- `<execution_context>` uses `@~/.claude/get-shit-done/` paths (installer rewrites these per runtime)
- `<process>` section is always short — delegates to workflow file
- Commands that orchestrate others (like `new-milestone`) include `Task` in allowed-tools
- Commands that need user input include `AskUserQuestion`

### Pattern 2: Workflow File Structure
**What:** XML-sectioned markdown with step-based process following existing conventions
**When to use:** Every GSD workflow file

**Canonical structure (from `new-milestone.md`, `execute-phase.md`):**
```markdown
<purpose>
[What this workflow does. 1-3 sentences.]
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="initialize" priority="first">
Load all context in one call:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
```

Parse JSON for: [list of fields].

[Error handling for missing data]
</step>

<step name="discover_phases">
[Phase discovery logic using roadmap analyze]
</step>

<step name="iterate_phases">
[Main orchestration loop]
</step>

</process>
```

**Key observations from existing workflows:**
- Always starts with `<purpose>` (not `<objective>`)
- `<required_reading>` section directs to load execution_context files
- `<process>` wraps numbered/named `<step>` elements
- Init commands use `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` (rewritten by installer)
- Bash code blocks show exact commands to run
- `Skill()` invocations are used for flat chaining (not `Task()` for chaining commands)
- Banner formats follow `ui-brand.md` patterns

### Pattern 3: Skill() Flat Chaining
**What:** Using `Skill()` instead of `Task()` when invoking other GSD commands to avoid deep nesting
**When to use:** When one workflow needs to invoke another workflow (discuss → plan → execute)

```
Skill(skill="gsd:discuss-phase", args="${PHASE}")
```

**Source:** `discuss-phase.md:622`, `plan-phase.md:480`, and Issue #686

**Critical:** `Task()` spawns a subagent creating deeper nesting. When chaining discuss→plan→execute, using `Task()` would create 3+ levels deep, which causes Claude runtime freezes. `Skill()` keeps everything at the same level.

### Pattern 4: Roadmap Phase Discovery (ORCH-03)
**What:** Using `roadmap analyze` + `roadmap get-phase N` to build an ordered list of incomplete phases
**When to use:** At workflow initialization and after each phase completes (re-read for decimal phases)

**`roadmap analyze` returns:**
```json
{
  "phases": [
    {
      "number": "5",
      "name": "Skill Scaffolding & Phase Discovery",
      "goal": null,           // ⚠️ BUG: null due to regex mismatch
      "depends_on": null,     // ⚠️ BUG: null due to regex mismatch
      "disk_status": "discussed",  // Values: no_directory|empty|discussed|researched|planned|partial|complete
      "roadmap_complete": false,
      "plan_count": 0,
      "summary_count": 0
    }
  ],
  "next_phase": "5",
  "current_phase": null,
  "completed_phases": 0,
  "phase_count": 4,
  "progress_percent": 0
}
```

**`roadmap get-phase N` returns:**
```json
{
  "found": true,
  "phase_number": "5",
  "phase_name": "Skill Scaffolding & Phase Discovery",
  "goal": null,              // ⚠️ Same regex bug
  "success_criteria": ["...", "..."],  // ✅ Works correctly
  "section": "### Phase 5: ...\n**Goal**: ...\n**Depends on**: ..."  // ✅ Full text available
}
```

**Incomplete phase filter:** phases where `disk_status` is NOT `"complete"` AND `roadmap_complete` is `false`.

### Anti-Patterns to Avoid
- **Using `Task()` for command chaining:** Causes deep nesting and Claude runtime freezes (Issue #686). Always use `Skill()`.
- **Caching roadmap state:** Re-read after each phase completes to detect inserted decimal phases.
- **Reusing `--auto` chain mechanism:** The existing auto-advance uses ephemeral config flags (`_auto_chain_active`). Autonomous mode needs its own independent loop — don't piggyback on this mechanism.
- **Parsing ROADMAP.md manually in the workflow:** Use `gsd-tools.cjs roadmap analyze` and `roadmap get-phase N` — they handle all the regex complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ROADMAP parsing | Custom regex in workflow | `gsd-tools.cjs roadmap analyze` | Already handles phase numbering, decimal phases, checkbox status, disk status detection |
| Phase directory discovery | Manual `ls` / `find` commands | `gsd-tools.cjs init phase-op N` | Handles zero-padding, slug normalization, file existence checks |
| Milestone context loading | Multiple `cat` commands | `gsd-tools.cjs init milestone-op` | Returns version, name, phase counts, file existence in single JSON call |
| Config read/write | Manual file editing | `gsd-tools.cjs config-get/config-set` | Handles JSON structure, nested keys, concurrent access |
| Skill-to-skill invocation | `Task()` nesting | `Skill()` flat calls | Prevents runtime freezes from deep agent nesting |

**Key insight:** The `gsd-tools.cjs` CLI already provides structured JSON access to all project metadata. The workflow should be a thin orchestration layer that calls tools and Skill(), not a reimplementation of parsing logic.

## Common Pitfalls

### Pitfall 1: Regex Mismatch in `roadmap.cjs` Goal/Depends Extraction
**What goes wrong:** `roadmap analyze` and `roadmap get-phase` return `null` for `goal` and `depends_on` fields.
**Why it happens:** The ROADMAP.md uses `**Goal**:` (colon outside bold) but the regex expects `**Goal:**` (colon inside bold). Same for `**Depends on**:`.
**How to avoid:** Fix the regex in `get-shit-done/bin/lib/roadmap.cjs` lines 120-124 (in `cmdRoadmapAnalyze`) and lines 67-68 (in `cmdRoadmapGetPhase`). Change:
```javascript
// Current (broken)
const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
const dependsMatch = section.match(/\*\*Depends on:\*\*\s*([^\n]+)/i);

// Fixed (handles both formats)
const goalMatch = section.match(/\*\*Goal(?:\*\*:|\*:|\*\*\s*:)\s*([^\n]+)/i);
const dependsMatch = section.match(/\*\*Depends on(?:\*\*:|\*:|\*\*\s*:)\s*([^\n]+)/i);
```
**Warning signs:** `goal: null` or `depends_on: null` in JSON output when ROADMAP.md clearly has these fields.
**Impact:** Without this fix, the autonomous workflow cannot programmatically extract phase goals or dependency info from `roadmap analyze`. It would need to parse the `section` text field manually — doable but fragile.

### Pitfall 2: Installer Path Rewriting
**What goes wrong:** Workflow references to `@~/.claude/get-shit-done/...` break on Copilot runtime.
**Why it happens:** The installer rewrites `@~/.claude/get-shit-done/` to `@.github/get-shit-done/` for Copilot. But `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` in bash commands is rewritten to `.github/get-shit-done/bin/gsd-tools.cjs`.
**How to avoid:** Use the exact path conventions from existing workflows:
- `execution_context` references: `@~/.claude/get-shit-done/workflows/autonomous.md`
- Bash tool paths: `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`
- Both are automatically rewritten by the installer for each runtime target.
**Warning signs:** Hardcoded absolute paths or `.github/` paths in source files.

### Pitfall 3: Missing `allowed-tools` in Command Frontmatter
**What goes wrong:** Claude agent can't use needed tools at runtime.
**Why it happens:** Copilot skills need explicit tool permissions in frontmatter.
**How to avoid:** Include all tools the autonomous workflow will need:
- `Read`, `Write`, `Bash` — file operations and CLI
- `Glob`, `Grep` — file discovery (for codebase context)
- `AskUserQuestion` — user interaction on blockers
- `Task` — spawning subagents if needed (though Skill() is preferred for chaining)
**Warning signs:** Runtime errors about tools not being available.

### Pitfall 4: Confusing disk_status values
**What goes wrong:** Workflow incorrectly determines which phases are "complete" vs "in progress".
**Why it happens:** `disk_status` has 7 distinct values with subtle meanings.
**How to avoid:** Use this classification:
- **Complete:** `disk_status === "complete"` (summaries ≥ plans, plans > 0)
- **In Progress:** `"partial"`, `"planned"`, `"researched"`, `"discussed"`
- **Not Started:** `"empty"`, `"no_directory"`
- **Skip condition:** Only skip phases where `disk_status === "complete"` AND `roadmap_complete === true`
**Warning signs:** Phases getting re-executed or skipped unexpectedly.

### Pitfall 5: `Skill()` vs `Task()` syntax
**What goes wrong:** Using wrong invocation method causes nesting freezes or incorrect argument passing.
**Why it happens:** Two similar-looking invocation methods with very different behavior.
**How to avoid:**
```
# For invoking other GSD commands (flat, same level):
Skill(skill="gsd:discuss-phase", args="5")

# For spawning subagents with custom prompts (creates new nesting level):
Task(prompt="...", subagent_type="gsd-executor", ...)
```
**Warning signs:** Claude runtime freezing, context window exhaustion, deep nesting warnings.

## Code Examples

### Example 1: Command File (autonomous.md)
Based on `new-milestone.md` and `execute-phase.md` patterns:

```markdown
---
name: gsd:autonomous
description: Run all remaining phases autonomously — discuss→plan→execute per phase
argument-hint: "[--from N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---
<objective>
Execute all remaining milestone phases autonomously. For each phase: discuss → plan → execute.
Pauses only for user decisions (grey area acceptance, blockers, validation requests).

**Uses:** ROADMAP.md phase discovery, Skill() flat invocations for each phase command.

**After:** Milestone audit → complete → cleanup (Phase 8 scope).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autonomous.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Flags: $ARGUMENTS
- `--from N` — Start from phase N instead of first incomplete phase

Context files are resolved in-workflow using init commands.
</context>

<process>
Execute the autonomous workflow from @~/.claude/get-shit-done/workflows/autonomous.md end-to-end.
Preserve all workflow gates (phase discovery, per-phase execution, blocker handling, progress display).
</process>
```

### Example 2: Workflow Init Bootstrap
Based on `execute-phase.md` and `new-milestone.md` patterns:

```markdown
<step name="initialize" priority="first">
Load milestone context:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
```

Parse JSON for: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`.

**If `roadmap_exists` is false:** Error — no ROADMAP.md found. Run `/gsd:new-milestone` first.
**If `state_exists` is false:** Error — no STATE.md found.
</step>
```

### Example 3: Phase Discovery from roadmap analyze
```markdown
<step name="discover_phases">
Get structured roadmap analysis:

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Parse JSON `phases` array. Filter to incomplete phases:
- `disk_status` is NOT `"complete"` OR `roadmap_complete` is `false`

Sort by `number` (numeric order, handling decimal phases like "2.1").

If `--from N` flag provided, skip phases with `number < N`.

For each incomplete phase, get detailed info:
```bash
PHASE_DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract from response: `phase_name`, `success_criteria`, `section` (full text for goal/depends parsing).
</step>
```

### Example 4: Skill() Invocation Pattern for Phase Chaining
Based on `discuss-phase.md:622` and `plan-phase.md:480`:

```markdown
<step name="execute_phase_pipeline">
For the current phase, run the discuss→plan→execute pipeline using flat Skill() calls:

```
Skill(skill="gsd:discuss-phase", args="${PHASE_NUM}")
```

After discuss completes, check for CONTEXT.md:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM}
```
If `has_context` is true, proceed to plan:
```
Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")
```

After plan completes, check for plans:
If `has_plans` is true, proceed to execute:
```
Skill(skill="gsd:execute-phase", args="${PHASE_NUM}")
```
</step>
```

### Example 5: Progress Banner Format
Based on CONTEXT.md decisions and `ui-brand.md`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ Phase 6/8: Smart Discuss [████░░░░] 75%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 5 ✅ Skill Scaffolding & Phase Discovery
→ Phase 6: Smart Discuss — Grey area resolution with proposed answers
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Task()` nesting for chaining | `Skill()` flat calls | Issue #686 | Prevents runtime freezes from deep agent nesting |
| Manual ROADMAP parsing | `gsd-tools.cjs roadmap analyze` | v1.23 | Structured JSON access to all phase data |
| `--auto` chain flags | Independent orchestration loops | Phase 5 decision | Autonomous mode builds own loop, doesn't reuse `_auto_chain_active` flag |

**Current but buggy:**
- `roadmap.cjs` goal/depends_on extraction: regex mismatch with `**Goal**:` format (colon outside bold). Affects both `analyze` and `get-phase` commands. Should be fixed in Phase 5 as prerequisite.

## Open Questions

1. **Roadmap regex fix scope**
   - What we know: The regex mismatch causes `goal: null` and `depends_on: null` in both `roadmap analyze` and `roadmap get-phase`
   - What's unclear: Should the fix be a dedicated task in Phase 5, or is it out of scope (autonomous workflow can parse `section` text)?
   - Recommendation: Fix it in Phase 5 as a small prerequisite task — it's a 2-line change in `roadmap.cjs` that benefits all consumers, and ORCH-03 specifically requires phase discovery to return "dependency info" per the success criteria

2. **`--from N` flag: phase number format**
   - What we know: Phase numbers can be integers ("5") or decimals ("5.1") per the roadmap conventions
   - What's unclear: Should `--from` accept decimal phases? What happens with `--from 5.1`?
   - Recommendation: Accept any format that `roadmap analyze` returns in `number` field (string comparison). The regex in `roadmap.cjs` already handles `\d+[A-Z]?(?:\.\d+)*`

3. **Scope of "Phase Discovery" for success criteria #4**
   - What we know: Success criteria says "produce an ordered list of incomplete phases with their names, numbers, and dependency info"
   - What's unclear: Is this a function/command that returns JSON, or is it workflow logic that displays a list?
   - Recommendation: It's workflow logic — the `<step name="discover_phases">` in the workflow calls `roadmap analyze`, filters, and produces the ordered list. No new CLI command needed since `roadmap analyze` already provides the raw data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js `node:test` (built-in) |
| Config file | `scripts/run-tests.cjs` (custom runner) |
| Quick run command | `node --test tests/roadmap.test.cjs` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ART-01 | `commands/gsd/autonomous.md` exists with valid frontmatter | unit | `node --test tests/commands.test.cjs` (extend existing) | ✅ (extend) |
| ART-02 | `get-shit-done/workflows/autonomous.md` exists with standard structure | unit | `node --test tests/commands.test.cjs` (extend existing) | ✅ (extend) |
| ART-03 | Installer converts `autonomous.md` → `gsd-autonomous/SKILL.md` | unit | `node --test tests/copilot-install.test.cjs` (extend existing) | ✅ (extend) |
| ORCH-03 | Phase discovery returns ordered incomplete phases with names, numbers, deps | unit | `node --test tests/roadmap.test.cjs` (extend existing) | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `node --test tests/roadmap.test.cjs tests/copilot-install.test.cjs`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/roadmap.test.cjs` — add test for `roadmap analyze` goal/depends_on extraction with both `**Goal:**` and `**Goal**:` formats (covers regex fix)
- [ ] `tests/commands.test.cjs` — add test that `commands/gsd/autonomous.md` has valid frontmatter fields (name, description, argument-hint)
- [ ] `tests/copilot-install.test.cjs` — add test that `autonomous.md` converts to `gsd-autonomous` skill correctly

## Sources

### Primary (HIGH confidence)
- **Source code:** `commands/gsd/new-milestone.md`, `discuss-phase.md`, `plan-phase.md`, `execute-phase.md` — command file pattern analysis
- **Source code:** `get-shit-done/workflows/new-milestone.md`, `discuss-phase.md`, `execute-phase.md` — workflow structure analysis
- **Source code:** `get-shit-done/bin/lib/roadmap.cjs` — `cmdRoadmapAnalyze` and `cmdRoadmapGetPhase` implementations
- **Source code:** `bin/install.js:1320-1363` — `copyCommandsAsCopilotSkills` function confirming auto-skill generation
- **Source code:** `bin/install.js:510-537` — `convertClaudeCommandToCopilotSkill` function confirming frontmatter conversion
- **CLI output:** `gsd-tools.cjs roadmap analyze` — live output showing null goal/depends_on fields
- **CLI output:** `gsd-tools.cjs roadmap get-phase 5` — live output showing section text contains goal despite null field

### Secondary (MEDIUM confidence)
- **Source code:** `get-shit-done/references/ui-brand.md` — banner formatting conventions
- **Source code:** `tests/roadmap.test.cjs`, `tests/copilot-install.test.cjs` — existing test patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already exist in the project, verified by source code reading
- Architecture: HIGH — patterns extracted from 31 commands and 25 workflows by direct inspection
- Pitfalls: HIGH — regex bug confirmed by live CLI testing showing null output
- Phase discovery: HIGH — `roadmap analyze` JSON structure verified by live execution

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable project conventions, no external dependencies)
